(() => {
  const TAU = Math.PI * 2;
  const START_SPEED = 1.8;      // rad/s
  const ACCEL = 0.9;            // rad/s² — 转盘持续加速
  const MAX_SPEED = 11;
  const LOCK_MS = 700;
  const WIN_STEP = 9, PERFECT_BONUS = 4, MISS_PENALTY = 6;

  const $ = id => document.getElementById(id);
  const arms = $('arms'), statusEl = $('status'), overlay = $('overlay');
  const COLORS = ['#e0b43a', '#c9573a'];

  function makePlayer(i) {
    return { i, canvas: $('dial' + (i + 1)), el: $('p' + (i + 1)),
      angle: 0, speed: START_SPEED, zoneCenter: 0, zoneWidth: 0.9, lock: 0, flash: 0, flashColor: '' };
  }
  const players = [makePlayer(0), makePlayer(1)];
  let state = 'idle', progress = 50, countdown = 0, last = 0;

  function newZone(p) {
    p.zoneCenter = Math.random() * TAU;
    p.zoneWidth = 0.9;
  }
  function resetPlayer(p) {
    p.angle = Math.random() * TAU; p.speed = START_SPEED; p.lock = 0; p.flash = 0; newZone(p);
  }
  function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

  function setStatus(t, big) { statusEl.textContent = t; statusEl.classList.toggle('big', !!big); }
  function render() { arms.style.left = progress + '%'; }

  function start() {
    players.forEach(resetPlayer);
    progress = 50; render(); overlay.classList.remove('show');
    state = 'count'; countdown = 3.2;
  }

  function press(p) {
    if (state === 'idle' || state === 'over') { if (state === 'idle') start(); return; }
    if (state !== 'play' || p.lock > 0) return;
    const d = Math.abs(angDiff(p.angle, p.zoneCenter));
    const dir = p.i === 0 ? -1 : 1;           // P1 pushes toward left, P2 toward right
    if (d <= p.zoneWidth / 2) {
      const perfect = d < p.zoneWidth * 0.12;
      progress += dir * (WIN_STEP + (perfect ? PERFECT_BONUS : 0));
      p.speed = Math.max(START_SPEED, p.speed * 0.55);   // 命中后转盘回落一点
      newZone(p); p.flash = 0.25; p.flashColor = '#7fd13b';
      p.el.classList.add('hit'); setTimeout(() => p.el.classList.remove('hit'), 160);
      setStatus(perfect ? 'PERFECT!' : 'GOOD');
    } else {
      progress -= dir * MISS_PENALTY;
      p.lock = LOCK_MS / 1000; p.flash = 0.3; p.flashColor = '#c23a22';
      p.el.classList.remove('miss'); void p.el.offsetWidth; p.el.classList.add('miss');
      setStatus('P' + (p.i + 1) + ' 失误');
    }
    progress = Math.max(0, Math.min(100, progress)); render();
    if (progress <= 4) finish(0); else if (progress >= 96) finish(1);
  }

  function finish(w) {
    state = 'over';
    $('result').textContent = 'PLAYER ' + (w + 1) + ' 获胜';
    $('result').style.color = COLORS[w];
    overlay.classList.add('show');
  }

  function drawDial(p) {
    const c = p.canvas, g = c.getContext('2d'), W = c.width, cx = W / 2, cy = W / 2, R = W / 2 - 14;
    g.clearRect(0, 0, W, W);
    // 外壳
    g.beginPath(); g.arc(cx, cy, R + 10, 0, TAU); g.fillStyle = '#0d0b07'; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#3a3322'; g.stroke();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = '#26210f'; g.fill();
    // 刻度
    for (let k = 0; k < 60; k++) {
      const a = k / 60 * TAU, l = k % 5 === 0 ? 14 : 7;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      g.lineTo(cx + Math.cos(a) * (R - 4 - l), cy + Math.sin(a) * (R - 4 - l));
      g.lineWidth = 2; g.strokeStyle = '#6b6044'; g.stroke();
    }
    // 判定区
    const half = p.zoneWidth / 2, rz = R - 38;
    g.lineCap = 'butt'; g.lineWidth = 30;
    g.beginPath(); g.arc(cx, cy, rz, p.zoneCenter - half, p.zoneCenter + half);
    g.strokeStyle = '#7fd13b'; g.stroke();
    g.lineWidth = 30; g.beginPath(); g.arc(cx, cy, rz, p.zoneCenter - half * 0.12, p.zoneCenter + half * 0.12);
    g.strokeStyle = '#d8ff9a'; g.stroke();
    // 指针
    const lockedCol = p.lock > 0 ? '#c23a22' : '#f2e9cf';
    g.save(); g.translate(cx, cy); g.rotate(p.angle);
    g.beginPath(); g.moveTo(-14, -4); g.lineTo(R - 14, -2); g.lineTo(R - 4, 0); g.lineTo(R - 14, 2); g.lineTo(-14, 4);
    g.closePath(); g.fillStyle = lockedCol; g.fill(); g.restore();
    g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.fillStyle = COLORS[p.i]; g.fill();
    g.lineWidth = 3; g.strokeStyle = '#0d0b07'; g.stroke();
    // 速度文字
    g.fillStyle = '#8a7f62'; g.font = '16px Impact, sans-serif'; g.textAlign = 'center';
    g.fillText('SPD ' + (p.speed / START_SPEED).toFixed(1) + 'x', cx, cy + 50);
    // 闪光
    if (p.flash > 0) { g.globalAlpha = p.flash * 2; g.beginPath(); g.arc(cx, cy, R + 8, 0, TAU);
      g.lineWidth = 8; g.strokeStyle = p.flashColor; g.stroke(); g.globalAlpha = 1; }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (state === 'count') {
      countdown -= dt;
      const n = Math.ceil(countdown);
      if (countdown <= 0) { state = 'play'; setStatus('GO!'); }
      else if (n <= 3) setStatus(String(n), true);
      if (state === 'play') statusEl.classList.remove('big');
    }
    players.forEach(p => {
      if (state === 'play') {
        p.angle = (p.angle + p.speed * dt) % TAU;
        if (p.lock > 0) p.lock -= dt;
        else p.speed = Math.min(MAX_SPEED, p.speed + ACCEL * dt);
      }
      if (p.flash > 0) p.flash -= dt;
      drawDial(p);
    });
    requestAnimationFrame(loop);
  }

  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); press(players[0]); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); press(players[1]); }
    else if (e.code === 'KeyR') start();
  });
  $('again').addEventListener('click', start);
  players.forEach(resetPlayer); render();
  requestAnimationFrame(loop);
})();
