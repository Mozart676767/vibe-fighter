import type * as Phaser from 'phaser';

import type { CharacterDefinition, HeroBoundsFrame } from './hero';
import {
  buildFighterCharacter,
  collisionBounds,
  hitBounds,
  rect,
  type FighterActionSpec
} from './fighterCharacter';
import { MY_FIGHTERS, type MyFighter } from './myFighters';
import {
  RAW_CELL,
  frameToCanvas,
  loadFirstImage,
  placeholderRawSheet,
  reverseRawSheet,
  sliceRawSheet,
  type RawSheet
} from './rawSheet';
import type { Rect } from './types';

declare const __FIGHTER_SHEET_FILES__: Record<string, Record<string, string>> | undefined;

/**
 * Fighters listed in `myFighters.ts` are built from raw AI-drawn pose sheets
 * at boot (see `rawSheet.ts`) instead of hand-made 256px spritesheets. A
 * missing picture falls back to the next one in its `sources` list, so a
 * fighter works with `idle` alone and improves as pictures are added.
 */

const SHEET_NAMES = ['idle', 'walk', 'punch', 'kick', 'hit', 'ko', 'jump', 'crouch', 'block', 'special'] as const;
const BOOT_CONCURRENCY = 6;
const BACKGROUND_CONCURRENCY = 2;

type SheetName = (typeof SHEET_NAMES)[number];

interface ActionPlan {
  action: string;
  label: string;
  /** Picture names to try, best first. */
  sources: SheetName[];
  frameRate: number;
  repeat: number;
  reverse?: boolean;
  /** Vertical slice of the frame the attack covers (the reach is measured). */
  attack?: { y: number; height: number };
  guard?: Rect;
}

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const STANDING = rect(76, 28, 104, 204);
const CROUCHING = rect(72, 104, 112, 126);
const PUNCH_ZONE = { y: 84, height: 46 };
const KICK_ZONE = { y: 48, height: 80 };
const SPECIAL_ZONE = { y: 36, height: 100 };

const ACTION_PLANS: ActionPlan[] = [
  { action: 'idle', label: 'Idle', sources: ['idle'], frameRate: 6, repeat: -1 },
  { action: 'walk-forward', label: 'Walk Forward', sources: ['walk', 'idle'], frameRate: 8, repeat: -1 },
  {
    action: 'walk-backward',
    label: 'Walk Backward',
    sources: ['walk', 'idle'],
    frameRate: 8,
    repeat: -1,
    reverse: true
  },
  { action: 'crouch', label: 'Crouch', sources: ['crouch', 'idle'], frameRate: 10, repeat: 0 },
  { action: 'jump', label: 'Jump', sources: ['jump', 'idle'], frameRate: 8, repeat: 0 },
  {
    action: 'block-high',
    label: 'Block High',
    sources: ['block', 'idle'],
    frameRate: 10,
    repeat: 0,
    guard: rect(60, 44, 136, 116)
  },
  {
    action: 'block-low',
    label: 'Block Low',
    sources: ['block', 'crouch', 'idle'],
    frameRate: 10,
    repeat: 0,
    guard: rect(60, 110, 136, 120)
  },
  { action: 'hit-high', label: 'Hit', sources: ['hit', 'idle'], frameRate: 10, repeat: 0 },
  {
    action: 'light-punch',
    label: 'Punch',
    sources: ['punch', 'idle'],
    frameRate: 12,
    repeat: 0,
    attack: PUNCH_ZONE
  },
  {
    action: 'heavy-kick',
    label: 'Kick',
    sources: ['kick', 'punch', 'idle'],
    frameRate: 10,
    repeat: 0,
    attack: KICK_ZONE
  },
  { action: 'special-charge', label: 'Special Charge', sources: ['crouch', 'idle'], frameRate: 10, repeat: 0 },
  {
    action: 'special',
    label: 'Special',
    sources: ['special', 'kick', 'punch', 'idle'],
    frameRate: 10,
    repeat: 0,
    attack: SPECIAL_ZONE
  },
  { action: 'knockdown', label: 'Knockdown', sources: ['ko', 'hit', 'idle'], frameRate: 8, repeat: 0 }
];

