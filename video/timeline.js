// The one timeline the scene, the renderer and the score share.
// Scene time is what index.html animates; video time is what plays. Each caption
// slows the scene for a moment as it appears, so the viewer reads before things move.
(function (root) {
  const CAPTIONS = [
    [8.5, 13.8, "Fernhill’s live site is the reference. The Taste Engine reads its brand straight from production."],
    [14.6, 18.0, "A coding agent opens a pull request that redesigns <b>/pricing</b>. Spot the problems?"],
    [18.2, 20.7, "Vercel deploys a preview. Anyone on the team comments <code>/taste review</code>."],
    [20.9, 22.5, "The action sends the preview and production to the Taste Engine."],
    [22.7, 25.5, "Same page, same brand: production scores <b>0.95</b>, the preview <b>0.35</b>."],
    [25.7, 28.4, "Every fix comes worst first, with the exact values the agent needs."],
    [28.8, 33.8, "The agent applies the fixes and pushes. Vercel deploys a new preview."],
    [34.2, 39.2, "Ask again: <b>0.90</b>, up 0.55. Back on brand before it merges."],
  ];
  const SCENE_TOTAL = 46;
  const SLOW_RATE = 0.6;
  const SLOW_FOR = 1.9;
  // A window never runs into the next caption, so the two directions agree.
  const SLOW = CAPTIONS.map(([a], i) => [a, Math.min(a + SLOW_FOR, CAPTIONS[i + 1]?.[0] ?? Infinity)]);

  function videoTimeOf(t) {
    let v = t;
    for (const [a, b] of SLOW) v += Math.max(0, Math.min(t, b) - a) * (1 / SLOW_RATE - 1);
    return v;
  }

  function sceneTimeOf(v) {
    let t = 0;
    let at = 0;
    for (const [a, b] of SLOW) {
      if (v <= at + (a - t)) return t + (v - at);
      at += a - t;
      t = a;
      const slowLen = (b - a) / SLOW_RATE;
      if (v <= at + slowLen) return t + (v - at) * SLOW_RATE;
      at += slowLen;
      t = b;
    }
    return t + (v - at);
  }

  root.TIMELINE = { CAPTIONS, SCENE_TOTAL, videoTimeOf, sceneTimeOf, VIDEO_TOTAL: videoTimeOf(SCENE_TOTAL) };
})(globalThis);
