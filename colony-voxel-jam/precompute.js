const L = require('./src/logic.js'), B = require('./src/bitmaps.js'), fs = require('fs');
const IMGS = JSON.parse(fs.readFileSync('images.json', 'utf8')), out = [], N = +process.argv[2] || 100;
let bad = 0, worst = 0;
for (let lv = 1; lv <= N; lv++) {
  const P = L.difficultyFor(lv), img = IMGS[((lv - 1) * 37) % IMGS.length];
  const g = B.fromBitmap(img, P.W, P.H, P.C);
  const t = Date.now();
  const r = L.generate(g.grid, P.W, P.H, P, lv * 7919 + 13, 30000);
  const ms = Date.now() - t; worst = Math.max(worst, ms);
  const ok = L.replay(g.grid, P.W, P.H, r.cols, r.solution);
  if (!ok) { bad++; console.log('UNSOLVED', lv); }
  const links = new Set(r.cols.flat().map((b) => b.g).filter(Boolean)).size;
  if (lv <= 6 || lv % 10 === 0 || lv % 5 >= 3 && lv < 12) console.log(lv, P.tier, P.W + 'x' + P.H, 'C' + g.palette.length, img.name, 'cubes', g.count, 'blocks', r.blocks, 'links', links, 'corr', r.corrections, 'moves', r.solution.length, ms + 'ms');
  out.push({ W: P.W, H: P.H, g: [...g.grid].map((v) => (v < 0 ? '.' : v.toString(16))).join(''), p: g.palette,
    c: r.cols.map((c) => c.map((b) => [b.color, b.count, b.g])), s: r.solution.map((m) => m.cols.join('')).join(','),
    l: img.name, b: r.blocks, t: r.tests, k: r.corrections });
}
fs.writeFileSync('levels.json', JSON.stringify(out));
console.log('levels', out.length, 'bad', bad, 'worst', worst + 'ms', 'bytes', fs.statSync('levels.json').size);
