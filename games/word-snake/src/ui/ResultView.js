import { GAME_COPY } from '../config.js';

export class ResultView {
  constructor(root, { result, onRestart, onHome }) {
    this.root = root;
    this.result = result;
    this.onRestart = onRestart;
    this.onHome = onHome;
  }

  render() {
    const title = GAME_COPY[this.result.reason] || GAME_COPY.completed;
    const avgSeconds = this.result.avgReactionTimeMs
      ? `${(this.result.avgReactionTimeMs / 1000).toFixed(1)}s`
      : '-';
    const weakList = this.result.weakWords.length
      ? this.result.weakWords
          .map((item) => `<li><strong>${item.word.en}</strong><span>${item.word.zh}</span></li>`)
          .join('')
      : '<li><strong>很稳</strong><span>本局没有明显薄弱词</span></li>';
    const snakeWords = this.result.finalSnakeWords.length
      ? this.result.finalSnakeWords.map((item) => `<span>${item.label}</span>`).join('')
      : '<span>继续挑战</span>';

    this.root.innerHTML = `
      <main class="result-view">
        <section class="result-panel" aria-labelledby="result-title">
          <p class="brand-kicker">学习结算</p>
          <h1 id="result-title">${title}</h1>
          <div class="final-snake" aria-label="最终蛇身">${snakeWords}</div>

          <div class="metrics-grid">
            <article><span>完成词数</span><strong>${this.result.completedWordCount}/${this.result.totalWordCount}</strong></article>
            <article><span>首次正确</span><strong>${this.result.firstTryCorrectCount}</strong></article>
            <article><span>错误次数</span><strong>${this.result.wrongAttemptCount}</strong></article>
            <article><span>平均反应</span><strong>${avgSeconds}</strong></article>
            <article><span>总分</span><strong>${this.result.score}</strong></article>
          </div>

          <section class="weak-section">
            <h2>薄弱词</h2>
            <ul>${weakList}</ul>
          </section>

          <div class="result-actions">
            <button class="primary-action compact" data-action="restart">再来一局</button>
            <button class="secondary-action" data-action="home">返回首页</button>
          </div>
        </section>
      </main>
    `;

    this.root.querySelector('[data-action="restart"]').addEventListener('click', this.onRestart);
    this.root.querySelector('[data-action="home"]').addEventListener('click', this.onHome);
  }
}
