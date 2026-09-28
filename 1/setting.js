// Setting: one cloud of points that takes six forms. Each form keeps a law of
// its own; the hand reaches into all of them alike. Points part around it and
// swing after it, a press holds, and a click sends a ring through the cloud.
// While a form is shown, a plate takes a long exposure of a few of its points.
// Once a form has had a few seconds of the visitor's time it is on file, and
// the profile shows its plate. Time here runs only while the page is in
// view, and every form is kept as it was left for the rest of the visit.

import { FILED, given, onSecond, plates, record, reduceMotion, save } from './site.js';

const N = 2800;
const TAU = Math.PI * 2;

const main = document.querySelector('main');
const canvas = main.querySelector('.field');
const ctx = canvas.getContext('2d');
const stage = main.querySelector('.stage');
const arc = stage.querySelector('.arc');
const reticle = main.querySelector('.reticle');
const links = [...document.querySelectorAll('.entries a')];
const ids = links.map((link) => link.hash.slice(1));
const defs = new Map(ids.map((id) => [id, document.getElementById(id)]));
const pager = main.querySelector('.defs .pager');
const aside = main.querySelector('#twin .aside');

const mod = (value, m) => ((value % m) + m) % m;
const wrap = (angle) => mod(angle + Math.PI, TAU) - Math.PI;
const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

// State that outlives the page is written as text.
const pack = (array) => btoa(String.fromCharCode(...new Uint8Array(array.buffer, array.byteOffset, array.byteLength)));
const unpack = (text, Type) => new Type(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)).buffer);

// The same visit always gets the same cloud, so what was done to a form can
// be laid back on the same points after the page has been left.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seeded(Number(record.no) * 42 + 1);
const a = Float32Array.from({ length: N }, random);
const b = Float32Array.from({ length: N }, random);
const gx = new Float32Array(N);
const gy = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const r = Math.sqrt(-2 * Math.log(1 - random()));
  const t = random() * TAU;
  gx[i] = r * Math.cos(t);
  gy[i] = r * Math.sin(t);
}

// Where each point is, how it moves, where its form wants it, and its ink:
// 0 white, 1 blue, 2 gold, 3 faint, 4 not drawn.
const x = Float32Array.from(gx, (v) => v * 0.3);
const y = Float32Array.from(gy, (v) => v * 0.3);
const vx = new Float32Array(N);
const vy = new Float32Array(N);
const tx = new Float32Array(N);
const ty = new Float32Array(N);
const tone = new Uint8Array(N);

// The hand, in the cloud's own units: where it is (eased), how fast it
// moves, how present it is, and whether it presses.
const hand = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, on: false, amount: 0, down: false };
const FIELD = 0.46; // its reach
const PUSH = 26; // how hard it parts the cloud
const DRAG = [4, 11]; // how much of its own motion it hands on, free and pressed
const RING = { speed: 2.6, band: 0.16, life: 1.3, kick: 70 };
const rings = [];

// World time: it runs only while the page is in view.
let world = 0;
// Seconds since the current form was shown. Points travel to it on soft
// springs at first, so one form turns into the next instead of snapping.
let since = 0;

/* The forms. Each has springs of its own (K, D), and may keep state, turn
   the hand's movement into that state (step), place every point (targets),
   answer a click (tap), and be written down and read back (save, load). */

// A dial: the hand writes down the ring as it passes. Whatever shape the
// ring is in at that moment is kept, a little less each turn after.
const ON_RING = Math.round(N * 0.8);
const dial = {
  K: 42,
  D: 7.5,
  hand: -Math.PI / 2,
  kx: new Float32Array(ON_RING),
  ky: new Float32Array(ON_RING),
  step(dt) {
    const before = this.hand;
    this.hand += (TAU / 12) * dt;
    const swept = this.hand - before;
    if (since > 1.2) {
      for (let i = 0; i < ON_RING; i++) {
        const angle = a[i] * TAU;
        if (mod(this.hand - angle, TAU) >= swept) continue;
        const radius = 0.8 + gx[i] * 0.012;
        let dx = (x[i] - Math.cos(angle) * radius) * 0.92;
        let dy = (y[i] - Math.sin(angle) * radius) * 0.92;
        const size = Math.hypot(dx, dy);
        if (size > 0.42) {
          dx *= 0.42 / size;
          dy *= 0.42 / size;
        }
        this.kx[i] = dx;
        this.ky[i] = dy;
      }
    }
    this.hand = mod(this.hand + Math.PI / 2, TAU) - Math.PI / 2;
  },
  targets() {
    for (let i = 0; i < ON_RING; i++) {
      const angle = a[i] * TAU;
      const radius = 0.8 + gx[i] * 0.012;
      tx[i] = Math.cos(angle) * radius + this.kx[i];
      ty[i] = Math.sin(angle) * radius + this.ky[i];
      tone[i] = mod(this.hand - angle, TAU) < 0.45 ? 1 : Math.abs(this.kx[i]) + Math.abs(this.ky[i]) > 0.045 ? 2 : 0;
    }
    for (let i = ON_RING; i < N; i++) {
      const r = 0.05 + 0.7 * b[i];
      tx[i] = Math.cos(this.hand) * r + gx[i] * 0.008;
      ty[i] = Math.sin(this.hand) * r + gy[i] * 0.008;
      tone[i] = 0;
    }
  },
  save() {
    return { hand: this.hand, kx: pack(this.kx), ky: pack(this.ky) };
  },
  load(state) {
    this.hand = state.hand;
    this.kx = unpack(state.kx, Float32Array);
    this.ky = unpack(state.ky, Float32Array);
  },
};

