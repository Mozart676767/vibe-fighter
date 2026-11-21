import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { createMenuBackdrop } from '../game/menuBackdrop';
import { playSfx, startMusic } from '../game/soundEffects';
import { createSelectionCard, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface ModeOption {
  mode: MatchMode;
  title: string;
  subtitle: string;
  texture: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { mode: '1v1', title: '1 VS 1', subtitle: 'Two players, one keyboard', texture: 'mode-card-1v1' },
  { mode: '1vcpu', title: '1 VS CPU', subtitle: 'You pick, the CPU answers', texture: 'mode-card-1vcpu' },
  { mode: '2v2', title: '2 VS 2', subtitle: 'Team brawl: 2 vs 2 fighters', texture: 'mode-card-2v2' }
];

const ACCENT = 0x38bdf8;

/**
 * First step of the Play flow: choose 1v1, 1vCPU, or 2v2 team brawl.
 * Forwards the chosen mode to the level select screen.
 */
export class ModeSelectScene extends BaseScene {
  private cards: SelectionCard[] = [];
  private selectedIndex = 0;

  constructor() {
    super(SCENE_KEYS.ModeSelect);
  }

  create(): void {
    this.cards = [];
    this.selectedIndex = 0;

    this.markActiveScene(SCENE_KEYS.ModeSelect);
    startMusic('menu', this.app.settingsStore);

    const cleanupBackdrop = createMenuBackdrop(this, {
      stageKey: 'crimson-eclipse-stage',
      showFighters: false,
      scrimAlpha: 0.62
    });

    this.createHeading('Select Mode', 'How do you want to play?');

    this.buildCards();
    this.registerInput();
    this.setSelection(0);

    this.createFooterHint('← → / A D to choose • Enter / Space to confirm • Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cleanupBackdrop();
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  private buildCards(): void {
    const { width, centerX, centerY } = this.cameras.main;
    const isCompact = width < 960;
    const cardWidth = isCompact ? 210 : 300;
    const cardHeight = isCompact ? 220 : 260;
    const gap = isCompact ? 18 : 42;
    const totalWidth = cardWidth * MODE_OPTIONS.length + gap * (MODE_OPTIONS.length - 1);
    const startX = centerX - totalWidth / 2 + cardWidth / 2;

    MODE_OPTIONS.forEach((option, index) => {
      const card = createSelectionCard(this, {
        x: startX + index * (cardWidth + gap),
        y: centerY + 14,
        width: cardWidth,
        height: cardHeight,
        title: option.title,
        subtitle: option.subtitle,
        texture: option.texture,
        imageMaxSize: isCompact ? 128 : 164,
        imageOffsetY: -44,
        onHover: () => this.setSelection(index),
        onClick: () => this.confirm(index)
      });

      card.container.setDepth(10);
      this.cards.push(card);
    });
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    keyboard.on('keydown-A', () => this.moveSelection(-1));
    keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    keyboard.on('keydown-D', () => this.moveSelection(1));
    keyboard.on('keydown-ENTER', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-SPACE', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-ESC', () => this.goToMenu());
    keyboard.on('keydown-BACKSPACE', () => this.goToMenu());
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.cards.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    if (this.selectedIndex !== index) {
      playSfx('ui-move', this.app.settingsStore.getState());
    }
    this.selectedIndex = index;
    this.cards.forEach((card, cardIndex) => card.setSelected(cardIndex === index, ACCENT));
  }

  private confirm(index: number): void {
    this.setSelection(index);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.scene.start(SCENE_KEYS.LevelSelect, { mode: MODE_OPTIONS[index].mode });
  }
}
