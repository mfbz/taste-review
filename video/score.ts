// The soundtrack, synthesized: a sparse felt piano written to the story, and
// only the sounds of the action itself (the keystrokes and the click). No
// whooshes, no dings: every sound is either music or something on screen.
// Cue times mirror index.html; change one and change the other.
//
//   node score.ts → out/score.wav

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Note = [time: number, midi: number, velocity: number];

const RATE = 48000;
const DURATION = 46;
const N = Math.ceil(DURATION * RATE);
const TAU = Math.PI * 2;
const OUT = join(import.meta.dirname, "out");
const FADE_OUT = [44.2, 46] as const;

const TYPE_COMMAND = [19.15, 19.9, 13] as const;
const CLICK = 20.6;

// The score. F major, with the agent's pull request in D minor and the drop
// on a low D minor chord; the recovery resolves home to F and rings out.
const NOTES: Note[] = [
  // intro: an open fifth, then a rising question
  [0.2, 41, 0.5],
  [0.2, 48, 0.4],
  [1.0, 64, 0.35],
  [1.9, 67, 0.32],
  [2.6, 72, 0.34],
  // the hook, one note per line
  [3.8, 69, 0.4],
  [3.8, 50, 0.38],
  [4.6, 67, 0.38],
  [5.7, 72, 0.42],
  [5.7, 46, 0.4],
  [5.7, 53, 0.3],
  // the brand: Fmaj9, then B♭maj7, voiced warm
  [8.1, 41, 0.45],
  [8.1, 57, 0.3],
  [8.1, 64, 0.28],
  [8.1, 67, 0.3],
  [9.6, 69, 0.3],
  [10.8, 46, 0.42],
  [10.8, 57, 0.28],
  [10.8, 62, 0.28],
  [10.8, 65, 0.3],
  [12.2, 72, 0.3],
  [12.9, 69, 0.26],
  // the agent's pull request: D minor, unsettled
  [14.4, 38, 0.45],
  [14.4, 57, 0.3],
  [14.4, 62, 0.3],
  [14.4, 65, 0.32],
  [16.0, 64, 0.3],
  [17.2, 46, 0.4],
  [17.2, 58, 0.28],
  [17.2, 62, 0.28],
  [18.2, 69, 0.3],
  // the review is running: a held, quiet C
  [20.8, 48, 0.36],
  [20.8, 60, 0.24],
  [20.8, 67, 0.24],
  // the drop: low D minor, the one heavy chord
  [23.4, 38, 0.55],
  [23.4, 53, 0.4],
  [23.4, 57, 0.38],
  [23.4, 62, 0.38],
  // the fixes, worst first: a descending line
  [25.8, 69, 0.3],
  [26.6, 67, 0.28],
  [27.4, 65, 0.28],
  // the fix: B♭ to C, leaning home
  [28.8, 46, 0.42],
  [28.8, 62, 0.28],
  [28.8, 65, 0.3],
  [30.5, 48, 0.42],
  [30.5, 64, 0.3],
  [30.5, 67, 0.3],
  [32.2, 70, 0.3],
  [33.0, 72, 0.32],
  // the recovery: home to F, high and open
  [34.9, 41, 0.5],
  [34.9, 53, 0.36],
  [34.9, 64, 0.34],
  [34.9, 69, 0.36],
  [34.9, 77, 0.38],
  [36.8, 76, 0.3],
  [37.6, 72, 0.3],
  // the end card: F major, rising with the score, then one long ring
  [39.8, 41, 0.45],
  [40.3, 65, 0.3],
  [40.6, 69, 0.3],
  [40.9, 72, 0.32],
  [41.2, 76, 0.34],
  [41.5, 79, 0.32],
  [43.0, 41, 0.4],
  [43.0, 53, 0.3],
  [43.0, 60, 0.28],
  [43.0, 64, 0.28],
  [43.0, 69, 0.3],
];

