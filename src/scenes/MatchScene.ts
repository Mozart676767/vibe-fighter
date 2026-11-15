import * as Phaser from 'phaser';

import { Fighter, NEUTRAL_FIGHTER_INPUT, type FighterInput } from '../game/fighter';
import { getCharacterDefinition } from '../game/hero';
import { MatchHud } from '../game/matchHud';
import { getSpecialPower } from '../game/specialPowers';
import { getStageDefinition } from '../game/stageConfig';
import { playSuperCutIn } from '../game/superCutIn';
import { SCENE_KEYS, type MatchConfig } from '../game/types';
import { spawnHitSpark, type VfxColor } from '../game/vfx';
import { BaseScene } from './BaseScene';

const GROUND_FRACTION = 0.82;
const EDGE_MARGIN = 170;
const DEPTH_FRONT = 8;
const DEPTH_BACK = 5;

// Fraction of the gap from the screen centre each fighter occupies at spawn.
const SPAWN_OFFSET_FRACTION = 0.18;
// How quickly the camera eases toward the fighters' midpoint (0..1 per frame).
const CAMERA_LERP = 0.14;

const ROUNDS_TO_WIN = 2;
// Seconds on the round clock. When it expires the fighter with more health wins
// (a tie is a draw and replays the round).
const ROUND_SECONDS = 90;
const HUD_DEPTH = 100;
const BANNER_DEPTH = 200;
const OVERLAY_DEPTH = 300;

/** The match's high-level state, driving input gating and the HUD. */
type MatchPhase = 'intro' | 'fighting' | 'roundEnd' | 'matchOver';

interface PlayerKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  crouch: Phaser.Input.Keyboard.Key;
  block: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  light: Phaser.Input.Keyboard.Key;
  heavy: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
}

/**
 * The versus match: two fighters spawn facing each other and fight a best-of-3
 * (first to {@link ROUNDS_TO_WIN} rounds). Each round runs a "ROUND n / FIGHT!"
 * intro, then live combat — attack boxes vs hurtboxes drive damage, hitstun,
 * knockback, and a knockdown on KO. When the match is decided a game-over
 * overlay offers a rematch or a return to the main menu. P1 is always human;
 * P2 is human in 1v1 or a simple CPU in 1vCPU.
 */
export class MatchScene extends BaseScene {
  private config: MatchConfig = {
    mode: '1v1',
    stageId: 'rooftop-twilight',
    p1CharacterId: '',
    p2CharacterId: ''
  };

  private p1!: Fighter;
  private p2!: Fighter;
  private p1Keys!: PlayerKeys;
  private p2Keys!: PlayerKeys;
  private cpu?: CpuController;

  private phase: MatchPhase = 'intro';
  private roundNumber = 1;
  private p1Wins = 0;
  private p2Wins = 0;

  private spawnX1 = 0;
  private spawnX2 = 0;

  private stageWorldWidth = 0;
  private maxScroll = 0;

