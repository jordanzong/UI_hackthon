/* SPHEREx dynamic Analysis Run browser.
 * This does not synthesize data: run lists come from science-runs/index.json,
 * each run's media and source IDs come from its own manifest only.
 * Existing Notebook Science Results remain untouched for prior analyses. */
(() => {
'use strict';
const base=new URL('./science-runs/index.json',document.baseURI);
const root=document.querySelector('#nr-explorer .nr-body');
if(!root)return;
const BANDS=[
 'D1','D2','D3','D4','D5','D6',
 'D1+D2+D3','D4+D5+D6','D1+D2+D3+D4+D5+D6'
];
const TARGETS=[
 ['WISE_0855','WISE 0855'],['Barnards_Star',"Barnard's Star"],
 ['Epsilon_Indi_B','Epsilon Indi B'],['RW_Aurigae','RW Aurigae'],
 ['R_Draconis','R Draconis']
];
const state={
 target:window.SPHERExNotebookResults?.current?.().target||'Epsilon_Indi_B',
 band:'D1',run:'',manifest:null,index:null,mode:'stack',source:'',
 group:'overview',plot:'groups',failure:'',loading:false,request:0
};
const el=document.createElement('section');
el.id='science-run-browser';el.setAttribute('aria-label','Analysis Run Browser');
el.innerHTML=[
 '<div class="srb-heading"><strong>ANALYSIS RUNS <small>NEW BACKEND</small></strong>',
 '<span id="srb-counter">0 / 45</span></div>',
 '<p class="srb-sub">5 Targets × 9 Bandpass · 每組分析獨立載入，不共用 Source ID</p>',
 '<label class="srb-label" for="srb-target">Target</label><select id="srb-target"></select>',
 '<label class="srb-label" for="srb-band">Bandpass</label><select id="srb-band"></select>',
 '<label class="srb-label" for="srb-version">Analysis Run (gap / span / version)</label>',
 '<select id="srb-version"></select>',
 '<p id="srb-status" class="srb-status" role="status" aria-live="polite"></p>',
 '<div id="srb-media" hidden>',
 '<div class="srb-actions"><button id="srb-gif" class="btn sm" type="button">Group Stack</button>',
 '<button id="srb-animation" class="btn sm" type="button">一般 GIF</button>',
 '<button id="srb-marked" class="btn sm" type="button">Marker GIF</button>',
 '<button id="srb-sed" class="btn sm" type="button">SED</button>',
 '<button id="srb-viewer" class="btn sm" type="button">Open Viewer</button></div>',
 '<div id="srb-groups"><label class="srb-label" for="srb-group">Group / Epoch</label>',
 '<select id="srb-group"></select></div>',
 '<div id="srb-sources" hidden><label class="srb-label" for="srb-source">Source ID (within this Run)</label>',
 '<select id="srb-source"></select><label class="srb-label" for="srb-plot">SED figure</label>',
 '<select id="srb-plot"><option value="groups">By time group</option>',
 '<option value="evolution">Epoch-to-epoch evolution</option></select></div>',
 '<div class="srb-frame"><img id="srb-image" alt="Verified SPHEREx analysis output" loading="lazy">',
 '<p id="srb-empty" hidden></p></div>',
 '<a id="srb-open" href="#" target="_blank" rel="noopener noreferrer">Open original image</a>',
 '<p id="srb-caption" class="srb-caption"></p>',
 '</div>',
 '<p class="srb-foot">Only published real PNG/FITS-derived results appear. Source markers in static PNGs are baked into the image; positional overlays require separately validated pixel coordinates.</p>'
].join('');
root.prepend(el);
const $=id=>document.getElementById(id);
const zh=()=>String(document.documentElement.lang||'zh').startsWith('zh');
const tr=(zhText,enText)=>zh()?zhText:enText;
const targetName=id=>TARGETS.find(x=>x[0]===id)?.[1]||id;
for(const [id,name] of TARGETS){
 const op=document.createElement('option');op.value=id;op.textContent=name;$('srb-target').append(op);
}
for(const id of BANDS){
 const op=document.createElement('option');op.value=id;op.textContent=id.replaceAll('+',' + ');$('srb-band').append(op);
}
$('srb-target').value=state.target;
const resolved=(path,origin)=>{
 if(typeof path!=='string'||!path)return null;
 const url=new URL(path,origin);
 if(!['http:','https:'].includes(url.protocol))throw Error('Invalid media URL protocol');
 if(url.origin!==base.origin)throw Error('Cross-origin media is not allowed in published runs');
 return url.href;
};
function runsFor(target,band){
 const entry=state.index?.targets?.find(x=>x.target_id===target);
 return (entry?.runs||[]).filter(x=>x.band_id===band&&typeof x.manifest_url==='string'
  &&/^[A-Za-z0-9_+./-]+\.json$/.test(x.manifest_url)
  &&!x.manifest_url.includes('..'));
}
function status(message){$('srb-status').textContent=message;}
function repaintOptions(){
 $('srb-target').value=state.target;$('srb-band').value=state.band;
 const available=state.index?.targets?.reduce((n,t)=>n+(t.runs?.length||0),0)||0;
 $('srb-counter').textContent=available+' / 45 '+tr('預期分析組合','planned combinations');
 for(const op of $('srb-band').options){
  const n=runsFor(state.target,op.value).length;
  op.textContent=op.value.replaceAll('+',' + ')+(n?' · '+n+' Run':' · —');
 }
 const items=runsFor(state.target,state.band);
 if(!items.some(x=>x.run_id===state.run))state.run=items[0]?.run_id||'';
 const runSelect=$('srb-version');runSelect.replaceChildren();
 if(!items.length){
  const opt=document.createElement('option');opt.value='';opt.textContent=tr('尚未提供分析結果','No analysis run provided');runSelect.append(opt);
  runSelect.disabled=true;
 }else{
  for(const x of items){
   const o=document.createElement('option');o.value=x.run_id;
   o.textContent=x.run_id+(x.has_gif?' · GIF':'')+(x.sed_count?' · SED '+x.sed_count:'');
   runSelect.append(o);
  }
  runSelect.disabled=false;
 }
 runSelect.value=state.run;
}
function clearCatalog(){
 // Never leave a previous analysis run's source detections on the sky.
 if(window.SPHERExCatalog?.clear)window.SPHERExCatalog.clear({target_id:state.target,origin:'analysis-run'});
}
function drawMissing(message){
 $('srb-media').hidden=true;status(message);clearCatalog();
}
async function refreshRun(){
 const token=++state.request;
 state.manifest=null;state.source='';state.group='overview';state.mode='stack';state.plot='groups';
 repaintOptions();
 const run=runsFor(state.target,state.band).find(x=>x.run_id===state.run);
 if(!run){
  drawMissing(tr('此 Target / Bandpass 尚未匯出 Analysis Run，等待後端提供。',
                 'This target/bandpass has no published Analysis Run yet.'));
  return;
 }
 state.loading=true;status(tr('正在載入 ','Loading ')+state.run+'…');$('srb-media').hidden=true;clearCatalog();
 try{
  const url=resolved(run.manifest_url,base);
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('Analysis Run Manifest HTTP '+response.status);
  const raw=await response.json();
  if(token!==state.request)return;
  if(raw.target_id!==state.target||raw.run_id!==state.run||raw.band_id!==state.band)
    throw Error('Run manifest identity mismatch; refusing cross-target/run images');
  const p=raw.bands?.[state.band];
  if(!p||typeof p!=='object')throw Error('Run has no selected band product');
  const frames=(Array.isArray(p.frames)?p.frames:[]).map(f=>({
    ...f,image_url:resolved(f.image_url,url)
  }));
  const seds=(Array.isArray(p.seds)?p.seds:[]).map(s=>({
    ...s,source_id:String(s.source_id),
    plots:Object.fromEntries(Object.entries(s.plots||{}).map(([k,path])=>[k,resolved(path,url)]))
  }));
  const validated={
   ...raw,product:{...p,frames,seds,blink_url:null,
    animation_url:resolved(p.animation_url||p.blink_url,url),
    marked_gif_url:resolved(p.marked_gif_url,url),
    overview_url:resolved(p.overview_url,url),diagnostic_url:resolved(p.diagnostic_url,url)},
   manifest_url:url,sources:Array.isArray(raw.sources)?raw.sources:[],
   candidates:Array.isArray(raw.candidates)?raw.candidates:[]
  };
  state.manifest=validated;
  if(validated.sources.length){
   window.SPHERExCatalog?.setSources?.(validated.sources,{origin:'analysis-run',target_id:state.target});
  }
  state.loading=false;render();
 }catch(e){
  if(token!==state.request)return;
  state.loading=false;drawMissing(tr('載入失敗：','Load failed: ')+String(e.message||e));
 }
}
function selectRun(value){state.run=value;refreshRun();}
function selectBand(value){if(!BANDS.includes(value))return;state.band=value;state.run='';refreshRun();}
function selectTarget(value){
 if(!TARGETS.some(x=>x[0]===value))return;
 state.target=value;state.run='';
 const first=state.index?.targets?.find(x=>x.target_id===value)?.runs?.[0];
 if(first?.band_id&&BANDS.includes(first.band_id))state.band=first.band_id;
 window.SPHERExNotebookResults?.selectTarget?.(value);
 refreshRun();
}
function sourceIds(p){
 const set=new Set((p.seds||[]).map(x=>String(x.source_id)));
 return Array.from(set).sort((a,b)=>Number(a)-Number(b));
}
function render(){
 const m=state.manifest;
 if(!m){$('srb-media').hidden=true;return;}
 const p=m.product,availableStacks=!!p.overview_url||!!p.diagnostic_url||p.frames.some(f=>f.image_url);
 const hasAnyImage=availableStacks||!!p.animation_url||!!p.marked_gif_url;
 const ids=sourceIds(p),hasSED=ids.length>0;
 $('srb-media').hidden=false;
 if(state.mode==='stack'&&!availableStacks)
  state.mode=p.animation_url?'animation':p.marked_gif_url?'marked':hasSED?'sed':'stack';
 if(state.mode==='animation'&&!p.animation_url)
  state.mode=availableStacks?'stack':p.marked_gif_url?'marked':hasSED?'sed':'stack';
 if(state.mode==='marked'&&!p.marked_gif_url)
  state.mode=availableStacks?'stack':p.animation_url?'animation':hasSED?'sed':'stack';
 if(state.mode==='sed'&&!hasSED)
  state.mode=availableStacks?'stack':p.animation_url?'animation':p.marked_gif_url?'marked':'sed';
 $('srb-gif').disabled=!availableStacks;
 $('srb-animation').disabled=!p.animation_url;
 $('srb-marked').disabled=!p.marked_gif_url;
 $('srb-marked').title=p.marked_gif_url?'':tr('標記 GIF 製作中','Marked GIF not yet published');
 $('srb-sed').disabled=!hasSED;
 $('srb-viewer').disabled=!hasAnyImage;
 $('srb-groups').hidden=state.mode!=='stack'||!availableStacks;
 $('srb-sources').hidden=state.mode!=='sed'||!hasSED;
 const groupSelect=$('srb-group');groupSelect.replaceChildren();
 if(p.overview_url){
  const o=document.createElement('option');o.value='overview';
  o.textContent=tr('所有 Group／Source 總覽','Overview: all groups / sources');
  groupSelect.append(o);
 }
 if(p.diagnostic_url){
  const o=document.createElement('option');o.value='diagnostic';
  o.textContent=tr('時間分組診斷圖','Time grouping diagnostic');groupSelect.append(o);
 }
 p.frames.forEach((f,i)=>{
  const op=document.createElement('option');op.value=String(i);
  op.textContent=f.label||'Group '+(i+1);
  if(f.mjd!=null)op.textContent+=' · MJD '+Number(f.mjd).toFixed(2);
  groupSelect.append(op);
 });
 const opts=Array.from(groupSelect.options).map(o=>o.value);
 if(!opts.includes(String(state.group)))state.group=opts.includes('overview')?'overview':(opts[0]||0);
 groupSelect.value=String(state.group);
 const chosen=ids.includes(state.source)?state.source:ids[0]||'';
 state.source=chosen;
 const sel=$('srb-source');sel.replaceChildren();
 for(const id of ids){const o=document.createElement('option');o.value=id;o.textContent='Source '+id;sel.append(o);}
 sel.value=chosen;
 $('srb-plot').value=state.plot;
 let url=null,caption='',sourceCaption='';
 if(state.mode==='animation'){
  url=p.animation_url;
  caption=targetName(state.target)+' · '+state.band+' · '+state.run+' · '+tr('一般 GIF（未驗證標記）','ordinary GIF (marker status unverified)');
 }else if(state.mode==='marked'){
  url=p.marked_gif_url;
  caption=targetName(state.target)+' · '+state.band+' · '+state.run+' · '+tr('Source Marker GIF','Source marker GIF');
 }else if(state.mode==='sed'){
  const source=p.seds.find(s=>String(s.source_id)===state.source);
  const candidate=m.candidates.find(c=>String(c.source_id)===state.source);
  url=source?.plots?.[state.plot]||null;
  if(!url&&source?.plots){
   const first=Object.values(source.plots).find(Boolean);
   url=first||null;
  }
  caption='Source '+state.source+' · '+state.band+' · '+state.run;
  if(candidate?.types?.length)sourceCaption=
   ' · '+tr('演算法候選','Algorithm candidate')+': '+candidate.types.join(', ');
 }else{
  const pick=typeof state.group==='number'?p.frames[state.group]:null;
  url=state.group==='overview'?p.overview_url:
      state.group==='diagnostic'?p.diagnostic_url:pick?.image_url||null;
  caption=targetName(state.target)+' · '+state.band+' · '+state.run+
   (state.group==='overview'?' · '+tr('總覽','Overview'):
    state.group==='diagnostic'?' · '+tr('時間分組診斷','Time grouping diagnostic'):
    ' · '+(pick?.label||'Group'));
  if(pick?.mjd!=null)caption+=' · MJD '+Number(pick.mjd).toFixed(3);
 }
 const img=$('srb-image'),empty=$('srb-empty'),open=$('srb-open');
 img.hidden=!url;empty.hidden=!!url;open.hidden=!url;
 if(url){if(img.getAttribute('src')!==url)img.src=url;open.href=url;}
 else{img.removeAttribute('src');empty.textContent=tr('該 Run 沒有此圖片','No image provided for this run');}
 $('srb-caption').textContent=caption+sourceCaption;
 status(targetName(state.target)+' · '+state.run+' · '+
   (p.frames.length+' Groups / '+ids.length+' SED Sources / '+m.candidates.length+
    ' '+tr('筆演算法候選','algorithm candidates'))+
   (p.marked_gif_url?' · Marker GIF '+tr('已提供','available'):' · Marker GIF '+tr('製作中','pending'))+
   (m.candidates.length?' · '+tr('尚未經科學確認','not independently verified'):''));
}
async function loadIndex(){
 status(tr('正在讀取後端分析索引…','Loading backend run index…'));
 try{
  const response=await fetch(base,{cache:'no-store'});
  if(!response.ok)throw Error('Index HTTP '+response.status);
  const index=await response.json();
  if(index.schema_version!=='spherex-science-runs-index/v1'||
     !Array.isArray(index.targets)||!Array.isArray(index.bands))
    throw Error('Unsupported analysis index schema');
  // The standard 9 combinations are always listed. Additional experimental
  // combinations (such as D5+D6) appear only if actually exported.
  for(const run of index.targets.flatMap(t=>Array.isArray(t.runs)?t.runs:[])){
   const b=String(run.band_id||'');
   const parts=b.split('+');
   if(BANDS.includes(b)||!parts.every(x=>/^D[1-6]$/.test(x))||
      new Set(parts).size!==parts.length||parts.join('+')!==parts.slice().sort().join('+'))continue;
   BANDS.push(b);
   const op=document.createElement('option');op.value=b;op.textContent=b.replaceAll('+',' + ')+' (exp)';
   $('srb-band').append(op);
  }
  state.index=index;
  const first=index.targets.find(x=>x.target_id===state.target)?.runs?.[0];
  if(first?.band_id&&BANDS.includes(first.band_id)&&!runsFor(state.target,state.band).length)
   state.band=first.band_id;
  repaintOptions();await refreshRun();
 }catch(e){
  state.failure=String(e.message||e);
  repaintOptions();
  drawMissing(tr('尚未部署可讀的科學分析索引：','Science index unavailable: ')+state.failure);
 }
}
$('srb-target').addEventListener('change',e=>selectTarget(e.target.value));
$('srb-band').addEventListener('change',e=>selectBand(e.target.value));
$('srb-version').addEventListener('change',e=>selectRun(e.target.value));
$('srb-gif').onclick=()=>{
 state.mode='stack';
 const p=state.manifest?.product;
 if(p?.overview_url)state.group='overview';
 else if(p?.frames?.length)state.group=0;
 else if(p?.diagnostic_url)state.group='diagnostic';
 render();
};
$('srb-animation').onclick=()=>{state.mode='animation';render();};
$('srb-marked').onclick=()=>{state.mode='marked';render();};
$('srb-sed').onclick=()=>{state.mode='sed';render();};
$('srb-group').onchange=e=>{
 state.group=/^\d+$/.test(e.target.value)?Number(e.target.value):e.target.value;render();
};
$('srb-source').onchange=e=>{state.source=e.target.value;render();};
$('srb-plot').onchange=e=>{state.plot=e.target.value;render();};
$('srb-viewer').onclick=()=>{
 const m=state.manifest;if(!m||!window.SPHERExViewer?.setData)return;
 const p=m.product;
 const images=p.frames.filter(f=>!!f.image_url);
 const frames=images.length?images:
  (p.overview_url?[{frame_id:'overview',label:'Stack overview PNG',image_url:p.overview_url}]:
   p.animation_url?[{frame_id:'animation',label:'Group animation',image_url:p.animation_url}]:
   p.marked_gif_url?[{frame_id:'marked',label:'Marked GIF',image_url:p.marked_gif_url}]:[]);
 if(!frames.length)return;
 const t=window.SPHERExNotebookResults?.targets?.find(x=>x.id===state.target);
 window.SPHERExViewer.setData({
  field_id:state.target+'_'+state.run,status:'ready',
  center:t?{ra_deg:t.ra_deg,dec_deg:t.dec_deg}:undefined,
  frames,sources:m.sources,
  notice:'Analysis Run: '+state.run+
   '. Algorithm mover/variable flags are candidates, not confirmed objects. '+
   'Static PNGs contain baked-in labels; no pixel-accurate overlays are inferred.'
 });
};
$('srb-image').addEventListener('error',()=>{
 status(tr('圖片載入失敗，請檢查 GitHub Pages 檔案位置。','Image failed. Check deployed GitHub Pages paths.'));
});
const legacy=$('nr-target');
legacy?.addEventListener('change',()=>{
 const id=legacy.value;
 if(id===state.target)return;
 state.target=id;state.run='';refreshRun();
});
window.SPHERExScienceRuns={
 reload:loadIndex,
 current:()=>({target:state.target,band:state.band,run:state.run,loaded:!!state.manifest}),
 selectTarget,selectBand,
 getIndex:()=>state.index
};
loadIndex();
})();