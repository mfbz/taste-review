// The soundtrack, synthesized: upbeat and bright, 120 BPM in F. A punchy kick,
// claps on two and four, off-beat hats, a plucked bass in eighths, piano stabs
// and a plucked lead hook, with the pads pumping against the kick. It builds
// through the intro, the groove lands with the brand, the drums drop out for a
// bar when the score falls to 0.35, slam back for the fixes, peak on the
// recovery and end on one hit. The only other sounds are the keystrokes and the
// click on screen. Sections are written in scene time and placed through
// timeline.js, the same timeline the picture uses.
//
//   node score.ts → out/score.wav

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

type Timeline = { VIDEO_TOTAL: number; videoTimeOf: (t: number) => number };

const sandbox: { TIMELINE?: Timeline } = {};
runInNewContext(readFileSync(join(import.meta.dirname, "timeline.js"), "utf8"), Object.assign(sandbox, { globalThis: sandbox }));
const TL = sandbox.TIMELINE as Timeline;

const RATE = 48000;
const DURATION = Math.ceil(TL.VIDEO_TOTAL * 10) / 10;
const N = Math.ceil(DURATION * RATE);
const TAU = Math.PI * 2;
const OUT = join(import.meta.dirname, "out");
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const SIXTEENTH = BEAT / 4;

// The bar grid is shifted so a bar starts exactly on the drop (0.35 landing on screen);
// every other section snaps to the nearest bar of that grid.
const OFFSET = (TL.videoTimeOf(22.4) % BAR) - BAR;
const barStart = (b: number) => OFFSET + b * BAR;
const bar = (scene: number) => Math.round((TL.videoTimeOf(scene) - OFFSET) / BAR);
const SECTIONS = {
  hook: bar(3.5),
  groove: bar(8.0),
  drop: bar(22.4),
  fixes: bar(22.4) + 1,
  recovery: bar(34.0),
  end: bar(39.3),
  finalHit: bar(42.0),
};
const BARS = Math.floor((DURATION - OFFSET) / BAR);

// I–vi–IV–V in F, one chord a bar; the drop sits on D minor.
const LOOP = [
  { root: 41, tones: [57, 60, 64, 65, 69] },
  { root: 38, tones: [57, 60, 62, 65, 69] },
  { root: 46, tones: [58, 62, 65, 69, 70] },
  { root: 48, tones: [55, 60, 64, 67, 72] },
];
const D_MINOR = LOOP[1];
const F_MAJOR = LOOP[0];

const TYPE_COMMAND = [19.15, 19.9, 13] as const;
const CLICK = 20.6;

let seed = 17;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647 - 0.5;
};
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const chordOfBar = (b: number) => (b === SECTIONS.drop ? D_MINOR : b >= SECTIONS.finalHit ? F_MAJOR : LOOP[b % 4]);

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

const drums = new Bus();
const music = new Bus();
const send = new Bus();
const duck = new Float32Array(N).fill(1);

function noiseHit(bus: Bus, time: number, length: number, decay: number, gain: number, bright: number, pan = 0, sendAmount = 0) {
  // white noise through a one-pole high-pass: brighter as `bright` rises toward 1
  const s0 = Math.floor(time * RATE);
  let prev = 0;
  let hp = 0;
  for (let k = 0; k < length * RATE; k++) {
    const x = rand() * 2;
    hp = bright * (hp + x - prev);
    prev = x;
    const v = hp * Math.exp(-k / (decay * RATE)) * gain;
    bus.add(s0 + k, v, pan);
    if (sendAmount) send.add(s0 + k, v * sendAmount, -pan);
  }
}

function kick(time: number, gain: number) {
  const s0 = Math.floor(time * RATE);
  let phase = 0;
  for (let k = 0; k < 0.32 * RATE; k++) {
    const t = k / RATE;
    phase += (TAU * (48 + 110 * Math.exp(-t * 32))) / RATE;
    drums.add(s0 + k, Math.sin(phase) * Math.exp(-t * 7.5) * gain);
  }
  noiseHit(drums, time, 0.008, 0.002, gain * 0.5, 0.6);
  // the pumping: everything but the drums ducks under the kick
  for (let k = 0; k < 0.3 * RATE; k++) {
    const i = s0 + k;
    if (i < N) duck[i] = Math.min(duck[i], 1 - 0.55 * Math.exp(-k / (0.09 * RATE)));
  }
}

function clap(time: number, gain: number) {
  for (const [offset, g] of [
    [0, 0.6],
    [0.011, 0.75],
    [0.022, 1],
  ]) {
    noiseHit(drums, time + offset, offset === 0.022 ? 0.22 : 0.012, offset === 0.022 ? 0.05 : 0.004, gain * g, 0.85, 0, 0.35);
  }
}

