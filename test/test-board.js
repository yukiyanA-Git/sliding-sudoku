const SudokuGenerator = require('../js/sudoku-generator.js');
const SlidingBoard = require('../js/sliding-board.js');

console.log("=== Testing SlidingBoard ===");

for (const diffId of ['beginner', 'normal', 'hard', 'master']) {
  console.log(`\nTesting Difficulty: ${diffId}`);
  const board = new SlidingBoard(diffId);

  // Check structure
  let emptyCount = 0;
  let fixedCount = 0;
  let movableCount = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = board.grid[r][c];
      if (cell.type === 'empty') emptyCount++;
      else if (cell.type === 'fixed') fixedCount++;
      else if (cell.type === 'movable') movableCount++;
    }
  }

  const expectedEmpty = board.difficulty.emptyPerBlock * 9;
  const expectedFixed = board.difficulty.fixedPerBlock * 9;
  console.log(`- Empty cells: ${emptyCount} (expected: ${expectedEmpty})`);
  console.log(`- Fixed cells: ${fixedCount} (expected: ${expectedFixed})`);
  console.log(`- Movable cells: ${movableCount} (expected: ${81 - expectedEmpty - expectedFixed})`);

  if (emptyCount !== expectedEmpty || fixedCount !== expectedFixed) {
    console.error(`FAIL: Cell counts do not match expected for ${diffId}`);
    process.exit(1);
  }

  // Check conflicts
  const { duplicateCounts } = board.getConflicts();
  console.log(`- Initial duplicate conflicts after shuffle: ${duplicateCounts.total}`);
}

console.log("\n=== Testing Mathematical Solvability (Reverse Shuffle Inversion) ===");
// Create a board, verify that applying the inverse of shuffle history restores the goal state with 0 conflicts
const testBoard = new SlidingBoard('beginner');
console.log("Shuffle history length:", testBoard.shuffleHistory.length);

// Revert shuffle moves in reverse order
for (let i = testBoard.shuffleHistory.length - 1; i >= 0; i--) {
  const step = testBoard.shuffleHistory[i];
  testBoard._swapCells(step.to.r, step.to.c, step.from.r, step.from.c);
}

const afterRevertConflicts = testBoard.getConflicts().duplicateCounts.total;
const isWin = testBoard.checkWinCondition();
console.log("Conflicts after reversing shuffle:", afterRevertConflicts);
console.log("Is win condition satisfied?", isWin);

if (afterRevertConflicts !== 0 || !isWin) {
  console.error("FAIL: Reverse shuffle inversion did not restore a 100% conflict-free state!");
  process.exit(1);
}
console.log("SUCCESS: 100% Mathematical solvability verified!");

console.log("\n=== Testing Slide Moves, Undo, and BFS Hint ===");
const game = new SlidingBoard('beginner');

// Find a movable tile with a valid slide move
let testedMove = false;
for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const moves = game.getSlideMove(r, c);
    if (moves && moves.length > 0) {
      console.log(`Found valid move at (${r}, ${c}):`, moves);
      const valBefore = game.grid[r][c].val;
      game.slideTile(r, c);
      console.log(`Tile slid. Move count: ${game.moveCount}`);

      // Test Undo
      game.undo();
      console.log(`Undid move. Value restored at (${r}, ${c}):`, game.grid[r][c].val === valBefore);
      if (game.grid[r][c].val !== valBefore) {
        console.error("FAIL: Undo did not restore original tile value!");
        process.exit(1);
      }
      testedMove = true;
      break;
    }
  }
  if (testedMove) break;
}

// Test BFS hint
const hint = game.findHintMove();
console.log("BFS Hint result:", hint);
if (hint) {
  console.log(`Hint suggests moving tile ${hint.tile.val} at (${hint.tile.r}, ${hint.tile.c}) to (${hint.to.r}, ${hint.to.c})`);
}

// Test Bidirectional Moves (tile between two empty spaces)
console.log("\nTesting Bidirectional Sliding...");
game.grid[0][0] = { type: 'empty', val: 0, r: 0, c: 0, id: 'e1' };
game.grid[0][1] = { type: 'movable', val: 5, r: 0, c: 1, id: 'm1' };
game.grid[0][2] = { type: 'empty', val: 0, r: 0, c: 2, id: 'e2' };
const bOpts = game.getAvailableSlideOptions(0, 1);
if (!bOpts.left || !bOpts.right) {
  console.error("FAIL: Both left and right must be available!");
  process.exit(1);
}
console.log("  ✓ Bidirectional sliding available in both directions (left & right)!");

console.log("\nALL BOARD TESTS PASSED SUCCESSFULLY!");

