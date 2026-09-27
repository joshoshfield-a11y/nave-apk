// N A V E — a cathedral of echoes. game-forge pipeline run #1, round 2.
const PAL = {
  bg: 0x160d18, fog: 0x160d18,
  stone: 0x7d5468, stoneHi: 0xb98ca0, dark: 0x2a1826,
  glass: 0xff6f9c, flame: 0xffb163,
};

let stepPhase = 0;

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const TEST = navigator.webdriver;
renderer.setPixelRatio(TEST ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
scene.fog = new THREE.FogExp2(PAL.fog, 0.0095);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 220);

// ---------- lights (round-2 rebalance: dim ambient, raking key) ----------
scene.add(new THREE.HemisphereLight(0x4a2f42, 0x120a14, 0.32));
const moon = new THREE.DirectionalLight(0x9a7a8e, 0.6);
moon.position.set(-10, 22, 6);
scene.add(moon);

// ---------- canvas textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
const roseTex = canvasTex(512, 512, (g, w, h) => {
  const cx = w / 2, cy = h / 2;
  g.fillStyle = '#160a12'; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(cx, cy, 10, cx, cy, 250);
  glow.addColorStop(0, 'rgba(255,111,156,0.9)'); glow.addColorStop(0.5, 'rgba(160,50,90,0.35)');
  glow.addColorStop(1, 'rgba(30,10,20,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ff8fb4'; g.lineWidth = 5;
  for (const r of [70, 130, 190, 235]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
    g.lineTo(cx + Math.cos(a) * 235, cy + Math.sin(a) * 235); g.stroke();
    const a2 = a + Math.PI / 12;
    g.beginPath(); g.arc(cx + Math.cos(a2) * 165, cy + Math.sin(a2) * 165, 32, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = '#ffd0de'; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill();
});
const flameTex = canvasTex(64, 96, (g, w, h) => {
  const grd = g.createRadialGradient(w/2, h*0.62, 2, w/2, h*0.6, w*0.55);
  grd.addColorStop(0, 'rgba(255,240,210,1)'); grd.addColorStop(0.35, 'rgba(255,177,99,0.9)');
  grd.addColorStop(0.75, 'rgba(200,60,30,0.35)'); grd.addColorStop(1, 'rgba(120,20,10,0)');
  g.fillStyle = grd;
  g.beginPath(); g.ellipse(w/2, h*0.58, w*0.32, h*0.4, 0, 0, Math.PI*2); g.fill();
});
const dustTex = canvasTex(32, 32, (g, w, h) => {
  const grd = g.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
  grd.addColorStop(0, 'rgba(255,220,235,0.9)'); grd.addColorStop(1, 'rgba(255,220,235,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});
const floorTex = canvasTex(64, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, '#0e0810'); grd.addColorStop(0.5, '#4a2f3c'); grd.addColorStop(1, '#0e0810');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

// ---------- materials ----------
const stoneMat = new THREE.MeshStandardMaterial({ color: PAL.stone, roughness: 0.88, metalness: 0.04 });
const stoneHiMat = new THREE.MeshStandardMaterial({ color: PAL.stoneHi, roughness: 0.8, metalness: 0.05 });
const darkMat = new THREE.MeshStandardMaterial({ color: PAL.dark, roughness: 1 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x4e3242, roughness: 0.92, metalness: 0.03 });

const shaftTex = canvasTex(64, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(255,190,215,0.55)'); grd.addColorStop(1, 'rgba(255,190,215,0)');
  g.fillStyle = grd; g.beginPath();
  g.moveTo(w*0.3, 0); g.lineTo(w*0.7, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
});
const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.10,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });

// ---------- world ----------
const world = new THREE.Group(); scene.add(world);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 130),
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -47);
world.add(floor);

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(34, 130),
  new THREE.MeshStandardMaterial({ color: 0x352236, roughness: 1 }));
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 14, -47);
world.add(ceil);
for (let i = 0; i < 6; i++) {
  const rib = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.22, 6, 24, Math.PI), frameMat);
  rib.position.set(0, 3.4, -12 - i * 16);
  world.add(rib);
}

