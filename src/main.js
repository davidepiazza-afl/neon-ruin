import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildWorld, W } from './world.js';
import { muzzleTex } from './textures.js';
import { Sfx } from './audio.js';

// ---------------- Platform detection ----------------
const params = new URLSearchParams(location.search);
const mq = (q) => window.matchMedia && matchMedia(q).matches;
let isTouch = mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(pointer: fine)'));
if (params.get('touch') === '1') isTouch = true; if (params.get('touch') === '0') isTouch = false;
document.body.classList.toggle('is-touch', isTouch);

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), touch: $('touch'), menu: $('menu'), pause: $('pause'), over: $('gameover'), loading: $('loading'),
  health: $('healthfill'), score: $('score'), wave: $('wave'), ammoNow: $('ammoNow'), ammoMax: $('ammoMax'),
  reloading: $('reloading'), banner: $('banner'), toast: $('toast'), damage: $('damage'), fps: $('fps'), hit: $('hitmarker'),
  joyBase: $('joyBase'), joyKnob: $('joyKnob'),
};

// ---------------- Renderer / quality ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const FOG = 0x140a20;
scene.background = new THREE.Color(0x07040d);
scene.fog = new THREE.FogExp2(FOG, 0.03);
const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 75, innerWidth / innerHeight, 0.05, 90);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = buildWorld(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 0.8);
let bloomScale = 0.5;
const bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => bloomSetSize(Math.max(64, Math.round(w * bloomScale)), Math.max(64, Math.round(h * bloomScale)));
composer.addPass(bloom);
composer.addPass(new OutputPass());

const QUALITY = [
  { name: 'Low', pr: 1.0, bloom: false, tier: 1, fog: 0.034 },
  { name: 'Medium', pr: 1.25, bloom: true, bloomScale: 0.5, strength: 0.45, tier: 1, fog: 0.03 },
  { name: 'High', pr: 1.5, bloom: true, bloomScale: 0.6, strength: 0.6, tier: 2, fog: 0.028 },
];
let qualityMode = localStorage.getItem('nr_quality') || 'auto'; // 'auto' | '0' | '1' | '2'
let qLevel = 0;
function resolveQuality() { return qualityMode === 'auto' ? (isTouch ? 1 : 2) : +qualityMode; }
function applyQuality(level) {
  qLevel = level; const q = QUALITY[level];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  bloomScale = q.bloomScale || 0.5; bloom.strength = q.strength || 0.5;
  for (const l of world.lights) l.visible = l.userData.tier <= q.tier;
  for (const m of world.lowOnly) m.visible = !q.bloom;
  scene.fog.density = q.fog;
  onResize();
  const label = `Quality: ${qualityMode === 'auto' ? 'Auto (' + q.name + ')' : q.name}`;
  $('qualityBtn').textContent = label; $('qualityBtn2').textContent = label;
}
function cycleQuality() {
  const order = ['auto', '0', '1', '2']; qualityMode = order[(order.indexOf(qualityMode) + 1) % order.length];
  localStorage.setItem('nr_quality', qualityMode); applyQuality(resolveQuality()); toast($('qualityBtn').textContent);
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  if (isTouch && h > w && typeof state !== 'undefined' && state === 'playing') setPaused(true);
  camera.aspect = w / h; camera.fov = (isTouch && w < h) ? 85 : (isTouch ? 72 : 75); camera.updateProjectionMatrix();
}
addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 200));

// ---------------- Player ----------------
const PR = 0.3, PH = 1.65, EYE = 1.55, STEP = 0.45, G = 15, JUMP = 5.3;
const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: true, hp: 100, eye: EYE };
const boxes = world.boxes;

function blocked(x, feet, z) {
  for (const b of boxes) {
    if (x + PR > b.min[0] && x - PR < b.max[0] && z + PR > b.min[2] && z - PR < b.max[2] && feet + STEP < b.max[1] && feet + PH > b.min[1]) return true;
  }
  return false;
}
function groundAt(x, z, feet) {
  let best = -50; const r = PR * 0.8;
  for (const b of boxes) {
    if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && b.max[1] <= feet + STEP + 1e-3 && b.max[1] > best) best = b.max[1];
  }
  return best;
}
function ceilingAt(x, z, headNow) {
  let best = Infinity;
  for (const b of boxes) {
    if (x + PR > b.min[0] && x - PR < b.max[0] && z + PR > b.min[2] && z - PR < b.max[2] && b.min[1] >= headNow - 0.05 && b.min[1] < best) best = b.min[1];
  }
  return best;
}

