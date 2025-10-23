import { describe, it, expect } from 'vitest';
import { Game, parseSnapshot } from './game';
import { DIFFICULTIES, ENEMIES, START_GOLD, START_LIVES } from './enemies';
import { TOWERS, MAX_LEVEL, upgradeCost } from './towers';
import { PATH_LENGTH } from './path';
import type { Enemy, TowerKind } from './types';

function enemy(kind: string, dist: number, id = 1): Enemy {
  const def = ENEMIES[kind]!;
  return { id, def, hp: def.hp, maxHp: def.hp, dist, slowTimer: 0, slowFactor: 1 };
}

describe('設置・売却・強化', () => {
  it('塔を建てると資金が減り、マスが埋まる', () => {
    const g = new Game();
    expect(g.placeTower('arrow', 5, 2)).toBe(true);
    expect(g.gold).toBe(START_GOLD - TOWERS.arrow.cost);
    expect(g.towerAt(5, 2)?.kind).toBe('arrow');
    expect(g.canPlace(5, 2)).toBe(false);
  });

  it('経路上や場外、資金不足では建てられない', () => {
    const g = new Game();
    expect(g.placeTower('arrow', 12, 1)).toBe(false); // 経路上
    expect(g.placeTower('arrow', -1, 1)).toBe(false); // 場外
    g.gold = 5;
    expect(g.placeTower('arrow', 5, 2)).toBe(false); // 資金不足
  });

  it('同じマスには重ねて建てられない', () => {
    const g = new Game();
    g.placeTower('arrow', 5, 2);
    expect(g.placeTower('cannon', 5, 2)).toBe(false);
  });

  it('強化でレベルが上がり、上限で止まる', () => {
    const g = new Game();
    g.gold = 999;
    g.placeTower('arrow', 5, 2);
    const id = g.towerAt(5, 2)!.id;
    expect(g.upgradeTower(id)).toBe(true);
    expect(g.towerAt(5, 2)!.level).toBe(2);
    expect(g.upgradeTower(id)).toBe(true);
    expect(g.towerAt(5, 2)!.level).toBe(MAX_LEVEL);
    expect(g.upgradeTower(id)).toBe(false); // 上限
  });

  it('売却で投資額の6割が戻り、マスが空く', () => {
    const g = new Game();
    g.placeTower('arrow', 5, 2);
    const id = g.towerAt(5, 2)!.id;
    const before = g.gold;
    expect(g.sellTower(id)).toBe(true);
    expect(g.gold).toBe(before + Math.floor(TOWERS.arrow.cost * 0.6));
    expect(g.canPlace(5, 2)).toBe(true);
  });

  it('強化費はレベルが上がるほど高い', () => {
    expect(upgradeCost(TOWERS.arrow, 2)).toBeGreaterThan(upgradeCost(TOWERS.arrow, 1));
  });
});

describe('ウェーブと進行', () => {
  it('開始すると敵が湧き、経路を進む', () => {
    const g = new Game();
    expect(g.startWave()).toBe(true);
    expect(g.waveActive).toBe(true);
    expect(g.waveIndex).toBe(0);
    g.step(0.1);
    expect(g.enemies.length).toBeGreaterThan(0);
    const first = g.enemies[0]!;
    const d0 = first.dist;
    g.step(1);
    expect(first.dist).toBeGreaterThan(d0);
  });

  it('進行中は次のウェーブを始められない', () => {
    const g = new Game();
    g.startWave();
    expect(g.startWave()).toBe(false);
  });

  it('待機中でも塔は射程内の敵を攻撃し、倒すと賞金が入る', () => {
    const g = new Game();
    g.placeTower('sniper', 5, 2);
    const afterBuy = g.gold;
    g.enemies.push(enemy('grunt', 5));
    for (let i = 0; i < 100 && g.enemies.length > 0; i++) g.step(0.1);
    expect(g.enemies.length).toBe(0);
    expect(g.gold).toBe(afterBuy + ENEMIES.grunt!.bounty);
  });

  it('氷塔の弾は敵を鈍らせる', () => {
    const g = new Game();
    g.placeTower('frost', 5, 2);
    const e = enemy('brute', 5); // 硬いので一撃では死なず、鈍化を観測できる
    g.enemies.push(e);
    for (let i = 0; i < 10 && e.slowTimer <= 0; i++) g.step(0.1);
    expect(e.slowTimer).toBeGreaterThan(0);
    expect(e.slowFactor).toBeLessThan(1);
  });

  it('守りきれないと出口に抜けられ、残機が減る', () => {
    const g = new Game();
    g.enemies.push(enemy('grunt', PATH_LENGTH - 1));
    for (let i = 0; i < 50 && g.lives === START_LIVES; i++) g.step(0.1);
    expect(g.lives).toBe(START_LIVES - ENEMIES.grunt!.leak);
    expect(g.enemies.length).toBe(0);
  });

  it('停止後はstepしても何も起きない', () => {
    const g = new Game();
    g.status = 'won';
    g.startWave();
    g.step(1);
    expect(g.enemies.length).toBe(0);
  });
});

