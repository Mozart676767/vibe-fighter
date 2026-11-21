import * as Phaser from 'phaser';

import { findCharacterAnimationKeyByAction, getCharacterDefinition } from './hero';
import { MY_FIGHTER_IDS } from './myFighterLoader';

export interface MenuBackdropOptions {
  stageKey?: string;
  showFighters?: boolean;
  scrimAlpha?: number;
  fighterRotateMs?: number;
}

const FEATURED_MATCHUPS: ReadonlyArray<readonly [string, string]> = [
  ['naruto', 'sasuke'],
  ['goku', 'vegeta'],
  ['gojo', 'sukuna'],
  ['deku', 'bakugo'],
  ['luffy', 'ichigo'],
  ['kakashi', 'itachi'],
  ['tanjiro', 'killua'],
  ['saitama', 'all-might'],
  ['minato', 'madara'],
  ['gaara', 'rock-lee'],
  ['jiraiya', 'pain'],
  ['todoroki', 'sakura']
];

const FALLBACK_STAGE_KEYS = [
  'shibuya-night-stage',
  'crimson-eclipse-stage',
  'final-valley-stage',
  'rooftop-twilight-stage'
];

const DEFAULT_FIGHTER_ROTATE_MS = 4500;

/**
 * Renders an atmospheric arcade fighting stage backdrop with subtle camera
 * breathing, dark center scrim for UI legibility, floating embers, and a
 * periodic left-vs-right animated fighter showcase.
 */