// An eddy: a hand moving round it drives the band it crosses towards its
// own speed, a still hand stills it, and what was stirred keeps turning,
// spreading to the bands beside it, for a long while after.
const BANDS = 44;
const EDGE = 1.15;
const orbit = Float32Array.from({ length: N }, (_, i) => Math.min(Math.hypot(gx[i], gy[i]) * 0.32, 1.05));
const drift = (r) => 0.5 * (1.1 - Math.min(r, 1));
const eddy = {
  K: 16,
  D: 4.5,
  phi: Float32Array.from(a, (v) => v * TAU),
  omega: new Float32Array(BANDS),
  scratch: new Float32Array(BANDS),
  at(r) {
    const f = (r / EDGE) * BANDS - 0.5;
    const k = clamp(Math.floor(f), 0, BANDS - 2);
    const w = clamp(f - k, 0, 1);
    return this.omega[k] * (1 - w) + this.omega[k + 1] * w;
  },
  step(dt) {
    if (hand.amount > 0.05) {
      const rp = Math.hypot(hand.x, hand.y);
      if (rp > 0.05 && rp < EDGE) {
        const turning = (hand.x * hand.vy - hand.y * hand.vx) / (rp * rp);
        const grip = (hand.down ? 7 : 1.6) * hand.amount;
        for (let k = 0; k < BANDS; k++) {
          const rk = ((k + 0.5) / BANDS) * EDGE;
          const w = Math.exp(-(((rk - rp) / 0.1) ** 2));
          if (w < 0.01) continue;
          const goal = clamp(turning - drift(rk), -7, 7);
          this.omega[k] += (goal - this.omega[k]) * (1 - Math.exp(-grip * w * dt));
        }
      }
    }
    const fade = Math.exp(-dt / 22);
    for (let k = 0; k < BANDS; k++) {
      const left = this.omega[Math.max(k - 1, 0)];
      const right = this.omega[Math.min(k + 1, BANDS - 1)];
      this.scratch[k] = (this.omega[k] + 2.5 * dt * (left + right - 2 * this.omega[k])) * fade;
    }
    this.omega.set(this.scratch);
    for (let i = 0; i < N; i++) this.phi[i] = (this.phi[i] + (drift(orbit[i]) + this.at(orbit[i])) * dt) % TAU;
  },
  targets() {
    for (let i = 0; i < N; i++) {
      const r = orbit[i];
      tx[i] = Math.cos(this.phi[i]) * r;
      ty[i] = Math.sin(this.phi[i]) * r;
      const stirred = Math.abs(this.at(r));
      tone[i] = stirred > 2.4 || a[i] > 0.985 ? 2 : stirred > 0.7 || a[i] < 0.06 ? 1 : 0;
    }
  },
  tap(px, py) {
    const rp = Math.hypot(px, py);
    for (let k = 0; k < BANDS; k++) {
      const rk = ((k + 0.5) / BANDS) * EDGE;
      this.omega[k] = clamp(this.omega[k] + 2.5 * Math.exp(-(((rk - rp) / 0.12) ** 2)), -7, 7);
    }
  },
  save() {
    return { phi: pack(this.phi), omega: pack(this.omega) };
  },
  load(state) {
    this.phi = unpack(state.phi, Float32Array);
    this.omega = unpack(state.omega, Float32Array);
  },
};

