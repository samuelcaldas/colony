/* ===== Domain logic: exposure, settle, solver, peeling generator, boosters ===== */
const Logic = (() => {
  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Flood fill from tray margins. Returns exposed cube indices (bottom rows first). */
  function computeExposed(grid, W, H) {
    const n = W * H, out = new Uint8Array(n), q = [];
    for (let i = 0; i < n; i++) {
      if (grid[i] >= 0) continue;
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { out[i] = 1; q.push(i); }
    }
    while (q.length) {
      const i = q.pop(), x = i % W, y = (i / W) | 0;
      if (x > 0 && grid[i - 1] < 0 && !out[i - 1]) { out[i - 1] = 1; q.push(i - 1); }
      if (x < W - 1 && grid[i + 1] < 0 && !out[i + 1]) { out[i + 1] = 1; q.push(i + 1); }
      if (y > 0 && grid[i - W] < 0 && !out[i - W]) { out[i - W] = 1; q.push(i - W); }
      if (y < H - 1 && grid[i + W] < 0 && !out[i + W]) { out[i + W] = 1; q.push(i + W); }
    }
    const ex = [];
    for (let i = n - 1; i >= 0; i--) {
      if (grid[i] < 0) continue;
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
        out[i - 1] || out[i + 1] || out[i - W] || out[i + W]) ex.push(i);
    }
    return ex;
  }

  const countCubes = (grid) => { let c = 0; for (let i = 0; i < grid.length; i++) if (grid[i] >= 0) c++; return c; };

  function makeState(grid, W, H, cols, maxSlots = 4) {
    return { W, H, grid: Int8Array.from(grid), cols, ptr: cols.map(() => 0), dock: [], maxSlots, left: countCubes(grid) };
  }
  const clone = (S) => ({ W: S.W, H: S.H, grid: S.grid.slice(), cols: S.cols, ptr: S.ptr.slice(), dock: S.dock.map((d) => ({ ...d })), maxSlots: S.maxSlots, left: S.left });

  /** Dock blocks send ants in rounds until nothing more is reachable; finished blocks leave. */
  function settle(S) {
    const rounds = [];
    while (S.dock.some((d) => d.count > 0)) {
      const ex = computeExposed(S.grid, S.W, S.H), by = {};
      for (const i of ex) (by[S.grid[i]] || (by[S.grid[i]] = [])).push(i);
      const picks = [];
      for (const d of S.dock) {
        const l = by[d.color];
        if (!l) continue;
        let k = l._k || 0;
        while (d.count > 0 && k < l.length) { picks.push({ id: d.id, i: l[k++], color: d.color }); d.count--; }
        l._k = k;
      }
      if (!picks.length) break;
      for (const p of picks) S.grid[p.i] = -1;
      S.left -= picks.length;
      rounds.push(picks);
    }
    S.dock = S.dock.filter((d) => d.count > 0 || (d.g && S.dock.some((o) => o.g === d.g && o.count > 0)));
    return rounds;
  }

  function legalMoves(S) {
    const free = S.maxSlots - S.dock.length, moves = [], seen = new Set();
    for (let c = 0; c < S.cols.length; c++) {
      const b = S.cols[c][S.ptr[c]];
      if (!b) continue;
      if (!b.g) { if (free >= 1) moves.push({ cols: [c] }); continue; }
      if (seen.has(b.g)) continue;
      seen.add(b.g);
      const mem = []; let ok = true;
      for (let k = 0; k < S.cols.length && ok; k++) {
        const col = S.cols[k];
        for (let i = S.ptr[k]; i < col.length; i++) if (col[i].g === b.g) { if (i !== S.ptr[k]) ok = false; mem.push(k); }
      }
      if (ok && free >= mem.length) moves.push({ cols: mem });
    }
    return moves;
  }

  function applyMove(S, mv) {
    for (const c of mv.cols) { S.dock.push({ ...S.cols[c][S.ptr[c]] }); S.ptr[c]++; }
    return settle(S);
  }

  /** DFS, greedy ordering (free slots, cubes cleared), backtracking + memo. */
  function solve(S0, budget = 900) {
    const memo = new Set(), path = []; let nodes = 0;
    const key = (S) => {
      let h = 7; for (let i = 0; i < S.grid.length; i++) h = (Math.imul(h, 31) + S.grid[i] + 2) | 0;
      return S.ptr.join(',') + '|' + S.dock.map((d) => d.id + ':' + d.count).join(',') + '|' + h;
    };
    const rec = (S) => {
      if (S.left === 0) return true;
      if (nodes++ > budget) return false;
      const k = key(S); if (memo.has(k)) return false; memo.add(k);
      const cand = legalMoves(S).map((m) => {
        const T = clone(S); applyMove(T, m);
        return { m, T, score: (T.maxSlots - T.dock.length) * 1000 + (S.left - T.left) };
      }).sort((a, b) => b.score - a.score);
      for (const c of cand) { path.push(c.m); if (rec(c.T)) return true; path.pop(); }
      return false;
    };
    const ok = rec(clone(S0));
    return { solvable: ok, path: ok ? path.slice() : [], nodes };
  }

  /** LevelSolvabilityTester entry point. linkedGroups optional: [[blockId,...],...] overrides block.g. */
  function verifyLevelSolvability(voxelGrid, columns, linkedGroups, maxSlots = 4, budget = 2500) {
    if (linkedGroups) {
      const g = new Map(); linkedGroups.forEach((ids, k) => ids.forEach((id) => g.set(id, k + 1)));
      columns.forEach((col) => col.forEach((b) => { b.g = g.get(b.id) || 0; }));
    }
    const r = solve(makeState(voxelGrid.cells, voxelGrid.W, voxelGrid.H, columns, maxSlots), budget);
    return { solvable: r.solvable, solutionPath: r.path, nodes: r.nodes };
  }

  /** Grid grows with level up to a cap: std 12→20, hard +2 (cap 22), super +4 (cap 24). */
  function difficultyFor(level) {
    const pos = (level - 1) % 5, tier = pos === 3 ? 'hard' : pos === 4 ? 'super' : 'std';
    const base = Math.min(20, 12 + Math.floor((level - 1) / 4));
    let C = 4 + Math.min(3, Math.floor(level / 10)), W = base, H = base, p;
    if (tier === 'std') p = { linkP: 0.1 + 0.025 * (level % 3), maxLink: 2, minP: 8, maxP: 30, swap: 0.3, window: 3 };
    else if (tier === 'hard') { W = H = Math.min(22, base + 2); C += 1; p = { linkP: 0.3, maxLink: 3, minP: 5, maxP: 20, swap: 0.6, window: 5 }; }
    else { W = H = Math.min(24, base + 4); C += 2; p = { linkP: 0.45, maxLink: 4, minP: 4, maxP: 16, swap: 0.9, window: 7 }; }
    return { level, pos, tier, W, H, C, ...p };
  }

  /** Simulated peeling: packets follow the real order in which cubes become reachable. */
  function peel(grid, W, H, P, rng) {
    const S = makeState(grid, W, H, [[], [], [], []], 1), seq = [];
    let last = -1;
    while (S.left > 0) {
      const cnt = {};
      for (const i of computeExposed(S.grid, W, H)) cnt[S.grid[i]] = (cnt[S.grid[i]] || 0) + 1;
      let colors = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a]);
      if (colors.length > 1) colors = colors.filter((c) => c !== last);
      const color = rng() < 0.6 ? colors[0] : colors[Math.floor(rng() * colors.length)];
      const cap = P.minP + Math.floor(rng() * (P.maxP - P.minP + 1)), before = S.left;
      S.dock = [{ id: 0, color, count: cap, g: 0 }];
      settle(S); S.dock = [];
      const n = before - S.left, prev = seq[seq.length - 1];
      if (prev && prev.color === color && prev.count + n <= P.maxP) prev.count += n;
      else seq.push({ color, count: n });
      last = color;
    }
    return seq;
  }

  const deal = (seq) => { const cols = [[], [], [], []]; seq.forEach((b, i) => cols[i % 4].push({ id: i + 1, color: b.color, count: b.count, g: 0 })); return cols; };

  function addLinks(cols, linkP, maxLink, rng) {
    let gid = 0; const rows = cols[0].length;
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < 3) {
        if (cols[c][r] && cols[c + 1][r] && rng() < linkP / 1.25) {
          let len = 2 + Math.floor(rng() * (maxLink - 1)), n = 0;
          while (n < len && c + n < 4 && cols[c + n][r]) n++;
          gid++; for (let k = 0; k < n; k++) cols[c + k][r].g = gid;
          c += n;
        } else c++;
      }
    }
    return gid;
  }
  const groupIds = (cols) => [...new Set(cols.flat().map((b) => b.g).filter(Boolean))];
  function dropHalfLinks(cols, rng) {
    const kill = new Set(groupIds(cols).filter((_, i, a) => a.length === 1 || rng() < 0.5));
    cols.flat().forEach((b) => { if (kill.has(b.g)) b.g = 0; });
  }

  /** Reverse generation + self-correction until verifyLevelSolvability passes. */
  function generate(grid, W, H, P, seed, budget = 2500) {
    const rng = mulberry32(seed), seq = peel(grid, W, H, P, rng), vg = { W, H, cells: grid };
    let swaps = Math.round(seq.length * P.swap), linkP = P.linkP, corrections = 0, tests = 0;
    for (let a = 0; a < 6; a++) {
      const s = seq.slice();
      for (let k = 0; k < swaps; k++) {
        const i = Math.floor(rng() * s.length), j = Math.min(s.length - 1, i + 1 + Math.floor(rng() * P.window));
        [s[i], s[j]] = [s[j], s[i]];
      }
      const cols = deal(s); addLinks(cols, linkP, P.maxLink, rng);
      let r = verifyLevelSolvability(vg, cols, null, 4, budget); tests++;
      for (let t = 0; !r.solvable && t < 2 && groupIds(cols).length; t++) { dropHalfLinks(cols, rng); corrections++; r = verifyLevelSolvability(vg, cols, null, 4, budget); tests++; }
      if (r.solvable) return { cols, solution: r.solutionPath, corrections, tests, blocks: seq.length };
      corrections++; swaps = Math.floor(swaps / 2); linkP *= 0.6;
    }
    const cols = deal(seq); let r = verifyLevelSolvability(vg, cols, null, 4, budget); tests++;
    const solution = r.solvable ? r.solutionPath : seq.map((_, i) => ({ cols: [i % 4] }));
    return { cols, solution, corrections, tests, blocks: seq.length };
  }

  /* ---- boosters ---- */
  function fixGroups(S) {
    const m = new Map();
    const add = (b) => { if (b.g) (m.get(b.g) || m.set(b.g, []).get(b.g)).push(b); };
    S.cols.forEach((col, c) => { for (let i = S.ptr[c]; i < col.length; i++) add(col[i]); });
    S.dock.forEach(add);
    m.forEach((l) => { if (l.length < 2) l.forEach((b) => { b.g = 0; }); });
  }
  function magnet(S, max = 10) {
    const removed = [];
    for (const i of computeExposed(S.grid, S.W, S.H)) {
      if (removed.length >= max) break;
      const color = S.grid[i]; let best = null;
      S.cols.forEach((col, c) => { for (let k = col.length - 1; k >= S.ptr[c]; k--) if (col[k].color === color && col[k].count > 0) { if (!best || k - S.ptr[c] > best.depth) best = { col, k, depth: k - S.ptr[c] }; break; } });
      let blk = best ? best.col[best.k] : null;
      if (!blk) for (const d of S.dock) if (d.color === color && d.count > 0) blk = d;
      if (!blk) continue;
      blk.count--; S.grid[i] = -1; S.left--; removed.push({ i, color });
      if (best && blk.count === 0) best.col.splice(best.k, 1);
    }
    fixGroups(S);
    return { removed, rounds: settle(S) };
  }
  function cutLinks(S) {
    S.cols.forEach((col) => col.forEach((b) => { b.g = 0; }));
    S.dock.forEach((d) => { d.g = 0; });
    return settle(S);
  }
  function shuffle(S, rng) {
    const rest = []; S.cols.forEach((col, c) => rest.push(...col.slice(S.ptr[c])));
    if (rest.length < 2) return false;
    const save = { cols: S.cols, ptr: S.ptr };
    for (let t = 0; t < 20; t++) {
      const arr = rest.map((b) => ({ ...b, g: 0 }));
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      const cols = [[], [], [], []]; arr.forEach((b, i) => cols[i % 4].push(b));
      S.cols = cols; S.ptr = [0, 0, 0, 0];
      if (solve(S, 1200).solvable) return true;
    }
    S.cols = save.cols; S.ptr = save.ptr;
    return false;
  }

  /** Replays a stored solution; true if it clears the mosaic. */
  function replay(grid, W, H, cols, moves, maxSlots = 4) {
    const S = makeState(grid, W, H, cols.map((c) => c.map((b) => ({ ...b }))), maxSlots);
    for (const m of moves) {
      const lm = legalMoves(S).find((x) => x.cols.join() === m.cols.join());
      if (!lm) return false;
      applyMove(S, lm);
    }
    return S.left === 0;
  }

  return { replay, mulberry32, computeExposed, makeState, clone, settle, legalMoves, applyMove, solve, verifyLevelSolvability, difficultyFor, generate, magnet, cutLinks, shuffle };
})();
if (typeof module !== 'undefined') module.exports = Logic;
