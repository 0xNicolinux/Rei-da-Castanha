/* Rei da Castanha — arte: humores de iluminação, atlas de sprites, normal maps gerados,
   props procedurais (coroa, caminhão, lanternas, plantas) em pixel-art. */
(function () {
  'use strict';
  const RC = window.RC;
  const { clamp, lerp } = RC;

  /* ======================= HUMORES (hora do dia por fase) ======================= */
  const lin = RC.hexLin, hex = RC.hex;
  function mood(o) {
    const m = Object.assign({}, o);
    m.skyTop = lin(o.sky[0]); m.skyMid = lin(o.sky[1]); m.skyLow = lin(o.sky[2]);
    m.sunDisc = lin(o.sunDisc); m.cloudCol = lin(o.cloud); m.fog = lin(o.fog); m.mistCol = lin(o.mist || o.fog);
    m.ambient = lin(o.ambient).map((v) => v * o.ambK);
    m.sunCol = lin(o.sunLight).map((v) => v * o.sunK);
    m.rayCol = lin(o.ray);
    const sx = o.sunPos[0], sy = o.sunPos[1];
    const L = [(sx - 0.5) * 1.5, (sy - 0.5) * 1.3 - 0.5, 0.85];
    const n = Math.hypot(L[0], L[1], L[2]);
    m.sunDir = L.map((v) => v / n);
    m.gradeShadow = o.gradeShadow; m.gradeHigh = o.gradeHigh;
    m.fDark = lin(o.fDark); m.fLight = lin(o.fLight);
    m.mtnDark = lin(o.mtn[0]); m.mtnLight = lin(o.mtn[1]);
    m.lanternK = o.lanternK || 0;
    return m;
  }

  RC.MOODS = [
    mood({ // 0 — amanhecer dourado
      id: 'amanhecer', sky: ['#4d6fae', '#f0b080', '#ffe0a8'], sunDisc: '#fff0c8', cloud: '#ffd9b0', fog: '#f2c79a', mist: '#ffd8a8',
      sunPos: [0.74, 0.50], sunSize: 0.045, moon: false, stars: 0, clouds: 0.8,
      ambient: '#7b78a0', ambK: 0.5, sunLight: '#ffcf8c', sunK: 1.1, ray: '#ffcc88',
      exposure: 1.0, contrast: 1.06, sat: 1.12, gradeShadow: [0.92, 0.95, 1.12], gradeHigh: [1.1, 1.0, 0.86],
      bloom: 0.52, bloomThr: 0.78, rays: 1.1, vignette: 0.34, grain: 0.028, depthBlur: 0.7,
      fDark: '#2b3f38', fLight: '#9aa86a', mtn: ['#6f6c98', '#f0b99c'],
      grass: ['#1a3a28', '#27602f', '#3f8a37', '#6bb348', '#a8d65e', '#e2f394'],
      fireflies: 0.15, leaves: 0.5, lanternK: 0.15, haze: 0.5
    }),
    mood({ // 1 — meio-dia, mata fechada
      id: 'mata', sky: ['#3a86cf', '#86c8e8', '#dff0c4'], sunDisc: '#fffbe0', cloud: '#ffffff', fog: '#bfe2c4', mist: '#d4efd0',
      sunPos: [0.30, 0.16], sunSize: 0.04, moon: false, stars: 0, clouds: 0.9,
      ambient: '#86a8a0', ambK: 0.5, sunLight: '#fff2c4', sunK: 0.95, ray: '#fff0b8',
      exposure: 1.0, contrast: 1.07, sat: 1.18, gradeShadow: [0.9, 1.0, 1.08], gradeHigh: [1.06, 1.04, 0.92],
      bloom: 0.42, bloomThr: 0.82, rays: 1.45, vignette: 0.3, grain: 0.024, depthBlur: 0.65,
      fDark: '#1c3d33', fLight: '#7fb865', mtn: ['#4f7ea0', '#a9d6dd'],
      grass: ['#16402a', '#23702f', '#3a9a3a', '#66c452', '#a2e069', '#e6fba0'],
      fireflies: 0, leaves: 0.8, lanternK: 0, haze: 0.45
    }),
    mood({ // 2 — entardecer magenta
      id: 'entardecer', sky: ['#30245f', '#d4507a', '#ffb067'], sunDisc: '#ffe2a0', cloud: '#ff9a7a', fog: '#e58478', mist: '#ff9d86',
      sunPos: [0.27, 0.58], sunSize: 0.075, moon: false, stars: 0.15, clouds: 0.95,
      ambient: '#7c5c92', ambK: 0.55, sunLight: '#ff9a52', sunK: 1.75, ray: '#ff9060',
      exposure: 1.1, contrast: 1.08, sat: 1.15, gradeShadow: [0.95, 0.88, 1.18], gradeHigh: [1.14, 0.98, 0.82],
      bloom: 0.58, bloomThr: 0.74, rays: 1.5, vignette: 0.38, grain: 0.03, depthBlur: 0.75,
      fDark: '#2a2447', fLight: '#c26a62', mtn: ['#5a3f78', '#e87d80'],
      grass: ['#1c3326', '#2c5a2e', '#4b8030', '#7fa83c', '#c0c452', '#f3e48a'],
      fireflies: 0.3, leaves: 0.7, lanternK: 0.5, haze: 0.5
    }),
    mood({ // 3 — hora azul, vaga-lumes
      id: 'horaazul', sky: ['#101745', '#3a4c96', '#9486bd'], sunDisc: '#e8eeff', cloud: '#7e86c4', fog: '#5a69a6', mist: '#7482be',
      sunPos: [0.70, 0.22], sunSize: 0.03, moon: true, stars: 0.7, clouds: 0.6,
      ambient: '#5568a8', ambK: 0.62, sunLight: '#9db2ff', sunK: 0.85, ray: '#9aaeff',
      exposure: 1.12, contrast: 1.08, sat: 1.1, gradeShadow: [0.9, 0.96, 1.22], gradeHigh: [1.0, 1.0, 1.12],
      bloom: 0.7, bloomThr: 0.68, rays: 0.9, vignette: 0.42, grain: 0.034, depthBlur: 0.8,
      fDark: '#141c44', fLight: '#5a6cb0', mtn: ['#2a3170', '#6a76b8'],
      grass: ['#10263a', '#1a4a50', '#2a6c58', '#4a9a6a', '#7cc686', '#b6eca0'],
      fireflies: 1, leaves: 0.3, lanternK: 1.0, haze: 0.5
    }),
    mood({ // 4 — noite de lua, lanternas
      id: 'noite', sky: ['#050816', '#101c46', '#26386f'], sunDisc: '#f2f5ff', cloud: '#4b5ba0', fog: '#1d2c5c', mist: '#2c3f80',
      sunPos: [0.58, 0.26], sunSize: 0.052, moon: true, stars: 1, clouds: 0.45,
      ambient: '#3f56a0', ambK: 0.58, sunLight: '#a9bcff', sunK: 0.95, ray: '#8aa4ff',
      exposure: 1.18, contrast: 1.1, sat: 1.08, gradeShadow: [0.88, 0.95, 1.28], gradeHigh: [1.02, 1.02, 1.14],
      bloom: 0.82, bloomThr: 0.62, rays: 1.0, vignette: 0.46, grain: 0.038, depthBlur: 0.85,
      fDark: '#0b1030', fLight: '#3c4f94', mtn: ['#151c50', '#4a5aa6'],
      grass: ['#0e2236', '#173f48', '#25604e', '#3f8a5c', '#6ab27a', '#a2dc98'],
      fireflies: 0.9, leaves: 0.2, lanternK: 1.5, haze: 0.45
    })
  ];

  /* ======================= UTILITÁRIOS DE CANVAS ======================= */
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  RC.cv = cv;

  /* Normal map a partir do relevo (alfa suavizado + luminância). */
  function normalFrom(src, strength, lumW) {
    const w = src.width, h = src.height;
    const sctx = src.getContext('2d');
    const img = sctx.getImageData(0, 0, w, h).data;
    const A = new Float32Array(w * h), Hh = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) A[i] = img[i * 4 + 3] / 255;
    // blur do alfa (2 passes de caixa) para o contorno "inflar"
    const tmp = new Float32Array(w * h), B = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      const from = pass === 0 ? A : B;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += from[y * w + xx]; n++; } }
        tmp[y * w + x] = s / n;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let k = -2; k <= 2; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
        B[y * w + x] = s / n;
      }
    }
    const lw = lumW === undefined ? 2.2 : lumW;
    for (let i = 0; i < w * h; i++) {
      const lum = (0.3 * img[i * 4] + 0.59 * img[i * 4 + 1] + 0.11 * img[i * 4 + 2]) / 255;
      Hh[i] = B[i] * 7 + lum * lw * A[i];
    }
    const out = cv(w, h), octx = out.getContext('2d');
    const od = octx.createImageData(w, h), o = od.data;
    const k = strength || 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(h - 1, y + 1);
      const dx = (Hh[y * w + xp] - Hh[y * w + xm]) * k, dy = (Hh[yp * w + x] - Hh[ym * w + x]) * k;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = img[i + 3];
    }
    octx.putImageData(od, 0, 0);
    return out;
  }
  RC.normalFrom = normalFrom;

  /* Normal map a partir de um campo de alturas já calculado (terreno / galhos). */
  RC.normalFromHeight = function (Hh, w, h, alphaSrc, k) {
    const out = cv(w, h), octx = out.getContext('2d');
    const od = octx.createImageData(w, h), o = od.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(h - 1, y + 1);
      const dx = (Hh[y * w + xp] - Hh[y * w + xm]) * k, dy = (Hh[yp * w + x] - Hh[ym * w + x]) * k;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = alphaSrc ? alphaSrc[y * w + x] : 255;
    }
    octx.putImageData(od, 0, 0);
    return out;
  };

  /* ======================= SPRITES PIXEL-ART PROCEDURAIS ======================= */
  function fromAscii(rows, pal) {
    const h = rows.length, w = rows[0].length, c = cv(w, h), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
    }
    return c;
  }

  function makeCrown() {
    const rows = [
      '.K...K...K.',
      'KLK.KLK.KLK',
      'KYKKKYKKKYK',
      'KYYYLYLYYYK',
      'KYRYYYYYBYK',
      'KYYYYYYYYYK',
      'KDDDDDDDDDK',
      '.KKKKKKKKK.'
    ];
    return fromAscii(rows, { K: '#4f1507', Y: '#ffc931', L: '#fff0a0', D: '#c9801a', R: '#ff3b4f', B: '#37b6ff' });
  }

  function makeLantern(on) {
    const rows = [
      '....KKKK....',
      '...KSSSSK...',
      '..KSKKKKSK..',
      '..KSOOOOSK..',
      '..KSOYYOSK..',
      '..KSOYWYOSK.',
      '..KSOYYOSK..',
      '..KSOOOOSK..',
      '..KSKKKKSK..',
      '...KSSSSK...',
      '....KKKK....'
    ];
    const pal = on
      ? { K: '#3a1a0a', S: '#8a5a2a', O: '#ffb23a', Y: '#ffe27a', W: '#ffffff' }
      : { K: '#2a1508', S: '#5e4125', O: '#57402a', Y: '#6e5233', W: '#7a5c3c' };
    return fromAscii(rows.map((r) => r.slice(0, 12).padEnd(12, '.')), pal);
  }

  function makePost() {
    const c = cv(14, 44), x = c.getContext('2d');
    const px = (xx, yy, w, h, col) => { x.fillStyle = col; x.fillRect(xx, yy, w, h); };
    px(5, 8, 4, 36, '#4f2a17'); px(6, 8, 2, 36, '#8a4e2a'); px(5, 8, 1, 36, '#321a0e'); px(8, 8, 1, 36, '#36200f');
    px(2, 40, 10, 4, '#3a2112'); px(3, 40, 8, 2, '#6a3d22');
    px(3, 8, 8, 2, '#321a0e'); px(4, 8, 6, 1, '#8a4e2a');
    // gancho
    px(6, 4, 2, 5, '#2a1508');
    return c;
  }

  function makeTuft(rnd, pal) {
    const w = 10 + Math.floor(rnd() * 5), h = 6 + Math.floor(rnd() * 5), c = cv(w, h), x = c.getContext('2d');
    const blades = 3 + Math.floor(rnd() * 3);
    for (let b = 0; b < blades; b++) {
      const bx = 1 + Math.floor(rnd() * (w - 2)), bh = 3 + Math.floor(rnd() * (h - 2));
      const lean = (rnd() - 0.5) * 2.2;
      for (let j = 0; j < bh; j++) {
        const xx = Math.round(bx + lean * (j / bh) * 2);
        x.fillStyle = pal[clamp(1 + Math.floor((j / bh) * 4), 1, 5)];
        x.fillRect(clamp(xx, 0, w - 1), h - 1 - j, 1, 1);
      }
      x.fillStyle = pal[0]; x.fillRect(bx, h - 1, 1, 1);
    }
    return c;
  }

  function makeFlower(rnd, petal, center) {
    const c = cv(7, 11), x = c.getContext('2d');
    x.fillStyle = '#2a6b2e'; x.fillRect(3, 5, 1, 6);
    x.fillStyle = '#44a043'; x.fillRect(2, 8, 1, 1); x.fillRect(4, 7, 1, 1);
    x.fillStyle = petal;
    [[3, 1], [2, 2], [4, 2], [3, 3], [1, 3], [5, 3]].forEach(([a, b]) => x.fillRect(a, b, 1, 1));
    x.fillRect(2, 3, 1, 1); x.fillRect(4, 3, 1, 1);
    x.fillStyle = center; x.fillRect(3, 2, 1, 1);
    return c;
  }

  function makeMushroom(cap, spot) {
    const rows = [
      '...KKKKK...',
      '..KCCCCCK..',
      '.KCCSCCCCK.',
      '.KCCCCSCCK.',
      'KCSCCCCCCCK',
      'KKKKKKKKKKK',
      '...KWWWK...',
      '...KWWWK...',
      '...KKKKK...'
    ];
    return fromAscii(rows, { K: '#241018', C: cap, S: spot, W: '#e8d8b8' });
  }

  function makeLeaf(col, dark) {
    const rows = ['..KK...', '.KCCK..', 'KCCDCK.', '.KCCCCK', '..KKKK.'];
    return fromAscii(rows, { K: dark, C: col, D: dark });
  }

  function makeGlow() {
    const c = cv(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  }

  function makeShaft() {
    const c = cv(64, 256), x = c.getContext('2d');
    const gx = x.createLinearGradient(0, 0, 64, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gx; x.fillRect(0, 0, 64, 256);
    x.globalCompositeOperation = 'destination-in';
    const gy = x.createLinearGradient(0, 0, 0, 256);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.15, 'rgba(0,0,0,.9)'); gy.addColorStop(0.7, 'rgba(0,0,0,.45)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gy; x.fillRect(0, 0, 64, 256);
    return c;
  }

  function makeDot() {
    const c = cv(4, 4), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4);
    return c;
  }

  /* Caminhão da Castanha 2 Irmãs — pixel-art desenhada por código */
  function makeTruck() {
    const W = 76, H = 46, c = cv(W, H), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const OUT = '#3b1608';
    // sombra de baixo da carroceria
    R(2, 33, 72, 4, OUT);
    // baú (carga)
    R(1, 4, 48, 31, OUT);
    R(2, 5, 46, 29, '#e0a032');
    R(2, 5, 46, 3, '#f5c65a'); R(2, 8, 46, 1, '#f8dc8a');
    R(2, 30, 46, 4, '#b9701c'); R(2, 28, 46, 2, '#c98424');
    for (let i = 0; i < 5; i++) R(10 + i * 9, 9, 1, 19, '#c98424');
    // faixa com nome
    R(5, 11, 40, 14, OUT); R(6, 12, 38, 12, '#2c6b3a'); R(6, 12, 38, 2, '#3f8a4d'); R(6, 22, 38, 2, '#1d4a29');
    // texto
    const t = cv(40, 14), tx = t.getContext('2d');
    tx.fillStyle = '#fff3c4'; tx.textBaseline = 'top'; tx.textAlign = 'center';
    tx.font = '700 8px "Pixelify Sans", monospace'; tx.fillText('CASTANHA', 20, -1);
    tx.font = '700 7px "Pixelify Sans", monospace'; tx.fillText('2 IRMÃS', 20, 6);
    const td = tx.getImageData(0, 0, 40, 14);
    for (let i = 0; i < td.data.length; i += 4) td.data[i + 3] = td.data[i + 3] > 110 ? 255 : 0;
    tx.putImageData(td, 0, 0);
    x.drawImage(t, 5, 11);
    // castanha emblema
    R(3, 6, 3, 1, '#7b3f16'); R(3, 7, 3, 2, '#c4601e');
    // cabine
    R(49, 12, 26, 23, OUT);
    R(50, 13, 24, 21, '#d9552f'); R(50, 13, 24, 3, '#f08050'); R(50, 30, 24, 4, '#a33a1c');
    R(55, 8, 17, 6, OUT); R(56, 9, 15, 5, '#d9552f'); R(56, 9, 15, 2, '#f08050');
    // janela
    R(57, 14, 15, 10, OUT); R(58, 15, 13, 8, '#9fd8e8'); R(58, 15, 13, 3, '#d8f6ff'); R(65, 15, 1, 8, '#7fb8c8');
    R(58, 20, 13, 3, '#7ab8cc');
    // porta e maçaneta
    R(53, 17, 1, 14, '#a33a1c'); R(60, 26, 3, 1, OUT);
    // para-choque e farol
    R(72, 30, 4, 4, OUT); R(73, 31, 3, 2, '#c8c8d0');
    R(73, 25, 3, 4, OUT); R(74, 26, 2, 2, '#fff2a0');
    // rodas
    const wheel = (cx) => {
      R(cx - 7, 31, 15, 15, OUT); R(cx - 6, 32, 13, 13, '#22252b'); R(cx - 5, 33, 11, 11, '#31353d');
      R(cx - 3, 35, 7, 7, '#c9b690'); R(cx - 2, 36, 5, 5, '#e6d4a8'); R(cx - 1, 37, 3, 3, '#6b5a3a');
    };
    wheel(14); wheel(38); wheel(63);
    return c;
  }

  /* ======================= SPRITES NOVOS: INIMIGOS, NPCs E ITENS (pixel-art por código) =======================
     Todos desenhados olhando para a ESQUERDA, âncora = centro-inferior do quadro (exceto onde indicado em js/enemies.js).
     Caixa de ferramentas: elipses sombreadas em faixas (estilo posterizado), polígonos, linhas e contorno automático. */
  const h2r = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const r2h = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  /* rampa escuro -> claro (sombras esfriam, luzes esquentam) */
  function ramp(h) {
    const [r, g, b] = h2r(h);
    return [r2h(r * 0.48, g * 0.5, b * 0.6 + 16), r2h(r * 0.75, g * 0.77, b * 0.84 + 6), h, r2h(r + (255 - r) * 0.34, g + (255 - g) * 0.3, b + (255 - b) * 0.2)];
  }
  function mixHex(a, b, t) { const A = h2r(a), B = h2r(b); return r2h(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  const rampMix = (pal, to, t) => pal.map((c) => mixHex(c, to, t));

  function toolkit(w, h) {
    const c = cv(w, h), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const T = { c, x, w, h };
    T.px = (a, b, col) => { a = Math.round(a); b = Math.round(b); if (a < 0 || b < 0 || a >= w || b >= h) return; x.fillStyle = col; x.fillRect(a, b, 1, 1); };
    T.rect = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), ww, hh); };
    T.line = (x0, y0, x1, y1, col, th) => {
      th = th || 1; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        x.fillStyle = col; x.fillRect(x0 - (th > 1 ? 1 : 0), y0 - (th > 1 ? 1 : 0), th, th);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    };
    T.poly = (pts, col) => {
      let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
      for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
      for (let yy = Math.floor(y0); yy <= Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx <= Math.ceil(x1); xx++) {
        const px = xx + 0.5, py = yy + 0.5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i], b = pts[j];
          if ((a[1] > py) !== (b[1] > py) && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]) ins = !ins;
        }
        if (ins) T.px(xx, yy, typeof col === 'function' ? col(xx, yy) : col);
      }
    };
    /* elipse (rotacionável) com sombreamento posterizado; pal = string (chapado) ou rampa [escuro..claro] */
    T.ell = (cx, cy, rx, ry, pal, o) => {
      o = o || {};
      const ang = o.ang || 0, cs = Math.cos(ang), sn = Math.sin(ang), ext = Math.ceil(Math.max(rx, ry)) + 2, n = Array.isArray(pal) ? pal.length : 0;
      for (let yy = Math.floor(cy - ext); yy <= cy + ext; yy++) for (let xx = Math.floor(cx - ext); xx <= cx + ext; xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const dx = xx + 0.5 - cx, dy = yy + 0.5 - cy;
        const u = (dx * cs + dy * sn) / rx, v = (-dx * sn + dy * cs) / ry, d = u * u + v * v;
        if (d > 1) continue;
        let col, idx = 0;
        if (!n) col = pal;
        else {
          const sx = u * cs - v * sn, sy = u * sn + v * cs;
          const b = -(sx * 0.45 + sy * 0.8) * 0.75 + Math.sqrt(1 - d) * 0.35;
          idx = clamp(Math.floor(((b + 0.5) / 1.25) * n), 0, n - 1);
          col = pal[idx];
        }
        if (o.fn) { const f = o.fn(xx, yy, idx, u, v); if (f === false) continue; if (f) col = f; }
        T.px(xx, yy, col);
      }
    };
    return T;
  }

  /* contorno de 1px (pixels transparentes vizinhos de opacos) */
  function outline(c, col, thr) {
    const w = c.width, h = c.height, x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data, src = new Uint8ClampedArray(d);
    const rgb = h2r(col), T0 = thr || 140;
    const A = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : src[(j * w + i) * 4 + 3]);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (A(i, j) >= 60) continue;
      if (A(i - 1, j) >= T0 || A(i + 1, j) >= T0 || A(i, j - 1) >= T0 || A(i, j + 1) >= T0) {
        const k = (j * w + i) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
      }
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  const flipV = (c) => { const o = cv(c.width, c.height), x = o.getContext('2d'); x.translate(0, c.height); x.scale(1, -1); x.drawImage(c, 0, 0); return o; };

  /* transformação de pose: achata/estica a partir do chão, inclina e levanta */
  function rig(T, ground, p) {
    const sq = p.sq || 1, dy = p.dy || 0, lean = p.lean || 0, k = 1 / Math.sqrt(sq);
    const X = (cx, cy) => cx + lean * ((ground - cy) / ground);
    const Y = (cy) => ground - (ground - cy) * sq - dy;
    return {
      X, Y,
      ell: (cx, cy, rx, ry, pal, o) => T.ell(X(cx, cy), Y(cy), rx * k, ry * sq, pal, o),
      line: (x0, y0, x1, y1, col, th) => T.line(X(x0, y0), Y(y0), X(x1, y1), Y(y1), col, th),
      poly: (pts, col) => T.poly(pts.map((q) => [X(q[0], q[1]), Y(q[1])]), col),
      px: (a, b, col) => T.px(X(a, b), Y(b), col),
      rect: (a, b, ww, hh, col) => T.rect(X(a, b), Y(b), ww, hh, col)
    };
  }

  const OUTL = '#1d0f15';

  /* ---- vespa (voadora) 36x32: 4 quadros de bater de asas + ferroada + hurt ---- */
  function makeWasp(ph, mode) {
    const T = toolkit(38, 34), W = T.ell;
    const yel = ramp('#f2b928'), dk = ramp('#4a2b1a'), eye = ramp('#d8283a');
    const a = mode === 'hurt' ? 0.5 : [-1.15, -0.55, 0.25, -0.55][ph];
    const bob = mode === 'hurt' ? 0 : [0, 1, 0, -1][ph];
    const wing = (cx, cy, al) => { W(cx + Math.cos(a) * 7.5, cy + Math.sin(a) * 7.5, 8.5, 3.2, ['#a9c4de', '#cfe4f4', '#e8f4ff', '#ffffff'].map((c) => c), { ang: a, fn: (x, y, i) => (i < 1 ? '#8fb0d0' : null) }); };
    // asa de trás (mais escura) e da frente
    wing(19, 12 + bob, 0.6);
    // pernas
    for (let i = 0; i < 3; i++) T.line(14 + i * 3, 19 + bob, 12 + i * 3 + (ph % 2), 25 + bob, '#3a2012');
    // ferrão
    T.poly([[31, 19 + bob], [37, 24 + bob], [31, 22 + bob]], '#2c1a12'); T.px(37, 24 + bob, '#ff5a3a');
    // abdômen listrado
    W(26, 18 + bob, 8.5, 6, yel, { ang: 0.35, fn: (x, y, i) => ((Math.floor((x - 18) / 3) % 2 + 2) % 2 === 0 ? dk[Math.min(i + 0, 2)] : null) });
    // tórax peludo
    W(17, 15 + bob, 5.4, 5.4, dk);
    T.px(16, 12 + bob, dk[3]); T.px(18, 11 + bob, dk[3]);
    // cabeça
    W(9, 15 + bob, 6, 5.5, yel);
    // olho grande
    W(8, 14 + bob, 3, 3.6, eye);
    if (mode === 'hurt') { T.line(6, 12 + bob, 10, 16 + bob, '#fff', 1); T.line(10, 12 + bob, 6, 16 + bob, '#fff', 1); }
    else { T.px(7, 13 + bob, '#ffd0d0'); T.px(8, 15 + bob, '#5a0a14'); T.line(5, 11 + bob, 11, 13 + bob, OUTL); }
    // boca/mandíbula
    T.line(4, 19 + bob, 8, 20 + bob, '#3a2012');
    // antenas
    T.line(8, 10 + bob, 5, 4 + bob + (ph % 2), '#3a2012'); T.px(5, 3 + bob + (ph % 2), '#ffd84a');
    T.line(11, 10 + bob, 12, 4 + bob - (ph % 2), '#3a2012'); T.px(12, 3 + bob - (ph % 2), '#ffd84a');
    // asa da frente por cima do tórax
    W(17 + Math.cos(a) * 6, 11 + bob + Math.sin(a) * 6, 8, 3, ['#b8d2ea', '#dcecf8', '#f2faff', '#ffffff'], { ang: a, fn: (x, y, i) => (i < 1 ? '#9bbad6' : null) });
    return outline(T.c, OUTL);
  }

  /* ---- besouro blindado 52x40: andando (4), de barriga p/ cima (2), atordoado (1) ---- */
  function makeBeetle(mode, ph) {
    const T = toolkit(54, 40), W = T.ell;
    const sh = ramp('#3c63c4'), hd = ramp('#454a66'), bel = ramp('#d8c394');
    const LEG = '#1b1d33';
    if (mode === 'walk') {
      const bob = ph % 2 ? 0 : 1;
      for (let i = 0; i < 3; i++) {
        const lx = 17 + i * 9, up = (ph + i) % 2 ? 3 : 0, fx = ((ph + i) % 2 ? -3 : 2);
        T.line(lx, 28 + bob, lx + fx + 1, 38 - up, LEG, 2);
        T.rect(lx + fx - 1, 38 - up, 4, 2, LEG);
      }
      W(28, 29 + bob, 16, 5, ramp('#25283f'));
      W(29, 20 + bob, 18, 13.5, sh, { fn: (x, y, i, u, v) => {
        if (Math.abs(x - 30) < 1 && v < 0.5) return sh[0];                       // costura dos élitros
        if (i >= 2 && ((Math.round(x / 4) + Math.round(y / 4)) % 5 === 0) && y > 17 + bob) return sh[3];
        return null; } });
      // faixa de brilho metálico
      for (let k = 0; k < 7; k++) T.px(19 + k * 1.3, 13 + bob + Math.abs(k - 3) * 0.7, '#cfe0ff');
      T.px(33, 12 + bob, '#ffffff'); T.px(34, 12 + bob, '#cfe0ff');
      // rebites dourados
      [[22, 25], [37, 25], [27, 28], [33, 28]].forEach(([a, b]) => { T.px(a, b + bob, '#ffd23a'); T.px(a, b + bob + 1, '#a8741a'); });
      // cabeça + chifre
      W(10, 25 + bob, 7, 6, hd);
      T.poly([[9, 22 + bob], [3, 14 + bob], [1, 9 + bob], [5, 12 + bob], [12, 20 + bob]], '#c8ccdc'); T.line(4, 13 + bob, 2, 10 + bob, '#ffffff');
      W(8, 25 + bob, 2.6, 2.8, '#ffffff'); T.rect(6, 25 + bob, 2, 2, '#10101c'); T.line(5, 22 + bob, 11, 24 + bob, OUTL, 1);
      T.poly([[4, 30 + bob], [1, 34 + bob], [6, 32 + bob]], '#9aa0b8');
    } else {
      // de barriga p/ cima: casco embaixo, barriga clara + 6 perninhas balançando
      const wig = ph ? 1 : -1;
      W(28, 29, 17, 9, sh, { fn: (x, y, i) => (i >= 2 && (x % 6 === 0) ? sh[1] : null) });
      T.line(14, 32, 42, 32, sh[0]);
      W(28, 21, 15, 7.5, bel, { fn: (x, y, i) => ((y - 12) % 3 === 0 && i < 3 ? bel[1] : null) });
      for (let i = 0; i < 3; i++) {
        const lx = 19 + i * 7;
        T.line(lx, 18, lx - 3 + wig * (i % 2 ? 1 : -1) * 2, 6 + (i % 2) * 2, LEG, 2);
        T.line(lx + 6, 18, lx + 8 - wig * 2, 5 + ((i + 1) % 2) * 2, LEG, 2);
      }
      W(10, 24, 6.5, 5.5, hd);
      T.poly([[8, 28], [3, 33], [1, 36], [5, 34], [11, 29]], '#c8ccdc');
      // olhos em espiral (tonto)
      T.px(7, 23, '#fff'); T.px(8, 22, '#fff'); T.px(9, 23, '#fff'); T.px(8, 24, '#fff'); T.px(8, 23, '#10101c');
      T.line(11, 28, 14, 29, '#10101c');
    }
    return outline(T.c, OUTL);
  }

  /* ---- sapo cuspidor 44x36 ---- */
  function makeToad(ph, puff, open, hurt) {
    const T = toolkit(46, 36), W = T.ell;
    const heat = puff;
    const skin = rampMix(ramp('#8f7a3c'), '#ff5a2a', heat * 0.5), belly = ramp('#e8c46a'), eyeP = ramp('#b8c24a');
    const br = ph ? 1 : 0, ex = Math.round(puff * 2);
    // pata de trás
    W(32, 28, 9, 6.5, skin); T.line(34, 33, 40, 34, skin[1], 2); T.rect(38, 33, 5, 2, skin[2]);
    // corpo
    W(24 - ex / 2, 23 - br, 16 + ex, 11 + br + ex * 0.6, skin, { fn: (x, y, i) => (((x * 7 + y * 13) % 17 === 0 && i < 3 && y < 26) ? skin[3] : (((x * 5 + y * 11) % 23 === 0 && y < 26) ? skin[0] : null)) });
    W(18, 29, 11, 5, belly);
    // papo inflável
    const sac = 4.5 + puff * 5;
    W(10, 27 + puff * 2, sac, sac * 0.85, rampMix(ramp('#f0a050'), '#ff3a2a', heat), { fn: (x, y, i) => (((y + 0) % 3 === 0 && i < 3) ? '#ff7a4a' : null) });
    // cabeça
    W(14, 20 - br, 10, 7, skin);
    // boca
    if (open) { T.poly([[3, 21 - br], [18, 21 - br], [16, 28], [5, 27]], '#5a0e1c'); T.rect(8, 24, 6, 3, '#ff6a7a'); T.px(5, 21 - br, '#fff4d0'); T.px(17, 21 - br, '#fff4d0'); }
    else T.line(3, 24 - br, 17, 25 - br, OUTL, 1);
    // olhos
    W(20, 12 - br, 5, 5, eyeP); W(11, 13 - br, 4.6, 4.8, eyeP);
    if (hurt) { [[20, 12], [11, 13]].forEach(([a, b]) => { T.line(a - 2, b - 3 - br, a + 2, b + 1 - br, '#101010'); T.line(a + 2, b - 3 - br, a - 2, b + 1 - br, '#101010'); }); }
    else {
      W(19, 13 - br, 2.6, 3, '#fff6c8'); W(10, 14 - br, 2.4, 2.8, '#fff6c8');
      T.rect(18, 13 - br, 2, 3, '#10100c'); T.rect(9, 14 - br, 2, 3, '#10100c');
      T.line(15, 8 - br, 24, 10 - br, '#4a3a18', 1); T.line(7, 9 - br, 14, 11 - br, '#4a3a18', 1);   // sobrancelhas
    }
    // pata da frente
    W(12, 33, 4.5, 3, skin); T.rect(7, 34, 3, 1, skin[2]); T.rect(10, 35, 3, 1, skin[2]);
    T.px(5, 19 - br, '#101010');
    return outline(T.c, OUTL);
  }

  /* ---- projéteis e efeitos pequenos ---- */
  function makeGlob(ph) {
    const T = toolkit(14, 14), r = 4.4 + (ph ? 0.8 : 0), q = 5 - (ph ? 0.8 : 0);
    T.ell(7, 7, r, q, ramp('#9bd630'));
    T.px(5, 5, '#f4ffc8'); T.px(6, 5, '#e2f8a0'); T.px(9, 8, '#4a7a10');
    T.px(1, 7 + ph, '#9bd630'); T.px(0, 8, '#6aa020');
    return outline(T.c, '#1d3a0a');
  }
  function makeStar() {
    const rows = ['....Y....', '....Y....', '...YYY...', 'YYYYWYYYY', '.YYWWWYY.', '..YYWYY..', '..YY.YY..', '.Y.....Y.'];
    return outline(padCanvas(fromAscii(rows, { Y: '#ffd23a', W: '#fff6c0' }), 1), '#6a3a08');
  }
  function padCanvas(c, p) { const o = cv(c.width + p * 2, c.height + p * 2); o.getContext('2d').drawImage(c, p, p); return o; }
  function makeExcl() {
    const rows = ['.RR.', 'RYYR', 'RYYR', 'RYYR', '.RR.', '.RR.', '....', '.RR.', 'RYYR', '.RR.'];
    return outline(padCanvas(fromAscii(rows, { R: '#d8283a', Y: '#ffe27a' }), 1), '#4a0a10');
  }
  function makeShock() {
    const T = toolkit(48, 22);
    for (let i = 0; i < 24; i++) {
      const a = (i / 23) * Math.PI, rx = 22, ry = 9, x = 24 - Math.cos(a) * rx * (0.9 + (i % 3) * 0.05), y = 21 - Math.sin(a) * ry * 0.95;
      T.ell(x, y + 1, 3.2, 3.2 - (i % 2) * 0.6, ramp('#e8d7b0'));
    }
    return T.c;
  }

  /* ---- ladrão das castanhas: o Barão Guaxinim (80x80, pés em y=78) ---- */
  function makeBoss(p) {
    p = Object.assign({ sq: 1, dy: 0, lean: 0, legA: 0, legB: 0, arm: -0.4, mouth: 0, eyes: 'angry', sackDy: 0, tail: 0, flash: 0, sackFront: false, hat: 0, lookDx: 0 }, p);
    const T = toolkit(80, 80), G = 78, Rg = rig(T, G, p);
    const heat = p.flash;
    const fur = rampMix(ramp('#7a7990'), '#ff4a3a', heat * 0.45), furD = ramp('#2c2a38'), cream = ramp('#e6dfcc'), tan = ramp('#c99a52');
    const dark = ramp('#1c1a26');
    // cauda anelada
    for (let i = 0; i < 6; i++) {
      const t = i / 5, ang = -0.2 - p.tail, bx = 54 + t * 14 * Math.cos(ang * 0.6 + 0.2), by = 62 - t * 36 + Math.sin(t * 3 + p.tail * 2) * 3 - p.tail * 8 * t;
      Rg.ell(bx, by, 7.4 - t * 1.2, 6.6 - t * 0.6, i % 2 ? rampMix(fur, '#e8e8f0', 0.25) : furD);
    }
    // pés (atrás)
    Rg.ell(47 + p.legB, 76 - Math.max(0, -p.legB) * 0.6, 8.5, 4.2, furD);
    // saco de castanhas roubadas (nas costas)
    if (!p.sackFront) {
      const sy = 46 + p.sackDy;
      Rg.ell(58, sy, 13, 15, tan, { fn: (x, y, i) => ((x + y * 2) % 11 === 0 && i < 3 ? tan[0] : null) });
      Rg.ell(58, sy - 14, 4.5, 3.4, tan[1]); Rg.line(53, sy - 12, 63, sy - 12, '#6a3a12', 1);
      Rg.ell(54, sy - 18, 3, 3.4, ramp('#b9702a')); Rg.ell(63, sy - 17, 3, 3.3, ramp('#d99a3a'));
      Rg.rect(54, sy - 19, 3, 1, '#4a2410'); Rg.rect(62, sy - 18, 3, 1, '#4a2410');
      Rg.rect(53, sy - 2, 11, 8, '#9a6a28'); Rg.px(58, sy + 2, '#ffd23a'); Rg.px(57, sy + 3, '#ffd23a'); Rg.px(59, sy + 3, '#ffd23a');  // remendo com castanha dourada
    }
    // corpo e barriga
    Rg.ell(38, 55, 19, 20.5, fur, { fn: (x, y, i) => (i >= 2 && ((x * 3 + y * 7) % 9 === 0) ? fur[1] : null) });
    Rg.ell(33, 59, 11.5, 14.5, cream);
    // pé da frente
    Rg.ell(26 + p.legA, 76 - Math.max(0, -p.legA) * 0.6, 8.5, 4.2, furD);
    Rg.px(21 + p.legA, 76, '#e6dfcc'); Rg.px(23 + p.legA, 77, '#e6dfcc');
    // braço de trás (sombra)
    // cabeça
    const hx = p.lookDx;
    Rg.ell(30, 29, 16.5, 13.5, fur);
    Rg.ell(17, 35, 5.4, 4.4, rampMix(fur, '#fff', 0.15)); Rg.ell(43, 35, 5.4, 4.4, fur);
    // orelhas
    Rg.poly([[15, 20], [15, 7], [26, 15]], fur[2]); Rg.poly([[17, 18], [17, 10], [23, 15]], '#d9a0a8');
    Rg.poly([[35, 14], [44, 6], [46, 20]], fur[2]); Rg.poly([[38, 15], [43, 10], [44, 18]], '#d9a0a8');
    // máscara de ladrão
    Rg.ell(22, 29, 7.5, 5.6, dark, { ang: 0.4 }); Rg.ell(39, 29, 7.5, 5.6, dark, { ang: -0.4 }); Rg.rect(26, 26, 9, 4, dark[1]);
    // focinho
    Rg.ell(18, 35, 8, 5.4, cream); Rg.ell(12, 33, 2.8, 2.2, '#0e0c14'); Rg.px(11, 32, '#7a7a90');
    // bigodes
    Rg.line(14, 36, 6, 35, '#f4f0e0'); Rg.line(14, 37, 7, 39, '#f4f0e0');
    // olhos
    if (p.eyes === 'x') {
      [[21, 29], [38, 29]].forEach(([a, b]) => { Rg.line(a - 2, b - 3, a + 2, b + 2, '#fff'); Rg.line(a + 2, b - 3, a - 2, b + 2, '#fff'); });
    } else if (p.eyes === 'happy') {
      [[21, 29], [38, 29]].forEach(([a, b]) => { Rg.px(a - 2, b, '#fff'); Rg.px(a - 1, b - 1, '#fff'); Rg.px(a, b - 1, '#fff'); Rg.px(a + 1, b, '#fff'); });
    } else {
      Rg.ell(21, 29, 3.3, 3.8, '#fffbe8', { ang: 0.5 }); Rg.ell(37.5, 29, 3.3, 3.8, '#fffbe8', { ang: -0.5 });
      Rg.rect(19 + hx, 29, 2, 3, '#0a0810'); Rg.rect(36 + hx, 29, 2, 3, '#0a0810'); Rg.px(19 + hx, 29, '#fff');
    }
    // sorriso ganancioso e dente de ouro
    if (p.mouth > 0) { Rg.ell(17, 40, 6, 1.8 + p.mouth * 3.4, '#4a0a16'); Rg.ell(17, 42 + p.mouth * 2, 3, 1.4 + p.mouth, '#ff6a7a'); Rg.rect(12, 39, 2, 2, '#ffd23a'); }
    else { Rg.line(11, 39, 24, 40, '#2a1018'); Rg.rect(14, 40, 2, 2, '#ffd23a'); Rg.px(14, 40, '#fff0a0'); Rg.line(11, 39, 10, 38, '#2a1018'); }
    // cartola
    const tl = p.hat;
    Rg.ell(30, 17, 12, 3, dark);
    Rg.poly([[23, 17], [37, 17], [36 + tl, 3], [24 + tl, 3]], '#1e1c2a');
    Rg.poly([[23, 17], [26, 17], [25 + tl, 3], [24 + tl, 3]], '#3a374c');
    Rg.poly([[23, 15], [37, 15], [37, 12], [23, 12]], '#c8283a'); Rg.rect(29, 12, 3, 3, '#ffd23a');
    Rg.ell(30 + tl, 3, 6.2, 1.8, '#3a374c');
    // saco na frente (escudo) ou braço
    if (p.sackFront) {
      Rg.ell(15, 52, 12, 15, tan, { fn: (x, y, i) => ((x + y * 2) % 11 === 0 && i < 3 ? tan[0] : null) });
      Rg.ell(15, 38, 4, 3.2, tan[1]); Rg.ell(12, 33, 3, 3.4, ramp('#b9702a')); Rg.ell(18, 34, 3, 3.3, ramp('#d99a3a'));
      Rg.rect(9, 54, 11, 6, '#9a6a28');
      Rg.ell(24, 56, 4.5, 3.6, dark);
    } else {
      const sx = 30, sy = 50, a = p.arm, hx2 = 22 - a * 5, hy2 = 58 - a * 30;
      for (let k = 0; k < 5; k++) { const t = k / 4; Rg.ell(sx + (hx2 - sx) * t, sy + (hy2 - sy) * t, 4.6 - t * 0.6, 4.4 - t * 0.6, fur); }
      Rg.ell(hx2, hy2, 4.6, 4.2, dark);
      Rg.px(hx2 - 2, hy2 + 3, '#e6dfcc'); Rg.px(hx2, hy2 + 3, '#e6dfcc');
    }
    return outline(T.c, '#15101a');
  }
  const BOSS_POSES = {
    idle: [{ dy: 0 }, { dy: 0, sq: 1.02, sackDy: -1, tail: 0.1 }, { dy: 1, sq: 1.03, sackDy: -1, tail: 0.25 }, { dy: 0, sackDy: 0, tail: 0.1 }].map((q, i) => Object.assign({ mouth: i === 2 ? 0.2 : 0 }, q)),
    walk: [{ dy: 0, legA: -4, legB: 4, tail: 0, hat: 0 }, { dy: 2, legA: 0, legB: 0, tail: 0.1, hat: 1 }, { dy: 0, legA: 4, legB: -4, tail: 0.2, hat: 0 }, { dy: 2, legA: 0, legB: 0, tail: 0.1, hat: -1 }].map((q) => Object.assign({ sackDy: -q.dy * 0.7, arm: -0.2, mouth: 0 }, q)),
    wind: [{ sq: 0.9, dy: 0, arm: 0.5, lean: 3, tail: 0.2, mouth: 0.4 }, { sq: 0.84, dy: 0, arm: 0.9, lean: 5, tail: 0.5, mouth: 0.9, flash: 1, sackDy: 3 }],
    dash: [{ sq: 0.9, lean: -9, legA: -9, legB: 8, tail: 0.7, sackFront: true, mouth: 0.6, hat: -2 }, { sq: 0.88, lean: -10, legA: 6, legB: -8, tail: 0.8, sackFront: true, mouth: 0.6, hat: -3 }],
    jump: [{ sq: 1.1, dy: 0, arm: 0.9, legA: 3, legB: -3, tail: 0.2, mouth: 0.5, eyes: 'happy' }, { sq: 0.94, dy: 0, arm: 0.6, legA: -4, legB: 4, tail: -0.1, mouth: 0.6 }],
    slam: [{ sq: 0.78, dy: 0, arm: -1, lean: -2, tail: 0.5, mouth: 1, legA: -6, legB: 6 }],
    throw: [{ sq: 1.02, arm: 1, lean: 4, sackDy: -4, mouth: 0.3, tail: 0.3 }, { sq: 0.96, arm: -0.1, lean: -4, sackDy: 3, mouth: 0.8, tail: 0.5, hat: -1 }],
    hurt: [{ sq: 0.94, lean: 6, arm: 0.2, eyes: 'x', mouth: 1, tail: 0.6, hat: 3 }, { sq: 1.04, lean: 3, arm: 0.5, eyes: 'x', mouth: 0.7, tail: 0.1, hat: 2 }],
    tired: [{ sq: 0.86, lean: 3, arm: -1, eyes: 'x', mouth: 0.5, tail: -0.4, legA: -3, legB: 3, hat: 2 }]
  };

  /* ---- esquilas roqueiras (irmãs): 56x64 ---- */
  function makeSister(which, ph, talk) {
    const T = toolkit(58, 66), W = T.ell, G = 64;
    const s1 = which === 1;
    const fur = ramp(s1 ? '#c0642e' : '#b9ad9e'), cream = ramp(s1 ? '#f4dcb6' : '#f6eddc'), leather = ramp(s1 ? '#2e2a3a' : '#243a44');
    const accent = s1 ? '#e0307a' : '#2fc7b8', accent2 = s1 ? '#ff8ab8' : '#8ff0e0';
    const guitar = ramp(s1 ? '#d02a3c' : '#1e9a96'), wood = ramp('#c89a5a');
    const bob = [0, -1, 0, -1][ph], tap = ph % 2, wag = [0, 2, 3, 1][ph];
    // cauda volumosa
    const tp = [[42, 50, 6.5], [47, 43, 7.2], [49, 33, 7.8], [47, 22, 7.8], [42, 14, 7], [37, 10, 5.4]];
    tp.forEach(([x, y, r], i) => W(x + wag * (i / 5) * (i > 2 ? 1 : 0.4), y, r, r * 1.05, i > 3 ? rampMix(fur, '#fff', 0.14) : fur, { fn: (xx, yy, k) => (i % 2 && k >= 1 && (xx + yy) % 5 === 0 ? fur[0] : null) }));
    // pés
    W(27, 63 - tap * 2, 6, 2.8, rampMix(fur, '#000', 0.2)); W(38, 63, 6, 2.8, rampMix(fur, '#000', 0.2));
    // corpo + colete de couro
    W(33, 49, 10.5, 13.5, fur);
    W(29, 51, 5.6, 9.5, cream);
    W(34, 48, 10.2, 12.4, leather, { fn: (x, y, i, u) => (u < -0.55 ? false : null) });
    W(28.5, 51, 3.6, 8.5, cream);
    T.px(39, 41, '#e8e8f0'); T.px(36, 44, '#e8e8f0'); T.px(41, 46, '#e8e8f0'); T.px(40, 52, accent);
    // cabeça
    const hy = bob;
    // orelhas com pincel
    T.poly([[19, 21 + hy], [18, 8 + hy], [27, 17 + hy]], fur[2]); T.poly([[21, 19 + hy], [20, 11 + hy], [25, 17 + hy]], '#e8a0a4'); T.px(18, 6 + hy, fur[0]); T.px(17, 7 + hy, fur[1]);
    T.poly([[33, 17 + hy], [38, 7 + hy], [39, 21 + hy]], fur[2]); T.px(38, 5 + hy, fur[0]);
    W(27, 28 + hy, 11, 10, fur);
    W(19, 33 + hy, 6, 4.2, cream); T.px(14, 31 + hy, '#3a1a20'); T.px(15, 31 + hy, '#3a1a20'); T.px(14, 30 + hy, '#c06a74');
    if (talk) { W(19, 36 + hy + talk, 3.4, 1.6 + talk, '#5a0e1c'); T.px(19, 37 + hy + talk, '#ff7a8a'); }
    else T.line(16, 35 + hy, 21, 35 + hy, '#5a2a20');
    W(33, 33 + hy, 3, 2.4, '#f08a8a', { fn: (x, y, i) => (i < 1 ? false : null) });
    if (s1) {
      // olho + bandana magenta com nó
      W(23, 27 + hy, 2.2, 3, '#14080e'); T.px(22, 26 + hy, '#fff');
      T.poly([[17, 21 + hy], [37, 18 + hy], [38, 23 + hy], [17, 26 + hy]], accent);
      T.line(18, 22 + hy, 36, 19 + hy, accent2, 1);
      for (let k = 0; k < 5; k++) T.px(21 + k * 3.4, 23 + hy - k * 0.3, '#ffe0f0');
      T.poly([[37, 19 + hy], [46, 14 + hy + wag], [44, 19 + hy], [47, 23 + hy + wag], [38, 23 + hy]], accent);
    } else {
      // franja espetada ciano + óculos escuros
      T.poly([[20, 19 + hy], [22, 7 + hy], [26, 17 + hy], [29, 4 + hy], [32, 16 + hy], [37, 7 + hy], [37, 20 + hy]], accent);
      T.poly([[22, 12 + hy], [23, 8 + hy], [25, 14 + hy]], accent2); T.px(29, 6 + hy, accent2);
      T.rect(17, 25 + hy, 17, 4, '#0c0c14'); T.rect(18, 25 + hy, 6, 1, '#6a7aa0'); T.px(28, 26 + hy, '#6a7aa0');
      T.line(34, 26 + hy, 38, 25 + hy, '#0c0c14');
    }
    // instrumento + correia + braços
    T.line(41, 36, 28, 59, '#14121c', 2);
    const gby = 54;
    W(33, gby, 9.5, 6.5, guitar, { ang: -0.3 });
    W(35, gby + 1, 2.5, 2.5, '#12101a'); T.rect(28, gby - 4, 3, 2, s1 ? '#f4f0e8' : '#14121c'); T.rect(34, gby + 3, 3, 1, '#d8dce8');
    const nx = s1 ? 6 : 3, ny = s1 ? 40 : 38;
    T.line(26, gby - 3, nx + 3, ny + 3, wood[0], 3); T.line(26, gby - 4, nx + 3, ny + 2, wood[2], 1);
    for (let k = 1; k < 5; k++) { const t = k / 5; T.px(26 + (nx + 3 - 26) * t, gby - 3 + (ny + 3 - gby + 3) * t - 1, '#e8e8f0'); }
    T.rect(nx - 1, ny - 4, 5, 5, '#2a1a14'); T.px(nx, ny - 5, '#e8e8f0'); T.px(nx + 2, ny - 5, '#e8e8f0');
    W(15, 45 - (ph === 2 ? 1 : 0), 3.6, 3.2, fur);
    W(30, 52, 3.6, 3.4, fur);
    return outline(T.c, '#1d0f15');
  }

  /* ---- texugo caminhoneiro: 66x66 ---- */
  function makeBadger(ph, talk) {
    const T = toolkit(68, 66), W = T.ell;
    const fur = ramp('#6c6e7a'), black = ramp('#2a2b34'), jeans = ramp('#2f62b0'), cap = ramp('#f2c230');
    const br = [0, 1, 0, 0][ph], hy = [0, 0, 1, 0][ph];
    const wr = [0, -3, -8, -3][ph];       // chave inglesa sobe e desce
    // botas
    W(26, 64, 8, 3.2, ramp('#5a3820')); W(44, 64, 8, 3.2, ramp('#5a3820'));
    // corpo
    W(36, 46, 20, 18 + br * 0.4, fur);
    W(36, 50, 17.5, 14.5, jeans, { fn: (x, y, i) => (((x + y) % 7 === 0 && i < 2) ? jeans[1] : null) });
    T.rect(26, 34, 20, 12, jeans[2]); T.line(26, 34, 46, 34, jeans[0]);
    T.line(28, 33, 26, 24, jeans[1], 2); T.line(44, 33, 46, 25, jeans[1], 2);
    T.rect(28, 40, 5, 4, jeans[3]); T.px(30, 40, '#ffd23a'); T.px(26, 35, '#ffd23a'); T.px(46, 35, '#ffd23a');
    T.rect(34, 52, 4, 4, '#ffd23a'); T.rect(35, 53, 2, 2, '#a8741a');
    // braço de trás segurando a chave inglesa
    const hx = 52, hyy = 44 + wr * 0.6;
    T.line(46, 40, hx, hyy, fur[1], 5);
    T.line(hx, hyy, hx + 5, hyy - 10 + wr * 0.5, '#9aa0b0', 3); T.line(hx + 1, hyy, hx + 6, hyy - 10 + wr * 0.5, '#d8dce8', 1);
    W(hx + 6, hyy - 12 + wr * 0.5, 4, 3.6, '#b8bece', { fn: (x, y, i, u, v) => (Math.abs(u) < 0.4 && v < -0.1 ? false : null) });
    W(hx, hyy + 1, 4.4, 4, black);
    // cabeça
    const y0 = 25 + hy;
    W(26, y0, 15, 11, black);
    W(18, y0 + 4, 6, 4, ramp('#e8e8f0'));
    T.poly([[28, y0 - 11], [33, y0 - 11], [18, y0 + 3], [11, y0 + 5], [12, y0 + 2]], '#f4f4f8');   // listra branca
    T.poly([[26, y0 - 10], [31, y0 - 10], [24, y0 - 2]], '#f4f4f8');
    W(37, y0 - 8, 3.6, 3.8, black); W(37, y0 - 8, 1.8, 2, '#e8e8f0');
    W(11, y0 + 5, 3.6, 2.8, '#0b0b10'); T.px(10, y0 + 4, '#7a7a90');
    W(22, y0, 3, 3.2, '#fffbe8'); T.rect(20, y0, 2, 3, '#0b0b10'); T.px(20, y0, '#fff');
    if (ph === 1) { T.line(20, y0 - 1, 24, y0 - 1, '#0b0b10'); T.px(22, y0 - 1, '#0b0b10'); }
    if (talk) { W(16, y0 + 9, 3.4, 1.4 + talk, '#4a0a16'); }
    else T.line(13, y0 + 9, 20, y0 + 10, '#2a1a20');
    // boné amarelo de caminhoneiro
    W(28, y0 - 9, 11, 6, cap); T.poly([[16, y0 - 7], [4, y0 - 4], [6, y0 - 1], [19, y0 - 3]], cap[1]); T.line(5, y0 - 3, 17, y0 - 5, cap[0]);
    T.rect(26, y0 - 12, 6, 4, '#2c6b3a'); T.px(28, y0 - 11, '#fff3c4'); T.px(29, y0 - 10, '#fff3c4'); T.px(30, y0 - 11, '#fff3c4');
    // braço da frente na cintura
    T.line(30, 43, 24, 49, fur[1], 5); W(25, 51, 4.4, 3.8, black); T.line(30, 43, 24, 49, fur[2], 2);
    return outline(T.c, '#15101a');
  }

  /* ---- corvo fofoqueiro: 46x54 (empoleirado num galho curto) ---- */
  function makeCrow(ph, talk) {
    const T = toolkit(48, 54), W = T.ell;
    const bl = ramp('#2e3466'), wing = ramp('#1a1f44');
    const tilt = [0, 1, 2, 1][ph], bob = ph === 2 ? 1 : 0;
    // galho
    T.rect(2, 49, 40, 3, '#5a3418'); T.rect(2, 49, 40, 1, '#8a5a2a'); T.rect(34, 46, 2, 3, '#5a3418'); T.rect(33, 44, 3, 2, '#3f8a37');
    // pés
    T.line(22, 45, 21, 49, '#f0a23a'); T.line(28, 45, 28, 49, '#f0a23a'); T.rect(19, 49, 3, 1, '#f0a23a'); T.rect(26, 49, 3, 1, '#f0a23a');
    // cauda
    T.poly([[30, 40], [44, 50 + (ph === 3 ? 1 : 0)], [40, 51], [28, 46]], wing[1]); T.line(32, 42, 43, 50, wing[0]);
    // corpo
    W(27, 32 + bob, 12, 14.5, bl);
    W(30, 34 + bob, 8, 11.5, wing, { ang: 0.2 });
    for (let k = 0; k < 3; k++) T.line(27 + k * 3, 40 + bob, 28 + k * 3, 45, wing[0]);
    W(24, 37 + bob, 5, 7, rampMix(bl, '#8890ff', 0.2));
    // cabeça + bico
    const hx = 16 - tilt * 0.5, hy = 18 + bob + (ph === 1 ? 1 : 0);
    W(hx + 1, hy, 9, 8.2, bl);
    const o = talk ? 2.4 * talk : 0;
    T.poly([[hx - 7, hy - 3], [hx - 16, hy + 1], [hx - 7, hy + 1 - o * 0.3]], '#f4b04a'); T.line(hx - 15, hy + 1, hx - 7, hy + 1, '#a8681a');
    T.poly([[hx - 7, hy + 2 + o], [hx - 14, hy + 3 + o], [hx - 7, hy + 5 + o]], '#e08a2a');
    // olho de fofoqueiro (olhar de lado) + monóculo
    W(hx - 3, hy - 2, 3, 3.2, '#fffbe8'); T.rect(hx - 5, hy - 2, 2, 2, '#0a0810'); T.px(hx - 5, hy - 2, '#fff');
    for (let a = 0; a < 16; a++) T.px(hx - 3 + Math.cos(a / 16 * 6.283) * 5, hy - 2 + Math.sin(a / 16 * 6.283) * 5, '#ffd23a');
    T.line(hx + 1, hy + 2, hx + 3, hy + 14, '#ffd23a');
    T.line(hx - 7, hy - 7, hx + 1, hy - 7 - (ph === 2 ? 2 : 0), '#0a0a14', 1);              // sobrancelha erguida
    T.px(hx + 3, hy - 9, bl[0]); T.px(hx + 5, hy - 10, bl[1]);
    return outline(T.c, '#0a0a14');
  }

  /* ---- itens e props ---- */
  function glint(T, x, y) { T.px(x, y, '#ffffff'); T.px(x - 1, y, '#fff6c0'); T.px(x + 1, y, '#fff6c0'); T.px(x, y - 1, '#fff6c0'); T.px(x, y + 1, '#fff6c0'); }
  function makeCorda(g) {
    const T = toolkit(22, 22), S = ramp('#c8d0e0');
    T.ell(11, 12, 9, 7, S, { fn: (x, y, i, u, v) => (u * u + v * v < 0.4 ? false : ((x + y) % 3 === 0 ? S[Math.min(3, i + 1)] : null)) });
    T.ell(11, 11, 7, 5, S, { fn: (x, y, i, u, v) => (u * u + v * v < 0.35 ? false : '#8890a8') });
    T.ell(11, 10, 5, 3, '#e8ecf8', { fn: (x, y, i, u, v) => (u * u + v * v < 0.4 ? false : null) });
    T.line(18, 14, 21, 19, '#c8d0e0'); T.line(4, 13, 1, 18, '#c8d0e0'); T.px(21, 20, '#ffd23a'); T.px(1, 19, '#ffd23a');
    T.rect(9, 3, 4, 2, '#b9702a');                      // laço de cobre
    if (g) glint(T, 16, 7);
    return outline(T.c, '#232a40');
  }
  function makePick(g) {
    const T = toolkit(20, 22);
    T.poly([[10, 20], [3, 9], [2, 5], [5, 2], [15, 2], [18, 5], [17, 9]], (x, y) => (y < 7 ? '#ffd84a' : (x > 11 ? '#e8a020' : '#f6c030')));
    T.poly([[10, 18], [5, 9], [6, 4], [9, 3]], '#fff0a0');
    T.rect(8, 7, 4, 2, '#d8283a'); T.px(10, 6, '#d8283a'); T.px(10, 9, '#d8283a');   // coração/nota
    if (g) glint(T, 14, 6);
    return outline(T.c, '#5a3208');
  }
  function makeKey(g) {
    const T = toolkit(26, 24);
    T.ell(7, 8, 5.5, 5.5, ramp('#f4c030'), { fn: (x, y, i, u, v) => (u * u + v * v < 0.2 ? false : null) });
    T.rect(11, 7, 12, 3, '#e8a820'); T.rect(11, 7, 12, 1, '#ffe27a'); T.rect(19, 10, 2, 4, '#e8a820'); T.rect(22, 10, 2, 3, '#e8a820');
    T.poly([[5, 14], [12, 14], [12, 22], [5, 22]], '#d8283a'); T.rect(5, 14, 7, 1, '#ff6a7a'); T.rect(7, 17, 3, 3, '#fff3c4'); T.px(8, 18, '#2c6b3a');
    T.line(8, 13, 8, 14, '#e8a820');
    if (g) glint(T, 20, 6);
    return outline(T.c, '#4a2a08');
  }
  function makeAmp(on, g) {
    const T = toolkit(34, 34);
    T.rect(2, 4, 30, 28, '#1c1a24'); T.rect(3, 5, 28, 26, '#2e2b3a'); T.rect(3, 5, 28, 2, '#4a4660');
    T.rect(4, 8, 26, 6, '#14121a');
    [8, 14, 20, 26].forEach((x, i) => { T.rect(x - 1, 9, 4, 4, '#c8c8d0'); T.px(x, 10, '#fff'); T.px(x + 1, 11, i === 1 ? '#d8283a' : '#555a68'); });
    T.px(28, 11, on ? '#ff3a3a' : '#5a1a1a'); if (on) { T.px(27, 11, '#ff9a8a'); T.px(29, 11, '#ff9a8a'); }
    // grade
    T.rect(5, 16, 24, 14, '#c9a05a');
    for (let y = 16; y < 30; y += 2) T.rect(5, y, 24, 1, '#a07838');
    for (let x = 5; x < 29; x += 2) T.rect(x, 16, 1, 14, '#a07838');
    T.rect(5, 16, 24, 1, '#e8c880'); T.rect(5, 29, 24, 1, '#7a5a28');
    // cantoneiras e alça
    [[2, 4], [29, 4], [2, 29], [29, 29]].forEach(([x, y]) => T.rect(x, y, 3, 3, '#c8c8d0'));
    T.rect(12, 1, 10, 3, '#5a3a22'); T.rect(11, 3, 2, 2, '#5a3a22'); T.rect(21, 3, 2, 2, '#5a3a22');
    if (on) { T.rect(5, 16, 24, 14, '#ffd27a'); for (let y = 16; y < 30; y += 2) T.rect(5, y, 24, 1, '#e0902a'); for (let x = 5; x < 29; x += 2) T.rect(x, 16, 1, 14, '#e0902a'); T.ell(17, 23, 5, 5, '#fff3c4', { fn: (x, y, i, u, v) => (u * u + v * v > 0.7 ? false : null) }); }
    if (g) glint(T, 25, 20);
    return outline(T.c, '#0a0810');
  }
  function makeCrate(dmg) {
    const T = toolkit(36, 36), W = ramp('#c28a46');
    T.rect(2, 2, 32, 32, '#3a2210'); T.rect(3, 3, 30, 30, W[2]);
    for (let y = 3; y < 33; y += 6) { T.rect(3, y + 5, 30, 1, W[0]); T.rect(3, y, 30, 1, W[3]); }
    T.rect(3, 3, 5, 30, W[1]); T.rect(28, 3, 5, 30, W[1]); T.rect(3, 3, 30, 5, W[1]); T.rect(3, 28, 30, 5, W[1]);
    T.rect(8, 8, 20, 20, W[2]); for (let y = 8; y < 28; y += 5) T.rect(8, y + 4, 20, 1, W[0]);
    T.line(8, 8, 27, 27, W[1], 3); T.line(27, 8, 8, 27, W[1], 3); T.line(9, 8, 27, 26, W[3], 1);
    [[5, 5], [30, 5], [5, 30], [30, 30]].forEach(([x, y]) => { T.rect(x, y, 2, 2, '#c8c8d0'); T.px(x, y, '#fff'); });
    T.ell(18, 18, 3, 3, '#e0a032'); T.px(17, 17, '#fff0a0');   // selo de castanha
    if (dmg) { T.line(22, 3, 17, 12, '#1a0c06'); T.line(17, 12, 21, 18, '#1a0c06'); T.line(5, 28, 12, 22, '#1a0c06'); T.rect(24, 2, 4, 3, false); T.px(25, 3, '#000'); }
    return outline(T.c, '#2a160a');
  }
  function makeSplinter(i) {
    const T = toolkit(10, 10), W = ramp('#c28a46');
    if (i === 0) T.poly([[1, 4], [8, 2], [9, 5], [2, 7]], W[2]); else if (i === 1) T.poly([[2, 1], [5, 1], [8, 8], [3, 8]], W[1]); else T.poly([[1, 2], [8, 3], [7, 7], [2, 8]], W[3]);
    T.px(3, 4, W[0]);
    return outline(T.c, '#2a160a');
  }
  function makeSpring(st) {
    // st 0 = comprimida, 1 = meio, 2 = esticada
    const T = toolkit(30, 34), H = [8, 15, 23][st], base = 31;
    T.rect(4, base - 3, 22, 4, '#5a3a22'); T.rect(4, base - 3, 22, 1, '#8a5a2a'); T.rect(7, base - 1, 2, 1, '#c8c8d0'); T.rect(21, base - 1, 2, 1, '#c8c8d0');
    const top = base - 3 - H;
    const n = [2, 3, 4][st];
    for (let k = 0; k <= n; k++) {
      const y = top + 3 + ((H - 3) * k) / n;
      T.rect(8, y - 1, 14, 3, '#9aa4b8'); T.rect(8, y - 1, 14, 1, '#e8eef8'); T.rect(8, y + 1, 14, 1, '#4a5268');
    }
    T.ell(15, top + 1, 12 + (st === 0 ? 1 : 0), 5 - (st === 0 ? 1 : 0) * 0.5, ramp('#e04a3a'), { fn: (x, y, i, u, v) => (i >= 2 && Math.abs(u) < 0.2 && v < 0 ? '#fff0d0' : null) });
    T.px(9, top - 1, '#fff'); T.px(10, top - 1, '#fff'); T.rect(20, top, 2, 2, '#fff0d0');
    return outline(T.c, '#2a0e0a');
  }
  function makeSign(kind) {
    const T = toolkit(40, 48), W = ramp('#b9803c');
    T.rect(18, 14, 5, 33, '#4a2a14'); T.rect(19, 14, 2, 33, '#8a5a2a');
    T.rect(12, 44, 17, 3, '#3a2112');
    if (kind === 0) {
      T.poly([[3, 6], [28, 6], [37, 14], [28, 22], [3, 22]], W[2]); T.poly([[4, 7], [27, 7], [35, 14], [27, 14], [4, 14]], W[3]);
      T.poly([[4, 21], [28, 21], [27, 21], [4, 21]], W[0]); T.rect(3, 19, 25, 3, W[1]);
      T.poly([[9, 12], [22, 12], [22, 9], [30, 14], [22, 19], [22, 16], [9, 16]], '#3a1a0a');
      T.px(6, 9, '#c8c8d0'); T.px(6, 19, '#c8c8d0');
    } else {
      T.poly([[4, 5], [34, 5], [34, 23], [4, 23]], W[2]); T.rect(4, 5, 30, 2, W[3]); T.rect(4, 21, 30, 2, W[1]);
      T.poly([[19, 8], [27, 20], [11, 20]], '#e8283a'); T.poly([[19, 10], [25, 19], [13, 19]], '#ffe27a');
      T.rect(18, 12, 2, 4, '#3a0a10'); T.rect(18, 17, 2, 1, '#3a0a10');
      T.px(6, 7, '#c8c8d0'); T.px(32, 7, '#c8c8d0'); T.px(6, 21, '#c8c8d0'); T.px(32, 21, '#c8c8d0');
    }
    return outline(T.c, '#2a160a');
  }
  function makePaperLantern(f) {
    const T = toolkit(24, 38), sw = [0, 1, 0][f], R = ramp('#e8383a');
    T.line(12, 0, 12 + sw, 5, '#3a2a18');
    T.rect(8 + sw, 5, 8, 3, '#ffd23a'); T.rect(8 + sw, 5, 8, 1, '#fff3a0');
    T.ell(12 + sw, 19, 10, 11.5, rampMix(R, '#ffb23a', f === 1 ? 0.35 : 0.2), { fn: (x, y, i, u, v) => (Math.abs(Math.round((x - 12 - sw) * 0.9) % 3) === 0 && i < 3 ? '#a82028' : (i === 3 ? '#ffe090' : null)) });
    T.rect(8 + sw, 30, 8, 3, '#ffd23a'); T.rect(8 + sw, 32, 8, 1, '#a8741a');
    T.line(12 + sw, 33, 12 + sw, 36, '#ffd23a'); T.px(11 + sw, 37, '#e8383a'); T.px(12 + sw, 37, '#e8383a'); T.px(13 + sw, 37, '#e8383a');
    T.px(9 + sw, 12, '#ffe8b0'); T.px(10 + sw, 11, '#ffe8b0');
    return outline(T.c, '#4a1008');
  }

  /* registra todos os sprites novos no atlas */
  function addNewSprites(add) {
    for (let i = 0; i < 4; i++) add('wasp_' + (i + 1), makeWasp(i, 'fly'));
    add('wasp_hurt', makeWasp(0, 'hurt'));
    for (let i = 0; i < 4; i++) add('beetle_' + (i + 1), makeBeetle('walk', i));
    add('beetle_flip_1', makeBeetle('flip', 0)); add('beetle_flip_2', makeBeetle('flip', 1));
    add('toad_1', makeToad(0, 0, false, false)); add('toad_2', makeToad(1, 0, false, false));
    add('toad_puff_1', makeToad(0, 0.6, false, false)); add('toad_puff_2', makeToad(1, 1, false, false));
    add('toad_spit', makeToad(0, 0.1, true, false)); add('toad_hurt', makeToad(0, 0, true, true));
    add('proj_glob_1', makeGlob(0)); add('proj_glob_2', makeGlob(1));
    add('fx_star', makeStar()); add('fx_excl', makeExcl()); add('fx_shock', makeShock());
    for (const k of Object.keys(BOSS_POSES)) BOSS_POSES[k].forEach((p, i) => add(`boss_${k}_${i + 1}`, makeBoss(p)));
    for (let w = 1; w <= 2; w++) {
      for (let i = 0; i < 4; i++) add(`npc_irma${w}_${i + 1}`, makeSister(w, i, 0));
      add(`npc_irma${w}_t1`, makeSister(w, 0, 0.4)); add(`npc_irma${w}_t2`, makeSister(w, 1, 1));
    }
    for (let i = 0; i < 4; i++) add(`npc_texugo_${i + 1}`, makeBadger(i, 0));
    add('npc_texugo_t1', makeBadger(0, 0.4)); add('npc_texugo_t2', makeBadger(2, 1));
    for (let i = 0; i < 4; i++) add(`npc_corvo_${i + 1}`, makeCrow(i, 0));
    add('npc_corvo_t1', makeCrow(0, 0.5)); add('npc_corvo_t2', makeCrow(2, 1));
    add('item_corda_1', makeCorda(false)); add('item_corda_2', makeCorda(true));
    add('item_palheta_1', makePick(false)); add('item_palheta_2', makePick(true));
    add('item_chave_1', makeKey(false)); add('item_chave_2', makeKey(true));
    add('item_amp_1', makeAmp(false, false)); add('item_amp_2', makeAmp(true, true));
    add('crate', makeCrate(false)); add('crate_hit', makeCrate(true));
    for (let i = 0; i < 3; i++) add('crate_piece_' + (i + 1), makeSplinter(i));
    for (let i = 0; i < 3; i++) add('spring_' + (i + 1), makeSpring(i));
    add('sign', makeSign(0)); add('sign_warn', makeSign(1));
    for (let i = 0; i < 3; i++) add('lantern_paper_' + (i + 1), makePaperLantern(i));
  }


  /* ======================= CARREGAMENTO + ATLAS ======================= */

  /* ---------- planar (glide) e mergulho (pancada): derivados dos quadros de corrida/bola ---------- */
  function palOf(src) {
    const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, m = {};
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; m[k] = (m[k] || 0) + 1; }
    const lum = (k) => ((k >> 16) & 255) * 0.3 + ((k >> 8) & 255) * 0.59 + (k & 255) * 0.11;
    const top = Object.keys(m).map(Number).sort((a, b) => m[b] - m[a]).slice(0, 7).sort((a, b) => lum(a) - lum(b));
    const hex = (k) => '#' + k.toString(16).padStart(6, '0');
    return top.map(hex);
  }
  function makeGlideFrames(run) {
    const out = '#2a1008', dk = '#8a3a12', md = '#b8561a', lt = '#dc7626', hi = '#f4a455';
    const frames = [];
    const P = [{ ang: 0.72, rx: 16, ry: 12, arm: 0, leg: 0 }, { ang: 0.92, rx: 15, ry: 13, arm: -1, leg: 1 }, { ang: 0.8, rx: 15.5, ry: 12.4, arm: 1, leg: -1 }, { ang: 0.62, rx: 16.5, ry: 11.5, arm: 0, leg: 1 }];
    P.forEach((q, fi) => {
      const c = cv(90, 58), g = c.getContext('2d');
      // cauda: leque felpudo em arco (de pára-quedas) saindo do quadril
      const ca = Math.cos(q.ang), sa = Math.sin(q.ang), cx = 38 - q.rx * ca, cy = 34 - q.rx * sa;
      const img = g.createImageData(90, 58);
      for (let y = 0; y < 58; y++) for (let x = 0; x < 90; x++) {
        const dx = x - cx, dy = y - cy;
        const u = (dx * ca + dy * sa) / q.rx, v = (-dx * sa + dy * ca) / q.ry;
        // formato de folha: afunila na raiz (u>0 = lado do corpo)
        const w = 1 - Math.max(0, u) * 0.6;
        const r = Math.sqrt(u * u + (v / Math.max(0.35, w)) * (v / Math.max(0.35, w)));
        if (r > 1) continue;
        let col = md;
        if (r > 0.86) col = out; else if (r > 0.7) col = dk;
        else {
          const band = Math.floor((u + 1) * 5.5 + Math.sin(v * 2.2 + fi) * 0.6);
          if (v < -0.25 && r < 0.6) col = lt;
          if (band % 3 === 0 && r < 0.64) col = dk;
          if (v < -0.55 && r < 0.62 && band % 3 !== 0) col = hi;
        }
        const k = (y * 90 + x) * 4, rgb = parseInt(col.slice(1), 16);
        img.data[k] = rgb >> 16; img.data[k + 1] = (rgb >> 8) & 255; img.data[k + 2] = rgb & 255; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      // corpo e cabeça do quadro de corrida (sem a cauda original)
      g.drawImage(run, 38, 0, 52, 58, 38, 0, 52, 58);
      // membros abertos: braço à frente/cima e perna esticada atrás
      const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
      const limb = (x0, y0, dxn, dyn, len, col) => { for (let i = 0; i < len; i++) { px(x0 + i * dxn, y0 + Math.round(i * dyn), out); px(x0 + i * dxn, y0 + Math.round(i * dyn) + 1, col); } };
      limb(57, 44 + q.arm, 1, 0.1, 6, md);
      limb(51, 45, 1, 0.05, 5, dk);
      limb(46, 44 + q.leg, -1, 0.35, 7, md);
      limb(49, 45, -1, 0.15, 5, dk);
      frames.push(c);
    });
    return frames;
  }
  function makePoundFrame(ball) {
    const c = cv(90, 84), g = c.getContext('2d');
    // rastros de velocidade acima da bola
    for (let i = 0; i < 7; i++) {
      const x = 22 + i * 7 + (i % 2) * 2, len = 12 + (i % 3) * 7;
      for (let y = 0; y < len; y++) {
        const a = 0.18 + 0.55 * (1 - y / len);
        g.fillStyle = `rgba(255,${226 - y * 2},150,${a})`; g.fillRect(x, 26 - len + y + (i % 2) * 3, 2, 1);
      }
    }
    g.drawImage(ball, 0, 26);
    return c;
  }
  RC.makeGlideFrames = makeGlideFrames; RC.makePoundFrame = makePoundFrame;

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Falha ao carregar ' + src)); i.src = src;
    });
  }

  RC.buildAtlas = async function (r, anchors) {
    const D = RC.SPRITE_DATA;
    const defs = [];
    const add = (name, canvasOrImg) => defs.push({ name, src: canvasOrImg });
    const names = Object.keys(D);
    const imgs = await Promise.all(names.map((n) => loadImg(D[n])));
    names.forEach((n, i) => add(n, imgs[i]));
    // sprites modelados no Blender (js/sprites-blender.js): substituem os desenhados por código e trazem normal map real
    const BL = RC.SPRITE_BLENDER || {}, BN = RC.SPRITE_NORMALS || {};
    const blNames = Object.keys(BL);
    const blImgs = await Promise.all(blNames.map((n) => loadImg(BL[n])));
    blNames.forEach((n, i) => add(n, blImgs[i]));
    const realNorm = {};
    await Promise.all(Object.keys(BN).map(async (n) => {
      const im = await loadImg(BN[n]); const c = cv(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); realNorm[n] = c;
    }));

    addNewSprites(add);
    {
      const toC = (im) => { const c = cv(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return c; };
      const run4 = defs.find((d) => d.name === 'run_4'), jmp = defs.find((d) => d.name === 'jump_3');
      if (run4) makeGlideFrames(toC(run4.src)).forEach((c, i) => add('glide_' + (i + 1), c));
      if (jmp) add('pound_1', makePoundFrame(toC(jmp.src)));
    }
    const M = RC.MOODS;
    add('crown', makeCrown());
    add('lantern_off', makeLantern(false)); add('lantern_on', makeLantern(true)); add('post', makePost());
    if (!BL.truck) add('truck', makeTruck());
    add('glow', makeGlow()); add('shaft', makeShaft()); add('dot', makeDot());
    const rnd = RC.mulberry32(77);
    // tufos e flores usam as cores da paleta de cada humor
    M.forEach((m, mi) => { for (let i = 0; i < 6; i++) add(`tuft_${mi}_${i}`, makeTuft(rnd, m.grass)); });
    add('flower_0', makeFlower(rnd, '#fff3d0', '#f0b030')); add('flower_1', makeFlower(rnd, '#ff8aa8', '#ffe27a'));
    add('flower_2', makeFlower(rnd, '#8ab8ff', '#fff3d0')); add('flower_3', makeFlower(rnd, '#ffcf4a', '#a8541c'));
    add('mush_0', makeMushroom('#e04545', '#fff1d6')); add('mush_1', makeMushroom('#38d6c4', '#e8fffb')); add('mush_2', makeMushroom('#b070ff', '#f6e8ff'));
    add('leaf_0', makeLeaf('#6bb348', '#1a3a28')); add('leaf_1', makeLeaf('#e0a032', '#5a2c10')); add('leaf_2', makeLeaf('#d9552f', '#4a1608'));

    // empacotamento (prateleiras) — albedo e normal com o mesmo layout
    const pack = (size) => {
      let cx = 1, cy = 1, rowH = 0;
      for (const d of defs) {
        const w = d.src.width, h = d.src.height;
        if (cx + w + 1 > size) { cx = 1; cy += rowH + 1; rowH = 0; }
        if (cy + h + 1 > size) return false;
        cx += w + 1; rowH = Math.max(rowH, h);
      }
      return true;
    };
    defs.sort((a, b) => b.src.height - a.src.height);
    const size = pack(1024) ? 1024 : 2048;
    const A = cv(size, size), N = cv(size, size);
    const actx = A.getContext('2d'), nctx = N.getContext('2d');
    actx.imageSmoothingEnabled = false;
    nctx.fillStyle = 'rgb(128,128,255)'; nctx.fillRect(0, 0, size, size);
    const rects = {};
    let cx = 1, cy = 1, rowH = 0;
    for (const d of defs) {
      const w = d.src.width, h = d.src.height;
      if (cx + w + 1 > size) { cx = 1; cy += rowH + 1; rowH = 0; }
      if (cy + h + 1 > size) throw new Error('Atlas cheio');
      let src = d.src;
      if (!(src instanceof HTMLCanvasElement)) { const c = cv(w, h); c.getContext('2d').drawImage(src, 0, 0); src = c; }
      const unlit = /^(glow|shaft|dot)$/.test(d.name);
      const norm = unlit ? null : realNorm[d.name] ? realNorm[d.name] : normalFrom(src, d.name === 'truck' ? 0.9 : 1.1, d.name === 'truck' ? 2.8 : 2.2);
      actx.drawImage(src, cx, cy);
      if (norm) { nctx.clearRect(cx, cy, w, h); nctx.drawImage(norm, cx, cy); }
      rects[d.name] = { x: cx, y: cy, w, h };
      cx += w + 1; rowH = Math.max(rowH, h);
    }
    return { set: r.texSet(A, N, { linear: true }), rects, size, albedo: A };
  };
})();
