import type { Store } from './store';
import type { SpecialBehaviorKind } from './specialPowers';
import type { GameSettings } from './types';

export type MusicTrack = 'none' | 'menu' | 'battle';

export type SfxKind =
  | 'ui-move'
  | 'jump'
  | 'land'
  | 'swing-light'
  | 'swing-heavy'
  | 'hit-light'
  | 'hit-heavy'
  | 'block'
  | 'super-cutin'
  | 'special-dash'
  | 'special-ranged'
  | 'special-teleport'
  | 'special-aoe'
  | 'round-announce'
  | 'fight-start'
  | 'ko'
  | 'timer-tick'
  | 'victory';

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let masterSfxGain: GainNode | null = null;
let masterMusicGain: GainNode | null = null;

let currentSettings: GameSettings = { sfxVolume: 0.8, musicVolume: 0.55, muted: false };
let subscribedStore: Store<GameSettings> | null = null;
let unlockBound = false;

let activeTrack: MusicTrack = 'none';
let seqTimer: number | null = null;
let seqStep = 0;
let musicDuckedUntil = 0;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }

  if (!ctx) {
    try {
      ctx = new AudioCtor();
      masterSfxGain = ctx.createGain();
      masterMusicGain = ctx.createGain();
      masterSfxGain.connect(ctx.destination);
      masterMusicGain.connect(ctx.destination);
      applyVolumes();
    } catch {
      return null;
    }
  }

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  return ctx;
}

function getNoiseBuffer(audioCtx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === audioCtx.sampleRate) {
    return noiseBuffer;
  }

  const length = Math.floor(audioCtx.sampleRate * 1.0);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

function effectiveSfxVolume(): number {
  return currentSettings.muted ? 0 : Math.max(0, Math.min(1, currentSettings.sfxVolume));
}

function effectiveMusicVolume(): number {
  if (currentSettings.muted) {
    return 0;
  }
  const base = Math.max(0, Math.min(1, currentSettings.musicVolume)) * 0.38;
  return Date.now() < musicDuckedUntil ? base * 0.35 : base;
}

function applyVolumes(): void {
  if (!ctx) {
    return;
  }
  const now = ctx.currentTime;
  if (masterSfxGain) {
    masterSfxGain.gain.setTargetAtTime(effectiveSfxVolume(), now, 0.02);
  }
  if (masterMusicGain) {
    masterMusicGain.gain.setTargetAtTime(effectiveMusicVolume(), now, 0.04);
  }
}

