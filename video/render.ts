// Renders index.html frame by frame in headless Chrome and pipes the frames into ffmpeg.
//
//   node render.ts                  out/taste-review.mp4 (1920x1080, 30 fps)
//   node render.ts --stills 2,6,14  out/still-<t>.png, to check a moment without a full render

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type Pending = Map<number, (result: Record<string, unknown>) => void>;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const OUT = join(import.meta.dirname, "out");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPage(): Promise<{
  send: (method: string, params?: object) => Promise<Record<string, unknown>>;
  close: () => void;
}> {
  const port = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/taste-review-video-${port}`,
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--allow-file-access-from-files",
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let url = "";
  for (let i = 0; i < 50 && !url; i++) {
    await sleep(200);
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      url = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl ?? "";
    } catch {
      // Chrome is still starting.
    }
  }
  const socket = new WebSocket(url);
  await new Promise((resolve) => (socket.onopen = resolve));
  let id = 0;
  const pending: Pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown> };
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)?.(message.result ?? {});
      pending.delete(message.id);
    }
  };
  const send = (method: string, params: object = {}) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const next = ++id;
      pending.set(next, resolve);
      socket.send(JSON.stringify({ id: next, method, params }));
    });
  return { send, close: () => chrome.kill("SIGKILL") };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const { send, close } = await openPage();
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: pathToFileURL(join(import.meta.dirname, "index.html")).href });
  for (let i = 0; i < 100; i++) {
    const ready = await send("Runtime.evaluate", { expression: "window.ready === true", returnByValue: true });
    if ((ready.result as { value?: boolean })?.value) break;
    await sleep(100);
  }
  await sleep(500);

  const frame = async (t: number): Promise<Buffer> => {
    await send("Runtime.evaluate", { expression: `seekVideo(${t})` });
    const shot = await send("Page.captureScreenshot", { format: "png" });
    return Buffer.from(String(shot.data), "base64");
  };

  const stillsArg = process.argv.indexOf("--stills");
  if (stillsArg !== -1) {
    for (const t of (process.argv[stillsArg + 1] ?? "").split(",").map(Number)) {
      writeFileSync(join(OUT, `still-${t}.png`), await frame(t));
    }
    close();
    return;
  }

  const total = Number(
    ((await send("Runtime.evaluate", { expression: "TOTAL", returnByValue: true })).result as { value: number })
      .value,
  );
  const frames = Math.round(total * FPS);
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "18",
      "-preset",
      "slow",
      "-movflags",
      "+faststart",
      join(OUT, "taste-review.mp4"),
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  for (let i = 0; i < frames; i++) {
    const png = await frame(i / FPS);
    if (!ffmpeg.stdin.write(png)) await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
    if (i % 60 === 0) process.stdout.write(`\r${i}/${frames}`);
  }
  ffmpeg.stdin.end();
  await new Promise((resolve) => ffmpeg.on("close", resolve));
  close();
  console.log(`\nWrote ${join(OUT, "taste-review.mp4")}`);
}

await main();
