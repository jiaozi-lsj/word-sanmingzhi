import { CONFIG } from '../config.js';

export function calculateResult(session, words, finalSnakeWords, reason) {
  const performances = Object.values(session.performance);
  const resolved = performances.filter((perf) => perf.resolved);
  const reactionTimes = performances.flatMap((perf) => perf.reactionTimesMs);
  const wrongAttemptCount = performances.reduce((total, perf) => total + perf.wrongCount, 0);
  const firstTryCorrectCount = performances.filter((perf) => perf.firstAttemptCorrect === true).length;
  const avgReactionTimeMs = reactionTimes.length
    ? reactionTimes.reduce((total, time) => total + time, 0) / reactionTimes.length
    : 0;

  const wordById = new Map(words.map((word) => [word.id, word]));
  const weakWords = performances
    .map((perf) => {
      const slowCount = perf.reactionTimesMs.filter((time) => time > CONFIG.SLOW_THRESHOLD_MS).length;
      const riskScore = perf.wrongCount * 3 + slowCount + (perf.resolved ? 0 : 5);
      return { ...perf, riskScore, word: wordById.get(perf.wordId) };
    })
    .filter((item) => item.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  return {
    reason,
    score: session.score,
    completedWordCount: resolved.length,
    totalWordCount: words.length,
    firstTryCorrectCount,
    wrongAttemptCount,
    avgReactionTimeMs,
    weakWords,
    finalSnakeWords
  };
}
