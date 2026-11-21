import type { VfxColor } from './vfx';

export type VictoryPoseAction =
  | 'idle'
  | 'light-punch'
  | 'heavy-kick'
  | 'jump'
  | 'special'
  | 'special-charge'
  | 'crouch';

export type VictoryMotionStyle =
  | 'hero-leap'
  | 'shadow-combo'
  | 'levitate'
  | 'power-surge'
  | 'flash-step'
  | 'blade-slash'
  | 'nonchalant';

export type VictoryFxKind =
  | 'rasengan-spiral'
  | 'chidori-sharingan'
  | 'raikiri-leaves'
  | 'hiraishin-flash'
  | 'crow-tsukuyomi'
  | 'sand-throne'
  | 'sakura-bloom'
  | 'eight-gates'
  | 'toad-sage'
  | 'rinnegan-ascend'
  | 'super-saiyan'
  | 'gear2-haki'
  | 'infinity-void'
  | 'getsuga-reiatsu'
  | 'hinokami-sun'
  | 'vegeta-pride'
  | 'shrine-cleave'
  | 'godspeed-bolt'
  | 'serious-sparkle'
  | 'tengai-meteor'
  | 'full-cowling'
  | 'nitro-ignition'
  | 'ice-fire-split'
  | 'united-smash'
  | 'default';

export interface VictoryPoseStep {
  action: VictoryPoseAction;
  /** Duration in ms before transitioning to the next pose (last pose holds). */
  durationMs: number;
}

export interface CharacterVictoryProfile {
  id: string;
  title: string;
  quote: string;
  color: VfxColor;
  accentHex: number;
  motion: VictoryMotionStyle;
  sequence: VictoryPoseStep[];
  fxKind: VictoryFxKind;
}

const DEFAULT_VICTORY_PROFILE: CharacterVictoryProfile = {
  id: 'default',
  title: 'MATCH VICTOR',
  quote: 'Victory belongs to the strongest!',
  color: 'gold',
  accentHex: 0xfef08a,
  motion: 'power-surge',
  sequence: [
    { action: 'light-punch', durationMs: 360 },
    { action: 'idle', durationMs: 1200 }
  ],
  fxKind: 'default'
};

