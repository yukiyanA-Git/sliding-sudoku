/**
 * スライド数独 盤面管理・スライド操作・状態検証モジュール
 */
const _SudokuGenerator = (function() {
  if (typeof window !== 'undefined' && window.SudokuGenerator) {
    return window.SudokuGenerator;
  }
  if (typeof SudokuGenerator !== 'undefined') {
    return SudokuGenerator;
  }
  if (typeof require !== 'undefined') {
    return require('./sudoku-generator.js');
  }
  return null;
})();

class SlidingBoard {
  /**
   * 難易度設定の定義
   */
  static DIFFICULTIES = {
    beginner: {
      id: 'beginner',
      name: '入門 (Beginner)',
      emptyPerBlock: 3,
      fixedPerBlock: 3,
      shuffleMoves: 8,
      description: '空きマス3個・固定数字3個。移動自由度が高く揃えやすい初心者向け。'
    },
    normal: {
      id: 'normal',
      name: '中級 (Normal)',
      emptyPerBlock: 2,
      fixedPerBlock: 2,
      shuffleMoves: 20,
      description: '空きマス2個・固定数字2個。スライドの手順と数独の推理を楽しむ標準モード。'
    },
    hard: {
      id: 'hard',
      name: '上級 (Hard)',
      emptyPerBlock: 1,
      fixedPerBlock: 1,
      shuffleMoves: 40,
      description: '空きマス1個・固定数字1個。各ブロックが本格的な8パズルとなる高難易度。'
    },
    master: {
      id: 'master',
      name: '達人 (Master)',
      emptyPerBlock: 1,
      fixedPerBlock: 0,
      shuffleMoves: 60,
      description: '空きマス1個・固定数字なし。全8タイル可動の8パズル×9面の最高難度。'
    }
  };

  constructor(difficultyId = 'normal') {
    this.difficulty = SlidingBoard.DIFFICULTIES[difficultyId] || SlidingBoard.DIFFICULTIES.normal;
    this.grid = [];           // 9x9 セルオブジェクト配列
    this.goalGrid = [];       // 9x9 ゴール（正解）セル配列
    this.moveHistory = [];    // プレイヤーの移動履歴（Undo用）
    this.redoHistory = [];    // Redo用
    this.shuffleHistory = []; // 初期生成時のシャッフル履歴
    this.moveCount = 0;
    this.startTime = null;
    this.endTime = null;
    this.isCompleted = false;

    this.initNewGame();
  }

