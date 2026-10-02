// The soundtrack, synthesized: felt piano and bowed strings, warm and unhurried.
// A soft piano ostinato gives the story its pulse, strings carry the harmony and
// swell where the story turns (D minor under the agent's pull request, the drop on
// the one heavy chord, home to F on the recovery), and the only other sounds are
// the keystrokes and the click on screen. Cues are written in scene time and
// placed through timeline.js, the same timeline the picture uses.
//
//   node score.ts → out/score.wav

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

type Timeline = {
  VIDEO_TOTAL: number;
  videoTimeOf: (t: number) => number;
  sceneTimeOf: (v: number) => number;
};
type Chord = { at: number; root: number; voices: number[]; strings: number };

const sandbox: { TIMELINE?: Timeline } = {};
runInNewContext(readFileSync(join(import.meta.dirname, "timeline.js"), "utf8"), Object.assign(sandbox, { globalThis: sandbox }));
const TL = sandbox.TIMELINE as Timeline;
const V = (t: number) => TL.videoTimeOf(t);

const RATE = 48000;
const DURATION = Math.ceil(TL.VIDEO_TOTAL * 10) / 10;
const N = Math.ceil(DURATION * RATE);
const TAU = Math.PI * 2;
const OUT = join(import.meta.dirname, "out");
const BPM = 84;
const EIGHTH = 60 / BPM / 2;

// Scene-time chord changes; strings is how far the string section swells there (0 to 1).
const CHORDS: Chord[] = [
  { at: 0, root: 41, voices: [53, 57, 60, 64, 67], strings: 0.5 },
  { at: 3.5, root: 38, voices: [53, 57, 60, 64], strings: 0.6 },
  { at: 5.7, root: 46, voices: [50, 53, 57, 62], strings: 0.65 },
  { at: 8.0, root: 41, voices: [53, 57, 60, 64, 67], strings: 0.55 },
  { at: 11.0, root: 46, voices: [50, 53, 57, 62], strings: 0.6 },
  { at: 14.0, root: 38, voices: [50, 53, 57, 60, 64], strings: 0.65 },
  { at: 17.0, root: 46, voices: [50, 53, 58, 62], strings: 0.65 },
  { at: 18.2, root: 48, voices: [53, 55, 60, 65], strings: 0.7 },
  { at: 20.8, root: 45, voices: [52, 55, 60, 64], strings: 0.75 },
  { at: 22.4, root: 38, voices: [50, 53, 57, 62], strings: 0.95 },
  { at: 25.7, root: 46, voices: [50, 53, 57, 62], strings: 0.7 },
  { at: 28.6, root: 46, voices: [53, 58, 62, 65], strings: 0.7 },
  { at: 30.6, root: 48, voices: [52, 55, 60, 64], strings: 0.8 },
  { at: 34.0, root: 41, voices: [53, 57, 60, 64, 69, 72], strings: 1.0 },
  { at: 36.6, root: 46, voices: [53, 57, 62, 65, 69], strings: 0.85 },
  { at: 38.0, root: 48, voices: [52, 55, 60, 64, 67], strings: 0.85 },
  { at: 39.3, root: 41, voices: [53, 57, 60, 64, 67, 72], strings: 0.9 },
];
const OSTINATO = [
  [8.0, 22.3],
  [23.9, 41.6],
] as const;
const MELODY: [scene: number, midi: number, velocity: number][] = [
  [0.4, 72, 0.32],
  [1.4, 69, 0.28],
  [2.5, 67, 0.3],
  [3.8, 69, 0.38],
  [4.6, 67, 0.36],
  [5.7, 72, 0.4],
  [9.6, 76, 0.3],
  [12.2, 74, 0.28],
  [15.4, 69, 0.3],
  [16.5, 65, 0.28],
  [22.4, 38, 0.6],
  [22.4, 45, 0.5],
  [22.4, 50, 0.45],
  [22.4, 53, 0.42],
  [25.8, 69, 0.3],
  [26.6, 67, 0.28],
  [27.4, 65, 0.28],
  [31.5, 72, 0.3],
  [32.3, 74, 0.3],
  [33.1, 76, 0.32],
  [34.9, 77, 0.42],
  [34.9, 81, 0.36],
  [36.8, 79, 0.32],
  [37.6, 76, 0.3],
  [40.3, 72, 0.32],
  [40.7, 76, 0.32],
  [41.1, 79, 0.34],
  [41.5, 84, 0.34],
  [43.0, 41, 0.42],
  [43.0, 53, 0.32],
  [43.0, 60, 0.3],
  [43.0, 64, 0.3],
  [43.0, 69, 0.32],
];
const TYPE_COMMAND = [19.15, 19.9, 13] as const;
const CLICK = 20.6;
const FADE_OUT = [V(44.0), DURATION] as const;

