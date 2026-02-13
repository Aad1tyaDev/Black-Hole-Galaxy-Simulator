// ===== Canvas Setup =====
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const center = { x: innerWidth / 2, y: innerHeight / 2 };

// Camera
let zoom = 1.0;

// Put blackHole FIRST so resize() can use it later
const blackHole = {
  x: center.x,
  y: center.y,
  vx: 0,
  vy: 0,
  mass: 6000, // simulation mass units
  radius: 60,
  type: "bh"
};

let binaryBH = null;
let binaryEnabled = false;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  center.x = canvas.width / 2;
  center.y = canvas.height / 2;
  blackHole.x = center.x;
  blackHole.y = center.y;
}
resize();
addEventListener("resize", resize);

// ===== UI Elements =====
const speedSlider = document.getElementById("speed");
const speedVal = document.getElementById("speedVal");
const useRK4Checkbox = document.getElementById("useRK4");
const useQuadCheckbox = document.getElementById("useQuad");
const showDebugCheckbox = document.getElementById("showDebug");

const gravSlider = document.getElementById("grav");
const gravVal = document.getElementById("gravVal");
const softSlider = document.getElementById("soft");
const softVal = document.getElementById("softVal");
const zoomSlider = document.getElementById("zoom");
const zoomVal = document.getElementById("zoomVal");

const metricsDiv = document.getElementById("metrics");
const physicsDiv = document.getElementById("physics-info");

let speedMult = 1.0;
speedSlider.addEventListener("input", () => {
  speedMult = speedSlider.value / 50;
  speedVal.textContent = speedMult.toFixed(2) + "x";
});

// Simulation gravity
let G = 0.4;
gravSlider.addEventListener("input", () => {
  // map 5..200 -> 0.05..2.0 roughly
  G = gravSlider.value / 100;
  gravVal.textContent = G.toFixed(2);
});

let softening = 10.0;
softSlider.addEventListener("input", () => {
  softening = parseFloat(softSlider.value);
  softVal.textContent = softening.toFixed(1);
});

zoomSlider.addEventListener("input", () => {
  zoom = zoomSlider.value / 100;
  zoomVal.textContent = zoom.toFixed(1) + "x";
});

// ===== Simulation State =====
let paused = false;
let trailsEnabled = true;

const bodies = []; // index 0 will be blackHole (and maybe binaryBH)
const repulsors = [];
const explosions = [];
const stars = [];
let swirlAngle = 0;

// "Real-ish" constants for overlays (scale factors)
const G_REAL = 6.6743e-11; // m^3 kg^-1 s^-2
const C = 3e8; // m/s
const MASS_SCALE = 1e24;
const DIST_SCALE = 1e8;

// Dark matter halo params (toy NFW-ish)
const haloDensity0 = 1.0;
const haloScaleRadius = 300;

// Telemetry history
const historyLength = 300;
const massHistory = [];
const countHistory = [];

// ===== Utility =====
function randRange(a, b) {
  return a + Math.random() * (b - a);
}

// ===== Stars (background) =====
function initStars(count = 400) {
  stars.length = 0;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      b: Math.random() * 0.6 + 0.2
    });
  }
}
initStars();

// Put black hole into bodies[0]
bodies.push(blackHole);

// ===== Bodies =====
function makeBodyOrbiting(mass) {
  const angle = Math.random() * Math.PI * 2;
  const dist = randRange(120, 460);

  const x = center.x + Math.cos(angle) * dist;
  const y = center.y + Math.sin(angle) * dist;

  const vMag = Math.sqrt((G * blackHole.mass) / dist); // circular orbit speed

  return {
    x,
    y,
    vx: -Math.sin(angle) * vMag,
    vy: Math.cos(angle) * vMag,
    mass,
    radius: Math.sqrt(mass),
    baseHue: Math.random() * 360,
    trail: [],
    type: "planet"
  };
}

function makeComet() {
  const angle = Math.random() * Math.PI * 2;
  const dist = randRange(500, 900);
  const x = center.x + Math.cos(angle) * dist;
  const y = center.y + Math.sin(angle) * dist;

  // high eccentricity: slightly under circular so it falls inward hard
  const vMag = Math.sqrt((G * blackHole.mass) / dist) * randRange(0.4, 0.8);

  const vx = -Math.sin(angle) * vMag;
  const vy = Math.cos(angle) * vMag;

  return {
    x,
    y,
    vx,
    vy,
    mass: randRange(10, 25),
    radius: 4,
    baseHue: 200,
    trail: [],
    type: "comet"
  };
}

