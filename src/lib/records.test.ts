import { describe, it, expect } from 'vitest';
import { emptyRecords, parseRecords, recordOutcome } from './records';

describe('プレイ記録', () => {
  it('初期値はすべて0', () => {
    const r = emptyRecords();
    expect(r.plays).toBe(0);
    expect(r.bestWave.normal).toBe(0);
    expect(r.wins.hard).toBe(0);
  });

  it('敗北は到達ウェーブを更新するが勝利数は増えない', () => {
    const r = recordOutcome(emptyRecords(), 'normal', 'lost', 4);
    expect(r.plays).toBe(1);
    expect(r.bestWave.normal).toBe(4);
    expect(r.wins.normal).toBe(0);
  });

  it('勝利は勝利数を増やす', () => {
    const r = recordOutcome(emptyRecords(), 'easy', 'won', 12);
    expect(r.wins.easy).toBe(1);
    expect(r.bestWave.easy).toBe(12);
  });

  it('最高ウェーブは下がらない', () => {
    let r = recordOutcome(emptyRecords(), 'hard', 'lost', 9);
    r = recordOutcome(r, 'hard', 'lost', 3);
    expect(r.bestWave.hard).toBe(9);
    expect(r.plays).toBe(2);
  });

  it('難易度ごとに独立して記録する', () => {
    let r = recordOutcome(emptyRecords(), 'easy', 'won', 12);
    r = recordOutcome(r, 'hard', 'lost', 2);
    expect(r.bestWave.easy).toBe(12);
    expect(r.bestWave.hard).toBe(2);
    expect(r.wins.easy).toBe(1);
    expect(r.wins.hard).toBe(0);
  });

  it('元のオブジェクトを変更しない', () => {
    const base = emptyRecords();
    recordOutcome(base, 'normal', 'won', 12);
    expect(base.plays).toBe(0);
    expect(base.wins.normal).toBe(0);
  });

  it('保存値を往復できる', () => {
    const r = recordOutcome(emptyRecords(), 'normal', 'won', 12);
    expect(parseRecords(JSON.stringify(r))).toEqual(r);
  });

  it('壊れた・空の保存値は初期値に落とす', () => {
    expect(parseRecords(null)).toEqual(emptyRecords());
    expect(parseRecords('{ not json')).toEqual(emptyRecords());
    expect(parseRecords('{"plays":-5,"bestWave":{"normal":"x"}}')).toEqual(emptyRecords());
  });
});