// A swell: five rings, never flat. The hand pushes each ring away from
// itself where it crosses it, and the waves it makes run round and keep
// running, passing into the rings beside them, slow to die down.
const RINGS = 5;
const SAMPLES = 120;
const swell = {
  K: 46,
  D: 8,
  u: new Float32Array(RINGS * SAMPLES),
  w: new Float32Array(RINGS * SAMPLES),
  clock: 0,
  radius: (k) => 0.18 + 0.15 * k,
  height(k, angle) {
    const f = mod(angle / TAU, 1) * SAMPLES;
    const j = Math.floor(f) % SAMPLES;
    const w = f - Math.floor(f);
    return this.u[k * SAMPLES + j] * (1 - w) + this.u[k * SAMPLES + ((j + 1) % SAMPLES)] * w;
  },
  kick(k, angle, amount) {
    const centre = Math.round(mod(angle / TAU, 1) * SAMPLES);
    for (let d = -5; d <= 5; d++) this.w[k * SAMPLES + mod(centre + d, SAMPLES)] += amount * Math.exp(-(d * d) / 6);
  },
  step(dt) {
    this.clock += dt;
    if (hand.amount > 0.05) {
      const rp = Math.hypot(hand.x, hand.y);
      const ap = Math.atan2(hand.y, hand.x);
      const speed = Math.min(Math.hypot(hand.vx, hand.vy), 4);
      for (let k = 0; k < RINGS; k++) {
        const d = rp - (this.radius(k) + this.height(k, ap));
        if (Math.abs(d) > 0.14) continue;
        const f = (1 - Math.abs(d) / 0.14) ** 2 * (0.5 + speed) * (hand.down ? 2.4 : 1) * hand.amount;
        this.kick(k, ap, -Math.sign(d) * f * 3 * dt);
      }
    }
    const steps = Math.ceil(dt * 120);
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let k = 0; k < RINGS; k++) {
        for (let j = 0; j < SAMPLES; j++) {
          const i = k * SAMPLES + j;
          const u = this.u[i];
          const along = this.u[k * SAMPLES + ((j + 1) % SAMPLES)] + this.u[k * SAMPLES + ((j + SAMPLES - 1) % SAMPLES)] - 2 * u;
          const across = (k > 0 ? this.u[i - SAMPLES] : u) + (k < RINGS - 1 ? this.u[i + SAMPLES] : u) - 2 * u;
          this.w[i] += (900 * along + 40 * across - 0.07 * this.w[i] - 0.5 * u) * h;
        }
      }
      for (let i = 0; i < this.u.length; i++) this.u[i] = clamp(this.u[i] + this.w[i] * h, -0.3, 0.3);
    }
  },
  targets() {
    const t = this.clock;
    for (let i = 0; i < N; i++) {
      const k = i % RINGS;
      const angle = a[i] * TAU;
      const lift = this.height(k, angle);
      const r = this.radius(k) + 0.06 * Math.sin(3 * angle + t * 1.3 + k) + 0.03 * Math.sin(5 * angle - t * 0.9) + lift;
      tx[i] = Math.cos(angle) * r;
      ty[i] = Math.sin(angle) * r;
      tone[i] = lift > 0.02 ? 2 : lift < -0.02 ? 1 : 0;
    }
  },
  tap(px, py) {
    const rp = Math.hypot(px, py);
    const ap = Math.atan2(py, px);
    for (let k = 0; k < RINGS; k++) {
      const d = rp - this.radius(k);
      this.kick(k, ap, -Math.sign(d) * 1.4 * Math.exp(-((d / 0.35) ** 2)));
    }
  },
  save() {
    return { u: pack(this.u), w: pack(this.w), clock: this.clock };
  },
  load(state) {
    this.u = unpack(state.u, Float32Array);
    this.w = unpack(state.w, Float32Array);
    this.clock = state.clock;
  },
};

