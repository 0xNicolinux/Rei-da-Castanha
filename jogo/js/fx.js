/* Rei da Castanha: fx — efeitos, clima e moldura de primeiro plano (plugado via RC.events / RC.game).
   Tudo aqui usa partículas próprias (lista F) desenhadas em drawFront (alpha) e drawAdd (aditivo).
   Aditivo sempre com alpha baixo para não estourar o bloom. */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  const clamp = RC.clamp;
  const API = () => RC.game;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let F = [];                       // partículas próprias
  let wasGround = true, lastVy = 0, lastFace = 1;
  let lastAtkId = 0, lastCombo = 0;
  let confetti = false, confT = 0;
  let wx = 0;                       // tempo de vento
  const MAXP = [900, 650, 420, 260];

  const qf = () => [1, 0.75, 0.5, 0.3][Math.min(3, API().quality | 0)];
  const cnt = (n) => Math.max(1, Math.round(n * qf()));
  function add(p) { if (F.length < MAXP[Math.min(3, API().quality | 0)]) F.push(p); }
  // p: {k:'streak'|'chunk'|'leaf'|'puff'|'orb'|'conf'|'ring', x,y,vx,vy,g,drag,life,size,col,rot,vr,add}
  function P(k, x, y, o) {
    o.k = k; o.x = x; o.y = y; o.vx = o.vx || 0; o.vy = o.vy || 0; o.g = o.g || 0; o.drag = o.drag || 0;
    o.life = o.max = o.life || 0.5; o.size = o.size || 1; o.rot = o.rot || 0; o.vr = o.vr || 0; o.col = o.col || [1, 1, 1];
    add(o); return o;
  }

  /* ------------------------------------------------------------ eventos */
  const ORANGE = [1, 0.7, 0.3], GOLD = [1, 0.85, 0.4];

  function impact(x, y, dir, big, col) {
    col = col || (big ? GOLD : ORANGE);
    // faíscas direcionais em leque (riscos)
    const n = cnt(big ? 12 : 7);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(0, dir) + rnd(-0.7, 0.7), s = rnd(220, big ? 520 : 380);
      P('streak', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 260, drag: 3.2, life: rnd(0.18, 0.34), size: rnd(0.6, 1.2), col, add: 1 });
    }
    // estouro central + anel
    P('orb', x, y, { life: 0.14, size: big ? 1.7 : 1.2, col: [1, 0.9, 0.6], add: 1, a: 0.5 });
    P('ring', x, y, { life: 0.26, size: big ? 2.6 : 1.8, col, add: 1, a: 0.5 });
  }

  function debris(x, y, w, h, how) {
    const cols = [[0.42, 0.26, 0.14], [0.62, 0.4, 0.2], [0.2, 0.34, 0.16], [0.82, 0.55, 0.24], [0.15, 0.1, 0.08]];
    const n = cnt(14);
    for (let i = 0; i < n; i++) {
      P('chunk', x + rnd(-w / 3, w / 3), y + rnd(-h / 3, h / 3), {
        vx: rnd(-230, 230), vy: rnd(-380, -90), g: 900, life: rnd(0.55, 1.1), size: rnd(1.4, 3.2),
        rot: rnd(0, 6), vr: rnd(-12, 12), col: pick(cols)
      });
    }
    for (let i = 0; i < cnt(6); i++) {
      P('leaf', x, y, { vx: rnd(-200, 200), vy: rnd(-300, -60), g: 140, drag: 1.4, life: rnd(0.9, 1.6), rot: rnd(0, 6), vr: rnd(-8, 8), name: pick(['leaf_0', 'leaf_1', 'leaf_2']) });
    }
    for (let i = 0; i < cnt(5); i++) P('puff', x + rnd(-10, 10), y + rnd(-6, 8), { vx: rnd(-60, 60), vy: rnd(-70, -10), g: -20, drag: 2, life: rnd(0.4, 0.7), size: rnd(1.2, 2.2), col: [0.8, 0.72, 0.6] });
    P('orb', x, y, { life: 0.2, size: 2.2, col: [1, 0.8, 0.5], add: 1, a: 0.42 });
    P('ring', x, y, { life: 0.32, size: 3.2, col: [1, 0.85, 0.55], add: 1, a: 0.4 });
    if (how === 'stomp') for (let i = 0; i < cnt(6); i++) P('streak', x, y + h / 2, { vx: (i % 2 ? 1 : -1) * rnd(120, 300), vy: rnd(-60, 0), drag: 3, life: 0.25, size: 0.8, col: [1, 0.9, 0.7], add: 1 });
  }

  EV.on('enemyKilled', (e, how) => {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    debris(cx, cy, e.w, e.h, how);
    impact(cx, cy, API().player.facing, true);
  });

  EV.on('nutTaken', (n) => {
    const gold = n.golden;
    const col = gold ? [1, 0.9, 0.4] : [1, 0.72, 0.32];
    for (let i = 0; i < cnt(gold ? 14 : 8); i++) {
      const a = (i / 8) * 6.283 + rnd(-0.2, 0.2), s = rnd(60, gold ? 200 : 140);
      P('streak', n.x, n.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: -40, drag: 2.5, life: rnd(0.3, 0.55), size: rnd(0.5, 0.9), col, add: 1 });
    }
    P('orb', n.x, n.y, { life: 0.3, size: gold ? 1.8 : 1.2, col, add: 1, a: 0.4 });
    P('ring', n.x, n.y, { life: 0.34, size: gold ? 2.6 : 1.8, col, add: 1, a: 0.4 });
  });

  EV.on('checkpoint', (c) => {
    const x = c.x, y = c.y - 38;
    P('orb', x, y, { life: 0.7, size: 3.4, col: [1, 0.7, 0.35], add: 1, a: 0.4 });
    P('ring', x, y, { life: 0.6, size: 5, col: [1, 0.78, 0.4], add: 1, a: 0.45 });
    P('ring', x, y, { life: 0.9, size: 7.5, col: [1, 0.6, 0.3], add: 1, a: 0.3 });
    for (let i = 0; i < cnt(22); i++) {
      const a = rnd(-3.0, -0.14), s = rnd(60, 260);
      P('streak', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 90, drag: 1.4, life: rnd(0.6, 1.3), size: rnd(0.5, 1), col: pick([[1, 0.75, 0.3], [1, 0.55, 0.25], [1, 0.9, 0.5]]), add: 1 });
    }
  });

  EV.on('playerHurt', () => {
    const p = API().player, x = p.x + p.w / 2, y = p.y + p.h / 2;
    for (let i = 0; i < cnt(10); i++) {
      const a = rnd(0, 6.283), s = rnd(120, 340);
      P('streak', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rnd(0.2, 0.4), size: 0.9, col: [1, 0.35, 0.25], add: 1 });
    }
    P('ring', x, y, { life: 0.3, size: 3, col: [1, 0.4, 0.3], add: 1, a: 0.45 });
  });

  EV.on('finish', () => { confetti = true; confT = 0; });
  EV.on('stageLoaded', () => { F = []; confetti = false; wasGround = true; birds = null; });
  EV.on('stageStart', () => { confetti = false; });

  /* detecta pouso, soco (onda de choque) e salto a cada tick */
  EV.on('update', (dt) => {
    const p = API().player, G = API().G;
    wx += dt;
    const cx = p.x + p.w / 2, feet = p.y + p.h;
    if (p.grounded && !wasGround && lastVy > 240) {
      const k = clamp(lastVy / 700, 0.4, 1);
      for (let i = 0; i < cnt(8 + 8 * k); i++) {
        const d = i % 2 ? 1 : -1;
        P('puff', cx + d * rnd(2, 10), feet - 2, { vx: d * rnd(40, 170) * (0.6 + k), vy: rnd(-45, -8), g: -10, drag: 2.4, life: rnd(0.35, 0.65), size: rnd(1.2, 2.4), col: [0.85, 0.76, 0.62] });
      }
      if (k > 0.55) P('ring', cx, feet - 3, { life: 0.28, size: 3.2, col: [1, 0.9, 0.7], add: 1, a: 0.3, flat: 1 });
    }
    if (!p.grounded && wasGround && p.vy < -100) {
      for (let i = 0; i < cnt(4); i++) P('puff', cx + rnd(-8, 8), feet - 2, { vx: rnd(-50, 50), vy: rnd(-25, -5), drag: 2, life: 0.35, size: 1.1, col: [0.85, 0.76, 0.62] });
    }
    wasGround = p.grounded; lastVy = p.vy; if (p.facing) lastFace = p.facing;

    if (p.atk > 0 && p.atkId !== lastAtkId) {
      lastAtkId = p.atkId;
      const fin = p.combo === 3, f = p.facing || 1;
      const x = cx + f * 26, y = p.y + p.h * 0.45;
      // onda de choque do soco: arco de riscos à frente
      for (let i = 0; i < cnt(fin ? 9 : 5); i++) {
        const a = rnd(-0.5, 0.5), s = rnd(160, fin ? 420 : 300);
        P('streak', x - f * 6, y + rnd(-10, 10), { vx: f * Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, drag: 4.2, life: rnd(0.12, 0.22), size: rnd(0.7, 1.3), col: [1, 0.95, 0.75], add: 1 });
      }
      if (fin) P('ring', x + f * 6, y, { life: 0.3, size: 3.6, col: [1, 0.85, 0.5], add: 1, a: 0.4 });
    }
    // trilha de poeira ao correr
    if (p.grounded && Math.abs(p.vx) > 190 && Math.random() < dt * 9) P('puff', cx - p.facing * 10, feet - 2, { vx: -p.facing * rnd(10, 40), vy: rnd(-30, -6), drag: 2, life: 0.4, size: rnd(0.8, 1.5), col: [0.85, 0.76, 0.62] });
    ambient(dt, G);
    if (confetti) {
      confT += dt;
      if (confT < 9 && Math.random() < dt * 60) {
        const cols = [[1, 0.35, 0.4], [1, 0.85, 0.3], [0.4, 0.8, 1], [0.5, 1, 0.5], [1, 0.55, 0.9]];
        P('conf', G.camX + rnd(-20, 980), rnd(-30, -5), { vx: rnd(-40, 40), vy: rnd(40, 120), g: 0, drag: 0.1, life: rnd(4, 7), size: rnd(1.2, 2), col: pick(cols), rot: rnd(0, 6), vr: rnd(-6, 6), ph: rnd(0, 6) });
      }
    }
  });

  /* ------------------------------------------------------------ clima / ambiente */
  function ambient(dt, G) {
    const m = G.mood; if (!m || G.state === 'boot') return;
    const cam = G.camX, id = m.id, q = qf();
    const spawn = (rate) => Math.random() < dt * rate * q;
    if (id === 'amanhecer' && spawn(2.2)) {
      // névoa matinal rasteira e pólen dourado
      P('mist', cam + rnd(-100, 1000), rnd(360, 440), { vx: rnd(8, 18), life: rnd(7, 11), size: rnd(5, 9), col: [1, 0.85, 0.65], a: 0.05 });
    }
    if ((id === 'amanhecer' || id === 'mata') && spawn(5)) {
      P('mote', cam + rnd(-40, 1000), rnd(60, 440), { vx: rnd(6, 20), vy: rnd(-8, 6), life: rnd(5, 9), size: rnd(0.5, 0.9), col: id === 'mata' ? [1, 1, 0.7] : [1, 0.85, 0.5], ph: rnd(0, 6), a: 0.55 });
    }
    if (id === 'entardecer' && spawn(7)) {
      P('mote', cam + rnd(-40, 1000), rnd(80, 460), { vx: rnd(-22, -6), vy: rnd(-10, 4), life: rnd(5, 9), size: rnd(0.4, 0.8), col: [1, 0.62, 0.35], ph: rnd(0, 6), a: 0.6 });
    }
    if (id === 'horaazul' && spawn(2.5)) {
      P('mote', cam + rnd(-40, 1000), rnd(180, 440), { vx: rnd(-8, 8), vy: rnd(-12, 2), life: rnd(6, 10), size: rnd(0.7, 1.2), col: [0.6, 1, 0.55], ph: rnd(0, 6), a: 0.7, blink: 1 });
    }
    if (id === 'noite') {
      if (spawn(0.55)) P('lantern', cam + rnd(-60, 1000), 560, { vx: rnd(-8, 8), vy: rnd(-26, -14), life: rnd(16, 24), size: rnd(0.9, 1.4), col: pick([[1, 0.62, 0.28], [1, 0.45, 0.35], [1, 0.8, 0.4]]), ph: rnd(0, 6), a: 0.8 });
      if (spawn(3)) P('mote', cam + rnd(-40, 1000), rnd(120, 440), { vx: rnd(-6, 6), vy: rnd(-14, -2), life: rnd(5, 8), size: rnd(0.5, 0.9), col: [0.7, 0.8, 1], ph: rnd(0, 6), a: 0.5 });
    }
  }

  /* ------------------------------------------------------------ desenho das partículas */
  const mixc = (c, a) => [c[0], c[1], c[2], a];

  function stepParts(dt) {
    for (let i = F.length - 1; i >= 0; i--) {
      const p = F[i];
      p.life -= dt;
      if (p.life <= 0) { F[i] = F[F.length - 1]; F.pop(); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.k === 'mote' || p.k === 'lantern') { p.x += (p.vx + Math.sin(wx * 0.9 + p.ph) * 10) * dt; p.y += (p.vy + Math.cos(wx * 0.7 + p.ph * 2) * 6) * dt; }
      else if (p.k === 'conf') { p.x += (p.vx + Math.sin(wx * 2.2 + p.ph) * 40) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    }
  }
  let lastT = 0;

  function drawParts(addPass, t, cam) {
    const g = API(), R = g.R, set = g.atlas.set, rc = g.rects;
    if (!addPass) { const dt = clamp(t - lastT, 0, 0.05); lastT = t; if (g.G.state !== 'paused') stepParts(dt); }
    const lo = cam - 80, hi = cam + 960 + 80;
    for (const p of F) {
      if (p.x < lo || p.x > hi) continue;
      const a = clamp(p.life / p.max, 0, 1), u = 1 - a;
      if (RC.fxSkip && RC.fxSkip[p.k]) continue;
      const isAdd = p.add || p.k === 'mote' || p.k === 'lantern' || p.k === 'mist';
      if (isAdd !== addPass) continue;
      switch (p.k) {
        case 'streak': {          // risco estirado na direção da velocidade
          const sp = Math.hypot(p.vx, p.vy), len = clamp(sp * 0.045, 3, 26) * p.size, th = 2.2 * p.size;
          const ang = Math.atan2(p.vy, p.vx);
          R.sprite(set, rc.glow, p.x - len / 2, p.y - th / 2, len / 64, th / 64, { rot: ang, col: mixc(p.col, a * 0.8), lit: 0, noSnap: true });
          break;
        }
        case 'orb': {
          const s = p.size * (0.5 + u * 0.9);
          R.sprite(set, rc.glow, p.x - 32 * s, p.y - 32 * s, s, s, { col: mixc(p.col, (p.a || 0.4) * a * a), lit: 0, noSnap: true });
          break;
        }
        case 'ring': {            // anel: círculo de pontos em expansão
          const r = (10 + u * 22) * p.size * 0.5, n = 14, ds = 0.55 * (0.4 + a);
          for (let i = 0; i < n; i++) {
            const an = i / n * 6.283 + p.rot, rx = Math.cos(an) * r, ry = Math.sin(an) * r * (p.flat ? 0.28 : 1);
            R.sprite(set, rc.glow, p.x + rx - 32 * ds * 0.5, p.y + ry - 32 * ds * 0.5, ds * 0.5, ds * 0.5, { col: mixc(p.col, (p.a || 0.4) * a), lit: 0, noSnap: true });
          }
          break;
        }
        case 'chunk': {
          const s = p.size;
          R.sprite(set, rc.dot, p.x - 2 * s, p.y - 2 * s, s, s, { rot: p.rot, col: [p.col[0], p.col[1], p.col[2], Math.min(1, a * 3)], lit: 1, noSnap: true });
          break;
        }
        case 'leaf':
          R.sprite(set, rc[p.name], p.x - 8, p.y - 8, 1.2, 1.2, { rot: p.rot, lit: 1, col: [1, 1, 1, Math.min(1, a * 3)], noSnap: true });
          break;
        case 'puff': {
          const s = (0.9 + u * 1.6) * p.size;
          R.sprite(set, rc.glow, p.x - 32 * s * 0.5, p.y - 32 * s * 0.5, s * 0.5, s * 0.5, { col: mixc(p.col, a * 0.32), lit: 1, noSnap: true });
          break;
        }
        case 'conf': {
          const fl = Math.abs(Math.sin(t * 8 + p.ph));
          R.sprite(set, rc.dot, p.x, p.y, p.size, p.size * (0.3 + fl), { rot: p.rot, col: mixc(p.col, Math.min(1, a * 2)), lit: 0.3, noSnap: true });
          break;
        }
        case 'mote': {
          const bl = p.blink ? 0.4 + 0.6 * Math.sin(t * 2.5 + p.ph * 3) : 1;
          const f = Math.min(1, u * 4, a * 3) * bl, s = p.size * 0.5;
          R.sprite(set, rc.glow, p.x - 32 * s, p.y - 32 * s, s, s, { col: mixc(p.col, (p.a || 0.5) * f), lit: 0, noSnap: true });
          break;
        }
        case 'mist': {
          const f = Math.min(1, u * 3, a * 3);
          R.sprite(set, rc.glow, p.x - 32 * p.size, p.y - 32 * p.size * 0.3, p.size, p.size * 0.3, { col: mixc(p.col, p.a * f), lit: 0, noSnap: true });
          break;
        }
        case 'lantern': {         // lanterna de papel flutuante
          const f = Math.min(1, u * 5, a * 4), s = p.size, fl = 0.85 + 0.15 * Math.sin(t * 6 + p.ph);
          R.sprite(set, rc.glow, p.x - 32 * s * 1.1, p.y - 32 * s * 1.1, s * 1.1, s * 1.1, { col: mixc(p.col, 0.3 * f * fl), lit: 0, noSnap: true });
          R.sprite(set, rc.dot, p.x - 5 * s, p.y - 6 * s, 2.5 * s, 3 * s, { col: mixc(p.col, 0.75 * f), lit: 0, noSnap: true });
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------ pássaros / morcegos (silhuetas distantes) */
  let birds = null;
  function initBirds(G) {
    const night = G.mood.id === 'horaazul' || G.mood.id === 'noite';
    birds = [];
    const n = G.mood.id === 'mata' ? 2 : 4;
    for (let i = 0; i < n; i++) birds.push({ x: Math.random() * 3000, y: rnd(40, 190), sp: rnd(22, 48) * (night ? 1.3 : 1), ph: rnd(0, 6), bat: night, sz: rnd(0.8, 1.3) });
  }
  function drawBirds(t, cam) {
    const g = API(), G = g.G, R = g.R, m = G.mood; if (!m) return;
    if (!birds) initBirds(G);
    const set = g.atlas.set, rc = g.rects;
    const dark = m.fDark.map((v) => v * 0.35);
    for (const b of birds) {
      // parallax distante: x na tela
      const span = 3400;
      const sx = ((b.x + t * b.sp - cam * 0.12) % span + span) % span - 200;
      if (sx < -40 || sx > 1000) continue;
      const x = cam + sx, y = b.y + Math.sin(t * 0.6 + b.ph) * 14;
      const flap = Math.sin(t * (b.bat ? 11 : 7) + b.ph) * (b.bat ? 0.7 : 0.55);
      const L = (b.bat ? 9 : 8) * b.sz;
      for (const sgn of [-1, 1]) {
        // asa sem rotação (a rotação aqui corrompia o lote e gerava um polígono preto): inclinação faz o bater de asa
        const hw = L / 2, lift = (0.3 + flap) * hw * 0.6;
        R.sprite(set, rc.dot, sgn > 0 ? x : x - hw, y - 1.2, hw / 4, 0.6, { shear: sgn * -lift, col: [dark[0], dark[1], dark[2], 0.85], lit: 0, noSnap: true });
      }
    }
  }

  /* ------------------------------------------------------------ moldura: cipós e raízes pendurados nas bordas */
  function drawVines(t, cam) {
    const g = API(), G = g.G, R = g.R, m = G.mood; if (!m) return;
    const set = g.atlas.set, rc = g.rects, PAR = 1.32, PERIOD = 1500;
    const dk = m.fDark.map((v) => v * 0.2), lt = m.fLight.map((v) => v * 0.5);
    const nseg = g.quality > 1 ? 7 : 11;
    for (let i = 0; i < 7; i++) {
      const seed = RC.hash2(i, 31, G.lv.index || 0);
      const base = i * (PERIOD / 7) + seed * 80;
      const sx = ((base - cam * (PAR - 1)) % PERIOD + PERIOD) % PERIOD - 200;      // tela
      if (sx < -60 || sx > 1020) continue;
      // concentra nas bordas laterais: afasta o miolo da tela
      const edge = sx < 200 || sx > 760;
      if (!edge && seed < 0.55) continue;
      const len = (edge ? 120 : 70) + seed * 120;
      const seg = len / nseg;
      let px = cam + sx, py = -6;
      const ph = seed * 10;
      for (let k = 0; k < nseg; k++) {
        const kk = k / nseg;
        const ang = Math.PI / 2 + Math.sin(t * 0.8 + ph + k * 0.35) * 0.09 * kk + Math.sin(t * 0.3 + ph) * 0.05;
        const nx = px + Math.cos(ang) * seg, ny = py + Math.sin(ang) * seg;
        const th = 5 * (1 - kk * 0.55);
        R.sprite(set, rc.dot, px, py - th / 2, (seg + 1) / 4, th / 4, { rot: ang, px: 0, py: th / 2, col: [dk[0], dk[1], dk[2], 0.95], lit: 0.2, noSnap: true });
        if (k % 2 === 1) {
          const ls = 0.7 + (1 - kk) * 0.4, side = k % 4 === 1 ? 1 : -1;
          R.sprite(set, rc.leaf_0, nx - 8, ny - 8, ls * side, ls, { rot: ang * 0.3 + side * 0.9 + Math.sin(t * 1.3 + k + ph) * 0.12, col: [lt[0] * 0.8, lt[1] * 0.9, lt[2] * 0.8, 0.95], lit: 0.4, noSnap: true });
        }
        px = nx; py = ny;
      }
    }
  }

  /* ------------------------------------------------------------ luz de contorno do jogador + luzes extras */
  function drawRim(t) {
    const g = API(), G = g.G, R = g.R, m = G.mood, p = g.player; if (!m || G.state === 'title') return;
    const set = g.atlas.set, rc = g.rects;
    const side = m.sunPos[0] > 0.5 ? 1 : -1;                 // lado de onde vem a luz
    const cx = p.x + p.w / 2 + side * 7, cy = p.y + p.h * 0.45;
    const k = 0.1 + 0.09 * (m.lanternK || 0);
    const c = Array.isArray(m.sunCol) ? m.sunCol : [1, 0.8, 0.5];
    R.sprite(set, rc.glow, cx - 32 * 0.42, cy - 32 * 0.9, 0.42, 0.9, { col: [Math.min(1, c[0] * 0.9 + 0.1), Math.min(1, c[1] * 0.9 + 0.1), Math.min(1, c[2] * 0.9 + 0.1), k], lit: 0, noSnap: true });
  }

  function drawGlowShrooms(t, cam) {
    // brilho aditivo suave extra em cogumelos/props luminosos, se houver (props.js registra G.props com glow)
    const G = API().G, R = API().R, set = API().atlas.set, rc = API().rects;
    const list = G.props; if (!list || !list.length) return;
    for (const pr of list) {
      if (!pr.glow || pr.x < cam - 60 || pr.x > cam + 1020) continue;
      const s = (pr.glowR || 40) / 32 * (0.9 + 0.1 * Math.sin(t * 2 + pr.x));
      R.sprite(set, rc.glow, pr.x - 32 * s, pr.y - 32 * s, s, s, { col: [...(pr.glowCol || [0.5, 1, 0.9]), 0.28], lit: 0, noSnap: true });
    }
  }

  const SK = (k) => RC.fxSkip && RC.fxSkip[k];
  EV.on('drawBehind', (t, cam) => { if (!SK('birds')) drawBirds(t, cam); });
  EV.on('drawFront', (t, cam) => { if (!SK('rim')) drawRim(t); drawParts(false, t, cam); if (!SK('vines')) drawVines(t, cam); });
  EV.on('drawAdd', (t, cam) => { drawParts(true, t, cam); drawGlowShrooms(t, cam); });
})();
