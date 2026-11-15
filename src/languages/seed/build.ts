// Turns the starter phrases into courses: each lesson gets a mix of meaning, tiles, matching,
// typing and fill-the-blank exercises. Deterministic (same input → same course).
import { Exercise, Lang, LanguageCourse } from '../schemas/language.schemas';
import { FR_EN_UNITS, Pair, SeedUnit, ZH_UNITS, ZhPhrase } from './phrases';

interface Item { target: string; base: string; romanization?: string }

/** Pinyin of each Chinese word, from phrases whose words and pinyin groups line up */
const PINYIN = new Map<string, string>();
for (const u of ZH_UNITS) for (const l of u.lessons) for (const p of l.phrases) {
  const w = p.zh.split(/\s+/).filter(Boolean);
  const py = p.py.split(/\s+/).filter(Boolean);
  if (w.length === 1) PINYIN.set(w[0], p.py);
  else if (w.length === py.length) w.forEach((x, i) => { if (!PINYIN.has(x)) PINYIN.set(x, py[i]); });
}
const romanize = (opts: string[], lang: Lang) => (lang === 'zh' ? opts.map((o) => PINYIN.get(o) ?? '') : undefined);

/** Words of a phrase, for tiles: Chinese is pre-split with spaces; others split on spaces */
const words = (s: string) => s.replace(/[?!.,]/g, ' ').split(/\s+/).filter(Boolean);
/** Shown form: Chinese without the helper spaces */
const show = (s: string, lang: Lang) => (lang === 'zh' ? s.replace(/\s+/g, '') : s);

/** Small deterministic shuffle so courses don't change between restarts */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let x = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lessonExercises(items: Item[], pool: Item[], target: Lang, base: Lang, seed: number): Exercise[] {
  const ex: Exercise[] = [];
  const others = (it: Item) => pool.filter((p) => p !== it);
  items.forEach((it, i) => {
    // 1. Meaning: target → pick the base translation
    const wrong = shuffle(others(it), seed + i).slice(0, 3).map((o) => o.base);
    ex.push({
      type: 'choice', instruction: 'meaning', prompt: show(it.target, target), promptRomanization: it.romanization,
      promptLang: target, answers: [it.base], options: shuffle([it.base, ...wrong], seed * 7 + i), pairs: [], answerLang: base,
    } as Exercise);
    // 2. Tiles: base → build the target from word tiles (plus a few decoys)
    const own = words(it.target);
    const decoys = shuffle([...new Set(others(it).flatMap((o) => words(o.target)).filter((w) => !own.includes(w)))], seed + 31 * i).slice(0, Math.min(3, Math.max(2, 6 - own.length)));
    const bank = shuffle([...own, ...decoys], seed * 13 + i);
    ex.push({
      type: 'tiles', instruction: 'translate', prompt: it.base, promptLang: base,
      answers: [own.join(' ')], options: bank, optionsRomanization: romanize(bank, target), pairs: [], answerLang: target,
    } as Exercise);
  });
  // 3. Match pairs (4 of them)
  const four = shuffle(items, seed + 5).slice(0, 4);
  ex.push({
    type: 'match', instruction: 'pairs', prompt: '', answers: [], options: [],
    pairs: four.map((it) => ({ left: show(it.target, target), right: it.base })), promptLang: target, answerLang: base,
  } as Exercise);
  // 4. Typing: target → type the base (two of them)
  shuffle(items, seed + 9).slice(0, 2).forEach((it) => {
    ex.push({
      type: 'type', instruction: 'translate', prompt: show(it.target, target), promptRomanization: it.romanization,
      promptLang: target, answers: [it.base], options: [], pairs: [], answerLang: base,
    } as Exercise);
  });
  // 5. Fill the blank in a longer target phrase
  const longer = items.filter((it) => words(it.target).length >= 3);
  shuffle(longer, seed + 17).slice(0, 2).forEach((it, k) => {
    const w = words(it.target);
    const idx = (seed + k) % w.length;
    const missing = w[idx];
    const blanked = w.map((x, j) => (j === idx ? '___' : x)).join(target === 'zh' ? '' : ' ');
    const decoys = shuffle([...new Set(pool.flatMap((o) => words(o.target)).filter((x) => x !== missing))], seed + 41 + k).slice(0, 3);
    const opts = shuffle([missing, ...decoys], seed * 3 + k);
    ex.push({
      type: 'fill', instruction: 'complete', prompt: blanked, promptRomanization: it.romanization, promptLang: target,
      answers: [missing], options: opts, optionsRomanization: romanize(opts, target), pairs: [], answerLang: target, explanation: it.base,
    } as Exercise);
  });
  return ex;
}

function buildCourse<T>(
  slug: string, target: Lang, base: Lang, order: number,
  title: { en: string; fr: string }, description: { en: string; fr: string },
  units: SeedUnit<T>[], toItem: (p: T) => Item,
): LanguageCourse {
  const all = units.flatMap((u) => u.lessons.flatMap((l) => l.phrases.map(toItem)));
  let seed = 11;
  return {
    slug, targetLang: target, baseLang: base, order, title, description, isPublished: true,
    units: units.map((u) => ({
      title: u.title[base === 'fr' ? 'fr' : 'en'],
      level: u.level,
      lessons: u.lessons.map((l) => {
        seed += 7;
        const items = l.phrases.map(toItem);
        // Decoys come from the same unit first, then the whole course
        const unitPool = u.lessons.flatMap((x) => x.phrases.map(toItem));
        const pool = unitPool.length >= 8 ? unitPool : all;
        return { title: l.title[base === 'fr' ? 'fr' : 'en'], isPublished: true, exercises: lessonExercises(items, pool, target, base, seed) };
      }),
    })),
  } as unknown as LanguageCourse;
}

export function starterCourses(): LanguageCourse[] {
  return [
    buildCourse<Pair>('french-for-english-speakers', 'fr', 'en', 1,
      { en: 'French', fr: 'Français' },
      { en: 'French for campus, housing and daily life in Cameroon.', fr: 'Le français du campus, du logement et du quotidien.' },
      FR_EN_UNITS, (p) => ({ target: p.fr, base: p.en })),
    buildCourse<Pair>('english-for-french-speakers', 'en', 'fr', 2,
      { en: 'English', fr: 'Anglais' },
      { en: 'English for campus, housing and daily life.', fr: "L'anglais du campus, du logement et du quotidien." },
      FR_EN_UNITS, (p) => ({ target: p.en, base: p.fr })),
    buildCourse<ZhPhrase>('chinese-for-english-speakers', 'zh', 'en', 3,
      { en: 'Chinese', fr: 'Chinois' },
      { en: 'Mandarin Chinese basics with pinyin.', fr: 'Les bases du chinois mandarin avec le pinyin.' },
      ZH_UNITS, (p) => ({ target: p.zh, base: p.en, romanization: p.py })),
    buildCourse<ZhPhrase>('chinese-for-french-speakers', 'zh', 'fr', 4,
      { en: 'Chinese', fr: 'Chinois' },
      { en: 'Mandarin Chinese basics with pinyin.', fr: 'Les bases du chinois mandarin avec le pinyin.' },
      ZH_UNITS, (p) => ({ target: p.zh, base: p.fr, romanization: p.py })),
  ];
}