function initGalaxy(count = 220) {
  bodies.length = 1; // keep only blackHole
  binaryBH = null;
  binaryEnabled = false;

  for (let i = 0; i < count; i++) {
    const mass = randRange(6, 20);
    bodies.push(makeBodyOrbiting(mass));
  }
  repulsors.length = 0;
  explosions.length = 0;
  massHistory.length = 0;
  countHistory.length = 0;
}

function initBinarySystem() {
  // create a second heavy black hole orbiting the first
  binaryBH = {
    x: center.x + 260,
    y: center.y,
    vx: 0,
    vy: Math.sqrt((G * blackHole.mass) / 260),
    mass: 4000,
    radius: 45,
    type: "bh"
  };
  // insert as body 1
  bodies.splice(1, 0, binaryBH);
  binaryEnabled = true;
}

function initGalaxyCollision() {
  bodies.length = 0;
  binaryEnabled = true;

  // two big BHs
  blackHole.x = center.x - 220;
  blackHole.y = center.y;
  blackHole.mass = 5000;
  blackHole.radius = 55;
  bodies.push(blackHole);

  binaryBH = {
    x: center.x + 220,
    y: center.y,
    vx: -0.35,
    vy: 0,
    mass: 5000,
    radius: 55,
    type: "bh"
  };
  bodies.push(binaryBH);

  // galaxy 1 around BH1
  for (let i = 0; i < 160; i++) {
    const mass = randRange(6, 20);
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(120, 360);
    const x = blackHole.x + Math.cos(angle) * dist;
    const y = blackHole.y + Math.sin(angle) * dist;
    const vMag = Math.sqrt((G * blackHole.mass) / dist);
    const vx = -Math.sin(angle) * vMag + 0.3; // push right
    const vy = Math.cos(angle) * vMag;
    bodies.push({
      x,
      y,
      vx,
      vy,
      mass,
      radius: Math.sqrt(mass),
      baseHue: Math.random() * 360,
      trail: [],
      type: "planet"
    });
  }

  // galaxy 2 around BH2
  for (let i = 0; i < 160; i++) {
    const mass = randRange(6, 20);
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(120, 360);
    const x = binaryBH.x + Math.cos(angle) * dist;
    const y = binaryBH.y + Math.sin(angle) * dist;
    const vMag = Math.sqrt((G * binaryBH.mass) / dist);
    const vx = -Math.sin(angle) * vMag - 0.3; // push left
    const vy = Math.cos(angle) * vMag;
    bodies.push({
      x,
      y,
      vx,
      vy,
      mass,
      radius: Math.sqrt(mass),
      baseHue: Math.random() * 360,
      trail: [],
      type: "planet"
    });
  }

  repulsors.length = 0;
  explosions.length = 0;
  massHistory.length = 0;
  countHistory.length = 0;
}

initGalaxy();

// ===== Mouse Inputs =====
// Right-click: negative mass repulsor
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  repulsors.push({
    x: e.clientX,
    y: e.clientY,
    strength: randRange(3000, 8000),
    life: 5
  });
});

// Left-click: spawn new random body
canvas.addEventListener("click", (e) => {
  const mass = randRange(8, 22);
  const b = makeBodyOrbiting(mass);
  b.x = e.clientX;
  b.y = e.clientY;
  b.vx = randRange(-1, 1);
  b.vy = randRange(-1, 1);
  bodies.push(b);
});

// Mouse wheel zoom
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoom *= factor;
  zoom = Math.min(Math.max(zoom, 0.3), 3.0);
  zoomSlider.value = Math.round(zoom * 100);
  zoomVal.textContent = zoom.toFixed(1) + "x";
});

