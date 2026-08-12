const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'BlockBothEndsAnalyzer.js'), 'utf8');
const sandbox = { globalThis: global, console, Map, Set, Number, isFinite, window: {}, document: { getElementById: () => null } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Analyzer = sandbox.window.BlockBothEndsAnalyzer;

function makeBoard(coords) {
  const map = new Map();
  coords.forEach(({ r, c, v }) => map.set(`${r},${c}`, v));
  return map;
}

function runCase(name, coords, expected, rules) {
  sandbox.GameState = { board: { infiniteMap: makeBoard(coords) }, roomRules: rules };
  const move = Analyzer.getOpenEndBlockMove('O', 'X', rules);
  const got = move ? `${move.r},${move.c}` : null;
  console.log(`${name} -> expected=${expected ? `${expected.r},${expected.c}` : null} got=${got}`);
}

const directions = [
  { dr: 0, dc: 1, name: 'hor' },
  { dr: 1, dc: 0, name: 'ver' },
  { dr: 1, dc: 1, name: 'diag1' },
  { dr: 1, dc: -1, name: 'diag2' }
];

const rules = { winCount: 5, chan2Dau: true };
const center = { r: 50, c: 50 };
const cases = [];

// For each direction, create two variants for chain lengths 3 and 4
for (const { dr, dc, name } of directions) {
  for (const len of [3, 4]) {
    // Negative blocked, positive open
    const coords1 = [];
    // blocker at negative side
    coords1.push({ r: center.r - dr, c: center.c - dc, v: 'O' });
    for (let i = 0; i < len; i++) {
      coords1.push({ r: center.r + i * dr, c: center.c + i * dc, v: 'X' });
    }
    // positive candidate is open
    const expected1 = { r: center.r + len * dr, c: center.c + len * dc };
    cases.push({ name: `${name}_len${len}_negBlocked_posOpen`, coords: coords1, expected: expected1 });

    // Positive blocked, negative open
    const coords2 = [];
    // blocker at positive side
    coords2.push({ r: center.r + len * dr, c: center.c + len * dc, v: 'O' });
    for (let i = 0; i < len; i++) {
      coords2.push({ r: center.r + i * dr, c: center.c + i * dc, v: 'X' });
    }
    const expected2 = { r: center.r - dr, c: center.c - dc };
    cases.push({ name: `${name}_len${len}_posBlocked_negOpen`, coords: coords2, expected: expected2 });
  }
}

// Also test longer gaps (open with gap) and both-ends-blocked negative
// Add some real-game scattered pieces to ensure neighborhood detection
cases.push({
  name: 'real_mixed_nearby',
  coords: [
    { r: 48, c: 50, v: 'O' },
    { r: 49, c: 50, v: 'X' },
    { r: 50, c: 50, v: 'X' },
    { r: 51, c: 50, v: 'X' },
    { r: 52, c: 50, v: '' },
    { r: 53, c: 50, v: 'O' }
  ],
  expected: { r: 52, c: 50 }
});

for (const c of cases) {
  runCase(c.name, c.coords, c.expected, rules);
}

console.log('Done tests.');