// A felt-ish piano, used short for the stabs and long for the hits.
function piano(time: number, midi: number, velocity: number, ring = 1) {
  const f0 = hz(midi);
  const s0 = Math.floor(time * RATE);
  const decay = clamp(1.5 - (midi - 40) / 50, 0.4, 1.5) * ring;
  const pan = clamp((midi - 62) / 26, -0.6, 0.6);
  const partials = Array.from({ length: 9 }, (_, k) => ({
    f: f0 * (k + 1) * Math.sqrt(1 + 0.0003 * (k + 1) ** 2),
    amp: (1 / (k + 1) ** 1.15) * Math.exp(-(k + 1) * (1 - velocity) * 0.45),
    tau: (2.4 * decay) / (1 + (k + 1) * 0.35),
    phase: rand() * TAU,
  })).filter((p) => p.f < 10000);
  for (let k = 0; k < Math.min(6, 5 * decay) * RATE; k++) {
    const t = k / RATE;
    let v = 0;
    for (const p of partials) v += p.amp * Math.exp(-t / p.tau) * Math.sin(TAU * p.f * t + p.phase);
    v *= Math.min(1, t / 0.004) * velocity * 0.2;
    music.add(s0 + k, v, pan);
    send.add(s0 + k, v * 0.35, -pan);
  }
}

// A plucked tone: a bright attack that closes fast, for the bass and the lead.
function pluck(time: number, midi: number, gain: number, decay: number, harmonics: number, pan = 0, sendAmount = 0.2) {
  const f0 = hz(midi);
  const s0 = Math.floor(time * RATE);
  for (let k = 0; k < decay * 5 * RATE; k++) {
    const t = k / RATE;
    let v = 0;
    for (let n = 1; n <= harmonics; n++) v += (Math.sin(TAU * f0 * n * t) / n) * Math.exp(-t / (decay / n ** 0.6));
    v *= Math.min(1, t / 0.003) * gain;
    music.add(s0 + k, v, pan);
    if (sendAmount) send.add(s0 + k, v * sendAmount, -pan);
  }
}

// A soft pad: detuned band-limited saws, slow attack, under everything.
const TABLE = (() => {
  const size = 4096;
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let v = 0;
    for (let n = 1; n <= 12; n++) v += (Math.sin((TAU * n * i) / size) / n) * Math.exp(-n * 0.22);
    table[i] = v * 0.6;
  }
  return table;
})();

function pad(start: number, end: number, midi: number, gain: number, pan: number) {
  const s0 = Math.floor(start * RATE);
  const held = end - start;
  const length = Math.floor((held + 0.6) * RATE);
  const f0 = hz(midi);
  const voices = [-0.005, 0.005].map((d) => ({ ratio: 1 + d, phase: Math.abs(rand()) }));
  for (let k = 0; k < length; k++) {
    const t = k / RATE;
    const env = Math.min(1, t / 0.25) * (t > held ? Math.max(0, 1 - (t - held) / 0.6) : 1);
    let v = 0;
    for (const voice of voices) {
      voice.phase += (f0 * voice.ratio) / RATE;
      voice.phase -= Math.floor(voice.phase);
      v += TABLE[Math.floor(voice.phase * TABLE.length)];
    }
    music.add(s0 + k, v * env * gain, pan);
    send.add(s0 + k, v * env * gain * 0.6, -pan);
  }
}

function key(time: number, gain: number) {
  noiseHit(music, time, 0.035, 0.004, gain, 0.5, 0.15);
}

function reverb(input: Bus): Bus {
  const out = new Bus();
  const run = (src: Float32Array, dst: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
    const passes = [556, 441, 341].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let k = 0; k < N; k++) {
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * 0.5 + c.store * 0.5;
        c.buf[c.i] = src[k] + c.store * 0.8;
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
      dst[k] = acc * 0.1;
    }
  };
  run(input.l, out.l, 0);
  run(input.r, out.r, 31);
  return out;
}

function highPass(x: Float32Array, cutoff: number) {
  const w = (TAU * cutoff) / RATE;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let k = 0; k < x.length; k++) {
    const y = b0 * x[k] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[k];
    y2 = y1;
    y1 = y;
    x[k] = y;
  }
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

const LEAD = [0, 2, 4, 2, 3, 1, 4, 2, 0, 2, 4, 3, 4, 2, 1, 2];

