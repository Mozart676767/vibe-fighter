import * as Phaser from 'phaser';

import {
  ensureGetsugaTexture,
  ensureHiraishinSealTexture,
  ensureHollowPurpleTexture,
  ensureRasenganTexture,
  ensureRinneganTexture,
  ensureSakuraPetalTexture,
  ensureSharinganTexture,
  spawnSandSwirl,
  spawnSteamPillars
} from './specialPowers';
import { VFX_HEX } from './vfx';
import type { CharacterVictoryProfile } from './victoryProfiles';

export {
  getCharacterVictoryProfile,
  VICTORY_PROFILES,
  type CharacterVictoryProfile,
  type VictoryFxKind,
  type VictoryMotionStyle,
  type VictoryPoseAction,
  type VictoryPoseStep
} from './victoryProfiles';

export interface VictoryTriggerContext {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  groundY: number;
  facing: 1 | -1;
  baseScale: number;
  registerTween: (tween: Phaser.Tweens.Tween) => void;
  registerTimer: (timer: Phaser.Time.TimerEvent) => void;
}

const VICTORY_FX_DEPTH = 95;
const VICTORY_BACK_DEPTH = 4;

/**
 * Triggers the winning character's unique physical choreography + signature VFX
 * burst on the arena floor.
 */
export function triggerVictoryMotionAndFx(ctx: VictoryTriggerContext, profile: CharacterVictoryProfile): void {
  triggerVictoryMotion(ctx, profile);
  spawnVictoryFx(ctx, profile);
}

function triggerVictoryMotion(ctx: VictoryTriggerContext, profile: CharacterVictoryProfile): void {
  const { scene, sprite, shadow, groundY, facing, baseScale, registerTween, registerTimer } = ctx;
  const startX = sprite.x;

  switch (profile.motion) {
    case 'hero-leap': {
      registerTween(
        scene.tweens.add({
          targets: sprite,
          y: groundY - 76,
          scaleX: baseScale * 1.07,
          scaleY: baseScale * 1.07,
          duration: 280,
          ease: 'Cubic.Out',
          yoyo: true,
          onComplete: () => {
            sprite.y = groundY;
            sprite.setScale(baseScale);
            spawnGroundRing(scene, sprite.x, groundY, VFX_HEX[profile.color], profile.accentHex);
          }
        })
      );
      registerTween(
        scene.tweens.add({
          targets: shadow,
          scale: 0.65,
          alpha: 0.18,
          duration: 280,
          ease: 'Cubic.Out',
          yoyo: true
        })
      );
      break;
    }

    case 'shadow-combo': {
      for (let i = 0; i < 3; i += 1) {
        registerTimer(
          scene.time.delayedCall(i * 210, () => {
            if (!scene.scene.isActive()) {
              return;
            }
            registerTween(
              scene.tweens.add({
                targets: sprite,
                x: startX + facing * (i % 2 === 0 ? 18 : -8),
                y: groundY - (i === 2 ? 42 : 16),
                duration: 105,
                ease: 'Quad.Out',
                yoyo: true,
                onComplete: () => {
                  sprite.x = startX;
                  sprite.y = groundY;
                }
              })
            );
          })
        );
      }
      break;
    }

    case 'levitate': {
      registerTween(
        scene.tweens.add({
          targets: sprite,
          y: groundY - 38,
          duration: 520,
          ease: 'Sine.Out',
          onComplete: () => {
            registerTween(
              scene.tweens.add({
                targets: sprite,
                y: groundY - 50,
                duration: 750,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: 2
              })
            );
          }
        })
      );
      registerTween(
        scene.tweens.add({
          targets: shadow,
          scale: 0.72,
          alpha: 0.2,
          duration: 520,
          ease: 'Sine.Out'
        })
      );
      break;
    }

    case 'power-surge': {
      registerTween(
        scene.tweens.add({
          targets: sprite,
          scaleX: baseScale * 1.12,
          scaleY: baseScale * 0.92,
          duration: 180,
          ease: 'Quad.Out',
          onComplete: () => {
            registerTween(
              scene.tweens.add({
                targets: sprite,
                scaleX: baseScale * 1.06,
                scaleY: baseScale * 1.08,
                duration: 240,
                ease: 'Back.Out',
                yoyo: true,
                onComplete: () => sprite.setScale(baseScale)
              })
            );
          }
        })
      );
      break;
    }

    case 'flash-step': {
      // Quick afterimage zip forward then snap back to pose
      for (let i = 0; i < 3; i += 1) {
        registerTimer(
          scene.time.delayedCall(i * 95, () => {
            if (!scene.scene.isActive()) {
              return;
            }
            const ghost = scene.add
              .sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
              .setOrigin(sprite.originX, sprite.originY)
              .setScale(sprite.scaleX, sprite.scaleY)
              .setFlipX(sprite.flipX)
              .setTint(VFX_HEX[profile.color])
              .setAlpha(0.65)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(Math.max(1, sprite.depth - 1));
            scene.tweens.add({
              targets: ghost,
              alpha: 0,
              scaleX: sprite.scaleX * 1.15,
              duration: 280,
              ease: 'Quad.Out',
              onComplete: () => ghost.destroy()
            });
          })
        );
      }
      registerTween(
        scene.tweens.add({
          targets: sprite,
          x: startX + facing * 42,
          duration: 150,
          ease: 'Cubic.Out',
          yoyo: true,
          onComplete: () => {
            sprite.x = startX;
          }
        })
      );
      break;
    }

    case 'blade-slash': {
      registerTween(
        scene.tweens.add({
          targets: sprite,
          x: startX + facing * 26,
          scaleX: baseScale * 1.08,
          duration: 170,
          ease: 'Cubic.Out',
          yoyo: true,
          onComplete: () => {
            sprite.x = startX;
            sprite.setScale(baseScale);
          }
        })
      );
      break;
    }

    case 'nonchalant': {
      // Subtle tiny bob — maximum contrast with the huge comedic burst
      registerTween(
        scene.tweens.add({
          targets: sprite,
          y: groundY - 8,
          duration: 140,
          ease: 'Sine.Out',
          yoyo: true
        })
      );
      break;
    }
  }
}