// ---------------- Input ----------------
const keys = new Set();
const input = { mx: 0, mz: 0, firing: false, jump: false, sprint: false };
let pointerLocked = false, lockedOnce = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (state !== 'playing') { if (e.code === 'Escape' && state === 'paused') {} return; }
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyQ') cycleQuality();
  if (e.code === 'KeyM') Sfx.toggleMute();
  if (e.code === 'KeyP') setPaused(true);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); input.firing = false; });
canvas.addEventListener('mousedown', (e) => {
  if (isTouch || state !== 'playing') return;
  if (!pointerLocked) requestLock();
  if (e.button === 0) input.firing = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0 && !isTouch) input.firing = false; });
addEventListener('mousemove', (e) => {
  if (!pointerLocked || state !== 'playing') return;
  look(e.movementX * 0.0022, e.movementY * 0.0022);
});
function requestLock() { try { const p = canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch (_) {} }
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) lockedOnce = true;
  else if (state === 'playing' && lockedOnce && !isTouch) setPaused(true);
});
function look(dx, dy) {
  player.yaw -= dx; player.pitch -= dy;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
}

// --- Touch controls ---
const touch = { joyId: null, joyX: 0, joyY: 0, lookId: null, lx: 0, ly: 0, fireId: null, fx: 0, fy: 0 };
const JOY_R = 55;
function setJoyBase(x, y) { ui.joyBase.style.left = (x - 65) + 'px'; ui.joyBase.style.top = (y - 65) + 'px'; ui.joyBase.style.bottom = 'auto'; }
function resetJoy() { ui.joyBase.classList.remove('active'); ui.joyBase.style.left = ''; ui.joyBase.style.top = ''; ui.joyBase.style.bottom = ''; ui.joyKnob.style.transform = ''; input.mx = input.mz = 0; }
ui.touch.addEventListener('touchstart', (e) => {
  e.preventDefault(); if (state !== 'playing') return;
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.42 && touch.joyId === null) {
      touch.joyId = t.identifier; touch.joyX = t.clientX; touch.joyY = t.clientY; setJoyBase(t.clientX, t.clientY); ui.joyBase.classList.add('active');
    } else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
  }
}, { passive: false });
ui.touch.addEventListener('touchmove', (e) => {
  e.preventDefault(); if (state !== 'playing') return;
  for (const t of e.changedTouches) {
    if (t.identifier === touch.joyId) {
      let dx = t.clientX - touch.joyX, dy = t.clientY - touch.joyY; const d = Math.hypot(dx, dy);
      if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
      ui.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.mx = dx / JOY_R; input.mz = dy / JOY_R; input.sprint = d > JOY_R * 1.15;
    } else if (t.identifier === touch.lookId) {
      look((t.clientX - touch.lx) * 0.0065, (t.clientY - touch.ly) * 0.0065); touch.lx = t.clientX; touch.ly = t.clientY;
    } else if (t.identifier === touch.fireId) {
      look((t.clientX - touch.fx) * 0.0065, (t.clientY - touch.fy) * 0.0065); touch.fx = t.clientX; touch.fy = t.clientY;
    }
  }
}, { passive: false });
const endTouch = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.joyId) { touch.joyId = null; resetJoy(); }
    if (t.identifier === touch.lookId) touch.lookId = null;
    if (t.identifier === touch.fireId) { touch.fireId = null; input.firing = false; $('btnFire').classList.remove('pressed'); }
  }
};
ui.touch.addEventListener('touchend', endTouch); ui.touch.addEventListener('touchcancel', endTouch);
function bindBtn(id, down) {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('pressed'); down(e.changedTouches[0]); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('pressed'); }, { passive: false });
}
bindBtn('btnFire', (t) => { input.firing = true; touch.fireId = t.identifier; touch.fx = t.clientX; touch.fy = t.clientY; });
bindBtn('btnJump', () => { input.jump = true; });
bindBtn('btnReload', () => reload());
// touchend for fire button lands on the button, not the layer
$('btnFire').addEventListener('touchend', endTouch); $('btnFire').addEventListener('touchcancel', endTouch);
$('pauseBtn').addEventListener('click', () => setPaused(true));

