// The soundtrack, synthesized: a calm pad in F at 96 BPM, a soft kick and hat
// once the story starts, and quiet sounds only on things that happen on screen.
// The cue times mirror index.html; change one and change the other.
//
//   node score.ts → out/score.wav

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 48000;
const DURATION = 46;
const N = Math.ceil(DURATION * RATE);
const TAU = Math.PI * 2;
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const OUT = join(import.meta.dirname, "out");

const DRUMS_IN = 8.0;
const DRUMS_OUT = 39.2;
const FADE_OUT = [43.5, 46] as const;

const CUES = {
  typeTitle: [1.85, 2.45, 13] as const,
  whoosh: [3.2, 7.6, 13.8, 22.4, 28.3, 34.0, 39.2],
  hook: [3.8, 4.6, 5.7],
  specs: [9.0, 9.55, 10.1, 10.65, 11.2],
  callouts: [15.4, 15.95, 16.5, 17.05],
  vercel: 18.2,
  typeCommand: [19.15, 19.9, 13] as const,
  click: 20.6,
  commentIn: [22.5, 34.0],
  drop: 23.4,
  fixes: 26.2,
  wipe: [29.8, 31.2] as const,
  checks: [31.5, 31.9, 32.3, 32.7],
  recovery: 34.9,
  count: [40.3, 41.4] as const,
  endLines: [41.2, 41.9, 42.6],
};

// Fmaj9 → Dm9 → B♭maj7 → C6/9, two bars each, held until the end card resolves on F.
const CHORDS = [
  { root: 41, notes: [57, 60, 64, 67] },
  { root: 38, notes: [53, 57, 60, 64] },
  { root: 46, notes: [58, 62, 65, 69] },
  { root: 48, notes: [55, 60, 64, 67] },
];

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647 - 0.5;
};
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

class Bus {
  l = new Float32Array(N);
  r = new Float32Array(N);
  add(i: number, v: number, pan = 0) {
    if (i < 0 || i >= N) return;
    const a = ((pan + 1) * Math.PI) / 4;
    this.l[i] += v * Math.cos(a);
    this.r[i] += v * Math.sin(a);
  }
}

const music = new Bus();
const fx = new Bus();
const verbSend = new Bus();

function tone(bus: Bus, start: number, dur: number, freq: number, opts: { gain: number; attack?: number; release?: number; pan?: number; partials?: number[]; send?: number; glide?: number }) {
  const s0 = Math.floor(start * RATE);
  const len = Math.floor((dur + (opts.release ?? 0.2)) * RATE);
  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? 0.2;
  const partials = opts.partials ?? [1];
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const t = k / RATE;
    const env = t < attack ? t / attack : t < dur ? 1 : Math.max(0, 1 - (t - dur) / release);
    const f = freq * (opts.glide ? 2 ** ((opts.glide * Math.min(t, dur)) / dur / 12) : 1);
    phase += (TAU * f) / RATE;
    let v = 0;
    partials.forEach((amp, p) => (v += amp * Math.sin(phase * (p + 1))));
    v *= env * opts.gain;
    bus.add(s0 + k, v, opts.pan ?? 0);
    if (opts.send) verbSend.add(s0 + k, v * opts.send, opts.pan ?? 0);
  }
}

function noise(bus: Bus, start: number, dur: number, opts: { gain: number; from: number; to: number; pan?: number; shape?: (x: number) => number; send?: number }) {
  // A one-pole low-pass whose cutoff sweeps, over white noise: air, not hiss.
  const s0 = Math.floor(start * RATE);
  const len = Math.floor(dur * RATE);
  let y = 0;
  for (let k = 0; k < len; k++) {
    const x = k / len;
    const cutoff = opts.from + (opts.to - opts.from) * x;
    const a = 1 - Math.exp((-TAU * cutoff) / RATE);
    y += a * (rand() * 2 - y);
    const env = (opts.shape ?? ((u) => Math.sin(Math.PI * u)))(x);
    const v = y * env * opts.gain;
    bus.add(s0 + k, v, opts.pan ?? 0);
    if (opts.send) verbSend.add(s0 + k, v * opts.send, opts.pan ?? 0);
  }
}

