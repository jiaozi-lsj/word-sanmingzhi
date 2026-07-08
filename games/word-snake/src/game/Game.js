import { CONFIG } from '../config.js';
import { TEST_WORDS } from '../data/words.js';
import { clamp, uid } from '../utils/math.js';
import { AudioSystem } from './AudioSystem.js';
import { CollisionSystem } from './CollisionSystem.js';
import { EnemySnake } from './EnemySnake.js';
import { EnergyManager } from './EnergyManager.js';
import { InputController } from './InputController.js';
import { PowerUpManager } from './PowerUpManager.js';
import { Renderer } from './Renderer.js';
import { calculateResult } from './ResultCalculator.js';
import { ScoreSystem } from './ScoreSystem.js';
import { Snake } from './Snake.js';
import { WordQueue } from './WordQueue.js';

export class Game {
  constructor({ canvas, joystickRoot, boostButton, hudView, words = TEST_WORDS, onEnd }) {
    this.canvas = canvas;
    this.joystickRoot = joystickRoot;
    this.boostButton = boostButton;
    this.hudView = hudView;
    this.words = words.slice(0, CONFIG.WORD_COUNT);
    this.onEnd = onEnd;

    this.bounds = { width: CONFIG.MAP_WIDTH, height: CONFIG.MAP_HEIGHT };
    this.renderer = new Renderer(canvas);
    this.snake = new Snake(this.bounds);
    this.energy = new EnergyManager(this.bounds);
    this.powerUps = new PowerUpManager(this.bounds);
    this.score = new ScoreSystem();
    this.input = new InputController({
      canvas,
      joystickRoot,
      boostButton,
      options: {
        onPauseToggle: () => this.togglePause(),
        onAutoPause: () => this.autoPause()
      }
    });

    this.state = 'home';
    this.beforePauseState = 'playing';
    this.raf = 0;
    this.lastTimestamp = 0;
    this.audioEnabled = true;
    this.audio = new AudioSystem();
    this.fx = [];
    this.enemies = [];
    this.camera = { x: 0, y: 0 };
    this.powerBoostUntil = 0;
    this.shieldUntil = 0;
    this.magnetUntil = 0;
  }

  start() {
    this.queue = new WordQueue(this.words);
    this.currentWord = this.queue.start();
    this.session = this.createSession();
    this.score.reset();
    this.timeLeftMs = CONFIG.ROUND_TIME_SEC * 1000;
    this.countdownMs = 3000;
    this.feedbackUntil = 0;
    this.invincibleUntil = 0;
    this.pendingAdvance = false;
    this.pendingRefillAt = 0;
    this.pendingEndReason = null;
    this.powerBoostUntil = 0;
    this.shieldUntil = 0;
    this.magnetUntil = 0;
    this.state = 'countdown';
    this.fx = [];
    this.enemies = Array.from(
      { length: CONFIG.ENEMY_SNAKE_COUNT },
      (_, index) => new EnemySnake(index, this.bounds)
    );

    this.snake.reset(this.currentWord);
    this.camera = { x: this.snake.head.x, y: this.snake.head.y };
    this.energy.spawnFor(this.currentWord, this.words, this.snake.snapshot());
    this.powerUps.spawn(this.snake.snapshot(), this.energy.orbs);
    this.input.bind();
    this.playTone('start');
    this.audio.startBgm();
    this.lastTimestamp = performance.now();
    this.raf = requestAnimationFrame((time) => this.loop(time));
  }

  createSession() {
    const performanceByWord = {};
    for (const word of this.words) {
      performanceByWord[word.id] = {
        wordId: word.id,
        attempts: 0,
        wrongCount: 0,
        correctCount: 0,
        firstAttemptCorrect: null,
        reactionTimesMs: [],
        resolved: false,
        repeatCount: 0,
        targetStartedAt: 0
      };
    }

    return {
      sessionId: uid('session'),
      startedAt: Date.now(),
      status: 'playing',
      score: 0,
      lives: CONFIG.INITIAL_LIVES,
      completedWordIds: [],
      performance: performanceByWord
    };
  }

  loop(timestamp) {
    const dt = clamp(timestamp - this.lastTimestamp, 0, 50);
    this.lastTimestamp = timestamp;
    this.update(dt, timestamp);
    const snapshot = this.snapshot(timestamp);
    this.renderer.render(snapshot);
    this.hudView.update(snapshot);

    if (this.state !== 'result') {
      this.raf = requestAnimationFrame((time) => this.loop(time));
    }
  }

