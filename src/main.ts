import './style.css';
import { Game, GRID_W, GRID_H } from './lib/game';
import { PATH } from './lib/path';
import {
  TOWERS,
  TOWER_KINDS,
  effectiveDamage,
  effectiveRange,
  MAX_LEVEL,
  upgradeCost,
} from './lib/towers';
import { DIFFICULTIES, DIFFICULTY_ORDER } from './lib/enemies';
import { parseRecords, recordOutcome, type Records } from './lib/records';
import type { Difficulty, Enemy, Status, Tower, TowerKind } from './lib/types';

const CELL = 44;
const W = GRID_W * CELL;
const H = GRID_H * CELL;
const SVGNS = 'http://www.w3.org/2000/svg';

// 設定の永続化。プライベートモードでは例外になり得るので失敗を握りつぶす。
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 保存不可なら諦める */
    }
  },
};

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function center(cell: number): number {
  return (cell + 0.5) * CELL;
}

const LOGO = `
<svg class="logo" viewBox="0 0 64 64" role="img" aria-labelledby="logo-title">
  <title id="logo-title">mamori</title>
  <path d="M32 6l22 8v14c0 14-9 23-22 30C19 51 10 42 10 28V14z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M22 32l7 7 13-15" fill="none" stroke="var(--logo-accent, #138a5a)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function towerCoreMarkup(kind: TowerKind): string {
  const body = '<rect x="-13" y="-13" width="26" height="26" rx="6" class="tower-body"/>';
  const core: Record<TowerKind, string> = {
    arrow: '<polygon points="0,-8 7,6 -7,6" class="tower-core"/>',
    cannon: '<circle r="7" class="tower-core"/>',
    frost: '<polygon points="0,-9 9,0 0,9 -9,0" class="tower-core"/>',
    sniper: '<polygon points="0,-10 5,8 -5,8" class="tower-core"/>',
  };
  return body + core[kind];
}

function towerButtons(): string {
  return TOWER_KINDS.map((kind) => {
    const def = TOWERS[kind];
    return `<button class="tower-btn t-${kind}" data-kind="${kind}" type="button" aria-pressed="false">
      <svg class="swatch" viewBox="-16 -16 32 32" aria-hidden="true">${towerCoreMarkup(kind)}</svg>
      <span class="tname">${def.name}</span>
      <span class="tcost">${def.cost}</span>
      <span class="tdesc">${def.description}</span>
    </button>`;
  }).join('');
}

function difficultyControl(): string {
  const btns = DIFFICULTY_ORDER.map(
    (d) =>
      `<button class="seg-btn" type="button" data-diff="${d}" aria-pressed="false">${DIFFICULTIES[d].label}</button>`,
  ).join('');
  return `<div class="seg" id="difficulty" role="group" aria-label="難易度を選ぶ">${btns}</div>`;
}

const SHELL = `
<header class="site-header">
  <div class="brand">
    ${LOGO}
    <div>
      <h1>mamori</h1>
      <div class="tagline">経路を進む敵を塔で迎え撃つ</div>
    </div>
  </div>
  <div class="header-tools">
    <button id="theme" type="button">テーマ: 自動</button>
    <button id="newgame" type="button">最初から</button>
  </div>
</header>

