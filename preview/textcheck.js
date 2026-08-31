const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('file:///home/claude/nesim/preview/bilby-home.html', {waitUntil:'networkidle'});
  await p.click('#previewBtn');
  const t = await p.evaluate(() => document.body.innerText);
  const bad = t.split('\n').filter(l => /[-‐-―]/.test(l));
  console.log('lines containing a dash:', bad.length);
  bad.forEach(l => console.log('  >', l));
  // exercise the controls
  await p.click('#sizeBtn');
  console.log('big class:', await p.evaluate(() => document.documentElement.classList.contains('big')));
  await p.click('#chips2 button:nth-child(5)');
  console.log('after China click:', await p.evaluate(() => [document.getElementById('plName').textContent, document.getElementById('plPrice').textContent, document.getElementById('stageCaption').textContent].join(' | ')));
  console.log('hero chip synced:', await p.evaluate(() => document.querySelector('#chips button:nth-child(5)').getAttribute('aria-pressed')));
  await b.close();
})();
