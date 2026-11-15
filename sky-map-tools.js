/* Sky Atlas tools — independent of SPHEREx FITS/backend products.
 * Searches verified built-in stars, DSOs, constellations, presets, loaded
 * Gaia/SPHEREx sources, and notebook target reference coordinates. */
(()=>{
'use strict';
const atlas=window.SkyAtlas, panel=document.getElementById('pbody');
if(!atlas?.searchObjects||!atlas?.focusObject||!panel)return;
const section=document.createElement('section');
section.id='atlas-tools';section.className='sec';
section.innerHTML=[
 '<h2 id="atlas-search-title">搜尋天體 / Sky search</h2>',
 '<label for="atlas-query" class="atlas-tool-label" id="atlas-name-label">名稱、Messier 編號或 Source ID</label>',
 '<div class="atlas-query-row"><input id="atlas-query" type="search" autocomplete="off" aria-controls="atlas-results" aria-expanded="false" spellcheck="false" placeholder="Sirius · M31 · Gaia DR3 ID"><button id="atlas-find" type="button" class="btn sm">搜尋</button></div>',
 '<div id="atlas-results" role="listbox" aria-label="Search results" hidden></div>',
 '<p id="atlas-feedback" class="fine" role="status" aria-live="polite"></p>',
 '<div class="atlas-utility-grid">',
   '<label class="atlas-utility" for="atlas-gaia-depth"><span id="atlas-depth-label">Gaia 星點密度</span><select id="atlas-gaia-depth"><option value="auto">Auto</option><option value="bright">Bright</option><option value="deep">Deep</option></select></label>',
   '<div class="atlas-utility"><span id="atlas-share-label">分享目前視野</span><button id="atlas-share" class="btn sm" type="button">複製連結</button></div>',
 '</div>',
 '<p id="atlas-depth-hint" class="fine">Gaia DR3 僅在 FOV ≤ 12° 時查詢，最多 3000 筆，需連線。</p>',
 '<p id="atlas-link-output" class="fine" hidden></p>'
].join('');
const sel=document.getElementById('sel');panel.insertBefore(section,sel||panel.firstChild);
const $=id=>document.getElementById(id);
const zh=()=>String(document.documentElement.lang||'zh').startsWith('zh');
const tr=(a,b)=>zh()?a:b;
const kindLabel=k=>({
 star:tr('恆星','Star'),dso:tr('深空天體','Deep sky'),
 constellation:tr('星座','Constellation'),preset:tr('預設視野','Preset'),
 gaia:'Gaia DR3',spx:'SPHEREx',target:tr('研究目標座標','Target reference')
}[k]||k);
let results=[];
function say(text){$('atlas-feedback').textContent=text;}
function hide(){
 $('atlas-results').hidden=true;
 $('atlas-query').setAttribute('aria-expanded','false');
}
function show(){
 const q=$('atlas-query').value.trim();
 if(q.length<2){results=[];hide();say(tr('請輸入至少兩個字元。','Type at least two characters.'));return;}
 results=atlas.searchObjects(q,14);
 const box=$('atlas-results');box.replaceChildren();
 for(const [index,r] of results.entries()){
  const b=document.createElement('button');
  b.type='button';b.className='atlas-match';b.setAttribute('role','option');
  b.dataset.index=String(index);
  const title=document.createElement('span');title.className='atlas-match-name';title.textContent=r.label;
  const meta=document.createElement('span');meta.className='atlas-match-meta';
  const mag=Number.isFinite(r.mag)?' · '+(r.kind==='gaia'?'G ':'mag ')+r.mag.toFixed(2):'';
  meta.textContent=kindLabel(r.kind)+mag+' · '+r.ra_deg.toFixed(3)+'°, '+r.dec_deg.toFixed(3)+'°';
  b.append(title,meta);
  b.addEventListener('click',()=>focus(index));
  box.append(b);
 }
 box.hidden=!results.length;$('atlas-query').setAttribute('aria-expanded',String(!!results.length));
 say(results.length?tr('找到 '+results.length+' 筆符合資料（僅搜尋已載入的星表）。',results.length+' matches (loaded catalogs only).'):
   tr('找不到符合名稱；可輸入 RA / Dec 或試用其他別名。','No match: try RA/Dec or another alias.'));
}
function focus(index){
 const r=results[index];
 if(!r||!atlas.focusObject(r)){say(tr('無法定位這個目標。','Cannot focus this target.'));return;}
 $('atlas-query').value=r.label;hide();
 say(tr('已前往 ','Focused ')+r.label+'. '+(r.kind==='target'
 ?tr('此處為參考座標，並非偵測證據。','Reference coordinate; not a detection.')
 :''));
 if(window.matchMedia('(max-width:720px)').matches){
  const p=document.getElementById('panel');
  if(p&&p.dataset.collapsed!=='true')document.getElementById('collapse')?.click();
 }
}
$('atlas-query').addEventListener('input',show);
$('atlas-query').addEventListener('keydown',e=>{
 if(e.key==='Escape'){hide();return;}
 if(e.key==='Enter'){e.preventDefault();if(!results.length)show();if(results.length)focus(0);}
});
$('atlas-find').onclick=()=>{if(!$('atlas-query').value.trim()){$('atlas-query').focus();return;}show();if(results.length===1)focus(0);};
document.addEventListener('pointerdown',e=>{
 if(!section.contains(e.target))hide();
});
$('atlas-gaia-depth').value=atlas.getGaiaDepth?.()||'auto';
$('atlas-gaia-depth').addEventListener('change',e=>{
 const m=e.target.value;
 if(atlas.setGaiaDepth?.(m)){
  say(tr('已設定 Gaia 顯示深度：','Gaia depth: ')+m+
      tr('。放大至 12° 內才會查詢，深度越高可能越快達 3000 筆上限。','. Zoom to ≤12° to query; denser fields may hit the 3000-row limit.'));
 }
});
function viewportLink(){
 const v=atlas.getView();
 const url=new URL(window.location.href);
 url.searchParams.set('ra',v.ra_deg.toFixed(6));
 url.searchParams.set('dec',v.dec_deg.toFixed(6));
 url.searchParams.set('fov',Math.max(.001,v.fov_deg).toFixed(6));
 return url.href;
}
$('atlas-share').onclick=async()=>{
 const text=viewportLink();
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
  $('atlas-link-output').hidden=true;
  say(tr('已複製視野連結，開啟後可還原相同 RA / Dec / FOV。','View link copied: restores RA / Dec / FOV.'));
 }catch(e){
  const link=$('atlas-link-output');
  link.textContent=text;link.hidden=false;
  say(tr('無法自動複製，請手動複製下方連結。','Clipboard unavailable; copy the URL shown below.'));
 }
};
function restoreQuery(){
 const p=new URLSearchParams(window.location.search);
 if(!['ra','dec','fov'].every(k=>p.has(k)))return;
 const a=Number(p.get('ra')),d=Number(p.get('dec')),f=Number(p.get('fov'));
 if([a,d,f].every(Number.isFinite)&&a>=0&&a<360&&d>=-90&&d<=90&&f>=.001&&f<=180){
  requestAnimationFrame(()=>{
   atlas.goToCoordinates({ra_deg:a,dec_deg:d,fov_deg:f});
   say(tr('已從網址還原視野。','View restored from URL.'));
  });
 }
}
function localize(){
 $('atlas-search-title').textContent=tr('搜尋天體 / 星圖工具','Sky search / tools');
 $('atlas-name-label').textContent=tr('名稱、Messier 編號或 Source ID','Name, Messier number, or Source ID');
 $('atlas-find').textContent=tr('搜尋','Search');
 $('atlas-depth-label').textContent=tr('Gaia 星點深度','Gaia star depth');
 $('atlas-share-label').textContent=tr('分享目前視野','Share current view');
 $('atlas-share').textContent=tr('複製連結','Copy link');
 $('atlas-gaia-depth').options[0].textContent=tr('自動','Auto');
 $('atlas-gaia-depth').options[1].textContent=tr('僅亮星','Bright only');
 $('atlas-gaia-depth').options[2].textContent=tr('較多暗星','More faint stars');
 $('atlas-depth-hint').textContent=tr(
  'Gaia 需連線，僅在 FOV ≤ 12° 時查詢（每次最多 3000 筆）；不是完整全天星表。',
  'Gaia requires network access and queries only at FOV ≤ 12° (up to 3000 rows); not a complete all-sky catalog.');
}
new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
document.addEventListener('keydown',e=>{
 const t=e.target,tag=t?.tagName;
 if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){
  e.preventDefault();$('atlas-query').focus();
 }
});
localize();restoreQuery();
window.SkyAtlasTools={search:query=>{ $('atlas-query').value=query;show();return results.slice();},
 getViewLink:viewportLink};
})();