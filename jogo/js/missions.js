/* Rei da Castanha: missões da história (uma principal por fase + uma extra opcional).
   Plugado via RC.events / RC.game. Usa RC.hud / RC.enemies quando existirem; senão, cai em alternativas simples. */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  let GM = null;                               // RC.game (nasce depois do boot do game.js)
  const api = () => (GM = GM || RC.game);

  /* ------------------------------------------------------------ progresso da corrida */
  const run = { main: [false, false, false, false, false], side: [false, false, false, false, false] };
  let M = null;                                // missão da fase atual

  /* ------------------------------------------------------------ textos (pt-BR) */
  const D = (who, portrait, ...lines) => ({ who, portrait, lines });
  const INTRO = [
    [D('Corvo Fofoqueiro', 'corvo', 'Crá! Rei, sua despensa foi saqueada!', 'Só sobrou casca. Siga o rastro de cascas!'), D('Rei', 'rei', 'CADÊ MINHAS CASTANHAS?!')],
    [D('Rei', 'rei', 'A raiva virou rock. Preciso de corda, palheta e amplificador!'), D('Corvo Fofoqueiro', 'corvo', 'Crá! Uns bichos pegaram as peças. Vai lá bater neles.')],
    [D('Corvo Fofoqueiro', 'corvo', 'Crá! O caminhão das Irmãs quebrou. Elas estão presas por aqui!'), D('Rei', 'rei', 'Ninguém fica preso na minha floresta!')],
    [D('Texugo', 'texugo', 'Rei! Perdi a chave do caminhão!', 'Um bicho levou. Dá pra ver o brilho dela de longe.'), D('Rei', 'rei', 'Deixa comigo, motorista!')],
    [D('Corvo Fofoqueiro', 'corvo', 'Crá! O ladrão está no festival. É ele!'), D('Rei', 'rei', 'Hoje tem rock, e a despensa volta pra mim!')]
  ];
  const DONE = [
    [D('Corvo Fofoqueiro', 'corvo', 'Crá! Pegadas pequenas e farinha de guitarra?', 'O ladrão tem estilo. Vamos ao caminhão!')],
    [D('Rei', 'rei', 'Corda, palheta e amp! Tá afinado.'), D('Rei', 'rei', 'Agora a floresta vai ouvir.')],
    [D('Irmã Mel', 'irma1', 'Valeu, Rei! Bora pro caminhão!'), D('Irmã Noz', 'irma2', 'A carga é especial. Todo mundo vai dançar!')],
    [D('Texugo', 'texugo', 'Achei a chave! Vou ligar o motor.'), D('Rei', 'rei', 'Pé na tábua, texugo!')],
    [D('Rei', 'rei', 'Ladrão derrotado! Agora é festa!'), D('Irmã Mel', 'irma1', 'Toca aquele solo, Majestade!')]
  ];
  const TITLE = ['Siga o rastro', 'Peças do rock', 'Resgate das Irmãs', 'Chave do caminhão', 'O ladrão no festival'];
  const SIDE = ['Limpa-trilha: derrote 4 bichos', 'Sem arranhão: não leve dano', 'Mestre do tabefe: 3 bichos no soco', 'Acenda 3 lampiões de papel', 'Rei da despensa: 90% das castanhas'];
  const SIDE_NAME = ['Limpa-trilha', 'Sem arranhão', 'Mestre do tabefe', 'Lampiões de papel', 'Rei da despensa'];

  /* ------------------------------------------------------------ diálogo (HUD ou caixa simples) */
  let dlgDepth = 0, fb = null;
  function fallbackDialogue(o) {
    return new Promise((res) => {
      if (!fb) {
        fb = document.createElement('div');
        fb.setAttribute('style', 'position:fixed;left:50%;bottom:7%;transform:translateX(-50%);max-width:70vw;min-width:260px;padding:12px 18px;background:rgba(20,12,8,.9);color:#ffe9b8;border:3px solid #e8a33d;border-radius:12px;font:700 18px "Nunito",sans-serif;z-index:60;display:none;text-align:left');
        document.body.appendChild(fb);
      }
      let i = 0, timer = 0, done = false;
      const next = () => {
        clearTimeout(timer);
        if (i >= o.lines.length) { done = true; fb.style.display = 'none'; window.removeEventListener('keydown', onKey, true); fb.onclick = null; res(); return; }
        fb.innerHTML = `<div style="color:#ffb84d;font-size:14px;margin-bottom:4px">${o.speaker}</div>${o.lines[i++]}<div style="opacity:.6;font-size:12px;margin-top:6px">Enter / toque para continuar</div>`;
        fb.style.display = 'block';
        timer = setTimeout(next, 3800);
      };
      const onKey = (e) => { if (['Enter', 'Space', 'KeyJ', 'KeyX'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); if (!done) next(); } };
      window.addEventListener('keydown', onKey, true); fb.onclick = next; fb.style.pointerEvents = 'auto';
      next();
    });
  }
  async function say(seq) {
    const g = api(); if (!g) return;
    dlgDepth++; g.G.dialogue = true;
    try {
      for (const d of seq) {
        if (g.G.state !== 'playing' && g.G.state !== 'paused') break;
        const o = { speaker: d.who, lines: d.lines, portrait: d.portrait };
        try {
          if (RC.hud && typeof RC.hud.dialogue === 'function') await RC.hud.dialogue(o); else await fallbackDialogue(o);
        } catch (err) { console.error(err); }
      }
    } finally {
      if (--dlgDepth <= 0) { dlgDepth = 0; g.G.dialogue = false; g.player.atkBuf = 0; g.player.buf = 0; }
    }
  }
  function cheer(text) {
    const g = api();
    if (RC.hud && typeof RC.hud.complete === 'function') RC.hud.complete(text); else g.toast(text, 2200);
    g.jingle('checkpoint');
  }
  function objective() {
    const g = api(); if (!g || !M) return;
    if (g.G.state === 'boot' || g.G.state === 'title') { clearObjective(); return; }
    const o = M.done ? { title: TITLE[M.s], text: 'Pronto! Vá ao caminhão.', cur: 1, max: 1 }
      : { title: TITLE[M.s], text: M.text(), cur: M.cur(), max: M.max };
    const extra = run.side[M.s] ? 'Extra feito!' : 'Extra: ' + SIDE[M.s];
    if (RC.hud && typeof RC.hud.setObjective === 'function') {
      RC.hud.setObjective({ title: o.title, text: o.text, extra, extraDone: !!run.side[M.s], cur: o.cur, max: o.max });
      if (M.fbObj) { M.fbObj.remove(); M.fbObj = null; }
    } else {
      if (!M.fbObj) {
        M.fbObj = document.createElement('div');
        M.fbObj.setAttribute('style', 'position:fixed;left:12px;top:64px;padding:6px 10px;background:rgba(20,12,8,.7);color:#ffe9b8;border-left:4px solid #e8a33d;font:700 13px "Nunito",sans-serif;z-index:20;pointer-events:none;max-width:44vw');
        document.body.appendChild(M.fbObj);
      }
      M.fbObj.innerHTML = `<b>${o.title}</b> ${o.cur}/${o.max}<br>${o.text}<br><small style="opacity:.8">${extra}</small>`;
    }
  }
  function clearObjective() {
    if (RC.hud && typeof RC.hud.setObjective === 'function') RC.hud.setObjective(null);
    if (M && M.fbObj) { M.fbObj.remove(); M.fbObj = null; }
  }

  /* ------------------------------------------------------------ posicionamento */
  /* Âncoras alcançáveis: castanhas normais do próprio nível (o gerador já garante que dá pra pegá-las). */
  function anchors(n, lv, used) {
    const g = api(), lo = Math.max(900, lv.start.x + 700), hi = lv.goal.x - 650;
    const cand = lv.nuts.filter((c) => !c.opt && !c.golden && c.x > lo && c.x < hi && g.surfaceBelow(c.x, c.y - 20) - c.y < 150);
    const out = [];
    for (let i = 0; i < n; i++) {
      const cx = lo + (hi - lo) * (i + 0.5) / n, half = (hi - lo) / n / 2;
      let best = null;
      for (const c of cand) if (!out.includes(c) && Math.abs(c.x - cx) < half && (!best || Math.abs(c.x - cx) < Math.abs(best.x - cx))) best = c;
      if (best) { out.push(best); continue; }
      let x = Math.round(cx / 32) * 32, k = 0;                              // alternativa: chão firme sem buracos por perto
      const solid = (xx) => g.groundTop(Math.floor(xx / 32)) < 1e8;
      while (k < 40 && !(solid(x - 32) && solid(x) && solid(x + 32))) { k++; x += (k % 2 ? 1 : -1) * k * 32; }
      out.push({ x, y: g.groundTop(Math.floor(x / 32)) - 24, fake: true });
    }
    return out;
  }
  function carriers(n, lv) {
    const g = api(), lo = Math.max(900, lv.start.x + 700), hi = lv.goal.x - 650;
    const list = g.G.enemies.filter((e) => !e.dead && e.x > lo && e.x < hi);
    const out = [];
    for (let i = 0; i < n; i++) {
      const cx = lo + (hi - lo) * (i + 0.5) / n, half = (hi - lo) / n / 2;
      let best = null;
      for (const e of list) if (!out.includes(e) && Math.abs(e.x - cx) < half && (!best || Math.abs(e.x - cx) < Math.abs(best.x - cx))) best = e;
      out.push(best);
    }
    return out;
  }

  /* ------------------------------------------------------------ sprites com alternativas */
  function npcRect(name, t) {
    const rc = api().rects, frames = [];
    for (let i = 1; i < 12; i++) if (rc[`${name}_${i}`]) frames.push(`${name}_${i}`); else if (i > 1) break;
    if (frames.length) return [rc[frames[Math.floor(t * 5) % frames.length]], frames[Math.floor(t * 5) % frames.length]];
    return rc[name] ? [rc[name], name] : [null, null];
  }
  const COL = { irma1: [1, 0.55, 0.7], irma2: [0.5, 0.75, 1], corvo: [0.35, 0.3, 0.5], texugo: [0.8, 0.8, 0.85] };
  function dotRect(x, y, w, h, col, add) {
    const g = api(), r = g.rects.dot; if (!r) return;
    g.R.sprite(g.atlas.set, r, x, y, w / r.w, h / r.h, { col, lit: 0, noSnap: true });
  }
  function glow(x, y, s, col) {
    const g = api(), r = g.rects.glow; if (!r) return;
    g.R.sprite(g.atlas.set, r, x - 32 * s, y - 32 * s, s, s, { col, lit: 0, noSnap: true });
  }
  function drawNpc(name, x, footY, t, flip) {
    const g = api(), [r, nm] = npcRect(name, t);
    if (r) { g.spr(nm, x - (flip < 0 ? -r.w * g.S / 2 : r.w * g.S / 2), footY - r.h * g.S, (flip || 1) * g.S, g.S, { emit: 0.05 }); return r.h * g.S; }
    const c = COL[name.replace('npc_', '')] || [1, 1, 1];            // boneco simples
    dotRect(x - 14, footY - 40, 28, 36, [c[0], c[1], c[2], 1]);
    dotRect(x - 11, footY - 62, 22, 22, [c[0] * 1.1, c[1] * 1.1, c[2] * 1.1, 1]);
    dotRect(x - 6 + (flip || 1) * 3, footY - 54, 4, 4, [0.1, 0.1, 0.1, 1]);
    return 62;
  }
  const ITEM_COL = { item_corda: [0.95, 0.85, 0.5], item_palheta: [1, 0.5, 0.35], item_amp: [0.6, 0.6, 0.7], item_chave: [1, 0.9, 0.3], pista: [1, 0.75, 0.4], lantern_paper: [1, 0.55, 0.35] };
  function drawItem(name, x, y, t, scale) {
    const g = api(), r = g.rects[name], bob = Math.sin(t * 3 + x) * 3, c = ITEM_COL[name] || [1, 1, 1];
    glow(x, y + bob, 1.1, [c[0], c[1], c[2], 0.5 + 0.2 * Math.sin(t * 4 + x)]);
    if (r) g.spr(name, x - r.w * g.S / 2, y + bob - r.h * g.S / 2, g.S * (scale || 1), g.S * (scale || 1), { emit: 0.7 });
    else {
      dotRect(x - 8, y + bob - 8, 16, 16, [c[0], c[1], c[2], 1]);
      dotRect(x - 5, y + bob - 5, 10, 10, [1, 1, 0.9, 0.9]);
    }
  }

  /* ------------------------------------------------------------ definição das missões */
  function newMission(s, lv) {
    const g = api(), G = g.G;
    const m = { s, lv, done: false, side: false, items: [], cur: () => 0, max: 1, text: () => '', nHurt: 0, punchKills: 0, t0: 0 };
    if (s === 0) {                                              // pistas ao longo da trilha
      m.items = anchors(5, lv).map((a, i) => ({ kind: 'pista', x: a.x, y: a.y - 10, got: false, i }));
      m.max = 5; m.cur = () => m.items.filter((i) => i.got).length; m.text = () => 'Ache as pistas (cascas brilhantes)';
    } else if (s === 1) {                                       // peças carregadas por inimigos
      const names = ['item_corda', 'item_palheta', 'item_amp'], label = ['corda', 'palheta', 'amplificador'];
      const cs = carriers(3, lv), an = anchors(3, lv);
      m.items = names.map((n, i) => ({ kind: n, label: label[i], carrier: cs[i], hidden: !!cs[i], x: cs[i] ? 0 : an[i].x, y: cs[i] ? 0 : an[i].y - 10, vy: 0, falling: false, got: false, i }));
      m.max = 3; m.cur = () => m.items.filter((i) => i.got).length; m.text = () => 'Tome as peças dos bichos (marcados)';
    } else if (s === 2) {                                       // irmãs presas
      const an = anchors(2, lv);
      m.cap = an.map((a, i) => ({ name: i ? 'npc_irma2' : 'npc_irma1', x: a.x, foot: g.surfaceBelow(a.x, a.y - 20), freed: false, flash: 0, i }));
      m.max = 2; m.cur = () => m.cap.filter((c) => c.freed).length; m.text = () => 'Dê um tabefe nas gaiolas';
      m.trail = [];
    } else if (s === 3) {                                       // chave com um bicho + lampiões
      const cs = carriers(1, lv)[0] || null, an = anchors(1, lv)[0];
      m.key = { kind: 'item_chave', carrier: cs, hidden: !!cs, x: cs ? 0 : an.x, y: cs ? 0 : an.y - 10, vy: 0, falling: false, got: false };
      const la = anchors(3, lv);
      m.lamps = la.map((a) => ({ x: a.x, y: a.y - 40, lit: false }));
      m.max = 1; m.cur = () => (m.key.got ? 1 : 0); m.text = () => 'Pegue a chave com o bicho brilhante';
    } else {                                                    // chefe
      m.boss = null; m.spawned = false;
      m.max = 1; m.cur = () => (m.done ? 1 : 0); m.text = () => 'Derrote o ladrão!';
    }
    return m;
  }

  function sideProgress() {
    const G = api().G, M_ = M;
    if (M_.s === 3) return M_.lamps.filter((l) => l.lit).length;
    return 0;
  }
  function awardSide() {
    const g = api(), s = M.s;
    if (run.side[s]) return;
    run.side[s] = true;
    if (g.G.hearts < g.G.maxHearts) { g.G.hearts++; g.renderHearts(); }
    cheer(`Extra: ${SIDE_NAME[s]}! +1 coração`);
    g.burst('spark', g.player.x + 10, g.player.y, 16, 260, { col: [1, 0.5, 0.6], life: 0.7 });
    objective();
  }
  function completeMain() {
    if (M.done) return;
    M.done = true; run.main[M.s] = true;
    const g = api();
    cheer('Missão cumprida: ' + TITLE[M.s]);
    g.burst('spark', g.player.x + 10, g.player.y, 24, 300, { col: [1, 0.85, 0.4], life: 0.8 });
    objective();
    if (M.s === 4) { rainNuts(); }
    setTimeout(() => { if (M && M.done && g.G.state === 'playing') say(DONE[M.s]); }, 700);
  }
  function rainNuts() {
    const g = api(), G = g.G, px = g.player.x;
    for (let i = 0; i < 14; i++) G.nuts.push({ x: px - 200 + i * 30, y: -20 - (i % 4) * 30, golden: i % 7 === 0, taken: false, ph: 0, mag: false, vy: 40, drop: true });
  }

  /* ------------------------------------------------------------ eventos */
  EV.on('stageLoaded', (lv) => {
    const g = api(); if (!g) return;
    if (M && M.fbObj) M.fbObj.remove();
    const s = Math.max(0, Math.min(4, g.G.stage));
    run.main[s] = false; run.side[s] = false;
    M = newMission(s, lv);
    g.G.dialogue = false; dlgDepth = 0;
    g.G.finishBlock = () => {
      if (!M || M.done) return null;
      if (M.s === 4 && !M.boss) return null;                    // sem chefe disponível, não trava
      return M.s === 4 ? 'O ladrão ainda está solto!' : `Missão pendente: ${TITLE[M.s]}`;
    };
    objective();
  });
  EV.on('stageStart', (stage) => {
    if (stage === 0) { run.main.fill(false); run.side.fill(false); }
    objective();
    setTimeout(() => { if (M && M.s === stage && api().G.state === 'playing') say(INTRO[stage]); }, 2500);
  });
  EV.on('playerHurt', () => { if (M) M.nHurt++; });
  EV.on('enemyKilled', (e, how) => {
    if (!M) return;
    if (how === 'punch') M.punchKills++;
    const drop = (it) => { it.hidden = false; it.falling = true; it.x = e.x + e.w / 2; it.y = e.y + e.h * 0.4; it.vy = -260; it.carrier = null; api().burst('spark', it.x, it.y, 10, 200, { col: [1, 0.9, 0.4], life: 0.5 }); };
    if (M.s === 1) for (const it of M.items) if (it.carrier === e) drop(it);
    if (M.s === 3 && M.key.carrier === e) drop(M.key);
    sideCheck();
  });
  EV.on('bossDefeated', () => { if (M && M.s === 4) completeMain(); });
  EV.on('finish', () => { sideCheck(true); });

  function sideCheck(atFinish) {
    if (!M || run.side[M.s]) return;
    const G = api().G;
    if (M.s === 0 && G.kills >= 4) awardSide();
    else if (M.s === 1 && atFinish && M.nHurt === 0) awardSide();
    else if (M.s === 2 && M.punchKills >= 3) awardSide();
    else if (M.s === 3 && M.lamps.every((l) => l.lit)) awardSide();
    else if (M.s === 4 && atFinish && G.collected >= G.lv.total * 0.9) awardSide();
  }

  EV.on('update', (dt) => {
    const g = api(); if (!g || !M) return;
    const G = g.G, P = g.player, lv = M.lv, s = M.s, near = (x, y, r) => Math.hypot(P.x + P.w / 2 - x, P.y + P.h / 2 - y) < r;
    const pickup = (it, onGet) => { if (!it.got && !it.hidden && !it.falling && near(it.x, it.y, 44)) { it.got = true; g.sfx('item', 0.4, 1.3); g.burst('spark', it.x, it.y, 12, 220, { col: [1, 0.9, 0.5], life: 0.5 }); onGet(it); objective(); } };
    const fall = (it) => {
      if (!it.falling) return;
      it.vy += 900 * dt; it.y += it.vy * dt;
      const sb = g.surfaceBelow(it.x, it.y - 16);
      if (it.y > sb - 22 && it.vy > 0) { it.y = sb - 22; it.vy = 0; it.falling = false; }
    };
    if (s === 0) {
      for (const it of M.items) pickup(it, () => {
        const n = M.cur();
        if (n < M.max) g.toast(['Casca fresca! Alguém passou aqui.', 'Pegada pequena... e roqueira.', 'Cheiro de couro e guitarra.', 'O Corvo grasna: tá quente!', ''][n - 1] || 'Pista!', 1800);
        if (n >= M.max) completeMain();
      });
    } else if (s === 1) {
      for (const it of M.items) { fall(it); pickup(it, () => { g.toast(`Achou: ${it.label}!`, 1600); if (M.cur() >= M.max) completeMain(); }); }
      for (const it of M.items) if (it.carrier && it.carrier.dead) { it.hidden = false; it.falling = true; it.x = it.carrier.x + it.carrier.w / 2; it.y = it.carrier.y; it.carrier = null; }
    } else if (s === 2) {
      for (const c of M.cap) {
        if (c.freed) continue;
        const dx = (P.x + P.w / 2) - c.x, dy = (P.y + P.h) - c.foot;
        if (Math.abs(dx) < 90 && Math.abs(dy) < 70 && !c.warned) { c.warned = true; g.toast('Dê um tabefe na gaiola! (J / X)', 1800); }
        const hitWin = P.atk > 0 && Math.abs(dx) < 86 && Math.abs(dy) < 70 && (dx * P.facing <= 12 || Math.abs(dx) < 26);
        const stomp = P.vy > 60 && Math.abs(dx) < 34 && P.y + P.h < c.foot - 50 && P.y + P.h > c.foot - 100;
        if (hitWin || stomp) {
          c.freed = true; g.sfx('kill', 0.5, 0.8); g.jingle('item'); G.shake = Math.max(G.shake, 4);
          g.burst('spark', c.x, c.foot - 40, 24, 300, { col: [1, 0.85, 0.5], life: 0.8 });
          g.toast(c.i ? 'Irmã Noz libertada!' : 'Irmã Mel libertada!', 1800);
          M.trail.push({ name: c.name, x: c.x, y: c.foot });
          objective();
          if (M.cur() >= M.max) completeMain();
        }
      }
      // as irmãs libertadas seguem o Rei (com atraso)
      M.hist = M.hist || [];
      M.hist.push([P.x + P.w / 2, P.y + P.h]); if (M.hist.length > 90) M.hist.shift();
      M.trail.forEach((f, i) => {
        const h = M.hist[Math.max(0, M.hist.length - 1 - (i + 1) * 22)] || M.hist[0];
        f.x += (h[0] - f.x) * Math.min(1, dt * 8); f.y += (h[1] - f.y) * Math.min(1, dt * 8);
        f.dir = h[0] > f.x + 1 ? 1 : h[0] < f.x - 1 ? -1 : (f.dir || 1);
      });
    } else if (s === 3) {
      fall(M.key); pickup(M.key, () => { g.toast('Chave do caminhão!', 1800); completeMain(); });
      if (M.key.carrier && M.key.carrier.dead) { const e = M.key.carrier; M.key.hidden = false; M.key.falling = true; M.key.x = e.x + e.w / 2; M.key.y = e.y; M.key.carrier = null; }
      for (const l of M.lamps) if (!l.lit && near(l.x, l.y, 50)) { l.lit = true; g.sfx('item', 0.4, 0.9); g.burst('spark', l.x, l.y, 14, 200, { col: [1, 0.6, 0.3], life: 0.6 }); g.toast(`Lampião aceso (${M.lamps.filter((q) => q.lit).length}/3)`, 1400); sideCheck(); objective(); }
    } else {
      if (!M.spawned && P.x > lv.goal.x - 760) {
        M.spawned = true;
        try {
          if (RC.enemies && typeof RC.enemies.spawnBoss === 'function') M.boss = RC.enemies.spawnBoss(lv.goal.x - 260) || null;
        } catch (err) { console.error(err); }
        if (M.boss) { g.toast('O ladrão apareceu!', 2200); objective(); }
        else completeMain();                                    // sem chefe no jogo: segue para o festival
      }
      if (M.boss && !M.done && (M.boss.dead || M.boss.defeated || M.boss.hp <= 0)) completeMain();
    }
    sideCheck();
  });

  /* ------------------------------------------------------------ desenho */
  EV.on('drawBehind', (t, cam) => {
    const g = api(); if (!g || !M || !g.rects) return;
    const vis = (x) => x > cam - 80 && x < cam + g.WW + 80;
    const G = g.G, lv = M.lv;
    // NPCs de cenário perto da largada (corvo ou texugo)
    const npc = M.s === 3 ? 'npc_texugo' : M.s < 2 ? 'npc_corvo' : null;
    if (npc) { const x = lv.start.x + 300; if (vis(x)) drawNpc(npc, x, g.surfaceBelow(x, 0), t, -1); }
    if (M.s === 2) {
      for (const c of M.cap) {
        if (c.freed || !vis(c.x)) continue;
        drawNpc(c.name, c.x, c.foot, t, c.i ? -1 : 1);
        const top = c.foot - 84, bw = 3;
        for (let k = -4; k <= 4; k++) dotRect(c.x + k * 8 - 1, top, bw, 84, [0.45, 0.28, 0.14, 0.95]);
        dotRect(c.x - 36, top - 4, 72, 6, [0.35, 0.2, 0.1, 1]); dotRect(c.x - 36, c.foot - 4, 72, 6, [0.35, 0.2, 0.1, 1]);
      }
    }
  });
  EV.on('drawFront', (t, cam) => {
    const g = api(); if (!g || !M || !g.rects) return;
    const vis = (x) => x > cam - 80 && x < cam + g.WW + 80;
    if (M.s === 0) for (const it of M.items) if (!it.got && vis(it.x)) drawItem('pista', it.x, it.y, t, 0.8);
    if (M.s === 1) {
      for (const it of M.items) {
        if (it.got) continue;
        if (it.carrier && !it.carrier.dead) { const e = it.carrier; if (vis(e.x)) glow(e.x + e.w / 2, e.y - 14, 0.8, [1, 0.8, 0.3, 0.55 + 0.2 * Math.sin(t * 6)]); continue; }
        if (!it.hidden && vis(it.x)) drawItem(it.kind, it.x, it.y, t);
      }
    }
    if (M.s === 3) {
      const k = M.key;
      if (!k.got) {
        if (k.carrier && !k.carrier.dead) { const e = k.carrier; if (vis(e.x)) { glow(e.x + e.w / 2, e.y - 18, 1, [1, 0.9, 0.3, 0.6 + 0.2 * Math.sin(t * 6)]); drawItem('item_chave', e.x + e.w / 2, e.y - 26, t, 0.6); } }
        else if (!k.hidden && vis(k.x)) drawItem('item_chave', k.x, k.y, t);
      }
      for (const l of M.lamps) if (vis(l.x)) {
        const r = g.rects.lantern_paper, sw = Math.sin(t * 2 + l.x) * 2;
        dotRect(l.x - 1, l.y - 30, 2, 22, [0.3, 0.2, 0.1, 1]);
        if (r) g.spr('lantern_paper', l.x - r.w * g.S / 2 + sw, l.y - r.h * g.S / 2, g.S, g.S, { emit: l.lit ? 1.4 : 0.1, col: l.lit ? [1, 1, 1, 1] : [0.6, 0.6, 0.7, 1] });
        else { dotRect(l.x - 9 + sw, l.y - 12, 18, 22, l.lit ? [1, 0.55, 0.25, 1] : [0.5, 0.35, 0.3, 1]); }
      }
    }
    if (M.s === 2) for (const f of M.trail) drawNpc(f.name, f.x, f.y, t, f.dir || 1);
  });
  EV.on('drawAdd', (t, cam) => {
    const g = api(); if (!g || !M || !g.rects) return;
    if (M.s === 3) for (const l of M.lamps) if (l.lit && l.x > cam - 120 && l.x < cam + g.WW + 120) glow(l.x, l.y, 2.4, [1, 0.6, 0.3, 0.45 + 0.1 * Math.sin(t * 5 + l.x)]);
  });

  /* ------------------------------------------------------------ resultados: extras na tela de fim de fase / vitória */
  function addToStats(id, html) {
    const el = document.getElementById(id); if (!el || el.querySelector('.mi-row')) return;
    const d = document.createElement('div'); d.className = 'mi-row'; d.innerHTML = html; el.appendChild(d);
  }
  setInterval(() => {
    const done = document.getElementById('done'), win = document.getElementById('win');
    if (done && done.classList.contains('visible') && M) {
      const st = run.side.slice(0, M.s + 1).filter(Boolean).length;
      addToStats('done-stats', `<b>${run.main[M.s] ? 'sim' : 'não'}</b><span>${TITLE[M.s]}</span>`);
      addToStats('done-stats', `<b>${st}/${M.s + 1}</b><span>extras (${run.side[M.s] ? 'esta fase: feito' : 'esta fase: faltou'})</span>`);
    }
    if (win && win.classList.contains('visible')) {
      addToStats('win-stats', `<b>${run.main.filter(Boolean).length}/5</b><span>missões da história</span>`);
      addToStats('win-stats', `<b>${run.side.filter(Boolean).length}/5</b><span>missões extras</span>`);
    }
  }, 400);

  RC.missions = {
    run, get current() { return M; }, skipDialogue() { const g = api(); if (g) g.G.dialogue = false; },
    TITLE, SIDE, say
  };
})();