const PLACEHOLDER_FRAMES = 1;

interface PreparedFighterState {
  character: CharacterDefinition;
  fighter: MyFighter;
  sheets: Map<SheetName, RawSheet | null>;
  combatPromise?: Promise<void>;
  combatDone: boolean;
}

const fighterStates = new Map<string, PreparedFighterState>();
let backgroundPrepStarted = false;

function toSpec(plan: ActionPlan): FighterActionSpec {
  return {
    action: plan.action,
    label: plan.label,
    file: `${plan.sources[0]}.png`,
    frames: PLACEHOLDER_FRAMES,
    frameRate: plan.frameRate,
    repeat: plan.repeat,
    defaultVisual: STANDING,
    guard: plan.guard
  };
}

function buildMyFighter(fighter: MyFighter): CharacterDefinition {
  const character = buildFighterCharacter({
    id: fighter.id,
    label: fighter.name,
    assetRoot: `/assets/${fighter.id}`,
    anchorUsage: `${fighter.name} (built from raw pose sheets)`,
    portraitFile: 'portrait.png',
    actions: ACTION_PLANS.map(toSpec)
  });

  // Textures for these assets are made in `prepareMyFighters`, not by the loader.
  character.assets.forEach((asset) => {
    asset.auto = true;
  });

  return character;
}

export const MY_FIGHTER_CHARACTERS: CharacterDefinition[] = MY_FIGHTERS.filter(
  (fighter) => /^[a-z0-9][a-z0-9-]*$/.test(fighter.id)
).map(buildMyFighter);

export const MY_FIGHTER_IDS: string[] = MY_FIGHTER_CHARACTERS.map((character) => character.id);

function candidateUrls(fighterId: string, name: string): string[] {
  const root = `/assets/${fighterId}`;
  const manifest =
    typeof __FIGHTER_SHEET_FILES__ === 'object' && __FIGHTER_SHEET_FILES__ !== null
      ? __FIGHTER_SHEET_FILES__
      : undefined;

  if (manifest) {
    const file = manifest[fighterId]?.[name];
    return file ? [`${root}/${file}`] : [];
  }

  return EXTENSIONS.map((extension) => `${root}/${name}.${extension}`);
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });

  await Promise.all(runners);
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function loadSheetForFighter(
  fighter: MyFighter,
  sheets: Map<SheetName, RawSheet | null>,
  name: SheetName
): Promise<RawSheet | null> {
  if (!sheets.has(name)) {
    const image = await loadFirstImage(candidateUrls(fighter.id, name));
    const sheet = image ? sliceRawSheet(image, { flip: fighter.flip, frames: fighter.frames?.[name] }) : null;
    sheets.set(name, sheet);
  }

  return sheets.get(name) ?? null;
}

function isGameAlive(game: Phaser.Game | null | undefined): game is Phaser.Game {
  return Boolean(game && game.isRunning && game.textures && game.anims);
}

function applyPlanSheet(
  scene: Phaser.Scene,
  character: CharacterDefinition,
  plan: ActionPlan,
  sheet: RawSheet,
  used: SheetName | null,
  refreshAnim: boolean
): void {
  const game = scene.sys?.game;
  if (!isGameAlive(game)) {
    return;
  }

  const animation = character.animations.find((candidate) => candidate.action === plan.action);
  if (!animation) {
    return;
  }

  const resolvedSheet = plan.reverse ? reverseRawSheet(sheet) : sheet;
  animation.sheet.frames = resolvedSheet.frames;
  animation.bounds = buildBounds(resolvedSheet, plan, used);
  addSheetTexture(game.textures, animation.sheet.key, resolvedSheet);

  if (refreshAnim && game.anims.exists(animation.key)) {
    game.anims.remove(animation.key);
    game.anims.create({
      key: animation.key,
      frames: game.anims.generateFrameNumbers(animation.sheet.key, {
        start: 0,
        end: animation.sheet.frames - 1
      }),
      frameRate: animation.frameRate,
      repeat: animation.repeat
    });
  }
}