function archFrame(outerW, outerH, innerW, innerH, depth) {
  const s = new THREE.Shape();
  s.moveTo(-outerW/2, 0); s.lineTo(-outerW/2, outerH*0.45);
  s.quadraticCurveTo(-outerW/2, outerH*0.86, 0, outerH);
  s.quadraticCurveTo(outerW/2, outerH*0.86, outerW/2, outerH*0.45);
  s.lineTo(outerW/2, 0); s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-innerW/2, 0); hole.lineTo(-innerW/2, innerH*0.45);
  hole.quadraticCurveTo(-innerW/2, innerH*0.86, 0, innerH);
  hole.quadraticCurveTo(innerW/2, innerH*0.86, innerW/2, innerH*0.45);
  hole.lineTo(innerW/2, 0); hole.closePath();
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

const MODULES = 12, STEP = 8, X_WALL = 9;
const colliders = [];
for (let i = 0; i < MODULES; i++) {
  const z = -6 - i * STEP;
  for (const side of [-1, 1]) {
    const frame = new THREE.Mesh(archFrame(6.4, 8.6, 5.2, 7.6, 0.6), frameMat);
    frame.position.set(side * X_WALL, 0, z - STEP/2);
    frame.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;
    world.add(frame);
    const span = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.4, STEP), frameMat);
    span.position.set(side * X_WALL, 8.6 + 2.7, z - STEP/2);
    world.add(span);
    if (i % 3 === 1) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 7),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.72, 0.25, 0.46), fog: false }));
      glass.position.set(side * (X_WALL + 2.5), 3.4, z - STEP/2);
      glass.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;
      world.add(glass);
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 13), shaftMat);
      shaft.position.set(side * (X_WALL - 2.2), 6.2, z - STEP/2);
      shaft.rotation.set(0, side > 0 ? -0.9 : 0.9, side * 0.42);
      world.add(shaft);
    }
  }
  const col = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 14, 10), stoneHiMat);
  core.position.y = 7; col.add(core);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 14, 6), stoneMat);
    shaft.position.set(Math.cos(a) * 0.62, 7, Math.sin(a) * 0.62);
    col.add(shaft);
  }
  const capBase = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.13, 6, 12), stoneHiMat);
  capBase.rotation.x = Math.PI / 2; capBase.position.y = 0.35; col.add(capBase);
  const capTop = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.14, 6, 12), stoneHiMat);
  capTop.rotation.x = Math.PI / 2; capTop.position.y = 9.2; col.add(capTop);
  col.position.set(-X_WALL + 0.8, 0, z);
  world.add(col);
  colliders.push({ x: -X_WALL + 0.8, z, r: 0.85 });
  const col2 = col.clone(); col2.position.x = X_WALL - 0.8;
  world.add(col2);
  colliders.push({ x: X_WALL - 0.8, z, r: 0.85 });
}

const farWall = new THREE.Mesh(new THREE.BoxGeometry(34, 16, 1), stoneMat);
farWall.position.set(0, 8, -100); world.add(farWall);
const roseMat = new THREE.MeshBasicMaterial({ map: roseTex, fog: false });
roseMat.color.setRGB(2.1, 2.1, 2.1);
const altarGlow = new THREE.PointLight(0xff9a7a, 0.85, 46, 1.7);
altarGlow.position.set(0, 4.5, -92); world.add(altarGlow);
const rose = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), roseMat);
rose.position.set(0, 9, -99.4); world.add(rose);
// round 3: far-wall relief — molding ring + flanking lancet moldings
const ring = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.32, 8, 48), stoneHiMat);
ring.position.set(0, 9, -99.3); world.add(ring);
for (const fx of [-7.6, 7.6]) {
  const m = new THREE.Mesh(archFrame(3.4, 6.4, 2.7, 5.6, 0.4), frameMat);
  m.position.set(fx, 0, -99.2); world.add(m);
}
// round 3: vault ribs + lifted ceiling tone (kills the black-void read)