// ---------------- Weapon ----------------
const gun = new THREE.Group();
{
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2a33, emissive: 0x16131c });
  const metal = new THREE.MeshLambertMaterial({ color: 0x6a6876, emissive: 0x1c1a22 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x7b4a28, emissive: 0x1e1008 });
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x22eaff).multiplyScalar(2.5) });
  const neon2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2bd6).multiplyScalar(2.5) });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); gun.add(m); return m; };
  add(new THREE.BoxGeometry(0.07, 0.09, 0.38), dark, 0, 0, 0);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8).rotateX(Math.PI / 2), metal, 0, 0.015, -0.32);
  add(new THREE.BoxGeometry(0.05, 0.16, 0.06), dark, 0, -0.11, 0.02).rotation.x = 0.25;
  add(new THREE.BoxGeometry(0.06, 0.14, 0.08), wood, 0, -0.09, 0.15).rotation.x = -0.35;
  add(new THREE.BoxGeometry(0.074, 0.008, 0.26), neon, 0, -0.03, -0.02);
  add(new THREE.BoxGeometry(0.008, 0.012, 0.03), neon2, 0, 0.082, 0.08);
  add(new THREE.BoxGeometry(0.03, 0.03, 0.12), metal, 0, 0.06, 0.05);
}
const GUN_REST = isTouch ? new THREE.Vector3(0.2, -0.2, -0.42) : new THREE.Vector3(0.2, -0.19, -0.4);
gun.position.copy(GUN_REST);
camera.add(gun);
const muzzleLocal = new THREE.Vector3(0, 0.015, -0.5);
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex(), color: new THREE.Color(2.5, 2.0, 1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
flash.scale.set(0.22, 0.22, 1); flash.position.copy(muzzleLocal); flash.visible = false; gun.add(flash);
const flashLight = new THREE.PointLight(0xffb060, 0, 7, 1.6); flashLight.position.copy(muzzleLocal); gun.add(flashLight);

const MAG = 24, FIRE_DT = 0.11, RELOAD_T = 1.3;
const weapon = { ammo: MAG, cd: 0, reload: 0, recoil: 0, flashT: 0 };
function reload() {
  if (state !== 'playing' || weapon.reload > 0 || weapon.ammo === MAG) return;
  weapon.reload = RELOAD_T; ui.reloading.classList.remove('hidden'); Sfx.reload();
}

// Tracers, sparks
const tracerGeo = new THREE.BoxGeometry(0.012, 0.012, 1); tracerGeo.translate(0, 0, 0.5);
const tracers = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.8, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false; m.userData.t = 0; scene.add(m); tracers.push(m);
}
let tracerIdx = 0;
const SPARKS = 300;
const sparkPos = new Float32Array(SPARKS * 3).fill(-999), sparkCol = new Float32Array(SPARKS * 3);
const sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.13, map: world.glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
sparks.frustumCulled = false; scene.add(sparks);
let sparkIdx = 0;
function burst(p, color, n, speed = 4, life = 0.5) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const k = sparkIdx; sparkIdx = (sparkIdx + 1) % SPARKS;
    sparkPos[k * 3] = p.x; sparkPos[k * 3 + 1] = p.y; sparkPos[k * 3 + 2] = p.z;
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
    sparkVel[k * 3] = v.x; sparkVel[k * 3 + 1] = v.y; sparkVel[k * 3 + 2] = v.z;
    sparkLife[k] = life * (0.5 + Math.random() * 0.8);
    sparkCol[k * 3] = c.r * 2; sparkCol[k * 3 + 1] = c.g * 2; sparkCol[k * 3 + 2] = c.b * 2;
  }
}
function updateSparks(dt) {
  for (let k = 0; k < SPARKS; k++) {
    if (sparkLife[k] <= 0) continue;
    sparkLife[k] -= dt;
    if (sparkLife[k] <= 0) { sparkPos[k * 3 + 1] = -999; continue; }
    sparkVel[k * 3 + 1] -= 9 * dt;
    sparkPos[k * 3] += sparkVel[k * 3] * dt; sparkPos[k * 3 + 1] += sparkVel[k * 3 + 1] * dt; sparkPos[k * 3 + 2] += sparkVel[k * 3 + 2] * dt;
    const f = Math.min(1, sparkLife[k] * 3);
    sparkCol[k * 3] *= 0.97 + 0.03 * f; sparkCol[k * 3 + 1] *= 0.96; sparkCol[k * 3 + 2] *= 0.96;
  }
  sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
}

