const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto('file://' + __dirname + '/bilby-v2.html');
  const clip = {x:230,y:0,width:440,height:1000};
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'v2-splash.png', clip });
  await p.waitForTimeout(2200);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({ path: 'v2-home.png', clip });

  await p.click('[data-k="pick"]'); await p.waitForTimeout(900);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({ path: 'v2-pick.png', clip });

  await p.click('[data-k="trips"]'); await p.waitForTimeout(800);
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({ path: 'v2-trips.png', clip });

  // theme variants of home
  for (const t of ['signal','solstice']) {
    await p.click('[data-k="home"]'); await p.waitForTimeout(600);
    await p.click(`[data-act="theme"][data-k="${t}"]`); await p.waitForTimeout(800);
    await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({ path: `v2-${t}.png`, clip });
  }
  console.log(errs.length ? errs.join('\n') : 'no console/page errors');
  await b.close();
})();