/**
 * Phase 1 (Boot): Load idle poses and portraits for every fighter in parallel
 * so Splash, MainMenu, and CharacterSelect open rapidly without 404 spam.
 * @param scene - The boot scene (owner of the texture manager).
 * @param onProgress - Optional progress callback `(completed, total)`.
 */
export async function prepareMyFighters(
  scene: Phaser.Scene,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  MY_FIGHTERS.filter((fighter) => !MY_FIGHTER_IDS.includes(fighter.id)).forEach((fighter) => {
    console.warn(`[my-fighter] "${fighter.id}" skipped: id must be lowercase english letters, numbers or "-"`);
  });

  fighterStates.clear();
  backgroundPrepStarted = false;

  const total = MY_FIGHTER_CHARACTERS.length;
  let completed = 0;

  onProgress?.(0, total);

  await runWithConcurrency(MY_FIGHTER_CHARACTERS, BOOT_CONCURRENCY, async (character) => {
    const fighter = MY_FIGHTERS.find((candidate) => candidate.id === character.id);
    if (!fighter) {
      completed += 1;
      onProgress?.(completed, total);
      return;
    }

    await prepareFighterBoot(scene, character, fighter);
    completed += 1;
    onProgress?.(completed, total);
  });
}

async function prepareFighterBoot(
  scene: Phaser.Scene,
  character: CharacterDefinition,
  fighter: MyFighter
): Promise<void> {
  const game = scene.sys?.game;
  if (!isGameAlive(game)) {
    return;
  }

  const sheets = new Map<SheetName, RawSheet | null>();
  const [idleSheet, portrait] = await Promise.all([
    loadSheetForFighter(fighter, sheets, 'idle'),
    loadFirstImage(candidateUrls(fighter.id, 'portrait'))
  ]);

  if (!isGameAlive(game)) {
    return;
  }

  const fallbackSheet = idleSheet ?? placeholderRawSheet();
  const usedIdle: SheetName | null = idleSheet ? 'idle' : null;

  // Populate all actions initially using idle/placeholder so every texture key exists immediately.
  for (const plan of ACTION_PLANS) {
    applyPlanSheet(scene, character, plan, fallbackSheet, usedIdle, false);
  }

  replaceTexture(game.textures, character.portrait.key);

  if (portrait) {
    game.textures.addImage(character.portrait.key, portrait);
  } else {
    game.textures.addCanvas(character.portrait.key, cropToPose(fallbackSheet));
  }

  if (character.anchorAsset.key !== character.portrait.key) {
    replaceTexture(game.textures, character.anchorAsset.key);
    game.textures.addCanvas(character.anchorAsset.key, frameToCanvas(fallbackSheet));
  }

  if (!idleSheet) {
    console.warn(`[my-fighter] ${fighter.id}: /assets/${fighter.id}/idle not found or has no pose in it`);
  }

  fighterStates.set(fighter.id, {
    character,
    fighter,
    sheets,
    combatDone: false
  });
}

async function prepareFighterCombat(scene: Phaser.Scene, state: PreparedFighterState): Promise<void> {
  if (state.combatDone) {
    return;
  }

  if (state.combatPromise) {
    return state.combatPromise;
  }

  state.combatPromise = (async () => {
    const { character, fighter, sheets } = state;

    for (const plan of ACTION_PLANS) {
      if (plan.action === 'idle') {
        continue;
      }

      let used: SheetName | null = null;
      let sheet: RawSheet | null = null;

      for (const name of plan.sources) {
        sheet = await loadSheetForFighter(fighter, sheets, name);
        if (sheet) {
          used = name;
          break;
        }
      }

      if (!sheet) {
        sheet = placeholderRawSheet();
      }

      applyPlanSheet(scene, character, plan, sheet, used, true);
      await yieldFrame();
    }

    const report = SHEET_NAMES.map((name) => `${name} ${sheets.get(name)?.frames ?? '-'}`);
    console.info(`[my-fighter] ${fighter.id}: ${report.join(', ')}   (number = poses found, "-" = no picture)`);

    state.combatDone = true;
  })();

  return state.combatPromise;
}

