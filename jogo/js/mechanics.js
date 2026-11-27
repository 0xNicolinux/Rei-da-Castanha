/* Rei da Castanha: elementos de cenário com que dá para interagir (módulo plugado via RC.events / RC.game).
   Tudo vem dos dados da fase feita à mão (js/levels.js) e é pintado por código, como o resto do cenário.

   lv.water   [{x0, x1, y}]                 lago: superfície em y; o fundo é o próprio chão (lv.ground).
                                            Nadar: Espaço dá braçada, perto da superfície salta para fora; ↓ mergulha.
   lv.vines   [{x, y, len}]                 cipó de balançar preso em (x, y). Agarra sozinho ao encostar no ar;
                                            ←/→ dá impulso, ↑/↓ sobe e desce, Espaço solta com o embalo.
   lv.ropes   [{x, y0, y1}]                 cipó de escalar (vertical). Agarra no ar ou com ↑; ↑/↓ sobe e desce, Espaço pula.
   lv.bridges [{type, x0, x1, y, lever?}]   'rope'  ponte de corda: sempre firme, verga sob o Rei.
                                            'draw'  ponte levadiça: abaixa quando a alavanca (lever: {x, y}) leva um tabefe.
                                            'log'   tronco seco em pé em x0: um tabefe derruba e ele vira ponte até x1.
   lv.rafts   [{x0, x1, y, w, speed}]       jangada que vai e volta sobre a água; leva quem está em cima.

   API: RC.mech = { control(p, dt, inp), waterAt(x, y), solidAt(x), bridgeAt(x), levers(), bridges() }
   Eventos emitidos: 'bridgeDown'(bridge) · 'leverPulled'(lever) · 'vineGrab'(vine). */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  const clamp = RC.clamp;
  const A = () => RC.game;
  let water = [], vines = [], ropes = [], bridges = [], levers = [], rafts = [], bubbles = [], ripples = [], tw = 0;

  /* ------------------------------------------------------------ montagem */
  EV.on('stageLoaded', (lv) => {
    tw = 0; bubbles = []; ripples = [];
    water = (lv.water || []).map((w) => Object.assign({ ph: Math.random() * 6 }, w));
    vines = (lv.vines || []).map((v) => Object.assign({ th: 0.12, om: 0, idle: Math.random() * 6 }, v));
    ropes = (lv.ropes || []).map((r) => Object.assign({ sway: Math.random() * 6 }, r));
    levers = []; bridges = []; rafts = [];
    for (const b0 of lv.bridges || []) {
      const b = Object.assign({ down: b0.type === 'rope', anim: b0.type === 'rope' ? 1 : 0, sag: 0 }, b0);
      // a colisão é uma plataforma comum do jogo (desligada até a ponte baixar); o desenho fica aqui
      b.plat = { x: b.x0, y: b.y, w: b.x1 - b.x0, kind: 'bridge', mech: true, off: !b.down };
      lv.platforms.push(b.plat);
      if (b.lever) { const L = { x: b.lever.x, y: b.lever.y, on: false, t: 0, bridge: b }; levers.push(L); b.leverRef = L; }
      bridges.push(b);
    }
    for (const r0 of lv.rafts || []) {
      const r = Object.assign({ dir: 1, speed: 55 }, r0);
      r.plat = { x: r.x0, y: r.y, w: r.w, kind: 'raft', mech: true };
      lv.platforms.push(r.plat); rafts.push(r);
    }
  });

  /* ------------------------------------------------------------ consultas */
  function waterAt(x, y) {
    for (const w of water) if (x > w.x0 && x < w.x1 && y > w.y) return w.y;
    return null;
  }
  function bridgeAt(x) { return bridges.find((b) => b.down && x >= b.x0 && x <= b.x1) || null; }
  // chão firme para quem anda no chão (o caminhão da fase 4): terreno, ponte abaixada ou jangada não contam como água
  function solidAt(x) {
    const g = A(); const b = bridgeAt(x); if (b) return b.y;
    for (const w of water) if (x > w.x0 && x < w.x1) return null;
    const t = g.groundTop(Math.floor(x / g.T));
    return t < 1e8 ? t : null;
  }

  /* ------------------------------------------------------------ controle do jogador pendurado */
  const GRAV = 1500;
  function tryGrab(p, inp) {
    if (p.regrab > 0 || p.grounded || p.swim || p.pound) return false;
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.35;
    for (const v of vines) {
      // ponto do cipó mais próximo do Rei (o cipó balança sozinho mesmo sem ninguém)
      const ex = v.x + Math.sin(v.th) * v.len, ey = v.y + Math.cos(v.th) * v.len;
      const vx = ex - v.x, vy = ey - v.y, L2 = vx * vx + vy * vy;
      let u = ((cx - v.x) * vx + (cy - v.y) * vy) / L2; u = clamp(u, 0.35, 1);
      const qx = v.x + vx * u, qy = v.y + vy * u;
      if (Math.hypot(cx - qx, cy - qy) < 24) {
        const r = Math.max(60, u * v.len), th = Math.atan2(cx - v.x, cy - v.y);
        p.vine = { v, r, th, om: (p.vx * Math.cos(th) - p.vy * Math.sin(th)) / r };
        p.vine.om = clamp(p.vine.om, -4.2, 4.2);
        A().sfx('vine', 0.35); EV.emit('vineGrab', v);
        A().burst('leaf', qx, qy, 4, 120, { name: 'leaf_1', g: 300, vr: 6, life: 0.8 });
        return true;
      }
    }
    for (const r of ropes) {
      const inX = Math.abs(cx - r.x) < 16, inY = p.y + p.h > r.y0 + 20 && p.y < r.y1;
      if (inX && inY && (!p.grounded || inp.up)) {
        p.rope = r; p.vx = 0; p.vy = 0; A().sfx('vine', 0.3); EV.emit('vineGrab', r);
        return true;
      }
    }
    return false;
  }
  function release(p, vx, vy) {
    p.vine = null; p.rope = null; p.regrab = 0.32; p.vx = vx; p.vy = vy; p.jumping = true; p.airDash = true; p.airJump = true;
    p.sx = 0.82; p.sy = 1.22;
  }
  function control(p, dt, inp) {
    const g = A();
    if (!p.vine && !p.rope) {
      if (!tryGrab(p, inp)) return false;
    }
    if (p.vine) {
      const s = p.vine, v = s.v;
      // pêndulo com impulso: empurrar a favor do movimento aumenta o arco
      const pump = inp.dir ? inp.dir * (Math.sign(s.om) === inp.dir || Math.abs(s.om) < 0.4 ? 5.2 : 2.6) : 0;
      s.om += (-(GRAV / s.r) * Math.sin(s.th) + pump * Math.cos(s.th)) * dt;
      s.om *= Math.exp(-dt * 0.35);
      s.th += s.om * dt;
      if (s.th > 1.45) { s.th = 1.45; s.om = Math.min(0, s.om) * 0.3; }
      if (s.th < -1.45) { s.th = -1.45; s.om = Math.max(0, s.om) * 0.3; }
      if (inp.up) s.r = Math.max(60, s.r - 150 * dt);

      v.th = s.th; v.om = s.om;
      const cx = v.x + Math.sin(s.th) * s.r, cy = v.y + Math.cos(s.th) * s.r;
      p.x = cx - p.w / 2; p.y = cy - p.h * 0.35;
      const tvx = Math.cos(s.th) * s.om * s.r, tvy = -Math.sin(s.th) * s.om * s.r;
      p.vx = tvx; p.vy = tvy;
      if (Math.abs(tvx) > 20) p.facing = Math.sign(tvx);
      if (inp.jumpPress) {
        // solta com o embalo e um empurrão para cima; o embalo horizontal é amplificado para o arremesso render
        release(p, tvx * 1.12, Math.min(tvy, 0) - 330);
        g.sfx('jump', 0.3, 1.15);
        g.burst('leaf', cx, cy - 10, 5, 160, { name: 'leaf_0', g: 260, vr: 8, life: 0.9 });
      } else if (inp.dashPress) release(p, p.facing * 300, 60);
      else if (inp.down) { release(p, tvx * 0.6, Math.max(tvy, 0) + 40); p.jumping = false; }          // ↓ solta o cipó e cai
      // bateu no chão ou numa parede: solta
      const top = g.groundTop(Math.floor((p.x + p.w / 2) / g.T));
      if (p.y + p.h > top) { p.y = top - p.h; release(p, p.vx * 0.5, 0); }
      return true;
    }
    if (p.rope) {
      const r = p.rope;
      p.x += (r.x - p.w / 2 - p.x) * Math.min(1, dt * 20);
      p.vy = (inp.down ? 1 : 0) * 170 - (inp.up ? 1 : 0) * 150;
      p.y += p.vy * dt;
      if (p.y < r.y0 - p.h * 0.2) { p.y = r.y0 - p.h * 0.2; p.vy = 0; }
      if (inp.dir) p.facing = inp.dir;
      const top = g.groundTop(Math.floor((p.x + p.w / 2) / g.T));
      if (p.y + p.h >= Math.min(top, r.y1 + p.h * 0.6)) {          // chegou ao pé do cipó
        if (p.y + p.h >= top) { p.y = top - p.h; p.rope = null; p.regrab = 0.3; p.grounded = true; return true; }
        p.y = r.y1 + p.h * 0.6 - p.h;
      }
      if (inp.jumpPress) { release(p, (inp.dir || p.facing) * 240, -560); g.sfx('jump', 0.28); }
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------ mundo */
  function hitBy(px, py, r) {          // tabefe ativo ou pancada perto do ponto
    const p = A().player;
    const reach = p.atk > 0 && Math.abs(p.x + p.w / 2 + p.facing * 30 - px) < r + 14 && Math.abs(p.y + p.h / 2 - py) < r + 30;
    return reach;
  }
  function lowerBridge(b) {
    if (b.down) return;
    b.down = true; b.plat.off = false; b.anim = 0.001;
    const g = A(); g.sfx('thud', 0.5); g.G.shake = Math.max(g.G.shake, 7);
    EV.emit('bridgeDown', b);
  }
  EV.on('update', (dt) => {
    const g = A(), G = g.G, p = g.player;
    if (!G.lv || G.state !== 'playing') return;
    tw += dt;
    // cipós livres balançam à toa
    for (const v of vines) if (!p.vine || p.vine.v !== v) { v.om += (-(GRAV / v.len) * Math.sin(v.th)) * dt; v.om *= Math.exp(-dt * 0.6); v.th += v.om * dt; if (Math.abs(v.om) < 0.05 && Math.abs(v.th) < 0.05) v.th = Math.sin(tw * 0.8 + v.idle) * 0.06; }
    // alavancas e troncos: um tabefe resolve
    for (const L of levers) {
      L.t += dt;
      if (!L.on && hitBy(L.x, L.y - 24, 40)) { L.on = true; L.t = 0; g.sfx('lever', 0.5); G.hitstop = 0.05; g.burst('spark', L.x, L.y - 30, 10, 200, { col: [1, 0.85, 0.5], life: 0.4 }); EV.emit('leverPulled', L); L.delay = 0.26; }
      if (L.delay > 0) { L.delay -= dt; if (L.delay <= 0) lowerBridge(L.bridge); }
    }
    for (const b of bridges) {
      if (b.type === 'log' && !b.down && hitBy(b.x0, b.y - 60, 46)) {
        g.sfx('punch', 0.4, 0.7); G.hitstop = 0.06; g.burst('leaf', b.x0, b.y - 80, 8, 200, { name: 'crate_piece_2', g: 700, vr: 10, life: 0.9 });
        b.falling = true; b.down = true; b.anim = 0.001;
      }
      if (b.anim > 0 && b.anim < 1) {
        const prev = b.anim; b.anim = Math.min(1, b.anim + dt * (b.type === 'log' ? 1.6 : 1.4));
        if (b.type === 'log') b.anim = Math.min(1, prev + dt * (0.8 + prev * 3));        // tomba acelerando
        if (b.anim >= 1) {
          b.plat.off = false; b.falling = false;
          if (b.type === 'log') { g.sfx('thud', 0.6); G.shake = Math.max(G.shake, 9); g.burst('dust', (b.x0 + b.x1) / 2, b.y, 14, 220, { life: 0.7, size: 1.6 }); EV.emit('bridgeDown', b); }
          else g.burst('dust', b.x1, b.y, 8, 140, { life: 0.5 });
        }
      }
      // ponte de corda verga onde o Rei pisa
      if (b.type === 'rope') {
        const on = p.grounded && Math.abs(p.y + p.h - b.y) < 2 && p.x + p.w > b.x0 && p.x < b.x1;
        b.sag += ((on ? 1 : 0) - b.sag) * Math.min(1, dt * 8); b.px = p.x + p.w / 2;
        if (on && !b.wasOn && Math.abs(p.vy) < 1) g.sfx('vine', 0.18, 0.7);
        b.wasOn = on;
      }
    }
    // jangadas: vão e voltam e carregam quem está em cima
    for (const r of rafts) {
      const dx = r.dir * r.speed * dt; let nx = r.plat.x + dx;
      if (nx < r.x0) { nx = r.x0; r.dir = 1; } if (nx + r.w > r.x1) { nx = r.x1 - r.w; r.dir = -1; }
      const real = nx - r.plat.x;
      const riding = p.grounded && Math.abs(p.y + p.h - r.plat.y) < 3 && p.x + p.w > r.plat.x + 2 && p.x < r.plat.x + r.w - 2;
      r.plat.x = nx; r.plat.y = r.y + Math.sin(tw * 2 + r.x0) * 3;
      if (riding) { p.x += real; p.y = r.plat.y - p.h; }
    }
    // bolhas de quem nada
    if (p.swim && Math.random() < dt * 5) bubbles.push({ x: p.x + p.w / 2 + p.facing * 8, y: p.y + 10, vy: -40 - Math.random() * 30, life: 1.4 });
    for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.life -= dt; b.y += b.vy * dt; b.x += Math.sin(tw * 6 + i) * 0.3; const s = waterAt(b.x, b.y); if (b.life <= 0 || s === null) { if (s === null && b.life > 0) ripples.push({ x: b.x, y: b.y, t: 0 }); bubbles.splice(i, 1); } }
    for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > 0.9) ripples.splice(i, 1); }
  });
  function splash(x, y, k) {
    const g = A();
    g.sfx('splash', 0.3 * k + 0.1);
    for (let i = 0; i < 10 * k + 4; i++) g.emit('spark', x + (Math.random() - 0.5) * 30, y, { vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 260 * k, g: 900, life: 0.6, col: [0.7, 0.9, 1], size: 0.7 });
    ripples.push({ x, y, t: 0, big: true });
  }
  EV.on('waterIn', (x, y) => { const p = A().player; splash(x, y, clamp(Math.abs(p.vy) / 500, 0.4, 1.3)); });
  EV.on('waterOut', (x, y) => splash(x, y, 0.5));
  EV.on('stroke', (x, y) => { for (let i = 0; i < 4; i++) bubbles.push({ x: x + (Math.random() - 0.5) * 16, y: y + 6, vy: -70 - Math.random() * 40, life: 1 }); });

  /* ------------------------------------------------------------ desenho (código, no estilo do world.js) */
  function rect(x, y, w, h, col, o) {
    const g = A(), r = g.rects.dot; if (!r) return;
    g.R.sprite(g.atlas.set, r, x, y, w / r.w, h / r.h, Object.assign({ col, lit: 0.6, noSnap: true }, o));
  }
  function glow(x, y, s, col) { const g = A(), r = g.rects.glow; if (r) g.R.sprite(g.atlas.set, r, x - 32 * s, y - 32 * s, s, s, { col, lit: 0, noSnap: true }); }
  const vis = (x0, x1, cam) => x1 > cam - 80 && x0 < cam + 1040;
  // segmento de corda/cipó entre dois pontos (retângulo girado)
  function seg(x0, y0, x1, y1, th, col) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 0.5) return;
    rect(x0 - th / 2, y0, th, L, col, { rot: -Math.atan2(dx, dy), px: th / 2, py: 0 });
  }
  const VINE = [0.22, 0.42, 0.16, 1], VINE_HI = [0.42, 0.66, 0.26, 1];
  function vineLine(pts, t) {
    for (let i = 0; i < pts.length - 1; i++) {
      seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 5, VINE);
      seg(pts[i][0] - 1, pts[i][1], pts[i + 1][0] - 1, pts[i + 1][1], 2, VINE_HI);
    }
    const g = A();
    for (let i = 1; i < pts.length; i += 2) {             // folhas presas no cipó
      const [x, y] = pts[i], side = i % 4 === 1 ? 1 : -1, r = g.rects.leaf_1 || g.rects.leaf_0; if (!r) continue;
      g.R.sprite(g.atlas.set, r, x + side * 2, y - 4, side * 2, 2, { rot: Math.sin(t * 2 + i) * 0.3 + side * 0.6, px: 0, py: 4, lit: 0.8 });
    }
  }
  function drawVines(t, cam) {
    const p = A().player;
    for (const v of vines) {
      const held = p.vine && p.vine.v === v, r = held ? p.vine.r : v.len, th = v.th;
      const ex = v.x + Math.sin(th) * r, ey = v.y + Math.cos(th) * r;
      if (!vis(Math.min(v.x, ex) - 40, Math.max(v.x, ex) + 40, cam)) continue;
      const n = 8, pts = [];
      for (let i = 0; i <= n; i++) { const u = i / n, bend = Math.sin(u * Math.PI) * (held ? 0 : 6) * Math.sin(t * 1.3 + v.idle); pts.push([v.x + (ex - v.x) * u + bend, v.y + (ey - v.y) * u]); }
      // nó no galho de cima
      rect(v.x - 9, v.y - 6, 18, 10, [0.32, 0.2, 0.1, 1], { lit: 0.9 });
      vineLine(pts, t);
      if (!held && r === v.len) { rect(ex - 5, ey - 3, 10, 8, [0.3, 0.55, 0.2, 1]); glow(ex, ey, 0.3, [0.7, 1, 0.5, 0.18 + 0.1 * Math.sin(t * 3 + v.idle)]); }   // ponta: dica de onde agarrar
    }
    for (const r of ropes) {
      if (!vis(r.x - 30, r.x + 30, cam)) continue;
      const n = Math.max(4, Math.round((r.y1 - r.y0) / 34)), pts = [];
      for (let i = 0; i <= n; i++) { const u = i / n; pts.push([r.x + Math.sin(t * 1.1 + r.sway + u * 2) * 3 * u, r.y0 + (r.y1 - r.y0) * u]); }
      rect(r.x - 10, r.y0 - 6, 20, 10, [0.32, 0.2, 0.1, 1], { lit: 0.9 });
      vineLine(pts, t);
    }
  }
  const WOOD = [0.55, 0.36, 0.2, 1], WOOD_D = [0.36, 0.22, 0.12, 1], ROPE = [0.72, 0.6, 0.4, 1];
  /* sprites modelados no Blender (js/sprites-props.js, 1 texel = 2 px). sp(): desenha com rotação em torno de (px, py) do mundo */
  function sp(name, x, y, o) {
    const g = A(), r = g.rects[name]; if (!r) return null;
    o = o || {}; const S = g.S, sx = (o.flip ? -1 : 1) * S;
    const opt = { lit: 1 };
    if (o.rot) { opt.rot = o.rot; opt.px = o.px - x; opt.py = o.py - y; opt.noSnap = true; }
    if (o.col) opt.col = o.col; if (o.emit) opt.emit = o.emit;
    g.R.sprite(g.atlas.set, r, o.flip ? x + r.w * S : x, y, sx, S, opt);
    return r;
  }
  const W_ = (n) => { const r = A().rects[n]; return r ? r.w * A().S : 32; };
  const H_ = (n) => { const r = A().rects[n]; return r ? r.h * A().S : 16; };
  function drawBridges(t, cam) {
    for (const b of bridges) {
      if (!vis(b.x0 - 60, b.x1 + 60, cam)) continue;
      const W = b.x1 - b.x0;
      if (b.type === 'rope') {
        // tábuas de verdade, verga onde o Rei pisa; cordas de mão entre os postes
        const pw = W_('prop_plank_1'), n = Math.max(2, Math.round(W / (pw - 2))), step = W / n;
        const dip = (u) => { const near = 1 - Math.min(1, Math.abs((b.x0 + u * W) - (b.px || 0)) / (W * 0.6)); return Math.sin(u * Math.PI) * (3 + b.sag * 7 * near); };
        let px = b.x0, py = b.y - 30;
        for (let i = 1; i <= n; i++) { const u = i / n, x = b.x0 + u * W, y = b.y - 30 + dip(u) * 0.8; seg(px, py, x, y, 2, ROPE); px = x; py = y; }
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n, x = b.x0 + i * step, y = b.y + dip(u) - 4;
          sp(i % 2 ? 'prop_plank_2' : 'prop_plank_1', x + (step - pw) / 2, y, { rot: (dip((i + 1) / n) - dip(i / n)) / step, px: x + step / 2, py: y + 6 });
          if (i > 0) seg(x, b.y - 30 + dip(i / n) * 0.8, x, y + 2, 1.5, ROPE);
        }
        for (const x of [b.x0, b.x1]) sp('prop_post', x - W_('prop_post') / 2, b.y - H_('prop_post') + 14);
      } else if (b.type === 'draw') {
        // ponte levadiça: tábuas com cinta de ferro giram da ponta esquerda (de pé, -90°, até deitada)
        const a = -Math.PI / 2 * (1 - easeOut(b.anim)), dw = W_('prop_deck'), n = Math.max(1, Math.round(W / dw));
        const tw2 = W_('prop_tower');
        sp('prop_tower', b.x0 - tw2 + 8, b.y - H_('prop_tower') + 10);
        for (let k = 0; k < n; k++) sp('prop_deck', b.x0 + k * (W / n), b.y - 4, { rot: a, px: b.x0, py: b.y + 2 });
        const ex = b.x0 + Math.cos(a) * W, ey = b.y + Math.sin(a) * W;
        seg(b.x0 - 10, b.y - H_('prop_tower') + 34, ex, ey, 2, [0.42, 0.42, 0.48, 1]);              // corrente
      } else if (b.type === 'log') {
        // tronco seco de Blender: em pé na beira, tomba para a direita e vira ponte
        const a = -Math.PI / 2 * (1 - easeIn(b.anim)), mw = W_('prop_log_mid'), lh = H_('prop_log_mid'), n = Math.max(1, Math.ceil(W / mw));
        for (let k = 0; k < n; k++) sp('prop_log_mid', b.x0 + k * mw, b.y - lh / 2 + 4, { rot: a, px: b.x0, py: b.y + 4 });
        sp('prop_log_end', b.x0 + n * mw - 2, b.y - lh / 2 + 4, { rot: a, px: b.x0, py: b.y + 4 });
        if (!b.down) glow(b.x0 + 6, b.y - 70, 0.6 + 0.1 * Math.sin(t * 4), [1, 0.8, 0.5, 0.16]);       // convida o tabefe
      }
    }
    for (const L of levers) {
      if (!vis(L.x - 30, L.x + 30, cam)) continue;
      const bw = W_('prop_lever_base'), bh = H_('prop_lever_base'), sn = L.on ? 'prop_lever_on' : 'prop_lever_off', sw = W_(sn), sh = H_(sn);
      const k = Math.min(1, L.t * 6), a = L.on ? -0.7 + 1.4 * easeOut(k) : -0.7 + Math.sin(t * 3) * 0.05;
      sp(sn, L.x - sw / 2, L.y - bh + 6 - sh, { rot: a, px: L.x, py: L.y - bh + 6 });
      sp('prop_lever_base', L.x - bw / 2, L.y - bh);
      if (!L.on) glow(L.x, L.y - bh - sh + 8, 0.55 + 0.08 * Math.sin(t * 5), [1, 0.45, 0.3, 0.22]);
    }
    for (const r of rafts) {
      const x = r.plat.x, y = r.plat.y, rw = W_('prop_raft');
      if (!vis(x, x + r.w, cam)) continue;
      const n = Math.max(1, Math.round(r.w / rw));
      for (let k = 0; k < n; k++) sp('prop_raft', x + k * (r.w / n), y - 4, { rot: Math.sin(tw * 2 + r.x0) * 0.02, px: x + r.w / 2, py: y });
    }
  }
  /* água pintada por código, com paleta por clima: [superfície, meio, fundo, crista] */
  const WPAL = [
    [[0.32, 0.62, 0.62], [0.13, 0.36, 0.44], [0.05, 0.14, 0.22], [0.86, 0.98, 0.92]],   // amanhecer
    [[0.24, 0.56, 0.46], [0.09, 0.32, 0.32], [0.03, 0.13, 0.15], [0.78, 1.0, 0.86]],    // mata fechada
    [[0.62, 0.5, 0.42], [0.3, 0.26, 0.34], [0.1, 0.08, 0.17], [1.0, 0.86, 0.66]],       // entardecer
    [[0.2, 0.36, 0.6], [0.08, 0.16, 0.36], [0.02, 0.05, 0.16], [0.7, 0.86, 1.0]],       // hora azul
    [[0.22, 0.28, 0.52], [0.1, 0.1, 0.3], [0.03, 0.02, 0.12], [1.0, 0.88, 0.62]]        // festival
  ];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const waveY = (w, x, t) => w.y + Math.sin(x * 0.045 + t * 2.1 + w.ph) * 1.8 + Math.sin(x * 0.11 - t * 3.3) * 0.9;
  function drawWater(t, cam) {
    const pal = WPAL[(A().G.lv && A().G.lv.mood) || 0];
    for (const w of water) {
      if (!vis(w.x0, w.x1, cam)) continue;
      const x0 = Math.max(w.x0, cam - 40), x1 = Math.min(w.x1, cam + 1000), H = 540 - w.y;
      // corpo: faixas de profundidade (translúcido em cima, quase opaco no fundo)
      const bands = 9;
      for (let k = 0; k < bands; k++) {
        const u = k / (bands - 1), c = u < 0.5 ? mix(pal[0], pal[1], u * 2) : mix(pal[1], pal[2], (u - 0.5) * 2);
        const y = w.y + 3 + (H - 3) * (k / bands), h = (H - 3) / bands + 1;
        rect(x0, y, x1 - x0, h, [c[0], c[1], c[2], 0.5 + 0.38 * u], { lit: 0.25 });
      }
      // refração: faixas claras e onduladas que correm devagar sob a superfície
      for (let k = 0; k < 5; k++) {
        const yy = w.y + 12 + k * 13 + Math.sin(t * 0.9 + k) * 2;
        for (let x = x0 - (x0 % 8); x < x1; x += 8) {
          const s0 = Math.sin(x * 0.03 + t * (0.8 + k * 0.17) + k * 1.7);
          if (s0 > 0.55) rect(x, yy + Math.sin(x * 0.07 + t * 2 + k) * 2, 8, 2, [pal[3][0], pal[3][1], pal[3][2], (s0 - 0.55) * 0.35 * (1 - k / 6)], { lit: 0 });
        }
      }
      // superfície: crista clara em cima de uma linha mais escura (dá espessura), em tiras de 4 px
      for (let x = x0 - (x0 % 4); x < x1; x += 4) {
        const y = waveY(w, x, t);
        rect(x, y + 2, 4, 3, [pal[1][0] * 0.7, pal[1][1] * 0.7, pal[1][2] * 0.8, 0.55], { lit: 0 });
        rect(x, y - 1, 4, 2, [pal[3][0], pal[3][1], pal[3][2], 0.85], { lit: 0 });
      }
      // brilhos que piscam na superfície
      for (let k = 0; k < 14; k++) {
        const x = w.x0 + ((k * 97.3 + Math.floor(t * 0.7 + k) * 41) % (w.x1 - w.x0));
        const tw_ = Math.sin(t * 4 + k * 2.3); if (tw_ < 0.4 || x < x0 || x > x1) continue;
        rect(x, waveY(w, x, t) + 4 + (k % 3) * 3, 6 + (k % 2) * 4, 1.5, [1, 1, 1, (tw_ - 0.4) * 0.9], { lit: 0 });
      }
      // espuma nas margens
      for (const ex of [w.x0, w.x1]) {
        if (ex < cam - 40 || ex > cam + 1000) continue;
        for (let k = 0; k < 4; k++) {
          const ph = t * 2.2 + k * 1.6, dx = (ex === w.x0 ? 1 : -1) * (4 + k * 6 + Math.sin(ph) * 3);
          rect(ex + dx - 3, waveY(w, ex + dx, t) - 2 - Math.abs(Math.sin(ph)) * 2, 6, 3, [1, 1, 1, 0.55 - k * 0.1], { lit: 0 });
        }
      }
    }
    for (const b of bubbles) { rect(b.x - 2, b.y - 2, 4, 4, [0.85, 0.95, 1, 0.75], { lit: 0 }); rect(b.x - 1, b.y - 1, 1.5, 1.5, [1, 1, 1, 0.9], { lit: 0 }); }
    for (const r of ripples) { const k = r.t / 0.9, w0 = (r.big ? 60 : 24) * k + 6; rect(r.x - w0, r.y - 1, w0 * 2, 2, [0.9, 0.98, 1, (1 - k) * 0.7], { lit: 0 }); rect(r.x - w0 * 0.6, r.y + 3, w0 * 1.2, 1.5, [0.9, 0.98, 1, (1 - k) * 0.4], { lit: 0 }); }
  }
  const easeOut = (u) => 1 - (1 - u) * (1 - u), easeIn = (u) => u * u;
  EV.on('drawBehind', (t, cam) => { if (!A().G.lv || !A().rects) return; drawBridges(t, cam); drawVines(t, cam); });
  EV.on('drawFront', (t, cam) => { if (!A().G.lv || !A().rects) return; drawWater(t, cam); });
  EV.on('drawAdd', (t, cam) => {
    const g = A(); if (!g.G.lv || !g.rects) return;
    const pal = WPAL[g.G.lv.mood || 0];
    for (const w of water) {
      if (!vis(w.x0, w.x1, cam)) continue;
      const H = 540 - w.y, r = g.rects.glow;
      // raios de luz entrando na água
      for (let k = 0; k < 4; k++) {
        const x = w.x0 + ((k * 211 + t * 9) % Math.max(1, w.x1 - w.x0)); if (x < cam - 60 || x > cam + 1020) continue;
        const a = 0.05 + 0.03 * Math.sin(t * 0.8 + k * 2);
        g.R.sprite(g.atlas.set, r, x - 20, w.y, 40 / r.w, H / r.h, { col: [pal[3][0], pal[3][1], pal[3][2], a], lit: 0, noSnap: true, shear: 18 });
      }
      // cáusticas dançando no fundo
      for (let x = Math.ceil((cam - 40) / 46) * 46; x < cam + 1000; x += 46) {
        if (x < w.x0 + 8 || x > w.x1 - 8) continue;
        const fy = g.groundTop(Math.floor(x / g.T)); if (fy > 1e8) continue;
        const k = Math.sin(x * 0.13 + t * 2.6) * Math.sin(x * 0.07 - t * 1.7);
        if (k > 0.1) glow(x + Math.sin(t * 1.3 + x) * 8, fy - 2, 0.35 + k * 0.3, [pal[3][0], pal[3][1], pal[3][2], k * 0.22]);
      }
    }
  });

  RC.mech = { control, waterAt, solidAt, bridgeAt, levers: () => levers, bridges: () => bridges, vines: () => vines, ropes: () => ropes, water: () => water };
})();
