// Badges learners can earn. Names live in the app's translations (languages.badge_<id>);
// these are fallbacks and the emoji shown on the badge.

export const BADGES: Record<string, { emoji: string; name: string; description: string }> = {
  lessons_1: { emoji: '🎯', name: 'First step', description: 'Finish your first lesson' },
  lessons_10: { emoji: '📚', name: 'Getting serious', description: 'Finish 10 lessons' },
  lessons_50: { emoji: '🎓', name: 'Scholar', description: 'Finish 50 lessons' },
  streak_3: { emoji: '🔥', name: 'On a roll', description: '3-day streak' },
  streak_7: { emoji: '🌟', name: 'One week strong', description: '7-day streak' },
  streak_30: { emoji: '🏅', name: 'Unstoppable', description: '30-day streak' },
  xp_100: { emoji: '💯', name: '100 XP', description: 'Earn 100 XP' },
  xp_500: { emoji: '⚡', name: '500 XP', description: 'Earn 500 XP' },
  xp_2000: { emoji: '🚀', name: '2,000 XP', description: 'Earn 2,000 XP' },
  perfect_1: { emoji: '✨', name: 'Flawless', description: 'A lesson with no mistakes' },
  perfect_10: { emoji: '💎', name: 'Precision', description: '10 lessons with no mistakes' },
  gold_1: { emoji: '👑', name: 'Gold lesson', description: 'Redo a lesson with no mistakes' },
  checkpoint_1: { emoji: '🏁', name: 'Unit master', description: 'Pass a unit checkpoint' },
  story_1: { emoji: '📖', name: 'Storyteller', description: 'Finish a story' },
  mock_80: { emoji: '📝', name: 'Exam ready', description: 'Score 80% or more in a mock exam' },
  friend_1: { emoji: '🤝', name: 'Study buddy', description: 'Follow another learner' },
  league_top3: { emoji: '🏆', name: 'Podium', description: 'Finish a week in your league’s top 3' },
};

/** Badges this profile qualifies for after an activity (already-earned ones are filtered by the caller) */
export function badgeIdsFor(p: any, opts: { kind: string; mockScore?: number; alreadyDone?: boolean }): string[] {
  const ids: string[] = [];
  const add = (id: string, ok: boolean) => { if (ok) ids.push(id); };
  add('lessons_1', (p.lessonsDone ?? 0) >= 1);
  add('lessons_10', (p.lessonsDone ?? 0) >= 10);
  add('lessons_50', (p.lessonsDone ?? 0) >= 50);
  add('streak_3', (p.streak ?? 0) >= 3);
  add('streak_7', (p.streak ?? 0) >= 7);
  add('streak_30', (p.streak ?? 0) >= 30);
  add('xp_100', (p.totalXp ?? 0) >= 100);
  add('xp_500', (p.totalXp ?? 0) >= 500);
  add('xp_2000', (p.totalXp ?? 0) >= 2000);
  add('perfect_1', (p.perfectLessons ?? 0) >= 1);
  add('perfect_10', (p.perfectLessons ?? 0) >= 10);
  add('gold_1', (p.courses ?? []).some((c: any) => (c.gold ?? []).length > 0));
  add('checkpoint_1', (p.courses ?? []).some((c: any) => (c.checkpoints ?? []).length > 0));
  add('story_1', (p.courses ?? []).some((c: any) => (c.stories ?? []).length > 0));
  add('mock_80', opts.kind === 'mock' && (opts.mockScore ?? 0) >= 80);
  return ids;
}