export const VICTORY_PROFILES: Record<string, CharacterVictoryProfile> = {
  naruto: {
    id: 'naruto',
    title: 'HOKAGE PROMISE',
    quote: 'That is my ninja way — believe it!',
    color: 'orange',
    accentHex: 0x38bdf8,
    motion: 'hero-leap',
    sequence: [
      { action: 'jump', durationMs: 340 },
      { action: 'light-punch', durationMs: 360 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'rasengan-spiral'
  },
  sasuke: {
    id: 'sasuke',
    title: 'SHARINGAN ECLIPSE',
    quote: 'My eyes see through everything.',
    color: 'blue',
    accentHex: 0xdc2626,
    motion: 'blade-slash',
    sequence: [
      { action: 'special', durationMs: 420 },
      { action: 'idle', durationMs: 1100 }
    ],
    fxKind: 'chidori-sharingan'
  },
  kakashi: {
    id: 'kakashi',
    title: 'COPY NINJA SALUTE',
    quote: 'Sorry, looks like you could not keep up.',
    color: 'cyan',
    accentHex: 0x4ade80,
    motion: 'flash-step',
    sequence: [
      { action: 'heavy-kick', durationMs: 340 },
      { action: 'idle', durationMs: 1200 }
    ],
    fxKind: 'raikiri-leaves'
  },
  minato: {
    id: 'minato',
    title: 'YELLOW FLASH',
    quote: 'Too slow. The battle ended in an instant.',
    color: 'gold',
    accentHex: 0xfef08a,
    motion: 'flash-step',
    sequence: [
      { action: 'special', durationMs: 360 },
      { action: 'idle', durationMs: 1200 }
    ],
    fxKind: 'hiraishin-flash'
  },
  itachi: {
    id: 'itachi',
    title: 'TSUKUYOMI ILLUSION',
    quote: 'You are already under my genjutsu.',
    color: 'red',
    accentHex: 0x18181b,
    motion: 'levitate',
    sequence: [
      { action: 'special', durationMs: 440 },
      { action: 'idle', durationMs: 1100 }
    ],
    fxKind: 'crow-tsukuyomi'
  },
  gaara: {
    id: 'gaara',
    title: 'DESERT SOVEREIGN',
    quote: 'The sand never fails to protect me.',
    color: 'gold',
    accentHex: 0xd97706,
    motion: 'power-surge',
    sequence: [
      { action: 'special-charge', durationMs: 420 },
      { action: 'idle', durationMs: 1100 }
    ],
    fxKind: 'sand-throne'
  },
  sakura: {
    id: 'sakura',
    title: 'CHERRY BLOSSOM BLOOM',
    quote: 'Cha! Never underestimate me!',
    color: 'pink',
    accentHex: 0xfdf2f8,
    motion: 'hero-leap',
    sequence: [
      { action: 'heavy-kick', durationMs: 380 },
      { action: 'light-punch', durationMs: 320 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'sakura-bloom'
  },
  'rock-lee': {
    id: 'rock-lee',
    title: 'SPRINGTIME OF YOUTH',
    quote: 'Hard work always beats natural talent!',
    color: 'green',
    accentHex: 0xef4444,
    motion: 'shadow-combo',
    sequence: [
      { action: 'light-punch', durationMs: 220 },
      { action: 'heavy-kick', durationMs: 260 },
      { action: 'jump', durationMs: 260 },
      { action: 'idle', durationMs: 900 }
    ],
    fxKind: 'eight-gates'
  },
  jiraiya: {
    id: 'jiraiya',
    title: 'GALLANT TOAD SAGE',
    quote: 'Behold the legendary Toad Sage of Mount Myoboku!',
    color: 'orange',
    accentHex: 0xfacc15,
    motion: 'hero-leap',
    sequence: [
      { action: 'jump', durationMs: 320 },
      { action: 'special', durationMs: 440 },
      { action: 'idle', durationMs: 950 }
    ],
    fxKind: 'toad-sage'
  },
  pain: {
    id: 'pain',
    title: 'ALMIGHTY JUDGMENT',
    quote: 'Know pain. Accept pain. Move beyond pain.',
    color: 'purple',
    accentHex: 0xe9d5ff,
    motion: 'levitate',
    sequence: [
      { action: 'special', durationMs: 520 },
      { action: 'idle', durationMs: 1100 }
    ],
    fxKind: 'rinnegan-ascend'
  },
  goku: {
    id: 'goku',
    title: 'SUPER SAIYAN AWAKENED',
    quote: 'That was awesome! Let us fight again sometime!',
    color: 'gold',
    accentHex: 0x38bdf8,
    motion: 'power-surge',
    sequence: [
      { action: 'special-charge', durationMs: 380 },
      { action: 'jump', durationMs: 340 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'super-saiyan'
  },
  luffy: {
    id: 'luffy',
    title: 'KING OF THE PIRATES',
    quote: 'Shishishi! I am gonna be King of the Pirates!',
    color: 'red',
    accentHex: 0xfacc15,
    motion: 'shadow-combo',
    sequence: [
      { action: 'light-punch', durationMs: 280 },
      { action: 'jump', durationMs: 320 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'gear2-haki'
  },
  gojo: {
    id: 'gojo',
    title: 'THE HONORED ONE',
    quote: 'Throughout Heaven and Earth, I alone am the honored one.',
    color: 'purple',
    accentHex: 0x38bdf8,
    motion: 'levitate',
    sequence: [
      { action: 'special', durationMs: 460 },
      { action: 'idle', durationMs: 1150 }
    ],
    fxKind: 'infinity-void'
  },
  ichigo: {
    id: 'ichigo',
    title: 'BANKAI FINALE',
    quote: 'If you want to stop me, bring more than that.',
    color: 'blue',
    accentHex: 0xef4444,
    motion: 'blade-slash',
    sequence: [
      { action: 'heavy-kick', durationMs: 380 },
      { action: 'idle', durationMs: 1200 }
    ],
    fxKind: 'getsuga-reiatsu'
  },
  tanjiro: {
    id: 'tanjiro',
    title: 'SUN BREATHING DANCE',
    quote: 'Set your heart ablaze and never give up!',
    color: 'orange',
    accentHex: 0x38bdf8,
    motion: 'blade-slash',
    sequence: [
      { action: 'heavy-kick', durationMs: 360 },
      { action: 'light-punch', durationMs: 280 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'hinokami-sun'
  },
  vegeta: {
    id: 'vegeta',
    title: 'SAIYAN ROYAL PRIDE',
    quote: 'I am the Prince of all Saiyans!',
    color: 'gold',
    accentHex: 0x60a5fa,
    motion: 'power-surge',
    sequence: [
      { action: 'special-charge', durationMs: 420 },
      { action: 'light-punch', durationMs: 300 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'vegeta-pride'
  },
  sukuna: {
    id: 'sukuna',
    title: 'KING OF CURSES',
    quote: 'Stand proud. You were strong.',
    color: 'red',
    accentHex: 0x7f1d1d,
    motion: 'blade-slash',
    sequence: [
      { action: 'light-punch', durationMs: 320 },
      { action: 'heavy-kick', durationMs: 320 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'shrine-cleave'
  },
  killua: {
    id: 'killua',
    title: 'GODSPEED SPARK',
    quote: 'Finished already? You did not even react.',
    color: 'cyan',
    accentHex: 0xe0f2fe,
    motion: 'flash-step',
    sequence: [
      { action: 'light-punch', durationMs: 240 },
      { action: 'heavy-kick', durationMs: 260 },
      { action: 'idle', durationMs: 1100 }
    ],
    fxKind: 'godspeed-bolt'
  },
  saitama: {
    id: 'saitama',
    title: 'ONE PUNCH',
    quote: 'OK.',
    color: 'gold',
    accentHex: 0xffffff,
    motion: 'nonchalant',
    sequence: [
      { action: 'light-punch', durationMs: 320 },
      { action: 'idle', durationMs: 1200 }
    ],
    fxKind: 'serious-sparkle'
  },
  madara: {
    id: 'madara',
    title: 'UCHIHA DOMINION',
    quote: 'Wake up to reality.',
    color: 'purple',
    accentHex: 0xdc2626,
    motion: 'levitate',
    sequence: [
      { action: 'special', durationMs: 460 },
      { action: 'idle', durationMs: 1150 }
    ],
    fxKind: 'tengai-meteor'
  },
  deku: {
    id: 'deku',
    title: 'FULL COWLING: 100%',
    quote: 'Go beyond — Plus Ultra!',
    color: 'green',
    accentHex: 0x86efac,
    motion: 'hero-leap',
    sequence: [
      { action: 'jump', durationMs: 340 },
      { action: 'light-punch', durationMs: 340 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'full-cowling'
  },
  bakugo: {
    id: 'bakugo',
    title: 'EXPLOSION KING',
    quote: 'Die! ...I mean, obviously I win!',
    color: 'orange',
    accentHex: 0xfacc15,
    motion: 'shadow-combo',
    sequence: [
      { action: 'light-punch', durationMs: 260 },
      { action: 'heavy-kick', durationMs: 320 },
      { action: 'idle', durationMs: 1050 }
    ],
    fxKind: 'nitro-ignition'
  },
  todoroki: {
    id: 'todoroki',
    title: 'HALF-COLD HALF-HOT',
    quote: 'Ice and flame — both are my own power.',
    color: 'cyan',
    accentHex: 0xef4444,
    motion: 'power-surge',
    sequence: [
      { action: 'special', durationMs: 420 },
      { action: 'idle', durationMs: 1100 }
    ],
    fxKind: 'ice-fire-split'
  },
  'all-might': {
    id: 'all-might',
    title: 'SYMBOL OF PEACE',
    quote: 'Have no fear — because I AM HERE!',
    color: 'gold',
    accentHex: 0xef4444,
    motion: 'hero-leap',
    sequence: [
      { action: 'jump', durationMs: 360 },
      { action: 'light-punch', durationMs: 380 },
      { action: 'idle', durationMs: 1000 }
    ],
    fxKind: 'united-smash'
  }
};

export function getCharacterVictoryProfile(characterId: string): CharacterVictoryProfile {
  return VICTORY_PROFILES[characterId] ?? DEFAULT_VICTORY_PROFILE;
}
