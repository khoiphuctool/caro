const fs = require('fs');
const path = require('path');
const vm = require('vm');

const loadFiles = [
  'BlockBothEndsAnalyzer.js',
  'bot-tia-chop.js',
  'bot-room.js'
];

const sandbox = {
  console,
  Map,
  Set,
  Number,
  isFinite,
  Date,
  performance: { now: () => Date.now() },
  window: {},
  document: { getElementById: () => null },
  localStorage: { store: {}, getItem(k){return this.store[k]||null}, setItem(k,v){this.store[k]=v}, removeItem(k){delete this.store[k]} },
  GameState: { board: { infiniteMap: new Map() }, roomRules: { winCount: 5, chan2Dau: true } },
  infiniteMap: undefined
};
vm.createContext(sandbox);

for (const f of loadFiles) {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}
console.log('Loaded files into VM; preparing scenario');

// Scenario: X has sequence of 4 at (7,7)-(7,10), left blocked by O at (7,6), so O should block at (7,11)
const script = `
(function(){
  const game = new AutoBotGameHeadless({ botXMode: 'bot-tia-chop', botOMode: 'bot-tia-chop', firstMove: 'O', winCount: 5, blockBoth: true });
  // Fill board: O blocks left
  game.board.set('7,6', 'O');
  game.board.set('7,7', 'X');
  game.board.set('7,8', 'X');
  game.board.set('7,9', 'X');
  game.board.set('7,10', 'X');
  game.currentPlayer = 'O';
  // Call getBotMove for O
  const move = game.getBotMove('bot-tia-chop', 'O');
  return { move };
})();
`;

try {
  const res = vm.runInContext(script, sandbox);
  // console.log('Scenario result:', res);
} catch (e) {
  console.error('Error running scenario:', e);
  process.exit(1);
}
