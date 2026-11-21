import * as Phaser from 'phaser';

import { AUDIO_KEYS, playAudioCue } from '../game/core/audio';
import { FIGHTER_CHARACTER_DEFINITIONS } from '../game/hero';
import { createMenuBackdrop } from '../game/menuBackdrop';
import { MY_FIGHTER_IDS } from '../game/myFighterLoader';
import { playSfx, startMusic } from '../game/soundEffects';
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

// Cards arrange into up to 8 columns for large rosters (e.g. 24 fighters in 3 rows) so all cards fit on screen.
const COLUMNS =
  SELECTABLE_ROSTER.length > 21
    ? 8
    : SELECTABLE_ROSTER.length > 15
      ? 7
      : SELECTABLE_ROSTER.length > 5
        ? 5
        : Math.max(1, SELECTABLE_ROSTER.length);
const ROWS = Math.max(1, Math.ceil(SELECTABLE_ROSTER.length / COLUMNS));
const COL_GAP = COLUMNS >= 8 ? 14 : COLUMNS >= 7 ? 16 : COLUMNS >= 5 || SELECTABLE_ROSTER.length > 3 ? 24 : 48;
const ROW_GAP = ROWS >= 3 ? (COLUMNS >= 7 ? 24 : 32) : 34;
const CARD_WIDTH =
  ROWS >= 3
    ? Math.min(176, Math.floor((1200 - COL_GAP * (COLUMNS - 1)) / COLUMNS))
    : ROWS > 1
      ? Math.min(200, Math.floor((1180 - COL_GAP * (COLUMNS - 1)) / COLUMNS))
      : Math.min(300, Math.floor((1180 - COL_GAP * (COLUMNS - 1)) / COLUMNS));
const CARD_HEIGHT =
  ROWS >= 3
    ? COLUMNS >= 7
      ? 140
      : 148
    : ROWS > 1
      ? Math.round(CARD_WIDTH * 1.14)
      : Math.round(CARD_WIDTH * 1.28);

interface PlayerCursor {
  index: number;
  locked: boolean;
  picks: number[];
  outline: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/**
 * Final step of the Play flow: pick fighters.
 * - 1v1: P1 (WASD + Space) & P2 (Arrows + Enter) each pick 1 fighter.
 * - 1vCPU: P1 picks 1 fighter, then CPU picks 1.
 * - 2v2: Each team picks 2 fighters; Team 2 defaults to CPU (press Tab or click
 *   the toggle to switch Team 2 to 2P Arrows).
 */
export class CharacterSelectScene extends BaseScene {
  private mode: MatchMode = '1v1';
  private stageId = '';
  private cards: SelectionCard[] = [];
  private cardPositions: Array<{ x: number; y: number }> = [];
  private p1!: PlayerCursor;
  private p2!: PlayerCursor;
  private team2IsCpu = true;
  private team2ToggleText?: Phaser.GameObjects.Text;
  private lockBadges: Phaser.GameObjects.Text[] = [];
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
    this.lockBadges = [];
    this.transitioning = false;
    this.team2IsCpu = this.mode === '1vcpu' || this.mode === '2v2';

    this.markActiveScene(SCENE_KEYS.CharacterSelect);
    startMusic('menu', this.app.settingsStore);

    const cleanupBackdrop = createMenuBackdrop(this, {
      stageKey: 'crimson-eclipse-stage',
      showFighters: false,
      scrimAlpha: 0.78
    });

    const subtitle =
      this.mode === '1v1'
        ? 'P1 = WASD + Space   •   P2 = Arrows + Enter'
        : this.mode === '2v2'
          ? 'Pick 2 Fighters per Team   •   WASD / Arrows + Confirm'
          : 'WASD / Arrows to choose • Enter to confirm';

    this.createHeading('Select Fighter', subtitle);

    if (this.mode === '2v2') {
      this.buildTeam2Toggle();
    }

