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
// Put science discovery first; the section counter now labels it 01.
panel.insertBefore(scienceSection,panel.firstElementChild);
const root=scienceSection.querySelector('.nr-body');
const BANDS=[
 'D1','D2','D3','D4','D5','D6',
 'D1+D2+D3','D4+D5+D6','D1+D2+D3+D4+D5+D6'
];
// Matrix column labels drop the shared "D" prefix (shown once in the corner).
const BAND_SHORT={'D1+D2+D3':'1–3','D4+D5+D6':'4–6','D1+D2+D3+D4+D5+D6':'1–6'};
const shortBand=b=>BAND_SHORT[b]||b.replace(/D/g,'');
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
// Suggested first run for new visitors: all six bands, most time groups.
const RECOMMENDED={target:'Barnards_Star',band:'D1+D2+D3+D4+D5+D6'};
const SKY_CONTEXT_FOV=10;
const state={
 target:'WISE_0855',
 band:'D1',run:'',manifest:null,index:null,mode:'gif',source:'',
 group:'gif',plot:'evolution',failure:'',loading:false,request:0
};
const el=document.createElement('section');
el.id='science-run-browser';el.setAttribute('aria-label','Analysis Run Browser');
el.innerHTML=[
 '<div class="srb-intro"><p id="srb-intro-text"></p>',
 '<button id="srb-recommend" type="button" class="btn primary sm"></button></div>',
 '<div class="srb-heading"><strong id="srb-title"></strong>',
 '<span id="srb-counter">0 / 45</span></div>',
 '<div id="srb-matrix" role="group" aria-labelledby="srb-title"></div>',
 '<p id="srb-legend" class="srb-sub"></p>',
 // Hidden selects keep keyboard/API compatibility; the matrix drives them.
 '<div class="srb-hidden-selects" hidden>',
 '<label class="srb-label" for="srb-target" id="srb-target-label"></label><select id="srb-target"></select>',
 '<label class="srb-label" for="srb-band" id="srb-band-label"></label><select id="srb-band"></select></div>',
 '<div class="srb-selected"><span id="srb-selected-name"></span>',
 '<div class="srb-target-where"><label><span>RA (°)</span><input id="srb-ra" type="number" min="0" max="360" step="any"></label><label><span>Dec (°)</span><input id="srb-dec" type="number" min="-90" max="90" step="any"></label></div>',
 '<button id="srb-go" type="button" class="btn sm srb-go"></button></div>',
 '<p id="srb-lookup" class="srb-status" role="status" aria-live="polite"></p>',
 '<div id="srb-version-wrap" hidden><label class="srb-label" for="srb-version" id="srb-version-label"></label>',
 '<select id="srb-version"></select></div>',
 '<p id="srb-status" class="srb-status" role="status" aria-live="polite"></p>',
 '<div id="srb-media" hidden>',
 '<div class="srb-tabs" role="tablist" aria-label="Analysis outputs">',
 '<button id="srb-gif" role="tab" type="button">GIF / Group</button>',
 '<button id="srb-stack" role="tab" type="button">STACK</button>',
 '<button id="srb-sed" role="tab" type="button">SED</button>',
 '<button id="srb-diagnostic" role="tab" type="button">Time Grouping</button></div>',
 '<div id="srb-groups"><label class="srb-label" for="srb-group" id="srb-group-label"></label>',
 '<select id="srb-group"></select></div>',
 '<div id="srb-sources" hidden><label class="srb-label" for="srb-source" id="srb-source-label"></label>',
 '<select id="srb-source"></select><label class="srb-label" for="srb-plot" id="srb-plot-label"></label>',
 '<select id="srb-plot"><option value="evolution">Epoch-to-epoch evolution</option>',
 '<option value="groups">By time group</option></select>',
 '<button id="srb-locate" type="button" class="btn sm"></button><p id="srb-source-info" class="srb-caption"></p></div>',
 '<div class="srb-frame" role="tabpanel"><img id="srb-image" alt="Verified SPHEREx analysis output" loading="lazy">',
 '<p id="srb-empty" hidden></p></div>',
 '<div class="srb-media-actions"><a id="srb-open" class="btn primary" href="#" target="_blank" rel="noopener noreferrer"></a>',
 '<button id="srb-viewer" class="btn sm" type="button"></button></div>',
 '<p id="srb-caption" class="srb-caption"></p>',
 '</div>',
 '<details class="srb-info"><summary id="srb-info-summary"></summary><ul id="srb-info-list"></ul></details>'
].join('');
root.prepend(el);
const $=id=>document.getElementById(id);
const zh=()=>String(document.documentElement.lang||'zh').startsWith('zh');
const tr=(zhText,enText)=>zh()?zhText:enText;
const targetName=id=>TARGETS.find(x=>x[0]===id)?.[1]||id;
const targetMeta=id=>META.find(x=>x.id===id)||META[0];
const urlHasView=()=>{const p=new URLSearchParams(window.location.search);return ['ra','dec','fov'].every(k=>p.has(k));};
function syncTargetCoordinates(){
 const t=targetMeta(state.target);
 $('srb-ra').value=String(t.ra);$('srb-dec').value=String(t.dec);
 $('srb-selected-name').textContent=t.name;
}
function goToSky(ra,dec,fov=2,label){
 const a=Number(ra),d=Number(dec);
 if(!Number.isFinite(a)||a<0||a>=360||!Number.isFinite(d)||d< -90||d>90){
  $('srb-lookup').textContent=tr('RA / Dec 不在有效範圍。','Invalid RA / Dec.');
  return false;
 }
 const ok=window.SkyAtlas?.goToCoordinates?.({ra_deg:a,dec_deg:d,fov_deg:fov});
 $('srb-lookup').textContent=ok
  ?(label?tr('已在星圖上標出 ','Marked on the sky: ')+label:tr('已移到此座標。','Moved to this coordinate.'))
  :tr('目前無法定位。','Sky navigation unavailable.');
 return !!ok;
}
// Keep the live sky pointed at the selected science target.
function focusTarget(){
 const t=targetMeta(state.target);
 return goToSky(t.ra,t.dec,SKY_CONTEXT_FOV,t.name);
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
function runLabel(x){
 const p=x.parameters||{};
 const parts=[];
 if(p.gap_days!=null)parts.push('gap '+p.gap_days+tr(' 天','d'));
 if(p.gap_days!=null||p.span_days!==undefined)parts.push('span '+(p.span_days==null?'∞':p.span_days+tr(' 天','d')));
 if(p.version)parts.push(p.version);
 return parts.length?parts.join(tr('，',', ')):x.run_id;
}
function status(message){$('srb-status').textContent=message;}
function revisionTarget(id){
 const info=state.index?.targets?.find(x=>x.target_id===id);
 return info?.publication_status==='photometry_under_revision';
}
function buildMatrix(){
 const grid=$('srb-matrix');grid.replaceChildren();
 grid.style.setProperty('--srb-cols',String(BANDS.length));
 const corner=document.createElement('span');corner.className='srb-mx-corner';corner.textContent=tr('波段 D','Band D');grid.append(corner);
 for(const b of BANDS){
  const h=document.createElement('span');h.className='srb-mx-col';h.textContent=shortBand(b);h.title=b.replaceAll('+',' + ');
  grid.append(h);
 }
 for(const [id,name] of TARGETS){
  const row=document.createElement('span');row.className='srb-mx-row';row.textContent=name;
  if(revisionTarget(id)){row.classList.add('revision');row.title=tr('測光修正中','Photometry under revision');}
  grid.append(row);
  for(const b of BANDS){
   const runs=runsFor(id,b);
   const cell=document.createElement('button');cell.type='button';cell.className='srb-mx-cell';
   cell.dataset.target=id;cell.dataset.band=b;
   const n=runs[0]?.group_count;
   cell.textContent=runs.length?(n?String(n):'•'):'';
   cell.disabled=!runs.length;
   cell.setAttribute('aria-label',name+tr('，',', ')+b.replaceAll('+',' + ')+tr('，',', ')+(runs.length
    ?runs.length+' Run'+(n?tr('，',', ')+n+tr(' 個時間分組',' time groups'):'')
    :tr('尚未發布','not published')));
   cell.title=cell.getAttribute('aria-label');
   cell.onclick=()=>selectCell(id,b);
   grid.append(cell);
  }
 }
 paintMatrix();
}
function paintMatrix(){
 for(const c of $('srb-matrix').querySelectorAll('.srb-mx-cell')){
  const on=c.dataset.target===state.target&&c.dataset.band===state.band;
  c.classList.toggle('selected',on);c.setAttribute('aria-pressed',String(on));
 }
 for(const r of $('srb-matrix').querySelectorAll('.srb-mx-row'))
  r.classList.toggle('selected',r.textContent===targetName(state.target));
}
function repaintOptions(){
 $('srb-target').value=state.target;$('srb-band').value=state.band;
 const available=state.index?.targets?.reduce((n,t)=>n+(t.runs?.length||0),0)||0;
 $('srb-counter').textContent=tr('已發布 ','')+available+' / 45'+tr(' 組',' published');
 for(const op of $('srb-band').options){
  const n=runsFor(state.target,op.value).length;
  op.textContent=op.value.replaceAll('+',' + ')+(n?' ('+n+' Run)':' (—)');
 }
 const items=runsFor(state.target,state.band);
 if(!items.some(x=>x.run_id===state.run))state.run=items[0]?.run_id||'';
 const runSelect=$('srb-version');runSelect.replaceChildren();
 for(const x of items){
  const o=document.createElement('option');o.value=x.run_id;o.textContent=runLabel(x);o.title=x.run_id;
  runSelect.append(o);
 }
 runSelect.disabled=items.length<2;
 // A version picker is only useful when one cell holds several runs.
 $('srb-version-wrap').hidden=items.length<2;
 runSelect.value=state.run;
 paintMatrix();
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
 state.manifest=null;state.source='';state.group='gif';state.mode='gif';state.plot='evolution';
 repaintOptions();
 const run=runsFor(state.target,state.band).find(x=>x.run_id===state.run);
 if(!run){
  drawMissing(revisionTarget(state.target)
   ?tr('R Draconis 測光結果正在修正，目前不提供分析影像或 SED。',
       'R Draconis photometry is under revision; analysis images and SED are withheld.')
   :tr('這個目標／波段組合還沒有發布分析結果。',
       'This target/bandpass has no published Analysis Run yet.'));
  return;
 }
 state.loading=true;status(tr('正在載入 ','Loading ')+targetName(state.target)+' '+state.band+'…');$('srb-media').hidden=true;clearCatalog();
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
  const viewerFrames=(Array.isArray(p.viewer_frames)?p.viewer_frames:[]).map(f=>({
    ...f,image_url:resolved(f.image_url,url)
  }));
  const plainFrames=(Array.isArray(p.plain_viewer_frames)?p.plain_viewer_frames:[]).map(f=>({
    ...f,image_url:resolved(f.image_url,url)
  }));
  const validated={
   ...raw,product:{...p,frames,seds,viewer_frames:viewerFrames,plain_viewer_frames:plainFrames,
    blink_url:resolved(p.blink_url,url),
    unmarked_blink_url:resolved(p.unmarked_blink_url,url),
    diagnostic_url:resolved(p.diagnostic_url,url),
    stack_url:resolved(p.stack_url,url)},
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
function selectTarget(value,opts={}){
 if(!TARGETS.some(x=>x[0]===value))return;
 const changed=value!==state.target;
 state.target=value;state.run='';
 syncTargetCoordinates();$('srb-lookup').textContent='';
 if(opts.band&&BANDS.includes(opts.band))state.band=opts.band;
 else{
  const first=state.index?.targets?.find(x=>x.target_id===value)?.runs?.[0];
  if(first?.band_id&&BANDS.includes(first.band_id))state.band=first.band_id;
 }
 if(changed&&opts.focus!==false)focusTarget();
 refreshRun();
}
function selectCell(target,band){
 if(target!==state.target)selectTarget(target,{band});
 else selectBand(band);
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
 const hasStack=!!p.stack_url,hasDiagnostic=!!p.diagnostic_url;
 $('srb-media').hidden=false;
 if(!availableImages&&state.mode==='gif'&&hasSED)state.mode='sed';
 if(!hasSED&&state.mode==='sed'&&availableImages)state.mode='gif';
 if(state.mode==='stack'&&!hasStack)state.mode='gif';
 if(state.mode==='diagnostic'&&!hasDiagnostic)state.mode='gif';
 $('srb-gif').disabled=!availableImages;
 $('srb-stack').disabled=!hasStack;
 $('srb-sed').disabled=!hasSED;
 $('srb-diagnostic').disabled=!hasDiagnostic;
 $('srb-viewer').disabled=!(p.blink_url||p.viewer_frames.length);
 for(const [id,mode] of [['srb-gif','gif'],['srb-stack','stack'],
                         ['srb-sed','sed'],['srb-diagnostic','diagnostic']]){
  $(id).setAttribute('aria-selected',String(state.mode===mode));
  $(id).tabIndex=state.mode===mode?0:-1;
 }
 $('srb-groups').hidden=state.mode!=='gif'||!p.frames.length;
 $('srb-sources').hidden=state.mode!=='sed'||!hasSED;
 const groupSelect=$('srb-group');groupSelect.replaceChildren();
 const gifOption=document.createElement('option');gifOption.value='gif';
 gifOption.textContent=p.gif_annotation==='algorithm-candidates'
  ?tr('播放動畫（演算法候選標記）','Play animation (algorithm-candidate labels)')
  :tr('播放全部時間分組動畫','Play all time groups');
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
 const where=targetName(state.target)+' '+state.band;
 if(state.mode==='diagnostic'){
  url=p.diagnostic_url;
  caption=tr('時間分組診斷圖 · ','Time grouping diagnostic · ')+where;
 }else if(state.mode==='stack'){
  url=p.stack_url;
  caption=tr('疊加影像總覽 · ','Stack overview · ')+where;
 }else if(state.mode==='sed'){
  const source=p.seds.find(s=>String(s.source_id)===state.source);
  const candidate=m.candidates.find(c=>String(c.source_id)===state.source);
  url=source?.plots?.[state.plot]||null;
  if(!url&&source?.plots){
   const first=Object.values(source.plots).find(Boolean);
   url=first||null;
  }
  caption='Source '+state.source+tr('，',', ')+where+
   tr('。','. ')+tr('時間分組使用選定波段；SED 取自六波段測光','grouping uses the selected bands; SED uses six-band photometry');
  if(candidate?.types?.length)sourceCaption=
   tr('。','. ')+tr('演算法候選','Algorithm candidate')+': '+candidate.types.join(', ');
 }else{
  const pick=p.frames[state.group];
  url=state.group==='gif'?p.blink_url:(pick?.image_url||p.blink_url);
  caption=where+tr('，',', ')+(state.group==='gif'?tr('時間分組動畫','time-group animation'):(pick?.label||'Group'));
  if(pick?.mjd!=null)caption+=tr('，',', ')+'MJD '+Number(pick.mjd).toFixed(3);
 }
 caption+=tr('（',' (')+state.run+tr('）',')');
 const img=$('srb-image'),empty=$('srb-empty'),open=$('srb-open');
 img.hidden=!url;empty.hidden=!!url;open.hidden=!url;
 if(url){if(img.getAttribute('src')!==url)img.src=url;open.href=url;}
 else{img.removeAttribute('src');empty.textContent=tr('該 Run 沒有此圖片','No image provided for this run');}
 $('srb-caption').textContent=caption+sourceCaption;
 const parts=[where,p.frames.length+tr(' 個時間分組',' time groups'),ids.length+tr(' 個來源 SED',' source SEDs')];
 if(m.candidates.length)parts.push(m.candidates.length+tr(' 個演算法候選（未確認）',' algorithm candidates (unconfirmed)'));
 status(parts.join(tr('，',', ')));
}
function localize(){
 $('nr-heading').textContent=tr('科學分析結果','Science Results');
 $('srb-intro-text').textContent=tr(
  '我們用 SPHEREx 多時段觀測，對 5 個目標、9 種波段組合做時間分組分析，比較各時段的影像與 SED。點下方方格就能看每一組結果。',
  'We ran time-grouped analyses of SPHEREx multi-epoch data for 5 targets across 9 bandpass combinations, comparing images and SEDs between epochs. Pick a cell below to see each result.');
 $('srb-recommend').textContent=tr("推薦先看：Barnard's Star 全波段 D1–6","Start here: Barnard's Star, all bands D1–6");
 $('srb-title').textContent=tr('分析結果總覽','Analysis runs');
 $('srb-legend').textContent=tr('格內數字＝時間分組數；空白＝尚未發布。','Number = time groups; empty = not published.');
 $('srb-target-label').textContent=tr('研究目標','Target');
 $('srb-band-label').textContent=tr('波段','Bandpass');
 $('srb-go').textContent=tr('在星圖上顯示','Show on sky');
 $('srb-version-label').textContent=tr('分析版本','Run version');
 $('srb-gif').textContent=tr('動畫 / 分組','Animation');
 $('srb-stack').textContent=tr('疊加','Stack');
 $('srb-sed').textContent='SED';
 $('srb-diagnostic').textContent=tr('時間分組','Time groups');
 $('srb-group-label').textContent=tr('時間分組','Time group');
 $('srb-source-label').textContent=tr('來源編號（僅限本組）','Source ID (this run only)');
 $('srb-plot-label').textContent=tr('SED 圖','SED figure');
 $('srb-plot').options[0].textContent=tr('各時段演變','Epoch-to-epoch evolution');
 $('srb-plot').options[1].textContent=tr('依時間分組','By time group');
 $('srb-locate').textContent=tr('在星圖上定位此來源','Locate this source on the sky');
 $('srb-viewer').textContent=tr('在影像檢視器開啟','Open in image viewer');
 $('srb-open').textContent=tr('開啟全尺寸圖片','Open full-size image');
 $('srb-info-summary').textContent=tr('關於這些資料','About this data');
 const notes=zh()?[
  '動畫裡的標記是畫在圖上的，不能點選來對應天空座標。',
  '來源編號只在同一組分析內有效：D1 的 Source 1 不一定等於 D2 的 Source 1。',
  '演算法標出的 mover / variable 只是候選，尚未經科學確認。',
  '目標座標是參考位置，不代表偵測到該天體。',
  '尚未發布的組合會留白，不會用其他資料代替。'
 ]:[
  'Labels in the animation are drawn into the image; they are not clickable sky coordinates.',
  'Source IDs are local to one run: Source 1 in D1 is not necessarily Source 1 in D2.',
  'Algorithm mover / variable flags are candidates, not confirmed objects.',
  'Target coordinates are reference positions, not proof of detection.',
  'Unpublished combinations stay empty; no other data is substituted.'
 ];
 if(revisionTarget('R_Draconis'))notes.push(tr('R Draconis 的測光正在修正，暫不提供結果。','R Draconis photometry is under revision and withheld.'));
 const list=$('srb-info-list');list.replaceChildren(...notes.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
 if(state.index)buildMatrix();
 repaintOptions();
 if(state.manifest)render();
}
async function loadIndex(){
 status(tr('正在讀取分析索引…','Loading run index…'));
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
  buildMatrix();
  $('srb-recommend').disabled=!runsFor(RECOMMENDED.target,RECOMMENDED.band).length;
  // Open on the selected target unless a shared view link asked for a specific field.
  if(!urlHasView())focusTarget();
  repaintOptions();await refreshRun();
 }catch(e){
  state.failure=String(e.message||e);
  repaintOptions();
  $('srb-recommend').disabled=true;
  drawMissing(tr('尚未部署可讀的科學分析索引：','Science index unavailable: ')+state.failure);
 }
}
$('srb-target').addEventListener('change',e=>selectTarget(e.target.value));
$('srb-band').addEventListener('change',e=>selectBand(e.target.value));
$('srb-version').addEventListener('change',e=>selectRun(e.target.value));
$('srb-recommend').onclick=()=>{
 selectCell(RECOMMENDED.target,RECOMMENDED.band);
 if(state.target===RECOMMENDED.target)focusTarget();
 $('srb-media').scrollIntoView?.({block:'nearest',behavior:'smooth'});
};
$('srb-gif').onclick=()=>{
 state.mode='gif';state.group=state.manifest?.product?.blink_url?'gif':0;render();
};
$('srb-sed').onclick=()=>{state.mode='sed';render();};
$('srb-stack').onclick=()=>{state.mode='stack';render();};
$('srb-diagnostic').onclick=()=>{state.mode='diagnostic';render();};
// Arrow keys move between tabs (WAI-ARIA tabs pattern).
el.querySelector('.srb-tabs').addEventListener('keydown',e=>{
 if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
 const tabs=[...el.querySelectorAll('.srb-tabs [role=tab]:not(:disabled)')];
 const i=tabs.indexOf(document.activeElement);if(i<0)return;
 const next=tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
 e.preventDefault();next.focus();next.click();
});
$('srb-group').onchange=e=>{state.group=e.target.value==='gif'?'gif':Number(e.target.value);render();};
$('srb-source').onchange=e=>{state.source=e.target.value;render();};
$('srb-plot').onchange=e=>{state.plot=e.target.value;render();};
$('srb-viewer').onclick=()=>{
 const m=state.manifest;if(!m||!window.SPHERExViewer?.setData)return;
 const p=m.product;
 // Original Group frames remain unchanged. Viewer uses marked GIF frames only.
 const images=p.viewer_frames.filter(f=>!!f.image_url);
 const plainImages=p.plain_viewer_frames.filter(f=>!!f.image_url);
 const frames=images.length?images:(p.blink_url?[{
  frame_id:'marked_gif',label:'Marked GIF animation',image_url:p.blink_url
 }]:[]);
 if(!frames.length)return;
 const t=window.SPHERExNotebookResults?.targets?.find(x=>x.id===state.target);
 window.SPHERExViewer.setData({
  field_id:state.target+'_'+state.run,status:'ready',
  target_name:targetName(state.target),
  center:t?{ra_deg:t.ra_deg,dec_deg:t.dec_deg}:undefined,
  frames,plain_frames:plainImages,sources:m.sources,
  frame_origin:'marked-gif',
  run_label:state.band+tr('（',' (')+state.run+tr('）',')'),
  annotation:p.gif_annotation||''
 });
};
$('srb-image').addEventListener('error',()=>{
 const image=$('srb-image'),missing=$('srb-empty');
 image.hidden=true;missing.hidden=false;
 missing.textContent=tr('此圖片尚未成功發布或無法讀取。','This image is not yet published or could not be loaded.');
 status(tr('圖片載入失敗，請檢查 GitHub Pages 檔案位置。','Image failed. Check deployed GitHub Pages paths.'));
});
$('srb-go').onclick=()=>goToSky($('srb-ra').value,$('srb-dec').value,SKY_CONTEXT_FOV,targetMeta(state.target).name);
$('srb-locate').onclick=()=>{
 const s=state.manifest?.sources?.find(x=>String(x.source_id)===state.source);
 if(s)goToSky(s.ra_deg,s.dec_deg,2,'Source '+state.source);
};
new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
localize();
window.SPHERExScienceRuns={
 reload:loadIndex,
 current:()=>({target:state.target,band:state.band,run:state.run,loaded:!!state.manifest}),
 selectTarget,selectBand,selectCell,
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