let seed = 11;
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

const dry = new Bus();
const send = new Bus();

// A felt piano: slightly inharmonic partials that die faster the higher they
// are, a soft hammer, and a short felt thump. Quieter notes are darker.
function piano(time: number, midi: number, velocity: number) {
  const f0 = hz(midi);
  const s0 = Math.floor(time * RATE);
  const pitchDecay = clamp(1.6 - (midi - 40) / 50, 0.45, 1.6);
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
    const attack = Math.min(1, t / 0.006);
    let v = 0;
    for (const p of partials) v += p.amp * Math.exp(-t / p.tau) * Math.sin(TAU * p.f * t + p.phase);
    v *= attack * velocity * 0.22;
    dry.add(s0 + k, v, pan);
    send.add(s0 + k, v * 0.55, -pan * 0.5);
  }
  // the felt thump: a few milliseconds of dark noise
  let y = 0;
  for (let k = 0; k < 0.03 * RATE; k++) {
    y += 0.3 * (rand() * 2 - y);
    dry.add(s0 + k, y * Math.exp(-k / (0.004 * RATE)) * velocity * 0.08, pan);
  }
}

// A key on a laptop keyboard: a short dark click and a little body.
function key(time: number, gain: number) {
  const s0 = Math.floor(time * RATE);
  let y = 0;
  for (let k = 0; k < 0.035 * RATE; k++) {
    y += 0.35 * (rand() * 2 - y);
    const env = Math.exp(-k / (0.004 * RATE));
    dry.add(s0 + k, y * env * gain, 0.15);
  }
  for (let k = 0; k < 0.03 * RATE; k++) {
    const t = k / RATE;
    dry.add(s0 + k, Math.sin(TAU * 180 * t) * Math.exp(-t / 0.008) * gain * 0.4, 0.15);
  }
}

// A small stereo reverb: four combs and two all-passes per side, a warm room.
function reverb(input: Bus): Bus {
  const out = new Bus();
  const run = (src: Float32Array, dst: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
    const passes = [556, 441, 341].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let k = 0; k < N; k++) {
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * 0.6 + c.store * 0.4;
        c.buf[c.i] = src[k] + c.store * 0.84;
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
      dst[k] = acc * 0.12;
    }
  };
  run(input.l, out.l, 0);
  run(input.r, out.r, 29);
  return out;
}

function highPass(x: Float32Array, cutoff: number) {
  // a second-order Butterworth, run in place
  const w = (TAU * cutoff) / RATE;
  const q = Math.SQRT1_2;
  const alpha = Math.sin(w) / (2 * q);
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

for (const [time, midi, velocity] of NOTES) piano(time, midi, velocity);
const [from, to, count] = TYPE_COMMAND;
for (let n = 0; n < count; n++) key(from + ((to - from) * n) / count + rand() * 0.015, 0.09 + rand() * 0.03);
key(CLICK, 0.16);
const verb = reverb(send);

const l = new Float32Array(N);
const r = new Float32Array(N);
let peak = 0;
for (let k = 0; k < N; k++) {
  const t = k / RATE;
  const fade = clamp(t / 0.05) * (1 - clamp((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0])));
  l[k] = (dry.l[k] + verb.l[k]) * fade;
  r[k] = (dry.r[k] + verb.r[k]) * fade;
  peak = Math.max(peak, Math.abs(l[k]), Math.abs(r[k]));
}
// A 40 Hz high-pass: nothing below it is music, and speakers cannot play it anyway.
highPass(l, 40);
highPass(r, 40);
peak = 0;
for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(l[k]), Math.abs(r[k]));
const gain = 0.89 / peak;
for (let k = 0; k < N; k++) {
  l[k] *= gain;
  r[k] *= gain;
}
mkdirSync(OUT, { recursive: true });
writeWav(join(OUT, "score.wav"), l, r);
console.log(`Wrote ${join(OUT, "score.wav")}`);
