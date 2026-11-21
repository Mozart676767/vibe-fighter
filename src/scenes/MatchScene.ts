import * as Phaser from 'phaser';

import { Fighter, NEUTRAL_FIGHTER_INPUT, type FighterInput } from '../game/fighter';
import { getCharacterDefinition } from '../game/hero';
import { playKoOverlay, type KoOverlayHandle } from '../game/koOverlay';
import { MatchHud } from '../game/matchHud';
import { getSpecialPower } from '../game/specialPowers';
import { getStageDefinition } from '../game/stageConfig';
import { playSfx, startMusic, stopMusic } from '../game/soundEffects';
import { playSuperCutIn } from '../game/superCutIn';
import { SCENE_KEYS, type MatchConfig } from '../game/types';
import { type CharacterVictoryProfile } from '../game/victoryAnimations';
import { spawnHitSpark, spawnSpecialImpactFx, VFX_HEX, type VfxColor } from '../game/vfx';
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
  private p1Ally?: Fighter;
  private p2Ally?: Fighter;
  private team1: Fighter[] = [];
  private team2: Fighter[] = [];
  private p1ActiveIndex = 0;
  private p2ActiveIndex = 0;

  private p1Keys!: PlayerKeys;
  private p2Keys!: PlayerKeys;
  private p1SwitchKey?: Phaser.Input.Keyboard.Key;
  private p2SwitchKey?: Phaser.Input.Keyboard.Key;
  private cpu?: CpuController;
  private p1AllyCpu?: CpuController;
  private p2AllyCpu?: CpuController;
  private p1TagBadge?: Phaser.GameObjects.Text;
  private p2TagBadge?: Phaser.GameObjects.Text;
  private downedFighters = new Set<Fighter>();

  private phase: MatchPhase = 'intro';
  private roundNumber = 1;
  private p1Wins = 0;
  private p2Wins = 0;

  private spawnX1 = 0;
  private spawnX2 = 0;
  private spawnX1Ally = 0;
  private spawnX2Ally = 0;

  private stageWorldWidth = 0;
  private maxScroll = 0;

  private hud!: MatchHud;
  private banner!: Phaser.GameObjects.Text;
  private roundTimeMs = ROUND_SECONDS * 1000;
  private lastTimerSecond = ROUND_SECONDS;
  private hitstopTimer = 0;
  private matchWinner: 1 | 2 | null = null;
  private koOverlay?: KoOverlayHandle;
  private victoryTimers: Phaser.Time.TimerEvent[] = [];
  private victoryBanner: Phaser.GameObjects.GameObject[] = [];
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
    this.p1AllyCpu = undefined;
    this.p2AllyCpu = undefined;
    this.p1Ally = undefined;
    this.p2Ally = undefined;
    this.team1 = [];
    this.team2 = [];
    this.p1ActiveIndex = 0;
    this.p2ActiveIndex = 0;
    this.downedFighters.clear();
    this.phase = 'intro';
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.hitstopTimer = 0;
    this.matchWinner = null;
    this.koOverlay = undefined;
    this.victoryTimers = [];
    this.victoryBanner = [];
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
      p1AllyCharacterId: this.config.p1AllyCharacterId,
      p2AllyCharacterId: this.config.p2AllyCharacterId,
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

    if (this.isP2Cpu()) {
      this.cpu = new CpuController();
    }
    if (this.config.mode === '2v2') {
      this.p1AllyCpu = new CpuController();
      this.p2AllyCpu = new CpuController();
      this.createActiveBadges();
    }

    startMusic('battle', this.app.settingsStore);
    this.startRound();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopMusic();
      this.clearEndSequence();
      this.p1TagBadge?.destroy();
      this.p2TagBadge?.destroy();
      this.p1TagBadge = undefined;
      this.p2TagBadge = undefined;
      this.team1.forEach((f) => f.destroy());
      this.team2.forEach((f) => f.destroy());
      this.hud?.destroy();
    });
  }

  private isP2Cpu(): boolean {
    return this.config.mode === '1vcpu' || (this.config.mode === '2v2' && this.config.p2IsCpu !== false);
  }

  private createActiveBadges(): void {
    this.p1TagBadge = this.add
      .text(0, 0, 'P1', {
        color: '#020617',
        backgroundColor: '#38bdf8',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        padding: { x: 5, y: 2 }
      })
      .setOrigin(0.5)
      .setDepth(DEPTH_FRONT + 20);

    if (!this.isP2Cpu()) {
      this.p2TagBadge = this.add
        .text(0, 0, 'P2', {
          color: '#020617',
          backgroundColor: '#f43f5e',
          fontFamily: 'monospace',
          fontSize: '12px',
          fontStyle: 'bold',
          padding: { x: 5, y: 2 }
        })
        .setOrigin(0.5)
        .setDepth(DEPTH_FRONT + 20);
    }
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

    if (fighting && this.config.mode === '2v2') {
      if (this.p1SwitchKey && Phaser.Input.Keyboard.JustDown(this.p1SwitchKey)) {
        const next = 1 - this.p1ActiveIndex;
        if (this.team1[next] && !this.team1[next].isDefeated) {
          this.p1ActiveIndex = next;
        }
      }
      if (!this.isP2Cpu() && this.p2SwitchKey && Phaser.Input.Keyboard.JustDown(this.p2SwitchKey)) {
        const next = 1 - this.p2ActiveIndex;
        if (this.team2[next] && !this.team2[next].isDefeated) {
          this.p2ActiveIndex = next;
        }
      }
      if (this.team1[this.p1ActiveIndex]?.isDefeated) {
        const aliveIdx = this.team1.findIndex((f) => !f.isDefeated);
        if (aliveIdx !== -1) {
          this.p1ActiveIndex = aliveIdx;
        }
      }
      if (!this.isP2Cpu() && this.team2[this.p2ActiveIndex]?.isDefeated) {
        const aliveIdx = this.team2.findIndex((f) => !f.isDefeated);
        if (aliveIdx !== -1) {
          this.p2ActiveIndex = aliveIdx;
        }
      }
    }

    const humanP1Input = fighting ? this.readKeys(this.p1Keys) : { ...NEUTRAL_FIGHTER_INPUT };
    const humanP2Input = fighting && !this.isP2Cpu() ? this.readKeys(this.p2Keys) : { ...NEUTRAL_FIGHTER_INPUT };

    const team1Inputs: FighterInput[] = this.team1.map((fighter, idx) => {
      if (!fighting || fighter.isDefeated) {
        return { ...NEUTRAL_FIGHTER_INPUT };
      }
      if (idx === this.p1ActiveIndex) {
        return { ...humanP1Input, crouch: false };
      }
      const target = this.nearestLiving(fighter, this.team2);
      const aiInput = this.p1AllyCpu ? this.p1AllyCpu.update(time, fighter, target) : { ...NEUTRAL_FIGHTER_INPUT };
      aiInput.crouch = false;
      return aiInput;
    });

    const team2Inputs: FighterInput[] = this.team2.map((fighter, idx) => {
      if (!fighting || fighter.isDefeated) {
        return { ...NEUTRAL_FIGHTER_INPUT };
      }
      if (!this.isP2Cpu() && idx === this.p2ActiveIndex) {
        return { ...humanP2Input, crouch: false };
      }
      const ctrl = idx === 0 && this.cpu ? this.cpu : this.p2AllyCpu;
      const target = this.nearestLiving(fighter, this.team1);
      const aiInput = ctrl ? ctrl.update(time, fighter, target) : { ...NEUTRAL_FIGHTER_INPUT };
      aiInput.crouch = false;
      return aiInput;
    });

    this.team1.forEach((fighter, idx) => {
      if (!fighter.isDefeated) {
        fighter.faceToward(this.nearestLiving(fighter, this.team2).x);
      }
      if (fighting) {
        fighter.setDepthBase(fighter.isDefeated ? DEPTH_BACK - 1 : isActing(team1Inputs[idx]) ? DEPTH_FRONT : DEPTH_BACK);
      }
      fighter.update(seconds, team1Inputs[idx]);
    });

    this.team2.forEach((fighter, idx) => {
      if (!fighter.isDefeated) {
        fighter.faceToward(this.nearestLiving(fighter, this.team1).x);
      }
      if (fighting) {
        fighter.setDepthBase(fighter.isDefeated ? DEPTH_BACK - 1 : isActing(team2Inputs[idx]) ? DEPTH_FRONT : DEPTH_BACK);
      }
      fighter.update(seconds, team2Inputs[idx]);
    });

    this.updateActiveBadges();
    this.updateCamera(false);

    if (fighting) {
      this.resolveCombat();
      this.checkForKnockout();

      if (this.phase === 'fighting') {
        this.tickRoundTimer(delta);
        this.hud.applyHealth(this.p1.health01, this.p2.health01);
        if (this.config.mode === '2v2') {
          this.hud.applyPartnerHealth(this.p1Ally?.health01 ?? 0, this.p2Ally?.health01 ?? 0);
        }
      }
    }

    this.hud.setMeter(this.p1.meter01, this.p2.meter01);
    if (this.config.mode === '2v2') {
      this.hud.setPartnerMeter(this.p1Ally?.meter01 ?? 0, this.p2Ally?.meter01 ?? 0);
    }
    this.hud.setTime(Math.ceil(this.roundTimeMs / 1000));
    this.hud.updateWins(this.p1Wins, this.p2Wins);
  }

  private nearestLiving(self: Fighter, opponents: Fighter[]): Fighter {
    const living = opponents.filter((f) => !f.isDefeated);
    const pool = living.length > 0 ? living : opponents;
    let best = pool[0];
    let bestDist = Math.abs(best.x - self.x);
    for (let i = 1; i < pool.length; i += 1) {
      const dist = Math.abs(pool[i].x - self.x);
      if (dist < bestDist) {
        best = pool[i];
        bestDist = dist;
      }
    }
    return best;
  }

  private updateActiveBadges(): void {
    const groundY = Math.round(this.cameras.main.height * GROUND_FRACTION);
    if (this.p1TagBadge) {
      const f1 = this.team1[this.p1ActiveIndex];
      const show = Boolean(f1 && !f1.isDefeated && this.phase === 'fighting');
      this.p1TagBadge.setVisible(show);
      if (show && f1) {
        this.p1TagBadge.setPosition(f1.x, groundY - 258);
      }
    }
    if (this.p2TagBadge) {
      const f2 = this.team2[this.p2ActiveIndex];
      const show = Boolean(f2 && !f2.isDefeated && this.phase === 'fighting');
      this.p2TagBadge.setVisible(show);
      if (show && f2) {
        this.p2TagBadge.setPosition(f2.x, groundY - 258);
      }
    }
  }

  /**
   * Checks both directions for connecting hits across teams and applies
   * damage/block this frame.
   */
  private resolveCombat(): void {
    for (const a of this.team1) {
      if (a.isDefeated) {
        continue;
      }
      for (const b of this.team2) {
        if (!b.isDefeated) {
          this.tryHit(a, b);
          this.tryHit(b, a);
        }
      }
    }
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

    const settings = this.app.settingsStore.getState();
    if (blocked) {
      playSfx('block', settings);
    } else if (finisher || attack.profile.kind === 'low' || isSpecial) {
      playSfx('hit-heavy', settings);
    } else {
      playSfx('hit-light', settings);
    }

    if (finisher) {
      this.hitstopTimer = 0.085;
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
    const sparkScale = finisher ? 1.85 : isSpecial ? 1.35 : 0.9;
    spawnHitSpark(this, sparkX, sparkY, color, sparkScale);

    if (isSpecial && !blocked) {
      spawnSpecialImpactFx(this, sparkX, sparkY, specialColor, finisher);
    }

    if (finisher) {
      this.cameras.main.shake(260, 0.015);
      const cam = this.cameras.main;
      const flash = this.add
        .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, VFX_HEX[specialColor], 0.24)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(BANNER_DEPTH - 5);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 150,
        ease: 'Quad.Out',
        onComplete: () => flash.destroy()
      });
    } else if (isSpecial) {
      this.cameras.main.shake(blocked ? 80 : 115, blocked ? 0.004 : 0.007);
    } else {
      this.cameras.main.shake(blocked ? 60 : 120, blocked ? 0.003 : 0.006);
    }
  }

  /** Ends the round when all fighters on either team are knocked out. */
  private checkForKnockout(): void {
    const team1Down = this.team1.every((f) => f.isDefeated);
    const team2Down = this.team2.every((f) => f.isDefeated);

    if (team1Down) {
      this.endRound(2);
      return;
    }
    if (team2Down) {
      this.endRound(1);
      return;
    }

    // In 2v2, notify on first teammate knockout without ending the round yet
    const allFighters = [...this.team1, ...this.team2];
    for (const fighter of allFighters) {
      if (fighter.isDefeated && !this.downedFighters.has(fighter)) {
        this.downedFighters.add(fighter);
        this.hitstopTimer = 0.06;
        this.cameras.main.shake(180, 0.01);
        playSfx('ko', this.app.settingsStore.getState());
        this.showBanner(`${fighter.label.toUpperCase()} DOWN!`, '#facc15', 0.8);
        this.time.delayedCall(750, () => {
          if (this.phase === 'fighting') {
            this.hideBanner();
          }
        });
      }
    }
  }

  /**
   * Counts the round clock down while fighting. When it reaches zero the round
   * is decided on remaining health (a tie replays the round as a draw).
   * @param delta - Milliseconds since the previous frame.
   */
  private tickRoundTimer(delta: number): void {
    this.roundTimeMs = Math.max(0, this.roundTimeMs - delta);
    const wholeSecond = Math.ceil(this.roundTimeMs / 1000);
    if (wholeSecond !== this.lastTimerSecond) {
      this.lastTimerSecond = wholeSecond;
      if (wholeSecond > 0 && wholeSecond <= 10) {
        playSfx('timer-tick', this.app.settingsStore.getState());
      }
    }

    if (this.roundTimeMs <= 0) {
      this.resolveTimeOut();
    }
  }

  /** Decides a timed-out round by comparing average remaining team health. */
  private resolveTimeOut(): void {
    const avgHealth = (team: Fighter[]): number =>
      team.reduce((sum, f) => sum + (f.isDefeated ? 0 : f.health01), 0) / Math.max(1, team.length);

    const p1 = avgHealth(this.team1);
    const p2 = avgHealth(this.team2);

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
    } else if (stageId === 'planet-namek') {
      this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          const isCyan = Math.random() < 0.45;
          const spark = this.add
            .circle(
              Phaser.Math.Between(40, cam.width - 40),
              Phaser.Math.Between(Math.round(cam.height * 0.35), Math.round(cam.height * 0.88)),
              Phaser.Math.Between(2, 5),
              isCyan ? 0x22d3ee : 0x4ade80,
              0.55
            )
            .setScrollFactor(0)
            .setDepth(2)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: spark,
            x: spark.x + Phaser.Math.Between(-25, 25),
            y: spark.y - Phaser.Math.Between(60, 140),
            scale: 0.3,
            alpha: 0,
            duration: Phaser.Math.Between(1600, 2600),
            ease: 'Sine.Out',
            onComplete: () => spark.destroy()
          });
        }
      });
    } else if (stageId === 'crimson-eclipse') {
      this.time.addEvent({
        delay: 190,
        loop: true,
        callback: () => {
          const ember = this.add
            .circle(
              Phaser.Math.Between(30, cam.width - 30),
              cam.height + 8,
              Phaser.Math.Between(2, 4),
              Math.random() < 0.3 ? 0xfca5a5 : 0xef4444,
              0.65
            )
            .setScrollFactor(0)
            .setDepth(2)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: ember,
            x: ember.x + Phaser.Math.Between(-50, 50),
            y: Phaser.Math.Between(120, Math.round(cam.height * 0.5)),
            alpha: 0,
            scale: 0.4,
            duration: Phaser.Math.Between(2200, 3400),
            ease: 'Quad.Out',
            onComplete: () => ember.destroy()
          });
        }
      });
    } else if (stageId === 'frost-citadel') {
      this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const flake = this.add
            .circle(
              Phaser.Math.Between(-20, cam.width + 20),
              -10,
              Phaser.Math.Between(2, 4),
              Math.random() < 0.25 ? 0xa5f3fc : 0xf8fafc,
              Phaser.Math.FloatBetween(0.45, 0.85)
            )
            .setScrollFactor(0)
            .setDepth(12);
          this.tweens.add({
            targets: flake,
            x: flake.x + Phaser.Math.Between(-80, 60),
            y: cam.height + 16,
            alpha: 0.15,
            duration: Phaser.Math.Between(3200, 5200),
            ease: 'Sine.InOut',
            onComplete: () => flake.destroy()
          });
        }
      });
    }
  }

  /** Spawns Team 1 (left, facing right) and Team 2 (right, facing left). */
  private spawnFighters(): void {
    const cam = this.cameras.main;
    const groundY = Math.round(cam.height * GROUND_FRACTION);
    const minX = EDGE_MARGIN;
    const maxX = this.stageWorldWidth - EDGE_MARGIN;
    const center = this.stageWorldWidth / 2;
    this.spawnX1 = Math.round(center - cam.width * SPAWN_OFFSET_FRACTION);
    this.spawnX2 = Math.round(center + cam.width * SPAWN_OFFSET_FRACTION);
    this.spawnX1Ally = Math.max(minX, this.spawnX1 - 125);
    this.spawnX2Ally = Math.min(maxX, this.spawnX2 + 125);

    const makeCutInHandler = (side: 'left' | 'right') => (fighter: Fighter): void => {
      const power = getSpecialPower(fighter.characterId);
      playSuperCutIn(this, {
        characterId: fighter.characterId,
        side,
        color: power.color,
        subtitle: power.jutsuName
      });
    };

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
      onSpecialStart: makeCutInHandler('left')
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
      onSpecialStart: makeCutInHandler('right')
    });

    this.team1 = [this.p1];
    this.team2 = [this.p2];

    if (this.config.mode === '2v2') {
      this.p1Ally = new Fighter({
        scene: this,
        app: this.app,
        characterId: this.config.p1AllyCharacterId || this.config.p1CharacterId,
        x: this.spawnX1Ally,
        groundY,
        facing: 1,
        minX,
        maxX,
        depth: DEPTH_BACK,
        onSpecialStart: makeCutInHandler('left')
      });

      this.p2Ally = new Fighter({
        scene: this,
        app: this.app,
        characterId: this.config.p2AllyCharacterId || this.config.p2CharacterId,
        x: this.spawnX2Ally,
        groundY,
        facing: -1,
        minX,
        maxX,
        depth: DEPTH_BACK,
        onSpecialStart: makeCutInHandler('right')
      });

      this.team1.push(this.p1Ally);
      this.team2.push(this.p2Ally);
    }
  }

  /**
   * Group-camera tracking across all active fighters, keeping them framed and
   * enforcing visible screen-edge walls.
   */
  private updateCamera(snap: boolean): void {
    const cam = this.cameras.main;
    const viewWidth = cam.width;
    const allFighters = [...this.team1, ...this.team2];
    const living = allFighters.filter((f) => !f.isDefeated);
    const active = living.length > 0 ? living : allFighters;

    const minFx = Math.min(...active.map((f) => f.x));
    const maxFx = Math.max(...active.map((f) => f.x));
    const midpoint = (minFx + maxFx) / 2;

    const focusTeam = this.matchWinner === 1 ? this.team1 : this.matchWinner === 2 ? this.team2 : null;
    const focusAlive = focusTeam?.find((f) => !f.isDefeated) ?? focusTeam?.[0];
    const focusX = focusAlive ? Phaser.Math.Linear(midpoint, focusAlive.x, 0.72) : midpoint;

    const targetScroll = Phaser.Math.Clamp(focusX - viewWidth / 2, 0, this.maxScroll);
    const scrollX = snap ? targetScroll : Phaser.Math.Linear(cam.scrollX, targetScroll, CAMERA_LERP);

    cam.setScroll(scrollX, 0);

    const leftWall = scrollX + EDGE_MARGIN;
    const rightWall = scrollX + viewWidth - EDGE_MARGIN;
    allFighters.forEach((f) => f.setHorizontalBounds(leftWall, rightWall));
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

    this.p1SwitchKey = keyboard.addKey(codes.Q);
    this.p2SwitchKey = keyboard.addKey(codes.O);

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
    const switchHintP1 = this.config.mode === '2v2' ? ' • Q switch' : '';
    const switchHintP2 = this.config.mode === '2v2' ? ' • O switch' : '';
    const p1 = `P1: WASD • F light • G heavy • C block • V special${switchHintP1}`;
    const p2 = this.isP2Cpu()
      ? this.config.mode === '2v2'
        ? 'Team 2: CPU Duo'
        : 'P2: CPU'
      : `P2: Arrows • , light • . heavy • / block • L special${switchHintP2}`;

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

  /** Resets all fighters to their corners and runs the round intro. */
  private startRound(): void {
    this.phase = 'intro';
    this.hitstopTimer = 0;
    this.roundTimeMs = ROUND_SECONDS * 1000;
    this.lastTimerSecond = ROUND_SECONDS;
    this.p1ActiveIndex = 0;
    this.p2ActiveIndex = 0;
    this.downedFighters.clear();
    this.cpu?.reset();
    this.p1AllyCpu?.reset();
    this.p2AllyCpu?.reset();

    const fullMin = EDGE_MARGIN;
    const fullMax = this.stageWorldWidth - EDGE_MARGIN;
    const allFighters = [...this.team1, ...this.team2];
    allFighters.forEach((f) => f.setHorizontalBounds(fullMin, fullMax));

    this.p1.resetForRound(this.spawnX1, 1);
    this.p2.resetForRound(this.spawnX2, -1);
    this.p1Ally?.resetForRound(this.spawnX1Ally, 1);
    this.p2Ally?.resetForRound(this.spawnX2Ally, -1);

    this.p1.setDepthBase(DEPTH_FRONT);
    this.p2.setDepthBase(DEPTH_BACK);
    this.p1Ally?.setDepthBase(DEPTH_BACK);
    this.p2Ally?.setDepthBase(DEPTH_BACK);
    this.updateCamera(true);
    this.hud.animateFill();
    this.hud.updateWins(this.p1Wins, this.p2Wins);

    this.showBanner(`ROUND ${this.roundNumber}`, '#f8fafc');
    playSfx('round-announce', this.app.settingsStore.getState());

    this.time.delayedCall(900, () => {
      if (this.phase !== 'intro') {
        return;
      }

      this.showBanner('FIGHT!', '#facc15', 1.15);
      playSfx('fight-start', this.app.settingsStore.getState());
      this.phase = 'fighting';
      allFighters.forEach((f) => f.setFrozen(false));

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
      this.config.mode === '2v2'
        ? winner === 1
          ? `TEAM 1 (${getCharacterDefinition(this.config.p1CharacterId).label} & ${getCharacterDefinition(this.config.p1AllyCharacterId || this.config.p1CharacterId).label})`
          : `${this.isP2Cpu() ? 'CPU TEAM' : 'TEAM 2'} (${getCharacterDefinition(this.config.p2CharacterId).label} & ${getCharacterDefinition(this.config.p2AllyCharacterId || this.config.p2CharacterId).label})`
        : winner === 1
          ? `P1 ${getCharacterDefinition(this.config.p1CharacterId).label}`
          : `${this.isP2Cpu() ? 'CPU' : 'P2'} ${getCharacterDefinition(this.config.p2CharacterId).label}`;

    const isKo = bannerText === 'K.O.';
    const roundPauseMs = isKo ? 1350 : 1100;

    if (isKo) {
      this.hitstopTimer = 0.11;
      this.koOverlay?.destroy();
      this.koOverlay = playKoOverlay(this, { depth: BANNER_DEPTH, durationMs: roundPauseMs });
      playSfx('ko', this.app.settingsStore.getState());
    } else {
      this.cameras.main.shake(220, 0.008);
      this.showBanner(bannerText, bannerColor, 1.2);
      playSfx('round-announce', this.app.settingsStore.getState());
    }

    this.victoryTimers.push(
      this.time.delayedCall(roundPauseMs, () => {
        const matchOver = this.p1Wins >= ROUNDS_TO_WIN || this.p2Wins >= ROUNDS_TO_WIN;

        if (matchOver) {
          this.startVictorySequence(winner, winnerName);
        } else {
          this.roundNumber += 1;
          this.startRound();
        }
      })
    );
  }

  /**
   * Triggers the match winner's distinct victory animation and signature quote
   * showcase on stage before displaying the final rematch/menu overlay.
   */
  private startVictorySequence(winner: 1 | 2, winnerName: string): void {
    this.matchWinner = winner;
    this.hideBanner();
    this.koOverlay?.destroy();
    this.koOverlay = undefined;

    stopMusic();
    playSfx('victory', this.app.settingsStore.getState());

    const winningTeam = winner === 1 ? this.team1 : this.team2;
    const livingWinners = winningTeam.filter((f) => !f.isDefeated);
    const showcaseFighters = livingWinners.length > 0 ? livingWinners : [winningTeam[0]];
    const profile = showcaseFighters[0].playVictory();
    for (let i = 1; i < showcaseFighters.length; i += 1) {
      showcaseFighters[i].playVictory();
    }
    this.showVictoryCallout(winnerName, profile);

    this.victoryTimers.push(
      this.time.delayedCall(1650, () => {
        this.endMatch(winnerName, profile);
      })
    );
  }

  /**
   * Displays a non-blocking victory title and character quote banner while the
   * winner performs their signature victory animation in the arena.
   */
  private showVictoryCallout(winnerName: string, profile: CharacterVictoryProfile): void {
    this.clearVictoryBanner();
    const { centerX } = this.cameras.main;
    const accentColor = VFX_HEX[profile.color];
    const accentCss = `#${accentColor.toString(16).padStart(6, '0')}`;

    const plate = this.add
      .rectangle(centerX, 198, 760, 86, 0x020617, 0.84)
      .setStrokeStyle(2, accentColor, 0.92)
      .setScrollFactor(0)
      .setDepth(BANNER_DEPTH)
      .setAlpha(0);

    const title = this.add
      .text(centerX, 180, `${winnerName.toUpperCase()}  •  ${profile.title}`, {
        color: accentCss,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: this.config.mode === '2v2' ? '16px' : '20px',
        stroke: '#020617',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(BANNER_DEPTH + 1)
      .setAlpha(0);

    const quote = this.add
      .text(centerX, 214, `"${profile.quote}"`, {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '16px',
        stroke: '#020617',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(BANNER_DEPTH + 1)
      .setAlpha(0);

    this.tweens.add({
      targets: [plate, title, quote],
      alpha: 1,
      duration: 240,
      ease: 'Quad.Out'
    });

    this.victoryBanner = [plate, title, quote];
  }

  /**
   * Shows the game-over overlay with the match winner and rematch / menu options.
   * @param winnerName - The display name of the match winner.
   * @param profile - The winning character's victory profile.
   */
  private endMatch(winnerName: string, profile: CharacterVictoryProfile): void {
    this.phase = 'matchOver';
    this.hideBanner();
    this.clearVictoryBanner();

    const { centerX, centerY, width, height } = this.cameras.main;
    const accentCss = `#${VFX_HEX[profile.color].toString(16).padStart(6, '0')}`;

    const dim = this.add
      .rectangle(centerX, centerY, width, height, 0x020617, 0.48)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const title = this.add
      .text(centerX, centerY - 110, `${winnerName}  WINS!`, {
        color: '#facc15',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: this.config.mode === '2v2' ? '34px' : '46px',
        stroke: '#020617',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const quoteText = this.add
      .text(centerX, centerY - 62, `"${profile.quote}"`, {
        color: accentCss,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: '18px',
        stroke: '#020617',
        strokeThickness: 4,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const score = this.add
      .text(centerX, centerY - 22, `${this.p1Wins} - ${this.p2Wins}`, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '28px'
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0);

    const rematch = this.makeOverlayButton(centerX, centerY + 44, 'Rematch  (R)', () => this.rematch());
    const menu = this.makeOverlayButton(centerX, centerY + 100, 'Main Menu  (Esc)', () => this.goToMenu());

    this.overlay = [dim, title, quoteText, score, rematch, menu];
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
    this.clearEndSequence();
    this.overlay.forEach((object) => object.destroy());
    this.overlay = [];
    this.matchWinner = null;
    this.roundNumber = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.cpu = this.isP2Cpu() ? new CpuController() : undefined;
    this.p1AllyCpu = this.config.mode === '2v2' ? new CpuController() : undefined;
    this.p2AllyCpu = this.config.mode === '2v2' ? new CpuController() : undefined;
    startMusic('battle', this.app.settingsStore);
    this.startRound();
  }

  private clearVictoryBanner(): void {
    this.victoryBanner.forEach((object) => object.destroy());
    this.victoryBanner = [];
  }

  private clearEndSequence(): void {
    this.victoryTimers.forEach((timer) => timer.remove(false));
    this.victoryTimers = [];
    this.koOverlay?.destroy();
    this.koOverlay = undefined;
    this.clearVictoryBanner();
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
 * Hard tactical CPU opponent that reacts rapidly to incoming attacks & specials,
 * jumps over ranged supers, hit-confirms light->heavy->special combos, whiffs
 * punishes openings, anti-airs jump-ins, and mixes up blocking defenders.
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

    // Release pointless guard early if the opponent stepped back out of range.
    if (this.holdBlock && !target.isAttacking && !target.isSpecialActive && absDist > 160) {
      this.holdBlock = false;
      this.holdUntil = 0;
    }

    // Execute queued hit-confirm follow-up right after a light punch or whiff-punish dash.
    if (this.comboFollowupAt > 0 && timeMs >= this.comboFollowupAt) {
      this.comboFollowupAt = 0;
      if (!self.isBusy && absDist < 145) {
        if (self.isMeterReady && !target.isBlocking && Math.random() < 0.88) {
          this.moveDir = 0;
          this.holdBlock = false;
          input.special = true;
          return input;
        }
        if (target.isBlocking && Math.random() < 0.45) {
          this.moveDir = towardDir;
          this.holdBlock = false;
          this.holdUntil = timeMs + 220;
          input.jump = true;
          return input;
        }
        input.heavy = true;
        return input;
      }
    }

    // Fast reactive defense against incoming normals & signature specials.
    const threatRange = target.isSpecialActive ? 500 : 148;
    if (
      !self.isBusy &&
      !this.holdBlock &&
      absDist <= threatRange &&
      (target.isAttacking || target.isSpecialActive) &&
      timeMs >= this.nextBlockReactAt
    ) {
      this.nextBlockReactAt = timeMs + 135;

      if (target.isSpecialActive && absDist >= 175 && absDist <= 440 && Math.random() < 0.36) {
        this.moveDir = towardDir;
        this.holdBlock = false;
        this.holdUntil = timeMs + 260;
        input.jump = true;
        return input;
      }

      const guardChance = target.isSpecialActive ? 0.9 : 0.82;
      if (Math.random() < guardChance) {
        this.moveDir = 0;
        this.holdBlock = true;
        this.holdUntil = timeMs + (target.isSpecialActive ? Phaser.Math.Between(300, 440) : Phaser.Math.Between(210, 320));
        this.nextDecisionAt = Math.max(this.nextDecisionAt, this.holdUntil - 30);
      }
    }

    if (timeMs >= this.nextDecisionAt) {
      this.decide(timeMs, input, self, target, absDist, towardDir);
      const clutchBonus = self.health01 < 0.4 ? 15 : 0;
      this.nextDecisionAt = timeMs + Phaser.Math.Between(Math.max(50, 70 - clutchBonus), 135 - clutchBonus);
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

    // Fire signature special cleanly when meter is ready and opponent is open (or Saitama breaks guard).
    if (self.isMeterReady) {
      const power = getSpecialPower(self.characterId);
      const effectiveRange =
        power.kind === 'ranged'
          ? power.range - 15
          : power.kind === 'aoe'
            ? power.range - 15
            : power.range + 65;
      const canBreakOrOpen = !target.isBlocking || self.characterId === 'saitama';
      if (absDist <= effectiveRange && canBreakOrOpen && Math.random() < 0.9) {
        this.moveDir = 0;
        this.holdBlock = false;
        input.special = true;
        return;
      }
    }

    // Anti-air or punish jumping opponent nearby.
    if (!target.isGrounded && absDist < 165) {
      if (target.isAttacking && Math.random() < 0.65) {
        this.moveDir = 0;
        this.holdBlock = true;
        this.holdUntil = timeMs + 220;
        return;
      }
      if (absDist < 135) {
        input.light = true;
        this.comboFollowupAt = timeMs + 165;
        return;
      }
    }

    // Whiff punish: if player swings and misses outside immediate close range, step in & counter!
    if (target.isAttacking && absDist > 125 && absDist <= 190) {
      this.holdBlock = false;
      this.moveDir = towardDir;
      this.holdUntil = timeMs + 145;
      this.comboFollowupAt = timeMs + 125;
      return;
    }

    // Far away: aggressively close the distance (with dynamic jump-in approaches).
    if (absDist > 165) {
      this.holdBlock = false;
      this.moveDir = towardDir;
      this.holdUntil = timeMs + Phaser.Math.Between(160, 300);
      if (absDist <= 280 && Math.random() < 0.22) {
        input.jump = true;
      }
      return;
    }

    // Mid-range footsies: pressure forward, punish stunned targets, or throw heavy pokes.
    if (absDist > 105) {
      if (target.isInHitstun) {
        this.holdBlock = false;
        this.moveDir = towardDir;
        this.holdUntil = timeMs + 120;
        if (absDist < 135) {
          input.heavy = true;
        }
        return;
      }

      const roll = Math.random();
      if (roll < 0.58) {
        this.holdBlock = false;
        this.moveDir = towardDir;
        this.holdUntil = timeMs + Phaser.Math.Between(120, 220);
      } else if (roll < 0.84 && absDist <= 145) {
        input.heavy = true;
      } else if (roll < 0.94) {
        this.holdBlock = false;
        this.moveDir = towardDir;
        this.holdUntil = timeMs + 240;
        input.jump = true;
      } else {
        this.moveDir = -towardDir;
        this.holdBlock = false;
        this.holdUntil = timeMs + 140;
      }
      return;
    }

    // Close combat: high-rate guard reads, mixups vs turtling defenders, and combo pressure.
    if (target.isAttacking && Math.random() < 0.78) {
      this.moveDir = 0;
      this.holdBlock = true;
      this.holdUntil = timeMs + Phaser.Math.Between(200, 300);
      return;
    }

    if (target.isBlocking) {
      const mix = Math.random();
      if (mix < 0.38) {
        this.moveDir = towardDir;
        this.holdBlock = false;
        this.holdUntil = timeMs + 220;
        input.jump = true;
      } else if (mix < 0.72) {
        input.heavy = true;
      } else {
        this.moveDir = -towardDir;
        this.holdBlock = false;
        this.holdUntil = timeMs + 150;
      }
      return;
    }

    const roll = Math.random();
    if (roll < 0.54) {
      input.light = true;
      if (Math.random() < 0.9) {
        this.comboFollowupAt = timeMs + Phaser.Math.Between(155, 200);
      }
      return;
    }

    if (roll < 0.85) {
      input.heavy = true;
      return;
    }

    if (roll < 0.94) {
      this.moveDir = 0;
      this.holdBlock = true;
      this.holdUntil = timeMs + Phaser.Math.Between(160, 240);
      return;
    }

    this.moveDir = towardDir;
    this.holdBlock = false;
    this.holdUntil = timeMs + 210;
    input.jump = true;
  }
}