export function bindAudioSettings(store: Store<GameSettings>): void {
  currentSettings = store.getState();
  applyVolumes();

  if (subscribedStore !== store) {
    subscribedStore = store;
    store.subscribe((next) => {
      currentSettings = next;
      applyVolumes();
    });
  }

  if (!unlockBound && typeof window !== 'undefined') {
    unlockBound = true;
    const unlock = (): void => {
      const audioCtx = getCtx();
      if (audioCtx && audioCtx.state === 'running') {
        applyVolumes();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }
}

export function startMusic(track: MusicTrack, store?: Store<GameSettings>): void {
  if (store) {
    bindAudioSettings(store);
  }

  if (track === 'none') {
    stopMusic();
    return;
  }

  if (activeTrack === track && seqTimer !== null) {
    return;
  }

  stopMusic();
  activeTrack = track;
  seqStep = 0;

  const stepMs = track === 'battle' ? 102 : 125; // ~147 BPM 16ths for battle, ~120 BPM for menu
  const tick = (): void => {
    if (activeTrack !== track) {
      return;
    }
    const audioCtx = getCtx();
    if (audioCtx && audioCtx.state === 'running' && effectiveMusicVolume() > 0.002) {
      applyVolumes();
      if (track === 'battle') {
        playBattleStep(audioCtx, seqStep);
      } else {
        playMenuStep(audioCtx, seqStep);
      }
    }
    seqStep = (seqStep + 1) % 64;
  };

  tick();
  if (typeof window !== 'undefined') {
    seqTimer = window.setInterval(tick, stepMs);
  }
}

export function stopMusic(): void {
  activeTrack = 'none';
  if (seqTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(seqTimer);
    seqTimer = null;
  }
}

export function duckMusic(durationMs = 950): void {
  musicDuckedUntil = Date.now() + durationMs;
  applyVolumes();
  if (typeof window !== 'undefined') {
    window.setTimeout(() => applyVolumes(), durationMs + 30);
  }
}

export function playSpecialKindSfx(kind: SpecialBehaviorKind, settings?: GameSettings): void {
  const sfxMap: Record<SpecialBehaviorKind, SfxKind> = {
    dash: 'special-dash',
    ranged: 'special-ranged',
    teleport: 'special-teleport',
    aoe: 'special-aoe'
  };
  playSfx(sfxMap[kind], settings);
}

export function playSfx(kind: SfxKind, settings?: GameSettings): void {
  if (settings) {
    currentSettings = settings;
    applyVolumes();
  }

  if (effectiveSfxVolume() <= 0) {
    return;
  }

  const audioCtx = getCtx();
  const out = masterSfxGain;
  if (!audioCtx || !out) {
    return;
  }

  const t = audioCtx.currentTime;

  switch (kind) {
    case 'ui-move':
      playTone(audioCtx, out, t, 'triangle', 540, 720, 0.045, 0.16);
      break;

    case 'jump':
      playTone(audioCtx, out, t, 'sine', 210, 520, 0.12, 0.28);
      playTone(audioCtx, out, t + 0.02, 'triangle', 340, 680, 0.09, 0.14);
      break;

    case 'land':
      playTone(audioCtx, out, t, 'sine', 135, 55, 0.09, 0.25);
      playFilteredNoise(audioCtx, out, t, 0.07, 450, 'lowpass', 0.18);
      break;

    case 'swing-light':
      playFilteredNoise(audioCtx, out, t, 0.09, 1900, 'bandpass', 0.28, 850);
      playTone(audioCtx, out, t, 'triangle', 360, 140, 0.07, 0.12);
      break;

    case 'swing-heavy':
      playFilteredNoise(audioCtx, out, t, 0.15, 1200, 'bandpass', 0.36, 420);
      playTone(audioCtx, out, t, 'sawtooth', 260, 82, 0.13, 0.18);
      break;

    case 'hit-light':
      playTone(audioCtx, out, t, 'sine', 220, 65, 0.11, 0.48);
      playTone(audioCtx, out, t, 'square', 410, 110, 0.06, 0.22);
      playFilteredNoise(audioCtx, out, t, 0.08, 2200, 'highpass', 0.35);
      break;

    case 'hit-heavy':
      playTone(audioCtx, out, t, 'sine', 170, 42, 0.2, 0.65);
      playTone(audioCtx, out, t, 'sawtooth', 280, 58, 0.14, 0.32);
      playFilteredNoise(audioCtx, out, t, 0.14, 1400, 'bandpass', 0.5);
      break;

    case 'block':
      playTone(audioCtx, out, t, 'square', 980, 640, 0.08, 0.26);
      playTone(audioCtx, out, t + 0.015, 'triangle', 1480, 1120, 0.11, 0.22);
      playFilteredNoise(audioCtx, out, t, 0.06, 3600, 'highpass', 0.24);
      break;

    case 'super-cutin':
      duckMusic(1050);
      playTone(audioCtx, out, t, 'sawtooth', 110, 55, 0.26, 0.45);
      playTone(audioCtx, out, t + 0.04, 'triangle', 440, 880, 0.28, 0.32);
      playTone(audioCtx, out, t + 0.12, 'sine', 660, 1320, 0.32, 0.28);
      playFilteredNoise(audioCtx, out, t, 0.32, 2400, 'bandpass', 0.35, 650);
      break;

    case 'special-dash':
      playTone(audioCtx, out, t, 'sawtooth', 160, 620, 0.28, 0.35);
      playTone(audioCtx, out, t + 0.1, 'square', 320, 140, 0.35, 0.28);
      playFilteredNoise(audioCtx, out, t, 0.42, 1800, 'bandpass', 0.45, 700);
      break;

    case 'special-ranged':
      playTone(audioCtx, out, t, 'sawtooth', 520, 130, 0.48, 0.38);
      playTone(audioCtx, out, t, 'sine', 880, 220, 0.45, 0.34);
      playFilteredNoise(audioCtx, out, t, 0.46, 2600, 'lowpass', 0.48, 400);
      break;

    case 'special-teleport':
      playTone(audioCtx, out, t, 'sine', 1400, 320, 0.12, 0.35);
      playTone(audioCtx, out, t + 0.09, 'triangle', 520, 1650, 0.16, 0.32);
      playFilteredNoise(audioCtx, out, t, 0.14, 3400, 'highpass', 0.26);
      break;

    case 'special-aoe':
      playTone(audioCtx, out, t, 'sine', 120, 34, 0.55, 0.7);
      playTone(audioCtx, out, t, 'sawtooth', 240, 48, 0.42, 0.35);
      playFilteredNoise(audioCtx, out, t, 0.48, 900, 'lowpass', 0.52);
      break;

    case 'round-announce':
      playTone(audioCtx, out, t, 'sawtooth', 196, 196, 0.22, 0.24);
      playTone(audioCtx, out, t + 0.08, 'triangle', 293.66, 293.66, 0.28, 0.26);
      break;

    case 'fight-start':
      playTone(audioCtx, out, t, 'square', 587.33, 587.33, 0.1, 0.28);
      playTone(audioCtx, out, t + 0.09, 'square', 880, 880, 0.22, 0.34);
      playTone(audioCtx, out, t + 0.09, 'sine', 440, 220, 0.25, 0.32);
      break;

    case 'ko':
      duckMusic(1300);
      playTone(audioCtx, out, t, 'sine', 150, 32, 0.65, 0.72);
      playTone(audioCtx, out, t, 'sawtooth', 220, 45, 0.5, 0.38);
      playFilteredNoise(audioCtx, out, t, 0.55, 1100, 'lowpass', 0.55);
      playTone(audioCtx, out, t + 0.18, 'square', 330, 165, 0.3, 0.2);
      break;

    case 'timer-tick':
      playTone(audioCtx, out, t, 'sine', 920, 760, 0.04, 0.16);
      break;

    case 'victory': {
      duckMusic(1800);
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = t + idx * 0.09;
        const dur = idx === notes.length - 1 ? 0.55 : 0.14;
        playTone(audioCtx, out, start, 'triangle', freq, freq, dur, 0.32);
        playTone(audioCtx, out, start, 'square', freq * 0.5, freq * 0.5, dur, 0.12);
      });
      break;
    }
  }
}

