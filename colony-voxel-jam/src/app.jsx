/* ===== React UI: ColonyVoxelGame ===== */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const THEMES = ['corgi', 'watermelon slice', 'mushroom', 'crown', 'ghost', 'race car', 'rubber duck', 'rocket', 'flower', 'cupcake', 'parrot', 'cactus'];
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return `rgb(${((n >> 16) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`; };

/** Red/white gingham generated on an HTMLCanvasElement. */
function picnicTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#fff7f2'; x.fillRect(0, 0, 48, 48);
  x.fillStyle = 'rgba(222,48,58,.62)'; x.fillRect(0, 0, 24, 48); x.fillRect(0, 0, 48, 24);
  return c.toDataURL();
}

const PRICES = { slot: 80, cut: 40, magnet: 60, shuffle: 50 };
const REWARD = { std: 20, hard: 35, super: 60 };
const FAST_PRICE = 30, SKIP_PRICE = 500, INV_CAP = 9, FREE_FAST = 3;
const DAILY_BASE = 50, DAILY_MULT = [1, 1.5, 2, 2.5, 3, 4, 5];
const LIFE_MAX = 5, LIFE_MS = 4 * 60 * 1000, LIFE_PRICE = 30, LIFE_REFILL = 100;
const regen = (l, now) => {
  if (l.n >= LIFE_MAX) return l.at === 0 && l.n === LIFE_MAX ? l : { n: LIFE_MAX, at: 0 };
  const k = Math.floor((now - l.at) / LIFE_MS);
  if (k <= 0) return l;
  const n = Math.min(LIFE_MAX, l.n + k);
  return { n, at: n >= LIFE_MAX ? 0 : l.at + k * LIFE_MS };
};
const addLife = (l, now, d) => {
  const r = regen(l, now), n = Math.max(0, Math.min(LIFE_MAX, r.n + d));
  return { n, at: n >= LIFE_MAX ? 0 : r.n >= LIFE_MAX ? now : r.at };
};
const mmss = (ms) => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const rewardFor = (tier, level) => REWARD[tier] + Math.min(20, 2 * Math.floor(level / 10));
const dayNum = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
const BOOST = [
  ['slot', '➕', '+1 Slot', 'Libera o 5º slot da doca (só neste nível)'],
  ['cut', '✂️', 'Cortar', 'Remove todas as ligações'],
  ['magnet', '🧲', 'Íman', 'Remove até 10 cubos expostos'],
  ['shuffle', '🔀', 'Baralhar', 'Reorganiza as colunas (continua solucionável)'],
];

function fromPre(r, P) {
  const grid = Int8Array.from(r.g, (ch) => (ch === '.' ? -1 : parseInt(ch, 16)));
  let id = 0;
  const cols = r.c.map((c) => c.map(([color, count, g]) => ({ id: ++id, color, count, g })));
  const solution = r.s.split(',').map((m) => ({ cols: [...m].map(Number) }));
  if (!Logic.replay(grid, r.W, r.H, cols, solution)) return null;
  return { ...P, grid, palette: r.p, label: r.l, cols, solution, tests: r.t, corrections: r.k, blocks: r.b };
}

async function buildLevel(level, src, note) {
  const P = Logic.difficultyFor(level);
  let source = null, label = '';
  try {
    if (src.mode === 'upload' && src.image) { source = src.image; label = 'upload'; }
    else if (src.mode === 'openai' && src.key) {
      const theme = src.theme.trim() || THEMES[(level - 1) % THEMES.length];
      source = await ImageToLevelPipeline.openaiImage(src.key, src.model, ImageToLevelPipeline.autoPrompt(theme));
      label = 'OpenAI · ' + theme;
    }
  } catch (e) { note('OpenAI falhou (' + e.message + ') → biblioteca'); source = null; }
  let g = null;
  if (source) {
    try { g = ImageToLevelPipeline.toGrid(source, P.W, P.H, P.C); } catch (e) { g = null; }
    if (!g || g.count < Math.max(24, P.W * P.H * 0.12) || g.palette.length < 2) { g = null; note('Imagem sem conteúdo útil → biblioteca'); }
  }
  if (!g) {
    const pre = LEVELS[level - 1], r = pre && fromPre(pre, P);
    if (r) return r;
    const img = IMAGES[((level - 1) * 37) % IMAGES.length];
    label = img.name; g = Bitmaps.fromBitmap(img, P.W, P.H, P.C);
  }
  const gen = Logic.generate(g.grid, P.W, P.H, P, level * 7919 + 13, 4000);
  return { ...P, grid: g.grid, palette: g.palette, label, ...gen };
}

