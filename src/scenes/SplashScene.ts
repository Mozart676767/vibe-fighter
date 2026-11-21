import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { GAME_TAGLINE, GAME_TITLE } from '../game/constants';
import { createMenuBackdrop } from '../game/menuBackdrop';
import { bindAudioSettings, startMusic } from '../game/soundEffects';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

export class SplashScene extends BaseScene {
  private hasAdvanced = false;

  constructor() {
    super(SCENE_KEYS.Splash);
  }

  create(): void {
    this.hasAdvanced = false;
    this.markActiveScene(SCENE_KEYS.Splash);
    bindAudioSettings(this.app.settingsStore);

    const camera = this.cameras.main;
    const cleanupBackdrop = createMenuBackdrop(this, {
      stageKey: 'shibuya-night-stage',
      showFighters: true,
      scrimAlpha: 0.44
    });

    this.add
      .text(camera.centerX, camera.centerY - 82, GAME_TITLE, {
        color: '#f8fafc',
        fontFamily: '"Silkscreen", "Press Start 2P", monospace',
        fontSize: '58px',
        stroke: '#020617',
        strokeThickness: 12,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: '#0ea5e9',
          blur: 16,
          fill: true
        }
      })
      .setOrigin(0.5)
      .setDepth(10);

    if (GAME_TAGLINE) {
      this.add
        .text(camera.centerX, camera.centerY - 24, GAME_TAGLINE, {
          color: '#e2e8f0',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '18px',
          stroke: '#020617',
          strokeThickness: 6
        })
        .setOrigin(0.5)
        .setDepth(10);
    }

    const promptText = this.add
      .text(
        camera.centerX,
        camera.centerY + 72,
        this.app.isMobileShell ? 'TAP SCREEN TO BEGIN' : 'PRESS ANY KEY TO BEGIN',
        {
          color: '#38bdf8',
          fontFamily: '"Silkscreen", monospace',
          fontSize: '20px',
          stroke: '#020617',
          strokeThickness: 6
        }
      )
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: promptText,
      alpha: 0.35,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const advanceToMenu = (): void => {
      if (this.hasAdvanced) {
        return;
      }

      this.hasAdvanced = true;
      startMusic('menu', this.app.settingsStore);
      playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
      this.scene.start(SCENE_KEYS.MainMenu);
    };

    this.input.once('pointerup', advanceToMenu);
    this.input.keyboard?.once('keydown', advanceToMenu);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupBackdrop);
  }
}