// Weight: four holdings, and loose dust around them. Holding one down gives
// it weight: dust streams in to it, and when the dust is gone, some of the
// heaviest of the others. None of them is ever emptied.
const CENTRES = [[-0.42, -0.2], [0.42, -0.36], [-0.18, 0.46], [0.5, 0.34]];
const DUST = 4;
const weight = {
  K: 11,
  D: 3.6,
  curl: 2.4,
  owner: new Uint8Array(N),
  count: new Uint16Array(5),
  clock: 0,
  held: -1,
  heldFor: 0,
  carry: 0,
  cursor: 0,
  reset() {
    const shares = [0.34, 0.26, 0.24, 0.16];
    for (let i = 0; i < N; i++) {
      let pick = a[i];
      let c = 0;
      while (c < 3 && pick > shares[c]) pick -= shares[c++];
      this.owner[i] = b[i] > 0.62 ? DUST : c;
    }
    this.recount();
  },
  recount() {
    this.count.fill(0);
    for (const c of this.owner) this.count[c]++;
  },
  spread(c) {
    return 0.05 + 0.3 * Math.sqrt(this.count[c] / N);
  },
  under(px, py) {
    for (let c = 0; c < 4; c++) if (Math.hypot(px - CENTRES[c][0], py - CENTRES[c][1]) < this.spread(c) * 1.6 + 0.08) return c;
    return -1;
  },
  next(c) {
    for (let step = 0; step < N; step++) {
      this.cursor = (this.cursor + 1) % N;
      if (this.owner[this.cursor] === c) return this.cursor;
    }
    return -1;
  },
  grow(c, n) {
    for (let k = 0; k < n; k++) {
      let i = this.count[DUST] ? this.next(DUST) : -1;
      if (i < 0) {
        let from = -1;
        for (let o = 0; o < 4; o++) if (o !== c && this.count[o] > N * 0.05 && (from < 0 || this.count[o] > this.count[from])) from = o;
        if (from < 0) return;
        i = this.next(from);
      }
      this.count[this.owner[i]]--;
      this.owner[i] = c;
      this.count[c]++;
    }
  },
  step(dt) {
    this.clock += dt;
    this.held = hand.down && hand.amount > 0.5 ? this.under(hand.x, hand.y) : -1;
    if (this.held < 0) {
      this.heldFor = 0;
      this.carry = 0;
      return;
    }
    this.heldFor += dt;
    this.carry += (70 + 140 * Math.min(this.heldFor, 2)) * dt;
    const n = Math.floor(this.carry);
    this.carry -= n;
    this.grow(this.held, n);
  },
  targets() {
    const t = this.clock;
    const turn = t * 0.03;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    for (let i = 0; i < N; i++) {
      const c = this.owner[i];
      if (c === DUST) {
        tx[i] = (gx[i] * cos - gy[i] * sin) * 0.5;
        ty[i] = (gx[i] * sin + gy[i] * cos) * 0.5;
        tone[i] = 3;
        continue;
      }
      const s = this.spread(c);
      tx[i] = CENTRES[c][0] + gx[i] * s + Math.sin(t * 0.7 + c) * 0.02;
      ty[i] = CENTRES[c][1] + gy[i] * s + Math.cos(t * 0.6 + c) * 0.02;
      tone[i] = c === this.held ? 2 : c === 1 ? 1 : 0;
    }
  },
  tap(px, py) {
    const c = this.under(px, py);
    if (c >= 0) this.grow(c, 40);
  },
  save() {
    return { owner: pack(this.owner), clock: this.clock };
  },
  load(state) {
    this.owner = unpack(state.owner, Uint8Array);
    this.clock = state.clock;
    this.recount();
  },
};

// Exchange: two bodies, sending points to each other along arcs. Whatever
// arrives is kept, and answered with more than came: new points, out of
// what neither had yet. So both grow. Holding a body down makes it send.
const BODIES = [-0.52, 0.52];
const OFFER = 0;
const ANSWER = 1;
const exchange = {
  K: 18,
  D: 4.6,
  role: new Uint8Array(N), // 0, 1: in that body; 2: on the way; 3: not yet anyone's
  from: new Uint8Array(N),
  kind: new Uint8Array(N),
  s: new Float32Array(N),
  count: new Uint16Array(4),
  owed: [0, 0],
  clock: 0,
  beat: 0,
  flow: 0,
  cursor: 0,
  reset() {
    for (let i = 0; i < N; i++) this.role[i] = b[i] < 0.22 ? 0 : b[i] < 0.44 ? 1 : 3;
    this.recount();
  },
  recount() {
    this.count.fill(0);
    for (const role of this.role) this.count[role]++;
  },
  spread(c) {
    return 0.05 + 0.32 * Math.sqrt(this.count[c] / N);
  },
  under(px, py) {
    for (let c = 0; c < 2; c++) if (Math.hypot(px - BODIES[c], py) < this.spread(c) * 1.8 + 0.08) return c;
    return -1;
  },
  next(role) {
    for (let step = 0; step < N; step++) {
      this.cursor = (this.cursor + 1) % N;
      if (this.role[this.cursor] === role) return this.cursor;
    }
    return -1;
  },
  send(c, kind) {
    // An answer is new: it comes out of the reserve, at the body that gives it.
    let i = kind === ANSWER && this.count[3] ? this.next(3) : -1;
    if (i >= 0) {
      x[i] = BODIES[c] + gx[i] * 0.04;
      y[i] = gy[i] * 0.04;
      vx[i] = vy[i] = 0;
    } else i = this.next(c);
    if (i < 0) return;
    this.count[this.role[i]]--;
    this.role[i] = 2;
    this.count[2]++;
    this.from[i] = c;
    this.kind[i] = kind;
    this.s[i] = 0;
  },
  step(dt) {
    this.clock += dt;
    this.beat += dt;
    if (this.beat > 0.4) {
      this.beat -= 0.4;
      this.send(0, OFFER);
      this.send(1, OFFER);
    }
    const c = hand.down && hand.amount > 0.5 ? this.under(hand.x, hand.y) : -1;
    if (c >= 0) {
      this.flow += 36 * dt;
      for (; this.flow >= 1; this.flow--) this.send(c, OFFER);
    } else this.flow = 0;
    for (let i = 0; i < N; i++) {
      if (this.role[i] !== 2) continue;
      this.s[i] += dt * (0.36 + 0.1 * a[i]);
      if (this.s[i] < 1) continue;
      const to = 1 - this.from[i];
      this.count[2]--;
      this.role[i] = to;
      this.count[to]++;
      if (this.kind[i] === OFFER) this.owed[to] += 1.3;
    }
    for (let k = 0; k < 2; k++) for (; this.owed[k] >= 1; this.owed[k]--) this.send(k, ANSWER);
  },
  targets() {
    for (let i = 0; i < N; i++) {
      const role = this.role[i];
      if (role < 2) {
        const s = this.spread(role);
        tx[i] = BODIES[role] + gx[i] * s;
        ty[i] = gy[i] * s;
        tone[i] = 0;
      } else if (role === 2) {
        const forward = this.from[i] === 0;
        const s = this.s[i];
        tx[i] = BODIES[0] + (forward ? s : 1 - s) * (BODIES[1] - BODIES[0]) + gx[i] * 0.012;
        ty[i] = Math.sin(Math.PI * s) * (0.3 + 0.16 * b[i]) * (forward ? -1 : 1) + gy[i] * 0.012;
        tone[i] = forward ? 1 : 2;
      } else {
        tx[i] = x[i];
        ty[i] = y[i];
        tone[i] = 4;
      }
    }
  },
  tap(px, py) {
    const c = this.under(px, py);
    if (c >= 0) for (let k = 0; k < 24; k++) this.send(c, OFFER);
  },
  save() {
    return { role: pack(this.role), from: pack(this.from), kind: pack(this.kind), s: pack(this.s), owed: this.owed, clock: this.clock };
  },
  load(state) {
    this.role = unpack(state.role, Uint8Array);
    this.from = unpack(state.from, Uint8Array);
    this.kind = unpack(state.kind, Uint8Array);
    this.s = unpack(state.s, Float32Array);
    this.owed = state.owed;
    this.clock = state.clock;
    this.recount();
  },
};

