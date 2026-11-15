import * as Phaser from 'phaser';

import { spawnChargeAura, VFX_HEX, type VfxColor } from './vfx';

const JUTSU_BACK_DEPTH = 4;
const JUTSU_DEPTH = 88;
const JUTSU_FRONT_DEPTH = 94;

export type SpecialBehaviorKind = 'dash' | 'teleport' | 'ranged' | 'aoe';

export interface SpecialPowerConfig {
  id: string;
  jutsuName: string;
  color: VfxColor;
  kind: SpecialBehaviorKind;
  dashSpeed: number;
  range: number;
  hitboxHeight: number;
  hitCount: number;
  hitIntervalMs: number;
  durationMs: number;
}

export interface SpriteSnapshot {
  textureKey: string;
  frameName: string | number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
  flipX: boolean;
  depth: number;
}

export interface SpecialFxContext {
  scene: Phaser.Scene;
  x: number;
  groundY: number;
  bodyHeight: number;
  facing: 1 | -1;
  targetX?: number | null;
  sprite?: SpriteSnapshot;
}

const DEFAULT_POWER: SpecialPowerConfig = {
  id: 'default',
  jutsuName: 'Chakra Burst',
  color: 'gold',
  kind: 'dash',
  dashSpeed: 720,
  range: 190,
  hitboxHeight: 170,
  hitCount: 1,
  hitIntervalMs: 110,
  durationMs: 520
};

export const SPECIAL_POWERS: Record<string, SpecialPowerConfig> = {
  naruto: {
    id: 'naruto',
    jutsuName: 'Rasengan',
    color: 'blue',
    kind: 'dash',
    dashSpeed: 790,
    range: 210,
    hitboxHeight: 175,
    hitCount: 3,
    hitIntervalMs: 110,
    durationMs: 600
  },
  sasuke: {
    id: 'sasuke',
    jutsuName: 'Chidori',
    color: 'blue',
    kind: 'dash',
    dashSpeed: 980,
    range: 220,
    hitboxHeight: 170,
    hitCount: 1,
    hitIntervalMs: 100,
    durationMs: 540
  },
  kakashi: {
    id: 'kakashi',
    jutsuName: 'Raikiri',
    color: 'cyan',
    kind: 'dash',
    dashSpeed: 930,
    range: 225,
    hitboxHeight: 170,
    hitCount: 1,
    hitIntervalMs: 100,
    durationMs: 540
  },
  minato: {
    id: 'minato',
    jutsuName: 'Flying Raijin',
    color: 'gold',
    kind: 'teleport',
    dashSpeed: 0,
    range: 205,
    hitboxHeight: 180,
    hitCount: 1,
    hitIntervalMs: 100,
    durationMs: 560
  },
  itachi: {
    id: 'itachi',
    jutsuName: 'Amaterasu',
    color: 'red',
    kind: 'ranged',
    dashSpeed: 0,
    range: 420,
    hitboxHeight: 195,
    hitCount: 3,
    hitIntervalMs: 130,
    durationMs: 680
  },
  gaara: {
    id: 'gaara',
    jutsuName: 'Sand Coffin',
    color: 'gold',
    kind: 'ranged',
    dashSpeed: 0,
    range: 400,
    hitboxHeight: 215,
    hitCount: 2,
    hitIntervalMs: 175,
    durationMs: 680
  },
  sakura: {
    id: 'sakura',
    jutsuName: 'Cherry Blossom Impact',
    color: 'pink',
    kind: 'dash',
    dashSpeed: 460,
    range: 320,
    hitboxHeight: 205,
    hitCount: 1,
    hitIntervalMs: 100,
    durationMs: 600
  },
  'rock-lee': {
    id: 'rock-lee',
    jutsuName: 'Hidden Lotus',
    color: 'green',
    kind: 'dash',
    dashSpeed: 1080,
    range: 200,
    hitboxHeight: 180,
    hitCount: 3,
    hitIntervalMs: 115,
    durationMs: 640
  },
  jiraiya: {
    id: 'jiraiya',
    jutsuName: 'Toad Flame Jutsu',
    color: 'orange',
    kind: 'ranged',
    dashSpeed: 0,
    range: 440,
    hitboxHeight: 200,
    hitCount: 3,
    hitIntervalMs: 125,
    durationMs: 680
  },
  pain: {
    id: 'pain',
    jutsuName: 'Shinra Tensei',
    color: 'purple',
    kind: 'aoe',
    dashSpeed: 0,
    range: 350,
    hitboxHeight: 265,
    hitCount: 1,
    hitIntervalMs: 100,
    durationMs: 640
  },
  goku: {
    id: 'goku',
    jutsuName: 'Kamehameha',
    color: 'cyan',
    kind: 'ranged',
    dashSpeed: 0,
    range: 480,
    hitboxHeight: 195,
    hitCount: 3,
    hitIntervalMs: 115,
    durationMs: 680
  },
  luffy: {
    id: 'luffy',
    jutsuName: 'Red Hawk',
    color: 'red',
    kind: 'dash',
    dashSpeed: 940,
    range: 230,
    hitboxHeight: 185,
    hitCount: 3,
    hitIntervalMs: 110,
    durationMs: 620
  },
  gojo: {
    id: 'gojo',
    jutsuName: 'Hollow Purple',
    color: 'purple',
    kind: 'ranged',
    dashSpeed: 0,
    range: 470,
    hitboxHeight: 220,
    hitCount: 1,
    hitIntervalMs: 100,
    durationMs: 680
  },
  ichigo: {
    id: 'ichigo',
    jutsuName: 'Getsuga Tenshou',
    color: 'blue',
    kind: 'ranged',
    dashSpeed: 0,
    range: 460,
    hitboxHeight: 210,
    hitCount: 2,
    hitIntervalMs: 135,
    durationMs: 640
  },
  tanjiro: {
    id: 'tanjiro',
    jutsuName: 'Hinokami Kagura',
    color: 'orange',
    kind: 'dash',
    dashSpeed: 880,
    range: 235,
    hitboxHeight: 190,
    hitCount: 3,
    hitIntervalMs: 110,
    durationMs: 620
  }
};

export function getSpecialPower(characterId: string): SpecialPowerConfig {
  return SPECIAL_POWERS[characterId] ?? DEFAULT_POWER;
}

