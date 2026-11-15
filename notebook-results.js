/* SPHEREx multi-target science results.
 * Default assets are the verified saved outputs of All_Band (1).ipynb.
 * Each target can add any band, frames, blink, difference, sources, and SED by
 * deploying notebook-results/<target-slug>/manifest.json with real previews.
 * No data are inferred from counts, coordinates or a different target. */
(() => {
'use strict';
const ROOT='./notebook-results/';
const BAND_IDS=['all','D1','D2','D3','D4','D5','D6','D5+D6'];
const OBS=[
 {id:'WISE_0855',slug:'wise-0855',name:'WISE 0855',aliases:['WISE 0855','WISE 0855-0714'],ra:133.78948309791494,dec:-7.24294039128244,counts:[35,48,45,36,48,45],valid:257,total:258},
 {id:'Barnards_Star',slug:'barnards-star',name:"Barnard's Star",aliases:["Barnard's Star","Barnards Star","GJ 699"],ra:269.45207696,dec:4.69336497,counts:[59,61,59,60,62,59],valid:360,total:363},
 {id:'Epsilon_Indi_B',slug:'epsilon-indi-b',name:'Epsilon Indi B',aliases:['Epsilon Indi B','eps Ind B','epsilon Indi B'],ra:331.04414659,dec:-56.78284420,counts:[48,93,99,45,84,96],valid:465,total:465},
 {id:'RW_Aurigae',slug:'rw-aurigae',name:'RW Aurigae',aliases:['RW Aurigae','RW Aur'],ra:76.95652603,dec:30.40143817,counts:[56,55,56,56,56,56],valid:335,total:335},
 {id:'R_Draconis',slug:'r-draconis',name:'R Draconis',aliases:['R Draconis','R Dra'],ra:248.16761083,dec:66.75497942,counts:[581,88,550,578,89,573],valid:2459,total:2493}
];
const EPS_GROUPS=[
 [60789.85552,60802.21973,41,91],[60815.13120,60815.13120,1,2],
 [60832.65291,60836.18981,15,31],[60946.96411,60958.23998,36,108],
 [60971.61341,60987.37357,10,24],[61154.88892,61164.11695,17,44],
 [61305.22691,61315.47808,60,120]
].map((g,i)=>({frame_id:'group_'+(i+1),label:'Group '+(i+1),mjd:(g[0]+g[1])/2,start_mjd:g[0],end_mjd:g[1],stack_inputs:g[2],photometry_images:g[3]}));
const EPOCH_GIF=ROOT+'epsilon-indi-b/epoch-blink.gif';
const BUILTIN={
 Epsilon_Indi_B:{bands:{
  'D5+D6':{kind:'combined',label:'D5+D6 combined detection stack',
   frames:EPS_GROUPS,blink_url:EPOCH_GIF,
   overview_url:ROOT+'epsilon-indi-b/stack-overview.png',
   diagnostic_url:ROOT+'epsilon-indi-b/grouping-diagnostic.png',
   notice:'Saved notebook combined D5+D6 time-group previews. Group 2 contains one stack input.'}
 }},
 WISE_0855:{bands:{all:{kind:'multi-band',label:'All-band SED',
  source_count:55,detection_count:216,photometry_count:10280,
  seds:[1,2,3].map(i=>({source_id:String(i),plots:{
   groups:ROOT+'wise-0855/source-'+String(i).padStart(2,'0')+'-groups.png',
   overlay:ROOT+'wise-0855/source-'+String(i).padStart(2,'0')+'-overlay.png'
  }})),
  notice:'Saved all-band SED figures. The complete photometry ECSV is not embedded.'}}}
};
/* Verified WISE 0855 field previews from the archived 2025 May/November DR1
 * standardized FITS bundle. These are FIELD images, not a WISE 0855 detection.
 * Reuse already-committed real, masked PNGs in spherex-demo.js.
 * Source IDs from this two-epoch bundle MUST NOT be equated with the
 * independently published 55-source / 12-group notebook SED analysis. */
const wiseField=window.SPHEREx_DemoManifest;
if(wiseField?.frames?.length===2&&wiseField.difference?.image_url&&
   wiseField.field_id==='WISE0855_DR1_2025_May_Nov'){
 BUILTIN.WISE_0855.bands.D2={
  kind:'single-band',
  label:'2025 May / Nov · D2 · archived field preview',
  frames:wiseField.frames.map(f=>({...f})),
  difference:{...wiseField.difference},
  notice:'Two real 2025 D2 archived FIELD frames (May/November); '+
   '101 common valid difference pixels. WISE 0855 target itself is '+
   'outside the valid common mask. Do not claim detection or non-detection. '+
   'These two exposures are separate from the SED source-ID mapping.',
  dataset_id:'WISE0855_DR1_2025_May_Nov',
  target_coverage:'unavailable',
  source_association:'not_verified'
 };
}
const $=id=>document.getElementById(id);
const zh=()=>String(document.documentElement.lang||'zh').startsWith('zh');
const tr=(tw,en)=>zh()?tw:en;
const fmt=(v,n=3)=>Number.isFinite(Number(v))?Number(v).toFixed(n):'—';
const refs=new Map();const loads=new Map();const gifCache=new Map();
let playback=null;
const state={target:'Epsilon_Indi_B',band:'D5+D6',mode:'image',epoch:0,source:'',plot:'groups',
 diff:false,blink:false,manifestState:'',error:'',previewSeq:0};
const panel=$('pbody');if(!panel)return;
const section=document.createElement('section');section.className='sec';section.id='nr-explorer';
section.innerHTML=[
 '<details id="nr-details" open><summary id="nr-heading">Notebook Science Results</summary><div class="nr-body">',
 '<label class="nr-label" for="nr-target">Target / 星體名稱</label><select id="nr-target" aria-label="Select target"></select>',
 '<div class="nr-name-actions"><input id="nr-name-query" type="search" autocomplete="off" spellcheck="false" placeholder="Name / alias (e.g. GJ 699)"><button id="nr-name-go" class="btn sm" type="button">Search</button></div>',
 '<div class="nr-coordinates"><label><span>RA (°)</span><input id="nr-ra" type="number" min="0" max="360" step="any"></label><label><span>Dec (°)</span><input id="nr-dec" type="number" min="-90" max="90" step="any"></label></div>',
 '<div class="nr-actions"><button class="btn sm" id="nr-go" type="button">Go to sky</button><button class="btn sm" id="nr-load" type="button">Open image viewer</button></div>',
 '<label class="nr-label" for="nr-band" id="nr-band-label">Wavelength band</label>',
 '<select id="nr-band"><option value="all">All bands</option><option value="D1">D1</option><option value="D2">D2</option><option value="D3">D3</option><option value="D4">D4</option><option value="D5">D5</option><option value="D6">D6</option><option value="D5+D6">D5+D6 combined</option></select>',
 '<div class="nr-stats"><div><small id="nr-valid-label">Usable FITS</small><strong id="nr-count">—</strong></div><div><small id="nr-selected-label">Selected-band FITS</small><strong id="nr-bandcount">—</strong></div></div>',
 '<p id="nr-product-summary" class="nr-note"></p><p id="nr-availability" class="nr-note" role="status" aria-live="polite"></p>',
 '<div id="nr-mode-area"><div class="nr-actions"><button id="nr-image-mode" type="button" class="btn sm" aria-pressed="true">Images</button><button id="nr-sed-mode" type="button" class="btn sm" aria-pressed="false">SED</button></div></div>',
 '<div id="nr-epoch-area" hidden><div class="nr-minihead"><span id="nr-epoch-heading">Epoch</span><span id="nr-epochcount" class="nr-mono"></span></div>',
 '<div class="nr-actions nr-epoch-actions"><button id="nr-prev" class="btn sm" type="button">◀</button><select id="nr-epoch" aria-label="Epoch"></select><button id="nr-next" class="btn sm" type="button">▶</button><button id="nr-blink" class="btn sm" type="button" aria-pressed="false">Blink</button></div>',
 '<div class="nr-actions"><button id="nr-difference" class="btn sm" type="button" aria-pressed="false">Difference</button></div><p id="nr-epochinfo" class="nr-note"></p></div>',
 '<div id="nr-source-area" hidden><div class="nr-minihead"><span id="nr-source-heading">Source catalog / SED</span><span id="nr-sourcecount" class="nr-mono"></span></div>',
 '<div class="nr-sed-actions"><label for="nr-source"><span>Source</span><select id="nr-source"></select></label><label for="nr-plot"><span>Plot</span><select id="nr-plot"><option value="groups">By group</option><option value="overlay">Overlay</option></select></label></div>',
 '<p id="nr-source-detail" class="nr-note"></p><button id="nr-focus-source" class="btn sm" type="button">Locate selected source</button></div>',
 '<div id="nr-plotbox" class="nr-plotbox"><img id="nr-plotimage" alt="Science image or spectrum" loading="lazy"><p id="nr-empty" hidden></p></div>',
 '<a id="nr-fullimg" class="nr-fullimg" href="#" target="_blank" rel="noopener noreferrer">Open original image</a>',
 '<div id="nr-links" class="nr-resource-links" hidden><a id="nr-overview" target="_blank" rel="noopener noreferrer">Stack overview</a><a id="nr-diagnostic" target="_blank" rel="noopener noreferrer">Time grouping</a></div>',
 '<div id="nr-manifest-area" class="nr-manifest"><label class="nr-label" for="nr-manifest-url" id="nr-manifest-label">Load a target manifest (JSON URL)</label>',
 '<div class="nr-manifest-actions"><input id="nr-manifest-url" type="text" placeholder="https://.../manifest.json" spellcheck="false"><button id="nr-fetch-manifest" class="btn sm" type="button">Load JSON</button></div>',
 '<p id="nr-manifest-status" class="nr-note"></p></div>',
 '<p id="nr-status" class="nr-note" role="status" aria-live="polite"></p>',
 '<p class="nr-source-note" id="nr-provenance">Source: saved notebook outputs and target-specific uploaded manifests. Missing products are not synthesized.</p><p class="nr-build" id="nr-build">MULTI-TARGET UI · v2.2</p>',
 '</div></details>'
].join('');
const layerSection=$('layers')?.closest('.sec');panel.insertBefore(section,layerSection||null);
for(const item of OBS){const op=document.createElement('option');op.value=item.id;op.textContent=item.name;$('nr-target').append(op);}
const nav=document.querySelector('#top .top-actions');
if(nav){const btn=document.createElement('button');btn.type='button';btn.id='nr-open';btn.className='btn sm';btn.textContent='SCIENCE';nav.prepend(btn);
 btn.onclick=()=>{const p=$('panel');if(p){p.dataset.collapsed='false';$('collapse')?.setAttribute('aria-expanded','true');} $('nr-details').open=true;section.scrollIntoView({block:'start',behavior:'smooth'});};}

function target(){return OBS.find(o=>o.id===state.target)||OBS[0];}
function defaultData(id){return typeof structuredClone==='function'?structuredClone(BUILTIN[id]||{bands:{}}):JSON.parse(JSON.stringify(BUILTIN[id]||{bands:{}}));}
function data(){return refs.get(state.target)||defaultData(state.target);}
function product(){return data().bands?.[state.band]||null;}
/* A science target's verified source catalog is the only SPHEREx sky overlay.
 * Source/SED summary counts are NOT positions and must not become markers. */
function syncSkySourceCatalog(id){
 if(state.target!==id)return;
 const d=refs.get(id)||defaultData(id);
 const sources=Array.isArray(d.sources)?d.sources:[];
 window.SPHERExCatalog?.setSources?.(sources,{origin:'manifest',target_id:id});
}
function link(path,base){
 if(typeof path!=='string'||!path.trim())return null;
 const url=new URL(path,base||document.baseURI);
 if(!['http:','https:','blob:'].includes(url.protocol)&&!(url.protocol==='data:'&&/^data:image\/(png|jpeg|webp|gif);base64,/i.test(path)))throw Error('Only HTTPS/HTTP image or JSON URLs are allowed');
 return url.href;
}
function normFrame(f,base,i){
 if(!f||typeof f!=='object')return null;
 const url=link(f.image_url||f.url||null,base);
 const frame={...f,frame_id:String(f.frame_id||f.id||'epoch_'+(i+1)),label:String(f.label||'Group '+(i+1)),image_url:url};
 return frame;
}
function normalized(raw,base,id){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected a JSON object');
 const tag=raw.target_id||raw.field_id||id;
 if(tag!==id)throw Error('Manifest target_id does not match selected target: '+tag+' ≠ '+id);
 const d=defaultData(id),incoming=raw.bands||raw.products?.bands||{};
 if(typeof incoming!=='object'||Array.isArray(incoming))throw Error('bands must be a keyed object');
 for(const [band,p] of Object.entries(incoming)){
  if(!BAND_IDS.includes(band))throw Error('Unknown band: '+band);
  if(!p||typeof p!=='object')continue;
  const built=d.bands[band]||{};
  const frames=(Array.isArray(p.frames)?p.frames:[]).map((v,i)=>normFrame(v,base,i)).filter(Boolean);
  const seds=(Array.isArray(p.seds)?p.seds:[]).map(s=>({
   ...s,source_id:String(s.source_id??s.global_source_id??''),
   plots:Object.fromEntries(Object.entries(s.plots||{}).filter(([k,v])=>['groups','overlay'].includes(k)&&typeof v==='string').map(([k,v])=>[k,link(v,base)]))
  })).filter(s=>s.source_id);
  const diff=p.difference&&typeof p.difference==='object'?{...p.difference,image_url:link(p.difference.image_url||p.difference.url,base)}:null;
  d.bands[band]={...built,...p,frames,seds,
   difference:diff,blink_url:link(p.blink_url||p.blink,base),
   overview_url:link(p.overview_url,base),diagnostic_url:link(p.diagnostic_url,base)};
 }
 if(Array.isArray(raw.sources))d.sources=raw.sources;
 if(raw.notice)d.notice=String(raw.notice);
 return d;
}
function setText(id,text){const x=$(id);if(x)x.textContent=String(text??'');}
function stop(){if(playback){clearInterval(playback);playback=null;}state.blink=false;}
function allFrames(p){return p?.frames?.length||0;}
function hasStill(p){return (p?.frames||[]).some(f=>!!f.image_url);}
function hasImages(p){return !!p&&(hasStill(p)||!!p.blink_url||!!p.difference?.image_url);}
function hasSeds(p){return !!p?.seds?.some(s=>Object.values(s.plots||{}).some(Boolean));}
function sourceList(p){
 const all=[...(p?.seds||[]).map(s=>String(s.source_id)),...(data().sources||[]).map(s=>String(s.global_source_id??s.source_id??s.detection_id??s.candidate_id??''))].filter(Boolean);
 return [...new Set(all)];
}
function sourceById(id){return (data().sources||[]).find(s=>String(s.global_source_id??s.source_id??s.detection_id??s.candidate_id)===id)||null;}
function sedById(p,id){return (p?.seds||[]).find(s=>String(s.source_id)===id)||null;}
function currentSourceInfo(){
 const s=sourceById(state.source);if(!s)return '';
 const bits=[];
 for(const [label,key,n] of [['RA','ra_deg',6],['Dec','dec_deg',6],['Flux mJy','flux_mjy',4],['Error mJy','flux_error_mjy',4]]){
  if(s[key]!==undefined&&s[key]!==null&&s[key]!==''&&Number.isFinite(Number(s[key])))bits.push(label+' '+Number(s[key]).toFixed(n));
 }
 if(s.quality_status)bits.push('Quality '+String(s.quality_status));
 if(!Array.isArray(s.frame_positions)||!s.frame_positions.length)bits.push(tr('未提供影像像素座標；不會顯示 Marker','No frame_positions: image markers unavailable'));
 return bits.join(' · ');
}
function display(src,alt){
 const img=$('nr-plotimage'),empty=$('nr-empty'),a=$('nr-fullimg');
 if(!src){img.hidden=true;img.removeAttribute('src');empty.hidden=false;empty.textContent=alt;a.hidden=true;return;}
 a.hidden=false;a.href=src;empty.hidden=true;img.hidden=false;img.alt=alt;
 if(img.getAttribute('src')!==src)img.src=src;
}
$('nr-plotimage').addEventListener('error',()=>{setText('nr-status',tr('影像無法載入，請檢查 Manifest 路徑與 GitHub Pages 檔案。','Image failed to load. Check manifest paths and deployed assets.'));});
async function decodeGif(url,count){
 if(gifCache.has(url))return gifCache.get(url);
 const p=(async()=>{
  if(!('ImageDecoder' in window)||!await ImageDecoder.isTypeSupported('image/gif'))return null;
  const res=await fetch(url);if(!res.ok)throw Error('GIF HTTP '+res.status);
  const d=new ImageDecoder({data:new Uint8Array(await res.arrayBuffer()),type:'image/gif',preferAnimation:true});
  const urls=[];
  try{await d.tracks.ready;for(let i=0;i<count;i++){
   const frame=(await d.decode({frameIndex:i,completeFramesOnly:true})).image;
   const canvas=document.createElement('canvas');canvas.width=frame.displayWidth;canvas.height=frame.displayHeight;
   canvas.getContext('2d').drawImage(frame,0,0);frame.close();
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)throw Error('GIF frame encoding failed');
   urls.push(URL.createObjectURL(blob));
  }}finally{d.close();}
  return urls;
 })().catch(e=>{setText('nr-status',String(e.message||e));return null;});
 gifCache.set(url,p);return p;
}
function currentPreview(){
 const p=product(),name=target().name;
 if(!p)return display('',tr('此波段尚無已匯出的影像或 SED。可透過下方 Manifest 載入。','No exported product for this band. Load a manifest below.'));
 if(state.mode==='sed'){
  const sed=sedById(p,state.source),url=sed?.plots?.[state.plot]||null;
  return display(url,url?name+' · Source '+state.source+' · '+state.plot:tr('此來源尚無對應的 SED 圖','No SED plot for this source'));
 }
 if(state.diff&&p.difference?.image_url)return display(p.difference.image_url,name+' · Difference · '+state.band);
 if(state.blink&&p.blink_url)return display(p.blink_url,name+' · Blink · '+state.band);
 const f=p.frames?.[state.epoch];
 if(f?.image_url)return display(f.image_url,name+' · '+state.band+' · '+f.label);
 if(p.blink_url){
  display(p.blink_url,tr('已提供 Blink；正在準備逐 Epoch 預覽','Blink available; preparing still frames'));
  const tag=++state.previewSeq,targetId=state.target,band=state.band;
  decodeGif(p.blink_url,p.frames?.length||0).then(arr=>{
   if(tag!==state.previewSeq||state.target!==targetId||state.band!==band||state.blink||state.diff||state.mode!=='image')return;
   if(arr?.[state.epoch])display(arr[state.epoch],name+' · '+band+' · Group '+(state.epoch+1));
   else setText('nr-status',tr('此瀏覽器不支援 GIF 逐影格解碼；仍可檢視 Blink。要支援逐 Epoch 請輸出 PNG。','GIF frame decoding unavailable in this browser; export separate PNGs for epoch selection.'));
  });
  return;
 }
 if(p.difference?.image_url)return display('',tr('此波段只有 Difference，請按 Difference 按鈕。','Only Difference is available for this band.'));
 return display('',tr('此波段沒有影像，可切換至 SED 或匯入新 Manifest。','No image for this band; try SED or a new manifest.'));
}
function countForBand(t){
 if(/^D[1-6]$/.test(state.band))return String(t.counts[Number(state.band.slice(1))-1]);
 if(state.band==='D5+D6')return `D5 ${t.counts[4]} · D6 ${t.counts[5]}`;
 return tr('六個波段','6 bands');
}
function chooseSource(p){
 const ids=sourceList(p),select=$('nr-source');
 if(!ids.includes(state.source))state.source=ids[0]||'';
 select.replaceChildren();
 for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent='Source '+id;select.append(option);}
 select.value=state.source;
 return ids;
}
function render(){
 const t=target(),d=data(),p=product(),ids=chooseSource(p),n=allFrames(p),canStill=hasStill(p),img=hasImages(p),sed=hasSeds(p);
 setText('nr-count',t.valid+' / '+t.total);setText('nr-bandcount',countForBand(t));
 setText('nr-selected-label',state.band==='D5+D6'?tr('D5／D6 各自紀錄','D5 / D6 records'):tr('所選波段紀錄','Selected-band records'));
 for(const op of $('nr-band').options){
  const bp=d.bands?.[op.value];const ready=hasImages(bp)||hasSeds(bp);
  const base=op.value==='all'?tr('全部波段（摘要）','All bands (summary)'):op.value==='D5+D6'?'D5+D6 '+tr('合併','combined'):op.value;
  op.textContent=base+(ready?' • ✓':'');
 }
 $('nr-band').value=state.band;
 if(!img&&state.mode==='image'&&sed)state.mode='sed';
 if(!sed&&state.mode==='sed'&&img)state.mode='image';
 $('nr-mode-area').hidden=!img&&!sed;
 $('nr-image-mode').disabled=!img;$('nr-sed-mode').disabled=!sed;
 $('nr-image-mode').setAttribute('aria-pressed',String(state.mode==='image'));
 $('nr-sed-mode').setAttribute('aria-pressed',String(state.mode==='sed'));
 $('nr-epoch-area').hidden=state.mode!=='image'||!img;
 $('nr-source-area').hidden=!ids.length;
 $('nr-source').disabled=!ids.length;
 $('nr-plot').disabled=!sed||state.mode!=='sed';
 $('nr-plot').value=state.plot;
 const f=p?.frames?.[state.epoch]||null;
 const ep=$('nr-epoch');ep.replaceChildren();
 for(let i=0;i<n;i++){const o=document.createElement('option');o.value=String(i);o.textContent=p.frames[i].label||'Group '+(i+1);ep.append(o);}
 if(state.epoch>=n)state.epoch=0;ep.value=String(state.epoch);
 ep.disabled=n<2;$('nr-prev').disabled=n<2;$('nr-next').disabled=n<2;
 $('nr-blink').disabled=!(p?.blink_url||n>=2);
 $('nr-blink').setAttribute('aria-pressed',String(state.blink));
 setText('nr-blink',state.blink?tr('停止 Blink','Stop Blink'):'Blink');
 $('nr-difference').disabled=!p?.difference?.image_url;
 $('nr-difference').setAttribute('aria-pressed',String(state.diff));
 setText('nr-epochcount',n?((state.epoch+1)+' / '+n):'0');
 const pick=p?.frames?.[state.epoch];
 setText('nr-epochinfo',pick?[
  pick.mjd!=null?'MJD '+fmt(pick.mjd,4):'',
  pick.stack_inputs!=null?pick.stack_inputs+' '+tr('張 Stack','stack inputs'):'',
  pick.photometry_images!=null?pick.photometry_images+' '+tr('張測光影像','photometry images'):''
 ].filter(Boolean).join(' · '):'');
 const links=$('nr-links');
 links.hidden=!p?.overview_url&&!p?.diagnostic_url;
 $('nr-overview').hidden=!p?.overview_url;$('nr-overview').href=p?.overview_url||'#';
 $('nr-diagnostic').hidden=!p?.diagnostic_url;$('nr-diagnostic').href=p?.diagnostic_url||'#';
 setText('nr-sourcecount',ids.length+' '+tr('筆可選','available'));
 setText('nr-source-detail',currentSourceInfo()||(sed?tr('選取 Source 查看原始 SED 圖','Choose a source to view SED'):''));
 const selected=sourceById(state.source);
 $('nr-focus-source').disabled=!(selected&&Number.isFinite(Number(selected.ra_deg))&&Number.isFinite(Number(selected.dec_deg)));
 const ready=Object.entries(d.bands||{}).filter(([_,v])=>hasImages(v)||hasSeds(v)).map(([k])=>k);
 const availability=[
  tr('可用波段','Bands')+': '+(ready.join(', ')||tr('尚無','none')),
  tr('Epoch','Epochs')+': '+n,
  'Blink: '+((p?.blink_url||n>1)?tr('可用','available'):tr('未提供','missing')),
  'Difference: '+(p?.difference?.image_url?tr('可用','available'):tr('未提供','missing')),
  'Source: '+(d.sources?.length||0),
  'SED: '+(p?.seds?.length||0)
 ];
 setText('nr-product-summary',availability.join(' · '));
 let msg='';
 if(!p)msg=tr('此波段尚無輸出檔。可在下方輸入 Manifest URL，或由隊友使用 Export Tool 產生檔案。','No exported files for this band. Load a manifest URL or ask the team to run the export tool.');
 else if(p.kind==='combined')msg=tr('合併波段 Stack：不能視為獨立 D5 或 D6 影像。','Combined-band stack: not an independent D5 or D6 measurement.');
 else if(state.band==='all'&&sed)msg=tr('SED 為原 Notebook 的全波長圖；波段選擇不會重新計算 Flux。','SED is the original full-spectrum figure; band selection does not remeasure flux.');
 else msg=tr('顯示已提供的真實觀測產品，不以其他目標影像替代。','Only uploaded observation products are shown; no other target is substituted.');
 if(p?.notice)msg+=' '+p.notice;
 if(d.notice)msg+=' '+d.notice;
 setText('nr-availability',msg);
 $('nr-load').disabled=!(state.mode==='image'&&img&&!!(p?.blink_url||canStill||p?.difference?.image_url));
 currentPreview();
}
function selectTarget(id){
 const t=OBS.find(o=>o.id===id);if(!t)return false;
 stop();state.target=id;state.diff=false;state.epoch=0;state.source='';state.plot='groups';state.mode='image';
 const d=refs.get(id)||defaultData(id);
 const available=Object.keys(d.bands||{}).filter(k=>hasImages(d.bands[k])||hasSeds(d.bands[k]));
 state.band=available[0]||'all';
 $('nr-target').value=t.id;$('nr-name-query').value='';$('nr-ra').value=fmt(t.ra,8);$('nr-dec').value=fmt(t.dec,8);setText('nr-status','');
 render();syncSkySourceCatalog(id);fetchStandard(id);return true;
}
function selectBand(id){
 if(!BAND_IDS.includes(id))return false;
 stop();state.diff=false;state.epoch=0;state.band=id;state.mode='image';render();return true;
}
function setGroup(index){
 const p=product(),n=allFrames(p);if(n<2)return;stop();state.diff=false;state.epoch=((index%n)+n)%n;render();
}
function goTo(ra,dec){
 const a=Number(ra),d=Number(dec);
 if(!Number.isFinite(a)||a<0||a>=360||!Number.isFinite(d)||Math.abs(d)>90){
  setText('nr-status',tr('RA 須在 0–360°，Dec 須在 −90–90°。','RA must be 0–360°, Dec −90–90°.'));return false;
 }
 const ok=window.SkyAtlas?.goToCoordinates?.({ra_deg:a,dec_deg:d,fov_deg:2});
 setText('nr-status',ok?tr('已定位；不會自動產生 FITS 影像。','Sky centered; no new FITS generated.'):tr('無法操作星圖。','Sky navigation unavailable.'));
 return !!ok;
}
function manifestInfo(msg){state.manifestState=msg;setText('nr-manifest-status',msg);}
async function loadManifest(url,id=state.target){
 if(!OBS.some(t=>t.id===id))throw Error('Unknown target');
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error('Manifest HTTP '+response.status);
 const raw=await response.json();
 const d=normalized(raw,response.url||url,id);
 refs.set(id,d);
 if(state.target===id){stop();state.diff=false;state.epoch=0;state.source='';
  const ready=Object.keys(d.bands).filter(k=>hasImages(d.bands[k])||hasSeds(d.bands[k]));
  if(ready.length&&!ready.includes(state.band))state.band=ready[0];
  manifestInfo(tr('已載入目標資料：','Target manifest loaded: ')+id);
  render();syncSkySourceCatalog(id);
 }
 return d;
}
function setManifest(raw,id=state.target,baseURL=document.baseURI){
 const d=normalized(raw,baseURL,id);refs.set(id,d);
 if(state.target===id){stop();state.diff=false;state.epoch=0;
  const keys=Object.keys(d.bands).filter(k=>hasImages(d.bands[k])||hasSeds(d.bands[k]));
  if(keys.length&&!keys.includes(state.band))state.band=keys[0];
  manifestInfo(tr('已載入應用程式提供的資料。','Application manifest loaded.'));render();
  syncSkySourceCatalog(id);
 }
 return d;
}
async function fetchStandard(id){
 if(loads.has(id))return loads.get(id);
 const item=OBS.find(x=>x.id===id);if(!item)return;
 const url=ROOT+item.slug+'/manifest.json';
 const p=loadManifest(url,id).then(x=>x).catch(e=>{
  if(state.target===id)manifestInfo(
   /HTTP 404/.test(String(e))?tr('目前只有內建結果；找不到此目標的 manifest.json。','Built-in results only: no target manifest.json yet.'):
   tr('外部 Manifest 未載入：','External manifest failed: ')+String(e.message||e));
  return null;
 });
 loads.set(id,p);return p;
}
async function openViewer(){
 const p=product();if(!p||!hasImages(p)||!window.SPHERExViewer?.setData)return;
 const button=$('nr-load');button.disabled=true;setText('nr-status',tr('正在載入 Viewer…','Loading viewer…'));
 try{
  let frames=(p.frames||[]).filter(f=>f.image_url);
  if(!frames.length&&p.blink_url){
   const decoded=await decodeGif(p.blink_url,p.frames?.length||0);
   if(decoded?.length)frames=decoded.map((url,i)=>({...p.frames[i],image_url:url}));
   else frames=[{frame_id:'animated',label:target().name+' · '+state.band+' Blink GIF',image_url:p.blink_url}];
  }
  if(!frames.length&&p.difference?.image_url)frames=[{frame_id:'difference_only',label:'Difference (only preview)',image_url:p.difference.image_url}];
  const t=target(),center=data().center||{ra_deg:t.ra,dec_deg:t.dec};
  window.SPHERExViewer.setData({
   field_id:t.id+'_'+state.band,status:'ready',
   center:{ra_deg:Number(center.ra_deg),dec_deg:Number(center.dec_deg)},
   frames,difference:p.difference?.image_url?p.difference:null,
   sources:data().sources||[],
   notice:(p.kind==='combined'?'Combined-band reference only. ':'')+(p.notice||'')+
    (!frames.some(f=>f.width&&f.height)?' WCS pixel markers require per-frame positions.':'')
  });
  setText('nr-status',tr('已開啟影像 Viewer。','Image viewer opened.'));
 }catch(e){setText('nr-status',tr('Viewer 載入失敗：','Viewer failed: ')+String(e.message||e));}
 finally{button.disabled=false;}
}
function localize(){
 setText('nr-heading',tr('Notebook 科學結果','Notebook science results'));
 setText('nr-go',tr('前往天球座標','Go to sky'));setText('nr-load',tr('開啟影像 Viewer','Open image viewer'));
 setText('nr-band-label',tr('波段選擇','Wavelength band'));
 setText('nr-valid-label',tr('有效 FITS','Usable FITS'));
 setText('nr-name-go',tr('搜尋','Search'));
 setText('nr-epoch-heading',tr('觀測時間組','Observation epochs'));
 setText('nr-image-mode',tr('影像','Images'));setText('nr-sed-mode','SED');
 setText('nr-source-heading',tr('Source Catalog / SED','Source catalog / SED'));
 setText('nr-focus-source',tr('定位選取 Source','Locate selected source'));
 setText('nr-difference',tr('差分影像','Difference'));setText('nr-manifest-label',tr('載入此目標的 Manifest JSON 網址','Load target manifest JSON URL'));
 setText('nr-fetch-manifest',tr('載入 JSON','Load JSON'));setText('nr-fullimg',tr('開啟原尺寸影像','Open full resolution'));
 setText('nr-overview',tr('Stack 總覽','Stack overview'));setText('nr-diagnostic',tr('時間分組圖','Time grouping'));
 $('nr-plot').options[0].textContent=tr('逐組','By group');$('nr-plot').options[1].textContent=tr('疊合','Overlay');
 setText('nr-provenance',tr('既有圖像來自 All_Band (1).ipynb；新的圖像由各目標 Manifest 提供。沒有檔案就不顯示結果。','Built-in media: saved All_Band (1).ipynb outputs. New images come from per-target manifests; missing data are never fabricated.'));
 render();
}
$('nr-target').addEventListener('change',e=>selectTarget(e.target.value));
function findByName(text){
 const key=String(text).trim().toLowerCase().replace(/[^a-z0-9]/g,'');
 if(!key)return {match:null,count:0};
 const exact=OBS.filter(o=>o.aliases.some(a=>a.toLowerCase().replace(/[^a-z0-9]/g,'')===key));
 if(exact.length===1)return {match:exact[0],count:1};
 const partial=OBS.filter(o=>o.aliases.some(a=>a.toLowerCase().replace(/[^a-z0-9]/g,'').includes(key)));
 return {match:partial.length===1?partial[0]:null,count:partial.length};
}
function searchByName(){
 const found=findByName($('nr-name-query').value);
 if(found.match)selectTarget(found.match.id);
 else setText('nr-status',found.count>1
  ?tr('找到多個符合的星體，請使用上方選單。','Multiple matches: choose from the target menu.')
  :tr('未找到該星體；可以使用上方選單或輸入 RA / Dec 定位。','Target not found: use the menu or enter RA / Dec.'));
}
$('nr-name-go').onclick=searchByName;
$('nr-name-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchByName();}});
$('nr-band').addEventListener('change',e=>selectBand(e.target.value));
$('nr-go').onclick=()=>goTo($('nr-ra').value,$('nr-dec').value);
$('nr-load').onclick=openViewer;
$('nr-image-mode').onclick=()=>{stop();state.mode='image';render();};
$('nr-sed-mode').onclick=()=>{stop();state.mode='sed';render();};
$('nr-prev').onclick=()=>setGroup(state.epoch-1);
$('nr-next').onclick=()=>setGroup(state.epoch+1);
$('nr-epoch').onchange=e=>setGroup(Number(e.target.value));
$('nr-blink').onclick=()=>{
 const p=product();if(!p||!(p.blink_url||allFrames(p)>=2))return;
 if(state.blink){stop();render();return;}
 state.blink=true;state.diff=false;
 if(!p.blink_url&&allFrames(p)>=2)playback=setInterval(()=>{state.epoch=(state.epoch+1)%p.frames.length;render();},850);
 render();
};
$('nr-difference').onclick=()=>{const p=product();if(!p?.difference?.image_url)return;stop();state.diff=!state.diff;render();};
$('nr-source').onchange=e=>{state.source=e.target.value;render();};
$('nr-focus-source').onclick=()=>{const s=sourceById(state.source);if(s)goTo(s.ra_deg,s.dec_deg);};
$('nr-plot').onchange=e=>{state.plot=e.target.value;render();};
$('nr-fetch-manifest').onclick=async()=>{
 const url=$('nr-manifest-url').value.trim();if(!url)return;
 $('nr-fetch-manifest').disabled=true;
 try{await loadManifest(new URL(url,document.baseURI).href);setText('nr-status',tr('已匯入此目標資料','Target products loaded'));}
 catch(e){manifestInfo(tr('讀取失敗：','Load failed: ')+String(e.message||e));}
 finally{$('nr-fetch-manifest').disabled=false;}
};
window.addEventListener('beforeunload',()=>{stop();for(const p of gifCache.values())p.then(arr=>arr?.forEach(url=>URL.revokeObjectURL(url)));});
new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.SPHERExNotebookResults={
 targets:OBS.map(t=>({id:t.id,name:t.name,ra_deg:t.ra,dec_deg:t.dec,band_counts:t.counts.slice(),usable:t.valid,total:t.total})),
 selectTarget,selectBand,goToCoordinates:goTo,navigate:goTo,
 loadManifest,setManifest,current:()=>({target:state.target,band:state.band,epoch:state.epoch+1,mode:state.mode,source_id:state.source}),
 getProducts:(id=state.target)=>Object.keys((refs.get(id)||defaultData(id)).bands||{})
};
selectTarget('Epsilon_Indi_B');localize();
})();