  update(dt, now) {
    this.fx = this.fx.filter((item) => now - item.createdAt < item.duration);
    this.energy.update(now);
    if (now < this.magnetUntil) {
      this.energy.attractTo(this.snake.head, dt);
    }

    if (this.state === 'paused' || this.state === 'result') return;

    if (this.state === 'countdown') {
      this.countdownMs -= dt;
      if (this.countdownMs <= 0) {
        this.state = 'playing';
        this.startTargetTimer(now);
      }
      return;
    }

    if (this.state === 'playing' || this.state === 'feedback') {
      this.timeLeftMs -= dt;
      if (this.timeLeftMs <= 0) {
        this.end('timeout', now);
        return;
      }

      const speedScale = this.state === 'feedback' ? 0.55 : this.currentSpeedScale();
      const intent = this.input.getIntent();
      this.snake.update(dt, intent, speedScale, now);
      for (const enemy of this.enemies) enemy.update(dt, now);
      this.updateCamera();

      if (this.pendingRefillAt && now >= this.pendingRefillAt) {
        this.energy.refillDistractor(
          this.currentWord,
          this.words,
          this.snake.snapshot(),
          this.powerUps.snapshot()
        );
        this.pendingRefillAt = 0;
      }

      if (this.state === 'feedback') {
        if (now >= this.feedbackUntil) this.finishFeedback(now);
        return;
      }

      this.checkOperationCollisions(now);
      this.checkEnergyCollision(now);
      this.checkPowerUpCollision(now);
    }
  }

  currentSpeedScale() {
    if (!this.currentWord) return 1;
    const perf = this.session.performance[this.currentWord.id];
    let scale = perf?.wrongCount >= 2 ? 0.8 : 1;
    if (performance.now() < this.powerBoostUntil) scale *= 1.35;
    return scale;
  }

  updateCamera() {
    this.camera.x += (this.snake.head.x - this.camera.x) * CONFIG.CAMERA_LERP;
    this.camera.y += (this.snake.head.y - this.camera.y) * CONFIG.CAMERA_LERP;
    this.camera.x = clamp(
      this.camera.x,
      CONFIG.WORLD_WIDTH / 2,
      this.bounds.width - CONFIG.WORLD_WIDTH / 2
    );
    this.camera.y = clamp(
      this.camera.y,
      CONFIG.WORLD_HEIGHT / 2,
      this.bounds.height - CONFIG.WORLD_HEIGHT / 2
    );
  }

  startTargetTimer(now) {
    if (this.currentWord) {
      this.session.performance[this.currentWord.id].targetStartedAt = now;
    }
  }

  checkOperationCollisions(now) {
    if (now < this.invincibleUntil) return;

    const wallSide = CollisionSystem.checkWall(this.snake.head, this.bounds);
    if (wallSide) {
      this.takeOperationDamage('碰到边界', now);
      this.snake.resolveWallCollision(wallSide);
      return;
    }

    if (CollisionSystem.checkBody(this.snake.head, this.snake.solidSegments)) {
      this.takeOperationDamage('碰到自己', now);
      this.snake.nudgeAwayFromBody();
      return;
    }

    if (CollisionSystem.checkEnemy(this.snake.head, this.enemies.map((enemy) => enemy.snapshot()))) {
      this.takeOperationDamage('碰到其他蛇', now);
      this.snake.nudgeAwayFromBody();
    }
  }

  takeOperationDamage(label, now) {
    if (now < this.shieldUntil) {
      this.shieldUntil = 0;
      this.addFx('护盾挡住了', this.snake.head.x, this.snake.head.y - 30, '#4D96FF');
      this.playTone('power');
      return;
    }
    this.session.lives -= 1;
    this.invincibleUntil = now + CONFIG.INVINCIBLE_MS;
    this.addFx(label, this.snake.head.x, this.snake.head.y - 26, '#FF6B6B');
    this.playTone('bump');
    if (this.session.lives <= 0) {
      this.pendingEndReason = 'no_lives';
      this.state = 'feedback';
      this.feedbackUntil = now + 360;
    }
  }

  checkEnergyCollision(now) {
    const orb = CollisionSystem.checkEnergy(this.snake.head, this.energy.orbs);
    if (!orb || !this.currentWord) return;

    if (orb.sourceWordId === this.currentWord.id) {
      this.handleCorrectEnergy(orb, now);
    } else {
      this.handleWrongEnergy(orb, now);
    }
  }

  checkPowerUpCollision(now) {
    const item = this.powerUps.checkCollision(this.snake.head);
    if (!item) return;
    this.powerUps.consume(item.id);
    const until = now + CONFIG.POWER_UP_DURATION_MS;
    if (item.type === 'boost') {
      this.powerBoostUntil = until;
      this.addFx('加速', item.x, item.y, '#DFAE2B');
    } else if (item.type === 'shield') {
      this.shieldUntil = until;
      this.addFx('护盾', item.x, item.y, '#4D96FF');
    } else if (item.type === 'magnet') {
      this.magnetUntil = until;
      this.addFx('吸词', item.x, item.y, '#38B8A6');
    }
    this.playTone('power');
  }