for (let i = 0; i < 3; i++) {
  const st = new THREE.Mesh(new THREE.BoxGeometry(10 - i * 2, 0.35, 3), stoneHiMat);
  st.position.set(0, 0.17 + i * 0.35, -93.5 - i * 0.6);
  world.add(st);
}

// ---------- candelabras ----------
const candles = [];
const CANDLE_Z = [-14, -26, -38, -50, -62, -74, -86];
CANDLE_Z.forEach((z, i) => {
  const x = (i % 2 === 0 ? -1 : 1) * 3.1;
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.5, 8), stoneHiMat);
  stem.position.y = 0.75; g.add(stem);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.18, 8), stoneHiMat);
  cup.position.y = 1.56; g.add(cup);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 8), stoneHiMat);
  base.position.y = 0.06; g.add(base);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameTex, color: new THREE.Color(2.2, 1.6, 1.1),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  flame.position.y = 1.95; flame.scale.set(0.5, 0.85, 1); g.add(flame);
  const light = new THREE.PointLight(PAL.flame, 0, 20, 1.9);
  light.position.y = 2.1; g.add(light);
  const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color(2.4, 1.2, 0.6),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  ember.scale.set(0.09, 0.09, 1); g.add(ember);
  g.position.set(x, 0, z);
  world.add(g);
  candles.push({ g, flame, light, x, z, lit: false, dwell: 0 });
});