let seed = 13;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647 - 0.5;
};
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const chordAt = (scene: number) => [...CHORDS].reverse().find((c) => c.at <= scene) ?? CHORDS[0];

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

const dry = new Bus();
const send = new Bus();

// A felt piano: slightly inharmonic partials that die faster the higher they are,
// a soft hammer and a short felt thump. Quieter notes are darker.
function piano(time: number, midi: number, velocity: number, ring = 1) {
  const f0 = hz(midi);
  const s0 = Math.floor(time * RATE);
  const pitchDecay = clamp(1.6 - (midi - 40) / 50, 0.45, 1.6) * ring;
  const length = Math.floor(Math.min(7, 6 * pitchDecay) * RATE);
  const pan = clamp((midi - 60) / 30, -0.6, 0.6);
  const partials = Array.from({ length: 10 }, (_, k) => {
    const n = k + 1;
    return {
      f: f0 * n * Math.sqrt(1 + 0.00035 * n * n),
      amp: (1 / n ** 1.25) * Math.exp(-n * (1 - velocity) * 0.55),
      tau: (2.8 * pitchDecay) / (1 + n * 0.35),
      phase: rand() * TAU,
    };
  }).filter((p) => p.f < 9000);
  for (let k = 0; k < length; k++) {
    const t = k / RATE;
    let v = 0;
    for (const p of partials) v += p.amp * Math.exp(-t / p.tau) * Math.sin(TAU * p.f * t + p.phase);
    v *= Math.min(1, t / 0.006) * velocity * 0.22;
    dry.add(s0 + k, v, pan);
    send.add(s0 + k, v * 0.5, -pan * 0.5);
  }
  let y = 0;
  for (let k = 0; k < 0.03 * RATE; k++) {
    y += 0.3 * (rand() * 2 - y);
    dry.add(s0 + k, y * Math.exp(-k / (0.004 * RATE)) * velocity * 0.07, pan);
  }
}

// One band-limited sawtooth cycle, dark at the top, for the strings.
const TABLE = (() => {
  const size = 4096;
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let v = 0;
    for (let n = 1; n <= 14; n++) v += (Math.sin((TAU * n * i) / size) / n) * Math.exp(-n * 0.18);
    table[i] = v * 0.6;
  }
  return table;
})();

// A bowed note: three detuned voices, slow attack, vibrato that arrives late.
function strings(start: number, end: number, midi: number, gain: number, pan: number) {
  const s0 = Math.floor(start * RATE);
  const attack = 1.3;
  const release = 1.8;
  const length = Math.floor((end - start + release) * RATE);
  const f0 = hz(midi);
  const voices = [-0.004, 0, 0.005].map((d) => ({ ratio: 1 + d, phase: Math.random() }));
  for (let k = 0; k < length; k++) {
    const t = k / RATE;
    const held = end - start;
    const env = (t < attack ? (1 - Math.cos((Math.PI * t) / attack)) / 2 : 1) * (t > held ? Math.max(0, 1 - (t - held) / release) : 1);
    if (env <= 0) continue;
    const vib = 1 + 0.0025 * Math.sin(TAU * 5.1 * t) * clamp((t - 0.6) / 1.2);
    let v = 0;
    for (const voice of voices) {
      voice.phase += (f0 * voice.ratio * vib) / RATE;
      voice.phase -= Math.floor(voice.phase);
      v += TABLE[Math.floor(voice.phase * TABLE.length)];
    }
    v *= env * gain;
    dry.add(s0 + k, v * 0.55, pan);
    send.add(s0 + k, v * 0.9, -pan);
  }
}