function spawnVictoryFx(ctx: VictoryTriggerContext, profile: CharacterVictoryProfile): void {
  const { scene, sprite, groundY, facing, registerTimer } = ctx;
  const x = sprite.x;
  const bodyH = sprite.displayHeight || 200;
  const midY = groundY - bodyH * 0.5;
  const primary = VFX_HEX[profile.color];
  const accent = profile.accentHex;

  // Base spotlight pillar behind the victor
  const beam = scene.add
    .rectangle(x, groundY, 130, 380, primary, 0.2)
    .setOrigin(0.5, 1)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(VICTORY_BACK_DEPTH);
  scene.tweens.add({
    targets: beam,
    scaleX: 1.45,
    alpha: 0.06,
    duration: 1450,
    ease: 'Sine.Out',
    onComplete: () => beam.destroy()
  });

  switch (profile.fxKind) {
    case 'rasengan-spiral': {
      const orbKey = ensureRasenganTexture(scene, 0x38bdf8, 0xe0f2fe, 'blue');
      const orb = scene.add
        .image(x + facing * 46, midY - 12, orbKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.2)
        .setDepth(VICTORY_FX_DEPTH);
      scene.tweens.add({
        targets: orb,
        scale: 1.1,
        angle: 720,
        duration: 620,
        ease: 'Back.Out',
        onComplete: () => {
          scene.tweens.add({
            targets: orb,
            scale: 1.6,
            alpha: 0,
            duration: 500,
            onComplete: () => orb.destroy()
          });
        }
      });
      spawnSteamPillars(scene, x, groundY, 0xf97316, 0x38bdf8);
      break;
    }

    case 'chidori-sharingan': {
      const crestKey = ensureSharinganTexture(scene, false);
      const eye = scene.add.image(x, groundY - bodyH * 0.92, crestKey).setScale(0.2).setDepth(VICTORY_FX_DEPTH);
      scene.tweens.add({
        targets: eye,
        scale: 0.95,
        angle: 240,
        alpha: 0,
        duration: 1150,
        ease: 'Cubic.Out',
        onComplete: () => eye.destroy()
      });
      spawnLightningBolts(scene, x, midY, 0x60a5fa, 0xeff6ff, 5, registerTimer);
      break;
    }

    case 'raikiri-leaves': {
      spawnLightningBolts(scene, x + facing * 24, midY, 0x22d3ee, 0xffffff, 3, registerTimer);
      for (let i = 0; i < 16; i += 1) {
        const leaf = scene.add
          .ellipse(x + Phaser.Math.Between(-90, 90), groundY - Phaser.Math.Between(30, 210), 12, 6, 0x4ade80, 0.9)
          .setAngle(Phaser.Math.Between(0, 180))
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: leaf,
          x: leaf.x + facing * Phaser.Math.Between(80, 210),
          y: leaf.y + Phaser.Math.Between(-30, 80),
          angle: leaf.angle + 320,
          alpha: 0,
          delay: i * 40,
          duration: 1050,
          ease: 'Sine.InOut',
          onComplete: () => leaf.destroy()
        });
      }
      break;
    }

    case 'hiraishin-flash': {
      const sealKey = ensureHiraishinSealTexture(scene);
      const seal = scene.add
        .image(x, midY, sealKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.4)
        .setDepth(VICTORY_BACK_DEPTH + 1);
      scene.tweens.add({
        targets: seal,
        scale: 1.85,
        angle: 180,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.Out',
        onComplete: () => seal.destroy()
      });
      spawnSparkBurst(scene, x, midY, 0xfacc15, 0xfef9c3, 18);
      break;
    }

    case 'crow-tsukuyomi': {
      const mKey = ensureSharinganTexture(scene, true);
      const mEye = scene.add
        .image(x, groundY - bodyH * 0.88, mKey)
        .setScale(0.25)
        .setAlpha(0.95)
        .setDepth(VICTORY_FX_DEPTH);
      scene.tweens.add({
        targets: mEye,
        scale: 1.25,
        angle: 360,
        alpha: 0,
        duration: 1250,
        ease: 'Cubic.Out',
        onComplete: () => mEye.destroy()
      });
      for (let i = 0; i < 14; i += 1) {
        const crow = scene.add
          .graphics({ x: x + Phaser.Math.Between(-40, 40), y: midY + Phaser.Math.Between(-40, 40) })
          .setDepth(VICTORY_FX_DEPTH);
        crow.lineStyle(3, 0x09090b, 1);
        crow.beginPath();
        crow.moveTo(-12, -5);
        crow.lineTo(0, 3);
        crow.lineTo(12, -5);
        crow.strokePath();
        crow.lineStyle(1.5, 0xef4444, 0.85);
        crow.strokeCircle(0, 2, 3);
        scene.tweens.add({
          targets: crow,
          x: crow.x + Phaser.Math.Between(-240, 240),
          y: crow.y - Phaser.Math.Between(60, 190),
          angle: Phaser.Math.Between(-40, 40),
          alpha: 0,
          delay: i * 38,
          duration: 950,
          ease: 'Cubic.Out',
          onComplete: () => crow.destroy()
        });
      }
      break;
    }

    case 'sand-throne': {
      spawnSandSwirl(scene, x, groundY, 22);
      for (const side of [-1, 1]) {
        const pillar = scene.add
          .rectangle(x + side * 66, groundY - 4, 24, 150, 0xd97706, 0.88)
          .setStrokeStyle(2, 0xfde68a, 0.9)
          .setOrigin(0.5, 1)
          .setScale(1, 0.1)
          .setDepth(VICTORY_BACK_DEPTH + 1);
        scene.tweens.add({
          targets: pillar,
          scaleY: 1,
          duration: 380,
          ease: 'Back.Out',
          onComplete: () => {
            scene.tweens.add({
              targets: pillar,
              alpha: 0,
              delay: 520,
              duration: 350,
              onComplete: () => pillar.destroy()
            });
          }
        });
      }
      break;
    }

    case 'sakura-bloom': {
      const petalKey = ensureSakuraPetalTexture(scene);
      spawnGroundRing(scene, x, groundY, 0xf472b6, 0xfdf2f8);
      for (let i = 0; i < 30; i += 1) {
        const petal = scene.add
          .image(x + Phaser.Math.Between(-85, 85), groundY - Phaser.Math.Between(10, 60), petalKey)
          .setScale(Phaser.Math.FloatBetween(0.75, 1.45))
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: petal,
          x: petal.x + Phaser.Math.Between(-140, 140),
          y: petal.y - Phaser.Math.Between(120, 260),
          angle: Phaser.Math.Between(-360, 360),
          alpha: 0,
          delay: i * 24,
          duration: 1100,
          ease: 'Sine.Out',
          onComplete: () => petal.destroy()
        });
      }
      break;
    }

    case 'eight-gates': {
      spawnSteamPillars(scene, x, groundY, 0x22c55e, 0xef4444);
      const star = scene.add
        .star(x + facing * 34, groundY - bodyH * 0.72, 4, 5, 18, 0xffffff, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(VICTORY_FX_DEPTH + 1);
      scene.tweens.add({
        targets: star,
        scale: 2.2,
        angle: 90,
        alpha: 0,
        delay: 480,
        duration: 520,
        ease: 'Cubic.Out',
        onComplete: () => star.destroy()
      });
      break;
    }

    case 'toad-sage': {
      spawnGroundRing(scene, x, groundY, 0xf97316, 0xfacc15);
      for (let i = 0; i < 16; i += 1) {
        const flame = scene.add
          .circle(x + Phaser.Math.Between(-75, 75), groundY - 12, Phaser.Math.Between(10, 20), i % 2 === 0 ? 0xf97316 : 0xfacc15, 0.85)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: flame,
          y: flame.y - Phaser.Math.Between(110, 230),
          scale: 0.25,
          alpha: 0,
          delay: i * 35,
          duration: 800,
          ease: 'Cubic.Out',
          onComplete: () => flame.destroy()
        });
      }
      break;
    }

    case 'rinnegan-ascend': {
      const rKey = ensureRinneganTexture(scene);
      const crest = scene.add
        .image(x, midY - 20, rKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.45)
        .setDepth(VICTORY_BACK_DEPTH + 1);
      scene.tweens.add({
        targets: crest,
        scale: 2.6,
        alpha: 0,
        duration: 1300,
        ease: 'Cubic.Out',
        onComplete: () => crest.destroy()
      });
      spawnGroundRing(scene, x, groundY, 0xa855f7, 0xe9d5ff);
      break;
    }

    case 'super-saiyan': {
      spawnSteamPillars(scene, x, groundY, 0xfacc15, 0x38bdf8);
      spawnLightningBolts(scene, x, midY, 0xfacc15, 0xffffff, 4, registerTimer);
      spawnGroundRing(scene, x, groundY, 0xfacc15, 0xfef9c3);
      break;
    }

    case 'gear2-haki': {
      // Gear 2 pink-white steam puffs + Conqueror's Haki black-crimson pulse
      for (let i = 0; i < 12; i += 1) {
        const puff = scene.add
          .circle(x + Phaser.Math.Between(-50, 50), midY + Phaser.Math.Between(-30, 50), Phaser.Math.Between(12, 24), 0xfca5a5, 0.55)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: puff,
          y: puff.y - Phaser.Math.Between(60, 140),
          scale: 2.0,
          alpha: 0,
          delay: i * 45,
          duration: 620,
          onComplete: () => puff.destroy()
        });
      }
      spawnGroundRing(scene, x, groundY, 0xef4444, 0xfacc15);
      break;
    }

    case 'infinity-void': {
      const purpleKey = ensureHollowPurpleTexture(scene);
      const blueOrb = scene.add
        .circle(x - 64, midY - 40, 15, 0x38bdf8, 0.92)
        .setStrokeStyle(3, 0xe0f2fe, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(VICTORY_FX_DEPTH);
      const redOrb = scene.add
        .circle(x + 64, midY - 40, 15, 0xef4444, 0.92)
        .setStrokeStyle(3, 0xfee2e2, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(VICTORY_FX_DEPTH);
      const halo = scene.add
        .image(x, midY - 26, purpleKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.15)
        .setAlpha(0)
        .setDepth(VICTORY_BACK_DEPTH + 1);

      scene.tweens.add({
        targets: [blueOrb, redOrb],
        x,
        duration: 420,
        ease: 'Cubic.In',
        onComplete: () => {
          blueOrb.destroy();
          redOrb.destroy();
          halo.setAlpha(0.9);
          scene.tweens.add({
            targets: halo,
            scale: 1.5,
            alpha: 0,
            duration: 850,
            ease: 'Cubic.Out',
            onComplete: () => halo.destroy()
          });
        }
      });
      break;
    }

    case 'getsuga-reiatsu': {
      const gKey = ensureGetsugaTexture(scene);
      const crescent = scene.add
        .image(x + facing * 35, midY, gKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setFlipX(facing === -1)
        .setScale(0.5, 0.7)
        .setDepth(VICTORY_FX_DEPTH);
      scene.tweens.add({
        targets: crescent,
        x: x + facing * 190,
        scaleX: 1.4,
        scaleY: 1.2,
        alpha: 0,
        duration: 720,
        ease: 'Cubic.Out',
        onComplete: () => crescent.destroy()
      });
      spawnSteamPillars(scene, x, groundY, 0x38bdf8, 0xef4444);
      break;
    }

    case 'hinokami-sun': {
      // Rotating fiery solar halo + golden embers
      const solarRing = scene.add
        .circle(x, midY - 12, 74, 0xf97316, 0.14)
        .setStrokeStyle(6, 0xfef08a, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(VICTORY_BACK_DEPTH + 1);
      scene.tweens.add({
        targets: solarRing,
        scale: 1.7,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.Out',
        onComplete: () => solarRing.destroy()
      });
      spawnSparkBurst(scene, x, midY, 0xf97316, 0xfef08a, 22);
      break;
    }

    case 'vegeta-pride': {
      spawnSteamPillars(scene, x, groundY, 0xfacc15, 0x60a5fa);
      spawnLightningBolts(scene, x, midY, 0x60a5fa, 0xfef08a, 5, registerTimer);
      break;
    }

    case 'shrine-cleave': {
      for (let i = 0; i < 8; i += 1) {
        registerTimer(
          scene.time.delayedCall(i * 65, () => {
            if (!scene.scene.isActive()) {
              return;
            }
            const slash = scene.add
              .rectangle(
                x + Phaser.Math.Between(-90, 90),
                midY + Phaser.Math.Between(-75, 55),
                Phaser.Math.Between(110, 200),
                5,
                i % 2 === 0 ? 0xef4444 : 0xffffff,
                0.95
              )
              .setRotation(Phaser.Math.FloatBetween(-1.2, 1.2))
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(VICTORY_FX_DEPTH);
            scene.tweens.add({
              targets: slash,
              scaleX: 1.45,
              scaleY: 0.15,
              alpha: 0,
              duration: 240,
              ease: 'Cubic.Out',
              onComplete: () => slash.destroy()
            });
          })
        );
      }
      break;
    }

    case 'godspeed-bolt': {
      spawnLightningBolts(scene, x, midY, 0x22d3ee, 0xe0f2fe, 6, registerTimer);
      spawnGroundRing(scene, x, groundY, 0x22d3ee, 0xe0f2fe);
      break;
    }

    case 'serious-sparkle': {
      // Giant deadpan comic starburst + twinkling glints
      const burst = scene.add
        .star(x, midY - 14, 16, 48, 170, 0xfacc15, 0.42)
        .setStrokeStyle(4, 0xffffff, 0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.2)
        .setDepth(VICTORY_BACK_DEPTH + 1);
      scene.tweens.add({
        targets: burst,
        scale: 1.45,
        angle: 35,
        alpha: 0,
        duration: 1150,
        ease: 'Cubic.Out',
        onComplete: () => burst.destroy()
      });
      for (let i = 0; i < 4; i += 1) {
        const glint = scene.add
          .star(x + Phaser.Math.Between(-50, 50), groundY - bodyH * Phaser.Math.FloatBetween(0.35, 0.85), 4, 4, 14, 0xffffff, 0.95)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: glint,
          scale: 1.7,
          angle: 90,
          alpha: 0,
          delay: 180 + i * 160,
          duration: 420,
          onComplete: () => glint.destroy()
        });
      }
      break;
    }

    case 'tengai-meteor': {
      const mKey = ensureSharinganTexture(scene, true);
      const rKey = ensureRinneganTexture(scene);
      const rCrest = scene.add
        .image(x, midY - 25, rKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.4)
        .setDepth(VICTORY_BACK_DEPTH + 1);
      const mCrest = scene.add
        .image(x, groundY - bodyH * 0.92, mKey)
        .setScale(0.2)
        .setDepth(VICTORY_FX_DEPTH);
      scene.tweens.add({
        targets: rCrest,
        scale: 2.5,
        alpha: 0,
        duration: 1300,
        ease: 'Cubic.Out',
        onComplete: () => rCrest.destroy()
      });
      scene.tweens.add({
        targets: mCrest,
        scale: 1.1,
        angle: 270,
        alpha: 0,
        duration: 1150,
        ease: 'Cubic.Out',
        onComplete: () => mCrest.destroy()
      });
      break;
    }

    case 'full-cowling': {
      spawnLightningBolts(scene, x, midY, 0x22c55e, 0x86efac, 5, registerTimer);
      spawnGroundRing(scene, x, groundY, 0x22c55e, 0xffffff);
      break;
    }

    case 'nitro-ignition': {
      for (let i = 0; i < 4; i += 1) {
        registerTimer(
          scene.time.delayedCall(i * 150, () => {
            if (!scene.scene.isActive()) {
              return;
            }
            const ex = x + Phaser.Math.Between(-55, 55);
            const ey = midY + Phaser.Math.Between(-45, 25);
            const boom = scene.add
              .circle(ex, ey, 22, 0xf97316, 0.72)
              .setStrokeStyle(5, 0xfacc15, 0.96)
              .setBlendMode(Phaser.BlendModes.ADD)
              .setDepth(VICTORY_FX_DEPTH);
            scene.tweens.add({
              targets: boom,
              scale: 2.8,
              alpha: 0,
              duration: 320,
              ease: 'Cubic.Out',
              onComplete: () => boom.destroy()
            });
          })
        );
      }
      break;
    }

    case 'ice-fire-split': {
      // Left side: cyan ice crystals; Right side: roaring crimson flames
      for (let i = 0; i < 8; i += 1) {
        const shard = scene.add
          .polygon(x - 45 - i * 14, groundY - 8, [0, 0, -10, -52 - (i % 3) * 18, 10, 0], 0x38bdf8, 0.85)
          .setStrokeStyle(2, 0xe0f2fe, 0.95)
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: shard,
          scaleY: 1.35,
          alpha: 0,
          delay: i * 40,
          duration: 950,
          ease: 'Cubic.Out',
          onComplete: () => shard.destroy()
        });

        const flame = scene.add
          .circle(x + 45 + i * 14, groundY - 14, 16, i % 2 === 0 ? 0xef4444 : 0xf97316, 0.85)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(VICTORY_FX_DEPTH);
        scene.tweens.add({
          targets: flame,
          y: flame.y - Phaser.Math.Between(95, 190),
          scale: 0.25,
          alpha: 0,
          delay: i * 40,
          duration: 850,
          ease: 'Cubic.Out',
          onComplete: () => flame.destroy()
        });
      }
      break;
    }

    case 'united-smash': {
      spawnSteamPillars(scene, x, groundY, 0xfacc15, 0xef4444);
      spawnGroundRing(scene, x, groundY, 0xfacc15, 0xef4444);
      const star = scene.add
        .star(x, midY - 30, 5, 22, 54, 0xfacc15, 0.85)
        .setStrokeStyle(3, 0xffffff, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(VICTORY_BACK_DEPTH + 1);
      scene.tweens.add({
        targets: star,
        scale: 2.3,
        angle: 72,
        alpha: 0,
        duration: 1100,
        ease: 'Cubic.Out',
        onComplete: () => star.destroy()
      });
      break;
    }

    default: {
      spawnGroundRing(scene, x, groundY, primary, accent);
      spawnSparkBurst(scene, x, midY, primary, accent, 16);
      break;
    }
  }
}

