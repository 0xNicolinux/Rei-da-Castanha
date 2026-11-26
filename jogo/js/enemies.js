/* Rei da Castanha: inimigos novos, chefe, NPCs e itens (módulo plugado via RC.events / RC.game).

   ======================= CATÁLOGO DE SPRITES (js/art.js, procedurais, 1 texel = S=2 px de mundo) =======================
   Todos olham para a ESQUERDA no atlas e têm âncora = CENTRO-INFERIOR do quadro (x = w/2, y = h). Use RC.enemies.draw()
   para desenhar com âncora, espelho (face:+1 vira para a direita), escala, rotação e cor. Quadros: nome_1 .. nome_n.

   INIMIGOS (tipos em RC.game.ENEMY: wasp, beetle, toad, ladrao)
     wasp_1..4        vespa voando (bater de asas)  38x34     wasp_hurt (1)  atordoada/morta
     beetle_1..4      besouro blindado andando       54x40     beetle_flip_1..2 de barriga p/ cima (perninhas mexendo)
     toad_1..2        sapo parado (respira)          46x36     toad_puff_1..2 papo inflando   toad_spit (1) cuspindo   toad_hurt (1)
     proj_glob_1..2   bola de gosma do sapo          14x14
     boss_idle_1..4   Barão Urso parado          80x80     boss_walk_1..4  boss_wind_1..2 (carregando, o 2 é vermelho)
     boss_dash_1..2   investida com o saco de escudo           boss_jump_1..2 (subindo, descendo)   boss_slam_1 (pousou)
     boss_throw_1..2  arremesso (levanta, solta)               boss_hurt_1..2   boss_tired_1 (zonzo)
     fx_star          estrelinha de tontura 11x10      fx_excl  "!" de alerta 6x12     fx_shock  poeira da onda de choque 48x22
   NPCs (idle _1.._4 em loop ~5 fps; falando alterne _t1/_t2 ~8 fps)
     npc_irma1_1..4, npc_irma1_t1..2   Rita, irmã guitarrista, bandana rosa, guitarra vermelha, pelo ruivo      58x66
     npc_irma2_1..4, npc_irma2_t1..2   Rosa, irmã baixista, franja ciano + óculos escuros, baixo azul-petróleo, pelo cinza  58x66
     npc_texugo_1..4, npc_texugo_t1..2 Seu Gambá, caminhoneiro (boné amarelo, macacão, chave inglesa)         68x66
     npc_corvo_1..4, npc_corvo_t1..2   Urubu fofoqueiro com monóculo, empoleirado em galhinho (galho incluso)  48x54
   ITENS / PROPS (âncora centro-inferior; item_* têm _1 normal e _2 com brilho: alterne ~3 fps)
     item_corda_1..2 22x22   item_palheta_1..2 20x22   item_chave_1..2 26x24   item_amp_1..2 34x34 (_1 apagado, _2 aceso)
     crate 36x36   crate_hit 36x36 (rachada)   crate_piece_1..3 10x10 (lascas)
     spring_1..3 30x34 (comprimida, meio, esticada)   sign 40x48 (seta p/ direita)   sign_warn 40x48 (aviso "!")
     lantern_paper_1..3 24x38 (lanterna de papel; ÂNCORA NO TOPO: use anchor:'t')

   API: RC.enemies = { spawnBoss(x), boss(), draw(name,x,y,o), drawNpc(quem,x,chaoY,t,o), shoot(kind,x,y,vx,vy,o), projectiles, SPRITES }
   Eventos emitidos: 'bossDefeated'(boss) · 'bossAggro'(boss) · 'bossPhase'(boss, fase) · 'projectileHit'(proj).
   draw(name, x, y, {face, sx, sy, rot, col, emit, anchor:'b'|'c'|'t'}) — (x,y) é o ponto de âncora no mundo. */
