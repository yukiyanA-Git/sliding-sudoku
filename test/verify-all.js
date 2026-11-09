const fs = require('fs');
const path = require('path');
const SudokuGenerator = require('../js/sudoku-generator.js');
const SlidingBoard = require('../js/sliding-board.js');

console.log("=========================================");
console.log("  SLIDING SUDOKU INTEGRATED TEST SUITE   ");
console.log("=========================================\n");

// 1. Check required files
console.log("1. Checking Project File Assets...");
const files = [
  'index.html',
  'css/style.css',
  'js/sudoku-generator.js',
  'js/sliding-board.js',
  'js/audio.js',
  'js/app.js',
  'server.js'
];

for (const f of files) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) {
    console.error(`FAIL: Missing file ${f}`);
    process.exit(1);
  }
  const size = fs.statSync(p).size;
  console.log(`  ✓ ${f.padEnd(24)} (${size} bytes)`);
}

// 2. Generate and verify 50 valid Sudoku boards
console.log("\n2. Stress Testing 9x9 Sudoku Generator (50 boards)...");
const genStart = Date.now();
for (let i = 0; i < 50; i++) {
  const b = SudokuGenerator.generateCompleteBoard();
  if (!SudokuGenerator.verifyBoard(b)) {
    console.error(`FAIL: Board #${i + 1} failed Sudoku verification!`);
    process.exit(1);
  }
}
const genElapsed = Date.now() - genStart;
console.log(`  ✓ 50 valid 9x9 boards generated & verified in ${genElapsed}ms (avg ${(genElapsed/50).toFixed(1)}ms/board)`);

// 3. Mathematical Solvability Verification for All Difficulties
console.log("\n3. Testing 100% Mathematical Solvability across all difficulties...");
const difficulties = ['beginner', 'normal', 'hard', 'master'];

for (const diff of difficulties) {
  const board = new SlidingBoard(diff);
  const shuffles = board.shuffleHistory.length;

  // Invert all shuffles
  for (let i = board.shuffleHistory.length - 1; i >= 0; i--) {
    const step = board.shuffleHistory[i];
    board._swapCells(step.to.r, step.to.c, step.from.r, step.from.c);
  }

  const { duplicateCounts } = board.getConflicts();
  const win = board.checkWinCondition();

  if (duplicateCounts.total !== 0 || !win) {
    console.error(`FAIL: Solvability test failed for difficulty "${diff}"`);
    process.exit(1);
  }
  console.log(`  ✓ Difficulty "${diff.padEnd(8)}": ${shuffles} reverse shuffle steps -> 100% restored (Conflicts: 0, Win: true)`);
}

// 4. Test Multi-slide and Movement Logic
console.log("\n4. Testing Multi-slide & Undo/Redo Engine...");
const simBoard = new SlidingBoard('beginner');
let movesDone = 0;

for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    const moves = simBoard.getSlideMove(r, c);
    if (moves && moves.length > 0) {
      simBoard.slideTile(r, c);
      movesDone++;
      if (movesDone >= 3) break;
    }
  }
  if (movesDone >= 3) break;
}

console.log(`  ✓ Performed ${movesDone} consecutive moves. Board moveCount = ${simBoard.moveCount}`);
if (simBoard.moveCount !== movesDone) {
  console.error("FAIL: moveCount mismatch!");
  process.exit(1);
}

// Undo all
for (let i = 0; i < movesDone; i++) {
  simBoard.undo();
}
console.log(`  ✓ Successfully undid all moves. Move history is now empty: ${simBoard.moveHistory.length === 0}`);
if (simBoard.moveHistory.length !== 0) {
  console.error("FAIL: Undo did not empty move history!");
  process.exit(1);
}

console.log("\n=========================================");
console.log("  ALL TESTS PASSED! 100% VERIFIED!       ");
console.log("=========================================\n");
