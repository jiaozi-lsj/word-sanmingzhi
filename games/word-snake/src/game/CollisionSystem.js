export class CollisionSystem {
  static checkWall(head, bounds) {
    if (head.x - head.radius <= 0) return 'left';
    if (head.x + head.radius >= bounds.width) return 'right';
    if (head.y - head.radius <= 0) return 'top';
    if (head.y + head.radius >= bounds.height) return 'bottom';
    return null;
  }

  static checkEnergy(head, orbs) {
    return orbs.find((orb) => {
      if (orb.state !== 'idle') return false;
      const dx = Math.abs(head.x - orb.x);
      const dy = Math.abs(head.y - orb.y);
      return dx <= orb.width / 2 + head.radius * 0.7 && dy <= orb.height / 2 + head.radius * 0.8;
    });
  }

  static checkBody(head, segments) {
    if (segments.length < 8) return false;
    return segments.slice(6).some((segment) => {
      const radius = segment.radius || segment.height / 2 || 20;
      return Math.hypot(head.x - segment.x, head.y - segment.y) <= head.radius * 0.72 + radius * 0.7;
    });
  }

  static checkEnemy(head, enemies) {
    return enemies.find((enemy) => {
      return enemy.segments.some((segment) => {
        const radius = segment.radius || 20;
        return Math.hypot(head.x - segment.x, head.y - segment.y) <= head.radius * 0.72 + radius * 0.7;
      });
    });
  }
}
