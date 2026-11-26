/* Rei da Castanha — utilidades: RNG com semente, ruído, helpers matemáticos.
   Funciona no navegador (window.RC) e no Node (para os testes do gerador). */
(function (root) {
  'use strict';
  const RC = root.RC = root.RC || {};

  RC.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  RC.hash2 = function (x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s | 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /* Barramento de eventos: módulos (missões, efeitos, HUD) se plugam no jogo sem editar game.js.
     Eventos: stageLoaded(lv) stageStart(stage) update(dt) enemyKilled(e, how) nutTaken(n) checkpoint(c)
     playerHurt() finish(stage) drawBehind(t, cam) drawFront(t, cam) drawAdd(t, cam) drawHud(t). */
  RC.events = (function () {
    const map = {};
    return {
      on(name, fn) { (map[name] = map[name] || []).push(fn); return () => this.off(name, fn); },
      off(name, fn) { const l = map[name]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
      emit(name, ...args) {
        const l = map[name]; if (!l) return;
        for (const fn of l.slice()) { try { fn(...args); } catch (err) { console.error(`[evento ${name}]`, err); } }
      }
    };
  })();

  RC.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  RC.lerp = (a, b, t) => a + (b - a) * t;
  RC.smooth = (t) => t * t * (3 - 2 * t);

  /* Ruído de valor 2D, opcionalmente periódico em X (para texturas que emendam). */
  RC.makeNoise = function (seed) {
    const s = seed | 0;
    function n2(x, y, period) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const wrap = (i) => (period ? ((i % period) + period) % period : i);
      const a = RC.hash2(wrap(xi), yi, s), b = RC.hash2(wrap(xi + 1), yi, s);
      const c = RC.hash2(wrap(xi), yi + 1, s), d = RC.hash2(wrap(xi + 1), yi + 1, s);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct, period) {
      let amp = 0.5, f = 1, sum = 0, norm = 0;
      for (let i = 0; i < (oct || 4); i++) {
        sum += amp * n2(x * f, y * f, period ? period * f : 0);
        norm += amp; amp *= 0.5; f *= 2;
      }
      return sum / norm;
    }
    return { n2, fbm };
  };
})(typeof window !== 'undefined' ? window : globalThis);
