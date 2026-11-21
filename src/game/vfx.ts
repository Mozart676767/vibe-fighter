import * as Phaser from 'phaser';

import { FIGHTING_UI_ATLAS_TEXTURE_KEY } from './fightingUiAtlas';

/** Render depth for combat VFX: above fighters, below the HUD. */
const VFX_DEPTH = 90;

/** Tint/spark colour keyed to the kind of impact or character chakra. */
export type VfxColor = 'red' | 'gold' | 'blue' | 'cyan' | 'purple' | 'green' | 'pink' | 'orange';

const SPARK_FRAME: Record<VfxColor, string> = {
  red: 'icon-hit-red',
  gold: 'icon-hit-gold',
  blue: 'icon-hit-blue',
  cyan: 'icon-hit-blue',
  purple: 'icon-hit-blue',
  green: 'icon-hit-gold',
  pink: 'icon-hit-red',
  orange: 'icon-hit-gold'
};

export const VFX_HEX: Record<VfxColor, number> = {
  red: 0xff5a5a,
  gold: 0xffd24a,
  blue: 0x38bdf8,
  cyan: 0x22d3ee,
  purple: 0xa855f7,
  green: 0x22c55e,
  pink: 0xf472b6,
  orange: 0xf97316
};

const FLASH_TINT: Record<VfxColor, number> = VFX_HEX;

/**
 * Spawns a short-lived hit spark (an atlas impact icon) at a contact point that
 * pops in, scales up, and fades out. Used when an attack connects.
 * @param scene - The owning scene.
 * @param x - World x of the contact point.
 * @param y - World y of the contact point.
 * @param color - Spark colour (red clean hit, blue blocked, gold finisher, or chakra colour).
 * @param scale - Peak display scale of the spark (default 1).
 */
export function spawnHitSpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor = 'red',
  scale = 1
): void {
  const frame = SPARK_FRAME[color];
  if (!scene.textures.exists(FIGHTING_UI_ATLAS_TEXTURE_KEY)) {
    spawnImpactFlash(scene, x, y, color, 40 * scale);
    return;
  }

  const spark = scene.add
    .image(x, y, FIGHTING_UI_ATLAS_TEXTURE_KEY, frame)
    .setDepth(VFX_DEPTH)
    .setScrollFactor(1)
    .setScale(0.2 * scale)
    .setAngle(Phaser.Math.Between(-30, 30))
    .setAlpha(1);

  if (color !== 'red' && color !== 'gold' && color !== 'blue') {
    spark.setTint(FLASH_TINT[color]);
  }

  scene.tweens.add({
    targets: spark,
    scale: scale * 1.15,
    alpha: 0,
    duration: 240,
    ease: 'Cubic.Out',
    onComplete: () => spark.destroy()
  });

  spawnImpactFlash(scene, x, y, color, 38 * scale);
}

/**
 * Spawns an expanding ring flash at a point that fades as it grows.
 * @param scene - The owning scene.
 * @param x - World x of the flash centre.
 * @param y - World y of the flash centre.
 * @param color - Flash tint.
 * @param radius - Peak radius in world pixels.
 */
export function spawnImpactFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor,
  radius = 40
): void {
  const ring = scene.add
    .circle(x, y, radius * 0.32, FLASH_TINT[color], 0.58)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(VFX_DEPTH - 1)
    .setScrollFactor(1);

  scene.tweens.add({
    targets: ring,
    scale: 2.6,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy()
  });
}

/**
 * Spawns an intense anime-style impact explosion when a special attack connects:
 * double shockwave rings, radial star slashes, and flying chakra sparks.
 */
export function spawnSpecialImpactFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: VfxColor,
  finisher: boolean
): void {
  const hex = FLASH_TINT[color];

  // Outer expanding shockwave ring
  const outerRing = scene.add
    .circle(x, y, finisher ? 36 : 24, hex, 0.28)
    .setStrokeStyle(finisher ? 7 : 5, 0xffffff, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(VFX_DEPTH + 1);
  scene.tweens.add({
    targets: outerRing,
    scale: finisher ? 4.8 : 3.1,
    alpha: 0,
    duration: finisher ? 340 : 250,
    ease: 'Cubic.Out',
    onComplete: () => outerRing.destroy()
  });

  // Crossed anime impact star slashes
  const rayCount = finisher ? 8 : 5;
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (Math.PI * i) / rayCount + Phaser.Math.FloatBetween(-0.15, 0.15);
    const ray = scene.add
      .rectangle(x, y, finisher ? 190 : 120, finisher ? 8 : 5, i % 2 === 0 ? 0xffffff : hex, 0.95)
      .setRotation(angle)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(VFX_DEPTH + 2);
    scene.tweens.add({
      targets: ray,
      scaleX: 1.65,
      scaleY: 0.15,
      alpha: 0,
      duration: finisher ? 280 : 200,
      ease: 'Cubic.Out',
      onComplete: () => ray.destroy()
    });
  }

  // Scatter chakra particles
  const sparkCount = finisher ? 16 : 9;
  for (let s = 0; s < sparkCount; s += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(finisher ? 95 : 55, finisher ? 210 : 125);
    const dot = scene.add
      .circle(x, y, Phaser.Math.Between(3, finisher ? 7 : 5), s % 3 === 0 ? 0xffffff : hex, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(VFX_DEPTH + 2);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      scale: 0.15,
      alpha: 0,
      duration: Phaser.Math.Between(220, 360),
      ease: 'Cubic.Out',
      onComplete: () => dot.destroy()
    });
  }
}

/**
 * Spawns a special-move charge burst around a fighter: concentric inward
 * energy rings plus an expanding ground halo telegraphing the super.
 * @param scene - The owning scene.
 * @param x - World x of the fighter's centre.
 * @param y - World y of the fighter's centre (roughly mid-body).
 * @param color - Aura colour.
 */
export function spawnChargeAura(scene: Phaser.Scene, x: number, y: number, color: VfxColor = 'gold'): void {
  const hex = FLASH_TINT[color];

  const coreBurst = scene.add
    .circle(x, y, 22, 0xffffff, 0.75)
    .setStrokeStyle(5, hex, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(VFX_DEPTH);
  scene.tweens.add({
    targets: coreBurst,
    scale: 2.8,
    alpha: 0,
    duration: 380,
    ease: 'Cubic.Out',
    onComplete: () => coreBurst.destroy()
  });

  for (let index = 0; index < 4; index += 1) {
    const ring = scene.add
      .circle(x, y, 22, hex, 0)
      .setStrokeStyle(4, index % 2 === 0 ? hex : 0xffffff, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(VFX_DEPTH - 1)
      .setScrollFactor(1)
      .setScale(2.1);

    scene.tweens.add({
      targets: ring,
      scale: 0.2,
      alpha: 0,
      delay: index * 95,
      duration: 400,
      ease: 'Sine.In',
      onComplete: () => ring.destroy()
    });
  }
}
