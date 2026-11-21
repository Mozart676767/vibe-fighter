import * as Phaser from 'phaser';

import { getAppContext } from '../game/context';
import type { AppContext } from '../game/context';
import { SCENE_KEYS, type SceneKey } from '../game/types';

export abstract class BaseScene extends Phaser.Scene {
  protected get app(): AppContext {
    return getAppContext();
  }

  protected markActiveScene(sceneKey: SceneKey): void {
    this.app.debugStore.patchState({ activeScene: sceneKey });
  }

  protected createHeading(title: string, subtitle: string): void {
    const { centerX } = this.cameras.main;

    this.add
      .text(centerX, 56, title, {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '34px',
        stroke: '#020617',
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setDepth(10);

    if (subtitle) {
      this.add
        .text(centerX, 92, subtitle, {
          color: '#cbd5e1',
          fontFamily: 'monospace',
          fontSize: '16px',
          stroke: '#020617',
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(10);
    }
  }

  protected createFooterHint(text: string): void {
    const { centerX, height } = this.cameras.main;

    this.add
      .text(centerX, height - 28, text, {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '14px'
      })
      .setOrigin(0.5)
      .setDepth(100);
  }

  protected goToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