<main class="layout">
  <section class="pane board-pane">
    <div class="hud">
      <span class="stat gold"><span class="label">資金</span><span class="value" id="gold">0</span></span>
      <span class="stat lives"><span class="label">残機</span><span class="value" id="lives">0</span></span>
      <span class="stat wave"><span class="label">ウェーブ</span><span class="value" id="wave">0 / 0</span></span>
      <span class="stat best"><span class="label">最高</span><span class="value" id="best">W0</span></span>
      <span class="spacer"></span>
      <span class="stat"><span class="label" id="speed-label">速度 1x</span></span>
    </div>
    <svg id="field" viewBox="0 0 ${W} ${H}" role="application" aria-label="防衛盤面。塔を配置して敵を止める"></svg>
    <div class="banner" id="banner" role="status"></div>
  </section>

  <aside class="side">
    <section class="side-sec">
      <h2>難易度</h2>
      ${difficultyControl()}
      <dl class="records" id="records"></dl>
    </section>

    <section class="side-sec">
      <h2>塔を建てる</h2>
      <div class="palette" id="palette">${towerButtons()}</div>
    </section>

    <section class="side-sec">
      <h2>操作</h2>
      <div class="controls">
        <button class="wave-btn primary" id="wave-btn" type="button">ウェーブ開始</button>
        <div class="row">
          <button id="pause" type="button">一時停止</button>
          <button id="speed" type="button">2倍速</button>
        </div>
      </div>
    </section>

    <section class="side-sec" id="sel-section" hidden>
      <h2>選択中の塔</h2>
      <div class="selinfo" id="selinfo"></div>
    </section>

    <section class="side-sec">
      <h2>実況</h2>
      <div class="log" id="log" aria-hidden="true"></div>
      <div id="announcer" aria-live="polite" class="sr-only"></div>
    </section>
  </aside>
</main>

<footer class="site-footer">
  数字キー1-4で塔を選び、盤面をクリックで設置。スペースでウェーブ開始/一時停止。
  <a href="https://github.com/miruky/mamori">ソース</a>