// ---------- echo wisps (collectibles) + god-ray shafts + candle embers ----------
const echoTex = canvasTex(64, 64, (g, w, h) => {
  const grd = g.createRadialGradient(w/2, h/2, 1, w/2, h/2, w/2);
  grd.addColorStop(0, 'rgba(215,235,255,1)'); grd.addColorStop(0.4, 'rgba(150,190,255,0.5)');
  grd.addColorStop(1, 'rgba(120,160,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});
const echoes = [];
const LORE = [
  "the nave remembers every footstep.",
  "someone prayed here, once.",
  "the glass was blue, before the fire.",
  "seven flames, seven names.",
  "listen: the stone is still warm.",
  "the architect never saw it finished.",
  "you are not the first to carry light."];
const loreEl = document.createElement('div');
loreEl.setAttribute('style', 'position:fixed;bottom:9%;left:0;right:0;text-align:center;color:#bcd4ff;' +
  'font-family:Georgia,serif;font-size:clamp(13px,3vw,18px);letter-spacing:.22em;opacity:0;' +
  'transition:opacity 1.4s;pointer-events:none;z-index:7;text-shadow:0 0 14px rgba(120,160,255,.6)');
document.body.appendChild(loreEl);
let loreTimer = null, echoesGot = 0;
for (let i = 0; i < 7; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: echoTex, color: new THREE.Color(1.5, 1.8, 2.3),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  s.scale.set(0.55, 0.55, 1);
  const bx = (i % 2 === 0 ? -1 : 1) * (2.5 + (i % 3)), bz = -10 - i * 12.5, by = 2.2 + (i % 3) * 1.6;
  world.add(s);
  echoes.push({ s, bx, bz, by, ph: i * 1.7, got: false });
}
function collectEcho(e) {
  e.got = true; e.s.visible = false; echoesGot++;
  bell(1174, 0.9, 0.14);
  loreEl.textContent = LORE[echoes.indexOf(e)] || "";
  loreEl.style.opacity = '0.9';
  clearTimeout(loreTimer);
  loreTimer = setTimeout(() => loreEl.style.opacity = '0', 4200);
}

// ---------- dust ----------
const DUST_N = 700;
const dustGeo = new THREE.BufferGeometry();
const dPos = new Float32Array(DUST_N * 3), dBase = new Float32Array(DUST_N * 3), dPhase = new Float32Array(DUST_N);
for (let i = 0; i < DUST_N; i++) {
  dBase[i*3] = dPos[i*3] = (Math.random() - 0.5) * 16;
  dBase[i*3+1] = dPos[i*3+1] = Math.random() * 12;
  dBase[i*3+2] = dPos[i*3+2] = 4 - Math.random() * 102;
  dPhase[i] = Math.random() * Math.PI * 2;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  map: dustTex, size: 0.05, transparent: true, opacity: 0.26,
  blending: THREE.AdditiveBlending, depthWrite: false, color: 0xd8a7ba }));
world.add(dust);

// ---------- player ----------
const player = {
  pos: new THREE.Vector3(0, 1.65, 2), yaw: 0, pitch: 0,
  vel: new THREE.Vector3(), mode: 'attract', speed: 3.4,
};
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; enterPlay(); });
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousedown', () => { enterPlay(); });
addEventListener('mousemove', e => {
  if (player.mode === 'play' && document.pointerLockElement) {
    player.yaw -= e.movementX * 0.0023;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - e.movementY * 0.0023));
  }
});
// round 6: virtual joystick — left half = move stick, right half = look drag
let joyId = null, joyBase = { x: 0, y: 0 }, joyVec = { x: 0, y: 0 };
let lookId = null, lookLast = { x: 0, y: 0 };
let joyBaseEl = null, joyNubEl = null;
function joyDom() {
  if (joyBaseEl) return;
  const mk = (css) => { const d = document.createElement('div');
    d.setAttribute('style', css); document.body.appendChild(d); return d; };
  joyBaseEl = mk('position:fixed;width:110px;height:110px;border:2px solid rgba(232,205,216,.35);' +
    'border-radius:50%;display:none;pointer-events:none;z-index:8;transform:translate(-50%,-50%)');
  joyNubEl = mk('position:fixed;width:44px;height:44px;background:rgba(232,205,216,.45);' +
    'border-radius:50%;display:none;pointer-events:none;z-index:9;transform:translate(-50%,-50%)');
}
addEventListener('touchstart', e => {
  enterPlay(); joyDom();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth / 2 && joyId === null) {
      joyId = t.identifier; joyBase = { x: t.clientX, y: t.clientY }; joyVec = { x: 0, y: 0 };
      joyBaseEl.style.display = joyNubEl.style.display = 'block';
      joyBaseEl.style.left = joyNubEl.style.left = t.clientX + 'px';
      joyBaseEl.style.top = joyNubEl.style.top = t.clientY + 'px';
    } else if (lookId === null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; }
  }
}, { passive: true });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) {
      let dx = (t.clientX - joyBase.x) / 55, dy = (t.clientY - joyBase.y) / 55;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      joyVec = { x: dx, y: dy };
      joyNubEl.style.left = (joyBase.x + dx * 40) + 'px';
      joyNubEl.style.top = (joyBase.y + dy * 40) + 'px';
    } else if (t.identifier === lookId && player.mode === 'play') {
      player.yaw -= (t.clientX - lookLast.x) * 0.0052;
      player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - (t.clientY - lookLast.y) * 0.0052));
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }
}, { passive: true });
addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) { joyId = null; joyVec = { x: 0, y: 0 };
      if (joyBaseEl) joyBaseEl.style.display = joyNubEl.style.display = 'none'; }
    if (t.identifier === lookId) lookId = null;
  }
});
const walkTouch = false; // superseded by joystick

const titleEl = document.getElementById('title');
function enterPlay() {
  if (player.mode !== 'attract') return;
  initAudio();
  player.mode = 'play';
  titleEl.style.opacity = '0';
  setTimeout(() => titleEl.style.display = 'none', 1300);
  renderer.domElement.requestPointerLock?.().catch?.(() => {});
}

function collide(p) {
  p.x = Math.max(-X_WALL + 1.5, Math.min(X_WALL - 1.5, p.x));
  p.z = Math.max(-97, Math.min(3, p.z));
  for (const c of colliders) {
    const dx = p.x - c.x, dz = p.z - c.z, d2 = dx*dx + dz*dz, rr = c.r + 0.45;
    if (d2 < rr*rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      p.x = c.x + dx/d * rr; p.z = c.z + dz/d * rr;
    }
  }
}

