const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'BlockBothEndsAnalyzer.js'), 'utf8');
const sandbox = {
  globalThis: global,
  console,
  Map,
  Set,
  Number,
  isFinite,
  window: {},
  document: { getElementById: () => null }
};
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
  const move = Analyzer.getPriorityTacticalMove('O', 'X', rules);
  const got = move ? `${move.r},${move.c}` : null;
  console.log(`${name}: expected=${expected == null ? 'null' : expected} got=${got}`);
  if (expected === null) {
    if (move !== null) {
      throw new Error(`${name}: expected no tactical move but got ${got}`);
    }
  } else if (got !== expected) {
    throw new Error(`${name}: expected ${expected} but got ${got}`);
  }
}

const rules = { winCount: 5, chan2Dau: true };

runCase('sealed_dead_chain', [
  { r: 10, c: 9, v: 'O' },
  { r: 10, c: 10, v: '' },
  { r: 10, c: 11, v: '' },
  { r: 10, c: 12, v: 'X' },
  { r: 10, c: 13, v: 'X' },
  { r: 10, c: 14, v: 'X' },
  { r: 10, c: 15, v: 'X' },
  { r: 10, c: 16, v: 'O' }
], null, rules);

runCase('live_double_open_three', [
  { r: 20, c: 9, v: '' },
  { r: 20, c: 10, v: 'X' },
  { r: 20, c: 11, v: 'X' },
  { r: 20, c: 12, v: 'X' },
  { r: 20, c: 13, v: '' }
], '20,9', rules);

runCase('live_open_end_four', [
  { r: 30, c: 9, v: 'O' },
  { r: 30, c: 10, v: '' },
  { r: 30, c: 11, v: 'X' },
  { r: 30, c: 12, v: 'X' },
  { r: 30, c: 13, v: 'X' },
  { r: 30, c: 14, v: 'X' }
], '30,10', rules);

console.log('Threat priority checks passed.');
