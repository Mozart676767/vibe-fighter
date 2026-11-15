import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { FIGHTER_CHARACTER_DEFINITIONS } from '../game/hero';
import { MY_FIGHTER_IDS } from '../game/myFighterLoader';
import { createSelectionCard, type SelectionCard } from '../game/ui';
import { SCENE_KEYS, type MatchMode } from '../game/types';
import { BaseScene } from './BaseScene';

interface CharacterSelectData {
  mode: MatchMode;
  stageId: string;
}

const P1_COLOR = 0x38bdf8;
const P2_COLOR = 0xf43f5e;

// Only fighters registered in myFighters.ts are selectable.
const SELECTABLE_FIGHTER_IDS = [...MY_FIGHTER_IDS];
const SELECTABLE_ROSTER = SELECTABLE_FIGHTER_IDS.flatMap((id) =>
  FIGHTER_CHARACTER_DEFINITIONS.filter((character) => character.id === id)
);

// Cards arrange into rows of up to 5 columns so large rosters stay clear and readable.
const COLUMNS = SELECTABLE_ROSTER.length > 5 ? 5 : Math.max(1, SELECTABLE_ROSTER.length);
const ROWS = Math.max(1, Math.ceil(SELECTABLE_ROSTER.length / COLUMNS));
const COL_GAP = COLUMNS >= 5 || SELECTABLE_ROSTER.length > 3 ? 24 : 48;
const ROW_GAP = ROWS >= 3 ? 32 : 34;
const CARD_WIDTH =
  ROWS >= 3
    ? Math.min(176, Math.floor((1180 - COL_GAP * (COLUMNS - 1)) / COLUMNS))
    : ROWS > 1
      ? Math.min(200, Math.floor((1180 - COL_GAP * (COLUMNS - 1)) / COLUMNS))
      : Math.min(300, Math.floor((1180 - COL_GAP * (COLUMNS - 1)) / COLUMNS));
const CARD_HEIGHT =
  ROWS >= 3 ? 148 : ROWS > 1 ? Math.round(CARD_WIDTH * 1.14) : Math.round(CARD_WIDTH * 1.28);

interface PlayerCursor {
  index: number;
  locked: boolean;
  outline: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/**
 * Final step of the Play flow: pick fighters. In 1v1 both players drive their
 * own cursor (P1 = WASD, P2 = arrows) and cannot land on the other's pick. In
 * 1vCPU the player picks freely and the CPU then auto-selects a different
 * fighter. Each confirmation plays a lock-in flash before the match starts.
 */
export class CharacterSelectScene extends BaseScene {
  private mode: MatchMode = '1v1';
  private stageId = '';
  private cards: SelectionCard[] = [];
  private cardPositions: Array<{ x: number; y: number }> = [];
  private p1!: PlayerCursor;
  private p2!: PlayerCursor;
  private transitioning = false;

  constructor() {
    super(SCENE_KEYS.CharacterSelect);
  }

  init(data: CharacterSelectData): void {
    this.mode = data?.mode ?? '1v1';
    this.stageId = data?.stageId ?? '';
  }

