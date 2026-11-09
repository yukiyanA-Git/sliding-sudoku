const SudokuGenerator = require('../js/sudoku-generator.js');

console.log("Testing SudokuGenerator...");
const board = SudokuGenerator.generateCompleteBoard();
console.log("Generated Board:");
console.log(board.map(row => row.join(' ')).join('\n'));

const isValid = SudokuGenerator.verifyBoard(board);
console.log("Is Board Valid?", isValid);

if (!isValid) {
  console.error("FAIL: Board is not valid!");
  process.exit(1);
} else {
  console.log("SUCCESS: 9x9 Sudoku Generator produces 100% valid board!");
}
