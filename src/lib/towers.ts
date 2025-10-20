import type { TowerDef, TowerKind } from './types';

// 4種の塔。役割を分ける ── 主力の連射、範囲の砲、足止めの氷、遠距離の狙撃。
export const TOWERS: Record<TowerKind, TowerDef> = {
  arrow: {
    kind: 'arrow',
    name: 'アロー塔',
    cost: 20,
    range: 2.6,
    damage: 8,
    fireRate: 2.2,
    projectileSpeed: 11,
    tint: 'arrow',
    description: '安価で連射が速い主力。単体を素早く削る。',
  },
  cannon: {
    kind: 'cannon',
    name: '砲塔',
    cost: 45,
    range: 2.4,
    damage: 22,
    fireRate: 0.65,
    projectileSpeed: 8,
    splash: 1.2,
    tint: 'cannon',
    description: '着弾点の周囲も巻き込む。群れに強いが発射は遅い。',
  },
  frost: {
    kind: 'frost',
    name: '氷塔',
    cost: 35,
    range: 2.3,
    damage: 4,
    fireRate: 1.4,
    projectileSpeed: 12,
    slow: { factor: 0.5, duration: 1.6 },
    tint: 'frost',
    description: '当てた敵を鈍らせる。火力より足止めの要。',
  },
  sniper: {
    kind: 'sniper',
    name: '狙撃塔',
    cost: 60,
    range: 4.6,
    damage: 40,
    fireRate: 0.5,
    projectileSpeed: 18,
    tint: 'sniper',
    description: '長射程・高威力。硬い敵を遠くから狙う。',
  },
};

export const TOWER_KINDS: readonly TowerKind[] = ['arrow', 'cannon', 'frost', 'sniper'];

/** レベル(1..3)に応じた実効ダメージ。1段ごとに約1.6倍。 */
export function effectiveDamage(def: TowerDef, level: number): number {
  return Math.round(def.damage * Math.pow(1.6, level - 1));
}

/** レベルに応じた実効射程。1段ごとに0.5セル伸びる。 */
export function effectiveRange(def: TowerDef, level: number): number {
  return def.range + 0.5 * (level - 1);
}

export const MAX_LEVEL = 3;

/** 次のレベルへ上げる費用。レベルが上がるほど高い。 */
export function upgradeCost(def: TowerDef, level: number): number {
  return Math.round(def.cost * (0.9 + 0.7 * level));
}
