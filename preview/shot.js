const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + __dirname + '/bilby-preview.html');
  await p.waitForTimeout(900);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-earn.png", clip: {x:230,y:0,width:440,height:1000} });

  // ready-to-redeem scenario
  await p.click('[data-k="athome"]'); await p.waitForTimeout(900);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-ready.png", clip: {x:230,y:0,width:440,height:1000} });

  // plans
  await p.click('[data-tab="plans"]'); await p.waitForTimeout(700);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-plans.png", clip: {x:230,y:0,width:440,height:1000} });

  // first run
  await p.click('[data-k="firstrun"]'); await p.waitForTimeout(700);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-firstrun.png", clip: {x:230,y:0,width:440,height:1000} });

  // offline
  await p.click('[data-k="offline"]'); await p.waitForTimeout(500);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-offline.png", clip: {x:230,y:0,width:440,height:1000} });

  // pool exhausted
  await p.click('[data-k="australia"]'); await p.waitForTimeout(800);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-australia.png", clip: {x:230,y:0,width:440,height:1000} });

  // install flow: ready -> redeem
  await p.click('[data-k="pakistan"]'); await p.waitForTimeout(700);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-pk.png", clip: {x:230,y:0,width:440,height:1000} });
  await p.click('[data-k="ready"]'); await p.waitForTimeout(500);
  await p.click('[data-act="redeem"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>window.scrollTo(0,0)); await p.screenshot({ path: "shot-install.png", clip: {x:230,y:0,width:440,height:1000} });

  console.log(errs.length ? errs.join('\n') : 'no console/page errors');
  await b.close();
})();
