/* SPHEREx science viewer. Image previews are 0-based, top-left pixel arrays.
   Backend integration: window.SPHERExViewer.setData({frames, difference, sources}).
   Overlays require frame_positions with PNG coordinates, not detector coordinates. */
(function(){
'use strict';
const $=id=>document.getElementById(id), num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const fmt=(x,n=3)=>num(x)?Number(x).toFixed(n):'—';
const ja=(tw,en)=>(document.documentElement.lang||'zh').startsWith('zh')?tw:en;
const app={data:null,index:0,diff:false,playing:false,timer:null,selection:null,annotated:true};
function el(tag,attrs={},text){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
const launch=el('button',{id:'spx-launch',type:'button','aria-expanded':'false','aria-controls':'spx-viewer'},'✦ SPHEREx Viewer');
const panel=el('aside',{id:'spx-viewer',role:'region','aria-label':'SPHEREx Observation Viewer'});
panel.innerHTML=[
'<div class="spx-head"><div><h2 id="spx-title">SPHEREx Observation Viewer</h2><p class="spx-sub" id="spx-subtitle"></p></div><button type="button" id="spx-close" aria-label="Close">×</button></div>',
'<div class="spx-body">',
'<div class="spx-visual"><div id="spx-imagebox"><div id="spx-zoom"><img id="spx-image" alt="SPHEREx published observation preview" draggable="false"><div id="spx-markers"></div></div><div id="spx-empty"></div>',
'<div class="spx-zoombar"><button type="button" id="spx-zoom-in" aria-label="Zoom in">+</button><button type="button" id="spx-zoom-out" aria-label="Zoom out">−</button><button type="button" id="spx-zoom-fit">Fit</button></div></div>',
'<label class="spx-brightness-rail" for="spx-brightness"><span class="spx-brightness-caption" id="spx-brightness-caption">BRIGHTNESS</span><input id="spx-brightness" type="range" min="1" max="10" value="1" step="0.5" aria-label="Display brightness (visual only)" aria-orientation="vertical"><output id="spx-brightness-value" for="spx-brightness">1×</output><span class="spx-brightness-note" id="spx-brightness-note">VISUAL ONLY</span></label></div>',
'<div class="spx-meta"><span id="spx-epoch">Epoch —</span><span id="spx-wave">λ —</span></div>',
'<div class="spx-controls"><button id="spx-prev" type="button">Previous</button><button id="spx-play" type="button" aria-pressed="false">Blink</button><button id="spx-next" type="button">Next</button><button id="spx-difference" type="button" aria-pressed="false" aria-describedby="spx-diff-hint">Difference</button></div>',
'<p id="spx-diff-hint" class="spx-note"></p>',
'<input id="spx-slider" type="range" min="0" max="0" value="0" aria-label="Epoch position">',
'<label id="spx-toggle-markers"><input id="spx-markers-on" type="checkbox" checked> <span id="spx-markers-label">Show annotated GIF</span></label>',
'<p id="spx-status" role="status" aria-live="polite"></p>',
'<details id="spx-info"><summary id="spx-info-summary"></summary><ul id="spx-info-list"></ul></details>',
'<section id="spx-education" aria-label="Astronomy reading">',
 '<div class="spx-education-heading"><span>EXPLORE ASTRONOMY</span><button id="spx-another-topic" type="button">Another topic</button></div>',
 '<h3 id="spx-reading-title"></h3><div id="spx-reading-body"></div>',
 '</section>',
'</div>'
].join('');
// Dock the viewer alongside the live sky canvas instead of covering it.
const main=document.getElementById('main');
if(main)main.append(panel);
else document.body.append(panel);
document.body.append(launch);
const skyStage=document.getElementById('stage');
const skyContext=el('div',{id:'spx-sky-context','aria-live':'polite'});
skyContext.hidden=true;
skyStage?.append(skyContext);
// Place the viewer control inside the reference design's top navigation.
const headerActions=document.querySelector('#top .top-actions');
if(headerActions)headerActions.prepend(launch);
panel.hidden=true;
const image=$('spx-image'),box=$('spx-imagebox'),markers=$('spx-markers'),zoomLayer=$('spx-zoom');
image.style.filter='brightness(1) contrast(1)';
/* Zoom / pan: image and markers share one transformed layer, so marker
   positions (computed in untransformed box pixels) stay aligned. */
const view={z:1,x:0,y:0};
function applyZoom(){
 const r=box.getBoundingClientRect();
 const mx=(view.z-1)*r.width/2,my=(view.z-1)*r.height/2;
 view.x=Math.max(-mx,Math.min(mx,view.x));view.y=Math.max(-my,Math.min(my,view.y));
 zoomLayer.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.z+')';
 box.classList.toggle('zoomed',view.z>1.001);
 $('spx-zoom-fit').disabled=view.z<=1.001;$('spx-zoom-out').disabled=view.z<=1.001;$('spx-zoom-in').disabled=view.z>=8;
}
function zoomAt(f,cx,cy){
 const r=box.getBoundingClientRect();
 const px=(cx??r.left+r.width/2)-r.left-r.width/2,py=(cy??r.top+r.height/2)-r.top-r.height/2;
 const z=Math.max(1,Math.min(8,view.z*f)),k=z/view.z;
 view.x=px-(px-view.x)*k;view.y=py-(py-view.y)*k;view.z=z;applyZoom();
}
function resetZoom(){view.z=1;view.x=0;view.y=0;applyZoom();}
box.addEventListener('wheel',e=>{if(!app.data)return;e.preventDefault();zoomAt(Math.exp(-Math.max(-300,Math.min(300,e.deltaY))*0.002),e.clientX,e.clientY);},{passive:false});
box.addEventListener('dblclick',e=>{if(e.target.closest('.spx-marker,.spx-zoombar'))return;view.z>1.001?resetZoom():zoomAt(2.5,e.clientX,e.clientY);});
let pan=null;
box.addEventListener('pointerdown',e=>{if(view.z<=1.001||e.target.closest('.spx-marker,.spx-zoombar'))return;pan={id:e.pointerId,x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};try{box.setPointerCapture(e.pointerId);}catch(_){}box.classList.add('panning');});
box.addEventListener('pointermove',e=>{if(!pan||pan.id!==e.pointerId)return;view.x=pan.vx+e.clientX-pan.x;view.y=pan.vy+e.clientY-pan.y;applyZoom();});
const endPan=e=>{if(pan&&pan.id===e.pointerId){pan=null;box.classList.remove('panning');}};
box.addEventListener('pointerup',endPan);box.addEventListener('pointercancel',endPan);
function status(message,error=false){$('spx-status').textContent=message;$('spx-status').classList.toggle('error',error);}
function current(){
 const d=app.data;
 if(!app.annotated && d?.plain_frames?.length===d?.frames?.length)
  return d.plain_frames[app.index]||null;
 return d?.frames?.[app.index]||null;
}
function frameImage(){return app.diff?app.data?.difference:current();}
function resolveImage(url,base){
 if(typeof url!=='string'||!url.trim())return '';
 const u=new URL(url,base||document.baseURI);
 if(!(['http:','https:','blob:'].includes(u.protocol)||u.protocol==='data:'&&/^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)))throw Error('Unsupported image URL');
 return u.href;
}
function normalize(raw,base){
 if(!raw||typeof raw!=='object')throw Error('Expected manifest object');
 const frames=(Array.isArray(raw.frames)?raw.frames:[]).map((f,i)=>({
   ...f,frame_id:String(f.frame_id??f.id??('frame_'+(i+1))),
   label:String(f.label??f.epoch??f.frame_id??('Epoch '+(i+1))),
   image_url:resolveImage(f.image_url??f.url,base),
   width:num(f.width)?Number(f.width):null,height:num(f.height)?Number(f.height):null
 })).filter(f=>f.image_url);
 const plain_frames=(Array.isArray(raw.plain_frames)?raw.plain_frames:[]).map((f,i)=>({
   ...f,frame_id:String(f.frame_id??('plain_'+(i+1))),
   label:String(f.label??('Epoch '+(i+1))),
   image_url:resolveImage(f.image_url??f.url,base)
 })).filter(f=>f.image_url);
 const d=raw.difference||raw.diff;
 const difference=d&&(d.image_url||d.url)?{...d,image_url:resolveImage(d.image_url??d.url,base)}:null;
 return {...raw,frames,plain_frames,difference,sources:Array.isArray(raw.sources)?raw.sources:[],
  status:String(raw.status??(frames.length?'ready':'no_data'))};
}
function stop(){clearTimeout(app.timer);app.timer=null;app.playing=false;$('spx-play').textContent=ja('輪播','Blink');$('spx-play').setAttribute('aria-pressed','false');}
function focusSkyContext(){
 const center=app.data?.center;
 const ra=Number(center?.ra_deg),dec=Number(center?.dec_deg);
 if(!center||!Number.isFinite(ra)||ra<0||ra>=360||
    !Number.isFinite(dec)||dec< -90||dec>90){
  skyContext.hidden=true;
  return false;
 }
 const target=String(app.data?.target_name||app.data?.field_id||'Science target');
 skyContext.textContent=target+ja('（參考座標）',' (reference position)');
 skyContext.title=ra.toFixed(5)+'°, '+(dec>=0?'+':'')+dec.toFixed(5)+'°；'+
  ja('參考座標，不代表偵測證據','reference coordinate, not proof of detection');
 skyContext.hidden=false;
 return !!window.SkyAtlas?.goToCoordinates?.({ra_deg:ra,dec_deg:dec,fov_deg:2});
}
function open(yes=true){
 panel.hidden=!yes;document.body.classList.toggle('spx-open',yes);launch.setAttribute('aria-expanded',String(yes));
 localize();
 if(!yes){stop();skyContext.hidden=true;}
 else{focusSkyContext();showRandomReading();requestAnimationFrame(drawMarkers);}
}
function setData(raw,opts={}){
 const d=normalize(raw,opts.baseURL);
 stop();app.data=d;app.index=0;app.diff=false;app.selection=null;app.annotated=true;resetZoom();
 box.classList.toggle('figure',d.frame_origin==='marked-gif');
 $('spx-markers-on').checked=true;
 $('spx-markers-on').disabled=!(d.plain_frames.length===d.frames.length&&d.frames.length>0);
 $('spx-brightness').value='1';
 $('spx-brightness-value').textContent='1×';
 image.style.filter='brightness(1) contrast(1)';
 if(d.sources.length&&window.SPHERExCatalog?.setSources)window.SPHERExCatalog.setSources(d.sources);
 render();if(opts.open!==false)open(true);
 return {frames:d.frames.length,sources:d.sources.length};
}
function markerId(s){return String(s.global_source_id||s.detection_id||s.candidate_id||s.source_id||'Source');}
function framePos(source,frame){
 const p=(Array.isArray(source.frame_positions)?source.frame_positions:[])
   .find(o=>String(o.frame_id??o.observation_id)===frame.frame_id);
 if(!p||p.covered===false||!num(p.x_px)||!num(p.y_px))return null;
 return p;
}
function drawMarkers(){
 markers.replaceChildren();
 const fr=current();if(app.data?.frame_origin==='marked-gif'||app.diff||!fr||!image.complete||!image.naturalWidth||!app.data?.sources?.length)return;
 const rect=box.getBoundingClientRect(),iw=image.naturalWidth,ih=image.naturalHeight;
 const scale=Math.min(rect.width/iw,rect.height/ih),ox=(rect.width-iw*scale)/2,oy=(rect.height-ih*scale)/2;
 const w=fr.width||iw,h=fr.height||ih;
 for(const s of app.data.sources){
   const p=framePos(s,fr);if(!p)continue;
   const x=Number(p.x_px),y=Number(p.y_px);
   if(x<0||y<0||x>=w||y>=h)continue;
   const dot=el('button',{type:'button','aria-label':'Source '+markerId(s),
    class:'spx-marker'+(String(s.quality_status).toLowerCase()==='pass'?'':' warn')});
   dot.style.left=(ox+(x+.5)*iw/w*scale)+'px';
   dot.style.top=(oy+(y+.5)*ih/h*scale)+'px';
   if(app.selection&&markerId(app.selection)===markerId(s))dot.classList.add('selected');
   dot.addEventListener('click',()=>selectSource(s,true));markers.appendChild(dot);
 }
}
function selectSource(s,fromViewer=false){
 app.selection=s;
 const ra=s.ra_deg??s.ra,dec=s.dec_deg??s.dec;
 const lines=[markerId(s),'RA '+fmt(ra,6)+'°, Dec '+fmt(dec,6)+'°',
    'Quality: '+String(s.quality_status||'unknown')];
 if(num(s.flux_mjy))lines.push('Flux: '+fmt(s.flux_mjy,4)+' mJy');
 if(num(s.flux_error_mjy))lines.push('Flux uncertainty: '+fmt(s.flux_error_mjy,4)+' mJy');
 // Source-specific metadata is available in the Science Results catalog.
 drawMarkers();
 if(fromViewer&&num(ra)&&num(dec))window.SkyAtlas?.focusSource?.(s);
}
function render(){
 const data=app.data,fr=current(),payload=frameImage();
 $('spx-prev').disabled=(data?.frames?.length||0)<2;
 $('spx-next').disabled=(data?.frames?.length||0)<2;
 $('spx-play').disabled=(data?.frames?.length||0)<2;
 $('spx-difference').disabled=!data?.difference;
 $('spx-diff-hint').textContent=data&&!data.difference?ja('這組資料沒有已驗證的差分影像，所以無法使用「差分」。','No validated difference image for this run, so Difference is unavailable.'):'';
 $('spx-diff-hint').hidden=!$('spx-diff-hint').textContent;
 $('spx-difference').setAttribute('aria-pressed',String(app.diff));
 $('spx-slider').max=String(Math.max(0,(data?.frames?.length||1)-1));
 $('spx-slider').value=String(app.index);
 $('spx-slider').disabled=(data?.frames?.length||0)<2;
 markers.replaceChildren();
 if(payload?.image_url){
   image.style.display='block';$('spx-empty').hidden=true;
   image.onload=()=>{
     status((data.frame_origin==='marked-gif'?
       ja('標記 GIF 影格','Marked GIF frame'):ja('影像已載入','Image loaded'))+
       ' · '+(app.index+1)+'/'+data.frames.length);
     drawMarkers();
   };
   image.onerror=()=>{status(ja('影像讀取失敗：檢查網址或跨來源限制','Image failed: check URL and CORS'),true);};
   image.src=payload.image_url;
   if(image.complete&&image.naturalWidth)drawMarkers();
 }else{
   image.style.display='none';image.removeAttribute('src');$('spx-empty').hidden=false;
   status(ja('尚無觀測影像','No observation images'));
 }
 $('spx-epoch').textContent=app.diff?'November − May':(fr?.label||ja('時段 —','Epoch —'))+(num(fr?.mjd)?' · MJD '+fmt(fr.mjd,3):'');
 $('spx-wave').textContent=data?.frame_origin==='marked-gif'
  ?(app.annotated?'Marked':'Original')+' GIF · '+(app.index+1)+' / '+(data?.frames?.length||0)
  :num(fr?.wavelength_um)?'λ '+fmt(fr.wavelength_um,5)+' μm':'λ —';

}
function changeFrame(i){
 const n=app.data?.frames?.length||0;if(!n)return;
 app.index=(i+n)%n;app.diff=false;render();
}
function play(){
 if(app.playing){stop();return;}
 if((app.data?.frames?.length||0)<2)return;
 app.playing=true;app.diff=false;
 $('spx-play').textContent=ja('暫停','Pause');$('spx-play').setAttribute('aria-pressed','true');
 const tick=()=>{
  if(!app.playing)return;
  const ms=Number(current()?.duration_ms)||800;
  app.timer=setTimeout(()=>{
   if(!app.playing)return;
   changeFrame(app.index+1);
   tick();
  },Math.max(80,Math.min(ms,5000)));
 };
 tick();
}

const ASTRONOMY_ARTICLES=[
 {
  title:'Variable Stars',
  paragraphs:[
   "Variable stars are astronomical objects whose luminosity changes over time. Their brightness variations can be intrinsic—caused by physical changes within the star—or extrinsic, caused by our viewing geometry.",
   "Intrinsic variables include pulsating stars, whose radii expand and contract; eruptive stars, which eject material from their surfaces; cataclysmic variables, often close binary systems where a white dwarf accretes matter from a companion; and X-ray variables in compact, high-density systems that produce strong high-energy emission.",
   "In a cataclysmic binary, accumulated matter can ignite a nova on a white dwarf's surface. Under particular conditions, white-dwarf evolution can also lead to a Type Ia supernova. Massive stars can produce other kinds of supernovae at the end of their lives.",
   "Extrinsic variables change apparent brightness because of their orientation to Earth. Eclipsing binaries dim when one component crosses in front of the other. Rotating stars with nonuniform surface brightness may also show periodic changes as spots rotate into and out of view."
  ]
 },
 {
  title:'Fast-Moving Objects',
  paragraphs:[
   "Fast-moving objects include astronomical bodies with exceptionally high velocities relative to the Galactic Center or with large apparent motion across the sky.",
   "Some stars travel extremely quickly because they orbit close to the supermassive black hole at the center of the Milky Way. S4714 is an example: its reported peak speed is approximately 24,000 km/s, or about 8% of the speed of light.",
   "Other stars look as though they move rapidly because they are nearby rather than because they have extreme physical speeds. This angular displacement is called proper motion. Barnard's Star, near our Solar System, is a well-known high-proper-motion example."
  ]
 }
];
let lastArticle=-1;
function showRandomReading(){
 let next=Math.floor(Math.random()*ASTRONOMY_ARTICLES.length);
 if(ASTRONOMY_ARTICLES.length>1&&next===lastArticle)
  next=(next+1)%ASTRONOMY_ARTICLES.length;
 lastArticle=next;
 const article=ASTRONOMY_ARTICLES[next],body=$('spx-reading-body');
 $('spx-reading-title').textContent=article.title;
 body.replaceChildren();
 for(const paragraph of article.paragraphs){
  const p=document.createElement('p');p.textContent=paragraph;body.append(p);
 }
}

function localize(){
 const yes=!panel.hidden;
 launch.textContent=yes?ja('關閉影像','Close viewer'):ja('觀測影像','Image viewer');
 launch.dataset.short=yes?ja('關閉','Close'):ja('影像','Viewer');
 $('spx-title').textContent=ja('SPHEREx 觀測影像','SPHEREx image viewer');
 $('spx-subtitle').textContent=ja('逐張檢視時間分組影像；滾輪縮放、拖曳平移、雙擊放大。','Step through time-group frames. Scroll to zoom, drag to pan, double-click to zoom.');
 $('spx-close').setAttribute('aria-label',ja('關閉','Close'));
 $('spx-empty').textContent=ja('在「科學分析結果」選一組結果，再按「在影像檢視器開啟」。','Choose a published analysis run in Science Results, then select “Open in image viewer”.');
 $('spx-zoom-fit').textContent=ja('符合','Fit');
 $('spx-zoom-in').setAttribute('aria-label',ja('放大','Zoom in'));$('spx-zoom-out').setAttribute('aria-label',ja('縮小','Zoom out'));
 $('spx-brightness-caption').textContent=ja('亮度','BRIGHT');
 $('spx-brightness-note').textContent=ja('僅顯示','DISPLAY ONLY');
 $('spx-prev').textContent=ja('上一張','Previous');$('spx-next').textContent=ja('下一張','Next');
 $('spx-difference').textContent=ja('差分','Difference');
 $('spx-play').textContent=app.playing?ja('暫停','Pause'):ja('輪播','Blink');
 $('spx-slider').setAttribute('aria-label',ja('時段位置','Epoch position'));
 $('spx-markers-label').textContent=ja('顯示標記動畫','Show annotated GIF');
 $('spx-info-summary').textContent=ja('關於這些影像','About these images');
 const notes=ja([
  '影像取自標記 GIF 的每一格；取消勾選「顯示標記動畫」可看無標記的原始影格。',
  '亮度只改變畫面呈現，不改變測光結果。',
  '動畫裡的標記是畫在圖上的，不能點選來對應天空座標。',
  '演算法標出的 mover / variable 只是候選，尚未經科學確認。',
  '完整的 FITS 分析在後端進行，這裡只顯示預覽圖。'
 ],[
  'Frames come from the marked GIF; untick “Show annotated GIF” for the unmarked original frames.',
  'Brightness only changes the display, never the photometry.',
  'Labels in the animation are drawn into the image; they are not clickable sky coordinates.',
  'Algorithm mover / variable flags are candidates, not confirmed objects.',
  'Full FITS analysis runs on the backend; this shows previews only.'
 ]);
 $('spx-info-list').replaceChildren(...notes.map(t=>el('li',{},t)));
 render();
}
new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
$('spx-zoom-in').onclick=()=>zoomAt(1.6);
$('spx-zoom-out').onclick=()=>zoomAt(1/1.6);
$('spx-zoom-fit').onclick=resetZoom;
launch.onclick=()=>open(panel.hidden);
$('spx-close').onclick=()=>open(false);
$('spx-prev').onclick=()=>{stop();changeFrame(app.index-1);};
$('spx-next').onclick=()=>{stop();changeFrame(app.index+1);};
$('spx-play').onclick=play;
$('spx-difference').onclick=()=>{stop();app.diff=!app.diff;render();};
$('spx-slider').oninput=e=>{stop();changeFrame(Number(e.target.value));};
$('spx-markers-on').onchange=e=>{app.annotated=e.target.checked;render();};
$('spx-another-topic').onclick=showRandomReading;
$('spx-brightness').oninput=e=>{
 const brightness=Number(e.target.value);
 image.style.filter='brightness('+brightness+') contrast(1)';
 $('spx-brightness-value').textContent=brightness+'×';
};
window.addEventListener('spherex:select-source',e=>{
 const source=e.detail?.source;if(source){
   const match=app.data?.sources?.find(s=>markerId(s)===markerId(source));
   selectSource(match||source,false);
 }
});
window.addEventListener('resize',()=>{if(!panel.hidden){applyZoom();drawMarkers();}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false);});
window.SPHERExViewer={setData,open:()=>open(true),close:()=>open(false),
 getState:()=>({frame:app.index,mode:app.diff?'difference':'frame',frames:app.data?.frames?.length||0,open:!panel.hidden,zoom:view.z,annotated:app.annotated})};
localize();applyZoom();
})();