// ---------- game state ----------
let lit = 0; const TOTAL = candles.length;
const hud = document.getElementById('hud');
const finEl = document.getElementById('fin');
function lightCandle(c) {
  c.lit = true; lit++;
  hud.textContent = `✦ ${lit} / ${TOTAL}`;
  bell(620 + lit * 46, 1.4, 0.2);
  c.pop = 0;
  if (lit === TOTAL) {
    let t = 0;
    const iv = setInterval(() => {
      t += 0.05;
      const k = Math.min(1, t);
      roseMat.color.setRGB(2.1 + 3.2 * k, 2.1 + 1.9 * k, 2.1 + 2.2 * k);
      if (k >= 1) { clearInterval(iv); finEl.style.display = 'flex'; padSwell(); }
    }, 50);
  }
}


// ---------- procedural audio (WebAudio, zero assets) ----------
let AC = null, masterGain = null, qualityLevel = 2;
function initAudio() {
  if (AC) { AC.resume?.(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  masterGain = AC.createGain(); masterGain.gain.value = 0.5; masterGain.connect(AC.destination);
  const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), dd = buf.getChannelData(0);
  for (let i = 0; i < len; i++) dd[i] = Math.random() * 2 - 1;
  const wind = AC.createBufferSource(); wind.buffer = buf; wind.loop = true;
  const bp = AC.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 380; bp.Q.value = 0.6;
  const wg = AC.createGain(); wg.gain.value = 0.03;
  const lfo = AC.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = AC.createGain(); lfoG.gain.value = 0.02;
  lfo.connect(lfoG); lfoG.connect(wg.gain);
  wind.connect(bp); bp.connect(wg); wg.connect(masterGain); wind.start(); lfo.start();
  const padG = AC.createGain(); padG.gain.value = 0.028; padG.connect(masterGain);
  for (const f of [110, 110.7, 164.8]) {
    const o = AC.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const g = AC.createGain(); g.gain.value = f > 150 ? 0.4 : 1;
    const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
    o.connect(g); g.connect(lp); lp.connect(padG); o.start();
  }
}
function bell(freq, dur, vol) {
  if (!AC) return; dur = dur || 1.2; vol = vol || 0.2;
  const t = AC.currentTime;
  for (const pair of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
    const o = AC.createOscillator(); o.type = "sine"; o.frequency.value = freq * pair[0];
    const g = AC.createGain();
    g.gain.setValueAtTime(vol * pair[1], t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (pair[0] === 1 ? 1 : 0.4));
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.1);
  }
}
function padSwell() {
  if (!AC) return;
  const t = AC.currentTime;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.13, t + 2.5);
  g.connect(masterGain);
  for (const f of [220, 277.2, 329.6, 440]) {
    const o = AC.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const og = AC.createGain(); og.gain.value = 0.25;
    o.connect(og); og.connect(g); o.start(t); o.stop(t + 9);
  }
}
function footstep() {
  if (!AC) return;
  const t = AC.currentTime, len = Math.floor(AC.sampleRate * 0.08);
  const buf = AC.createBuffer(1, len, AC.sampleRate), dd = buf.getChannelData(0);
  for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 280;
  const g = AC.createGain(); g.gain.value = 0.045;
  s.connect(f); f.connect(g); g.connect(masterGain); s.start(t);
}


// ---------- shared presence: MQTT bus (graceful solo when unreachable) ----------
const mp = { cid: 'u' + Math.random().toString(36).slice(2, 8), cli: null, remote: null,
  connected: false, url: 0, t: 0, greeted: false };
const BROKERS = ['wss://test.mosquitto.org:8081/mqtt', 'wss://broker.emqx.io:8084/mqtt',
                 'wss://broker.hivemq.com:8884/mqtt'];
