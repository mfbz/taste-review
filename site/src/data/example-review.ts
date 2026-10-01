// An illustrative verdict in the shape the Taste Engine returns: a 0-1 score,
// worst-first recommendations, and fixes keyed by an action discriminator.
export const EXAMPLE_REVIEW = {
  sha: "a1b2c3d",
  pages: [
    { path: "/", production: 0.86, preview: 0.85 },
    { path: "/pricing", production: 0.84, preview: 0.71 },
  ],
  recommendations: [
    "Snap the plan headings from 44px to 48px to match the reference type scale.",
    "Replace the gradient on the primary button with the flat charcoal fill the brand uses for every action.",
    "Set the plan card radius to 8px; the reference never rounds a card past it.",
  ],
  fixes: [
    { action: "snap_to_token", property: "font_size", from: "44px", to_value: "48px" },
    {
      action: "snap_to_token",
      property: "background",
      from: "linear-gradient(…)",
      to_value: "#1E1E1E",
    },
    { action: "snap_to_token", property: "border_radius", from: "16px", to_value: "8px" },
  ],
} as const;

// What the extractor read from one live site, trimmed to what this page shows.
export const EXAMPLE_EXTRACTION = {
  source: "tastelabs.com",
  colors: [
    { name: "Charcoal black", hex: "#1E1E1E", role: "Dark surfaces and type on light" },
    { name: "Off-white", hex: "#F5F7F2", role: "Light surfaces and type on dark" },
    { name: "Void black", hex: "#111111", role: "Nested dark sections and forms" },
    { name: "Muted grey", hex: "#8B8B8B", role: "Supporting copy and hairlines" },
    { name: "Hyperlink blue", hex: "#0000EE", role: "Interactive text only" },
  ],
  type: [
    { role: "Headline", family: "Matter", spec: "400 · 2-2.2rem · 1.2" },
    { role: "Body", family: "Matter", spec: "300 · 1-1.1rem · 1.5" },
    { role: "Button", family: "Azeret Semimono", spec: "400 · 15px · 1.4" },
  ],
} as const;
