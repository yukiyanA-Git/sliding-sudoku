/**
 * 9x9 数独完成盤面生成モジュール
 */
class SudokuGenerator {
  /**
   * 完全な正解数独盤面（9x9の2次元配列、各値1〜9）を生成する
   * @returns {number[][]} 9x9 の盤面
   */
  static generateCompleteBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));

    // 独立した対角線上の3つの 3x3 ブロック (0,0), (3,3), (6,6) をランダムに埋める
    for (let i = 0; i < 9; i += 3) {
      this._fillBlock(board, i, i);
    }

    // 残りのセルをバックトラッキングで解く
    this._solve(board);
    return board;
  }

  /**
   * 指定した3x3ブロックに1〜9の数字をランダムに配置
   */
  static _fillBlock(board, startRow, startCol) {
    const nums = this._shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[startRow + r][startCol + c] = nums[idx++];
      }
    }
  }

  /**
   * Fisher-Yates シャッフル
   */
  static _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 特定のマスに数値を配置可能か検証
   */
  static isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num) return false;
      if (board[i][col] === num) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[startRow + r][startCol + c] === num) return false;
      }
    }
    return true;
  }

  /**
   * バックトラッキングによる盤面求解
   */
  static _solve(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const nums = this._shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of nums) {
            if (this.isValid(board, r, c, num)) {
              board[r][c] = num;
              if (this._solve(board)) return true;
              board[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 盤面が完全な正解数独かどうか検証
   */
  static verifyBoard(board) {
    for (let i = 0; i < 9; i++) {
      const rowSet = new Set();
      const colSet = new Set();
      for (let j = 0; j < 9; j++) {
        const rVal = board[i][j];
        const cVal = board[j][i];
        if (rVal < 1 || rVal > 9 || rowSet.has(rVal)) return false;
        if (cVal < 1 || cVal > 9 || colSet.has(cVal)) return false;
        rowSet.add(rVal);
        colSet.add(cVal);
      }
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const blockSet = new Set();
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const val = board[br * 3 + r][bc * 3 + c];
            if (val < 1 || val > 9 || blockSet.has(val)) return false;
            blockSet.add(val);
          }
        }
      }
    }
    return true;
  }
}

if (typeof window !== 'undefined') {
  window.SudokuGenerator = SudokuGenerator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SudokuGenerator;
}