export function spawnSpecialChargeFx(ctx: SpecialFxContext, power: SpecialPowerConfig): void {
  const midY = ctx.groundY - ctx.bodyHeight * 0.48;
  const hex = VFX_HEX[power.color];
  spawnChargeAura(ctx.scene, ctx.x, midY, power.color);

  // Glowing sprite silhouette pulse around the caster during wind-up.
  spawnSpriteAura(ctx, hex, 1.14, 420);

  // Rising chakra motes around the caster.
  for (let i = 0; i < 10; i += 1) {
    const mote = ctx.scene.add
      .circle(
        ctx.x + Phaser.Math.Between(-50, 50),
        ctx.groundY - Phaser.Math.Between(6, 36),
        Phaser.Math.Between(3, 6),
        hex,
        0.9
      )
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(JUTSU_DEPTH);
    ctx.scene.tweens.add({
      targets: mote,
      y: mote.y - Phaser.Math.Between(90, 170),
      alpha: 0,
      scale: 0.3,
      delay: i * 32,
      duration: 380,
      ease: 'Cubic.Out',
      onComplete: () => mote.destroy()
    });
  }

  if (power.id === 'itachi' || power.id === 'sasuke' || power.id === 'kakashi') {
    spawnSharinganCrest(ctx.scene, ctx.x, ctx.groundY - ctx.bodyHeight * 0.85, power.id === 'itachi');
  } else if (power.id === 'rock-lee') {
    spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0x22c55e, 0xef4444);
  } else if (power.id === 'pain') {
    spawnRinneganCrest(ctx.scene, ctx.x, midY, true);
  } else if (power.id === 'gaara') {
    spawnSandSwirl(ctx.scene, ctx.x, ctx.groundY, 14);
  } else if (power.id === 'minato') {
    spawnHiraishinSeal(ctx.scene, ctx.x, ctx.groundY - 12);
  } else if (power.id === 'goku') {
    spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0xfacc15, 0x38bdf8);
  } else if (power.id === 'luffy') {
    spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0xef4444, 0xfca5a5);
  } else if (power.id === 'gojo') {
    spawnGojoConvergenceCharge(ctx.scene, ctx.x + ctx.facing * 42, midY);
  } else if (power.id === 'ichigo') {
    spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0x38bdf8, 0x0f172a);
  } else if (power.id === 'tanjiro') {
    spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0xf97316, 0x22d3ee);
  }
}

export function spawnSpecialTeleportFx(scene: Phaser.Scene, x: number, groundY: number, bodyHeight: number): void {
  const midY = groundY - bodyHeight * 0.48;
  const flash = scene.add
    .rectangle(x, midY, 28, bodyHeight * 1.45, 0xfef08a, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);

  const sealKey = ensureHiraishinSealTexture(scene);
  const seal = scene.add
    .image(x, midY, sealKey)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.75)
    .setDepth(JUTSU_FRONT_DEPTH);

  scene.tweens.add({
    targets: flash,
    scaleX: 3.1,
    scaleY: 1.3,
    alpha: 0,
    duration: 260,
    ease: 'Cubic.Out',
    onComplete: () => flash.destroy()
  });

  scene.tweens.add({
    targets: seal,
    scale: 1.65,
    angle: 120,
    alpha: 0,
    duration: 360,
    ease: 'Cubic.Out',
    onComplete: () => seal.destroy()
  });
}

export function spawnSpecialDashTrailFx(ctx: SpecialFxContext, power: SpecialPowerConfig): void {
  const hex = VFX_HEX[power.color];
  if (ctx.sprite && ctx.scene.textures.exists(ctx.sprite.textureKey)) {
    const ghostColor =
      power.id === 'rock-lee'
        ? Math.random() < 0.45
          ? 0xef4444
          : 0x22c55e
        : power.id === 'luffy'
          ? 0xf97316
          : power.id === 'tanjiro'
            ? Math.random() < 0.5
              ? 0xf97316
              : 0xfacc15
            : hex;
    const ghost = ctx.scene.add
      .sprite(ctx.x, ctx.groundY, ctx.sprite.textureKey, ctx.sprite.frameName)
      .setOrigin(ctx.sprite.originX, ctx.sprite.originY)
      .setScale(ctx.sprite.scaleX, ctx.sprite.scaleY)
      .setFlipX(ctx.sprite.flipX)
      .setTint(ghostColor)
      .setAlpha(0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Math.max(1, ctx.sprite.depth - 1));

    ctx.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ctx.sprite.scaleX * 1.08,
      duration: 230,
      ease: 'Quad.Out',
      onComplete: () => ghost.destroy()
    });
    return;
  }

  const midY = ctx.groundY - ctx.bodyHeight * 0.45;
  const fallback = ctx.scene.add
    .ellipse(ctx.x, midY, 44, ctx.bodyHeight * 0.85, hex, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_DEPTH - 1);
  ctx.scene.tweens.add({
    targets: fallback,
    alpha: 0,
    duration: 200,
    onComplete: () => fallback.destroy()
  });
}

export function spawnSpecialExecuteFx(ctx: SpecialFxContext, power: SpecialPowerConfig): void {
  spawnSuperStageDim(ctx.scene, power.color, power.durationMs);
  spawnSpriteAura(ctx, VFX_HEX[power.color], 1.18, power.durationMs);

  switch (power.id) {
    case 'naruto':
      spawnRasenganFx(ctx, 0x38bdf8, 0xe0f2fe, 'blue');
      break;
    case 'minato':
      spawnRasenganFx(ctx, 0xfacc15, 0xfef9c3, 'gold');
      break;
    case 'sasuke':
      spawnLightningBladeFx(ctx, 0x60a5fa, 0xeff6ff, true);
      break;
    case 'kakashi':
      spawnLightningBladeFx(ctx, 0x22d3ee, 0xffffff, false);
      break;
    case 'itachi':
      spawnAmaterasuFx(ctx);
      break;
    case 'gaara':
      spawnSandCoffinFx(ctx);
      break;
    case 'sakura':
      spawnCherryBlossomImpactFx(ctx);
      break;
    case 'rock-lee':
      spawnHiddenLotusFx(ctx);
      break;
    case 'jiraiya':
      spawnToadFlameFx(ctx);
      break;
    case 'pain':
      spawnShinraTenseiFx(ctx);
      break;
    case 'goku':
      spawnKamehamehaFx(ctx);
      break;
    case 'luffy':
      spawnRedHawkFx(ctx);
      break;
    case 'gojo':
      spawnHollowPurpleFx(ctx);
      break;
    case 'ichigo':
      spawnGetsugaTenshouFx(ctx);
      break;
    case 'tanjiro':
      spawnHinokamiKaguraFx(ctx);
      break;
    default:
      spawnRasenganFx(ctx, VFX_HEX[power.color], 0xffffff, 'gold');
      break;
  }
}

function spawnSuperStageDim(scene: Phaser.Scene, color: VfxColor, durationMs: number): void {
  const cam = scene.cameras.main;
  const tint = color === 'red' ? 0x1a0308 : color === 'purple' ? 0x120624 : 0x020617;
  const dim = scene.add
    .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, tint, 0)
    .setScrollFactor(0)
    .setDepth(JUTSU_BACK_DEPTH);

  scene.tweens.add({
    targets: dim,
    alpha: 0.52,
    duration: 110,
    ease: 'Quad.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: dim,
        alpha: 0,
        delay: Math.max(120, durationMs - 140),
        duration: 240,
        ease: 'Quad.In',
        onComplete: () => dim.destroy()
      });
    }
  });
}

