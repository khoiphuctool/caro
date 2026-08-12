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
  try {
    vm.runInContext(code, sandbox, { filename: f });
    console.log('Loaded', f);
  } catch (e) {
    console.error('Error loading', f, e);
    process.exit(1);
  }
}

// Create and run a headless game
const script = `
(function(){
  const game = new AutoBotGameHeadless({ botXMode: 'bot-tia-chop', botOMode: 'bot-tia-chop', firstMove: 'X', winCount: 5, blockBoth: true });
  const result = game.run();
  return { result, moveCount: game.moveCount };
})();
`;

try {
  const res = vm.runInContext(script, sandbox);
  console.log('Match result:', res);
} catch (e) {
  console.error('Error running match:', e);
  process.exit(1);
}
