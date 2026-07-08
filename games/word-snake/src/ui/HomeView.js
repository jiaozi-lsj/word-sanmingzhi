import { GAME_COPY } from '../config.js';

export class HomeView {
  constructor(root, { onStart }) {
    this.root = root;
    this.onStart = onStart;
  }

  render() {
    this.root.innerHTML = `
      <main class="home-view">
        <section class="home-hero" aria-labelledby="home-title">
          <div class="brand-lockup">
            <span class="brand-kicker">单词成长蛇</span>
            <h1 id="home-title">${GAME_COPY.title}</h1>
            <p>${GAME_COPY.subtitle}</p>
          </div>

          <div class="snake-preview" aria-hidden="true">
            <span class="preview-head"></span>
            <span class="preview-segment">forest</span>
            <span class="preview-segment">curious</span>
            <span class="preview-segment">protect</span>
            <span class="preview-segment preview-ghost">abandon</span>
          </div>

          <button class="primary-action" data-action="start">开始3分钟挑战</button>
          <p class="word-pack-note">本局10词 · 180秒 · 3生命</p>
        </section>

        <section class="steps-strip" aria-label="玩法步骤">
          <article>
            <strong>看英文</strong>
            <span>蛇尾的半透明目标节显示当前单词</span>
          </article>
          <article>
            <strong>吃中文</strong>
            <span>在地图里找到对应的中文词义</span>
          </article>
          <article>
            <strong>长蛇身</strong>
            <span>吃对后英文固化为真正蛇节</span>
          </article>
        </section>
      </main>
    `;

    this.root.querySelector('[data-action="start"]').addEventListener('click', this.onStart);
  }
}
