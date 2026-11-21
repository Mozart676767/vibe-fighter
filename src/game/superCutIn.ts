import * as Phaser from 'phaser';

import { getCharacterDefinition } from './hero';
import { VFX_HEX, type VfxColor } from './vfx';

/**
 * Base render depth for the super cut-in. Sits above the HUD (100) and round
 * banner (200) but below the end-of-match overlay (300) so a special on the
 * final KO frame can't paint over the game-over screen. Layers stack upward
 * from here.
 */
const CUTIN_DEPTH = 250;
const DEPTH_BACKDROP = CUTIN_DEPTH;
const DEPTH_STREAKS = CUTIN_DEPTH + 1;
const DEPTH_PORTRAIT = CUTIN_DEPTH + 2;
const DEPTH_CAPTION = CUTIN_DEPTH + 3;
const DEPTH_LETTERBOX = CUTIN_DEPTH + 4;
const DEPTH_FLASH = CUTIN_DEPTH + 5;

/** Accent colour per cut-in flavour. */
const COLOR: Record<VfxColor, number> = VFX_HEX;

/** Cinematic timeline (ms): slide the portrait in, hold the pose, sweep it out. */
const SLIDE_IN_MS = 240;
const HOLD_MS = 380;
const SLIDE_OUT_MS = 240;
const TOTAL_MS = SLIDE_IN_MS + HOLD_MS + SLIDE_OUT_MS;

const STREAK_COUNT = 24;
/** How far the portrait's trapezium mask narrows at the top vs the bottom. */
const TRAPEZIUM_SLANT = 0.16;

/** Options for {@link playSuperCutIn}. */
export interface SuperCutInOptions {
  /** Character whose portrait flies in. */
  characterId: string;
  /** Screen side the portrait enters from (P1 left, P2 right). */
  side: 'left' | 'right';
  /** Accent colour for the wash, streaks, and burst (default gold). */
  color?: VfxColor;
  /** Signature jutsu / special move title shown beneath the character name. */
  subtitle?: string;
}

/**
 * Plays a grandiose, fighting-game-style super-move cut-in: the screen dims to a
 * lightbox with cinematic letterbox bars, neon speed-lines and radial burst rays
 * sweep across, and the character's large portrait slams in with an aura edge —
 * masked into an angled trapezium panel — alongside a skewed jutsu nameplate.
 */