function key(time: number, gain: number) {
  const s0 = Math.floor(time * RATE);
  let y = 0;
  for (let k = 0; k < 0.035 * RATE; k++) {
    y += 0.35 * (rand() * 2 - y);
    dry.add(s0 + k, y * Math.exp(-k / (0.004 * RATE)) * gain, 0.15);
  }
  for (let k = 0; k < 0.03 * RATE; k++) {
    const t = k / RATE;
    dry.add(s0 + k, Math.sin(TAU * 180 * t) * Math.exp(-t / 0.008) * gain * 0.4, 0.15);
  }
}

// A warm room: six damped combs and three all-passes per side.
function reverb(input: Bus): Bus {
  const out = new Bus();
  const run = (src: Float32Array, dst: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ buf: new Float32Array(Math.round(d * 1.35) + spread), i: 0, store: 0 }));
    const passes = [556, 441, 341].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let k = 0; k < N; k++) {
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * 0.45 + c.store * 0.55;
        c.buf[c.i] = src[k] + c.store * 0.86;
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

// strings: each chord held until the next, a little overlap so the bows cross
CHORDS.forEach((chord, i) => {
  const start = V(chord.at);
  const end = i + 1 < CHORDS.length ? V(CHORDS[i + 1].at) + 0.4 : V(44.5);
  const gain = 0.035 * chord.strings;
  chord.voices.forEach((m, n) => strings(start, end, m, gain, (n / (chord.voices.length - 1) - 0.5) * 1.3));
  strings(start, end, chord.root + 12, gain * 0.9, 0);
});

// the ostinato: eighths on a fixed grid, the chord read from the picture's scene time
for (const [from, to] of OSTINATO) {
  for (let v = V(from); v < V(to); v += EIGHTH) {
    const chord = chordAt(TL.sceneTimeOf(v));
    const tones = [chord.root + 12, ...chord.voices].filter((m) => m >= 53 && m <= 72);
    const step = Math.round((v - V(from)) / EIGHTH);
    const pattern = [0, 2, 3, 1, 3, 2, 0, 3];
    const midi = tones[pattern[step % 8] % tones.length];
    piano(v + rand() * 0.008, midi, step % 2 ? 0.17 : 0.23, 0.55);
  }
}

for (const [scene, midi, velocity] of MELODY) piano(V(scene), midi, velocity);

const [from, to, count] = TYPE_COMMAND;
for (let n = 0; n < count; n++) key(V(from + ((to - from) * n) / count) + rand() * 0.015, 0.09 + rand() * 0.03);
key(V(CLICK), 0.16);

const verb = reverb(send);
const l = new Float32Array(N);
const r = new Float32Array(N);
for (let k = 0; k < N; k++) {
  const t = k / RATE;
  const fade = clamp(t / 0.08) * (1 - clamp((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0])));
  // a touch of tape: soft saturation glues the piano and strings together
  const tape = (x: number) => Math.tanh(x * 1.6) / Math.tanh(1.6);
  l[k] = tape(dry.l[k] + verb.l[k]) * fade;
  r[k] = tape(dry.r[k] + verb.r[k]) * fade;
}
highPass(l, 40);
highPass(r, 40);
let peak = 0;
for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(l[k]), Math.abs(r[k]));
const gain = 0.89 / peak;
for (let k = 0; k < N; k++) {
  l[k] *= gain;
  r[k] *= gain;
}
mkdirSync(OUT, { recursive: true });
writeWav(join(OUT, "score.wav"), l, r);
console.log(`Wrote ${join(OUT, "score.wav")} (${DURATION}s)`);
