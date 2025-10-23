// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { GRID_W, GRID_H } from './lib/game';

// main.ts は読み込み時に boot() が一度だけ走り、rAFループとキー操作を結線する。
beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  // jsdomにはrequestAnimationFrameが無いので最小限を補う。
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(
        () => cb(performance.now()),
        16,
      ) as unknown as number) as typeof requestAnimationFrame;
  }
  await import('./main');
});

function press(key: string, code = ''): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
}

describe('UI のDOM結線', () => {
  it('盤面と床セルを描画する', () => {
    const field = document.getElementById('field');
    expect(field).toBeTruthy();
    expect(field!.querySelectorAll('.cell-bg')).toHaveLength(GRID_W * GRID_H);
    expect(field!.querySelector('.path-stroke')).toBeTruthy();
  });

  it('HUDに資金・残機・ウェーブを表示する', () => {
    expect(Number(document.getElementById('gold')?.textContent)).toBeGreaterThan(0);
    expect(Number(document.getElementById('lives')?.textContent)).toBeGreaterThan(0);
    expect(document.getElementById('wave')?.textContent).toContain('/');
  });

  it('塔パレットに4種を並べる', () => {
    expect(document.querySelectorAll('.tower-btn')).toHaveLength(4);
  });

  it('数字キーで塔を選ぶとパレットが押下状態になる', () => {
    press('1', 'Digit1');
    const first = document.querySelector('.tower-btn') as HTMLButtonElement;
    expect(first.getAttribute('aria-pressed')).toBe('true');
    press('1', 'Digit1'); // もう一度で解除
    expect(first.getAttribute('aria-pressed')).toBe('false');
  });

  it('ウェーブ開始ボタンで例外を投げない', () => {
    expect(() => {
      (document.getElementById('wave-btn') as HTMLButtonElement).click();
    }).not.toThrow();
  });

  it('難易度をセグメントで切り替えられる', () => {
    const hard = document.querySelector('.seg-btn[data-diff="hard"]') as HTMLButtonElement;
    hard.click();
    expect(hard.getAttribute('aria-pressed')).toBe('true');
    const normal = document.querySelector('.seg-btn[data-diff="normal"]') as HTMLButtonElement;
    expect(normal.getAttribute('aria-pressed')).toBe('false');
    normal.click(); // 後続のテストのため標準へ戻す
  });

  it('盤面フォーカス中の方向キーとEnterで塔を置ける', () => {
    document.querySelector<HTMLButtonElement>('.tower-btn[data-kind="arrow"]')!.click();
    const field = document.getElementById('field') as unknown as HTMLElement;
    field.focus();
    if (document.activeElement !== field) return; // 環境がSVGフォーカス未対応なら検証を省く
    const before = document.querySelectorAll('.tower').length;
    press('ArrowUp'); // 中央(経路上)から上の空きマスへ
    press('ArrowUp');
    press('Enter');
    expect(document.querySelectorAll('.tower').length).toBeGreaterThan(before);
  });
});
