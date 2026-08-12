const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, 'BlockBothEndsAnalyzer.js'), 'utf8');
const sandbox = { globalThis: global, console, Map, Set, Number, isFinite, window: {}, document: undefined };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Analyzer = sandbox.window.BlockBothEndsAnalyzer || sandbox.BlockBothEndsAnalyzer;
function makeBoard(coords) {
  const map = new Map();
  coords.forEach(({ r, c, v }) => map.set(`${r},${c}`, v));
  return map;
}
function getWinningBlocks(coords, player, winCount = 5) {
  const board = makeBoard(coords);
  const empties = coords.filter(cell => cell.v === '');
  const results = [];

  for (const cell of empties) {
    board.set(`${cell.r},${cell.c}`, player);
    sandbox.GameState = { board: { infiniteMap: board } };
    const isWin = Analyzer._isWinningMoveAt(cell.r, cell.c, player, winCount, true);
    if (isWin) {
      results.push(`${cell.r},${cell.c}`);
    }
    board.set(`${cell.r},${cell.c}`, '');
  }
  return results;
}

function testPattern(name, coords, exp, winCount = 5) {
  sandbox.GameState = { board: { infiniteMap: makeBoard(coords) } };
  const validKeys = getWinningBlocks(coords, 'X', winCount);
  const move = Analyzer.getPriorityTacticalMove('O', 'X', winCount);
  const actualKey = move ? `${move.r},${move.c}` : 'null';
  return { name, expected: validKeys.join('|'), actual: actualKey, reason: move && move.reason, pass: validKeys.includes(actualKey), validKeys };
}
const dirs = [
  { name: 'E', dr: 0, dc: 1 },
  { name: 'W', dr: 0, dc: -1 },
  { name: 'S', dr: 1, dc: 0 },
  { name: 'N', dr: -1, dc: 0 },
  { name: 'SE', dr: 1, dc: 1 },
  { name: 'NW', dr: -1, dc: -1 },
  { name: 'NE', dr: -1, dc: 1 },
  { name: 'SW', dr: 1, dc: -1 }
];
const patterns = Array.from({ length: 20 }, (_, i) => ({ label: `O${'_'.repeat(i + 1)}XXXX`, gap: i + 1 }));
const start = { r: 10, c: 10 };
const results = [];
for (const pat of patterns) {
  for (const dir of dirs) {
    const coords = [];
    let r = start.r;
    let c = start.c;
    coords.push({ r, c, v: 'O' });
    for (let i = 1; i <= pat.gap; i++) coords.push({ r: r + dir.dr * i, c: c + dir.dc * i, v: '' });
    const xStart = pat.gap + 1;
    for (let i = 0; i < 4; i++) coords.push({ r: r + dir.dr * (xStart + i), c: c + dir.dc * (xStart + i), v: 'X' });
    const blockPos = { r: r + dir.dr * (xStart + 4), c: c + dir.dc * (xStart + 4) };
    const secondaryPos = { r: r + dir.dr * (xStart - 1), c: c + dir.dc * (xStart - 1) };
    coords.push({ r: blockPos.r, c: blockPos.c, v: '' });
    results.push(testPattern(`${pat.label}_${dir.name}`, coords, blockPos, [`${blockPos.r},${blockPos.c}`, `${secondaryPos.r},${secondaryPos.c}`]));
  }
}
console.log('Pattern test results:');
results.forEach(r => console.log(`${r.name} => expected ${r.expected}, actual ${r.actual}, reason=${r.reason}, pass=${r.pass}`));
const fail = results.filter(r => !r.pass);
console.log('\nSummary:');
console.log('Total', results.length, 'Passed', results.length - fail.length, 'Failed', fail.length);
if (fail.length) {
  console.log('Failed cases:');
  fail.forEach(r => console.log(r.name));
  const debug = fail[0];
  console.log('--- debug first failed case ---');
  console.log('name', debug.name);
  const [patternName, direction] = debug.name.split('_');
  console.log('pattern', patternName, 'direction', direction);
  console.log('tactical cells count', Analyzer._getTacticalCells().length);
  console.log('contains expected block', Analyzer._getTacticalCells().some(c => `${c.r},${c.c}` === debug.expected));
  console.log('winning at expected block?', Analyzer._isWinningMoveAt(...debug.expected.split(',').map(Number), 'X', 5, true));
}
