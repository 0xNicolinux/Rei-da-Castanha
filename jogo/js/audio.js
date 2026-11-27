/* Rei da Castanha — motor de música e som procedural (Web Audio, sem arquivos).
   Uma peça original por humor + tema do título. Camadas adaptativas:
   calma (pad, cravo, baixo, melodia) sempre ligada; "drive" (bateria, baixo em colcheias,
   metais) entra conforme a intensidade (velocidade do jogador / inimigos por perto). */
(function () {
  'use strict';
  const RC = (window.RC = window.RC || {});

  /* ---------------------------------------------------------------- utilitários */
  const dbToGain = (db) => Math.pow(10, db / 20);
  const fin = (x, d) => (Number.isFinite(x) ? x : d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rr = (a, b) => a + Math.random() * (b - a);
  // define valor de AudioParam sem nunca enviar NaN
  function setP(p, v, t, tc) {
    v = fin(v, 0);
    if (tc) p.setTargetAtTime(v, t, tc); else p.setValueAtTime(v, t);
  }

  let ctx = null, master, comp, limiter, musicBus, musicLP, sfxBus, revIn, noiseBuf = null;
  let unlocked = false, enabled = true, paused = false;
  let want = null;           // cena desejada: 0..4, 'title' ou null
  let cur = null;            // tema tocando { key, th, bus, step, nextT, bar }
  let timer = 0;
  let intensity = 0, target = 0, lastTick = 0;
  let voices = 0, maxVoices = 0;

  /* ---------------------------------------------------------------- composição */
  const SC = {
    dorian: [0, 2, 3, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11]
  };
  // padrões de arpejo (índice no acorde [c0,c1,c2,c0+oit]; -1 = pausa)
  const ARP = {
    A: [0, -1, 1, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 2, -1],
    B: [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 1, 2, 3],
    C: [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1]
  };
  // baixo do drive: [passo, 0 raiz | 1 quinta | 2 oitava]
  const BASS = {
    march: [[0, 0], [2, 2], [4, 1], [6, 2], [8, 0], [10, 2], [12, 1], [14, 2]],
    flow: [[0, 0], [6, 2], [8, 1], [14, 2]],
    pulse: [[0, 0], [3, 0], [6, 2], [8, 1], [11, 0], [14, 2]]
  };
  const THEMES = {
    // 0 amanhecer: Ré dórico, esperançoso e delicado
    0: {
      name: 'amanhecer', bpm: 84, root: 50, scale: SC.dorian, lead: 'flute', arp: ARP.A, bass: BASS.flow,
      prog: [0, 6, 3, 0, 1, 6, 4, 4],
      mel: ['0:4:3 4:2:1 5:4:3 8:7:6 14:6:2', '0:6:3 4:4:1 5:3:3 8:1:6', '0:5:3 4:3:2 6:5:2 8:7:6', '0:4:4 4:2:2 6:0:2 8:2:8',
        '0:5:3 4:3:1 5:5:3 8:8:6 14:7:2', '0:6:3 4:8:1 5:6:3 8:4:6 14:3:2', '0:4:3 4:6:1 5:8:3 8:6:4 12:4:4', '0:4:8 8:3:4 12:4:4'],
      kick: [0, 10], snare: [8], hat: [0, 4, 8, 12], stab: [4, 12], drumVel: 0.7
    },
    // 1 mata fechada: Mi menor, marcha enérgica com metais
    1: {
      name: 'mata', bpm: 116, root: 52, scale: SC.minor, lead: 'violin', arp: ARP.B, bass: BASS.march,
      prog: [0, 5, 6, 0, 3, 5, 6, 4],
      mel: ['0:4:2 3:4:1 4:2:2 6:0:2 8:2:2 10:4:2 12:7:4', '0:5:2 3:5:1 4:4:2 6:2:2 8:5:2 10:7:2 12:7:4',
        '0:6:2 3:6:1 4:3:2 6:1:2 8:3:2 10:6:2 12:8:4', '0:7:6 6:6:2 8:4:4 12:2:4',
        '0:3:2 3:3:1 4:5:2 6:7:2 8:5:2 10:3:2 12:7:4', '0:5:2 3:5:1 4:7:2 6:9:2 8:7:2 10:5:2 12:4:4',
        '0:6:2 3:6:1 4:8:2 6:6:2 8:3:2 10:6:2 12:8:4', '0:4:2 4:6:2 8:4:2 10:6:2 12:4:4'],
      kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], stab: [4, 12], drumVel: 1
    },
    // 2 pôr do sol: Lá menor, calor melancólico
    2: {
      name: 'por-do-sol', bpm: 100, root: 45, scale: SC.minor, lead: 'violin', arp: ARP.A, bass: BASS.pulse,
      prog: [0, 5, 2, 6, 0, 3, 4, 0],
      mel: ['0:4:4 4:7:2 6:4:2 8:9:8', '0:9:4 4:7:2 6:5:2 8:7:8', '0:11:3 3:9:1 4:7:4 8:9:6 14:7:2', '0:8:4 4:6:2 6:8:2 8:10:8',
        '0:9:3 3:7:1 4:4:4 8:7:4 12:9:4', '0:7:4 4:5:2 6:3:2 8:5:4 12:7:4', '0:8:3 3:6:1 4:4:4 8:6:2 10:8:2 12:11:4', '0:9:6 6:7:2 8:4:8'],
      kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], stab: [0, 6, 10], drumVel: 0.9
    },
    // 3 hora azul: Fá# menor, esparso, caixinha de música
    3: {
      name: 'hora-azul', bpm: 72, root: 54, scale: SC.minor, lead: 'bell', arp: ARP.C, bass: BASS.flow,
      prog: [0, 5, 3, 4, 0, 5, 6, 0],
      mel: ['0:4:6 8:2:4 12:0:4', '0:5:6 8:7:4 12:9:4', '0:7:6 8:5:4 12:3:4', '0:6:4 6:8:2 8:4:8',
        '0:4:4 4:2:2 6:4:2 8:7:8', '0:9:4 4:7:2 6:5:2 8:7:8', '0:8:4 4:10:2 6:8:2 8:6:8', '0:4:12'],
      kick: [0, 8], snare: [12], hat: [4, 12], stab: [8], drumVel: 0.55
    },
    // 4 festa ao luar: Sol menor harmônico, animado e festivo
    4: {
      name: 'festa-lunar', bpm: 128, root: 43, scale: SC.harm, lead: 'brass', arp: ARP.B, bass: BASS.march,
      prog: [0, 3, 4, 0, 5, 3, 4, 0],
      mel: ['0:7:2 2:9:2 4:11:2 6:9:2 8:7:4 12:4:2 14:7:2', '0:10:2 2:8:2 4:10:2 6:12:2 8:10:4 12:8:2 14:7:2',
        '0:11:2 2:13:2 4:15:2 6:13:2 8:11:4 12:13:4', '0:11:6 6:9:2 8:7:4 12:4:4',
        '0:12:2 2:11:2 4:9:2 6:7:2 8:9:4 12:12:4', '0:10:2 2:8:2 4:7:2 6:5:2 8:7:4 12:10:4',
        '0:11:2 4:13:2 6:11:2 8:8:2 10:11:2 12:13:4', '0:7:8 8:9:2 10:11:2 12:7:4'],
      kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], stab: [2, 6, 10, 14], drumVel: 1
    },
    // título: Lá menor, lento, cravo e cordas
    title: {
      name: 'titulo', bpm: 76, root: 45, scale: SC.minor, lead: 'violin', arp: ARP.A, bass: BASS.flow,
      prog: [0, 3, 5, 4, 0, 3, 4, 0],
      mel: ['0:7:6 6:9:2 8:11:6 14:9:2', '0:10:4 4:9:2 6:7:2 8:5:8', '0:9:4 4:7:2 6:9:2 8:12:8', '0:11:6 6:8:2 8:6:4 12:8:4',
        '0:7:4 4:9:4 8:11:4 12:14:4', '0:10:6 6:12:2 8:10:4 12:7:4', '0:8:4 4:11:4 8:10:2 10:8:2 12:6:4', '0:7:12'],
      kick: [], snare: [], hat: [], stab: [], drumVel: 0, noDrive: true
    }
  };
  // pré-processa melodias "passo:grau:duração"
  Object.keys(THEMES).forEach((k) => {
    const th = THEMES[k];
    th.melP = th.mel.map((s) => s.split(' ').map((tok) => { const p = tok.split(':').map(Number); return { s: p[0], d: p[1], l: p[2] }; }));
    th.kickS = new Set(th.kick); th.snareS = new Set(th.snare); th.hatS = new Set(th.hat); th.stabS = new Set(th.stab);
  });
  // grau da escala (pode ser negativo/oitavas) -> nota MIDI
  function degMidi(th, d) {
    const n = th.scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n;
    return th.root + th.scale[i] + 12 * o;
  }

  /* ---------------------------------------------------------------- grafo base */
  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { return false; }
    master = ctx.createGain(); master.gain.value = dbToGain(-2);
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.006; comp.release.value = 0.22;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.08;
    master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);
    musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 18000; musicLP.Q.value = 0.5;
    musicBus = ctx.createGain(); musicBus.gain.value = dbToGain(-7);
    musicBus.connect(musicLP); musicLP.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = dbToGain(-4); sfxBus.connect(master);
    // reverb sintético (ruído com decaimento) para cravo/cordas
    const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 0.32;
    const revLP = ctx.createBiquadFilter(); revLP.type = 'lowpass'; revLP.frequency.value = 3800;
    revIn.connect(conv); conv.connect(revLP); revLP.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    lastTick = ctx.currentTime;
    return true;
  }

  /* ---------------------------------------------------------------- vozes */
  // inicia/para osciladores e solta o grafo quando terminar
  function run(oscs, out, t0, t1) {
    voices++; if (voices > maxVoices) maxVoices = voices;
    oscs.forEach((o) => { o.start(t0); o.stop(t1); });
    oscs[0].onended = () => { voices--; try { out.disconnect(); } catch (_) { /* ok */ } };
  }
  function osc(type, freq, det) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = fin(freq, 440); if (det) o.detune.value = det; return o;
  }
  function lpf(freq, q) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7; return f; }
  function env(g, t, peak, a, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(fin(peak, 0.0001), t + a);
    g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
  }
  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    return s;
  }
  const toRev = (node, amt) => { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(revIn); };

  // cravo: serra + quadrada com filtro que fecha rápido
  function pluck(t, m, vel, dest, dur) {
    dur = dur || 0.55; const f = mtof(m);
    const o1 = osc('sawtooth', f), o2 = osc('square', f, 4), o3 = osc('sawtooth', f * 2, -3);
    const g = ctx.createGain(), fl = lpf(4800, 0.9), g3 = ctx.createGain(); g3.gain.value = 0.35;
    fl.frequency.setValueAtTime(5200, t); fl.frequency.exponentialRampToValueAtTime(1100, t + 0.28);
    o1.connect(fl); o2.connect(fl); o3.connect(g3); g3.connect(fl); fl.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(fin(vel * 0.17, 0.01), t + 0.003);
    g.gain.setTargetAtTime(0.0001, t + 0.004, dur / 4.5);
    toRev(g, 0.5);
    run([o1, o2, o3], g, t, t + dur + 0.3);
  }
  // cordas: serras desafinadas, ataque lento
  function pad(t, ms, dur, vel, dest) {
    const g = ctx.createGain(), fl = lpf(1100, 0.5), oscs = [];
    fl.connect(g); g.connect(dest);
    ms.forEach((m) => { [-8, 8].forEach((d) => { const o = osc('sawtooth', mtof(m), d); o.connect(fl); oscs.push(o); }); });
    const a = Math.min(0.7, dur * 0.35);
    env(g, t, vel * 0.045, a, dur, 0.7);
    toRev(g, 0.6);
    run(oscs, g, t, t + dur + 1.4);
  }
  function bass(t, m, dur, vel, dest, hard) {
    const f = mtof(m), o1 = osc('triangle', f), o2 = osc(hard ? 'sawtooth' : 'square', f), g = ctx.createGain(), fl = lpf(hard ? 520 : 320, 0.8);
    const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(fl); o1.connect(fl); fl.connect(g); g.connect(dest);
    env(g, t, vel * 0.3, 0.012, dur, 0.1);
    run([o1, o2], g, t, t + dur + 0.3);
  }
  function lead(kind, t, m, dur, vel, dest) {
    const f = mtof(m), g = ctx.createGain(), oscs = [];
    if (kind === 'bell') {
      const o1 = osc('sine', f), o2 = osc('sine', f * 3.01), g2 = ctx.createGain(); g2.gain.value = 0.25;
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, Math.min(1.6, dur) / 3.2);
      toRev(g, 0.9); run([o1, o2], g, t, t + Math.min(1.6, dur) * 1.6 + 0.3); return;
    }
    const fl = lpf(kind === 'brass' ? 700 : kind === 'violin' ? 2600 : 2200, 0.6);
    fl.connect(g); g.connect(dest);
    if (kind === 'brass') {
      [-6, 6].forEach((d) => { const o = osc('sawtooth', f, d); o.connect(fl); oscs.push(o); });
      fl.frequency.setValueAtTime(600, t); fl.frequency.linearRampToValueAtTime(2600, t + 0.05); fl.frequency.setTargetAtTime(1500, t + 0.06, 0.15);
      env(g, t, vel * 0.1, 0.025, dur * 0.92, 0.08);
    } else {
      const o = osc(kind === 'flute' ? 'triangle' : 'sawtooth', f);
      if (kind === 'flute') { const o2 = osc('sine', f); o2.connect(fl); oscs.push(o2); }
      o.connect(fl); oscs.push(o);
      // vibrato tardio
      const lfo = osc('sine', 5.2), lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(fin(kind === 'flute' ? 9 : 14, 0), t + Math.min(dur, 0.7));
      lfo.connect(lg); oscs.forEach((x) => lg.connect(x.detune)); oscs.push(lfo);
      env(g, t, vel * (kind === 'flute' ? 0.12 : 0.075), kind === 'flute' ? 0.05 : 0.09, dur * 0.95, 0.25);
    }
    toRev(g, 0.55);
    run(oscs, g, t, t + dur + 1.0);
  }
  function kick(t, vel, dest) {
    const o = osc('sine', 150), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(vel * 0.75, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(dest); run([o], g, t, t + 0.3);
  }
  function noiseHit(t, dur, vel, dest, type, freq, q) {
    const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(fin(vel, 0.1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    voices++; if (voices > maxVoices) maxVoices = voices;
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    s.onended = () => { voices--; try { g.disconnect(); } catch (_) { /* ok */ } };
  }
  function snare(t, vel, dest) {
    noiseHit(t, 0.17, vel * 0.5, dest, 'bandpass', 2100, 0.7);
    const o = osc('triangle', 200), g = ctx.createGain();
    o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    g.gain.setValueAtTime(vel * 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(dest); run([o], g, t, t + 0.12);
  }
  const hat = (t, vel, dest, open) => noiseHit(t, open ? 0.12 : 0.04, vel * 0.16, dest, 'highpass', 7500, 0.5);

  /* ---------------------------------------------------------------- sequenciador */
  function makeBus() {
    const out = ctx.createGain(), calm = ctx.createGain(), drive = ctx.createGain();
    out.gain.value = 0.0001; drive.gain.value = 0.0001;
    calm.connect(out); drive.connect(out); out.connect(musicBus);
    return { out, calm, drive };
  }
  function startTheme(key) {
    const th = THEMES[key]; if (!th) return;
    stopTheme(0.5);
    const now = ctx.currentTime, bus = makeBus();
    bus.out.gain.setValueAtTime(0.0001, now);
    bus.out.gain.linearRampToValueAtTime(1, now + 0.08);
    setP(bus.drive.gain, intensity, now);
    cur = { key, th, bus, step: 0, nextT: now + (key === 'title' ? 0.15 : 0.12) };
    if (!timer) timer = setInterval(pump, 40);
  }
  function stopTheme(fade) {
    if (!cur) return;
    const old = cur.bus, now = ctx.currentTime; cur = null;
    old.out.gain.cancelScheduledValues(now);
    old.out.gain.setValueAtTime(Math.max(fin(old.out.gain.value, 1), 0.0001), now);
    old.out.gain.linearRampToValueAtTime(0.0001, now + fade);
    setTimeout(() => { try { old.out.disconnect(); } catch (_) { /* ok */ } }, (fade + 2.5) * 1000);
  }
  function schedStep(c, t) {
    const th = c.th, s = c.step % 16, bar = Math.floor(c.step / 16) % 8, sd = 60 / th.bpm / 4, bd = sd * 16;
    const deg = th.prog[bar], I = intensity, calm = c.bus.calm, drv = c.bus.drive;
    // camada calma
    if (s === 0) {
      pad(t, [degMidi(th, deg - 7), degMidi(th, deg - 5), degMidi(th, deg - 3)], bd + 0.5, 1, calm);
      bass(t, degMidi(th, deg - 7), bd * 0.5, 0.8, calm, false);
    }
    if (s === 8 && th.bass !== BASS.march) bass(t, degMidi(th, deg - 7 + 4), bd * 0.45, 0.55, calm, false);
    const ap = th.arp[s];
    if (ap >= 0) {
      const ch = [deg + 7, deg + 9, deg + 11, deg + 14][ap];
      pluck(t, degMidi(th, ch), (s % 8 === 0 ? 0.8 : 0.55) * rr(0.88, 1.08), calm, th.lead === 'bell' ? 0.9 : 0.5);
    }
    th.melP[bar].forEach((n) => {
      if (n.s !== s) return;
      const vel = rr(0.85, 1.05);
      lead(th.lead, t, degMidi(th, n.d + 7), n.l * sd, vel, calm);
      if (!th.noDrive && I > 0.55) lead('brass', t, degMidi(th, n.d), n.l * sd, 0.55 * vel * I, drv);
    });
    // camada drive
    if (th.noDrive || I < 0.06) return;
    const dv = th.drumVel * rr(0.92, 1.05);
    if (th.kickS.has(s)) kick(t, dv, drv);
    if (I > 0.18) {
      if (th.snareS.has(s)) snare(t, dv, drv);
      // rufo de caixa no fim de cada frase
      if ((bar === 3 || bar === 7) && s >= 12 && th.drumVel >= 0.9 && I > 0.4) snare(t, dv * 0.45 + (s - 12) * 0.1, drv);
      if (th.hatS.has(s)) hat(t, dv * (s % 4 === 0 ? 1 : 0.7), drv, false);
      if (th.bass === BASS.march && s === 14 && th.drumVel >= 1) hat(t, dv * 0.6, drv, true);
    }
    if (I > 0.3) {
      th.bass.forEach(([bs, k]) => {
        if (bs !== s) return;
        const m = degMidi(th, deg - 7 + (k === 1 ? 4 : 0)) + (k === 2 ? 12 : 0);
        bass(t, m, sd * (k === 2 ? 1.4 : 1.8), 0.8 * (0.8 + 0.2 * I), drv, true);
      });
    }
    if (I > 0.55 && th.stabS.has(s)) {
      [deg + 7, deg + 9, deg + 11].forEach((d) => lead('brass', t, degMidi(th, d), sd * 1.6, 0.5 * I * rr(0.9, 1.05), drv));
    }
  }
  function pump() {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime, dt = clamp(now - lastTick, 0, 0.5); lastTick = now;
    // suaviza a intensidade: sobe rápido, desce devagar
    const k = target > intensity ? 0.5 : 2.5;
    intensity = clamp(fin(intensity + (target - intensity) * (1 - Math.exp(-dt / k)), 0), 0, 1);
    if (cur) {
      setP(cur.bus.drive.gain, intensity, now, 0.12);
      setP(cur.bus.calm.gain, 1 - 0.22 * intensity, now, 0.2);
      if (cur.nextT < now - 0.25) cur.nextT = now + 0.05; // aba em segundo plano: não acumula notas atrasadas
      const sd = 60 / cur.th.bpm / 4;
      while (cur.nextT < now + 0.3) {
        schedStep(cur, cur.nextT);
        cur.step++; cur.nextT += sd;
      }
    }
  }

  /* ---------------------------------------------------------------- estado / cena */
  function apply() {
    if (!ctx || !unlocked) return;
    const now = ctx.currentTime;
    if (!enabled) {
      setP(master.gain, 0.0001, now, 0.04);
      setTimeout(() => { if (!enabled && ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 250);
      return;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    setP(master.gain, dbToGain(-2), now, 0.05);
    // pausa: abafa em vez de cortar
    setP(musicLP.frequency, paused ? 420 : 18000, now, paused ? 0.12 : 0.2);
    setP(musicBus.gain, dbToGain(paused ? -13 : -7), now, 0.15);
    if (want === null || want === undefined) { if (cur) stopTheme(0.9); return; }
    if (!cur || cur.key !== want) startTheme(want);
  }
  function unlock() {
    if (unlocked && ctx) { if (ctx.state === 'suspended' && enabled) ctx.resume().catch(() => {}); return; }
    if (!ensure()) return;
    unlocked = true; apply();
  }
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));

  /* ---------------------------------------------------------------- stings */
  function sting(name) {
    if (!ctx || !unlocked || !enabled) return;
    const t = ctx.currentTime + 0.05, d = sfxBus;
    const th = THEMES.title;
    if (name === 'over') {
      // descida lenta em Lá menor, cravo + cordas graves
      [76, 74, 72, 69, 67, 64].forEach((m, i) => pluck(t + i * 0.2, m - 12, 0.9 - i * 0.05, d, 0.9));
      pad(t, [45, 52, 57], 3.2, 1.3, d); bass(t + 0.1, 33, 2.2, 1, d, false);
      lead('bell', t + 1.3, 57, 2, 0.9, d);
    } else if (name === 'fanfare') {
      // fanfarra de fim de fase: metais em Dó maior + rufo de caixa
      const seq = [[0, 67, 0.16], [0.16, 72, 0.16], [0.32, 76, 0.16], [0.48, 79, 0.9]];
      seq.forEach(([o, m, l]) => lead('brass', t + o, m, l, 1.15, d));
      [60, 64, 67].forEach((m) => lead('brass', t + 0.48, m, 0.9, 0.9, d));
      for (let i = 0; i < 6; i++) snare(t + i * 0.08, 0.5 + i * 0.1, d);
      kick(t + 0.48, 1, d); noiseHit(t + 0.48, 1.1, 0.12, d, 'highpass', 6000, 0.4);
      pad(t + 0.4, [48, 55, 64], 1.8, 1, d);
      [84, 88, 91].forEach((m, i) => pluck(t + 1.0 + i * 0.1, m, 0.7, d, 0.9));
    } else if (name === 'win') {
      // final: fanfarra maior e arpejos brilhantes
      [[0, 67], [0.2, 72], [0.4, 76], [0.6, 79], [1.0, 76], [1.2, 79], [1.4, 84]].forEach(([o, m]) => lead('brass', t + o, m, o >= 1.4 ? 1.8 : 0.22, 1.1, d));
      [60, 64, 67, 72].forEach((m) => lead('brass', t + 1.4, m, 1.8, 0.8, d));
      for (let i = 0; i < 8; i++) snare(t + i * 0.075, 0.4 + i * 0.08, d);
      kick(t + 1.4, 1, d); kick(t, 0.9, d);
      pad(t + 0.5, [48, 55, 64, 72], 3.5, 1.2, d);
      for (let i = 0; i < 10; i++) pluck(t + 1.5 + i * 0.12, 72 + [0, 4, 7, 12, 16, 19, 24, 19, 16, 12][i], 0.65, d, 1.1);
      lead('bell', t + 1.5, 84, 2.5, 1, d);
    } else if (name === 'start') {
      [57, 64, 69, 72].forEach((m, i) => pluck(t + i * 0.09, m, 0.8, d, 0.8));
    }
    void th;
  }

  /* ---------------------------------------------------------------- efeitos sonoros */
  let combo = 0, comboT = -9;
  const lastSfx = {};
  const PENT = [0, 2, 4, 7, 9];
  function blip(t, type, f0, f1, dur, vel, dest, rev) {
    const o = osc(type, f0), g = ctx.createGain();
    o.frequency.setValueAtTime(fin(f0, 440), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(fin(f1, 440), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(fin(vel, 0.1), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus); if (rev) toRev(g, rev);
    run([o], g, t, t + dur + 0.02);
  }
  function sfx(name, vol, rate) {
    if (!ctx || !unlocked || !enabled) return;
    const t = ctx.currentTime + 0.005, now = ctx.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < 0.03) return;
    lastSfx[name] = now;
    const v = clamp(fin(vol, 0.3) / 0.3, 0.2, 2), p = rr(0.94, 1.06);
    switch (name) {
      case 'jump':
        blip(t, 'triangle', 300 * p, 640 * p, 0.14, 0.22 * v);
        blip(t, 'square', 150 * p, 320 * p, 0.1, 0.05 * v);
        break;
      case 'land':
        blip(t, 'sine', 130 * p, 55, 0.12, 0.3 * v);
        noiseHit(t, 0.06, 0.12 * v, sfxBus, 'lowpass', 900, 0.5);
        break;
      case 'hurt':
        blip(t, 'sawtooth', 340 * p, 90, 0.34, 0.22 * v);
        blip(t, 'square', 227 * p, 70, 0.3, 0.08 * v);
        noiseHit(t, 0.18, 0.2 * v, sfxBus, 'bandpass', 1400, 0.6);
        break;
      case 'kill':
        if (rate && rate > 1.2) { // pisão que não derrota: quique seco
          blip(t, 'sine', 260 * p, 110, 0.1, 0.26 * v); noiseHit(t, 0.05, 0.12 * v, sfxBus, 'bandpass', 2400, 0.8);
        } else {
          blip(t, 'sine', 420 * p, 95, 0.22, 0.3 * v);
          noiseHit(t, 0.1, 0.22 * v, sfxBus, 'bandpass', 1800, 0.7);
          blip(t + 0.07, 'triangle', 520 * p, 1040 * p, 0.12, 0.12 * v);
        }
        break;
      case 'item': {
        // combo: sobe pela pentatônica enquanto as castanhas vêm em sequência
        combo = now - comboT < 1.1 ? Math.min(combo + 1, 19) : 0; comboT = now;
        if (rate && rate < 0.9) { // castanha dourada: acorde brilhante
          [0, 4, 7, 12].forEach((s, i) => blip(t + i * 0.045, 'triangle', mtof(79 + s), 0, 0.5, 0.13 * v, sfxBus, 0.5));
          break;
        }
        const n = PENT[combo % 5] + 12 * Math.floor(combo / 5), f = mtof(79 + n) * rr(0.995, 1.005);
        blip(t, 'sine', f, 0, 0.2, 0.2 * v, sfxBus, 0.35);
        blip(t, 'triangle', f * 2, 0, 0.09, 0.05 * v);
        break;
      }
      case 'checkpoint':
        [67, 74, 79].forEach((m, i) => { pluck(t + i * 0.1, m, 0.7, sfxBus, 0.8); });
        lead('bell', t + 0.2, 86, 1.2, 0.8, sfxBus);
        break;
      case 'heart':
        [72, 76, 79, 84].forEach((m, i) => { pluck(t + i * 0.08, m, 0.75, sfxBus, 0.7); blip(t + i * 0.08, 'sine', mtof(m + 12), 0, 0.3, 0.08, sfxBus, 0.5); });
        break;
      case 'swing':  // golpe no ar: sopro de ruído que desce
        noiseHit(t, 0.12, 0.16 * v, sfxBus, 'bandpass', 2600 * p, 1.4);
        blip(t, 'triangle', 520 * p, 210, 0.09, 0.05 * v);
        break;
      case 'punch':  // golpe que acerta: baque grave + estalo
        blip(t, 'sine', 180 * p, 48, 0.16, 0.42 * v);
        noiseHit(t, 0.07, 0.3 * v, sfxBus, 'lowpass', 1600, 0.7);
        blip(t, 'square', 900 * p, 300, 0.04, 0.06 * v);
        break;
      case 'deny':
        blip(t, 'square', 180, 150, 0.1, 0.08 * v); blip(t + 0.12, 'square', 160, 120, 0.14, 0.08 * v);
        break;
      case 'splash':  // mergulho: chiado de água filtrado + bolha grave
        noiseHit(t, 0.32, 0.26 * v, sfxBus, 'lowpass', 1300 * p, 0.6);
        noiseHit(t + 0.03, 0.18, 0.1 * v, sfxBus, 'bandpass', 3200 * p, 1.2);
        blip(t + 0.04, 'sine', 240 * p, 90, 0.18, 0.16 * v);
        break;
      case 'stroke':  // braçada debaixo d'água: bolhas subindo
        blip(t, 'sine', 300 * p, 620 * p, 0.08, 0.07 * v); blip(t + 0.05, 'sine', 380 * p, 760 * p, 0.07, 0.05 * v);
        break;
      case 'dash':    // arrancada: sopro curto e agudo
        noiseHit(t, 0.14, 0.2 * v, sfxBus, 'highpass', 1800 * p, 0.9);
        blip(t, 'triangle', 700 * p, 1400 * p, 0.08, 0.06 * v);
        break;
      case 'vine':    // agarrar cipó: rangido de fibra
        blip(t, 'sawtooth', 120 * p, 95 * p, 0.16, 0.05 * v);
        noiseHit(t, 0.1, 0.08 * v, sfxBus, 'bandpass', 700 * p, 2.5);
        break;
      case 'lever':   // alavanca: estalo metálico + engrenagem
        blip(t, 'square', 420 * p, 210, 0.05, 0.1 * v); blip(t + 0.07, 'square', 330 * p, 160, 0.05, 0.08 * v);
        noiseHit(t, 0.08, 0.14 * v, sfxBus, 'bandpass', 2200, 1.1);
        break;
      case 'thud':    // ponte/tronco caindo no lugar: baque de madeira
        blip(t, 'sine', 95 * p, 38, 0.32, 0.5 * v);
        noiseHit(t, 0.22, 0.26 * v, sfxBus, 'lowpass', 600, 0.5);
        break;
      default: break;
    }
  }

  /* ---------------------------------------------------------------- API */
  RC.audio = {
    unlock,
    // true/false: espelha o botão de som
    setEnabled(on) { enabled = !!on; apply(); },
    // cena: 0..4 (humor da fase), 'title' ou null (silêncio com fade)
    setScene(key, isPaused) { want = key === undefined ? null : key; paused = !!isPaused; apply(); },
    setIntensity(v) { target = clamp(fin(v, 0), 0, 1); },
    sting, sfx,
    stats() { return { state: ctx ? ctx.state : 'none', voices, maxVoices, intensity, scene: cur ? cur.key : null, unlocked, enabled }; }
  };
})();