function spawnSpriteAura(ctx: SpecialFxContext, hex: number, scaleMult: number, durationMs: number): void {
  if (!ctx.sprite || !ctx.scene.textures.exists(ctx.sprite.textureKey)) {
    return;
  }

  const aura = ctx.scene.add
    .sprite(ctx.x, ctx.groundY, ctx.sprite.textureKey, ctx.sprite.frameName)
    .setOrigin(ctx.sprite.originX, ctx.sprite.originY)
    .setScale(ctx.sprite.scaleX * scaleMult, ctx.sprite.scaleY * scaleMult)
    .setFlipX(ctx.sprite.flipX)
    .setTint(hex)
    .setAlpha(0.55)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Math.max(1, ctx.sprite.depth - 1));

  ctx.scene.tweens.add({
    targets: aura,
    alpha: 0,
    scaleX: ctx.sprite.scaleX * (scaleMult + 0.14),
    scaleY: ctx.sprite.scaleY * (scaleMult + 0.14),
    duration: Math.min(480, durationMs),
    ease: 'Cubic.Out',
    onComplete: () => aura.destroy()
  });
}

function spawnRasenganFx(
  ctx: SpecialFxContext,
  outerColor: number,
  innerColor: number,
  variant: 'blue' | 'gold'
): void {
  const handX = ctx.x + ctx.facing * 58;
  const handY = ctx.groundY - ctx.bodyHeight * 0.48;
  const dist = ctx.targetX != null ? Phaser.Math.Clamp(Math.abs(ctx.targetX - ctx.x) - 24, 130, 260) : 200;
  const travel = ctx.facing * dist;

  const orbKey = ensureRasenganTexture(ctx.scene, outerColor, innerColor, variant);
  const orb = ctx.scene.add
    .image(handX, handY, orbKey)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.45)
    .setDepth(JUTSU_FRONT_DEPTH + 1);

  const glow = ctx.scene.add
    .circle(handX, handY, 52, outerColor, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);

  ctx.scene.tweens.add({
    targets: [orb, glow],
    x: handX + travel,
    scale: 1.15,
    duration: 330,
    ease: 'Cubic.Out',
    onComplete: () => {
      const impactX = orb.x;
      ctx.scene.cameras.main.shake(220, 0.011);

      const vortex = ctx.scene.add
        .image(impactX, handY, orbKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.1)
        .setDepth(JUTSU_FRONT_DEPTH + 1);

      ctx.scene.tweens.add({
        targets: vortex,
        scale: 2.8,
        angle: ctx.facing * 360,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.Out',
        onComplete: () => vortex.destroy()
      });

      const shock = ctx.scene.add
        .circle(impactX, handY, 36, innerColor, 0.25)
        .setStrokeStyle(6, outerColor, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH);

      ctx.scene.tweens.add({
        targets: shock,
        scale: 3.8,
        alpha: 0,
        duration: 280,
        ease: 'Cubic.Out',
        onComplete: () => shock.destroy()
      });

      for (let s = 0; s < 12; s += 1) {
        const angle = (Math.PI * 2 * s) / 12;
        const spark = ctx.scene.add
          .circle(impactX, handY, 5, innerColor, 0.95)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(JUTSU_FRONT_DEPTH + 2);
        ctx.scene.tweens.add({
          targets: spark,
          x: impactX + Math.cos(angle) * 140,
          y: handY + Math.sin(angle) * 110,
          alpha: 0,
          scale: 0.2,
          duration: 280,
          ease: 'Cubic.Out',
          onComplete: () => spark.destroy()
        });
      }

      orb.destroy();
      glow.destroy();
    }
  });

  ctx.scene.tweens.add({
    targets: orb,
    angle: ctx.facing * 540,
    duration: 330
  });

  // Swirling wind spiral rings
  for (let i = 0; i < 5; i += 1) {
    const ring = ctx.scene.add
      .ellipse(handX + ctx.facing * (i * 22), handY, 26, 62, outerColor, 0)
      .setStrokeStyle(3, outerColor, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(JUTSU_DEPTH);
    ctx.scene.tweens.add({
      targets: ring,
      x: handX + travel + ctx.facing * (i * 18),
      scaleX: 2.4,
      scaleY: 1.6,
      alpha: 0,
      delay: i * 48,
      duration: 300,
      onComplete: () => ring.destroy()
    });
  }
}

function spawnLightningBladeFx(ctx: SpecialFxContext, boltColor: number, coreColor: number, isChidori: boolean): void {
  const startX = ctx.x + ctx.facing * 54;
  const handY = ctx.groundY - ctx.bodyHeight * 0.46;
  const targetOffset = ctx.facing * 260;

  const glow = ctx.scene.add
    .circle(startX, handY, 44, boltColor, 0.45)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);
  const core = ctx.scene.add
    .circle(startX, handY, 18, coreColor, 0.98)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH + 1);

  ctx.scene.tweens.add({
    targets: [glow, core],
    x: startX + targetOffset,
    scale: 1.5,
    alpha: 0,
    duration: 400,
    ease: 'Quad.Out',
    onComplete: () => {
      glow.destroy();
      core.destroy();
    }
  });

  // Animated multi-branch crackling lightning arcs across 6 frames
  for (let wave = 0; wave < 6; wave += 1) {
    ctx.scene.time.delayedCall(wave * 52, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const g = ctx.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(JUTSU_FRONT_DEPTH + 2);
      const baseX = startX + ctx.facing * (wave * 38);

      // Outer electric glow branches
      g.lineStyle(4.5, boltColor, 0.85);
      for (let b = 0; b < 4; b += 1) {
        let px = baseX;
        let py = handY + Phaser.Math.Between(-28, 28);
        g.beginPath();
        g.moveTo(px, py);
        for (let seg = 0; seg < 5; seg += 1) {
          px += ctx.facing * Phaser.Math.Between(18, 36);
          py += Phaser.Math.Between(-34, 34);
          g.lineTo(px, py);
        }
        g.strokePath();
      }

      // White-hot inner core bolt
      g.lineStyle(2, coreColor, 1);
      let cx = baseX;
      let cy = handY;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let seg = 0; seg < 4; seg += 1) {
        cx += ctx.facing * Phaser.Math.Between(24, 42);
        cy += Phaser.Math.Between(-20, 20);
        g.lineTo(cx, cy);
      }
      g.strokePath();

      // Ground discharge streak for Chidori
      if (isChidori) {
        g.lineStyle(3, boltColor, 0.8);
        g.lineBetween(baseX, ctx.groundY - 6, baseX + ctx.facing * 90, handY + 12);
      }

      ctx.scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: 150,
        onComplete: () => g.destroy()
      });
    });
  }
}

