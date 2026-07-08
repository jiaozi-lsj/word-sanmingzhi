export class TutorialView {
  constructor(root, { onClose }) {
    this.root = root;
    this.onClose = onClose;
  }

  render() {
    const layer = document.createElement('div');
    layer.className = 'tutorial-layer';
    layer.innerHTML = `
      <section class="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <h2 id="tutorial-title">先认识一下小蛇</h2>
        <ol>
          <li><strong>目标蛇节</strong><span>这里显示你现在要找的英文单词。</span></li>
          <li><strong>中文能量</strong><span>在地图里找到正确的中文意思。</span></li>
          <li><strong>成长蛇身</strong><span>吃对后，英文会变成真正的蛇身。</span></li>
        </ol>
        <button class="primary-action compact" data-action="close">我知道了</button>
      </section>
    `;
    this.root.appendChild(layer);
    layer.querySelector('[data-action="close"]').addEventListener('click', () => {
      layer.remove();
      this.onClose();
    });
  }
}
