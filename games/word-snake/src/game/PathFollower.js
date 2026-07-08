import { distance, lerp } from '../utils/math.js';

export class PathFollower {
  constructor(sampleGap) {
    this.sampleGap = sampleGap;
    this.points = [];
    this.totalDistance = 0;
    this.lastSampleDistance = 0;
  }

  reset(start, direction, maxDistance) {
    this.totalDistance = maxDistance;
    this.lastSampleDistance = maxDistance;
    this.points = [];

    const backward = { x: -direction.x, y: -direction.y };
    const count = Math.ceil(maxDistance / this.sampleGap);
    for (let i = 0; i <= count; i += 1) {
      this.points.push({
        x: start.x + backward.x * i * this.sampleGap,
        y: start.y + backward.y * i * this.sampleGap,
        distance: maxDistance - i * this.sampleGap
      });
    }
  }

  append(point, maxDistance) {
    if (!this.points.length) {
      this.points = [{ x: point.x, y: point.y, distance: 0 }];
      this.totalDistance = 0;
      this.lastSampleDistance = 0;
      return;
    }

    const oldHead = this.points[0];
    const moved = distance(oldHead, point);
    if (moved <= 0.001) return;

    const previousDistance = this.totalDistance;
    this.totalDistance += moved;
    const newHead = { x: point.x, y: point.y, distance: this.totalDistance };
    const additions = [];

    while (this.lastSampleDistance + this.sampleGap <= this.totalDistance) {
      const nextDistance = this.lastSampleDistance + this.sampleGap;
      const t = (nextDistance - previousDistance) / moved;
      additions.unshift({
        x: lerp(oldHead.x, point.x, t),
        y: lerp(oldHead.y, point.y, t),
        distance: nextDistance
      });
      this.lastSampleDistance = nextDistance;
    }

    this.points = [newHead, ...additions, ...this.points.slice(1)];
    this.trim(maxDistance);
  }

  sample(distanceFromHead) {
    return this.sampleWithAngle(distanceFromHead).point;
  }

  sampleWithAngle(distanceFromHead) {
    if (this.points.length === 0) return { point: { x: 0, y: 0 }, angle: 0 };

    const targetDistance = this.totalDistance - distanceFromHead;
    if (targetDistance >= this.points[0].distance) {
      const head = this.points[0];
      const next = this.points[1] || head;
      return {
        point: { x: head.x, y: head.y },
        angle: Math.atan2(head.y - next.y, head.x - next.x)
      };
    }

    for (let i = 0; i < this.points.length - 1; i += 1) {
      const newer = this.points[i];
      const older = this.points[i + 1];
      if (newer.distance >= targetDistance && older.distance <= targetDistance) {
        const span = newer.distance - older.distance || 1;
        const t = (newer.distance - targetDistance) / span;
        return {
          point: {
            x: lerp(newer.x, older.x, t),
            y: lerp(newer.y, older.y, t)
          },
          angle: Math.atan2(newer.y - older.y, newer.x - older.x)
        };
      }
    }

    const last = this.points[this.points.length - 1];
    const prev = this.points[this.points.length - 2] || last;
    return {
      point: { x: last.x, y: last.y },
      angle: Math.atan2(prev.y - last.y, prev.x - last.x)
    };
  }

  trim(maxDistance) {
    const minDistance = this.totalDistance - maxDistance;
    while (this.points.length > 2 && this.points[this.points.length - 2].distance < minDistance) {
      this.points.pop();
    }
  }
}
