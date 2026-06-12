// Universal red-flag phrase system. The DEFAULT list is always active and
// cannot be disabled. Users may add custom phrases on top (stored in DB).
// Used both to instruct the model (prevention) and to scrub output (cleanup).

export const DEFAULT_RED_FLAGS: string[] = [
  "here is what i will do",
  "here's what i will do",
  "here is how i will do it",
  "here's how i'll do it",
  "i will do this",
  "i will deliver",
  "i will provide",
  "i will create",
  "i will make sure",
  "i can do this",
  "i can help you",
  "i am the perfect fit",
  "i am the best candidate",
  "i am confident that",
  "i am passionate about",
  "i am excited to",
  "i would love to",
  "i have done this before",
  "i have years of experience",
  "i am an expert in",
  "let me know if you have any questions",
  "looking forward to hearing from you",
  "thank you for your consideration",
  "i am available for a call",
  "jump on a call",
  "hop on a call",
  "dear hiring manager",
  "to whom it may concern",
  "most developers",
  "most freelancers",
  "in today's fast-paced world",
  "in today's digital age",
  "results-driven",
  "detail-oriented",
  "team player",
  "go-getter",
  "think outside the box",
  "hit the ground running",
  "best regards",
  "warm regards",
  "i hope this message finds you well",
  "i came across your job posting",
  "i saw your job post",
  "i am writing to apply",
  "i am reaching out",
  "with that being said",
  "at the end of the day",
  "needless to say",
  "rest assured",
  "look no further",
  "your one-stop shop",
];

// Normalize for comparison (lowercase, collapse whitespace).
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Return the merged active red-flag list (defaults + custom), de-duplicated.
export function activeRedFlags(custom: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phrase of [...DEFAULT_RED_FLAGS, ...custom.map(norm)]) {
    const n = norm(phrase);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// Detect which red-flag phrases appear in the given text.
export function detectRedFlags(text: string, custom: string[] = []): string[] {
  const hay = norm(text);
  return activeRedFlags(custom).filter((p) => hay.includes(p));
}

// Remove red-flag phrases from text. Strips the offending phrase and tidies
// up leftover punctuation/whitespace so sentences stay readable.
export function scrubRedFlags(text: string, custom: string[] = []): string {
  let out = text;
  for (const phrase of activeRedFlags(custom)) {
    // Build a case-insensitive matcher for the phrase with flexible whitespace.
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    const re = new RegExp(escaped, "gi");
    out = out.replace(re, "");
  }
  // Tidy: collapse double spaces, fix orphaned punctuation and blank lines.
  out = out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:])\1+/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+/gm, (m) => m) // keep indentation
    .trim();
  return out;
}

// Build the instruction block injected into system prompts.
export function redFlagPromptBlock(custom: string[] = []): string {
  const list = activeRedFlags(custom);
  return `\n\nHARD CONSTRAINT — RED-FLAGGED PHRASES (NEVER use any of these or close variants; they read as generic AI filler and instantly disqualify the writing):\n${list.map((p) => `  • "${p}"`).join("\n")}\n\nWrite like a sharp human expert who has done this work for years — specific, confident, plain-spoken. No filler, no clichés, no hedging, no corporate buzzwords. Every sentence must carry concrete meaning.`;
}