for (let b = 0; b < BARS; b++) {
  const t0 = barStart(b);
  const chord = chordOfBar(b);
  const intro = b < SECTIONS.hook;
  const hook = b >= SECTIONS.hook && b < SECTIONS.groove;
  const drop = b === SECTIONS.drop;
  const peak = b >= SECTIONS.recovery && b < SECTIONS.finalHit;
  const final = b === SECTIONS.finalHit;
  const after = b > SECTIONS.finalHit;
  if (after) break;

  // the pad, every bar, louder once the groove is in
  chord.tones.slice(0, 4).forEach((m, n) => pad(t0, t0 + BAR, m, (intro ? 0.012 : 0.018) * (peak ? 1.25 : 1), (n / 3 - 0.5) * 1.2));

  if (final) {
    // the last hit: the whole band on F, then the room
    kick(t0, 0.9);
    clap(t0, 0.35);
    [41, 53, 57, 60, 65, 69, 72].forEach((m) => piano(t0, m, 0.55, 1.6));
    pluck(t0, 29, 0.5, 0.9, 3, 0, 0);
    noiseHit(drums, t0, 1.6, 0.5, 0.06, 0.95, 0.2, 0.6);
    continue;
  }

  if (drop) {
    // the drums fall away; one low D minor chord and the room
    [38, 50, 53, 57, 62].forEach((m) => piano(t0, m, 0.6, 1.3));
    pluck(t0, 26, 0.45, 0.8, 3, 0, 0);
    continue;
  }

  for (let s = 0; s < 16; s++) {
    const t = t0 + s * SIXTEENTH + (s % 2 ? SIXTEENTH * 0.08 : 0);
    const beat = s / 4;
    // drums
    if (!intro && s % 4 === 0 && (hook ? b >= SECTIONS.hook + 1 : true)) kick(t, hook ? 0.6 : 0.85);
    if (!intro && !hook && (s === 4 || s === 12)) clap(t, peak ? 0.42 : 0.36);
    if (s % 4 === 2) noiseHit(drums, t, 0.14, intro ? 0.03 : 0.06, intro ? 0.05 : 0.09, 0.95, 0.3);
    if (!intro && s % 2 === 1) noiseHit(drums, t, 0.03, 0.012, hook ? 0.03 : 0.045, 0.97, -0.3);
    // the bass: eighths on the root, an octave jump on the off-beat of three
    if (!intro && s % 2 === 0) {
      const midi = chord.root - 12 + (s === 10 ? 12 : 0);
      pluck(t, midi, hook ? 0.16 : 0.22, 0.16, 6, 0, 0);
    }
    // the stabs: short piano chords on the and-of-two and the and-of-four
    if (!intro && (s === 6 || s === 14)) chord.tones.slice(0, 3).forEach((m) => piano(t, m + 12, peak ? 0.42 : 0.34, 0.25));
    // the lead hook: sixteenths over the chord, every other bar, and every bar at the peak
    const leadOn = intro || (b >= SECTIONS.groove && (peak || b % 2 === 0) && b !== SECTIONS.fixes);
    if (leadOn) pluck(t, chord.tones[LEAD[s]] + 12, intro ? 0.05 + 0.02 * beat : peak ? 0.085 : 0.07, 0.12, 5, s % 2 ? 0.35 : -0.35, 0.35);
  }
}

const [from, to, count] = TYPE_COMMAND;
for (let n = 0; n < count; n++) key(TL.videoTimeOf(from + ((to - from) * n) / count) + rand() * 0.015, 0.16 + rand() * 0.04);
noiseHit(music, TL.videoTimeOf(CLICK), 0.04, 0.006, 0.28, 0.4);

const verb = reverb(send);
const l = new Float32Array(N);
const r = new Float32Array(N);
const fadeOutFrom = barStart(SECTIONS.finalHit) + 2.2;
for (let k = 0; k < N; k++) {
  const t = k / RATE;
  const fade = clamp(t / 0.03) * (1 - clamp((t - fadeOutFrom) / Math.max(0.5, DURATION - fadeOutFrom)));
  const tape = (x: number) => Math.tanh(x * 1.5) / Math.tanh(1.5);
  l[k] = tape(drums.l[k] + (music.l[k] + verb.l[k]) * duck[k]) * fade;
  r[k] = tape(drums.r[k] + (music.r[k] + verb.r[k]) * duck[k]) * fade;
}
highPass(l, 35);
highPass(r, 35);
let peak = 0;
for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(l[k]), Math.abs(r[k]));
for (let k = 0; k < N; k++) {
  l[k] *= 0.89 / peak;
  r[k] *= 0.89 / peak;
}
mkdirSync(OUT, { recursive: true });
writeWav(join(OUT, "score.wav"), l, r);
console.log(`Wrote ${join(OUT, "score.wav")} (${DURATION}s, bars: ${JSON.stringify(SECTIONS)})`);
