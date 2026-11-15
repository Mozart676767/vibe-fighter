/**
 * YOUR FIGHTERS — add one line per fighter.
 *
 *   id    the folder name: public/assets/<id>/   (english, lowercase, no spaces)
 *   name  the name shown in the game
 *   flip  true if your pictures face RIGHT (the game needs fighters facing LEFT)
 *
 * Pictures go in public/assets/<id>/ :
 *   idle  walk  punch  kick  hit  ko        (needed)
 *   jump  crouch  block  special  portrait  (bonus)
 *
 * Full rules: ADD_CHARACTER.md
 */
export interface MyFighter {
  id: string;
  name: string;
  flip?: boolean;
  /** Only if auto-detect counts the poses wrong: { kick: 4 } */
  frames?: Record<string, number>;
}

const FOUR_FRAME_SHEET = { idle: 4, walk: 4, punch: 4, kick: 4, hit: 4, ko: 4 };

export const MY_FIGHTERS: MyFighter[] = [
  { id: 'naruto', name: 'Naruto', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'sasuke', name: 'Sasuke', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'kakashi', name: 'Kakashi', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'minato', name: 'Minato', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'itachi', name: 'Itachi', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'gaara', name: 'Gaara', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'sakura', name: 'Sakura', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'rock-lee', name: 'Rock Lee', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'jiraiya', name: 'Jiraiya', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'pain', name: 'Pain', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'goku', name: 'Goku', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'luffy', name: 'Luffy', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'gojo', name: 'Gojo', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'ichigo', name: 'Ichigo', flip: true, frames: FOUR_FRAME_SHEET },
  { id: 'tanjiro', name: 'Tanjiro', flip: true, frames: FOUR_FRAME_SHEET },
];
