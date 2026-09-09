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

export type BlockType = "hook" | "portfolio" | "body" | "cta" | "signoff";

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
const SIGNOFF_RE = /^(thanks|cheers|best|regards|warmly|talk soon|—|--)\b/i;

function classify(paragraph: string, index: number, total: number): BlockType {
  const p = paragraph.trim();
  if (index === 0) return "hook";
  if (SIGNOFF_RE.test(p) || (index === total - 1 && p.length < 140 && !CTA_RE.test(p)))
    return "signoff";
  if (URL_RE.test(p) || PORTFOLIO_RE.test(p)) return "portfolio";
  if (CTA_RE.test(p) || (p.endsWith("?") && index >= total - 3)) return "cta";
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
