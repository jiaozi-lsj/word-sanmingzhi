import { GAME_COPY } from '../config.js';

function todayText() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildReviewReport(result) {
  const lines = [
    '【Word Snake 单词贪吃蛇复习结果】',
    `日期：${todayText()}`,
    '昵称：小勇士',
    `总单词数：${result.totalWordCount}`,
    `未过关单词数：${result.unpassedWordCount}`,
    `首次正确率：${result.firstAccuracy}%`,
    `用时：${result.durationSec} 秒`,
    '',
    '单词过关情况：',
    ...result.wordResults.map((item, index) =>
      `${index + 1}. ${item.word.en} - ${item.word.zh}：${item.status}`
    )
  ];
  return lines.join('\n');
}

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
    const snakeWords = this.result.finalSnakeWords.length
      ? this.result.finalSnakeWords.map((item) => `<span>${item.label}</span>`).join('')
      : '<span>继续挑战</span>';
    const report = buildReviewReport(this.result);

    this.root.innerHTML = `
      <main class="result-view">
        <section class="result-panel" aria-labelledby="result-title">
          <p class="brand-kicker">学习结算</p>
          <h1 id="result-title">${title}</h1>
          <div class="final-snake" aria-label="最终蛇身">${snakeWords}</div>

          <div class="metrics-grid">
            <article><span>完成词数</span><strong>${this.result.completedWordCount}/${this.result.totalWordCount}</strong></article>
            <article><span>未过关</span><strong>${this.result.unpassedWordCount}</strong></article>
            <article><span>首次正确率</span><strong>${this.result.firstAccuracy}%</strong></article>
            <article><span>平均反应</span><strong>${avgSeconds}</strong></article>
            <article><span>总分</span><strong>${this.result.score}</strong></article>
          </div>

          <section class="copy-card" aria-labelledby="review-title">
            <div class="copy-card-head">
              <h2 id="review-title">今日复习报告</h2>
              <button class="secondary-action compact" data-action="copy">复制</button>
            </div>
            <pre id="review-report">${report}</pre>
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
    this.root.querySelector('[data-action="copy"]').addEventListener('click', async () => {
      const text = this.root.querySelector('#review-report').textContent;
      try {
        await navigator.clipboard.writeText(text);
        this.root.querySelector('[data-action="copy"]').textContent = '已复制';
      } catch {
        prompt('复制以下复习结果：', text);
      }
    });
  }
}
