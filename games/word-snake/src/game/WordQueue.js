import { CONFIG } from '../config.js';
import { randomInt, shuffle } from '../utils/math.js';

export class WordQueue {
  constructor(words) {
    this.requiredIds = new Set(words.map((word) => word.id));
    this.pending = shuffle(words).slice(0, CONFIG.WORD_COUNT);
    this.currentWord = null;
    this.completedIds = new Set();
  }

  start() {
    this.currentWord = this.pending.shift() || null;
    return this.currentWord;
  }

  current() {
    return this.currentWord;
  }

  advance() {
    this.currentWord = this.pending.shift() || null;
    return this.currentWord;
  }

  markCompleted(word) {
    if (word) this.completedIds.add(word.id);
  }

  maybeReinsert(word, performance) {
    if (!CONFIG.ENABLE_REVIEW_REINSERTION || !word) return;
    if (performance.repeatCount >= CONFIG.MAX_REPEAT_PER_WORD) return;

    const hadWrong = performance.wrongCount > 0;
    const slow = performance.reactionTimesMs.some((time) => time > CONFIG.SLOW_THRESHOLD_MS);
    if (!hadWrong && (!slow || Math.random() >= 0.5)) return;

    performance.repeatCount += 1;
    const gap = hadWrong ? randomInt(3, 5) : randomInt(4, 6);
    const index = Math.min(this.pending.length, Math.max(0, gap - 1));
    this.pending.splice(index, 0, word);
  }

  progressTotal() {
    return this.requiredIds.size;
  }

  progressDone() {
    return this.completedIds.size;
  }
}
