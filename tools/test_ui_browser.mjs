/* English-first language + Viewer browser smoke test. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({locale:'en-US',viewport:{width:1500,height:900}});
const page=await context.newPage();
page.on('pageerror',err=>console.error('Page JS error:',err.message));
try{
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.SPHERExScienceRuns?.current?.().loaded,{timeout:60000});
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#lang').innerText(),'ZH');
  assert.equal(await page.locator('#srb-target option').count(),5);
  assert.equal(await page.locator('#srb-open').getAttribute('class'),'btn primary');
  async function auditVisible(place){
    const problems=await page.evaluate(()=>{
      const out=[];
      const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walk.nextNode())){
        const text=node.textContent.trim();
        if(!/[\u3400-\u9fff]/.test(text))continue;
        const parent=node.parentElement;
        if(!parent)continue;
        if(parent.closest('script,style,template,[hidden]'))continue;
        const style=getComputedStyle(parent);
        if(style.display==='none'||style.visibility==='hidden')continue;
        if(!parent.getClientRects().length)continue;
        out.push({tag:parent.tagName,id:parent.id,text:text.slice(0,140)});
      }
      return out.slice(0,30);
    });
    console.log('English visible text audit:',place,JSON.stringify(problems));
    assert.equal(problems.length,0,'Chinese visible in English interface');
  }
  await auditVisible('initial');
  await page.locator('#guide-open').click();
  await page.locator('#guide-title').waitFor({state:'visible'});
  assert.match(await page.locator('#guide-title').innerText(),/How to use/);
  await auditVisible('guide');
  await page.locator('#guide-finish').click();

  await page.locator('#srb-viewer').click();
  await page.locator('#spx-image').waitFor({state:'visible'});
  assert.equal(await page.locator('#spx-brightness').inputValue(),'1');
  assert.equal(await page.locator('#spx-brightness-value').innerText(),'1×');
  assert.equal(await page.locator('#spx-markers-on').isChecked(),true);
  const marked=await page.locator('#spx-image').getAttribute('src');
  assert.match(marked,/viewer_marked_frames/);
  await page.locator('#spx-markers-on').uncheck();
  const plain=await page.locator('#spx-image').getAttribute('src');
  assert.match(plain,/viewer_plain_frames/);
  assert.notEqual(marked,plain);
  await page.locator('#spx-next').click();
  assert.notEqual(await page.locator('#spx-image').getAttribute('src'),plain);
  await page.locator('#spx-play').click();
  assert.match(await page.locator('#spx-play').innerText(),/Pause/);
  await page.locator('#spx-play').click();
  assert.match(await page.locator('#spx-play').innerText(),/Blink/);
  assert.match(await page.locator('#spx-reading-title').innerText(),/Variable Stars|Fast-Moving Objects/);
  await auditVisible('viewer');

  await page.locator('#spx-close').click();
  await page.locator('#lang').click();
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');
  await page.locator('#lang').click();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  await auditVisible('language roundtrip');
  console.log('PASS: EN default / no visible Chinese / guide / marked-original toggle / 1x brightness / Prev Blink Next');
} finally {
  await browser.close();
}