// ===== Keyboard Controls =====
addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    paused = !paused;
  } else if (e.key === "r" || e.key === "R") {
    initGalaxy();
  } else if (e.key === "t" || e.key === "T") {
    trailsEnabled = !trailsEnabled;
    bodies.forEach((b, i) => {
      if (i !== 0) b.trail.length = 0;
    });
  } else if (e.key === "=" || e.key === "+") {
    G *= 1.1;
    gravSlider.value = Math.round(G * 100);
    gravVal.textContent = G.toFixed(2);
  } else if (e.key === "-" || e.key === "_") {
    G *= 0.9;
    gravSlider.value = Math.round(G * 100);
    gravVal.textContent = G.toFixed(2);
  } else if (e.key === "z" || e.key === "Z") {
    softening *= 0.9;
    softSlider.value = Math.max(1, Math.round(softening));
    softVal.textContent = softening.toFixed(1);
  } else if (e.key === "x" || e.key === "X") {
    softening *= 1.1;
    softSlider.value = Math.min(50, Math.round(softening));
    softVal.textContent = softening.toFixed(1);
  } else if (e.key === "b" || e.key === "B") {
    if (!binaryEnabled) initBinarySystem();
  } else if (e.key === "c" || e.key === "C") {
    bodies.push(makeComet());
  } else if (e.key === "g" || e.key === "G") {
    initGalaxyCollision();
  } else if (e.key === "k" || e.key === "K") {
    saveSnapshot();
  } else if (e.key === "l" || e.key === "L") {
    loadSnapshot();
  }
});

// ===== Explosions =====
function spawnExplosion(x, y, energy) {
  explosions.push({
    x,
    y,
    r: 0,
    maxR: 80 + energy * 0.004,
    alpha: 1
  });
}

// ===== Physics helpers =====
function haloAcceleration(dx, dy, dist) {
  const r = dist;
  const rs = haloScaleRadius;
  const rho = haloDensity0 / ((r / rs + 0.01) * Math.pow(1 + r / rs + 0.01, 2));
  const haloF = 0.0008 * rho;
  return {
    ax: (dx / (r || 1)) * haloF,
    ay: (dy / (r || 1)) * haloF
  };
}

function accelerationFromMassiveObjects(tmp) {
  // central BH
  let dx = blackHole.x - tmp.x;
  let dy = blackHole.y - tmp.y;
  let dist = Math.sqrt(dx * dx + dy * dy + softening * softening);

  const gF = (G * blackHole.mass) / (dist * dist);
  let ax = (dx / dist) * gF;
  let ay = (dy / dist) * gF;

  // halo
  const haloAcc = haloAcceleration(dx, dy, dist);
  ax += haloAcc.ax;
  ay += haloAcc.ay;

  // binary BH if enabled
  if (binaryEnabled && binaryBH) {
    const dx2 = binaryBH.x - tmp.x;
    const dy2 = binaryBH.y - tmp.y;
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + softening * softening);
    const gF2 = (G * binaryBH.mass) / (d2 * d2);
    ax += (dx2 / d2) * gF2;
    ay += (dy2 / d2) * gF2;
  }

  // repulsors
  for (const r of repulsors) {
    const rx = r.x - tmp.x;
    const ry = r.y - tmp.y;
    const rd = Math.sqrt(rx * rx + ry * ry + softening * softening);
    const repF = (G * r.strength) / (rd * rd);
    ax -= (rx / rd) * repF;
    ay -= (ry / rd) * repF;
  }

  return { ax, ay };
}

// RK4 integrator using accelerationFromMassiveObjects
function integrateRK4(b, dt) {
  const k1v = accelerationFromMassiveObjects(b);
  const k1x = { vx: b.vx, vy: b.vy };

  const mid1 = {
    x: b.x + k1x.vx * dt / 2,
    y: b.y + k1x.vy * dt / 2,
    vx: b.vx + k1v.ax * dt / 2,
    vy: b.vy + k1v.ay * dt / 2
  };
  const k2v = accelerationFromMassiveObjects(mid1);
  const k2x = { vx: mid1.vx, vy: mid1.vy };

  const mid2 = {
    x: b.x + k2x.vx * dt / 2,
    y: b.y + k2x.vy * dt / 2,
    vx: b.vx + k2v.ax * dt / 2,
    vy: b.vy + k2v.ay * dt / 2
  };
  const k3v = accelerationFromMassiveObjects(mid2);
  const k3x = { vx: mid2.vx, vy: mid2.vy };

  const end = {
    x: b.x + k3x.vx * dt,
    y: b.y + k3x.vy * dt,
    vx: b.vx + k3v.ax * dt,
    vy: b.vy + k3v.ay * dt
  };
  const k4v = accelerationFromMassiveObjects(end);
  const k4x = { vx: end.vx, vy: end.vy };

  b.x += (dt / 6) * (k1x.vx + 2 * k2x.vx + 2 * k3x.vx + k4x.vx);
  b.y += (dt / 6) * (k1x.vy + 2 * k2x.vy + 2 * k3x.vy + k4x.vy);
  b.vx += (dt / 6) * (k1v.ax + 2 * k2v.ax + 2 * k3v.ax + k4v.ax);
  b.vy += (dt / 6) * (k1v.ay + 2 * k2v.ay + 2 * k3v.ay + k4v.ay);
}