</footer>`;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`要素が見つからない: ${id}`);
  return node as T;
}

function loadDifficulty(): Difficulty {
  const v = store.get('mamori-difficulty');
  return v === 'easy' || v === 'hard' ? v : 'normal';
}

class UI {
  private difficulty: Difficulty = loadDifficulty();
  private records: Records = parseRecords(store.get('mamori-records'));
  private game = new Game({ difficulty: this.difficulty });
  private prevStatus: Status = 'playing';
  private selectedKind: TowerKind | null = null;
  private selectedTowerId: number | null = null;
  private hoverCell: { x: number; y: number } | null = null;
  private speed = 1;
  private paused = false;
  private lastTime = 0;
  private lastNotices = 0;

  private field = el<HTMLElement>('field') as unknown as SVGSVGElement;
  private gridLayer = svg('g', { 'aria-hidden': 'true' });
  private pathLayer = svg('g', { 'aria-hidden': 'true' });
  private rangeLayer = svg('g', { 'aria-hidden': 'true' });
  private hintRect = svg('rect', { class: 'build-hint', width: CELL, height: CELL, rx: 4 });
  private towerLayer = svg('g');
  private enemyLayer = svg('g');
  private projLayer = svg('g');
  private enemyEls = new Map<number, SVGGElement>();
  private projEls = new Map<number, SVGCircleElement>();

  constructor() {
    this.buildField();
    this.bind();
    this.refreshTowers();
    this.syncDifficulty();
    this.render(); // 最初のフレームを待たずに初期状態を描く
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  private syncDifficulty(): void {
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#difficulty .seg-btn')) {
      const on = btn.dataset.diff === this.difficulty;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    this.renderRecords();
  }

  private renderRecords(): void {
    const best = this.records.bestWave[this.difficulty];
    const wins = this.records.wins[this.difficulty];
    el('records').innerHTML =
      `<div><dt>最高到達</dt><dd>${best ? `ウェーブ ${best}` : '—'}</dd></div>` +
      `<div><dt>勝利</dt><dd>${wins} 回</dd></div>`;
    el('best').textContent = `W${best}`;
  }

  private setDifficulty(d: Difficulty): void {
    if (d === this.difficulty) return;
    this.difficulty = d;
    store.set('mamori-difficulty', d);
    this.reset(); // 難易度の変更は新しいゲームから始める
    this.syncDifficulty();
  }

  private recordEndIfFinished(): void {
    const status = this.game.status;
    if (status !== 'playing' && this.prevStatus === 'playing') {
      const reached = status === 'won' ? this.game.totalWaves : this.game.waveIndex + 1;
      this.records = recordOutcome(this.records, this.difficulty, status, Math.max(0, reached));
      store.set('mamori-records', JSON.stringify(this.records));
      this.renderRecords();
    }
    this.prevStatus = status;
  }

  private buildField(): void {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        this.gridLayer.appendChild(
          svg('rect', {
            class: `cell-bg ${(x + y) % 2 ? 'odd' : ''}`,
            x: x * CELL,
            y: y * CELL,
            width: CELL,
            height: CELL,
          }),
        );
      }
    }
    const d = PATH.map((p, i) => `${i === 0 ? 'M' : 'L'}${center(p.x)} ${center(p.y)}`).join(' ');
    this.pathLayer.appendChild(svg('path', { class: 'path-edge', d, 'stroke-width': CELL * 0.78 }));
    this.pathLayer.appendChild(
      svg('path', { class: 'path-stroke', d, 'stroke-width': CELL * 0.64 }),
    );

    this.field.append(
      this.gridLayer,
      this.pathLayer,
      this.rangeLayer,
      this.hintRect,
      this.towerLayer,
      this.projLayer,
      this.enemyLayer,
    );
  }

  // --- 静的レイヤ(塔・射程)の再構築 --------------------------------------

  private refreshTowers(): void {
    this.towerLayer.replaceChildren();
    for (const t of this.game.towers) this.towerLayer.appendChild(this.towerNode(t));
    this.refreshRange();
    this.refreshSelInfo();
  }

  private towerNode(t: Tower): SVGGElement {
    const g = svg('g', {
      class: `tower t-${t.kind}`,
      transform: `translate(${center(t.cx)} ${center(t.cy)})`,
    });
    if (t.id === this.selectedTowerId) g.appendChild(svg('circle', { class: 'tower-sel', r: 15 }));
    g.insertAdjacentHTML('beforeend', towerCoreMarkup(t.kind));
    for (let i = 0; i < t.level; i++) {
      g.appendChild(svg('circle', { class: 'tower-lv', cx: -6 + i * 6, cy: 11, r: 1.7 }));
    }
    return g;
  }

  private refreshRange(): void {
    this.rangeLayer.replaceChildren();
    let cx: number | null = null;
    let cy: number | null = null;
    let range = 0;
    const sel = this.game.towers.find((t) => t.id === this.selectedTowerId);
    if (sel) {
      cx = sel.cx;
      cy = sel.cy;
      range = effectiveRange(TOWERS[sel.kind], sel.level);
    } else if (
      this.selectedKind &&
      this.hoverCell &&
      this.game.canPlace(this.hoverCell.x, this.hoverCell.y)
    ) {
      cx = this.hoverCell.x;
      cy = this.hoverCell.y;
      range = TOWERS[this.selectedKind].range;
    }
    if (cx !== null && cy !== null) {
      this.rangeLayer.appendChild(
        svg('circle', { class: 'range-ring', cx: center(cx), cy: center(cy), r: range * CELL }),
      );
    }
  }

  // --- 毎フレーム描画(敵・投射物) ----------------------------------------

  private frame(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    if (!this.paused && this.game.status === 'playing') this.game.step(dt * this.speed);
    this.recordEndIfFinished();
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  private render(): void {
    this.renderEnemies();
    this.renderProjectiles();
    this.renderHud();
  }

  private renderEnemies(): void {
    const seen = new Set<number>();
    for (const e of this.game.enemies) {
      seen.add(e.id);
      let node = this.enemyEls.get(e.id);
      if (!node) {
        node = this.makeEnemyNode(e);
        this.enemyEls.set(e.id, node);
        this.enemyLayer.appendChild(node);
      }
      const p = this.game.enemyPos(e);
      node.setAttribute('transform', `translate(${center(p.x)} ${center(p.y)})`);
      const barW = CELL * 0.56;
      const fill = node.querySelector('.hp-fill') as SVGRectElement;
      fill.setAttribute('width', String(Math.max(0, (e.hp / e.maxHp) * barW)));
      const slow = node.querySelector('.enemy-slow') as SVGCircleElement;
      slow.setAttribute('opacity', e.slowTimer > 0 ? '1' : '0');
    }
    for (const [id, node] of this.enemyEls) {
      if (!seen.has(id)) {
        node.remove();
        this.enemyEls.delete(id);
      }
    }
  }

  private makeEnemyNode(e: Enemy): SVGGElement {
    const r = e.def.size * CELL;
    const barW = CELL * 0.56;
    const g = svg('g', { class: 'enemy enemy-enter' });
    g.appendChild(svg('circle', { class: `enemy-body e-${e.def.tint}`, r }));
    g.appendChild(svg('circle', { class: 'enemy-slow', r: r + 1.5, fill: 'none', opacity: 0 }));
    g.appendChild(
      svg('rect', { class: 'hp-bg', x: -barW / 2, y: -r - 6, width: barW, height: 3, rx: 1 }),
    );
    g.appendChild(
      svg('rect', { class: 'hp-fill', x: -barW / 2, y: -r - 6, width: barW, height: 3, rx: 1 }),
    );
    return g;
  }

  private renderProjectiles(): void {
    const seen = new Set<number>();
    for (const p of this.game.projectiles) {
      seen.add(p.id);
      let node = this.projEls.get(p.id);
      if (!node) {
        node = svg('circle', { class: `proj p-${p.tint}`, r: p.splash ? 4 : 2.6 });
        this.projEls.set(p.id, node);
        this.projLayer.appendChild(node);
      }
      node.setAttribute('cx', String(center(p.x)));
      node.setAttribute('cy', String(center(p.y)));
    }
    for (const [id, node] of this.projEls) {
      if (!seen.has(id)) {
        node.remove();
        this.projEls.delete(id);
      }
    }
  }

  private renderHud(): void {
    const g = this.game;
    el('gold').textContent = String(g.gold);
    el('lives').textContent = String(g.lives);
    el('wave').textContent = `${Math.max(0, g.waveIndex + 1)} / ${g.totalWaves}`;

    const waveBtn = el<HTMLButtonElement>('wave-btn');
    if (!g.hasNextWave && !g.waveActive) {
      waveBtn.disabled = true;
      waveBtn.textContent = '最終ウェーブ';
    } else if (g.waveActive) {
      waveBtn.disabled = true;
      waveBtn.textContent = 'ウェーブ進行中';
    } else {
      waveBtn.disabled = g.status !== 'playing';
      waveBtn.textContent = `ウェーブ ${g.waveIndex + 2} を開始`;
    }

    for (const btn of document.querySelectorAll<HTMLButtonElement>('.tower-btn')) {
      const def = TOWERS[btn.dataset.kind as TowerKind];
      btn.disabled = g.gold < def.cost || g.status !== 'playing';
    }

    if (g.notices.length !== this.lastNotices) {
      this.renderLog();
      this.lastNotices = g.notices.length;
    }
    this.renderBanner();
  }

  private renderLog(): void {
    const box = el('log');
    const fresh = this.game.notices.slice(Math.max(0, this.lastNotices)).map((n) => n.text);
    box.replaceChildren();
    for (const n of this.game.notices.slice(-12)) {
      const line = document.createElement('div');
      line.className = `line tint-${n.tint}`;
      line.textContent = n.text;
      box.appendChild(line);
    }
    box.scrollTop = box.scrollHeight;
    if (fresh.length) el('announcer').textContent = fresh.join(' ');
  }

  private renderBanner(): void {
    const banner = el('banner');
    if (this.game.status === 'playing') {
      if (banner.classList.contains('show')) banner.className = 'banner';
      return;
    }
    if (banner.classList.contains('show')) return;
    banner.className = `banner show ${this.game.status}`;
    const msg =
      this.game.status === 'won'
        ? '<b>防衛成功。</b> すべての波を退けた。'
        : `<b>突破された。</b> ウェーブ ${this.game.waveIndex + 1} で防衛線が崩れた。`;
    banner.innerHTML = `${msg}<div><button id="retry" type="button" class="primary">もう一度</button></div>`;
    el<HTMLButtonElement>('retry').addEventListener('click', () => this.reset());
  }

  private refreshSelInfo(): void {
    const section = el('sel-section');
    const sel = this.game.towers.find((t) => t.id === this.selectedTowerId);
    if (!sel) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    const def = TOWERS[sel.kind];
    const up = sel.level < MAX_LEVEL ? upgradeCost(def, sel.level) : null;
    const refund = Math.floor(sel.invested * 0.6);
    el('selinfo').innerHTML = `
      <div class="title t-${sel.kind}">${def.name}(Lv${sel.level})</div>
      <div class="stats">
        <span>威力</span><span class="v">${effectiveDamage(def, sel.level)}</span>
        <span>射程</span><span class="v">${effectiveRange(def, sel.level).toFixed(1)}</span>
        <span>連射</span><span class="v">${def.fireRate.toFixed(1)}/秒</span>
      </div>
      <div class="actions">
        ${up !== null ? `<button id="upgrade" type="button">強化 ${up}</button>` : ''}
        <button id="sell" type="button">売却 ${refund}</button>
      </div>`;
    const upBtn = document.getElementById('upgrade') as HTMLButtonElement | null;
    if (upBtn) {
      upBtn.disabled = up === null || this.game.gold < up;
      upBtn.addEventListener('click', () => {
        if (this.selectedTowerId !== null) {
          this.game.upgradeTower(this.selectedTowerId);
          this.refreshTowers();
        }
      });
    }
    el<HTMLButtonElement>('sell').addEventListener('click', () => {
      if (this.selectedTowerId !== null) {
        this.game.sellTower(this.selectedTowerId);
        this.selectedTowerId = null;
        this.refreshTowers();
      }
    });
  }

  // --- 入力 -----------------------------------------------------------------

  private cellFromEvent(e: MouseEvent): { x: number; y: number } {
    const rect = this.field.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { x: Math.floor(x / CELL), y: Math.floor(y / CELL) };
  }

  private selectKind(kind: TowerKind | null): void {
    this.selectedKind = kind;
    if (kind) this.selectedTowerId = null;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('.tower-btn')) {
      const on = btn.dataset.kind === kind;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    this.refreshTowers();
  }

  private selectTower(id: number | null): void {
    this.selectedTowerId = id;
    if (id !== null) this.selectKind(null);
    else this.refreshTowers();
  }

  private onFieldClick(e: MouseEvent): void {
    const cell = this.cellFromEvent(e);
    const existing = this.game.towerAt(cell.x, cell.y);
    if (this.selectedKind && this.game.canPlace(cell.x, cell.y)) {
      this.game.placeTower(this.selectedKind, cell.x, cell.y);
      this.refreshTowers();
    } else if (existing) {
      this.selectTower(existing.id);
    } else {
      this.selectKind(null);
      this.selectTower(null);
    }
  }

  private onFieldMove(e: PointerEvent): void {
    const cell = this.cellFromEvent(e);
    this.hoverCell = cell;
    if (!this.selectedKind) {
      this.hintRect.classList.remove('show', 'blocked');
      return;
    }
    this.hintRect.setAttribute('x', String(cell.x * CELL));
    this.hintRect.setAttribute('y', String(cell.y * CELL));
    const ok = this.game.canPlace(cell.x, cell.y);
    this.hintRect.classList.add('show');
    this.hintRect.classList.toggle('blocked', !ok);
    this.refreshRange();
  }

  private setSpeed(s: number): void {
    this.speed = s;
    el('speed').textContent = s === 1 ? '2倍速' : s === 2 ? '3倍速' : '等速';
    el('speed-label').textContent = `速度 ${s}x`;
  }

  private togglePause(): void {
    this.paused = !this.paused;
    el('pause').textContent = this.paused ? '再開' : '一時停止';
  }

  private reset(): void {
    this.game = new Game({ difficulty: this.difficulty });
    this.prevStatus = 'playing';
    this.selectedKind = null;
    this.selectedTowerId = null;
    this.lastNotices = 0;
    this.paused = false;
    this.setSpeed(1);
    el('pause').textContent = '一時停止';
    for (const node of this.enemyEls.values()) node.remove();
    this.enemyEls.clear();
    for (const node of this.projEls.values()) node.remove();
    this.projEls.clear();
    el('banner').className = 'banner';
    this.selectKind(null);
    this.refreshTowers();
  }

  private bind(): void {
    this.field.addEventListener('click', (e) => this.onFieldClick(e));
    this.field.addEventListener('pointermove', (e) => this.onFieldMove(e));
    this.field.addEventListener('pointerleave', () => {
      this.hoverCell = null;
      this.hintRect.classList.remove('show', 'blocked');
    });

    el('palette').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.tower-btn') as HTMLButtonElement | null;
      if (!btn) return;
      const kind = btn.dataset.kind as TowerKind;
      this.selectKind(this.selectedKind === kind ? null : kind);
    });

    el('difficulty').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.seg-btn') as HTMLButtonElement | null;
      if (btn) this.setDifficulty(btn.dataset.diff as Difficulty);
    });

    el<HTMLButtonElement>('wave-btn').addEventListener('click', () => {
      this.game.startWave();
      this.renderHud();
    });
    el<HTMLButtonElement>('pause').addEventListener('click', () => this.togglePause());
    el<HTMLButtonElement>('speed').addEventListener('click', () => {
      this.setSpeed(this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1);
    });
    el<HTMLButtonElement>('newgame').addEventListener('click', () => this.reset());
    el<HTMLButtonElement>('theme').addEventListener('click', () => cycleTheme());

    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    const digit = /^Digit([1-4])$/.exec(e.code);
    if (digit) {
      const kind = TOWER_KINDS[Number(digit[1]) - 1]!;
      this.selectKind(this.selectedKind === kind ? null : kind);
      return;
    }
    if (e.key === 'Escape') {
      this.selectKind(null);
      this.selectTower(null);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (this.game.waveActive || !this.game.hasNextWave) this.togglePause();
      else this.game.startWave();
    } else if (e.key === 'p') {
      this.togglePause();
    } else if (e.key === 'u' && this.selectedTowerId !== null) {
      this.game.upgradeTower(this.selectedTowerId);
      this.refreshTowers();
    } else if (e.key === 's' && this.selectedTowerId !== null) {
      this.game.sellTower(this.selectedTowerId);
      this.selectedTowerId = null;
      this.refreshTowers();
    }
  }
}

function cycleTheme(): void {
  const order = ['auto', 'light', 'dark'] as const;
  const cur = (store.get('mamori-theme') as (typeof order)[number]) || 'auto';
  const next = order[(order.indexOf(cur) + 1) % order.length]!;
  store.set('mamori-theme', next);
  applyTheme(next);
}

function applyTheme(mode: 'auto' | 'light' | 'dark'): void {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const label = { auto: '自動', light: '明', dark: '暗' }[mode];
  const btn = document.getElementById('theme');
  if (btn) btn.textContent = `テーマ: ${label}`;
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = SHELL;
  applyTheme((store.get('mamori-theme') as 'auto' | 'light' | 'dark') || 'auto');
  new UI();
}

boot();
