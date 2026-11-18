(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const mod = (n, m) => ((n % m) + m) % m;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const app = $('#app');
  const cfg = {
    welcome: Number(app.dataset.welcomeCoins),
    daily: Number(app.dataset.dailyCoins),
    betCost: Number(app.dataset.betCost),
    maxBets: Number(app.dataset.maxBets),
    bigWin: Number(app.dataset.bigWin),
    megaWin: Number(app.dataset.megaWin),
    streakBonus: Number(app.dataset.streakBonus),
    streakCap: Number(app.dataset.streakCap),
  };

  const cells = $$('[data-bet]');
  const payouts = {};
  cells.forEach((cell) => {
    const holder = cell.dataset.payout ? cell : cell.closest('[data-payout]');
    payouts[cell.dataset.bet] = Number(holder.dataset.payout);
  });
  const cellFor = (key) => cells.find((c) => c.dataset.bet === key);

  const memory = {};
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('sf_' + key);
        return v === null ? fallback : v;
      } catch (e) {
        return key in memory ? memory[key] : fallback;
      }
    },
    set(key, value) {
      memory[key] = String(value);
      try { localStorage.setItem('sf_' + key, String(value)); } catch (e) { return; }
    },
  };

  const parseOwned = (text) => {
    const owned = {};
    text.split(',').filter(Boolean).forEach((pair) => {
      const [id, n] = pair.split(':');
      owned[id] = Number(n) || 0;
    });
    return owned;
  };

  const state = {
    coins: Number(store.get('coins', 0)) || 0,
    lastClaim: store.get('lastClaim', ''),
    dayOffset: Number(store.get('dayOffset', 0)) || 0,
    owned: parseOwned(store.get('owned', '')),
  };

  function saveState() {
    store.set('coins', state.coins);
    store.set('lastClaim', state.lastClaim);
    store.set('dayOffset', state.dayOffset);
    store.set('owned', Object.entries(state.owned).map(([id, n]) => id + ':' + n).join(','));
  }

  function today() {
    const d = new Date();
    d.setDate(d.getDate() + state.dayOffset);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function msg(key, vars = {}) {
    const el = $('[data-msg="' + key + '"]');
    if (!el) return '';
    return el.textContent.trim().replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }
  const setStatus = (text) => { $('#status').textContent = text; };

  function fillNumbers() {
    const values = {
      welcome: cfg.welcome,
      daily: cfg.daily,
      betcost: cfg.betCost,
      maxbets: cfg.maxBets,
      'payout-red': payouts.red,
      'payout-black': payouts.black,
      'payout-number': payouts.n0,
    };
    $$('[data-fill]').forEach((el) => { el.textContent = values[el.dataset.fill]; });
  }

  const logEl = $('#event-log');
  function track(name, data = {}) {
    console.log('[event]', name, data);
    const detail = Object.entries(data).map(([k, v]) => k + ': ' + v).join(', ');
    const li = document.createElement('li');
    li.textContent = new Date().toLocaleTimeString() + '  ' + name + (detail ? ' (' + detail + ')' : '');
    logEl.prepend(li);
    while (logEl.children.length > 40) logEl.lastChild.remove();
  }

  const requested = (new URLSearchParams(location.search).get('variant') || '').toUpperCase();
  const variant = requested === 'B' ? 'B' : 'A';
  $$('[data-variant]').forEach((el) => { el.hidden = el.dataset.variant !== variant; });

  let soundOn = store.get('sound', 'on') === 'on';
  let audioCtx = null;
  const soundBtn = $('#sound');

  function paintSoundButton() {
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.textContent = soundOn ? soundBtn.dataset.on : soundBtn.dataset.off;
  }

  function tone(freq, start, length, type, volume) {
    if (!soundOn) return;
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return;
      }
    }
    const t = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  function playTicks(durationMs) {
    if (!soundOn || reduceMotion) return;
    const count = 46;
    for (let i = 1; i <= count; i++) {
      const progress = i / count;
      const when = (durationMs / 1000) * (1 - Math.pow(1 - progress, 1 / 3));
      tone(1100, when, 0.03, 'square', 0.035);
    }
  }

  function playWin(tier) {
    const notes = tier === 'mega' ? [523, 659, 784, 1047, 1319, 1568] : tier === 'big' ? [523, 659, 784, 1047] : [523, 784];
    notes.forEach((f, i) => tone(f, i * 0.11, 0.25, 'triangle', 0.12));
  }

  function playLose() {
    tone(220, 0, 0.25, 'sawtooth', 0.05);
    tone(165, 0.18, 0.3, 'sawtooth', 0.05);
  }

  const fx = $('#fx');
  const fctx = fx.getContext('2d');
  const palette = ['#ff2e93', '#ffd23f', '#22d3ee', '#12d6a0', '#ff9f1c', '#ffffff', '#a78bfa'];
  let particles = [];
  let fxFrame = 0;

  function sizeFx() {
    fx.width = window.innerWidth;
    fx.height = window.innerHeight;
  }

  function addParticle(x, y, vx, vy, coin) {
    particles.push({
      x, y, vx, vy,
      size: coin ? 9 + Math.random() * 5 : 6 + Math.random() * 7,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      color: coin ? '#ffd23f' : palette[Math.floor(Math.random() * palette.length)],
      coin,
      life: 260 + Math.random() * 80,
    });
  }

  function stepFx() {
    fctx.clearRect(0, 0, fx.width, fx.height);
    particles = particles.filter((p) => p.life > 0 && p.y < fx.height + 40);
    particles.forEach((p) => {
      p.vy += 0.22;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      fctx.save();
      fctx.translate(p.x, p.y);
      fctx.rotate(p.rot);
      fctx.fillStyle = p.color;
      if (p.coin) {
        fctx.beginPath();
        fctx.arc(0, 0, p.size, 0, Math.PI * 2);
        fctx.fill();
        fctx.strokeStyle = '#ff9f1c';
        fctx.lineWidth = 3;
        fctx.stroke();
      } else {
        fctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      }
      fctx.restore();
    });
    if (particles.length) {
      fxFrame = requestAnimationFrame(stepFx);
    } else {
      fxFrame = 0;
      fctx.clearRect(0, 0, fx.width, fx.height);
    }
  }

  function startFx() {
    if (!fxFrame) fxFrame = requestAnimationFrame(stepFx);
  }

  function burst(amount, power) {
    if (reduceMotion) return;
    sizeFx();
    const box = $('#wheel-wrap').getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.4 + Math.random()) * power;
      addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - power * 0.5, i % 4 === 0);
    }
    startFx();
  }

  function coinRain(amount) {
    if (reduceMotion) return;
    sizeFx();
    for (let i = 0; i < amount; i++) {
      addParticle(Math.random() * fx.width, -20 - Math.random() * 400, (Math.random() - 0.5) * 2, 2 + Math.random() * 3, true);
    }
    startFx();
  }

  const POCKETS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');
  const wheel = $('#wheel');
  const wrap = $('#wheel-wrap');

  function buildBulbs() {
    const holder = $('#bulbs');
    const total = 32;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2;
      const bulb = document.createElement('span');
      bulb.className = 'bulb';
      bulb.style.left = 50 + 46.8 * Math.sin(angle) + '%';
      bulb.style.top = 50 - 46.8 * Math.cos(angle) + '%';
      bulb.style.setProperty('--i', i);
      holder.appendChild(bulb);
    }
  }

  function drawWheel() {
    const ctx = wheel.getContext('2d');
    const size = wheel.width;
    const c = size / 2;
    const outer = c - 2;
    const pockets = outer - 20;
    const step = (Math.PI * 2) / POCKETS.length;
    const fills = { red: '#ff2e63', black: '#1a0b4d', green: '#12d6a0' };

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(c, c, outer, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();

    POCKETS.forEach((n, i) => {
      const a0 = -Math.PI / 2 + i * step;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, pockets, a0, a0 + step);
      ctx.closePath();
      ctx.fillStyle = fills[colorOf(n)];
      ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(a0 + step / 2 + Math.PI / 2);
      ctx.fillStyle = n === 0 ? '#1a0b4d' : '#ffffff';
      ctx.font = '800 20px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, -(pockets - 28));
      ctx.restore();
    });

    const inner = pockets * 0.62;
    ctx.beginPath();
    ctx.arc(c, c, inner, 0, Math.PI * 2);
    ctx.fillStyle = '#2a0e6c';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffd23f';
    ctx.stroke();

    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const a0 = (i / petals) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, inner - 12, a0, a0 + (Math.PI * 2) / petals);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#ff2e93' : '#22d3ee';
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(c, c, inner * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0b4d';
    ctx.fill();
  }

  const orbit = $('#orbit');
  const ball = $('#ball');
  let rotation = 0;

  function spinTo(index) {
    const step = 360 / POCKETS.length;
    const jitter = (Math.random() - 0.5) * step * 0.6;
    const target = mod(jitter - (index + 0.5) * step, 360);
    const delta = mod(target - mod(rotation, 360), 360);
    const turns = reduceMotion ? 1 : 6;
    const duration = reduceMotion ? 700 : 5200;
    rotation += turns * 360 + delta;

    wheel.style.transition = 'transform ' + duration + 'ms cubic-bezier(.12,.62,.12,1)';
    wheel.style.transform = 'rotate(' + rotation + 'deg)';

    orbit.style.transition = 'none';
    orbit.style.transform = 'rotate(0deg)';
    ball.style.transition = 'none';
    ball.style.top = '3.4%';
    void orbit.offsetWidth;
    orbit.style.transition = 'transform ' + duration + 'ms cubic-bezier(.2,.55,.15,1)';
    orbit.style.transform = 'rotate(-' + (reduceMotion ? 360 : 5 * 360) + 'deg)';
    ball.style.transition = 'top 1000ms ease-in ' + Math.max(0, duration - 1300) + 'ms';
    ball.style.top = '8.4%';

    playTicks(duration);
    return wait(duration + 80);
  }

  const bets = new Set();
  const coinsEl = $('#coins');
  const balanceEl = $('#balance');
  const spinBtn = $('#spin');
  let busy = false;
  let shown = null;
  let streak = 0;

  function setCoinsText(to, animate) {
    const from = shown === null ? to : shown;
    shown = to;
    if (!animate || from === to || reduceMotion) {
      coinsEl.textContent = to;
      return;
    }
    const start = performance.now();
    const duration = Math.min(1400, 350 + Math.abs(to - from) * 30);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      coinsEl.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    balanceEl.classList.remove('pop');
    void balanceEl.offsetWidth;
    balanceEl.classList.add('pop');
  }

  function trimBets() {
    while (bets.size * cfg.betCost > state.coins && bets.size > 0) {
      bets.delete(Array.from(bets).pop());
    }
  }

  function paintBets() {
    cells.forEach((cell) => cell.setAttribute('aria-pressed', String(bets.has(cell.dataset.bet))));
    const stake = bets.size * cfg.betCost;
    if (bets.size === 0) {
      $('#bet-summary').textContent = msg('summaryNone');
      $('#spin-sub').textContent = msg('subNone');
    } else {
      const list = Array.from(bets).map((key) => cellFor(key).dataset.label).join(', ');
      $('#bet-summary').textContent = msg('summary', { list, coins: stake });
      $('#spin-sub').textContent = stake === 1 ? msg('subOne') : msg('subMany', { n: stake });
    }
  }

  function render(animate) {
    trimBets();
    paintBets();
    setCoinsText(state.coins, animate);
    $$('.prize').forEach((b) => {
      const owned = state.owned[b.dataset.id] || 0;
      $('.owned', b).textContent = owned ? 'You have ' + owned : '';
      b.classList.toggle('short', state.coins < Number(b.dataset.cost));
    });
  }

  function setBusy(value) {
    busy = value;
    wrap.classList.toggle('is-spinning', value);
    ['#spin', '#open-buy', '#open-redeem', '#next-day', '#reset', '#clear-bets'].forEach((s) => { $(s).disabled = value; });
    cells.forEach((cell) => { cell.disabled = value; });
  }

  function toggleBet(cell) {
    if (busy) return;
    const key = cell.dataset.bet;
    if (bets.has(key)) {
      bets.delete(key);
      track('bet_removed', { bet: cell.dataset.label });
    } else {
      if (bets.size >= cfg.maxBets) {
        setStatus(msg('tooMany', { max: cfg.maxBets }));
        return;
      }
      if ((bets.size + 1) * cfg.betCost > state.coins) {
        setStatus(msg('needCoins', { coins: state.coins }));
        return;
      }
      bets.add(key);
      setStatus('');
      track('bet_added', { bet: cell.dataset.label });
    }
    paintBets();
  }

  cells.forEach((cell) => cell.addEventListener('click', () => toggleBet(cell)));

  $('#clear-bets').addEventListener('click', () => {
    bets.clear();
    paintBets();
    track('bets_cleared');
  });

  const dialogs = {
    welcome: $('#welcome-dialog'),
    daily: $('#daily-dialog'),
    empty: $('#empty-dialog'),
    buy: $('#buy-dialog'),
    redeem: $('#redeem-dialog'),
  };

  function openDialog(dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  [dialogs.welcome, dialogs.daily].forEach((d) => d.addEventListener('cancel', (e) => e.preventDefault()));

  [dialogs.empty, dialogs.buy, dialogs.redeem].forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) closeDialog(d); });
  });

  $$('dialog .close').forEach((b) => b.addEventListener('click', () => closeDialog(b.closest('dialog'))));

  function openEmpty() {
    if (busy || state.coins >= cfg.betCost) return;
    track('out_of_coins', { balance: state.coins });
    openDialog(dialogs.empty);
  }

  function claim(kind, amount) {
    state.coins += amount;
    state.lastClaim = today();
    saveState();
    closeDialog(dialogs[kind]);
    render(true);
    track(kind === 'welcome' ? 'welcome_bonus' : 'daily_bonus', { coins: amount });
    setStatus(msg(kind, { coins: amount }));
    burst(110, 9);
    tone(784, 0, 0.2, 'triangle', 0.12);
    tone(1047, 0.12, 0.3, 'triangle', 0.12);
  }

  $('#claim-welcome').addEventListener('click', () => claim('welcome', cfg.welcome));
  $('#claim-daily').addEventListener('click', () => claim('daily', cfg.daily));

  function intro() {
    const t = today();
    if (!state.lastClaim) {
      track('welcome_shown');
      openDialog(dialogs.welcome);
    } else if (state.lastClaim < t) {
      track('daily_shown');
      openDialog(dialogs.daily);
    } else {
      setStatus(msg('claimed', { coins: cfg.daily }));
      openEmpty();
    }
  }

  const history = [];
  function pushHistory(number) {
    history.unshift(number);
    if (history.length > 12) history.pop();
    const items = history.map((n) => {
      const li = document.createElement('li');
      li.className = colorOf(n);
      li.textContent = n;
      return li;
    });
    $('#history').replaceChildren(...items);
  }

  function showBanner(tier, amount) {
    const banner = $('#win-banner');
    $('#win-tier').textContent = msg(tier === 'mega' ? 'tierMega' : tier === 'big' ? 'tierBig' : 'tierWin');
    $('#win-amount').textContent = '+' + amount;
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  function highlight(keys) {
    const hit = keys.map(cellFor).filter(Boolean);
    hit.forEach((cell) => cell.classList.add('hit'));
    setTimeout(() => hit.forEach((cell) => cell.classList.remove('hit')), 2400);
  }

  async function spin() {
    if (busy) return;
    if (state.coins < cfg.betCost) {
      openEmpty();
      return;
    }
    if (bets.size === 0) {
      setStatus(msg('pick'));
      return;
    }

    const placed = Array.from(bets);
    const stake = placed.length * cfg.betCost;
    setBusy(true);
    state.coins -= stake;
    saveState();
    setCoinsText(state.coins, false);
    setStatus(msg('spinning'));
    track('spin_start', { bets: placed.map((k) => cellFor(k).dataset.label).join('/'), stake });

    const index = Math.floor(Math.random() * POCKETS.length);
    await spinTo(index);

    const number = POCKETS[index];
    const color = colorOf(number);
    let payout = 0;
    placed.forEach((key) => {
      if (key === color || key === 'n' + number) payout += payouts[key];
    });

    let bonus = 0;
    if (payout > 0) {
      streak += 1;
      bonus = streak >= 2 ? Math.min(streak - 1, cfg.streakCap) * cfg.streakBonus : 0;
    } else {
      streak = 0;
    }
    const total = payout + bonus;
    state.coins += total;
    saveState();

    const chip = $('#result-ball');
    chip.textContent = number;
    chip.className = 'ball-chip ' + color;
    pushHistory(number);
    $('#result-text').textContent = msg(payout > 0 ? 'win' : 'lose', { number, color, payout: total });
    setStatus('');
    render(true);
    track('spin_result', { number, color, payout, bonus, streak, balance: state.coins });

    if (payout > 0) {
      const tier = total >= cfg.megaWin ? 'mega' : total >= cfg.bigWin ? 'big' : 'win';
      highlight(placed.filter((key) => key === color || key === 'n' + number));
      showBanner(tier, total);
      playWin(tier);
      burst(tier === 'mega' ? 220 : tier === 'big' ? 150 : 80, tier === 'mega' ? 14 : 10);
      if (tier !== 'win') coinRain(tier === 'mega' ? 90 : 40);
      if (tier === 'mega') {
        wrap.classList.remove('shake');
        void wrap.offsetWidth;
        wrap.classList.add('shake');
      }
      track('win_' + tier, { total });
    } else {
      playLose();
    }

    const paintStreak = $('#streak');
    if (streak >= 2) {
      paintStreak.hidden = false;
      paintStreak.textContent = msg('streak', { streak, bonus });
      paintStreak.style.animation = 'none';
      void paintStreak.offsetWidth;
      paintStreak.style.animation = '';
    } else {
      paintStreak.hidden = true;
    }

    setBusy(false);
    if (state.coins < cfg.betCost) {
      await wait(payout > 0 ? 1800 : 900);
      openEmpty();
    }
  }

  spinBtn.addEventListener('click', spin);

  $('#open-buy').addEventListener('click', () => {
    if (busy) return;
    $('#buy-msg').textContent = '';
    track('buy_open', { balance: state.coins });
    openDialog(dialogs.buy);
  });

  $('#empty-buy').addEventListener('click', () => {
    closeDialog(dialogs.empty);
    $('#buy-msg').textContent = '';
    track('buy_open', { balance: state.coins, from: 'empty_popup' });
    openDialog(dialogs.buy);
  });

  $('#open-redeem').addEventListener('click', () => {
    if (busy) return;
    $('#redeem-msg').textContent = '';
    render(false);
    track('redeem_open', { balance: state.coins });
    openDialog(dialogs.redeem);
  });

  let buyLock = false;
  $$('.pack').forEach((b) => b.addEventListener('click', () => {
    if (buyLock) return;
    buyLock = true;
    setTimeout(() => { buyLock = false; }, 400);
    const coins = Number(b.dataset.coins);
    state.coins += coins;
    saveState();
    render(true);
    $('#buy-msg').textContent = msg('bought', { coins });
    track('buy_confirm', { pack: b.dataset.id, coins, price: b.dataset.price, demo: 'yes' });
    tone(880, 0, 0.15, 'triangle', 0.12);
  }));

  $$('.prize').forEach((b) => b.addEventListener('click', () => {
    const cost = Number(b.dataset.cost);
    const name = b.dataset.name;
    if (state.coins < cost) {
      $('#redeem-msg').textContent = msg('notEnough', { cost, name });
      track('redeem_failed', { prize: b.dataset.id, cost, balance: state.coins });
      return;
    }
    state.coins -= cost;
    state.owned[b.dataset.id] = (state.owned[b.dataset.id] || 0) + 1;
    saveState();
    render(true);
    $('#redeem-msg').textContent = msg('redeemed', { name, cost });
    track('redeem_confirm', { prize: b.dataset.id, cost, balance: state.coins });
    burst(60, 8);
  }));

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set('sound', soundOn ? 'on' : 'off');
    paintSoundButton();
    track('sound_toggle', { on: soundOn ? 'yes' : 'no' });
  });

  $('#next-day').addEventListener('click', () => {
    if (busy) return;
    state.dayOffset += 1;
    saveState();
    track('demo_skip_day', { dayOffset: state.dayOffset });
    intro();
  });

  $('#reset').addEventListener('click', () => {
    if (busy) return;
    state.coins = 0;
    state.lastClaim = '';
    state.dayOffset = 0;
    state.owned = {};
    streak = 0;
    bets.clear();
    saveState();
    $('#streak').hidden = true;
    render(false);
    track('demo_reset');
    setStatus(msg('reset'));
    intro();
  });

  window.addEventListener('resize', sizeFx);

  fillNumbers();
  buildBulbs();
  drawWheel();
  paintSoundButton();
  render(false);
  sizeFx();
  track('page_view', { variant });
  track('variant_assigned', { variant });
  intro();
})();