function Block({ color, count, linked, waiting, dim, onClick, shake, docked }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={'cvj-block relative flex items-center justify-center font-black text-white select-none ' + (shake ? 'cvj-shake ' : '') + (docked ? 'ring-2 ring-white ' : '') + (onClick ? 'active:translate-y-0.5 ' : '')}
      style={{ background: color, boxShadow: `0 calc(var(--b)*.11) 0 ${shade(color, 0.68)}, inset 0 3px 0 rgba(255,255,255,.38)`, opacity: dim ? 0.55 : 1 }}>
      <span style={{ fontSize: 'calc(var(--b)*.46)', textShadow: '0 2px 0 rgba(0,0,0,.4),0 0 4px rgba(0,0,0,.55)' }}>{count}</span>
      {linked ? <span className="absolute -top-1.5 -left-1.5 rounded-full bg-slate-900 text-[9px] leading-none px-1 py-0.5 ring-1 ring-white/70">🔗</span> : null}
      {waiting ? <span className="absolute -top-1.5 -right-1.5 text-[11px] cvj-pulse">⏳</span> : null}
    </button>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.9, dur: 1.6 + Math.random() * 1.6, rot: Math.random() * 360,
    color: ['#ff4d6d', '#ffd60a', '#4cc9f0', '#80ed99', '#b388ff', '#ff9f1c'][i % 6], w: 6 + Math.random() * 7,
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <i key={i} className="cvj-confetti absolute block" style={{ left: b.left + '%', top: '-4%', width: b.w, height: b.w * 0.6, background: b.color, animationDelay: b.delay + 's', animationDuration: b.dur + 's', transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}

function ColonyVoxelGame() {
  const [level, setLevel] = useState(() => Math.max(1, store.get('cvj_level', 1) | 0));
  const [nonce, setNonce] = useState(0);
  const [lv, setLv] = useState(null);
  const [status, setStatus] = useState('loading');
  const [speed, setSpeed] = useState(1);
  const [coins, setCoins] = useState(() => store.get('cvj_coins', 100) | 0);
  const [inv, setInv] = useState(() => ({ slot: 0, cut: 0, magnet: 0, shuffle: 0, ...store.get('cvj_inv', {}) }));
  const [shop, setShop] = useState(false);
  const [free2x, setFree2x] = useState(() => store.get('cvj_free2x', FREE_FAST) | 0);
  const [fastPaid, setFastPaid] = useState(false);
  const [maxCleared, setMaxCleared] = useState(() => store.get('cvj_max', 0) | 0);
  const [daily, setDaily] = useState(() => ({ last: -1, streak: 0, ...store.get('cvj_daily', {}) }));
  const [dailyModal, setDailyModal] = useState(() => store.get('cvj_daily', { last: -1 }).last !== dayNum());
  const [lastReward, setLastReward] = useState(0);
  const [dbg, setDbg] = useState(false);
  const [lives, setLives] = useState(() => regen({ n: LIFE_MAX, at: 0, ...store.get('cvj_lives', {}) }, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [livesModal, setLivesModal] = useState(false);
  const taps = useRef({ n: 0, t: 0 });
  const [auto, setAuto] = useState(false);
  const [modal, setModal] = useState(false);
  const [banner, setBanner] = useState(null);
  const [toast, setToast] = useState(null);
  const [shake, setShake] = useState(-1);
  const [src, setSrc] = useState({ mode: 'library', key: '', model: 'gpt-image-1', theme: '', image: null, name: '' });
  const [, setTick] = useState(0);

  const dockGrp = useRef(new Map()), mountRef = useRef(null), sceneRef = useRef(null), L = useRef(null), slots = useRef(Array(4).fill(null)), info = useRef(new Map());
  const pathRef = useRef({ moves: [], idx: 0, valid: false }), srcRef = useRef(src), autoRef = useRef(false), toastT = useRef(0);
  srcRef.current = src; autoRef.current = auto;
  const cloth = useMemo(picnicTexture, []);
  const bump = useCallback(() => setTick((t) => (t + 1) % 1e9), []);
  const note = useCallback((m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2600); }, []);

  const syncSlots = () => {
    const S = L.current, sc = sceneRef.current, sl = slots.current;
    if (!S || !sc) return;
    while (sl.length < S.maxSlots) sl.push(null);
    // a slot frees only when its block is done AND its last ant is in the anthill; linked groups free together
    const idle = (id) => !S.dock.some((d) => d.id === id) && sc.pending(id) === 0 && sc.activeAnts(id) === 0;
    const ids = sl.filter((x) => x != null), dg = dockGrp.current;
    for (const id of ids) {
      const g = dg.get(id);
      if (idle(id) && (!g || ids.every((o) => dg.get(o) !== g || idle(o)))) { sl[sl.indexOf(id)] = null; dg.delete(id); }
    }
  };

  // 3D scene lifecycle
  useEffect(() => {
    if (!window.THREE) return undefined;
    const sc = new VoxelScene(mountRef.current, {
      slotX: (id) => { const sl = slots.current, k = sl.indexOf(id), n = sl.length; return k < 0 || n < 2 ? 0 : (k - (n - 1) / 2) / ((n - 1) / 2); },
      onChange: bump,
    });
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [bump]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.speed = speed; }, [speed]);

  // level pipeline: image -> grid -> peeling generator -> solvability test
  useEffect(() => {
    let dead = false;
    setStatus('loading'); setAuto(false);
    const t = setTimeout(async () => {
      let data;
      try { data = await buildLevel(level, srcRef.current, (m) => !dead && note(m)); } catch (e) { if (!dead) note('Erro ao gerar nível: ' + e.message); return; }
      if (dead || !sceneRef.current) return;
      L.current = Logic.makeState(data.grid, data.W, data.H, data.cols.map((c) => c.map((b) => ({ ...b }))));
      slots.current = Array(4).fill(null); dockGrp.current.clear();
      info.current = new Map(data.cols.flat().map((b) => [b.id, b]));
      pathRef.current = { moves: data.solution, idx: 0, valid: true };
      sceneRef.current.loadLevel(data);
      setLv(data); setStatus('playing');
      store.set('cvj_level', level);
      if (data.tier !== 'std') { setBanner(data.tier); setTimeout(() => !dead && setBanner(null), 1800); }
    }, 40);
    return () => { dead = true; clearTimeout(t); };
  }, [level, nonce, note]);

  const doMove = (mv, fromAuto) => {
    const S = L.current, sc = sceneRef.current;
    syncSlots();
    if (slots.current.filter((x) => x == null).length < mv.cols.length) return false;
    for (const c of mv.cols) { const blk = S.cols[c][S.ptr[c]]; slots.current[slots.current.indexOf(null)] = blk.id; dockGrp.current.set(blk.id, blk.g || 0); }
    sc.enqueue(Logic.applyMove(S, mv));
    if (S.cols.every((col, c) => S.ptr[c] >= col.length)) { setSpeed(2); setFastPaid(true); note('Última peça na doca — 2x automático'); }
    if (!fromAuto) pathRef.current.valid = false;
    bump();
    return true;
  };

  const tapColumn = (c) => {
    if (status !== 'playing') return;
    const S = L.current, mv = Logic.legalMoves(S).find((m) => m.cols.includes(c));
    if (mv && doMove(mv, false)) return;
    const b = S.cols[c][S.ptr[c]];
    setShake(c); setTimeout(() => setShake(-1), 350);
    note(mv || !b || !b.g || S.maxSlots - S.dock.length < 1 ? 'Doca sem espaço — aguarde as formigas' : 'Bloco ligado: todos os parceiros precisam estar no topo e caber na doca');
  };

  const autoStep = () => {
    const S = L.current, p = pathRef.current;
    if (!S || status !== 'playing') return;
    if (!p.valid) {
      const r = Logic.solve(S, 6000);
      if (!r.solvable) { note('Solver: sem solução a partir daqui — reinicie ou use um booster'); setAuto(false); return; }
      pathRef.current = { moves: r.path, idx: 0, valid: true };
    }
    const q = pathRef.current, mv = q.moves[q.idx];
    if (mv && doMove(mv, true)) q.idx++;
  };

  // game clock: slot sync, win / game-over detection, auto-solver pacing
  const tickRef = useRef(null);
  tickRef.current = () => {
    const S = L.current, sc = sceneRef.current;
    if (!S || !sc || status !== 'playing') return;
    syncSlots();
    if (S.left === 0) { if (sc.isIdle()) setStatus('won'); }
    else if (sc.totalPending() === 0 && Logic.legalMoves(S).length === 0) setStatus('lost');
    else if (autoRef.current && sc.totalPending() === 0) autoStep();
    bump();
  };
  useEffect(() => { const iv = setInterval(() => tickRef.current(), 170); return () => clearInterval(iv); }, []);

  const fireBooster = (kind, paid) => {
    const S = L.current, sc = sceneRef.current;
    if (!S || !sc) return;
    if (!paid && !inv[kind]) { setShop(true); return; }
    if (status !== 'playing' && !(status === 'lost' && kind === 'slot')) return;
    if (kind === 'slot') { if (S.maxSlots >= 5) { note('Slot extra já ativo neste nível'); return; } S.maxSlots = 5; slots.current.push(null); if (status === 'lost') { setStatus('playing'); setLives((l) => addLife(l, Date.now(), 1)); } }
    else if (kind === 'cut') { sc.enqueue(Logic.cutLinks(S)); dockGrp.current.forEach((v, k) => dockGrp.current.set(k, 0)); }
    else if (kind === 'magnet') { const r = Logic.magnet(S); if (!r.removed.length) { note('Nenhum cubo exposto'); return; } sc.magnet(r.removed); sc.enqueue(r.rounds); }
    else if (kind === 'shuffle') { if (!Logic.shuffle(S, Logic.mulberry32(Date.now() & 0xffff))) { note('Baralhar: nenhuma ordem solucionável encontrada'); return; } }
    pathRef.current.valid = false;
    if (!paid) setInv((v) => ({ ...v, [kind]: v[kind] - 1 }));
    bump();
  };

  useEffect(() => { store.set('cvj_coins', coins); }, [coins]);
  useEffect(() => { store.set('cvj_inv', inv); }, [inv]);
  useEffect(() => { store.set('cvj_lives', lives); }, [lives]);
  useEffect(() => { const iv = setInterval(() => { const t = Date.now(); setNow(t); setLives((l) => regen(l, t)); }, 1000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (status === 'lost') setLives((l) => addLife(l, Date.now(), -1)); }, [status]);
  useEffect(() => { if (lives.n === 0 && status === 'playing') setLivesModal(true); }, [lives.n, status]);
  useEffect(() => { if (lives.n > 0) setLivesModal(false); }, [lives.n === 0]); // eslint-disable-line
  const buyLife = (all) => {
    const price = all ? LIFE_REFILL : LIFE_PRICE;
    if (coins < price || lives.n >= LIFE_MAX) return;
    setCoins((c) => c - price); setLives((l) => (all ? { n: LIFE_MAX, at: 0 } : addLife(l, Date.now(), 1)));
  };
  useEffect(() => { store.set('cvj_free2x', free2x); }, [free2x]);
  useEffect(() => { store.set('cvj_max', maxCleared); }, [maxCleared]);
  useEffect(() => { store.set('cvj_daily', daily); }, [daily]);
  useEffect(() => { setSpeed(1); setFastPaid(store.get('cvj_fast', 0) === level); }, [level]);
  useEffect(() => { if (!dbg) setAuto(false); }, [dbg]);
  useEffect(() => {
    if (status !== 'won' || !lv) return;
    const first = lv.level > maxCleared, r = first ? rewardFor(lv.tier, lv.level) : 0;
    setLastReward(r);
    if (first) { setCoins((c) => c + r); setMaxCleared(lv.level); }
  }, [status]); // eslint-disable-line
  const buy = (k) => { if (coins < PRICES[k] || inv[k] >= INV_CAP) return; setCoins((c) => c - PRICES[k]); setInv((v) => ({ ...v, [k]: v[k] + 1 })); };

  const toggleSpeed = () => {
    if (speed === 2) { setSpeed(1); return; }
    if (fastPaid) { setSpeed(2); return; }
    if (free2x > 0) { setFree2x(free2x - 1); setFastPaid(true); store.set('cvj_fast', level); setSpeed(2); note(`2x grátis usado — restam ${free2x - 1}`); return; }
    if (coins >= FAST_PRICE) { setCoins((c) => c - FAST_PRICE); setFastPaid(true); store.set('cvj_fast', level); setSpeed(2); note(`2x liberado neste nível (−🪙${FAST_PRICE})`); return; }
    note(`2x custa 🪙${FAST_PRICE} por nível`); setShop(true);
  };
  const skipLevel = () => {
    if (coins < SKIP_PRICE) { note(`Pular nível custa 🪙${SKIP_PRICE}`); return; }
    setCoins((c) => c - SKIP_PRICE); setModal(false); setLevel(level + 1);
  };
  const titleTap = () => {
    const T = taps.current, now = Date.now();
    T.n = now - T.t < 1500 ? T.n + 1 : 1; T.t = now;
    if (T.n >= 7) { T.n = 0; setDbg((d) => !d); }
  };
  const resetSave = () => { setCoins(100); setLives({ n: LIFE_MAX, at: 0 }); setInv({ slot: 0, cut: 0, magnet: 0, shuffle: 0 }); setMaxCleared(0); setDaily({ last: -1, streak: 0 }); setFree2x(FREE_FAST); store.set('cvj_fast', 0); setLevel(1); };
  const today = dayNum();
  const claimable = daily.last !== today;
  const nextStreak = daily.last === today - 1 ? daily.streak + 1 : daily.last === today ? daily.streak : 1;
  const dIdx = Math.min(Math.max(nextStreak, 1), 7) - 1, dailyAmount = Math.round(DAILY_BASE * DAILY_MULT[dIdx]);
  const claim = () => { if (!claimable) return; setCoins((c) => c + dailyAmount); setDaily({ last: today, streak: nextStreak }); setDailyModal(false); note(`+${dailyAmount} 🪙 (dia ${dIdx + 1}, ×${DAILY_MULT[dIdx]})`); };

  const [confirmRestart, setConfirmRestart] = useState(false);
  const askRestart = () => { if (lives.n <= 0) { setLivesModal(true); return; } if (status === 'playing') setConfirmRestart(true); else restart(); };
  const payRestart = () => { setConfirmRestart(false); setLives((l) => addLife(l, Date.now(), -1)); setNonce((n) => n + 1); };
  const restart = () => { if (lives.n <= 0) { setLivesModal(true); return; } setNonce((n) => n + 1); };
  const goLevel = (n) => { const v = Math.max(1, n); if (v === level) restart(); else setLevel(v); };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const image = await ImageToLevelPipeline.fileToImage(f); setSrc((s) => ({ ...s, mode: 'upload', image, name: f.name })); srcRef.current = { ...srcRef.current, mode: 'upload', image }; setModal(false); restart(); }
    catch (err) { note('Upload falhou: ' + err.message); }
  };
  const applySource = (mode) => { const next = { ...src, mode }; setSrc(next); srcRef.current = next; setModal(false); restart(); };

  if (!window.THREE) return <div className="p-6 text-white">Three.js não carregou (CDN bloqueado). Recarregue a página.</div>;

  syncSlots();
  const nextIn = lives.n < LIFE_MAX ? Math.max(0, LIFE_MS - (now - lives.at)) : 0;
  const livesCard = (
    <div className="mt-2 rounded-2xl bg-rose-50 p-2.5">
      <div className="flex items-center justify-between">
        <b className="text-sm">❤️ Vidas {lives.n}/{LIFE_MAX}</b>
        <span className="text-xs text-slate-500">{lives.n < LIFE_MAX ? `próxima em ${mmss(nextIn)}` : 'cheias'}</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">Perde 1 vida a cada Game Over. Recupera 1 a cada {LIFE_MS / 60000} min.</div>
      <div className="mt-2 flex gap-2">
        <button disabled={coins < LIFE_PRICE || lives.n >= LIFE_MAX} onClick={() => buyLife(false)} className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-bold text-white shadow-[0_3px_0_#9f1239] disabled:opacity-40">+1 vida 🪙{LIFE_PRICE}</button>
        <button disabled={coins < LIFE_REFILL || lives.n >= LIFE_MAX} onClick={() => buyLife(true)} className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-bold text-white shadow-[0_3px_0_#881337] disabled:opacity-40">Encher 🪙{LIFE_REFILL}</button>
      </div>
    </div>
  );
  const dailyCard = (
    <div className="mt-2 rounded-2xl bg-amber-50 p-2.5">
      <div className="flex items-center justify-between">
        <b className="text-sm">🎁 Recompensa diária <span className="font-normal text-slate-500">· sequência {claimable ? nextStreak - 1 : daily.streak}</span></b>
        <button disabled={!claimable} onClick={claim} className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-bold text-white shadow-[0_3px_0_#b7791f] disabled:opacity-40">{claimable ? `Resgatar 🪙${dailyAmount}` : 'Volte amanhã'}</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {DAILY_MULT.map((m, i) => (
          <div key={i} className={'rounded-lg py-1 text-[10px] leading-tight ' + (i === dIdx ? (claimable ? 'bg-amber-400 font-bold text-white ring-2 ring-amber-600' : 'bg-emerald-400 font-bold text-white') : i < dIdx ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500')}>
            D{i + 1}<br />×{m}<br />{Math.round(DAILY_BASE * m)}
          </div>
        ))}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">Falhou um dia → sequência volta ao D1. Do D7 em diante fica ×5.</div>
    </div>
  );
  const S = L.current, sc = sceneRef.current, tier = lv ? lv.tier : 'std', pal = lv ? lv.palette : [];
  const legalCols = new Set(S && status === 'playing' ? Logic.legalMoves(S).flatMap((m) => m.cols) : []);
  const cyclePos = (level - 1) % 5;
  const frame = tier === 'super' ? 'linear-gradient(135deg,#ffd60a,#b388ff,#ffd60a)' : tier === 'hard' ? 'linear-gradient(135deg,#ff9f1c,#ef233c)' : 'transparent';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#12261f]" style={{ fontFamily: "'Fredoka',system-ui,sans-serif" }}>
      <div className="cvj-frame relative overflow-hidden" style={{ background: frame, padding: tier === 'std' ? 0 : 4 }}>
        <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: 'linear-gradient(#5fb37c,#3f8f63 55%,#2f7450)', borderRadius: tier === 'std' ? 0 : 14 }}>

          {/* header */}
          <div className="relative z-10 px-3 pt-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              <div className="flex gap-1.5">
                <button className="cvj-btn" onClick={() => setModal(true)} aria-label="Fonte de imagem">🖼️</button>
                <button className="cvj-btn" onClick={askRestart} aria-label="Reiniciar">↻</button>
                <button className="cvj-btn relative" onClick={() => setLivesModal(true)} aria-label="Vidas">❤️{lives.n}{lives.n < LIFE_MAX ? <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-1.5 text-[9px] leading-4 text-white ring-1 ring-white">{mmss(nextIn)}</span> : null}</button>
              </div>
              <div className="text-center leading-none">
                <div className="text-2xl font-bold text-white drop-shadow" onClick={titleTap}>Nível {level}</div>
                {tier !== 'std' ? <span className={'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white ' + (tier === 'super' ? 'bg-gradient-to-r from-purple-600 to-amber-500' : 'bg-gradient-to-r from-orange-500 to-red-600')}>{tier === 'super' ? 'SUPER HARD' : 'HARD'}</span> : null}
              </div>
              <div className="flex justify-end gap-1.5">
                <button className="cvj-btn font-bold" onClick={() => setShop(true)} aria-label="Loja">🪙 {coins}</button>
                <button className="cvj-btn relative font-bold" onClick={toggleSpeed}>⏩{speed}x</button>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-2">
              {[0, 1, 2, 3, 4].map((k) => (
                <span key={k} className={'flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition ' + (k === cyclePos ? 'scale-125 bg-white shadow ring-2 ring-amber-300' : k < cyclePos ? 'bg-emerald-200/90' : 'bg-black/25')}>
                  {k === 3 ? '🔥' : k === 4 ? '💀' : k < cyclePos ? '✓' : ''}
                </span>
              ))}
            </div>
            {dbg ? (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1 rounded-xl bg-black/45 px-2 py-1 text-[10px] text-white">
                <b className="text-amber-300">DEBUG</b><span className="text-emerald-300">{lv ? `✓ Solvable ${lv.solution.length} moves` : ""}</span>
                <button className="rounded-full bg-white/20 px-2 py-0.5" onClick={autoStep}>Test Step</button>
                <button className={'rounded-full px-2 py-0.5 ' + (auto ? 'bg-amber-500' : 'bg-white/20')} onClick={() => setAuto((a) => !a)}>{auto ? '■ Auto' : '▶ Auto-Solve'}</button>
                <button className="rounded-full bg-white/20 px-2 py-0.5" onClick={() => goLevel(level - 1)}>Nv−</button>
                <button className="rounded-full bg-white/20 px-2 py-0.5" onClick={() => goLevel(level + 1)}>Nv+</button>
                <button className="rounded-full bg-white/20 px-2 py-0.5" onClick={() => setCoins((c) => c + 1000)}>+1000🪙</button>
                <button className="rounded-full bg-red-500/80 px-2 py-0.5" onClick={resetSave}>Reset save</button>
              </div>
            ) : null}
          </div>

          {/* 3D arena */}
          <div ref={mountRef} className="relative min-h-0 flex-1" />

          {/* dock */}
          <div className="relative z-10 mx-2 mb-2 mt-1 rounded-2xl px-1 pb-2 pt-3" style={{ background: 'linear-gradient(#6b4a2f,#4e3421)', boxShadow: 'inset 0 3px 6px rgba(0,0,0,.5), 0 2px 0 rgba(255,255,255,.25)' }}>
            <div className="flex justify-center gap-[2.4cqw]">
              {slots.current.map((id, k) => {
                if (id == null || !S) return <div key={k} className="cvj-slot" />;
                const d = S.dock.find((x) => x.id === id), b = info.current.get(id), pend = sc ? sc.pending(id) : 0;
                return <div key={k} className="cvj-slot"><Block docked color={pal[b.color]} count={(d ? d.count : 0) + pend} linked={d && d.g} waiting={d && d.count > 0 && pend === 0 && sc && sc.totalPending() === 0} /></div>;
              })}
            </div>
          </div>

          {/* columns */}
          <div className="relative z-10 mx-2 mb-1 rounded-2xl pt-3" style={{ background: 'rgba(255,255,255,.16)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.22)' }}>
            <div className="flex justify-center gap-[2.4cqw] overflow-hidden px-1" style={{ height: 'calc(var(--b)*3.15)' }}>
              {S ? S.cols.map((col, c) => (
                <div key={c} className="flex flex-col items-center gap-[1.6cqw] pt-1" style={{ width: 'calc(var(--b) + 6px)' }}>
                  {col.slice(S.ptr[c], S.ptr[c] + 4).map((b, r) => {
                    const nb = S.cols[c + 1] && S.cols[c + 1][S.ptr[c + 1] + r];
                    return (
                      <div key={b.id} className="relative">
                        <Block color={pal[b.color]} count={b.count} linked={b.g} dim={r > 0} shake={r === 0 && shake === c}
                          onClick={r === 0 ? () => tapColumn(c) : undefined} />
                        {r === 0 && legalCols.has(c) ? <span className="pointer-events-none absolute inset-0 rounded-[26%] ring-2 ring-white/80" /> : null}
                        {b.g && nb && nb.g === b.g ? <span className="pointer-events-none absolute top-1/2 z-10 h-2 -translate-y-1/2 rounded-full bg-slate-900 ring-1 ring-white/70" style={{ left: '88%', width: 'calc(24% + 2.4cqw + 6px)' }} /> : null}
                      </div>
                    );
                  })}
                </div>
              )) : null}
            </div>
          </div>

          {/* boosters on the picnic cloth */}
          <div className="relative z-10 flex justify-around rounded-t-3xl px-2 pb-3 pt-2 shadow-[0_-4px_0_rgba(0,0,0,.18)]" style={{ backgroundImage: `url(${cloth})`, backgroundSize: '48px 48px' }}>
            {BOOST.map(([k, icon, label]) => {
              const off = k === 'slot' && S && S.maxSlots >= 5;
              return (
                <button key={k} onClick={() => fireBooster(k)} disabled={off}
                  className={'relative flex h-14 w-14 flex-col items-center justify-center rounded-full bg-amber-50 shadow-[0_4px_0_#c9a36b] ring-2 ring-white transition active:translate-y-0.5 ' + (off ? 'opacity-45 grayscale' : '')}>
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="text-[8px] font-semibold leading-tight text-amber-900">{label}</span>
                  <span className={'absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white ' + (inv[k] ? 'bg-emerald-500' : 'bg-sky-500')}>{inv[k] || '+'}</span>
                </button>
              );
            })}
          </div>

          {/* overlays */}
          {status === 'loading' ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 text-lg font-semibold text-white">Gerando e validando nível…</div> : null}
          {banner ? (
            <div className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex justify-center">
              <div className={'cvj-banner w-full py-3 text-center text-2xl font-bold tracking-wide text-white shadow-xl ' + (banner === 'super' ? 'bg-gradient-to-r from-purple-700 via-fuchsia-600 to-amber-500' : 'bg-gradient-to-r from-orange-500 to-red-600')}>
                {banner === 'super' ? '💀 SUPER HARD LEVEL' : '🔥 HARD LEVEL'}
              </div>
            </div>
          ) : null}
          {toast ? <div className="absolute inset-x-4 bottom-24 z-40 rounded-xl bg-slate-900/90 px-3 py-2 text-center text-xs text-white shadow-lg">{toast}</div> : null}

          {status === 'won' ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45">
              <Confetti />
              <div className="cvj-banner relative mx-6 rounded-3xl bg-white p-6 text-center shadow-2xl">
                <div className="text-4xl">🐜🎉</div>
                <div className="mt-1 text-2xl font-bold text-emerald-700">Nível {level} concluído!</div>
                <div className="mt-1 text-xs text-slate-500">Mosaico “{lv.label}” · {lv.blocks} blocos · {lv.W}×{lv.H}</div>
                {lastReward > 0 ? <div className="mt-2 text-xl font-bold text-amber-500">+{lastReward} 🪙</div> : <div className="mt-2 text-xs text-slate-400">Nível já concluído antes — sem moedas</div>}
                <button className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-lg font-bold text-white shadow-[0_4px_0_#16794a] active:translate-y-0.5" onClick={() => setLevel(level + 1)}>Próximo nível →</button>
              </div>
            </div>
          ) : null}
          {status === 'lost' ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55">
              <div className="cvj-banner mx-6 rounded-3xl bg-white p-6 text-center shadow-2xl">
                <div className="text-4xl">😵</div>
                <div className="mt-1 text-2xl font-bold text-red-600">Game Over</div>
                <div className="mt-1 text-xs text-slate-500">Doca bloqueada — nenhum movimento possível.</div>
                {S && S.maxSlots < 5 ? (inv.slot > 0
                  ? <button className="mt-4 w-full rounded-2xl bg-amber-400 py-2.5 font-bold text-amber-950 shadow-[0_4px_0_#b7791f] active:translate-y-0.5" onClick={() => fireBooster('slot')}>➕ Usar +1 Slot e continuar</button>
                  : coins >= PRICES.slot ? <button className="mt-4 w-full rounded-2xl bg-amber-400 py-2.5 font-bold text-amber-950 shadow-[0_4px_0_#b7791f] active:translate-y-0.5" onClick={() => { setCoins((c) => c - PRICES.slot); fireBooster('slot', true); }}>➕ Comprar +1 Slot (🪙{PRICES.slot}) e continuar</button> : null) : null}
                {lives.n > 0
                  ? <button className="mt-3 w-full rounded-2xl bg-red-500 py-2.5 font-bold text-white shadow-[0_4px_0_#9b1c1c] active:translate-y-0.5" onClick={restart}>↻ Tentar de novo · ❤️ {lives.n}</button>
                  : <div className="mt-3 text-left">{livesCard}</div>}
              </div>
            </div>
          ) : null}

          {confirmRestart ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmRestart(false)}>
              <div className="cvj-banner mx-6 w-full rounded-3xl bg-white p-5 text-center text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="text-lg font-bold">Reiniciar o nível?</div>
                <div className="mt-1 text-sm text-slate-500">Custa 1 vida ❤️ (você fica com {lives.n - 1}). Boosters usados não voltam.</div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-xl bg-slate-100 py-2.5 font-semibold" onClick={() => setConfirmRestart(false)}>Cancelar</button>
                  <button className="flex-1 rounded-xl bg-rose-500 py-2.5 font-bold text-white shadow-[0_3px_0_#9f1239]" onClick={payRestart}>Reiniciar</button>
                </div>
              </div>
            </div>
          ) : null}

          {livesModal ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => lives.n > 0 && setLivesModal(false)}>
              <div className="cvj-banner mx-4 w-full rounded-3xl bg-white p-4 text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {lives.n === 0 ? <div className="text-center text-lg font-bold text-rose-600">Sem vidas 💔</div> : null}
                {livesCard}
                {lives.n > 0 ? <button className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm font-semibold" onClick={() => setLivesModal(false)}>Fechar</button> : null}
              </div>
            </div>
          ) : null}

          {dailyModal ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDailyModal(false)}>
              <div className="cvj-banner mx-4 w-full rounded-3xl bg-white p-4 text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {dailyCard}
                <button className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm font-semibold" onClick={() => setDailyModal(false)}>{claimable ? 'Depois' : 'Fechar'}</button>
              </div>
            </div>
          ) : null}

          {shop ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55" onClick={() => setShop(false)}>
              <div className="w-full rounded-t-3xl bg-white p-4 text-slate-800" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">Loja de boosters</div>
                  <div className="flex items-center gap-2"><b className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">🪙 {coins}</b><button className="rounded-full bg-slate-100 px-3 py-1 text-sm" onClick={() => setShop(false)}>✕</button></div>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">1ª vez que limpa o nível: {REWARD.std} (normal) · {REWARD.hard} (HARD) · {REWARD.super} (SUPER HARD), +2 a cada 10 níveis (teto +20).</div>
                <div className="mt-1 text-[11px] text-slate-500">⏩ 2x: 🪙{FAST_PRICE} por nível · grátis restantes: <b>{free2x}</b></div>
                {dailyCard}
                {livesCard}
                {livesCard}
                {BOOST.map(([k, icon, label, desc]) => (
                  <div key={k} className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 p-2.5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-2xl shadow">{icon}</span>
                    <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{label} <span className="text-xs font-normal text-slate-500">· você tem {inv[k]}/{INV_CAP}</span></div><div className="text-[11px] leading-tight text-slate-500">{desc}</div></div>
                    <button disabled={coins < PRICES[k] || inv[k] >= INV_CAP} onClick={() => buy(k)} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white shadow-[0_3px_0_#16794a] disabled:opacity-40">🪙 {PRICES[k]}</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {modal ? (
            <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55" onClick={() => setModal(false)}>
              <div className="max-h-[92%] w-full overflow-y-auto rounded-t-3xl bg-white p-4 text-slate-800" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">Fonte da imagem do nível</div>
                  <button className="rounded-full bg-slate-100 px-3 py-1 text-sm" onClick={() => setModal(false)}>✕</button>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Atual: <b>{src.mode}</b>{lv ? ` · ${lv.label} · ${lv.W}×${lv.H} · ${pal.length} cores · ${lv.tests} testes, ${lv.corrections} auto-correções` : ''}</div>

                <div className="mt-3 rounded-2xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold">1 · Biblioteca ({IMAGES.length} imagens · {LEVELS.length} níveis pré-calculados)</div>
                  <div className="text-[11px] text-slate-500">Pixel-art gerada por código; níveis já validados como solucionáveis. Sem rede.</div>
                  <button className="mt-2 w-full rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white" onClick={() => applySource('library')}>Usar biblioteca</button>
                </div>
                <div className="mt-2 rounded-2xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold">2 · Upload local (PNG/JPG)</div>
                  <div className="text-[11px] text-slate-500">{src.image ? 'Carregada: ' + src.name : 'Fundo branco/transparente é removido.'}</div>
                  <label className="mt-2 block w-full cursor-pointer rounded-xl bg-sky-500 py-2 text-center text-sm font-bold text-white">Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} /></label>
                </div>
                <div className="mt-2 rounded-2xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold">3 · OpenAI Image API</div>
                  <input type="password" autoComplete="off" placeholder="OPENAI_API_KEY (sk-…)" value={src.key} onChange={(e) => setSrc({ ...src, key: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                  <div className="mt-2 flex gap-2">
                    <select value={src.model} onChange={(e) => setSrc({ ...src, model: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="gpt-image-1">gpt-image-1</option><option value="dall-e-3">dall-e-3</option>
                    </select>
                    <input placeholder="Tema (vazio = automático por nível)" value={src.theme} onChange={(e) => setSrc({ ...src, theme: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                  </div>
                  <div className="mt-1 text-[10px] leading-snug text-slate-500">Prompt: “{ImageToLevelPipeline.autoPrompt(src.theme.trim() || THEMES[(level - 1) % THEMES.length])}”. Chave fica só em memória. Dentro do Claude Artifacts a rede externa é bloqueada (CSP) → cai na biblioteca; num .html local funciona.</div>
                  <button disabled={!src.key} className="mt-2 w-full rounded-xl bg-violet-600 py-2 text-sm font-bold text-white disabled:opacity-40" onClick={() => applySource('openai')}>Gerar com OpenAI</button>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-100 p-3">
                  <div><div className="text-sm font-semibold">Pular nível</div><div className="text-[11px] text-slate-500">Sem recompensa. Não conta como concluído.</div></div>
                  <button disabled={coins < SKIP_PRICE} onClick={skipLevel} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-bold text-white shadow-[0_3px_0_#9f1239] disabled:opacity-40">🪙 {SKIP_PRICE}</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ColonyVoxelGame />);