  create(): void {
    this.cards = [];
    this.cardPositions = [];
    this.transitioning = false;

    this.markActiveScene(SCENE_KEYS.CharacterSelect);
    this.cameras.main.setBackgroundColor(0x020617);
    this.createHeading(
      'Select Fighter',
      this.mode === '1v1' ? 'P1 = WASD + Space   •   P2 = Arrows + Enter' : 'WASD / Arrows to choose • Enter to confirm'
    );

    this.buildCards();
    this.buildCursors();
    this.registerInput();

    this.createFooterHint('Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  private buildCards(): void {
    const { centerX, centerY } = this.cameras.main;
    const roster = SELECTABLE_ROSTER;
    const totalHeight = ROWS * CARD_HEIGHT + ROW_GAP * (ROWS - 1);
    const gridCenterY = ROWS >= 3 ? centerY + 38 : ROWS > 1 ? centerY + 38 : centerY + 24;
    const startY = gridCenterY - totalHeight / 2 + CARD_HEIGHT / 2;
    const imageMaxSize = ROWS >= 3 ? 98 : ROWS > 1 ? Math.round(CARD_WIDTH * 0.72) : CARD_WIDTH - 36;
    const imageOffsetY = ROWS >= 3 ? -14 : ROWS > 1 ? -16 : -34;

    roster.forEach((character, index) => {
      const row = Math.floor(index / COLUMNS);
      const col = index % COLUMNS;
      const itemsInRow = Math.min(COLUMNS, roster.length - row * COLUMNS);
      const rowWidth = CARD_WIDTH * itemsInRow + COL_GAP * (itemsInRow - 1);
      const rowStartX = centerX - rowWidth / 2 + CARD_WIDTH / 2;
      const x = rowStartX + col * (CARD_WIDTH + COL_GAP);
      const y = startY + row * (CARD_HEIGHT + ROW_GAP);

      this.cardPositions.push({ x, y });

      const card = createSelectionCard(this, {
        x,
        y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        title: character.label,
        texture: this.textures.exists(character.portrait.key) ? character.portrait.key : undefined,
        imageMaxSize,
        imageOffsetY,
        onHover: () => this.hoverCard(index),
        onClick: () => this.clickCard(index)
      });

      this.cards.push(card);
    });
  }

  private buildCursors(): void {
    this.p1 = this.createCursor('P1', P1_COLOR, 0);
    const p2Start = this.mode === '1v1' ? Math.min(1, this.cards.length - 1) : 0;
    this.p2 = this.createCursor('P2', P2_COLOR, p2Start);

    if (this.mode === '1vcpu') {
      this.p2.outline.setVisible(false);
      this.p2.label.setVisible(false);
    }

    this.refreshCursor(this.p1);
    this.refreshCursor(this.p2);
  }

  private createCursor(label: string, color: number, index: number): PlayerCursor {
    const outline = this.add
      .rectangle(0, 0, CARD_WIDTH + 16, CARD_HEIGHT + 16, color, 0)
      .setStrokeStyle(4, color, 1)
      .setDepth(20);

    const text = this.add
      .text(0, 0, label, {
        color: '#020617',
        backgroundColor: colorToCss(color),
        fontFamily: 'monospace',
        fontSize: '16px',
        padding: { x: 8, y: 3 }
      })
      .setOrigin(0.5)
      .setDepth(21);

    return { index, locked: false, outline, label: text };
  }

  private refreshCursor(cursor: PlayerCursor): void {
    const position = this.cardPositions[cursor.index];
    if (!position) {
      return;
    }

    cursor.outline.setPosition(position.x, position.y);
    cursor.outline.setStrokeStyle(cursor.locked ? 7 : 4, cursor.outline.strokeColor, 1);
    cursor.label.setPosition(position.x, position.y - CARD_HEIGHT / 2 - 18);
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    if (this.mode === '1v1') {
      keyboard.on('keydown-A', () => this.movePlayer(this.p1, -1, 0));
      keyboard.on('keydown-D', () => this.movePlayer(this.p1, 1, 0));
      keyboard.on('keydown-W', () => this.movePlayer(this.p1, 0, -1));
      keyboard.on('keydown-S', () => this.movePlayer(this.p1, 0, 1));
      keyboard.on('keydown-LEFT', () => this.movePlayer(this.p2, -1, 0));
      keyboard.on('keydown-RIGHT', () => this.movePlayer(this.p2, 1, 0));
      keyboard.on('keydown-UP', () => this.movePlayer(this.p2, 0, -1));
      keyboard.on('keydown-DOWN', () => this.movePlayer(this.p2, 0, 1));
      keyboard.on('keydown-SPACE', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-F', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-ENTER', () => this.confirmPlayer(this.p2));
    } else {
      const moveLeft = (): void => this.movePlayer(this.p1, -1, 0);
      const moveRight = (): void => this.movePlayer(this.p1, 1, 0);
      const moveUp = (): void => this.movePlayer(this.p1, 0, -1);
      const moveDown = (): void => this.movePlayer(this.p1, 0, 1);
      keyboard.on('keydown-A', moveLeft);
      keyboard.on('keydown-LEFT', moveLeft);
      keyboard.on('keydown-D', moveRight);
      keyboard.on('keydown-RIGHT', moveRight);
      keyboard.on('keydown-W', moveUp);
      keyboard.on('keydown-UP', moveUp);
      keyboard.on('keydown-S', moveDown);
      keyboard.on('keydown-DOWN', moveDown);
      keyboard.on('keydown-SPACE', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-F', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-ENTER', () => this.confirmPlayer(this.p1));
    }

    keyboard.on('keydown-ESC', () => this.goBack());
    keyboard.on('keydown-BACKSPACE', () => this.goBack());
  }

  /**
   * Moves a player's cursor across the roster grid. The two players can never
   * select the same fighter: when a move would land on the other player's card
   * the cursor hops over it (or shifts on the target row) if a free card
   * exists, otherwise swaps picks when the other player isn't locked.
   */
  private movePlayer(cursor: PlayerCursor, dx: number, dy: number): void {
    if (this.transitioning || cursor.locked || this.cards.length === 0) {
      return;
    }

    const count = this.cards.length;
    const other = this.otherCursor(cursor);
    const computeTarget = (fromIndex: number, stepX: number, stepY: number): number => {
      if (stepY !== 0) {
        const currentRow = Math.floor(fromIndex / COLUMNS);
        const currentCol = fromIndex % COLUMNS;
        const targetRow = Phaser.Math.Wrap(currentRow + stepY, 0, ROWS);
        return Math.min(count - 1, targetRow * COLUMNS + currentCol);
      }

      return Phaser.Math.Wrap(fromIndex + stepX, 0, count);
    };

    let next = computeTarget(cursor.index, dx, dy);

    if (this.mode === '1v1' && next === other.index) {
      const skip = computeTarget(next, dx, dy);

      if (skip !== cursor.index && skip !== other.index) {
        next = skip;
      } else if (dy !== 0 && COLUMNS > 1) {
        const targetRow = Math.floor(next / COLUMNS);
        const targetCol = next % COLUMNS;
        let found: number | undefined;
        for (let offset = 1; offset < COLUMNS; offset++) {
          const candidate = targetRow * COLUMNS + Phaser.Math.Wrap(targetCol + offset, 0, COLUMNS);
          if (candidate < count && candidate !== other.index && candidate !== cursor.index) {
            found = candidate;
            break;
          }
        }
        if (found !== undefined) {
          next = found;
        } else if (!other.locked) {
          other.index = cursor.index;
          cursor.index = next;
          this.refreshCursor(cursor);
          this.refreshCursor(other);
          return;
        } else {
          return;
        }
      } else if (!other.locked) {
        other.index = cursor.index;
        cursor.index = next;
        this.refreshCursor(cursor);
        this.refreshCursor(other);
        return;
      } else {
        return;
      }
    }

    cursor.index = next;
    this.refreshCursor(cursor);
  }

  private otherCursor(cursor: PlayerCursor): PlayerCursor {
    return cursor === this.p1 ? this.p2 : this.p1;
  }

  private hoverCard(index: number): void {
    if (this.transitioning || this.mode !== '1vcpu' || this.p1.locked) {
      return;
    }

    this.p1.index = index;
    this.refreshCursor(this.p1);
  }

  private clickCard(index: number): void {
    if (this.transitioning) {
      return;
    }

    if (this.mode === '1vcpu') {
      this.p1.index = index;
      this.refreshCursor(this.p1);
      this.confirmPlayer(this.p1);
    }
  }

  /**
   * Locks a player's current pick with a flash. In 1v1 the match starts once
   * both players have locked; in 1vCPU locking the player triggers the CPU pick.
   * @param cursor - The player cursor confirming its selection.
   */
  private confirmPlayer(cursor: PlayerCursor): void {
    if (this.transitioning || cursor.locked) {
      return;
    }

    cursor.locked = true;
    this.refreshCursor(cursor);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());

    this.cards[cursor.index].flashLock(() => {
      if (this.mode === '1vcpu') {
        this.runCpuSelection();
        return;
      }

      if (this.p1.locked && this.p2.locked) {
        this.startMatch();
      }
    });
  }

