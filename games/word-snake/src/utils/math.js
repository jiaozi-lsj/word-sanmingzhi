import { DIRECTIONS } from '../config.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.0001) return { x: 0, y: 0, length: 0 };
  return { x: vector.x / length, y: vector.y / length, length };
}

export function angleFromVector(vector) {
  return Math.atan2(vector.y, vector.x);
}

export function shortestAngleDelta(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function moveAngleToward(current, target, maxStep) {
  const delta = shortestAngleDelta(current, target);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function isOpposite(a, b) {
  if (!a || !b) return false;
  const av = DIRECTIONS[a];
  const bv = DIRECTIONS[b];
  return av.x + bv.x === 0 && av.y + bv.y === 0;
}

export function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function capsuleSizeForText(text, language = 'en') {
  const length = text.length;
  if (language === 'zh') {
    return {
      width: clamp(58 + length * 18, 82, 148),
      height: 48,
      fontSize: length > 5 ? 16 : 18
    };
  }

  if (length <= 6) return { width: 72, height: 42, fontSize: 16 };
  if (length <= 10) return { width: 92, height: 42, fontSize: 15 };
  if (length <= 14) return { width: 112, height: 42, fontSize: 14 };
  return { width: 124, height: 42, fontSize: 13 };
}
