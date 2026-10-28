// Canvas-generated textures — no external assets.
import * as THREE from 'three';

let seed = 1337;
export function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const R = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function canvasTex(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

function noise(g, w, h, n, cols, rmin, rmax, alpha) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * R(0.3, 1);
    g.fillStyle = pick(cols);
    g.beginPath(); g.arc(R(0, w), R(0, h), R(rmin, rmax), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function bricks(g, x0, y0, w, h, bw = 32, bh = 14) {
  g.fillStyle = '#5a4436'; g.fillRect(x0, y0, w, h);
  for (let y = y0, row = 0; y < y0 + h; y += bh, row++) {
    for (let x = x0 - (row % 2) * bw / 2; x < x0 + w; x += bw) {
      const r = R(120, 170) | 0, gg = R(60, 90) | 0, b = R(40, 60) | 0;
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x + 1.5, y + bh - 4, bw - 3, 2.5);
    }
  }
}

const WORDS = ['SZIMPLA', 'BUDAPEST', 'KERT', 'Anna + Bence', 'I ❤ BP', 'ROMKOCSMA', 'Kazinczy 14', 'Egészségedre!', 'LUCA', 'TOMI 2019', 'DUDLEY', 'Marco', 'Peace', 'Ide jártam', 'Jägerbomb', 'xoxo', 'Ciao!', 'MUSIC', 'Lisboa → BP', 'hello', 'Sziasztok', 'FREE', 'ruin', 'DAVIDE', 'Pálinka!', 'K.B.', '★', 'ERASMUS', '2026', 'LOVE', 'ZOLI', 'Prost', 'NO WAR'];
function scribbles(g, w, h, n, palette) {
  for (let i = 0; i < n; i++) {
    g.save();
    g.translate(R(0, w), R(0, h)); g.rotate(R(-0.5, 0.5));
    g.fillStyle = g.strokeStyle = pick(palette);
    g.globalAlpha = R(0.55, 0.95);
    if (rand() < 0.7) {
      g.font = `${pick(['bold ', 'italic ', ''])}${R(10, 30) | 0}px ${pick(['cursive', 'sans-serif', 'serif', 'monospace', 'fantasy'])}`;
      g.fillText(pick(WORDS), 0, 0);
    } else {
      g.lineWidth = R(1, 2.5); g.beginPath(); g.moveTo(0, 0);
      for (let k = 0; k < 8; k++) g.quadraticCurveTo(R(-30, 30), R(-20, 20), R(-30, 30), R(-20, 20));
      g.stroke();
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

export function plasterTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#a89c86'); grd.addColorStop(1, '#8c7f69');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    noise(g, w, h, 900, ['#7a6d58', '#b5aa93', '#6b604f', '#9d8f74'], 2, 14, 0.25);
    // fallen plaster revealing brick
    for (let i = 0; i < 5; i++) {
      const cx = R(40, w - 40), cy = R(40, h - 40), rx = R(30, 90), ry = R(20, 60);
      g.save(); g.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.4) { const rr = R(0.6, 1.1); g.lineTo(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr); }
      g.closePath(); g.clip(); bricks(g, cx - rx * 1.2, cy - ry * 1.2, rx * 2.4, ry * 2.4); g.restore();
    }
    // water stains
    for (let i = 0; i < 6; i++) {
      const x = R(0, w); const gr = g.createLinearGradient(x, 0, x, h);
      gr.addColorStop(0, 'rgba(60,50,35,0.35)'); gr.addColorStop(1, 'rgba(60,50,35,0)');
      g.fillStyle = gr; g.fillRect(x, 0, R(8, 40), R(100, 400));
    }
    scribbles(g, w, h, 110, ['#111', '#222', '#1b1b6b', '#7a0c0c', '#f4f4f4', '#0b4a1c', '#333']);
  });
}

export function brickTex() {
  return canvasTex(512, 512, (g, w, h) => {
    bricks(g, 0, 0, w, h, 64, 28);
    noise(g, w, h, 500, ['#3a2a20', '#c49470', '#2a1d16'], 1, 6, 0.25);
    scribbles(g, w, h, 45, ['#111', '#f0f0f0', '#e0e0e0', '#7a0c0c', '#222']);
  });
}