describe('勝敗の決着', () => {
  it('塔がなければ抜かれ続けて敗北する', () => {
    const g = new Game();
    let guard = 0;
    while (g.status === 'playing' && guard++ < 6000) {
      if (!g.waveActive && g.hasNextWave) g.startWave();
      g.step(0.1);
    }
    expect(g.status).toBe('lost');
    expect(g.lives).toBe(0);
  });

  it('十分な布陣なら全ウェーブを退けて勝利する', () => {
    const g = new Game();
    g.gold = 999999;
    let placed = 0;
    for (const y of [0, 2, 3, 5, 6, 8]) {
      for (const x of [1, 3, 5, 7, 9, 11, 13]) {
        const kind: TowerKind = (x + y) % 2 === 0 ? 'sniper' : 'cannon';
        if (g.canPlace(x, y) && g.placeTower(kind, x, y)) placed++;
      }
    }
    expect(placed).toBeGreaterThan(10);
    let guard = 0;
    while (g.status === 'playing' && guard++ < 20000) {
      if (!g.waveActive && g.hasNextWave) g.startWave();
      g.step(0.1);
    }
    expect(g.status).toBe('won');
    expect(g.lives).toBeGreaterThan(0);
  });
});

describe('難易度', () => {
  it('既定はnormalで、補正なしの素の値になる', () => {
    const g = new Game();
    expect(g.difficulty).toBe('normal');
    expect(g.gold).toBe(START_GOLD);
    expect(g.lives).toBe(START_LIVES);
  });

  it('easyは資金と残機が多く、敵が脆い', () => {
    const g = new Game({ difficulty: 'easy' });
    expect(g.gold).toBe(DIFFICULTIES.easy.startGold);
    expect(g.lives).toBe(DIFFICULTIES.easy.startLives);
    g.startWave();
    g.step(0.1);
    const e = g.enemies[0]!;
    expect(e.maxHp).toBeLessThan(ENEMIES.grunt!.hp);
    expect(e.hp).toBe(e.maxHp);
  });

  it('hardは敵が硬く、賞金が減る', () => {
    const g = new Game({ difficulty: 'hard' });
    expect(g.gold).toBe(DIFFICULTIES.hard.startGold);
    g.placeTower('sniper', 5, 2);
    const before = g.gold;
    g.enemies.push({
      id: 99,
      def: ENEMIES.grunt!,
      hp: Math.round(ENEMIES.grunt!.hp * DIFFICULTIES.hard.hpScale),
      maxHp: Math.round(ENEMIES.grunt!.hp * DIFFICULTIES.hard.hpScale),
      dist: 5,
      slowTimer: 0,
      slowFactor: 1,
    });
    for (let i = 0; i < 100 && g.enemies.length > 0; i++) g.step(0.1);
    const earned = g.gold - before;
    expect(earned).toBeLessThan(ENEMIES.grunt!.bounty); // 賞金が割り引かれる
    expect(earned).toBeGreaterThan(0);
  });
});

describe('保存と復元', () => {
  it('スナップショットから局面を組み立て直せる', () => {
    const g = new Game({ difficulty: 'hard' });
    g.gold = 200;
    g.placeTower('sniper', 5, 2);
    g.placeTower('frost', 7, 3);
    g.gold = 999;
    g.upgradeTower(g.towerAt(5, 2)!.id);
    g.startWave(); // waveIndexを0へ進める
    g.waveActive = false; // 合間に保存する想定

    const restored = Game.fromSnapshot(g.snapshot());
    expect(restored.difficulty).toBe('hard');
    expect(restored.gold).toBe(g.gold);
    expect(restored.lives).toBe(g.lives);
    expect(restored.waveIndex).toBe(0);
    expect(restored.towerAt(5, 2)?.kind).toBe('sniper');
    expect(restored.towerAt(5, 2)?.level).toBe(2);
    expect(restored.canPlace(7, 3)).toBe(false); // 復元した塔でマスが埋まる
    expect(restored.startWave()).toBe(true); // 次のウェーブから続けられる
    expect(restored.waveIndex).toBe(1);
  });

  it('JSON文字列を往復できる', () => {
    const g = new Game();
    g.placeTower('arrow', 5, 2);
    const back = parseSnapshot(JSON.stringify(g.snapshot()));
    expect(back).toEqual(g.snapshot());
  });

  it('壊れた・不正な保存値はnullになる', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('{ broken')).toBeNull();
    expect(parseSnapshot('{"difficulty":"impossible"}')).toBeNull();
    // 経路上のマスに塔がある保存値は不正
    expect(
      parseSnapshot(
        JSON.stringify({
          difficulty: 'normal',
          gold: 100,
          lives: 20,
          waveIndex: -1,
          status: 'playing',
          towers: [{ kind: 'arrow', cx: 12, cy: 1, level: 1, invested: 20 }],
        }),
      ),
    ).toBeNull();
    // 同じマスに二重設置の保存値は不正
    expect(
      parseSnapshot(
        JSON.stringify({
          difficulty: 'normal',
          gold: 100,
          lives: 20,
          waveIndex: -1,
          status: 'playing',
          towers: [
            { kind: 'arrow', cx: 5, cy: 2, level: 1, invested: 20 },
            { kind: 'frost', cx: 5, cy: 2, level: 1, invested: 35 },
          ],
        }),
      ),
    ).toBeNull();
  });
});
