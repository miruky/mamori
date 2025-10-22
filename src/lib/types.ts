// ゲーム全体で共有する型。描画(SVG/DOM)からは独立させ、ロジックだけで完結させる。
// 座標はセル単位の浮動小数。描画側がピクセルへ変換する。

export interface Vec {
  x: number;
  y: number;
}

export type TowerKind = 'arrow' | 'cannon' | 'frost' | 'sniper';

/** 鈍化効果の指定。氷塔と、その投射物が運ぶ。 */
export interface SlowSpec {
  /** 速度倍率(0.5なら半減)。 */
  factor: number;
  /** 効果の持続秒数。 */
  duration: number;
}

/** 塔の種別定義。レベルで威力と射程が伸びる。 */
export interface TowerDef {
  kind: TowerKind;
  name: string;
  cost: number;
  /** 射程(セル)。 */
  range: number;
  damage: number;
  /** 毎秒の発射回数。 */
  fireRate: number;
  /** 投射物の速度(セル毎秒)。誘導弾なので必ず当たる。 */
  projectileSpeed: number;
  /** 着弾点の周囲に与える範囲ダメージ半径(砲塔)。 */
  splash?: number;
  /** 命中した敵を鈍らせる(氷塔)。 */
  slow?: SlowSpec;
  tint: string;
  description: string;
}

export interface Tower {
  id: number;
  kind: TowerKind;
  /** 設置セル。 */
  cx: number;
  cy: number;
  level: number;
  /** 次の発射までの残り秒数。 */
  cooldown: number;
  /** 売却額算定のため、これまで投じた総額。 */
  invested: number;
}

/** 敵の種別定義。 */
export interface EnemyDef {
  kind: string;
  name: string;
  hp: number;
  /** 基本速度(セル毎秒)。 */
  speed: number;
  /** 固定ダメージ軽減。 */
  armor: number;
  /** 倒したときの賞金。 */
  bounty: number;
  /** 出口へ抜けたとき失う残機。 */
  leak: number;
  tint: string;
  /** 描画半径(セル比)。見た目の大小。 */
  size: number;
}

export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  /** 出現時の最大HP。難易度で増減するため、HPバーの分母はここを使う。 */
  maxHp: number;
  /** 経路上の到達距離(セル)。 */
  dist: number;
  /** 鈍化の残り秒数と倍率。 */
  slowTimer: number;
  slowFactor: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  splash?: number;
  slow?: SlowSpec;
  tint: string;
}

/** 1ウェーブの編成。delay秒後から、count体をspacing秒間隔で送り出す。 */
export interface SpawnGroup {
  enemy: string;
  count: number;
  spacing: number;
  delay: number;
}

export type Wave = SpawnGroup[];

export type Status = 'playing' | 'won' | 'lost';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** 難易度ごとの補正。標準(normal)は等倍で、既定の挙動と一致する。 */
export interface DifficultyDef {
  label: string;
  /** 敵HPの倍率。 */
  hpScale: number;
  /** 賞金の倍率。難しいほど稼ぎにくい。 */
  bountyScale: number;
  startGold: number;
  startLives: number;
}

/** ログ・通知の1行。 */
export interface Notice {
  text: string;
  tint: 'info' | 'good' | 'bad';
}
