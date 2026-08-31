const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const url = 'file:///home/claude/nesim/preview/bilby-home.html';
  for (const [name, scheme, w, h] of [['home-light','light',1280,900],['home-dark','dark',1280,900],['home-mob','light',420,900]]) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, colorScheme:scheme, deviceScaleFactor:2 });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil:'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(900);
    await p.evaluate(() => window.scrollTo(0,0));
    await p.waitForTimeout(700);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(name, 'h-overflow:', overflow);
    await p.screenshot({ path: name + '.png', fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
