export class ScoreSystem {
  constructor() {
    this.score = 0;
    this.combo = 0;
  }

  reset() {
    this.score = 0;
    this.combo = 0;
  }

  onCorrect(firstAttempt) {
    this.combo += 1;
    const base = firstAttempt ? 100 : 70;
    const comboBonus = this.combo > 0 && this.combo % 3 === 0 ? 50 : 0;
    this.score += base + comboBonus;
    return { gained: base + comboBonus, comboBonus };
  }

  onWrong() {
    this.combo = 0;
    this.score = Math.max(0, this.score - 20);
  }

  onCompleted(remainingSeconds) {
    this.score += 300 + Math.max(0, remainingSeconds) * 2;
  }
}
