const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, 'BlockBothEndsAnalyzer.js'), 'utf8');
const sandbox = { globalThis: global, console, Map, Set, Number, isFinite, window: {}, document: { getElementById: () => null } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
console.log('window has analyzer', typeof sandbox.window.BlockBothEndsAnalyzer);
console.log('global has analyzer', typeof sandbox.BlockBothEndsAnalyzer);
const Analyzer = sandbox.window.BlockBothEndsAnalyzer;
function makeBoard(coords) {
  const map = new Map();
  coords.forEach(({ r, c, v }) => map.set(`${r},${c}`, v));
  return map;
}
function test(name, coords, rules) {
  sandbox.GameState = { board: { infiniteMap: makeBoard(coords) }, roomRules: rules };
  const move = Analyzer.getOpenEndBlockMove('O', 'X', rules);
  console.log(name, '->', move ? `${move.r},${move.c}` : null);
}
const patterns = [
  {
    name: 'hor O___XXXX',
    coords: [
      {r:10,c:10,v:'O'},
      {r:10,c:11,v:''},
      {r:10,c:12,v:''},
      {r:10,c:13,v:''},
      {r:10,c:14,v:'X'},
      {r:10,c:15,v:'X'},
      {r:10,c:16,v:'X'},
      {r:10,c:17,v:'X'},
    ]
  },
  {
    name: 'hor O__XXXX',
    coords: [
      {r:10,c:10,v:'O'},
      {r:10,c:11,v:''},
      {r:10,c:12,v:''},
      {r:10,c:13,v:'X'},
      {r:10,c:14,v:'X'},
      {r:10,c:15,v:'X'},
      {r:10,c:16,v:'X'},
    ]
  },
  {
    name: 'hor O_XXXX',
    coords: [
      {r:10,c:10,v:'O'},
      {r:10,c:11,v:''},
      {r:10,c:12,v:'X'},
      {r:10,c:13,v:'X'},
      {r:10,c:14,v:'X'},
      {r:10,c:15,v:'X'},
    ]
  },
  {
    name: 'diag O___XXXX',
    coords: [
      {r:10,c:10,v:'O'},
      {r:11,c:11,v:''},
      {r:12,c:12,v:''},
      {r:13,c:13,v:''},
      {r:14,c:14,v:'X'},
      {r:15,c:15,v:'X'},
      {r:16,c:16,v:'X'},
      {r:17,c:17,v:'X'},
    ]
  },
  {
    name: 'diag O__XXXX',
    coords: [
      {r:10,c:10,v:'O'},
      {r:11,c:11,v:''},
      {r:12,c:12,v:''},
      {r:13,c:13,v:'X'},
      {r:14,c:14,v:'X'},
      {r:15,c:15,v:'X'},
      {r:16,c:16,v:'X'},
    ]
  },
  {
    name: 'diag O_XXXX',
    coords: [
      {r:10,c:10,v:'O'},
      {r:11,c:11,v:''},
      {r:12,c:12,v:'X'},
      {r:13,c:13,v:'X'},
      {r:14,c:14,v:'X'},
      {r:15,c:15,v:'X'},
    ]
  }
];
patterns.push(...[
  {
    name: 'hor X_XXXX with left block',
    coords: [
      {r:10,c:9,v:'O'},
      {r:10,c:10,v:'X'},
      {r:10,c:11,v:'X'},
      {r:10,c:12,v:'X'},
      {r:10,c:13,v:'X'},
    ]
  },
  {
    name: 'diag X_XXXX with left block',
    coords: [
      {r:9,c:9,v:'O'},
      {r:10,c:10,v:'X'},
      {r:11,c:11,v:'X'},
      {r:12,c:12,v:'X'},
      {r:13,c:13,v:'X'},
    ]
  }
]);
for (const p of patterns) {
  test(p.name, p.coords, { winCount: 5, chan2Dau: true });
}
