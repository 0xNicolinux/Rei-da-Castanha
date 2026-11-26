/* Rei da Castanha: props interativos (módulo plugado via RC.events / RC.game).
   - spring: cogumelo-trampolim; cair em cima (ou pular de cima dele) lança bem alto, até o galho secreto.
   - crate: caixote quebrável (soco ou pisão) que solta castanhas.
   - lanterns: lanternas penduradas nos galhos nas fases 4 e 5 (só visual). */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  let props = [], lanterns = [], prev = { vy: 0, g: false }, stageT = 0;

  const G = () => RC.game.G;
  const rect = (n) => RC.game.rects && RC.game.rects[n];

  EV.on('stageLoaded', (lv) => {
    props = (lv.props || []).map((p) => Object.assign({ squash: 0, broken: false, shake: 0, bob: Math.random() * 6 }, p));
    lanterns = (lv.lanterns || []).map((l) => Object.assign({ ph: Math.random() * 6 }, l));
    prev = { vy: 0, g: false };
  });

  function breakCrate(c, how) {
    const g = G(), api = RC.game;
    c.broken = true; c.t = 0;
    api.burst('spark', c.x, c.y - 14, 12, 210, { col: [0.75, 0.5, 0.25], life: 0.5 });
    api.burst('dust', c.x, c.y - 6, 6, 120, { life: 0.4 });
    api.sfx('land', 0.34, 0.8); api.sfx('item', 0.2, 0.7);
    const n = c.golden ? 3 : 3;
    for (let i = 0; i < n; i++) {
      g.nuts.push({ x: c.x + (i - 1) * 16, y: c.y - 30, golden: c.golden && i === 1, taken: false, ph: i, mag: false, vy: -300 - i * 40, drop: true });
    }
    if (how === 'stomp') { const p = api.player; p.vy = -420; p.jumping = false; p.sx = 0.85; p.sy = 1.2; }
  }

  // onda da Pancada do Rei quebra caixotes por perto
  EV.on('pound', (x, y) => {
    for (const c of props) if (c.type === 'crate' && !c.broken && Math.abs(c.x - x) < 120 && Math.abs(c.y - y) < 40) breakCrate(c, 'punch');
  });

  EV.on('update', (dt) => {
    const api = RC.game, p = api.player, g = G();
    if (!g.lv || g.state !== 'playing') return;
    const pcx = p.x + p.w / 2, bottom = p.y + p.h;
    for (const s of props) {
      if (s.broken) { s.t += dt; continue; }
      if (s.squash > 0) s.squash = Math.max(0, s.squash - dt * 3.2);
      if (s.shake > 0) s.shake -= dt;
      if (Math.abs(pcx - s.x) > 60) continue;
      if (s.type === 'spring') {
        const over = Math.abs(pcx - s.x) < 26;
        const landed = p.grounded && !prev.g && prev.vy > 150 && over && Math.abs(bottom - s.y) < 6;
        const jumpedOff = !p.grounded && prev.g && p.vy < -400 && over && Math.abs(bottom - s.y) < 14;
        if (landed || jumpedOff) {
          p.vy = -880; p.grounded = false; p.jumping = false; p.coyote = 0; p.y -= 3;
          p.sx = 0.75; p.sy = 1.3; s.squash = 1;
          api.burst('spark', s.x, s.y - 12, 12, 200, { col: [0.8, 0.6, 1], life: 0.45 });
          api.sfx('jump', 0.4, 1.5);
        }
      } else if (s.type === 'crate') {
        const top = s.y - 30;
        // pisão
        if (p.vy > 60 && p.x + p.w > s.x - 17 && p.x < s.x + 17 && bottom >= top && bottom <= top + 18 && p.y + p.h - p.vy * dt <= top + 8) { breakCrate(s, 'stomp'); continue; }
        // soco
        if (p.atk > 0 && s.hitId !== p.atkId) {
          const f = p.facing, hx = f > 0 ? p.x + p.w - 8 : p.x - 50, hy = p.y - 10, hh = p.h + 18;
          if (hx < s.x + 17 && hx + 58 > s.x - 17 && hy < s.y && hy + hh > top) { s.hitId = p.atkId; breakCrate(s, 'punch'); }
        }
      }
    }
    prev.vy = p.vy; prev.g = p.grounded;
  });

  function box(x, y, w, h, col) {
    const R = RC.game.R, r = rect('dot');
    if (!r) return;
    R.sprite(RC.game.atlas.set, r, x, y, w / r.w, h / r.h, { col, noSnap: true });
  }

  EV.on('drawBehind', (t, cam) => {
    const api = RC.game, S = api.S;
    if (api.G.state === 'title') return;                    // tela inicial limpa atrás do título
    for (const s of props) {
      if (s.x < cam - 60 || s.x > cam + 1020) continue;
      if (s.type === 'spring') {
        const r = rect('mush_2'); if (!r) continue;
        const sq = Math.sin(s.squash * Math.PI) * s.squash;
        const sy = 1.35 * (1 - 0.35 * sq), sx = 1.35 * (1 + 0.25 * sq);
        api.spr('mush_2', s.x - r.w * S * sx / 2, s.y + 2 - r.h * S * sy, S * sx, S * sy, { emit: 0.55 + 0.25 * Math.sin(t * 3 + s.bob) });
      } else if (s.type === 'crate' && !s.broken) {
        const r = rect('crate');
        const sh = s.shake > 0 ? Math.sin(s.shake * 60) * 2 : 0;
        if (r) { api.spr('crate', s.x - r.w * S / 2 + sh, s.y - r.h * S, S, S); continue; }
        const x = s.x - 17 + sh, y = s.y - 30;
        box(x, y, 34, 30, [0.36, 0.2, 0.09, 1]);
        box(x + 2, y + 2, 30, 26, [0.7, 0.46, 0.22, 1]);
        box(x + 2, y + 13, 30, 3, [0.45, 0.27, 0.12, 1]);
        box(x + 14, y + 2, 3, 26, [0.45, 0.27, 0.12, 1]);
        box(x + 2, y + 2, 4, 26, [0.85, 0.6, 0.3, 1]);
        if (s.golden) box(x + 2, y + 1, 30, 3, [1, 0.82, 0.25, 1]);
      }
    }
    for (const l of lanterns) {
      if (l.x < cam - 40 || l.x > cam + 1000) continue;
      const sw = Math.sin(t * 1.3 + l.ph) * 3, ly = l.y + l.len;
      box(l.x - 0.5, l.y, 1.5, l.len, [0.25, 0.16, 0.1, 0.9]);
      const c = [[1, 0.45, 0.25], [1, 0.8, 0.3], [0.45, 0.85, 1]][l.hue];
      box(l.x - 6 + sw, ly, 12, 15, [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, 1]);
      box(l.x - 4 + sw, ly + 2, 8, 11, [c[0], c[1], c[2], 1]);
    }
  });

  EV.on('drawAdd', (t, cam) => {
    const api = RC.game, R = api.R, r = rect('glow'); if (!r) return;
    for (const l of lanterns) {
      if (l.x < cam - 80 || l.x > cam + 1040) continue;
      const c = [[1, 0.45, 0.25], [1, 0.8, 0.3], [0.45, 0.85, 1]][l.hue], sw = Math.sin(t * 1.3 + l.ph) * 3, k = 0.85 + 0.15 * Math.sin(t * 5 + l.ph);
      R.sprite(api.atlas.set, r, l.x + sw - 40, l.y + l.len + 8 - 40, 80 / r.w, 80 / r.h, { col: [c[0], c[1], c[2], 0.45 * k], lit: 0, noSnap: true });
    }
    for (const s of props) if (s.type === 'spring' && s.x > cam - 60 && s.x < cam + 1020) {
      R.sprite(api.atlas.set, r, s.x - 28, s.y - 40, 56 / r.w, 40 / r.h, { col: [0.7, 0.5, 1, 0.3 + 0.12 * Math.sin(t * 3 + s.bob)], lit: 0, noSnap: true });
    }
  });
})();
