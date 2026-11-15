/* Saved SPHEREx notebook results explorer (no fabricated flux or pixels).
 * Every image is extracted from All_Band (1).ipynb execution outputs.
 * Epsilon Indi B: seven combined D5+D6 image groups (Cell B/B2).
 * WISE 0855: source SED plots and historical detection summaries (Cells C-E).
 * Band selector reports actual availability; it NEVER relabels a combined stack as an individual band.
 */
(() => {
'use strict';
const BASE='./notebook-results/';
const EPOCH_GIF=BASE+'epsilon-indi-b/epoch-blink.gif';
const TARGETS=[
 {id:'WISE_0855',name:'WISE 0855',alt:['WISE 0855','WISE 0855-0714'],ra:133.78948309791494,dec:-7.24294039128244,counts:[35,48,45,36,48,45],valid:257,total:258,products:'sed'},
 {id:'Barnards_Star',name:"Barnard's Star",alt:["Barnard's Star","Barnards Star","GJ 699"],ra:269.45207696,dec:4.69336497,counts:[59,61,59,60,62,59],valid:360,total:363,products:'metadata'},
 {id:'Epsilon_Indi_B',name:'Epsilon Indi B',alt:['Epsilon Indi B','eps Ind B','epsilon Indi B'],ra:331.04414659,dec:-56.78284420,counts:[48,93,99,45,84,96],valid:465,total:465,products:'epochs'},
 {id:'RW_Aurigae',name:'RW Aurigae',alt:['RW Aurigae','RW Aur'],ra:76.95652603,dec:30.40143817,counts:[56,55,56,56,56,56],valid:335,total:335,products:'metadata'},
 {id:'R_Draconis',name:'R Draconis',alt:['R Draconis','R Dra'],ra:248.16761083,dec:66.75497942,counts:[581,88,550,578,89,573],valid:2459,total:2493,products:'metadata'}
];
const GROUPS=[
 {start:60789.85552,end:60802.21973,stack:41,phot:91},
 {start:60815.13120,end:60815.13120,stack:1,phot:2},
 {start:60832.65291,end:60836.18981,stack:15,phot:31},
 {start:60946.96411,end:60958.23998,stack:36,phot:108},
 {start:60971.61341,end:60987.37357,stack:10,phot:24},
 {start:61154.88892,end:61164.11695,stack:17,phot:44},
 {start:61305.22691,end:61315.47808,stack:60,phot:120}
];
const SOURCE_META=[
 {id:1,ra:133.7544328973246,snr:165.576130989875},
 {id:2,ra:133.79724508781587,snr:158.32682187357193},
 {id:3,ra:133.81652049907999,snr:71.87551395177246}
];
// The notebook does not include complete source coordinates or the 10,280-row ECSV.
// Do not auto-place these SED sources as markers on an image or sky chart.
const state={target:'Epsilon_Indi_B',band:'D5+D6',group:0,source:1,plot:'groups',
  blink:false,frameUrls:null,decoding:null,decoderNote:'',loadingToViewer:false};
const $=id=>document.getElementById(id);
const zh=()=>String(document.documentElement.lang||'zh').startsWith('zh');
const tr=(tw,en)=>zh()?tw:en;
const target=()=>TARGETS.find(t=>t.id===state.target)||TARGETS[0];
const fmt=(v,n=3)=>Number(v).toFixed(n);
const panel=$('pbody');
if(!panel)return;
const section=document.createElement('section');
section.className='sec';section.id='nr-explorer';
section.innerHTML=[
 '<details id="nr-details" open>',
  '<summary id="nr-heading">Notebook Science Results</summary>',
  '<div class="nr-body">',
   '<label class="nr-label" for="nr-target">Target / 星體名稱</label>',
   '<input type="search" id="nr-target" list="nr-targets" autocomplete="off" spellcheck="false" placeholder="WISE 0855 / Epsilon Indi B">',
   '<datalist id="nr-targets"></datalist>',
   '<div class="nr-coordinates">',
    '<label><span id="nr-ra-label">RA (deg)</span><input id="nr-ra" type="number" min="0" max="360" step="any" inputmode="decimal"></label>',
    '<label><span id="nr-dec-label">Dec (deg)</span><input id="nr-dec" type="number" min="-90" max="90" step="any" inputmode="decimal"></label>',
   '</div>',
   '<div class="nr-actions"><button class="btn sm" id="nr-go" type="button">Go to sky</button>',
    '<button class="btn sm" id="nr-load" type="button">Open in Viewer</button></div>',
   '<label class="nr-label" for="nr-band" id="nr-band-label">Wavelength band</label>',
   '<select id="nr-band"><option value="all">All bands / summary</option>',
   '<option value="D1">SPHEREx D1</option><option value="D2">SPHEREx D2</option>',
   '<option value="D3">SPHEREx D3</option><option value="D4">SPHEREx D4</option>',
   '<option value="D5">SPHEREx D5</option><option value="D6">SPHEREx D6</option>',
   '<option value="D5+D6">D5 + D6 combined stack</option></select>',
   '<div class="nr-stats"><div><small id="nr-valid-label">Valid FITS</small><strong id="nr-count">—</strong></div>',
   '<div><small id="nr-selected-label">Selected band</small><strong id="nr-bandcount">—</strong></div></div>',
   '<p id="nr-availability" class="nr-note" role="status" aria-live="polite"></p>',
   '<div id="nr-epoch-area" hidden>',
    '<div class="nr-minihead"><span id="nr-epoch-heading">Epoch image</span>',
    '<span id="nr-epochcount" class="nr-mono">1 / 7</span></div>',
    '<div class="nr-actions nr-epoch-actions">',
     '<button class="btn sm" id="nr-prev" type="button" aria-label="Previous epoch">◀</button>',
     '<select id="nr-epoch" aria-label="Epoch selection"></select>',
     '<button class="btn sm" id="nr-next" type="button" aria-label="Next epoch">▶</button>',
     '<button class="btn sm" id="nr-blink" type="button" aria-pressed="false">Blink</button>',
    '</div>',
    '<p id="nr-epochinfo" class="nr-note"></p>',
   '</div>',
   '<div id="nr-sed-area" hidden>',
    '<div class="nr-minihead"><span id="nr-sed-heading">Source SED</span><span id="nr-sedtotal">55 matched sources</span></div>',
    '<div class="nr-sed-actions"><label for="nr-source"><span id="nr-source-label">Source</span>',
     '<select id="nr-source"><option value="1">Source 1</option><option value="2">Source 2</option><option value="3">Source 3</option></select></label>',
    '<label for="nr-plot"><span id="nr-plot-label">Plot</span>',
     '<select id="nr-plot"><option value="groups">By group</option><option value="overlay">Overlay</option></select></label></div>',
    '<p id="nr-sednote" class="nr-note"></p>',
   '</div>',
   '<div id="nr-plotbox" class="nr-plotbox"><img id="nr-plotimage" alt="Notebook results" loading="lazy">',
    '<p id="nr-empty" hidden></p></div>',
   '<div id="nr-links" class="nr-resource-links"><a id="nr-overview" target="_blank" rel="noopener noreferrer" href="./notebook-results/epsilon-indi-b/stack-overview.png">Stack overview</a>',
    '<a id="nr-diagnostic" target="_blank" rel="noopener noreferrer" href="./notebook-results/epsilon-indi-b/grouping-diagnostic.png">Time grouping</a></div>',
   '<p id="nr-status" class="nr-note" role="status" aria-live="polite"></p>',
   '<p class="nr-source-note" id="nr-provenance"></p>',
  '</div>',
 '</details>'
].join('');
// Keep sky-atlas navigation at the top, followed by results before less-used toggles.
const layerSection=$('layers')?.closest('.sec');
panel.insertBefore(section,layerSection||null);
const opts=$('nr-targets');
TARGETS.forEach(t=>{t.alt.forEach(name=>{const o=document.createElement('option');o.value=name;opts.append(o);});});
GROUPS.forEach((g,i)=>{const o=document.createElement('option');o.value=String(i);
 o.textContent='Group '+(i+1)+' · '+fmt(g.start,1)+'–'+fmt(g.end,1);$('nr-epoch').append(o);});
const nav=document.querySelector('#top .top-actions');
if(nav){
 const openButton=document.createElement('button');
 openButton.type='button';openButton.id='nr-open';openButton.className='btn sm';
 openButton.textContent='SCIENCE';
 openButton.addEventListener('click',()=>{
  const p=$('panel');
  if(p){p.dataset.collapsed='false';$('collapse')?.setAttribute('aria-expanded','true');
    const btn=$('collapse');if(btn)btn.textContent=tr('收合面板','Hide panel');}
  $('nr-details').open=true;
  section.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 });
 nav.prepend(openButton);
}
function matchTarget(text){
 const query=String(text).trim().toLowerCase().replace(/[^a-z0-9]/g,'');
 return TARGETS.find(t=>t.alt.some(a=>a.toLowerCase().replace(/[^a-z0-9]/g,'')===query))||null;
}
function setText(id,txt){const el=$(id);if(el)el.textContent=txt;}
function localize(){
 setText('nr-heading',tr('Notebook 科學結果','Notebook science results'));
 setText('nr-ra-label','RA (°)');setText('nr-dec-label','Dec (°)');
 setText('nr-go',tr('前往天球座標','Go to sky'));
 setText('nr-load',tr('開啟影像 Viewer','Open image viewer'));
 setText('nr-band-label',tr('波段選擇','Wavelength band'));
 setText('nr-valid-label',tr('有效 FITS','Usable FITS'));
 setText('nr-selected-label',tr('所選波段紀錄','Selected-band records'));
 setText('nr-epoch-heading',tr('觀測時間組','Observation epoch'));
 setText('nr-sed-heading',tr('光譜能量分布','Spectral energy distribution'));
 setText('nr-source-label','Source');setText('nr-plot-label',tr('圖表類型','Plot type'));
 setText('nr-sedtotal',tr('已匹配 55 個 Source，展示其中 3 個','55 matched; 3 shown'));
 setText('nr-open','SCIENCE');
 setText('nr-prev','◀');setText('nr-next','▶');
 setText('nr-blink',state.blink?tr('停止 Blink','Stop Blink'):'Blink');
 $('nr-band').options[0].textContent=tr('全部波段／摘要','All bands / summary');
 $('nr-band').options[7].textContent=tr('D5+D6 合併 Stack','D5+D6 combined stack');
 $('nr-plot').options[0].textContent=tr('逐 Group 分布','By group');
 $('nr-plot').options[1].textContent=tr('跨 Group 疊合','Overlay');
 setText('nr-provenance',tr(
  '資料來源：All_Band (1).ipynb 儲存輸出。影像預覽與 SED 來自 Notebook 原圖；沒有匯入原始 FITS/ECSV，故不提供逐像素 WCS、Source marker 或單波段重新測光。',
  'Source: saved All_Band (1).ipynb outputs. Images and SED plots are original figures; FITS/ECSV tables were not embedded, so pixel WCS, source markers and remeasured per-band flux are unavailable.'
 ));
 render();
}
function selectTarget(id){
 const t=TARGETS.find(o=>o.id===id);if(!t)return false;
 state.target=id;state.band=t.products==='epochs'?'D5+D6':'all';
 state.group=0;state.source=1;state.plot='groups';state.blink=false;
 $('nr-target').value=t.name;$('nr-ra').value=fmt(t.ra,8);$('nr-dec').value=fmt(t.dec,8);
 $('nr-band').value=state.band;$('nr-source').value='1';$('nr-plot').value='groups';$('nr-epoch').value='0';
 render();return true;
}
function currentBandCount(t){
 if(/^D[1-6]$/.test(state.band))return t.counts[Number(state.band.slice(1))-1];
 return null;
}
function hasEpochImage(){
 return state.target==='Epsilon_Indi_B'&&['all','D5','D6','D5+D6'].includes(state.band);
}
function imageSet(src,alt){
 const im=$('nr-plotimage'),empty=$('nr-empty');
 if(!src){im.hidden=true;im.removeAttribute('src');empty.hidden=false;empty.textContent=alt;return;}
 empty.hidden=true;im.hidden=false;im.alt=alt;
 if(im.getAttribute('src')!==src)im.src=src;
}
async function decodeFrames(){
 if(state.frameUrls)return state.frameUrls;
 if(state.decoding)return state.decoding;
 state.decoding=(async()=>{
  if(!('ImageDecoder' in window)||!await ImageDecoder.isTypeSupported('image/gif')){
   throw Error('The browser cannot decode individual GIF frames');
  }
  const response=await fetch(EPOCH_GIF);
  if(!response.ok)throw Error('GIF HTTP '+response.status);
  const data=new Uint8Array(await response.arrayBuffer());
  const decoder=new ImageDecoder({data,type:'image/gif',preferAnimation:true});
  const frames=[];
  try{
   await decoder.tracks.ready;
   for(let i=0;i<GROUPS.length;i++){
    const result=await decoder.decode({frameIndex:i,completeFramesOnly:true});
    const source=result.image;
    const canvas=document.createElement('canvas');
    canvas.width=source.displayWidth;canvas.height=source.displayHeight;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(source,0,0);source.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Could not create PNG for group '+(i+1));
    frames.push(URL.createObjectURL(blob));
   }
  }finally{decoder.close();}
  state.frameUrls=frames;return frames;
 })().catch(e=>{state.decoderNote=String(e.message||e);return null;});
 return state.decoding;
}
function updatePreview(){
 const t=target();
 if(t.products==='epochs'&&hasEpochImage()){
  if(state.blink){imageSet(EPOCH_GIF,tr('七組 Epsilon Indi B D5+D6 疊圖 Blink','Seven-group Epsilon Indi B D5+D6 blink'));return;}
  if(state.frameUrls){imageSet(state.frameUrls[state.group],
    'Epsilon Indi B · D5+D6 · Group '+(state.group+1));return;}
  imageSet(EPOCH_GIF,tr('正在準備七個時間組的影格；GIF 為原始連續動畫','Preparing time-group frames; original animated GIF displayed'));
  decodeFrames().then(frames=>{
   if(state.target==='Epsilon_Indi_B'&&hasEpochImage()&&!state.blink&&frames){
    imageSet(frames[state.group],'Epsilon Indi B · D5+D6 · Group '+(state.group+1));
    setText('nr-status',tr('已載入原始 GIF 的七個影格','Seven original GIF frames loaded'));
   }
  });
 }else if(t.products==='sed'){
  const n=String(state.source).padStart(2,'0');
  const path=BASE+'wise-0855/source-'+n+'-'+(state.plot==='overlay'?'overlay':'groups')+'.png';
  imageSet(path,'WISE 0855 · Source '+state.source+' · '+state.plot);
 }else{
  imageSet('',tr('此目標／波段尚未提供 Notebook 影像；可先查看觀測數量與天球位置。',
    'No notebook image for this target/band; observation counts and sky navigation are still available.'));
 }
}
function render(){
 const t=target(),bandCount=currentBandCount(t),isEpoch=t.products==='epochs';
 setText('nr-count',t.valid+' / '+t.total);
 setText('nr-bandcount',bandCount===null?'—':String(bandCount));
 $('nr-epoch-area').hidden=!isEpoch||!hasEpochImage();
 $('nr-sed-area').hidden=t.products!=='sed';
 $('nr-load').disabled=!hasEpochImage();
 $('nr-epoch').value=String(state.group);
 setText('nr-epochcount',(state.group+1)+' / '+GROUPS.length);
 const g=GROUPS[state.group];
 setText('nr-epochinfo','MJD '+fmt(g.start,5)+' – '+fmt(g.end,5)
   +' · '+g.stack+' '+tr('張 Stack 輸入','stack inputs')
   +' · '+g.phot+' '+tr('張配對測光影像','matched photometry images'));
 $('nr-blink').setAttribute('aria-pressed',String(state.blink));
 setText('nr-blink',state.blink?tr('停止 Blink','Stop Blink'):'Blink');
 if(t.products==='sed'){
  setText('nr-sednote',tr(
   'Source '+state.source+'：顯示原 Notebook 的完整波長 SED（圖例 Group 1–12）。選擇單一 D 波段只會更新資料摘要；缺少 ECSV 時不裁切或重新計算原圖。',
   'Source '+state.source+': original complete-wavelength SED (groups 1–12). A single D-band selection changes the summary only; original graph is not cropped or recalculated without ECSV.'
  ));
 }
 const linkArea=$('nr-links');linkArea.hidden=t.products!=='epochs';
 if(isEpoch){
  let note=tr('此處顯示 D5+D6 的合併 Stack，非 D5 或 D6 的獨立影像。',
   'The available stack combines D5+D6; it is NOT a stand-alone D5 or D6 image.');
  if(!hasEpochImage())note=tr('所選 '+state.band+' 波段的獨立影像尚未輸出，不能用 D5+D6 Stack 代替。',
   'No individual '+state.band+' image exported; the D5+D6 stack must not be mislabelled.');
  setText('nr-availability',note);
 }else if(t.products==='sed'){
  setText('nr-availability',tr(
   '已保存全波段 ePSF SED 圖及 55 個匹配來源的摘要，但未附完整 ECSV。'+
   (bandCount!==null?' 目前選取 '+state.band+'，可用影像紀錄 '+bandCount+' 筆。':''),
   'Full-spectrum SED figures and a 55-source matching summary are available, but the ECSV is missing.'+
   (bandCount!==null?' '+state.band+': '+bandCount+' image records.':'')
  ));
 }else{
  setText('nr-availability',tr(
   '此目標已取得各波段 FITS 紀錄，但 Notebook 沒有內嵌相應 Stack 或 SED 圖；請勿與其他目標的圖混用。',
   'FITS observation counts exist, but stack/SED images for this target are not embedded in this notebook. Images from other fields are not substituted.'
  ));
 }
 updatePreview();
}
function setGroup(n){
 if(!hasEpochImage())return;
 state.group=(n+GROUPS.length)%GROUPS.length;state.blink=false;render();
}
function goTo(ra,dec){
 const r=Number(ra),d=Number(dec);
 if(!Number.isFinite(r)||!Number.isFinite(d)||r<0||r>=360||d< -90||d>90){
  setText('nr-status',tr('請輸入有效的赤經（0–360°）及赤緯（−90° 至 +90°）。',
   'Enter valid RA (0–360°) and Dec (−90° to +90°).'));return false;
 }
 const ok=window.SkyAtlas?.goToCoordinates?.({ra_deg:r,dec_deg:d,fov_deg:0.1});
 setText('nr-status',ok
  ?tr('星圖已前往指定座標；這不會產生新的 SPHEREx 影像。','Sky centered at coordinates; no new SPHEREx image is generated.')
  :tr('星圖座標功能尚未就緒。','Sky atlas navigation is not ready.'));
 return !!ok;
}
$('nr-target').addEventListener('change',e=>{
 const t=matchTarget(e.target.value);
 if(t)selectTarget(t.id);
 else setText('nr-status',tr('找不到此名稱的離線資料；仍可輸入 RA/Dec 定位。','Name is not in the offline catalog; enter RA/Dec to navigate.'));
});
$('nr-target').addEventListener('keydown',e=>{
 if(e.key==='Enter'){e.preventDefault();const t=matchTarget(e.currentTarget.value);if(t)selectTarget(t.id);}
});
$('nr-band').addEventListener('change',e=>{state.band=e.target.value;state.blink=false;render();});
$('nr-epoch').addEventListener('change',e=>setGroup(Number(e.target.value)));
$('nr-prev').addEventListener('click',()=>setGroup(state.group-1));
$('nr-next').addEventListener('click',()=>setGroup(state.group+1));
$('nr-blink').addEventListener('click',()=>{if(!hasEpochImage())return;state.blink=!state.blink;render();});
$('nr-source').addEventListener('change',e=>{state.source=Number(e.target.value);render();});
$('nr-plot').addEventListener('change',e=>{state.plot=e.target.value;render();});
$('nr-go').addEventListener('click',()=>goTo($('nr-ra').value,$('nr-dec').value));
$('nr-load').addEventListener('click',async()=>{
 if(!hasEpochImage())return;
 const control=$('nr-load');control.disabled=true;
 setText('nr-status',tr('正在準備影像 Viewer…','Preparing image viewer…'));
 const frames=await decodeFrames();
 const data={
  field_id:'Epsilon_Indi_B_D5_D6_notebook',
  status:'ready',
  center:{ra_deg:331.04414659,dec_deg:-56.78284420},
  frames:(frames?GROUPS.map((g,i)=>({
   frame_id:'group_'+(i+1),label:'Group '+(i+1)+' · D5+D6 (combined)',
   mjd:(g.start+g.end)/2,image_url:frames[i],width:600,height:600
  })): [{frame_id:'animated',label:'7-group D5+D6 animated GIF',image_url:EPOCH_GIF}]),
  sources:[],
  notice:tr(
   'Notebook：Epsilon Indi B，D5+D6 合併 Stack；GIF/影格為顯示用預覽，不具可直接點選的 WCS Source Pixels。Group 2 僅有 1 張輸入影像。',
   'Notebook: Epsilon Indi B, D5+D6 combined stack; preview frames have no selectable WCS source pixels. Group 2 contains only one stack input.'
  )
 };
 if(window.SPHERExViewer?.setData){
  window.SPHERExViewer.setData(data);
  setText('nr-status',frames?tr('七組影像已載入 Viewer','Seven image groups loaded into Viewer'):
   tr('已載入動畫；此瀏覽器不支援逐影格解碼','Animated GIF loaded; individual frame decoding is unavailable'));
 }else setText('nr-status',tr('找不到 SPHEREx Viewer。','SPHEREx Viewer not loaded.'));
 control.disabled=false;
});
window.addEventListener('beforeunload',()=>{if(state.frameUrls)state.frameUrls.forEach(url=>URL.revokeObjectURL(url));});
new MutationObserver(()=>localize()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.SPHERExNotebookResults={
 targets:TARGETS.map(t=>({id:t.id,name:t.name,ra_deg:t.ra,dec_deg:t.dec,band_counts:t.counts.slice(),usable:t.valid,total:t.total})),
 groups:GROUPS.map(g=>({...g})),
 selectTarget, selectBand(b){if(['all','D1','D2','D3','D4','D5','D6','D5+D6'].includes(b)){state.band=b;$('nr-band').value=b;render();return true;}return false;},
 navigate:goTo, current(){return{target:state.target,band:state.band,group:state.group+1,source:state.source};}
};
selectTarget('Epsilon_Indi_B');localize();
})();
