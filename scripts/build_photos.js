#!/usr/bin/env node
/* photos.jsx  →  photos.build.js
   كان المتصفح بيحمّل Babel من CDN (٢٫٨ م.ب) ويترجم الـJSX عند كل فتح.
   ده كان بيعني: اعتماد على unpkg.com (لو وقع، الصفحة ما تفتحش · ولو
   اتخترق، بيشغّل كود عندنا)، وبطء واستهلاك داتا على موبايل الكاشير.
   دلوقتي الترجمة بتحصل هنا مرة واحدة، وReact متسحوب محليًا. */
const fs = require('fs'), path = require('path');
const babel = require('/tmp/node_modules/@babel/core');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'photos.jsx'), 'utf8');
const out = babel.transformSync(src, {
  presets: [['/tmp/node_modules/@babel/preset-react', { runtime: 'classic' }]],
  filename: 'photos.jsx',
  compact: false,
});
const banner = '/* مولّد آليًا من photos.jsx — عدّل الـjsx وشغّل scripts/build_photos.js */\n';
fs.writeFileSync(path.join(ROOT, 'photos.build.js'), banner + out.code);
console.log('✓ photos.build.js', (out.code.length / 1024).toFixed(1), 'ك.ب');
