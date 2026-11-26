/* Rei da Castanha: HUD, missão, diálogo, banners, contador de combo e tela de resultados.
   Plugado via RC.events / RC.game, sem editar game.js. API pública: RC.hud
     setObjective({title,text,cur,max}|null)  complete(texto)  dialogue({speaker,lines,portrait}) -> Promise
     banner(texto, sub)  combo(n, sub)                                                                     */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  const $ = (id) => document.getElementById(id);
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const game = () => RC.game || null;
  const G = () => (RC.game && RC.game.G) || {};
  const sfx = (n, v, r) => { try { if (RC.game && RC.game.sfx) RC.game.sfx(n, v, r); } catch (e) { /* som é opcional */ } };

  /* reinicia uma animação CSS de classe */
  function restart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  const el = {
    hearts: $('hud-hearts'), nuts: $('hud-nuts'), vignette: $('vignette'), chain: $('hud-chain'),
    obj: $('hud-obj'), objTitle: $('obj-title'), objText: $('obj-text'), objBar: $('obj-bar'), objFill: $('obj-fill'), objCount: $('obj-count'), objExtra: $('obj-extra'),
    md: $('mission-done'), mdText: $('md-text'), banner: $('banner'), bnTitle: $('bn-title'), bnSub: $('bn-sub'),
    combo: $('combo'), comboN: $('combo-n'), comboL: $('combo-l'), comboSub: $('combo-sub'),
    dlg: $('dialogue'), dlgPortrait: $('dlg-portrait'), dlgName: $('dlg-name'), dlgText: $('dlg-text'), dlgSr: $('dlg-sr'), dlgNext: $('dlg-next')
  };

  /* ------------------------------------------------------------ missão */
  let objPrev = null;
  function setObjective(o) {
    if (!el.obj) return;
    if (!o) { el.obj.hidden = true; objPrev = null; return; }
    const hasBar = typeof o.max === 'number' && o.max > 0;
    const cur = hasBar ? Math.max(0, Math.min(o.max, +o.cur || 0)) : 0;
    const wasHidden = el.obj.hidden;
    el.objTitle.textContent = o.title || 'Missão';
    el.objText.textContent = o.text || '';
    if (el.objExtra) { el.objExtra.textContent = o.extra || ''; el.objExtra.hidden = !o.extra; el.objExtra.classList.toggle('ok', !!o.extraDone); }
    el.objBar.hidden = !hasBar;
    if (hasBar) { el.objFill.style.width = `${(cur / o.max) * 100}%`; el.objCount.textContent = `${cur}/${o.max}`; }
    el.obj.hidden = false;
    if (!wasHidden && objPrev && (objPrev.cur !== cur || objPrev.text !== o.text)) { el.obj.classList.remove('tick'); void el.obj.offsetWidth; el.obj.classList.add('tick'); }
    objPrev = { cur, text: o.text };
  }

  let mdT = 0;
  function complete(text) {
    if (!el.md) return;
    el.mdText.textContent = text || 'Missão cumprida';
    restart(el.md, 'show');
    sfx('checkpoint');
    clearTimeout(mdT); mdT = setTimeout(() => el.md.classList.remove('show'), 3100);
  }

  let bnT = 0;
  function banner(text, sub) {
    if (!el.banner) return;
    el.bnTitle.textContent = text || '';
    el.bnSub.textContent = sub || '';
    restart(el.banner, 'show');
    clearTimeout(bnT); bnT = setTimeout(() => el.banner.classList.remove('show'), 2700);
  }

  /* ------------------------------------------------------------ combo */
  const TIERS = [[8, 'Lendário!'], [5, 'Imparável!'], [3, 'Em chamas!']];
  let comboT = 0, streak = 0;
  function hideCombo() { if (el.combo) el.combo.classList.remove('on', 'pop', 'hot', 'max'); streak = 0; }
  function combo(n, sub) {
    if (!el.combo || !(n > 0)) return;
    streak = n | 0;
    el.comboN.textContent = String(streak);
    el.comboL.textContent = streak === 1 ? 'ABATE' : 'ABATES';
    const t = TIERS.find((x) => streak >= x[0]);
    el.comboSub.textContent = sub || (t ? t[1] : '');
    el.combo.classList.toggle('hot', streak >= 4);
    el.combo.classList.toggle('max', streak >= 8);
    el.combo.style.setProperty('--ct', '2.4s');
    el.combo.classList.remove('on'); void el.combo.offsetWidth; el.combo.classList.add('on');
    restart(el.combo, 'pop');
    clearTimeout(comboT); comboT = setTimeout(hideCombo, 2400);
  }

  /* ------------------------------------------------------------ retratos em pixel art (SVG gerado) */
  const FACE = [
    '....c.cccc.c....', '....cccccccc....', '..ee.hhhhhh.ee..', '.eEEhhhhhhhhEEe.',
    '.eEhhhhhhhhhhhEe', '..hhhhhhhhhhhh..', '..hhwkhhhhwkhh..', '..hhkkhhhhkkhh..',
    '..hhhhsssshhhh..', '...hhssssssshh..', '...hhsssnnsshh..', '....hsssmmssh...',
    '......ssss......', '..bbbbbbbbbbbb..', '.bbbbbbbbbbbbbb.', 'bbbbbbbbbbbbbbbb'
  ];
  const PORTRAITS = {
    rei: { h: '#b8672a', e: '#8a4a14', E: '#f0a8a0', s: '#f4d9a8', n: '#2a140b', k: '#1a0c06', w: '#fff', m: '#8a3a2a', b: '#7a1f3a', c: '#ffc931', bg: '#3a2a5a' },
    irma1: { h: '#c47a36', e: '#8a4a14', E: '#f4a8b8', s: '#f8e0b8', n: '#2a140b', k: '#1a0c06', w: '#fff', m: '#b04a4a', b: '#2f7a5a', c: '#ff7aa8', bg: '#2a4a3a', hat: [[0, 4, '..cc..cc'], [1, 4, 'cccccccc']] },
    irma2: { h: '#d4a05a', e: '#9a6a30', E: '#f4c8a8', s: '#fbe8c8', n: '#3a1a0b', k: '#1a0c06', w: '#fff', m: '#b04a4a', b: '#2a5a9a', c: '#6ac8ff', bg: '#2a3a5a', hat: [[0, 5, 'c.cc.c'], [1, 4, 'cccccccc']] },
    texugo: { h: '#6a6e78', e: '#3a3d44', E: '#9a9ea8', s: '#d8dce4', n: '#111', k: '#0a0a0a', w: '#fff', m: '#333', b: '#4a3a2a', c: null, bg: '#3a3030',
      patch: [[2, 7, 'pp'], [3, 7, 'pp'], [4, 7, 'pp'], [5, 7, 'pp']], p: '#f0f0f0' },
    corvo: { h: '#2f3756', e: '#1b2034', E: '#2f3756', s: '#46507a', n: '#1b2034', k: '#0a0a0a', w: '#e8ecff', m: '#1b2034', b: '#232a44', c: '#1b2034', bg: '#4a3a5a',
      hat: [[0, 4, '..c...c.']], patch: [[8, 5, 'pppppp'], [9, 5, 'ppppppp'], [10, 6, 'ppppp'], [11, 7, 'ppp']], p: '#f2b632' }
  };
  function portraitSvg(key, speaker) {
    const P = PORTRAITS[key];
    if (!P) {
      const ch = (speaker || '?').trim().charAt(0).toUpperCase() || '?';
      return `<svg viewBox="0 0 16 16"><text x="8" y="12" text-anchor="middle" font-family="Lilita One,sans-serif" font-size="11" fill="#ffc931">${ch.replace(/[<&]/g, '')}</text></svg>`;
    }
    const rows = FACE.map((r) => r.split(''));
    for (const [ry, cx, str] of (P.hat || [])) for (let i = 0; i < str.length; i++) rows[ry][cx + i] = str[i];
    for (const [ry, cx, str] of (P.patch || [])) for (let i = 0; i < str.length; i++) rows[ry][cx + i] = str[i];
    let out = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="${P.bg}"/>`;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = rows[y][x]; if (ch === '.') continue;
      const col = ch === 'p' ? P.p : P[ch]; if (!col) continue;
      out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${col}"/>`;
    }
    return out + '</svg>';
  }

  /* ------------------------------------------------------------ diálogo */
  const queue = [];
  let cur = null, lineIdx = 0, typing = null, shown = '';
  const gate = () => { const s = G().state; return s === 'playing' || s === 'finished' || s === 'loading'; };

  function setLine() {
    const line = String(cur.lines[lineIdx] == null ? '' : cur.lines[lineIdx]);
    shown = line;
    el.dlgNext.classList.remove('on');
    el.dlgSr.textContent = line;
    clearInterval(typing); typing = null;
    if (reduced()) { el.dlgText.textContent = line; el.dlgNext.classList.add('on'); return; }
    let i = 0; el.dlgText.textContent = '';
    typing = setInterval(() => {
      i += 1; el.dlgText.textContent = line.slice(0, i);
      if (i % 3 === 1) sfx('item', 0.12, 1.6 + Math.random() * 0.3);
      if (i >= line.length) { clearInterval(typing); typing = null; el.dlgNext.classList.add('on'); }
    }, 28);
  }
  function openNext() {
    const d = queue.shift();
    if (!d) { cur = null; el.dlg.hidden = true; const g = G(); g.dialogue = false; return; }
    cur = d; lineIdx = 0;
    const g = G(); g.dialogue = true;
    try { if (RC.game && RC.game.keys) RC.game.keys.clear(); } catch (e) { /* ok */ }
    el.dlgName.textContent = d.speaker || '';
    const key = d.portrait || ((d.speaker || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, ''));
    const svg = portraitSvg(PORTRAITS[key] ? key : d.portrait, d.speaker);
    el.dlgPortrait.innerHTML = svg;
    el.dlgPortrait.hidden = false;
    el.dlg.hidden = false;
    el.dlg.style.visibility = '';
    setLine();
  }
  function advance() {
    if (!cur) return;
    if (typing) { clearInterval(typing); typing = null; el.dlgText.textContent = shown; el.dlgNext.classList.add('on'); return; }
    sfx('item', 0.2, 1.2);
    lineIdx += 1;
    if (lineIdx >= cur.lines.length) { const done = cur.resolve; cur = null; openNext(); done(); }
    else setLine();
  }
  function dialogue(d) {
    return new Promise((resolve) => {
      const lines = d && Array.isArray(d.lines) ? d.lines.filter((l) => l != null) : (d && d.text ? [d.text] : []);
      if (!d || !lines.length) { resolve(); return; }
      queue.push({ speaker: d.speaker || '', lines, portrait: d.portrait, resolve });
      if (!cur) openNext();
    });
  }
  const ADV = ['Space', 'Enter', 'NumpadEnter', 'KeyJ', 'KeyX', 'KeyK'];
  const SWALLOW = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];
  window.addEventListener('keydown', (e) => {
    if (!cur || !gate()) return;
    if (ADV.includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) advance(); }
    else if (SWALLOW.includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  el.dlg.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); advance(); });
  let padPrev = false;
  setInterval(() => {
    if (!navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
    const now = !!(gp && ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[1] && gp.buttons[1].pressed)));
    if (now && !padPrev && cur && gate()) advance();
    padPrev = now;
  }, 40);

  /* ------------------------------------------------------------ HUD por evento + estado */
  let prevHearts = null, lowState = false, hurtT = 0;
  function pollHud() {
    const g = G(), s = g.state;
    if (el.dlg && cur) el.dlg.style.visibility = (s === 'paused' || s === 'title') ? 'hidden' : '';
    if (typeof g.hearts !== 'number') return;
    if (prevHearts !== null && g.hearts !== prevHearts && el.hearts.children.length) {
      if (g.hearts < prevHearts) {
        const c = el.hearts.children[g.hearts]; if (c) c.classList.add('lost');
        restart(el.hearts, 'shake');
      } else {
        const c = el.hearts.children[g.hearts - 1]; if (c) c.classList.add('gain');
      }
    }
    prevHearts = g.hearts;
    const low = s === 'playing' && g.hearts === 1;
    if (low !== lowState) { lowState = low; el.hearts.classList.toggle('low', low); el.vignette.classList.toggle('low', low); }
    if (s !== 'playing' && s !== 'paused' && el.vignette.classList.contains('low')) { el.vignette.classList.remove('low'); lowState = false; el.hearts.classList.remove('low'); }
    // pips da corrente de golpes (Combo do Rei)
    const p = game() && game().player;
    if (p) {
      const live = s === 'playing' && p.combo > 0 && g.time - p.lastAtkT < 0.75;
      el.chain.classList.toggle('live', live);
      el.chain.classList.toggle('final', live && p.combo === 3);
      const pips = el.chain.children;
      for (let i = 0; i < 3; i++) pips[i].classList.toggle('on', live && i < p.combo);
    }
  }
  EV.on('drawHud', pollHud);
  EV.on('nutTaken', () => restart(el.nuts, 'bump'));
  EV.on('playerHurt', () => { restart(el.vignette, 'hurt'); clearTimeout(hurtT); hurtT = setTimeout(() => el.vignette.classList.remove('hurt'), 650); hideCombo(); });
  EV.on('enemyKilled', () => { combo(streak + 1); if (streak < 2) el.combo.classList.remove('on'); });
  EV.on('stageLoaded', () => {
    hideCombo(); prevHearts = null;
    const pend = queue.splice(0); if (cur) pend.unshift(cur);
    cur = null; clearInterval(typing); typing = null; el.dlg.hidden = true; G().dialogue = false;
    pend.forEach((d) => { try { d.resolve(); } catch (e) { /* ok */ } });
  });
  EV.on('stageStart', (stage) => {
    const num = $('stage-num'); if (num) num.textContent = `Ato ${ROMAN[stage] || stage + 1}`;
  });

  /* ------------------------------------------------------------ resultados: contagem e estrelas */
  const RANKS = ['', 'Dá para melhorar', 'Muito bem', 'Rei supremo'];
  function countUp(node, delay) {
    const txt = node.textContent.trim();
    let n, fmt;
    if (/^\d+$/.test(txt)) { n = parseInt(txt, 10); fmt = (v) => String(Math.round(v)); }
    else if (/^\d+:\d\d$/.test(txt)) { const [m, sc] = txt.split(':'); n = +m * 60 + +sc; fmt = (v) => { v = Math.round(v); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; }; }
    else return;
    if (reduced() || n === 0) return;
    node.textContent = fmt(0);
    const dur = 700 + Math.min(600, n * 8);
    let t0 = null;
    const owner = node.closest('.overlay');
    (function loop(ts) {
      if (!owner.classList.contains('visible') || node.textContent === undefined) { node.textContent = txt; return; }
      if (t0 === null) t0 = ts + delay;
      const k = Math.max(0, Math.min(1, (ts - t0) / dur));
      node.textContent = fmt(n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(loop); else node.textContent = txt;
    })(performance.now());
    // o primeiro quadro precisa partir de 0 mesmo com atraso
  }
  function onResults(root, statsId) {
    const stats = $(statsId); if (!stats) return;
    [...stats.querySelectorAll('b')].forEach((b, i) => countUp(b, 250 + i * 200));
    if (root.id === 'done') {
      const lv = G().lv, stars = root.querySelectorAll('.star.on').length;
      const sub = $('done-sub'), rank = $('done-rank');
      if (sub && lv) sub.textContent = `Ato ${ROMAN[G().stage] || (G().stage + 1)} · ${lv.name}`;
      if (rank) rank.textContent = RANKS[stars] || '';
      for (let i = 0; i < stars; i++) setTimeout(() => { if (root.classList.contains('visible')) sfx('item', 0.5, 1 + i * 0.25); }, 1300 + i * 400);
    }
  }
  [['done', 'done-stats'], ['win', 'win-stats']].forEach(([id, statsId]) => {
    const root = $(id); if (!root) return;
    let was = false;
    new MutationObserver(() => {
      const vis = root.classList.contains('visible');
      if (vis && !was) onResults(root, statsId);
      was = vis;
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  });

  RC.hud = { setObjective, complete, dialogue, banner, combo };
})();