function mpConnect() {
  if (typeof mqtt === 'undefined' || mp.url >= BROKERS.length) return;
  try {
    mp.cli = mqtt.connect(BROKERS[mp.url], { clientId: 'nave-' + mp.cid,
      reconnectPeriod: 4000, connectTimeout: 9000 });
  } catch (e) { mp.url++; setTimeout(mpConnect, 1200); return; }
  mp.cli.on('connect', () => { mp.connected = true; mp.cli.subscribe('nave/v1/me'); });
  mp.cli.on('message', (topic, payload) => {
    try { mp.remote = JSON.parse(payload.toString()); } catch (e) {}
  });
  mp.cli.on('error', () => { mp.url++; try { mp.cli.end(true); } catch (e) {} setTimeout(mpConnect, 1500); });
}
function mpStart() {
  if (typeof mqtt === 'undefined') { console.log('[nave] solo: no mqtt lib'); return; }
  try { mpConnect(); } catch (e) { console.log('[nave] solo: bus init failed'); }
}
if (document.readyState === 'complete') setTimeout(mpStart, 50);
else addEventListener('load', function () { setTimeout(mpStart, 50); });
setTimeout(function () { if (!mp.cli) console.log('[nave] solo: no bus reachable'); }, 14000);
const wisp = new THREE.Sprite(new THREE.SpriteMaterial({ map: echoTex,
  color: new THREE.Color(2.6, 2.6, 2.9), blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true, opacity: 0 }));
wisp.scale.set(0.9, 0.9, 1); world.add(wisp);

// ---------- postfx + loop ----------
const postfx = new PostFX(renderer, { threshold: 0.5, bloomStrength: 1.25, scale: 0.5 });
postfx.setSize(renderer.domElement.width, renderer.domElement.height);

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.setSize(renderer.domElement.width, renderer.domElement.height);
});

let frames = 0, fpsTime = 0, fps = 0;
const clock = new THREE.Clock();
window.__gf = { ready: false, get fps() { return fps; },
  get state() { return { lit, total: TOTAL, echoes: echoesGot, quality: qualityLevel, mp: mp.connected, remote: mp.remote, mode: player.mode,
    pos: { x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2) } }; } };

