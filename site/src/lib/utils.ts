import { createCn } from "cn/config";

// Unregistered, a custom size like `text-label` reads as a colour and cn drops
// the real colour beside it. utils.test.ts fails when globals.css names one not listed here.
export const FONT_SIZES = [
  "display",
  "title",
  "subtitle",
  "body",
  "small",
  "label",
  "tag",
] as const;

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: [...FONT_SIZES] }] } },
});
