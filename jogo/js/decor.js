/* Rei da Castanha: decoração por aglomerados (módulo plugado: game.js chama RC.placeDecor).
   Regras: tudo nasce sobre chão/galho (nada flutua), em manchas e não em ruído uniforme; a
   camada da frente (z=1) nunca cobre inimigos, caixotes, molas, lampiões ou o caminhão. */
(function () {
  'use strict';
  const RC = window.RC;
  const T = 32;

  RC.placeDecor = function (lv, rnd, fallback) {
    if (!lv || !lv.ground) return fallback;
    const M = lv.mood, noise = RC.makeNoise((lv.genSeed || 1) * 31 + 7);
    const out = [];
    const taken = [];                       // [x, z] já ocupados, para não empilhar
    const keepOut = [];                     // faixas onde a frente fica limpa
    for (const e of lv.enemies) keepOut.push([e.left - 30, e.right + 30]);
    for (const p of lv.props || []) keepOut.push([p.x - 40, p.x + 40]);
    for (const c of lv.checkpoints) keepOut.push([c.x - 46, c.x + 46]);
    keepOut.push([lv.start.x + 250, lv.start.x + 350], [lv.goal.x - 60, lv.goal.x + 260], [lv.start.x - 40, lv.start.x + 40]);
    const blocked = (x) => keepOut.some((k) => x > k[0] && x < k[1]);
    const crowded = (x, z, r) => taken.some((t) => t[1] === z && Math.abs(t[0] - x) < r);
    const add = (it, r) => { if (crowded(it.x, it.z, r || 9)) return false; taken.push([it.x, it.z]); out.push(it); return true; };
    const tuft = () => `tuft_${M}_${Math.floor(rnd() * 6)}`;

    // percorre trechos contínuos de chão
    for (let c = 0; c < lv.cols;) {
      if (lv.ground[c] < 0) { c++; continue; }
      let e = c; while (e + 1 < lv.cols && lv.ground[e + 1] === lv.ground[c]) e++;
      const y = lv.ground[c] * T, x0 = c * T + 7, x1 = (e + 1) * T - 7;
      c = e + 1;
      if (x1 - x0 < 24) continue;
      // manchas de grama: centros com densidade vinda de ruído
      for (let x = x0; x < x1; x += 11) {
        const dens = noise.fbm(x * 0.012, 1.7, 3);
        if (rnd() < 0.16 + dens * 0.78) {
          const tx = x + rnd() * 8, z = (!blocked(tx - 6) && !blocked(tx + 6) && rnd() < 0.42) ? 1 : 0;
          add({ kind: 'tuft', name: tuft(), x: tx, y: y + 1, ph: rnd() * 6.28, z }, 9);
        }
      }
      // flores em canteiros pequenos
      const patches = Math.floor((x1 - x0) / 170);
      for (let k = 0; k < patches; k++) {
        if (rnd() < 0.55) continue;
        const px = x0 + 20 + rnd() * (x1 - x0 - 40), n = 2 + Math.floor(rnd() * 3), f0 = Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          const fx = px + (i - n / 2) * 14 + rnd() * 6;
          if (fx > x0 && fx < x1 && !blocked(fx)) add({ kind: 'flower', name: `flower_${rnd() < 0.7 ? f0 : Math.floor(rnd() * 4)}`, x: fx, y: y + 1, ph: rnd() * 6, z: 0 }, 11);
        }
      }
      // cogumelos em rodas (grupos de 2 a 3), longe do início
      if (x0 > 360) {
        const rings = Math.floor((x1 - x0) / 240);
        for (let k = 0; k < rings; k++) {
          if (rnd() < 0.5) continue;
          const px = x0 + 24 + rnd() * (x1 - x0 - 48), n = 2 + Math.floor(rnd() * 2);
          for (let i = 0; i < n; i++) {
            const mx = px + i * 22 + rnd() * 6;
            if (mx > x1 || blocked(mx)) continue;
            const name = M >= 3 ? `mush_${1 + Math.floor(rnd() * 2)}` : (rnd() < 0.3 ? 'mush_2' : 'mush_0');
            add({ kind: 'mush', name, x: mx, y: y + 2, ph: 0, z: 0, glow: M >= 3 }, 20);
          }
        }
      }
      // gravetos ao fundo, esparsos
      for (let x = x0 + 30; x < x1 - 30; x += 90 + rnd() * 120) {
        if (rnd() < 0.55) add({ kind: 'twig', name: `twig_${1 + Math.floor(rnd() * 2)}`, x, y: y + 4, ph: rnd() * 6, z: 0, flip: rnd() < 0.5 ? -1 : 1 }, 40);
      }
    }

    // galhos: tufos na borda superior e gravetos, só dentro da largura do galho
    for (const p of lv.platforms) {
      if (p.crumble) continue;
      const n = Math.max(1, Math.floor(p.w / 28));
      for (let k = 0; k < n; k++) {
        if (rnd() < 0.35) continue;
        const x = p.x + 8 + rnd() * (p.w - 16);
        add({ kind: 'tuft', name: tuft(), x, y: p.y + 4, ph: rnd() * 6, z: 1 }, 12);
      }
      if (p.w >= 64 && rnd() < 0.4) add({ kind: 'twig', name: `twig_${1 + Math.floor(rnd() * 2)}`, x: p.x + p.w * (0.25 + rnd() * 0.5), y: p.y + 6, ph: rnd() * 6, z: 0, flip: rnd() < 0.5 ? -1 : 1 }, 30);
    }
    return out;
  };
})();