export function createMenuBackdrop(
  scene: Phaser.Scene,
  options: MenuBackdropOptions = {}
): () => void {
  const { width, height, centerX, centerY } = scene.cameras.main;
  const isCompact = width < 900;
  const scrimAlpha = options.scrimAlpha ?? 0.52;
  const rotateMs = options.fighterRotateMs ?? DEFAULT_FIGHTER_ROTATE_MS;

  const createdObjects: Phaser.GameObjects.GameObject[] = [];
  const activeTweens: Phaser.Tweens.Tween[] = [];
  let rotateTimer: Phaser.Time.TimerEvent | undefined;
  let swapTweens: Phaser.Tweens.Tween[] = [];
  let destroyed = false;

  scene.cameras.main.setBackgroundColor(0x020617);

  // 1. Stage Key-Art Image (cover-fit)
  const stageKey = resolveStageTextureKey(scene, options.stageKey);
  if (stageKey) {
    const bg = scene.add.image(centerX, centerY, stageKey).setDepth(0);
    const baseScale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(baseScale);
    createdObjects.push(bg);

    activeTweens.push(
      scene.tweens.add({
        targets: bg,
        scaleX: baseScale * 1.045,
        scaleY: baseScale * 1.045,
        duration: 14000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    );
  }

  // 2. Atmospheric Vignette & Readability Scrim (soft layered, no hard boxes)
  const baseScrim = scene.add
    .rectangle(centerX, centerY, width, height, 0x020617, scrimAlpha)
    .setDepth(1);
  createdObjects.push(baseScrim);

  // Soft multi-layer side aura glows (Cyan left, Crimson right)
  const auraBaseRadius = isCompact ? 130 : 210;
  const leftAuraX = width * 0.19;
  const rightAuraX = width * 0.81;
  const auraY = height * 0.68;

  [1.35, 1.0, 0.65].forEach((mult, idx) => {
    const alpha = 0.035 + idx * 0.015;
    createdObjects.push(
      scene.add.circle(leftAuraX, auraY, auraBaseRadius * mult, 0x38bdf8, alpha).setDepth(1),
      scene.add.circle(rightAuraX, auraY, auraBaseRadius * mult, 0xf43f5e, alpha).setDepth(1)
    );
  });

  // 3. Featured Animated Fighter Face-Off (rotates periodically)
  if (options.showFighters !== false) {
    const availableMatchups = getAvailableMatchups(scene);
    if (availableMatchups.length > 0) {
      let currentIndex = Phaser.Math.Between(0, availableMatchups.length - 1);
      const [initialLeft, initialRight] = availableMatchups[currentIndex];

      const fighterY = isCompact ? height * 0.84 : height * 0.87;
      const fighterScale = isCompact ? 1.15 : 1.55;
      const offsetX = isCompact ? width * 0.31 : Math.min(410, width * 0.32);
      const leftX = centerX - offsetX;
      const rightX = centerX + offsetX;

      const leftSlot = spawnShowcaseFighter(
        scene,
        initialLeft,
        leftX,
        fighterY,
        fighterScale,
        true
      );
      const rightSlot = spawnShowcaseFighter(
        scene,
        initialRight,
        rightX,
        fighterY,
        fighterScale,
        false
      );

      if (leftSlot && rightSlot) {
        createdObjects.push(leftSlot.shadow, leftSlot.sprite, rightSlot.shadow, rightSlot.sprite);

        if (availableMatchups.length > 1) {
          rotateTimer = scene.time.addEvent({
            delay: rotateMs,
            loop: true,
            callback: () => {
              if (destroyed) {
                return;
              }

              currentIndex = (currentIndex + 1) % availableMatchups.length;
              const [nextLeft, nextRight] = availableMatchups[currentIndex];

              swapTweens.forEach((t) => t.stop());
              swapTweens = [
                animateFighterSwap(scene, leftSlot, nextLeft, leftX, true, -36, () => destroyed),
                animateFighterSwap(scene, rightSlot, nextRight, rightX, false, 36, () => destroyed)
              ];
            }
          });
        }
      }
    }
  }

  // 4. Drifting Energy Embers
  const emberCount = 18;
  for (let i = 0; i < emberCount; i += 1) {
    const startX = Phaser.Math.Between(30, Math.max(40, width - 30));
    const startY = Phaser.Math.Between(Math.round(height * 0.45), height + 20);
    const radius = Phaser.Math.FloatBetween(1.5, 3.2);
    const color = i % 3 === 0 ? 0xfacc15 : i % 2 === 0 ? 0x38bdf8 : 0xf43f5e;
    const ember = scene.add
      .circle(startX, startY, radius, color, Phaser.Math.FloatBetween(0.25, 0.65))
      .setDepth(3);
    createdObjects.push(ember);

    const driftX = Phaser.Math.Between(-45, 45);
    const targetY = Phaser.Math.Between(40, Math.round(height * 0.35));
    activeTweens.push(
      scene.tweens.add({
        targets: ember,
        x: startX + driftX,
        y: targetY,
        alpha: 0,
        duration: Phaser.Math.Between(4200, 7800),
        delay: Phaser.Math.Between(0, 2400),
        repeat: -1,
        onRepeat: () => {
          ember.setPosition(
            Phaser.Math.Between(30, Math.max(40, width - 30)),
            height + Phaser.Math.Between(10, 40)
          );
          ember.setAlpha(Phaser.Math.FloatBetween(0.25, 0.65));
        }
      })
    );
  }

  return () => {
    destroyed = true;
    rotateTimer?.remove(false);
    swapTweens.forEach((tween) => tween.stop());
    swapTweens = [];
    activeTweens.forEach((tween) => tween.stop());
    createdObjects.forEach((obj) => {
      if (obj.scene) {
        obj.destroy();
      }
    });
  };
}

interface FighterSlot {
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Sprite;
}

function resolveStageTextureKey(scene: Phaser.Scene, preferred?: string): string | null {
  const candidates = preferred ? [preferred, ...FALLBACK_STAGE_KEYS] : FALLBACK_STAGE_KEYS;
  return candidates.find((key) => scene.textures.exists(key)) ?? null;
}

function getAvailableMatchups(scene: Phaser.Scene): Array<readonly [string, string]> {
  const isAvailable = (id: string): boolean => {
    const key = findCharacterAnimationKeyByAction(id, 'idle');
    return Boolean(key && scene.anims.exists(key));
  };

  const featured = FEATURED_MATCHUPS.filter(([leftId, rightId]) => isAvailable(leftId) && isAvailable(rightId));
  if (featured.length > 0) {
    return Phaser.Utils.Array.Shuffle([...featured]);
  }

  const ids = MY_FIGHTER_IDS.filter(isAvailable);
  if (ids.length < 2) {
    return [];
  }

  const pairs: Array<readonly [string, string]> = [];
  for (let i = 0; i + 1 < ids.length; i += 2) {
    pairs.push([ids[i], ids[i + 1]]);
  }
  return pairs;
}

function spawnShowcaseFighter(
  scene: Phaser.Scene,
  characterId: string,
  x: number,
  y: number,
  scale: number,
  faceRight: boolean
): FighterSlot | null {
  const idleKey = findCharacterAnimationKeyByAction(characterId, 'idle');
  if (!idleKey || !scene.anims.exists(idleKey)) {
    return null;
  }

  const character = getCharacterDefinition(characterId);
  const shadow = scene.add
    .ellipse(x, y - 16 * scale, Math.round(112 * scale), Math.round(24 * scale), 0x000000, 0.45)
    .setDepth(2);

  const sprite = scene.add
    .sprite(x, y, idleKey, 0)
    .setOrigin(0.5, character.anchor.y)
    .setScale(scale)
    .setFlipX(faceRight)
    .setAlpha(0.95)
    .setDepth(3);

  sprite.play(idleKey);

  return { shadow, sprite };
}

function animateFighterSwap(
  scene: Phaser.Scene,
  slot: FighterSlot,
  nextCharacterId: string,
  restX: number,
  faceRight: boolean,
  slideOffset: number,
  isDestroyed: () => boolean
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: [slot.sprite, slot.shadow],
    x: restX + slideOffset,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      if (isDestroyed() || !slot.sprite.scene) {
        return;
      }

      const idleKey = findCharacterAnimationKeyByAction(nextCharacterId, 'idle');
      if (idleKey && scene.anims.exists(idleKey)) {
        const character = getCharacterDefinition(nextCharacterId);
        slot.sprite
          .setOrigin(0.5, character.anchor.y)
          .setFlipX(faceRight)
          .play(idleKey);
      }

      slot.sprite.setX(restX + slideOffset);
      slot.shadow.setX(restX + slideOffset);

      scene.tweens.add({
        targets: slot.sprite,
        x: restX,
        alpha: 0.95,
        duration: 360,
        ease: 'Cubic.easeOut'
      });

      scene.tweens.add({
        targets: slot.shadow,
        x: restX,
        alpha: 0.45,
        duration: 360,
        ease: 'Cubic.easeOut'
      });
    }
  });
}
