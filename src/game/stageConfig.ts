import finalValleyUrl from '../assets/images/stage_final_valley_1794715906288.jpg';
import martialArenaUrl from '../assets/images/stage_martial_arena_1794715906951.jpg';
import sakuraShrineUrl from '../assets/images/stage_sakura_shrine_1794715907293.jpg';
import shibuyaNightUrl from '../assets/images/stage_shibuya_night_1794715906880.jpg';
import planetNamekUrl from '../assets/images/stage_planet_namek_1795229430220.jpg';
import crimsonEclipseUrl from '../assets/images/stage_crimson_eclipse_1795229430326.jpg';
import frostCitadelUrl from '../assets/images/stage_frost_citadel_1795229430419.jpg';
import type { ImageAsset } from './assets';
import type { StagePreviewDebugState } from './types';

/**
 * A full-frame fighting-stage background candidate. Stages are single images
 * (not parallax layers) used by the Stage Preview gym to evaluate framing.
 */
export interface StageDefinition {
  id: string;
  label: string;
  key: string;
  url: string;
  width: number;
  height: number;
}

/**
 * The computed placement of a stage when fit to a viewport: vertical-fit scale,
 * resulting on-screen size, and how far it can scroll horizontally.
 */
export interface StageLayout {
  scale: number;
  displayWidth: number;
  displayHeight: number;
  maxScroll: number;
}

export const STAGE_PREVIEW_DEFAULT_PAN_SPEED = 140;
export const STAGE_PREVIEW_MIN_PAN_SPEED = 20;
export const STAGE_PREVIEW_MAX_PAN_SPEED = 600;

const STAGE_ASSET_ROOT = '/assets/backgrounds';

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'rooftop-twilight',
    label: 'Rooftop Twilight',
    key: 'rooftop-twilight-stage',
    url: `${STAGE_ASSET_ROOT}/rooftop-twilight-stage.png`,
    width: 1774,
    height: 887
  },
  {
    id: 'rooftop-sunset',
    label: 'Rooftop Sunset',
    key: 'rooftop-sunset-stage',
    url: `${STAGE_ASSET_ROOT}/rooftop-sunset-stage.png`,
    width: 2048,
    height: 768
  },
  {
    id: 'final-valley',
    label: 'Final Valley',
    key: 'final-valley-stage',
    url: finalValleyUrl,
    width: 1376,
    height: 768
  },
  {
    id: 'martial-arena',
    label: 'Martial Arena',
    key: 'martial-arena-stage',
    url: martialArenaUrl,
    width: 1376,
    height: 768
  },
  {
    id: 'shibuya-night',
    label: 'Shibuya Night',
    key: 'shibuya-night-stage',
    url: shibuyaNightUrl,
    width: 1376,
    height: 768
  },
  {
    id: 'sakura-shrine',
    label: 'Sakura Shrine',
    key: 'sakura-shrine-stage',
    url: sakuraShrineUrl,
    width: 1376,
    height: 768
  },
  {
    id: 'planet-namek',
    label: 'Planet Namek',
    key: 'planet-namek-stage',
    url: planetNamekUrl,
    width: 1376,
    height: 768
  },
  {
    id: 'crimson-eclipse',
    label: 'Crimson Eclipse',
    key: 'crimson-eclipse-stage',
    url: crimsonEclipseUrl,
    width: 1376,
    height: 768
  },
  {
    id: 'frost-citadel',
    label: 'Frost Citadel',
    key: 'frost-citadel-stage',
    url: frostCitadelUrl,
    width: 1376,
    height: 768
  }
];

export const STAGE_IMAGE_ASSETS: ImageAsset[] = [
  {
    kind: 'image',
    key: 'final-valley-stage',
    url: finalValleyUrl,
    width: 1376,
    height: 768,
    usage: 'Final Valley canyon waterfall stage background'
  },
  {
    kind: 'image',
    key: 'martial-arena-stage',
    url: martialArenaUrl,
    width: 1376,
    height: 768,
    usage: 'Martial Arena tournament stage background'
  },
  {
    kind: 'image',
    key: 'shibuya-night-stage',
    url: shibuyaNightUrl,
    width: 1376,
    height: 768,
    usage: 'Shibuya Night neon street crossing stage background'
  },
  {
    kind: 'image',
    key: 'sakura-shrine-stage',
    url: sakuraShrineUrl,
    width: 1376,
    height: 768,
    usage: 'Sakura Shrine sunset courtyard stage background'
  },
  {
    kind: 'image',
    key: 'planet-namek-stage',
    url: planetNamekUrl,
    width: 1376,
    height: 768,
    usage: 'Planet Namek green sky alien battlefield stage background'
  },
  {
    kind: 'image',
    key: 'crimson-eclipse-stage',
    url: crimsonEclipseUrl,
    width: 1376,
    height: 768,
    usage: 'Crimson Eclipse cursed blood-moon shrine stage background'
  },
  {
    kind: 'image',
    key: 'frost-citadel-stage',
    url: frostCitadelUrl,
    width: 1376,
    height: 768,
    usage: 'Frost Citadel snowy mountain aurora dojo stage background'
  }
];

export const DEFAULT_STAGE_PREVIEW_STATE: StagePreviewDebugState = {
  stageId: STAGE_DEFINITIONS[0].id,
  scrollX: 0,
  maxScroll: 0,
  displayWidth: 0,
  autoPan: false,
  panSpeed: STAGE_PREVIEW_DEFAULT_PAN_SPEED,
  showGuides: true
};

/**
 * Resolves a stage definition by id, falling back to the first stage when the
 * id is unknown.
 * @param stageId - The stage identifier to resolve.
 * @returns The matching {@link StageDefinition} or the first stage.
 */
export function getStageDefinition(stageId: string): StageDefinition {
  return STAGE_DEFINITIONS.find((stage) => stage.id === stageId) ?? STAGE_DEFINITIONS[0];
}

/**
 * Computes how a stage is placed when fit to the viewport height and centered,
 * including the horizontal scroll range produced by the overflow.
 * @param stageId - The stage to lay out.
 * @param viewportWidth - The game viewport width in pixels.
 * @param viewportHeight - The game viewport height in pixels.
 * @returns The {@link StageLayout} for the stage at this viewport size.
 */
export function getStageLayout(
  stageId: string,
  viewportWidth: number,
  viewportHeight: number
): StageLayout {
  const stage = getStageDefinition(stageId);
  const scale = viewportHeight / stage.height;
  const displayWidth = stage.width * scale;

  return {
    scale,
    displayWidth,
    displayHeight: viewportHeight,
    maxScroll: Math.max(0, displayWidth - viewportWidth)
  };
}

/**
 * Clamps a horizontal scroll value to the valid range for a layout.
 * @param value - The desired scroll position in pixels.
 * @param maxScroll - The maximum scroll for the current stage layout.
 * @returns The clamped scroll position.
 */
export function clampStageScroll(value: number, maxScroll: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(0, maxScroll), Math.max(0, value));
}

/**
 * Clamps a pan speed to the supported range.
 * @param value - The desired pan speed in pixels/second.
 * @returns The clamped pan speed.
 */
export function clampStagePanSpeed(value: number): number {
  if (!Number.isFinite(value)) {
    return STAGE_PREVIEW_DEFAULT_PAN_SPEED;
  }

  return Math.min(STAGE_PREVIEW_MAX_PAN_SPEED, Math.max(STAGE_PREVIEW_MIN_PAN_SPEED, Math.round(value)));
}
