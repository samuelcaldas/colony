/* ===== ImageToLevelPipeline: image source -> W x H voxel matrix with C colours ===== */
function mkCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try { const c = new OffscreenCanvas(w, h); if (c.getContext('2d')) return c; } catch (e) { /* fall through */ }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

const ImageToLevelPipeline = (() => {
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  /** Solid backdrop colour if all four corners of the source agree, else null. */
  function detectBackdrop(source) {
    const cv = mkCanvas(8, 8), ctx = cv.getContext('2d');
    ctx.drawImage(source, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const cs = [0, 7, 56, 63].map((i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]]);
    if (cs.some((c) => c[3] < 200) || cs.some((c) => d2(c, cs[0]) > 40 * 40)) return null;
    return [0, 1, 2].map((k) => cs.reduce((s, c) => s + c[k], 0) / 4);
  }

  /** Resample to the grid: each cell = average of the centre pixels of a 4x4 block. */
  function sample(source, W, H) {
    const K = 4, cw = W * K, ch = H * K, cv = mkCanvas(cw, ch), ctx = cv.getContext('2d');
    const sw = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
    const sc = Math.min(cw / sw, ch / sh), dw = sw * sc, dh = sh * sc;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    const d = ctx.getImageData(0, 0, cw, ch).data, cells = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 1; j <= 2; j++) for (let i = 1; i <= 2; i++) {
        const o = ((y * K + j) * cw + x * K + i) * 4, al = d[o + 3];
        r += d[o] * al; g += d[o + 1] * al; b += d[o + 2] * al; a += al;
      }
      if (a / 4 >= 140) cells[y * W + x] = [r / a, g / a, b / a];
    }
    return cells;
  }

  /** Flood from the outside over cells matching the backdrop colour. */
  function stripBackdrop(cells, W, H, bg) {
    if (!bg) return;
    const T = 46 * 46, q = [];
    const edge = (i) => {
      const x = i % W, y = (i / W) | 0;
      return x === 0 || y === 0 || x === W - 1 || y === H - 1 || !cells[i - 1] || !cells[i + 1] || !cells[i - W] || !cells[i + W];
    };
    for (let i = 0; i < W * H; i++) if (cells[i] && edge(i) && d2(cells[i], bg) < T) q.push(i);
    while (q.length) {
      const i = q.pop(); if (!cells[i]) continue;
      cells[i] = null;
      const x = i % W, y = (i / W) | 0;
      [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
        const j = ny * W + nx; if (cells[j] && d2(cells[j], bg) < T) q.push(j);
      });
    }
  }

  /** Simplified K-Means (farthest-point seeding, Euclidean RGB), then merge near-duplicate / tiny clusters. */
  function quantize(cells, C) {
    const idx = []; cells.forEach((c, i) => { if (c) idx.push(i); });
    if (!idx.length) return { assign: new Map(), palette: [] };
    const mean = [0, 1, 2].map((k) => idx.reduce((s, i) => s + cells[i][k], 0) / idx.length);
    let cen = [cells[idx.reduce((b, i) => (d2(cells[i], mean) < d2(cells[b], mean) ? i : b), idx[0])].slice()];
    while (cen.length < C) {
      let best = -1, bd = 24 * 24;
      for (const i of idx) { const m = Math.min(...cen.map((c) => d2(cells[i], c))); if (m > bd) { bd = m; best = i; } }
      if (best < 0) break;
      cen.push(cells[best].slice());
    }
    const nearest = (p, list) => { let b = 0, bd = Infinity; list.forEach((c, k) => { const v = d2(p, c); if (v < bd) { bd = v; b = k; } }); return b; };
    let lab = new Map();
    for (let it = 0; it < 8; it++) {
      const sum = cen.map(() => [0, 0, 0, 0]);
      for (const i of idx) { const k = nearest(cells[i], cen); lab.set(i, k); const s = sum[k]; s[0] += cells[i][0]; s[1] += cells[i][1]; s[2] += cells[i][2]; s[3]++; }
      cen = cen.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
    }
    const size = cen.map(() => 0); lab.forEach((k) => size[k]++);
    const keep = [];
    cen.forEach((c, k) => { if (size[k] >= 3 && !keep.some((j) => d2(cen[j], c) < 48 * 48)) keep.push(k); });
    if (!keep.length) keep.push(size.indexOf(Math.max(...size)));
    const kept = keep.map((k) => cen[k]), assign = new Map();
    for (const i of idx) assign.set(i, nearest(cells[i], kept));
    return { assign, palette: kept.map(hex) };
  }

  function toGrid(source, W, H, C) {
    const cells = sample(source, W, H);
    stripBackdrop(cells, W, H, detectBackdrop(source));
    const { assign, palette } = quantize(cells, C), grid = new Int8Array(W * H).fill(-1);
    assign.forEach((k, i) => { grid[i] = k; });
    return { grid, palette, count: assign.size };
  }

  const loadImage = (url) => new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => rej(new Error('imagem inválida')); im.src = url;
  });
  const fileToImage = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => loadImage(fr.result).then(res, rej); fr.onerror = () => rej(new Error('leitura falhou'));
    fr.readAsDataURL(file);
  });
  const autoPrompt = (theme) => `cute flat pixel art icon of a ${theme}, white background, 6 distinct colors, high contrast`;

  /** OpenAI Image API (gpt-image-1 / dall-e-3). Key stays in memory only. */
  async function openaiImage(key, model, prompt) {
    const body = { model, prompt, n: 1, size: '1024x1024' };
    if (model.startsWith('dall-e')) body.response_format = 'b64_json';
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const it = ((await r.json()).data || [])[0];
    if (!it) throw new Error('resposta vazia');
    return loadImage(it.b64_json ? 'data:image/png;base64,' + it.b64_json : it.url);
  }

  return { toGrid, loadImage, fileToImage, openaiImage, autoPrompt };
})();
