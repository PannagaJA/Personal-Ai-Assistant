export function calculateWordCount(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/<[^>]*>/g, " ").replace(/[^\w\s]/gi, "");
  const words = clean.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function calculateReadingTime(wordCount: number): number {
  const wordsPerMinute = 200;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

export function generateAutoSummary(content: string, maxLen = 140): string {
  if (!content) return "";
  const plainText = content
    .replace(/^#+\s+/gm, "") // headers
    .replace(/[*_~`>#-]/g, "") // markdown symbols
    .replace(/\s+/g, " ")
    .trim();
  if (plainText.length <= maxLen) return plainText;
  return plainText.slice(0, maxLen).trim() + "…";
}

export function extractEntitiesFromText(text: string): {
  tags: string[];
  people: string[];
  companies: string[];
} {
  const tags: string[] = [];
  const tagMatches = text.match(/#([\w-]+)/g);
  if (tagMatches) {
    tagMatches.forEach((t) => tags.push(t.replace("#", "").toLowerCase()));
  }

  // Simple heuristic entity extractors
  const people: string[] = [];
  const companyMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Corp|Corporation|Ltd|Co|Smart Path|Google|Microsoft|Apple))\b/g);
  const companies: string[] = companyMatches ? Array.from(new Set(companyMatches)) : [];

  return {
    tags: Array.from(new Set(tags)),
    people: Array.from(new Set(people)),
    companies,
  };
}