// Twin: two arms wound together. Either can be pushed round, and the other
// keeps its distance, half a turn away. A press takes hold of an arm: it
// stays under the hand and grows, the other grows after it, and both settle
// back when let go. Hold one long enough, and the page asks what that would
// be for.
const twin = {
  K: 30,
  D: 6,
  // Each arm's turn, on top of the half turn that already sets them apart.
  phase: [0, 0],
  spin: [0, 0],
  size: [1, 1],
  grip: -1,
  pressing: 0,
  asked: 0,
  armAt(px, py) {
    const rp = Math.hypot(px, py);
    if (rp < 0.04 || rp > 0.9) return -1;
    const s = (rp - 0.06) / 0.74;
    const ap = Math.atan2(py, px);
    let arm = -1;
    let gap = 0.6;
    for (let k = 0; k < 2; k++) {
      const off = Math.abs(wrap(ap - (k * Math.PI + s * 3.3 * Math.PI + this.phase[k])));
      if (off < gap) {
        gap = off;
        arm = k;
      }
    }
    return arm;
  },
  step(dt) {
    if (!hand.down) this.grip = -1;
    else if (this.grip < 0 && hand.amount > 0.05) this.grip = this.armAt(hand.x, hand.y);
    const held = this.grip;
    const arm = held >= 0 ? held : hand.amount > 0.05 ? this.armAt(hand.x, hand.y) : -1;
    if (arm >= 0) {
      const rp = Math.max(Math.hypot(hand.x, hand.y), 0.05);
      const turning = clamp((hand.x * hand.vy - hand.y * hand.vx) / (rp * rp), -6, 6);
      // A held arm turns with the hand, and only with it.
      const goal = held >= 0 ? turning - 0.25 : turning;
      this.spin[arm] += (goal - this.spin[arm]) * (1 - Math.exp(-(held >= 0 ? 12 : 1.5) * hand.amount * dt));
    }
    // Pull one forward and the other follows, to stay half a turn apart.
    const apart = wrap(this.phase[1] - this.phase[0]);
    this.spin[0] += apart * 3 * dt;
    this.spin[1] -= apart * 3 * dt;
    for (let k = 0; k < 2; k++) {
      this.phase[k] = mod(this.phase[k] + (0.25 + this.spin[k]) * dt, TAU);
      this.spin[k] *= Math.exp(-dt / 2.5);
    }
    if (held >= 0) {
      this.pressing += dt;
      this.size[held] = Math.min(this.size[held] + 0.45 * dt, 1.7);
      this.size[1 - held] += (this.size[held] - this.size[1 - held]) * (1 - Math.exp(-0.9 * dt));
    } else {
      this.pressing = 0;
      for (let k = 0; k < 2; k++) this.size[k] += (1 - this.size[k]) * (1 - Math.exp(-dt / 5));
    }
    this.asked = this.pressing > 1.2 ? 7 : Math.max(this.asked - dt, 0);
    aside.classList.toggle('shown', this.asked > 0);
  },
  targets() {
    for (let i = 0; i < N; i++) {
      const k = i % 2;
      const s = a[i];
      const size = this.size[k];
      const r = 0.06 + 0.74 * s * (0.86 + 0.14 * size);
      const angle = k * Math.PI + s * 3.3 * Math.PI + this.phase[k];
      const thick = 0.018 * size * size;
      tx[i] = Math.cos(angle) * r + gx[i] * thick;
      ty[i] = Math.sin(angle) * r + gy[i] * thick;
      tone[i] = k;
    }
  },
  tap(px, py) {
    const k = this.armAt(px, py);
    if (k >= 0) this.spin[k] += 2.2;
  },
  save() {
    return { phase: this.phase, spin: this.spin, size: this.size };
  },
  load(state) {
    Object.assign(this, state);
  },
};