export function playSuperCutIn(scene: Phaser.Scene, options: SuperCutInOptions): number {
  const color = COLOR[options.color ?? 'gold'];
  const cam = scene.cameras.main;
  const width = cam.width;
  const height = cam.height;
  const fromLeft = options.side === 'left';
  const layers: Phaser.GameObjects.GameObject[] = [];

  const track = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
    layers.push(object);
    return object;
  };

  const barHeight = Math.round(height * 0.115);
  const outDelay = SLIDE_IN_MS + HOLD_MS;

  // 1) Deep dramatic lightbox dim + side-split accent glow.
  const lightbox = track(
    scene.add.rectangle(width / 2, height / 2, width, height, 0x020617, 0).setScrollFactor(0).setDepth(DEPTH_BACKDROP)
  );
  scene.tweens.add({ targets: lightbox, alpha: 0.72, duration: SLIDE_IN_MS, ease: 'Quad.Out' });
  scene.tweens.add({ targets: lightbox, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Quad.In' });

  const wash = track(
    scene.add
      .rectangle(fromLeft ? 0 : width, height / 2, width * 0.78, height, color, 0.0)
      .setOrigin(fromLeft ? 0 : 1, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(DEPTH_BACKDROP)
  );
  scene.tweens.add({ targets: wash, alpha: 0.28, duration: SLIDE_IN_MS, ease: 'Quad.Out' });
  scene.tweens.add({ targets: wash, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Quad.In' });

  // Diagonal full-screen energy ribbon behind the portrait & nameplate.
  const ribbon = track(
    scene.add
      .rectangle(width / 2, height / 2, width * 1.4, height * 0.34, color, 0)
      .setAngle(fromLeft ? -6 : 6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(DEPTH_BACKDROP)
  );
  scene.tweens.add({ targets: ribbon, alpha: 0.22, duration: SLIDE_IN_MS, ease: 'Quad.Out' });
  scene.tweens.add({ targets: ribbon, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Quad.In' });

  // 2) Dense anime speed bars sweeping across in both white-hot and accent tones.
  const fromX = fromLeft ? -width * 0.45 : width * 1.45;
  const toX = fromLeft ? width * 1.45 : -width * 0.45;
  for (let index = 0; index < STREAK_COUNT; index += 1) {
    const y = Phaser.Math.Between(barHeight, height - barHeight);
    const isCore = index % 4 === 0;
    const streak = track(
      scene.add
        .rectangle(
          fromX,
          y,
          Phaser.Math.Between(width * 0.4, width * 1.0),
          isCore ? Phaser.Math.Between(2, 5) : Phaser.Math.Between(5, 14),
          isCore ? 0xffffff : color,
          isCore ? 0.85 : 0.62
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(DEPTH_STREAKS)
        .setAngle(fromLeft ? -6 : 6)
    );
    scene.tweens.add({ targets: streak, x: toX, alpha: 0, delay: index * 14, duration: 420, ease: 'Quad.Out' });
  }

  // 3) The big portrait slamming in from the side, masked into a glowing trapezium panel.
  buildPortrait(scene, track, options, { width, height, fromLeft, color });

  // 4) Skewed metallic nameplate + Character name & signature jutsu title.
  const captionFromX = fromLeft ? width + 320 : -320;
  const captionRestX = fromLeft ? width - 38 : 38;
  const captionY = options.subtitle ? height * 0.44 : height * 0.5;

  const plateWidth = 520;
  const plateHeight = options.subtitle ? 128 : 82;
  const plateFromX = fromLeft ? width + plateWidth : -plateWidth;
  const plateRestX = fromLeft ? width - plateWidth * 0.5 - 20 : plateWidth * 0.5 + 20;

  const plate = track(
    scene.add
      .rectangle(plateFromX, height * 0.5, plateWidth, plateHeight, 0x05070d, 0.86)
      .setStrokeStyle(3, color, 0.95)
      .setAngle(fromLeft ? -4 : 4)
      .setScrollFactor(0)
      .setDepth(DEPTH_CAPTION - 1)
  );
  const plateEdge = track(
    scene.add
      .rectangle(
        plateFromX + (fromLeft ? -plateWidth * 0.48 : plateWidth * 0.48),
        height * 0.5,
        10,
        plateHeight,
        0xffffff,
        0.95
      )
      .setAngle(fromLeft ? -4 : 4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(DEPTH_CAPTION)
  );

  scene.tweens.add({ targets: plate, x: plateRestX, duration: SLIDE_IN_MS, ease: 'Back.Out' });
  scene.tweens.add({
    targets: plateEdge,
    x: plateRestX + (fromLeft ? -plateWidth * 0.48 : plateWidth * 0.48),
    duration: SLIDE_IN_MS,
    ease: 'Back.Out'
  });
  scene.tweens.add({ targets: plate, x: plateFromX, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Back.In' });
  scene.tweens.add({
    targets: plateEdge,
    x: plateFromX + (fromLeft ? -plateWidth * 0.48 : plateWidth * 0.48),
    alpha: 0,
    delay: outDelay,
    duration: SLIDE_OUT_MS,
    ease: 'Back.In'
  });

  const caption = track(
    scene.add
      .text(captionFromX, captionY, getCharacterDefinition(options.characterId).label.toUpperCase(), {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: '42px',
        stroke: '#020617',
        strokeThickness: 7
      })
      .setOrigin(fromLeft ? 1 : 0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_CAPTION)
  );
  scene.tweens.add({ targets: caption, x: captionRestX, duration: SLIDE_IN_MS, ease: 'Back.Out' });
  scene.tweens.add({ targets: caption, x: captionFromX, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Back.In' });

  if (options.subtitle) {
    const accentHex = `#${color.toString(16).padStart(6, '0')}`;
    const sub = track(
      scene.add
        .text(captionFromX, height * 0.555, options.subtitle.toUpperCase(), {
          color: accentHex,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fontSize: '30px',
          stroke: '#020617',
          strokeThickness: 6
        })
        .setOrigin(fromLeft ? 1 : 0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH_CAPTION)
    );
    scene.tweens.add({ targets: sub, x: captionRestX, duration: SLIDE_IN_MS + 25, ease: 'Back.Out' });
    scene.tweens.add({ targets: sub, x: captionFromX, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Back.In' });
  }

  // 5) Cinematic letterbox bars with glowing accent trim lines.
  const topBar = track(
    scene.add.rectangle(width / 2, -barHeight / 2, width, barHeight, 0x000000, 1).setScrollFactor(0).setDepth(DEPTH_LETTERBOX)
  );
  const bottomBar = track(
    scene.add
      .rectangle(width / 2, height + barHeight / 2, width, barHeight, 0x000000, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH_LETTERBOX)
  );
  const topTrim = track(
    scene.add.rectangle(width / 2, 0, width, 3, color, 0.9).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setDepth(DEPTH_LETTERBOX + 1)
  );
  const bottomTrim = track(
    scene.add.rectangle(width / 2, height, width, 3, color, 0.9).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0).setDepth(DEPTH_LETTERBOX + 1)
  );

  scene.tweens.add({ targets: topBar, y: barHeight / 2, duration: SLIDE_IN_MS, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: bottomBar, y: height - barHeight / 2, duration: SLIDE_IN_MS, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: topTrim, y: barHeight, duration: SLIDE_IN_MS, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: bottomTrim, y: height - barHeight, duration: SLIDE_IN_MS, ease: 'Cubic.Out' });

  scene.tweens.add({ targets: topBar, y: -barHeight / 2, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Cubic.In' });
  scene.tweens.add({ targets: bottomBar, y: height + barHeight / 2, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Cubic.In' });
  scene.tweens.add({ targets: topTrim, y: 0, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Cubic.In' });
  scene.tweens.add({ targets: bottomTrim, y: height, alpha: 0, delay: outDelay, duration: SLIDE_OUT_MS, ease: 'Cubic.In' });

  // 6) Impact flash + camera punch shake as the portrait slams into position.
  const flash = track(
    scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0).setScrollFactor(0).setDepth(DEPTH_FLASH)
  );
  scene.tweens.add({
    targets: flash,
    alpha: 0.72,
    delay: SLIDE_IN_MS - 50,
    duration: 75,
    yoyo: true,
    ease: 'Quad.Out'
  });
  scene.time.delayedCall(SLIDE_IN_MS - 40, () => {
    if (scene.scene.isActive()) {
      cam.shake(150, 0.008);
    }
  });

  scene.time.delayedCall(TOTAL_MS + 140, () => layers.forEach((object) => object.destroy()));

  return TOTAL_MS;
}

/**
 * Builds the sliding portrait plus its glowing aura silhouette, neon trapezium frame,
 * geometry mask, and starburst landing burst.
 */
function buildPortrait(
  scene: Phaser.Scene,
  track: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  options: SuperCutInOptions,
  layout: { width: number; height: number; fromLeft: boolean; color: number }
): void {
  const { width, height, fromLeft, color } = layout;
  const portraitKey = getCharacterDefinition(options.characterId).portrait.key;
  if (!scene.textures.exists(portraitKey)) {
    return;
  }

  const source = scene.textures.get(portraitKey).getSourceImage();
  const scale = (height * 1.05) / source.height;
  const displayWidth = source.width * scale;
  const displayHeight = source.height * scale;
  const restX = fromLeft ? displayWidth * 0.42 : width - displayWidth * 0.42;
  const offX = fromLeft ? -displayWidth * 0.65 : width + displayWidth * 0.65;

  // Radial anime starburst lines behind the portrait
  const rays = track(scene.add.graphics({ x: restX, y: height / 2 }).setScrollFactor(0).setDepth(DEPTH_PORTRAIT - 1).setAlpha(0));
  rays.fillStyle(color, 0.32);
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    rays.fillTriangle(
      0,
      0,
      Math.cos(a - 0.08) * height * 0.9,
      Math.sin(a - 0.08) * height * 0.9,
      Math.cos(a + 0.08) * height * 0.9,
      Math.sin(a + 0.08) * height * 0.9
    );
  }
  scene.tweens.add({ targets: rays, alpha: 0.9, angle: fromLeft ? 25 : -25, delay: SLIDE_IN_MS - 40, duration: HOLD_MS, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: rays, alpha: 0, delay: SLIDE_IN_MS + HOLD_MS, duration: SLIDE_OUT_MS });

  // Glowing colored aura silhouette behind the portrait
  const aura = track(
    scene.add
      .image(offX, height / 2, portraitKey)
      .setScrollFactor(0)
      .setDepth(DEPTH_PORTRAIT)
      .setScale(scale * 1.07)
      .setTint(color)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setFlipX(fromLeft)
  );

  const portrait = track(
    scene.add
      .image(offX, height / 2, portraitKey)
      .setScrollFactor(0)
      .setDepth(DEPTH_PORTRAIT)
      .setScale(scale)
      .setFlipX(fromLeft)
  );

  // Trapezium mask & neon border frame travelling together
  const halfH = displayHeight * 0.5;
  const halfWBottom = displayWidth * 0.5;
  const halfWTop = halfWBottom - displayWidth * TRAPEZIUM_SLANT;
  const maskGraphics = track(scene.add.graphics({ x: offX, y: height / 2 }).setScrollFactor(0));
  maskGraphics.fillStyle(0xffffff, 1);
  maskGraphics.beginPath();
  maskGraphics.moveTo(-halfWTop, -halfH);
  maskGraphics.lineTo(halfWTop, -halfH);
  maskGraphics.lineTo(halfWBottom, halfH);
  maskGraphics.lineTo(-halfWBottom, halfH);
  maskGraphics.closePath();
  maskGraphics.fillPath();
  maskGraphics.setVisible(false);
  portrait.setMask(maskGraphics.createGeometryMask());

  const frame = track(scene.add.graphics({ x: offX, y: height / 2 }).setScrollFactor(0).setDepth(DEPTH_PORTRAIT + 1));
  frame.lineStyle(8, color, 0.95);
  frame.beginPath();
  frame.moveTo(-halfWTop, -halfH);
  frame.lineTo(halfWTop, -halfH);
  frame.lineTo(halfWBottom, halfH);
  frame.lineTo(-halfWBottom, halfH);
  frame.closePath();
  frame.strokePath();
  frame.lineStyle(3, 0xffffff, 0.95);
  frame.strokePath();

  const outDelay = SLIDE_IN_MS + HOLD_MS;
  scene.tweens.add({
    targets: [portrait, aura, maskGraphics, frame],
    x: restX,
    duration: SLIDE_IN_MS,
    ease: 'Back.Out'
  });
  scene.tweens.add({
    targets: portrait,
    scale: scale * 1.06,
    delay: SLIDE_IN_MS,
    duration: HOLD_MS,
    ease: 'Sine.InOut',
    yoyo: true
  });
  scene.tweens.add({
    targets: aura,
    scale: scale * 1.16,
    alpha: 0.25,
    delay: SLIDE_IN_MS,
    duration: HOLD_MS,
    ease: 'Sine.InOut',
    yoyo: true
  });
  scene.tweens.add({
    targets: [portrait, aura, maskGraphics, frame],
    x: offX,
    duration: SLIDE_OUT_MS,
    delay: outDelay,
    ease: 'Back.In'
  });
  scene.tweens.add({
    targets: [portrait, aura, frame],
    alpha: 0,
    delay: outDelay,
    duration: SLIDE_OUT_MS,
    ease: 'Quad.In'
  });

  // Double shock burst rings where the portrait lands.
  const burstOuter = track(
    scene.add
      .circle(restX, height / 2, 42, color, 0)
      .setStrokeStyle(9, color, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(DEPTH_PORTRAIT)
  );
  const burstInner = track(
    scene.add
      .circle(restX, height / 2, 24, 0xffffff, 0)
      .setStrokeStyle(5, 0xffffff, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(DEPTH_PORTRAIT)
  );
  scene.tweens.add({ targets: burstOuter, scale: 8, alpha: 0, delay: SLIDE_IN_MS - 30, duration: 420, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: burstInner, scale: 6.5, alpha: 0, delay: SLIDE_IN_MS - 10, duration: 360, ease: 'Cubic.Out' });
}
