/**
 * "Guests mention": what reviews talk about, found from words in English and French.
 * A review counts once per topic, however many times it uses the words.
 */
export const REVIEW_TOPICS = [
  'location', 'cleanliness', 'hospitality', 'comfort', 'value', 'security', 'wifi', 'quiet',
] as const;
export type ReviewTopic = (typeof REVIEW_TOPICS)[number];

// Word stems, matched at the start of a word, case and accents ignored. A stem ending in
// "!" must be the whole word ("host!" matches "host" but not "hostile").
const WORDS: Record<ReviewTopic, string[]> = {
  location: ['location', 'located', 'emplacement', 'situ', 'quartier', 'neighbo', 'central', 'centre', 'proche', 'close to', 'near!', 'walking distance', 'accessible'],
  cleanliness: ['clean', 'propre', 'proprete', 'spotless', 'tidy', 'impeccable', 'nettoy'],
  hospitality: ['host!', 'hosts!', 'hote!', 'hotes!', 'hotesse', 'welcom', 'accueil', 'friendly', 'chaleureu', 'sympa', 'helpful', 'disponible', 'responsive', 'reactif', 'kind!', 'gentil', 'aimable', 'hospitalit'],
  comfort: ['comfort', 'confort', 'cosy', 'cozy', 'spacious', 'spacieu', 'lit!', 'lits!', 'bed!', 'beds!', 'literie', 'matelas', 'mattress'],
  value: ['value', 'price', 'prix', 'worth', 'rapport qualit', 'affordable', 'abordable', 'cheap', 'bon marche'],
  security: ['safe', 'secur', 'securi', 'gardien', 'guard', 'watchman', 'surveill'],
  wifi: ['wifi', 'wi-fi', 'internet', 'connexion', 'connection'],
  quiet: ['quiet', 'calm', 'calme', 'tranquil', 'peaceful', 'paisible', 'silenc'],
};

/** Accents removed, lower case: "Propreté" → "proprete". */
export function fold(text: string): string {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stem = (s: string) => (s.endsWith('!') ? `${escape(s.slice(0, -1))}(?![a-z])` : escape(s));

const MATCHERS: Record<ReviewTopic, RegExp> = Object.fromEntries(
  REVIEW_TOPICS.map((topic) => [topic, new RegExp(`(^|[^a-z])(${WORDS[topic].map(stem).join('|')})`)]),
) as Record<ReviewTopic, RegExp>;

/** The topics one review talks about. */
export function topicsOf(text: string): ReviewTopic[] {
  const folded = fold(text);
  return REVIEW_TOPICS.filter((topic) => MATCHERS[topic].test(folded));
}

/** Topic counts across reviews, most mentioned first, topics nobody mentions left out. */
export function countMentions(texts: string[]): { topic: ReviewTopic; count: number }[] {
  const counts = new Map<ReviewTopic, number>();
  for (const text of texts) for (const topic of topicsOf(text)) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  return [...counts.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
}

export function isReviewTopic(value: unknown): value is ReviewTopic {
  return typeof value === 'string' && (REVIEW_TOPICS as readonly string[]).includes(value);
}
