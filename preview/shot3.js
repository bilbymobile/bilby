const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + __dirname + '/bilby-v3.html');
  await p.waitForTimeout(1500);
  const phone = { x: 330, y: 0, width: 440, height: 1000 };
  await p.screenshot({ path: 'v3-home.png', clip: phone });
  for (const k of ['arrive','tools','shop']) {
    await p.click(`[data-k="${k}"]`); await p.waitForTimeout(900);
    await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({ path: `v3-${k}.png`, clip: phone });
  }
  // website
  const box = await p.evaluate(()=>{ const e=document.getElementById('web');
    const r=e.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 20);
    return {w:r.width, h:r.height}; });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: 'v3-web.png',
    clip: { x: Math.max(0,(1100-box.w)/2), y: 0, width: Math.min(1100,box.w), height: Math.min(1000, box.h+30) } });
  console.log(errs.length ? errs.join('\n') : 'no console/page errors');
  await b.close();
})();
