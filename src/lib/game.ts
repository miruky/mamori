import { GRID_H, GRID_W, isBuildableCell, PATH_LENGTH, pointAt } from './path';
import { effectiveDamage, effectiveRange, MAX_LEVEL, TOWERS, upgradeCost } from './towers';
import { DIFFICULTIES, ENEMIES, WAVE_CLEAR_BONUS, WAVES } from './enemies';
import type {
  Difficulty,
  DifficultyDef,
  Enemy,
  Notice,
  Projectile,
  Status,
  Tower,
  TowerKind,
  Vec,
} from './types';

const HIT_DIST = 0.4;

interface SpawnEvent {
  time: number;
  enemy: string;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * タワーディフェンスの全状態と進行。描画はこのオブジェクトを読むだけで、
 * 時間を進めるのは step(dt) に限る。乱数を使わないため、同じ操作と同じ
 * 時間刻みからは常に同じ展開になり、そのままテストできる。
 */
export interface GameOptions {
  difficulty?: Difficulty;
}

export class Game {
  readonly difficulty: Difficulty;
  gold: number;
  lives: number;
  /** 現在/直近のウェーブ番号(0始まり、未開始は-1)。 */
  waveIndex = -1;
  status: Status = 'playing';
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  waveActive = false;
  notices: Notice[] = [];

  private readonly diff: DifficultyDef;
  private waveTime = 0;
  private schedule: SpawnEvent[] = [];
  private spawnCursor = 0;
  private nextId = 1;
  private occupied = new Set<string>();

  constructor(opts: GameOptions = {}) {
    this.difficulty = opts.difficulty ?? 'normal';
    this.diff = DIFFICULTIES[this.difficulty];
    this.gold = this.diff.startGold;
    this.lives = this.diff.startLives;
  }

  get totalWaves(): number {
    return WAVES.length;
  }

  get hasNextWave(): boolean {
    return this.waveIndex + 1 < WAVES.length;
  }

  // --- 設置・売却・強化 -----------------------------------------------------

  towerAt(cx: number, cy: number): Tower | undefined {
    return this.towers.find((t) => t.cx === cx && t.cy === cy);
  }

  canPlace(cx: number, cy: number): boolean {
    return isBuildableCell(cx, cy) && !this.occupied.has(`${cx},${cy}`);
  }

  placeTower(kind: TowerKind, cx: number, cy: number): boolean {
    if (this.status !== 'playing') return false;
    const def = TOWERS[kind];
    if (!this.canPlace(cx, cy)) return false;
    if (this.gold < def.cost) {
      this.notify('資金が足りない。', 'bad');
      return false;
    }
    this.gold -= def.cost;
    this.towers.push({
      id: this.nextId++,
      kind,
      cx,
      cy,
      level: 1,
      cooldown: 0,
      invested: def.cost,
    });
    this.occupied.add(`${cx},${cy}`);
    return true;
  }

  upgradeTower(id: number): boolean {
    const tower = this.towers.find((t) => t.id === id);
    if (!tower || tower.level >= MAX_LEVEL) return false;
    const cost = upgradeCost(TOWERS[tower.kind], tower.level);
    if (this.gold < cost) {
      this.notify('資金が足りない。', 'bad');
      return false;
    }
    this.gold -= cost;
    tower.level += 1;
    tower.invested += cost;
    return true;
  }

  sellTower(id: number): boolean {
    const idx = this.towers.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    const tower = this.towers[idx]!;
    const refund = Math.floor(tower.invested * 0.6);
    this.gold += refund;
    this.occupied.delete(`${tower.cx},${tower.cy}`);
    this.towers.splice(idx, 1);
    this.notify(`塔を売却して${refund}を得た。`, 'info');
    return true;
  }

  // --- ウェーブ -------------------------------------------------------------

  startWave(): boolean {
    if (this.status !== 'playing' || this.waveActive || !this.hasNextWave) return false;
    this.waveIndex += 1;
    this.waveTime = 0;
    this.spawnCursor = 0;
    this.schedule = this.buildSchedule(this.waveIndex);
    this.waveActive = true;
    this.notify(`ウェーブ ${this.waveIndex + 1} 開始。`, 'info');
    return true;
  }

  private buildSchedule(waveIndex: number): SpawnEvent[] {
    const events: SpawnEvent[] = [];
    for (const group of WAVES[waveIndex]!) {
      for (let i = 0; i < group.count; i++) {
        events.push({ time: group.delay + i * group.spacing, enemy: group.enemy });
      }
    }
    events.sort((a, b) => a.time - b.time);
    return events;
  }

  // --- 毎フレームの更新 -----------------------------------------------------

  /** dt秒ぶん時間を進める。安定のため大きなdtは内部で分割する。 */
  step(dt: number): void {
    if (this.status !== 'playing') return;
    let remaining = dt;
    while (remaining > 0) {
      const slice = Math.min(remaining, 0.05);
      this.tick(slice);
      remaining -= slice;
      if (this.status !== 'playing') return;
    }
  }

  private tick(dt: number): void {
    if (this.waveActive) {
      this.waveTime += dt;
      while (
        this.spawnCursor < this.schedule.length &&
        this.schedule[this.spawnCursor]!.time <= this.waveTime
      ) {
        this.spawn(this.schedule[this.spawnCursor]!.enemy);
        this.spawnCursor += 1;
      }
    }

    this.moveEnemies(dt);
    this.fireTowers(dt);
    this.moveProjectiles(dt);
    this.collectDead();
    this.checkWaveEnd();
  }

