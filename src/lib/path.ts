import type { Vec } from './types';

// 盤面はセル格子。経路は折れ線(軸並行)で定義し、敵はその上を距離で進む。
export const GRID_W = 15;
export const GRID_H = 9;

// 経路の通過点(セル中心の座標)。左外から入り、S字に折れて右外へ抜ける。
export const PATH: readonly Vec[] = [
  { x: -1, y: 1 },
  { x: 12, y: 1 },
  { x: 12, y: 4 },
  { x: 2, y: 4 },
  { x: 2, y: 7 },
  { x: 15, y: 7 },
];

interface Segment {
  from: Vec;
  to: Vec;
  len: number;
  acc: number; // この区間の始点までの累積距離
}

function buildSegments(points: readonly Vec[]): { segments: Segment[]; total: number } {
  const segments: Segment[] = [];
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const len = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    segments.push({ from, to, len, acc });
    acc += len;
  }
  return { segments, total: acc };
}

const { segments: SEGMENTS, total: TOTAL } = buildSegments(PATH);

/** 経路全長(セル)。 */
export const PATH_LENGTH = TOTAL;

/** 経路上、始点からの距離distの位置を返す(範囲外はクランプ)。 */
export function pointAt(dist: number): Vec {
  const d = Math.max(0, Math.min(dist, TOTAL));
  for (const seg of SEGMENTS) {
    if (d <= seg.acc + seg.len || seg === SEGMENTS[SEGMENTS.length - 1]) {
      const t = seg.len === 0 ? 0 : (d - seg.acc) / seg.len;
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * t,
        y: seg.from.y + (seg.to.y - seg.from.y) * t,
      };
    }
  }
  return { ...PATH[PATH.length - 1]! };
}

/** 経路が通過する盤内セルの集合("x,y")。塔はここには建てられない。 */
export function pathCells(): Set<string> {
  const cells = new Set<string>();
  for (const seg of SEGMENTS) {
    const dx = Math.sign(seg.to.x - seg.from.x);
    const dy = Math.sign(seg.to.y - seg.from.y);
    let x = seg.from.x;
    let y = seg.from.y;
    const steps = seg.len;
    for (let i = 0; i <= steps; i++) {
      if (x >= 0 && y >= 0 && x < GRID_W && y < GRID_H) cells.add(`${x},${y}`);
      x += dx;
      y += dy;
    }
  }
  return cells;
}

const PATH_CELLS = pathCells();

/** (cx,cy)が盤内かつ経路上でなければ建設可能。 */
export function isBuildableCell(cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return false;
  return !PATH_CELLS.has(`${cx},${cy}`);
}