(function () {
  'use strict';
  const RC = window.RC, A = RC.game, EV = RC.events;
  if (!A) return;
  const { clamp, lerp } = RC;
  const S = A.S, G = A.G, ENEMY = A.ENEMY;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sgn = (v) => (v < 0 ? -1 : 1);
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  const easeIO = (u) => u * u * (3 - 2 * u);

  /* ---------------------------------------------------------------- desenho */
  function draw(name, x, y, o) {
    o = o || {};
    const r = A.rects[name]; if (!r) return;
    const sx = (o.sx || 1) * S, sy = (o.sy || 1) * S, w = r.w * sx, h = r.h * sy;
    const so = {};
    if (o.col) so.col = o.col;
    if (o.emit) so.emit = o.emit;
    if (o.lit !== undefined) so.lit = o.lit;
    if (o.rot) { so.rot = o.rot; so.noSnap = true; }
    const top = o.anchor === 't' ? y : o.anchor === 'c' ? y - h / 2 : y - h;
    A.spr(name, x - w / 2, top, o.face > 0 ? -sx : sx, sy, so);
  }
  const onScreen = (x, m) => x > G.camX - (m || 120) && x < G.camX + A.WW + (m || 120);

  function shadow(cx, y, w, a) {
    const sb = A.surfaceBelow(cx, y - 4); if (sb > 1e8) return;
    const d = clamp((sb - y) / 200, 0, 1), k = 1 - d * 0.45;
    A.R.sprite(A.atlas.set, A.rects.glow, cx - w * k, sb - 4, (w * 2 * k) / 64, 8 / 64, { col: [0, 0, 0, a * (1 - d * 0.7)], lit: 0, noSnap: true });
  }
  function stars(cx, cy, t, n, rx) {
    for (let i = 0; i < n; i++) {
      const a = t * 5 + (i * Math.PI * 2) / n;
      draw('fx_star', cx + Math.cos(a) * rx, cy + Math.sin(a) * rx * 0.3 + 5, { sx: 0.85, sy: 0.85, emit: 0.7 });
    }
  }
  function excl(cx, top, t) {
    const k = 1 + 0.18 * Math.sin(t * 22);
    draw('fx_excl', cx, top - 4 - Math.abs(Math.sin(t * 11)) * 5, { sx: 1.1 * k, sy: 1.1 * k, emit: 0.9 });
  }
  const pl = () => A.player;
  const pcx = () => A.player.x + A.player.w / 2;
  const pcy = () => A.player.y + A.player.h / 2;

  /* NPCs: quem = 'irma1' | 'irma2' | 'texugo' | 'corvo' */
  function drawNpc(who, x, fy, t, o) {
    o = o || {};
    const name = 'npc_' + who;
    let fr;
    if (o.talk) fr = name + '_t' + (1 + (Math.floor(t * 8) % 2));
    else fr = name + '_' + (1 + (Math.floor(t * 5) % 4));
    draw(fr, x, fy + 2, { face: o.face, sx: o.scale, sy: o.scale, col: o.col, emit: o.emit });
  }

  /* ---------------------------------------------------------------- projéteis e ondas */
  const P = [];
  function shoot(kind, x, y, vx, vy, o) {
    const p = Object.assign({ kind, x, y, vx, vy, g: kind === 'glob' ? 520 : 1100, life: 5, t: 0, r: kind === 'glob' ? 11 : 12, rot: 0, vr: rnd(-9, 9), bounce: kind === 'nut' ? 1 : 0 }, o || {});
    P.push(p); return p;
  }
  function hitsPlayer(px, py, r) {
    const p = pl();
    if (p.dead || p.finishing) return false;
    return px + r > p.x && px - r < p.x + p.w && py + r > p.y && py - r < p.y + p.h;
  }
  function splat(p, col) {
    A.burst('spark', p.x, p.y, 9, 170, { col, life: 0.4, size: 0.7 });
    A.dust(p.x, p.y + 4, 3);
  }
  function updateProj(dt) {
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t += dt; p.life -= dt;
      if (p.kind === 'wave') {
        p.x += p.vx * dt;
        if (Math.random() < dt * 40) A.dust(p.x, p.y, 1);
        const q = pl();
        if (!q.dead && Math.abs(pcx() - p.x) < 26 && q.y + q.h > p.y - 26 && q.y + q.h < p.y + 12) { A.hurt(p.x - p.vx * 0.01); EV.emit('projectileHit', p); }
        if (p.life <= 0 || p.x < 0 || p.x > G.lv.width) P.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const sb = A.surfaceBelow(p.x, p.y - 20);
      if (p.vy > 0 && p.y + p.r * 0.6 >= sb) {
        if (p.bounce > 0) { p.bounce--; p.vy = -p.vy * 0.5; p.vx *= 0.6; p.y = sb - p.r * 0.6; A.dust(p.x, sb, 3); p.life = Math.min(p.life, 1.1); }
        else { splat(p, p.kind === 'glob' ? [0.6, 0.9, 0.2] : [1, 0.7, 0.3]); P.splice(i, 1); continue; }
      }
      if (hitsPlayer(p.x, p.y, p.r)) { splat(p, p.kind === 'glob' ? [0.6, 0.9, 0.2] : [1, 0.7, 0.3]); A.hurt(p.x); EV.emit('projectileHit', p); P.splice(i, 1); continue; }
      if (p.life <= 0 || p.y > G.lv.width + 800 || p.y > 900) P.splice(i, 1);
    }
  }
  EV.on('drawFront', (t) => {
    for (const p of P) {
      if (!onScreen(p.x, 60)) continue;
      if (p.kind === 'glob') draw('proj_glob_' + (1 + (Math.floor(t * 9) % 2)), p.x, p.y + 12, { rot: Math.atan2(p.vy, p.vx) * 0.0 + Math.sin(t * 20) * 0.15, emit: 0.4, sx: 1.1, sy: 1.1 });
      else if (p.kind === 'nut') draw('acorn_' + (1 + (Math.floor(t * 8 + p.vr) % 3)), p.x, p.y, { anchor: 'c', rot: p.rot, sx: 1.25, sy: 1.25, col: [1.25, 0.7, 0.55], emit: 0.3 });
      else if (p.kind === 'wave') {
        const k = clamp(p.life / 0.4, 0, 1);
        draw('fx_shock', p.x, p.y + 3, { face: p.vx > 0 ? 1 : -1, sx: 1.3, sy: 1.5 * Math.min(1, p.t * 6), col: [1, 1, 1, Math.min(1, k * 1.2)], lit: 0.4 });
      }
    }
  });

  /* ---------------------------------------------------------------- morte com personalidade */
  /* e.dd = estado de corpo: x (centro), y (pés), vx, vy, rot, vr, t, rest. Integrado em tick (roda mesmo com o inimigo morto). */
  function launch(e, how, o) {
    o = o || {};
    const cx = e.x + e.w / 2, away = sgn(cx - pcx());
    const stomp = how === 'stomp' && !o.always;
    e.dd = { x: cx, y: e.y + e.h, vx: away * (stomp ? 40 : rnd(240, 360)) * (o.k || 1), vy: stomp ? -260 : -rnd(520, 640) * (o.k || 1), rot: 0, vr: away * (stomp ? 4 : rnd(9, 14)), t: 0, bounces: 0, rest: false, how, squash: !!(stomp && o.squash), max: o.max || 1.5 };
    if (e.dd.squash) { e.dd.vx = e.dd.vy = e.dd.vr = 0; e.dd.rest = true; }
  }
  function stepBody(e, dt) {
    const d = e.dd; if (!d) return;
    d.t += dt;
    if (d.rest) return;
    d.vy += 1500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
    const sb = A.surfaceBelow(d.x, d.y - 40);
    if (d.vy > 0 && d.y >= sb && sb < 1e8) {
      d.y = sb;
      if (d.bounces < (d.maxBounce === undefined ? 2 : d.maxBounce) && d.vy > 160) { d.bounces++; d.vy = -d.vy * 0.45; d.vx *= 0.6; d.vr *= 0.55; A.dust(d.x, sb, 4); A.sfx('land', 0.18, 1.3); }
      else { d.rest = true; d.vx = d.vy = d.vr = 0; A.dust(d.x, sb, 6); }
    }
  }
  /* corpo desenhado por drawDead (chamado de game.js drawActors). frame = nome do sprite; devolve true se ainda visível */
  function drawBody(e, t, frame, o) {
    o = o || {};
    const d = e.dd; if (!d) return false;
    const life = o.max || d.max;
    if (d.t > life) return false;
    const fade = clamp((life - d.t) / 0.35, 0, 1);
    if (d.squash) {
      const k = clamp(d.t / 0.06, 0, 1);
      draw(frame, d.x, d.y + 2, { face: sgn(e.dir), sx: 1 + 0.35 * k, sy: 1 - 0.7 * k, col: [1, 1, 1, fade] });
      if (d.t > 0.12) stars(d.x, d.y - 30, t, 3, 22);
      return true;
    }
    // vira de ponta-cabeça ao girar; rot não passa de ~pi/2 quando repousa
    let rot = d.rot;
    if (d.rest) rot = clamp(rot, -1.6, 1.6) * (o.restK === undefined ? 0.35 : o.restK);
    const blink = d.t > life - 0.6 ? (Math.floor(d.t * 18) % 2 ? 0.3 : 1) : 1;
    const lift = (o.ay || 0) * Math.abs(Math.sin(rot));
    if (!d.rest) shadow(d.x, d.y, 24, 0.3);
    draw(frame, d.x, d.y + lift, { face: sgn(e.dir), rot, col: [1, 1, 1, fade * blink], anchor: o.anchor });
    if (d.t < life - 0.5 && d.t > 0.25 && (d.rest || d.vy > 0)) stars(d.x, d.y - (o.sh || 40), t, 3, 20);
    return true;
  }

  /* ---------------------------------------------------------------- VESPA */
  ENEMY.wasp = {
    w: 40, h: 34, hp: 1,
    init(e) {
      e.hover = 100 + Math.random() * 30;
      e.left = Math.max(30, e.left - 120); e.right = Math.min(G.lv.width - 30, e.right + 120);
      e.hy = e.floorY - e.h - e.hover; e.y = e.hy; e.ph = Math.random() * 6; e.st = 'patrol'; e.stT = 0; e.cd = 0.8 + Math.random() * 1.5; e.hp0 = e.hp;
    },
    update(e, dt) {
      const cx = e.x + e.w / 2, dx = pcx() - cx, p = pl();
      e.ph += dt;
      if (e.st === 'patrol') {
        e.x += e.dir * e.speed * 0.9 * dt;
        const nx = e.x + e.w / 2;
        if (nx < e.left) { e.x = e.left - e.w / 2; e.dir = 1; } else if (nx > e.right) { e.x = e.right - e.w / 2; e.dir = -1; }
        e.y = e.hy + Math.sin(e.ph * 3) * 8;
        e.cd -= dt;
        if (e.cd <= 0 && Math.abs(dx) < 330 && Math.abs(dx) > 70 && !p.dead && !p.finishing && Math.abs(pcy() - (e.floorY - 30)) < 260) { e.st = 'warn'; e.stT = 0; e.dir = sgn(dx); }
      } else if (e.st === 'warn') {
        e.stT += dt; e.dir = sgn(dx);
        e.y += (e.hy - 10 - e.y) * Math.min(1, dt * 8);
        if (e.stT >= 0.55) {
          e.st = 'dive'; e.stT = 0; e.sx0 = e.x; e.sy0 = e.y;
          e.tx = clamp(pcx() + sgn(dx) * 70 - e.w / 2, 0, G.lv.width - e.w); e.ty = e.floorY - e.h - 6;
          e.dir = sgn(e.tx - e.x);
          A.sfx('swing', 0.25, 1.6);
        }
      } else if (e.st === 'dive') {
        e.stT += dt / 0.7; const u = Math.min(1, e.stT);
        e.x = lerp(e.sx0, e.tx, u); e.y = lerp(e.sy0, e.ty, easeOut(u));
        if (u >= 1) { e.st = 'rise'; e.stT = 0; e.sx0 = e.x; e.sy0 = e.y; }
      } else if (e.st === 'rise') {
        e.stT += dt / 0.95; const u = Math.min(1, e.stT);
        e.y = lerp(e.sy0, e.hy, easeIO(u));
        e.x = clamp(e.x + e.dir * e.speed * 1.1 * dt, e.left - e.w / 2, e.right - e.w / 2);
        if (u >= 1) { e.st = 'patrol'; e.cd = 2 + Math.random() * 1.6; }
      }
    },
    draw(e, t) {
      const cx = e.x + e.w / 2, fy = e.y + e.h + 14;
      if (!onScreen(cx)) return;
      shadow(cx, e.y + e.h, 20, 0.28);
      let name = 'wasp_' + (1 + (Math.floor(e.anim * 18) % 4)), rot = 0, ox = 0, sx = 1, sy = 1;
      if (e.stun > 0) { name = 'wasp_hurt'; rot = Math.sin(t * 30) * 0.3; }
      else if (e.st === 'warn') { rot = -0.45 * e.dir; ox = Math.sin(t * 60) * 2.5; }
      else if (e.st === 'dive') { rot = 0.65 * e.dir; sx = 1.06; sy = 0.94; }
      else if (e.st === 'rise') rot = -0.2 * e.dir;
      else rot = Math.sin(e.anim * 3) * 0.06;
      draw(name, cx + ox, fy, { face: e.dir, rot, sx, sy });
      if (e.st === 'warn' && e.stun <= 0) excl(cx, e.y - 26, t);
      if (e.stun > 0.15) stars(cx, e.y - 8, t, 3, 22);
    },
    onKill(e, how) { launch(e, how, { always: true, k: how === 'stomp' ? 0.6 : 1 }); A.burst('spark', e.x + e.w / 2, e.y + 10, 5, 220, { col: [1, 0.85, 0.2], life: 0.45 }); },
    drawDead(e, t) { if (!e.dd) launch(e, 'punch'); drawBody(e, t, 'wasp_hurt', { max: 1.6, restK: 0.6 }); return true; }
  };

  /* ---------------------------------------------------------------- BESOURO BLINDADO (2 golpes; vira de costas) */
  ENEMY.beetle = {
    w: 56, h: 46, hp: 2,
    init(e) { e.hp0 = e.hp; e.flip = false; e.rise = 0; e.charge = 0; e.warn = 0; e.cd = 1 + Math.random() * 2; e.speed = Math.max(34, Math.min(52, e.speed)); },
    update(e, dt) {
      if (e.rise > 0) { e.rise -= dt; return; }
      const cx = e.x + e.w / 2, dx = pcx() - cx, p = pl();
      if (e.warn > 0) { e.warn -= dt; e.dir = sgn(dx); if (e.warn <= 0) { e.charge = 1.0; A.sfx('swing', 0.25, 0.7); } return; }
      e.cd -= dt;
      if (e.charge <= 0 && e.cd <= 0 && sgn(dx) === e.dir && Math.abs(dx) < 280 && Math.abs(dx) > 50 && Math.abs(pcy() - (e.y + e.h / 2)) < 70 && !p.dead) { e.warn = 0.4; e.cd = 3; A.dust(cx, e.y + e.h, 4); return; }
      const k = e.charge > 0 ? 2.8 : 1;
      if (e.charge > 0) { e.charge -= dt; if (Math.random() < dt * 22) A.dust(cx - e.dir * 20, e.y + e.h, 1); }
      e.x += e.dir * e.speed * k * dt;
      const nx = e.x + e.w / 2;
      if (nx < e.left) { e.x = e.left - e.w / 2; e.dir = 1; e.charge = 0; } else if (nx > e.right) { e.x = e.right - e.w / 2; e.dir = -1; e.charge = 0; }
    },
    tick(e, dt) {
      if (e.dead) { stepBody(e, dt); return; }
      if (e.hp < e.hp0) {                                  // levou o primeiro golpe: capota de barriga p/ cima
        e.hp0 = e.hp; e.flip = true; e.stun = 2.3; e.kb = (e.kb || 0) * 0.6; e.charge = 0; e.warn = 0;
        A.burst('spark', e.x + e.w / 2, e.y + 10, 12, 260, { col: [0.7, 0.8, 1], life: 0.45 });
        A.sfx('punch', 0.3, 1.9); G.shake = Math.max(G.shake, 4);
      }
      if (e.flip && e.stun <= 0) { e.flip = false; e.rise = 0.55; A.dust(e.x + e.w / 2, e.y + e.h, 5); }
    },
    draw(e, t) {
      const cx = e.x + e.w / 2, fy = e.y + e.h + 2;
      if (!onScreen(cx)) return;
      shadow(cx, fy, 30, 0.34);
      let name, rot = 0, sx = 1, sy = 1, ox = 0;
      if (e.flip) {
        name = 'beetle_flip_' + (1 + (Math.floor(e.anim * 7) % 2));
        rot = Math.sin(t * 13) * 0.09; if (e.stun < 0.6) ox = Math.sin(t * 50) * 2;      // balança antes de desvirar
      } else if (e.rise > 0) {
        name = 'beetle_1'; const k = 1 - e.rise / 0.55; sy = 1 + 0.12 * Math.sin(k * 12) * (1 - k); sx = 1 / sy;
      } else if (e.warn > 0) { name = 'beetle_1'; ox = Math.sin(t * 70) * 2; sy = 0.92; sx = 1.06; }
      else name = 'beetle_' + (1 + (Math.floor(e.anim * (e.charge > 0 ? 16 : 7)) % 4));
      draw(name, cx + ox, fy, { face: e.dir, rot, sx, sy, col: e.stun > 0 && !e.flip ? [1.4, 1.4, 1.4, 1] : null });
      if (e.flip) stars(cx, e.y - 4, t, 3, 26);
      if (e.warn > 0) excl(cx, e.y - 20, t);
    },
    onKill(e, how) { launch(e, how, { always: true, k: 1.1, max: 1.7 }); A.burst('spark', e.x + e.w / 2, e.y + 12, 8, 280, { col: [0.45, 0.6, 1], life: 0.6 }); A.burst('spark', e.x + e.w / 2, e.y + 12, 4, 200, { col: [1, 0.85, 0.3], life: 0.5, size: 0.7 }); },
    drawDead(e, t) { if (!e.dd) launch(e, 'punch'); drawBody(e, t, 'beetle_flip_' + (1 + (Math.floor(t * 9) % 2)), { max: 1.7, restK: 0.2, sh: 36 }); return true; }
  };

  /* ---------------------------------------------------------------- SAPO CUSPIDOR */
  ENEMY.toad = {
    w: 54, h: 40, hp: 1,
    init(e) { e.hp0 = e.hp; e.st = 'idle'; e.stT = 0; e.cd = 1 + Math.random() * 2; e.speed = 0; },
    update(e, dt) {
      const cx = e.x + e.w / 2, dx = pcx() - cx, dy = pcy() - (e.y + e.h / 2), p = pl();
      e.dir = sgn(dx);
      if (e.st === 'idle') {
        e.cd -= dt;
        if (e.cd <= 0 && Math.abs(dx) < 470 && Math.abs(dx) > 50 && Math.abs(dy) < 300 && !p.dead && !p.finishing) { e.st = 'puff'; e.stT = 0; A.sfx('jump', 0.14, 0.55); }
      } else if (e.st === 'puff') {
        e.stT += dt;
        if (e.stT >= 0.9) {
          const ox = cx + e.dir * 26, oy = e.y + e.h * 0.4, T = 1.05, g = 520;
          const tx = pcx() + p.vx * 0.25, ty = p.y + p.h * 0.55;
          shoot('glob', ox, oy, clamp((tx - ox) / T, -340, 340), (ty - oy) / T - 0.5 * g * T);
          A.sfx('swing', 0.25, 0.6); A.burst('spark', ox, oy, 6, 120, { col: [0.7, 0.95, 0.3], life: 0.3, size: 0.6 });
          e.st = 'spit'; e.stT = 0;
        }
      } else if (e.st === 'spit') {
        e.stT += dt;
        if (e.stT >= 0.45) { e.st = 'idle'; e.cd = 2.3 + Math.random() * 1.5; }
      }
    },
    draw(e, t) {
      const cx = e.x + e.w / 2, fy = e.y + e.h + 2;
      if (!onScreen(cx)) return;
      shadow(cx, fy, 28, 0.32);
      let name = 'toad_' + (1 + (Math.floor(e.anim * 2.4) % 2)), sx = 1, sy = 1, ox = 0, col = null;
      if (e.stun > 0) { name = 'toad_hurt'; }
      else if (e.st === 'puff') {
        const k = clamp(e.stT / 0.9, 0, 1);
        name = k < 0.4 ? 'toad_puff_1' : 'toad_puff_2';
        sx = 1 + 0.1 * k; sy = 1 + 0.06 * k; ox = Math.sin(t * 55) * 1.6 * k;
        const f = 0.5 + 0.5 * Math.sin(t * 24); col = [1, 1 - 0.25 * k * f, 1 - 0.3 * k * f, 1];
      } else if (e.st === 'spit') { name = 'toad_spit'; const k = e.stT / 0.45; sx = 0.92 + 0.08 * k; sy = 1.1 - 0.1 * k; }
      draw(name, cx + ox, fy, { face: e.dir, sx, sy, col });
      if (e.stun > 0.15) stars(cx, e.y - 2, t, 3, 22);
    },
    onKill(e, how) { launch(e, how, { squash: true, k: 1 }); if (how === 'stomp') { A.dust(e.x + e.w / 2, e.y + e.h, 8); } A.burst('spark', e.x + e.w / 2, e.y + 16, 5, 200, { col: [0.7, 0.9, 0.3], life: 0.5 }); },
    drawDead(e, t) { if (!e.dd) launch(e, 'punch'); drawBody(e, t, 'toad_hurt', { max: e.dd && e.dd.squash ? 1.1 : 1.5, restK: 0.3 }); return true; }
  };

  /* ---------------------------------------------------------------- CHEFE: Barão Urso, o ladrão das castanhas */
  const BOSS_HP = 12;
  let boss = null, bar = null, barFill = null, barPips = null;
  const clamp2 = (e) => { e.x = clamp(e.x, e.left - e.w / 2, e.right - e.w / 2); };

  function ensureBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'boss-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = 'position:fixed;left:50%;top:104px;transform:translateX(-50%);width:min(520px,72vw);z-index:6;pointer-events:none;display:none;text-align:center;font-family:"Lilita One",system-ui,sans-serif;color:#ffe9b0;text-shadow:0 2px 0 #3b1608,0 0 10px #000a;transition:opacity .4s';
    bar.innerHTML = '<div style="font-size:clamp(14px,2.2vw,20px);letter-spacing:.04em;margin-bottom:4px">Barão Urso, o Ladrão das Castanhas</div>' +
      '<div style="height:16px;border:3px solid #3b1608;border-radius:10px;background:#2a1208cc;overflow:hidden;position:relative;box-shadow:0 3px 0 #0006"><div class="f" style="height:100%;width:100%;background:linear-gradient(#ffd25a,#e0861e);border-radius:6px;transition:width .25s"></div>' +
      '<div class="p" style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(100%/12 - 2px),#3b1608 calc(100%/12 - 2px) calc(100%/12))"></div></div>';
    document.body.appendChild(bar);
    barFill = bar.querySelector('.f');
  }
  function updateBar() {
    if (!bar) return;
    const show = boss && !boss.dead && boss.st !== 'sleep' && (G.state === 'playing' || G.state === 'paused');
    bar.style.display = show ? 'block' : 'none'; document.body.classList.toggle('boss-on', !!show);
    if (show) barFill.style.width = clamp(boss.hp / BOSS_HP, 0, 1) * 100 + '%';
  }

  function popNuts(e, n, golden) {
    const cx = e.x + e.w / 2;
    for (let i = 0; i < n; i++) {
      G.nuts.push({ x: cx + rnd(-60, 60), y: e.y + e.h * 0.35 + rnd(-30, 10), golden: !!(golden && i < golden), taken: false, ph: Math.random() * 6, mag: false, vy: -rnd(260, 520), drop: true });
    }
    A.renderNuts && A.renderNuts();
  }
  function clang(e) {
    if (e.clangT > 0) return;
    e.clangT = 0.25;
    const cx = e.x + e.w / 2 + (pcx() < e.x + e.w / 2 ? -34 : 34);
    A.burst('spark', cx, e.y + e.h * 0.5, 10, 300, { col: [0.9, 0.95, 1], life: 0.3, size: 0.6 });
    A.sfx('punch', 0.3, 2.2);
  }
  function setH(e, h) { const fy = e.y + e.h; e.h = h; e.y = fy - h; }
  function faceP(e) { e.dir = sgn(pcx() - (e.x + e.w / 2)); }
  function nextAttack(e) {
    const ph = e.phase, pool = ph === 1 ? ['charge', 'throw', 'charge'] : ph === 2 ? ['charge', 'throw', 'slam'] : ['charge', 'slam', 'throw', 'slam'];
    let a; let guard = 0;
    do { a = pool[Math.floor(Math.random() * pool.length)]; } while (a === e.last && guard++ < 6);
    e.last = a; return a;
  }
  function toWalk(e) { e.st = 'walk'; e.sub = undefined; e.walkT = [0, 1.5, 1.0, 0.6][e.phase] * (0.8 + Math.random() * 0.5); e.shield = false; }

  ENEMY.ladrao = {
    w: 84, h: 118, hp: BOSS_HP,
    init(e) {
      e.boss = true; e.hp0 = e.hp; e.st = 'sleep'; e.t = 0; e.phase = 1; e.inv = 0; e.shield = false; e.clangT = 0; e.last = '';
      e.lastStun = 0; e.cdir = 1; e.air = false; e.vy = 0; e.shots = 0; e.speed = 95; e.phaseNew = 0; e.stepT = 0;
    },
    update(e, dt) {
      const cx = e.x + e.w / 2, dx = pcx() - cx, sp = [0, 1, 1.3, 1.6][e.phase];
      e.t += dt; e.stepT += dt;
      switch (e.st) {
        case 'sleep':
          faceP(e);
          if (Math.abs(dx) < 620 || e.hp < e.hp0) { e.st = 'taunt'; e.t = 0; EV.emit('bossAggro', e); A.sfx('kill', 0.3, 0.5); }
          break;
        case 'taunt': faceP(e); if (e.t > 1.2) toWalk(e); break;
        case 'roar': e.shake = 1; if (e.t > 1.1) { toWalk(e); } break;
        case 'hurt': if (e.t > 0.3) toWalk(e); break;
        case 'walk': {
          faceP(e);
          if (Math.abs(dx) > 70) e.x += e.dir * e.speed * sp * dt;
          clamp2(e);
          e.walkT -= dt;
          if (e.walkT <= 0) { e.st = nextAttack(e); e.t = 0; e.sub = 'wind'; e.cdir = sgn(dx); }
          break;
        }
        case 'charge': {                                    // 1) carrega (vermelho, "!"), 2) investe de saco na frente, 3) bate na parede e fica zonzo
          if (e.sub === 'wind') {
            faceP(e); e.cdir = e.dir;
            if (e.t >= [0, 0.9, 0.72, 0.55][e.phase]) { e.sub = 'run'; e.t = 0; e.shield = e.hp > 2; setH(e, 88); A.sfx('swing', 0.3, 0.6); G.shake = Math.max(G.shake, 3); }
          } else if (e.sub === 'run') {
            e.dir = e.cdir; e.x += e.cdir * 560 * (0.9 + 0.2 * e.phase) * dt;
            if (Math.random() < dt * 30) A.dust(e.x + e.w / 2 - e.cdir * 30, e.y + e.h, 1);
            const nx = e.x + e.w / 2;
            if (nx < e.left + 6 || nx > e.right - 6 || e.t > 1.6) {
              clamp2(e); setH(e, 118); e.shield = false; e.sub = 'bonk'; e.t = 0;
              if (nx < e.left + 6 || nx > e.right - 6) {
                G.shake = Math.max(G.shake, 12); A.sfx('land', 0.5, 0.5); A.dust(e.x + e.w / 2 + e.cdir * 40, e.y + e.h, 10);
                A.burst('spark', e.x + e.w / 2 + e.cdir * 44, e.y + e.h * 0.4, 14, 320, { col: [1, 0.85, 0.4], life: 0.5 });
                popNuts(e, 5, 0); e.stunSelf = 1.7;
              } else e.stunSelf = 0.7;
            }
          } else if (e.sub === 'bonk') {
            if (e.t >= e.stunSelf) { e.sub = undefined; toWalk(e); }
          }
          break;
        }
        case 'throw': {
          const n = [0, 1, 2, 3][e.phase];
          if (e.sub === 'wind') {
            faceP(e);
            if (e.t >= 0.6) { e.sub = 'shoot'; e.t = 0; e.shots = 0; }
          } else if (e.sub === 'shoot') {
            faceP(e);
            if (e.t >= 0.2 + e.shots * 0.42 && e.shots < n) {
              const ox = cx + e.dir * 30, oy = e.y + 20, T = 0.85;
              const off = n === 3 ? (e.shots - 1) * 150 : n === 2 ? (e.shots - 0.5) * 110 : 0;
              const tx = pcx() + off + pl().vx * 0.3, ty = pl().y + pl().h * 0.5;
              shoot('nut', ox, oy, clamp((tx - ox) / T, -520, 520), (ty - oy) / T - 0.5 * 1100 * T);
              A.sfx('swing', 0.28, 0.9); e.shots++; e.flash = 0.2;
            }
            if (e.t >= 0.5 + n * 0.42) { e.sub = undefined; toWalk(e); }
          }
          break;
        }
        case 'slam': {
          if (e.sub === 'wind') {
            faceP(e);
            if (e.t >= [0, 0.7, 0.55, 0.42][e.phase]) {
              e.sub = 'air'; e.t = 0; e.air = true; e.vy = -820; e.jvx = clamp(dx / 1.1, -380, 380); A.sfx('jump', 0.4, 0.45); A.dust(cx, e.y + e.h, 8);
            }
          } else if (e.sub === 'air') {
            e.vy += 1500 * dt; e.y += e.vy * dt; e.x += e.jvx * dt; clamp2(e);
            if (e.vy > 0 && e.y + e.h >= e.floorY) {
              e.y = e.floorY - e.h; e.air = false; e.vy = 0; e.sub = 'land'; e.t = 0;
              G.shake = Math.max(G.shake, 14); G.hitstop = Math.max(G.hitstop || 0, 0.05); A.sfx('land', 0.6, 0.45); A.dust(e.x + e.w / 2, e.floorY, 14);
              A.burst('spark', e.x + e.w / 2, e.floorY - 6, 14, 280, { col: [1, 0.85, 0.5], life: 0.45 });
              const wx = e.x + e.w / 2;
              shoot('wave', wx - 30, e.floorY, -340 - 40 * e.phase, 0, { life: 1.7 });
              shoot('wave', wx + 30, e.floorY, 340 + 40 * e.phase, 0, { life: 1.7 });
              if (e.phase === 3) popNuts(e, 3, 0);
            }
          } else if (e.sub === 'land') {
            if (e.t >= 0.55) { e.sub = undefined; toWalk(e); }
          }
          break;
        }
      }
    },
    tick(e, dt) {
      if (e.dead) { stepBody(e, dt); return; }
      e.clangT = Math.max(0, e.clangT - dt); e.flash = Math.max(0, (e.flash || 0) - dt);
      if (e.st === 'sleep' && e.hp >= e.hp0) { e.lastStun = e.stun; return; }
      if (e.hp < e.hp0) {
        if (e.st === 'sleep') { e.st = 'taunt'; e.t = 0; EV.emit('bossAggro', e); }
        if (e.shield || e.inv > 0) {                         // investida blindada / janela de invulnerabilidade: golpe "tlim"
          e.hp = e.hp0; e.stun = Math.max(0, (e.lastStun || 0) - dt); e.kb = 0; clang(e);
        } else {
          e.hp0 = e.hp; e.inv = 1.0; e.kb = 0;
          if (e.sub !== 'bonk') { e.sub = undefined; }
          if (e.air) { e.air = false; e.vy = 0; }
          if (e.h !== 118) setH(e, 118);
          e.st = 'hurt'; e.t = 0;
          popNuts(e, 2 + Math.floor(Math.random() * 2), 0);
          A.burst('spark', e.x + e.w / 2, e.y + e.h * 0.4, 16, 300, { col: [1, 0.8, 0.4], life: 0.55 });
          const np = e.hp > 8 ? 1 : e.hp > 4 ? 2 : 3;
          if (np > e.phase) { e.phase = np; e.st = 'hurt'; e.roarNext = true; EV.emit('bossPhase', e, np); }
        }
      }
      if (e.kb) e.kb *= 0.1;
      if (e.inv > 0) e.inv -= dt;
      if (e.st === 'hurt' && e.roarNext && e.stun <= 0) { e.roarNext = false; e.st = 'roar'; e.t = 0; A.toast('O Barão ficou furioso!', 1600); G.shake = Math.max(G.shake, 9); A.sfx('kill', 0.4, 0.45); }
      e.lastStun = e.stun;
    },
    draw(e, t) {
      const cx = e.x + e.w / 2, fy = e.floorY + 2;
      if (!onScreen(cx, 200)) return;
      shadow(cx, e.y + e.h, 52, 0.4);
      let name, ox = 0, col = null, sx = 1, sy = 1, lift = 0;
      const fr = (n, rate) => 1 + (Math.floor(t * rate) % n);
      if (e.stun > 0 && e.st !== 'sleep') name = e.st === 'bonk' ? 'boss_tired_1' : 'boss_hurt_' + fr(2, 10);
      else switch (e.st) {
        case 'sleep': name = 'boss_idle_' + fr(4, 3); break;
        case 'taunt': name = 'boss_jump_1'; break;
        case 'roar': name = 'boss_wind_' + fr(2, 8); ox = Math.sin(t * 60) * 2; break;
        case 'hurt': name = 'boss_hurt_1'; break;
        case 'walk': name = 'boss_walk_' + fr(4, 6 + e.phase * 1.5); break;
        case 'charge':
          if (e.sub === 'wind') { name = e.t < 0.35 ? 'boss_wind_1' : 'boss_wind_2'; ox = Math.sin(t * 70) * 2.2; }
          else if (e.sub === 'run') name = 'boss_dash_' + fr(2, 14);
          else name = 'boss_tired_1';
          break;
        case 'throw':
          if (e.sub === 'wind') name = 'boss_throw_1'; else name = e.flash > 0 ? 'boss_throw_2' : 'boss_throw_1';
          break;
        case 'slam':
          if (e.sub === 'wind') { name = e.t < 0.2 ? 'boss_wind_1' : 'boss_wind_2'; ox = Math.sin(t * 60) * 2; }
          else if (e.sub === 'air') name = e.vy < 0 ? 'boss_jump_1' : 'boss_jump_2';
          else name = 'boss_slam_1';
          break;
        default: name = 'boss_idle_' + fr(4, 4);
      }
      if (e.inv > 0.4 && e.stun <= 0) col = [1.3, 1.3, 1.3, 1];
      draw(name, cx + ox, e.y + e.h + 2, { face: e.dir, sx, sy, col, emit: e.st === 'roar' ? 0.35 : 0 });
      if (e.stun > 0.1 || (e.st === 'charge' && e.sub === 'bonk')) stars(cx, e.y - 4, t, 4, 34);
      if ((e.st === 'charge' || e.st === 'slam') && e.sub === 'wind') excl(cx, e.y - 36, t);
      if (e.shield) A.R.sprite(A.atlas.set, A.rects.glow, cx + e.dir * 44 - 32 * 0.9, e.y + e.h * 0.5 - 32 * 0.9, 0.9 * 1, 0.9, { col: [0.8, 0.9, 1, 0.35], lit: 0, noSnap: true });
    },
    onKill(e, how) {
      const cx = e.x + e.w / 2;
      e.shield = false; e.air = false; setH(e, 118);
      launch(e, 'punch', { k: 0.95, max: 4.2 }); e.dd.vy = -820; e.dd.vx *= 0.55; e.dd.vr *= 0.5; e.dd.maxBounce = 3;
      G.shake = 16; G.flash = 0.55; G.hitstop = 0.18; G.aberr = Math.max(G.aberr || 0, 0.06);
      A.burst('spark', cx, e.y + e.h * 0.4, 40, 460, { col: [1, 0.85, 0.4], life: 0.9, size: 1.1 });
      A.burst('spark', cx, e.y + e.h * 0.4, 24, 340, { col: [1, 0.4, 0.3], life: 0.7 });
      A.sfx('kill', 0.5, 0.5);
      // chuva de castanhas roubadas
      for (let i = 0; i < 26; i++) G.nuts.push({ x: cx + rnd(-220, 220), y: e.y + rnd(-200, 40), golden: i < 4, taken: false, ph: Math.random() * 6, mag: false, vy: -rnd(120, 520), drop: true });
      A.renderNuts && A.renderNuts();
      A.toast('O Ladrão das Castanhas caiu!', 2800);
      e.deadFx = 0;
      EV.emit('bossDefeated', e);
    },
    drawDead(e, t) {
      if (!e.dd) return false;
      const d = e.dd;
      e.deadFx = (e.deadFx || 0);
      if (d.t < 3.4 && !d.rest && Math.random() < 0.3) A.burst('spark', d.x, d.y - 60, 2, 140, { col: [1, 0.9, 0.5], life: 0.4, size: 0.7 });
      const frame = d.t < 0.9 ? 'boss_hurt_' + (1 + (Math.floor(d.t * 8) % 2)) : 'boss_tired_1';
      const ok = drawBody(e, t, frame, { max: 4.2, restK: 0.95, ay: 26, sh: 90, anchor: undefined });
      if (!ok && !e.popped) { e.popped = true; A.burst('spark', d.x, d.y - 50, 30, 320, { col: [1, 0.85, 0.5], life: 0.7 }); A.dust(d.x, d.y, 12); }
      return true;
    }
  };

  /* ---------------------------------------------------------------- criação do chefe */
  function arenaAt(x) {
    const lv = G.lv, T = A.T;
    let c = clamp(Math.floor(x / T), 2, lv.cols - 3);
    for (let k = 0; k < 40 && lv.ground[c] < 0; k++) c = clamp(c + (k % 2 ? -k : k), 2, lv.cols - 3);
    const row = lv.ground[c];
    let l = c, r = c;
    while (l > 2 && lv.ground[l - 1] === row) l--;
    while (r < lv.cols - 3 && lv.ground[r + 1] === row) r++;
    const cx = x;
    return { left: Math.max(l * T + 70, cx - 430), right: Math.min((r + 1) * T - 70, cx + 430), floor: row * T };
  }
  function spawnBoss(x) {
    ensureBar();
    const a = arenaAt(x);
    if (a.right - a.left < 260) { a.left = Math.min(a.left, x - 130); a.right = Math.max(a.right, x + 130); }
    const e = A.makeEnemy({ type: 'ladrao', left: a.left, right: a.right, y: a.floor, speed: 95 }, G.enemies.length);
    e.x = clamp(x, a.left, a.right) - e.w / 2;
    G.enemies.push(e);
    boss = e;
    return e;
  }

  /* ---------------------------------------------------------------- variedade por fase */
  function diversify(lv) {
    const idx = lv.index || 0;
    const prob = [0, 0.22, 0.34, 0.42, 0.45][Math.min(4, idx)];
    if (!prob) return;
    const r = RC.mulberry32((lv.genSeed || lv.seed || 1) * 7 + idx * 131 + 5);
    const T = A.T, x0 = lv.start.x + 14 * T, x1 = lv.goal.x - 14 * T;
    const wt = idx === 1 ? [['wasp', 6], ['toad', 4]] : idx === 2 ? [['wasp', 4], ['toad', 3], ['beetle', 3]] : [['wasp', 3], ['toad', 3], ['beetle', 4]];
    const pickT = (pool) => { let tot = 0; pool.forEach((p) => (tot += p[1])); let v = r() * tot; for (const p of pool) { v -= p[1]; if (v <= 0) return p[0]; } return pool[0][0]; };
    G.enemies = G.enemies.map((e, i) => {
      const mid = (e.left + e.right) / 2;
      if (mid < x0 || mid > x1 || e.right - e.left < 2 * T || r() > prob) return e;
      let type;
      if (e.type === 'gator') type = r() < 0.75 ? 'beetle' : pickT(wt);
      else if (e.type === 'hopper') type = pickT(wt.filter((p) => p[0] !== 'beetle').concat([['toad', 2]]));
      else type = pickT(wt.filter((p) => p[0] !== 'beetle'));
      if (!ENEMY[type]) return e;
      return A.makeEnemy({ type, left: e.left, right: e.right, y: e.floorY, speed: e.speed }, i);
    });
  }

  /* ---------------------------------------------------------------- ligação com o jogo */
  EV.on('stageLoaded', (lv) => {
    P.length = 0; boss = null; updateBar();
    try { diversify(lv); } catch (err) { console.error('[enemies] diversify', err); }
    if (lv.index === 4 && !RC.missions) {                                // sem módulo de missões: o chefe fica na arena antes do caminhão
      const b = spawnBoss(lv.goal.x - 760);
      G.finishBlock = () => (boss && !boss.dead ? 'Derrote o Barão Urso para pegar as castanhas de volta!' : null);
    }
  });
  EV.on('update', (dt) => {
    // corpos de tipos sem tick (vespa, sapo) também precisam cair/quicar; antes ficavam congelados onde morreram
    for (const e of G.enemies) { const d = e.def; if (d && d.tick) d.tick(e, dt); else if (e.dead && e.dd) stepBody(e, dt); }
    updateProj(dt);
    updateBar();
  });
  EV.on('enemyKilled', (e, how) => { if (e.def && e.def.onKill) e.def.onKill(e, how); });

  RC.enemies = {
    spawnBoss, boss: () => boss, draw, drawNpc, shoot, projectiles: P,
    SPRITES: { npc: ['irma1', 'irma2', 'texugo', 'corvo'], enemies: ['wasp', 'beetle', 'toad', 'ladrao'] }
  };
})();
