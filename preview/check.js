const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{width:1440,height:900} });
  await p.goto('file:///home/claude/nesim/preview/bilby-landing.html', {waitUntil:'networkidle'});
  console.log('best tick border:', await p.evaluate(() =>
    getComputedStyle(document.querySelector('.plan.best li'), '::before').borderLeftColor));
  console.log('plain tick border:', await p.evaluate(() =>
    getComputedStyle(document.querySelector('.plan:not(.best) li'), '::before').borderLeftColor));
  console.log('plan note bg:', await p.evaluate(() =>
    getComputedStyle(document.querySelector('.plan .note')).backgroundColor));
  await p.click('.dest:nth-child(3)');
  await p.waitForTimeout(400);
  console.log('after Japan click:', await p.evaluate(() =>
    document.getElementById('planCountry').textContent + ' / ' + document.querySelector('.plan .amt').textContent));
  await p.click('#previewBtn');
  console.log('notes shown:', await p.evaluate(() => !document.getElementById('noteList').classList.contains('hidden')));
  const t = await p.evaluate(() => document.body.innerText);
  console.log('dash lines:', t.split('\n').filter(l => /[-‐-―]/.test(l)).length);
  await b.close();
})();
