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
  const completedIds = new Set(session.completedWordIds);
  const weakWords = performances
    .map((perf) => {
      const slowCount = perf.reactionTimesMs.filter((time) => time > CONFIG.SLOW_THRESHOLD_MS).length;
      const riskScore = perf.wrongCount * 3 + slowCount + (perf.resolved ? 0 : 5);
      return { ...perf, riskScore, word: wordById.get(perf.wordId) };
    })
    .filter((item) => item.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
  const wordResults = words.map((word) => {
    const passed = completedIds.has(word.id);
    return {
      word,
      passed,
      status: passed ? '已过关' : '重点复习'
    };
  });
  const durationSec = session.endedAt && session.startedAt
    ? Math.max(1, Math.round((session.endedAt - session.startedAt) / 1000))
    : CONFIG.ROUND_TIME_SEC;
  const firstAccuracy = words.length
    ? Math.round((firstTryCorrectCount / words.length) * 100)
    : 0;

  return {
    reason,
    score: session.score,
    completedWordCount: resolved.length,
    totalWordCount: words.length,
    unpassedWordCount: wordResults.filter((item) => !item.passed).length,
    firstTryCorrectCount,
    firstAccuracy,
    wrongAttemptCount,
    avgReactionTimeMs,
    durationSec,
    weakWords,
    finalSnakeWords,
    wordResults
  };
}