  private runCpuSelection(): void {
    if (this.transitioning) {
      return;
    }

    this.transitioning = true;

    const choices = this.cards.map((_, index) => index).filter((index) => index !== this.p1.index);
    const cpuIndex = choices.length > 0 ? Phaser.Math.RND.pick(choices) : this.p1.index;

    this.p2.index = cpuIndex;
    this.p2.outline.setVisible(true);
    this.p2.label.setVisible(true);
    this.p2.label.setText('CPU');
    this.refreshCursor(this.p2);

    this.time.delayedCall(450, () => {
      this.p2.locked = true;
      this.refreshCursor(this.p2);
      playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
      this.cards[cpuIndex].flashLock(() => this.startMatch());
    });
  }

  private startMatch(): void {
    if (this.transitioning && this.mode === '1v1') {
      return;
    }

    this.transitioning = true;
    const roster = SELECTABLE_ROSTER;

    this.scene.start(SCENE_KEYS.Match, {
      mode: this.mode,
      stageId: this.stageId,
      p1CharacterId: roster[this.p1.index].id,
      p2CharacterId: roster[this.p2.index].id
    });
  }

  private goBack(): void {
    if (this.transitioning) {
      return;
    }

    this.scene.start(SCENE_KEYS.LevelSelect, { mode: this.mode });
  }
}

/**
 * Convert a 24-bit colour integer to a CSS hex string.
 * @param color - The colour as 0xRRGGBB.
 */
function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
