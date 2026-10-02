// The one timeline the scene, the renderer and the score share.
// Scene time is what index.html animates; video time is what plays. Each caption
// slows the scene for a moment as it appears, and the title holds still long
// enough to read, so the viewer reads before things move.
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
  // The title and its subtitle hold still here, in scene time, for this many seconds.
  const HOLDS = [[2.95, 2.6]];

  // Breakpoints of a piecewise-linear map: [scene, video]. A hold is two points at
  // one scene time; a slow window is a segment with a gentler slope.
  const points = [[0, 0]];
  const events = [
    ...HOLDS.map(([at, length]) => ({ at, kind: "hold", length })),
    ...CAPTIONS.map(([a], i) => ({
      at: a,
      kind: "slow",
      // a window never runs into the next caption
      end: Math.min(a + SLOW_FOR, CAPTIONS[i + 1]?.[0] ?? Infinity),
    })),
  ].sort((x, y) => x.at - y.at);
  for (const event of events) {
    const [s, v] = points[points.length - 1];
    const at = v + (event.at - s);
    points.push([event.at, at]);
    if (event.kind === "hold") points.push([event.at, at + event.length]);
    else points.push([event.end, at + (event.end - event.at) / SLOW_RATE]);
  }
  const [lastScene, lastVideo] = points[points.length - 1];
  points.push([SCENE_TOTAL, lastVideo + (SCENE_TOTAL - lastScene)]);

  function videoTimeOf(t) {
    for (let i = 1; i < points.length; i++) {
      const [s0, v0] = points[i - 1];
      const [s1, v1] = points[i];
      if (s1 > s0 && t <= s1) return v0 + ((t - s0) * (v1 - v0)) / (s1 - s0);
    }
    return points[points.length - 1][1];
  }

  function sceneTimeOf(v) {
    for (let i = 1; i < points.length; i++) {
      const [s0, v0] = points[i - 1];
      const [s1, v1] = points[i];
      if (v <= v1) return v1 === v0 ? s0 : s0 + ((v - v0) * (s1 - s0)) / (v1 - v0);
    }
    return SCENE_TOTAL;
  }

  root.TIMELINE = { CAPTIONS, HOLDS, SCENE_TOTAL, videoTimeOf, sceneTimeOf, VIDEO_TOTAL: points[points.length - 1][1] };
})(globalThis);
