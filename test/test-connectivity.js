function isConnected(fixedKeys) {
  const nonFixed = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (!fixedKeys.has(`${r},${c}`)) nonFixed.push({r, c});
    }
  }
  if (nonFixed.length === 0) return true;
  const visited = new Set();
  const queue = [nonFixed[0]];
  visited.add(`${nonFixed[0].r},${nonFixed[0].c}`);
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  while (queue.length > 0) {
    const curr = queue.shift();
    for (const [dr, dc] of dirs) {
      const nr = curr.r + dr;
      const nc = curr.c + dc;
      const k = `${nr},${nc}`;
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && !fixedKeys.has(k) && !visited.has(k)) {
        visited.add(k);
        queue.push({r: nr, c: nc});
      }
    }
  }
  return visited.size === nonFixed.length;
}

for (const fixCount of [1, 2, 3]) {
  let total = 0;
  let connected = 0;
  const allCells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      allCells.push(`${r},${c}`);
    }
  }

  function getCombinations(arr, k) {
    if (k === 1) return arr.map(x => [x]);
    const res = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const head = arr[i];
      const tail = getCombinations(arr.slice(i + 1), k - 1);
      for (const t of tail) res.push([head, ...t]);
    }
    return res;
  }

  const combos = getCombinations(allCells, fixCount);
  for (const combo of combos) {
    total++;
    if (isConnected(new Set(combo))) connected++;
  }

  console.log(`Fixed count = ${fixCount}: Total = ${total}, Connected = ${connected} (${(connected/total*100).toFixed(1)}%)`);
}

// Test: In a connected layout with 3 fixed tiles and 3 empty spaces, can all 3 movable tiles move?
const fixSet = new Set(['0,2', '1,2', '2,2']); // right column fixed
console.log('Is right column fixed connected?', isConnected(fixSet));

const SlidingBoard = require('../js/sliding-board.js');
let totalBlocks = 0;
let isolatedCount = 0;

for (const diff of ['beginner', 'normal', 'hard', 'master']) {
  for (let i = 0; i < 50; i++) {
    const board = new SlidingBoard(diff);
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        totalBlocks++;
        const fixed = new Set();
        const empties = [];
        const movables = [];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const cell = board.grid[br * 3 + r][bc * 3 + c];
            const k = `${r},${c}`;
            if (cell.type === 'fixed') fixed.add(k);
            else if (cell.type === 'empty') empties.push({ r, c });
            else movables.push({ r, c });
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
              if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && !fixed.has(k) && !visited.has(k)) {
                visited.add(k);
                q.push({ r: nr, c: nc });
              }
            }
          }
          for (const m of movables) {
            if (!visited.has(`${m.r},${m.c}`)) {
              isolatedCount++;
            }
          }
        }
      }
    }
  }
}
console.log(`Stress Test: ${totalBlocks} blocks tested, ${isolatedCount} isolated tiles found.`);



