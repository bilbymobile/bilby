const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const url = 'file:///home/claude/nesim/preview/bilby-landing.html';
  for (const [n,w,h] of [['L',1440,900],['Lm',430,900]]) {
    const ctx = await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2});
    const p = await ctx.newPage();
    await p.goto(url, {waitUntil:'networkidle'});
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(1100);
    await p.evaluate(() => window.scrollTo(0,0));
    await p.waitForTimeout(1400);
    console.log(n, 'overflow:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1));
    await p.screenshot({path:'land-'+n+'.png', fullPage:true});
    await ctx.close();
  }
  await b.close();
})();
