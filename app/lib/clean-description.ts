/** Display-only cleanup — never mutate stored claim data. */
export function cleanDescription(description: string): string {
  if (!description) return description;
  return description
    // Unicode × followed by number at end
    .replace(/\s*×\s*\d+\s*$/g, "")
    // Plain x followed by number at end (case insensitive, word boundary)
    .replace(/\s+x\s*\d+\s*$/gi, "")
    // (6 bottles) or (×6) in parens at end
    .replace(/\s*\(\s*[×x]?\s*\d+[^)]*\)\s*$/gi, "")
    // "set of N" at end
    .replace(/\s*set of \d+\s*$/gi, "")
    // "N-pack" or "N pack" at end
    .replace(/\s*\d+[-\s]?pack\s*$/gi, "")
    // "pair" is ok to keep
    .trim();
}