/**
 * Starts loading all fighters' remaining combat sheets in the background after
 * boot completes, keeping menu responsiveness smooth.
 * @param scene - Any active Phaser scene.
 */
export function startBackgroundFighterPrep(scene: Phaser.Scene): void {
  if (backgroundPrepStarted) {
    return;
  }

  backgroundPrepStarted = true;
  const states = Array.from(fighterStates.values());

  void runWithConcurrency(states, BACKGROUND_CONCURRENCY, async (state) => {
    const game = scene.sys?.game;
    if (!isGameAlive(game)) {
      return;
    }

    await prepareFighterCombat(scene, state);
  });
}

/**
 * Ensures the specified fighter IDs have all combat sheets sliced and
 * animations updated before starting a match.
 * @param scene - The calling Phaser scene.
 * @param fighterIds - Character IDs to prepare.
 */
export async function ensureFightersReady(scene: Phaser.Scene, fighterIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(fighterIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map(async (id) => {
      const state = fighterStates.get(id);
      if (state) {
        await prepareFighterCombat(scene, state);
      }
    })
  );
}

function buildBounds(sheet: RawSheet, plan: ActionPlan, used: SheetName | null): HeroBoundsFrame[] {
  const body = used === 'crouch' ? CROUCHING : STANDING;
  const active = plan.attack ? attackFrames(sheet) : [];

  return sheet.boxes.map((box, frame) => ({
    frame,
    visual: { ...box },
    collision: collisionBounds(body, RAW_CELL, RAW_CELL),
    hit: hitBounds(box, RAW_CELL, RAW_CELL),
    attack:
      plan.attack && active.includes(frame)
        ? rect(box.x, plan.attack.y, Math.max(48, RAW_CELL / 2 - 10 - box.x), plan.attack.height)
        : null,
    guard: plan.guard ? { ...plan.guard } : null
  }));
}

/**
 * The frames where the attack can land: those where the pose reaches furthest
 * forward (fighters face left, so "forward" is the left edge of the pose).
 */
function attackFrames(sheet: RawSheet): number[] {
  const reaches = sheet.boxes.map((box) => RAW_CELL / 2 - box.x);
  const furthest = Math.max(...reaches);

  if (furthest - Math.min(...reaches) < 15) {
    return [Math.floor(sheet.frames / 2)];
  }

  return reaches.flatMap((reach, frame) => (reach >= furthest - 12 ? [frame] : []));
}

function addSheetTexture(textures: Phaser.Textures.TextureManager, key: string, sheet: RawSheet): void {
  replaceTexture(textures, key);
  // Phaser accepts a canvas here at runtime; the typings only list images.
  textures.addSpriteSheet(key, sheet.canvas as unknown as HTMLImageElement, {
    frameWidth: RAW_CELL,
    frameHeight: RAW_CELL,
    startFrame: 0,
    endFrame: sheet.frames - 1
  });
}

function replaceTexture(textures: Phaser.Textures.TextureManager, key: string): void {
  if (textures.exists(key)) {
    textures.remove(key);
  }
}

/** First idle pose, cropped square around the body, for the select card. */
function cropToPose(sheet: RawSheet): HTMLCanvasElement {
  const box = sheet.boxes[0];
  const size = Math.max(box.width, box.height) + 16;
  const canvas = document.createElement('canvas');

  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    ?.drawImage(
      frameToCanvas(sheet),
      box.x,
      box.y,
      box.width,
      box.height,
      Math.round((size - box.width) / 2),
      Math.round((size - box.height) / 2),
      box.width,
      box.height
    );

  return canvas;
}
