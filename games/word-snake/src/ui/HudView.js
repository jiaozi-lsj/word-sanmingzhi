import { formatTime } from '../utils/math.js';

export class HudView {
  constructor(root, { onPause, onAudioToggle }) {
    this.root = root;
    this.onPause = onPause;
    this.onAudioToggle = onAudioToggle;
    this.audioOn = true;
  }

  render() {
    this.root.innerHTML = '';

    document.querySelector('[data-action="pause"]')?.addEventListener('click', this.onPause);
    document.querySelector('[data-action="audio"]')?.addEventListener('click', () => {
      this.audioOn = this.onAudioToggle();
      const audioButton = document.querySelector('[data-action="audio"]');
      if (audioButton) audioButton.textContent = this.audioOn ? '♪' : '×';
    });
  }

  update(snapshot) {
    this.latestStatus = `${snapshot.progressDone}/${snapshot.progressTotal}, Score ${snapshot.score}, ${formatTime(snapshot.timeLeftMs)}, target ${snapshot.currentWord?.en || 'done'}`;
  }
}
