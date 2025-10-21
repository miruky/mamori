import { describe, it, expect } from 'vitest';
import { PATH, PATH_LENGTH, pointAt, isBuildableCell, pathCells } from './path';

describe('経路', () => {
  it('全長は各区間の和になる', () => {
    // 13 + 3 + 10 + 3 + 13 = 42
    expect(PATH_LENGTH).toBe(42);
  });

  it('始点と終点を返す', () => {
    expect(pointAt(0)).toEqual(PATH[0]);
    expect(pointAt(PATH_LENGTH)).toEqual(PATH[PATH.length - 1]);
    expect(pointAt(-5)).toEqual(PATH[0]); // 範囲外はクランプ
    expect(pointAt(999)).toEqual(PATH[PATH.length - 1]);
  });

  it('区間の折れ点を正しく通る', () => {
    expect(pointAt(13)).toEqual({ x: 12, y: 1 });
    expect(pointAt(16)).toEqual({ x: 12, y: 4 });
    expect(pointAt(26)).toEqual({ x: 2, y: 4 });
  });

  it('距離に対して位置は単調に進む', () => {
    let prev = pointAt(0);
    let moved = 0;
    for (let d = 1; d <= PATH_LENGTH; d++) {
      const p = pointAt(d);
      moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
      prev = p;
    }
    expect(moved).toBeCloseTo(PATH_LENGTH, 5);
  });
});

describe('建設可否', () => {
  it('経路上のセルには建てられない', () => {
    expect(isBuildableCell(12, 1)).toBe(false);
    expect(isBuildableCell(2, 4)).toBe(false);
  });

  it('経路外の盤内セルには建てられる', () => {
    expect(isBuildableCell(5, 2)).toBe(true);
    expect(isBuildableCell(8, 5)).toBe(true);
  });

  it('盤外には建てられない', () => {
    expect(isBuildableCell(-1, 1)).toBe(false);
    expect(isBuildableCell(15, 7)).toBe(false);
  });

  it('経路セル集合は盤内の通過点を含む', () => {
    const cells = pathCells();
    expect(cells.has('0,1')).toBe(true);
    expect(cells.has('12,1')).toBe(true);
    expect(cells.has('2,7')).toBe(true);
    expect(cells.has('5,2')).toBe(false);
  });
});