    this.buildCards();
    this.buildCursors();
    this.registerInput();

    this.createFooterHint(this.mode === '2v2' ? 'Tab: toggle Team 2 (CPU / 2P) • Esc to go back' : 'Esc to go back');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cleanupBackdrop();
      this.lockBadges.forEach((badge) => badge.destroy());
      this.lockBadges = [];
      this.team2ToggleText?.destroy();
      this.team2ToggleText = undefined;
      this.cards.forEach((card) => card.destroy());
      this.cards = [];
    });
  }

  private get picksPerTeam(): number {
    return this.mode === '2v2' ? 2 : 1;
  }

  private buildTeam2Toggle(): void {
    const { centerX } = this.cameras.main;
    this.team2ToggleText = this.add
      .text(centerX, 120, '', {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '14px',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: { x: 12, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setInteractive({ useHandCursor: true });

    this.team2ToggleText.on('pointerdown', () => this.toggleTeam2Control());
    this.refreshTeam2Toggle();
  }

  private refreshTeam2Toggle(): void {
    if (!this.team2ToggleText) {
      return;
    }

    const label = this.team2IsCpu
      ? 'Team 2: CPU Team  [Tab / Click to switch to 2P]'
      : 'Team 2: 2P Arrows  [Tab / Click to switch to CPU]';
    this.team2ToggleText
      .setText(label)
      .setColor(this.team2IsCpu ? '#38bdf8' : '#f43f5e');
  }

  private toggleTeam2Control(): void {
    if (this.mode !== '2v2' || this.transitioning || this.p2.picks.length > 0 || this.p1.locked) {
      return;
    }

    this.team2IsCpu = !this.team2IsCpu;
    this.p2.outline.setVisible(!this.team2IsCpu);
    this.p2.label.setVisible(!this.team2IsCpu);
    if (!this.team2IsCpu && this.p2.index === this.p1.index && this.cards.length > 1) {
      this.p2.index = (this.p1.index + 1) % this.cards.length;
    }
    this.refreshCursor(this.p2);
    this.refreshTeam2Toggle();
    playSfx('ui-move', this.app.settingsStore.getState());
  }

  private buildCards(): void {
    const { centerX, centerY } = this.cameras.main;
    const roster = SELECTABLE_ROSTER;
    const totalHeight = ROWS * CARD_HEIGHT + ROW_GAP * (ROWS - 1);
    const gridCenterY =
      this.mode === '2v2'
        ? centerY + 46
        : ROWS >= 3
          ? centerY + 38
          : ROWS > 1
            ? centerY + 38
            : centerY + 24;
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

      card.container.setDepth(10);
      this.cards.push(card);
    });
  }

  private buildCursors(): void {
    const p1Label = this.mode === '2v2' ? 'P1-1' : 'P1';
    const p2Label = this.mode === '2v2' ? 'P2-1' : 'P2';
    this.p1 = this.createCursor(p1Label, P1_COLOR, 0);
    const p2Start = !this.team2IsCpu ? Math.min(1, this.cards.length - 1) : 0;
    this.p2 = this.createCursor(p2Label, P2_COLOR, p2Start);

    if (this.team2IsCpu) {
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

    return { index, locked: false, picks: [], outline, label: text };
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

  private placePickBadge(index: number, label: string, color: number): void {
    const position = this.cardPositions[index];
    if (!position) {
      return;
    }

    const badge = this.add
      .text(position.x - CARD_WIDTH / 2 + 8, position.y - CARD_HEIGHT / 2 + 8, label, {
        color: '#020617',
        backgroundColor: colorToCss(color),
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        padding: { x: 5, y: 2 }
      })
      .setOrigin(0, 0)
      .setDepth(22);

    this.lockBadges.push(badge);
  }

  private registerInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    if (this.mode === '1v1' || (this.mode === '2v2' && !this.team2IsCpu)) {
      keyboard.on('keydown-A', () => this.movePlayer(this.p1, -1, 0));
      keyboard.on('keydown-D', () => this.movePlayer(this.p1, 1, 0));
      keyboard.on('keydown-W', () => this.movePlayer(this.p1, 0, -1));
      keyboard.on('keydown-S', () => this.movePlayer(this.p1, 0, 1));
      keyboard.on('keydown-LEFT', () => {
        if (!this.team2IsCpu) {
          this.movePlayer(this.p2, -1, 0);
        } else {
          this.movePlayer(this.p1, -1, 0);
        }
      });
      keyboard.on('keydown-RIGHT', () => {
        if (!this.team2IsCpu) {
          this.movePlayer(this.p2, 1, 0);
        } else {
          this.movePlayer(this.p1, 1, 0);
        }
      });
      keyboard.on('keydown-UP', () => {
        if (!this.team2IsCpu) {
          this.movePlayer(this.p2, 0, -1);
        } else {
          this.movePlayer(this.p1, 0, -1);
        }
      });
      keyboard.on('keydown-DOWN', () => {
        if (!this.team2IsCpu) {
          this.movePlayer(this.p2, 0, 1);
        } else {
          this.movePlayer(this.p1, 0, 1);
        }
      });
      keyboard.on('keydown-SPACE', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-F', () => this.confirmPlayer(this.p1));
      keyboard.on('keydown-ENTER', () => {
        if (!this.team2IsCpu) {
          this.confirmPlayer(this.p2);
        } else {
          this.confirmPlayer(this.p1);
        }
      });
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

    if (this.mode === '2v2') {
      keyboard.on('keydown-TAB', (event: KeyboardEvent) => {
        event.preventDefault();
        this.toggleTeam2Control();
      });
    }

    keyboard.on('keydown-ESC', () => this.goBack());
    keyboard.on('keydown-BACKSPACE', () => this.goBack());
  }

  private isIndexTaken(index: number): boolean {
    return this.p1.picks.includes(index) || this.p2.picks.includes(index);
  }

  private findFirstFreeIndex(exclude: number[] = []): number {
    for (let i = 0; i < this.cards.length; i += 1) {
      if (!this.isIndexTaken(i) && !exclude.includes(i)) {
        return i;
      }
    }
    return 0;
  }

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
    const blockedByOtherCursor = !this.team2IsCpu && next === other.index;
    const blockedByLockedPick = this.isIndexTaken(next);

    if (blockedByOtherCursor || blockedByLockedPick) {
      let attempts = 0;
      let candidate = next;
      while (attempts < count) {
        candidate = computeTarget(candidate, dx || (dy !== 0 ? 1 : 1), dx !== 0 ? 0 : dy);
        if (candidate !== cursor.index && !this.isIndexTaken(candidate) && (this.team2IsCpu || candidate !== other.index)) {
          next = candidate;
          break;
        }
        attempts += 1;
      }
      if (this.isIndexTaken(next) || (!this.team2IsCpu && next === other.index)) {
        return;
      }
    }

    if (next !== cursor.index) {
      playSfx('ui-move', this.app.settingsStore.getState());
    }
    cursor.index = next;
    this.refreshCursor(cursor);
  }

  private otherCursor(cursor: PlayerCursor): PlayerCursor {
    return cursor === this.p1 ? this.p2 : this.p1;
  }

  private hoverCard(index: number): void {
    if (this.transitioning || !this.team2IsCpu || this.p1.locked || this.isIndexTaken(index)) {
      return;
    }

    if (this.p1.index !== index) {
      playSfx('ui-move', this.app.settingsStore.getState());
    }
    this.p1.index = index;
    this.refreshCursor(this.p1);
  }

  private clickCard(index: number): void {
    if (this.transitioning || !this.team2IsCpu || this.p1.locked || this.isIndexTaken(index)) {
      return;
    }

    this.p1.index = index;
    this.refreshCursor(this.p1);
    this.confirmPlayer(this.p1);
  }

  private confirmPlayer(cursor: PlayerCursor): void {
    if (this.transitioning || cursor.locked || this.isIndexTaken(cursor.index)) {
      return;
    }

    const isP1 = cursor === this.p1;
    const color = isP1 ? P1_COLOR : P2_COLOR;
    const pickNum = cursor.picks.length + 1;
    const pickedIndex = cursor.index;

    cursor.picks.push(pickedIndex);
    playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());

    if (this.mode === '2v2') {
      const badgeLabel = isP1 ? `P1-${pickNum}` : `P2-${pickNum}`;
      this.placePickBadge(pickedIndex, badgeLabel, color);
    }

    const doneForCursor = cursor.picks.length >= this.picksPerTeam;
    if (doneForCursor) {
      cursor.locked = true;
      this.refreshCursor(cursor);
    } else {
      cursor.label.setText(isP1 ? 'P1-2' : 'P2-2');
      cursor.index = this.findFirstFreeIndex(!this.team2IsCpu ? [this.otherCursor(cursor).index] : []);
      this.refreshCursor(cursor);
    }

    this.cards[pickedIndex].flashLock(() => {
      if (!doneForCursor) {
        return;
      }

      if (this.team2IsCpu) {
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
    const needed = this.picksPerTeam;
    const choices = this.cards.map((_, index) => index).filter((index) => !this.p1.picks.includes(index));
    const shuffled = Phaser.Utils.Array.Shuffle([...choices]);

    const cpuPicks: number[] = [];
    for (let i = 0; i < needed; i += 1) {
      cpuPicks.push(shuffled[i] ?? this.p1.picks[0] ?? 0);
    }
    this.p2.picks = cpuPicks;

    this.p2.index = cpuPicks[0];
    this.p2.outline.setVisible(true);
    this.p2.label.setVisible(true);
    this.p2.label.setText(this.mode === '2v2' ? 'CPU-1' : 'CPU');
    this.refreshCursor(this.p2);

    this.time.delayedCall(380, () => {
      if (this.mode === '2v2') {
        this.placePickBadge(cpuPicks[0], 'CPU-1', P2_COLOR);
        playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
        this.cards[cpuPicks[0]].flashLock(() => {
          this.p2.index = cpuPicks[1];
          this.p2.label.setText('CPU-2');
          this.refreshCursor(this.p2);

          this.time.delayedCall(360, () => {
            this.p2.locked = true;
            this.refreshCursor(this.p2);
            this.placePickBadge(cpuPicks[1], 'CPU-2', P2_COLOR);
            playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
            this.cards[cpuPicks[1]].flashLock(() => this.startMatch());
          });
        });
        return;
      }

      this.p2.locked = true;
      this.refreshCursor(this.p2);
      playAudioCue(this, AUDIO_KEYS.uiConfirm, this.app.settingsStore.getState());
      this.cards[cpuPicks[0]].flashLock(() => this.startMatch());
    });
  }

  private startMatch(): void {
    if (this.transitioning && !this.team2IsCpu) {
      return;
    }

    this.transitioning = true;
    const roster = SELECTABLE_ROSTER;
    const p1Main = roster[this.p1.picks[0] ?? this.p1.index].id;
    const p2Main = roster[this.p2.picks[0] ?? this.p2.index].id;
    const p1Ally = this.mode === '2v2' ? roster[this.p1.picks[1] ?? this.p1.index].id : undefined;
    const p2Ally = this.mode === '2v2' ? roster[this.p2.picks[1] ?? this.p2.index].id : undefined;

    this.scene.start(SCENE_KEYS.Match, {
      mode: this.mode,
      stageId: this.stageId,
      p1CharacterId: p1Main,
      p2CharacterId: p2Main,
      p1AllyCharacterId: p1Ally,
      p2AllyCharacterId: p2Ally,
      p2IsCpu: this.team2IsCpu
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
