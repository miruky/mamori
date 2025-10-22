import type { Difficulty, DifficultyDef, EnemyDef, Wave } from './types';

// 敵の種別。速い斥候、硬い装甲、群れ、重い巨体、そして最終ウェーブの主。
export const ENEMIES: Record<string, EnemyDef> = {
  grunt: {
    kind: 'grunt',
    name: '雑兵',
    hp: 30,
    speed: 1.4,
    armor: 0,
    bounty: 6,
    leak: 1,
    tint: 'grunt',
    size: 0.32,
  },
  runner: {
    kind: 'runner',
    name: '斥候',
    hp: 20,
    speed: 2.7,
    armor: 0,
    bounty: 7,
    leak: 1,
    tint: 'runner',
    size: 0.27,
  },
  armored: {
    kind: 'armored',
    name: '装甲兵',
    hp: 48,
    speed: 1.15,
    armor: 4,
    bounty: 11,
    leak: 1,
    tint: 'armored',
    size: 0.34,
  },
  swarm: {
    kind: 'swarm',
    name: '小鬼',
    hp: 13,
    speed: 1.8,
    armor: 0,
    bounty: 3,
    leak: 1,
    tint: 'swarm',
    size: 0.22,
  },
  brute: {
    kind: 'brute',
    name: '巨兵',
    hp: 150,
    speed: 0.95,
    armor: 3,
    bounty: 24,
    leak: 2,
    tint: 'brute',
    size: 0.42,
  },
  boss: {
    kind: 'boss',
    name: '魔王',
    hp: 720,
    speed: 0.8,
    armor: 6,
    bounty: 150,
    leak: 10,
    tint: 'boss',
    size: 0.5,
  },
};

// 12ウェーブ。徐々に量と硬さが増し、最後に魔王が出る。
export const WAVES: readonly Wave[] = [
  [{ enemy: 'grunt', count: 6, spacing: 0.9, delay: 0 }],
  [{ enemy: 'grunt', count: 8, spacing: 0.8, delay: 0 }],
  [
    { enemy: 'runner', count: 6, spacing: 0.6, delay: 0 },
    { enemy: 'grunt', count: 5, spacing: 0.8, delay: 4 },
  ],
  [{ enemy: 'armored', count: 7, spacing: 1.0, delay: 0 }],
  [
    { enemy: 'swarm', count: 16, spacing: 0.35, delay: 0 },
    { enemy: 'grunt', count: 4, spacing: 0.9, delay: 6 },
  ],
  [
    { enemy: 'runner', count: 10, spacing: 0.5, delay: 0 },
    { enemy: 'armored', count: 4, spacing: 1.2, delay: 3 },
  ],
  [{ enemy: 'brute', count: 3, spacing: 2.2, delay: 0 }],
  [
    { enemy: 'armored', count: 8, spacing: 0.7, delay: 0 },
    { enemy: 'runner', count: 8, spacing: 0.4, delay: 2 },
  ],
  [
    { enemy: 'swarm', count: 24, spacing: 0.28, delay: 0 },
    { enemy: 'brute', count: 2, spacing: 3, delay: 4 },
  ],
  [
    { enemy: 'brute', count: 4, spacing: 1.8, delay: 0 },
    { enemy: 'armored', count: 10, spacing: 0.6, delay: 1 },
  ],
  [
    { enemy: 'runner', count: 18, spacing: 0.32, delay: 0 },
    { enemy: 'brute', count: 3, spacing: 2.2, delay: 3 },
    { enemy: 'armored', count: 8, spacing: 0.7, delay: 8 },
  ],
  [
    { enemy: 'brute', count: 6, spacing: 1.6, delay: 0 },
    { enemy: 'boss', count: 1, spacing: 1, delay: 6 },
  ],
];

/** ウェーブを乗り切るごとの報酬の基準額(これに進行度を加える)。 */
export const WAVE_CLEAR_BONUS = 12;
export const START_GOLD = 110;
export const START_LIVES = 20;

// 難易度。normalは等倍・既定値で、補正なしの素の挙動と一致する。
// easyは敵が脆く資金に余裕があり、hardは硬く稼ぎにくく残機も少ない。
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { label: 'やさしい', hpScale: 0.8, bountyScale: 1.15, startGold: 140, startLives: 25 },
  normal: {
    label: 'ふつう',
    hpScale: 1,
    bountyScale: 1,
    startGold: START_GOLD,
    startLives: START_LIVES,
  },
  hard: { label: 'むずかしい', hpScale: 1.35, bountyScale: 0.9, startGold: 95, startLives: 15 },
};

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'normal', 'hard'];
