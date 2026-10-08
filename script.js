/* Outlast Trials · Sleep Room Arm Wrestling Simulator (fan-made)
 * P1 = SPACE, P2 = ENTER. Hit the yellow zone as the needle passes,
 * red centre = perfect. Dials speed up over time and after every hit.
 */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const CFG = {
    baseSpeed: 2.4,       // rad/s at round start (~23 RPM)
    maxSpeed: 13,         // rad/s cap (~124 RPM)
    timeAccel: 0.045,     // continuous speed-up per second
    hitAccel: 0.055,      // extra speed-up per successful hit
    zoneStart: 0.95,      // zone width in rad (~54°)
    zoneMin: 0.42,        // narrowest zone (~24°)
    perfectRatio: 0.32,   // centre share of zone counted as perfect
    pushHit: 0.085,
    pushPerfect: 0.14,
    comboBonus: 0.06,     // +6% push per combo step (max 5)
    missPenalty: 0.05,    // opponent gains this much when you miss
    stunMs: 420,          // input lock after a miss
    roundsToWin: 2,       // best of 3
  };

  const $ = (s, r = document) => r.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const norm = a => ((a % TAU) + TAU) % TAU;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ======================= AUDIO ======================= */
  let actx = null;
  let muted = false;
  function audio() {
    if (muted) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.25, hp = 800) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource();
    s.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = a.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(a.destination);
    s.start();
  }
  const SFX = {
    hit() { noise(0.06, 0.2, 1500); tone(220, 0.18, 'triangle', 0.25, 0.5); },
    perfect() { noise(0.08, 0.25, 2500); tone(330, 0.22, 'square', 0.1, 0.5); tone(660, 0.14, 'sine', 0.14); },
    miss() { tone(95, 0.3, 'sawtooth', 0.16, 0.7); noise(0.15, 0.12, 200); },
    beep() { tone(620, 0.15, 'square', 0.09); },
    go() { tone(940, 0.35, 'square', 0.1); noise(0.12, 0.2, 600); },
    slam() { tone(70, 0.7, 'sine', 0.5, 0.4); noise(0.35, 0.35, 90); },
    ready() { tone(480, 0.08, 'square', 0.07); },
  };

  /* ======================= DIAL (static layer) ======================= */
  const S = 300;               // logical dial size
  const C = S / 2;
  const R = S / 2 - 4;         // bezel radius
  const FACE = R * 0.76;       // face radius

  function buildDialFace(id, keyLabel) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S * 2;
    const c = cv.getContext('2d');
    c.scale(2, 2);

    // drop shadow
    c.save();
    c.shadowColor = 'rgba(0,0,0,.85)';
    c.shadowBlur = 14;
    c.shadowOffsetY = 4;
    c.beginPath(); c.arc(C, C, R, 0, TAU);
    c.fillStyle = '#1a1c19'; c.fill();
    c.restore();

    // steel bezel
    let g = c.createRadialGradient(C - 40, C - 50, 10, C, C, R);
    g.addColorStop(0, '#6e7268');
    g.addColorStop(0.55, '#3a3d37');
    g.addColorStop(1, '#141612');
    c.beginPath(); c.arc(C, C, R, 0, TAU);
    c.fillStyle = g; c.fill();

    // knurled rim
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU;
      c.beginPath();
      c.moveTo(C + Math.cos(a) * (R - 1), C + Math.sin(a) * (R - 1));
      c.lineTo(C + Math.cos(a) * (R - 6), C + Math.sin(a) * (R - 6));
      c.strokeStyle = i % 2 ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.08)';
      c.lineWidth = 1.2;
      c.stroke();
    }

    // rust patches on bezel
    for (let i = 0; i < 7; i++) {
      const a = rand(0, TAU);
      const rr = rand(FACE + 12, R - 8);
      const x = C + Math.cos(a) * rr;
      const y = C + Math.sin(a) * rr;
      const r = rand(4, 12);
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(110,60,25,.45)');
      rg.addColorStop(1, 'rgba(110,60,25,0)');
      c.fillStyle = rg;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // recessed bevel
    c.beginPath(); c.arc(C, C, FACE + 8, 0, TAU);
    g = c.createLinearGradient(0, C - FACE, 0, C + FACE);
    g.addColorStop(0, '#0b0c0a');
    g.addColorStop(1, '#5c6057');
    c.fillStyle = g; c.fill();

    // bolts
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * (Math.PI / 2);
      const bx = C + Math.cos(a) * (R - 14);
      const by = C + Math.sin(a) * (R - 14);
      const bg = c.createRadialGradient(bx - 1.5, by - 1.5, 0.5, bx, by, 5);
      bg.addColorStop(0, '#a9ab9f');
      bg.addColorStop(1, '#2b2d28');
      c.beginPath(); c.arc(bx, by, 5, 0, TAU);
      c.fillStyle = bg; c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 0.8; c.stroke();
      const sa = rand(0, Math.PI);
      c.beginPath();
      c.moveTo(bx - Math.cos(sa) * 3.5, by - Math.sin(sa) * 3.5);
      c.lineTo(bx + Math.cos(sa) * 3.5, by + Math.sin(sa) * 3.5);
      c.strokeStyle = '#1a1a17'; c.lineWidth = 1.2; c.stroke();
    }

    // aged face
    g = c.createRadialGradient(C - 20, C - 30, 5, C, C, FACE);
    g.addColorStop(0, '#e6dec2');
    g.addColorStop(0.7, '#c9bf9d');
    g.addColorStop(1, '#8c8263');
    c.beginPath(); c.arc(C, C, FACE, 0, TAU);
    c.fillStyle = g; c.fill();

    // grime + blood specks
    c.save();
    c.beginPath(); c.arc(C, C, FACE, 0, TAU); c.clip();
    for (let i = 0; i < 16; i++) {
      const x = C + rand(-FACE, FACE);
      const y = C + rand(-FACE, FACE);
      const r = rand(6, 32);
      const gg = c.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(60,45,25,${rand(0.05, 0.2).toFixed(2)})`);
      gg.addColorStop(1, 'rgba(60,45,25,0)');
      c.fillStyle = gg;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.arc(C + rand(-FACE * 0.8, FACE * 0.8), C + rand(-FACE * 0.8, FACE * 0.8), rand(0.6, 2.4), 0, TAU);
      c.fillStyle = `rgba(110,15,10,${rand(0.3, 0.75).toFixed(2)})`;
      c.fill();
    }
    // hairline crack
    c.beginPath();
    let cx = C + rand(-FACE * 0.6, -FACE * 0.2);
    let cy = C - FACE;
    c.moveTo(cx, cy);
    for (let i = 0; i < 6; i++) { cx += rand(-6, 14); cy += rand(10, 20); c.lineTo(cx, cy); }
    c.strokeStyle = 'rgba(40,35,25,.35)';
    c.lineWidth = 0.7;
    c.stroke();
    c.restore();

    // ticks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const major = i % 5 === 0;
      const r1 = FACE - 4;
      const r2 = FACE - (major ? 17 : 10);
      c.beginPath();
      c.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
      c.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2);
      c.strokeStyle = '#2b261d';
      c.lineWidth = major ? 2.6 : 1;
      c.stroke();
    }
    c.beginPath(); c.arc(C, C, FACE - 21, 0, TAU);
    c.strokeStyle = 'rgba(43,38,29,.35)'; c.lineWidth = 1; c.stroke();

    // print
    c.fillStyle = '#2b261d';
    c.textAlign = 'center';
    c.font = '13px "Bebas Neue", sans-serif';
    c.fillText('MURKOFF', C, C - FACE * 0.36);
    c.font = '7px "Special Elite", monospace';
    c.fillText('GRIP · TORQUE · INDEX', C, C - FACE * 0.36 + 10);
    c.font = '18px "Bebas Neue", sans-serif';
    c.fillText(keyLabel, C, C + FACE * 0.47);
    c.font = '7px "Special Elite", monospace';
    c.fillText(id === 0 ? 'REAGENT  ·  A' : 'REAGENT  ·  B', C, C + FACE * 0.47 + 11);

    return cv;
  }

  /* ======================= PLAYERS ======================= */
  function makePlayer(id, dir, keyLabel, sel, color) {
    const root = $(sel);
    const canvas = $('canvas.dial', root);
    canvas.width = canvas.height = S * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    const stat = n => $(`[data-stat="${n}"]`, root);
    return {
      id, dir, keyLabel, root, canvas, ctx, color,
      face: buildDialFace(id, keyLabel),
      pops: $('.pops', root),
      keycap: $('.keycap', root),
      winsEl: $('.wins', root),
      els: {
        hits: stat('hits'), perfects: stat('perfects'), misses: stat('misses'),
        combo: stat('combo'), rpm: stat('rpm'),
      },
      angle: -Math.PI / 2, speed: CFG.baseSpeed,
      zoneA: 0, zoneW: CFG.zoneStart,
      stun: 0, flash: 0, flashType: '', shake: 0,
      combo: 0, best: 0, hits: 0, perfects: 0, misses: 0,
      wins: 0, ready: false,
    };
  }

  const players = [
    makePlayer(0, 1, 'SPACE', '#p1', '#e3a526'),
    makePlayer(1, -1, 'ENTER', '#p2', '#3fbcae'),
  ];

  // rebuild dial faces once web fonts are ready
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => players.forEach(p => { p.face = buildDialFace(p.id, p.keyLabel); }));
  }

  function placeZone(p) {
    const offset = rand(1.9, 4.2); // always well ahead of the needle
    p.zoneA = p.dir > 0 ? norm(p.angle + offset) : norm(p.angle - offset - p.zoneW);
  }

  /* ======================= GAME STATE ======================= */
  let state = 'ready';     // ready | countdown | fight | roundEnd | matchEnd
  let balance = 0;         // -1 (B pins) .. +1 (A pins)
  let shownBalance = 0;
  let elapsed = 0;
  let round = 1;
  let countdownT = 0;
  let roundEndT = 0;
  let goT = 0;
  let endAt = 0;
  let lastRoundWinner = -1;

  const ov = $('#overlay');
  const flashEl = $('#flash');
  const timerEl = $('#timer');
  const roundEl = $('#roundLabel');
  const meterFill = $('#meterFill');

  function setOverlay(html) { ov.innerHTML = html; ov.classList.remove('hidden'); }
  function hideOverlay() { ov.classList.add('hidden'); }

  function screenFlash(red) {
    flashEl.classList.remove('go', 'red');
    void flashEl.offsetWidth;
    if (red) flashEl.classList.add('red');
    flashEl.classList.add('go');
  }
  function quake() {
    document.body.classList.remove('quake');
    void document.body.offsetWidth;
    document.body.classList.add('quake');
  }

  function resetRound() {
    balance = 0;
    elapsed = 0;
    for (const p of players) {
      p.angle = -Math.PI / 2;
      p.speed = CFG.baseSpeed;
      p.zoneW = CFG.zoneStart;
      p.stun = 0; p.flash = 0; p.shake = 0;
      p.combo = 0; p.best = 0; p.hits = 0; p.perfects = 0; p.misses = 0;
      p.ready = false;
      placeZone(p);
    }
    updateHUD();
  }

  function toReady() {
    state = 'ready';
    resetRound();
    roundEl.textContent = `ROUND ${round}`;
    showReady();
  }

  function newMatch() {
    round = 1;
    for (const p of players) p.wins = 0;
    toReady();
  }

  function showReady() {
    const [a, b] = players;
    setOverlay(`
      <div class="ov-title">ROUND ${round}</div>
      <div class="ov-sub">两名 Reagent 按下各自按键握手就位</div>
      <div class="ready-row">
        <span class="rd a ${a.ready ? 'on' : ''}">A · SPACE ${a.ready ? '✔' : ''}</span>
        <span class="rd b ${b.ready ? 'on' : ''}">B · ENTER ${b.ready ? '✔' : ''}</span>
      </div>
      <div class="hint">指针扫过<b>黄色区</b>时按键发力，<i>红色中心</i>是完美发力。<br>按空会脱力并被对手反压，转盘会越转越快。</div>
    `);
  }

  function startCountdown() {
    state = 'countdown';
    countdownT = 3;
    showCount(3);
    SFX.beep();
  }
  function showCount(n) {
    setOverlay(`<div class="ov-title ov-count">${n}</div><div class="ov-sub">GET A GRIP</div>`);
  }

  function endRound(w) {
    state = 'roundEnd';
    lastRoundWinner = w;
    players[w].wins++;
    roundEndT = 2.6;
    SFX.slam();
    quake();
    screenFlash(true);
    const p = players[w];
    const tag = w === 0 ? 'a' : 'b';
    setOverlay(`
      <div class="ov-title ${tag}">REAGENT ${w === 0 ? 'A' : 'B'}</div>
      <div class="ov-sub">PINNED IN ${elapsed.toFixed(2)}s · ${p.perfects} PERFECT · BEST COMBO ${p.best}</div>
      <div class="ready-row"><span class="rd on a">A ${players[0].wins}</span><span class="rd on b">B ${players[1].wins}</span></div>
    `);
    updateHUD();
  }

  function showMatchEnd() {
    state = 'matchEnd';
    endAt = performance.now();
    const w = players[0].wins > players[1].wins ? 0 : 1;
    const tag = w === 0 ? 'a' : 'b';
    setOverlay(`
      <div class="ov-sub">TRIAL COMPLETE</div>
      <div class="ov-title ${tag}">REAGENT ${w === 0 ? 'A' : 'B'} WINS</div>
      <div class="ov-sub">${players[0].wins} — ${players[1].wins}</div>
      <div class="hint">按 SPACE / ENTER / R 再来一局</div>
    `);
  }

  /* ======================= INPUT ======================= */
  function pressKeycap(p) {
    p.keycap.classList.add('down');
    setTimeout(() => p.keycap.classList.remove('down'), 90);
  }

  function onKey(pid) {
    const p = players[pid];
    pressKeycap(p);
    audio(); // unlock audio on first gesture
    if (state === 'ready') {
      if (!p.ready) {
        p.ready = true;
        SFX.ready();
        showReady();
        if (players.every(q => q.ready)) startCountdown();
      }
    } else if (state === 'fight') {
      press(p);
    } else if (state === 'matchEnd' && performance.now() - endAt > 1200) {
      newMatch();
    }
  }

  function popText(p, text, cls) {
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    p.pops.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function push(pid, amt) {
    if (state !== 'fight') return;
    balance += pid === 0 ? amt : -amt;
    if (balance >= 1 || balance <= -1) {
      balance = clamp(balance, -1, 1);
      endRound(balance > 0 ? 0 : 1);
    }
  }

  function press(p) {
    if (p.stun > 0) return;
    const o = players[1 - p.id];
    const d = norm(p.angle - p.zoneA);

    if (d <= p.zoneW) {
      const perfect = Math.abs(d - p.zoneW / 2) <= (p.zoneW * CFG.perfectRatio) / 2;
      p.combo++;
      p.best = Math.max(p.best, p.combo);
      p.hits++;
      let amt = perfect ? CFG.pushPerfect : CFG.pushHit;
      amt *= 1 + Math.min(p.combo - 1, 5) * CFG.comboBonus;
      if (perfect) {
        p.perfects++;
        p.flashType = 'perfect';
        SFX.perfect();
        popText(p, p.combo > 2 ? `PERFECT ×${p.combo}` : 'PERFECT', 'perfect');
      } else {
        p.flashType = 'hit';
        SFX.hit();
        popText(p, p.combo > 2 ? `PUSH ×${p.combo}` : 'PUSH', 'hit');
      }
      p.flash = 1;
      p.speed = Math.min(CFG.maxSpeed, p.speed * (1 + CFG.hitAccel));
      p.zoneW = Math.max(CFG.zoneMin, CFG.zoneStart - p.hits * 0.025 - elapsed * 0.006);
      placeZone(p);
      push(p.id, amt);
    } else {
      p.misses++;
      p.combo = 0;
      p.stun = CFG.stunMs;
      p.flash = 1;
      p.flashType = 'miss';
      p.shake = 1;
      p.root.classList.remove('stunned');
      void p.root.offsetWidth;
      p.root.classList.add('stunned');
      SFX.miss();
      popText(p, 'MISS', 'miss');
      push(o.id, CFG.missPenalty);
    }
    updateHUD();
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) onKey(0);
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (!e.repeat) onKey(1);
    } else if (e.code === 'KeyR' && !e.repeat) {
      newMatch();
    } else if (e.code === 'KeyM' && !e.repeat) {
      toggleMute();
    }
  });

  // touch / mouse: tap your own panel
  players.forEach(p => {
    p.root.addEventListener('pointerdown', e => {
      e.preventDefault();
      onKey(p.id);
    });
  });

  const muteBtn = $('#muteBtn');
  function toggleMute() {
    muted = !muted;
    muteBtn.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  }
  muteBtn.addEventListener('click', () => { toggleMute(); muteBtn.blur(); });

  /* ======================= HUD ======================= */
  function updateHUD() {
    for (const p of players) {
      p.els.hits.textContent = p.hits;
      p.els.perfects.textContent = p.perfects;
      p.els.misses.textContent = p.misses;
      p.els.combo.textContent = p.combo;
      let pips = '';
      for (let i = 0; i < CFG.roundsToWin; i++) pips += `<span class="${i < p.wins ? 'on' : ''}"></span>`;
      if (p.winsEl.innerHTML !== pips) p.winsEl.innerHTML = pips;
    }
  }

  function updateFrameHUD() {
    for (const p of players) {
      const rpm = state === 'fight' ? Math.round((p.speed / TAU) * 60) : 0;
      const s = String(rpm);
      if (p.els.rpm.textContent !== s) p.els.rpm.textContent = s;
    }
    timerEl.textContent = elapsed.toFixed(2).padStart(5, '0');
    const b = shownBalance;
    meterFill.style.width = `${Math.abs(b) * 50}%`;
    meterFill.style.left = b >= 0 ? '50%' : `${50 - Math.abs(b) * 50}%`;
    meterFill.style.background = b >= 0 ? players[0].color : players[1].color;
    meterFill.style.boxShadow = `0 0 ${6 + Math.abs(b) * 14}px ${b >= 0 ? players[0].color : players[1].color}`;
  }

  /* ======================= DRAW: DIAL ======================= */
  function drawDial(p) {
    const c = p.ctx;
    const live = state === 'fight' || state === 'countdown';
    const stunned = p.stun > 0;

    c.save();
    c.clearRect(0, 0, S, S);
    if (p.shake > 0) c.translate(rand(-1, 1) * p.shake * 6, rand(-1, 1) * p.shake * 6);
    c.drawImage(p.face, 0, 0, S, S);

    if (live) {
      const a0 = p.zoneA;
      const a1 = p.zoneA + p.zoneW;
      // wedge glow
      c.beginPath();
      c.moveTo(C, C);
      c.arc(C, C, FACE - 4, a0, a1);
      c.closePath();
      c.fillStyle = stunned ? 'rgba(70,70,70,.16)' : 'rgba(226,176,33,.2)';
      c.fill();
      // rim band
      c.lineCap = 'butt';
      c.lineWidth = 15;
      c.beginPath();
      c.arc(C, C, FACE - 11, a0, a1);
      c.strokeStyle = stunned ? '#6d6a60' : '#e2b021';
      c.stroke();
      // perfect core
      const mid = (a0 + a1) / 2;
      const pw = (p.zoneW * CFG.perfectRatio) / 2;
      c.beginPath();
      c.arc(C, C, FACE - 11, mid - pw, mid + pw);
      c.strokeStyle = stunned ? '#4a4740' : '#c3221a';
      c.stroke();
      // zone edges
      c.lineWidth = 1.5;
      c.strokeStyle = '#2b261d';
      for (const a of [a0, a1]) {
        c.beginPath();
        c.moveTo(C + Math.cos(a) * (FACE - 3), C + Math.sin(a) * (FACE - 3));
        c.lineTo(C + Math.cos(a) * (FACE - 20), C + Math.sin(a) * (FACE - 20));
        c.stroke();
      }
    }

    // motion trail
    if (state === 'fight') {
      const k = Math.min(1.1, p.speed * 0.05);
      const t0 = p.dir > 0 ? p.angle - k : p.angle;
      c.beginPath();
      c.moveTo(C, C);
      c.arc(C, C, FACE - 6, t0, t0 + k);
      c.closePath();
      c.fillStyle = 'rgba(150,20,15,.13)';
      c.fill();
    }

    // stun tint
    if (stunned) {
      c.beginPath(); c.arc(C, C, FACE, 0, TAU);
      c.fillStyle = `rgba(140,10,5,${(0.22 * p.stun / CFG.stunMs).toFixed(3)})`;
      c.fill();
    }

    // needle
    c.save();
    c.translate(C, C);
    c.rotate(p.angle);
    c.shadowColor = 'rgba(0,0,0,.55)';
    c.shadowBlur = 4;
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 3;
    c.beginPath();
    c.moveTo(-FACE * 0.22, -4.5);
    c.lineTo(FACE - 8, -1.2);
    c.lineTo(FACE - 4, 0);
    c.lineTo(FACE - 8, 1.2);
    c.lineTo(-FACE * 0.22, 4.5);
    c.closePath();
    c.fillStyle = stunned ? '#5a1310' : '#a5130f';
    c.fill();
    c.shadowColor = 'transparent';
    c.beginPath();
    c.moveTo(-FACE * 0.22, -1);
    c.lineTo(FACE - 8, -0.4);
    c.strokeStyle = 'rgba(255,190,170,.35)';
    c.lineWidth = 0.8;
    c.stroke();
    c.restore();

    // brass cap
    const cg = c.createRadialGradient(C - 3, C - 3, 1, C, C, 11);
    cg.addColorStop(0, '#f1d88a');
    cg.addColorStop(0.5, '#a6812f');
    cg.addColorStop(1, '#3d2e10');
    c.beginPath(); c.arc(C, C, 11, 0, TAU);
    c.fillStyle = cg; c.fill();
    c.beginPath(); c.arc(C, C, 3, 0, TAU);
    c.fillStyle = '#1b150a'; c.fill();

    // feedback ring
    if (p.flash > 0) {
      const col = p.flashType === 'miss' ? '255,59,47' : p.flashType === 'perfect' ? '255,242,168' : '157,255,122';
      c.beginPath();
      c.arc(C, C, FACE + 3 + (1 - p.flash) * 6, 0, TAU);
      c.strokeStyle = `rgba(${col},${p.flash.toFixed(3)})`;
      c.lineWidth = 6;
      c.stroke();
    }

    // glass glare
    c.save();
    c.beginPath(); c.arc(C, C, FACE, 0, TAU); c.clip();
    const gl = c.createLinearGradient(C - FACE, C - FACE, C + FACE * 0.2, C + FACE * 0.2);
    gl.addColorStop(0, 'rgba(255,255,255,.18)');
    gl.addColorStop(0.45, 'rgba(255,255,255,.04)');
    gl.addColorStop(0.46, 'rgba(255,255,255,0)');
    c.fillStyle = gl;
    c.fillRect(0, 0, S, S);
    c.restore();

    c.restore();
  }

  /* ======================= DRAW: ARMS ======================= */
  const armsCv = $('#arms');
  const AW = 420, AH = 280;
  armsCv.width = AW * 2;
  armsCv.height = AH * 2;
  const ac = armsCv.getContext('2d');
  ac.scale(2, 2);

  const TABLE_Y = AH * 0.6;
  const scratches = Array.from({ length: 22 }, () => {
    const x = rand(40, AW - 40);
    const y = rand(TABLE_Y + 6, AH - 4);
    const a = rand(-0.4, 0.4);
    const l = rand(6, 26);
    return [x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, rand(0.05, 0.18)];
  });

  function limb(c, x1, y1, x2, y2, w, color, shade) {
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
    c.strokeStyle = shade; c.lineWidth = w; c.stroke();
    c.beginPath(); c.moveTo(x1 - 1, y1 - 1.5); c.lineTo(x2 - 1, y2 - 1.5);
    c.strokeStyle = color; c.lineWidth = w - 7; c.stroke();
  }

  function silhouette(c, x, y, rim, lean) {
    c.save();
    c.translate(x + lean, y);
    c.rotate(lean * 0.01);
    c.beginPath();
    c.ellipse(0, 0, 46, 72, 0, 0, TAU);
    c.fillStyle = '#0d100e';
    c.fill();
    c.strokeStyle = rim; c.globalAlpha = 0.35; c.lineWidth = 2; c.stroke();
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(0, -92, 25, 0, TAU);
    c.fillStyle = '#0d100e';
    c.fill();
    c.strokeStyle = rim; c.globalAlpha = 0.35; c.stroke();
    c.globalAlpha = 1;
    // goggles glint (night-vision rig)
    c.beginPath();
    c.arc(x < AW / 2 ? 12 : -12, -94, 4, 0, TAU);
    c.fillStyle = 'rgba(140,255,120,.55)';
    c.fill();
    c.restore();
  }

  function pad(c, x, y, heat) {
    c.beginPath();
    c.ellipse(x, y, 24, 7, 0, 0, TAU);
    c.fillStyle = '#16110d';
    c.fill();
    c.strokeStyle = 'rgba(255,220,170,.18)';
    c.lineWidth = 1;
    c.stroke();
    if (heat > 0) {
      c.beginPath();
      c.ellipse(x, y, 24, 7, 0, 0, TAU);
      c.fillStyle = `rgba(200,30,20,${(heat * 0.6).toFixed(3)})`;
      c.fill();
    }
  }

  function drawArms() {
    const c = ac;
    c.clearRect(0, 0, AW, AH);

    // lamp light cone
    let g = c.createRadialGradient(AW / 2, -20, 10, AW / 2, -20, AH * 1.1);
    g.addColorStop(0, 'rgba(230,235,190,.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, AW, AH);
    c.fillStyle = '#1c1f1a';
    c.beginPath();
    c.moveTo(AW / 2 - 26, 0); c.lineTo(AW / 2 + 26, 0);
    c.lineTo(AW / 2 + 40, 14); c.lineTo(AW / 2 - 40, 14);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(250,245,200,.9)';
    c.fillRect(AW / 2 - 32, 13, 64, 3);

    const lean = shownBalance * 10;
    silhouette(c, 52, TABLE_Y - 30, players[0].color, lean * 0.6);
    silhouette(c, AW - 52, TABLE_Y - 30, players[1].color, lean * 0.6);

    // table
    g = c.createLinearGradient(0, TABLE_Y, 0, AH);
    g.addColorStop(0, '#4a3c2d');
    g.addColorStop(1, '#19130e');
    c.beginPath();
    c.moveTo(24, TABLE_Y); c.lineTo(AW - 24, TABLE_Y);
    c.lineTo(AW + 10, AH); c.lineTo(-10, AH);
    c.closePath();
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,230,180,.16)';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(24, TABLE_Y); c.lineTo(AW - 24, TABLE_Y); c.stroke();
    for (const [x1, y1, x2, y2, al] of scratches) {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
      c.strokeStyle = `rgba(255,230,190,${al})`;
      c.lineWidth = 0.7; c.stroke();
    }

    const px = AW / 2;
    const py = AH * 0.86;

    // pin pads + elbow pad
    pad(c, px - 128, py - 4, clamp((-shownBalance - 0.6) / 0.4, 0, 1));
    pad(c, px + 128, py - 4, clamp((shownBalance - 0.6) / 0.4, 0, 1));
    c.beginPath();
    c.ellipse(px, py + 5, 58, 12, 0, 0, TAU);
    c.fillStyle = '#231b15';
    c.fill();

    // arm geometry
    const tremble = state === 'fight' ? 1 : 0.2;
    const a = shownBalance * 1.42 + (Math.random() - 0.5) * 0.014 * tremble;
    const L = 122;
    const hx = px + Math.sin(a) * L;
    const hy = py - Math.cos(a) * L;
    const e1 = [px - 22, py];
    const e2 = [px + 22, py];

    // upper arms (sleeves)
    limb(c, 70 + lean * 0.6, TABLE_Y - 50, e1[0], e1[1], 32, '#4d5b52', '#1f2621');
    limb(c, AW - 70 + lean * 0.6, TABLE_Y - 50, e2[0], e2[1], 32, '#5b524d', '#26201d');

    // forearms
    const skin1 = ['#c99a74', '#6e4c34'];
    const skin2 = ['#9a6a4b', '#4b301f'];
    limb(c, e2[0], e2[1], hx + 6, hy, 26, skin2[0], skin2[1]);
    limb(c, e1[0], e1[1], hx - 6, hy, 26, skin1[0], skin1[1]);

    // wrist bands
    const band = (ex, ey, col) => {
      const t1 = 0.68, t2 = 0.78;
      c.lineCap = 'butt';
      c.beginPath();
      c.moveTo(ex + (hx - ex) * t1, ey + (hy - ey) * t1);
      c.lineTo(ex + (hx - ex) * t2, ey + (hy - ey) * t2);
      c.strokeStyle = col; c.lineWidth = 22; c.stroke();
    };
    band(e2[0], e2[1], players[1].color);
    band(e1[0], e1[1], players[0].color);

    // clasped fists
    const fist = (x, y, col, shade) => {
      c.beginPath(); c.arc(x, y, 15, 0, TAU);
      c.fillStyle = col; c.fill();
      c.strokeStyle = shade; c.lineWidth = 2; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.arc(x + i * 6, y - 6, 3.5, Math.PI, 0);
        c.stroke();
      }
    };
    fist(hx + 7, hy - 2, skin2[0], skin2[1]);
    fist(hx - 7, hy + 2, skin1[0], skin1[1]);

    // strain sweat flecks at high pressure
    if (state === 'fight' && Math.abs(shownBalance) > 0.55 && Math.random() < 0.3) {
      c.fillStyle = 'rgba(220,235,255,.6)';
      c.beginPath();
      c.arc(hx + rand(-20, 20), hy + rand(-25, 5), rand(0.8, 1.6), 0, TAU);
      c.fill();
    }
  }

  /* ======================= LOOP ======================= */
  function update(dt) {
    if (state === 'fight') {
      elapsed += dt;
      for (const p of players) {
        p.speed = Math.min(CFG.maxSpeed, p.speed * (1 + CFG.timeAccel * dt));
        p.angle = norm(p.angle + p.dir * p.speed * dt);
        if (p.stun > 0) p.stun = Math.max(0, p.stun - dt * 1000);
      }
      if (goT > 0) {
        goT -= dt;
        if (goT <= 0) hideOverlay();
      }
    } else if (state === 'countdown') {
      const prev = Math.ceil(countdownT);
      countdownT -= dt;
      const cur = Math.ceil(countdownT);
      if (countdownT <= 0) {
        state = 'fight';
        goT = 0.6;
        SFX.go();
        screenFlash(false);
        setOverlay('<div class="ov-title ov-count">PUSH!</div>');
      } else if (cur !== prev) {
        SFX.beep();
        showCount(cur);
      }
    } else {
      // idle sway between rounds
      for (const p of players) p.angle = norm(p.angle + p.dir * 0.5 * dt);
    }

    if (state === 'roundEnd') {
      roundEndT -= dt;
      if (roundEndT <= 0) {
        if (players.some(p => p.wins >= CFG.roundsToWin)) {
          showMatchEnd();
        } else {
          round++;
          toReady();
        }
      }
    }

    for (const p of players) {
      p.flash = Math.max(0, p.flash - dt * 2.5);
      p.shake = Math.max(0, p.shake - dt * 4);
    }
    const target = state === 'ready' || state === 'countdown' ? 0 : balance;
    shownBalance += (target - shownBalance) * Math.min(1, dt * 10);
  }

  function render() {
    for (const p of players) drawDial(p);
    drawArms();
    updateFrameHUD();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  toReady();
  requestAnimationFrame(frame);
})();
