const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1180, height: 1400 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/bilby-v3.html');
  for (const mode of ['dark','light']) {
    await p.evaluate(m => { document.body.dataset.mode = m; }, mode);
    await p.evaluate(() => { document.getElementById('panel').style.display='none'; });
    // phone
    await p.evaluate(() => { document.getElementById('web').style.display='none';
                             document.getElementById('phone').style.display='flex'; });
    await p.waitForTimeout(1400);
    await (await p.$('#phone')).screenshot({ path: `v3-phone-${mode}.png` });
    // site
    await p.evaluate(() => { document.getElementById('phone').style.display='none';
                             document.getElementById('web').style.display='block'; });
    await p.waitForTimeout(1600);
    await (await p.$('#web')).screenshot({ path: `v3-web-${mode}.png` });
  }
  console.log('ok');
  await b.close();
})();
