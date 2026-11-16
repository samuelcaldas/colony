/* ===== Bitmaps: 32x32 indexed sprites -> W x H voxel grid (bbox-fit, majority sampling, palette cap C) ===== */
const Bitmaps = (() => {
  const N = 32;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  function fromBitmap(img, W, H, C) {
    const px = [...img.b].map((ch) => (ch === '.' ? -1 : parseInt(ch, 16)));
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let i = 0; i < N * N; i++) if (px[i] >= 0) { const x = i % N, y = (i / N) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const side = Math.max(x1 - x0 + 1, y1 - y0 + 1), ox = x0 - (side - (x1 - x0 + 1)) / 2, oy = y0 - (side - (y1 - y0 + 1)) / 2;
    const grid = new Int8Array(W * H).fill(-1), step = side / W;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cnt = {}; let tot = 0, bg = 0;
      for (let sy = Math.floor(oy + y * step); sy < Math.ceil(oy + (y + 1) * step); sy++)
        for (let sx = Math.floor(ox + x * step); sx < Math.ceil(ox + (x + 1) * step); sx++) {
          tot++; const v = sx < 0 || sy < 0 || sx >= N || sy >= N ? -1 : px[sy * N + sx];
          if (v < 0) bg++; else cnt[v] = (cnt[v] || 0) + 1;
        }
      if (bg * 2 > tot) continue;
      let best = -1, bc = 0; for (const k in cnt) if (cnt[k] > bc) { bc = cnt[k]; best = +k; }
      grid[y * W + x] = best;
    }
    const pal = img.p.map(rgb), size = {};
    grid.forEach((v) => { if (v >= 0) size[v] = (size[v] || 0) + 1; });
    let used = Object.keys(size).map(Number);
    while (used.length > C) {
      used.sort((a, b) => size[a] - size[b]);
      const k = used.shift(); let to = used[0];
      used.forEach((j) => { if (d2(pal[j], pal[k]) < d2(pal[to], pal[k])) to = j; });
      size[to] += size[k]; grid.forEach((v, i) => { if (v === k) grid[i] = to; });
    }
    used.sort((a, b) => size[b] - size[a]);
    const remap = new Map(used.map((k, i) => [k, i]));
    grid.forEach((v, i) => { if (v >= 0) grid[i] = remap.get(v); });
    return { grid, palette: used.map((k) => img.p[k]), count: grid.reduce((n, v) => n + (v >= 0), 0) };
  }
  return { fromBitmap };
})();
if (typeof module !== 'undefined') module.exports = Bitmaps;
