import base64, sys
src = open('bilby-landing.src.html', encoding='utf-8').read()
hero = base64.b64encode(open('hero-bilby.jpg','rb').read()).decode()
out = src.replace('__HERO__', 'data:image/jpeg;base64,' + hero)
open('bilby-landing.html','w',encoding='utf-8').write(out)
print('built', len(out), 'bytes')