  /**
   * 新しいゲーム盤面を生成
   */
  initNewGame() {
    // 1. 完全な正解数独盤面を生成（9x9）
    const completeBoard = _SudokuGenerator.generateCompleteBoard();

    // 2. セル初期化
    let tileIdCounter = 1;
    this.grid = Array.from({ length: 9 }, () => Array(9).fill(null));
    this.goalGrid = Array.from({ length: 9 }, () => Array(9).fill(null));

    // 各3x3ブロックごとに属性（空きマス、固定数字、可動タイル）を決定
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const emptyCount = this.difficulty.emptyPerBlock;
        const fixedCount = this.difficulty.fixedPerBlock;

        // 固定数字に囲まれて可動タイルが孤立しないよう、連結グラフを保証して配置
        const { emptyPositions, fixedPositions } = this._generateConnectedBlockLayout(br, bc, emptyCount, fixedCount);

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const gr = br * 3 + r;
            const gc = bc * 3 + c;
            const key = `${gr},${gc}`;
            const val = completeBoard[gr][gc];
            let type = 'movable';
            let cellVal = val;

            if (emptyPositions.has(key)) {
              type = 'empty';
              cellVal = 0;
            } else if (fixedPositions.has(key)) {
              type = 'fixed';
              cellVal = val;
            }

            const cellData = {
              id: type === 'empty' ? `empty-${gr}-${gc}` : `tile-${tileIdCounter++}`,
              val: cellVal,
              goalVal: cellVal, // ゴール時の値
              type: type,
              goalType: type,
              r: gr,
              c: gc,
              origR: gr,
              origC: gc
            };

            this.grid[gr][gc] = { ...cellData };
            this.goalGrid[gr][gc] = { ...cellData };
          }
        }
      }
    }

    // 3. 各3x3ブロック内で合法手による逆スライドシャッフルを実施
    this.shuffleHistory = [];
    this._performReverseShuffle();

    // 履歴・統計リセット
    this.moveHistory = [];
    this.redoHistory = [];
    this.moveCount = 0;
    this.startTime = Date.now();
    this.endTime = null;
    this.isCompleted = false;
  }

  /**
   * 固定数字によって可動マスが壁で囲まれて孤立（移動不能）しないよう、
   * 非固定マス（可動＋空き）が4方向で1つの連結成分を形成する配置を生成する
   */
  _generateConnectedBlockLayout(br, bc, emptyCount, fixedCount) {
    const localCoords = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        localCoords.push({ r, c });
      }
    }

    let fixedCoords = [];
    let attempts = 0;

    while (attempts < 200) {
      attempts++;
      // localCoords をランダムシャッフル
      const shuffled = [...localCoords].sort(() => Math.random() - 0.5);
      const candFixed = shuffled.slice(0, fixedCount);
      const candFixedKeys = new Set(candFixed.map(p => `${p.r},${p.c}`));
      const nonFixed = localCoords.filter(p => !candFixedKeys.has(`${p.r},${p.c}`));

      // 非固定マス全体の4方向連結性をBFSで判定
      if (this._isNonFixedConnected(nonFixed, candFixedKeys)) {
        fixedCoords = candFixed;
        break;
      }
    }

    // 万が一のフォールバック（必ず連結になる配置）
    if (fixedCoords.length < fixedCount) {
      fixedCoords = [];
      for (let c = 0; c < fixedCount; c++) {
        fixedCoords.push({ r: 0, c });
      }
    }

    // グローバル座標のSetに変換
    const fixedPositions = new Set(
      fixedCoords.map(p => `${br * 3 + p.r},${bc * 3 + p.c}`)
    );
    const fixedSetLocal = new Set(fixedCoords.map(p => `${p.r},${p.c}`));

    // 残りの非固定マスから空きマスを選択
    const nonFixed = localCoords.filter(p => !fixedSetLocal.has(`${p.r},${p.c}`));
    const shuffledNonFixed = [...nonFixed].sort(() => Math.random() - 0.5);
    const emptyPositions = new Set(
      shuffledNonFixed.slice(0, emptyCount).map(p => `${br * 3 + p.r},${bc * 3 + p.c}`)
    );

    return { emptyPositions, fixedPositions };
  }

  /**
   * 3x3ブロック内の非固定マスが4方向で1つの連結成分になっているかをBFSで検証
   */
  _isNonFixedConnected(nonFixed, fixedKeys) {
    if (nonFixed.length <= 1) return true;

    const visited = new Set();
    const queue = [nonFixed[0]];
    visited.add(`${nonFixed[0].r},${nonFixed[0].c}`);

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
          const key = `${nr},${nc}`;
          if (!fixedKeys.has(key) && !visited.has(key)) {
            visited.add(key);
            queue.push({ r: nr, c: nc });
          }
        }
      }
    }

    return visited.size === nonFixed.length;
  }

  /**
   * 各3x3ブロックで合法手を逆順にシャッフル
   */
  _performReverseShuffle() {
    const movesTarget = this.difficulty.shuffleMoves;

    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        let lastMovedTileId = null;

        for (let step = 0; step < movesTarget; step++) {
          // このブロック内の空きマスを探す
          const emptyCells = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const cell = this.grid[br * 3 + r][bc * 3 + c];
              if (cell.type === 'empty') {
                emptyCells.push(cell);
              }
            }
          }

          // 空きマスに隣接する可動タイルを探す
          const candidateMoves = [];
          const dirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1]
          ];

          for (const emptyCell of emptyCells) {
            for (const [dr, dc] of dirs) {
              const nr = emptyCell.r + dr;
              const nc = emptyCell.c + dc;
              // 同じブロック内かチェック
              if (
                Math.floor(nr / 3) === br &&
                Math.floor(nc / 3) === bc
              ) {
                const neighbor = this.grid[nr][nc];
                if (neighbor.type === 'movable') {
                  candidateMoves.push({
                    tile: neighbor,
                    targetEmpty: emptyCell
                  });
                }
              }
            }
          }

          if (candidateMoves.length === 0) break;

          // 直前の移動タイルの逆戻りを避ける（可能な場合）
          let validCandidates = candidateMoves;
          if (candidateMoves.length > 1 && lastMovedTileId) {
            const filtered = candidateMoves.filter(m => m.tile.id !== lastMovedTileId);
            if (filtered.length > 0) validCandidates = filtered;
          }

          const chosen = validCandidates[Math.floor(Math.random() * validCandidates.length)];
          this._swapCells(chosen.tile.r, chosen.tile.c, chosen.targetEmpty.r, chosen.targetEmpty.c);
          lastMovedTileId = chosen.tile.id;
          this.shuffleHistory.push({
            br, bc,
            from: { r: chosen.tile.r, c: chosen.tile.c },
            to: { r: chosen.targetEmpty.r, c: chosen.targetEmpty.c }
          });
        }
      }
    }
  }

  /**
   * 2つのセルの内容（オブジェクト・値・ID・属性）を確実にスワップし、現在座標を更新
   */
  _swapCells(r1, c1, r2, c2) {
    const temp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = temp;

    this.grid[r1][c1].r = r1;
    this.grid[r1][c1].c = c1;
    this.grid[r2][c2].r = r2;
    this.grid[r2][c2].c = c2;
  }


  /**
   * 指定セルから特定方向（'left' | 'right' | 'up' | 'down'）へのスライド手を探索
   * （隣接する空きマス、または同一直線上で空きマスに繋がるマルチスライドに対応）
   * @param {number} r 行 (0-8)
   * @param {number} c 列 (0-8)
   * @param {'left' | 'right' | 'up' | 'down'} dir 方向
   * @returns {Array<{fromR: number, fromC: number, toR: number, toC: number}> | null}
   */
  getMoveInDirection(r, c, dir) {
    const cell = this.grid[r][c];
    if (!cell || cell.type !== 'movable') return null;

    const br = Math.floor(r / 3);
    const bc = Math.floor(c / 3);

    const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;

    let currR = r + dr;
    let currC = c + dc;

    // 3x3ブロック境界内を移動
    while (
      Math.floor(currR / 3) === br &&
      Math.floor(currC / 3) === bc
    ) {
      const target = this.grid[currR][currC];
      if (target.type === 'fixed') {
        return null; // 固定数字によって遮られている
      }
      if (target.type === 'empty') {
        // 空きマス到達！手前のタイルから順に空きマス方向へ押し出す手順を生成
        const moves = [];
        let pushR = currR;
        let pushC = currC;
        while (pushR !== r || pushC !== c) {
          moves.push({
            fromR: pushR - dr,
            fromC: pushC - dc,
            toR: pushR,
            toC: pushC
          });
          pushR -= dr;
          pushC -= dc;
        }
        return moves;
      }
      // 他の可動タイルの場合はさらに先を探索（マルチスライド）
      currR += dr;
      currC += dc;
    }

    return null;
  }

  /**
   * 指定セルについて、移動可能な全方向（4方向＋縦横）の情報を取得
   * @param {number} r
   * @param {number} c
   */
  getAvailableSlideOptions(r, c) {
    const cell = this.grid[r][c];
    if (!cell || cell.type !== 'movable') {
      return {
        left: null,
        right: null,
        up: null,
        down: null,
        horizontal: null,
        vertical: null
      };
    }

    const left = this.getMoveInDirection(r, c, 'left');
    const right = this.getMoveInDirection(r, c, 'right');
    const up = this.getMoveInDirection(r, c, 'up');
    const down = this.getMoveInDirection(r, c, 'down');

    return {
      left,
      right,
      up,
      down,
      horizontal: left || right,
      vertical: up || down
    };
  }

  /**
   * 指定セルがスライド可能かチェックし、移動可能な空きマスへのルートを返す
   * @param {number} r 行 (0-8)
   * @param {number} c 列 (0-8)
   * @param {'left' | 'right' | 'up' | 'down' | 'horizontal' | 'vertical' | null} preferred 優先方向または優先軸
   * @returns {Array<{fromR: number, fromC: number, toR: number, toC: number}> | null}
   */
  getSlideMove(r, c, preferred = null) {
    const opts = this.getAvailableSlideOptions(r, c);

    if (preferred === 'left') return opts.left || opts.right || opts.up || opts.down;
    if (preferred === 'right') return opts.right || opts.left || opts.up || opts.down;
    if (preferred === 'up') return opts.up || opts.down || opts.left || opts.right;
    if (preferred === 'down') return opts.down || opts.up || opts.left || opts.right;

    if (preferred === 'horizontal') return opts.left || opts.right || opts.up || opts.down;
    if (preferred === 'vertical') return opts.up || opts.down || opts.left || opts.right;

    // preferred なしの場合は利用可能な手（上下・左右いずれか）
    return opts.up || opts.down || opts.left || opts.right;
  }

  /**
   * タイルのスライドを実行する
   * @param {number} r
   * @param {number} c
   * @param {'horizontal' | 'vertical' | null} preferredAxis
   * @returns {boolean} 移動が成功したかどうか
   */
  slideTile(r, c, preferredAxis = null) {
    if (this.isCompleted) return false;

    const moves = this.getSlideMove(r, c, preferredAxis);
    if (!moves || moves.length === 0) return false;

    // スワップを実行
    for (const m of moves) {
      this._swapCells(m.fromR, m.fromC, m.toR, m.toC);
    }

    this.moveCount++;
    this.moveHistory.push(moves);
    this.redoHistory = []; // 新たな手が行われたらRedoをクリア

    // クリア判定
    if (this.checkWinCondition()) {
      this.isCompleted = true;
      this.endTime = Date.now();
    }

    return true;
  }

  /**
   * 1手戻す (Undo)
   */
  undo() {
    if (this.moveHistory.length === 0 || this.isCompleted) return false;
    const moves = this.moveHistory.pop();

    // moves の逆順で巻き戻し
    for (let i = moves.length - 1; i >= 0; i--) {
      const m = moves[i];
      this._swapCells(m.toR, m.toC, m.fromR, m.fromC);
    }

    this.redoHistory.push(moves);
    this.moveCount++;
    return true;
  }

  /**
   * 1手進める (Redo)
   */
  redo() {
    if (this.redoHistory.length === 0 || this.isCompleted) return false;
    const moves = this.redoHistory.pop();

    for (const m of moves) {
      this._swapCells(m.fromR, m.fromC, m.toR, m.toC);
    }

    this.moveHistory.push(moves);
    this.moveCount++;

    if (this.checkWinCondition()) {
      this.isCompleted = true;
      this.endTime = Date.now();
    }

    return true;
  }

  /**
   * 行および列における重複（コンフリクト）を検出
   * 各セルについて conflict: boolean を設定したマップを返す
   */
  getConflicts() {
    const conflicts = Array.from({ length: 9 }, () => Array(9).fill(false));
    const duplicateCounts = { rows: 0, cols: 0, total: 0 };

    // 行チェック
    for (let r = 0; r < 9; r++) {
      const valMap = new Map();
      for (let c = 0; c < 9; c++) {
        const val = this.grid[r][c].val;
        if (val > 0) {
          if (!valMap.has(val)) valMap.set(val, []);
          valMap.get(val).push(c);
        }
      }
      for (const [val, cols] of valMap.entries()) {
        if (cols.length > 1) {
          duplicateCounts.rows += cols.length;
          for (const c of cols) {
            conflicts[r][c] = true;
          }
        }
      }
    }

    // 列チェック
    for (let c = 0; c < 9; c++) {
      const valMap = new Map();
      for (let r = 0; r < 9; r++) {
        const val = this.grid[r][c].val;
        if (val > 0) {
          if (!valMap.has(val)) valMap.set(val, []);
          valMap.get(val).push(r);
        }
      }
      for (const [val, rows] of valMap.entries()) {
        if (rows.length > 1) {
          duplicateCounts.cols += rows.length;
          for (const r of rows) {
            conflicts[r][c] = true;
          }
        }
      }
    }

    duplicateCounts.total = duplicateCounts.rows + duplicateCounts.cols;
    return { conflicts, duplicateCounts };
  }

  /**
   * 行・列の完成状態（重複なしで埋まっているか）を検出
   */
  getCompletionStatus() {
    const completedRows = [];
    const completedCols = [];

    // 行
    for (let r = 0; r < 9; r++) {
      const vals = new Set();
      let hasEmpty = false;
      let hasDup = false;
      for (let c = 0; c < 9; c++) {
        const val = this.grid[r][c].val;
        if (val === 0) hasEmpty = true;
        else {
          if (vals.has(val)) hasDup = true;
          vals.add(val);
        }
      }
      // 重複がなく、かつ想定タイル数が全て揃っているか
      if (!hasDup && vals.size > 0) {
        completedRows.push(r);
      }
    }

    // 列
    for (let c = 0; c < 9; c++) {
      const vals = new Set();
      let hasDup = false;
      for (let r = 0; r < 9; r++) {
        const val = this.grid[r][c].val;
        if (val > 0) {
          if (vals.has(val)) hasDup = true;
          vals.add(val);
        }
      }
      if (!hasDup && vals.size > 0) {
        completedCols.push(c);
      }
    }

    return { completedRows, completedCols };
  }

  /**
   * 勝利条件の判定
   * 1. すべての行で重複がない
   * 2. すべての列で重複がない
   * 3. (各3x3ブロック内はスライド移動のみなので元から重複ゼロ)
   */
  checkWinCondition() {
    const { duplicateCounts } = this.getConflicts();
    return duplicateCounts.total === 0;
  }

  /**
   * 各ブロックをゴール状態に近づけるためのヒント（1手）を探索（BFS）
   * 差異のあるブロックの中から1つを選び、最短経路の最初の1手を返す
   */
  findHintMove() {
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        // このブロックがゴールと一致しているかチェック
        let isBlockMatched = true;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const curCell = this.grid[br * 3 + r][bc * 3 + c];
            const goalCell = this.goalGrid[br * 3 + r][bc * 3 + c];
            if (curCell.val !== goalCell.val) {
              isBlockMatched = false;
              break;
            }
          }
          if (!isBlockMatched) break;
        }

        if (!isBlockMatched) {
          const move = this._solveBlockBFS(br, bc);
          if (move) {
            return {
              br, bc,
              tile: { r: move.fromR, c: move.fromC, val: this.grid[move.fromR][move.fromC].val },
              to: { r: move.toR, c: move.toC }
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * 1つの 3x3 ブロックに対して BFS でゴールへの最短手を探す
   */
  _solveBlockBFS(br, bc) {
    const startState = [];
    const goalState = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        startState.push(this.grid[br * 3 + r][bc * 3 + c].val);
        goalState.push(this.goalGrid[br * 3 + r][bc * 3 + c].val);
      }
    }

    const goalKey = goalState.join(',');
    const startKey = startState.join(',');
    if (startKey === goalKey) return null;

    // BFS キュー: { state, firstMove }
    const queue = [{ state: startState, firstMove: null }];
    const visited = new Set([startKey]);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    let maxSteps = 4000; // 探索ノード制限
    while (queue.length > 0 && maxSteps-- > 0) {
      const { state, firstMove } = queue.shift();
      const currentKey = state.join(',');
      if (currentKey === goalKey) {
        return firstMove;
      }

      // 空きマス（0）を見つける
      for (let idx = 0; idx < 9; idx++) {
        if (state[idx] === 0) {
          const er = Math.floor(idx / 3);
          const ec = idx % 3;

          for (const [dr, dc] of dirs) {
            const nr = er + dr;
            const nc = ec + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
              const neighborIdx = nr * 3 + nc;
              // 固定数字は動かせない
              if (this.grid[br * 3 + nr][bc * 3 + nc].type === 'fixed') continue;

              const nextState = [...state];
              nextState[idx] = nextState[neighborIdx];
              nextState[neighborIdx] = 0;

              const nextKey = nextState.join(',');
              if (!visited.has(nextKey)) {
                visited.add(nextKey);
                const moveObj = {
                  fromR: br * 3 + nr,
                  fromC: bc * 3 + nc,
                  toR: br * 3 + er,
                  toC: bc * 3 + ec
                };
                queue.push({
                  state: nextState,
                  firstMove: firstMove || moveObj
                });
              }
            }
          }
        }
      }
    }

    return null;
  }
}

if (typeof window !== 'undefined') {
  window.SlidingBoard = SlidingBoard;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SlidingBoard;
}
