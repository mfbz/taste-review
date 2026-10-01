// Every line terminator GitHub's renderer or JavaScript might honour, not only \n.
const LINE_BREAKS = new RegExp("[\\r\\n\\v\\f\\u0085\\u2028\\u2029]+", "g");

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "`": "&#96;",
  // GitHub links mentions and references after decoding entities, so an entity alone
  // still pings; a zero-width space after the sign is what breaks the link.
  "@": "@&#8203;",
  "#": "#&#8203;",
  "[": "&#91;",
  "]": "&#93;",
  "(": "&#40;",
  ")": "&#41;",
  "*": "&#42;",
  _: "&#95;",
  "~": "&#126;",
  "|": "&#124;",
  "\\": "&#92;",
  "!": "&#33;",
};

// Verdict text describes a page built from the pull request's own code, so it is
// untrusted: no mention, issue reference, link, autolink, HTML or table break survives.
export function escapeMarkdown(text: string): string {
  return text
    .replace(LINE_BREAKS, " ")
    .replace(/[&<>`@#[\]()*_~|\\!]/g, (char) => ENTITIES[char] ?? char)
    .replace(/:\/\//g, ":&#47;&#47;")
    .replace(/www\./gi, (match) => `${match.slice(0, 3)}&#46;`)
    .replace(/\bGH-(?=\d)/gi, (match) => `${match.slice(0, 2)}&#8203;-`)
    .trim();
}

// A code fence one backtick longer than any run inside the content, so the content cannot close it.
export function fence(content: string, language = ""): string {
  const longest = Math.max(0, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
  const marks = "`".repeat(Math.max(3, longest + 1));
  return `${marks}${language}\n${content}\n${marks}`;
}
