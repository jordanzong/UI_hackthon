/* SPHEREx dynamic Analysis Run browser.
 * This does not synthesize data: run lists come from science-runs/index.json,
 * each run's media and source IDs come from its own manifest only.
 * Existing Notebook Science Results remain untouched for prior analyses. */
(() => {
'use strict';
const base=new URL('./science-runs/index.json',document.baseURI);
const panel=document.getElementById('pbody');
if(!panel)return;
// One canonical Science Results section replaces both previous science panels.
const scienceSection=document.createElement('section');
scienceSection.className='sec';scienceSection.id='nr-explorer';
scienceSection.innerHTML='<details id="nr-details" open><summary id="nr-heading">科學分析 / Science Results</summary><div class="nr-body"></div></details>';
panel.insertBefore(scienceSection,document.getElementById('layers')?.closest('.sec')||null);
const root=scienceSection.querySelector('.nr-body');
const BANDS=[
 'D1','D2','D3','D4','D5','D6',
 'D1+D2+D3','D4+D5+D6','D1+D2+D3+D4+D5+D6'
];
const TARGETS=[
 ['WISE_0855','WISE 0855'],['Barnards_Star',"Barnard's Star"],
 ['Epsilon_Indi_B','Epsilon Indi B'],['RW_Aurigae','RW Aurigae'],
 ['R_Draconis','R Draconis']
];
const META=[
 {id:'WISE_0855',name:'WISE 0855',ra:133.78948309791494,dec:-7.24294039128244,aliases:['WISE 0855','WISE 0855-0714']},
 {id:'Barnards_Star',name:"Barnard's Star",ra:269.45207696,dec:4.69336497,aliases:["Barnard's Star",'Barnards Star','GJ 699']},
 {id:'Epsilon_Indi_B',name:'Epsilon Indi B',ra:331.04414659,dec:-56.78284420,aliases:['Epsilon Indi B','eps Ind B']},
 {id:'RW_Aurigae',name:'RW Aurigae',ra:76.95652603,dec:30.40143817,aliases:['RW Aurigae','RW Aur']},
 {id:'R_Draconis',name:'R Draconis',ra:248.16761083,dec:66.75497942,aliases:['R Draconis','R Dra']}
];
const state={
 target:'WISE_0855',
 band:'D1',run:'',manifest:null,index:null,mode:'gif',source:'',
 group:'gif',plot:'groups',failure:'',loading:false,request:0
};
const el=document.createElement('section');
el.id='science-run-browser';el.setAttribute('aria-label','Analysis Run Browser');
el.innerHTML=[
 '<div class="srb-heading"><strong>VERIFIED ANALYSIS RUNS <small>SCIENCE DATA</small></strong>',
 '<span id="srb-counter">0 / 45</span></div>',
 '<p class="srb-sub">5 Targets × 9 Bandpass · 每組分析獨立載入，不共用 Source ID</p>',
 '<label class="srb-label" for="srb-target">Target / 研究目標</label><select id="srb-target"></select>',
 '<div class="srb-search"><input id="srb-query" type="search" placeholder="Name / alias · GJ 699 · RW Aur" aria-label="Search target name"><button id="srb-find" class="btn sm" type="button">搜尋</button></div>',
 '<div class="srb-target-where"><label>RA (°)<input id="srb-ra" type="number" min="0" max="360" step="any"></label><label>Dec (°)<input id="srb-dec" type="number" min="-90" max="90" step="any"></label></div>',
 '<button id="srb-go" type="button" class="btn sm srb-go">前往天球座標 / Go to sky</button>',
 '<p id="srb-lookup" class="srb-status" role="status" aria-live="polite"></p>',
 '<label class="srb-label" for="srb-band">Bandpass / 時間分組使用波段</label><select id="srb-band"></select>',
 '<label class="srb-label" for="srb-version">Analysis Run (gap / span / version)</label>',
 '<select id="srb-version"></select>',
 '<p id="srb-status" class="srb-status" role="status" aria-live="polite"></p>',
 '<div id="srb-media" hidden>',
 '<div class="srb-actions"><button id="srb-gif" class="btn sm" type="button">GIF / Stack</button>',
 '<button id="srb-sed" class="btn sm" type="button">SED</button>',
 '<button id="srb-viewer" class="btn sm" type="button">Open Viewer</button></div>',
 '<div id="srb-groups"><label class="srb-label" for="srb-group">Group / Epoch</label>',
 '<select id="srb-group"></select></div>',
 '<div id="srb-sources" hidden><label class="srb-label" for="srb-source">Source ID (within this Run)</label>',
 '<select id="srb-source"></select><label class="srb-label" for="srb-plot">SED figure</label>',
 '<select id="srb-plot"><option value="groups">By time group</option>',
 '<option value="evolution">Epoch-to-epoch evolution</option></select>',
 '<button id="srb-locate" type="button" class="btn sm">定位此 Run 的 Source / Locate Source</button><p id="srb-source-info" class="srb-caption"></p></div>',
 '<div class="srb-frame"><img id="srb-image" alt="Verified SPHEREx analysis output" loading="lazy">',
 '<p id="srb-empty" hidden></p></div>',
 '<a id="srb-open" href="#" target="_blank" rel="noopener noreferrer">Open original image</a>',
 '<p id="srb-caption" class="srb-caption"></p>',
 '</div>',
 '<p class="srb-foot">Missing outputs remain unavailable. A marked GIF is a rendered visualization;',
 ' its embedded annotations are not independently clickable sky coordinates.</p>'
].join('');
root.prepend(el);
const $=id=>document.getElementById(id);
const zh=()=>String(document.documentElement.lang||'zh').startsWith('zh');
const tr=(zhText,enText)=>zh()?zhText:enText;
const targetName=id=>TARGETS.find(x=>x[0]===id)?.[1]||id;
const targetMeta=id=>META.find(x=>x.id===id)||META[0];
function syncTargetCoordinates(){
 const t=targetMeta(state.target);
 $('srb-ra').value=String(t.ra);$('srb-dec').value=String(t.dec);
}
function goToSky(ra,dec){
 const a=Number(ra),d=Number(dec);
 if(!Number.isFinite(a)||a<0||a>=360||!Number.isFinite(d)||d< -90||d>90){
  $('srb-lookup').textContent=tr('RA / Dec 不在有效範圍。','Invalid RA / Dec.');
  return false;
 }
 const ok=window.SkyAtlas?.goToCoordinates?.({ra_deg:a,dec_deg:d,fov_deg:2});
 $('srb-lookup').textContent=ok
  ?tr('已定位參考座標；不代表偵測證據。','Reference location selected; not a detection.')
  :tr('目前無法定位。','Sky navigation unavailable.');
 return !!ok;
}
for(const [id,name] of TARGETS){
 const op=document.createElement('option');op.value=id;op.textContent=name;$('srb-target').append(op);
}
for(const id of BANDS){
 const op=document.createElement('option');op.value=id;op.textContent=id.replaceAll('+',' + ');$('srb-band').append(op);
}
$('srb-target').value=state.target;
syncTargetCoordinates();
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
 $('srb-media').hidden=true;
 $('srb-image').removeAttribute('src');
 $('srb-open').hidden=true;
 status(message);clearCatalog();
}
async function refreshRun(){
 const token=++state.request;
 state.manifest=null;state.source='';state.group='gif';state.mode='gif';state.plot='groups';
 repaintOptions();
 const run=runsFor(state.target,state.band).find(x=>x.run_id===state.run);
 if(!run){
  const targetInfo=state.index?.targets?.find(x=>x.target_id===state.target);
  const revision=targetInfo?.publication_status==='photometry_under_revision'||
                 state.target==='R_Draconis';
  drawMissing(revision
   ?tr('R Draconis 測光結果正在修正，目前不提供分析影像或 SED。',
       'R Draconis photometry is under revision; analysis images and SED are withheld.')
   :tr('此 Target / Bandpass 尚未匯出 Analysis Run，等待後端提供。',
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
   ...raw,product:{...p,frames,seds,blink_url:resolved(p.blink_url,url)},
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
 syncTargetCoordinates();$('srb-lookup').textContent='';
 const first=state.index?.targets?.find(x=>x.target_id===value)?.runs?.[0];
 if(first?.band_id&&BANDS.includes(first.band_id))state.band=first.band_id;
 refreshRun();
}
function sourceIds(p){
 const set=new Set((p.seds||[]).map(x=>String(x.source_id)));
 return Array.from(set).sort((a,b)=>Number(a)-Number(b));
}
function render(){
 const m=state.manifest;
 if(!m){$('srb-media').hidden=true;return;}
 const p=m.product,availableImages=!!p.blink_url||p.frames.some(f=>f.image_url);
 const ids=sourceIds(p),hasSED=ids.length>0;
 $('srb-media').hidden=false;
 if(!availableImages&&state.mode==='gif'&&hasSED)state.mode='sed';
 if(!hasSED&&state.mode==='sed'&&availableImages)state.mode='gif';
 $('srb-gif').disabled=!availableImages;
 $('srb-sed').disabled=!hasSED;
 $('srb-viewer').disabled=!availableImages;
 $('srb-groups').hidden=state.mode!=='gif'||!p.frames.length;
 $('srb-sources').hidden=state.mode!=='sed'||!hasSED;
 const groupSelect=$('srb-group');groupSelect.replaceChildren();
 const gifOption=document.createElement('option');gifOption.value='gif';
 gifOption.textContent=p.gif_annotation==='algorithm-candidates'
  ?tr('播放候選標記 GIF','Play candidate-marked GIF')
  :tr('播放 Source 標記 GIF','Play source-annotated GIF');
 if(p.blink_url)groupSelect.append(gifOption);
 p.frames.forEach((f,i)=>{
  const op=document.createElement('option');op.value=String(i);
  op.textContent=f.label||'Group '+(i+1);
  if(f.mjd!=null)op.textContent+=' · MJD '+Number(f.mjd).toFixed(2);
  groupSelect.append(op);
 });
 if(state.group==='gif'&&!p.blink_url)state.group=0;
 if(typeof state.group==='number'&&state.group>=p.frames.length)state.group=0;
 groupSelect.value=String(state.group);
 const chosen=ids.includes(state.source)?state.source:ids[0]||'';
 state.source=chosen;
 const sel=$('srb-source');sel.replaceChildren();
 for(const id of ids){const o=document.createElement('option');o.value=id;o.textContent='Source '+id;sel.append(o);}
 sel.value=chosen;
 const source=m.sources.find(s=>String(s.source_id)===chosen);
 $('srb-locate').disabled=!source||!Number.isFinite(Number(source.ra_deg))||!Number.isFinite(Number(source.dec_deg));
 $('srb-source-info').textContent=source
  ?'Source '+chosen+' · RA '+Number(source.ra_deg).toFixed(6)+'° · Dec '+Number(source.dec_deg).toFixed(6)+'°'+
   (source.best_snr!=null?' · SNR '+Number(source.best_snr).toFixed(2):'')
  :tr('沒有已驗證的來源座標。','No source coordinates supplied.');
 $('srb-plot').value=state.plot;
 let url=null,caption='',sourceCaption='';
 if(state.mode==='sed'){
  const source=p.seds.find(s=>String(s.source_id)===state.source);
  const candidate=m.candidates.find(c=>String(c.source_id)===state.source);
  url=source?.plots?.[state.plot]||null;
  if(!url&&source?.plots){
   const first=Object.values(source.plots).find(Boolean);
   url=first||null;
  }
  caption='Source '+state.source+' · '+state.band+' · '+state.run+
   ' · '+tr('時間分組使用選定波段；SED 取自六波段測光','Run grouping uses selected bands; SED uses six-band photometry');
  if(candidate?.types?.length)sourceCaption=
   ' · '+tr('演算法候選','Algorithm candidate')+': '+candidate.types.join(', ');
 }else{
  const pick=p.frames[state.group];
  url=state.group==='gif'?p.blink_url:(pick?.image_url||p.blink_url);
  caption=targetName(state.target)+' · '+state.band+' · '+state.run+
   (state.group==='gif'?' · GIF ('+
     (p.gif_annotation==='algorithm-candidates'?'candidate labels':'source labels')+')':
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
 state.mode='gif';state.group=state.manifest?.product?.blink_url?'gif':0;render();
};
$('srb-sed').onclick=()=>{state.mode='sed';render();};
$('srb-group').onchange=e=>{state.group=e.target.value==='gif'?'gif':Number(e.target.value);render();};
$('srb-source').onchange=e=>{state.source=e.target.value;render();};
$('srb-plot').onchange=e=>{state.plot=e.target.value;render();};
$('srb-viewer').onclick=()=>{
 const m=state.manifest;if(!m||!window.SPHERExViewer?.setData)return;
 const p=m.product;
 const images=p.frames.filter(f=>!!f.image_url);
 const frames=images.length?images:(p.blink_url?[{
  frame_id:'marked_gif',label:'Marked GIF composite',image_url:p.blink_url
 }]:[]);
 if(!frames.length)return;
 const t=window.SPHERExNotebookResults?.targets?.find(x=>x.id===state.target);
 window.SPHERExViewer.setData({
  field_id:state.target+'_'+state.run,status:'ready',
  target_name:targetName(state.target),
  center:t?{ra_deg:t.ra_deg,dec_deg:t.dec_deg}:undefined,
  frames,sources:m.sources,
  notice:'Analysis Run: '+state.run+
   '. Algorithm mover/variable flags are candidates, not confirmed objects. '+
   (p.gif_annotation==='algorithm-candidates'?
      'Algorithm candidate labels in GIF are baked-in. ':
      'Source-number labels in GIF are baked-in. ')+
   'No pixel-accurate overlays are inferred.'
 });
};
$('srb-image').addEventListener('error',()=>{
 const image=$('srb-image'),missing=$('srb-empty');
 image.hidden=true;missing.hidden=false;
 missing.textContent=tr('此圖片尚未成功發布或無法讀取。','This image is not yet published or could not be loaded.');
 status(tr('圖片載入失敗，請檢查 GitHub Pages 檔案位置。','Image failed. Check deployed GitHub Pages paths.'));
});
$('srb-go').onclick=()=>goToSky($('srb-ra').value,$('srb-dec').value);
function searchTarget(){
 const key=$('srb-query').value.toLowerCase().replace(/[^a-z0-9]/g,'');
 if(!key)return;
 const result=META.filter(x=>[x.name,x.id,...x.aliases].some(a=>
  a.toLowerCase().replace(/[^a-z0-9]/g,'').includes(key)));
 if(result.length===1){selectTarget(result[0].id);$('srb-lookup').textContent='Target: '+result[0].name;}
 else $('srb-lookup').textContent=result.length
  ?tr('多個目標符合，請使用上方選單。','Multiple matching targets; use menu.')
  :tr('未找到目標，可輸入 RA / Dec 導航。','No matching target; use RA / Dec.');
}
$('srb-find').onclick=searchTarget;
$('srb-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchTarget();}});
$('srb-locate').onclick=()=>{
 const s=state.manifest?.sources?.find(x=>String(x.source_id)===state.source);
 if(s)goToSky(s.ra_deg,s.dec_deg);
};
window.SPHERExScienceRuns={
 reload:loadIndex,
 current:()=>({target:state.target,band:state.band,run:state.run,loaded:!!state.manifest}),
 selectTarget,selectBand,
 getIndex:()=>state.index
};
// Metadata compatibility for atlas object search; no old Notebook Results UI or sample products.
window.SPHERExNotebookResults={
 targets:META.map(t=>({id:t.id,name:t.name,ra_deg:t.ra,dec_deg:t.dec})),
 selectTarget,selectBand,
 goToCoordinates:goToSky,navigate:goToSky,
 current:()=>({target:state.target,band:state.band,run:state.run,source_id:state.source}),
 getProducts:id=>[...new Set((state.index?.targets?.find(t=>t.target_id===(id||state.target))?.runs||[]).map(r=>r.band_id))]
};
loadIndex();
})();