// Ray helpers
function rayBox(o, d, b) {
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const oi = i === 0 ? o.x : i === 1 ? o.y : o.z, di = i === 0 ? d.x : i === 1 ? d.y : d.z;
    if (Math.abs(di) < 1e-9) { if (oi < b.min[i] || oi > b.max[i]) return Infinity; }
    else { let t1 = (b.min[i] - oi) / di, t2 = (b.max[i] - oi) / di; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return Infinity; }
  }
  return tmin;
}
function rayWorld(o, d, maxT = 80) {
  let best = maxT;
  for (const b of boxes) { if (b.ns) continue; const t = rayBox(o, d, b); if (t < best) best = t; }
  return best;
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
  if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t > 0 ? t : Infinity;
}
function pointInWorld(p) {
  for (const b of boxes) if (!b.ns && p.x > b.min[0] && p.x < b.max[0] && p.y > b.min[1] && p.y < b.max[1] && p.z > b.min[2] && p.z < b.max[2]) return true;
  return false;
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3(), _v = new THREE.Vector3();
function shoot() {
  weapon.ammo--; weapon.cd = FIRE_DT; weapon.recoil = 1; weapon.flashT = 0.05;
  flash.visible = true; flash.material.rotation = Math.random() * Math.PI; flashLight.intensity = 6;
  Sfx.shot();
  camera.getWorldPosition(_o); camera.getWorldDirection(_d);
  const spread = (player.onGround ? 0.008 : 0.025) + (input.mx || input.mz || keys.size ? 0.006 : 0);
  _d.x += (Math.random() - 0.5) * spread; _d.y += (Math.random() - 0.5) * spread; _d.z += (Math.random() - 0.5) * spread; _d.normalize();
  const tWorld = rayWorld(_o, _d);
  let hitE = null, tE = tWorld;
  for (const e of enemies) { const t = raySphere(_o, _d, e.pos, e.radius); if (t < tE) { tE = t; hitE = e; } }
  if (!hitE && isTouch) { // gentle aim assist on touch
    let bestA = 0.06;
    for (const e of enemies) {
      _v.copy(e.pos).sub(_o); const dist = _v.length(); if (dist > tWorld) continue;
      const a = Math.acos(Math.min(1, _v.dot(_d) / dist)); if (a < bestA) { bestA = a; hitE = e; tE = dist; }
    }
  }
  const hitP = _o.clone().addScaledVector(_d, hitE ? tE : tWorld);
  // tracer from muzzle
  gun.localToWorld(_m.copy(muzzleLocal));
  const tr = tracers[tracerIdx]; tracerIdx = (tracerIdx + 1) % tracers.length;
  tr.position.copy(_m); tr.lookAt(hitP); tr.scale.set(1, 1, _m.distanceTo(hitP)); tr.visible = true; tr.userData.t = 0.06; tr.material.opacity = 1;
  if (hitE) damageEnemy(hitE, 1, hitP);
  else if (tWorld < 80) burst(hitP, 0xffb060, 6, 3, 0.35);
}

// ---------------- Enemies ----------------
const enemies = [], orbs = [], pickups = [];
const eGeo = { shell: (() => { const a = new THREE.BoxGeometry(0.16, 0.5, 0.36); a.translate(0.42, 0, 0); const b = a.clone(); b.translate(-0.84, 0, 0); const c = new THREE.BoxGeometry(0.9, 0.06, 0.12); return mergeGeometries([a, b, c]); })(),
  core: new THREE.IcosahedronGeometry(0.3, 1), ring: new THREE.TorusGeometry(0.5, 0.035, 6, 24), eye: new THREE.SphereGeometry(0.1, 8, 6) };
const haloMat = new THREE.SpriteMaterial({ map: world.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
const shellMat = new THREE.MeshLambertMaterial({ color: 0x3a3444, emissive: 0x120a1a });
const TYPES = {
  drone: { hp: 2, speed: 2.6, core: 0xff2bd6, ring: 0xff2bd6, scale: 1, score: 100, shoots: false },
  spitter: { hp: 3, speed: 2.0, core: 0x22eaff, ring: 0xff7a18, scale: 1.05, score: 150, shoots: true },
  brute: { hp: 7, speed: 1.6, core: 0xff7a18, ring: 0x9b3bff, scale: 1.6, score: 300, shoots: false },
};
const coreMats = {}; const ringMats = {};
for (const [k, t] of Object.entries(TYPES)) {
  coreMats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(t.core).multiplyScalar(3) });
  ringMats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(t.ring).multiplyScalar(2.6) });
}
const hitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) });
const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.5, 3) });

