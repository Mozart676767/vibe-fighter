import * as Phaser from 'phaser';

import { FIGHTING_UI_ATLAS_TEXTURE_KEY } from './fightingUiAtlas';

export interface KoOverlayHandle {
  destroy: () => void;
}

/**
 * Triggers a dramatic arcade 'K.O.' overlay with screen-shake, impact flash,
 * starburst rays, diagonal slash band, and slam-in 'K.O.' typography.
 */
export function playKoOverlay(
  scene: Phaser.Scene,
  options: { depth: number; durationMs?: number }
): KoOverlayHandle {
  const cam = scene.cameras.main;
  const { width, height, centerX, centerY } = cam;
  const depth = options.depth;
  const durationMs = options.durationMs ?? 1300;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const timers: Phaser.Time.TimerEvent[] = [];

  const track = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    objects.push(obj);
    return obj;
  };

  // Dramatic screen-shake + flash on the knockout blow
  cam.shake(460, 0.022);

  const flash = track(
    scene.add
      .rectangle(centerX, centerY, width, height, 0xfff1f2, 0.72)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(depth + 6)
  );
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 220,
    ease: 'Quad.Out'
  });

  // Crimson edge vignette / impact dim
  const dim = track(
    scene.add
      .rectangle(centerX, centerY, width, height, 0x1a0308, 0)
      .setScrollFactor(0)
      .setDepth(depth - 1)
  );
  scene.tweens.add({
    targets: dim,
    alpha: 0.44,
    duration: 140,
    ease: 'Quad.Out'
  });

  // Diagonal dark slash band with crimson & gold trim bars
  const bandHeight = 164;
  const band = track(
    scene.add
      .rectangle(centerX, centerY - 24, width * 1.18, bandHeight, 0x020617, 0.86)
      .setAngle(-3)
      .setScale(0.05, 1)
      .setScrollFactor(0)
      .setDepth(depth)
  );
  const topTrim = track(
    scene.add
      .rectangle(centerX, centerY - 24 - bandHeight / 2, width * 1.18, 5, 0xf43f5e, 0.98)
      .setAngle(-3)
      .setScale(0.05, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(depth + 1)
  );
  const bottomTrim = track(
    scene.add
      .rectangle(centerX, centerY - 24 + bandHeight / 2, width * 1.18, 5, 0xfacc15, 0.98)
      .setAngle(-3)
      .setScale(0.05, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(depth + 1)
  );
  scene.tweens.add({
    targets: [band, topTrim, bottomTrim],
    scaleX: 1,
    duration: 190,
    ease: 'Cubic.Out'
  });

  // Expanding shockwave rings + radial burst behind 'K.O.'
  const ringOuter = track(
    scene.add
      .circle(centerX, centerY - 24, 48, 0xf43f5e, 0.18)
      .setStrokeStyle(8, 0xf43f5e, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(depth + 1)
  );
  const ringInner = track(
    scene.add
      .circle(centerX, centerY - 24, 32, 0xfacc15, 0.25)
      .setStrokeStyle(5, 0xffffff, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(depth + 2)
  );
  scene.tweens.add({
    targets: ringOuter,
    scale: 6.5,
    alpha: 0,
    duration: 540,
    ease: 'Cubic.Out'
  });
  scene.tweens.add({
    targets: ringInner,
    scale: 4.8,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.Out'
  });

  // Optional atlas KO emblem watermark behind the text
  if (scene.textures.exists(FIGHTING_UI_ATLAS_TEXTURE_KEY)) {
    const icon = track(
      scene.add
        .image(centerX, centerY - 24, FIGHTING_UI_ATLAS_TEXTURE_KEY, 'icon-ko')
        .setScale(0.4)
        .setAlpha(0.32)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(depth + 2)
    );
    scene.tweens.add({
      targets: icon,
      scale: 2.1,
      alpha: 0.22,
      duration: 280,
      ease: 'Back.Out'
    });
  }

  // Main 'K.O.' slam text
  const koText = track(
    scene.add
      .text(centerX, centerY - 30, 'K.O.', {
        color: '#fff1f2',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: '108px',
        stroke: '#be123c',
        strokeThickness: 14,
        shadow: {
          offsetX: 0,
          offsetY: 6,
          color: '#020617',
          blur: 14,
          stroke: true,
          fill: true
        }
      })
      .setOrigin(0.5)
      .setScale(2.35)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(depth + 4)
  );
  scene.tweens.add({
    targets: koText,
    scale: 1,
    alpha: 1,
    duration: 230,
    ease: 'Back.Out'
  });

  const subText = track(
    scene.add
      .text(centerX, centerY + 34, 'K N O C K O U T !', {
        color: '#facc15',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: '20px',
        stroke: '#020617',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(depth + 4)
  );
  scene.tweens.add({
    targets: subText,
    alpha: 1,
    delay: 130,
    duration: 180,
    ease: 'Quad.Out'
  });

  // Fade out cleanly near end of duration
  const fadeOutDelay = Math.max(450, durationMs - 260);
  timers.push(
    scene.time.delayedCall(fadeOutDelay, () => {
      if (!scene.scene.isActive()) {
        return;
      }
      scene.tweens.add({
        targets: objects,
        alpha: 0,
        duration: 240,
        ease: 'Quad.In'
      });
    })
  );

  const destroy = (): void => {
    timers.forEach((t) => t.remove(false));
    timers.length = 0;
    objects.forEach((obj) => obj.destroy());
    objects.length = 0;
  };

  timers.push(scene.time.delayedCall(durationMs + 40, destroy));

  return { destroy };
}