// The pad: detuned sines, slow attack, panned wide.
function pad() {
  const chordLen = BAR * 2;
  for (let start = 0, i = 0; start < 40.5; start += chordLen, i++) {
    const chord = CHORDS[i % CHORDS.length];
    chord.notes.forEach((m, n) => {
      for (const detune of [-0.06, 0.06]) {
        tone(music, start, chordLen, hz(m + detune), {
          gain: 0.028,
          attack: 1.2,
          release: 1.6,
          pan: (n / 3 - 0.5) * 1.2 * Math.sign(detune),
          partials: [1, 0.25, 0.08],
          send: 0.5,
        });
      }
    });
    tone(music, start, chordLen * 0.95, hz(chord.root), { gain: start < DRUMS_IN - 1 ? 0.05 : 0.09, attack: 0.08, release: 0.6, partials: [1, 0.3] });
  }
  // the resolve on F under the end card
  [53, 57, 60, 64, 67, 72].forEach((m, n) =>
    tone(music, 40.3, 4.2, hz(m), { gain: 0.03, attack: 0.9, release: 2.5, pan: (n / 5 - 0.5) * 1.4, partials: [1, 0.2], send: 0.7 }),
  );
  tone(music, 40.3, 4.5, hz(41), { gain: 0.08, attack: 0.3, release: 2, partials: [1, 0.3] });
}

function drums() {
  for (let t = DRUMS_IN; t < DRUMS_OUT; t += BEAT) {
    const beat = Math.round((t - DRUMS_IN) / BEAT) % 4;
    if (beat === 0 || beat === 2) {
      // a soft kick: a sine dropping from 110 to 45 Hz
      const s0 = Math.floor(t * RATE);
      let phase = 0;
      for (let k = 0; k < 0.35 * RATE; k++) {
        const u = k / RATE;
        phase += (TAU * (45 + 65 * Math.exp(-u * 30))) / RATE;
        music.add(s0 + k, Math.sin(phase) * Math.exp(-u * 9) * 0.22);
      }
    }
    if (beat === 1 || beat === 3) noise(music, t, 0.18, { gain: 0.05, from: 2500, to: 1800, shape: (x) => Math.exp(-x * 6), pan: 0.1, send: 0.2 });
    for (const off of [0, BEAT / 2]) {
      noise(music, t + off + (off ? 0.03 : 0), 0.05, { gain: off ? 0.022 : 0.03, from: 9000, to: 9000, shape: (x) => Math.exp(-x * 9), pan: 0.35 });
    }
  }
}

const tick = (t: number, pitch = 2400, gain = 0.05, pan = 0) => {
  noise(fx, t, 0.03, { gain: gain * 1.4, from: 6000, to: 4000, shape: (x) => Math.exp(-x * 8), pan });
  tone(fx, t, 0.02, pitch, { gain, attack: 0.001, release: 0.05, pan });
};

