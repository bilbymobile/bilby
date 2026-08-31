const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1180, height: 1400 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/bilby-v3.html');
  // Hide the phone and the panel so the site stands alone at the top of the page.
  await p.evaluate(() => {
    document.getElementById('phone').style.display = 'none';
    document.getElementById('panel').style.display = 'none';
  });
  await p.waitForTimeout(1600);
  const el = await p.$('#web');
  await el.screenshot({ path: 'v3-web.png' });
  console.log('ok');
  await b.close();
})();