// --- Music Patterns ---

const MENU_BASS: ReadonlyArray<number | null> = [
  110, null, 110, null, 130.81, null, 146.83, null,
  110, null, 110, null, 164.81, null, 146.83, null,
  87.31, null, 87.31, null, 98.0, null, 110, null,
  98.0, null, 130.81, null, 146.83, null, 164.81, null
];

const MENU_LEAD: ReadonlyArray<number | null> = [
  440, null, null, 523.25, null, null, 659.25, null,
  587.33, null, 523.25, null, 440, null, null, null,
  349.23, null, null, 440, null, null, 523.25, null,
  587.33, null, 659.25, null, 783.99, null, 659.25, null,
  440, null, null, 523.25, null, null, 659.25, null,
  783.99, null, 659.25, null, 587.33, null, 523.25, null,
  349.23, null, 440, null, 523.25, null, 587.33, null,
  659.25, null, 587.33, null, 523.25, null, 440, null
];

function playMenuStep(audioCtx: AudioContext, step: number): void {
  const out = masterMusicGain;
  if (!out) {
    return;
  }
  const t = audioCtx.currentTime;

  // Soft kick on 0, 8 and crisp hi-hat pulse
  if (step % 8 === 0) {
    playTone(audioCtx, out, t, 'sine', 125, 48, 0.11, 0.35);
  } else if (step % 4 === 2) {
    playFilteredNoise(audioCtx, out, t, 0.035, 5200, 'highpass', 0.08);
  }

  const bass = MENU_BASS[step % MENU_BASS.length];
  if (bass) {
    playTone(audioCtx, out, t, 'triangle', bass, bass, 0.18, 0.24);
  }

  const lead = MENU_LEAD[step % MENU_LEAD.length];
  if (lead) {
    playTone(audioCtx, out, t, 'sine', lead, lead, 0.22, 0.16);
    playTone(audioCtx, out, t, 'triangle', lead * 0.5, lead * 0.5, 0.2, 0.08);
  }
}