function sounds() {
  // the intro shimmer: a high cluster swelling into the octagon
  [84, 88, 91, 96].forEach((m, n) => tone(fx, 0.2 + n * 0.12, 1.9, hz(m), { gain: 0.012, attack: 1.4, release: 0.8, pan: n % 2 ? 0.5 : -0.5, send: 1 }));
  const typing = (from: number, to: number, count: number, gain: number) => {
    for (let n = 0; n < count; n++) {
      tick(from + ((to - from) * n) / count + rand() * 0.012, 1700 + rand() * 500, gain, rand() * 0.4);
    }
  };
  typing(...CUES.typeTitle, 0.035);
  CUES.whoosh.forEach((t, n) => noise(fx, t - 0.15, 0.6, { gain: 0.09, from: 300, to: 3500, pan: n % 2 ? 0.3 : -0.3, send: 0.4 }));
  CUES.hook.forEach((t) => tick(t, 1200, 0.04));
  CUES.specs.forEach((t, n) => tick(t, 1500 + n * 120, 0.04));
  // off brand: a muted low minor second
  CUES.callouts.forEach((t) => {
    tone(fx, t, 0.16, hz(50), { gain: 0.07, attack: 0.005, release: 0.18, partials: [1, 0.5, 0.2] });
    tone(fx, t + 0.04, 0.12, hz(51), { gain: 0.05, attack: 0.005, release: 0.18, partials: [1, 0.4] });
  });
  // preview ready
  tone(fx, CUES.vercel, 0.5, hz(84), { gain: 0.04, attack: 0.002, release: 0.9, partials: [1, 0, 0.3], send: 0.8 });
  tone(fx, CUES.vercel + 0.09, 0.5, hz(91), { gain: 0.03, attack: 0.002, release: 0.9, send: 0.8 });
  typing(...CUES.typeCommand, 0.05);
  // the click
  noise(fx, CUES.click, 0.04, { gain: 0.16, from: 4000, to: 1500, shape: (x) => Math.exp(-x * 7) });
  tone(fx, CUES.click, 0.03, 900, { gain: 0.06, attack: 0.001, release: 0.04 });
  CUES.commentIn.forEach((t) => noise(fx, t, 0.5, { gain: 0.06, from: 2000, to: 500, send: 0.3 }));
  // the drop: a low tone falling a fifth
  tone(fx, CUES.drop, 0.7, hz(45), { gain: 0.12, attack: 0.01, release: 0.6, partials: [1, 0.4], glide: -7, send: 0.4 });
  tick(CUES.fixes, 1300, 0.04);
  noise(fx, CUES.wipe[0], CUES.wipe[1] - CUES.wipe[0], { gain: 0.07, from: 600, to: 6000, pan: 0, send: 0.4 });
  // the checks: up the F major scale
  CUES.checks.forEach((t, n) => tone(fx, t, 0.22, hz([72, 74, 76, 79][n]), { gain: 0.035, attack: 0.003, release: 0.5, partials: [1, 0, 0.25], pan: n / 3 - 0.5, send: 0.7 }));
  // the recovery: a bright major chime
  [77, 81, 84, 89].forEach((m, n) => tone(fx, CUES.recovery + n * 0.05, 0.6, hz(m), { gain: 0.03, attack: 0.002, release: 1.4, partials: [1, 0, 0.2], pan: n / 3 - 0.5, send: 0.9 }));
  // the count up: an arpeggio rising with the number
  const [c0, c1] = CUES.count;
  [65, 69, 72, 76, 77, 81].forEach((m, n) => tone(fx, c0 + ((c1 - c0) * n) / 6, 0.25, hz(m), { gain: 0.03, attack: 0.002, release: 0.4, send: 0.7, pan: (n / 5 - 0.5) * 0.8 }));
  CUES.endLines.forEach((t) => tick(t, 1100, 0.035));
}

// A small stereo reverb: four combs and two all-passes per side.
function reverb(input: Bus): Bus {
  const out = new Bus();
  const run = (src: Float32Array, dst: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
    const passes = [556, 441].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let k = 0; k < N; k++) {
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * 0.75 + c.store * 0.25;
        c.buf[c.i] = src[k] + c.store * 0.82;
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (const p of passes) {
        const b = p.buf[p.i];
        const y = -acc + b;
        p.buf[p.i] = acc + b * 0.5;
        p.i = (p.i + 1) % p.buf.length;
        acc = y;
      }
      dst[k] = acc * 0.18;
    }
  };
  run(input.l, out.l, 0);
  run(input.r, out.r, 23);
  return out;
}

function writeWav(path: string, l: Float32Array, r: Float32Array) {
  const data = Buffer.alloc(N * 4);
  for (let k = 0; k < N; k++) {
    data.writeInt16LE(Math.round(clamp(l[k], -1, 1) * 32767), k * 4);
    data.writeInt16LE(Math.round(clamp(r[k], -1, 1) * 32767), k * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

pad();
drums();
sounds();
const verb = reverb(verbSend);

const l = new Float32Array(N);
const r = new Float32Array(N);
let peak = 0;
for (let k = 0; k < N; k++) {
  const t = k / RATE;
  const fade = clamp(t / 0.4) * (1 - clamp((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0])));
  l[k] = (music.l[k] + fx.l[k] + verb.l[k]) * fade;
  r[k] = (music.r[k] + fx.r[k] + verb.r[k]) * fade;
  peak = Math.max(peak, Math.abs(l[k]), Math.abs(r[k]));
}
// Normalise to -1 dBFS so the mix is as loud as it can be without clipping.
const gain = 0.89 / peak;
for (let k = 0; k < N; k++) {
  l[k] *= gain;
  r[k] *= gain;
}
mkdirSync(OUT, { recursive: true });
writeWav(join(OUT, "score.wav"), l, r);
console.log(`Wrote ${join(OUT, "score.wav")} (peak gain ${gain.toFixed(2)})`);
