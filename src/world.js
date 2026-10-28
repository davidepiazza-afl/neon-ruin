// Procedural Szimpla-Kert-style ruin bar courtyard.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

const rand = T.rand;
const R = (a, b) => a + (b - a) * rand();

// Courtyard extents
export const W = { x0: -10, x1: 10, z0: -7, z1: 7, F1: 4, F2: 8, H: 13, inX: 7.8, inZ: 4.8 };

export function buildWorld(scene) {
  const boxes = [];           // collision AABBs {min:[x,y,z], max:[x,y,z]}
  const buckets = new Map();  // material key -> geometries
  const animated = [];        // objects with update(t, dt)
  const lowOnly = [];         // meshes only shown on low quality (glow halos)

  const tex = {
    plaster: T.plasterTex(), brick: T.brickTex(), wood: T.woodTex(), floor: T.floorTex(),
    facade: T.facadeTex(), orn: T.ironOrnamentTex(), spider: T.spiderPlantTex(), fern: T.fernTex(),
    buoy: T.lifebuoyTex(), disco: T.discoTex(), glow: T.glowSpriteTex(),
  };
  const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  const NEON = {
    magenta: hdr(0xff2bd6, 3.2), cyan: hdr(0x22eaff, 3.0), orange: hdr(0xff7a18, 3.2), purple: hdr(0x9b3bff, 3.0),
    warm: hdr(0xffc070, 3.0), blue: hdr(0x3a6bff, 3.0), green: hdr(0x40ff7a, 2.6), red: hdr(0xff2a3a, 3.0),
  };
  const mats = {
    plaster: new THREE.MeshLambertMaterial({ map: tex.plaster }),
    brick: new THREE.MeshLambertMaterial({ map: tex.brick }),
    wood: new THREE.MeshLambertMaterial({ map: tex.wood }),
    floor: new THREE.MeshLambertMaterial({ map: tex.floor }),
    iron: new THREE.MeshLambertMaterial({ color: 0x1d1b1f }),
    metal: new THREE.MeshLambertMaterial({ color: 0x55525a }),
    terracotta: new THREE.MeshLambertMaterial({ color: 0xa4542f }),
    planter: new THREE.MeshLambertMaterial({ color: 0xb05a3a }),
    trabant: new THREE.MeshLambertMaterial({ color: 0x3fb3a8 }),
    tyre: new THREE.MeshLambertMaterial({ color: 0x111111 }),
    cream: new THREE.MeshLambertMaterial({ color: 0xd8d0bc }),
    dark: new THREE.MeshBasicMaterial({ color: 0x050308 }),
    facade: new THREE.MeshLambertMaterial({ map: tex.facade, emissiveMap: tex.facade, emissive: new THREE.Color(0x2a2620) }),
    orn: new THREE.MeshLambertMaterial({ map: tex.orn, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide }),
    glass: new THREE.MeshBasicMaterial({ color: 0x6a8cff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }),
  };
  for (const [k, c] of Object.entries(NEON)) {
    mats['n_' + k] = new THREE.MeshBasicMaterial({ color: c });
    mats['h_' + k] = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.25), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  for (const m of [mats.plaster, mats.brick, mats.wood, mats.floor]) m.map.needsUpdate = true;

  const add = (key, geo) => { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(geo); };

  // Box with world-scaled UVs. tile = metres per texture repeat.
  function boxGeo(sx, sy, sz, tile = 3) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const uv = g.attributes.uv;
    const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
    return g;
  }
  // Axis-aligned block from min/max corners
  function block(key, x0, y0, z0, x1, y1, z1, solid = true, tile = 3) {
    const g = boxGeo(x1 - x0, y1 - y0, z1 - z0, tile);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    add(key, g);
    if (solid) boxes.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
  }
  function solidOnly(x0, y0, z0, x1, y1, z1) { boxes.push({ min: [x0, y0, z0], max: [x1, y1, z1] }); }

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  function tube(key, a, b, r = 0.035, halo = true) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A); const len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, 6, 1, false);
    tmpQ.setFromUnitVectors(up, d.normalize());
    tmpM.compose(A.clone().add(B).multiplyScalar(0.5), tmpQ, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(tmpM); add('n_' + key, g);
    if (halo) { const h = new THREE.CylinderGeometry(r * 5, r * 5, len + r * 6, 6, 1, true); h.applyMatrix4(tmpM); add('h_' + key, h); }
  }

  const { x0, x1, z0, z1, F1, F2, H, inX, inZ } = W;
  const T_ = 0.4; // wall thickness

  // ---------- Floor & outer walls ----------
  block('floor', x0 - 1, -0.3, z0 - 1, x1 + 1, 0, z1 + 1, true, 4);
  block('plaster', x0, 0, z0 - T_, x1, H, z0, true, 4);            // north
  block('plaster', x1, 0, z0, x1 + T_, H, z1, true, 4);            // east
  block('brick', x0 - T_, 0, z0, x0, H, z1, true, 3);              // west (brick)
  // south wall with entrance arch gap x -1.4..1.4 on ground floor
  block('plaster', x0, 0, z1, -1.4, F1, z1 + T_, true, 4);
  block('plaster', 1.4, 0, z1, x1, F1, z1 + T_, true, 4);
  block('plaster', -1.4, 3.1, z1, 1.4, F1, z1 + T_, true, 4);
  block('plaster', x0, F1, z1, x1, H, z1 + T_, true, 4);
  block('dark', -1.4, 0, z1 + T_, 1.4, 3.1, z1 + 3, false);        // dark passage
  boxes.push({ min: [-1.4, 0, z1 + 0.3], max: [1.4, 3.1, z1 + 0.5], ns: true }); // invisible gate
  // passage neon (colourful like the street entrance)
  ['magenta', 'cyan', 'orange', 'green', 'purple'].forEach((c, i) => tube(c, [-1.3, 0.6 + i * 0.5, z1 + 0.6 + i * 0.35], [1.3, 0.6 + i * 0.5, z1 + 0.6 + i * 0.35], 0.03));

  // Facade on the inside of the south wall (upper floors)
  const fac = new THREE.PlaneGeometry(x1 - x0, H - F1 + 0.2); fac.rotateY(Math.PI); fac.translate(0, (H + F1) / 2, z1 - 0.01); add('facade', fac);

  // ---------- Walkways ----------
  const slab = 0.3;
  const walk = (y, ax0, az0, ax1, az1) => {
    block('wood', ax0, y - slab, az0, ax1, y, az1, true, 2);
  };
  walk(F1, x0, z0, x1, -inZ);   // north F1
  walk(F1, x0, inZ, x1, z1);    // south F1
  walk(F1, inX, -inZ, x1, inZ); // east F1
  walk(F1, x0, -inZ, -inX, inZ);// west F1 (under stairwell)
  walk(F2, x0, z0, x1, -inZ);   // north F2
  // purple strip lights under F1 edge, like the photo
  tube('purple', [-inX, F1 - slab - 0.05, -inZ + 0.05], [inX, F1 - slab - 0.05, -inZ + 0.05], 0.03);
  tube('purple', [-inX, F1 - slab - 0.05, inZ - 0.05], [inX, F1 - slab - 0.05, inZ - 0.05], 0.03);
  tube('magenta', [-inX, F2 - slab - 0.05, -inZ + 0.05], [inX, F2 - slab - 0.05, -inZ + 0.05], 0.03);

  // columns
  const col = (x, z, yb, yt) => block('iron', x - 0.08, yb, z - 0.08, x + 0.08, yt, z + 0.08, true);
  for (const x of [-inX, -4, 0, 4, inX]) { col(x, -inZ, 0, F1 - slab); col(x, inZ, 0, F1 - slab); col(x, -inZ, F1, F2 - slab); }
  for (const z of [-1.6, 1.6]) col(inX, z, 0, F1 - slab);

  // ---------- Railings ----------
  const balusters = [];
  function railing(ax, az, bx, bz, y) {
    const t = 0.05, hgt = 1.05;
    const xa = Math.min(ax, bx), xb = Math.max(ax, bx), za = Math.min(az, bz), zb = Math.max(az, bz);
    const alongX = (xb - xa) > (zb - za);
    if (alongX) { block('iron', xa, y + hgt - 0.05, za - t, xb, y + hgt, za + t, false); block('iron', xa, y + 0.1, za - 0.02, xb, y + 0.14, za + 0.02, false); }
    else { block('iron', xa - t, y + hgt - 0.05, za, xa + t, y + hgt, zb, false); block('iron', xa - 0.02, y + 0.1, za, xa + 0.02, y + 0.14, zb, false); }
    boxes.push({ min: [xa - 0.1, y, za - 0.1], max: [xb + 0.1, y + 1.7, zb + 0.1], ns: true }); // ns = bullets pass
    const len = alongX ? xb - xa : zb - za;
    for (let s = 0.08; s < len; s += 0.16) balusters.push(alongX ? [xa + s, y, za] : [xa, y, za + s]);
    return { xa, xb, za, zb, alongX };
  }
  const rails = [];
  rails.push(railing(-inX, -inZ, 5.75, -inZ, F1));       // north F1 (gap for stair A)
  rails.push(railing(-inX, inZ, inX, inZ, F1));          // south F1
  rails.push(railing(inX, -inZ, inX, inZ, F1));          // east F1
  rails.push(railing(-inX, -inZ, x1, -inZ, F2));         // north F2 (gap at west for stair B)
  railing(5.75, -inZ, 5.75, -inZ + 0.01, F1);            // tiny post at stair head

  // ---------- Stair A: ground -> F1 (x 5.8..7.6) ----------
  const N = 16, rise = F1 / N, run = (4 + inZ) / N;
  for (let i = 0; i < N; i++) {
    const za = 4 - (i + 1) * run, zb = 4 - i * run;
    block('wood', 5.8, (i) * rise, za, 7.6, (i + 1) * rise, zb, false, 1.5);
    solidOnly(5.8, 0, za, 7.6, (i + 1) * rise, zb);
    if (i) block('brick', 5.8, 0, za, 7.6, i * rise, zb, false, 2);
  }
  // stair handrail (visual) + iron ornaments on the side
  tube('orange', [5.78, 1.0, 4], [5.78, F1 + 1.0, -inZ], 0.025);
  for (let i = 0; i < 5; i++) {
    const z = 3 - i * 1.7, y = (4 - z) / (4 + inZ) * F1;
    const p = new THREE.PlaneGeometry(0.9, 0.9); p.rotateY(Math.PI / 2); p.translate(5.77, y + 0.55, z); add('orn', p);
  }

  // ---------- Stair B: F1 -> F2 inside a narrow brick stairwell (west) ----------
  block('brick', -inX, F1, -inZ, -inX + 0.25, H - 1.5, inZ, true, 3); // stairwell inner wall
  for (let i = 0; i < N; i++) {
    const za = 4 - (i + 1) * run, zb = 4 - i * run;
    block('brick', x0, F1 + i * rise, za, -inX, F1 + (i + 1) * rise, zb, false, 1.5);
    solidOnly(x0, F1, za, -inX, F1 + (i + 1) * rise, zb);
  }
  // wrought-iron ornaments on the stairwell wall + sconce
  for (let i = 0; i < 5; i++) {
    const z = 3 - i * 1.7, y = F1 + (4 - z) / (4 + inZ) * F1;
    const p = new THREE.PlaneGeometry(0.8, 0.8); p.rotateY(-Math.PI / 2); p.translate(-inX - 0.01, y + 0.9, z); add('orn', p);
    const q = new THREE.PlaneGeometry(0.6, 0.6); q.rotateY(Math.PI / 2); q.translate(x0 + 0.01, y + 1.6, z + 0.8); add('orn', q);
  }
  tube('cyan', [x0 + 0.08, F1 + 1, 2.2], [x0 + 0.08, H - 1.6, 2.2], 0.035);
  tube('orange', [x0 + 0.08, F1 + 1.2, 1.9], [x0 + 0.08, H - 1.6, 1.9], 0.03);
  tube('cyan', [-inX - 0.05, F1 + 2.4, -3.8], [-inX - 0.05, H - 1.6, -3.8], 0.03);
  block('iron', x0, 6.75, -0.05, x0 + 0.25, 6.85, 0.05, false);
  const bulb = new THREE.SphereGeometry(0.09, 10, 8); bulb.translate(x0 + 0.27, 6.95, 0); add('n_warm', bulb);
  // "music" sticker sign
  const musicSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshLambertMaterial({ map: T.signTex('music', '#ffffff', null, { w: 256, h: 160, font: 'bold 70px sans-serif', bg: '#141414' }) }));
  musicSign.rotation.y = Math.PI / 2; musicSign.position.set(x0 + 0.02, 7.6, -1.2); scene.add(musicSign);

  // ---------- Roof: beams + partial glass ----------
  for (let x = -9; x <= 9; x += 2.25) block('wood', x - 0.12, H - 0.7, z0, x + 0.12, H - 0.4, z1, false, 2);
  for (const z of [-4, 0, 4]) block('wood', x0, H - 0.95, z - 0.1, x1, H - 0.7, z + 0.1, false, 2);
  const glassG = new THREE.PlaneGeometry(x1 - x0, 7); glassG.rotateX(Math.PI / 2); glassG.translate(0, H - 0.35, -3.5); add('glass', glassG);

  // ---------- Ground floor furniture ----------
  // bar counter (west)
  block('wood', -9.2, 0, -3.5, -8.3, 1.1, 3.5, true, 1.5);
  block('iron', -9.25, 1.1, -3.55, -8.25, 1.15, 3.55, false);
  block('wood', x0, 1.3, -3.5, x0 + 0.35, 1.36, 3.5, false); block('wood', x0, 2.0, -3.5, x0 + 0.35, 2.06, 3.5, false);
  const bottleCols = ['n_green', 'n_orange', 'n_red', 'n_cyan', 'n_warm'];
  for (let z = -3.3; z < 3.3; z += 0.22) for (const y of [1.36, 2.06]) {
    if (rand() < 0.25) continue; const b = new THREE.CylinderGeometry(0.035, 0.04, R(0.22, 0.32), 5); b.translate(x0 + 0.18, y + 0.14, z); add(bottleCols[(rand() * 5) | 0], b);
  }
  const barSign = signPlane(T.signTex('BÁR', '#ff4fd8', '#ff2bd0', { font: 'bold 96px "Trebuchet MS"' }), 2.2, 0.55, true);
  barSign.rotation.y = Math.PI / 2; barSign.position.set(x0 + 0.03, 2.9, 0); scene.add(barSign);

  // tables + benches
  for (const [tx, tz] of [[-4.5, -2.8], [-1.0, 3.0], [2.8, -3.0], [3.0, 2.6]]) {
    block('wood', tx - 0.7, 0.72, tz - 0.4, tx + 0.7, 0.8, tz + 0.4, false, 1);
    for (const [lx, lz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) block('iron', tx + lx - 0.03, 0, tz + lz - 0.03, tx + lx + 0.03, 0.72, tz + lz + 0.03, false);
    solidOnly(tx - 0.7, 0, tz - 0.4, tx + 0.7, 0.8, tz + 0.4);
    block('wood', tx - 0.7, 0.42, tz - 0.75, tx + 0.7, 0.47, tz - 0.55, true, 1);
    block('wood', tx - 0.7, 0.42, tz + 0.55, tx + 0.7, 0.47, tz + 0.75, true, 1);
    // candle glow
    const c = new THREE.SphereGeometry(0.04, 6, 5); c.translate(tx, 0.86, tz); add('n_warm', c);
  }

  // Trabant (a Szimpla classic)
  const tbx = -5.2, tbz = 2.4;
  block('trabant', tbx - 1.7, 0.3, tbz - 0.72, tbx + 1.7, 0.95, tbz + 0.72, true, 2);
  block('trabant', tbx - 0.9, 0.95, tbz - 0.66, tbx + 0.7, 1.45, tbz + 0.66, true, 2);
  block('dark', tbx - 0.85, 1.0, tbz - 0.67, tbx + 0.65, 1.4, tbz + 0.67, false);
  block('cream', tbx - 1.72, 0.3, tbz - 0.74, tbx + 1.72, 0.4, tbz + 0.74, false);
  for (const [wx, wz] of [[-1.1, -0.72], [1.1, -0.72], [-1.1, 0.72], [1.1, 0.72]]) {
    const w = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12); w.rotateX(Math.PI / 2); w.translate(tbx + wx, 0.3, tbz + wz); add('tyre', w);
  }
  for (const dz of [-0.45, 0.45]) { const h = new THREE.SphereGeometry(0.1, 8, 6); h.translate(tbx + 1.71, 0.72, tbz + dz); add('n_warm', h); }
  tube('cyan', [tbx - 1.6, 0.12, tbz - 0.75], [tbx + 1.6, 0.12, tbz - 0.75], 0.03);
  tube('cyan', [tbx - 1.6, 0.12, tbz + 0.75], [tbx + 1.6, 0.12, tbz + 0.75], 0.03);

  // ---------- Centre plant rack with lifebuoy (photo 1) ----------
  const rk = { x0: -2, x1: 2, z0: -0.8, z1: 0.8 };
  for (const [px, pz] of [[rk.x0, rk.z0], [rk.x1, rk.z0], [rk.x0, rk.z1], [rk.x1, rk.z1]]) block('iron', px - 0.05, 0, pz - 0.05, px + 0.05, 3.9, pz + 0.05, false);
  const shelves = [1.2, 2.4, 3.6];
  for (const y of shelves) block('wood', rk.x0, y - 0.05, rk.z0, rk.x1, y, rk.z1, false, 1.5);
  solidOnly(rk.x0 - 0.05, 0, rk.z0 - 0.05, rk.x1 + 0.05, 3.9, rk.z1 + 0.05);
  // orange X neon (front & back)
  for (const zz of [rk.z1 + 0.06, rk.z0 - 0.06]) { tube('orange', [rk.x0, 0.15, zz], [rk.x1, 1.15, zz], 0.03); tube('orange', [rk.x0, 1.15, zz], [rk.x1, 0.15, zz], 0.03); }
  tube('magenta', [0.6, 0, rk.z1 + 0.05], [0.6, 3.5, rk.z1 + 0.05], 0.035);
  // lifebuoy + fan + inner orange neon ring
  const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 10, 28), new THREE.MeshLambertMaterial({ map: tex.buoy, emissive: 0x220806 }));
  buoy.position.set(-0.6, 3.05, rk.z1 + 0.15); scene.add(buoy);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 32), mats.n_orange); ring.position.copy(buoy.position); scene.add(ring);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshLambertMaterial({ color: 0x8a8f99, emissive: 0x1a1a22 }));
  fan.position.copy(buoy.position).add(new THREE.Vector3(0, 0, -0.04)); scene.add(fan);
  animated.push((t) => { fan.rotation.z = t * 6; });

  // ---------- Neon on walls ----------
  tube('magenta', [-9.6, 3.2, z0 + 0.06], [-1, 3.2, z0 + 0.06], 0.035);
  tube('cyan', [1, 2.6, z0 + 0.06], [9.6, 2.6, z0 + 0.06], 0.035);
  tube('magenta', [x1 - 0.06, 0.6, 5.5], [x1 - 0.06, 3.4, 5.5], 0.035);
  tube('cyan', [x1 - 0.06, 5, -2], [x1 - 0.06, 11, -2], 0.035);
  tube('orange', [x1 - 0.06, 5, 2], [x1 - 0.06, 9, 6], 0.03);
  tube('purple', [-9.6, 10.5, z0 + 0.06], [9.6, 10.5, z0 + 0.06], 0.03);
  tube('red', [-1.6, 3.25, z1 - 0.05], [1.6, 3.25, z1 - 0.05], 0.03);
  // pink-lit windows on the east wall (F1), like the photo
  for (const z of [-2.6, 1.0]) {
    const win = new THREE.PlaneGeometry(1.4, 2.2); win.rotateY(-Math.PI / 2); win.translate(x1 - 0.02, F1 + 1.5, z); add('n_magenta', win);
    block('wood', x1 - 0.1, F1 + 0.35, z - 0.78, x1, F1 + 2.65, z - 0.68, false); block('wood', x1 - 0.1, F1 + 0.35, z + 0.68, x1, F1 + 2.65, z + 0.78, false);
    block('wood', x1 - 0.1, F1 + 1.4, z - 0.7, x1 - 0.04, F1 + 1.47, z + 0.7, false);
  }
  // Big neon sign on the north wall
  const sz = signPlane(T.signTex('SZIMPLA', '#4ff3ff', '#22eaff', { w: 1024, h: 200, font: 'bold 170px "Trebuchet MS", sans-serif' }), 7, 1.37, true);
  sz.position.set(0, 11.6, z0 + 0.05); scene.add(sz);
  const kert = signPlane(T.signTex('KERT', '#ff4fd8', '#ff2bd0', { font: 'italic bold 90px cursive' }), 2.4, 0.6, true);
  kert.position.set(-6.5, 6.1, z0 + 0.05); scene.add(kert);
  const romk = signPlane(T.signTex('romkocsma', '#ffb347', '#ff7a18', { font: 'italic 80px cursive' }), 2.8, 0.7, true);
  romk.position.set(6.5, 6.3, z0 + 0.05); scene.add(romk);

  // House number 14 + street plate at the entrance
  const num = signPlane(T.signTex('14', '#ffffff', null, { w: 128, h: 128, font: 'bold 90px sans-serif', bg: '#1d4fb0' }), 0.5, 0.5, false);
  num.rotation.y = Math.PI; num.position.set(2.0, 2.6, z1 - 0.03); scene.add(num);
  const plate = signPlane(T.signTex('Kultúra utca', '#151515', null, { w: 512, h: 128, font: 'bold 64px serif', bg: '#efede4' }), 1.4, 0.35, false);
  plate.rotation.y = Math.PI; plate.position.set(3.2, 2.0, z1 - 0.03); scene.add(plate);

  // Facade balcony with coloured fairy lights (photo 3)
  block('cream', -3, 8.3, z1 - 1.0, 3, 8.5, z1, true, 2);
  block('iron', -3, 9.45, z1 - 1.02, 3, 9.5, z1 - 0.95, false);
  for (let x = -2.95; x < 3; x += 0.15) block('iron', x, 8.5, z1 - 1.0, x + 0.02, 9.45, z1 - 0.98, false);

  // ---------- Instanced details ----------
  const potXforms = [], spiderXforms = [], fernXforms = [], hangXforms = [], planterBoxes = [];
  const m4 = (x, y, z, s = 1, ry = 0, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(up, ry), new THREE.Vector3(s, sy, s));

  // planters on railings, with spider plants spilling over
  function railPlanters(xa, xb, z, y, step = 2.2) {
    for (let x = xa + 0.8; x < xb - 0.5; x += step) {
      block('planter', x - 0.45, y + 1.05, z - 0.14, x + 0.45, y + 1.3, z + 0.14, false, 1);
      spiderXforms.push(m4(x - 0.22, y + 1.3, z, R(0.8, 1.1), R(0, 6))); spiderXforms.push(m4(x + 0.22, y + 1.3, z, R(0.8, 1.1), R(0, 6)));
    }
  }
  railPlanters(-inX, 5.6, -inZ, F1); railPlanters(-inX, inX, inZ, F1, 2.6); railPlanters(-inX + 0.3, x1, -inZ, F2, 2.4);
  for (let z = -inZ + 0.8; z < inZ - 0.5; z += 2.4) { block('planter', inX - 0.14, F1 + 1.05, z - 0.45, inX + 0.14, F1 + 1.3, z + 0.45, false, 1); spiderXforms.push(m4(inX, F1 + 1.3, z, 1, R(0, 6))); }
  // shelves on the rack
  for (const y of shelves) for (let x = -1.7; x <= 1.7; x += 0.55) {
    const z = R(-0.4, 0.4); potXforms.push(m4(x, y, z, R(0.9, 1.2)));
    (rand() < 0.6 ? spiderXforms : fernXforms).push(m4(x, y + 0.3, z, R(0.7, 1.0), R(0, 6)));
  }
  // top of rack
  for (let x = -1.6; x <= 1.6; x += 0.8) { potXforms.push(m4(x, 3.9, 0, 1.2)); fernXforms.push(m4(x, 4.25, 0, 1.1, R(0, 6))); }
  // hanging pots under walkway edges
  for (let x = -7; x <= 7; x += 1.75) for (const z of [-inZ + 0.25, inZ - 0.25]) {
    if (x > 5.4 && z < 0) continue;
    hangXforms.push(m4(x, F1 - slab - 0.9, z, R(1.0, 1.4), R(0, 6)));
    potXforms.push(m4(x, F1 - slab - 1.2, z, 0.9));
  }
  for (let x = -7; x <= 7; x += 2.3) { hangXforms.push(m4(x, F2 - slab - 0.9, -inZ + 0.25, R(1, 1.3), R(0, 6))); potXforms.push(m4(x, F2 - slab - 1.2, -inZ + 0.25, 0.9)); }
  // ground corners and along walls: big ferns
  for (const [x, z] of [[-9.4, -6.4], [9.4, -6.4], [9.4, 6.4], [-9.4, 6.4], [-3, -6.4], [3, -6.4], [-6, 6.4], [6, 6.4], [9.4, -4], [4.5, 6.4], [-4.5, 6.4]]) {
    potXforms.push(m4(x, 0, z, 2.0)); fernXforms.push(m4(x, 0.6, z, 2.0, R(0, 6)));
    solidOnly(x - 0.35, 0, z - 0.35, x + 0.35, 0.6, z + 0.35);
  }
  // facade balcony plants & window-sill plants (photo 3)
  for (const x of [-2.5, 2.5]) { potXforms.push(m4(x, 8.5, z1 - 0.5, 1.4)); fernXforms.push(m4(x, 8.95, z1 - 0.5, 1.6)); }
  // F1 / F2 walkway floor plants against walls
  for (let x = -8; x <= 8; x += 3.2) { potXforms.push(m4(x, F1, z0 + 0.4, 1.5)); fernXforms.push(m4(x, F1 + 0.45, z0 + 0.4, 1.6, R(0, 6))); }
  for (let x = -6; x <= 8; x += 3.5) { potXforms.push(m4(x, F2, z0 + 0.4, 1.4)); spiderXforms.push(m4(x, F2 + 0.42, z0 + 0.4, 1.4, R(0, 6))); }

  // Plant geometry: 3 crossed quads with root at y=0
  function plantGeo(rootFrac) {
    const parts = [];
    for (let i = 0; i < 3; i++) { const p = new THREE.PlaneGeometry(1, 1); p.translate(0, 0.5 - rootFrac, 0); p.rotateY(i * Math.PI / 3); parts.push(p); }
    return mergeGeometries(parts);
  }
  const plantMat = (map) => new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, emissive: 0x0b140a });
  const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; scene.add(im); return im; };
  inst(plantGeo(0.38), plantMat(tex.spider), spiderXforms);
  inst(plantGeo(0.05), plantMat(tex.fern), fernXforms);
  inst(plantGeo(0.38), plantMat(tex.spider), hangXforms.map(m => m.clone().multiply(new THREE.Matrix4().makeScale(1, -1, 1))).concat(hangXforms));
  const potG = new THREE.CylinderGeometry(0.18, 0.13, 0.3, 8); potG.translate(0, 0.15, 0);
  inst(potG, mats.terracotta, potXforms);
  // hanging pot cords
  const cordPts = [];
  for (const m of hangXforms) { const p = new THREE.Vector3().setFromMatrixPosition(m); cordPts.push(p.x, p.y - 0.3, p.z, p.x, p.y + 0.9, p.z); }
  // balusters
  const balG = new THREE.BoxGeometry(0.025, 1.0, 0.025); balG.translate(0, 0.55, 0);
  inst(balG, mats.iron, balusters.map(([x, y, z]) => m4(x, y, z)));

  // String fairy lights: catenaries across the courtyard + along balcony
  const bulbs = [], bulbCols = [];
  const warmC = new THREE.Color(0xffc27a).multiplyScalar(3.2);
  const palette = [0xff3355, 0x33ff88, 0x3388ff, 0xffdd33, 0xff55ff, 0x55ffff].map(c => new THREE.Color(c).multiplyScalar(3));
  function strand(a, b, sag, n, colorful = false) {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n; const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(...a), new THREE.Vector3(...b), t); p.y -= sag * 4 * t * (1 - t);
      bulbs.push(m4(p.x, p.y, p.z)); bulbCols.push(colorful ? palette[i % palette.length] : warmC);
      if (prev) cordPts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p;
    }
  }
  for (let x = -8; x <= 8; x += 4) strand([x, 11.8, z0 + 0.1], [x + 2, 11.8, z1 - 0.1], 1.6, 28);
  strand([x0 + 0.1, 11, 0], [x1 - 0.1, 11, 0], 1.2, 30);
  strand([-inX, F1 + 1.15, inZ], [inX, F1 + 1.15, inZ], 0.25, 30);
  strand([-inX, F2 + 1.15, -inZ], [x1, F2 + 1.15, -inZ], 0.25, 30);
  strand([-inX, F1 + 2.7, -inZ], [5.6, F1 + 2.7, -inZ], 0.35, 26);
  strand([-3, 9.4, z1 - 1.0], [3, 9.4, z1 - 1.0], 0.12, 22, true);   // facade balcony (colourful)
  strand([-1.4, 3.6, z1 - 0.1], [1.4, 3.6, z1 - 0.1], 0.1, 12, true);  // entrance
  const bulbG = new THREE.SphereGeometry(0.045, 6, 4);
  const bim = inst(bulbG, new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs);
  bulbCols.forEach((c, i) => bim.setColorAt(i, c)); bim.instanceColor.needsUpdate = true;
  const cordGeo = new THREE.BufferGeometry(); cordGeo.setAttribute('position', new THREE.Float32BufferAttribute(cordPts, 3));
  scene.add(new THREE.LineSegments(cordGeo, new THREE.LineBasicMaterial({ color: 0x0c0a08 })));

  // Disco balls
  const discoMat = new THREE.MeshLambertMaterial({ map: tex.disco, emissiveMap: tex.disco, emissive: new THREE.Color(0x9a7ab0) });
  for (const [x, y, z, r] of [[0, 9.6, 0.5, 0.45], [4.2, 3.0, 0.2, 0.28], [-6.2, 3.1, -2.6, 0.28]]) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), discoMat); d.position.set(x, y, z); scene.add(d);
    cordPts.push(x, y + r, z, x, y + 3, z);
    animated.push((t) => { d.rotation.y = t * 0.6; });
  }
  cordGeo.setAttribute('position', new THREE.Float32BufferAttribute(cordPts, 3));

  // Stars over the open roof
  const stars = []; for (let i = 0; i < 160; i++) stars.push(R(-30, 30), R(16, 30), R(-30, 30));
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8a86b0, size: 1.5, sizeAttenuation: false, fog: false })));

  // ---------- Merge buckets ----------
  for (const [key, geos] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mats[key]);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    if (key.startsWith('h_')) { mesh.renderOrder = 2; lowOnly.push(mesh); }
    scene.add(mesh);
  }

  function signPlane(map, w, h, glow) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow
      ? new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2) })
      : new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: new THREE.Color(0x333333) }));
    return m;
  }

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0x6a4a9a, 0x24160e, 0.45));
  scene.add(new THREE.AmbientLight(0x2a2040, 0.35));
  const mkLight = (c, i, d, pos, tier) => { const l = new THREE.PointLight(c, i * 0.6, d, 1.7); l.position.set(...pos); l.userData.tier = tier; scene.add(l); return l; };
  const lights = [
    mkLight(0xff2bd6, 16, 14, [-5, 2.6, -4], 1),
    mkLight(0x22eaff, 16, 14, [6.5, 6.5, 1.5], 1),
    mkLight(0xff7a18, 12, 10, [0, 2.0, 1.8], 1),
    mkLight(0xffb060, 9, 9, [-9.2, 7.0, 0], 1),
    mkLight(0x9b3bff, 14, 14, [0, 10.2, -5.6], 2),
    mkLight(0x22ffd0, 10, 10, [-3, 1.4, 5.5], 2),
    mkLight(0xff4fa0, 10, 10, [6, 1.6, -3.5], 2),
    mkLight(0xffc27a, 8, 8, [0, 9.6, 5.6], 2),
  ];

  const spawnPoints = [];
  for (let x = -7; x <= 7; x += 3.5) for (const z of [-2.5, 2.5]) spawnPoints.push(new THREE.Vector3(x, 12.2, z));
  spawnPoints.push(new THREE.Vector3(0, 1.6, z1 + 1.5));

  return { boxes, animated, lowOnly, lights, spawnPoints, glowTex: tex.glow };
}
