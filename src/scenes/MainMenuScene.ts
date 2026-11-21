import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { GAME_TAGLINE, GAME_TITLE } from '../game/constants';
import { createMenuBackdrop } from '../game/menuBackdrop';
import { playSfx, startMusic } from '../game/soundEffects';
import { createTextButton, type TextButton } from '../game/ui';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

interface MenuOption {
  label: string;
  action: () => void;
}

export class MainMenuScene extends BaseScene {
  private selectedIndex = 0;

  private buttons: TextButton[] = [];

  private dividers: Phaser.GameObjects.Text[] = [];

  private options: MenuOption[] = [];

  constructor() {
    super(SCENE_KEYS.MainMenu);
  }

  create(): void {
    this.buttons = [];
    this.dividers = [];
    this.selectedIndex = 0;
    this.options = [];

    this.markActiveScene(SCENE_KEYS.MainMenu);
    startMusic('menu', this.app.settingsStore);

    const cleanupBackdrop = createMenuBackdrop(this, {
      stageKey: 'shibuya-night-stage',
      showFighters: true,
      scrimAlpha: 0.48
    });

    this.renderArcadeHeader();
    this.renderMenu();

    const keyUp = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    const keyDown = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    const keyW = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    const keyS = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    const keyEnter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const keySpace = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    keyUp?.on('down', () => this.moveSelection(-1));
    keyW?.on('down', () => this.moveSelection(-1));
    keyDown?.on('down', () => this.moveSelection(1));
    keyS?.on('down', () => this.moveSelection(1));
    keyEnter?.on('down', () => this.confirmOption(this.options[this.selectedIndex]));
    keySpace?.on('down', () => this.confirmOption(this.options[this.selectedIndex]));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cleanupBackdrop();
      this.clearButtons();
      this.selectedIndex = 0;
      this.options = [];
    });

    this.createFooterHint('Arrow keys / WASD to navigate • Enter / Space to confirm');
  }

  private renderArcadeHeader(): void {
    const { centerX } = this.cameras.main;

    this.add
      .text(centerX, 118, GAME_TITLE, {
        color: '#f8fafc',
        fontFamily: '"Silkscreen", "Press Start 2P", monospace',
        fontSize: '52px',
        stroke: '#020617',
        strokeThickness: 10,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: '#0ea5e9',
          blur: 14,
          fill: true
        }
      })
      .setOrigin(0.5)
      .setDepth(10);

    if (GAME_TAGLINE) {
      this.add
        .text(centerX, 166, GAME_TAGLINE, {
          color: '#cbd5e1',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '16px',
          stroke: '#020617',
          strokeThickness: 5
        })
        .setOrigin(0.5)
        .setDepth(10);
    }

    this.add
      .rectangle(centerX, 196, 220, 3, 0x38bdf8, 0.85)
      .setDepth(10);
  }

  private moveSelection(direction: number): void {
    const next = Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.buttons.length);
    this.setSelection(next);
  }

  private setSelection(index: number): void {
    if (this.selectedIndex !== index) {
      playSfx('ui-move', this.app.settingsStore.getState());
    }
    this.selectedIndex = index;
    this.buttons.forEach((button, buttonIndex) => {
      button.setSelected(buttonIndex === index);
    });
  }

  private renderMenu(): void {
    this.clearButtons();

    const playOption: MenuOption = { label: 'Play', action: () => this.scene.start(SCENE_KEYS.ModeSelect) };
    const settingsOption: MenuOption = { label: 'Settings', action: () => this.scene.start(SCENE_KEYS.Settings) };
    this.options = [playOption, settingsOption];

    const startY = this.cameras.main.centerY - 8;
    const spacing = 74;
    let row = 0;

    const layoutButton = (option: MenuOption, optionIndex: number): void => {
      const button = createTextButton(this, {
        x: this.cameras.main.centerX,
        y: startY + row * spacing,
        width: 340,
        height: 58,
        label: option.label,
        onClick: () => this.confirmOption(option),
        onHover: () => this.setSelection(optionIndex)
      });

      button.group.setDepth(10);
      this.buttons.push(button);
      row += 1;
    };

    layoutButton(playOption, 0);
    layoutButton(settingsOption, 1);

    this.setSelection(0);
  }


  private clearButtons(): void {
    this.buttons.forEach((button) => {
      button.destroy();
    });
    this.buttons = [];
    this.dividers.forEach((divider) => {
      divider.destroy();
    });
    this.dividers = [];
  }

  private confirmOption(option?: MenuOption): void {
    if (!option) {
      return;
    }

    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
    option.action();
  }
}