function attractCam(t) {
  const T = 40, p = (t % T) / T;
  const ph = p < 0.5 ? p * 2 : (1 - p) * 2;
  const e = ph * ph * (3 - 2 * ph);
  camera.position.set(
    Math.sin(t * 0.11) * 1.4,
    2.0 + Math.sin(t * 0.07) * 0.3,
    2 - 74 * e);
  camera.lookAt(Math.sin(t * 0.05) * 2, 6.5, -99);
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  frames++; fpsTime += dt;
  if (fpsTime >= 1) {
    fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0;
    if (!TEST && fps > 0 && fps < 28 && qualityLevel === 2) {
      qualityLevel = 1;
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      postfx.setSize(renderer.domElement.width, renderer.domElement.height);
      console.log('[nave] auto-quality -> level 1 (pixelRatio 1)');
    } else if (!TEST && fps > 0 && fps < 20 && qualityLevel === 1) {
      qualityLevel = 0; dust.visible = false;
      console.log('[nave] auto-quality -> level 0 (dust off)');
    }
  }

  if (player.mode === 'attract') {
    attractCam(t);
    if (!candles[1].lit) { lightCandle(candles[1]); }
    if (!candles[3].lit) { lightCandle(candles[3]); }
  } else {
    const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp || joyVec.y < -0.25) wish.add(f);
    if (joyVec.y > 0.25) wish.sub(f);
    if (joyVec.x > 0.25) wish.add(r);
    if (joyVec.x < -0.25) wish.sub(r);
    
    
    
    if (wish.lengthSq() > 0) wish.normalize();
    const sp = (keys.ShiftLeft || keys.ShiftRight) ? player.speed * 1.9 : player.speed;
    player.vel.lerp(wish.multiplyScalar(sp), 1 - Math.pow(0.0001, dt));
    player.pos.addScaledVector(player.vel, dt);
    collide(player.pos);
    const moving = player.vel.length() > 0.4;
    player.pos.y = 1.65 + (moving ? Math.sin(t * 9) * 0.045 : 0);
    if (moving) { const sp2 = Math.sin(t * 9); if (stepPhase > 0 && sp2 <= 0) footstep(); stepPhase = sp2; }
    camera.position.copy(player.pos);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(player.yaw); camera.rotateX(player.pitch);
  }

  for (const c of candles) {
    if (!c.lit && player.mode === 'play') {
      const dx = player.pos.x - c.x, dz = player.pos.z - c.z;
      if (dx*dx + dz*dz < 2.3*2.3) {
        c.dwell += dt;
        if (c.dwell > 0.4) lightCandle(c);
      } else c.dwell = 0;
    }
    if (c.lit) {
      if (c.pop < 1) { c.pop = Math.min(1, c.pop + dt * 2.2); }
      const flick = 0.9 + Math.sin(t * 13 + c.z) * 0.08 + Math.sin(t * 31 + c.x) * 0.05;
      c.light.intensity = 1.55 * c.pop * flick;
      c.flame.material.opacity = c.pop;
      const s = c.pop * (0.9 + Math.sin(t * 17 + c.z) * 0.08);
      c.flame.scale.set(0.5 * s + 0.15, 0.85 * s + 0.2, 1);
      const eh = (t * 0.55 + c.z * 0.13) % 1;
      emberRef(c).position.y = 2.0 + eh * 1.1;
      emberRef(c).material.opacity = c.pop * (1 - eh) * 0.8;
    }
  }
  function emberRef(c) { return c.g.children[c.g.children.length - 1]; }
  // echo wisp drift + collection
  for (const e of echoes) {
    if (e.got) continue;
    e.s.position.set(
      e.bx + Math.sin(t * 0.31 + e.ph) * 1.3,
      e.by + Math.sin(t * 0.43 + e.ph * 1.7) * 0.55,
      e.bz + Math.cos(t * 0.21 + e.ph) * 1.6);
    if (player.mode === 'play') {
      const dx = player.pos.x - e.s.position.x, dy = player.pos.y - e.s.position.y,
            dz = player.pos.z - e.s.position.z;
      if (dx*dx + dy*dy + dz*dz < 1.7*1.7) collectEcho(e);
    }
  }

  const pa = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST_N; i++) {
    pa[i*3]   = dBase[i*3]   + Math.sin(t * 0.22 + dPhase[i]) * 0.6;
    pa[i*3+1] = dBase[i*3+1] + Math.sin(t * 0.13 + dPhase[i] * 1.7) * 0.5;
  }
  dustGeo.attributes.position.needsUpdate = true;

  // shared presence (fault-isolated: never allowed to kill the frame loop)
  try {
    mp.t += dt;
    if (mp.cli && mp.connected && mp.t > 0.5) {
      mp.t = 0;
      mp.cli.publish('nave/v1/user/' + mp.cid, JSON.stringify({
        x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2),
        z: +player.pos.z.toFixed(2), ry: +player.yaw.toFixed(2), mode: player.mode }));
    }
    if (mp.remote) {
      const d = mp.remote;
      wisp.position.set(d.x, d.y, d.z);
      wisp.material.opacity = Math.min(0.95, wisp.material.opacity + dt * 1.5);
      const s = 0.85 + Math.sin(t * 2.2) * 0.08;
      wisp.scale.set(s, s, 1);
      if (player.mode === 'play' && !mp.greeted) {
        const dx = player.pos.x - d.x, dy = player.pos.y - d.y, dz = player.pos.z - d.z;
        if (dx*dx + dy*dy + dz*dz < 2.6*2.6) {
          mp.greeted = true; bell(523, 1.6, 0.16);
          loreEl.textContent = "the wisp regards you.";
          loreEl.style.opacity = '0.9';
          clearTimeout(loreTimer);
          loreTimer = setTimeout(function () { loreEl.style.opacity = '0'; }, 4000);
        }
      }
    } else {
      wisp.material.opacity = Math.max(0, wisp.material.opacity - dt);
    }
  } catch (e) { /* solo fallback: ignore bus faults */ }
  postfx.render(scene, camera, t);
  if (!window.__gf.ready) window.__gf.ready = true;
}
tick();