  handleCorrectEnergy(orb, now) {
    const perf = this.session.performance[this.currentWord.id];
    perf.attempts += 1;
    const firstAttempt = perf.attempts === 1;
    if (perf.firstAttemptCorrect === null) perf.firstAttemptCorrect = firstAttempt;
    perf.correctCount += 1;
    perf.resolved = true;
    perf.reactionTimesMs.push(now - perf.targetStartedAt);

    this.queue.markCompleted(this.currentWord);
    if (!this.session.completedWordIds.includes(this.currentWord.id)) {
      this.session.completedWordIds.push(this.currentWord.id);
    }

    const gained = this.score.onCorrect(firstAttempt);
    this.session.score = this.score.score;
    this.snake.grow(this.currentWord);
    this.energy.markCorrect(orb.id);
    this.addFx(`+${gained.gained}`, orb.x, orb.y, '#2E8C4B');
    if (gained.comboBonus) this.addFx('成长闪光', this.snake.head.x, this.snake.head.y - 34, '#DFAE2B');
    this.audio.speakWord(this.currentWord.en);

    this.pendingAdvance = true;
    this.state = 'feedback';
    this.feedbackUntil = now + 260;
  }

  handleWrongEnergy(orb, now) {
    const perf = this.session.performance[this.currentWord.id];
    perf.attempts += 1;
    if (perf.firstAttemptCorrect === null) perf.firstAttemptCorrect = false;
    perf.wrongCount += 1;

    this.session.lives -= 1;
    this.score.onWrong();
    this.session.score = this.score.score;
    this.energy.markWrong(orb.id, now);
    this.pendingRefillAt = now + 400;
    this.addFx('再想一想', orb.x, orb.y, '#FF6B6B');
    this.playTone('wrong');

    this.state = 'feedback';
    this.feedbackUntil = now + 260;
    if (this.session.lives <= 0) this.pendingEndReason = 'no_lives';
  }

  finishFeedback(now) {
    if (this.pendingEndReason) {
      this.end(this.pendingEndReason, now);
      return;
    }

    if (this.pendingAdvance) {
      const resolvedWord = this.currentWord;
      const perf = this.session.performance[resolvedWord.id];
      this.queue.maybeReinsert(resolvedWord, perf);
      this.currentWord = this.queue.advance();
      this.pendingAdvance = false;

      if (!this.currentWord) {
        this.end('completed', now);
        return;
      }

      this.snake.setGhostWord(this.currentWord);
      this.energy.spawnFor(
        this.currentWord,
        this.words,
        this.snake.snapshot(),
        this.powerUps.snapshot()
      );
      this.startTargetTimer(now);
    }

    this.state = 'playing';
  }

  end(reason, now) {
    if (this.state === 'result') return;
    if (reason === 'completed') {
      this.score.onCompleted(Math.floor(this.timeLeftMs / 1000));
    }

    this.state = 'result';
    this.session.endedAt = Date.now();
    this.session.status = reason;
    this.session.score = this.score.score;
    this.session.lives = this.session.lives;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.audio.stopBgm();

    const result = calculateResult(this.session, this.words, this.snake.getFinalWords(), reason);
    this.onEnd?.(result);
  }

  togglePause() {
    if (this.state === 'paused') {
      this.state = this.beforePauseState;
      this.lastTimestamp = performance.now();
      return;
    }

    if (['countdown', 'playing', 'feedback'].includes(this.state)) {
      this.beforePauseState = this.state;
      this.state = 'paused';
    }
  }

  autoPause() {
    if (['countdown', 'playing', 'feedback'].includes(this.state)) {
      this.beforePauseState = this.state;
      this.state = 'paused';
    }
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    this.audio.setEnabled(this.audioEnabled);
    return this.audioEnabled;
  }

  playTone(kind) {
    if (!this.audioEnabled) return;
    this.audio.playTone(kind);
  }

  addFx(text, x, y, color) {
    this.fx.push({
      id: uid('fx'),
      text,
      x,
      y,
      color,
      createdAt: performance.now(),
      duration: 760
    });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.audio.destroy();
    this.state = 'result';
  }

  snapshot(now = performance.now()) {
    return {
      state: this.state,
      now,
      countdownMs: this.countdownMs,
      timeLeftMs: this.timeLeftMs,
      lives: this.session?.lives ?? CONFIG.INITIAL_LIVES,
      score: this.score.score,
      combo: this.score.combo,
      progressDone: this.queue?.progressDone() ?? 0,
      progressTotal: this.queue?.progressTotal() ?? this.words.length,
      currentWord: this.currentWord,
      words: this.words,
      invincible: now < this.invincibleUntil,
      boost: this.input.boost,
      activePowers: {
        boost: now < this.powerBoostUntil,
        shield: now < this.shieldUntil,
        magnet: now < this.magnetUntil
      },
      camera: { ...this.camera },
      map: { ...this.bounds },
      snake: this.snake.snapshot(),
      orbs: this.energy.snapshot(),
      powerUps: this.powerUps.snapshot(),
      enemies: this.enemies.map((enemy) => enemy.snapshot()),
      fx: this.fx.map((item) => ({ ...item }))
    };
  }
}
