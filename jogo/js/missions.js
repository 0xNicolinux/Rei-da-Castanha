/* Rei da Castanha: história e missões (uma principal + um desafio extra por fase).
   Tom: épico com zoeira. Cada fase abre com um cartão de narrador e é desfeita por uma fala cômica.
   Plugado via RC.events / RC.game. Usa RC.hud, RC.props, RC.setpieces e RC.enemies. */
(function () {
  'use strict';
  const RC = window.RC, EV = RC.events;
  let GM = null;                               // RC.game (nasce depois do boot do game.js)
  const api = () => (GM = GM || RC.game);

  /* ------------------------------------------------------------ progresso da corrida */
  const run = { main: [false, false, false, false, false], side: [false, false, false, false, false] };
  let M = null;                                // missão da fase atual

  /* ------------------------------------------------------------ roteiro (pt-BR)
     Vozes (cada fala foi conferida contra estas regras; no máximo ~110 caracteres por fala):
     Rei: vaidoso e dramático, frases curtas; fala "o Rei" quando se empolga; no fundo é gente boa.
     Urubu Fofoqueiro: espalha boato sem prova ("Ouvi dizer..."), erra tudo com total confiança.
     Capanga Ursinho: medroso e mal pago; só quer bater o ponto e ir embora.
     Mel: comerciante, transforma tudo em negócio. Noz: fala pouco, seca, certeira.
     Gambá: caminhoneiro de monossílabos. Barão Urso: astro frustrado, carente e exagerado. */
  const L = (e, t) => ({ e, t });             // fala com emoção: angry | happy | shock
  const D = (who, portrait, ...lines) => ({ who, portrait, lines });
  const CARDS = [
    ['Toda manhã o Rei conta suas castanhas.', 'Hoje a conta deu zero'],
    ['Para encarar um astro do rock, o Rei precisa de uma guitarra.', 'As peças estão espalhadas pela mata'],
    ['Ninguém atravessa o Cipoal andando.', 'Lá, quem manda é o cipó'],
    ['A gangue apagou os lampiões e levantou as pontes.', 'O caminhão do Gambá só anda no claro'],
    ['Lua cheia, palco montado.', 'O Barão já está afinando']
  ];
  const INTRO = [
    [D('Rei', 'rei', L('shock', 'Minha despensa... vazia! Doze mil castanhas!')), D('Urubu Fofoqueiro', 'corvo', 'Ouvi dizer que foi um tigre-dente-de-sabre.'),
      D('Rei', 'rei', 'Tigre não carrega saco de juta, Urubu.'), D('Urubu Fofoqueiro', 'corvo', 'Esse carrega. É um tigre organizado.'),
      D('Rei', 'rei', L('angry', 'Olha lá na frente! Um urso fugindo com o MEU saco!'))],
    [D('Rei', 'rei', 'Se o Barão quer palco, o Rei sobe no palco.'), D('Urubu Fofoqueiro', 'corvo', 'Com o quê? Você nem tem guitarra.'),
      D('Rei', 'rei', 'Corda lá nas copas, palheta no fundo do lago...'), D('Urubu Fofoqueiro', 'corvo', 'E o amplificador?'),
      D('Rei', 'rei', L('happy', 'Do outro lado de uma ponte levantada. Claro que sim.'))],
    [D('Urubu Fofoqueiro', 'corvo', 'As irmãs estão presas em gaiolas, penduradas no Cipoal.'), D('Rei', 'rei', 'E como se chega lá?'),
      D('Urubu Fofoqueiro', 'corvo', 'Pendurado também. Ouvi dizer que o chão acabou.'), D('Rei', 'rei', L('happy', 'Ótimo. O Rei adora um cipó.'))],
    [D('Gambá', 'texugo', 'Estrada escura.'), D('Rei', 'rei', 'E com as pontes levantadas. A gangue caprichou.'), D('Gambá', 'texugo', 'Eu dirijo.'),
      D('Rei', 'rei', 'E o Rei abre caminho. Combinado?'), D('Gambá', 'texugo', 'Devagar.')],
    [D('Irmã Mel', 'irma1', 'O palco é logo depois do lago. Ingresso eu consigo pela metade.'), D('Rei', 'rei', 'Eu sou a atração, Mel.'),
      D('Irmã Noz', 'irma2', 'Ele vai tocar.'), D('Rei', 'rei', L('angry', 'Segura o baixo, Noz. O show vai começar.'))]
  ];
  const BOSS_INTRO = [D('Barão Urso', 'barao', 'Majestade! Bem-vindo ao meu show particular.'), D('Rei', 'rei', 'Cadê minhas castanhas, Barão?'),
    D('Barão Urso', 'barao', 'Eu precisava de público. E nada lota um show como castanha de graça.'), D('Rei', 'rei', 'Castanha de graça... com a castanha DOS OUTROS.'),
    D('Barão Urso', 'barao', L('angry', 'Detalhe! Que comece o duelo!'))];
  const RHYME = [D('Barão Urso', 'barao', L('angry', 'Eu sou o Barão, o dono do refrão! E você é só... um grão!')),
    D('Barão Urso', 'barao', L('angry', 'Rimo com trovão, com furacão, com... feijão!'), 'Feijão foi fraco. A plateia percebeu.')];
  const DONE = [
    [D('Rei', 'rei', "'Festival Sob a Lua. Atração principal: Barão Urso.'"), D('Rei', 'rei', 'Ele roubou meu estoque pra pagar um show?'),
      D('Urubu Fofoqueiro', 'corvo', 'Ouvi dizer que ele é famoso no Egito.'), D('Rei', 'rei', 'Ele é um urso, Urubu.'), D('Urubu Fofoqueiro', 'corvo', 'Um urso famoso no Egito.')],
    [D('Rei', 'rei', L('happy', 'Corda, palheta e amplificador. Só falta a banda.')), D('Urubu Fofoqueiro', 'corvo', 'Ouvi dizer que duas irmãs tocam muito. Estão presas no Cipoal.'),
      D('Rei', 'rei', 'Você ouve tudo, né?'), D('Urubu Fofoqueiro', 'corvo', 'É meu único talento.')],
    [D('Irmã Mel', 'irma1', 'Ufa! O caminhão do Gambá leva a gente até o festival.'), D('Irmã Noz', 'irma2', 'Eu toco baixo.'), D('Rei', 'rei', L('happy', 'E eu toco o terror.'))],
    [D('Gambá', 'texugo', 'Chegamos.'), D('Rei', 'rei', "Só isso? Nem um 'obrigado, Majestade'?"), D('Gambá', 'texugo', '...Chegamos, Majestade.')],
    [D('Barão Urso', 'barao', L('shock', 'Ninguém nunca me chamou pra tocar. Nem em aniversário.')), D('Rei', 'rei', 'E aí você roubou doze mil castanhas?'),
      D('Barão Urso', 'barao', 'Foi uma fase difícil da carreira.'), D('Rei', 'rei', 'O Rei não perdoa. O Rei divide. E você carrega o amplificador.'),
      D('Barão Urso', 'barao', L('happy', 'Roadie! Meu sonho de infância!'))]
  ];
  const EPILOGUE = ['Castanha para todo mundo. Até para o Urubu.', 'Fim. Ou será que tem bis?'];
  const TITLE = ['O saco de juta', 'Peças da guitarra', 'As duas irmãs', 'Estrada escura', 'Duelo no palco'];
  const SIDE_NAME = ['Castanhas douradas', 'Castanhas douradas', 'Castanhas douradas', 'Castanhas douradas', 'Castanhas douradas'];
  const SIDE_TXT = Array.from({ length: 5 }, () => () => `ache as 3 castanhas douradas escondidas (${Math.min(3, M.gold)}/3)`);


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

  function cheer(text) {
    const g = api();
    if (RC.hud && typeof RC.hud.complete === 'function') RC.hud.complete(text); else g.toast(text, 2200);
    g.jingle('checkpoint');
  }
  function objective() {
    const g = api(); if (!g || !M) return;
    if (g.G.state === 'boot' || g.G.state === 'title') { clearObjective(); return; }
    const o = M.done ? { title: TITLE[M.s], text: M.doneText || 'Pronto! Vá ao caminhão.', cur: 1, max: 1 }
      : { title: TITLE[M.s], text: M.text(), cur: M.cur(), max: M.max };
    const extra = run.side[M.s] ? 'Extra feito! +1 coração' : 'Extra: ' + SIDE_TXT[M.s]();
    if (RC.hud && typeof RC.hud.setObjective === 'function') RC.hud.setObjective({ title: o.title, text: o.text, extra, extraDone: !!run.side[M.s], cur: o.cur, max: o.max });
  }
  function clearObjective() { if (RC.hud && typeof RC.hud.setObjective === 'function') RC.hud.setObjective(null); }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function intro(stage) {
    const g = api(); await sleep(2300);
    if (!M || M.s !== stage || g.G.state !== 'playing') return;
    if (RC.hud && RC.hud.card) await RC.hud.card(CARDS[stage][0], CARDS[stage][1], 4600);
    if (stage < 4) await say(INTRO[stage]); else await say(INTRO[4]);
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

  /* ------------------------------------------------------------ utilidades de posição */
  const gTop = (x) => api().groundTop(Math.floor(x / 32));
  const solidX = (x) => {                       // coluna firme (sem fosso por perto) mais próxima e longe de lampiões de retorno
    let k = 0; const solid = (xx) => gTop(xx) < 1e8;
    const cps = (api().G.lv && api().G.lv.checkpoints) || [];
    for (let i = 0; i < 12 && cps.some((c) => Math.abs(c.x - x) < 200); i++) x += 96;
    x = Math.round(x / 32) * 32;
    while (k < 60 && !(solid(x - 32) && solid(x) && solid(x + 32))) { k++; x += (k % 2 ? 1 : -1) * k * 32; }
    return x;
  };
  /* trecho plano largo para laje/arena, longe de lampiões e do início/chegada */
  function findFlat(lv, minCols, f0, f1, avoidProps) {
    const lo = Math.max(900, lv.start.x + 700), hi = lv.goal.x - 700, tgt = lo + (hi - lo) * (f0 + f1) / 2;
    let best = null;
    for (let c = 0; c < lv.cols;) {
      if (lv.ground[c] < 0) { c++; continue; }
      let e = c; while (e + 1 < lv.cols && lv.ground[e + 1] === lv.ground[c]) e++;
      const x0 = (c + 4) * 32, x1 = (e - 3) * 32;
      if (x1 - x0 >= minCols * 32 && x0 > lo && x1 < hi && !lv.checkpoints.some((k) => k.x > x0 - 100 && k.x < x1 + 100)
        && !(avoidProps && (lv.props || []).some((p) => p.x > x0 - 60 && p.x < x1 + 60))) {
        const d = Math.abs((x0 + x1) / 2 - tgt); if (!best || d < best.d) best = { x0, x1, y: lv.ground[c] * 32, d };
      }
      c = e + 1;
    }
    return best;
  }
  const ITEM_NAMES = ['item_corda', 'item_palheta', 'item_amp', 'item_chave', 'item_panfleto', 'item_saco'];
  const need = (n) => { const r = api().rects; if (!r[n]) { console.error('[missions] sprite ausente no atlas: ' + n); return null; } return r[n]; };

  /* ------------------------------------------------------------ definição das missões */
  function newMission(s, lv) {
    const g = api(), mi = lv.mission || {};
    const m = { s, lv, done: false, doneText: '', items: [], cur: () => 0, max: 1, text: () => '', nHurt: 0, gold: 0, t0: 0 };
    if (s === 0) {                                              // pega o urso do saco: ele espera em 3 pontos fixos
      const pts = mi.runner;
      m.pts = pts; m.runner = { x: pts[0], y: gTop(pts[0]), state: 'wait', catches: 0, dir: 1, leak: 0, t: 0 };
      m.flyer = null;
      m.max = 3; m.cur = () => m.runner.catches;
      m.text = () => (m.flyer ? 'Pegue o papel que o urso largou' : `Alcance o urso do saco e dê um tabefe (${m.runner.catches}/3)`);
    } else if (s === 1) {                                       // guitarra: corda (copa), palheta (lago), amplificador (ilha)
      m.items = [
        { kind: 'item_corda', label: 'corda', x: mi.corda.x, y: mi.corda.y, got: false, hint: 'corda (nas copas)' },
        { kind: 'item_palheta', label: 'palheta', x: mi.palheta.x, y: mi.palheta.y, got: false, hint: 'palheta (fundo do lago)' },
        { kind: 'item_amp', label: 'amplificador', x: mi.amp.x, y: mi.amp.y, got: false, hint: 'amplificador (depois da ponte)' }
      ];
      m.max = 3; m.cur = () => m.items.filter((i) => i.got).length;
      m.text = () => 'Falta: ' + m.items.filter((i) => !i.got).map((i) => i.hint).join(', ');
    } else if (s === 2) {                                       // gaiolas penduradas + fuga
      m.cap = mi.cages.map((c, i) => ({ name: i ? 'npc_irma2' : 'npc_irma1', x: c.x, foot: c.foot, freed: false, state: 'hang', vy: 0, fy: 0, i }));
      m.trail = []; m.chase = null; m.escapeStarted = false; m.escapeEnd = mi.escapeEnd;
      m.max = 2; m.cur = () => m.cap.filter((c) => c.freed).length;
      m.text = () => (m.escapeStarted ? 'Corra para o caminhão! A gangue vem atrás' : `Pule e dê um tabefe nas gaiolas (${m.cur()}/2)`);
    } else if (s === 3) {                                       // escolta do caminhão
      m.lamps = mi.lamps.map((x, i) => ({ x, y: gTop(x), lit: false, i, amb: mi.ambush.includes(i) }));
      const n = m.lamps.length;
      m.truck = { x: lv.start.x + 160, y: gTop(lv.start.x + 160), hits: 0, hitCd: 0, why: '', moving: 0, wob: 0 };
      m.max = n; m.cur = () => m.lamps.filter((l) => l.lit).length;
      m.text = () => `Acenda os lampiões (${m.cur()}/${n})${m.truck.why ? '. ' + m.truck.why : ''}`;
    } else {                                                    // chefe no palco
      m.boss = null; m.spawned = false; m.hurtAtBoss = 0;
      m.max = 1; m.cur = () => (m.done ? 1 : 0); m.text = () => 'Vença o Barão no palco';
    }
    return m;
  }

  function awardSide() {
    const g = api(), s = M.s;
    if (run.side[s]) return;
    run.side[s] = true;
    if (g.G.hearts < g.G.maxHearts) { g.G.hearts++; g.renderHearts(); }
    cheer('As 3 castanhas douradas! +1 coração');
    g.burst('spark', g.player.x + 10, g.player.y, 16, 260, { col: [1, 0.5, 0.6], life: 0.7 });
    objective();
  }
  function completeMain() {
    if (M.done) return;
    M.done = true; run.main[M.s] = true;
    const g = api();
    cheer('Missão cumprida: ' + TITLE[M.s]);
    g.burst('spark', g.player.x + 10, g.player.y, 24, 300, { col: [1, 0.85, 0.4], life: 0.8 });
    M.doneText = M.s === 4 ? 'Pegue as castanhas e suba no caminhão' : 'Agora é só chegar ao caminhão';
    objective();
    const s = M.s;
    setTimeout(async () => {
      if (!M || !M.done || g.G.state !== 'playing') return;
      await say(DONE[s]);
      if (s === 4) { rainNuts(); M.roadie = true; }
    }, 700);
  }
  function rainNuts() {
    const g = api(), G = g.G, px = g.player.x;
    for (let i = 0; i < 18; i++) G.nuts.push({ x: px - 260 + i * 30, y: -20 - (i % 4) * 30, golden: i % 6 === 0, taken: false, ph: 0, mag: false, vy: 40, drop: true });
  }
  const CATCH = [
    [D('Capanga Ursinho', 'capanga', L('shock', 'Ai! Calma, eu só trabalho aqui!')), D('Rei', 'rei', 'Então trabalha devolvendo.')],
    [D('Capanga Ursinho', 'capanga', 'De novo não... meu turno acabou faz uma hora.')],
    [D('Capanga Ursinho', 'capanga', L('shock', 'Tá bom, tá bom! Foi o Barão.'), 'Tá tudo nesse papel. Não conta que fui eu.')]
  ];
  const PART_LINE = { item_corda: 'Corda de cipó trançado. Afinada pelo vento.', item_palheta: 'Uma pedrinha lisa do fundo do lago. Serve de palheta!', item_amp: L('happy', 'Um amplificador! Quem larga isso numa ilha?') };

  /* ------------------------------------------------------------ eventos */
  EV.on('stageLoaded', (lv) => {
    const g = api(); if (!g) return;
    const s = Math.max(0, Math.min(4, g.G.stage));
    run.main[s] = false; run.side[s] = false;
    M = newMission(s, lv);
    g.G.dialogue = false; dlgDepth = 0;
    g.G.finishBlock = () => {
      if (!M || M.done) return null;
      if (M.s === 4 && !M.boss) return null;
      return M.s === 4 ? 'O Barão ainda está no palco!' : `Antes do caminhão: ${M.text().toLowerCase()}`;
    };
    objective();
  });
  EV.on('stageStart', (stage) => {
    if (stage === 0) { run.main.fill(false); run.side.fill(false); }
    objective();
    intro(stage);
  });
  EV.on('playerHurt', () => { if (M) { M.nHurt++; objective(); } });
  EV.on('nutTaken', (n) => { if (M && n.secret) { M.gold++; api().toast(`Castanha dourada! ${Math.min(3, M.gold)}/3`, 1500); if (M.gold >= 3) awardSide(); else objective(); } });
  EV.on('bossDefeated', () => { if (M && M.s === 4) completeMain(); });
  EV.on('finish', () => { if (M && M.s === 4 && RC.hud && RC.hud.card) setTimeout(() => RC.hud.card(EPILOGUE[0], EPILOGUE[1], 5200), 900); });

  EV.on('update', (dt) => {
    const g = api(); if (!g || !M) return;
    const G = g.G, P = g.player, lv = M.lv, s = M.s;
    if (G.state !== 'playing' || G.dialogue) return;
    const near = (x, y, r) => Math.hypot(P.x + P.w / 2 - x, P.y + P.h / 2 - y) < r;
    const pickup = (it, onGet) => { if (!it.got && !it.hidden && !it.falling && near(it.x, it.y, 46)) { it.got = true; g.sfx('item', 0.4, 1.3); g.burst('spark', it.x, it.y, 14, 240, { col: [1, 0.9, 0.5], life: 0.5 }); onGet(it); objective(); } };
    const fall = (it) => {
      if (!it.falling) return;
      it.vy += 900 * dt; it.y += it.vy * dt;
      const sb = g.surfaceBelow(it.x, it.y - 16);
      if (it.y > sb - 22 && it.vy > 0) { it.y = sb - 22; it.vy = 0; it.falling = false; }
    };
    if (s === 0) {
      const r = M.runner; r.t += dt;
      if (r.state === 'flee' || r.state === 'gone') {
        const tx = r.state === 'gone' ? lv.goal.x + 400 : M.pts[r.catches];
        r.x += Math.min(340 * dt, Math.abs(tx - r.x)) * Math.sign(tx - r.x || 1);
        const gt = RC.mech ? RC.mech.solidAt(r.x) : gTop(r.x); if (gt !== null && gt < 1e8) r.y = gt; else { const w = RC.mech && RC.mech.waterAt(r.x, 1e4); if (w !== null && w !== undefined) r.y = w + 18; }
        r.leak -= dt; if (r.leak <= 0 && r.state === 'flee') { r.leak = 0.5; G.nuts.push({ x: r.x - 18, y: r.y - 34, golden: false, taken: false, ph: 0, mag: false, vy: -140, drop: true }); }
        if (Math.abs(tx - r.x) < 4) { if (r.state === 'gone') r.state = 'away'; else r.state = 'wait'; }
      } else if (r.state === 'wait') {
        const dx = P.x + P.w / 2 - r.x, dy = P.y + P.h - r.y;
        const hit = P.atk > 0 && Math.abs(dx) < 86 && Math.abs(dy) < 70 && dx * P.facing <= 14;
        const stomp = P.vy > 60 && Math.abs(dx) < 36 && dy < -10 && dy > -70;
        if (hit || stomp) {
          r.catches++; G.hitstop = 0.08; G.shake = Math.max(G.shake, 6); g.sfx('kill', 0.5, 1.2);
          g.burst('spark', r.x, r.y - 40, 18, 300, { col: [1, 0.8, 0.4], life: 0.5 });
          if (stomp) { P.vy = -420; P.jumping = false; }
          if (r.catches >= 3) {
            r.state = 'gone';
            m_flyer(r);
          } else r.state = 'flee';
          say(CATCH[r.catches - 1]); objective();
        }
      }
      if (M.flyer) { fall(M.flyer); pickup(M.flyer, () => completeMain()); }
    } else if (s === 1) {
      for (const it of M.items) { pickup(it, () => { say([D('Rei', 'rei', PART_LINE[it.kind])]); if (M.cur() >= M.max) completeMain(); }); }
    } else if (s === 2) {
      for (const c of M.cap) {
        if (c.state === 'hang') {
          const cy = c.foot - 110, dx = P.x + P.w / 2 - c.x, dy = P.y + P.h / 2 - cy;
          const hitWin = P.atk > 0 && Math.abs(dx) < 84 && Math.abs(dy) < 80;
          if (hitWin) { c.state = 'fall'; c.fy = c.foot - 56; c.vy = -120; G.hitstop = 0.06; g.sfx('punch', 0.4, 0.9); g.burst('spark', c.x, cy, 14, 240, { col: [1, 0.85, 0.5], life: 0.5 }); }
        } else if (c.state === 'fall') {
          c.vy += 1100 * dt; c.fy += c.vy * dt;
          if (c.fy >= c.foot) {
            c.fy = c.foot; c.state = 'free'; c.freed = true; g.sfx('kill', 0.5, 0.8); g.jingle('item'); G.shake = Math.max(G.shake, 6);
            g.burst('spark', c.x, c.foot - 40, 26, 320, { col: [1, 0.85, 0.5], life: 0.8 });
            g.burst('leaf', c.x, c.foot - 30, 8, 260, { name: 'crate_piece_1', g: 900, vr: 10, life: 1 });
            M.trail.push({ name: c.name, x: c.x, y: c.foot });
            say(c.i ? [D('Irmã Noz', 'irma2', 'Valeu.'), D('Rei', 'rei', 'Só isso?'), D('Irmã Noz', 'irma2', 'Valeu mesmo.')] : [D('Irmã Mel', 'irma1', 'Até que enfim! Pelo resgate, te dou desconto no frete.'), D('Rei', 'rei', 'Eu não cobrei nada.'), D('Irmã Mel', 'irma1', 'Então o desconto é maior ainda.')]);
            objective();
            if (M.cur() >= M.max) startEscape();
          }
        }
      }
      M.hist = M.hist || [];
      M.hist.push([P.x + P.w / 2, P.y + P.h]); if (M.hist.length > 90) M.hist.shift();
      M.trail.forEach((f, i) => {
        const h = M.hist[Math.max(0, M.hist.length - 1 - (i + 1) * 22)] || M.hist[0];
        f.x += (h[0] - f.x) * Math.min(1, dt * 8); f.y += (h[1] - f.y) * Math.min(1, dt * 8);
        f.dir = h[0] > f.x + 1 ? 1 : h[0] < f.x - 1 ? -1 : (f.dir || 1);
      });
      if (M.chase && !M.done) {
        const c = M.chase; c.t += dt; c.x += (175 + Math.min(30, c.t * 1.2)) * dt;
        c.x = Math.max(c.x, P.x - 700);                          // nunca fica longe demais: a pressão continua
        if (c.x + 34 > P.x && !P.dead) {                         // alcançou: derruba castanhas e empurra, sem tirar coração
          const lose = Math.min(5, G.collected); G.collected -= lose; g.renderNuts(); c.x = P.x - 460;
          P.vx = 320; P.vy = -360; P.grounded = false; G.shake = Math.max(G.shake, 8); g.sfx('hurt', 0.3);
          for (let k = 0; k < lose; k++) G.nuts.push({ x: P.x + 40 + k * 18, y: P.y, golden: false, taken: false, ph: k, mag: false, vy: -300, drop: true });
          g.toast(lose ? `A gangue te alcançou! Caíram ${lose} castanhas` : 'A gangue te alcançou!', 1400);
        }
        if (P.x + P.w / 2 > M.escapeEnd) { M.chase = null; completeMain(); }
      }
    } else if (s === 3) {
      const T = M.truck; T.hitCd -= dt;
      // lampiões
      for (const l of M.lamps) if (!l.lit && Math.abs(P.x + P.w / 2 - l.x) < 46 && Math.abs(P.y + P.h - l.y) < 110) {
        l.lit = true; g.sfx('item', 0.45, 0.9); g.jingle('checkpoint'); g.burst('spark', l.x, l.y - 70, 16, 220, { col: [1, 0.7, 0.3], life: 0.6 });
        if (l.amb) {
          const ex = solidX(l.x + 340);
          const flat = [-48, 0, 48].every((o) => gTop(ex + o) === gTop(ex));
          if (flat) for (let k = 0; k < 2; k++) { const t2 = k ? 'hopper' : 'ant'; const e = g.makeEnemy({ type: t2, left: ex - 90 + k * 20, right: ex + 90 + k * 20, y: gTop(ex), speed: 80 }, 7 + k); G.enemies.push(e); }
          say([D('Capanga Ursinho', 'capanga', 'Ninguém falou que o caminhão tinha segurança!'), D('Gambá', 'texugo', 'Eu falei.')]);
        }
        objective();
      }
      // o caminhão anda atrás do Rei, e para se a estrada estiver escura ou bloqueada
      let why = '';
      const ahead = M.lamps.find((l) => !l.lit && l.x > T.x - 20 && l.x < T.x + 190);
      const block = G.enemies.find((e) => !e.dead && e.x + e.w > T.x - 30 && e.x < T.x + 260 && Math.abs((e.y + e.h) - T.y) < 80);
      const road = !RC.mech || [120, 200, 290].every((o) => RC.mech.solidAt(T.x + o) !== null);
      if (ahead) why = 'Estrada escura: acenda o lampião'; else if (!road) why = 'A ponte está levantada: abra o caminho'; else if (block) why = 'Bichos na estrada: tire eles do caminho'; else if (P.x < T.x + 60) why = 'Vá na frente do caminhão';
      if (why !== T.why) { T.why = why; objective(); }
      T.moving = why ? 0 : 1;
      if (T.moving) {
        T.x += 135 * dt; const gt = RC.mech ? RC.mech.solidAt(T.x + 60) : gTop(T.x + 60); if (gt !== null && gt < 1e8) T.y += (gt - T.y) * Math.min(1, dt * 12);
        T.wob += dt;
      }
      for (const e of G.enemies) if (!e.dead && T.hitCd <= 0 && e.x + e.w > T.x - 60 && e.x < T.x + 90 && Math.abs((e.y + e.h) - T.y) < 60) {
        T.hits++; T.hitCd = 1.2; e.stun = 0.6; e.kb = 400; g.sfx('hurt', 0.3, 0.7); g.burst('spark', T.x + 20, T.y - 40, 12, 240, { col: [1, 0.5, 0.3], life: 0.5 }); G.shake = Math.max(G.shake, 5); objective();
      }
      if (T.x > lv.goal.x - 420 && !M.done) completeMain();
    } else {
      if (!M.spawned && P.x > lv.goal.x - 760) {
        M.spawned = true; M.hurtAtBoss = M.nHurt;
        try { if (RC.enemies && typeof RC.enemies.spawnBoss === 'function') M.boss = RC.enemies.spawnBoss(lv.goal.x - 260) || null; } catch (err) { console.error(err); }
        if (M.boss) { objective(); say(BOSS_INTRO); }
        else completeMain();
      }
      if (M.boss && !M.done) {
        if (M.boss.hp <= 8 && !M.r1) { M.r1 = true; say([RHYME[0]]); }
        if (M.boss.hp <= 4 && !M.r2) { M.r2 = true; say([RHYME[1]]); }
        if (M.boss.dead || M.boss.defeated || M.boss.hp <= 0) completeMain();
      }
    }
    sideCheckLate();
  });
  function m_flyer(r) { M.flyer = { kind: 'item_panfleto', x: r.x, y: r.y - 40, vy: -260, falling: true, got: false, hidden: false }; }
  function startEscape() {
    M.escapeStarted = true;
    const P = api().player;
    M.chase = { x: P.x - 520, t: 0 };
    setTimeout(() => say([D('Irmã Mel', 'irma1', 'Ih... a gangue acordou. E trouxe os primos.'), D('Irmã Noz', 'irma2', 'Corre.'), D('Irmã Mel', 'irma1', 'Corre que depois eu cobro!')]), 900);
    objective();
  }
  function sideCheckLate() {}


  /* ------------------------------------------------------------ desenho */
  function frameOf(base, n, t, rate) { const rc = api().rects; for (let i = n; i >= 1; i--) if (rc[`${base}_${i}`]) { n = i; break; } return `${base}_${1 + (Math.floor(t * (rate || 5)) % n)}`; }
  function drawItem(name, x, y, t, scale) {                       // item com sprite real e animado: giro, balanço e brilho. Nunca um quadrado.
    const g = api(), c = ITEM_COL[name] || [1, 1, 1], bob = Math.sin(t * 3 + x * 0.02) * 4;
    const fr = `${name}_${1 + (Math.floor(t * 3 + x * 0.01) % 2)}`, r = need(fr); if (!r) return;
    glow(x, y + bob, 1.15, [c[0], c[1], c[2], 0.4 + 0.18 * Math.sin(t * 4 + x)]);
    const sc = g.S * (scale || 1), spin = 0.72 + 0.28 * Math.abs(Math.cos(t * 2.1 + x * 0.01));
    g.spr(fr, x - r.w * sc * spin / 2, y + bob - r.h * sc / 2, sc * spin, sc, { emit: 0.55 });
    const k = (t * 1.7 + x * 0.013) % 1;                          // estrelinha de brilho
    glow(x + Math.cos(k * 6.28) * 16, y + bob + Math.sin(k * 6.28) * 14, 0.22 * (1 - Math.abs(k - 0.5) * 2), [1, 1, 0.85, 0.9]);
  }
  const ITEM_COL = { item_corda: [0.8, 0.88, 1], item_palheta: [1, 0.8, 0.5], item_amp: [1, 0.85, 0.5], item_chave: [1, 0.9, 0.3], item_panfleto: [1, 0.85, 0.6], item_saco: [1, 0.8, 0.4] };
  function boss(x, footY, t, dir, sc, anim, tint, extra) {        // o Barão e seus capangas: mesmo sprite, escalas e tons diferentes
    const g = api(), nm = frameOf('boss_' + (anim || 'walk'), 6, t, 7), r = g.rects[nm]; if (!r) return;
    const k = (tint || [1, 1, 1]), br = (anim || 'walk') === 'idle' ? 1 + Math.sin(t * 2.4 + x * 0.01) * 0.025 : 1;   // parado: respira
    g.spr(nm, x - (dir > 0 ? 0 : -r.w * g.S * sc) - r.w * g.S * sc / 2 * (dir > 0 ? 1 : -1) * 1, footY - r.h * g.S * sc * br + 4, (dir > 0 ? -1 : 1) * g.S * sc, g.S * sc * br, Object.assign({ col: [k[0], k[1], k[2], 1], emit: 0.04 }, extra));
  }
  EV.on('drawBehind', (t, cam) => {
    const g = api(); if (!g || !M || !g.rects || g.G.state === 'title') return;
    const vis = (x) => x > cam - 120 && x < cam + g.WW + 120;
    const lv = M.lv;
    const npc = M.s < 3 ? 'npc_corvo' : null;
    if (npc) { const x = lv.start.x + 300; if (vis(x)) drawNpc(npc, x, g.surfaceBelow(x, 0), t, -1); }
    if (M.s === 2) for (const c of M.cap) {
      if (!vis(c.x) || c.state === 'free') continue;
      const sw = Math.sin(t * 2 + c.i) * 3, bottom = c.state === 'hang' ? c.foot - 56 : c.fy;
      if (c.state === 'hang') drawNpc(c.name, c.x + sw, bottom - 8, t, c.i ? -1 : 1);
      dotRect(c.x + sw * 0.4 - 1, bottom - 230, 3, 126, [0.55, 0.38, 0.18, 1]);                 // corda de onde a gaiola pende
      g.spr(`gaiola_${1 + (Math.floor(t * 2.2) % 2)}`, c.x - 36 + sw, bottom - 104, g.S, g.S, { emit: 0.05 });
    }
    if (M.s === 3) for (const l of M.lamps) {
      if (!vis(l.x)) continue;
      const pr = g.rects.post, lr = g.rects[l.lit ? 'lantern_on' : 'lantern_off'];
      g.spr('post', l.x - pr.w, l.y - pr.h * g.S + 2, g.S, g.S);
      g.spr(l.lit ? 'lantern_on' : 'lantern_off', l.x - lr.w + Math.sin(t * 1.6 + l.x) * 1.2, l.y - pr.h * g.S + 18, g.S, g.S, { emit: l.lit ? 1.6 : 0 });
    }
    if (M.s === 4 && M.spawned) {                                                 // plateia em silhueta, braços para o alto
      const y0 = lv.goal.y + 2;
      for (let x = lv.goal.x - 1250; x < lv.goal.x - 60; x += 38) {
        if (!vis(x)) continue;
        const j = Math.sin(x * 12.9) * 7, up = Math.sin(t * (3 + (x % 5) * 0.3) + x) * 0.5 + 0.5, hh = 20 + (x % 3) * 4;
        glow(x + j, y0 - hh - 8, 0.34, [0.04, 0.03, 0.08, 0.95]);                   // cabeça
        glow(x + j, y0 - 8, 0.52, [0.04, 0.03, 0.08, 0.95]);                        // corpo
        dotRect(x + j - 11, y0 - hh - 6 - up * 14, 3, 14 + up * 12, [0.04, 0.03, 0.08, 0.95]); dotRect(x + j + 9, y0 - hh - 6 - (1 - up) * 14, 3, 14 + (1 - up) * 12, [0.04, 0.03, 0.08, 0.95]);
      }
    }
    if (M.s === 4 && M.roadie) { const x = lv.goal.x - 200; if (vis(x)) { boss(x, lv.goal.y, t, -1, 0.55, 'idle', [0.95, 0.9, 1]); drawItem('item_amp', x - 26, lv.goal.y - 86, t, 0.6); } }
  });
  EV.on('drawFront', (t, cam) => {
    const g = api(); if (!g || !M || !g.rects || g.G.state === 'title') return;
    const vis = (x) => x > cam - 120 && x < cam + g.WW + 120;
    if (M.s === 0) {
      const r = M.runner;
      if (r.state !== 'away' && vis(r.x)) {
        const fleeing = r.state === 'flee' || r.state === 'gone', hop = fleeing ? Math.abs(Math.sin(t * 14)) * 7 : Math.sin(t * 5) * 1;
        boss(r.x, r.y - hop, t, 1, 0.5, fleeing ? 'walk' : 'idle', [0.78, 0.72, 0.85]);
        const sr = g.rects.item_saco_1; if (sr) g.spr('item_saco_' + (1 + (Math.floor(t * 4) % 2)), r.x - 36 - sr.w * 0.5, r.y - hop - 70, g.S * 0.75, g.S * 0.75, { emit: 0.08 });
      }
      if (M.flyer && !M.flyer.got && vis(M.flyer.x)) drawItem('item_panfleto', M.flyer.x, M.flyer.y, t, 1.1);
    }
    if (M.s === 1) for (const it of M.items) if (!it.got && !it.hidden && vis(it.x)) drawItem(it.kind, it.x, it.y, t);
    if (M.s === 2) {
      for (const f of M.trail) drawNpc(f.name, f.x, f.y, t, f.dir || 1);
      if (M.chase) {
        const c = M.chase;
        for (let k = 0; k < 4; k++) { const x = c.x - 30 - k * 38 + Math.sin(t * 9 + k) * 6; if (vis(x)) boss(x, gTop(Math.max(x, 0)) < 1e8 ? gTop(x) : M.lv.goal.y, t + k * 0.3, 1, 0.42 + (k % 2) * 0.06, 'walk', [0.55, 0.5, 0.65]); }
      }
    }
    if (M.s === 3) {
      const T = M.truck, tr = g.rects.truck, sc = 1.3;
      if (tr && vis(T.x)) {
        const jit = T.moving ? Math.sin(T.wob * 24) * 0.9 : 0, flash = T.hitCd > 0.9 ? 2.2 : 1;
        g.spr('truck', T.x - 30, T.y - tr.h * sc + 5 + jit, sc, sc, { emit: 0.3, col: [1.3 * flash, 1.25 * flash, 1.2 * flash, 1] });
      }
    }
  });
  EV.on('drawAdd', (t, cam) => {
    const g = api(); if (!g || !M || !g.rects || g.G.state === 'title') return;
    if (M.s === 3) {
      for (const l of M.lamps) if (l.lit && l.x > cam - 140 && l.x < cam + g.WW + 140) glow(l.x, l.y - 70, 2.6, [1, 0.62, 0.3, 0.42 + 0.1 * Math.sin(t * 5 + l.x)]);
      const T = M.truck, r = g.rects.glow;
      if (T && T.x > cam - 200 && T.x < cam + g.WW + 200) { glow(T.x + 215 * 1.3 * 0.95, T.y - 38, 1.6, [1, 0.92, 0.6, T.moving ? 0.55 : 0.2]); }
    }
    if (M.s === 2 && M.chase) { const x = M.chase.x; glow(x - 60, M.lv.goal.y - 60, 5, [0.1, 0.02, 0.18, 0.55]); }
    if (M.s === 4 && M.spawned && !M.done) {                                      // refletores do palco
      const R = g.R, r = g.rects.glow, cx = M.lv.goal.x - 460;
      for (let k = 0; k < 3; k++) {
        const ang = Math.sin(t * 0.9 + k * 2.1) * 0.5, ox = cx + (k - 1) * 320, col = [[1, 0.4, 0.5], [0.5, 0.8, 1], [1, 0.9, 0.4]][k];
        R.sprite(g.atlas.set, r, ox - 36, -20, 72 / r.w, 560 / r.h, { col: [col[0], col[1], col[2], 0.16], lit: 0, noSnap: true, rot: ang, px: 36, py: 20 });
      }
    }
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
      addToStats('done-stats', `<b>${st}/${M.s + 1}</b><span>extras (${run.side[M.s] ? SIDE_NAME[M.s] + ': feito' : SIDE_NAME[M.s] + ': faltou'})</span>`);
    }
    if (win && win.classList.contains('visible')) {
      addToStats('win-stats', `<b>${run.main.filter(Boolean).length}/5</b><span>missões da história</span>`);
      addToStats('win-stats', `<b>${run.side.filter(Boolean).length}/5</b><span>desafios extras</span>`);
    }
  }, 400);

  RC.missions = {
    run, get current() { return M; }, skipDialogue() { const g = api(); if (g) g.G.dialogue = false; },
    TITLE, SIDE_NAME, say, ITEM_NAMES, CARDS, INTRO, DONE, CATCH, RHYME, BOSS_INTRO, EPILOGUE
  };
})();
