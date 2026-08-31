import type { DocumentTag } from "./document";

export type SimilarTag = DocumentTag & {
  reason: "case" | "prefix" | "substring" | "distance";
};
const comparable = (value: string) =>
  value.trim().normalize("NFKC").toLocaleLowerCase();
const distanceAtMostOne = (left: string, right: string): boolean => {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (left.length > right.length) i++;
    else if (right.length > left.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
};

export const findSimilarTags = (
  input: string,
  tags: readonly DocumentTag[],
  limit = 5,
): SimilarTag[] => {
  const query = comparable(input);
  if (!query) return [];
  const rank = { case: 0, prefix: 1, substring: 2, distance: 3 } as const;
  return tags.flatMap((tag): SimilarTag[] => {
    if (tag.name === input.trim()) return [];
    const candidate = comparable(tag.name);
    const reason = candidate === query
      ? "case"
      : candidate.startsWith(query) || query.startsWith(candidate)
      ? "prefix"
      : candidate.includes(query) || query.includes(candidate)
      ? "substring"
      : [...query].length >= 4 && distanceAtMostOne(query, candidate)
      ? "distance"
      : undefined;
    return reason ? [{ ...tag, reason }] : [];
  }).sort((a, b) =>
    rank[a.reason] - rank[b.reason] || a.name.localeCompare(b.name)
  ).slice(0, limit);
};