  private hud!: MatchHud;
  private banner!: Phaser.GameObjects.Text;
  private roundTimeMs = ROUND_SECONDS * 1000;
  private hitstopTimer = 0;
  private overlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE_KEYS.Match);
  }

  init(data: MatchConfig): void {
    if (data) {
      this.config = data;
    }
  }

  create(): void {
    this.cpu = undefined;
    this.phase = 'intro';
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.hitstopTimer = 0;
    this.overlay = [];

    this.markActiveScene(SCENE_KEYS.Match);
    this.cameras.main.setBackgroundColor(0x05070d);

    this.buildStage();
    this.spawnFighters();
    this.registerKeys();
    this.createControlsLegend();

    this.hud = new MatchHud(this, {
      mode: this.config.mode,
      p1CharacterId: this.config.p1CharacterId,
      p2CharacterId: this.config.p2CharacterId,
      roundsToWin: ROUNDS_TO_WIN,
      depth: HUD_DEPTH
    });
    this.hud.slideIn();

    this.banner = this.add
      .text(this.cameras.main.centerX, this.cameras.main.centerY - 40, '', {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '64px',
        stroke: '#020617',
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(BANNER_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0);

    if (this.config.mode === '1vcpu') {
      this.cpu = new CpuController();
    }

    this.startRound();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.p1?.destroy();
      this.p2?.destroy();
      this.hud?.destroy();
    });
  }

  /**
   * Per-frame loop: feeds both fighters their input (only while fighting),
   * keeps them facing each other, resolves hits, checks for a KO, and redraws
   * the HUD.
   * @param time - Phaser clock time in ms.
   * @param delta - Milliseconds since the previous frame.
   */
  update(time: number, delta: number): void {
    const seconds = delta / 1000;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - seconds);
      return;
    }

    const fighting = this.phase === 'fighting';

    const p1Input = fighting ? this.readKeys(this.p1Keys) : { ...NEUTRAL_FIGHTER_INPUT };
    const p2Input = fighting
      ? this.cpu
        ? this.cpu.update(time, this.p2, this.p1)
        : this.readKeys(this.p2Keys)
      : { ...NEUTRAL_FIGHTER_INPUT };

    // Crouching (and crouch-block) is disabled for now: defense is simply
    // block-or-not. The geometric guard-box model still resolves blocks via the
    // standing guard box; the crouch/low path stays in the code but unused.
    p1Input.crouch = false;
    p2Input.crouch = false;

    this.p1.faceToward(this.p2.x);
    this.p2.faceToward(this.p1.x);

    if (fighting) {
      if (isActing(p1Input)) {
        this.p1.setDepthBase(DEPTH_FRONT);
        this.p2.setDepthBase(DEPTH_BACK);
      } else if (isActing(p2Input)) {
        this.p2.setDepthBase(DEPTH_FRONT);
        this.p1.setDepthBase(DEPTH_BACK);
      }
    }

    this.p1.update(seconds, p1Input);
    this.p2.update(seconds, p2Input);

    this.updateCamera(false);

    if (fighting) {
      this.resolveCombat();
      this.checkForKnockout();

      if (this.phase === 'fighting') {
        this.tickRoundTimer(delta);
        this.hud.applyHealth(this.p1.health01, this.p2.health01);
      }
    }

    this.hud.setMeter(this.p1.meter01, this.p2.meter01);
    this.hud.setTime(Math.ceil(this.roundTimeMs / 1000));
    this.hud.updateWins(this.p1Wins, this.p2Wins);
  }

  /**
   * Checks both directions for a connecting hit and applies damage/block this
   * frame. A swing only lands once thanks to the attacker's connect flag.
   */
  private resolveCombat(): void {
    this.tryHit(this.p1, this.p2);
    this.tryHit(this.p2, this.p1);
  }

  /**
   * Resolves a single attacker -> defender interaction for the current frame.
   * Blocking is purely geometric: the hit is guarded when the attack box
   * overlaps the defender's active guard box (from its block pose).
   * @param attacker - The fighter whose attack box is tested.
   * @param defender - The fighter whose hurtbox is tested.
   */
  private tryHit(attacker: Fighter, defender: Fighter): void {
    if (defender.isDefeated) {
      return;
    }

    const attack = attacker.getActiveAttack();
    if (!attack) {
      return;
    }

    const hurt = defender.getHurtRect();
    if (!hurt || !Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, hurt)) {
      return;
    }

    const guard = defender.getGuardRect();
    const blocked = guard !== null && Phaser.Geom.Intersects.RectangleToRectangle(attack.rect, guard);
    const isSpecial = attack.profile.kind === 'special';
    const finisher = attack.finisher && !blocked;

    // The combo finisher launches harder and stuns longer than a regular hit.
    const profile = finisher
      ? { ...attack.profile, knockback: attack.profile.knockback * 1.9, hitstun: attack.profile.hitstun * 1.4 }
      : attack.profile;

    defender.applyHit(profile, attacker.facingDirection, blocked);
    defender.flashHit(blocked);
    attacker.markAttackConnected();
    attacker.registerOffense(blocked, isSpecial);
    defender.registerDefense(blocked);

    this.spawnHitFx(attack.rect, hurt, blocked, isSpecial, finisher, attacker.characterId);

    if (finisher) {
      this.hitstopTimer = 0.065;
    }
  }

  /**
   * Spawns the impact spark and camera shake for a connecting hit, scaled up for
   * special hits and the combo finisher.
   * @param attackRect - The attacker's attack box (world space).
   * @param hurtRect - The defender's hurtbox (world space).
   * @param blocked - Whether the hit was guarded.
   * @param isSpecial - Whether the attack was a special move.
   * @param finisher - Whether this is the special's finishing hit.
   * @param attackerId - The attacking character id for signature chakra spark colour.
   */
  private spawnHitFx(
    attackRect: Phaser.Geom.Rectangle,
    hurtRect: Phaser.Geom.Rectangle,
    blocked: boolean,
    isSpecial: boolean,
    finisher: boolean,
    attackerId: string
  ): void {
    const sparkX = (Phaser.Geom.Rectangle.GetCenter(attackRect).x + Phaser.Geom.Rectangle.GetCenter(hurtRect).x) / 2;
    const sparkY = (Phaser.Geom.Rectangle.GetCenter(attackRect).y + Phaser.Geom.Rectangle.GetCenter(hurtRect).y) / 2;

    const specialColor = getSpecialPower(attackerId).color;
    const color: VfxColor = blocked ? 'blue' : isSpecial ? specialColor : finisher ? 'gold' : 'red';
    const sparkScale = finisher ? 1.7 : isSpecial ? 1.25 : 0.9;
    spawnHitSpark(this, sparkX, sparkY, color, sparkScale);

    if (finisher) {
      this.cameras.main.shake(220, 0.012);
    } else if (isSpecial) {
      this.cameras.main.shake(blocked ? 60 : 90, blocked ? 0.003 : 0.005);
    } else {
      this.cameras.main.shake(blocked ? 60 : 120, blocked ? 0.003 : 0.006);
    }
  }

  /** Ends the round when either fighter is knocked out. */
  private checkForKnockout(): void {
    if (this.p1.isDefeated) {
      this.endRound(2);
    } else if (this.p2.isDefeated) {
      this.endRound(1);
    }
  }

  /**
   * Counts the round clock down while fighting. When it reaches zero the round
   * is decided on remaining health (a tie replays the round as a draw).
   * @param delta - Milliseconds since the previous frame.
   */
  private tickRoundTimer(delta: number): void {
    this.roundTimeMs = Math.max(0, this.roundTimeMs - delta);

    if (this.roundTimeMs <= 0) {
      this.resolveTimeOut();
    }
  }

  /** Decides a timed-out round by comparing remaining health. */
  private resolveTimeOut(): void {
    const p1 = this.p1.health01;
    const p2 = this.p2.health01;

    if (p1 > p2) {
      this.endRound(1, 'TIME UP', '#facc15');
    } else if (p2 > p1) {
      this.endRound(2, 'TIME UP', '#facc15');
    } else {
      this.drawRound();
    }
  }

  /** Handles a drawn round (timeout with equal health): replays the round. */
  private drawRound(): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';
    this.showBanner('DRAW', '#e2e8f0', 1.1);
    this.time.delayedCall(1100, () => this.startRound());
  }

  /**
   * Places the chosen stage fit to the viewport height, anchored at world x=0,
   * and sets up the scrollable world. The stage's on-screen width becomes the
   * world width; the camera is bounded to it so it can scroll horizontally and
   * stop at the stage ends (producing corners).
   */
  private buildStage(): void {
    const cam = this.cameras.main;
    const stage = getStageDefinition(this.config.stageId);
    const source = this.textures.get(stage.key).getSourceImage();
    const scale = cam.height / (source.height || stage.height);
    this.stageWorldWidth = (source.width || stage.width) * scale;
    this.maxScroll = Math.max(0, this.stageWorldWidth - cam.width);

    this.add.image(0, 0, stage.key).setOrigin(0, 0).setScale(scale).setDepth(0);
    cam.setBounds(0, 0, this.stageWorldWidth, cam.height);

    this.spawnStageAtmosphere(stage.id);
  }

  /** Adds lightweight ambient atmosphere tailored to the active stage. */
  private spawnStageAtmosphere(stageId: string): void {
    const cam = this.cameras.main;
    if (stageId === 'sakura-shrine') {
      this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          const petal = this.add
            .ellipse(Phaser.Math.Between(-40, cam.width + 40), -12, 10, 6, 0xf9a8d4, 0.85)
            .setScrollFactor(0)
            .setDepth(2)
            .setAngle(Phaser.Math.Between(0, 180));
          this.tweens.add({
            targets: petal,
            x: petal.x + Phaser.Math.Between(70, 180),
            y: cam.height + 20,
            angle: petal.angle + Phaser.Math.Between(120, 320),
            alpha: 0.25,
            duration: Phaser.Math.Between(3600, 5200),
            ease: 'Sine.InOut',
            onComplete: () => petal.destroy()
          });
        }
      });
    } else if (stageId === 'shibuya-night') {
      this.time.addEvent({
        delay: 65,
        loop: true,
        callback: () => {
          const drop = this.add
            .rectangle(Phaser.Math.Between(0, cam.width + 80), -20, 2, 22, 0x93c5fd, 0.28)
            .setScrollFactor(0)
            .setDepth(12)
            .setAngle(12);
          this.tweens.add({
            targets: drop,
            x: drop.x - 95,
            y: cam.height + 30,
            duration: 460,
            ease: 'Linear',
            onComplete: () => drop.destroy()
          });
        }
      });
    } else if (stageId === 'final-valley') {
      this.time.addEvent({
        delay: 380,
        loop: true,
        callback: () => {
          const mist = this.add
            .circle(
              cam.width * 0.45 + Phaser.Math.Between(-160, 160),
              cam.height * 0.78,
              Phaser.Math.Between(18, 36),
              0xe2e8f0,
              0.14
            )
            .setScrollFactor(0)
            .setDepth(2);
          this.tweens.add({
            targets: mist,
            y: mist.y - Phaser.Math.Between(50, 110),
            scale: 2.1,
            alpha: 0,
            duration: 2100,
            ease: 'Quad.Out',
            onComplete: () => mist.destroy()
          });
        }
      });
    } else if (stageId === 'martial-arena') {
      this.time.addEvent({
        delay: 420,
        loop: true,
        callback: () => {
          const mote = this.add
            .circle(
              Phaser.Math.Between(40, cam.width - 40),
              Phaser.Math.Between(160, Math.round(cam.height * 0.8)),
              Phaser.Math.Between(2, 4),
              0xfef08a,
              0.35
            )
            .setScrollFactor(0)
            .setDepth(2);
          this.tweens.add({
            targets: mote,
            x: mote.x + Phaser.Math.Between(-35, 35),
            y: mote.y - Phaser.Math.Between(25, 65),
            alpha: 0,
            duration: 2200,
            ease: 'Sine.Out',
            onComplete: () => mote.destroy()
          });
        }
      });
    }
  }

  /** Spawns P1 (left, facing right) and P2 (right, facing left). */
  private spawnFighters(): void {
    const cam = this.cameras.main;
    const groundY = Math.round(cam.height * GROUND_FRACTION);
    const minX = EDGE_MARGIN;
    const maxX = this.stageWorldWidth - EDGE_MARGIN;
    const center = this.stageWorldWidth / 2;
    this.spawnX1 = Math.round(center - cam.width * SPAWN_OFFSET_FRACTION);
    this.spawnX2 = Math.round(center + cam.width * SPAWN_OFFSET_FRACTION);

    this.p1 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p1CharacterId,
      x: this.spawnX1,
      groundY,
      facing: 1,
      minX,
      maxX,
      depth: DEPTH_FRONT,
      onSpecialStart: (fighter) => {
        const power = getSpecialPower(fighter.characterId);
        playSuperCutIn(this, {
          characterId: fighter.characterId,
          side: 'left',
          color: power.color,
          subtitle: power.jutsuName
        });
      }
    });

    this.p2 = new Fighter({
      scene: this,
      app: this.app,
      characterId: this.config.p2CharacterId,
      x: this.spawnX2,
      groundY,
      facing: -1,
      minX,
      maxX,
      depth: DEPTH_BACK,
      onSpecialStart: (fighter) => {
        const power = getSpecialPower(fighter.characterId);
        playSuperCutIn(this, {
          characterId: fighter.characterId,
          side: 'right',
          color: power.color,
          subtitle: power.jutsuName
        });
      }
    });
  }

  /**
   * Group-camera tracking: scrolls horizontally to keep both fighters framed
   * around their midpoint, clamped to the stage ends (so it stops at corners),
   * then turns the visible screen edges into movement walls for both fighters.
   * This is what produces the "camera locks until one fighter relents" feel —
   * neither fighter can walk off-screen, so they can only separate as far as the
   * screen is wide.
   * @param snap - When true, jumps to the target scroll instantly (round start)
   *   instead of easing toward it.
   */
  private updateCamera(snap: boolean): void {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const midpoint = (this.p1.x + this.p2.x) / 2;
    const targetScroll = Phaser.Math.Clamp(midpoint - viewWidth / 2, 0, this.maxScroll);
    const scrollX = snap ? targetScroll : Phaser.Math.Linear(cam.scrollX, targetScroll, CAMERA_LERP);

    cam.setScroll(scrollX, 0);

    const leftWall = scrollX + EDGE_MARGIN;
    const rightWall = scrollX + viewWidth - EDGE_MARGIN;
    this.p1.setHorizontalBounds(leftWall, rightWall);
    this.p2.setHorizontalBounds(leftWall, rightWall);
  }

  /** Registers the two keyboard control schemes plus the menu shortcut. */
  private registerKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('MatchScene requires keyboard input');
    }

    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.p1Keys = {
      left: keyboard.addKey(codes.A),
      right: keyboard.addKey(codes.D),
      crouch: keyboard.addKey(codes.S),
      block: keyboard.addKey(codes.C),
      jump: keyboard.addKey(codes.W),
      light: keyboard.addKey(codes.F),
      heavy: keyboard.addKey(codes.G),
      special: keyboard.addKey(codes.V)
    };

    this.p2Keys = {
      left: keyboard.addKey(codes.LEFT),
      right: keyboard.addKey(codes.RIGHT),
      crouch: keyboard.addKey(codes.DOWN),
      block: keyboard.addKey(codes.FORWARD_SLASH),
      jump: keyboard.addKey(codes.UP),
      light: keyboard.addKey(codes.COMMA),
      heavy: keyboard.addKey(codes.PERIOD),
      special: keyboard.addKey(codes.L)
    };

    keyboard.on('keydown-ESC', () => this.goToMenu());
    keyboard.on('keydown-BACKSPACE', () => this.goToMenu());
    keyboard.on('keydown-R', () => {
      if (this.phase === 'matchOver') {
        this.rematch();
      }
    });
  }

  /**
   * Reads a control scheme into a fighter input snapshot. Held keys map to held
   * inputs; jump/light/heavy use edge detection so they fire once per press.
   * @param keys - The player's resolved keys.
   */
  private readKeys(keys: PlayerKeys): FighterInput {
    return {
      left: keys.left.isDown,
      right: keys.right.isDown,
      crouch: keys.crouch.isDown,
      block: keys.block.isDown,
      jump: Phaser.Input.Keyboard.JustDown(keys.jump),
      light: Phaser.Input.Keyboard.JustDown(keys.light),
      heavy: Phaser.Input.Keyboard.JustDown(keys.heavy),
      special: Phaser.Input.Keyboard.JustDown(keys.special)
    };
  }

  /** Draws the control legend at the bottom of the screen. */
  private createControlsLegend(): void {
    const { centerX, height } = this.cameras.main;
    const p1 = 'P1: WASD • F light • G heavy • C block • V special';
    const p2 = this.config.mode === '1vcpu' ? 'P2: CPU' : 'P2: Arrows • , light • . heavy • / block • L special';

    this.add
      .text(centerX, height - 22, `${p1}      ${p2}      Esc Menu`, {
        color: '#cbd5f5',
        fontFamily: 'monospace',
        fontSize: '12px',
        backgroundColor: 'rgba(2, 6, 23, 0.6)',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);
  }

  /** Resets both fighters to their corners and runs the round intro. */
  private startRound(): void {
    this.phase = 'intro';
    this.hitstopTimer = 0;
    this.roundTimeMs = ROUND_SECONDS * 1000;
    this.cpu?.reset();

    const fullMin = EDGE_MARGIN;
    const fullMax = this.stageWorldWidth - EDGE_MARGIN;
    this.p1.setHorizontalBounds(fullMin, fullMax);
    this.p2.setHorizontalBounds(fullMin, fullMax);

    this.p1.resetForRound(this.spawnX1, 1);
    this.p2.resetForRound(this.spawnX2, -1);
    this.p1.setDepthBase(DEPTH_FRONT);
    this.p2.setDepthBase(DEPTH_BACK);
    this.updateCamera(true);
    this.hud.animateFill();
    this.hud.updateWins(this.p1Wins, this.p2Wins);

    this.showBanner(`ROUND ${this.roundNumber}`, '#f8fafc');

    this.time.delayedCall(900, () => {
      if (this.phase !== 'intro') {
        return;
      }

      this.showBanner('FIGHT!', '#facc15', 1.15);
      this.phase = 'fighting';
      this.p1.setFrozen(false);
      this.p2.setFrozen(false);

      this.time.delayedCall(650, () => this.hideBanner());
    });
  }

  /**
   * Concludes the current round, tallies the win, and either advances to the
   * next round or ends the match.
   * @param winner - Which player won (1 or 2).
   * @param bannerText - The banner to show (defaults to a knockout).
   * @param bannerColor - The banner colour.
   */
  private endRound(winner: 1 | 2, bannerText = 'K.O.', bannerColor = '#f43f5e'): void {
    if (this.phase !== 'fighting') {
      return;
    }

    this.phase = 'roundEnd';

    if (winner === 1) {
      this.p1Wins += 1;
    } else {
      this.p2Wins += 1;
    }

    const winnerName =
      winner === 1
        ? `P1 ${getCharacterDefinition(this.config.p1CharacterId).label}`
        : `${this.config.mode === '1vcpu' ? 'CPU' : 'P2'} ${getCharacterDefinition(this.config.p2CharacterId).label}`;
    this.showBanner(bannerText, bannerColor, 1.2);

    this.time.delayedCall(1100, () => {
      const matchOver = this.p1Wins >= ROUNDS_TO_WIN || this.p2Wins >= ROUNDS_TO_WIN;

      if (matchOver) {
        this.endMatch(winnerName);
      } else {
        this.roundNumber += 1;
        this.startRound();
      }
    });
  }

  /**
   * Shows the game-over overlay with the match winner and rematch / menu options.
   * @param winnerName - The display name of the match winner.
   */
  private endMatch(winnerName: string): void {
    this.phase = 'matchOver';
    this.hideBanner();

    const { centerX, centerY, width, height } = this.cameras.main;

    const dim = this.add
      .rectangle(centerX, centerY, width, height, 0x020617, 0.62)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const title = this.add
      .text(centerX, centerY - 90, `${winnerName}  WINS!`, {
        color: '#facc15',
        fontFamily: 'monospace',
        fontSize: '46px',
        stroke: '#020617',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const score = this.add
      .text(centerX, centerY - 30, `${this.p1Wins} - ${this.p2Wins}`, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '28px'
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const rematch = this.makeOverlayButton(centerX, centerY + 40, 'Rematch  (R)', () => this.rematch());
    const menu = this.makeOverlayButton(centerX, centerY + 96, 'Main Menu  (Esc)', () => this.goToMenu());

    this.overlay = [dim, title, score, rematch, menu];
  }

  /**
   * Builds a clickable overlay button with hover feedback.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param label - Button text.
   * @param onClick - Click handler.
   */
  private makeOverlayButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '22px',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: { x: 18, y: 10 }
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setColor('#facc15'));
    button.on('pointerout', () => button.setColor('#e2e8f0'));
    button.on('pointerdown', onClick);

    return button;
  }

  /** Restarts the match from round 1 with the same configuration. */
  private rematch(): void {
    this.overlay.forEach((object) => object.destroy());
    this.overlay = [];
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.cpu = this.config.mode === '1vcpu' ? new CpuController() : undefined;
    this.startRound();
  }

  /**
   * Shows the centre banner with a short pop-in tween.
   * @param text - The banner text.
   * @param color - The text colour.
   * @param peakScale - The scale to settle at (default 1).
   */
  private showBanner(text: string, color: string, peakScale = 1): void {
    this.banner.setText(text).setColor(color).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: peakScale, duration: 260, ease: 'Back.Out' });
  }

  /** Fades the centre banner out. */
  private hideBanner(): void {
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 300 });
  }
}