// Driving D minor anime-fighter riff
const BATTLE_BASS: ReadonlyArray<number | null> = [
  73.42, 73.42, 146.83, 73.42, 73.42, 73.42, 146.83, 73.42,
  73.42, 73.42, 146.83, 73.42, 87.31, null, 98.0, null,
  58.27, 58.27, 116.54, 58.27, 58.27, 58.27, 116.54, 58.27,
  65.41, 65.41, 130.81, 65.41, 82.41, null, 98.0, null
];

const BATTLE_LEAD: ReadonlyArray<number | null> = [
  587.33, null, 659.25, 698.46, null, 659.25, 587.33, null,
  523.25, null, 587.33, null, 440, null, null, null,
  466.16, null, 523.25, 587.33, null, 523.25, 466.16, null,
  523.25, null, 659.25, null, 698.46, null, 783.99, null,
  880, null, 783.99, 698.46, null, 659.25, 587.33, null,
  659.25, null, 698.46, null, 880, null, null, null,
  783.99, null, 698.46, 659.25, null, 587.33, 523.25, null,
  587.33, null, 659.25, null, 523.25, null, 440, null
];

function playBattleStep(audioCtx: AudioContext, step: number): void {
  const out = masterMusicGain;
  if (!out) {
    return;
  }
  const t = audioCtx.currentTime;

  // Punchy 4-on-the-floor kick + snare backbeat + 16th hats
  if (step % 4 === 0) {
    playTone(audioCtx, out, t, 'sine', 145, 46, 0.1, 0.42);
  }
  if (step % 8 === 4) {
    playFilteredNoise(audioCtx, out, t, 0.09, 1700, 'highpass', 0.22);
    playTone(audioCtx, out, t, 'triangle', 190, 105, 0.06, 0.18);
  } else if (step % 2 === 1) {
    playFilteredNoise(audioCtx, out, t, 0.025, 6200, 'highpass', 0.09);
  }

  const bass = BATTLE_BASS[step % BATTLE_BASS.length];
  if (bass) {
    playTone(audioCtx, out, t, 'sawtooth', bass, bass, 0.085, 0.16);
  }

  const lead = BATTLE_LEAD[step % BATTLE_LEAD.length];
  if (lead) {
    playTone(audioCtx, out, t, 'square', lead, lead, 0.14, 0.11);
    playTone(audioCtx, out, t, 'triangle', lead, lead, 0.16, 0.12);
  }
}

// --- Low-level Web Audio helpers ---

function playTone(
  audioCtx: AudioContext,
  destination: AudioNode,
  startTime: number,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number,
  duration: number,
  peakGain: number
): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freqStart), startTime);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.01, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playFilteredNoise(
  audioCtx: AudioContext,
  destination: AudioNode,
  startTime: number,
  duration: number,
  freqStart: number,
  filterType: BiquadFilterType,
  peakGain: number,
  freqEnd?: number
): void {
  const src = audioCtx.createBufferSource();
  src.buffer = getNoiseBuffer(audioCtx);

  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(40, freqStart), startTime);
  if (freqEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), startTime + duration);
  }

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start(startTime);
  src.stop(startTime + duration + 0.02);
}
