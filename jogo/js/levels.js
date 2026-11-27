/* Rei da Castanha: as cinco fases, desenhadas à mão (nada de sementes nem geração procedural).

   Grade: tile T = 32. Linha 13 do chão = y 416. O pulo sobe ~119 px (3 linhas e pouco) e vence
   ~4 colunas de vão no plano (5 a 6 com arrancada). Abaixo disso, cada fase segue o padrão de documento
   de fase: tema, caminho principal, rotas opcionais, segredos (3 castanhas douradas), encontros e ritmo.

   Formato de saída (o que game.js, mechanics.js, props.js e missions.js leem):
     ground[col] = linha do chão (-1 = buraco)   platforms [{x, y, w}]   nuts [{x, y, golden, opt, secret}]
     enemies [{type, left, right, y, speed}]      checkpoints [{x, y}]    props [{type:'crate'|'spring', x, y}]
     water [{x0, x1, y}]  vines [{x, y, len}]  ropes [{x, y0, y1}]  bridges [{type, x0, x1, y, lever?}]  rafts [...]
     mission: dados fixos da missão da fase (posições escolhidas à mão, sempre alcançáveis). */
(function (root) {
  'use strict';
  const RC = root.RC = root.RC || {};
  const T = 32;
  const PHYS = RC.PHYS = {
    GRAV: 1500, FALL_MULT: 1.35, JUMP_V: 600, CUT_V: 230, MAXFALL: 840,
    RUN: 270, ACC_G: 2500, ACC_A: 1650, FRIC_G: 2800, FRIC_A: 600,
    COYOTE: 0.1, BUFFER: 0.13, STOMP_V: 470, W: 26, H: 38
  };
  const NAMES = ['A Toca ao Amanhecer', 'Mata Fechada', 'Entardecer no Cipoal', 'Hora Azul', 'Festival Sob a Lua'];
  const SPEED = { ant: 85, hopper: 60, gator: 45, wasp: 70, beetle: 46, toad: 0 };

  /* ------------------------------------------------------------ construtor */
  function builder(index) {
    const lv = {
      index, mood: index, name: NAMES[index], handmade: true, seed: index, genSeed: 101 + index * 17,
      ground: [], platforms: [], nuts: [], enemies: [], checkpoints: [], props: [], lanterns: [],
      water: [], vines: [], ropes: [], bridges: [], rafts: [], winds: [], arenas: [], secrets: [], zones: [], landmarks: [], mission: {}
    };
    const g = lv.ground;
    const B = {
      lv, X: (c) => c * T, col: () => g.length,
      top: (c) => g[c] * T,                                      // y do chão na coluna
      run(n, row) { const c0 = g.length; for (let i = 0; i < n; i++) g.push(row); return c0; },
      gap(n) { const c0 = g.length; for (let i = 0; i < n; i++) g.push(-1); return c0; },
      /* lago: margens na linha bankRow, fundo depth linhas abaixo; a água fica 16 px abaixo da margem */
      pool(n, bankRow, depth) { const c0 = g.length; for (let i = 0; i < n; i++) g.push(bankRow + (depth || 3)); lv.water.push({ x0: c0 * T, x1: (c0 + n) * T, y: bankRow * T + 16 }); return c0; },
      nut(x, y, o) { o = o || {}; lv.nuts.push({ x: Math.round(x), y: Math.round(y), golden: !!o.gold, opt: !!(o.opt || o.secret), secret: !!o.secret }); },
      secret(x, y, label) { B.nut(x, y, { gold: true, secret: true }); lv.secrets.push({ type: label || 'segredo', x, y, w: 32 }); },
      line(x0, y, n, dx, o) { for (let i = 0; i < n; i++) B.nut(x0 + i * (dx || 32), y, o); },
      /* castanhas num arco de pulo de (x0, y0) até (x1, y1), com altura h acima do ponto mais alto */
      arc(x0, y0, x1, y1, n, h, o) {
        const top = Math.min(y0, y1) - h;
        for (let i = 0; i < n; i++) {
          const u = (i + 1) / (n + 1), x = x0 + (x1 - x0) * u;
          const base = y0 + (y1 - y0) * u, bump = 4 * u * (1 - u) * (Math.min(y0, y1) - top + Math.abs(y1 - y0) * 0.5);
          B.nut(x, base - bump, o);
        }
      },
      plat(x, y, w, o) { lv.platforms.push(Object.assign({ x: Math.round(x), y: Math.round(y), w: Math.round(w), kind: 'branch' }, o)); },
      enemy(type, c0, c1, o) {
        const row = g[c0];
        for (let c = c0; c <= c1; c++) if (g[c] !== row) throw new Error(`${NAMES[index]}: inimigo ${type} fora do chão plano (col ${c})`);
        lv.enemies.push(Object.assign({ type, left: (c0 + 0.5) * T, right: (c1 + 0.5) * T, y: row * T, speed: SPEED[type] }, o));
      },
      cp(c) { lv.checkpoints.push({ x: c * T + 16, y: g[c] * T }); },
      crate(c, gold) { lv.props.push({ type: 'crate', x: c * T + 16, y: g[c] * T, golden: !!gold }); },
      spring(c) { lv.props.push({ type: 'spring', x: c * T + 16, y: g[c] * T }); },
      vine(x, y, len) { lv.vines.push({ x: Math.round(x), y, len }); },
      rope(x, y0, y1) { lv.ropes.push({ x: Math.round(x), y0, y1 }); },
      bridge(type, x0, x1, y, lever) { lv.bridges.push({ type, x0, x1, y, lever }); },
      raft(x0, x1, y, w, speed) { lv.rafts.push({ x0, x1, y, w: w || 96, speed: speed || 55 }); },
      lantern(x, y, len, hue) { lv.lanterns.push({ x, y, len: len || 40, hue: hue || 0 }); },
      /* chegada: trecho plano de 24 colunas com o caminhão na 9ª */
      finish(row) {
        const c0 = B.run(24, row);
        lv.goal = { x: (c0 + 8) * T, y: row * T };
        B.line((c0 + 1) * T + 16, row * T - 24, 5, 40);
        return c0;
      },
      done() {
        lv.cols = g.length; lv.width = g.length * T;
        lv.start = { x: 3 * T, y: g[3] * T };
        const val = (n) => (n.golden ? 3 : 1);
        lv.total = lv.nuts.reduce((s, n) => s + val(n), 0);
        const main = lv.nuts.reduce((s, n) => s + (n.opt ? 0 : val(n)), 0);
        lv.required = Math.ceil(main * 0.4);                       // meta leve: a graça é explorar, não varrer a fase
        lv.landmarks.push({ type: 'inicio', x: lv.start.x, y: lv.start.y }, { type: 'caminhao', x: lv.goal.x, y: lv.goal.y });
        return lv;
      }
    };
    return B;
  }

  /* ================================================================ FASE 1 · A Toca ao Amanhecer
     Tema: manhã calma; ensina tudo sem punir. Nenhum buraco mortal até o tronco seco.
     Caminho: chão → degraus → 1º bicho → lago raso (nadar) → ponte de corda → 1º cipó de balançar
              (sobre água: errar = nadar) → tronco seco (tabefe derruba = ponte) → mola → lago fundo → caminhão.
     Missão: alcançar o Capanga Ursinho 3 vezes (ele espera nos pontos marcados).
     Segredos: copa da árvore (cipó de escalar), galho da mola, fundo do lago grande.
     Ritmo: calmo → leve (bicho) → respiro (lago) → atenção (cipó) → pico (tronco + bichos) → respiro → fim. */
  function stage0() {
    const B = builder(0), X = B.X, lv = B.lv;
    B.run(18, 13); B.line(X(6), 392, 8, 40);
    B.run(10, 12); B.crate(23); B.arc(X(16), 392, X(19), 360, 3, 30);
    B.run(12, 11); B.arc(X(26), 360, X(29), 328, 3, 30);
    B.enemy('ant', 31, 38);
    const p1 = B.pool(12, 11, 3);                                    // lago raso: nadar e mergulhar
    B.line(X(p1 + 2), 338, 8, 34); B.line(X(p1 + 3), 430, 6, 34);
    B.run(12, 11);                                                   // 52..63: capanga 1
    B.run(12, 12); B.cp(69);                                          // 64..75
    const g1 = B.gap(7);                                              // 76..82 ponte de corda
    B.bridge('rope', X(g1), X(g1 + 7), 384); B.line(X(g1) + 24, 360, 6, 36);
    const c2 = B.run(14, 12);                                         // 83..96
    B.enemy('hopper', c2 + 3, c2 + 10);
    B.rope(X(95) + 16, 160, 340);                                     // cipó de escalar até a copa
    B.plat(X(96) + 8, 210, 5 * T); B.line(X(97), 186, 3, 32); B.secret(X(100) + 8, 180, 'copa');
    const c3 = B.run(12, 13);                                         // 97..108
    B.line(X(c3 + 2), 392, 5, 36);
    const p2 = B.pool(10, 13, 3);                                     // 109..118 cipó sobre a água
    B.vine(X(p2 + 3) + 16, 110, 196);
    B.arc(X(p2) - 20, 340, X(p2 + 10), 360, 6, 70);
    const c4 = B.run(16, 13);                                         // 119..134: capanga 2
    B.crate(c4 + 11);
    const g2 = B.gap(7);                                              // 135..141 tronco seco
    B.bridge('log', X(g2), X(g2 + 7), 416);
    const c5 = B.run(19, 13);                                         // 142..160
    B.cp(c5 + 2); B.enemy('ant', c5 + 5, c5 + 10); B.spring(c5 + 13);
    B.plat(X(c5 + 14) + 8, 226, 4 * T, { bonus: true }); B.line(X(c5 + 15), 200, 2, 32, { opt: true }); B.secret(X(c5 + 17) + 8, 196, 'mola');
    const p3 = B.pool(12, 13, 3);                                     // 161..172 lago fundo
    B.line(X(p3 + 2), 404, 8, 36); B.line(X(p3 + 2), 470, 4, 36); B.secret(X(p3 + 11), 488, 'fundo do lago');
    B.run(2, 13);
    B.finish(13);
    lv.mission = { runner: [X(58), X(126), X(153)] };
    return B.done();
  }

  /* ================================================================ FASE 2 · Mata Fechada
     Tema: mata densa e vertical; três peças da guitarra em três lugares que pedem as três mecânicas.
     Caminho: chão com vespas e sapo → cipó de escalar até a COPA (corda, via cipó de balançar) → grande lago
              com jangada (palheta no fundo) → alavanca no alto abaixa a ponte levadiça → ilha (amplificador)
              → dois cipós seguidos sobre água → caminhão.
     Missão: corda (copa), palheta (fundo do lago), amplificador (ilha além da ponte levadiça).
     Segredos: pico do balanço na copa, canto fundo do lago, acima da ponte levadiça.
     Ritmo: aquecimento → subida (tensão de altura) → respiro na água → quebra-cabeça (alavanca) → pico (ilha) → fim. */
  function stage1() {
    const B = builder(1), X = B.X, lv = B.lv;
    B.run(16, 13); B.line(X(6), 392, 7, 40);
    const c1 = B.run(12, 12); B.enemy('wasp', c1 + 3, c1 + 9); B.line(X(c1 + 2), 360, 5, 40);
    B.gap(4); B.arc(X(28), 360, X(32), 360, 3, 40);
    const c2 = B.run(12, 12); B.enemy('toad', c2 + 6, c2 + 6); B.crate(c2 + 2);
    const c3 = B.run(28, 11);                                         // 44..71 chão sob a copa
    B.rope(X(50) + 16, 150, 312);
    B.plat(X(51) + 8, 210, 5 * T); B.line(X(52), 186, 3, 32);
    B.vine(X(60) + 16, 40, 150);                                      // balanço entre as copas
    B.plat(X(64), 200, 6 * T); B.line(X(64) + 20, 176, 2, 32);
    B.secret(X(63) + 20, 120, 'pico do balanço');
    B.enemy('ant', 56, 62); B.cp(68);
    const corda = { x: X(68), y: 168 };
    const p1 = B.pool(24, 11, 4);                                     // 72..95 o grande lago
    B.raft(X(p1) + 8, X(p1 + 24) - 8, 362, 96, 60);
    B.vine(X(p1 + 12) + 16, 120, 170);
    B.line(X(p1 + 3), 330, 5, 40); B.line(X(p1 + 9), 420, 6, 30); B.line(X(p1 + 15), 330, 5, 40);
    const palheta = { x: X(p1 + 12), y: 458 };
    B.secret(X(p1 + 23) - 4, 470, 'canto do lago');
    const c4 = B.run(12, 11);                                         // 96..107 lado de cá da ponte
    B.enemy('ant', c4 + 7, c4 + 11);
    B.rope(X(101) + 16, 210, 312);
    B.plat(X(102), 250, 5 * T);
    const g1 = B.gap(6);                                              // 108..113 ponte levadiça
    B.bridge('draw', X(g1), X(g1 + 6), 352, { x: X(105) + 16, y: 250 });
    B.secret(X(g1 + 2), 214, 'acima da ponte');
    const c5 = B.run(17, 11);                                         // 114..130 ilha
    B.enemy('beetle', c5 + 2, c5 + 6); B.enemy('ant', c5 + 11, c5 + 16); B.cp(c5 + 8);
    const amp = { x: X(c5 + 9), y: 316 };
    B.line(X(c5 + 1), 328, 4, 34);
    B.run(12, 12);                                                    // 131..142
    const p2 = B.pool(10, 12, 3);                                     // 143..152 dois cipós
    B.vine(X(p2 + 2) + 16, 90, 196); B.vine(X(p2 + 7) + 16, 90, 196);
    B.arc(X(p2), 320, X(p2 + 10), 330, 7, 60);
    const c6 = B.run(10, 12); B.enemy('wasp', c6 + 2, c6 + 7);
    B.finish(12);
    lv.mission = { corda, palheta, amp };
    return B.done();
  }

  /* ================================================================ FASE 3 · Entardecer no Cipoal
     Tema: pôr do sol entre cipós; a fase do balanço. Buracos de verdade a partir daqui, sempre com cipó.
     Caminho: lago raso → abismo com 1 cipó → gaiola da Mel → escalada até a rota alta (opcional) →
              abismo com 2 cipós → gaiola da Noz → FUGA: ponte de corda, lago, mais cipós, até o caminhão.
     Missão: soltar Mel e Noz (tabefe na gaiola) e fugir da gangue até o caminhão.
     Segredos: fundo do primeiro lago, fim da rota alta, topo do segundo balanço.
     Ritmo: aquecimento → salto de fé (cipó) → respiro (gaiola) → exploração (alto) → pico (2 cipós) → corrida. */
  function stage2() {
    const B = builder(2), X = B.X, lv = B.lv;
    B.run(15, 13); B.line(X(6), 392, 6, 40);
    const p1 = B.pool(8, 13, 3); B.line(X(p1 + 1), 404, 6, 36); B.secret(X(p1 + 6), 488, 'fundo do lago');
    const c1 = B.run(14, 13); B.enemy('ant', c1 + 3, c1 + 9); B.cp(c1 + 11);
    const g1 = B.gap(10);                                             // 37..46 abismo com cipó
    B.vine(X(g1 + 3) + 16, 100, 210);
    B.arc(X(g1) - 10, 340, X(g1 + 10), 330, 6, 60);
    const c2 = B.run(14, 12); B.line(X(c2 + 2), 360, 4, 36);          // 47..60 gaiola da Mel
    const cage1 = { x: X(c2 + 8) + 16, foot: B.top(c2 + 8) };
    const c3 = B.run(12, 11);                                         // 61..72
    B.rope(X(c3 + 9) + 16, 150, 312);
    B.plat(X(c3 + 10) + 8, 200, 5 * T); B.line(X(c3 + 11), 176, 3, 32, { opt: true });
    B.vine(X(c3 + 18) + 16, 30, 170);
    B.plat(X(c3 + 22), 200, 6 * T); B.line(X(c3 + 22) + 20, 176, 3, 36, { opt: true }); B.secret(X(c3 + 27), 170, 'rota alta');
    const c4 = B.run(8, 11); B.enemy('hopper', c4 + 1, c4 + 6);      // 73..80
    B.gap(4); B.arc(X(81), 330, X(85), 330, 3, 40);                   // 81..84
    const c5 = B.run(12, 11); B.enemy('toad', c5 + 8, c5 + 8); B.cp(c5 + 4);
    const g2 = B.gap(14);                                             // 97..110 abismo com dois cipós
    B.vine(X(g2 + 3) + 16, 90, 210); B.vine(X(g2 + 9) + 16, 90, 210);
    B.arc(X(g2) - 10, 320, X(g2 + 14), 340, 9, 70);
    B.secret(X(g2 + 12), 130, 'topo do balanço');
    const c6 = B.run(14, 12);                                         // 111..124 gaiola da Noz
    const cage2 = { x: X(c6 + 7) + 16, foot: B.top(c6 + 7) };
    // ---- fuga
    const c7 = B.run(12, 12); B.line(X(c7 + 2), 360, 5, 40);
    const g3 = B.gap(7); B.bridge('rope', X(g3), X(g3 + 7), 384); B.line(X(g3) + 20, 360, 6, 36);
    const c8 = B.run(8, 12); B.enemy('wasp', c8 + 1, c8 + 6);
    const p2 = B.pool(6, 12, 3); B.line(X(p2 + 1), 372, 4, 36);
    B.run(12, 12);
    B.run(6, 13);
    const g4 = B.gap(9); B.vine(X(g4 + 3) + 16, 100, 210); B.arc(X(g4) - 10, 340, X(g4 + 9), 330, 6, 60);
    B.finish(13);
    lv.mission = { cages: [cage1, cage2], escapeEnd: lv.goal ? lv.goal.x - 320 : 0 };
    return B.done();
  }

  /* ================================================================ FASE 4 · Hora Azul
     Tema: estrada no escuro; o Rei abre caminho para o caminhão do Gambá.
     Caminho: o caminhão só anda com o lampião à frente aceso e a estrada inteira: ponte levadiça sobre o lago
              (alavanca do outro lado: nade ou salte), ponte levadiça com alavanca no alto (cipó de escalar),
              ponte de corda sobre lago fundo, tronco seco para derrubar.
     Missão: acender os 5 lampiões e manter a estrada livre até o caminhão chegar.
     Segredos: copa acima da 1ª alavanca, fundo do lago grande, galho alto antes do tronco.
     Ritmo: guiar (lento) → quebra-cabeça → emboscada (lampião 2) → guiar → quebra-cabeça → emboscada → fim. */
  function stage3() {
    const B = builder(3), X = B.X, lv = B.lv;
    B.run(26, 13); B.line(X(12), 392, 6, 40);
    const p1 = B.pool(6, 13, 3);                                      // 26..31 lago sob a ponte levadiça
    B.bridge('draw', X(p1), X(p1 + 6), 416, { x: X(p1 + 8) + 16, y: 416 });
    B.line(X(p1 + 1), 470, 4, 36);
    const c1 = B.run(26, 13); B.enemy('ant', c1 + 12, c1 + 18);       // 32..57
    B.cp(c1 + 2);
    B.rope(X(c1 + 4) + 16, 170, 376); B.plat(X(c1 + 5) + 8, 230, 4 * T); B.secret(X(c1 + 7), 200, 'copa');
    const c2 = B.run(14, 13);                                         // 58..71
    B.rope(X(c2 + 8) + 16, 190, 376); B.plat(X(c2 + 9) + 8, 250, 4 * T); B.line(X(c2 + 9) + 16, 226, 2, 32);
    const g1 = B.gap(8);                                              // 72..79 ponte levadiça (alavanca no alto)
    B.bridge('draw', X(g1), X(g1 + 8), 416, { x: X(c2 + 12), y: 250 });
    const c3 = B.run(22, 13); B.enemy('beetle', c3 + 9, c3 + 15); B.line(X(c3 + 2), 392, 5, 40);   // 80..101
    const p2 = B.pool(12, 13, 3);                                     // 102..113 ponte de corda sobre o lago
    B.bridge('rope', X(p2), X(p2 + 12), 416); B.line(X(p2 + 2), 470, 6, 36); B.secret(X(p2 + 10), 488, 'fundo do lago');
    const c4 = B.run(28, 13); B.enemy('ant', c4 + 14, c4 + 20);       // 114..141
    B.cp(c4 + 3);
    B.plat(X(c4 + 22), 290, 4 * T); B.secret(X(c4 + 24), 262, 'galho alto');
    const g2 = B.gap(6);                                              // 142..147 tronco seco
    B.bridge('log', X(g2), X(g2 + 6), 416);
    const c5 = B.run(22, 13); B.enemy('hopper', c5 + 10, c5 + 16);
    B.finish(13);
    lv.mission = { lamps: [X(14), X(44), X(88), X(124), X(158)], ambush: [1, 3] };
    return B.done();
  }

  /* ================================================================ FASE 5 · Festival Sob a Lua
     Tema: o festival do Barão; lanternas, jangadas e andaimes de palco.
     Caminho: lago das lanternas (2 jangadas ou cipós) → bichos → abismo com cipós → andaime alto (opcional) →
              tronco seco → lago com jangada → arena do palco: duelo com o Barão Urso → caminhão.
     Missão: derrotar o Barão no palco.
     Segredos: lanterna mais alta do lago, topo do andaime, fundo do último lago.
     Ritmo: encantamento → ação → salto → exploração → quebra-cabeça → respiro → chefe. */
  function stage4() {
    const B = builder(4), X = B.X, lv = B.lv;
    B.run(15, 13); B.line(X(6), 392, 6, 40);
    const p1 = B.pool(20, 13, 3);                                     // 15..34 lago das lanternas
    B.raft(X(p1) + 8, X(p1 + 11), 426, 96, 50); B.raft(X(p1 + 9), X(p1 + 20) - 8, 426, 96, 64);
    B.vine(X(p1 + 6) + 16, 110, 190); B.vine(X(p1 + 14) + 16, 110, 190);
    B.line(X(p1 + 2), 390, 8, 40); B.line(X(p1 + 11), 390, 7, 40);
    B.secret(X(p1 + 10), 150, 'lanterna alta');
    for (let k = 0; k < 6; k++) B.lantern(X(p1 + 2 + k * 3), 60 + (k % 2) * 20, 50 + (k % 3) * 16, k % 3);
    const c1 = B.run(14, 13); B.enemy('wasp', c1 + 2, c1 + 8); B.enemy('toad', c1 + 11, c1 + 11);   // 35..48
    const g1 = B.gap(10); B.vine(X(g1 + 3) + 16, 100, 210); B.vine(X(g1 + 7) + 16, 100, 210);       // 49..58
    B.arc(X(g1) - 10, 340, X(g1 + 10), 330, 7, 70);
    const c2 = B.run(14, 12); B.cp(c2 + 3);                           // 59..72 andaime
    B.rope(X(c2 + 8) + 16, 130, 344); B.plat(X(c2 + 9) + 8, 190, 4 * T); B.line(X(c2 + 9) + 16, 166, 3, 30, { opt: true });
    B.secret(X(c2 + 12), 160, 'topo do andaime');
    const g2 = B.gap(7); B.bridge('log', X(g2), X(g2 + 7), 384);     // 73..79
    const c3 = B.run(18, 12); B.enemy('beetle', c3 + 3, c3 + 8); B.enemy('ant', c3 + 11, c3 + 16);  // 80..97
    const p2 = B.pool(9, 12, 4); B.raft(X(p2) + 8, X(p2 + 9) - 8, 394, 96, 58);                     // 98..106
    B.line(X(p2 + 2), 360, 5, 40); B.secret(X(p2 + 8), 488, 'fundo do lago');
    const c4 = B.run(8, 12); B.cp(c4 + 3);                            // 107..114
    B.run(2, 13);
    // arena do palco: 34 colunas planas antes do caminhão (o Barão aparece quando o Rei chega perto)
    const c5 = B.run(22, 13);
    for (let k = 0; k < 5; k++) B.lantern(X(c5 + 2 + k * 4), 70, 40 + (k % 2) * 20, k % 3);
    B.finish(13);
    lv.mission = { boss: true };
    return B.done();
  }

  const STAGES = [stage0, stage1, stage2, stage3, stage4];
  const cache = {};
  function build(index) {
    index = Math.max(0, Math.min(STAGES.length - 1, index | 0));
    // cópia nova a cada carga: o jogo muda plataformas (pontes, galhos que caem) durante a partida
    if (!cache[index]) cache[index] = JSON.stringify(STAGES[index]());
    return JSON.parse(cache[index]);
  }

  RC.LevelGen = { T, NAMES, build, count: STAGES.length, stages: STAGES };
  if (typeof module !== 'undefined') module.exports = RC.LevelGen;
})(typeof window !== 'undefined' ? window : globalThis);