function spawnAmaterasuFx(ctx: SpecialFxContext): void {
  spawnSharinganCrest(ctx.scene, ctx.x, ctx.groundY - ctx.bodyHeight * 0.9, true);

  // Flapping black crow silhouettes scattering across the arena
  for (let f = 0; f < 12; f += 1) {
    const startX = ctx.x + ctx.facing * Phaser.Math.Between(10, 60);
    const startY = ctx.groundY - ctx.bodyHeight * 0.55 + Phaser.Math.Between(-35, 25);
    const crow = ctx.scene.add.graphics({ x: startX, y: startY }).setDepth(JUTSU_FRONT_DEPTH + 1);
    crow.lineStyle(3, 0x09090b, 1);
    crow.beginPath();
    crow.moveTo(-12, -5);
    crow.lineTo(0, 3);
    crow.lineTo(12, -5);
    crow.strokePath();
    crow.lineStyle(1.5, 0xef4444, 0.75);
    crow.strokeCircle(0, 2, 3);

    ctx.scene.tweens.add({
      targets: crow,
      x: startX + ctx.facing * Phaser.Math.Between(120, 420),
      y: startY + Phaser.Math.Between(-110, 40),
      angle: Phaser.Math.Between(-45, 45),
      scale: Phaser.Math.FloatBetween(0.9, 1.5),
      alpha: 0,
      delay: f * 25,
      duration: 540,
      ease: 'Cubic.Out',
      onComplete: () => crow.destroy()
    });
  }

  // Roaring black-core crimson-edged Amaterasu flame pillars along the ground
  const flameCount = 8;
  for (let i = 0; i < flameCount; i += 1) {
    const fxX = ctx.x + ctx.facing * (68 + i * 48);
    ctx.scene.time.delayedCall(i * 42, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const flame = ctx.scene.add.graphics({ x: fxX, y: ctx.groundY }).setDepth(JUTSU_FRONT_DEPTH);
      // Crimson outer aura
      flame.fillStyle(0xdc2626, 0.85);
      flame.fillTriangle(-32, 0, 32, 0, -6, -155);
      flame.fillTriangle(-24, 0, 28, 0, 14, -125);
      // Pitch-black core flames
      flame.fillStyle(0x050507, 0.98);
      flame.fillTriangle(-20, 0, 20, 0, -4, -130);
      flame.fillTriangle(-14, 0, 18, 0, 10, -98);

      flame.setScale(0.7, 0.25);
      ctx.scene.tweens.add({
        targets: flame,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 180,
        ease: 'Back.Out',
        onComplete: () => {
          ctx.scene.tweens.add({
            targets: flame,
            scaleY: 0.9,
            alpha: 0,
            duration: 320,
            ease: 'Quad.In',
            onComplete: () => flame.destroy()
          });
        }
      });
    });
  }
}

function spawnSandCoffinFx(ctx: SpecialFxContext): void {
  const targetCenter =
    ctx.targetX != null
      ? Phaser.Math.Clamp(ctx.targetX, ctx.x + ctx.facing * 80, ctx.x + ctx.facing * 360)
      : ctx.x + ctx.facing * 210;

  // Surging sand tsunami rolling from Gaara to the target
  for (let i = 0; i < 6; i += 1) {
    const waveX = ctx.x + ctx.facing * (55 + i * 52);
    ctx.scene.time.delayedCall(i * 40, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const crest = ctx.scene.add
        .ellipse(waveX, ctx.groundY - 12, 72, 24, 0xd97706, 0.85)
        .setStrokeStyle(3, 0xfde68a, 0.7)
        .setOrigin(0.5, 1)
        .setDepth(JUTSU_DEPTH);
      ctx.scene.tweens.add({
        targets: crest,
        scaleY: 4.5,
        scaleX: 1.35,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.Out',
        onComplete: () => crest.destroy()
      });
    });
  }

  // Giant crushing twin sand jaws slamming inward around the target
  ctx.scene.time.delayedCall(150, () => {
    if (!ctx.scene.scene.isActive()) {
      return;
    }
    const leftWall = ctx.scene.add
      .rectangle(targetCenter - 135, ctx.groundY - 8, 54, 185, 0xb45309, 0.92)
      .setStrokeStyle(3, 0xfbbf24, 0.9)
      .setOrigin(0.5, 1)
      .setDepth(JUTSU_FRONT_DEPTH);
    const rightWall = ctx.scene.add
      .rectangle(targetCenter + 135, ctx.groundY - 8, 54, 185, 0xb45309, 0.92)
      .setStrokeStyle(3, 0xfbbf24, 0.9)
      .setOrigin(0.5, 1)
      .setDepth(JUTSU_FRONT_DEPTH);

    ctx.scene.tweens.add({
      targets: leftWall,
      x: targetCenter - 26,
      duration: 180,
      ease: 'Cubic.In',
      onComplete: () => {
        ctx.scene.cameras.main.shake(180, 0.01);
        ctx.scene.tweens.add({
          targets: leftWall,
          alpha: 0,
          scaleY: 1.15,
          duration: 240,
          onComplete: () => leftWall.destroy()
        });
      }
    });

    ctx.scene.tweens.add({
      targets: rightWall,
      x: targetCenter + 26,
      duration: 180,
      ease: 'Cubic.In',
      onComplete: () => {
        ctx.scene.tweens.add({
          targets: rightWall,
          alpha: 0,
          scaleY: 1.15,
          duration: 240,
          onComplete: () => rightWall.destroy()
        });
      }
    });
  });

  // Swirling dense sand particles
  for (let p = 0; p < 24; p += 1) {
    const grain = ctx.scene.add
      .circle(
        targetCenter + Phaser.Math.Between(-120, 120),
        ctx.groundY - Phaser.Math.Between(8, 120),
        Phaser.Math.Between(3, 6),
        p % 2 === 0 ? 0xfbbf24 : 0xd97706,
        0.95
      )
      .setDepth(JUTSU_FRONT_DEPTH + 1);
    ctx.scene.tweens.add({
      targets: grain,
      x: targetCenter + Phaser.Math.Between(-60, 60),
      y: grain.y - Phaser.Math.Between(40, 140),
      alpha: 0,
      delay: 140 + p * 12,
      duration: 380,
      onComplete: () => grain.destroy()
    });
  }
}

