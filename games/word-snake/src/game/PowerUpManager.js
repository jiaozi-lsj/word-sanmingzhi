import { CONFIG } from '../config.js';
import { distance, randomInt, shuffle, uid } from '../utils/math.js';

const POWER_UP_TYPES = [
  { id: 'boost', label: '加速', icon: '⚡', fill: '#FFE681', stroke: '#DFAE2B' },
  { id: 'shield', label: '护盾', icon: '◇', fill: '#D8EAFF', stroke: '#4D96FF' },
  { id: 'magnet', label: '吸词', icon: '◎', fill: '#D8FFF5', stroke: '#38B8A6' }
];

export class PowerUpManager {
  constructor(bounds) {
    this.bounds = bounds;
    this.items = [];
  }

  spawn(snakeSnapshot, avoidPoints = []) {
    this.items = [];
    for (const type of shuffle(POWER_UP_TYPES).slice(0, CONFIG.POWER_UP_COUNT)) {
      this.items.push(this.createItem(type, snakeSnapshot, avoidPoints));
    }
  }

  createItem(type, snakeSnapshot, avoidPoints) {
    const position = this.findPosition(snakeSnapshot, avoidPoints);
    return {
      id: uid('power'),
      type: type.id,
      label: type.label,
      icon: type.icon,
      fill: type.fill,
      stroke: type.stroke,
      x: position.x,
      y: position.y,
      radius: CONFIG.POWER_UP_RADIUS,
      spawnAt: performance.now()
    };
  }

  findPosition(snakeSnapshot, avoidPoints) {
    const head = snakeSnapshot.head;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomInt(320, 620);
      const candidate = {
        x: Math.max(CONFIG.SAFE_EDGE, Math.min(this.bounds.width - CONFIG.SAFE_EDGE, head.x + Math.cos(angle) * radius)),
        y: Math.max(CONFIG.SAFE_EDGE, Math.min(this.bounds.height - CONFIG.SAFE_EDGE, head.y + Math.sin(angle) * radius))
      };
      if (distance(candidate, head) < 260) continue;
      if (this.items.some((item) => distance(candidate, item) < 150)) continue;
      if (avoidPoints.some((item) => distance(candidate, item) < 150)) continue;
      return candidate;
    }
    return {
      x: Math.min(this.bounds.width - CONFIG.SAFE_EDGE, head.x + 360),
      y: Math.min(this.bounds.height - CONFIG.SAFE_EDGE, head.y + 240)
    };
  }

  checkCollision(head) {
    return this.items.find((item) => distance(head, item) <= head.radius + item.radius * 0.85);
  }

  consume(itemId) {
    this.items = this.items.filter((item) => item.id !== itemId);
  }

  snapshot() {
    return this.items.map((item) => ({ ...item }));
  }
}