export function woodTex() {
  return canvasTex(256, 256, (g, w, h) => {
    for (let x = 0; x < w; x += 32) {
      const b = R(60, 90) | 0; g.fillStyle = `rgb(${b + 30},${b},${b - 25})`; g.fillRect(x, 0, 32, h);
      g.strokeStyle = 'rgba(30,18,8,0.4)'; g.lineWidth = 1;
      for (let k = 0; k < 6; k++) { g.beginPath(); const xx = x + R(2, 30); g.moveTo(xx, 0); g.bezierCurveTo(xx + R(-4, 4), h * 0.3, xx + R(-4, 4), h * 0.6, xx + R(-3, 3), h); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 2, h);
    }
  });
}

export function floorTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b2420'; g.fillRect(0, 0, w, h);
    const bw = 48, bh = 24;
    for (let y = 0, row = 0; y < h; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
      const r = R(85, 120) | 0; g.fillStyle = `rgb(${r},${r * 0.62 | 0},${r * 0.48 | 0})`;
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
    noise(g, w, h, 700, ['#1c1612', '#3d332b', '#6e5a48'], 1, 5, 0.35);
  });
}

export function facadeTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#9a8f7a'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 1500, ['#7d725f', '#b0a58f', '#5f5646', '#8a7e68'], 2, 18, 0.3);
    // cornice with dentils
    g.fillStyle = '#6d6352'; g.fillRect(0, 0, w, 34); g.fillStyle = '#b8ad96'; g.fillRect(0, 34, w, 10);
    for (let x = 6; x < w; x += 22) { g.fillStyle = '#8c826e'; g.fillRect(x, 44, 12, 18); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 10, 44, 3, 18); }
    g.fillStyle = '#5e5546'; g.fillRect(0, 62, w, 6);
    // windows row x2
    const drawWin = (x, y, ww, hh, lit) => {
      g.fillStyle = '#d9d3c1'; g.fillRect(x - 8, y - 8, ww + 16, hh + 16);
      g.fillStyle = '#4d4638'; g.beginPath(); g.moveTo(x - 16, y - 12); g.lineTo(x + ww / 2, y - 44); g.lineTo(x + ww + 16, y - 12); g.closePath(); g.fill();
      g.fillStyle = '#bdb49e'; g.beginPath(); g.moveTo(x - 8, y - 14); g.lineTo(x + ww / 2, y - 38); g.lineTo(x + ww + 8, y - 14); g.closePath(); g.fill();
      g.fillStyle = lit ? '#e8b75c' : '#56685a'; g.fillRect(x, y, ww, hh);
      if (lit) { const gr = g.createRadialGradient(x + ww / 2, y + hh / 2, 4, x + ww / 2, y + hh / 2, ww); gr.addColorStop(0, '#fff2c0'); gr.addColorStop(1, 'rgba(232,183,92,0)'); g.fillStyle = gr; g.fillRect(x, y, ww, hh); }
      g.fillStyle = '#f2efe6'; g.fillRect(x + ww / 2 - 3, y, 6, hh); g.fillRect(x, y + hh * 0.32, ww, 5);
      g.strokeStyle = '#f2efe6'; g.lineWidth = 5; g.strokeRect(x, y, ww, hh);
      // sill + balusters
      g.fillStyle = '#7a705d'; g.fillRect(x - 14, y + hh + 8, ww + 28, 10);
      for (let bx = x - 10; bx < x + ww + 10; bx += 12) { g.fillStyle = '#a89d86'; g.beginPath(); g.ellipse(bx + 5, y + hh + 30, 4, 11, 0, 0, Math.PI * 2); g.fill(); }
    };
    for (let i = 0; i < 6; i++) { drawWin(50 + i * 165, 120, 80, 120, rand() < 0.3); }
    for (let i = 0; i < 6; i++) { drawWin(50 + i * 165, 340, 80, 110, rand() < 0.25); }
    // peeling patches
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(60,52,40,${R(.2, .5)})`; g.beginPath(); g.ellipse(R(0, w), R(70, h), R(10, 50), R(6, 30), R(0, 3), 0, 7); g.fill(); }
  }, { repeat: false });
}

export function ironOrnamentTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2a2622'; g.lineCap = 'round';
    const scroll = (cx, cy, r, dir) => { g.beginPath(); for (let a = 0; a < Math.PI * 3.2; a += 0.1) { const rr = r * (1 - a / (Math.PI * 3.6)); g.lineTo(cx + Math.cos(a * dir) * rr, cy + Math.sin(a * dir) * rr); } g.stroke(); };
    g.lineWidth = 7; g.strokeRect(6, 6, w - 12, h - 12);
    g.lineWidth = 6;
    scroll(80, 80, 50, 1); scroll(176, 80, 50, -1); scroll(80, 176, 50, -1); scroll(176, 176, 50, 1);
    g.beginPath(); g.moveTo(128, 10); g.lineTo(128, 246); g.moveTo(10, 128); g.lineTo(246, 128); g.stroke();
    g.fillStyle = '#2a2622'; g.beginPath(); g.arc(128, 128, 14, 0, 7); g.fill();
    g.strokeStyle = '#6d5a3c'; g.lineWidth = 1.5; scroll(80, 80, 50, 1); scroll(176, 176, 50, 1); // brass highlights
  }, { repeat: false });
}

export function spiderPlantTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const a = R(-Math.PI * 0.95, -Math.PI * 0.05);
      const len = R(70, 125), droop = R(20, 90);
      const x0 = w / 2 + R(-6, 6), y0 = h * 0.62;
      const ex = x0 + Math.cos(a) * len, ey = y0 + Math.sin(a) * len * 0.75 + droop;
      const cx = x0 + Math.cos(a) * len * 0.5, cy = y0 + Math.sin(a) * len * 0.9;
      const green = rand() < 0.5 ? `hsl(${R(85, 120)},${R(45, 70)}%,${R(28, 45)}%)` : `hsl(${R(70, 100)},${R(30, 55)}%,${R(45, 62)}%)`;
      g.strokeStyle = green; g.lineWidth = R(2.5, 5); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      if (rand() < 0.35) { g.strokeStyle = 'rgba(230,240,200,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke(); }
    }
  }, { repeat: false });
}

export function fernTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI / 2 + R(-1.1, 1.1); const len = R(80, 120);
      g.save(); g.translate(w / 2, h * 0.95); g.rotate(a + Math.PI / 2);
      g.strokeStyle = `hsl(${R(95, 125)},55%,${R(22, 34)}%)`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.stroke();
      for (let s = 8; s < len; s += 5) { const l = (1 - s / len) * 22 + 4; g.fillStyle = `hsl(${R(95, 125)},55%,${R(25, 40)}%)`;
        g.beginPath(); g.ellipse(-l / 2, -s, l / 2, 2.2, -0.4, 0, 7); g.fill(); g.beginPath(); g.ellipse(l / 2, -s, l / 2, 2.2, 0.4, 0, 7); g.fill(); }
      g.restore();
    }
  }, { repeat: false });
}

export function lifebuoyTex() {
  return canvasTex(256, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2efe8' : '#e0471f'; g.fillRect(i * w / 8, 0, w / 8, h); }
    noise(g, w, h, 200, ['#8a6a50', '#553322'], 1, 4, 0.3);
  });
}

export function discoTex() {
  return canvasTex(256, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const v = R(80, 255) | 0; const tint = pick([[1, 1, 1], [1, .6, 1], [.6, 1, 1], [1, .85, .6]]);
      g.fillStyle = `rgb(${v * tint[0] | 0},${v * tint[1] | 0},${v * tint[2] | 0})`; g.fillRect(x + 0.5, y + 0.5, 7, 7);
    }
  });
}

export function signTex(text, color, glow, { w = 512, h = 128, font = 'bold 84px "Trebuchet MS", sans-serif', bg = null } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
    if (glow) { g.shadowBlur = 8; g.fillStyle = '#ffffff'; g.globalAlpha = 0.55; g.fillText(text, w / 2, h / 2 + 4); }
  }, { repeat: false });
}

export function glowSpriteTex() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false, srgb: false });
}

export function muzzleTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.translate(64, 64);
    for (let i = 0; i < 7; i++) { g.rotate(Math.PI * 2 / 7 + R(-.2, .2)); const gr = g.createLinearGradient(0, 0, 0, -60);
      gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, -R(40, 62)); g.lineTo(7, 0); g.fill(); }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
  }, { repeat: false });
}
