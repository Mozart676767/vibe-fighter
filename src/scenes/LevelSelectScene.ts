import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { STAGE_DEFINITIONS } from '../game/stageConfig';
import { createSelectionCard, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface LevelSelectData {
  mode: MatchMode;
}

const ACCENT = 0xfacc15;

/**
 * Second step of the Play flow: pick the stage for the match. Shows each stage
 * as a thumbnail card and forwards the selection to character select.
 */
export class LevelSelectScene extends BaseScene {
  private mode: MatchMode = '1v1';
  private cards: SelectionCard[] = [];
  private selectedIndex = 0;

  constructor() {
    super(SCENE_KEYS.LevelSelect);
  }

  init(data: LevelSelectData): void {
    this.mode = data?.mode ?? '1v1';
  }

  create(): void {
    this.cards = [];
    this.selectedIndex = 0;

    this.markActiveScene(SCENE_KEYS.LevelSelect);
    this.cameras.main.setBackgroundColor(0x020617);
    this.createHeading('Select Stage', this.mode === '1v1' ? '1 vs 1' : '1 vs CPU');

    this.buildCards();
    this.registerInput();
    this.setSelection(0);

    this.createFooterHint('← → ↑ ↓ / WASD to choose • Enter / Space to confirm • Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  private buildCards(): void {
    const { centerX, centerY } = this.cameras.main;
    const count = STAGE_DEFINITIONS.length;
    const columns = count > 3 ? 3 : Math.max(1, count);
    const rows = Math.max(1, Math.ceil(count / columns));
    const cardWidth = rows > 1 ? 330 : 380;
    const cardHeight = rows > 1 ? 216 : 300;
    const colGap = rows > 1 ? 36 : 60;
    const rowGap = 24;

    const totalHeight = rows * cardHeight + rowGap * (rows - 1);
    const gridCenterY = rows > 1 ? centerY + 34 : centerY + 10;
    const startY = gridCenterY - totalHeight / 2 + cardHeight / 2;

    STAGE_DEFINITIONS.forEach((stage, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const itemsInRow = Math.min(columns, count - row * columns);
      const rowWidth = cardWidth * itemsInRow + colGap * (itemsInRow - 1);
      const startX = centerX - rowWidth / 2 + cardWidth / 2;
      const x = startX + col * (cardWidth + colGap);
      const y = startY + row * (cardHeight + rowGap);

      const card = createSelectionCard(this, {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        title: stage.label,
        texture: this.textures.exists(stage.key) ? stage.key : undefined,
        imageMaxSize: cardWidth - 28,
        imageOffsetY: rows > 1 ? -18 : -28,
        onHover: () => this.setSelection(index),
        onClick: () => this.confirm(index)
      });

      this.cards.push(card);
    });
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on('keydown-LEFT', () => this.moveGrid(-1, 0));
    keyboard.on('keydown-A', () => this.moveGrid(-1, 0));
    keyboard.on('keydown-RIGHT', () => this.moveGrid(1, 0));
    keyboard.on('keydown-D', () => this.moveGrid(1, 0));
    keyboard.on('keydown-UP', () => this.moveGrid(0, -1));
    keyboard.on('keydown-W', () => this.moveGrid(0, -1));
    keyboard.on('keydown-DOWN', () => this.moveGrid(0, 1));
    keyboard.on('keydown-S', () => this.moveGrid(0, 1));
    keyboard.on('keydown-ENTER', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-SPACE', () => this.confirm(this.selectedIndex));
    keyboard.on('keydown-ESC', () => this.scene.start(SCENE_KEYS.ModeSelect));
    keyboard.on('keydown-BACKSPACE', () => this.scene.start(SCENE_KEYS.ModeSelect));
  }

  private moveGrid(dx: number, dy: number): void {
    const count = this.cards.length;
    if (count === 0) {
      return;
    }

    const columns = count > 3 ? 3 : Math.max(1, count);
    const rows = Math.max(1, Math.ceil(count / columns));

    if (dy !== 0) {
      const currentRow = Math.floor(this.selectedIndex / columns);
      const currentCol = this.selectedIndex % columns;
      const targetRow = Phaser.Math.Wrap(currentRow + dy, 0, rows);
      const next = Math.min(count - 1, targetRow * columns + currentCol);
      this.setSelection(next);
      return;
    }

    const next = Phaser.Math.Wrap(this.selectedIndex + dx, 0, count);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, cardIndex) => card.setSelected(cardIndex === index, ACCENT));
  }

  private confirm(index: number): void {
    this.setSelection(index);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    this.scene.start(SCENE_KEYS.CharacterSelect, {
      mode: this.mode,
      stageId: STAGE_DEFINITIONS[index].id
    });
  }
}