// ===== Simple Quad-Tree for Barnes–Hut (2D) =====
class QuadNode {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.mass = 0;
    this.cx = 0;
    this.cy = 0;
    this.body = null;
    this.children = null;
  }

  insert(body) {
    if (!this.children && this.body === null && this.mass === 0) {
      this.body = body;
      this.mass = body.mass;
      this.cx = body.x;
      this.cy = body.y;
      return;
    }

    if (!this.children) {
      this.subdivide();
      if (this.body) {
        this._insertIntoChildren(this.body);
        this.body = null;
      }
    }
    this._insertIntoChildren(body);

    const totalMass = this.mass + body.mass;
    this.cx = (this.cx * this.mass + body.x * body.mass) / totalMass;
    this.cy = (this.cy * this.mass + body.y * body.mass) / totalMass;
    this.mass = totalMass;
  }

  _insertIntoChildren(body) {
    const midX = this.x + this.w / 2;
    const midY = this.y + this.h / 2;
    const right = body.x >= midX;
    const bottom = body.y >= midY;
    let idx = 0;
    if (right && !bottom) idx = 1; // NE
    else if (!right && bottom) idx = 2; // SW
    else if (right && bottom) idx = 3; // SE
    this.children[idx].insert(body);
  }

  subdivide() {
    const hw = this.w / 2;
    const hh = this.h / 2;
    this.children = [
      new QuadNode(this.x, this.y, hw, hh), // NW
      new QuadNode(this.x + hw, this.y, hw, hh), // NE
      new QuadNode(this.x, this.y + hh, hw, hh), // SW
      new QuadNode(this.x + hw, this.y + hh, hw, hh) // SE
    ];
  }

  addForceOn(body, theta, acc) {
    if (this.mass === 0 || this.body === body) return;

    const dx = this.cx - body.x;
    const dy = this.cy - body.y;
    const dist = Math.sqrt(dx * dx + dy * dy + softening * softening);

    if (!this.children || (this.w / dist) < theta) {
      const f = (G * this.mass) / (dist * dist);
      acc.ax += f * dx / dist;
      acc.ay += f * dy / dist;
    } else {
      for (const child of this.children) {
        child.addForceOn(body, theta, acc);
      }
    }
  }
}

// ===== Planet-Planet merging & supernova =====
const SUPER_MASS_THRESHOLD = 220;