function spawnEnemy(type, at) {
  const t = TYPES[type];
  const g = new THREE.Group();
  const shell = new THREE.Mesh(eGeo.shell, shellMat); const core = new THREE.Mesh(eGeo.core, coreMats[type]);
  const ring = new THREE.Mesh(eGeo.ring, ringMats[type]); ring.rotation.x = Math.PI / 2;
  const eye = new THREE.Mesh(eGeo.eye, eyeMat); eye.position.z = 0.3;
  const halo = new THREE.Sprite(haloMat.clone()); halo.material.color = new THREE.Color(t.core); halo.scale.setScalar(1.8);
  g.add(shell, core, ring, eye, halo); g.scale.setScalar(t.scale); scene.add(g);
  const p = at ? at.clone() : world.spawnPoints[(Math.random() * world.spawnPoints.length) | 0].clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
  g.position.copy(p);
  const e = { type, t, g, shell, core, ring, pos: g.position, vel: new THREE.Vector3(0, -3, 0), hp: t.hp, radius: 0.5 * t.scale,
    phase: Math.random() * 10, bite: 0, fire: 2 + Math.random() * 2, flash: 0 };
  enemies.push(e); burst(p, t.core, 14, 3, 0.6);
  return e;
}
function damageEnemy(e, dmg, at) {
  e.hp -= dmg; e.flash = 0.07; e.core.material = hitMat;
  burst(at, TYPES[e.type].core, 8, 3, 0.35); showHit(); Sfx.hit();
  _v.copy(e.pos).sub(player.pos).setY(0).normalize(); e.vel.addScaledVector(_v, 1.5);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  burst(e.pos, TYPES[e.type].core, 40, 6, 0.9); burst(e.pos, 0xffffff, 12, 4, 0.4);
  Sfx.boom(); scene.remove(e.g); enemies.splice(enemies.indexOf(e), 1);
  game.score += e.t.score; game.kills++;
  if (Math.random() < (player.hp < 50 ? 0.3 : 0.12)) spawnPickup(e.pos);
}
const orbGeo = new THREE.SphereGeometry(0.12, 8, 6);
const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x22eaff).multiplyScalar(3.5) });
function fireOrb(from, dir) {
  const m = new THREE.Mesh(orbGeo, orbMat); m.position.copy(from); scene.add(m);
  orbs.push({ m, vel: dir.clone().multiplyScalar(7.5), life: 4 }); Sfx.zap();
}
const pickGeo = new THREE.OctahedronGeometry(0.22, 0);
const pickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40ff7a).multiplyScalar(2.5) });
function spawnPickup(p) {
  const m = new THREE.Mesh(pickGeo, pickMat); m.position.copy(p); scene.add(m);
  let y = p.y; for (const fy of [W.F2, W.F1, 0]) if (p.y > fy + 0.2 && groundAt(p.x, p.z, p.y) >= fy - 0.01) { y = groundAt(p.x, p.z, p.y) + 0.6; break; }
  pickups.push({ m, baseY: Math.max(0.6, y), t: 0 });
}

const BOUNDS = { x0: W.x0 + 0.6, x1: W.x1 - 0.6, z0: W.z0 + 0.6, z1: W.z1 - 0.6, y0: 0.6, y1: W.H - 0.8 };
const _head = new THREE.Vector3(), _sep = new THREE.Vector3(), _des = new THREE.Vector3(), _side = new THREE.Vector3();
function updateEnemies(dt, now) {
  _head.set(player.pos.x, player.pos.y + 1.3, player.pos.z);
  for (const e of enemies) {
    const t = e.t;
    _des.copy(_head).sub(e.pos); const dist = _des.length(); _des.divideScalar(dist || 1);
    const sp = Math.min(t.speed + game.wave * 0.18, 5.2);
    _side.set(-_des.z, 0, _des.x);
    const strafe = Math.sin(now * 1.3 + e.phase) * 0.7;
    const keep = t.shoots ? 5 : 1.1;
    const fwd = dist > keep ? 1 : -0.4;
    _des.multiplyScalar(sp * fwd).addScaledVector(_side, sp * strafe);
    _des.y += Math.sin(now * 2 + e.phase) * 0.6;
    _sep.set(0, 0, 0);
    for (const o of enemies) { if (o === e) continue; _v.copy(e.pos).sub(o.pos); const d = _v.length(); if (d < 1.3 && d > 0.001) _sep.addScaledVector(_v, (1.3 - d) / d * 4); }
    _des.add(_sep);
    e.vel.lerp(_des, Math.min(1, dt * 2.5));
    e.pos.addScaledVector(e.vel, dt);
    e.pos.x = Math.min(BOUNDS.x1, Math.max(BOUNDS.x0, e.pos.x)); e.pos.z = Math.min(BOUNDS.z1, Math.max(BOUNDS.z0, e.pos.z));
    e.pos.y = Math.min(BOUNDS.y1 + 0.5, Math.max(BOUNDS.y0, e.pos.y));
    e.g.lookAt(_head); e.ring.rotation.z += dt * 3;
    if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0) e.core.material = coreMats[e.type]; }
    e.bite -= dt;
    if (dist < 1.35 * t.scale && e.bite <= 0) { hurt(t.scale > 1.2 ? 18 : 10); e.bite = 0.8; e.vel.addScaledVector(_des.copy(e.pos).sub(_head).normalize(), 4); }
    if (t.shoots) {
      e.fire -= dt;
      if (e.fire <= 0 && dist < 20) {
        e.fire = 2.2 + Math.random() * 1.6;
        _d.copy(_head).sub(e.pos).normalize();
        if (rayWorld(e.pos, _d, dist) >= dist - 0.3) fireOrb(e.pos.clone().addScaledVector(_d, 0.5), _d);
      }
    }
  }
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.life -= dt; o.m.position.addScaledVector(o.vel, dt);
    let dead = o.life <= 0 || pointInWorld(o.m.position);
    if (!dead && o.m.position.distanceTo(_head) < 0.6) { hurt(12); dead = true; }
    if (dead) { burst(o.m.position, 0x22eaff, 8, 2, 0.3); scene.remove(o.m); orbs.splice(i, 1); }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt; p.m.rotation.y += dt * 2; p.m.position.y = p.baseY + Math.sin(p.t * 3) * 0.12;
    const dx = p.m.position.x - player.pos.x, dz = p.m.position.z - player.pos.z, dy = p.m.position.y - (player.pos.y + 0.8);
    if (dx * dx + dz * dz < 1.1 && Math.abs(dy) < 1.4) { player.hp = Math.min(100, player.hp + 25); burst(p.m.position, 0x40ff7a, 20, 3, 0.5); Sfx.pickup(); scene.remove(p.m); pickups.splice(i, 1); toast('+25 HP'); }
    else if (p.t > 25) { scene.remove(p.m); pickups.splice(i, 1); }
  }
}

