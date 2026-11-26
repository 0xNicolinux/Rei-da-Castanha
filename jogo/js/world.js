/* Rei da Castanha — pintura procedural do mundo:
   terreno por texel (solo, grama, raízes, pedras) com normal map de relevo,
   galhos-plataforma únicos e camadas de fundo (montanhas, matas, troncos) em tons de cinza
   que o shader tinge conforme a hora do dia de cada fase. */
(function () {
  'use strict';
  const RC = window.RC;
  const { clamp, cv } = RC;

  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);
  const SOIL = ['#22110b', '#38200f', '#4e2c18', '#693c22', '#855030', '#a66b3c'].map(rgb);
  const STONE = ['#2c2226', '#4a3d40', '#6f6068', '#9a8a88'].map(rgb);
  const MUSH_STEM = ['#c9b896', '#efe3c4'].map(rgb);
  const BARK = ['#24110a', '#3b1e10', '#55301a', '#7a4826', '#9d6234', '#c08648'].map(rgb);

  /* ---------------------------------------------------------------- TERRENO */
  RC.paintTerrain = function (r, level, mood) {
    const TL = 16, TH = 270, CW = 1024;
    const total = level.cols * TL;
    const noise = RC.makeNoise(level.genSeed * 13 + level.index * 7 + 5);
    const surf = new Int32Array(total);
    for (let x = 0; x < total; x++) { const g = level.ground[Math.floor(x / TL)]; surf[x] = g < 0 ? 99999 : g * TL; }
    const SURF = (x) => (x < 0 ? -1 : x >= total ? -1 : surf[x]);        // fora do mundo = parede sólida
    const gthick = new Uint8Array(total), blade = new Uint8Array(total), wmax = new Int32Array(total);
    for (let x = 0; x < total; x++) {
      gthick[x] = 4 + Math.floor(noise.n2(x * 0.33, 3.3) * 4.2);
      const h = RC.hash2(x, 7, level.index);
      blade[x] = h < 0.3 ? 0 : h < 0.55 ? 1 : h < 0.78 ? 2 : h < 0.93 ? 3 : 5;
    }
    for (let x = 0; x < total; x++) {
      let m = 0; for (let k = -5; k <= 5; k++) { const s = SURF(x + k); if (s < 90000) m = Math.max(m, s); else m = 99999; if (m === 99999) break; }
      wmax[x] = m;
    }
    const GR = mood.grass.map(rgb);
    const chunks = [];
    for (let x0 = 0; x0 < total; x0 += CW) {
      const w = Math.min(CW, total - x0);
      const img = new Uint8ClampedArray(w * TH * 4);
      const H = new Float32Array(w * TH);
      const A = new Uint8Array(w * TH);
      const put = (lx, ty, col, a, hh) => {
        const i = ty * w + lx; img[i * 4] = col[0]; img[i * 4 + 1] = col[1]; img[i * 4 + 2] = col[2]; img[i * 4 + 3] = 255;
        A[i] = 255; if (hh !== undefined) H[i] = hh;
      };
      for (let ty = 0; ty < TH; ty++) {
        for (let lx = 0; lx < w; lx++) {
          const gx = x0 + lx, s = surf[gx];
          if (ty < s) {
            // lâminas de grama acima da superfície
            const bh = blade[gx];
            if (s < 90000 && bh && ty >= s - bh && ty < s) {
              const k = s - ty;
              put(lx, ty, GR[clamp(k + 1, 1, 5)], 255, 2.5);
            }
            continue;
          }
          const depth = ty - s;
          const up = depth + 1;
          let side = 9;
          if (ty < wmax[gx]) {
            for (let k = 1; k <= 5; k++) { if (ty < SURF(gx - k)) { side = k; break; } }
            for (let k = 1; k <= 5 && k < side; k++) { if (ty < SURF(gx + k)) { side = k; break; } }
          }
          const ad = Math.min(up, side, 7);
          const gt = gthick[gx];
          const bay = BAYER[(ty & 3) * 4 + (gx & 3)];
          let col, hh = Math.min(ad, 6) * 1.1;
          const isGrassTop = up <= gt;
          const isGrassSide = side <= 2 && depth < gt + 4 && side < 9;
          if (isGrassTop || isGrassSide) {
            const k = Math.min(up, side + 0);
            const idx = k <= 1 ? 0 : k === 2 ? 5 : k === 3 ? 4 : k === 4 ? 3 : 2;
            col = GR[clamp(idx + (bay > 0.25 && idx > 1 ? 1 : 0), 0, 5)];
            hh += 1.6;
          } else if (ad === 1) {
            col = SOIL[0];
          } else {
            const n = noise.fbm(gx * 0.05, ty * 0.11, 3);
            let v = n * 6.2 + bay * 1.15 - Math.min(depth / 70, 1) * 2.4 - (ty > TH - 26 ? 1.2 : 0);
            if (ad === 2) v += 0.9;
            // raízes
            if (depth > 6) {
              const rn = Math.abs(noise.n2(gx * 0.034 + ty * 0.013, ty * 0.034) - 0.5);
              if (rn < 0.012) { col = SOIL[5]; v = 99; hh += 1.4; } else if (rn < 0.024) v -= 1.6;
            }
            col = v === 99 ? SOIL[5] : SOIL[clamp(Math.floor(v), 0, 5)];
            hh += (clamp(Math.floor(v), 0, 5)) * 0.35;
          }
          put(lx, ty, col, 255, hh + (noise.n2(gx * 0.3, ty * 0.3) - 0.5) * 0.8);
        }
      }
      // pedras embutidas
      for (let cy = 0; cy < TH; cy += 13) for (let cx = Math.floor(x0 / 15) * 15; cx < x0 + w; cx += 15) {
        const hsh = RC.hash2(cx, cy, 91 + level.index);
        if (hsh > 0.2) continue;
        const px = cx + RC.hash2(cx, cy, 3) * 15, py = cy + RC.hash2(cx, cy, 4) * 13;
        const rx = 1.8 + RC.hash2(cx, cy, 5) * 3, ry = 1.3 + RC.hash2(cx, cy, 6) * 2.2;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) {
          const e = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (e > 1.35) continue;
          const gx = Math.round(px + dx), ty = Math.round(py + dy), lx = gx - x0;
          if (lx < 0 || lx >= w || ty < 0 || ty >= TH || gx >= total) continue;
          const s = surf[gx]; if (ty < s + gthick[gx] + 2) continue;
          if (ty < wmax[gx] || SURF(gx - 4) > ty - 1 || SURF(gx + 4) > ty - 1) continue;
          let c;
          if (e > 1.0) c = STONE[0];
          else { const sh = (-dx / rx - dy / ry) * 0.5 + 1.4; c = STONE[clamp(Math.floor(sh * 1.5), 1, 3)]; }
          put(lx, ty, c, 255, 4.2 - e * 2);
        }
      }
      // franja de musgo pendurada sob a grama + raízes finas que escorrem
      for (let lx = 0; lx < w; lx++) {
        const gx = x0 + lx, sy = surf[gx];
        if (sy > 90000) continue;
        const hh2 = RC.hash2(gx, 21, level.index);
        if (hh2 > 0.34) continue;
        const len = 3 + Math.floor(RC.hash2(gx, 22, level.index) * 9), st = sy + gthick[gx] + 1;
        for (let k = 0; k < len; k++) {
          const ty = st + k + (k > 4 ? 0 : 0), xx = lx + (k > 5 ? Math.round(Math.sin(gx + k * 0.5)) : 0);
          if (ty >= TH || xx < 0 || xx >= w) continue;
          if (surf[x0 + xx] > ty) continue;
          put(xx, ty, GR[clamp(k < 2 ? 2 : k < len - 2 ? 1 : 3, 0, 5)], 255, 2 + (k === len - 1 ? 1 : 0));
        }
      }
      // cogumelos sobre trechos planos (cogumelos claros: leitura imediata da borda)
      for (let lx = 4; lx < w - 4; lx++) {
        const gx = x0 + lx, sy = surf[gx];
        if (sy > 90000 || RC.hash2(gx, 31, level.index) > 0.012) continue;
        let flat = true; for (let k = -4; k <= 4; k++) if (SURF(gx + k) !== sy) flat = false;
        if (!flat) continue;
        const big = RC.hash2(gx, 32, level.index) > 0.5, sh = big ? 6 : 4, cw = big ? 4 : 3;
        const cap = RC.hash2(gx, 33, level.index) > 0.5 ? ['#7a1f2a', '#c23a3a', '#f0805a'].map(rgb) : ['#5a3a70', '#9a62b0', '#d6a0e0'].map(rgb);
        for (let k = 1; k <= sh; k++) put(lx, sy - k, MUSH_STEM[k & 1], 255, 3);
        for (let dx = -cw; dx <= cw; dx++) {
          const hgt = Math.round(Math.sqrt(Math.max(0, 1 - (dx * dx) / (cw * cw + 0.5))) * (big ? 3 : 2)) + 1;
          for (let k = 0; k < hgt; k++) {
            const ty = sy - sh - k;
            if (ty < 0 || lx + dx < 0 || lx + dx >= w) continue;
            const spot = (dx === -1 || dx === 2) && k === hgt - 1 && hgt > 1;
            put(lx + dx, ty, spot ? MUSH_STEM[1] : (k === hgt - 1 ? cap[2] : k === 0 ? cap[0] : cap[1]), 255, 3 + k * 0.6);
          }
        }
      }
      // ruínas de pedra esculpida enterradas (tijolos, argamassa e glifos)
      for (let cy = 50; cy < TH - 12; cy += 40) for (let cx = Math.floor(x0 / 60) * 60; cx < x0 + w; cx += 60) {
        if (RC.hash2(cx, cy, 71 + level.index) > 0.09) continue;
        const bx = cx + Math.floor(RC.hash2(cx, cy, 72) * 20), by = cy + Math.floor(RC.hash2(cx, cy, 73) * 14);
        const bw = 22 + Math.floor(RC.hash2(cx, cy, 74) * 14), bh = 14 + Math.floor(RC.hash2(cx, cy, 75) * 8);
        let ok = true;
        for (let ty = by; ty < by + bh && ok; ty += 4) for (let gx = bx; gx < bx + bw; gx += 4) { if (gx >= total || ty < wmax[Math.min(gx, total - 1)] + 22) { ok = false; break; } }
        if (!ok) continue;
        for (let ty = by; ty < by + bh; ty++) for (let gx = bx; gx < bx + bw; gx++) {
          const lx = gx - x0; if (lx < 0 || lx >= w || ty >= TH) continue;
          const row = Math.floor((ty - by) / 5), off = (row & 1) * 5, mortar = (ty - by) % 5 === 4 || (gx - bx + off) % 10 === 9;
          const edge = ty === by || gx === bx || ty === by + bh - 1 || gx === bx + bw - 1;
          const top = ty - by < 2;
          const sh = mortar || edge ? 0 : clamp(1 + (RC.hash2(gx, ty, 76) > 0.7 ? 1 : 0) + (top ? 1 : 0) + ((gx - bx + off) % 10 < 2 ? 1 : 0), 1, 3);
          put(lx, ty, STONE[sh], 255, mortar || edge ? 1.2 : 4 + (top ? 0.8 : 0));
        }
        // glifo entalhado no centro
        const gcx = bx + (bw >> 1), gcy = by + (bh >> 1);
        const glyph = [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [-2, -1], [-1, -1], [1, 0], [2, 0], [-1, 2], [1, 2]];
        for (const [dx, dy] of glyph) { const lx = gcx + dx - x0; if (lx >= 0 && lx < w) put(lx, gcy + dy, STONE[3], 255, 0.6); }
      }
      const albedo = cv(w, TH);
      albedo.getContext('2d').putImageData(new ImageData(img, w, TH), 0, 0);
      const normal = RC.normalFromHeight(H, w, TH, A, 0.9);
      chunks.push({ x0: x0 * 2, w: w * 2, set: r.texSet(albedo, normal, { linear: true }), texW: w, texH: TH });
    }
    return chunks;
  };

  /* ----------------------------------------------------------------- GALHOS */
  RC.paintBranches = function (r, level, mood) {
    const GR = mood.grass.map(rgb);
    const noise = RC.makeNoise(level.genSeed * 5 + 11);
    const items = level.platforms.map((p, i) => {
      const wT = Math.round(p.w / 2);                // largura em texels (1 texel = 2 unidades)
      const W = wT + 14, Hh = 38;
      const img = new Uint8ClampedArray(W * Hh * 4), H = new Float32Array(W * Hh), A = new Uint8Array(W * Hh);
      const cy = 17, rad = 7.2;                        // centro e raio do tronco
      const set = (x, y, c, hh) => { if (x < 0 || x >= W || y < 0 || y >= Hh) return; const k = y * W + x; img[k * 4] = c[0]; img[k * 4 + 1] = c[1]; img[k * 4 + 2] = c[2]; img[k * 4 + 3] = 255; A[k] = 255; H[k] = hh; };
      const seed = i * 17 + level.index * 3;
      const x0 = 4, x1 = 4 + wT;                       // extensão colisora em texels
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        // ponta arredondada nas duas extremidades
        const capL = Math.max(0, (x0 - x) / 4), capR = Math.max(0, (x - (x1 - 1)) / 4);
        const cap = Math.max(capL, capR);
        const rr = rad * Math.sqrt(Math.max(0, 1 - cap * cap)) + (noise.n2(x * 0.2 + seed, 1.7) - 0.5) * 1.2;
        const dy = y - cy;
        if (Math.abs(dy) > rr || x < x0 - 4 || x > x1 + 3) continue;
        const sh = Math.sqrt(Math.max(0, 1 - (dy / rr) * (dy / rr)));
        // luz vinda de cima
        let v = (1 - (dy / rr + 1) * 0.5) * 3.2 + noise.fbm(x * 0.07 + seed, y * 0.5, 3) * 2.4 - 0.7;
        v += BAYER[(y & 3) * 4 + (x & 3)] * 1.1;
        let edge = Math.abs(dy) > rr - 1.1 || cap > 0.82;
        const c = edge ? BARK[0] : BARK[clamp(Math.floor(v), 1, 5)];
        set(x, y, c, sh * 5 + noise.n2(x * 0.4, y * 0.4) * 0.8);
      }
      // musgo no topo
      for (let x = x0 - 2; x < x1 + 2; x++) {
        const th = 3 + Math.floor(noise.n2(x * 0.45 + seed, 9.1) * 3.2);
        const top = Math.round(cy - rad * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, x0 - x, x - (x1 - 1)) / 4, 2))));
        for (let k = 0; k < th; k++) {
          const y = top + k;
          if (!A[y * W + x]) continue;
          const idx = k === 0 ? 0 : k === 1 ? 5 : k === 2 ? 4 : k === 3 ? 3 : 2;
          set(x, y, GR[idx], 5.5 - k * 0.3);
        }
      }
      // nó de madeira
      const kn = x0 + 4 + Math.floor(RC.hash2(i, 1, 5) * Math.max(1, wT - 8));
      for (let a = -3; a <= 3; a++) for (let b = -2; b <= 2; b++) {
        const e = (a * a) / 9 + (b * b) / 4;
        if (e <= 1 && A[(cy + 2 + b) * W + kn + a]) set(kn + a, cy + 2 + b, e > 0.55 ? BARK[0] : BARK[1], 3 + e);
      }
      // raízes/trepadeiras penduradas
      for (let v = 0; v < Math.max(2, wT / 14); v++) {
        const vx = x0 + 2 + Math.floor(RC.hash2(i, v, 8) * (wT - 4)), len = 5 + Math.floor(RC.hash2(i, v, 9) * 11);
        for (let k = 0; k < len; k++) {
          const xx = vx + Math.round(Math.sin(k * 0.6 + v) * 1.0), yy = cy + Math.round(rad) - 1 + k;
          set(xx, yy, k % 5 === 4 ? GR[3] : GR[1], 1);
        }
        set(vx, cy + Math.round(rad) + len, GR[4], 1);
      }
      const c = cv(W, Hh);
      c.getContext('2d').putImageData(new ImageData(img, W, Hh), 0, 0);
      const n = RC.normalFromHeight(H, W, Hh, A, 0.95);
      return { c, n, W, Hh, tops: cy - rad - 3 };
    });
    // empacota
    const size = 1024; let cx = 1, cy = 1, rowH = 0;
    for (const it of items) { if (cx + it.W + 1 > size) { cx = 1; cy += rowH + 1; rowH = 0; } it.x = cx; it.y = cy; cx += it.W + 1; rowH = Math.max(rowH, it.Hh); }
    const hTot = Math.min(size, Math.max(64, Math.pow(2, Math.ceil(Math.log2(cy + rowH + 2)))));
    const A = cv(size, hTot), N = cv(size, hTot);
    const ac = A.getContext('2d'), nc = N.getContext('2d');
    nc.fillStyle = 'rgb(128,128,255)'; nc.fillRect(0, 0, size, hTot);
    for (const it of items) { ac.drawImage(it.c, it.x, it.y); nc.clearRect(it.x, it.y, it.W, it.Hh); nc.drawImage(it.n, it.x, it.y); }
    return { set: r.texSet(A, N, { linear: true }), items, topTexel: 17 - 7.2 };
  };

  /* ---------------------------------------------------------- FUNDOS PINTADOS */
  const P = 2048, PH = 540;
  function g(L, a) { const v = Math.round(clamp(L, 0, 1) * 255); return a === undefined ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${a})`; }
  function wrap(ctx, x, ext, fn) { fn(x); if (x - ext < 0) fn(x + P); if (x + ext > P) fn(x - P); }

  function blurWrap(src, px) {
    const w = src.width, h = src.height;
    const big = cv(w * 3, h), bx = big.getContext('2d');
    bx.drawImage(src, 0, 0); bx.drawImage(src, w, 0); bx.drawImage(src, w * 2, 0);
    const out = cv(w * 3, h), ox = out.getContext('2d');
    ox.filter = `blur(${px}px)`; ox.drawImage(big, 0, 0);
    const res = cv(w, h); res.getContext('2d').drawImage(out, -w, 0);
    return res;
  }

  function canopyBlob(ctx, x, y, rad, L, hi) {
    wrap(ctx, x, rad, (xx) => {
      const gr = ctx.createRadialGradient(xx - rad * 0.3, y - rad * 0.38, rad * 0.1, xx, y, rad);
      gr.addColorStop(0, g(hi)); gr.addColorStop(0.55, g(L)); gr.addColorStop(1, g(L * 0.62));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(xx, y, rad, 0, Math.PI * 2); ctx.fill();
    });
  }
  /* Tufo de folhas irregular (couve-flor): base escura + lóbulos iluminados no canto da luz. */
  function leafClump(ctx, rnd, x, y, rad, L, hi) {
    wrap(ctx, x, rad * 1.6, (xx) => {
      ctx.fillStyle = g(L * 0.62); ctx.beginPath(); ctx.arc(xx, y, rad, 0, 7); ctx.fill();
      const lobes = 7 + Math.floor(rnd() * 3);
      for (let k = 0; k < lobes; k++) {
        const a = (k / lobes) * 6.283 + rnd() * 0.5, d = rad * (0.45 + rnd() * 0.25), r2 = rad * (0.38 + rnd() * 0.2);
        const lx = xx + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.9;
        const lit = clamp(0.5 - (Math.cos(a) * 0.5 + Math.sin(a) * 0.7) * 0.5, 0, 1);
        const gr = ctx.createRadialGradient(lx - r2 * 0.35, ly - r2 * 0.4, r2 * 0.1, lx, ly, r2);
        gr.addColorStop(0, g(L + (hi - L) * (0.55 + lit * 0.45))); gr.addColorStop(0.6, g(L * (0.78 + lit * 0.3))); gr.addColorStop(1, g(L * 0.6));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(lx, ly, r2, 0, 7); ctx.fill();
      }
      for (let k = 0; k < 7; k++) {
        const a = rnd() * 6.283, d = rnd() * rad * 0.8;
        ctx.fillStyle = g(hi + 0.1, 0.5); ctx.fillRect(xx + Math.cos(a) * d - 3 - rad * 0.12, y + Math.sin(a) * d * 0.8 - 3 - rad * 0.14, 2 + rnd() * 3, 2 + rnd() * 2);
      }
    });
  }

  function paintMountains(seed) {
    const c = cv(P, PH), x = c.getContext('2d'); const n = RC.makeNoise(seed);
    const ridges = [{ base: 250, amp: 130, f: 3, L: 0.9, lo: 0.7 }, { base: 320, amp: 100, f: 5, L: 0.62, lo: 0.42 }];
    ridges.forEach((rd, i) => {
      const gr = x.createLinearGradient(0, rd.base - rd.amp, 0, PH);
      gr.addColorStop(0, g(rd.L)); gr.addColorStop(1, g(rd.lo));
      x.fillStyle = gr; x.beginPath(); x.moveTo(0, PH);
      const pts = [];
      for (let px = 0; px <= P; px += 4) {
        const v = n.fbm((px / P) * rd.f + i * 7, 0.5 + i, 5, rd.f);
        const py = rd.base - rd.amp * (v - 0.25) * 1.5; pts.push([px, py]); x.lineTo(px, py);
      }
      x.lineTo(P, PH); x.closePath(); x.fill();
      // luz de contorno
      x.strokeStyle = g(Math.min(1, rd.L + 0.12), 0.55); x.lineWidth = 2; x.beginPath();
      pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1] + 1) : x.moveTo(p[0], p[1] + 1))); x.stroke();
      // veios
      x.globalAlpha = 0.12; x.strokeStyle = g(0.2);
      for (let k = 0; k < 60; k++) {
        const px = ((k * 137.5 + i * 53) % P), v = n.fbm((px / P) * rd.f + i * 7, 0.5 + i, 5, rd.f), py = rd.base - rd.amp * (v - 0.25) * 1.5;
        x.beginPath(); x.moveTo(px, py + 4); x.lineTo(px + 14 + (k % 5) * 6, py + 60 + (k % 7) * 12); x.lineWidth = 3 + (k % 3); x.stroke();
      }
      x.globalAlpha = 1;
    });
    return blurWrap(c, 2.2);
  }

  function paintFarForest(seed) {
    const c = cv(P, PH), x = c.getContext('2d'); const rnd = RC.mulberry32(seed), n = RC.makeNoise(seed + 3);
    x.fillStyle = g(0.3); x.fillRect(0, 440, P, 100);
    // massa de copas
    for (let px = 0; px < P; px += 20) {
      const base = 410 - 36 * n.fbm((px / P) * 6, 2.2, 4, 6);
      leafClump(x, rnd, px + rnd() * 14, base + rnd() * 10, 30 + rnd() * 26, 0.34 + rnd() * 0.08, 0.66 + rnd() * 0.12);
    }
    // coníferas
    for (let k = 0; k < 34; k++) {
      const px = rnd() * P, top = 285 + rnd() * 70, hgt = 440 - top, wd = 22 + rnd() * 16;
      wrap(x, px, wd, (xx) => {
        const tiers = 5;
        for (let t = 0; t < tiers; t++) {
          const ty = top + (hgt * t) / (tiers + 0.8), th = (hgt / tiers) * 1.5, tw = wd * (0.35 + (t / tiers) * 0.85);
          const gr = x.createLinearGradient(xx - tw, 0, xx + tw, 0);
          gr.addColorStop(0, g(0.58)); gr.addColorStop(0.5, g(0.34)); gr.addColorStop(1, g(0.2));
          x.fillStyle = gr; x.beginPath(); x.moveTo(xx, ty); x.lineTo(xx + tw, ty + th); x.lineTo(xx - tw, ty + th); x.closePath(); x.fill();
        }
      });
    }
    return blurWrap(c, 1.6);
  }

  function paintMidTrees(seed) {
    const c = cv(P, PH), x = c.getContext('2d'); const rnd = RC.mulberry32(seed);
    x.fillStyle = g(0.2); x.fillRect(0, 490, P, 60);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const px = (i + 0.5) * (P / count) + (rnd() - 0.5) * 70;
      const kind = rnd() < 0.62 ? 'oak' : rnd() < 0.6 ? 'tall' : 'pine';
      const tw = (kind === 'tall' ? 16 : 22) + rnd() * 14, top = (kind === 'pine' ? 150 : 200) + rnd() * 80;
      wrap(x, px, 170, (xx) => {
        const gr = x.createLinearGradient(xx - tw / 2, 0, xx + tw / 2, 0);
        gr.addColorStop(0, g(0.5)); gr.addColorStop(0.35, g(0.3)); gr.addColorStop(1, g(0.12));
        x.fillStyle = gr; x.beginPath();
        x.moveTo(xx - tw * 0.5, 545); x.lineTo(xx - tw * 0.3, top + 60); x.lineTo(xx + tw * 0.3, top + 60); x.lineTo(xx + tw * 0.5, 545);
        x.closePath(); x.fill();
        x.beginPath(); x.moveTo(xx - tw * 1.2, 545); x.quadraticCurveTo(xx - tw * 0.4, 505, xx - tw * 0.5, 470); x.lineTo(xx + tw * 0.5, 470);
        x.quadraticCurveTo(xx + tw * 0.4, 505, xx + tw * 1.2, 545); x.fill();
        if (kind !== 'pine') {
          x.strokeStyle = g(0.2); x.lineWidth = 6; x.lineCap = 'round';
          x.beginPath(); x.moveTo(xx, top + 100); x.lineTo(xx - 60, top + 20); x.moveTo(xx, top + 110); x.lineTo(xx + 66, top + 26); x.moveTo(xx, top + 80); x.lineTo(xx + 6, top - 10); x.stroke();
        }
      });
      if (kind === 'pine') {
        wrap(x, px, 90, (xx) => {
          const tiers = 7;
          for (let t = 0; t < tiers; t++) {
            const ty = top + t * 42, tw2 = 30 + t * 14, th = 70;
            const gr2 = x.createLinearGradient(xx - tw2, 0, xx + tw2, 0);
            gr2.addColorStop(0, g(0.68)); gr2.addColorStop(0.45, g(0.34)); gr2.addColorStop(1, g(0.14));
            x.fillStyle = gr2; x.beginPath(); x.moveTo(xx, ty); x.lineTo(xx + tw2, ty + th); x.quadraticCurveTo(xx, ty + th - 14, xx - tw2, ty + th); x.closePath(); x.fill();
          }
        });
      } else {
        const rx = kind === 'tall' ? 62 : 118, ry = kind === 'tall' ? 90 : 66, nb = kind === 'tall' ? 20 : 34;
        for (let b = 0; b < nb; b++) {
          const a = rnd() * 6.283, d = Math.sqrt(rnd());
          leafClump(x, rnd, px + Math.cos(a) * d * rx, top + 20 + Math.sin(a) * d * ry, 17 + rnd() * 17, 0.3 + rnd() * 0.08, 0.7 + rnd() * 0.16);
        }
      }
    }
    return blurWrap(c, 0.8);
  }

  function paintNearTrunks(seed) {
    const c = cv(P, PH), x = c.getContext('2d'); const rnd = RC.mulberry32(seed);
    const count = 3;
    for (let i = 0; i < count; i++) {
      const px = (i + 0.5) * (P / count) + (rnd() - 0.5) * 140;
      const tw = 96 + rnd() * 40;
      wrap(x, px, tw * 1.3, (xx) => {
        const gr = x.createLinearGradient(xx - tw / 2, 0, xx + tw / 2, 0);
        gr.addColorStop(0, g(0.46)); gr.addColorStop(0.25, g(0.3)); gr.addColorStop(0.7, g(0.14)); gr.addColorStop(1, g(0.07));
        x.fillStyle = gr; x.beginPath();
        x.moveTo(xx - tw * 0.5, -10); x.lineTo(xx - tw * 0.52, 400); x.quadraticCurveTo(xx - tw * 0.6, 500, xx - tw * 0.95, 545);
        x.lineTo(xx + tw * 0.95, 545); x.quadraticCurveTo(xx + tw * 0.6, 500, xx + tw * 0.52, 400); x.lineTo(xx + tw * 0.5, -10); x.closePath(); x.fill();
        // casca
        for (let k = 0; k < 46; k++) {
          const gx = xx - tw * 0.48 + rnd() * tw * 0.96;
          x.strokeStyle = g(rnd() < 0.45 ? 0.62 : 0.02, 0.3 + rnd() * 0.3); x.lineWidth = 1.5 + rnd() * 3;
          x.beginPath(); x.moveTo(gx, -10); x.bezierCurveTo(gx + (rnd() - 0.5) * 18, 140, gx + (rnd() - 0.5) * 22, 300, gx + (rnd() - 0.5) * 16, 540); x.stroke();
        }
        // musgo
        for (let k = 0; k < 9; k++) {
          const my = 160 + rnd() * 330, mx = xx - tw * 0.5 + rnd() * tw * 0.4;
          for (let q2 = 0; q2 < 7; q2++) { x.fillStyle = g(0.6 + rnd() * 0.2, 0.55); x.beginPath(); x.ellipse(mx + (rnd() - 0.5) * 22, my + (rnd() - 0.5) * 40, 2 + rnd() * 5, 3 + rnd() * 6, rnd() * 3, 0, 7); x.fill(); }
        }
        // trepadeiras
        for (let k = 0; k < 3; k++) {
          const vx = xx - tw * 0.7 + rnd() * tw * 1.4, len = 110 + rnd() * 160;
          x.strokeStyle = g(0.2); x.lineWidth = 2.6; x.beginPath(); x.moveTo(vx, 0);
          for (let t = 0; t <= len; t += 8) x.lineTo(vx + Math.sin(t * 0.045 + k) * 5, t); x.stroke();
          for (let t = 20; t < len; t += 18) { x.fillStyle = g(0.55, 0.9); x.beginPath(); x.ellipse(vx + Math.sin(t * 0.045 + k) * 5 + 4, t, 4, 2.2, 0.6, 0, 7); x.fill(); }
        }
      });
    }
    // dossel escuro no topo
    for (let px = 0; px < P; px += 34) {
      const r0 = 30 + rnd() * 34;
      leafClump(x, rnd, px + rnd() * 20, -24 + rnd() * 36, r0, 0.14 + rnd() * 0.05, 0.34 + rnd() * 0.1);
    }
    for (let k = 0; k < 12; k++) { const px = rnd() * P, len = 30 + rnd() * 60; leafClump(x, rnd, px, 24 + len * 0.4, 12 + rnd() * 12, 0.14, 0.36); }
    // samambaias na base
    for (let k = 0; k < 14; k++) {
      const px = rnd() * P, by = 536;
      wrap(x, px, 70, (xx) => {
        for (let f = 0; f < 9; f++) {
          const a = -Math.PI * (0.12 + 0.76 * (f / 8)), len = 46 + rnd() * 30;
          x.strokeStyle = g(0.12 + rnd() * 0.3); x.lineWidth = 3; x.beginPath(); x.moveTo(xx, by);
          x.quadraticCurveTo(xx + Math.cos(a) * len * 0.6, by + Math.sin(a) * len * 1.0, xx + Math.cos(a) * len, by + Math.sin(a) * len * 0.55 + 14); x.stroke();
        }
      });
    }
    return blurWrap(c, 1.0);
  }

  function paintForeground(seed) {
    const c = cv(P, PH), x = c.getContext('2d'); const rnd = RC.mulberry32(seed);
    const leaf = (cx, cy, len, ang, L) => {
      x.save(); x.translate(cx, cy); x.rotate(ang);
      x.fillStyle = g(L); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * 0.5, -len * 0.3, len, 0); x.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0); x.fill();
      x.strokeStyle = g(L + 0.18, 0.6); x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, 0); x.lineTo(len * 0.92, 0); x.stroke();
      x.restore();
    };
    for (let k = 0; k < 16; k++) {
      const px = rnd() * P, by = 556;
      wrap(x, px, 150, (xx) => { for (let f = 0; f < 6; f++) leaf(xx, by, 34 + rnd() * 52, -Math.PI * (0.15 + 0.7 * rnd()), 0.04 + rnd() * 0.1); });
    }
    for (let k = 0; k < 10; k++) {
      const px = rnd() * P;
      wrap(x, px, 150, (xx) => { for (let f = 0; f < 6; f++) leaf(xx, -20, 40 + rnd() * 70, Math.PI * (0.18 + 0.64 * rnd()), 0.04 + rnd() * 0.1); });
    }
    for (let k = 0; k < 110; k++) {
      const px = rnd() * P, h = 14 + rnd() * 36;
      wrap(x, px, 20, (xx) => { x.strokeStyle = g(0.05 + rnd() * 0.08); x.lineWidth = 2 + rnd() * 2; x.beginPath(); x.moveTo(xx, 545); x.quadraticCurveTo(xx + (rnd() - 0.5) * 24, 545 - h * 0.6, xx + (rnd() - 0.5) * 40, 545 - h); x.stroke(); });
    }
    return blurWrap(c, 2.4);
  }

  RC.paintBackgrounds = function (r, seed) {
    return {
      mountains: r.texSet(paintMountains(seed + 1), null, { linear: true, repeat: true }),
      far: r.texSet(paintFarForest(seed + 2), null, { linear: true, repeat: true }),
      mid: r.texSet(paintMidTrees(seed + 3), null, { linear: true, repeat: true }),
      near: r.texSet(paintNearTrunks(seed + 4), null, { linear: true, repeat: true }),
      fore: r.texSet(paintForeground(seed + 5), null, { linear: true, repeat: true }),
      tile: P, h: PH
    };
  };
})();
