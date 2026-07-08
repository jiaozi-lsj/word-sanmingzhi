import { CONFIG } from '../config.js';
import { formatTime } from '../utils/math.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sprite = new Image();
    this.sprite.src = './src/assets/snake-sprite.png';
  }

  render(snapshot) {
    this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
    this.drawBackground(ctx, snapshot);
    this.withWorld(ctx, snapshot, () => {
      this.drawPowerUps(ctx, snapshot.powerUps || [], snapshot.now);
      this.drawOrbs(ctx, snapshot.orbs, snapshot.now);
      this.drawEnemies(ctx, snapshot.enemies);
      this.drawSnake(ctx, snapshot.snake, snapshot);
      this.drawFx(ctx, snapshot.fx, snapshot.now);
    });
    this.drawHud(ctx, snapshot);
    this.drawOverlay(ctx, snapshot);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }
    this.ctx.setTransform(
      nextWidth / CONFIG.WORLD_WIDTH,
      0,
      0,
      nextHeight / CONFIG.WORLD_HEIGHT,
      0,
      0
    );
  }

  withWorld(ctx, snapshot, draw) {
    ctx.save();
    ctx.translate(CONFIG.WORLD_WIDTH / 2 - snapshot.camera.x, CONFIG.WORLD_HEIGHT / 2 - snapshot.camera.y);
    draw();
    ctx.restore();
  }

  drawBackground(ctx, snapshot) {
    const gradient = ctx.createLinearGradient(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
    gradient.addColorStop(0, '#F4F6FF');
    gradient.addColorStop(0.55, '#EEF4FF');
    gradient.addColorStop(1, '#F7FBFF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);

    const grid = 44;
    const offsetX = -((snapshot.camera.x - CONFIG.WORLD_WIDTH / 2) % grid);
    const offsetY = -((snapshot.camera.y - CONFIG.WORLD_HEIGHT / 2) % grid);
    ctx.save();
    ctx.strokeStyle = 'rgba(83, 91, 114, 0.18)';
    ctx.lineWidth = 1.2;
    for (let x = offsetX - grid; x < CONFIG.WORLD_WIDTH + grid; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CONFIG.WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = offsetY - grid; y < CONFIG.WORLD_HEIGHT + grid; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CONFIG.WORLD_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    this.withWorld(ctx, snapshot, () => {
      ctx.save();
      ctx.strokeStyle = 'rgba(32, 48, 64, 0.18)';
      ctx.lineWidth = 10;
      roundRect(ctx, 8, 8, snapshot.map.width - 16, snapshot.map.height - 16, 28);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawOrbs(ctx, orbs, now) {
    for (const orb of orbs) {
      ctx.save();
      const pulse = this.reducedMotion ? 0 : Math.sin((now - orb.spawnAt) / 420) * 2;
      const wrongShake = orb.state === 'wrong' ? Math.sin(now / 24) * 8 : 0;
      ctx.translate(orb.x + wrongShake, orb.y + pulse);
      ctx.globalAlpha = orb.state === 'wrong' ? 0.58 : 1;
      ctx.fillStyle = orb.state === 'wrong' ? '#FFD9D9' : orb.palette.fill;
      ctx.strokeStyle = orb.state === 'wrong' ? '#FF6B6B' : orb.palette.stroke;
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(30, 60, 90, 0.16)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 7;
      roundRect(ctx, -orb.width / 2, -orb.height / 2, orb.width, orb.height, orb.height / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();
      ctx.fillStyle = orb.state === 'wrong' ? '#8A2C2C' : orb.palette.ink;
      ctx.font = `800 ${orb.fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(orb.zh, 0, 1, orb.width - 18);
      ctx.restore();
    }
  }

  drawPowerUps(ctx, powerUps, now) {
    for (const item of powerUps) {
      const pulse = this.reducedMotion ? 0 : Math.sin((now - item.spawnAt) / 360) * 3;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = item.fill;
      ctx.strokeStyle = item.stroke;
      ctx.lineWidth = 4;
      ctx.shadowColor = `${item.stroke}66`;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();
      ctx.fillStyle = '#203040';
      ctx.font = '900 23px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, 0, 1);
      ctx.restore();
    }
  }

  drawEnemies(ctx, enemies) {
    for (const enemy of enemies) {
      const points = [enemy.head, ...enemy.segments];
      this.drawRibbon(ctx, points, enemy.color.body, 36, 0.36);
      for (let i = enemy.segments.length - 1; i >= 0; i -= 1) {
        const segment = enemy.segments[i];
        this.drawEnemyBead(ctx, segment, enemy.color);
      }
      this.drawEnemyHead(ctx, enemy.head, enemy.color);
    }
  }

  drawSnake(ctx, snake, snapshot) {
    const points = [snake.head, ...snake.solidSegments];
    this.drawRibbon(ctx, points, '#F13A2F', 43, 0.5);
    for (let i = snake.solidSegments.length - 1; i >= 0; i -= 1) {
      const segment = snake.solidSegments[i];
      this.drawBodyBead(ctx, segment, i);
    }
    this.drawTargetBubble(ctx, snake.head, snapshot.currentWord);
    this.drawPlayerHead(ctx, snake.head, snapshot.invincible, snapshot.boost);
  }

  drawRibbon(ctx, points, color, width, alpha) {
    if (points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i += 1) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  drawBodyBead(ctx, segment, index) {
    ctx.save();
    ctx.translate(segment.x, segment.y);
    ctx.rotate(segment.angle);
    ctx.globalAlpha = segment.alpha;
    const size = segment.type === 'word' ? 48 : 45;
    if (this.sprite.complete && this.sprite.naturalWidth) {
      ctx.drawImage(this.sprite, 56, 360, 300, 320, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = segmentColor(index);
      ctx.strokeStyle = '#A51F18';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    if (segment.wordId && segment.label) {
      ctx.save();
      ctx.translate(segment.x, segment.y - 31);
      ctx.fillStyle = 'rgba(255,255,255,0.76)';
      ctx.strokeStyle = 'rgba(32,48,64,0.16)';
      ctx.lineWidth = 1;
      roundRect(ctx, -34, -13, 68, 24, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#203040';
      ctx.font = '800 12px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(segment.label, 0, 0, 62);
      ctx.restore();
    }
  }

  drawPlayerHead(ctx, head, invincible, boost) {
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.angle);
    ctx.globalAlpha = invincible ? 0.58 + Math.sin(performance.now() / 80) * 0.22 : 1;
    const size = boost ? 62 : 56;
    if (boost) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#4DDBFF';
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (this.sprite.complete && this.sprite.naturalWidth) {
      ctx.drawImage(this.sprite, 900, 350, 330, 330, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#F13A2F';
      ctx.strokeStyle = '#A51F18';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, head.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(9, -9, 7, 0, Math.PI * 2);
      ctx.arc(9, 9, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#203040';
      ctx.beginPath();
      ctx.arc(12, -9, 3.5, 0, Math.PI * 2);
      ctx.arc(12, 9, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEnemyBead(ctx, segment, color) {
    ctx.save();
    ctx.translate(segment.x, segment.y);
    ctx.fillStyle = color.body;
    ctx.strokeStyle = color.edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, segment.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawEnemyHead(ctx, head, color) {
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.angle);
    ctx.fillStyle = color.body;
    ctx.strokeStyle = color.edge;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, head.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, -8, 5, 0, Math.PI * 2);
    ctx.arc(8, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#203040';
    ctx.beginPath();
    ctx.arc(10, -8, 2.3, 0, Math.PI * 2);
    ctx.arc(10, 8, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTargetBubble(ctx, head, word) {
    if (!word) return;
    const width = Math.max(86, Math.min(152, word.en.length * 11 + 36));
    const x = head.x;
    const y = head.y - 70;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.strokeStyle = 'rgba(77,150,255,0.82)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(77,150,255,0.22)';
    ctx.shadowBlur = 16;
    roundRect(ctx, x - width / 2, y - 19, width, 38, 19);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.fillStyle = '#203040';
    ctx.font = '900 17px "Inter", "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word.en, x, y + 1, width - 18);
    ctx.restore();
  }

  drawFx(ctx, fxItems, now) {
    for (const fx of fxItems) {
      const age = now - fx.createdAt;
      const t = Math.min(1, age / fx.duration);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = fx.color;
      ctx.font = '800 22px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fx.text, fx.x, fx.y - t * 36);
      ctx.restore();
    }
  }

  drawHud(ctx, snapshot) {
    this.drawWordList(ctx, snapshot);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(32,48,64,0.38)';
    roundRect(ctx, CONFIG.WORLD_WIDTH / 2 - 72, 18, 144, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(32,48,64,0.36)';
    ctx.lineWidth = 4;
    ctx.font = '900 28px "Inter", "Segoe UI", Arial, sans-serif';
    strokeFillText(ctx, formatTime(snapshot.timeLeftMs), CONFIG.WORLD_WIDTH / 2, 42);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(32,48,64,0.42)';
    roundRect(ctx, CONFIG.WORLD_WIDTH - 250, 18, 218, 96, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 22px "Microsoft YaHei", sans-serif';
    strokeFillText(ctx, `长度: ${snapshot.snake.solidSegments.length}`, CONFIG.WORLD_WIDTH - 228, 31);
    strokeFillText(ctx, `Score: ${snapshot.score}`, CONFIG.WORLD_WIDTH - 228, 61);
    const combo = snapshot.combo >= 2 ? `  x${snapshot.combo}` : '';
    strokeFillText(ctx, `${snapshot.progressDone}/${snapshot.progressTotal}${combo}`, CONFIG.WORLD_WIDTH - 228, 91);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '900 18px "Microsoft YaHei", sans-serif';
    strokeFillText(ctx, '♥'.repeat(Math.max(0, snapshot.lives)), 26, CONFIG.WORLD_HEIGHT - 42);
    ctx.restore();

    const active = [
      snapshot.activePowers?.boost ? '加速' : '',
      snapshot.activePowers?.shield ? '护盾' : '',
      snapshot.activePowers?.magnet ? '吸词' : ''
    ].filter(Boolean);
    if (active.length) {
      ctx.save();
      ctx.fillStyle = 'rgba(32,48,64,0.36)';
      roundRect(ctx, CONFIG.WORLD_WIDTH / 2 - 102, CONFIG.WORLD_HEIGHT - 58, 204, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '900 16px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      strokeFillText(ctx, active.join('  '), CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT - 41);
      ctx.restore();
    }
  }

  drawWordList(ctx, snapshot) {
    const completed = new Set(snapshot.snake.solidSegments.filter((s) => s.wordId).map((s) => s.wordId));
    ctx.save();
    ctx.fillStyle = 'rgba(32,48,64,0.34)';
    roundRect(ctx, 24, 22, 214, 252, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '900 18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('今日词表', 42, 38);
    ctx.font = '800 13px "Inter", "Segoe UI", Arial, sans-serif';
    snapshot.words.forEach((word, index) => {
      const y = 72 + index * 18;
      const state = completed.has(word.id) ? '✓' : snapshot.currentWord?.id === word.id ? '▶' : '·';
      ctx.fillStyle = snapshot.currentWord?.id === word.id ? '#FFD93D' : completed.has(word.id) ? '#B9F2C8' : 'rgba(255,255,255,0.82)';
      ctx.fillText(`${state} ${word.en}`, 42, y, 120);
      ctx.textAlign = 'right';
      ctx.fillText(word.zh, 218, y, 70);
      ctx.textAlign = 'left';
    });
    ctx.restore();
  }

  drawOverlay(ctx, snapshot) {
    if (snapshot.state === 'countdown') {
      const n = Math.max(1, Math.ceil(snapshot.countdownMs / 1000));
      this.centerOverlay(ctx, `${n}`, '准备找中文');
    }
    if (snapshot.state === 'paused') {
      this.centerOverlay(ctx, '暂停', '按 P 继续');
    }
    if (snapshot.state === 'playing' && snapshot.timeLeftMs <= 15000) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 107, 107, 0.95)';
      ctx.font = '900 24px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`还剩 ${formatTime(snapshot.timeLeftMs)}`, CONFIG.WORLD_WIDTH / 2, 86);
      ctx.restore();
    }
  }

  centerOverlay(ctx, title, subtitle) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.76)';
    roundRect(ctx, CONFIG.WORLD_WIDTH / 2 - 135, CONFIG.WORLD_HEIGHT / 2 - 86, 270, 172, 22);
    ctx.fill();
    ctx.fillStyle = '#203040';
    ctx.font = '900 64px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2 - 16);
    ctx.font = '700 21px "Microsoft YaHei", sans-serif';
    ctx.fillText(subtitle, CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2 + 46);
    ctx.restore();
  }
}

function strokeFillText(ctx, text, x, y) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(32,48,64,0.38)';
  ctx.lineWidth = 5;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function segmentColor(index) {
  const colors = ['#F13A2F', '#E72E2A', '#FF4B35', '#D82724'];
  return colors[index % colors.length];
}
