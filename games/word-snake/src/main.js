import { TEST_WORDS } from './data/words.js';
import { Game } from './game/Game.js';
import { HomeView } from './ui/HomeView.js';
import { HudView } from './ui/HudView.js';
import { ResultView } from './ui/ResultView.js';
import { TutorialView } from './ui/TutorialView.js';
import { getStoredBoolean, setStoredBoolean } from './utils/storage.js';

const root = document.querySelector('#app');
let currentGame = null;

function renderHome() {
  currentGame?.destroy();
  currentGame = null;
  new HomeView(root, {
    onStart: () => {
      if (getStoredBoolean('wordSnakeTutorialSeen')) {
        renderGame();
      } else {
        new TutorialView(root, {
          onClose: () => {
            setStoredBoolean('wordSnakeTutorialSeen', true);
            renderGame();
          }
        }).render();
      }
    }
  }).render();
}

function renderGame() {
  currentGame?.destroy();
  root.innerHTML = `
    <main class="game-view">
      <section class="canvas-wrap">
        <canvas id="game-canvas" width="1200" height="675" aria-label="Word Snake 游戏画布"></canvas>
        <header class="game-hud" aria-live="polite" aria-label="游戏状态"></header>
        <div class="corner-actions">
          <button class="icon-button" type="button" data-action="audio" aria-label="音效开关" title="音效开关">♪</button>
          <button class="icon-button" type="button" data-action="pause" aria-label="暂停" title="暂停">Ⅱ</button>
        </div>
        <div class="joystick-zone" aria-label="移动摇杆" role="application">
          <span class="joystick-knob"></span>
        </div>
        <button class="boost-button" type="button" aria-label="加速">
          <span>⚡</span>
        </button>
      </section>
    </main>
  `;

  const hud = new HudView(root.querySelector('.game-hud'), {
    onPause: () => currentGame?.togglePause(),
    onAudioToggle: () => currentGame?.toggleAudio()
  });
  hud.render();

  currentGame = new Game({
    canvas: root.querySelector('#game-canvas'),
    joystickRoot: root.querySelector('.joystick-zone'),
    boostButton: root.querySelector('.boost-button'),
    hudView: hud,
    words: TEST_WORDS,
    onEnd: (result) => renderResult(result)
  });
  currentGame.start();
}

function renderResult(result) {
  currentGame?.destroy();
  currentGame = null;
  new ResultView(root, {
    result,
    onRestart: renderGame,
    onHome: renderHome
  }).render();
}

renderHome();
