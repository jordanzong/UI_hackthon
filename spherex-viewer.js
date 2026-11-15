/* SPHEREx science viewer. Image previews are 0-based, top-left pixel arrays.
   Backend integration: window.SPHERExViewer.setData({frames, difference, sources}).
   Overlays require frame_positions with PNG coordinates, not detector coordinates. */
(function(){
'use strict';
const $=id=>document.getElementById(id), num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const fmt=(x,n=3)=>num(x)?Number(x).toFixed(n):'—';
const ja=(tw,en)=>(document.documentElement.lang||'zh').startsWith('zh')?tw:en;
const app={data:null,index:0,diff:false,playing:false,timer:null,urls:[],selection:null,markers:true,loading:0};
function el(tag,attrs={},text){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
const launch=el('button',{id:'spx-launch',type:'button','aria-expanded':'false','aria-controls':'spx-viewer'},'✦ SPHEREx Viewer');
const panel=el('aside',{id:'spx-viewer',role:'region','aria-label':'SPHEREx Observation Viewer'});
panel.innerHTML=[
'<div class="spx-head"><div><h2>SPHEREx Observation Viewer</h2><p class="spx-sub">DR1 · Wavelength · Time Domain</p></div><button type="button" id="spx-close" aria-label="Close">×</button></div>',
'<div class="spx-body">',
'<div class="spx-controls"><button id="spx-demo" type="button">DR1 Example</button><button id="spx-import-img" type="button">Import Images</button><button id="spx-import-json" type="button">Import JSON</button></div>',
'<input type="file" id="spx-file-img" accept=".png,.jpg,.jpeg,.webp,.gif,image/*" multiple hidden>',
'<input type="file" id="spx-file-json" accept=".json,application/json" hidden>',
'<div class="spx-url"><input id="spx-manifest-url" type="url" placeholder="https://.../field.json" aria-label="JSON manifest URL"><button id="spx-load" type="button">Load URL</button></div>',
'<div id="spx-imagebox"><img id="spx-image" alt="SPHEREx observation preview" draggable="false"><div id="spx-markers"></div><div id="spx-empty">Load the DR1 example or select your own PNG/GIF.</div></div>',
'<div class="spx-meta"><span id="spx-epoch">Epoch —</span><span id="spx-wave">λ —</span></div>',
'<div class="spx-controls"><button id="spx-prev" type="button">◀ Prev</button><button id="spx-play" type="button" aria-pressed="false">▶ Blink</button><button id="spx-next" type="button">Next ▶</button><button id="spx-difference" type="button" aria-pressed="false">Difference</button></div>',
'<input id="spx-slider" type="range" min="0" max="0" value="0" aria-label="Epoch position">',
'<label class="spx-note" for="spx-brightness">Display brightness (visual only) <input id="spx-brightness" type="range" min="1" max="10" value="3" step="0.5" aria-label="Display brightness"></label>',
'<label id="spx-toggle-markers"><input id="spx-markers-on" type="checkbox" checked> Source markers (science-image pixel positions)</label>',
'<p id="spx-status" role="status" aria-live="polite"></p>',
'<div id="spx-caveat" hidden></div><div id="spx-source-detail" aria-live="polite">Select a source marker to inspect details.</div>',
'<p class="spx-note">Real FITS analysis remains on the backend. The viewer displays calibrated image previews and only draws sources where frame-specific pixel coordinates were provided.</p>',
'</div>'
].join('');
document.body.append(launch,panel);
// Place the viewer control inside the reference design's top navigation.
const headerActions=document.querySelector('#top .top-actions');
if(headerActions)headerActions.prepend(launch);
panel.hidden=true;
const image=$('spx-image'),box=$('spx-imagebox'),markers=$('spx-markers');
image.style.filter='brightness(3) contrast(1.1)';
function status(message,error=false){$('spx-status').textContent=message;$('spx-status').classList.toggle('error',error);}
function current(){return app.data?.frames?.[app.index]||null;}
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
 const d=raw.difference||raw.diff;
 const difference=d&&(d.image_url||d.url)?{...d,image_url:resolveImage(d.image_url??d.url,base)}:null;
 return {...raw,frames,difference,sources:Array.isArray(raw.sources)?raw.sources:[],
  status:String(raw.status??(frames.length?'ready':'no_data'))};
}
function stop(){clearInterval(app.timer);app.timer=null;app.playing=false;$('spx-play').textContent='▶ Blink';$('spx-play').setAttribute('aria-pressed','false');}
function open(yes=true){
 panel.hidden=!yes;document.body.classList.toggle('spx-open',yes);launch.setAttribute('aria-expanded',String(yes));
 launch.textContent=yes?'✕ Hide Viewer':'✦ SPHEREx Viewer';
 if(!yes)stop();if(yes)requestAnimationFrame(drawMarkers);
}
function resetLocalFiles(){for(const url of app.urls)URL.revokeObjectURL(url);app.urls=[];}
function setData(raw,opts={}){
 const d=normalize(raw,opts.baseURL);
 stop();resetLocalFiles();app.data=d;app.index=0;app.diff=false;app.selection=null;
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
 const fr=current();if(!app.markers||app.diff||!fr||!image.complete||!image.naturalWidth||!app.data?.sources?.length)return;
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
 $('spx-source-detail').textContent=lines.join('\n');
 drawMarkers();
 if(fromViewer&&num(ra)&&num(dec))window.SkyAtlas?.focusSource?.(s);
}
function render(){
 const data=app.data,fr=current(),payload=frameImage();
 $('spx-prev').disabled=(data?.frames?.length||0)<2;
 $('spx-next').disabled=(data?.frames?.length||0)<2;
 $('spx-play').disabled=(data?.frames?.length||0)<2;
 $('spx-difference').disabled=!data?.difference;
 $('spx-difference').setAttribute('aria-pressed',String(app.diff));
 $('spx-slider').max=String(Math.max(0,(data?.frames?.length||1)-1));
 $('spx-slider').value=String(app.index);
 $('spx-slider').disabled=(data?.frames?.length||0)<2;
 markers.replaceChildren();
 if(payload?.image_url){
   image.style.display='block';$('spx-empty').hidden=true;
   image.onload=()=>{status(ja('影像已載入','Image loaded')+' · '+(app.index+1)+'/'+data.frames.length);drawMarkers();};
   image.onerror=()=>{status(ja('影像讀取失敗：檢查網址或跨來源限制','Image failed: check URL and CORS'),true);};
   image.src=payload.image_url;
   if(image.complete&&image.naturalWidth)drawMarkers();
 }else{
   image.style.display='none';image.removeAttribute('src');$('spx-empty').hidden=false;
   status(ja('尚無觀測影像','No observation images'));
 }
 $('spx-epoch').textContent=app.diff?'November − May':(fr?.label||'Epoch —')+(num(fr?.mjd)?' · MJD '+fmt(fr.mjd,3):'');
 $('spx-wave').textContent=num(fr?.wavelength_um)?'λ '+fmt(fr.wavelength_um,5)+' μm':'λ —';
 const note=data?.notice||(data?.status==='coverage_unavailable'?ja('目標座標不在共同有效遮罩；空白不代表未偵測','Target outside common valid mask; blank does not mean undetected'):'');
 $('spx-caveat').hidden=!note;$('spx-caveat').textContent=note;
 if(!app.selection)$('spx-source-detail').textContent=data?.sources?.length?
    ja('點選影像標記查看來源；需提供每張影像的 frame_positions','Click markers; frame_positions required for each image'):
    ja('尚無來源標記。可匯入含 frame_positions 的 Manifest','No source positions. Import a manifest with frame_positions.');
}
function changeFrame(i){
 const n=app.data?.frames?.length||0;if(!n)return;
 app.index=(i+n)%n;app.diff=false;render();
}
function play(){
 if(app.playing){stop();return;}
 if((app.data?.frames?.length||0)<2)return;
 app.playing=true;app.diff=false;
 $('spx-play').textContent='❚❚ Pause';$('spx-play').setAttribute('aria-pressed','true');
 changeFrame(app.index+1);app.timer=setInterval(()=>changeFrame(app.index+1),800);
}
async function loadFromUrl(url){
 const seq=++app.loading;status(ja('正在取得 Manifest…','Loading manifest…'));
 const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
 const d=await res.json();if(seq!==app.loading)return null;
 return setData(d,{baseURL:res.url||url});
}
async function importImages(list){
 const files=[...list].filter(f=>/^image\/(png|jpeg|webp|gif)$/.test(f.type)||/\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
  .sort((a,b)=>a.name.localeCompare(b.name));
 if(!files.length)throw Error('Select PNG, WebP, JPEG or GIF (not FITS)');
 const urls=files.map(f=>URL.createObjectURL(f)),frames=[];let difference=null;
 files.forEach((f,i)=>{
   const o={frame_id:f.name,label:f.name,image_url:urls[i]};
   if(/diff(erence)?/i.test(f.name))difference=o;else frames.push(o);
 });
 const result=setData({field_id:'local_images',status:'ready',frames,difference,
  notice:ja('本機影像模式：無 WCS、有效遮罩或來源像素位置。','Local preview: no WCS, mask or source pixel positions.')});
 app.urls=urls;return result;
}
launch.onclick=()=>open(panel.hidden);
$('spx-close').onclick=()=>open(false);
$('spx-demo').onclick=()=>setData(window.SPHEREx_DemoManifest||{frames:[]});
$('spx-prev').onclick=()=>{stop();changeFrame(app.index-1);};
$('spx-next').onclick=()=>{stop();changeFrame(app.index+1);};
$('spx-play').onclick=play;
$('spx-difference').onclick=()=>{stop();app.diff=!app.diff;render();};
$('spx-slider').oninput=e=>{stop();changeFrame(Number(e.target.value));};
$('spx-markers-on').onchange=e=>{app.markers=e.target.checked;drawMarkers();};
$('spx-brightness').oninput=e=>{image.style.filter='brightness('+Number(e.target.value)+') contrast(1.1)';};
$('spx-import-img').onclick=()=>$('spx-file-img').click();
$('spx-import-json').onclick=()=>$('spx-file-json').click();
$('spx-file-img').onchange=async e=>{try{await importImages(e.target.files);}catch(err){status(String(err.message||err),true);}e.target.value='';};
$('spx-file-json').onchange=async e=>{const f=e.target.files?.[0];if(f)try{setData(JSON.parse(await f.text()));}catch(err){status(String(err.message||err),true);}e.target.value='';};
$('spx-load').onclick=async()=>{
 try{const url=$('spx-manifest-url').value.trim();if(!url)throw Error('Enter manifest URL');await loadFromUrl(url);}
 catch(err){status(String(err.message||err),true);}
};
window.addEventListener('spherex:select-source',e=>{
 const source=e.detail?.source;if(source){
   const match=app.data?.sources?.find(s=>markerId(s)===markerId(source));
   selectSource(match||source,false);
 }
});
window.addEventListener('resize',()=>{if(!panel.hidden)drawMarkers();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false);});
window.SPHERExViewer={setData,loadFromUrl,importImages,open:()=>open(true),close:()=>open(false),
 getState:()=>({frame:app.index,mode:app.diff?'difference':'frame',frames:app.data?.frames?.length||0,open:!panel.hidden})};
if(window.SPHEREx_DemoManifest)setData(window.SPHEREx_DemoManifest,{open:innerWidth>700});
else render();
})();