function handlePlanetCollisions() {
  const n = bodies.length;
  const toRemove = new Set();
  const toAdd = [];

  for (let i = 1; i < n; i++) {
    const bi = bodies[i];
    if (bi.type === "bh" || toRemove.has(i)) continue;

    for (let j = i + 1; j < n; j++) {
      if (toRemove.has(j)) continue;
      const bj = bodies[j];
      if (bj.type === "bh") continue;

      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;
      const dist = Math.hypot(dx, dy);
      if (dist < (bi.radius + bj.radius) * 0.9) {
        const m1 = bi.mass;
        const m2 = bj.mass;
        const M = m1 + m2;

        const mx = (bi.x * m1 + bj.x * m2) / M;
        const my = (bi.y * m1 + bj.y * m2) / M;
        const mvx = (bi.vx * m1 + bj.vx * m2) / M;
        const mvy = (bi.vy * m1 + bj.vy * m2) / M;

        spawnExplosion(mx, my, M);

        if (M > SUPER_MASS_THRESHOLD) {
          // supernova: break into fragments
          const fragments = 10;
          for (let k = 0; k < fragments; k++) {
            const ang = (Math.PI * 2 * k) / fragments;
            const speed = 2 + Math.random() * 2;
            toAdd.push({
              x: mx,
              y: my,
              vx: mvx + Math.cos(ang) * speed,
              vy: mvy + Math.sin(ang) * speed,
              mass: M / (fragments * 2),
              radius: 3,
              baseHue: 40 + Math.random() * 40,
              trail: [],
              type: "planet"
            });
          }
        } else {
          // normal merged planet
          toAdd.push({
            x: mx,
            y: my,
            vx: mvx,
            vy: mvy,
            mass: M,
            radius: Math.sqrt(M),
            baseHue: (bi.baseHue + bj.baseHue) / 2,
            trail: [],
            type: "planet"
          });
        }

        toRemove.add(i);
        toRemove.add(j);
        break;
      }
    }
  }

  if (toRemove.size > 0) {
    const newBodies = [];
    bodies.forEach((b, idx) => {
      if (!toRemove.has(idx)) newBodies.push(b);
    });
    bodies.length = 0;
    for (const b of newBodies) bodies.push(b);
    for (const extra of toAdd) bodies.push(extra);
  }
}

// ===== Physics Update =====
function update(dt) {
  // Repulsors
  for (let i = repulsors.length - 1; i >= 0; i--) {
    repulsors[i].life -= dt;
    if (repulsors[i].life <= 0) repulsors.splice(i, 1);
  }

  // Binary BH orbital evolution (very simple, treated as point masses)
  if (binaryEnabled && binaryBH) {
    const dx = blackHole.x - binaryBH.x;
    const dy = blackHole.y - binaryBH.y;
    const dist = Math.sqrt(dx * dx + dy * dy + softening * softening);
    const f = (G * blackHole.mass) / (dist * dist);
    const ax = (dx / dist) * f;
    const ay = (dy / dist) * f;
    binaryBH.vx += ax * dt * speedMult;
    binaryBH.vy += ay * dt * speedMult;
    binaryBH.x += binaryBH.vx * dt * speedMult;
    binaryBH.y += binaryBH.vy * dt * speedMult;
  }

  // Build tree of non-BH bodies (for body-body gravity in Euler mode)
  let quadRoot = null;
  if (useQuadCheckbox.checked) {
    quadRoot = new QuadNode(0, 0, canvas.width, canvas.height);
    for (let i = 1; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.type !== "bh") quadRoot.insert(b);
    }
  }

  const dragCoeffInner = 0.3;
  const dragRadius = 200;

  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    if (b.type === "bh") continue; // planets/comets only here

    if (useRK4Checkbox.checked) {
      // RK4 mode: treat planets as test particles in the combined BH + halo + repulsor field
      integrateRK4(b, dt * speedMult);
    } else {
      // Euler mode: include full body-body gravity + BH + halo + repulsors
      let ax = 0;
      let ay = 0;

      // body-body gravity
      if (useQuadCheckbox.checked && quadRoot) {
        const acc = { ax: 0, ay: 0 };
        quadRoot.addForceOn(b, 0.6, acc);
        ax += acc.ax;
        ay += acc.ay;
      } else {
        for (let j = 1; j < bodies.length; j++) {
          if (i === j) continue;
          const s = bodies[j];
          if (s.type === "bh") continue;
          const dx = s.x - b.x;
          const dy = s.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy + softening * softening);
          const f = (G * s.mass) / (dist * dist);
          ax += f * dx / dist;
          ay += f * dy / dist;
        }
      }

      // BH + halo + binary + repulsors
      const accMassive = accelerationFromMassiveObjects(b);
      ax += accMassive.ax;
      ay += accMassive.ay;

      // integrate
      b.vx += ax * dt * speedMult;
      b.vy += ay * dt * speedMult;
      b.x += b.vx * dt * speedMult;
      b.y += b.vy * dt * speedMult;
    }

    // atmospheric drag near central BH (for spirals)
    const dxBH = b.x - blackHole.x;
    const dyBH = b.y - blackHole.y;
    const distBH = Math.hypot(dxBH, dyBH);
    if (distBH < dragRadius) {
      const drag = 1 - dragCoeffInner * dt;
      b.vx *= drag;
      b.vy *= drag;
    }

    // Trails
    if (trailsEnabled) {
      b.trail.push({ x: b.x, y: b.y });
      const maxTrail = b.type === "comet" ? 120 : 70;
      if (b.trail.length > maxTrail) b.trail.shift();
    } else {
      b.trail.length = 0;
    }

    // Absorption by black holes
    let absorbed = false;
    const distBH2 = Math.hypot(blackHole.x - b.x, blackHole.y - b.y);
    if (distBH2 < blackHole.radius && b.type !== "bh") {
      const speed = Math.hypot(b.vx, b.vy);
      const energy = b.mass * speed * speed;
      blackHole.mass += b.mass;
      blackHole.radius = Math.sqrt(blackHole.mass / 2);
      spawnExplosion(b.x, b.y, energy);
      absorbed = true;
    }

    if (!absorbed && binaryEnabled && binaryBH && b.type !== "bh") {
      const distBin = Math.hypot(binaryBH.x - b.x, binaryBH.y - b.y);
      if (distBin < binaryBH.radius) {
        const speed = Math.hypot(b.vx, b.vy);
        const energy = b.mass * speed * speed;
        binaryBH.mass += b.mass;
        binaryBH.radius = Math.sqrt(binaryBH.mass / 2);
        spawnExplosion(b.x, b.y, energy);
        absorbed = true;
      }
    }

    if (absorbed) {
      bodies.splice(i, 1);
      i--;
    }
  }

  // handle planet-planet collisions + supernovae
  handlePlanetCollisions();

  // Explosions expansion / fade
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.r += 200 * dt * speedMult;
    ex.alpha -= 1.2 * dt * speedMult;
    if (ex.alpha <= 0) explosions.splice(i, 1);
  }

  swirlAngle += 0.3 * dt * speedMult;

  // telemetry
  massHistory.push(blackHole.mass);
  countHistory.push(bodies.length);
  if (massHistory.length > historyLength) {
    massHistory.shift();
    countHistory.shift();
  }
}