function spawnCherryBlossomImpactFx(ctx: SpecialFxContext): void {
  const impactX = ctx.x + ctx.facing * 135;
  const impactY = ctx.groundY - 8;

  ctx.scene.cameras.main.shake(280, 0.015);

  // Blinding pink chakra impact dome
  const dome = ctx.scene.add
    .circle(impactX, impactY, 38, 0xf472b6, 0.5)
    .setStrokeStyle(6, 0xfdf2f8, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);
  ctx.scene.tweens.add({
    targets: dome,
    scale: 5.4,
    alpha: 0,
    duration: 480,
    ease: 'Cubic.Out',
    onComplete: () => dome.destroy()
  });

  // Ground-shattering glowing fissures along the stage floor
  const cracks = ctx.scene.add.graphics().setDepth(JUTSU_DEPTH);
  cracks.lineStyle(4, 0xf472b6, 0.95);
  for (let c = -3; c <= 3; c += 1) {
    let cx = impactX + c * 22;
    let cy = impactY;
    cracks.beginPath();
    cracks.moveTo(cx, cy);
    for (let s = 0; s < 3; s += 1) {
      cx += c * 24 + Phaser.Math.Between(-14, 14);
      cy += Phaser.Math.Between(-10, 10);
      cracks.lineTo(cx, cy);
    }
    cracks.strokePath();
  }
  ctx.scene.tweens.add({
    targets: cracks,
    alpha: 0,
    delay: 220,
    duration: 340,
    onComplete: () => cracks.destroy()
  });

  // Flying fractured stone blocks
  for (let i = 0; i < 10; i += 1) {
    const slab = ctx.scene.add
      .rectangle(impactX + Phaser.Math.Between(-100, 120), impactY, Phaser.Math.Between(16, 30), 14, 0x334155, 0.96)
      .setStrokeStyle(2, 0xf472b6, 0.85)
      .setAngle(Phaser.Math.Between(-35, 35))
      .setDepth(JUTSU_DEPTH + 1);

    ctx.scene.tweens.add({
      targets: slab,
      x: slab.x + Phaser.Math.Between(-90, 90) + ctx.facing * 50,
      y: impactY - Phaser.Math.Between(90, 210),
      angle: slab.angle + Phaser.Math.Between(-180, 180),
      alpha: 0,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => slab.destroy()
    });
  }

  // 26 detailed cherry blossom petals swirling upward and drifting outward
  const petalKey = ensureSakuraPetalTexture(ctx.scene);
  for (let p = 0; p < 26; p += 1) {
    const petal = ctx.scene.add
      .image(impactX + Phaser.Math.Between(-50, 70), impactY - 14, petalKey)
      .setScale(Phaser.Math.FloatBetween(0.7, 1.35))
      .setAngle(Phaser.Math.Between(0, 360))
      .setDepth(JUTSU_FRONT_DEPTH + 1);

    ctx.scene.tweens.add({
      targets: petal,
      x: petal.x + ctx.facing * Phaser.Math.Between(40, 280) + Phaser.Math.Between(-90, 90),
      y: petal.y - Phaser.Math.Between(70, 260),
      angle: petal.angle + Phaser.Math.Between(-360, 360),
      alpha: 0,
      delay: p * 12,
      duration: 620,
      ease: 'Sine.Out',
      onComplete: () => petal.destroy()
    });
  }
}

function spawnHiddenLotusFx(ctx: SpecialFxContext): void {
  const midY = ctx.groundY - ctx.bodyHeight * 0.48;
  spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0x22c55e, 0xef4444);

  // Rapid multi-hit taijutsu slash rings & crimson finisher lotus bloom
  for (let i = 0; i < 4; i += 1) {
    ctx.scene.time.delayedCall(i * 110, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const isFinisher = i === 3;
      const strikeX = ctx.x + ctx.facing * (76 + i * 40);
      const strikeY = midY + Phaser.Math.Between(-30, 20);
      const color = isFinisher ? 0xef4444 : 0x22c55e;

      const slash = ctx.scene.add
        .ellipse(strikeX, strikeY, isFinisher ? 110 : 75, 20, isFinisher ? 0xfca5a5 : 0x86efac, 0.85)
        .setAngle(isFinisher ? 0 : Phaser.Math.Between(-45, 45))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH + 1);

      ctx.scene.tweens.add({
        targets: slash,
        scaleX: 1.8,
        scaleY: 0.4,
        alpha: 0,
        duration: 210,
        ease: 'Cubic.Out',
        onComplete: () => slash.destroy()
      });

      const ring = ctx.scene.add
        .circle(strikeX, strikeY, 24, color, 0.25)
        .setStrokeStyle(5, color, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH);
      ctx.scene.tweens.add({
        targets: ring,
        scale: isFinisher ? 4.0 : 2.3,
        alpha: 0,
        duration: 270,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy()
      });
    });
  }
}

function spawnToadFlameFx(ctx: SpecialFxContext): void {
  const mouthX = ctx.x + ctx.facing * 52;
  const mouthY = ctx.groundY - ctx.bodyHeight * 0.62;

  // Roaring layered flamethrower wave across the arena
  for (let i = 0; i < 14; i += 1) {
    ctx.scene.time.delayedCall(i * 32, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const isHotCore = i % 3 === 0;
      const flameColor = isHotCore ? 0xfef08a : i % 2 === 0 ? 0xf97316 : 0xef4444;
      const fireball = ctx.scene.add
        .circle(mouthX, mouthY + Phaser.Math.Between(-16, 16), Phaser.Math.Between(20, 36), flameColor, 0.82)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH);

      ctx.scene.tweens.add({
        targets: fireball,
        x: mouthX + ctx.facing * Phaser.Math.Between(260, 430),
        y: ctx.groundY - Phaser.Math.Between(28, 130),
        scale: Phaser.Math.FloatBetween(1.6, 2.3),
        alpha: 0,
        duration: 440,
        ease: 'Quad.Out',
        onComplete: () => fireball.destroy()
      });
    });
  }

  // Rising glowing ember sparks
  for (let e = 0; e < 18; e += 1) {
    const ember = ctx.scene.add
      .circle(
        mouthX + ctx.facing * Phaser.Math.Between(60, 380),
        ctx.groundY - Phaser.Math.Between(10, 60),
        Phaser.Math.Between(2, 5),
        0xfde047,
        0.95
      )
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(JUTSU_FRONT_DEPTH + 1);
    ctx.scene.tweens.add({
      targets: ember,
      y: ember.y - Phaser.Math.Between(80, 190),
      x: ember.x + ctx.facing * Phaser.Math.Between(20, 80),
      alpha: 0,
      delay: 100 + e * 18,
      duration: 460,
      onComplete: () => ember.destroy()
    });
  }
}