const FORMS = { dial, eddy, swell, weight, exchange, twin };
for (const [id, form] of Object.entries(FORMS)) {
  const state = record.forms[id]?.state;
  if (state) form.load(state);
  else form.reset?.();
}

/* Plates: a long exposure of every seventh point, drawn as the line it
   travelled each frame and added up, light on dark. One for each form,
   kept through the visit. */

const PLATE = 600;
const PLATE_SCALE = PLATE / 2.5;
const SAMPLE = 7;
const PLATE_INK = ['rgb(236 238 241 / 0.07)', 'rgb(58 134 255 / 0.1)', 'rgb(226 179 60 / 0.1)', 'rgb(236 238 241 / 0.025)'];
const lastX = new Float32Array(N);
const lastY = new Float32Array(N);
const surfaces = new Map();

async function plate(id) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = PLATE;
  const p = surface.getContext('2d');
  p.fillStyle = '#050608';
  p.fillRect(0, 0, PLATE, PLATE);
  const url = plates.get(id);
  if (url) {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      p.drawImage(image, 0, 0, PLATE, PLATE);
    } catch {}
  }
  p.globalCompositeOperation = 'lighter';
  p.lineWidth = 1.3;
  p.lineCap = 'square';
  surfaces.set(id, surface);
}
await Promise.all(ids.map(plate));

function expose() {
  const p = surfaces.get(current).getContext('2d');
  const half = PLATE / 2;
  for (let k = 0; k < 4; k++) {
    p.strokeStyle = PLATE_INK[k];
    p.beginPath();
    for (let i = 0; i < N; i += SAMPLE) {
      if (tone[i] !== k) continue;
      // A point that has just been made is not drawn coming from nowhere.
      if (Math.abs(x[i] - lastX[i]) + Math.abs(y[i] - lastY[i]) > 0.3) continue;
      p.moveTo(half + lastX[i] * PLATE_SCALE, half + lastY[i] * PLATE_SCALE);
      p.lineTo(half + x[i] * PLATE_SCALE, half + y[i] * PLATE_SCALE);
    }
    p.stroke();
  }
  remember();
}

function remember() {
  for (let i = 0; i < N; i += SAMPLE) {
    lastX[i] = x[i];
    lastY[i] = y[i];
  }
}

// Writes a form and its plate into the visit.
function keep(id) {
  const form = (record.forms[id] ??= { ms: 0, at: 0 });
  form.state = FORMS[id].save();
  if (form.ms >= FILED) plates.set(id, surfaces.get(id).toDataURL('image/jpeg', 0.9));
}

function mark() {
  for (const link of links) link.classList.toggle('filed', (record.forms[link.hash.slice(1)]?.ms ?? 0) >= FILED);
}

function account(ms) {
  const form = (record.forms[current] ??= { ms: 0, at: 0 });
  const before = form.ms;
  form.ms += ms;
  if (before < FILED && form.ms >= FILED) {
    form.at = given();
    mark();
    keep(current);
    save();
  }
}

/* Drawing. The cloud is drawn over the whole page; the form sits on the
   stage. A little of each frame is left behind, so fast points streak. */

let width = 0;
let height = 0;
let cx = 0;
let cy = 0;
let scale = 1;
const INK = ['rgb(236 238 241 / 0.88)', '#3a86ff', '#e2b33c', 'rgb(236 238 241 / 0.32)'];