  private spawn(kind: string): void {
    const def = ENEMIES[kind]!;
    const hp = Math.max(1, Math.round(def.hp * this.diff.hpScale));
    this.enemies.push({
      id: this.nextId++,
      def,
      hp,
      maxHp: hp,
      dist: 0,
      slowTimer: 0,
      slowFactor: 1,
    });
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      let speed = e.def.speed;
      if (e.slowTimer > 0) {
        speed *= e.slowFactor;
        e.slowTimer -= dt;
      }
      e.dist += speed * dt;
      if (e.dist >= PATH_LENGTH) {
        // 出口へ抜けた。残機を削り、敵を消す。
        this.lives -= e.def.leak;
        e.hp = 0;
        e.dist = PATH_LENGTH;
        if (this.lives <= 0) {
          this.lives = 0;
          this.status = 'lost';
          this.notify('防衛線を破られた。', 'bad');
        } else {
          this.notify(`${e.def.name}に抜けられた。`, 'bad');
        }
      }
    }
    // 抜けた敵(hp0だが賞金対象でない)を除く。倒した敵はcollectDeadで賞金処理。
    this.enemies = this.enemies.filter((e) => e.hp > 0 || e.dist < PATH_LENGTH);
  }

  enemyPos(e: Enemy): Vec {
    return pointAt(e.dist);
  }

  private fireTowers(dt: number): void {
    for (const tower of this.towers) {
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const def = TOWERS[tower.kind];
      const range = effectiveRange(def, tower.level);
      // 経路点も塔セルも同じセル索引座標で扱う(描画側が一律に+0.5して中心化する)。
      const target = this.pickTarget(tower.cx, tower.cy, range);
      if (!target) continue;
      tower.cooldown = 1 / def.fireRate;
      this.projectiles.push({
        id: this.nextId++,
        x: tower.cx,
        y: tower.cy,
        targetId: target.id,
        speed: def.projectileSpeed,
        damage: effectiveDamage(def, tower.level),
        splash: def.splash,
        slow: def.slow,
        tint: def.tint,
      });
    }
  }

  /** 射程内で最も先へ進んだ敵(出口に近い敵)を狙う。 */
  private pickTarget(cx: number, cy: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    const r2 = range * range;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const p = this.enemyPos(e);
      if (dist2(cx, cy, p.x, p.y) > r2) continue;
      if (!best || e.dist > best.dist) best = e;
    }
    return best;
  }

  private moveProjectiles(dt: number): void {
    const survivors: Projectile[] = [];
    for (const p of this.projectiles) {
      const target = this.enemies.find((e) => e.id === p.targetId && e.hp > 0);
      if (!target) continue; // 標的が消えたら不発
      const tp = this.enemyPos(target);
      const dx = tp.x - p.x;
      const dy = tp.y - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d <= Math.max(HIT_DIST, stepLen)) {
        this.impact(p, tp.x, tp.y, target);
        continue;
      }
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
      survivors.push(p);
    }
    this.projectiles = survivors;
  }

  private impact(p: Projectile, hx: number, hy: number, direct: Enemy): void {
    this.hitEnemy(direct, p.damage, p.slow);
    if (p.splash) {
      const r2 = p.splash * p.splash;
      for (const e of this.enemies) {
        if (e.id === direct.id || e.hp <= 0) continue;
        const ep = this.enemyPos(e);
        if (dist2(hx, hy, ep.x, ep.y) <= r2) this.hitEnemy(e, p.damage, p.slow);
      }
    }
  }

  private hitEnemy(e: Enemy, damage: number, slow?: Projectile['slow']): void {
    const dealt = Math.max(1, damage - e.def.armor);
    e.hp -= dealt;
    if (slow) {
      e.slowTimer = Math.max(e.slowTimer, slow.duration);
      e.slowFactor = slow.factor;
    }
  }

  private collectDead(): void {
    const alive: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.hp <= 0 && e.dist < PATH_LENGTH) {
        // 倒した(出口には抜けていない)敵は賞金になる。難易度で増減する。
        this.gold += Math.max(1, Math.round(e.def.bounty * this.diff.bountyScale));
      } else {
        alive.push(e);
      }
    }
    this.enemies = alive;
  }

  private checkWaveEnd(): void {
    if (!this.waveActive) return;
    if (this.spawnCursor < this.schedule.length) return;
    if (this.enemies.length > 0) return;
    this.waveActive = false;
    if (this.waveIndex + 1 >= WAVES.length) {
      this.status = 'won';
      this.notify('全ウェーブを退けた。防衛成功。', 'good');
      return;
    }
    const bonus = WAVE_CLEAR_BONUS + this.waveIndex * 3;
    this.gold += bonus;
    this.notify(`ウェーブ ${this.waveIndex + 1} を凌いだ。報酬 ${bonus}。`, 'good');
  }

  private notify(text: string, tint: Notice['tint']): void {
    this.notices.push({ text, tint });
    if (this.notices.length > 50) this.notices.shift();
  }
}

export { GRID_W, GRID_H, PATH_LENGTH };