function spawnShinraTenseiFx(ctx: SpecialFxContext): void {
  const centerY = ctx.groundY - ctx.bodyHeight * 0.5;
  ctx.scene.cameras.main.shake(300, 0.017);

  spawnRinneganCrest(ctx.scene, ctx.x, centerY, false);

  const dome = ctx.scene.add
    .circle(ctx.x, centerY, 44, 0xa855f7, 0.36)
    .setStrokeStyle(7, 0xf3e8ff, 0.98)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);
  ctx.scene.tweens.add({
    targets: dome,
    scale: 8.8,
    alpha: 0,
    duration: 500,
    ease: 'Cubic.Out',
    onComplete: () => dome.destroy()
  });

  // 20 radial Almighty Push repulsion streaks
  for (let s = 0; s < 20; s += 1) {
    const angle = (Math.PI * 2 * s) / 20;
    const streak = ctx.scene.add
      .rectangle(ctx.x, centerY, 48, 5, 0xe9d5ff, 0.9)
      .setRotation(angle)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(JUTSU_FRONT_DEPTH + 1);
    ctx.scene.tweens.add({
      targets: streak,
      x: ctx.x + Math.cos(angle) * 350,
      y: centerY + Math.sin(angle) * 280,
      scaleX: 2.0,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.Out',
      onComplete: () => streak.destroy()
    });
  }
}

function spawnGojoConvergenceCharge(scene: Phaser.Scene, cx: number, cy: number): void {
  const blueOrb = scene.add
    .circle(cx - 56, cy - 28, 16, 0x38bdf8, 0.9)
    .setStrokeStyle(4, 0xe0f2fe, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);
  const redOrb = scene.add
    .circle(cx + 56, cy + 28, 16, 0xef4444, 0.9)
    .setStrokeStyle(4, 0xfee2e2, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH);

  scene.tweens.add({
    targets: [blueOrb, redOrb],
    x: cx,
    y: cy,
    scale: 1.35,
    alpha: 0.1,
    duration: 360,
    ease: 'Cubic.In',
    onComplete: () => {
      blueOrb.destroy();
      redOrb.destroy();
    }
  });
}

function spawnKamehamehaFx(ctx: SpecialFxContext): void {
  const originX = ctx.x + ctx.facing * 52;
  const beamY = ctx.groundY - ctx.bodyHeight * 0.48;
  const beamLen = 490;
  const beamCenterX = originX + ctx.facing * (beamLen / 2);

  ctx.scene.cameras.main.shake(300, 0.015);

  const flare = ctx.scene.add
    .circle(originX, beamY, 42, 0x38bdf8, 0.55)
    .setStrokeStyle(6, 0xffffff, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH + 2);

  const outerBeam = ctx.scene.add
    .rectangle(beamCenterX, beamY, beamLen, 72, 0x0ea5e9, 0.65)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.1, 0.5)
    .setDepth(JUTSU_FRONT_DEPTH);
  const innerBeam = ctx.scene.add
    .rectangle(beamCenterX, beamY, beamLen, 30, 0xf0f9ff, 0.98)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.1, 0.4)
    .setDepth(JUTSU_FRONT_DEPTH + 1);

  ctx.scene.tweens.add({
    targets: [outerBeam, innerBeam],
    scaleX: 1.05,
    scaleY: 1.25,
    duration: 160,
    ease: 'Cubic.Out',
    onComplete: () => {
      ctx.scene.tweens.add({
        targets: [outerBeam, innerBeam],
        scaleY: 0.15,
        alpha: 0,
        delay: 280,
        duration: 240,
        ease: 'Quad.In',
        onComplete: () => {
          outerBeam.destroy();
          innerBeam.destroy();
        }
      });
    }
  });

  ctx.scene.tweens.add({
    targets: flare,
    scale: 1.8,
    alpha: 0,
    delay: 260,
    duration: 260,
    onComplete: () => flare.destroy()
  });

  // Expanding shockwave rings sliding down the Kamehameha beam
  for (let i = 0; i < 6; i += 1) {
    const ring = ctx.scene.add
      .ellipse(originX + ctx.facing * 24, beamY, 22, 82, 0x22d3ee, 0)
      .setStrokeStyle(4, 0xbae6fd, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(JUTSU_FRONT_DEPTH + 2);
    ctx.scene.tweens.add({
      targets: ring,
      x: originX + ctx.facing * (beamLen - 20),
      scaleY: 1.45,
      alpha: 0,
      delay: i * 52,
      duration: 320,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy()
    });
  }
}

function spawnRedHawkFx(ctx: SpecialFxContext): void {
  const midY = ctx.groundY - ctx.bodyHeight * 0.48;
  spawnSteamPillars(ctx.scene, ctx.x, ctx.groundY, 0xef4444, 0xf97316);

  // Fiery stretched fist bursts & Gear 2 explosion waves
  for (let i = 0; i < 4; i += 1) {
    ctx.scene.time.delayedCall(i * 105, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const isFinisher = i === 3;
      const strikeX = ctx.x + ctx.facing * (85 + i * 44);
      const strikeY = midY + Phaser.Math.Between(-20, 14);

      if (isFinisher) {
        ctx.scene.cameras.main.shake(260, 0.015);
      }

      const fireStreak = ctx.scene.add
        .ellipse(strikeX - ctx.facing * 24, strikeY, isFinisher ? 150 : 105, isFinisher ? 44 : 26, 0xf97316, 0.85)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH);
      const core = ctx.scene.add
        .circle(strikeX + ctx.facing * 20, strikeY, isFinisher ? 34 : 20, 0xfef08a, 0.95)
        .setStrokeStyle(5, 0xef4444, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH + 1);

      ctx.scene.tweens.add({
        targets: [fireStreak, core],
        scale: isFinisher ? 2.4 : 1.5,
        alpha: 0,
        duration: isFinisher ? 340 : 210,
        ease: 'Cubic.Out',
        onComplete: () => {
          fireStreak.destroy();
          core.destroy();
        }
      });

      if (isFinisher) {
        for (let b = 0; b < 14; b += 1) {
          const angle = (Math.PI * 2 * b) / 14;
          const ember = ctx.scene.add
            .circle(strikeX, strikeY, 6, b % 2 === 0 ? 0xf97316 : 0xfacc15, 0.95)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(JUTSU_FRONT_DEPTH + 2);
          ctx.scene.tweens.add({
            targets: ember,
            x: strikeX + Math.cos(angle) * 170,
            y: strikeY + Math.sin(angle) * 140,
            alpha: 0,
            scale: 0.25,
            duration: 320,
            ease: 'Cubic.Out',
            onComplete: () => ember.destroy()
          });
        }
      }
    });
  }
}

