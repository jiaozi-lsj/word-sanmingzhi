import { CONFIG } from '../config.js';
import {
  angleFromVector,
  capsuleSizeForText,
  clamp,
  moveAngleToward,
  normalizeVector,
  uid
} from '../utils/math.js';
import { PathFollower } from './PathFollower.js';

export class Snake {
  constructor(bounds) {
    this.bounds = bounds;
    this.path = new PathFollower(CONFIG.SAMPLE_GAP);
    this.head = {
      x: bounds.width / 2,
      y: bounds.height / 2,
      radius: 26,
      angle: 0,
      targetAngle: 0,
      speed: CONFIG.SNAKE_SPEED,
      maxTurnRate: CONFIG.TURN_RATE
    };
    this.angle = 0;
    this.targetAngle = 0;
    this.solidSegments = [];
    this.targetWord = null;
  }

  reset(currentWord) {
    this.head = {
      x: this.bounds.width / 2,
      y: this.bounds.height / 2,
      radius: 26,
      angle: 0,
      targetAngle: 0,
      speed: CONFIG.SNAKE_SPEED,
      maxTurnRate: CONFIG.TURN_RATE
    };
    this.angle = 0;
    this.targetAngle = 0;
    this.solidSegments = [];

    for (let i = 0; i < CONFIG.BASE_BODY_BEADS; i += 1) {
      this.solidSegments.push(this.createSegment(null, '', true));
    }

    this.path.reset(this.head, { x: Math.cos(this.angle), y: Math.sin(this.angle) }, this.maxPathDistance());
    this.setGhostWord(currentWord);
    this.updateSegments(performance.now());
  }

  createSegment(word, label, base = false) {
    const size = word ? capsuleSizeForText(word.en, 'en') : { width: 46, height: 46, fontSize: 13 };
    return {
      id: uid(base ? 'base' : 'seg'),
      type: base ? 'base' : 'word',
      wordId: word?.id,
      label,
      x: this.head.x,
      y: this.head.y,
      angle: this.angle,
      width: Math.max(44, Math.min(64, size.width * 0.52)),
      height: 44,
      radius: 22,
      fontSize: size.fontSize,
      alpha: base ? 1 : CONFIG.GHOST_ALPHA,
      bornAt: base ? 0 : performance.now()
    };
  }

  maxPathDistance() {
    return (this.solidSegments.length + 6) * CONFIG.SEGMENT_SPACING + 360;
  }

  update(dtMs, intent, speedScale = 1, now = performance.now()) {
    const vector = normalizeVector(intent?.direction || { x: 0, y: 0 });
    if (vector.length > 0.12) {
      this.targetAngle = angleFromVector(vector);
    }

    this.angle = moveAngleToward(this.angle, this.targetAngle, this.head.maxTurnRate * (dtMs / 1000));
    const boostScale = intent?.boost ? CONFIG.BOOST_SPEED_MULTIPLIER : 1;
    const currentSpeed = CONFIG.SNAKE_SPEED * speedScale * boostScale;
    const distance = currentSpeed * (dtMs / 1000);
    this.head.x += Math.cos(this.angle) * distance;
    this.head.y += Math.sin(this.angle) * distance;
    this.head.angle = this.angle;
    this.head.targetAngle = this.targetAngle;
    this.head.speed = currentSpeed;
    this.head.maxTurnRate = CONFIG.TURN_RATE;
    this.path.append(this.head, this.maxPathDistance());
    this.updateSegments(now);
  }

  updateSegments(now) {
    this.solidSegments.forEach((segment, index) => {
      const sample = this.path.sampleWithAngle((index + 1) * CONFIG.SEGMENT_SPACING);
      segment.x = sample.point.x;
      segment.y = sample.point.y;
      segment.angle = sample.angle;
      if (segment.bornAt) {
        const t = clamp((now - segment.bornAt) / 320, 0, 1);
        segment.alpha = 0.35 + t * 0.65;
        if (t >= 1) segment.bornAt = 0;
      }
    });
  }

  setGhostWord(word) {
    this.targetWord = word || null;
  }

  grow(word) {
    this.solidSegments.push(this.createSegment(word, word.en));
  }

  resolveWallCollision(side) {
    const r = this.head.radius;
    const recoveryPadding = 14;
    this.head.x = clamp(this.head.x, r + recoveryPadding, this.bounds.width - r - recoveryPadding);
    this.head.y = clamp(this.head.y, r + recoveryPadding, this.bounds.height - r - recoveryPadding);

    let reboundAngle;
    if (side === 'left' || side === 'right') {
      reboundAngle = Math.PI - this.angle;
    } else {
      reboundAngle = -this.angle;
    }

    this.angle = reboundAngle;
    this.targetAngle = reboundAngle;
    this.head.angle = this.angle;
    this.head.targetAngle = this.targetAngle;
    this.path.append(this.head, this.maxPathDistance());
    this.updateSegments(performance.now());
  }

  nudgeAwayFromBody() {
    this.head.x -= Math.cos(this.angle) * 44;
    this.head.y -= Math.sin(this.angle) * 44;
    this.targetAngle = this.angle + Math.PI * 0.55;
    this.head.angle = this.angle;
    this.head.targetAngle = this.targetAngle;
    this.path.append(this.head, this.maxPathDistance());
  }

  getFinalWords() {
    return this.solidSegments
      .filter((segment) => segment.wordId)
      .map((segment) => ({ wordId: segment.wordId, label: segment.label }));
  }

  snapshot() {
    return {
      head: { ...this.head },
      solidSegments: this.solidSegments.map((segment) => ({ ...segment })),
      ghost: null,
      targetWord: this.targetWord
    };
  }
}