/**
 * Whether an input represents the fighter actively doing something (moving,
 * jumping, or attacking) this frame — used to decide who draws in front.
 * @param input - The fighter input snapshot to test.
 */
function isActing(input: FighterInput): boolean {
  return input.left || input.right || input.jump || input.light || input.heavy || input.special;
}

/**
 * Tactical CPU opponent that tracks spacing, guards incoming swings, chains
 * light->heavy combos, punishes openings, and fires its signature special
 * jutsu when in range.
 */
class CpuController {
  private nextDecisionAt = 0;
  private holdUntil = 0;
  private moveDir = 0;
  private holdBlock = false;
  private comboFollowupAt = 0;
  private nextBlockReactAt = 0;

  reset(): void {
    this.nextDecisionAt = 0;
    this.holdUntil = 0;
    this.moveDir = 0;
    this.holdBlock = false;
    this.comboFollowupAt = 0;
    this.nextBlockReactAt = 0;
  }

  /**
   * Produce the CPU's input for this frame.
   * @param timeMs - The current Phaser clock time in ms.
   * @param self - The CPU-controlled fighter.
   * @param target - The opponent fighter.
   */
  update(timeMs: number, self: Fighter, target: Fighter): FighterInput {
    const input: FighterInput = { ...NEUTRAL_FIGHTER_INPUT };
    const dx = target.x - self.x;
    const absDist = Math.abs(dx);
    const towardDir = dx >= 0 ? 1 : -1;

    // Execute queued combo heavy follow-up right after a light punch.
    if (this.comboFollowupAt > 0 && timeMs >= this.comboFollowupAt) {
      this.comboFollowupAt = 0;
      if (!self.isBusy && absDist < 135) {
        input.heavy = true;
        return input;
      }
    }

    // Reactive guard when the player threatens an attack nearby.
    const threatRange = target.isSpecialActive ? 290 : 135;
    if (
      !self.isBusy &&
      !this.holdBlock &&
      absDist <= threatRange &&
      (target.isAttacking || target.isSpecialActive) &&
      timeMs >= this.nextBlockReactAt
    ) {
      this.nextBlockReactAt = timeMs + 340;
      if (Math.random() < 0.62) {
        this.moveDir = 0;
        this.holdBlock = true;
        this.holdUntil = timeMs + Phaser.Math.Between(240, 380);
        this.nextDecisionAt = Math.max(this.nextDecisionAt, this.holdUntil - 40);
      }
    }

    if (timeMs >= this.nextDecisionAt) {
      this.decide(timeMs, input, self, target, absDist, towardDir);
      this.nextDecisionAt = timeMs + Phaser.Math.Between(170, 340);
    }

    if (timeMs < this.holdUntil) {
      if (this.moveDir < 0) {
        input.left = true;
      } else if (this.moveDir > 0) {
        input.right = true;
      }
      input.block = input.block || this.holdBlock;
    } else {
      this.moveDir = 0;
      this.holdBlock = false;
    }

    return input;
  }