function spawnHollowPurpleFx(ctx: SpecialFxContext): void {
  const startX = ctx.x + ctx.facing * 64;
  const orbY = ctx.groundY - ctx.bodyHeight * 0.52;
  const endX = ctx.x + ctx.facing * 470;
  const key = ensureHollowPurpleTexture(ctx.scene);

  ctx.scene.cameras.main.shake(280, 0.014);

  const sphere = ctx.scene.add
    .image(startX, orbY, key)
    .setScale(0.35)
    .setDepth(JUTSU_FRONT_DEPTH + 2);
  const aura = ctx.scene.add
    .circle(startX, orbY, 58, 0xa855f7, 0.45)
    .setStrokeStyle(5, 0xf3e8ff, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH + 1);

  ctx.scene.tweens.add({
    targets: [sphere, aura],
    x: endX,
    scale: 1.55,
    duration: 460,
    ease: 'Cubic.In',
    onComplete: () => {
      ctx.scene.cameras.main.shake(220, 0.013);
      const burst = ctx.scene.add
        .circle(endX, orbY, 48, 0xc084fc, 0.45)
        .setStrokeStyle(7, 0xffffff, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH + 2);
      ctx.scene.tweens.add({
        targets: burst,
        scale: 3.4,
        alpha: 0,
        duration: 280,
        ease: 'Cubic.Out',
        onComplete: () => burst.destroy()
      });
      sphere.destroy();
      aura.destroy();
    }
  });

  ctx.scene.tweens.add({
    targets: sphere,
    angle: ctx.facing * 540,
    duration: 460
  });

  // Trailing purple void rings behind Hollow Purple
  for (let i = 0; i < 6; i += 1) {
    const trailX = startX + ctx.facing * (i * 66);
    ctx.scene.time.delayedCall(i * 55, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const ring = ctx.scene.add
        .ellipse(trailX, orbY, 34, 110, 0xa855f7, 0)
        .setStrokeStyle(4, 0xd8b4fe, 0.85)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_DEPTH);
      ctx.scene.tweens.add({
        targets: ring,
        scale: 1.75,
        alpha: 0,
        duration: 240,
        onComplete: () => ring.destroy()
      });
    });
  }
}

function spawnGetsugaTenshouFx(ctx: SpecialFxContext): void {
  const startX = ctx.x + ctx.facing * 56;
  const centerY = ctx.groundY - ctx.bodyHeight * 0.5;
  const endX = ctx.x + ctx.facing * 450;
  const key = ensureGetsugaTexture(ctx.scene);

  ctx.scene.cameras.main.shake(250, 0.013);

  const crescent = ctx.scene.add
    .image(startX, centerY, key)
    .setFlipX(ctx.facing < 0)
    .setScale(0.7, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(JUTSU_FRONT_DEPTH + 1);
  const darkCore = ctx.scene.add
    .image(startX - ctx.facing * 6, centerY, key)
    .setFlipX(ctx.facing < 0)
    .setTint(0x0f172a)
    .setAlpha(0.75)
    .setScale(0.62, 0.82)
    .setDepth(JUTSU_FRONT_DEPTH);

  ctx.scene.tweens.add({
    targets: [crescent, darkCore],
    x: endX,
    scaleY: 1.45,
    scaleX: 1.25,
    duration: 420,
    ease: 'Cubic.Out',
    onComplete: () => {
      ctx.scene.tweens.add({
        targets: [crescent, darkCore],
        alpha: 0,
        duration: 180,
        onComplete: () => {
          crescent.destroy();
          darkCore.destroy();
        }
      });
    }
  });

  // Ground slash fissure marks along the Getsuga path
  for (let i = 0; i < 7; i += 1) {
    ctx.scene.time.delayedCall(i * 45, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const gx = startX + ctx.facing * (i * 60);
      const streak = ctx.scene.add
        .rectangle(gx, ctx.groundY - 12, 46, 12, 0x38bdf8, 0.85)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_DEPTH);
      ctx.scene.tweens.add({
        targets: streak,
        scaleY: 3.0,
        alpha: 0,
        duration: 240,
        onComplete: () => streak.destroy()
      });
    });
  }
}

function spawnHinokamiKaguraFx(ctx: SpecialFxContext): void {
  const midY = ctx.groundY - ctx.bodyHeight * 0.48;
  ctx.scene.cameras.main.shake(240, 0.013);

  // Swirling Sun Breathing flame slash arcs & radiant solar rings
  for (let i = 0; i < 4; i += 1) {
    ctx.scene.time.delayedCall(i * 105, () => {
      if (!ctx.scene.scene.isActive()) {
        return;
      }
      const isFinisher = i === 3;
      const sx = ctx.x + ctx.facing * (76 + i * 44);
      const sy = midY + Phaser.Math.Between(-24, 18);

      const arc = ctx.scene.add.graphics({ x: sx, y: sy }).setBlendMode(Phaser.BlendModes.ADD).setDepth(JUTSU_FRONT_DEPTH + 1);
      arc.lineStyle(isFinisher ? 14 : 10, 0xf97316, 0.92);
      arc.beginPath();
      arc.arc(0, 0, isFinisher ? 78 : 54, -Math.PI * 0.65, Math.PI * 0.65);
      arc.strokePath();
      arc.lineStyle(5, 0xfef08a, 0.98);
      arc.beginPath();
      arc.arc(0, 0, isFinisher ? 74 : 50, -Math.PI * 0.55, Math.PI * 0.55);
      arc.strokePath();
      if (ctx.facing < 0) {
        arc.setScale(-1, 1);
      }

      ctx.scene.tweens.add({
        targets: arc,
        scaleX: ctx.facing < 0 ? -1.45 : 1.45,
        scaleY: 1.45,
        angle: ctx.facing * (isFinisher ? 90 : -45),
        alpha: 0,
        duration: isFinisher ? 340 : 240,
        ease: 'Cubic.Out',
        onComplete: () => arc.destroy()
      });

      const sunRing = ctx.scene.add
        .circle(sx, sy, isFinisher ? 36 : 22, 0xfacc15, 0.25)
        .setStrokeStyle(5, 0xef4444, 0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(JUTSU_FRONT_DEPTH);
      ctx.scene.tweens.add({
        targets: sunRing,
        scale: isFinisher ? 3.8 : 2.2,
        alpha: 0,
        duration: 280,
        onComplete: () => sunRing.destroy()
      });
    });
  }
}

function spawnSharinganCrest(scene: Phaser.Scene, x: number, y: number, mangekyou: boolean): void {
  const key = ensureSharinganTexture(scene, mangekyou);
  const crest = scene.add
    .image(x, y, key)
    .setScale(0.3)
    .setAlpha(0.95)
    .setDepth(JUTSU_FRONT_DEPTH + 1);

  scene.tweens.add({
    targets: crest,
    scale: 1.5,
    angle: 180,
    alpha: 0,
    duration: 460,
    ease: 'Cubic.Out',
    onComplete: () => crest.destroy()
  });
}

function spawnRinneganCrest(scene: Phaser.Scene, x: number, y: number, inward: boolean): void {
  const key = ensureRinneganTexture(scene);
  const crest = scene.add
    .image(x, y, key)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(inward ? 1.8 : 0.4)
    .setAlpha(0.85)
    .setDepth(JUTSU_DEPTH);

  scene.tweens.add({
    targets: crest,
    scale: inward ? 0.35 : 3.2,
    alpha: 0,
    duration: 440,
    ease: inward ? 'Sine.In' : 'Cubic.Out',
    onComplete: () => crest.destroy()
  });
}

function spawnHiraishinSeal(scene: Phaser.Scene, x: number, y: number): void {
  const key = ensureHiraishinSealTexture(scene);
  const seal = scene.add
    .image(x, y, key)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(0.9)
    .setDepth(JUTSU_DEPTH);

  scene.tweens.add({
    targets: seal,
    angle: 180,
    scale: 1.35,
    alpha: 0,
    duration: 400,
    onComplete: () => seal.destroy()
  });
}

function spawnSteamPillars(scene: Phaser.Scene, x: number, groundY: number, colorA: number, colorB: number): void {
  for (let i = 0; i < 7; i += 1) {
    const offset = Phaser.Math.Between(-40, 40);
    const bar = scene.add
      .rectangle(x + offset, groundY - 8, 16, 42, i % 2 === 0 ? colorA : colorB, 0.78)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(0.5, 1)
      .setDepth(JUTSU_DEPTH);
    scene.tweens.add({
      targets: bar,
      y: groundY - 140,
      height: 170,
      alpha: 0,
      delay: i * 35,
      duration: 380,
      ease: 'Cubic.Out',
      onComplete: () => bar.destroy()
    });
  }
}

function spawnSandSwirl(scene: Phaser.Scene, x: number, groundY: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const grain = scene.add
      .circle(x + Phaser.Math.Between(-50, 50), groundY - Phaser.Math.Between(6, 32), 6, 0xf59e0b, 0.92)
      .setDepth(JUTSU_DEPTH);
    ctxTweenSand(scene, grain, x);
  }
}