// ===== Drawing =====
function withCamera(drawFn) {
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-center.x, -center.y);
  drawFn();
  ctx.restore();
}

function drawStars() {
  // draw stars in screen space (no camera zoom so they feel "infinite")
  for (const s of stars) {
    const flicker = (Math.random() - 0.5) * 0.1;
    const b = Math.min(1, Math.max(0, s.b + flicker));
    ctx.fillStyle = `rgba(255,255,255,${b})`;
    ctx.fillRect(s.x, s.y, 1.5, 1.5);
  }
}

function drawLensRing() {
  ctx.save();
  ctx.translate(blackHole.x, blackHole.y);
  ctx.rotate(swirlAngle * 0.6);

  const inner = blackHole.radius * 1.3;
  const outer = blackHole.radius * 2.8;

  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const r = inner + (outer - inner) * t;
    const hue = (220 + t * 140 + performance.now() * 0.02) % 360;
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${hue}, 80%, 70%, 0.5)`;
    ctx.lineWidth = 1.5;
    const wobble = Math.sin(t * 10 + swirlAngle * 2) * 0.3;
    ctx.ellipse(0, 0, r * (1 + wobble), r, wobble, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlackHole() {
  drawLensRing();

  ctx.beginPath();
  ctx.fillStyle = "black";
  ctx.arc(blackHole.x, blackHole.y, blackHole.radius * 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.arc(blackHole.x, blackHole.y, blackHole.radius, 0, Math.PI * 2);
  ctx.stroke();

  if (binaryEnabled && binaryBH) {
    ctx.beginPath();
    ctx.fillStyle = "#050010";
    ctx.arc(binaryBH.x, binaryBH.y, binaryBH.radius * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "#88f";
    ctx.lineWidth = 2;
    ctx.arc(binaryBH.x, binaryBH.y, binaryBH.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBodies() {
  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    if (b.type === "bh") continue;

    const speed = Math.hypot(b.vx, b.vy);
    const heat = Math.min(1, speed / 7);
    let hue;
    let light;

    if (b.type === "comet") {
      hue = 190 + heat * 40;
      light = 70;
    } else {
      hue = (b.baseHue + heat * 60) % 360;
      light = 45 + heat * 30;
    }

    // Trail
    if (b.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (const p of b.trail) ctx.lineTo(p.x, p.y);
      const alpha = b.type === "comet" ? 0.6 : 0.35;
      ctx.strokeStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`;
      ctx.lineWidth = b.type === "comet" ? 1.6 : 1.2;
      ctx.stroke();
    }

    // Heat glow
    const glowR = b.type === "comet" ? b.radius * 4 : b.radius * 3;
    const grad = ctx.createRadialGradient(
      b.x,
      b.y,
      0,
      b.x,
      b.y,
      glowR
    );
    grad.addColorStop(0, `hsla(${hue},100%,${light + 20}%,0.9)`);
    grad.addColorStop(1, `hsla(${hue},100%,${light}%,0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.fillStyle = `hsl(${hue},100%,${light}%)`;
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRepulsors() {
  for (const r of repulsors) {
    const alpha = Math.max(0, r.life / 5);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0,255,255,${alpha})`;
    ctx.lineWidth = 2;
    ctx.arc(r.x, r.y, 20 + (5 - r.life) * 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawExplosions() {
  for (const ex of explosions) {
    const a = Math.max(0, ex.alpha);
    const grad = ctx.createRadialGradient(
      ex.x,
      ex.y,
      0,
      ex.x,
      ex.y,
      ex.maxR
    );
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.25, `rgba(255,230,120,${a * 0.9})`);
    grad.addColorStop(0.5, `rgba(255,120,20,${a * 0.7})`);
    grad.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// mini telemetry graph bottom-left
function drawTelemetry() {
  if (!showDebugCheckbox.checked) return;
  const w = 180;
  const h = 70;
  const margin = 14;

  const x0 = margin;
  const y0 = canvas.height - margin - h;

  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = "rgba(5,5,20,0.85)";
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.roundRect(x0, y0, w, h, 8);
  ctx.fill();
  ctx.stroke();

  if (massHistory.length > 1) {
    const n = massHistory.length;
    const maxMass = Math.max(...massHistory);
    const minMass = Math.min(...massHistory);

    const maxCount = Math.max(...countHistory);
    const minCount = Math.min(...countHistory);

    function norm(v, min, max) {
      return max === min ? 0.5 : (v - min) / (max - min);
    }

    // BH mass line (magenta)
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const v = norm(massHistory[i], minMass, maxMass);
      const x = x0 + t * (w - 10) + 5;
      const y = y0 + h - 5 - v * (h - 15);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,120,255,0.9)";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // count line (cyan)
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const v = norm(countHistory[i], minCount, maxCount);
      const x = x0 + t * (w - 10) + 5;
      const y = y0 + h - 5 - v * (h - 15);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(120,220,255,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "9px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("BH mass / body count", x0 + 8, y0 + 14);
  }

  ctx.restore();
}

// ===== Physics Overlay (Schwarzschild, time dilation, Kepler) =====
function updatePhysicsOverlay(sampleBody) {
  const simMassKg = blackHole.mass * MASS_SCALE;
  const rsMeters = (2 * G_REAL * simMassKg) / (C * C);
  const rsSimUnits = rsMeters / DIST_SCALE;

  let dilation = 1.0;
  let T_orbit = null;

  if (sampleBody) {
    const dx = sampleBody.x - blackHole.x;
    const dy = sampleBody.y - blackHole.y;
    const rSim = Math.sqrt(dx * dx + dy * dy);
    const rMeters = rSim * DIST_SCALE;

    const inside = 1 - (2 * G_REAL * simMassKg) / (rMeters * C * C);
    dilation = inside > 0 ? Math.sqrt(inside) : 0;

    const GM = G_REAL * simMassKg;
    const Tsec = 2 * Math.PI * Math.sqrt((rMeters ** 3) / GM);
    T_orbit = Tsec;
  }

  physicsDiv.innerHTML = `
    <h3>Physics</h3>
    <div class="mono">
      M ≈ ${(simMassKg / 1.988e30).toExponential(2)} M☉<br>
      rₛ ≈ ${rsSimUnits.toFixed(1)} sim units<br>
      Time dilation: ×${dilation.toFixed(3)}<br>
      ${T_orbit ? "Kepler period ≈ " + (T_orbit / 3600).toFixed(2) + " h" : ""}
    </div>
  `;
}

// ===== Save / Load snapshot =====
function saveSnapshot() {
  const snapshot = {
    blackHole: {
      x: blackHole.x,
      y: blackHole.y,
      vx: blackHole.vx,
      vy: blackHole.vy,
      mass: blackHole.mass,
      radius: blackHole.radius
    },
    binary: binaryEnabled && binaryBH ? {
      x: binaryBH.x,
      y: binaryBH.y,
      vx: binaryBH.vx,
      vy: binaryBH.vy,
      mass: binaryBH.mass,
      radius: binaryBH.radius
    } : null,
    G,
    softening,
    zoom,
    bodies: bodies.slice(1).map(b => ({
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      mass: b.mass,
      radius: b.radius,
      baseHue: b.baseHue,
      type: b.type
    }))
  };
  try {
    localStorage.setItem("bh-sim-snapshot", JSON.stringify(snapshot));
  } catch (e) {
    console.warn("Could not save snapshot:", e);
  }
}

function loadSnapshot() {
  try {
    const raw = localStorage.getItem("bh-sim-snapshot");
    if (!raw) return;
    const snap = JSON.parse(raw);

    blackHole.x = snap.blackHole.x;
    blackHole.y = snap.blackHole.y;
    blackHole.vx = snap.blackHole.vx;
    blackHole.vy = snap.blackHole.vy;
    blackHole.mass = snap.blackHole.mass;
    blackHole.radius = snap.blackHole.radius;

    bodies.length = 0;
    bodies.push(blackHole);

    if (snap.binary) {
      binaryBH = {
        ...snap.binary,
        type: "bh"
      };
      binaryEnabled = true;
      bodies.push(binaryBH);
    } else {
      binaryBH = null;
      binaryEnabled = false;
    }

    G = snap.G ?? G;
    softening = snap.softening ?? softening;
    zoom = snap.zoom ?? zoom;

    gravSlider.value = Math.round(G * 100);
    gravVal.textContent = G.toFixed(2);
    softSlider.value = Math.round(softening);
    softVal.textContent = softening.toFixed(1);
    zoomSlider.value = Math.round(zoom * 100);
    zoomVal.textContent = zoom.toFixed(1) + "x";

    for (const b of snap.bodies) {
      bodies.push({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        mass: b.mass,
        radius: b.radius,
        baseHue: b.baseHue,
        trail: [],
        type: b.type || "planet"
      });
    }

    massHistory.length = 0;
    countHistory.length = 0;
  } catch (e) {
    console.warn("Could not load snapshot:", e);
  }
}

// ===== Metrics =====
let lastTime = performance.now();
let fps = 0;

function updateMetrics(dt) {
  const alpha = 0.05;
  const instFPS = 1 / dt;
  fps = fps === 0 ? instFPS : fps * (1 - alpha) + instFPS * alpha;

  if (!showDebugCheckbox.checked) {
    metricsDiv.innerHTML = "";
    physicsDiv.innerHTML = "";
    return;
  }

  metricsDiv.innerHTML = `
    <h3>Metrics</h3>
    <div class="mono">
      FPS: ${fps.toFixed(1)}<br>
      Bodies: ${bodies.length}<br>
      Gravity: ${G.toFixed(3)}<br>
      Integrator: ${useRK4Checkbox.checked ? "RK4" : "Euler"}<br>
      Gravity algo: ${useQuadCheckbox.checked ? "Barnes–Hut" : "Brute force"}<br>
      ε: ${softening.toFixed(1)} units<br>
      Binary BH: ${binaryEnabled ? "ON" : "OFF"}
    </div>
  `;

  const sample = bodies.find(b => b.type === "planet" || b.type === "comet");
  if (sample) updatePhysicsOverlay(sample);
}

// ===== Main Loop =====
function loop(now) {
  const dt = (now - lastTime) / 1000 || 0.016;
  lastTime = now;

  // fade background slightly
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();

  withCamera(() => {
    drawBlackHole();
    drawBodies();
    drawRepulsors();
    drawExplosions();
  });

  if (!paused) {
    update(dt);
  }

  updateMetrics(dt);
  drawTelemetry();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
