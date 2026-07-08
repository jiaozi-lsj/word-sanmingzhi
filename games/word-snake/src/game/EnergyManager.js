import { CONFIG, ORB_PALETTES } from '../config.js';
import { capsuleSizeForText, distance, shuffle, uid } from '../utils/math.js';

export class EnergyManager {
  constructor(bounds) {
    this.bounds = bounds;
    this.orbs = [];
  }

  clear() {
    this.orbs = [];
  }

  spawnFor(currentWord, allWords, snakeSnapshot, avoidPoints = []) {
    this.orbs = [];
    const choices = this.pickChoices(currentWord, allWords, CONFIG.ORB_COUNT - 1);
    const entries = shuffle([currentWord, ...choices]);

    for (const [index, word] of entries.entries()) {
      const size = capsuleSizeForText(word.zh, 'zh');
      const position = this.findPosition(size, snakeSnapshot, index, avoidPoints);
      this.orbs.push({
        id: uid('orb'),
        zh: word.zh,
        sourceWordId: word.id,
        isCorrectForCurrent: word.id === currentWord.id,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        radius: size.height / 2,
        fontSize: size.fontSize,
        palette: ORB_PALETTES[index % ORB_PALETTES.length],
        state: 'idle',
        removeAt: 0,
        spawnAt: performance.now()
      });
    }
  }

  pickChoices(currentWord, allWords, count) {
    const seen = new Set([currentWord.zh]);
    const distractors = [];
    for (const word of shuffle(allWords)) {
      if (word.id === currentWord.id || seen.has(word.zh)) continue;
      distractors.push(word);
      seen.add(word.zh);
      if (distractors.length >= count) break;
    }
    return distractors;
  }

  findPosition(size, snakeSnapshot, seed, avoidPoints = []) {
    const relaxed = { head: CONFIG.SAFE_HEAD_DISTANCE, body: CONFIG.SAFE_BODY_DISTANCE };
    const head = snakeSnapshot.head;
    const halfW = CONFIG.WORLD_WIDTH / 2 - CONFIG.VIEW_SPAWN_PADDING;
    const halfH = CONFIG.WORLD_HEIGHT / 2 - CONFIG.VIEW_SPAWN_PADDING;
    const minX = Math.max(CONFIG.SAFE_EDGE + size.width / 2, head.x - halfW);
    const maxX = Math.min(this.bounds.width - CONFIG.SAFE_EDGE - size.width / 2, head.x + halfW);
    const minY = Math.max(CONFIG.SAFE_EDGE + size.height / 2, head.y - halfH);
    const maxY = Math.min(this.bounds.height - CONFIG.SAFE_EDGE - size.height / 2, head.y + halfH);

    for (let attempt = 0; attempt < CONFIG.MAX_SPAWN_ATTEMPTS; attempt += 1) {
      if (attempt > 30) {
        relaxed.head = 110;
        relaxed.body = 36;
      }
      const baseAngle = seed * 1.74 + Math.random() * 0.65;
      const radius =
        CONFIG.ORB_CLUSTER_MIN_RADIUS +
        Math.random() * (CONFIG.ORB_CLUSTER_MAX_RADIUS - CONFIG.ORB_CLUSTER_MIN_RADIUS);
      const x = Math.min(maxX, Math.max(minX, head.x + Math.cos(baseAngle) * radius));
      const y = Math.min(maxY, Math.max(minY, head.y + Math.sin(baseAngle) * radius * 0.72));
      const candidate = { x, y };
      if (this.isSafe(candidate, snakeSnapshot, relaxed, avoidPoints)) return candidate;
    }

    return {
      x: Math.min(maxX, Math.max(minX, head.x + (seed - 2) * 120)),
      y: Math.min(maxY, Math.max(minY, head.y + (seed % 2 ? 160 : -160)))
    };
  }

  isSafe(candidate, snakeSnapshot, relaxed, avoidPoints = []) {
    if (distance(candidate, snakeSnapshot.head) < relaxed.head) return false;
    if (this.orbs.some((orb) => distance(candidate, orb) < CONFIG.SAFE_ORB_DISTANCE)) return false;
    if (avoidPoints.some((item) => distance(candidate, item) < CONFIG.SAFE_ORB_DISTANCE + (item.radius || 24))) return false;
    const body = [...snakeSnapshot.solidSegments, snakeSnapshot.ghost].filter(Boolean);
    return body.every((segment) => distance(candidate, segment) >= relaxed.body);
  }

  markCorrect(orbId) {
    this.orbs = this.orbs.filter((orb) => orb.id !== orbId);
  }

  markWrong(orbId, now) {
    const orb = this.orbs.find((item) => item.id === orbId);
    if (!orb) return;
    orb.state = 'wrong';
    orb.removeAt = now + 260;
  }

  refillDistractor(currentWord, allWords, snakeSnapshot, avoidPoints = []) {
    const existingZh = new Set(this.orbs.map((orb) => orb.zh));
    const candidate = shuffle(allWords).find(
      (word) => word.id !== currentWord.id && !existingZh.has(word.zh)
    );
    if (!candidate) return;

    const size = capsuleSizeForText(candidate.zh, 'zh');
    const position = this.findPosition(size, snakeSnapshot, this.orbs.length + 1, avoidPoints);
    this.orbs.push({
      id: uid('orb'),
      zh: candidate.zh,
      sourceWordId: candidate.id,
      isCorrectForCurrent: false,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      radius: size.height / 2,
      fontSize: size.fontSize,
      palette: ORB_PALETTES[Math.floor(Math.random() * ORB_PALETTES.length)],
      state: 'idle',
      removeAt: 0,
      spawnAt: performance.now()
    });
  }

  update(now) {
    this.orbs = this.orbs.filter((orb) => !orb.removeAt || now < orb.removeAt);
  }

  attractTo(point, dtMs) {
    const pullRadius = 360;
    const maxMove = 90 * (dtMs / 1000);
    for (const orb of this.orbs) {
      if (orb.state !== 'idle') continue;
      const d = distance(point, orb);
      if (d > pullRadius || d < 1) continue;
      const strength = (1 - d / pullRadius) * maxMove;
      orb.x += ((point.x - orb.x) / d) * strength;
      orb.y += ((point.y - orb.y) / d) * strength;
    }
  }

  snapshot() {
    return this.orbs.map((orb) => ({ ...orb }));
  }
}