  private decide(
    timeMs: number,
    input: FighterInput,
    self: Fighter,
    target: Fighter,
    absDist: number,
    towardDir: number
  ): void {
    if (self.isBusy) {
      return;
    }

    // Use signature special when meter is ready and opponent is in effective jutsu range.
    if (self.isMeterReady) {
      const power = getSpecialPower(self.characterId);
      const effectiveRange =
        power.kind === 'ranged' ? power.range - 20 : power.kind === 'aoe' ? power.range - 25 : 340;
      if (absDist <= effectiveRange && Math.random() < 0.45) {
        this.moveDir = 0;
        this.holdBlock = false;
        input.special = true;
        return;
      }
    }

    // Far away: aggressively close the distance (with occasional jump-ins).
    if (absDist > 160) {
      this.holdBlock = false;
      this.moveDir = towardDir;
      this.holdUntil = timeMs + Phaser.Math.Between(220, 420);
      if (Math.random() < 0.14) {
        input.jump = true;
      }
      return;
    }

    // Mid-range footsies: step in to pressure or throw a long poke.
    if (absDist > 108) {
      const roll = Math.random();
      if (roll < 0.56) {
        this.holdBlock = false;
        this.moveDir = towardDir;
        this.holdUntil = timeMs + Phaser.Math.Between(180, 300);
      } else if (roll < 0.78) {
        input.heavy = true;
      } else if (roll < 0.9) {
        this.holdBlock = false;
        this.moveDir = towardDir;
        this.holdUntil = timeMs + 260;
        input.jump = true;
      } else {
        this.moveDir = -towardDir;
        this.holdBlock = false;
        this.holdUntil = timeMs + 180;
      }
      return;
    }

    // Close combat: pressure with fast light->heavy combos, kicks, and occasional guard/spacing.
    const roll = Math.random();
    if (target.isAttacking && roll < 0.55) {
      this.moveDir = 0;
      this.holdBlock = true;
      this.holdUntil = timeMs + Phaser.Math.Between(220, 340);
      return;
    }

    if (roll < 0.42) {
      input.light = true;
      if (Math.random() < 0.65) {
        this.comboFollowupAt = timeMs + Phaser.Math.Between(190, 250);
      }
      return;
    }

    if (roll < 0.72) {
      input.heavy = true;
      return;
    }

    if (roll < 0.84) {
      this.moveDir = 0;
      this.holdBlock = true;
      this.holdUntil = timeMs + Phaser.Math.Between(180, 280);
      return;
    }

    if (roll < 0.93) {
      this.moveDir = -towardDir;
      this.holdBlock = false;
      this.holdUntil = timeMs + 190;
      return;
    }

    this.moveDir = towardDir;
    this.holdBlock = false;
    this.holdUntil = timeMs + 220;
    input.jump = true;
  }
}
