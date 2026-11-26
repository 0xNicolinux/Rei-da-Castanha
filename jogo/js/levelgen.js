/* Rei da Castanha — gerador procedural de fases.

   Método: "rhythm groups" (Smith et al., 2009; Launchpad/Tanagra) sobre uma grade de tiles.
   A fase é uma sequência de segmentos (corrida, degrau, fosso, pedras flutuantes, escada de
   galhos, pátio de inimigos...). Cada segmento só usa distâncias de pulo calculadas a partir da
   física real do jogador (PHYS), com folga de segurança. Depois, um validador percorre o grafo
   de superfícies e confirma que existe caminho do início ao caminhão — sem depender de sorte. */
(function (root) {
  'use strict';
  const RC = root.RC = root.RC || {};
  if (!RC.mulberry32) throw new Error('util.js precisa ser carregado antes de levelgen.js');

  const T = 32;                 // tamanho do tile em unidades de mundo
  const ROW_MIN = 9, ROW_MAX = 14;
  const WORLD_H = 540;

  const PHYS = RC.PHYS = {
    GRAV: 1500, FALL_MULT: 1.35, JUMP_V: 600, CUT_V: 230, MAXFALL: 840,
    RUN: 270, ACC_G: 2500, ACC_A: 1650, FRIC_G: 2800, FRIC_A: 600,
    COYOTE: 0.09, BUFFER: 0.12, STOMP_V: 470, W: 26, H: 38
  };
  const APEX = (PHYS.JUMP_V * PHYS.JUMP_V) / (2 * PHYS.GRAV);           // 120
  const HALF_G2 = 0.5 * PHYS.GRAV * PHYS.FALL_MULT;

  /* Distância horizontal máxima de um pulo entre duas bordas, com rise>0 = destino mais alto. */
  function gapLimit(rise, safety) {
    const tUp = PHYS.JUMP_V / PHYS.GRAV;
    const k = Math.max(0, APEX - 2 - rise) / HALF_G2;
    return safety * PHYS.RUN * (tUp + Math.sqrt(k));
  }
  const designGap = (rise) => gapLimit(rise, 0.70);   // usado na geração
  const hardGap = (rise) => gapLimit(rise, 0.92);     // usado na validação

  const NAMES = ['A Toca ao Amanhecer', 'Mata Fechada', 'Entardecer no Cipoal', 'Hora Azul', 'Festival Sob a Lua'];

  /* Assinatura estrutural de cada ambiente: multiplicadores dos pesos de segmento, fator de
     inimigos e quais peças formam o set piece (meio da fase) e o clímax (perto do caminhão). */
  const SIG = [
    { id: 'amanhecer', w: { flat: 1.3, step: 1, hill: 1.4, pit: 0.7, stones: 0.5, ladder: 1.2, tower: 0, yard: 0.4, gauntlet: 0 },
      foe: 0.7, setpiece: 'staircase', climax: ['yard', 'ladder'], pitLong: false },
    { id: 'mata', w: { flat: 0.8, step: 1.2, hill: 1.6, pit: 0.8, stones: 0.8, ladder: 2.2, tower: 1.4, yard: 0.5, gauntlet: 0 },
      foe: 0.9, setpiece: 'tower', climax: ['tower', 'yard'], pitLong: false },
    { id: 'entardecer', w: { flat: 0.8, step: 0.8, hill: 0.8, pit: 1.4, stones: 1.5, ladder: 0.8, tower: 0.3, yard: 1.0, gauntlet: 0 },
      foe: 1.0, setpiece: 'chasm', climax: ['chasm', 'pit'], pitLong: true },
    { id: 'hora_azul', w: { flat: 0.7, step: 0.8, hill: 0.8, pit: 1, stones: 0.8, ladder: 1, tower: 0.2, yard: 2.2, gauntlet: 1.2 },
      foe: 1.35, setpiece: 'gauntlet', climax: ['gauntlet', 'gauntlet'], pitLong: false },
    { id: 'festival', w: { flat: 0.8, step: 1, hill: 1, pit: 1.4, stones: 1.4, ladder: 1.2, tower: 0.8, yard: 1.2, gauntlet: 0.8 },
      foe: 1.15, setpiece: 'arena', climax: ['stones', 'gauntlet', 'gauntlet'], pitLong: true }
  ];

  function generate(seed, index) {
    const rnd = RC.mulberry32((seed * 7919 + index * 104729 + 12345) >>> 0);
    const d = Math.min(1.15, index / 4);
    const sig = SIG[index % SIG.length];
    const targetCols = 200 + index * 20;
    const zones = [], landmarks = [], secrets = [];
    let phase = 'intro';
    const ground = [];
    const platforms = [];
    const nuts = [];
    const enemies = [];
    const checkpoints = [];
    let gr = 13;
    let lastCheck = 0;

    const rr = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const gy = (row) => row * T;
    const clampRow = (r) => Math.max(ROW_MIN, Math.min(ROW_MAX, r));

    function addGround(n, row) { const c0 = ground.length; for (let i = 0; i < n; i++) ground.push(row); return c0; }
    function addPit(n) { const c0 = ground.length; for (let i = 0; i < n; i++) ground.push(-1); return c0; }
    let optNuts = false;      // acorns de rotas altas opcionais não contam para a meta
    function nut(x, y, golden) { nuts.push({ x: Math.round(x), y: Math.round(y), golden: !!golden, opt: optNuts }); }

    /* Acorns seguindo exatamente a trajetória de um pulo: ensina o jogador por onde ir. */
    function arc(x0, feetY, count, speed) {
      const vx = speed || 205;
      const tTotal = 0.4 + Math.sqrt((APEX + 40) / HALF_G2);
      for (let i = 0; i < count; i++) {
        const t = (tTotal * (i + 1)) / (count + 1);
        const y = t <= 0.4 ? PHYS.JUMP_V * t - 0.5 * PHYS.GRAV * t * t
                           : APEX - HALF_G2 * (t - 0.4) * (t - 0.4);
        nut(x0 + vx * t, feetY - 22 - y * 0.92, false);
      }
    }

    function pickType() {
      return d < 0.25 ? pick(['ant', 'ant', 'hopper'])
        : d < 0.6 ? pick(['ant', 'hopper', 'hopper', 'gator']) : pick(['ant', 'hopper', 'gator', 'gator']);
    }
    function mkEnemy(c0, c1, y, kind, key) {
      const type = kind || pickType();
      const speed = type === 'ant' ? rr(78, 105) : type === 'hopper' ? rr(52, 70) : rr(38, 52);
      return { type, left: (c0 + 0.5) * T, right: (c1 - 0.5) * T, y, speed: Math.round(speed * (1 + d * 0.15)), key: !!key };
    }
    function enemyOn(c0, c1, y, kind, key) {
      enemies.push(mkEnemy(c0, c1, y, kind, key || phase === 'setpiece' || phase === 'climax'));
    }

    /* ---------- segmentos ---------- */
    function segFlat(n, o) {
      o = o || {};
      const c0 = addGround(n, gr), y = gy(gr);
      if (!o.noNuts && rnd() < 0.85) {
        const k = Math.max(2, Math.floor((n - 2) / 1.5));
        for (let i = 0; i < k; i++) nut((c0 + 1.5 + i * 1.5) * T, y - 24, false);
      }
      if (!o.noEnemy && phase !== 'intro' && n >= 7 && rnd() < (0.32 + 0.4 * d) * sig.foe) enemyOn(c0 + 2, c0 + n - 1, y);
    }

    function segStep() {
      const up = rnd() < (gr > 12 ? 0.72 : gr < 11 ? 0.25 : 0.5);
      const k = rr(1, 2);
      const prevRow = gr;
      if (up && gr - k >= ROW_MIN) gr -= k;
      else if (gr + k <= ROW_MAX) gr += rr(1, 3) > 0 ? Math.min(k + rr(0, 1), ROW_MAX - gr) : k;
      else return segFlat(rr(4, 6));
      if (gr < prevRow) arc((ground.length - 1) * T, gy(prevRow), 3, 170);
      segFlat(rr(4, 7));
    }

    function segPit() {
      const gr2 = clampRow(gr + pick([-1, 0, 0, 1]));
      const rise = (gr - gr2) * T;
      const maxN = Math.max(2, Math.floor(designGap(rise) / T));
      const n = phase === 'intro' ? 2 : sig.pitLong && d > 0.2 ? Math.min(maxN, rr(Math.max(2, maxN - 1), maxN)) : Math.min(maxN, rr(2, 2 + Math.ceil(2 * d)));
      arc(ground.length * T - 6, gy(gr), 3 + (n > 3 ? 1 : 0), 200);
      addPit(n);
      gr = gr2;
      segFlat(rr(3, 5), { noEnemy: true });
    }

    /* Pedras flutuantes sobre um abismo: sequência de plataformas pequenas. */
    function segStones(minCount, opts) {
      opts = opts || {};
      let col = ground.length;       // primeira coluna do abismo
      let curTop = gy(gr);
      let placed = 0;
      const start = col;
      const local = [];
      let guard = 0;
      while (guard++ < 40) {
        if (placed >= minCount) {
          const gr2 = clampRow(gr + pick([-1, 0, 0, 1]));
          let rise = curTop - gy(gr2);
          let landRow = gr2;
          if (rise > 64) { landRow = clampRow(Math.round(curTop / T) + 1); rise = curTop - gy(landRow); }
          const gmax = Math.max(1, Math.floor(designGap(rise) / T));
          if (gmax >= 2 || placed > 0) {
            const g = rr(Math.max(1, gmax - 1), gmax);
            col += g;
            const n = col - start;
            for (let i = 0; i < n; i++) ground.push(-1);
            gr = landRow;
            break;
          }
        }
        let pw = opts.long ? pick([2, 2, 3]) : d < 0.5 ? pick([3, 3, 4]) : pick([2, 3, 3]);
        let newY = curTop + pick([-48, -32, -16, 0, 0, 16, 32]);
        newY = Math.max(176, Math.min(gy(ROW_MAX) - 0, newY));
        newY = Math.round(newY / 16) * 16;
        const rise = curTop - newY;
        // pouso mais alto sobre abismo: galho de 2 tiles só aceitava toque curto no pulo; 3 tiles perdoa segurar o botão
        if (rise > 0) pw = Math.max(pw, 3);
        const gmax = Math.max(2, Math.floor(designGap(rise) / T));
        const g = opts.long ? rr(Math.max(2, gmax - 1), gmax) : rr(2, gmax);
        const pcol = col + g;
        local.push({ x: pcol * T, y: newY, w: pw * T });
        arc(col * T - 4, curTop, 2, 190);
        nut((pcol + pw / 2) * T, newY - 26, opts.long && placed === Math.floor(minCount / 2) && minCount >= 3);
        col = pcol + pw;
        curTop = newY;
        placed++;
      }
      platforms.push(...local.map((p) => Object.assign(p, { kind: 'branch' })));
      if (opts.long) landmarks.push({ type: 'chasm', x: (start + (col - start) / 2) * T, y: gy(gr), w: (col - start) * T });
      segFlat(rr(3, 5), { noEnemy: true });
    }

    /* Escada de galhos sobre o chão: rota alta opcional, com bônus; embaixo, inimigos. */
    function segLadder(o) {
      o = o || {};
      const steps = rr(2, 3 + Math.floor(d * 1.6));
      const rel = [];                 // plataformas relativas à coluna inicial
      let colRel = 2;
      let top = gy(gr) - rr(2, 4) * 16;          // sobe 32..64
      rel.push({ c: colRel, y: top, w: 3 });
      colRel += 3;
      let goingUp = true;
      for (let i = 1; i < steps * 2 - 1; i++) {
        let ny;
        if (goingUp) { ny = top - pick([32, 48, 64]); if (ny < 176) { ny = top; goingUp = false; } if (i >= steps) goingUp = false; }
        else ny = Math.min(gy(gr) - 32, top + pick([32, 48, 64]));
        if (!goingUp && ny >= gy(gr) - 40) break;
        const rise = top - ny;
        const gmax = Math.max(1, Math.floor(designGap(rise) / T));
        const g = rr(1, gmax);
        colRel += g;
        rel.push({ c: colRel, y: ny, w: pick([3, 3, 4]) });
        colRel += rel[rel.length - 1].w;
        top = ny;
      }
      const n = colRel + 3;
      const c0 = addGround(n, gr);
      const y0 = gy(gr);
      let best = null;
      for (const p of rel) {
        platforms.push({ x: (c0 + p.c) * T, y: p.y, w: p.w * T, kind: 'branch' });
        optNuts = true;
        for (let i = 0; i < p.w - 1; i++) nut((c0 + p.c + 0.7 + i) * T, p.y - 26, false);
        optNuts = false;
        if (!best || p.y < best.y) best = p;
      }
      optNuts = true; nut((c0 + best.c + best.w / 2) * T, best.y - 30, true); optNuts = false;
      secrets.push({ type: 'galho_alto', x: (c0 + best.c) * T, y: best.y, w: best.w * T });
      // chão: inimigos embaixo e acorns de recompensa
      if (n >= 9 && !o.noEnemy) enemyOn(c0 + 1, c0 + n - 1, y0);
      if (n >= 18 && d > 0.4 && !o.noEnemy) enemyOn(c0 + 9, c0 + n - 1, y0);
    }

    /* Pátio: chão plano com 2–3 inimigos e uma plataforma segura por cima. */
    function segYard() {
      const n = rr(11, 15);
      const c0 = addGround(n, gr), y = gy(gr);
      const cnt = (d < 0.4 ? 2 : 3) + (sig.foe > 1.2 && d > 0.4 ? 1 : 0);
      for (let i = 0; i < cnt; i++) {
        const a = c0 + 1 + Math.floor((i * (n - 2)) / cnt);
        const b = c0 + 1 + Math.floor(((i + 1) * (n - 2)) / cnt);
        if (b - a >= 4) enemyOn(a, b, y);
      }
      const pc = c0 + Math.floor(n / 2) - 1;
      platforms.push({ x: pc * T, y: y - 64, w: 3 * T, kind: 'branch' });
      nut((pc + 1.5) * T, y - 64 - 26, false);
      for (let i = 0; i < 4; i++) nut((c0 + 2 + i * 2.2) * T, y - 24, false);
    }

    /* Colina: sobe um degrau largo; em fases mais abertas ganha um nicho (galho curto
       com castanha dourada) logo acima do topo — rota alta opcional. */
    function segHill() {
      const k = 2;
      if (gr - k < ROW_MIN) return segFlat(5);
      arc((ground.length - 1) * T, gy(gr), 3, 160);
      gr -= k;
      const c0 = addGround(rr(4, 6), gr);
      nut((ground.length - 2) * T, gy(gr) - 26, false);
      if (phase !== 'intro' && gy(gr) - 80 >= 176 && rnd() < 0.45) {
        const w = 2;
        platforms.push({ x: (c0 + 1) * T, y: gy(gr) - 80, w: w * T, kind: 'branch' });
        optNuts = true; nut((c0 + 2) * T, gy(gr) - 80 - 28, true); optNuts = false;
        secrets.push({ type: 'nicho', x: (c0 + 1) * T, y: gy(gr) - 80, w: w * T });
      }
      gr += k;
      segFlat(rr(4, 6));
    }

    /* Torre: subida de galhos até a copa, com uma travessia alta e (às vezes) um nicho escondido
       com dourada; desce do outro lado. O chão embaixo segue livre (rota principal). */
    function segTower(o) {
      o = o || {};
      const base = gy(gr);
      const ups = rr(3, 4);
      const rel = [];
      let c = 2, y = base - 48;
      for (let i = 0; i < ups; i++) {
        rel.push({ c, y, w: 3 });
        const ny = Math.max(208, y - pick([48, 64]));
        const gmax = Math.max(1, Math.floor(designGap(y - ny) / T));
        c += 3 + rr(1, Math.min(2, gmax));
        y = ny;
      }
      const top = { c, y, w: rr(4, 6) };
      rel.push(top);
      c += top.w;
      // travessia alta: mais uma ou duas pedras na copa
      let cy = y;
      const cross = 1;
      for (let i = 0; i < cross; i++) {
        const ny = Math.max(208, cy + pick([-16, 0, 16]));
        const gmax = Math.max(2, Math.floor(designGap(cy - ny) / T));
        c += rr(2, Math.min(3, gmax));
        rel.push({ c, y: ny, w: 3 });
        c += 3; cy = ny;
      }
      // descida
      while (cy < base - 64) {
        const ny = Math.min(base - 48, cy + pick([48, 64, 80]));
        c += rr(1, 2);
        rel.push({ c, y: ny, w: 3 });
        c += 3; cy = ny;
      }
      const n = c + 3;
      const c0 = addGround(n, gr);
      optNuts = true;
      for (const p of rel) {
        platforms.push({ x: (c0 + p.c) * T, y: p.y, w: p.w * T, kind: 'branch' });
        for (let i = 0; i < p.w - 1; i++) nut((c0 + p.c + 0.7 + i) * T, p.y - 26, false);
      }
      nut((c0 + top.c + top.w / 2) * T, top.y - 30, true);
      // nicho escondido acima da copa
      if (o.alcove !== false && top.y - 48 >= 150) {
        const ax = top.c + top.w + 1;       // colado à travessia seguinte (entre pedras)
        const ay = top.y - 48;
        platforms.push({ x: (c0 + top.c + top.w - 1) * T, y: ay, w: 2 * T, kind: 'branch' });
        nut((c0 + top.c + top.w) * T, ay - 28, true);
        nut((c0 + top.c + top.w + 1) * T, ay - 28, true);
        secrets.push({ type: 'nicho_copa', x: (c0 + top.c + top.w - 1) * T, y: ay, w: 2 * T });
      }
      optNuts = false;
      landmarks.push({ type: 'torre', x: (c0 + top.c + top.w / 2) * T, y: top.y, base: base, w: n * T });
      if (!o.noEnemy && n >= 12) enemyOn(c0 + 1, c0 + n - 1, base);
      for (let i = 0; i < 4; i++) nut((c0 + 2 + i * 2.5) * T, base - 24, false);
    }

    /* Corredor de ondas (Metal Slug): várias baias de inimigos em sequência, ondas crescentes,
       com uma passarela alta de recompensa por cima como alternativa. */
    function segGauntlet(waves) {
      const w0 = Math.max(2, Math.min(waves, 5));
      const n = 5 + w0 * 6;
      const c0 = addGround(n, gr), y = gy(gr);
      const pens = [];
      for (let i = 0; i < w0; i++) {
        const a = c0 + 3 + i * 6, b = Math.min(c0 + n - 1, a + 6);
        pens.push([a, b]);
        const hard = i >= w0 - 1 && d > 0.3;
        enemyOn(a, b, y, i === 0 ? 'ant' : hard ? 'gator' : undefined);
        if (i >= 2 && d > 0.5 && b - a >= 6) enemyOn(a + 1, b, y, 'hopper');
      }
      // passarela alta sobre as baias
      optNuts = true;
      for (let i = 1; i < w0; i += 2) {
        const pc = c0 + 3 + i * 6 - 1;
        platforms.push({ x: pc * T, y: y - 80, w: 4 * T, kind: 'branch' });
        for (let k = 0; k < 3; k++) nut((pc + 0.8 + k) * T, y - 80 - 26, false);
      }
      optNuts = false;
      for (let i = 0; i < 3; i++) nut((c0 + 1 + i * 0.9) * T, y - 24, false);
      nut((c0 + n - 2) * T, y - 24, false);
      landmarks.push({ type: 'portal_ondas', x: c0 * T, y, w: n * T, waves: w0 });
    }

    function segCheckpoint(kind) {
      const c0 = addGround(kind ? 9 : 6, gr);
      checkpoints.push({ x: (c0 + (kind ? 4 : 3)) * T, y: gy(gr) });
      lastCheck = ground.length;
      if (kind) {
        landmarks.push({ type: 'santuario', x: (c0 + 4) * T, y: gy(gr) });
        for (let i = 0; i < 3; i++) nut((c0 + 6 + i * 1.2) * T, gy(gr) - 24, false);
      }
    }

    function segTeach() {            // primeiro inimigo: sozinho, em chão largo e plano
      const c0 = addGround(11, gr), y = gy(gr);
      enemyOn(c0 + 4, c0 + 10, y, 'ant', true);
      for (let i = 0; i < 4; i++) nut((c0 + 1 + i * 1.3) * T, y - 24, false);
    }

    /* ---------- composição: intro → desenvolvimento → set piece → respiro → clímax ---------- */
    function weightsTable() {
      const W = sig.w;
      const t = [['flat', 2.2 * W.flat], ['step', 2 * W.step], ['hill', 1.4 * W.hill],
        ['pit', (1.8 + 2 * d) * W.pit], ['stones', (1.4 + 2.2 * d) * W.stones],
        ['ladder', 1.6 * W.ladder], ['tower', 1.0 * W.tower], ['yard', (0.8 + 1.4 * d) * W.yard],
        ['gauntlet', (0.5 + 1.0 * d) * W.gauntlet]];
      if (phase === 'intro') return t.filter(([k]) => k === 'flat' || k === 'step' || k === 'hill' || k === 'pit' || k === 'ladder');
      return t;
    }
    let lastKind = 'flat';
    function runKind(kind) {
      const intro = phase === 'intro';
      if (kind === 'flat') segFlat(rr(5, 9));
      else if (kind === 'step') segStep();
      else if (kind === 'hill') segHill();
      else if (kind === 'pit') segPit();
      else if (kind === 'stones') segStones(rr(1, 2 + Math.floor(d * 3)), { long: sig.pitLong && d > 0.2 });
      else if (kind === 'ladder') segLadder({ noEnemy: intro });
      else if (kind === 'tower') segTower({ noEnemy: intro });
      else if (kind === 'yard') segYard();
      else if (kind === 'gauntlet') segGauntlet(2 + Math.round(d * 2));
      lastKind = kind;
    }
    function wander(untilCol) {
      let guard = 0;
      while (ground.length < untilCol && guard++ < 200) {
        if (ground.length - lastCheck > 40) { segCheckpoint(); lastKind = 'flat'; continue; }
        const table = weightsTable().filter(([k, w]) => w > 0 && !((k === 'pit' || k === 'stones') && (lastKind === 'pit' || lastKind === 'stones')));
        let total = 0; for (const [, w] of table) total += w;
        let r = rnd() * total, kind = 'flat';
        for (const [k, w] of table) { if ((r -= w) <= 0) { kind = k; break; } }
        runKind(kind);
        // varia o relevo depois de peças grandes: a fase nunca fica uma planície
        if (kind !== 'step' && kind !== 'hill' && kind !== 'pit' && kind !== 'stones' && rnd() < 0.6) { if (rnd() < 0.5) segStep(); else segHill(); }
      }
    }
    function zone(type, fn) { const c0 = ground.length; fn(); zones.push({ type, x0: c0 * T, x1: ground.length * T }); }
    function setPiece(kind) {
      if (kind === 'staircase') { segLadder(); segFlat(4, { noEnemy: true }); segTower({ alcove: false }); }
      else if (kind === 'tower') { segTower(); segStep(); segTower({ noEnemy: true }); }
      else if (kind === 'chasm') { segStones(3 + Math.round(d * 2), { long: true }); segFlat(3, { noEnemy: true }); segPit(); }
      else if (kind === 'gauntlet') segGauntlet(3 + Math.round(d));
      else if (kind === 'arena') { segYard(); segStones(3, { long: true }); segGauntlet(3); }
    }
    function climaxPiece(kind) {
      if (kind === 'yard') segYard();
      else if (kind === 'ladder') segLadder();
      else if (kind === 'tower') segTower();
      else if (kind === 'chasm') segStones(3 + Math.round(d * 2), { long: true });
      else if (kind === 'pit') segPit();
      else if (kind === 'stones') segStones(2 + Math.round(d * 2), { long: true });
      else if (kind === 'gauntlet') segGauntlet(2 + Math.round(d * 3));
    }

    segFlat(12, { noEnemy: true });
    const spawnCol = 3;
    zone('intro', () => {
      wander(Math.round(targetCols * 0.2));
      segFlat(3, { noEnemy: true });
      if (index === 0 || d < 0.6) segTeach();
    });
    phase = 'develop';
    zone('desenvolvimento', () => wander(Math.round(targetCols * 0.42)));
    phase = 'setpiece';
    zone('setpiece', () => { segFlat(4, { noEnemy: true }); setPiece(sig.setpiece); segFlat(3, { noEnemy: true }); });
    phase = 'breather';
    zone('respiro', () => segCheckpoint('shrine'));
    phase = 'develop';
    zone('desenvolvimento2', () => wander(Math.round(targetCols * 0.74)));
    phase = 'breather';
    zone('respiro', () => { segFlat(3, { noEnemy: true }); segCheckpoint('shrine'); });
    phase = 'climax';
    zone('climax', () => {
      for (const k of sig.climax) { segFlat(rr(3, 5), { noEnemy: true }); climaxPiece(k); if (lastKind === 'pit' || k === 'pit') segFlat(2, { noEnemy: true }); }
    });
    // final: terreno plano e área do caminhão
    if (gr !== 13) { gr = gr < 13 ? gr + 1 : gr - 1; }
    const goalCol0 = ground.length + 4;
    zone('chegada', () => { segFlat(4, { noEnemy: true }); addGround(16, gr); });
    const goal = { x: (goalCol0 + 7) * T, y: gy(gr) };
    for (let i = 0; i < 4; i++) nut((goalCol0 + 1 + i * 1.4) * T, gy(gr) - 24, false);
    landmarks.unshift({ type: 'inicio', x: spawnCol * T, y: gy(13) });
    landmarks.push({ type: 'caminhao', x: goal.x, y: goal.y });

    const cols = ground.length;

    /* ---------- pós-processamento: inimigos balanceados ---------- */
    const TARGET = [[6, 9], [8, 11], [6, 9], [12, 16], [14, 18], [15, 19], [16, 20]][Math.min(index, 6)];
    const runOf = (c) => {
      let a = c, b = c; const r = ground[c];
      while (a > 0 && ground[a - 1] === r) a--;
      while (b < cols - 1 && ground[b + 1] === r) b++;
      return [a, b];
    };
    const badZones = zones.filter((z) => z.type === 'intro' || z.type === 'respiro' || z.type === 'chegada');
    const nearStartGoal = (l, r) => l < start0.x + 11 * T || r > goal.x - 6 * T;
    const nearCp = (l, r) => checkpoints.some((c) => c.x > l - 5 * T && c.x < r + 5 * T);
    const inBad = (l, r) => badZones.some((z) => l < z.x1 && r > z.x0);
    const accepted = [];
    const overlaps = (l, r, gap) => accepted.some((e) => l < e.right + gap && r > e.left - gap);
    function fit(e, isKey) {
      const c = Math.floor(((e.left + e.right) / 2) / T);
      if (c < 0 || c >= cols || ground[c] < 0 || ground[c] * T !== e.y) return null;
      const [a, b] = runOf(c);
      const l = Math.max(e.left, (a + 2) * T), r = Math.min(e.right, (b - 1) * T);
      if (r - l < 3 * T) return null;
      if (nearStartGoal(l, r) || nearCp(l, r)) return null;
      if (!isKey && inBad(l, r)) return null;
      if (overlaps(l, r, 1.2 * T)) return null;
      return Object.assign({}, e, { left: l, right: r });
    }
    const start0 = { x: spawnCol * T };
    let cand = enemies.slice();
    enemies.length = 0;
    for (const e of cand) { const f = fit(e, e.key); if (f) accepted.push(f); }
    const want = rr(TARGET[0], TARGET[1]);
    // excesso: remove não-chave aleatórios, depois chave
    while (accepted.length > want) {
      const nk = accepted.map((e, i) => i).filter((i) => !accepted[i].key);
      const pool = nk.length ? nk : accepted.map((e, i) => i);
      accepted.splice(pool[Math.floor(rnd() * pool.length)], 1);
    }
    // falta: preenche trechos largos de chão plano
    if (accepted.length < want) {
      const runs = [];
      for (let c = 0; c < cols;) {
        if (ground[c] < 0) { c++; continue; }
        const [a, b] = runOf(c); runs.push([a, b]); c = b + 1;
      }
      for (let i = runs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = runs[i]; runs[i] = runs[j]; runs[j] = t; }
      for (const gap of [4, 2.2, 1.2]) {
        for (const [a, b] of runs) {
          if (accepted.length >= want) break;
          if (b - a + 1 < (gap < 2 ? 7 : 9)) continue;
          for (let tries = 0; tries < 10 && accepted.length < want; tries++) {
            const innerL = a + 2, innerR = b - 1;      // colunas [innerL, innerR)
            const w = Math.min(innerR - innerL, rr(gap < 2 ? 3 : 4, 6));
            const c0 = innerL + Math.floor(rnd() * (innerR - innerL - w + 1));
            const e = mkEnemy(c0, c0 + w, ground[a] * T, undefined, false);
            if (nearStartGoal(e.left, e.right) || nearCp(e.left, e.right) || inBad(e.left, e.right) || overlaps(e.left, e.right, gap * T)) continue;
            accepted.push(e);
          }
        }
        if (accepted.length >= want) break;
      }
    }
    accepted.sort((p, q) => p.left - q.left);
    for (const e of accepted) { delete e.key; enemies.push(e); }

    /* ---------- props interativos (bônus; nunca exigidos pelo caminho principal) ---------- */
    const props = [];
    const lanterns = [];
    const platClear = (x0, x1, yTop, yBot) => !platforms.some((p) => p.x < x1 && p.x + p.w > x0 && p.y > yTop && p.y < yBot);
    const enemyNear = (x0, x1) => enemies.some((e) => e.left < x1 + 2 * T && e.right > x0 - 2 * T);
    const cpNear = (x0, x1) => checkpoints.some((c) => c.x > x0 - 3 * T && c.x < x1 + 3 * T);
    const freeSpot = (x0, x1) => !enemyNear(x0, x1) && !cpNear(x0, x1) && x0 > start0.x + 8 * T && x1 < goal.x - 8 * T
      && !props.some((q) => q.x > x0 - 2 * T && q.x < x1 + 2 * T);
    const runs = [];
    for (let c = 0; c < cols;) { if (ground[c] < 0) { c++; continue; } const [ra, rb] = runOf(c); runs.push([ra, rb]); c = rb + 1; }
    const shuffled = runs.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
    // molas: cogumelo-trampolim que leva a uma plataforma secreta alta com castanhas douradas
    const wantSprings = index === 1 ? 3 : 1 + (index >= 3 ? 1 : 0);
    let springs = 0;
    for (const [ra, rb] of shuffled) {
      if (springs >= wantSprings) break;
      if (rb - ra + 1 < 10 || ground[ra] < 11) continue;
      const sx = (ra + 2) * T + 16;
      const px = (ra + 5) * T, pw = 4 * T, py = ground[ra] * T - 190;
      if (py < 150 || px + pw > (rb - 1) * T) continue;
      if (!freeSpot(sx - 16, px + pw)) continue;
      if (!platClear(sx - 2 * T, px + pw + 2 * T, py - 90, py + 60)) continue;
      props.push({ type: 'spring', x: sx, y: ground[ra] * T });
      platforms.push({ x: px, y: py, w: pw, kind: 'branch', bonus: true });
      optNuts = true;
      nut(px + T * 1.2, py - 28, true); nut(px + T * 2.6, py - 28, false);
      nut(sx + 30, ground[ra] * T - 130, false);          // trilha de arco no ar
      optNuts = false;
      secrets.push({ type: 'mola', x: px, y: py, w: pw });
      springs++;
    }
    // caixotes quebráveis (soco ou pisão) em trechos planos, com 3 castanhas dentro
    const wantCrates = 3 + Math.min(2, index);
    let crates = 0;
    for (const [ra, rb] of shuffled.concat(shuffled)) {
      if (rb - ra + 1 < (crates ? 7 : 5)) continue;
      for (let tries = 0; tries < 8 && crates < wantCrates; tries++) {
        const cx = (ra + 2 + Math.floor(rnd() * Math.max(1, rb - ra - 3))) * T + 16;
        if (!freeSpot(cx - 16, cx + 16)) continue;
        if (!platClear(cx - 40, cx + 40, ground[ra] * T - 70, ground[ra] * T)) continue;
        props.push({ type: 'crate', x: cx, y: ground[ra] * T, golden: crates === 0 && index >= 2 });
        crates++;
      }
    }
    // festival (e hora azul): lanternas penduradas sobre as plataformas
    if (index % NAMES.length >= 3) {
      for (const p of platforms) if (!p.bonus && rnd() < (index % NAMES.length === 4 ? 0.7 : 0.35)) {
        lanterns.push({ x: p.x + p.w * (rnd() < 0.5 ? 0.15 : 0.85), y: p.y, len: 36 + Math.floor(rnd() * 24), hue: Math.floor(rnd() * 3) });
      }
    }
    props.sort((p, q) => p.x - q.x);

    // acorns: limpeza (dentro do terreno / dentro de galhos / duplicados / sob caixotes e molas)
    for (let i = nuts.length - 1; i >= 0; i--) {
      const n = nuts[i], c = Math.floor(n.x / T), row = ground[c];
      let bad = c < 0 || c >= cols || (row >= 0 && n.y > row * T - 14);
      if (!bad) bad = platforms.some((p) => n.x > p.x - 4 && n.x < p.x + p.w + 4 && n.y > p.y - 6 && n.y < p.y + 26);
      if (!bad) bad = props.some((q) => Math.abs(q.x - n.x) < 26 && n.y > q.y - 40);
      if (!bad) for (let j = 0; j < i; j++) if (Math.abs(nuts[j].x - n.x) < 14 && Math.abs(nuts[j].y - n.y) < 14) { bad = true; break; }
      if (bad) nuts.splice(i, 1);
    }
    const val = (n) => (n.golden ? 3 : 1);
    const total = nuts.reduce((s, n) => s + val(n), 0);
    const mainTotal = nuts.reduce((s, n) => s + (n.opt ? 0 : val(n)), 0);
    const level = {
      seed, index, mood: index % NAMES.length, name: NAMES[index % NAMES.length] + (index >= NAMES.length ? ' II' : ''),
      cols, width: cols * T, ground, platforms, nuts, enemies, checkpoints,
      start: { x: spawnCol * T, y: gy(13) }, goal, total,
      required: Math.min(Math.ceil(total * 0.5), Math.floor(mainTotal * 0.85)),
      props, lanterns, zones, landmarks, secrets, profile: { sig: sig.id, difficulty: +d.toFixed(2), setpiece: sig.setpiece }
    };
    return level;
  }

  /* ---------- validação ---------- */
  function surfacesOf(level) {
    const s = [];
    let c = 0;
    while (c < level.cols) {
      const row = level.ground[c];
      if (row < 0) { c++; continue; }
      let e = c;
      while (e + 1 < level.cols && level.ground[e + 1] === row) e++;
      s.push({ x0: c * T, x1: (e + 1) * T, y: row * T, kind: 'ground' });
      c = e + 1;
    }
    for (const p of level.platforms) if (!p.bonus) s.push({ x0: p.x, x1: p.x + p.w, y: p.y, kind: 'plat' });
    return s;
  }

  function validate(level) {
    const errs = [];
    const S = surfacesOf(level);
    if (!S.length) return { ok: false, errs: ['sem superfícies'] };
    const reach = (a, b) => {
      const rise = a.y - b.y;
      if (rise > 108) return false;
      const gap = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
      return gap <= (gap === 0 ? 1e9 : hardGap(rise));
    };
    const startS = S.find((s) => level.start.x >= s.x0 && level.start.x < s.x1 && s.kind === 'ground');
    const goalS = S.find((s) => level.goal.x >= s.x0 && level.goal.x < s.x1 && s.kind === 'ground');
    if (!startS || !goalS) errs.push('início/chegada fora do chão');
    else {
      const seen = new Set([startS]);
      const q = [startS];
      while (q.length) {
        const a = q.shift();
        for (const b of S) if (!seen.has(b) && reach(a, b)) { seen.add(b); q.push(b); }
      }
      if (!seen.has(goalS)) errs.push('caminhão inalcançável');
      // todo chão deve ser alcançável também (sem ilhas no caminho principal)
      for (const s of S) if (s.kind === 'ground' && !seen.has(s)) errs.push(`ilha de chão em x=${s.x0}`);
      // rotas altas opcionais também precisam ser completáveis (nada de galho inalcançável)
      for (const s of S) if (s.kind === 'plat' && !seen.has(s)) errs.push(`galho inalcançável em x=${s.x0}`);
    }
    // acorns e inimigos dentro do mundo e fora do terreno
    for (const n of level.nuts) {
      const c = Math.floor(n.x / T);
      if (c < 0 || c >= level.cols) { errs.push('acorn fora do mundo'); continue; }
      const row = level.ground[c];
      if (row >= 0 && n.y > row * T - 6) errs.push(`acorn dentro do chão x=${n.x}`);
      if (n.y < 20) errs.push('acorn alto demais');
    }
    for (const e of level.enemies) {
      const c0 = Math.floor(e.left / T), c1 = Math.floor(e.right / T);
      for (let c = c0; c <= c1; c++) if (level.ground[c] !== e.y / T) { errs.push(`inimigo sem chão x=${e.left}`); break; }
    }
    for (const p of level.platforms) if (p.y < 148 || p.y > 460) errs.push(`plataforma fora da faixa y=${p.y}`);
    return { ok: errs.length === 0, errs };
  }

  function build(seed, index) {
    let lastErr = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const lv = generate(seed + attempt * 977, index);
      const v = validate(lv);
      if (v.ok) { lv.attempts = attempt + 1; lv.seed = seed; lv.genSeed = seed + attempt * 977; return lv; }
      lastErr = v.errs;
    }
    throw new Error('Não foi possível gerar fase válida: ' + (lastErr && lastErr[0]));
  }

  RC.LevelGen = { T, ROW_MIN, ROW_MAX, WORLD_H, NAMES, build, generate, validate, surfacesOf, designGap, hardGap };
  if (typeof module !== 'undefined') module.exports = RC.LevelGen;
})(typeof window !== 'undefined' ? window : globalThis);
