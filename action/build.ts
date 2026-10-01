// Bundles the action into one file GitHub runs without an install step.
// CI rebuilds it and fails when the committed dist/ differs from the source.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  legalComments: "none",
  // A CommonJS dependency inside an ESM bundle still calls require.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
