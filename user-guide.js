/* Interactive user guide: English-first, with Traditional Chinese on explicit ZH selection. */
(() => {
'use strict';
const trigger=document.getElementById('guide-open');
if(!trigger)return;
const dialog=document.createElement('dialog');
dialog.id='user-guide';dialog.setAttribute('aria-labelledby','guide-title');
dialog.innerHTML=[
 '<div class="guide-header"><h2 id="guide-title">How to use SPHEREx Sky Atlas</h2>',
 '<button type="button" class="btn sm" id="guide-close" aria-label="Close guide">✕</button></div>',
 '<p id="guide-intro" class="guide-intro"></p>',
 '<div id="guide-steps"></div>',
 '<p id="guide-caution"></p>',
 '<div class="guide-actions"><button type="button" id="guide-finish" class="btn primary">Start exploring</button></div>'
].join('');
document.body.append(dialog);
const L={
 en:{
  trigger:'HOW TO USE',title:'How to use SPHEREx Sky Atlas',
  intro:'A quick tour of real analysis runs, sky coordinates and scientific images.',
  steps:[
   ['01 · Pick a science target','In Science Results, choose WISE 0855, Barnard’s Star, Epsilon Indi B, RW Aurigae or R Draconis. Select a bandpass and an analysis run; the source IDs belong only to that run.'],
   ['02 · Browse scientific products','Use GIF / Group for original time-grouped frames, STACK for the source-stack overview, SED for photometry (Epoch-to-epoch evolution by default), and Time Grouping for the diagnostic chart.'],
   ['03 · Open the Observation Viewer','Select Open Viewer to see the marked GIF beside the live sky map. Prev / Blink / Next step or play the real epochs. Check “Show annotated GIF” to show labels, or uncheck it for the original animation.'],
   ['04 · Navigate the sky','Use RA and Dec to jump to a position. FOV accepts 0.2°–180°; you can also drag, zoom, or use the separate Sky Search and preset-target controls.'],
   ['05 · Inspect, enlarge, and compare','Select Open full-size image for a larger source figure. In the Viewer, adjust display brightness independently of measured photometry, and scroll down for a randomly selected astronomy article.']
  ],
  caution:'Interpretation note: GIF annotations are algorithm-generated candidate labels, not independently verified identifications. Missing coverage is not evidence of a nondetection.',
  finish:'Start exploring',close:'Close guide'
 },
 zh:{
  trigger:'使用教學',title:'SPHEREx 天球星圖使用教學',
  intro:'快速了解目標選擇、天球定位、科學分析及觀測影像。',
  steps:[
   ['01 · 選擇研究目標','在 Science Results 選擇研究天體、波段及 Analysis Run。Source ID 只對應目前的 Run，不可跨 Run 當成相同來源。'],
   ['02 · 查看科學分析結果','GIF / Group 顯示原始分組影像；STACK 顯示疊合總覽；SED 顯示測光演變；Time Grouping 顯示時間分組診斷。'],
   ['03 · 開啟 Observation Viewer','Open Viewer 可同時看星空與影像。Prev／Blink／Next 切換標記動畫影格；「Show annotated GIF」可切換標記版及原始版。'],
   ['04 · 定位與縮放星圖','以 RA / Dec 前往天球座標。FOV 支援 0.2°–180°，亦可拖曳、縮放，或使用搜尋及預設目標。'],
   ['05 · 放大與比較','點選 Open full-size image 查看大圖；Viewer 亮度只影響畫面，不改變測光。下方可閱讀隨機天文科普。']
  ],
  caution:'注意：動畫標記屬演算法候選結果，並非已獨立確認的天體分類。缺乏有效觀測資料不能視為未偵測。',
  finish:'開始探索',close:'關閉教學'
 }
};
function localize(){
 const lang=String(document.documentElement.lang||'en').startsWith('zh')?'zh':'en';
 const t=L[lang];
 trigger.textContent=t.trigger;
 document.getElementById('guide-title').textContent=t.title;
 document.getElementById('guide-intro').textContent=t.intro;
 const container=document.getElementById('guide-steps');
 container.replaceChildren();
 t.steps.forEach(([title,body])=>{
  const section=document.createElement('section');section.className='guide-step';
  const h=document.createElement('h3');h.textContent=title;
  const p=document.createElement('p');p.textContent=body;
  section.append(h,p);container.append(section);
 });
 document.getElementById('guide-caution').textContent=t.caution;
 document.getElementById('guide-finish').textContent=t.finish;
 document.getElementById('guide-close').setAttribute('aria-label',t.close);
}
const close=()=>dialog.close();
trigger.onclick=()=>{localize();dialog.showModal();};
document.getElementById('guide-close').onclick=close;
document.getElementById('guide-finish').onclick=close;
dialog.onclick=e=>{if(e.target===dialog)close();};
new MutationObserver(localize).observe(document.documentElement,{
 attributes:true,attributeFilter:['lang']
});
localize();
})();