function spawnGroundRing(scene: Phaser.Scene, x: number, groundY: number, colorA: number, colorB: number): void {
  const ring = scene.add
    .ellipse(x, groundY - 6, 86, 26, colorA, 0.25)
    .setStrokeStyle(4, colorB, 0.95)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(VICTORY_FX_DEPTH - 1);
  scene.tweens.add({
    targets: ring,
    scaleX: 3.1,
    scaleY: 2.2,
    alpha: 0,
    duration: 580,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy()
  });
}

function spawnSparkBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  colorA: number,
  colorB: number,
  count: number
): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const dist = Phaser.Math.Between(90, 200);
    const spark = scene.add
      .circle(x, y, Phaser.Math.Between(3, 6), i % 2 === 0 ? colorA : colorB, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(VICTORY_FX_DEPTH);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.75,
      scale: 0.2,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.Out',
      onComplete: () => spark.destroy()
    });
  }
}

function spawnLightningBolts(
  scene: Phaser.Scene,
  x: number,
  midY: number,
  boltColor: number,
  coreColor: number,
  waves: number,
  registerTimer: (timer: Phaser.Time.TimerEvent) => void
): void {
  for (let w = 0; w < waves; w += 1) {
    registerTimer(
      scene.time.delayedCall(w * 150, () => {
        if (!scene.scene.isActive()) {
          return;
        }
        const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(VICTORY_FX_DEPTH);
        for (let b = 0; b < 3; b += 1) {
          g.lineStyle(b === 0 ? 4 : 2, b === 0 ? boltColor : coreColor, 0.95);
          let px = x + Phaser.Math.Between(-55, 55);
          let py = midY + Phaser.Math.Between(-65, 50);
          g.beginPath();
          g.moveTo(px, py);
          for (let seg = 0; seg < 4; seg += 1) {
            px += Phaser.Math.Between(-36, 36);
            py += Phaser.Math.Between(-42, 26);
            g.lineTo(px, py);
          }
          g.strokePath();
        }
        scene.tweens.add({
          targets: g,
          alpha: 0,
          duration: 210,
          onComplete: () => g.destroy()
        });
      })
    );
  }
}