function resize() {
  const rect = canvas.getBoundingClientRect();
  const box = stage.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  cx = box.left - rect.left + box.width / 2;
  cy = box.top - rect.top + box.height / 2;
  scale = Math.min(box.width, box.height) * 0.46;
  reticle.style.setProperty('--r', `${FIELD * 2 * scale}px`);
  if (reduceMotion.matches) still();
}

function draw(dt) {
  if (dt) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgb(0 0 0 / ${1 - Math.exp(-dt / 0.07)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  } else ctx.clearRect(0, 0, width, height);
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = INK[k];
    for (let i = 0; i < N; i++) if (tone[i] === k) ctx.fillRect(cx + x[i] * scale - 0.85, cy + y[i] * scale - 0.85, 1.7, 1.7);
  }
}

function physics(dt, form) {
  const ramp = Math.min(since / 0.9, 1);
  const K = form.K * (0.22 + 0.78 * ramp * ramp * (3 - 2 * ramp));
  const D = form.D;
  const curl = form.curl ?? 0;
  const push = PUSH * hand.amount;
  const drag = DRAG[hand.down ? 1 : 0] * hand.amount;
  const live = [];
  for (const ring of rings) {
    const age = world - ring.t;
    if (age < RING.life) live.push([ring.x, ring.y, RING.speed * age, RING.kick * (1 - age / RING.life) ** 2]);
  }
  for (let i = 0; i < N; i++) {
    let ax = K * (tx[i] - x[i]) - D * vx[i];
    let ay = K * (ty[i] - y[i]) - D * vy[i];
    if (push > 0) {
      const dx = x[i] - hand.x;
      const dy = y[i] - hand.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < FIELD * FIELD) {
        const d = Math.sqrt(d2) || 1e-4;
        const f = (1 - d / FIELD) ** 2;
        ax += (push * f * dx) / d + drag * f * (hand.vx - vx[i]);
        ay += (push * f * dy) / d + drag * f * (hand.vy - vy[i]);
      }
    }
    if (curl) {
      ax -= curl * vy[i];
      ay += curl * vx[i];
    }
    for (const [rx, ry, front, kick] of live) {
      const dx = x[i] - rx;
      const dy = y[i] - ry;
      const d = Math.hypot(dx, dy) || 1e-4;
      const off = Math.abs(d - front);
      if (off > RING.band) continue;
      const s = (1 - off / RING.band) * kick;
      ax += (s * dx) / d;
      ay += (s * dy) / d;
    }
    vx[i] += ax * dt;
    vy[i] += ay * dt;
    x[i] += vx[i] * dt;
    y[i] += vy[i] * dt;
  }
}

// The hand eases after the pointer (about 40 ms), and in or out of the
// cloud (about 180 ms); its speed is the eased point's.
function follow(dt) {
  const px = hand.x;
  const py = hand.y;
  const ease = 1 - Math.exp(-dt / 0.04);
  hand.x += (hand.tx - hand.x) * ease;
  hand.y += (hand.ty - hand.y) * ease;
  const blend = 1 - Math.exp(-dt / 0.05);
  hand.vx += ((hand.x - px) / dt - hand.vx) * blend;
  hand.vy += ((hand.y - py) / dt - hand.vy) * blend;
  hand.amount += ((hand.on ? 1 : 0) - hand.amount) * (1 - Math.exp(-dt / 0.18));
  if (!hand.on && hand.amount < 0.002) hand.amount = 0;
}

function tick(dt) {
  world += dt;
  since += dt;
  follow(dt);
  for (let k = rings.length - 1; k >= 0; k--) if (world - rings[k].t > RING.life) rings.splice(k, 1);
  const form = FORMS[current];
  form.step(dt);
  form.targets();
  physics(dt, form);
  draw(dt);
  if (since > 0.9) expose();
  else remember();
  account(dt * 1000);
  // Placed with translate, which applies after the press's scale, so the ring
  // tightens about its own centre rather than towards the page's corner.
  reticle.style.translate = `${cx + hand.x * scale}px ${cy + hand.y * scale}px`;
  reticle.classList.toggle('on', hand.amount > 0.3);
  reticle.classList.toggle('down', hand.down);
  arc.setAttribute('transform', `rotate(${(world * 22) % 360})`);
}

