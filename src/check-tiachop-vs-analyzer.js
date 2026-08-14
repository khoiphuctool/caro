const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['BlockBothEndsAnalyzer.js','bot-tia-chop.js'];
const sandbox = { console, Map, Set, Number, isFinite, performance: { now: () => Date.now() }, window: {}, document: { getElementById: ()=>null }, localStorage: { store: {}, getItem(k){return this.store[k]||null}, setItem(k,v){this.store[k]=v}, removeItem(k){delete this.store[k]} }, GameState: { board: { infiniteMap: new Map() }, roomRules: { winCount:5, chan2Dau:true } }, infiniteMap: undefined };
vm.createContext(sandbox);
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname,f),'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}
const Analyzer = sandbox.window.BlockBothEndsAnalyzer;
const Bot = sandbox.BotTiaChop;

function makeBoard(coords){ const map=new Map(); coords.forEach(({r,c,v})=>map.set(`${r},${c}`,v)); return map; }
function analyzeAndBot(coords){
  sandbox.GameState = { board: { infiniteMap: makeBoard(coords) }, roomRules: { winCount:5, chan2Dau:true } };
  sandbox.infiniteMap = sandbox.GameState.board.infiniteMap;
  const analyzerMove = Analyzer.getOpenEndBlockMove('O','X',{winCount:5,chan2Dau:true});
  // Call BotTiaChop.getBotMove inside the sandbox to ensure correct binding
  const botMove = vm.runInContext(`BotTiaChop.getBotMove(${JSON.stringify({ player: 'O', opponent: 'X', roomRules: { winCount:5, chan2Dau:true } })})`, sandbox);
  return { analyzerMove, botMove };
}

const center={r:10,c:10};
const directions=[{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1},{dr:1,dc:-1}];
const results=[];
for(const {dr,dc} of directions){
  for(const len of [3,4]){
    // left blocked (negative)
    const coords1=[{r:center.r-dr,c:center.c-dc,v:'O'}];
    for(let i=0;i<len;i++) coords1.push({r:center.r+i*dr,c:center.c+i*dc,v:'X'});
    const res1=analyzeAndBot(coords1);
    results.push({case:`dir${dr},${dc}_len${len}_negBlocked`, analyzer:res1.analyzerMove, bot:res1.botMove});

    // right blocked (positive)
    const coords2=[{r:center.r+len*dr,c:center.c+len*dc,v:'O'}];
    for(let i=0;i<len;i++) coords2.push({r:center.r+i*dr,c:center.c+i*dc,v:'X'});
    const res2=analyzeAndBot(coords2);
    results.push({case:`dir${dr},${dc}_len${len}_posBlocked`, analyzer:res2.analyzerMove, bot:res2.botMove});
  }
}

console.log('Comparing Analyzer vs BotTiaChop:');
for(const r of results){
  const a = r.analyzer ? `${r.analyzer.r},${r.analyzer.c}` : 'null';
  const b = r.bot ? `${r.bot.r},${r.bot.c}` : 'null';
  const ok = (a===b) ? 'OK' : 'MISMATCH';
  // console.log(r.case, 'analyzer=',a,'bot=',b, ok);
}

// Also test some gap/open patterns
const gapCoords=[
  {r:10,c:8,v:'O'},
  {r:10,c:9,v:'X'},
  {r:10,c:10,v:''},
  {r:10,c:11,v:'X'},
  {r:10,c:12,v:'X'},
  {r:10,c:13,v:'X'},
];
const gapRes=analyzeAndBot(gapCoords);
console.log('gap case analyzer=', gapRes.analyzerMove, 'bot=', gapRes.botMove);
