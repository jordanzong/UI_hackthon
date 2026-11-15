/* HYG v4.1 real whole-sky star layer.
 * Original: https://github.com/astronexus/HYG-Database
 * David Nash/Astronexus, CC BY-SA 4.0. J2000 positions and VISUAL V
 * magnitude. This is not Gaia DR3, which remains its own layer. */
(()=>{
'use strict';
const sky=window.SkyAtlas;
if(!sky?.registerAllSkyLayer)return;
const state={
  manifest:null,bright:[],tiles:new Map(),active:[],pending:new Set(),
  failed:new Set(),error:'',ready:false
};
const D2R=Math.PI/180, R2D=180/Math.PI;
const ROOT='./catalogs/allsky/';
function normalize(data){
 if(!Array.isArray(data))return[];
 return data.map(s=>{
  if(!Array.isArray(s)||s.length<4)return null;
  const [id,ra,dec,mag]=s.map((v,i)=>i<4?Number(v):v);
  if(!Number.isInteger(id)||id<0||![ra,dec,mag].every(Number.isFinite)||
     ra<0||ra>=360||dec< -90||dec>90||mag>11.5)return null;
  const proper=typeof s[4]==='string'?s[4]:'';
  return {kind:'hyg',id:String(id),source_id:'HYG '+id,n:proper||'HYG '+id,
    proper,ra:ra*D2R,dec:dec*D2R,mag};
 }).filter(Boolean);
}
function sepDeg(a,b,c,d){
 const sd=Math.sin((b-d)/2),sr=Math.sin((a-c)/2);
 const q=sd*sd+Math.cos(b)*Math.cos(d)*sr*sr;
 return 2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,q))))*R2D;
}
function requestDraw(){sky.requestRedraw?.();}
async function init(){
 try{
  const r=await fetch(ROOT+'manifest.json',{cache:'force-cache'});
  if(!r.ok)throw Error('HYG manifest HTTP '+r.status);
  const m=await r.json();
  if(m.catalog!=='HYG Database v4.1'||!Array.isArray(m.tiles)||
     m.tile_count<100||m.bright_count<4000)
   throw Error('Unexpected HYG manifest');
  const rb=await fetch(ROOT+String(m.bright_file||'bright.json'),{cache:'force-cache'});
  if(!rb.ok)throw Error('HYG bright HTTP '+rb.status);
  const bright=normalize(await rb.json());
  if(bright.length<4000)throw Error('HYG bright data invalid or empty');
  state.manifest=m;state.bright=bright;state.ready=true;state.error='';
  requestDraw();
 }catch(e){state.error=String(e.message||e).slice(0,170);requestDraw();}
}
function magLimit(fov){
 return fov>40?6.5:fov>24?8.0:fov>12?9.2:fov>5?10.3:11.5;
}
function groups(){
 const out=[state.bright];
 for(const id of state.active){const t=state.tiles.get(id);if(t)out.push(t);}
 return out;
}
function sync(view){
 if(!state.manifest||view.fov>30){state.active=[];return;}
 const rad=Math.min(50,Math.max(1.5,
  view.fov*.5*Math.sqrt(1+view.aspect*view.aspect)*1.2));
 const wanted=state.manifest.tiles.filter(t=>
   sepDeg(view.ra,view.dec,Number(t.ra_center_deg)*D2R,
          Number(t.dec_center_deg)*D2R)<=rad+18);
 state.active=wanted.map(t=>t.id);
 for(const t of wanted){
  if(state.pending.size>=5)break;
  if(state.tiles.has(t.id)||state.pending.has(t.id)||state.failed.has(t.id))continue;
  if(!/^tiles\/r\d{2}_d\d{2}\.json$/.test(String(t.file)))continue;
  state.pending.add(t.id);
  fetch(ROOT+t.file,{cache:'force-cache'}).then(async r=>{
   if(!r.ok)throw Error(t.id+': HTTP '+r.status);
   const data=normalize(await r.json());
   if(!data.length)throw Error(t.id+': invalid or empty tile');
   state.tiles.set(t.id,data);
  }).catch(e=>{
   state.failed.add(t.id);state.error=String(e.message||e).slice(0,170);
  }).finally(()=>{state.pending.delete(t.id);requestDraw();});
 }
}
function draw(ctx,view,project,holder,TAU,clamp){
 if(!state.ready)return;
 const faint=magLimit(view.fov);
 ctx.save();ctx.fillStyle='#b9c9e3';
 for(const list of groups())for(const s of list){
  if(s.mag>faint||!project(s.ra,s.dec,holder)||
     holder.x<0||holder.x>view.W||holder.y<0||holder.y>view.H)continue;
  const radius=clamp(1.7-(s.mag-2)*.13,.42,2.35);
  ctx.globalAlpha=clamp(.9-Math.max(0,s.mag-5)*.09,.30,.94);
  ctx.beginPath();ctx.arc(holder.x,holder.y,radius,0,TAU);ctx.fill();
 }
 ctx.restore();
}
function nearest(px,py,maxDist,project,holder,view){
 const faint=magLimit(view.fov);
 let best=null,bestDist=maxDist;
 for(const list of groups())for(const s of list){
  if(s.mag>faint||!project(s.ra,s.dec,holder))continue;
  const d=Math.hypot(holder.x-px,holder.y-py);
  if(d<bestDist){best=s;bestDist=d;}
 }
 return best?{o:best,distance:bestDist}:null;
}
function findById(id){
 for(const list of groups())for(const s of list)if(s.id===String(id))return s;
 return null;
}
function search(text,max=12){
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s'._-]+/g,'');
 const q=norm(text);if(q.length<2)return[];
 const found=[];
 for(const list of groups())for(const s of list){
  if(!s.proper)continue;
  const name=norm(s.proper),hyg=norm(s.source_id);
  if(name.includes(q)||hyg.includes(q)){
   found.push({id:s.id,kind:'hyg',label:s.proper,
     ra_deg:s.ra*R2D,dec_deg:s.dec*R2D,fov_deg:Math.max(2,4),
     mag:s.mag,rank:name===q||hyg===q?0:name.startsWith(q)?1:2});
  }
 }
 return found.sort((a,b)=>a.rank-b.rank||a.mag-b.mag).slice(0,max);
}
function status(){
 return {
  ready:state.ready,bright_count:state.bright.length,
  loaded_tiles:state.tiles.size,active_tiles:state.active.length,
  total_catalog_stars:state.manifest?
     state.manifest.bright_count+state.manifest.tile_source_count:0,
  loaded_sources:state.bright.length+Array.from(state.tiles.values()).reduce((n,t)=>n+t.length,0),
  error:state.error,
  source:'HYG v4.1 (Astronexus / CC BY-SA 4.0)',
  magnitude:'visual V; not Gaia G',epoch:'J2000'
 };
}
function statusText(zh){
 if(state.error)return (zh?'全天星表載入問題：':'All-sky catalog issue: ')+state.error;
 if(!state.ready)return zh?'HYG 全天真實星表載入中…':'Loading HYG real whole-sky stars…';
 const n=state.active.filter(id=>state.tiles.has(id)).length;
 return (zh?'HYG 全天亮星 ':'HYG whole-sky bright ')+state.bright.length+
  (zh?' 筆；較暗星點分區 ':'; faint-star tiles ')+n+'/'+state.active.length+
  (zh?' 已載入（V 星等）':' loaded (V magnitude)');
}
sky.registerAllSkyLayer({sync,draw,nearest,findById,search,status,statusText});
init();
})();