// Without motion each form is simply placed, as it stands, and its plate is
// a still of it rather than a long exposure.
const STILL_INK = ['rgb(236 238 241 / 0.75)', 'rgb(58 134 255 / 0.9)', 'rgb(226 179 60 / 0.9)', 'rgb(236 238 241 / 0.3)'];
function still() {
  const form = FORMS[current];
  form.targets();
  x.set(tx);
  y.set(ty);
  draw(0);
  const p = surfaces.get(current).getContext('2d');
  const half = PLATE / 2;
  p.globalCompositeOperation = 'source-over';
  p.fillStyle = '#050608';
  p.fillRect(0, 0, PLATE, PLATE);
  for (let k = 0; k < 4; k++) {
    p.fillStyle = STILL_INK[k];
    for (let i = 0; i < N; i++) if (tone[i] === k) p.fillRect(half + x[i] * PLATE_SCALE - 0.8, half + y[i] * PLATE_SCALE - 0.8, 1.6, 1.6);
  }
  p.globalCompositeOperation = 'lighter';
}

let current = null;

function show(id) {
  if (current === id) return;
  if (current) keep(current);
  if (current === 'twin') {
    twin.asked = 0;
    aside.classList.remove('shown');
  }
  current = id;
  since = 0;
  for (const link of links) link.setAttribute('aria-current', String(link.hash.slice(1) === id));
  defs.forEach((def, key) => def.classList.toggle('current', key === id));
  const n = ids.indexOf(id);
  pager.replaceChildren(
    Object.assign(document.createElement('span'), { className: 'label num', textContent: `${String(n + 1).padStart(2, '0')} / ${String(ids.length).padStart(2, '0')}` }),
    ...ids.map((_, k) => Object.assign(document.createElement('i'), { className: k === n ? 'on' : '' })),
  );
  remember();
  if (reduceMotion.matches) still();
}

for (const link of links) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    show(link.hash.slice(1));
    history.replaceState(null, '', link.hash);
  });
}

/* The hand. A mouse or a pen reaches in wherever it is over the page; a
   finger only taps, or holds after resting a moment, so the page still
   scrolls under it. A quick click, of either, sends a ring. */

let press = null;

function toCloud(event) {
  const rect = canvas.getBoundingClientRect();
  return [(event.clientX - rect.left - cx) / scale, (event.clientY - rect.top - cy) / scale];
}

function place([ux, uy], jump) {
  hand.tx = ux;
  hand.ty = uy;
  if (jump || hand.amount < 0.02) {
    hand.x = ux;
    hand.y = uy;
    hand.vx = hand.vy = 0;
  }
}

main.addEventListener('pointermove', (event) => {
  if (reduceMotion.matches) return;
  if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.moved = true;
  if (event.pointerType === 'touch' && !press?.holding) return;
  place(toCloud(event));
  hand.on = true;
});

main.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'touch') return;
  hand.on = false;
  hand.down = false;
});

main.addEventListener('pointerdown', (event) => {
  if (reduceMotion.matches || event.button !== 0 || event.target.closest('a, button')) return;
  const at = toCloud(event);
  press = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), at, moved: false, holding: false };
  if (event.pointerType !== 'touch') {
    hand.down = true;
    return;
  }
  press.timer = setTimeout(() => {
    if (!press || press.moved) return;
    press.holding = true;
    place(press.at, true);
    hand.on = true;
    hand.down = true;
  }, 450);
});

function release(event, cancelled) {
  if (!press || event.pointerId !== press.id) return;
  clearTimeout(press.timer);
  if (!cancelled && !press.moved && performance.now() - press.t < 320) {
    rings.push({ x: press.at[0], y: press.at[1], t: world });
    if (rings.length > 4) rings.shift();
    FORMS[current].tap?.(...press.at);
  }
  if (press.holding) hand.on = false;
  hand.down = false;
  press = null;
}
addEventListener('pointerup', (event) => release(event, false));
addEventListener('pointercancel', (event) => release(event, true));

/* Running: only while the cloud is on screen and the page in view. */

let onScreen = true;
let frame = 0;
let last = 0;

function loop(now) {
  frame = 0;
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  tick(dt);
  run();
}

function run() {
  if (reduceMotion.matches || !onScreen || document.visibilityState !== 'visible') {
    last = 0;
    return;
  }
  if (!frame) frame = requestAnimationFrame(loop);
}

new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  run();
}).observe(canvas);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    keep(current);
    save();
  }
  run();
});
addEventListener('pagehide', () => {
  keep(current);
  save();
});

// Without motion there is no loop, so time with a form is counted by the second.
let counted = given();
onSecond((ms) => {
  if (reduceMotion.matches && current && onScreen) account(ms - counted);
  counted = ms;
});

reduceMotion.addEventListener('change', () => {
  hand.on = false;
  hand.down = false;
  rings.length = 0;
  if (reduceMotion.matches) still();
  run();
});

new ResizeObserver(resize).observe(canvas);
new ResizeObserver(resize).observe(stage);

mark();
const initial = location.hash.slice(1);
show(defs.has(initial) ? initial : ids[0]);
run();
