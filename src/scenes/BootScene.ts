import * as Phaser from 'phaser';

import { preloadStarterAssets, registerStarterAnimations } from '../game/assets';
import { GAME_TITLE } from '../game/constants';
import { registerGeneratedAssets } from '../game/generatedAssets';
import { prepareMyFighters, startBackgroundFighterPrep } from '../game/myFighterLoader';
import { registerTileAtlasFrames } from '../game/tileAtlas';
import { registerQuestUiAtlasFrames } from '../game/uiAtlas';
import { registerFightingUiAtlasFrames } from '../game/fightingUiAtlas';
import { SCENE_KEYS } from '../game/types';
import { BaseScene } from './BaseScene';

const BAR_WIDTH = 420;
const BAR_HEIGHT = 18;

export class BootScene extends BaseScene {
  private progressFill?: Phaser.GameObjects.Rectangle;
  private statusText?: Phaser.GameObjects.Text;
  private percentText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    this.createLoadingUi();

    this.load.on('progress', (value: number) => {
      this.updateProgress(value * 0.45, 'LOADING ARENA ASSETS...');
    });

    this.load.on('loaderror', (file: { key?: string; src?: string }) => {
      console.warn('[boot] asset failed to load:', file?.key, file?.src);
    });

    preloadStarterAssets(this);
  }

  create(): void {
    this.markActiveScene(SCENE_KEYS.Boot);
    this.updateProgress(0.45, 'PREPARING FIGHTERS...');

    registerGeneratedAssets(this);
    registerTileAtlasFrames(this);
    registerQuestUiAtlasFrames(this);
    registerFightingUiAtlasFrames(this);

    void this.finishBoot();
  }

  private async finishBoot(): Promise<void> {
    try {
      await prepareMyFighters(this, (completed, total) => {
        const ratio = total > 0 ? completed / total : 1;
        this.updateProgress(0.45 + ratio * 0.55, `PREPARING FIGHTERS (${completed}/${total})...`);
      });
    } catch (error) {
      console.error('[my-fighter] could not prepare fighters', error);
    }

    if (!this.sys.game.isRunning || !this.scene.isActive()) {
      return;
    }

    this.updateProgress(1, 'READY!');
    registerStarterAnimations(this);
    startBackgroundFighterPrep(this);
    this.scene.start(SCENE_KEYS.Splash);
  }

  private createLoadingUi(): void {
    const { centerX, centerY } = this.cameras.main;
    this.cameras.main.setBackgroundColor(0x020617);

    this.add
      .text(centerX, centerY - 68, GAME_TITLE, {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '42px',
        fontStyle: 'bold',
        stroke: '#0ea5e9',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(centerX, centerY - 14, 'LOADING ARENA ASSETS...', {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '15px'
      })
      .setOrigin(0.5);

    this.add
      .rectangle(centerX, centerY + 24, BAR_WIDTH + 6, BAR_HEIGHT + 6, 0x0f172a, 1)
      .setStrokeStyle(2, 0x38bdf8, 0.85);

    this.progressFill = this.add
      .rectangle(centerX - BAR_WIDTH / 2, centerY + 24, 0, BAR_HEIGHT, 0x38bdf8, 1)
      .setOrigin(0, 0.5);

    this.percentText = this.add
      .text(centerX, centerY + 58, '0%', {
        color: '#38bdf8',
        fontFamily: 'monospace',
        fontSize: '14px'
      })
      .setOrigin(0.5);
  }

  private updateProgress(ratio: number, message: string): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.progressFill?.setDisplaySize(Math.round(BAR_WIDTH * clamped), BAR_HEIGHT);
    this.statusText?.setText(message);
    this.percentText?.setText(`${Math.round(clamped * 100)}%`);
  }
}