function ctxTweenSand(scene: Phaser.Scene, grain: Phaser.GameObjects.Arc, originX: number): void {
  scene.tweens.add({
    targets: grain,
    x: originX + Phaser.Math.Between(-32, 32),
    y: grain.y - Phaser.Math.Between(80, 175),
    alpha: 0,
    delay: Phaser.Math.Between(0, 180),
    duration: 380,
    onComplete: () => grain.destroy()
  });
}

function ensureRasenganTexture(
  scene: Phaser.Scene,
  outerColor: number,
  innerColor: number,
  variant: string
): string {
  const key = `vfx-rasengan-${variant}`;
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = 128;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  const outerHex = `#${outerColor.toString(16).padStart(6, '0')}`;
  const innerHex = `#${innerColor.toString(16).padStart(6, '0')}`;

  const grad = ctx.createRadialGradient(half, half, 4, half, half, half - 4);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(0.45, outerHex);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = innerHex;
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i += 1) {
    const start = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.arc(half, half, 26 + (i % 2) * 10, start, start + Math.PI * 0.85);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(half, half, 12, 0, Math.PI * 2);
  ctx.fill();

  scene.textures.addCanvas(key, canvas);
  return key;
}

function ensureSharinganTexture(scene: Phaser.Scene, mangekyou: boolean): string {
  const key = mangekyou ? 'vfx-mangekyou' : 'vfx-sharingan';
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = 128;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(half, half, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 6;
  ctx.stroke();

  if (mangekyou) {
    ctx.fillStyle = '#09090b';
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(half, half);
      ctx.rotate((Math.PI * 2 * i) / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(32, -26, 48, 4);
      ctx.quadraticCurveTo(18, 12, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(half, half, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(half, half, 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(half, half, 10, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 3; i += 1) {
      const a = (Math.PI * 2 * i) / 3;
      ctx.beginPath();
      ctx.arc(half + Math.cos(a) * 32, half + Math.sin(a) * 32, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  scene.textures.addCanvas(key, canvas);
  return key;
}

function ensureRinneganTexture(scene: Phaser.Scene): string {
  const key = 'vfx-rinnegan';
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = 160;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  for (let r = 18; r <= 72; r += 13) {
    ctx.strokeStyle = r > 55 ? '#e9d5ff' : '#a855f7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(half, half, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  scene.textures.addCanvas(key, canvas);
  return key;
}

function ensureHiraishinSealTexture(scene: Phaser.Scene): string {
  const key = 'vfx-hiraishin';
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = 128;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(half, half, 50, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(half, 14);
  ctx.lineTo(half, 114);
  ctx.moveTo(24, half - 18);
  ctx.lineTo(104, half - 18);
  ctx.moveTo(34, half + 18);
  ctx.lineTo(94, half + 18);
  ctx.stroke();

  scene.textures.addCanvas(key, canvas);
  return key;
}

function ensureSakuraPetalTexture(scene: Phaser.Scene): string {
  const key = 'vfx-sakura-petal';
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath();
  ctx.moveTo(12, 22);
  ctx.quadraticCurveTo(2, 12, 6, 4);
  ctx.lineTo(12, 8);
  ctx.lineTo(18, 4);
  ctx.quadraticCurveTo(22, 12, 12, 22);
  ctx.fill();

  scene.textures.addCanvas(key, canvas);
  return key;
}

function ensureHollowPurpleTexture(scene: Phaser.Scene): string {
  const key = 'vfx-hollow-purple';
  if (scene.textures.exists(key)) {
    return key;
  }

  const size = 160;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  const grad = ctx.createRadialGradient(half, half, 6, half, half, half - 4);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.28, '#e9d5ff');
  grad.addColorStop(0.58, '#9333ea');
  grad.addColorStop(0.84, '#4c1d95');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#f3e8ff';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i += 1) {
    const start = (Math.PI * 2 * i) / 3;
    ctx.beginPath();
    ctx.arc(half, half, 36 + i * 10, start, start + Math.PI * 0.9);
    ctx.stroke();
  }

  scene.textures.addCanvas(key, canvas);
  return key;
}

function ensureGetsugaTexture(scene: Phaser.Scene): string {
  const key = 'vfx-getsuga-crescent';
  if (scene.textures.exists(key)) {
    return key;
  }

  const w = 140;
  const h = 220;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return key;
  }

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(0.55, '#38bdf8');
  grad.addColorStop(1, '#f0f9ff');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.quadraticCurveTo(w * 1.08, h * 0.5, 16, h - 10);
  ctx.quadraticCurveTo(w * 0.62, h * 0.5, 16, 10);
  ctx.closePath();
  ctx.fill();

  scene.textures.addCanvas(key, canvas);
  return key;
}
