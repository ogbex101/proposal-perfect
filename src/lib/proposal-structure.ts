// Structural fingerprint of a proposal.
//
// The fingerprint captures ONLY:
//   1. the ordered sequence of block types (hook → portfolio → body → cta …),
//      with consecutive repeats collapsed, and
//   2. whether a Golden Key is used and which pattern it is.
//
// It deliberately does NOT include paragraph count, word count, or any other
// length signal — a structurally identical proposal that is one sentence (or
// five paragraphs) longer must produce the SAME fingerprint.

export type BlockType = "hook" | "portfolio" | "body" | "cta";

export type StructureFingerprint = {
  /** Collapsed, ordered block sequence. */
  blocks: BlockType[];
  /** null when no Golden Key was used. */
  goldenKeyPattern: string | null;
  /** Stable string key used for comparison + storage. */
  key: string;
};

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const PORTFOLIO_RE = /\b(portfolio|case study|recent work|samples?|previous work|here'?s a link|you can see)\b/i;
const CTA_RE =
  /\b(want me to|shall i|let me know|reply|book a call|schedule|next step|send (?:it|you)|happy to|are you open|would you like|if that works|jump on a call)\b/i;
// A trailing sign-off / closing line ("Thanks, Caleb", "Best,", "— Caleb"). It is NOT
// part of the structure per the user's spec, so it is dropped before classification.
const SIGNOFF_RE = /^(thanks|thank you|cheers|best|regards|warmly|sincerely|talk soon|looking forward|—|--|-\s)/i;
function isSignoff(p: string): boolean {
  const t = p.trim();
  if (t.length > 120) return false;          // too long to be a bare sign-off
  if (URL_RE.test(t) || CTA_RE.test(t) || t.endsWith("?")) return false; // real content
  if (SIGNOFF_RE.test(t)) return true;
  // A very short trailing line with no sentence punctuation (e.g. a bare name) also counts.
  return t.length <= 40 && !/[.!?]/.test(t);
}

function classify(paragraph: string, index: number, total: number): BlockType {
  const p = paragraph.trim();
  if (index === 0) return "hook";
  if (URL_RE.test(p) || PORTFOLIO_RE.test(p)) return "portfolio";
  if (CTA_RE.test(p) || (p.endsWith("?") && index >= total - 3)) return "cta";
  // A trailing sign-off / closing line is treated as body, not its own block —
  // per the user's spec, only hook/portfolio/body/CTA define the structure, so a
  // "Thanks, Caleb" line must NOT make an otherwise-identical proposal a new shape.
  return "body";
}

/** Collapse consecutive duplicates so length alone never changes the shape. */
function collapse(list: BlockType[]): BlockType[] {
  return list.filter((b, i) => b !== list[i - 1]);
}

export function computeFingerprint(
  content: string,
  goldenKey?: { use?: boolean; pattern?: string | null; keyId?: string | null } | null,
): StructureFingerprint {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Drop a trailing sign-off line so it never adds a spurious block to the shape.
  while (paragraphs.length > 1 && isSignoff(paragraphs[paragraphs.length - 1])) {
    paragraphs.pop();
  }

  const blocks = collapse(paragraphs.map((p, i) => classify(p, i, paragraphs.length)));
  const goldenKeyPattern =
    goldenKey && goldenKey.use ? (goldenKey.pattern ?? goldenKey.keyId ?? "unknown") : null;

  return {
    blocks,
    goldenKeyPattern,
    key: `${blocks.join(">")}|gk:${goldenKeyPattern ?? "none"}`,
  };
}

export function describeFingerprint(fp: StructureFingerprint): string {
  const label = fp.blocks.join(" → ");
  return fp.goldenKeyPattern ? `${label} · Golden Key (${fp.goldenKeyPattern})` : label;
}
