import { CONFIG } from '../config.js';
import { clamp, moveAngleToward, randomInt, uid } from '../utils/math.js';
import { PathFollower } from './PathFollower.js';

const ENEMY_COLORS = [
  { body: '#8B64D8', edge: '#5C3BA8' },
  { body: '#38B8A6', edge: '#1F8174' },
  { body: '#E16B5C', edge: '#A33B32' },
  { body: '#DFAE2B', edge: '#A97B12' },
  { body: '#4D96FF', edge: '#2867B5' }
];

export class EnemySnake {
  constructor(index, bounds) {
    this.id = uid('enemy');
    this.bounds = bounds;
    this.color = ENEMY_COLORS[index % ENEMY_COLORS.length];
    this.path = new PathFollower(CONFIG.SAMPLE_GAP);
    this.head = {
      x: randomInt(260, bounds.width - 260),
      y: randomInt(260, bounds.height - 260),
      radius: 22,
      angle: Math.random() * Math.PI * 2
    };
    this.angle = this.head.angle;
    this.turnSeed = Math.random() * 1000;
    this.segments = [];
    for (let i = 0; i < CONFIG.ENEMY_SEGMENTS; i += 1) {
      this.segments.push({
        id: uid('enemySeg'),
        x: this.head.x,
        y: this.head.y,
        angle: this.angle,
        radius: Math.max(15, 21 - i * 0.2)
      });
    }
    this.path.reset(this.head, { x: Math.cos(this.angle), y: Math.sin(this.angle) }, this.maxPathDistance());
    this.updateSegments();
  }

  maxPathDistance() {
    return (this.segments.length + 4) * CONFIG.SEGMENT_SPACING + 200;
  }

  update(dtMs, now) {
    const t = now / 1000 + this.turnSeed;
    const desired = this.angle + Math.sin(t * 0.7) * 0.8 + Math.sin(t * 0.23) * 0.35;
    this.angle = moveAngleToward(this.angle, desired, 1.6 * (dtMs / 1000));

    const margin = 130;
    if (this.head.x < margin) this.angle = moveAngleToward(this.angle, 0, 4 * (dtMs / 1000));
    if (this.head.x > this.bounds.width - margin) this.angle = moveAngleToward(this.angle, Math.PI, 4 * (dtMs / 1000));
    if (this.head.y < margin) this.angle = moveAngleToward(this.angle, Math.PI / 2, 4 * (dtMs / 1000));
    if (this.head.y > this.bounds.height - margin) this.angle = moveAngleToward(this.angle, -Math.PI / 2, 4 * (dtMs / 1000));

    const distance = CONFIG.ENEMY_SPEED * (dtMs / 1000);
    this.head.x = clamp(this.head.x + Math.cos(this.angle) * distance, 50, this.bounds.width - 50);
    this.head.y = clamp(this.head.y + Math.sin(this.angle) * distance, 50, this.bounds.height - 50);
    this.head.angle = this.angle;
    this.path.append(this.head, this.maxPathDistance());
    this.updateSegments();
  }

  updateSegments() {
    this.segments.forEach((segment, index) => {
      const sample = this.path.sampleWithAngle((index + 1) * CONFIG.SEGMENT_SPACING);
      segment.x = sample.point.x;
      segment.y = sample.point.y;
      segment.angle = sample.angle;
    });
  }

  snapshot() {
    return {
      id: this.id,
      color: this.color,
      head: { ...this.head },
      segments: this.segments.map((segment) => ({ ...segment }))
    };
  }
}
