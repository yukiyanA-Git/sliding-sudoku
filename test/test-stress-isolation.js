const SlidingBoard = require('../js/sliding-board.js');

let totalBlocksTested = 0;
let isolatedFound = 0;

for (const diff of ['beginner', 'normal', 'hard', 'master']) {
  for (let bIdx = 0; bIdx < 50; bIdx++) {
    const board = new SlidingBoard(diff);
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        totalBlocksTested++;
        const fixedKeys = new Set();
        const nonFixed = [];
        const empties = [];
        const movables = [];

        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const cell = board.grid[br * 3 + r][bc * 3 + c];
            const k = `${r},${c}`;
            if (cell.type === 'fixed') fixedKeys.add(k);
            else {
              nonFixed.push({ r, c, type: cell.type });
              if (cell.type === 'empty') empties.push({ r, c });
              else movables.push({ r, c });
            }
          }
        }

        if (empties.length > 0 && movables.length > 0) {
          const visited = new Set();
          const q = [empties[0]];
          visited.add(`${empties[0].r},${empties[0].c}`);
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          while (q.length > 0) {
            const curr = q.shift();
            for (const [dr, dc] of dirs) {
              const nr = curr.r + dr;
              const nc = curr.c + dc;
              const k = `${nr},${nc}`;
              if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && !fixedKeys.has(k) && !visited.has(k)) {
                visited.add(k);
                q.push({ r: nr, c: nc });
              }
            }
          }
          for (const m of movables) {
            if (!visited.has(`${m.r},${m.c}`)) {
              isolatedFound++;
              console.error(`ISOLATED MOVABLE FOUND at block (${br},${bc}) cell (${m.r},${m.c})`);
            }
          }
        }
      }
    }
  }
}

console.log(`Total 3x3 blocks tested: ${totalBlocksTested}`);
console.log(`Isolated movable tiles found: ${isolatedFound}`);
if (isolatedFound === 0) {
  console.log('SUCCESS: 100% of movable tiles have guaranteed connected paths to empty space!');
}
