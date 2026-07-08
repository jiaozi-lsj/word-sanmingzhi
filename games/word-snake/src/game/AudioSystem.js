export class AudioSystem {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
    this.bgmGain = null;
    this.bgmTimer = 0;
    this.step = 0;
    this.voice = null;
    this.voicesReady = false;
    this.loadVoices();
  }

  ensureContext() {
    if (!this.enabled) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    this.context ||= new AudioContext();
    if (this.context.state === 'suspended') this.context.resume();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }
    this.context.resume?.();
    return this.context;
  }

  loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const select = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const british = voices.filter((voice) => /^en[-_]GB/i.test(voice.lang));
      this.voice =
        british.find((voice) => /female|sonia|libby|serena|kate|amy|susan|zira|aria/i.test(voice.name)) ||
        british[0] ||
        voices.find((voice) => /^en/i.test(voice.lang)) ||
        voices[0];
      this.voicesReady = true;
    };
    select();
    window.speechSynthesis.onvoiceschanged = select;
  }

  startBgm() {
    const context = this.ensureContext();
    if (!context || this.bgmTimer) return;
    this.bgmGain = context.createGain();
    this.bgmGain.gain.value = 0.24;
    this.bgmGain.connect(this.master);
    this.scheduleBgmNote();
    this.bgmTimer = window.setInterval(() => this.scheduleBgmNote(), 420);
  }

  stopBgm() {
    if (this.bgmTimer) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = 0;
    }
    this.bgmGain?.disconnect();
    this.bgmGain = null;
  }

  scheduleBgmNote() {
    const context = this.ensureContext();
    if (!context || !this.bgmGain) return;
    const notes = [392, 440, 523, 587, 523, 440, 349, 392];
    const frequency = notes[this.step % notes.length];
    this.step += 1;
    this.playOscillator(frequency, 0.18, 'sine', this.bgmGain, 0.12);
    if (this.step % 4 === 0) {
      this.playOscillator(frequency / 2, 0.3, 'triangle', this.bgmGain, 0.06);
    }
  }

  playTone(kind) {
    const context = this.ensureContext();
    if (!context) return;
    const tones = {
      start: [523, 0.08, 'sine', 0.09],
      wrong: [180, 0.13, 'triangle', 0.1],
      bump: [130, 0.1, 'triangle', 0.09],
      power: [659, 0.12, 'sine', 0.1]
    };
    const [frequency, duration, type, volume] = tones[kind] || tones.start;
    this.playOscillator(frequency, duration, type, this.master, volume);
  }

  playOscillator(frequency, duration, type, destination, volume) {
    const context = this.ensureContext();
    if (!context || !destination) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }

  speakWord(word) {
    if (!this.enabled || !('speechSynthesis' in window) || !word) return;
    this.loadVoices();
    this.ensureContext();
    window.speechSynthesis.resume?.();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-GB';
    utterance.rate = 0.96;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    if (this.voice) utterance.voice = this.voice;
    window.setTimeout(() => {
      window.speechSynthesis.resume?.();
      window.speechSynthesis.speak(utterance);
      if (!this.voicesReady) {
        window.setTimeout(() => {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            this.loadVoices();
            const retry = new SpeechSynthesisUtterance(word);
            retry.lang = 'en-GB';
            retry.rate = 0.96;
            retry.pitch = 1.08;
            retry.volume = 1;
            if (this.voice) retry.voice = this.voice;
            window.speechSynthesis.speak(retry);
          }
        }, 180);
      }
    }, 40);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBgm();
      window.speechSynthesis?.cancel();
      return false;
    }
    this.ensureContext();
    this.startBgm();
    this.playTone('start');
    return true;
  }

  destroy() {
    this.stopBgm();
    window.speechSynthesis?.cancel();
  }
}
