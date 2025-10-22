import { DIFFICULTY_ORDER } from './enemies';
import type { Difficulty, Status } from './types';

/** プレイ記録。難易度ごとの最高到達ウェーブと勝利数、総プレイ数を持つ。 */
export interface Records {
  /** 難易度ごとの最高到達ウェーブ(1始まり、未プレイは0)。 */
  bestWave: Record<Difficulty, number>;
  /** 難易度ごとの勝利数。 */
  wins: Record<Difficulty, number>;
  /** 決着のついた総プレイ数。 */
  plays: number;
}

export function emptyRecords(): Records {
  return {
    bestWave: { easy: 0, normal: 0, hard: 0 },
    wins: { easy: 0, normal: 0, hard: 0 },
    plays: 0,
  };
}

/**
 * 決着した1ゲームを記録へ反映し、新しいRecordsを返す(引数は変更しない)。
 * waveReachedは1始まりの到達ウェーブ。
 */
export function recordOutcome(
  base: Records,
  difficulty: Difficulty,
  status: Exclude<Status, 'playing'>,
  waveReached: number,
): Records {
  const next: Records = {
    bestWave: { ...base.bestWave },
    wins: { ...base.wins },
    plays: base.plays + 1,
  };
  next.bestWave[difficulty] = Math.max(
    base.bestWave[difficulty],
    Math.max(0, Math.floor(waveReached)),
  );
  if (status === 'won') next.wins[difficulty] += 1;
  return next;
}

/** 壊れた・古い保存値からも安全にRecordsを組み立てる。 */
export function parseRecords(raw: string | null): Records {
  const base = emptyRecords();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw) as Partial<Records>;
    for (const d of DIFFICULTY_ORDER) {
      base.bestWave[d] = clamp(data.bestWave?.[d]);
      base.wins[d] = clamp(data.wins?.[d]);
    }
    base.plays = clamp(data.plays);
    return base;
  } catch {
    return base;
  }
}

function clamp(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}
