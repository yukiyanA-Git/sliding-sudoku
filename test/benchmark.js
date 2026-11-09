const SudokuGenerator = require('../js/sudoku-generator.js');

let maxTime = 0;
let stuckCount = 0;

for (let i = 0; i < 50; i++) {
  const t0 = Date.now();
  const board = SudokuGenerator.generateCompleteBoard();
  const dt = Date.now() - t0;
  if (dt > maxTime) maxTime = dt;
  if (dt > 200) {
    console.log(`Run ${i} took ${dt}ms`);
    stuckCount++;
  }
}

console.log(`Max time: ${maxTime}ms, Runs > 200ms: ${stuckCount}`);
