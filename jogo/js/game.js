/* Rei da Castanha — núcleo do jogo: estados, física, inimigos, câmera, render e UI. */
(function () {
  'use strict';
  const RC = window.RC, LG = RC.LevelGen, PH = RC.PHYS;      // LG: fases feitas à mão (js/levels.js)
  const { clamp, lerp } = RC;
  const T = LG.T, WW = 960, WH = 540, S = 2;
  const EV = RC.events;                 // S = tamanho do texel em unidades
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);

  /* ------------------------------------------------------------ estado global */
  const G = {
    state: 'boot', seed: 0, stage: 0, hearts: 3, maxHearts: 5, totalNuts: 0, totalKills: 0,
    time: 0, camX: 0, camTarget: 0, shake: 0, flash: 0, aberr: 0, fade: 0, fadeTarget: 1, hitstop: 0,
    lv: null, mood: null, res: null, nuts: [], enemies: [], decor: [], parts: [], flies: [], cps: [],
    collected: 0, kills: 0, levelTime: 0, nutsForHeart: 0, toastT: 0, mouseX: 0.5, lastCp: null, goalWarn: 0
  };
  const player = {
    x: 0, y: 0, vx: 0, vy: 0, w: PH.W, h: PH.H, grounded: false, facing: 1, coyote: 0, buf: 0, jumpHeld: false,
    invuln: 0, hurtT: 0, sx: 1, sy: 1, animT: 0, jumping: false, landT: 0, dead: false, finishing: false,
    idleT: 0, atk: 0, atkCd: 0, atkBuf: 0, atkId: 0, combo: 0, lastAtkT: -9, lastBeat: -1,
    gliding: false, glideT: 0, pound: 0, poundHang: 0, chain: 0, prevJump: false, prevDown: false,
    dash: 0, dashDur: 0.4, dashV0: 0, spin: 0, dashCd: 0, airDash: true, prevDash: false, dashId: 0, airJump: true, flipT: 0, prevL: false, prevR: false, tapDir: 0, tapT: -9, vine: null, rope: null, swim: false, regrab: 0, swimCd: 0
  };
  /* bola rolante: ← ou → duas vezes rápido (ou Shift/L, botão Correr). O Rei vira bola, fica invulnerável e
     derruba os bichos em que bater. Uma no ar; recarrega ao pousar, agarrar cipó ou pisar num bicho. */
  // curva de velocidade: entra em IN s (encolhendo), sustenta, e nos últimos OUT s desacelera até a corrida
  const DASH = { T: 0.4, V: 540, CD: 0.45, TAP: 0.24, IN: 0.08, OUT: 0.16 };
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const DJUMP = 0.88;                                       // pulo duplo: 88% do pulo normal
  /* golpe: DUR total, janela ativa ON..OFF (segundos desde o início), alcance à frente; 3º golpe seguido é o finalizador */
  const ATK = { DUR: 0.26, ON: 0.05, OFF: 0.16, CD: 0.3, BUF: 0.14, REACH: 58, CHAIN: 0.55 };
  /* planar: aperte pular de novo no ar e segure (a cauda abre) — fôlego limitado por pulo.
     Pancada do Rei: baixo no ar mergulha; ao tocar o chão solta uma onda que atordoa e quebra caixotes. */
  const GLIDE = { MAX: 0.9, FALL: 105 };
  const POUND = { HANG: 0.11, V: 1080, R: 104 };
  const DANCE_AFTER = 3, BEAT = 0.5;                       // parado por 3 s, o Rei começa a dançar
  let R = null, atlas = null, rects = null, bg = null, soundOn = true, qualityIdx = 0;
  const keys = new Set();
  const QUALITY = [1080, 810, 720, 540];

  const ui = {
    hud: $('hud'), nuts: $('hud-nuts'), need: $('hud-need'), hearts: $('hud-hearts'), prog: $('hud-prog'), progBar: $('hud-prog-fill'),
    title: $('title'), card: $('stage-card'), cardName: $('stage-name'), cardNum: $('stage-num'), pause: $('pause'), done: $('done'),
    over: $('over'), win: $('win'), toast: $('toast'), loading: $('loading')
  };

  /* ---------------------------------------------------------------- áudio */
  // motor procedural em js/audio.js (RC.audio); aqui só a ponte com o estado do jogo
  const AU = RC.audio;
  function sfx(name, vol, rate) { if (AU) AU.sfx(name, vol, rate); }
  const jingle = (name) => { if (AU) AU.sfx(name); };
  function syncMusic() {
    if (!AU) return;
    const st = G.state;
    AU.setEnabled(soundOn);
    const key = st === 'title' || st === 'loading' && !G.lv ? 'title' : (st === 'playing' || st === 'paused') && G.lv ? G.lv.mood : null;
    AU.setScene(key, st === 'paused');
  }
  // intensidade adaptativa: velocidade do jogador e inimigos por perto ligam a camada de ação
  setInterval(() => {
    if (!AU || G.state !== 'playing') { if (AU) AU.setIntensity(0); return; }
    let near = 0;
    for (const e of G.enemies) if (!e.dead && Math.abs(e.x - player.x) < 380 && Math.abs(e.y - player.y) < 260) near++;
    const run = Math.min(1, Math.max(0, (Math.abs(player.vx) / PH.RUN - 0.55) / 0.45));
    AU.setIntensity(Math.max(run * 0.85, near ? 0.6 + Math.min(0.4, near * 0.15) : 0));
  }, 120);

  /* ---------------------------------------------------------------- utilitários de UI */
  function toast(msg, ms) {
    if (G.state !== 'playing' && G.state !== 'finished') return;       // toasts de jogo não aparecem em menus
    ui.toast.textContent = msg; ui.toast.classList.add('show'); G.toastT = (ms || 1800) / 1000;
  }
  /* Telas com botões. Só a de cima recebe foco; o resto (e o HUD) fica inerte enquanto ela está aberta. */
  const SCREENS = [ui.title, ui.pause, ui.done, ui.over, ui.win];
  const topScreen = () => SCREENS.find((e) => e.classList.contains('visible')) || null;
  function syncFocus() {
    const top = topScreen();
    SCREENS.forEach((e) => { e.inert = e !== top; });
    ui.hud.inert = !!top || !ui.hud.classList.contains('visible');
    const a = document.activeElement;
    if (top) { if (!top.contains(a)) (top.querySelector('.btn.primary') || top.querySelector('button')).focus({ preventScroll: true }); }
    else if (a && a !== document.body) a.blur();                 // jogando: Espaço pula, não aperta botão
  }
  function moveFocus(step, buttonsOnly) {
    const top = topScreen(); if (!top) return;
    const list = [...top.querySelectorAll(buttonsOnly ? 'button' : 'button, input')].filter((b) => !b.disabled);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    list[i < 0 ? 0 : (i + step + list.length) % list.length].focus({ preventScroll: true });
  }
  function show(el, on) { el.classList.toggle('visible', !!on); syncFocus(); }
  function showHud(on) { ui.hud.classList.toggle('visible', on); syncFocus(); }
  function hideAll() { [ui.title, ui.card, ui.pause, ui.done, ui.over, ui.win].forEach((e) => show(e, false)); }
  function hashSeed(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10) >>> 0;
    let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function renderHearts() {
    let h = '';
    for (let i = 0; i < G.maxHearts; i++) h += `<i class="heart ${i < G.hearts ? 'on' : ''} ${i >= 3 ? 'bonus' : ''}"></i>`;
    ui.hearts.innerHTML = h;
  }
  function renderNuts() {
    const lv = G.lv; if (!lv) return;
    ui.nuts.textContent = String(G.collected).padStart(2, '0');
    ui.need.textContent = G.collected >= lv.required ? 'caminhão liberado' : `meta ${lv.required}`;
    ui.need.classList.toggle('ok', G.collected >= lv.required);
  }

  /* ---------------------------------------------------------------- nível */
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  async function loadStage(stage) {
    ui.loading.classList.add('visible');
    await nextFrame(); await nextFrame();
    if (G.res) { G.res.chunks.forEach((c) => R.freeSet(c.set)); R.freeSet(G.res.branches.set); }
    const lv = LG.build(stage);
    const mood = RC.MOODS[lv.mood];
    const chunks = RC.paintTerrain(R, lv, mood);
    const branches = RC.paintBranches(R, lv, mood);
    G.res = { chunks, branches };
    G.lv = lv; G.mood = mood; G.stage = stage;
    buildRuntime(lv);
    EV.emit('stageLoaded', lv);
    ui.loading.classList.remove('visible');
  }

  function groundTop(c) {
    const lv = G.lv;
    if (c < 0 || c >= lv.cols) return -1e9;
    const g = lv.ground[c];
    return g < 0 ? 1e9 : g * T;
  }
  /* y da superfície mais próxima abaixo de (x, y) */
  function surfaceBelow(x, y) {
    const lv = G.lv;
    let best = groundTop(Math.floor(x / T));
    if (best > 1e8) best = 1e9;
    for (const p of lv.platforms) if (!p.off && x > p.x && x < p.x + p.w && p.y >= y - 2 && p.y < best) best = p.y;
    return best;
  }

  function buildRuntime(lv) {
    const rnd = RC.mulberry32(lv.genSeed * 3 + 99);
    G.nuts = lv.nuts.map((n, i) => ({ x: n.x, y: n.y, golden: n.golden, taken: false, ph: i * 0.9, mag: false }));
    G.enemies = lv.enemies.map((e, i) => makeEnemy(e, i));
    G.cps = lv.checkpoints.map((c) => ({ x: c.x, y: c.y, on: false, pulse: 0 }));
    G.parts = []; G.collected = 0; G.kills = 0; G.hurts = 0; G.levelTime = 0; G.nutsForHeart = 0; G.lastCp = null; G.goalWarn = 0;
    // decoração (js/decor.js pode substituir a distribuição inteira com RC.placeDecor)
    const d = [];
    const M = lv.mood, tuftN = 6;
    for (let c = 0; c < lv.cols; c++) {
      const row = lv.ground[c]; if (row < 0) continue;
      const y = row * T;
      for (let k = 0; k < 2; k++) {
        const r0 = rnd();
        if (r0 < 0.62) d.push({ kind: 'tuft', name: `tuft_${M}_${Math.floor(rnd() * tuftN)}`, x: c * T + rnd() * T, y: y + 1, ph: rnd() * 6.28, z: rnd() < 0.5 ? 0 : 1 });
      }
      if (rnd() < 0.07) d.push({ kind: 'flower', name: `flower_${Math.floor(rnd() * 4)}`, x: c * T + rnd() * T, y: y + 1, ph: rnd() * 6, z: 0 });
      if (rnd() < 0.045 && c > 8) d.push({ kind: 'mush', name: `mush_${M >= 3 ? 1 + Math.floor(rnd() * 2) : Math.floor(rnd() * 3) === 2 ? 2 : 0}`, x: c * T + rnd() * T, y: y + 2, ph: 0, z: 0, glow: M >= 3 });
      if (rnd() < 0.09) d.push({ kind: 'twig', name: `sprout_${Math.floor(rnd() * 3)}`, x: c * T + 12, y: y + 2, ph: rnd() * 6, z: 0, flip: rnd() < 0.5 ? -1 : 1 });
    }
    for (const p of lv.platforms) {
      const n = Math.floor(p.w / 22);
      for (let k = 0; k < n; k++) if (rnd() < 0.6) d.push({ kind: 'tuft', name: `tuft_${M}_${Math.floor(rnd() * tuftN)}`, x: p.x + 6 + rnd() * (p.w - 12), y: p.y + 4, ph: rnd() * 6, z: 1 });
      if (rnd() < 0.5) d.push({ kind: 'twig', name: `sprout_${Math.floor(rnd() * 3)}`, x: p.x + 15 + (p.w - 30) * rnd(), y: p.y + 3, ph: rnd() * 6, z: 0, flip: rnd() < 0.5 ? -1 : 1 });
    }
    G.decor = RC.placeDecor ? RC.placeDecor(lv, rnd, d) : d;
    // vaga-lumes
    const nf = Math.round(RC.MOODS[lv.mood].fireflies * 34);
    G.flies = Array.from({ length: nf }, () => ({ x: rnd() * 1300, y: 130 + rnd() * 300, ph: rnd() * 6.28, sp: 0.4 + rnd() * 0.8, r: 10 + rnd() * 14 }));
    // posição inicial
    spawnPlayer(lv.start.x, lv.start.y);
    G.camX = G.camTarget = clamp(player.x - WW * 0.35, 0, lv.width - WW);
    renderNuts(); renderHearts();
  }

  function spawnPlayer(x, groundY) {
    player.x = x; player.y = groundY - player.h - 1; player.vx = player.vy = 0; player.grounded = false; player.facing = 1;
    player.invuln = 1.2; player.hurtT = 0; player.coyote = 0; player.buf = 0; player.sx = player.sy = 1; player.jumping = false;
    player.dead = false; player.finishing = false;
    player.idleT = 0; player.atk = 0; player.atkCd = 0; player.atkBuf = 0; player.combo = 0;
    player.gliding = false; player.glideT = GLIDE.MAX; player.pound = 0; player.poundHang = 0; player.chain = 0;
    player.dash = 0; player.dashCd = 0; player.airDash = true; player.airJump = true; player.flipT = 0; player.vine = null; player.rope = null; player.swim = false; player.regrab = 0;
  }

  /* ---------------------------------------------------------------- inimigos */
  const ENEMY = {
    ant: { w: 46, h: 36, hp: 1, frames: 8, anchor: [18, 30] },
    hopper: { w: 44, h: 46, hp: 1, frames: 4, anchor: [25, 32] },
    gator: { w: 54, h: 62, hp: 2, frames: 4, anchor: [24, 46] }
  };
  function makeEnemy(e, i) {
    const def = ENEMY[e.type];
    const cx = (e.left + e.right) / 2;
    const o = { ...e, type: e.type, def, x: cx - def.w / 2, y: e.y - def.h, w: def.w, h: def.h, left: e.left, right: e.right, floorY: e.y,
      dir: i % 2 ? -1 : 1, speed: e.speed, hp: def.hp, vy: 0, hopT: 1 + (i % 4) * 0.5, air: false, dead: false, deadT: 0, stun: 0, anim: i * 0.37 };
    if (def.init) def.init(o, API);                       // tipos novos (registrados em ENEMY por módulos) preparam seu estado aqui
    return o;
  }
  function updateEnemy(e, dt) {
    if (e.dead) { e.deadT += dt; return; }
    e.anim += dt;
    if (e.def.update && e.stun <= 0) { e.def.update(e, dt, API); return; }
    if (e.stun > 0) {
      e.stun -= dt;
      if (e.kb) {                                           // empurrão do golpe, preso à área de patrulha
        e.x = clamp(e.x + e.kb * dt, e.left - e.w / 2, e.right - e.w / 2);
        e.kb *= Math.exp(-dt * 9); if (Math.abs(e.kb) < 5) e.kb = 0;
      }
      if (e.air) { e.vy += 1500 * dt; e.y += e.vy * dt; if (e.y >= e.floorY - e.h) { e.y = e.floorY - e.h; e.air = false; e.vy = 0; } }
      return;
    }
    const cx = e.x + e.w / 2;
    if (e.type === 'hopper') {
      e.hopT -= dt;
      if (!e.air && e.hopT <= 0) { e.air = true; e.vy = -430; e.hopT = 1.1 + Math.random() * 1.1; }
      if (e.air) {
        e.vy += 1500 * dt; e.y += e.vy * dt; e.x += e.dir * e.speed * 2.3 * dt;
        if (e.y >= e.floorY - e.h && e.vy > 0) { e.y = e.floorY - e.h; e.air = false; e.vy = 0; }
      } else e.x += e.dir * e.speed * 0.45 * dt;
    } else e.x += e.dir * e.speed * dt;
    const nx = e.x + e.w / 2;
    if (nx < e.left) { e.x = e.left - e.w / 2; e.dir = 1; }
    if (nx > e.right) { e.x = e.right - e.w / 2; e.dir = -1; }
  }

  /* ---------------------------------------------------------------- partículas */
  function emit(kind, x, y, o) {
    o = o || {};
    G.parts.push({ kind, x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g === undefined ? 0 : o.g, life: o.life || 0.6, max: o.life || 0.6,
      size: o.size || 1, rot: o.rot || 0, vr: o.vr || 0, col: o.col || [1, 1, 1], name: o.name, grow: o.grow || 0, drag: o.drag || 0 });
  }
  function burst(kind, x, y, n, speed, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = speed * (0.35 + Math.random() * 0.65);
      emit(kind, x, y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.25 }, o, { life: (o && o.life || 0.6) * (0.7 + Math.random() * 0.6) }));
    }
  }
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) emit('dust', x + (Math.random() - 0.5) * 18, y, { vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 40, life: 0.38 + Math.random() * 0.2, size: 1 + Math.random() * 1.2, g: -30 });
  }

  /* ---------------------------------------------------------------- física do jogador */
  function overlapsSolidX(nx) {
    const c0 = Math.floor(nx / T), c1 = Math.floor((nx + player.w - 0.01) / T);
    const bottom = player.y + player.h;
    for (let c = c0; c <= c1; c++) { const top = groundTop(c); if (top < bottom - 0.5) return { c, top }; }
    return null;
  }

  function stepPlayer(dt) {
    const lv = G.lv;
    const left = keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('PadLeft');
    const right = keys.has('ArrowRight') || keys.has('KeyD') || keys.has('PadRight');
    const upHeld = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('PadUp');
    const onLine = !!(player.vine || player.rope);           // no cipó, ↑/W sobe em vez de pular
    const jumpHeld = keys.has('Space') || keys.has('PadJump') || (!onLine && (keys.has('ArrowUp') || keys.has('KeyW')));
    // ↓ desce (plataforma, cipó, água); S é a Pancada. No controle, ↓ faz as duas coisas conforme o lugar.
    const downHeld = keys.has('ArrowDown') || keys.has('PadDown');
    const slamHeld = keys.has('KeyS') || (keys.has('PadDown') && !player.grounded);
    const dashHeld = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyL') || keys.has('PadDash');
    const jumpPress = jumpHeld && !player.prevJump, downPress = downHeld && !player.prevDown, dashPress = dashHeld && !player.prevDash, slamPress = slamHeld && !player.prevSlam;
    player.prevJump = jumpHeld; player.prevDown = downHeld; player.prevDash = dashHeld; player.prevSlam = slamHeld; player.dropT = (player.dropT || 0) - dt;
    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (player.finishing) dir = 1;
    if (player.hurtT > 0) { player.hurtT -= dt; dir = 0; }
    player.regrab -= dt; player.dashCd -= dt; player.swimCd -= dt; player.flipT -= dt;

    // cipós e cordas (js/mechanics.js) assumem o controle enquanto o Rei está pendurado
    const inp = { dir, up: upHeld, down: downHeld, jumpPress, jumpHeld, dashPress };
    if (RC.mech && !player.finishing && player.hurtT <= 0 && RC.mech.control(player, dt, inp)) {
      player.gliding = false; player.pound = 0; player.dash = 0; player.airDash = true; player.airJump = true; player.glideT = GLIDE.MAX; player.chain = 0;
      player.coyote = 0; player.buf = 0; player.grounded = false; player.animT += dt; player.idleT = 0;
      if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
      const k = 1 - Math.exp(-dt * 16); player.sx += (1 - player.sx) * k; player.sy += (1 - player.sy) * k;
      if (player.y > WH + 70 && !player.dead) fall();
      return;
    }
    // água: o centro do Rei abaixo da superfície
    const surf = RC.mech ? RC.mech.waterAt(player.x + player.w / 2, player.y + player.h * 0.55) : null;
    const wasSwim = player.swim; player.swim = surf !== null;
    if (player.swim !== wasSwim) EV.emit(player.swim ? 'waterIn' : 'waterOut', player.x + player.w / 2, surf !== null ? surf : player.y + player.h);
    if (player.swim) { player.gliding = false; player.pound = 0; player.airDash = true; player.airJump = true; player.glideT = GLIDE.MAX; }

    // toque duplo em ← ou →: dispara a bola (funciona com teclado, controle, analógico de toque)
    let rollPress = dashPress || player.rollReq; player.rollReq = false;
    const lNow = left && !right, rNow = right && !left;
    for (const [now, prev, d] of [[lNow, player.prevL, -1], [rNow, player.prevR, 1]]) {
      if (now && !prev) {
        if (player.tapDir === d && G.levelTime - player.tapT < DASH.TAP) { rollPress = true; player.tapDir = 0; } else { player.tapDir = d; player.tapT = G.levelTime; }
      }
    }
    player.prevL = lNow; player.prevR = rNow;
    // bola rolante
    if (rollPress && player.dashCd <= 0 && !player.dash && (player.grounded || player.airDash || player.swim) && !player.finishing && player.hurtT <= 0) {
      if (dir) player.facing = dir;
      player.dash = player.dashDur = DASH.T * (player.swim ? 1.3 : 1); player.dashCd = DASH.CD; player.dashId++; if (!player.grounded) player.airDash = false;
      player.dashV0 = Math.max(0, player.vx * player.facing);
      player.gliding = false; player.pound = 0; player.jumping = false; player.sx = 1.12; player.sy = 0.9; player.flipT = 0;
      dust(player.x + player.w / 2, player.y + player.h, 6);
      sfx('dash', 0.32); EV.emit('dash', player.facing);
    }

    const grounded = player.grounded;
    const accel = (grounded ? PH.ACC_G : PH.ACC_A) * (player.swim ? 0.55 : 1);
    const maxV = PH.RUN * (player.finishing ? 0.7 : 1) * (player.swim ? 0.62 : 1);
    if (player.dash > 0) {
      player.dash -= dt;
      const top = DASH.V * (player.swim ? 0.6 : 1), el = player.dashDur - player.dash;
      let v = player.dash < DASH.OUT ? lerp(maxV, top, smooth(player.dash / DASH.OUT)) : lerp(player.dashV0, top, smooth(el / DASH.IN));
      player.vx = player.facing * v;
      if (player.dash <= 0) { player.dash = 0; player.vx = player.facing * maxV; player.sx = 0.95; player.sy = 1.05; }
    } else if (dir) {
      // virar rápido; acima da corrida (arremesso do cipó, arrancada) o embalo cai aos poucos em vez de cortar seco
      if (Math.sign(player.vx) !== dir && player.vx !== 0) player.vx += dir * accel * 1.5 * dt;
      else if (Math.abs(player.vx) < maxV) player.vx = Math.min(maxV, Math.abs(player.vx + dir * accel * dt)) * dir;
      if (player.atk <= 0) player.facing = dir;
      if (Math.abs(player.vx) > maxV) player.vx = Math.sign(player.vx) * Math.max(maxV, Math.abs(player.vx) - (grounded ? 1400 : 380) * dt);
    } else if (player.hurtT <= 0) {
      const f = (grounded ? PH.FRIC_G : PH.FRIC_A) * dt;
      player.vx = Math.abs(player.vx) <= f ? 0 : player.vx - Math.sign(player.vx) * f;
    }

    player.coyote = grounded ? PH.COYOTE : player.coyote - dt;
    player.buf -= dt;
    if (player.swim && player.buf > 0 && player.swimCd <= 0 && player.hurtT <= 0) {
      // perto da superfície: salto para fora; mais fundo: braçada
      const nearTop = player.y < surf + 2;
      player.vy = nearTop ? -PH.JUMP_V * 0.98 : -265; player.buf = 0; player.swimCd = nearTop ? 0.25 : 0.2; player.jumping = false;   // salto da água nunca é cortado
      player.sx = 0.85; player.sy = 1.2; sfx(nearTop ? 'jump' : 'stroke', 0.26); EV.emit('stroke', player.x + player.w / 2, player.y + player.h / 2);
    } else if (!player.swim && player.buf > 0 && player.coyote > 0 && player.hurtT <= 0 && !player.finishing) {
      player.groundJumpT = 0.1;                                 // este toque já foi o pulo do chão
      player.vy = -PH.JUMP_V; player.coyote = 0; player.buf = 0; player.grounded = false; player.jumping = true;
      player.sx = 0.8; player.sy = 1.25;
      dust(player.x + player.w / 2, player.y + player.h, 5);
      sfx('jump', 0.28);
    }
    if (!jumpHeld && player.jumping && player.vy < -PH.CUT_V) player.vy = -PH.CUT_V;
    if (player.vy >= 0) player.jumping = false;

    // Pancada do Rei: baixo no ar (não logo após decolar)
    if (jumpPress && player.dash > 0 && !player.grounded) player.dash = 0;     // pular cancela a bola no ar
    const canAct = !player.grounded && !player.swim && !player.dash && player.hurtT <= 0 && !player.finishing && !player.dead;
    // ↓ em cima de um galho ou jangada: atravessa para baixo (pontes ficam firmes, para ninguém cair num buraco sem querer)
    if (downPress && player.grounded && !player.dash && player.hurtT <= 0) {
      const feet = player.y + player.h;
      const on = lv.platforms.find((p) => !p.off && p.kind !== 'bridge' && player.x + player.w > p.x + 3 && player.x < p.x + p.w - 3 && Math.abs(p.y - feet) < 3);
      if (on) { player.dropT = 0.22; player.grounded = false; player.y += 3; player.vy = 60; player.coyote = 0; player.sx = 0.9; player.sy = 1.1; }
    }
    if (slamPress && canAct && !player.pound && player.y + player.h < surfaceBelow(player.x + player.w / 2, player.y + player.h) - 40) {
      player.pound = 1; player.poundHang = POUND.HANG; player.gliding = false; player.jumping = false;
      player.vx *= 0.2; player.vy = 0; player.sx = 0.8; player.sy = 1.2;
      sfx('swing', 0.34, 0.6);
    }
    // pulo duplo: o primeiro toque no ar dá um segundo pulo (com cambalhota); o próximo abre a planada
    let usedDJ = false;
    player.groundJumpT = (player.groundJumpT || 0) - dt;
    if (canAct && !player.pound && jumpPress && player.groundJumpT <= 0 && player.coyote <= 0 && player.airJump && !player.gliding) {
      player.airJump = false; usedDJ = true; player.buf = 0;
      player.vy = -PH.JUMP_V * DJUMP; player.jumping = true; player.flipT = 0.34; player.sx = 0.78; player.sy = 1.28;
      sfx('jump', 0.3, 1.35); EV.emit('doubleJump', player.x + player.w / 2, player.y + player.h);
      burst('dust', player.x + player.w / 2, player.y + player.h, 8, 150, { life: 0.4, size: 1.1 });
      for (let i = 0; i < 4; i++) emit('leaf', player.x + player.w / 2, player.y + player.h, { vx: (Math.random() - 0.5) * 180, vy: 40 + Math.random() * 60, g: 200, life: 0.7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, name: 'leaf_' + (i % 3) });
    }
    // planar: novo toque em pular durante a queda (depois do pulo duplo)
    if (canAct && !usedDJ && !player.airJump && !player.pound && jumpPress && player.coyote <= 0 && player.glideT > 0 && player.vy > -120) {
      player.gliding = true; player.jumping = false;
      sfx('jump', 0.16, 1.7);
      for (let i = 0; i < 5; i++) emit('leaf', player.x + player.w / 2, player.y + 10, { vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 80, g: 220, life: 0.8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, name: 'leaf_' + (i % 3) });
    }
    if (player.gliding && (!jumpHeld || player.glideT <= 0 || player.grounded || player.hurtT > 0)) player.gliding = false;

    if (player.dash > 0 && !player.swim) {
      // bola: no chão rola junto ao terreno; no ar quase não cai (plana na rolagem)
      player.vy = player.grounded ? 0 : Math.min(player.vy + PH.GRAV * 0.35 * dt, 160);
    } else if (player.dash > 0) {
      player.vy *= Math.exp(-dt * 6);
    } else if (player.swim && player.swimCd < 0.12 || player.swim && player.vy > -400) {
      // empuxo: o Rei boia com a cabeça para fora; segurar ↓ mergulha (castanhas e segredos no fundo)
      if (downHeld || keys.has('KeyS')) player.vy += 900 * dt;
      else player.vy += (player.y > surf - 12 ? -560 : 380) * dt;
      player.vy *= Math.exp(-dt * 3.2);
      player.vy = clamp(player.vy, -300, downHeld || keys.has('KeyS') ? 240 : 160);
    } else if (player.pound) {
      if (player.poundHang > 0) { player.poundHang -= dt; player.vy = 0; player.vx *= Math.exp(-dt * 20); }
      else player.vy = POUND.V;
      if (Math.random() < dt * 40) emit('spark', player.x + player.w / 2 + (Math.random() - 0.5) * 16, player.y + 6, { vx: 0, vy: -60, life: 0.25, col: [1, 0.85, 0.5], size: 0.5 });
    } else if (player.gliding) {
      player.glideT -= dt;
      player.vy = Math.min(player.vy + PH.GRAV * dt, GLIDE.FALL);
      player.sx += (1.12 - player.sx) * 0.3; player.sy += (0.9 - player.sy) * 0.3;
      if (Math.random() < dt * 9) emit('leaf', player.x + player.w / 2 - player.facing * 12, player.y + 18, { vx: -player.facing * 40, vy: 30, g: 60, life: 0.9, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, name: 'leaf_' + Math.floor(Math.random() * 3) });
    } else {
      let g = PH.GRAV * (player.vy > 0 ? PH.FALL_MULT : 1);
      if (Math.abs(player.vy) < 70 && jumpHeld && player.jumping) g *= 0.82;
      if (Math.abs(player.vy) < 38 && !player.grounded && !player.pound) g *= 0.6;          // suspensão no ápice do pulo
      player.vy = Math.min(player.vy + g * dt, PH.MAXFALL);
    }

    // eixo X
    const prevX = player.x;
    let nx = player.x + player.vx * dt;
    nx = clamp(nx, 0, lv.width - player.w);
    // limite do caminhão enquanto faltam castanhas
    const goalWall = lv.goal.x + 18;
    const blockedByTruck = !player.finishing && G.collected < lv.required;
    if (blockedByTruck && nx + player.w > goalWall) { nx = goalWall - player.w; player.vx = 0; }
    // beirada: o bote do tabefe nunca leva o Rei para dentro de um buraco
    if (player.grounded && player.atk > 0) {
      const lead = player.vx > 0 ? nx + player.w : nx, gt = groundTop(Math.floor(lead / T));
      if (gt > player.y + player.h + 40 && !lv.platforms.some((p) => !p.off && lead > p.x && lead < p.x + p.w && Math.abs(p.y - (player.y + player.h)) < 4)) { nx = player.x; player.vx = 0; }
    }
    const hit = (() => { const old = player.x; player.x = nx; const h = overlapsSolidX(nx); player.x = old; return h; })();
    if (hit) {
      const stepH = player.y + player.h - hit.top;
      if (stepH <= 9) { player.y = hit.top - player.h; player.x = nx; }
      else { nx = player.vx > 0 ? hit.c * T - player.w : (hit.c + 1) * T; player.vx = 0; player.x = nx; }
    } else player.x = nx;

    // caixotes sólidos: empurram para fora pelos lados
    if (RC.props) for (const b of RC.props.solids()) {
      if (player.x + player.w > b.x0 && player.x < b.x1 && player.y + player.h > b.top + 3 && player.y < b.bottom) {
        const over = player.y + player.h - b.top;
        if (over <= 12 && player.vy >= -200) { player.y = b.top - player.h; if (player.vy > 0) player.vy = 0; continue; }   // correção de quina: sobe no caixote
        if (player.x + player.w / 2 < (b.x0 + b.x1) / 2) player.x = b.x0 - player.w; else player.x = b.x1;
        player.vx = 0;
      }
    }
    // eixo Y
    const prevBottom = player.y + player.h;
    player.y += player.vy * dt;
    const wasGrounded = player.grounded;
    player.grounded = false;
    if (player.vy >= 0) {
      const bottom = player.y + player.h;
      const c0 = Math.floor(player.x / T), c1 = Math.floor((player.x + player.w - 0.01) / T);
      let top = 1e9;
      for (let c = c0; c <= c1; c++) top = Math.min(top, groundTop(c));
      let land = null;
      if (bottom >= top && prevBottom <= top + 7) land = top;
      for (const p of lv.platforms) {
        if (player.dropT > 0 && p.kind !== 'bridge') continue;          // descendo pelo galho
        if (!p.off && player.x + player.w > p.x + 3 && player.x < p.x + p.w - 3 && prevBottom <= p.y + 5 && bottom >= p.y && (land === null || p.y < land)) {
          land = p.y;
          if (p.crumble && !(p.cT > 0)) { p.cT = 0.5; sfx('land', 0.15, 0.6); burst('dust', player.x + player.w / 2, p.y, 4, 70, { col: [0.5, 0.35, 0.2], life: 0.5 }); }
        }
      }
      if (RC.props) for (const b of RC.props.solids()) {
        if (player.x + player.w > b.x0 + 2 && player.x < b.x1 - 2 && prevBottom <= b.top + 6 && bottom >= b.top && (land === null || b.top < land)) land = b.top;
      }
      if (land !== null) {
        player.y = land - player.h;
        if (player.vy > 260) { player.sx = 1.25; player.sy = 0.78; dust(player.x + player.w / 2, land, 6); G.shake = Math.max(G.shake, player.vy > 600 ? 2.5 : 0); }
        player.vy = 0; player.grounded = true;
      }
    }
    if (player.grounded && !wasGrounded) {
      player.landT = 0.12; sfx('land', 0.2);
      player.glideT = GLIDE.MAX; player.gliding = false; player.chain = 0; player.airDash = true; player.airJump = true;
      if (player.pound) poundImpact();
    }

    // squash & stretch retorna ao normal
    const k = 1 - Math.exp(-dt * 16);
    player.sx += (1 - player.sx) * k; player.sy += (1 - player.sy) * k;
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    player.animT += dt;
    if (grounded && Math.abs(player.vx) > 150 && Math.random() < dt * 14) dust(player.x + player.w / 2 - player.facing * 8, player.y + player.h, 1);

    // golpe (J/X/K, X ou B no controle, botão Bater no toque)
    player.atkCd -= dt; player.atkBuf -= dt;
    if (player.atk > 0) player.atk -= dt;
    if (player.atkBuf > 0 && player.atkCd <= 0 && player.hurtT <= 0 && !player.finishing && !player.dead) {
      player.combo = G.time - player.lastAtkT < ATK.CHAIN ? (player.combo % 3) + 1 : 1; player.lastAtkT = G.time;
      player.atk = ATK.DUR; player.atkCd = ATK.CD; player.atkBuf = 0; player.atkId++;
      if (player.grounded) player.vx += player.facing * (player.combo === 3 ? 260 : 170);
      else if (player.vy > 0) player.vy *= 0.35;               // golpe no ar segura a queda um instante
      player.sx = 1.22; player.sy = 0.86;
      sfx('swing', 0.3);
    }
    // ócio: sem tecla, parado no chão -> dança
    const busy = dir || jumpHeld || !player.grounded || player.swim || Math.abs(player.vx) > 5 || player.atk > 0 || player.hurtT > 0;
    player.idleT = busy ? 0 : player.idleT + dt;

    if (player.y > WH + 70 && !player.dead) fall();
  }

  // onda de choque da Pancada: atordoa/derruba quem estiver perto no mesmo andar
  function poundImpact() {
    player.pound = 0;
    const cx = player.x + player.w / 2, fy = player.y + player.h;
    G.shake = Math.max(G.shake, 11); G.hitstop = 0.07; G.aberr = Math.max(G.aberr, 0.03);
    player.sx = 1.4; player.sy = 0.7;
    sfx('land', 0.5, 0.55); sfx('punch', 0.4, 0.6);
    burst('dust', cx, fy, 16, 260, { life: 0.6 });
    burst('spark', cx, fy - 4, 12, 320, { col: [1, 0.8, 0.45], life: 0.4, size: 0.7 });
    let hits = 0;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const ex = e.x + e.w / 2, d = Math.abs(ex - cx);
      if (d > POUND.R + e.w / 2 || Math.abs(e.y + e.h - fy) > 48) continue;
      hits++;
      e.hp -= e.boss ? 1 : 2;
      if (e.hp <= 0 && !e.boss) { killEnemy(e); continue; }
      e.stun = Math.max(e.stun, 0.9); e.kb = Math.sign(ex - cx || 1) * 380;
      if (!e.boss) { e.air = true; e.vy = -320; }
    }
    if (hits >= 2) toast(`Pancada do Rei! ${hits} de uma vez`, 1100);
    EV.emit('poundHits', hits);
    EV.emit('pound', cx, fy);
  }

  function killEnemy(e) {
    const ex = e.x + e.w / 2, ey = e.y + e.h * 0.3;
    e.dead = true; G.kills++; G.totalKills++; sfx('kill', 0.36);
    EV.emit('enemyKilled', e, player.atk > 0 ? 'punch' : 'stomp');
    burst('spark', ex, ey, 14, 240, { col: [1, 0.85, 0.4], life: 0.5 });
    burst('dust', ex, ey + 4, 9, 150, { life: 0.7, size: 1.8, drag: 2.5 });   // fumaça
    burst('spark', ex, ey, 10, 380, { col: [1, 0.5, 0.2], life: 0.35, size: 0.9 });      // faíscas de explosão
    burst('leaf', ex, ey, 5, 260, { name: 'crate_piece_' + (1 + Math.floor(Math.random() * 3)), g: 900, vr: 14, life: 0.9 });                // estilhaços
    G.shake = Math.max(G.shake, 4); G.flash = Math.max(G.flash, 0.06);
    // inimigo derrotado solta uma castanha
    G.nuts.push({ x: ex, y: ey - 6, golden: false, taken: false, ph: 0, mag: true, vy: -220, drop: true });
  }
  function punchEnemy(e, f) {
    const fin = player.combo === 3;
    e.hp -= fin ? 2 : 1;
    const hx = f > 0 ? e.x + 6 : e.x + e.w - 6, hy = e.y + e.h * 0.45;
    sfx('punch', fin ? 0.42 : 0.32, 1);
    burst('spark', hx, hy, fin ? 8 : 5, fin ? 300 : 210, { col: fin ? [1, 0.8, 0.4] : [1, 0.65, 0.3], life: 0.3, size: 0.55 });
    G.hitstop = fin ? 0.09 : 0.055; G.shake = Math.max(G.shake, fin ? 6 : 3.5);
    if (e.hp <= 0) { killEnemy(e); if (fin) toast('Combo do Rei!', 900); return; }
    e.stun = 0.45; e.kb = f * (fin ? 520 : 330); e.dir = -f;
  }

  // bola rolante acerta: mesmo dano do tabefe, empurra e dá um quique curto no Rei
  function rollHit(e) {
    const f = player.facing, ex = e.x + e.w / 2, ey = e.y + e.h * 0.45;
    e.hp -= 1; sfx('punch', 0.4, 1.2); G.hitstop = 0.06; G.shake = Math.max(G.shake, 5);
    burst('spark', ex, ey, 10, 280, { col: [1, 0.85, 0.45], life: 0.35, size: 0.7 });
    EV.emit('rollHit', e);
    if (e.hp <= 0) { killEnemy(e); return; }
    e.stun = 0.6; e.kb = f * 420; e.dir = -f;
  }
  function hurt(fromX, heavy) {
    if (player.invuln > 0 || player.dead || player.finishing || player.dash > 0) return;     // bola rolante: invulnerável
    G.hearts--; G.hurts++; renderHearts(); EV.emit('playerHurt');
    player.invuln = 1.7; player.hurtT = 0.38;
    player.vx = (player.x + player.w / 2 < fromX ? -1 : 1) * 250; player.vy = -380; player.grounded = false; player.jumping = false;
    G.shake = 9; G.flash = 0.35; G.aberr = 0.05; G.hitstop = 0.07;
    burst('spark', player.x + player.w / 2, player.y + 14, 12, 260, { col: [1, 0.6, 0.3], life: 0.5, size: 1 });
    sfx('hurt', 0.36);
    if (G.hearts <= 0) gameOver();
  }

  function fall() {
    G.hearts--; G.hurts++; renderHearts();
    G.shake = 8; G.flash = 0.3; sfx('hurt', 0.34);
    if (G.hearts <= 0) { gameOver(); return; }
    const cp = G.lastCp;
    const x = cp ? cp.x - 24 : G.lv.start.x;
    const gy = cp ? cp.y : G.lv.start.y;
    spawnPlayer(x, gy); player.invuln = 2.0;
    G.camTarget = clamp(player.x - WW * 0.35, 0, G.lv.width - WW);
    toast(cp ? 'De volta ao último lampião' : 'De volta ao início', 1500);
  }

  /* ---------------------------------------------------------------- loop de jogo */
  function updateWorld(dt) {
    if (G.dialogue) return;               // diálogo de missão aberto: mundo congelado
    const lv = G.lv;
    G.levelTime += dt;
    stepPlayer(dt);
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;

    // golpe: cada inimigo leva no máximo um acerto por golpe
    const atkEl = ATK.DUR - player.atk;
    if (player.atk > 0 && atkEl >= ATK.ON && atkEl <= ATK.OFF) {
      const f = player.facing, hx = f > 0 ? player.x + player.w - 8 : player.x - ATK.REACH + 8, hy = player.y - 10, hh = player.h + 18;
      for (const e of G.enemies) {
        if (e.dead || e.hitBy === player.atkId) continue;
        if (hx < e.x + e.w && hx + ATK.REACH > e.x && hy < e.y + e.h && hy + hh > e.y) { e.hitBy = player.atkId; punchEnemy(e, f); }
      }
    }

    for (let i = G.enemies.length - 1; i >= 0; i--) { const e = G.enemies[i]; if (e.dead && e.deadT > 2.4 && e.type !== 'ladrao') G.enemies.splice(i, 1); }   // corpos já invisíveis saem da lista
    for (const e of G.enemies) {
      updateEnemy(e, dt);
      if (e.dead || e.stun > 0 || player.dead) continue;
      if (player.dash > 0 && e.hitBy !== 'r' + player.dashId && player.x - 6 < e.x + e.w && player.x + player.w + 6 > e.x && player.y < e.y + e.h && player.y + player.h > e.y) {
        e.hitBy = 'r' + player.dashId; rollHit(e); continue;
      }
      if (player.x < e.x + e.w && player.x + player.w > e.x && player.y < e.y + e.h && player.y + player.h > e.y) {
        if (player.dash > 0) continue;
        const stomp = player.vy > 60 && player.y + player.h < e.y + e.h * 0.62 + 8;
        if (stomp) {
          e.hp -= player.pound ? 2 : 1;
          if (player.pound) { player.pound = 0; G.shake = Math.max(G.shake, 7); }
          player.chain++; player.glideT = GLIDE.MAX; player.airDash = true; player.airJump = true;
          if (player.chain >= 2) {
            toast(`Pisão em cadeia x${player.chain}`, 900); sfx('item', 0.3, 1 + player.chain * 0.12);
            for (let k = 1; k < player.chain && k < 4; k++) G.nuts.push({ x: e.x + e.w / 2 + (k - 2) * 12, y: e.y, golden: player.chain >= 4 && k === 1, taken: false, ph: k, mag: true, vy: -260 - k * 30, drop: true });
          }
          player.vy = -(keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp') || keys.has('PadJump') ? PH.STOMP_V * 1.15 : PH.STOMP_V); player.jumping = true;
          player.sx = 0.85; player.sy = 1.2; G.hitstop = 0.05;
          const ex = e.x + e.w / 2, ey = e.y + e.h * 0.3;
          if (e.hp <= 0) killEnemy(e);
          else { e.stun = 0.5; e.dir *= -1; sfx('kill', 0.2, 1.4); burst('spark', ex, ey, 8, 160, { col: [1, 1, 0.8], life: 0.35 }); }
          G.shake = Math.max(G.shake, 3);
        } else hurt(e.x + e.w / 2);
      }
    }

    // castanhas (com ímã)
    for (const n of G.nuts) {
      if (n.taken) continue;
      if (n.drop) { n.vy += 900 * dt; n.y += n.vy * dt; const sb = surfaceBelow(n.x, n.y - 10); if (n.y > sb - 14 && n.vy > 0) { n.y = sb - 14; n.vy = 0; n.drop = false; } }
      const dx = pcx - n.x, dy = pcy - n.y, d = Math.hypot(dx, dy);
      if (d < 80 || n.mag) { n.mag = true; const sp = 240 + (1 - Math.min(d, 80) / 80) * 360; const k = Math.min(1, (sp * dt) / Math.max(d, 1)); if (d < 80) { n.x += dx * k; n.y += dy * k; } }
      if (d < 24) {
        n.taken = true; G.collected += n.golden ? 3 : 1; G.totalNuts += n.golden ? 3 : 1; G.nutsForHeart += n.golden ? 3 : 1;
        burst('spark', n.x, n.y, n.golden ? 16 : 7, n.golden ? 280 : 170, { col: n.golden ? [1, 0.9, 0.35] : [1, 0.75, 0.3], life: 0.5 });
        sfx('item', 0.28, n.golden ? 0.8 : 1 + Math.random() * 0.2);
        renderNuts(); EV.emit('nutTaken', n);
        if (G.nutsForHeart >= 25 && G.hearts < G.maxHearts) { G.nutsForHeart -= 25; G.hearts++; renderHearts(); toast('Mais um coração!', 1400); jingle('heart'); }
      }
    }

    // checkpoints
    for (const c of G.cps) {
      c.pulse += dt;
      if (!c.on && player.x + player.w > c.x - 6) {
        c.on = true; G.lastCp = c; EV.emit('checkpoint', c); toast('Lampião aceso: se cair, você volta daqui', 1700); jingle('checkpoint');
        burst('spark', c.x, c.y - 36, 14, 150, { col: [1, 0.8, 0.4], life: 0.7 });
      }
    }

    // chegada
    const door = lv.goal.x + 8;
    if (!player.finishing && player.x + player.w > door) {
      const why = G.finishBlock ? G.finishBlock() : null;
      if (G.collected >= lv.required && !why) startFinish();
      else if (why && G.collected >= lv.required) { G.goalWarn -= dt; if (G.goalWarn <= 0) { G.goalWarn = 3; toast(why, 2200); jingle('deny'); } }
    }
    if (!player.finishing && G.collected < lv.required && player.x + player.w > lv.goal.x - 130) {
      G.goalWarn -= dt;
      if (G.goalWarn <= 0) { G.goalWarn = 3; toast(`Faltam ${lv.required - G.collected} castanhas para abrir o caminhão`, 2200); jingle('deny'); }
    }
    if (player.finishing && player.x + player.w / 2 > lv.goal.x + 56) finishStage();
    EV.emit('update', dt);

    // câmera
    const look = player.facing * 70 + clamp(player.vx * 0.16, -40, 40);
    G.camTarget = clamp(pcx - WW * 0.42 + look, 0, lv.width - WW);
    if (G.camLock != null) G.camTarget = G.camLock;
    G.camX += (G.camTarget - G.camX) * (1 - Math.exp(-dt * 6.5));
    G.camX = clamp(G.camX, 0, lv.width - WW);

    // progresso HUD
    const pct = clamp(pcx / lv.goal.x, 0, 1);
    ui.progBar.style.width = `${pct * 100}%`;
    ui.prog.style.setProperty('--p', pct);
  }

  function startFinish() {
    EV.emit('finish', G.stage);
    player.finishing = true; player.invuln = 99; G.fadeTarget = 1;
    if (AU) AU.sting('fanfare'); if (RC.hud && RC.hud.banner) RC.hud.banner('FASE CONCLUÍDA!', 'o caminhão é todo seu'); else toast('Caminhão liberado!', 1200);
    burst('spark', G.lv.goal.x + 60, G.lv.goal.y - 60, 48, 380, { col: [1, 0.85, 0.4], life: 0.9 });
  }
  function finishStage() {
    if (G.state !== 'playing') return;
    G.state = 'finished'; G.fadeTarget = 0.0; syncMusic();
    setTimeout(() => {
      const lv = G.lv, last = G.stage >= 4;
      const pct = G.collected / Math.max(1, lv.total);
      const stars = pct >= 0.9 ? 3 : pct >= 0.65 ? 2 : 1;
      const secs = Math.round(G.levelTime), tm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      $('done-title').textContent = last ? 'A despensa está salva' : 'Fase concluída';
      $('done-stars').innerHTML = [1, 2, 3].map((i) => `<i class="star ${i <= stars ? 'on' : ''}"></i>`).join('');
      $('done-stats').innerHTML = `<div><b>${G.collected}</b><span>de ${lv.total} castanhas</span></div><div><b>${G.kills}</b><span>inimigos pisados</span></div><div><b>${tm}</b><span>tempo</span></div>`;
      $('done-next').textContent = last ? 'Ver o final' : 'Próxima fase';
      // recordes por semente+fase (só no navegador de quem joga)
      const notes = [];
      if (!G.hurts) notes.push('Sem levar dano!');
      try {
        const key = 'rc-records', all = JSON.parse(localStorage.getItem(key) || '{}'), id = `fase${G.stage}`, old = all[id];
        const beatTime = !old || secs < old.time, beatStars = !old || stars > old.stars;
        if (old && (beatTime || beatStars)) notes.push(beatStars ? 'Novo recorde de estrelas!' : 'Novo recorde de tempo!');
        else if (old) notes.push(`Recorde: ${Math.floor(old.time / 60)}:${String(old.time % 60).padStart(2, '0')}`);
        all[id] = { stars: Math.max(stars, old ? old.stars : 0), time: Math.min(secs, old ? old.time : secs) };
        localStorage.setItem(key, JSON.stringify(all));
      } catch (e) { /* armazenamento bloqueado: segue sem recorde */ }
      $('done-rec').textContent = notes.join(' · ');
      show(ui.done, true); G.state = 'done';
    }, 700);
  }
  function gameOver() {
    player.dead = true; G.state = 'over'; G.fadeTarget = 0.35; syncMusic(); if (AU) AU.sting('over');
    setTimeout(() => { show(ui.over, true); }, 650);
  }

  /* ---------------------------------------------------------------- controle de fluxo */
  async function beginRun(stage) {
    G.hearts = 3; G.totalNuts = 0; G.totalKills = 0;
    await startStage(stage || 0);
  }
  async function startStage(stage) {
    hideAll(); G.state = 'loading'; G.fadeTarget = 0;
    await loadStage(stage);
    showHud(true);
    ui.cardNum.textContent = `Fase ${stage + 1} de 5`; ui.cardName.textContent = G.lv.name;
    show(ui.card, true);
    G.fade = 0; G.fadeTarget = 1; G.state = 'playing'; syncMusic();
    EV.emit('stageStart', stage);
    setTimeout(() => show(ui.card, false), 2300);
    if (stage === 0) setTimeout(() => { if (G.state === 'playing') toast(matchMedia('(pointer:coarse)').matches ? 'Bater: dá um tabefe nos bichos' : 'J: dá um tabefe nos bichos', 2600); }, 2600);
  }
  function togglePause() {
    if (G.state === 'playing') { G.state = 'paused'; show(ui.pause, true); syncMusic(); }
    else if (G.state === 'paused') { G.state = 'playing'; show(ui.pause, false); syncMusic(); }
  }
  function placeTitlePlayer() { const tx = 300; const ty = surfaceBelow(tx, 0); player.x = tx; player.grounded = true; player.y = ty - player.h; player.invuln = 0; player.vx = 0; player.vy = 0; }
  async function toTitle() {
    hideAll(); showHud(false);
    await loadStage(0);
    placeTitlePlayer();
    G.state = 'title'; G.fadeTarget = 1; show(ui.title, true); syncMusic();
  }

  /* ---------------------------------------------------------------- render */
  const LIGHT = { warm: [1.0, 0.78, 0.45], fire: [1.0, 0.7, 0.3], green: [0.6, 1.0, 0.5], cool: [0.8, 0.9, 1.0] };

  function addLights(cam) {
    const L = R.lights; L.length = 0;
    const m = G.mood, lk = m.lanternK;
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    if (G.state !== 'title') L.push({ x: pcx, y: pcy - 6, z: 90, r: 240, c: [1, 0.84, 0.55], k: 0.15 + 0.3 * lk + (player.finishing ? 0.4 : 0) });
    else L.push({ x: pcx, y: pcy - 6, z: 90, r: 260, c: [1, 0.84, 0.55], k: 0.45 + 0.3 * lk });
    const cand = [];
    for (const c of G.cps) if (c.x > cam - 200 && c.x < cam + WW + 200) cand.push({ x: c.x, y: c.y - 38, z: 40, r: 260, c: LIGHT.fire, k: c.on ? 0.9 + 0.5 * lk : 0.15, d: Math.abs(c.x - pcx) - 400 });
    const g = G.lv.goal;
    if (g.x > cam - 300 && g.x < cam + WW + 300) cand.push({ x: g.x + 150, y: g.y - 36, z: 50, r: 320, c: [1, 0.95, 0.7], k: 1.1 + 0.8 * lk, d: Math.abs(g.x - pcx) - 500 });
    for (const f of G.flies) { const fx = flyPos(f); if (fx.x > cam - 100 && fx.x < cam + WW + 100) cand.push({ x: fx.x, y: fx.y, z: 40, r: 150, c: LIGHT.green, k: 0.45 * (0.6 + 0.4 * Math.sin(G.time * 3 + f.ph)), d: Math.abs(fx.x - pcx) }); }
    let near = 0;
    for (const n of G.nuts) {
      if (n.taken || n.x < cam - 40 || n.x > cam + WW + 40) continue;
      cand.push({ x: n.x, y: n.y, z: 44, r: 110, c: LIGHT.warm, k: (n.golden ? 0.6 : 0.22) * (0.6 + lk * 0.3), d: Math.abs(n.x - pcx) + 120 });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) { if (L.length >= 8) break; L.push(c); }
  }

  function flyPos(f) {
    const base = G.camX * 0.9 - 100;
    const x = base + ((f.x + G.time * 14 * f.sp - G.camX * 0.9 * 0.0) % 1200) + Math.sin(G.time * 0.7 * f.sp + f.ph) * 30;
    const y = f.y + Math.sin(G.time * 0.9 * f.sp + f.ph * 2) * 26;
    return { x, y };
  }

  function drawActors(t) {
    const lv = G.lv, rc = rects, set = atlas.set, cam = G.camX;
    const spr = (name, x, y, sx, sy, o) => R.sprite(set, rc[name], x, y, sx, sy, o);

    // sombras de contato
    const blob = (x, y, w, a) => { const sb = surfaceBelow(x, y - 4); if (sb > 1e8) return; const d = clamp((sb - y) / 160, 0, 1); R.sprite(set, rc.glow, x - w * (1 - d * 0.4), sb - 4, (w * 2 * (1 - d * 0.4)) / 64, 8 / 64, { col: [0, 0, 0, a * (1 - d * 0.7)], lit: 0, noSnap: true }); };

    // decoração atrás
    for (const d of G.decor) {
      if (d.x < cam - 40 || d.x > cam + WW + 40 || d.z !== 0) continue;
      const r0 = rc[d.name];
      if (d.kind === 'twig') spr(d.name, d.x + (d.flip < 0 ? 1 : -1) * r0.w * S / 2, d.y - r0.h * S, (d.flip || 1) * S, S, { fog: 0.05, shear: Math.sin(t * 1.9 + d.ph + d.x * 0.013) * 2.2 });
      else if (d.kind === 'mush') spr(d.name, d.x, d.y - r0.h * S, S, S, { emit: d.glow ? 0.9 : 0.05 });
      else if (d.kind === 'flower') spr(d.name, d.x, d.y - r0.h * S, S, S, { shear: Math.sin(t * 1.4 + d.ph) * 2 });
    }

    // checkpoints
    for (const c of G.cps) {
      if (c.x < cam - 40 || c.x > cam + WW + 40) continue;
      const pr = rc.post;
      spr('post', c.x - pr.w, c.y - pr.h * S + 2, S, S);
      const lr = rc[c.on ? 'lantern_on' : 'lantern_off'];
      const sw = Math.sin(t * 1.6 + c.x) * 1.2;
      spr(c.on ? 'lantern_on' : 'lantern_off', c.x - lr.w + sw, c.y - pr.h * S + 18, S, S, { emit: c.on ? 1.6 : 0 });
    }

    // caminhão
    {
      const g = lv.goal, tr = rc.truck;
      if (g.x > cam - 200 && g.x < cam + WW + 200) {
        const dark = [0, 0.1, 0.3, 0.55, 0.45][G.lv.mood] || 0.3;           // fases escuras pedem mais luz de preenchimento
        R.setBlend('add');
        R.sprite(set, rc.glow, g.x + tr.w * S * 0.5 - 150, g.y - 90, 300 / 64, 110 / 64, { col: [1, 0.78, 0.45, 0.16 + dark * 0.2], lit: 0, noSnap: true, emit: 0 });
        R.setBlend('alpha');
        const k = 1.35 + dark * 0.5;
        spr('truck', g.x - 6, g.y - tr.h * S + 4, S, S, { emit: 0.28 + dark * 0.35, col: [k, k * 0.97, k * 0.92] });
        const open = G.collected >= lv.required;
        const pul = 0.5 + 0.5 * Math.sin(t * 4);
        const big = tr.w > 100, hx = big ? g.x + 216 : g.x + 146, hy = big ? g.y - 58 : g.y - 30;   // farol
        R.sprite(set, rc.glow, hx - 40, hy - 40, 80 / 64, 80 / 64, { col: [1, 0.92, 0.6, open ? 0.5 + pul * 0.3 : 0.18], lit: 0, noSnap: true, emit: 0 });
      }
    }

    // castanhas
    for (const n of G.nuts) {
      if (n.taken || n.x < cam - 30 || n.x > cam + WW + 30) continue;
      const bob = Math.sin(t * 2.6 + n.ph) * 3.5;
      const fr = 'acorn_' + (1 + (Math.floor(t * 5 + n.ph) % 3));
      const s = n.golden ? 2.6 : 2;
      blob(n.x, n.y + 14, 9, 0.28);
      spr(fr, n.x - 8 * s, n.y + bob - 7 * s, s, s, { emit: n.golden ? 0.8 : 0.28, col: n.golden ? [1.35, 1.1, 0.4] : [1, 1, 1] });
    }

    // inimigos
    for (const e of G.enemies) {
      if (e.x + e.w < cam - 60 || e.x > cam + WW + 60) continue;
      const cx = e.x + e.w / 2, fy = e.y + e.h;
      if (e.dead) {
        if (e.def.drawDead && e.def.drawDead(e, t, API)) continue;   // mortes próprias dos tipos novos (js/enemies.js)
        if (e.deadT > 0.95) continue;
        // morte à Metal Slug: clarão branco, pulinho exagerado, giro e queda
        const tt = e.deadT, fr = 'death_' + (1 + Math.min(3, Math.floor(tt / 0.1)));
        const dy = -(300 * tt - 760 * tt * tt), w = tt < 0.09 ? 2.8 : 1, al = tt > 0.55 ? 1 - (tt - 0.55) / 0.4 : 1;
        spr(fr, cx - 14 * S, fy - 26 * S + 4 + dy, S * (1 + Math.max(0, 0.25 - tt)), S * (1 + Math.max(0, 0.25 - tt)), { col: [w, w, w, al], rot: tt * 11 * (e.dir || 1), px: 14 * S, py: 13 * S });
        continue;
      }
      if (e.def.draw) { e.def.draw(e, t, API); continue; }
      let name, ax, ay;
      if (e.type === 'ant') { name = 'ant_' + (1 + (Math.floor(e.anim * 14) % 8)); ax = 18; ay = 30; }
      else if (e.type === 'gator') { name = 'gator_' + (1 + (Math.floor(e.anim * 5) % 4)); ax = 24; ay = 46; }
      else if (e.air) { name = (e.vy < 0 ? 'hopjump_' : 'hopfall_') + (1 + (Math.floor(e.anim * 8) % 2)); ax = 26; ay = 41; }
      else { name = 'hopidle_' + (1 + (Math.floor(e.anim * 5) % 4)); ax = 25; ay = 32; }
      const dim = e.stun > 0 ? 0.6 + 0.4 * Math.sin(t * 40) : 1;
      const flip = e.dir > 0 ? -1 : 1;                       // sprites originais olham para a ESQUERDA
      // expressividade: antecipação antes do pulo, esticada no ar, tremedeira de pânico ao tomar golpe
      let ex = 1, ey = 1, er = 0;
      if (e.stun > 0) { er = Math.sin(t * 55) * 0.14; ey = 1.08; ex = 0.95; }
      else if (e.type === 'hopper') { if (e.air) { ey = 1.14; ex = 0.9; } else if (e.hopT < 0.32) { ey = 0.82; ex = 1.14; } }
      else if (e.type === 'ant') { ey = 1 + 0.05 * Math.sin(e.anim * 30); ex = 1 - 0.03 * Math.sin(e.anim * 30); }
      else if (e.type === 'gator') { const near = Math.abs(cx - (player.x + player.w / 2)) < 230; ey = 1 + (near ? 0.06 : 0.025) * Math.sin(t * (near ? 11 : 4)); er = near ? -0.05 * flip * Math.sin(t * 9) : 0; }
      const r0 = rc[name];
      blob(cx, e.air ? e.floorY : fy, 22, 0.32);
      const offX = (flip < 0 ? (r0.w - ax) * S : ax * S) * ex;
      const hf = e.stun > 0.36 ? 2.6 : dim;      // 1-2 quadros de clarão branco ao tomar o golpe
      spr(name, cx - offX, fy - ay * S * ey, flip * S * ex, S * ey, { col: [hf, hf, hf, 1], rot: er, px: offX, py: ay * S * ey });
    }

    // jogador
    drawPlayer(t, blob);

    // decoração à frente (grama balança e se curva quando o esquilo passa)
    const pcx = player.x + player.w / 2;
    for (const d of G.decor) {
      if (d.x < cam - 40 || d.x > cam + WW + 40 || d.z !== 1) continue;
      const r0 = rc[d.name];
      let sh = Math.sin(t * 1.7 + d.ph + d.x * 0.01) * 2.4;
      const dx = d.x - pcx, dy = Math.abs(d.y - (player.y + player.h));
      if (Math.abs(dx) < 46 && dy < 40) sh += Math.sign(dx || 1) * (46 - Math.abs(dx)) * 0.22;
      spr(d.name, d.x - r0.w, d.y - r0.h * S, S, S, { shear: sh });
    }
  }

  function drawPlayer(t, blob) {
    if (player.dead && G.state === 'over') return;
    const set = atlas.set, rc = rects, A = RC.PLAYER_ANCHORS;
    if (!A.glide) { A.glide = RC.GLIDE_ANCHORS || [[45, 30, 0, 'head']]; A.pound = [[43, 27, 0, 'ball']]; }
    let anim, n, rate, fy = 47, ax = 40, ay = 47, cidx;
    let lineRot = 0;
    if (player.hurtT > 0) { anim = 'hurt'; n = 2; rate = 8; ax = 40; ay = 44; }
    else if (player.vine) { anim = 'jump'; n = 1; rate = 1; ax = 43; ay = 36; lineRot = -player.vine.th * 0.85; }        // pendurado, inclinado com o cipó
    else if (player.rope) { anim = 'jump'; n = 2; rate = Math.abs(player.vy) > 10 ? 9 : 0.001; ax = 43; ay = 36; }   // subindo: alterna dois quadros
    else if (player.swim) { anim = 'jump'; n = 4; rate = 6; ax = 43; ay = 36; lineRot = clamp(player.vx / 400, -0.35, 0.35) * player.facing; }
    else if (player.dash > 0) {
      // mesma pose da cambalhota do pulo duplo: o Rei rola uma volta inteira e termina de pé
      const u = (player.dashDur - player.dash) / player.dashDur;
      anim = 'jump'; n = 1; rate = 1; ax = 43; ay = 36; lineRot = player.facing * Math.PI * 2 * u;
    }
    else if (player.pound) { anim = 'pound'; n = 1; rate = 1; ax = 43; ay = 36; }
    else if (player.flipT > 0 && !player.grounded) { anim = 'jump'; n = 1; rate = 1; ax = 43; ay = 36; lineRot = player.facing * (1 - player.flipT / 0.34) * Math.PI * 2; }   // cambalhota do pulo duplo
    else if (player.gliding) { anim = 'glide'; n = 4; rate = 11; ax = 42; ay = 30; }
    else if (!player.grounded) { anim = 'jump'; n = 4; rate = 15; ax = 43; ay = 36; }
    else if (Math.abs(player.vx) > 40 || player.finishing) { anim = 'run'; n = 6; rate = 8 + Math.abs(player.vx) / 28; }
    else { anim = 'idle'; n = 8; rate = 8; }
    let idx = Math.floor(player.animT * rate) % n;
    let f = player.facing, dyOff = 0, msx = 1, msy = 1, dTilt = 0;
    const atkEl = player.atk > 0 ? ATK.DUR - player.atk : -1;
    if (atkEl >= 0 && player.hurtT <= 0) {
      // preparo agachado, depois o bote para a frente
      if (atkEl < ATK.ON) { anim = 'crouch'; idx = 1; } else { anim = 'run'; idx = 1; msx = 1.08; }
      ax = 40; ay = 47; dTilt = (atkEl < ATK.ON ? -0.12 : 0.18) * f;
    } else if (anim === 'idle' && player.idleT > DANCE_AFTER) {
      // dança em 8 tempos: balanço, giro, agachada, pulinho, giro de volta, bate-cabeça
      const beat = (player.idleT - DANCE_AFTER) / BEAT, step = Math.floor(beat) % 8, ph = beat % 1;
      const bounce = Math.abs(Math.sin(ph * Math.PI));
      if (step !== player.lastBeat) {
        player.lastBeat = step;
        if (step === 0 || step === 4) burst('spark', player.x + player.w / 2, player.y - 8, 4, 90, { col: [1, 0.85, 0.4], life: 0.6, size: 0.8 });
      }
      if (step <= 1) { anim = 'idle'; idx = (step * 2 + (ph > 0.5 ? 1 : 0)) % 8; dyOff = -bounce * 6; msy = 1 - (1 - bounce) * 0.08; msx = 1 + (1 - bounce) * 0.06; }
      else if (step === 2) { anim = 'idle'; idx = 4; f = -f; dyOff = -bounce * 5; }
      else if (step === 3) { anim = 'crouch'; idx = ph < 0.5 ? 0 : 1; f = -f; msy = 0.94; }
      else if (step === 4) { anim = 'run'; idx = 1; dyOff = -bounce * 20; msx = 0.94; msy = 1.06; dTilt = 0.1 * f; }
      else if (step === 5) { anim = 'crouch'; idx = 1; msy = 0.92; }
      else { anim = ph * 2 % 1 < 0.5 ? 'idle' : 'crouch'; idx = 0; dTilt = Math.sin(beat * Math.PI * 4) * 0.25; dyOff = -Math.abs(Math.sin(beat * Math.PI * 2)) * 3; }
    }
    const name = `${anim}_${idx + 1}`, r0 = rc[name];
    const cx = player.x + player.w / 2;
    const cyAnchor = (anim === 'jump' || anim === 'glide' || anim === 'pound' ? player.y + player.h / 2 : player.y + player.h) + dyOff;
    const sx = player.sx * msx, sy = player.sy * msy;
    const flicker = player.invuln > 0 && player.invuln < 90 && Math.floor(t * 18) % 2 === 0 && player.hurtT <= 0 ? 0.35 : 1;
    // origem do sprite: esquerda/topo conforme espelhamento
    const offX = (f > 0 ? ax : r0.w - ax) * S * sx;
    const left = cx - offX, top = cyAnchor - ay * S * sy;
    if (G.state !== 'title' && !player.vine && !player.rope && !player.swim) blob(cx, player.y + player.h, 22, 0.4);
    // rastro de vultos na arrancada e no arremesso do cipó (lê como velocidade, à la Silksong)
    const fast = player.dash > 0 || (!player.grounded && Math.abs(player.vx) > PH.RUN * 1.25);
    G.ghostT = (G.ghostT || 0) - 1 / 60;
    if (fast && G.ghostT <= 0 && G.state === 'playing') { G.ghostT = 0.05; (G.ghosts = G.ghosts || []).push({ r: r0, left, top, sx: f * S * sx, sy: S * sy, a: player.dash > 0 ? 0.22 * smooth(player.dash / DASH.OUT + 0.2) : 0.3, rot: lineRot }); }
    if (G.ghosts) for (let i = G.ghosts.length - 1; i >= 0; i--) {
      const gh = G.ghosts[i]; gh.a -= 1 / 60 * 1.9; if (gh.a <= 0) { G.ghosts.splice(i, 1); continue; }
      R.sprite(set, gh.r, gh.left, gh.top, gh.sx, gh.sy, { col: [0.55, 0.85, 1.4, gh.a * 0.7], lit: 0, emit: 0.6, rot: gh.rot, px: (cx - gh.left), py: (gh.top < top ? top - gh.top : 0) + ay * S * sy });
    }
    // tracinhos de velocidade (estilo desenho animado): riscos finos que nascem atrás do Rei e esticam/somem
    G.lines = G.lines || [];
    const zoom = player.dash > 0 ? 1 : (!player.grounded && Math.abs(player.vx) > PH.RUN * 1.3 ? 0.5 : 0);
    if (zoom && G.state === 'playing') for (let k = 0; k < (zoom >= 1 ? 2 : 1); k++) if (Math.random() < zoom * 0.9) {
      const dirx = Math.sign(player.vx) || f;
      G.lines.push({ x: cx - dirx * (8 + Math.random() * 16), y: player.y - 4 + Math.random() * (player.h + 8), dir: dirx, len: 0, max: 50 + Math.random() * 70, t: 0, w: Math.random() < 0.35 ? 3 : 2 });
    }
    for (let i = G.lines.length - 1; i >= 0; i--) {
      const L = G.lines[i]; L.t += 1 / 60; if (L.t > 0.22) { G.lines.splice(i, 1); continue; }
      const k = L.t / 0.22, len = L.max * Math.min(1, k * 2.4), a = (1 - k * k) * 0.95;
      const x0 = L.dir > 0 ? L.x - len : L.x;
      R.sprite(set, rc.dot, x0, L.y - L.w / 2, len / rc.dot.w, L.w / rc.dot.h, { col: [1, 0.97, 0.88, a], lit: 0, noSnap: true });
      R.sprite(set, rc.dot, L.dir > 0 ? x0 - len * 0.35 : x0 + len, L.y - 0.5, (len * 0.35) / rc.dot.w, 1 / rc.dot.h, { col: [1, 0.97, 0.88, a * 0.5], lit: 0, noSnap: true });   // ponta afinando
    }
    if (player.dash > 0 && player.dashDur - player.dash < 1 / 60 + 0.001 && G.state === 'playing') {   // arranque: leque de riscos curtos atrás
      for (let k = 0; k < 5; k++) G.lines.push({ x: cx - f * 18, y: player.y + 6 + k * (player.h - 10) / 4, dir: f, len: 0, max: 50 + k % 2 * 30, t: 0, w: 3 });
    }
    const spOpt = { col: [1, 1, 1, flicker], emit: 0.05 };
    if (lineRot) { spOpt.rot = lineRot; spOpt.px = cx - left; spOpt.py = cyAnchor - top; }
    R.sprite(set, r0, left, top, f * S * sx, S * sy, spOpt);

    // coroa: âncora medida por frame (cabeça muda de lugar em cada pose)
    const anc = A[anim][idx];
    const hx = f > 0 ? anc[0] : r0.w - anc[0];
    let hxw = left + hx * S * sx, hyw = top + anc[1] * S * sy;
    if (lineRot) { const c0 = Math.cos(lineRot), s0 = Math.sin(lineRot), dx0 = hxw - cx, dy0 = hyw - cyAnchor; hxw = cx + dx0 * c0 - dy0 * s0; hyw = cyAnchor + dx0 * s0 + dy0 * c0; }
    const crown = rc.crown;
    const tilt = clamp(player.vx / PH.RUN, -1, 1) * 0.12 * f + (anim === 'jump' ? Math.sin(player.animT * 10) * 0.05 : anim === 'glide' ? 0.06 * f * Math.sin(player.animT * 7) : 0) + dTilt + lineRot;
    R.sprite(set, crown, hxw - (crown.w / 2) * S, hyw - crown.h * S + 3, S, S, { rot: tilt, px: (crown.w / 2) * S, py: crown.h * S - 3, emit: 0.55, col: [1, 1, 1, flicker] });
    G.crownPos = [hxw, hyw];

    // rastro do golpe: arco de luz à frente, de cima para baixo
    if (atkEl >= 0 && atkEl < ATK.OFF + 0.07) {
      const fin = player.combo === 3, prog = clamp((atkEl - ATK.ON * 0.4) / (ATK.OFF - ATK.ON * 0.4), 0, 1);
      const fade = atkEl > ATK.OFF ? 1 - (atkEl - ATK.OFF) / 0.07 : 1;
      const ox = cx + f * 14, oy = player.y + player.h * 0.42, rad = fin ? 44 : 36, segs = 9;
      R.setBlend('add');
      for (let i = 0; i < segs; i++) {
        const u = i / (segs - 1); if (u > prog) break;
        const a = lerp(-1.2, 1.05, u), age = prog - u;
        const al = clamp(1 - age * 2.2, 0, 1) * fade * (fin ? 0.5 : 0.38), s = (0.1 + 0.12 * (1 - age)) * (fin ? 1.3 : 1);
        const px = ox + f * Math.cos(a) * rad, py = oy + Math.sin(a) * rad;
        R.sprite(set, rc.glow, px - 32 * s, py - 32 * s, s, s, { col: fin ? [1, 0.75, 0.3, al] : [1, 0.6, 0.22, al], lit: 0, noSnap: true });
      }
      R.setBlend('alpha');
    }
  }

  function drawParticles(t) {
    const set = atlas.set, rc = rects;
    for (const p of G.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'spark') {
        R.setBlend('add');
        const s = (0.18 + 0.35 * a) * p.size;
        R.sprite(set, rc.glow, p.x - 32 * s, p.y - 32 * s, s, s, { col: [p.col[0], p.col[1], p.col[2], a], lit: 0, noSnap: true });
        R.setBlend('alpha');
      } else if (p.kind === 'dust') {
        const s = (1 + (1 - a) * 1.6) * p.size;
        R.sprite(set, rc.dot, p.x - 2 * s, p.y - 2 * s, s, s, { col: [0.82, 0.74, 0.62, a * 0.5], lit: 0, noSnap: true });
      } else if (p.kind === 'leaf') {
        R.sprite(set, rc[p.name], p.x, p.y, S, S, { rot: p.rot, lit: 1, col: [1, 1, 1, Math.min(1, a * 3)] });
      }
    }
  }

  function updateParticles(dt) {
    const arr = G.parts;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    }
    // folhas caindo
    const m = G.mood;
    if (m && G.state !== 'boot' && Math.random() < dt * 3.5 * m.leaves) {
      const names = m.id === 'entardecer' || m.id === 'amanhecer' ? ['leaf_1', 'leaf_2', 'leaf_0'] : ['leaf_0', 'leaf_0', 'leaf_1'];
      emit('leaf', G.camX + Math.random() * (WW + 160) - 40, -10, { vx: -20 - Math.random() * 25, vy: 24 + Math.random() * 20, life: 12, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2.4, name: names[Math.floor(Math.random() * names.length)], g: 0 });
    }
  }

  /* ?debug=1: hitboxes, patrulhas, plataformas e avisos do validador de posicionamento */
  const DEBUG = q.get('debug') === '1';
  let dbgCv = null, dbgLv = null, dbgWarn = [];
  function drawDebug() {
    const lv = G.lv; if (!lv) return;
    const stage = document.getElementById('stage');
    if (!dbgCv) { dbgCv = document.createElement('canvas'); dbgCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none'; stage.appendChild(dbgCv); }
    if (dbgLv !== lv) { dbgLv = lv; dbgWarn = LG.placementIssues ? LG.placementIssues(lv) : []; }
    const w = stage.clientWidth, h = stage.clientHeight;
    if (dbgCv.width !== w) { dbgCv.width = w; dbgCv.height = h; }
    const c = dbgCv.getContext('2d'), k = w / WW, cam = G.camX;
    c.clearRect(0, 0, w, h); c.lineWidth = 1.5; c.font = `${Math.max(10, 11 * k)}px monospace`;
    const X = (x) => (x - cam) * k, Y = (y) => y * k, box = (x, y, bw, bh, col) => { c.strokeStyle = col; c.strokeRect(X(x), Y(y), bw * k, bh * k); };
    for (const p of lv.platforms) box(p.x, p.y, p.w, 10, p.bonus ? '#ff0' : '#0f8');
    for (const e of G.enemies) {
      if (e.dead) continue;
      box(e.x, e.y, e.w, e.h, '#f33');
      const L0 = e.pl != null ? e.pl : e.left, R0 = e.pr != null ? e.pr : e.right;
      if (L0 != null && R0 != null) { c.strokeStyle = 'rgba(255,120,60,.9)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(X(L0), Y(e.y + e.h + 4)); c.lineTo(X(R0), Y(e.y + e.h + 4)); c.stroke(); c.setLineDash([]); }
    }
    for (const q2 of lv.props) if (q2.type === 'crate') box(q2.x - 20, q2.y - 40, 40, 40, '#6cf'); else box(q2.x - 18, q2.y - 30, 36, 30, '#6cf');
    for (const cp of lv.checkpoints) box(cp.x - 12, cp.y - 40, 24, 40, '#fc6');
    for (const n of G.nuts) if (!n.taken) { c.strokeStyle = n.golden ? '#fd0' : '#9f9'; c.strokeRect(X(n.x - 6), Y(n.y - 6), 12 * k, 12 * k); }
    box(player.x, player.y, player.w, player.h, '#0ff');
    c.fillStyle = '#fff'; c.fillText(`debug  avisos do validador: ${dbgWarn.length}  inimigos: ${G.enemies.length}  castanhas: ${lv.nuts.length}`, 8, h - 8);
    c.fillStyle = '#f0f';
    for (const w2 of dbgWarn) { c.beginPath(); c.arc(X(w2.x), Y(w2.y - 20), 6 * k, 0, 6.3); c.fill(); c.fillText(w2.msg, X(w2.x) + 8, Y(w2.y - 24)); }
  }

  function render(t) {
    const m = G.mood, lv = G.lv;
    if (!m || !lv) return;
    let cam = G.camX;
    if (G.state === 'title') cam = clamp(G.camX + (G.mouseX - 0.5) * 80, 0, lv.width - WW);
    const shk = G.shake > 0.05 ? [(Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake] : [0, 0];
    R.begin(Math.round((cam + shk[0]) * 2) / 2, shk[1], t);
    const E = R.env;
    E.ambient = m.ambient; E.sunDir = m.sunDir; E.sunCol = m.sunCol; E.fog = m.fog;
    R.drawSky(m);

    const L = (set, par, y, dark, light, o) => R.drawLayer(set, par, bg.tile, y, bg.h, m, Object.assign({ dark, light }, o));
    const mul = (c, k) => c.map((v) => v * k);
    L(bg.mountains, 0.04, 0, m.mtnDark, m.mtnLight, { haze: 0.2, fogBottom: 0.55 });
    R.drawMist(m, 0.05, 330, 0.4, 0.8);
    L(bg.far, 0.09, 0, mul(m.fDark, 1.1), mul(m.fLight, 0.8), { haze: 0.34, fogBottom: 0.5 });
    R.drawMist(m, 0.1, 360, 0.36, 1.0);
    L(bg.mid, 0.2, 0, m.fDark, mul(m.fLight, 1.0), { haze: 0.1, fogBottom: 0.3 });
    R.drawMist(m, 0.22, 400, 0.34, 1.3);
    // raios de luz
    drawShafts(t, cam);
    L(bg.near, 0.4, 0, mul(m.fDark, 0.5), mul(m.fLight, 0.75), { haze: 0.04, fogBottom: 0.15 });

    addLights(cam);
    R.flush();
    // separação do plano de ação: escurece/dessatura levemente o fundo (só em fases de dia)
    if ((G.mood && lv.mood) !== undefined) {
      const a = [0.2, 0.2, 0.16, 0.0, 0.0][lv.mood] || 0;
      if (a > 0) R.sprite(atlas.set, rects.dot, cam - 10, -10, (WW + 20) / rects.dot.w, (WH + 20) / rects.dot.h, { col: [0.06, 0.05, 0.1, a], lit: 0, noSnap: true });
    }
    // terreno
    for (const c of G.res.chunks) {
      if (c.x0 > cam + WW || c.x0 + c.w < cam) continue;
      R.sprite(c.set, { x: 0, y: 0, w: c.texW, h: c.texH }, c.x0, 0, S, S, { noSnap: true });
    }
    // galhos
    const B = G.res.branches;
    lv.platforms.forEach((p, i) => {
      if (p.x + p.w < cam - 20 || p.x > cam + WW + 20 || p.off || p.mech) return;
      const it = B.items[i]; if (!it) return;
      const jx = p.cT > 0 ? Math.sin(t * 90) * 1.6 : 0, jy = p.cT > 0 ? (0.5 - p.cT) * 3 : 0;
      R.sprite(B.set, { x: it.x, y: it.y, w: it.W, h: it.Hh }, p.x - 4 * S + jx, p.y - B.topTexel * S + jy, S, S, { noSnap: false, col: p.crumble ? [1.25, 1.05, 0.8] : [1, 1, 1] });
    });
    EV.emit('drawBehind', t, cam);
    R.setRim(0.3); drawActors(t); R.setRim(0);
    EV.emit('drawFront', t, cam);
    drawParticles(t);
    // vaga-lumes (aditivo)
    R.setBlend('add');
    for (const f of G.flies) {
      const fp = flyPos(f);
      if (fp.x < cam - 40 || fp.x > cam + WW + 40) continue;
      const a = 0.55 + 0.45 * Math.sin(t * 3.2 + f.ph * 3), s = f.r / 64 * (0.8 + 0.3 * a);
      R.sprite(atlas.set, rects.glow, fp.x - 32 * s, fp.y - 32 * s, s * 1, s * 1, { col: [0.75, 1, 0.45, a], lit: 0, noSnap: true });
    }
    // brilho das castanhas e lampiões
    for (const c of G.cps) if (c.on && c.x > cam - 100 && c.x < cam + WW + 100) {
      const s = 2.2 + Math.sin(t * 7 + c.x) * 0.15;
      R.sprite(atlas.set, rects.glow, c.x - 32 * s, c.y - 76 - 32 * s + 24, s, s, { col: [1, 0.7, 0.3, 0.55], lit: 0, noSnap: true });
    }
    if (G.crownPos && G.state !== 'over') {
      const s = 0.5 + Math.sin(t * 5) * 0.04;
      R.sprite(atlas.set, rects.glow, G.crownPos[0] - 32 * s, G.crownPos[1] - 14 - 32 * s, s, s, { col: [1, 0.85, 0.4, 0.45], lit: 0, noSnap: true });
    }
    EV.emit('drawAdd', t, cam);
    R.setBlend('alpha');
    // primeiro plano desfocado
    R.flush();
    R.drawMotes(m, 3 - Math.min(qualityIdx, 3)); // esporos flutuantes (menos camadas em qualidade baixa)
    R.drawLayer(bg.fore, 1.45, bg.tile, 0, bg.h, m, { dark: mul(m.fDark, 0.18), light: mul(m.fDark, 0.55), haze: 0, alpha: 0.96 });

    const fx = { flash: G.flash, flashCol: G.hearts <= 1 ? [1, 0.2, 0.2] : [1, 0.9, 0.8], aberr: G.aberr, fade: G.fade, satMul: G.state === 'over' ? 0.45 : 1 };
    R.post(m, fx);
  }

  function drawShafts(t, cam) {
    const m = G.mood; if (m.rays < 0.5) return;
    R.setBlend('add');
    const dirSign = m.sunPos[0] > 0.5 ? -1 : 1;
    const par = 0.24;
    for (let i = 0; i < 9; i++) {
      const base = i * 420 + ((i * 97) % 130);
      let x = base - (cam * par) % 3780;
      x = ((x % 3780) + 3780) % 3780 - 300;
      const w = 90 + (i * 53) % 80;
      const a = (0.045 + 0.03 * Math.sin(t * 0.4 + i * 1.7)) * m.rays;
      R.sprite(atlas.set, rects.shaft, x, -20, w / 64, 640 / 256, { col: [m.rayCol[0], m.rayCol[1], m.rayCol[2], a], lit: 0, noSnap: true, shear: dirSign * 170 });
    }
    R.setBlend('alpha');
  }

  /* ---------------------------------------------------------------- loop */
  let last = performance.now(), accFps = 0, nFps = 0, slowT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    // qualidade adaptativa
    accFps += dt; nFps++;
    if (accFps > 2.5) {
      const avg = accFps / nFps; accFps = 0; nFps = 0;
      if (avg > 1 / 38 && qualityIdx < QUALITY.length - 1 && G.state === 'playing') { qualityIdx++; R.resize(QUALITY[qualityIdx]); }
    }
    G.time += dt;
    pollPad(dt);
    if (G.hitstop > 0) { G.hitstop -= dt; dt = 0; }
    if (G.state === 'playing') {
      // física em subpassos de no máximo 1/240 s: o pulo tem a mesma altura a 30, 60 ou 144 Hz
      // (o gerador de fases conta com o pulo "ideal"); para se a fase acabar ou um impacto congelar a tela
      const n = Math.max(1, Math.ceil(dt * 240 - 1e-6)), h = dt / n;
      for (let i = 0; i < n && G.state === 'playing' && !(i && G.hitstop > 0); i++) updateWorld(h);
    }
    else if (G.state === 'title') {
      player.animT += dt; player.idleT += dt; G.camX = 0;
    }
    if (G.state === 'over' || G.state === 'done' || G.state === 'paused') { /* congela mundo */ }
    if (G.state !== 'paused') updateParticles(dt);
    G.shake = Math.max(0, G.shake - dt * 28); G.flash = Math.max(0, G.flash - dt * 2.4); G.aberr = Math.max(0, G.aberr - dt * 0.2);
    G.fade += (G.fadeTarget - G.fade) * (1 - Math.exp(-dt * 4));
    if (G.state === 'title') ui.toast.classList.remove('show');
    for (const p of (G.lv && G.state === 'playing' && !G.dialogue) ? G.lv.platforms : []) if (p.crumble) {
      if (p.cT > 0) { p.cT -= dt; if (p.cT <= 0) { p.off = true; p.offT = 2.8; burst('dust', p.x + p.w / 2, p.y + 6, 10, 110, { col: [0.45, 0.3, 0.18], life: 0.7, size: 1.3 }); burst('leaf', p.x + p.w / 2, p.y, 5, 120, { name: 'leaf_1', g: 500, vr: 6, life: 0.9 }); sfx('kill', 0.2, 0.6); } }
      else if (p.off) { p.offT -= dt; if (p.offT <= 0) { p.off = false; p.cT = 0; } }
    }
    if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) ui.toast.classList.remove('show'); }
    if (G.lv) render(G.time);
    if (DEBUG) drawDebug();
    EV.emit('drawHud', G.time);
  }

  /* ---------------------------------------------------------------- entrada */
  const kbTap = { d: 0, t: -9 };
  window.addEventListener('keydown', (e) => {
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'Escape', 'KeyP', 'Enter', 'KeyJ', 'KeyS', 'ShiftLeft', 'ShiftRight', 'KeyL'];
    const t = e.target, onField = !!t && /INPUT|TEXTAREA/.test(t.tagName), onButton = !!t && t.tagName === 'BUTTON';
    if (handled.includes(e.code) && !(onField && e.code !== 'Escape')) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
    if (e.code === 'Enter' && G.state === 'title' && !onButton) { $('btn-play').click(); return; }
    if (topScreen()) {
      document.body.classList.add('kbd-nav');
      if (e.code === 'Tab') { e.preventDefault(); moveFocus(e.shiftKey ? -1 : 1); return; }   // Tab gira dentro da tela
      // Enter/Espaço apertam o botão focado; as setas andam entre os botões da tela de cima.
      if (onButton && (e.code === 'Enter' || e.code === 'Space')) { if (!e.repeat) t.click(); return; }
      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.code];
      if (step && !(onField && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) { moveFocus(step); return; }
    }
    if (!e.repeat && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) { player.buf = PH.BUFFER; }
    if (!e.repeat && e.code === 'KeyJ' && G.state === 'playing') player.atkBuf = ATK.BUF;          // um só botão de tabefe
    // toque duplo no teclado direto no evento: toques rápidos demais para caber entre dois quadros também valem
    const tapD = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[e.code];
    if (tapD && !e.repeat && G.state === 'playing') {
      const now = performance.now() / 1000;
      if (kbTap.d === tapD && now - kbTap.t < DASH.TAP) { player.rollReq = true; kbTap.d = 0; player.tapDir = 0; } else { kbTap.d = tapD; kbTap.t = now; }
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); if (G.state === 'playing') togglePause(); });
  window.addEventListener('mousemove', (e) => { G.mouseX = e.clientX / innerWidth; });
  window.addEventListener('pointerdown', () => document.body.classList.remove('kbd-nav'));
  // celular em retrato: o aviso "gire o aparelho" cobre o jogo, então pausa em vez de deixar rodando por baixo
  const portrait = matchMedia('(pointer:coarse) and (orientation:portrait)');
  portrait.addEventListener('change', () => { if (portrait.matches && G.state === 'playing') togglePause(); });
  // botões do HUD clicados com o mouse não podem guardar o foco, senão Espaço os aperta em vez de pular
  document.querySelectorAll('.hud-tools .tool').forEach((b) => b.addEventListener('click', () => { if (!topScreen()) b.blur(); }));

  /* ---------------------------------------------------------------- controle (Gamepad API, mapeamento padrão) */
  const pad = { prev: {}, navT: 0, on: false };
  function pollPad(dt) {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g && g.connected) : null;
    if (!gp) { if (pad.on) { ['PadLeft', 'PadRight', 'PadJump', 'PadDown', 'PadUp', 'PadDash'].forEach((k) => keys.delete(k)); pad.on = false; pad.prev = {}; } return; }
    pad.on = true;
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, DZ = 0.4;
    const now = {
      a: btn(0), b: btn(1), x: btn(2), y: btn(3), start: btn(9), dash: btn(5) || btn(7) || btn(3),
      up: btn(12) || ay < -DZ, down: btn(13) || ay > DZ, left: btn(14) || ax < -DZ, right: btn(15) || ax > DZ
    };
    const hit = (k) => now[k] && !pad.prev[k];
    const top = topScreen();
    if (hit('start')) togglePause();
    else if (top) {
      document.body.classList.add('kbd-nav');
      const dir = now.left || now.up ? -1 : now.right || now.down ? 1 : 0;
      const fresh = hit('left') || hit('up') || hit('right') || hit('down');
      pad.navT -= dt;
      if (dir && (fresh || pad.navT <= 0)) { moveFocus(dir, true); pad.navT = fresh ? 0.4 : 0.15; }   // repetição ao segurar
      if (hit('a') && document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.click();
      if (hit('b') && G.state === 'paused') togglePause();
    }
    const play = G.state === 'playing';
    const set = (k, v) => (v && play ? keys.add(k) : keys.delete(k));
    set('PadLeft', now.left); set('PadRight', now.right); set('PadJump', now.a); set('PadDown', btn(13) || ay > 0.6); set('PadUp', btn(12) || ay < -0.6); set('PadDash', now.dash);
    if (play && hit('a')) player.buf = PH.BUFFER;
    if (play && hit('x')) player.atkBuf = ATK.BUF;
    pad.prev = now;
  }
  window.addEventListener('gamepadconnected', () => toast('Controle conectado', 1400));

  document.querySelectorAll('.touch-btn').forEach((b) => {
    const code = b.dataset.key;
    const down = (e) => { e.preventDefault(); keys.add(code); if (code === 'Space') player.buf = PH.BUFFER; if (code === 'KeyJ' && G.state === 'playing') player.atkBuf = ATK.BUF; b.classList.add('down'); };
    const up = (e) => { e.preventDefault(); keys.delete(code); b.classList.remove('down'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });

  $('btn-play').addEventListener('click', () => beginRun(0));
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-quit').addEventListener('click', () => { toTitle(); });
  $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn; syncMusic(); $('btn-sound').classList.toggle('off', !soundOn);
    $('btn-sound').setAttribute('aria-pressed', String(!soundOn));
  });
  $('btn-full').addEventListener('click', () => {
    // tela cheia no documento inteiro: o #stage continua 16:9 com tarja, em vez de esticar em 21:9 ou 16:10
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  });
  $('done-next').addEventListener('click', () => {
    show(ui.done, false);
    if (G.stage >= 4) { $('win-stats').innerHTML = `<div><b>${G.totalNuts}</b><span>castanhas guardadas</span></div><div><b>${G.totalKills}</b><span>inimigos pisados</span></div>`; show(ui.win, true); G.state = 'won'; syncMusic(); if (AU) AU.sting('win'); }
    else startStage(G.stage + 1);
  });
  $('over-retry').addEventListener('click', () => { G.hearts = 3; show(ui.over, false); startStage(G.stage); });
  $('over-menu').addEventListener('click', () => toTitle());
  $('win-again').addEventListener('click', () => { show(ui.win, false); toTitle(); });

  /* ---------------------------------------------------------------- boot */
  async function boot() {
    try {
      await Promise.all(['700 16px "Lilita One"', '600 12px "Pixelify Sans"', '700 8px "Pixelify Sans"', '400 12px "Nunito"'].map((f) => document.fonts.load(f)));
      R = RC.createRenderer($('game'));
      qualityIdx = parseInt(q.get('q') || '0', 10) || 0;
      if (qualityIdx) R.resize(QUALITY[Math.min(qualityIdx, QUALITY.length - 1)]);
      atlas = await RC.buildAtlas(R);
      rects = atlas.rects; RC.atlasInfo = atlas;
      bg = RC.paintBackgrounds(R, 4242);
    } catch (err) {
      console.error(err);
      $('loading').innerHTML = '<p class="fatal">Este jogo precisa de WebGL 2. Tente um navegador atualizado (Chrome, Edge, Firefox ou Safari 15+).</p>';
      return;
    }
    renderHearts();
    await loadStage(0);
    placeTitlePlayer();
    G.state = 'title'; G.fade = 0; G.fadeTarget = 1;
    ui.loading.classList.remove('visible');
    show(ui.title, true);
    requestAnimationFrame(frame);
    if (q.get('autostart')) beginRun(clamp(parseInt(q.get('stage') || '0', 10) || 0, 0, 4));
  }

  /* API para módulos em arquivos próprios (missions.js, fx.js etc.). Getters porque R/atlas nascem no boot. */
  const API = {
    G, player, keys, PH, ENEMY, T, WW, WH, S, EV,
    get R() { return R; }, get atlas() { return atlas; }, get rects() { return rects; }, get quality() { return qualityIdx; },
    spr: (name, x, y, sx, sy, o) => R.sprite(atlas.set, rects[name], x, y, sx, sy, o),
    emit, burst, dust, toast, sfx, jingle, surfaceBelow, groundTop, hurt, killEnemy, renderNuts, renderHearts, makeEnemy,
    show, ui
  };
  RC.game = API;

  window.__rc = { atlas: () => atlas, G, player, keys, step: (dt) => updateWorld(dt), groundTop, surfaceBelow, PH, R: () => R, loadStage, startStage, beginRun, togglePause, teleport: (x) => { const y = surfaceBelow(x, 0); spawnPlayer(x, y); G.camX = G.camTarget = clamp(x - WW * 0.4, 0, G.lv.width - WW); } };
  boot();
})();
