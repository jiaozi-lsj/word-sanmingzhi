import { CONFIG } from '../config.js';
import { normalizeVector } from '../utils/math.js';

const KEY_TO_VECTOR = new Map([
  ['ArrowUp', { x: 0, y: -1 }],
  ['KeyW', { x: 0, y: -1 }],
  ['ArrowDown', { x: 0, y: 1 }],
  ['KeyS', { x: 0, y: 1 }],
  ['ArrowLeft', { x: -1, y: 0 }],
  ['KeyA', { x: -1, y: 0 }],
  ['ArrowRight', { x: 1, y: 0 }],
  ['KeyD', { x: 1, y: 0 }]
]);

export class InputController {
  constructor({ canvas, joystickRoot, boostButton, options = {} }) {
    this.canvas = canvas;
    this.joystickRoot = joystickRoot;
    this.boostButton = boostButton;
    this.options = options;
    this.pointerDirection = { x: 1, y: 0 };
    this.keyboardVector = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };
    this.keys = new Set();
    this.boost = false;
    this.joystickPointerId = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleCanvasPointer = this.handleCanvasPointer.bind(this);
    this.handleJoystickDown = this.handleJoystickDown.bind(this);
    this.handleJoystickMove = this.handleJoystickMove.bind(this);
    this.handleJoystickUp = this.handleJoystickUp.bind(this);
    this.handleBoostDown = this.handleBoostDown.bind(this);
    this.handleBoostUp = this.handleBoostUp.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  bind() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.canvas?.addEventListener('pointerdown', this.handleCanvasPointer);
    this.canvas?.addEventListener('pointermove', this.handleCanvasPointer);
    this.joystickRoot?.addEventListener('pointerdown', this.handleJoystickDown);
    window.addEventListener('pointermove', this.handleJoystickMove);
    window.addEventListener('pointerup', this.handleJoystickUp);
    window.addEventListener('pointercancel', this.handleJoystickUp);
    this.boostButton?.addEventListener('pointerdown', this.handleBoostDown);
    this.boostButton?.addEventListener('pointerup', this.handleBoostUp);
    this.boostButton?.addEventListener('pointercancel', this.handleBoostUp);
    this.boostButton?.addEventListener('pointerleave', this.handleBoostUp);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.canvas?.removeEventListener('pointerdown', this.handleCanvasPointer);
    this.canvas?.removeEventListener('pointermove', this.handleCanvasPointer);
    this.joystickRoot?.removeEventListener('pointerdown', this.handleJoystickDown);
    window.removeEventListener('pointermove', this.handleJoystickMove);
    window.removeEventListener('pointerup', this.handleJoystickUp);
    window.removeEventListener('pointercancel', this.handleJoystickUp);
    this.boostButton?.removeEventListener('pointerdown', this.handleBoostDown);
    this.boostButton?.removeEventListener('pointerup', this.handleBoostUp);
    this.boostButton?.removeEventListener('pointercancel', this.handleBoostUp);
    this.boostButton?.removeEventListener('pointerleave', this.handleBoostUp);
  }

  handleKeyDown(event) {
    if (KEY_TO_VECTOR.has(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
      this.updateKeyboardVector();
      return;
    }

    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      event.preventDefault();
      this.boost = true;
      return;
    }

    if (event.code === 'KeyP') {
      event.preventDefault();
      this.options.onPauseToggle?.();
    }
  }

  handleKeyUp(event) {
    if (KEY_TO_VECTOR.has(event.code)) {
      this.keys.delete(event.code);
      this.updateKeyboardVector();
      return;
    }

    if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.boost = false;
    }
  }

  updateKeyboardVector() {
    let x = 0;
    let y = 0;
    for (const key of this.keys) {
      const vector = KEY_TO_VECTOR.get(key);
      x += vector.x;
      y += vector.y;
    }
    const normalized = normalizeVector({ x, y });
    this.keyboardVector = { x: normalized.x, y: normalized.y };
  }

  handleCanvasPointer(event) {
    if (event.pointerType === 'touch') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CONFIG.WORLD_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * CONFIG.WORLD_HEIGHT;
    const normalized = normalizeVector({
      x: x - CONFIG.WORLD_WIDTH / 2,
      y: y - CONFIG.WORLD_HEIGHT / 2
    });
    if (normalized.length > 24) {
      this.pointerDirection = { x: normalized.x, y: normalized.y };
    }
  }

  handleJoystickDown(event) {
    event.preventDefault();
    this.joystickPointerId = event.pointerId;
    this.joystickRoot.setPointerCapture?.(event.pointerId);
    this.updateJoystick(event);
  }

  handleJoystickMove(event) {
    if (event.pointerId !== this.joystickPointerId) return;
    event.preventDefault();
    this.updateJoystick(event);
  }

  handleJoystickUp(event) {
    if (event.pointerId !== this.joystickPointerId) return;
    this.joystickPointerId = null;
    this.joystickVector = { x: 0, y: 0 };
    this.joystickRoot?.style.setProperty('--joy-x', '0px');
    this.joystickRoot?.style.setProperty('--joy-y', '0px');
  }

  updateJoystick(event) {
    const rect = this.joystickRoot.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    const raw = {
      x: event.clientX - center.x,
      y: event.clientY - center.y
    };
    const normalized = normalizeVector(raw);
    const radius = Math.min(CONFIG.JOYSTICK_RADIUS, normalized.length || 0);
    this.joystickVector = normalized.length > 8 ? { x: normalized.x, y: normalized.y } : { x: 0, y: 0 };
    this.joystickRoot.style.setProperty('--joy-x', `${normalized.x * radius}px`);
    this.joystickRoot.style.setProperty('--joy-y', `${normalized.y * radius}px`);
  }

  handleBoostDown(event) {
    event.preventDefault();
    this.boost = true;
    this.boostButton?.classList.add('is-boosting');
  }

  handleBoostUp() {
    this.boost = false;
    this.boostButton?.classList.remove('is-boosting');
  }

  handleVisibility() {
    if (document.hidden) this.options.onAutoPause?.();
  }

  getIntent() {
    const active = this.joystickVector.x || this.joystickVector.y
      ? this.joystickVector
      : this.keyboardVector.x || this.keyboardVector.y
        ? this.keyboardVector
        : this.pointerDirection;

    return {
      direction: active,
      boost: this.boost
    };
  }
}
