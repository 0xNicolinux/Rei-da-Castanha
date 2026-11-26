/* Rei da Castanha: peças de fase com comportamento próprio (módulo plugado via RC.events).
   - troncos que balançam (platform.bob): sobem e descem; a colisão normal já acompanha a altura.
   - correntes de vento (lv.winds): quem plana dentro delas é empurrado para cima.
   - emboscada (lv.arenas): a tela trava, ondas de bichos surgem; ao vencer todas o caminho abre e castanhas chovem. */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  let arenas = [], winds = [];
  const G = () => RC.game.G;

  EV.on('stageLoaded', (lv) => {
    for (const p of lv.platforms) if (p.bob) p.y0 = p.y;
    winds = lv.winds || [];
    arenas = (lv.arenas || []).map((a) => Object.assign({ st: 'idle', wave: 0, foes: [] }, a));
    G().camLock = null;
  });

  function spawnWave(a) {
    const api = RC.game, g = G(), d = Math.min(1.15, (g.lv.index || 0) / 4);
    const n = 3 + a.wave + (g.lv.index >= 4 ? 1 : 0), w = (a.x1 - a.x0) / n;
    a.foes = [];
    for (let i = 0; i < n; i++) {
      const type = (i + a.wave) % 3 === 2 ? 'gator' : (i + a.wave) % 2 ? 'hopper' : 'ant';
      const speed = type === 'ant' ? 95 : type === 'hopper' ? 62 : 46;
      const e = api.makeEnemy({ type, left: a.x0 + i * w + 20, right: a.x0 + (i + 1) * w - 20, y: a.y, speed: Math.round(speed * (1 + d * 0.15)) }, i + a.wave);
      e.spawnT = 0.5;
      g.enemies.push(e); a.foes.push(e);
      api.burst('spark', e.x + e.w / 2, e.y + e.h / 2, 10, 200, { col: [1, 0.8, 0.4], life: 0.5 });
    }
    api.sfx('item', 0.4, 0.7);
  }

  EV.on('update', (dt) => {
    const api = RC.game, g = G(), p = api.player;
    if (!g.lv || g.state !== 'playing') return;
    // vento: empurra quem plana para cima e devolve fôlego de planeio
    for (const w of winds) {
      const cx = p.x + p.w / 2;
      if (cx > w.x0 && cx < w.x1 && p.y > w.y0 && p.y < w.y1) {
        if (p.gliding) { p.vy = Math.max(p.vy - 2600 * dt, -190); p.glideT = Math.min(3, p.glideT + dt * 1.5); }
        else if (!p.grounded && p.vy > 0) p.vy -= 500 * dt;                    // ajuda leve mesmo sem planar
      }
      if (Math.random() < dt * 14 && w.x1 > g.camX - 50 && w.x0 < g.camX + 1010)
        api.emit('spark', w.x0 + 16 + Math.random() * (w.x1 - w.x0 - 32), w.y1 - 40 - Math.random() * 60, { vx: (Math.random() - 0.5) * 20, vy: -150 - Math.random() * 80, life: 0.9, col: [0.7, 1, 0.8], size: 0.45 });
    }
    // troncos que balançam
    const t = g.time;
    for (const pl of g.lv.platforms) if (pl.bob) pl.y = pl.y0 + Math.sin(t * 1.6 + pl.ph) * 18;
    // emboscadas
    for (const a of arenas) {
      const cx = p.x + p.w / 2;
      if (a.st === 'idle' && cx > a.x0 + 140 && cx < a.x1 - 140 && p.grounded) {
        a.st = 'active'; a.wave = 0; g.camLock = clamp((a.x0 + a.x1) / 2 - 480, 0, g.lv.width - 960);
        api.toast('Emboscada! Derrote todos os bichos', 2200); api.sfx('deny', 0.3, 0.8); g.shake = Math.max(g.shake, 6);
        spawnWave(a);
      } else if (a.st === 'active' && (cx < a.x0 - 80 || cx > a.x1 + 80 || p.dead)) {
        a.st = 'idle'; g.camLock = null; for (const e of a.foes) e.dead = true; a.foes = [];       // morreu/voltou ao lampião: reinicia
      } else if (a.st === 'active') {
        if (p.x < a.x0) { p.x = a.x0; p.vx = Math.max(0, p.vx); }
        if (p.x + p.w > a.x1) { p.x = a.x1 - p.w; p.vx = Math.min(0, p.vx); }
        if (a.foes.every((e) => e.dead)) {
          a.wave++;
          if (a.wave >= a.waves) {
            a.st = 'done'; g.camLock = null;
            api.toast('Caminho livre!', 1600); api.sfx('item', 0.5, 1.3); if (RC.audio && RC.audio.jingle) { /* opcional */ }
            for (let i = 0; i < 7; i++) g.nuts.push({ x: (a.x0 + a.x1) / 2 + (i - 3) * 22, y: a.y - 90, golden: i === 3, taken: false, ph: i, mag: false, vy: -380 - i * 20, drop: true });
          } else { a.foes = []; spawnWave(a); api.toast(`Onda ${a.wave + 1} de ${a.waves}`, 1200); }
        }
      }
    }
  });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // arte: setas de corrente (faixa clara) e trava da arena
  EV.on('drawAdd', (t, cam) => {
    const api = RC.game, R = api.R, r = api.rects.glow; if (!r) return;
    for (const w of winds) {
      if (w.x1 < cam - 20 || w.x0 > cam + 980) continue;
      const k = 0.07 + 0.03 * Math.sin(t * 2 + w.x0);
      R.sprite(api.atlas.set, r, w.x0, w.y0, (w.x1 - w.x0) / r.w, (w.y1 - w.y0) / r.h, { col: [0.7, 1, 0.85, k], lit: 0, noSnap: true });
    }
    for (const a of arenas) if (a.st === 'active') {
      for (const x of [a.x0, a.x1]) R.sprite(api.atlas.set, r, x - 12, a.y - 220, 24 / r.w, 220 / r.h, { col: [1, 0.55, 0.25, 0.5 + 0.2 * Math.sin(t * 8)], lit: 0, noSnap: true });
    }
  });
  RC.setpieces = { arenas: () => arenas, winds: () => winds };
})();