// ---------------- Game state ----------------
let state = 'menu';
const game = { score: 0, wave: 0, kills: 0, toSpawn: 0, spawnT: 0, waveT: 0 };
function hurt(n) {
  if (state !== 'playing') return;
  player.hp -= n; Sfx.hurt(); damageFlash = 1;
  if (player.hp <= 0) { player.hp = 0; gameOver(); }
}
let damageFlash = 0;
function nextWave() {
  game.wave++; game.toSpawn = 3 + game.wave * 2; game.spawnT = 1.0;
  banner(`WAVE ${game.wave}`);
}
function pickType() {
  const w = game.wave, r = Math.random();
  if (w >= 4 && r < 0.15) return 'brute';
  if (w >= 2 && r < 0.4) return 'spitter';
  return 'drone';
}
function resetGame() {
  for (const e of enemies) scene.remove(e.g); enemies.length = 0;
  for (const o of orbs) scene.remove(o.m); orbs.length = 0;
  for (const p of pickups) scene.remove(p.m); pickups.length = 0;
  Object.assign(game, { score: 0, wave: 0, kills: 0, toSpawn: 0, spawnT: 0, waveT: 1.2 });
  player.pos.set(1.0, 0, 3.9); player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = 0.05; player.hp = 100; player.onGround = true;
  weapon.ammo = MAG; weapon.reload = 0; weapon.cd = 0; ui.reloading.classList.add('hidden');
}
function startGame() {
  Sfx.init();
  resetGame(); state = 'playing';
  ui.menu.classList.add('hidden'); ui.over.classList.add('hidden'); ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden'); if (isTouch) ui.touch.classList.remove('hidden');
  if (isTouch) goFullscreen(); else requestLock();
}
function setPaused(p) {
  if (p && state === 'playing') { state = 'paused'; ui.pause.classList.remove('hidden'); input.firing = false; resetJoy(); touch.joyId = touch.lookId = touch.fireId = null; if (pointerLocked) document.exitPointerLock(); }
  else if (!p && state === 'paused') { state = 'playing'; ui.pause.classList.add('hidden'); if (!isTouch) requestLock(); }
}
function gameOver() {
  state = 'over'; input.firing = false; resetJoy();
  const best = Math.max(+(localStorage.getItem('nr_best') || 0), game.score); localStorage.setItem('nr_best', best);
  $('finalScore').innerHTML = `Score <b>${game.score}</b> · Wave ${game.wave} · ${game.kills} drones down<br>Best: ${best}`;
  ui.over.classList.remove('hidden'); ui.touch.classList.add('hidden');
  if (pointerLocked) document.exitPointerLock();
}
function goToMenu() {
  state = 'menu'; ui.pause.classList.add('hidden'); ui.over.classList.add('hidden'); ui.hud.classList.add('hidden'); ui.touch.classList.add('hidden'); ui.menu.classList.remove('hidden');
  for (const e of enemies) scene.remove(e.g); enemies.length = 0;
}
function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}
$('playBtn').addEventListener('click', startGame);
$('restartBtn').addEventListener('click', startGame);
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('quitBtn').addEventListener('click', goToMenu);
$('qualityBtn').addEventListener('click', cycleQuality); $('qualityBtn2').addEventListener('click', cycleQuality);
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// HUD helpers
let bannerT = 0, toastT = 0, hitT = 0;
function banner(txt) { ui.banner.textContent = txt; ui.banner.classList.add('on'); bannerT = 2.2; }
function toast(txt) { ui.toast.textContent = txt; ui.toast.classList.add('on'); toastT = 1.8; }
function showHit() { ui.hit.classList.add('on'); hitT = 0.08; }
const hudCache = {};
function setText(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
function updateHUD() {
  const hp = Math.max(0, Math.round(player.hp));
  if (hudCache.hp !== hp) { hudCache.hp = hp; ui.health.style.width = hp + '%'; }
  setText(ui.score, 'score', String(game.score));
  setText(ui.wave, 'wave', `WAVE ${game.wave}`);
  setText(ui.ammoNow, 'ammo', String(weapon.ammo)); setText(ui.ammoMax, 'ammoMax', `/ ${MAG}`);
  const dmg = Math.round(damageFlash * 100) / 100;
  if (hudCache.dmg !== dmg) { hudCache.dmg = dmg; ui.damage.style.boxShadow = `inset 0 0 140px 50px rgba(255,20,60,${dmg * 0.6 + (hp < 30 ? 0.18 : 0)})`; }
}

// ---------------- Update loop ----------------
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3();
let bob = 0;
function updatePlayer(dt) {
  let mx = input.mx, mz = input.mz;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || input.sprint;
  const speed = sprint ? 6.4 : 4.3;
  _fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); _right.set(-_fwd.z, 0, _fwd.x);
  const tvx = (_fwd.x * -mz + _right.x * mx) * speed, tvz = (_fwd.z * -mz + _right.z * mx) * speed;
  const acc = player.onGround ? 14 : 4;
  player.vel.x += (tvx - player.vel.x) * Math.min(1, acc * dt);
  player.vel.z += (tvz - player.vel.z) * Math.min(1, acc * dt);

  const p = player.pos;
  // horizontal, per-axis with sub-steps
  const steps = Math.ceil(Math.max(Math.abs(player.vel.x), Math.abs(player.vel.z)) * dt / 0.15) || 1;
  for (let s = 0; s < steps; s++) {
    const nx = p.x + player.vel.x * dt / steps; if (!blocked(nx, p.y, p.z)) p.x = nx; else player.vel.x = 0;
    const nz = p.z + player.vel.z * dt / steps; if (!blocked(p.x, p.y, nz)) p.z = nz; else player.vel.z = 0;
  }
  // vertical
  if (input.jump && player.onGround) { player.vel.y = JUMP; player.onGround = false; Sfx.jump(); }
  input.jump = false;
  const g = groundAt(p.x, p.z, p.y);
  const wasGround = player.onGround;
  player.vel.y -= G * dt;
  let ny = p.y + player.vel.y * dt;
  if (player.vel.y > 0) { const c = ceilingAt(p.x, p.z, p.y + PH); if (ny + PH > c) { ny = c - PH; player.vel.y = 0; } }
  if (ny <= g) { ny = g; player.vel.y = 0; player.onGround = true; }
  else if (wasGround && player.vel.y <= 0 && p.y - g < 0.3) { ny = g; player.vel.y = 0; player.onGround = true; } // stick to stairs going down
  else player.onGround = false;
  const stepped = ny - p.y;
  p.y = ny;
  if (p.y < -5) p.set(0, 0, 5.6);
  // smooth eye on step-up
  if (player.onGround && stepped > 0.05 && stepped < STEP + 0.01) player.eye -= stepped;
  player.eye += (EYE - player.eye) * Math.min(1, dt * 12);

  const moving = Math.hypot(player.vel.x, player.vel.z);
  bob += dt * moving * 2.2 * (player.onGround ? 1 : 0);
  camera.position.set(p.x, p.y + player.eye + Math.sin(bob * 2) * 0.03 * Math.min(1, moving / 4), p.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  // gun sway + recoil
  weapon.recoil = Math.max(0, weapon.recoil - dt * 9);
  const rl = weapon.reload > 0 ? Math.sin((1 - weapon.reload / RELOAD_T) * Math.PI) : 0;
  gun.position.set(GUN_REST.x + Math.cos(bob) * 0.008, GUN_REST.y + Math.abs(Math.sin(bob)) * 0.01 - rl * 0.12, GUN_REST.z + weapon.recoil * 0.05);
  gun.rotation.set(weapon.recoil * 0.12 + rl * 0.6, 0, rl * 0.4);
}
function updateWeapon(dt) {
  weapon.cd -= dt;
  if (weapon.reload > 0) {
    weapon.reload -= dt;
    if (weapon.reload <= 0) { weapon.ammo = MAG; ui.reloading.classList.add('hidden'); }
  } else if (input.firing && weapon.cd <= 0) {
    if (weapon.ammo > 0) { shoot(); player.pitch += 0.006; }
    else { reload(); }
  }
  if (weapon.flashT > 0) { weapon.flashT -= dt; if (weapon.flashT <= 0) { flash.visible = false; flashLight.intensity = 0; } }
  for (const t of tracers) if (t.visible) { t.userData.t -= dt; t.material.opacity = Math.max(0, t.userData.t / 0.06); if (t.userData.t <= 0) t.visible = false; }
}
function updateWaves(dt) {
  if (game.toSpawn > 0) {
    game.spawnT -= dt;
    const maxAlive = qLevel === 0 ? 6 : 9;
    if (game.spawnT <= 0 && enemies.length < maxAlive) { spawnEnemy(pickType()); game.toSpawn--; game.spawnT = Math.max(0.5, 1.4 - game.wave * 0.08); }
  } else if (enemies.length === 0) {
    game.waveT -= dt;
    if (game.waveT <= 0) { nextWave(); game.waveT = 2.5; if (game.wave > 1) { game.score += 250; toast('Wave cleared +250'); } }
  }
}

// adaptive quality (Auto mode only)
let perfAcc = 0, perfFrames = 0, perfLow = 0, fpsShow = 0;
function adaptive(dt) {
  perfAcc += dt; perfFrames++;
  if (perfAcc >= 1) {
    const fps = perfFrames / perfAcc; fpsShow = fps; ui.fps.textContent = `${fps.toFixed(0)} fps · ${QUALITY[qLevel].name}`;
    if (qualityMode === 'auto' && state === 'playing') {
      perfLow = fps < 38 ? perfLow + 1 : 0;
      if (perfLow >= 3 && qLevel > 0) { applyQuality(qLevel - 1); perfLow = 0; toast(`Auto quality → ${QUALITY[qLevel].name}`); }
    }
    perfAcc = 0; perfFrames = 0;
  }
}

const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed += dt;
  for (const a of world.animated) a(elapsed, dt);
  if (state === 'playing') {
    updatePlayer(dt); updateWeapon(dt); updateEnemies(dt, elapsed); updateWaves(dt);
    damageFlash = Math.max(0, damageFlash - dt * 2.5);
    updateHUD();
  } else if (state === 'menu') {
    const a = elapsed * 0.12;
    camera.position.set(Math.sin(a) * 5.5, 2.2 + Math.sin(elapsed * 0.3) * 0.6, Math.cos(a) * 4.2);
    camera.lookAt(0, 4.5, 0);
  }
  if (state !== 'playing') { for (const t of tracers) t.visible = false; flash.visible = false; flashLight.intensity = 0; }
  updateSparks(dt);
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) ui.banner.classList.remove('on'); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.classList.remove('on'); }
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) ui.hit.classList.remove('on'); }
  gun.visible = state === 'playing' || state === 'paused';
  if (QUALITY[qLevel].bloom) composer.render(dt); else renderer.render(scene, camera);
  adaptive(dt);
  requestAnimationFrame(frame);
}

applyQuality(resolveQuality());
ui.loading.classList.add('hidden');
requestAnimationFrame(frame);

// Test/debug hooks (used by the headless smoke test)
window.__game = {
  start: startGame, get state() { return state; }, player, game, enemies, weapon,
  spawn: (type = 'drone', x, y, z) => spawnEnemy(type, x !== undefined ? new THREE.Vector3(x, y, z) : undefined),
  view: (x, y, z, yaw, pitch) => { player.pos.set(x, y, z); player.yaw = yaw; player.pitch = pitch; player.vel.set(0, 0, 0); },
  fire: (on) => { input.firing = on; }, move: (mx, mz) => { input.mx = mx; input.mz = mz; }, jump: () => { input.jump = true; },
  setQuality: (l) => { qualityMode = String(l); applyQuality(l); }, get fps() { return fpsShow; }, renderer,
  freezeWaves: () => { game.toSpawn = 0; game.waveT = 1e9; },
};
