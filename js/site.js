/* Rei da Castanha: site. Topo, jogo embutido, player da faixa e animações de entrada. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  $('year').textContent = new Date().getFullYear();

  /* ---------------------------------------------------------- topo e navegação */
  const top = $('topo');
  const onScroll = () => top.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const links = [...document.querySelectorAll('.nav a')];
  const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) links.forEach((a, i) => a.classList.toggle('on', secs[i] === e.target));
    }), { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach((s) => s && spy.observe(s));

    const rev = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); rev.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => rev.observe(el));
  } else document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));

  /* ---------------------------------------------------------- música */
  const song = $('song'), seek = $('song-seek'), mini = $('mini');
  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  let seeking = false, cardVisible = true;

  function setPlaying(on) {
    document.body.classList.toggle('song-on', on);
    const label = on ? 'Pausar' : 'Tocar';
    $('song-toggle').setAttribute('aria-label', label);
    $('mini-toggle').setAttribute('aria-label', label);
    syncMini();
  }
  function syncMini() { mini.hidden = !(document.body.classList.contains('song-on') && !cardVisible); }
  function toggleSong(force) {
    const play = force === undefined ? song.paused : force;
    if (play) {
      song.play().catch(() => { $('song-msg').textContent = 'Não foi possível tocar a faixa agora. Tente de novo.'; });
    } else song.pause();
  }
  song.addEventListener('play', () => { setPlaying(true); $('song-msg').textContent = ''; });
  song.addEventListener('pause', () => setPlaying(false));
  song.addEventListener('ended', () => setPlaying(false));
  song.addEventListener('error', () => { $('song-msg').textContent = 'O arquivo da música não carregou.'; });
  song.addEventListener('loadedmetadata', () => { $('song-dur').textContent = fmt(song.duration); });
  song.addEventListener('timeupdate', () => {
    const p = song.duration ? song.currentTime / song.duration : 0;
    if (!seeking) { seek.value = Math.round(p * 1000); seek.style.setProperty('--p', `${p * 100}%`); }
    $('song-cur').textContent = fmt(song.currentTime);
    $('mini-time').textContent = `${fmt(song.currentTime)} / ${fmt(song.duration)}`;
    $('mini-fill').style.width = `${p * 100}%`;
  });
  seek.addEventListener('input', () => {
    seeking = true; seek.style.setProperty('--p', `${seek.value / 10}%`);
    if (song.duration) $('song-cur').textContent = fmt(song.duration * seek.value / 1000);
  });
  seek.addEventListener('change', () => {
    seeking = false;
    if (song.duration) song.currentTime = song.duration * seek.value / 1000;
    else { song.preload = 'auto'; song.addEventListener('loadedmetadata', () => { song.currentTime = song.duration * seek.value / 1000; }, { once: true }); song.load(); }
  });
  $('song-toggle').addEventListener('click', () => toggleSong());
  $('mini-toggle').addEventListener('click', () => toggleSong());
  document.querySelectorAll('[data-play-song]').forEach((b) => b.addEventListener('click', () => {
    $('musica').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    toggleSong(true);
  }));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { cardVisible = e.isIntersecting; syncMini(); }, { threshold: 0.15 }).observe(document.querySelector('.music-card'));
  }

  /* ---------------------------------------------------------- jogo embutido */
  const screen = $('screen'), status = $('game-status'), fullBtn = $('game-full');
  let frame = null;

  function loadGame() {
    if (frame) { frame.focus(); return; }
    screen.classList.add('loading');
    status.textContent = 'Carregando a floresta…';
    $('start-game').disabled = true;
    toggleSong(false);                                     // o jogo tem trilha própria
    frame = document.createElement('iframe');
    frame.src = 'jogo/index.html';
    frame.title = 'Jogo Rei da Castanha: Pânico na Floresta';
    frame.allow = 'fullscreen; gamepad; autoplay';
    frame.setAttribute('allowfullscreen', '');
    frame.style.opacity = '0';
    $('poster').after(frame);
    frame.addEventListener('load', () => {
      $('poster').remove();
      frame.style.opacity = '';
      screen.classList.remove('loading'); screen.classList.add('live');
      status.textContent = 'Jogando. Clique na tela se o teclado não responder.';
      fullBtn.disabled = false;
      frame.focus();
      try { frame.contentWindow.focus(); } catch (e) { /* outra origem: tudo bem */ }
    }, { once: true });
  }
  $('start-game').addEventListener('click', loadGame);
  fullBtn.addEventListener('click', () => {
    const req = screen.requestFullscreen || screen.webkitRequestFullscreen;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (req) {
      const r = req.call(screen);
      if (r && r.then) r.then(() => frame && frame.focus()).catch(() => {});
    }
  });
  // quando o foco entra no jogo, a faixa do site para para não brigar com a trilha do jogo
  addEventListener('blur', () => {
    setTimeout(() => { if (frame && document.activeElement === frame && !song.paused) song.pause(); }, 0);
  });
})();
