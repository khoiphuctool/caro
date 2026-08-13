// ===== TRẠNG THÁI GAME - Biến toàn cục =====

// ===== ZOBRIST HASHING =====
const ZOBRIST_SIZE = 100;
const zobristTable = [];

function initZobristTable() {
    for (let r = 0; r < ZOBRIST_SIZE; r++) {
        zobristTable[r] = [];
        for (let c = 0; c < ZOBRIST_SIZE; c++) {
            zobristTable[r][c] = [
                Math.floor(Math.random() * 0xFFFFFFFF),
                Math.floor(Math.random() * 0xFFFFFFFF),
                Math.floor(Math.random() * 0xFFFFFFFF)
            ];
        }
    }
}
initZobristTable();

let zobristHash = 0;

function getZobristIndex(r) {
    return ((r % ZOBRIST_SIZE) + ZOBRIST_SIZE) % ZOBRIST_SIZE;
}
function getZobristColIndex(c) {
    return ((c % ZOBRIST_SIZE) + ZOBRIST_SIZE) % ZOBRIST_SIZE;
}
function updateZobristHash(r, c, oldPiece, newPiece) {
    const zr = getZobristIndex(r);
    const zc = getZobristColIndex(c);
    const oldVal = (oldPiece === 'X') ? 1 : (oldPiece === 'O' ? 2 : 0);
    const newVal = (newPiece === 'X') ? 1 : (newPiece === 'O' ? 2 : 0);
    // Guard: bỏ qua nếu table chưa sẵn sàng hoặc index ngoài range
    if (!zobristTable[zr] || !zobristTable[zr][zc]) return;
    zobristHash ^= zobristTable[zr][zc][oldVal];
    zobristHash ^= zobristTable[zr][zc][newVal];
}
function generateBoardHash() {
    return zobristHash;
}

// ===== TRANSPOSITION TABLE =====
const TT_SIZE = 100000;
const transpositionTable = new Map();
let ttHits = 0, ttMisses = 0;

function ttLookup(hash, depth, alpha, beta) {
    const entry = transpositionTable.get(hash);
    if (entry && entry.depth >= depth) {
        ttHits++;
        if (entry.flag === 'exact') return entry.value;
        if (entry.flag === 'lower' && entry.value >= alpha) return entry.value;
        if (entry.flag === 'upper' && entry.value <= beta) return entry.value;
    }
    ttMisses++;
    return null;
}
function ttStore(hash, depth, value, flag) {
    if (transpositionTable.size >= TT_SIZE) {
        const firstKey = transpositionTable.keys().next().value;
        transpositionTable.delete(firstKey);
    }
    transpositionTable.set(hash, { depth, value, flag });
}
function clearTranspositionTable() {
    transpositionTable.clear();
    ttHits = 0;
    ttMisses = 0;
}

// ===== KILLER HEURISTIC =====
const killerMoves = [];
const MAX_KILLER_DEPTH = 20;

function addKillerMove(depth, r, c) {
    if (depth < MAX_KILLER_DEPTH) {
        if (!killerMoves[depth]) killerMoves[depth] = [];
        const exists = killerMoves[depth].some(m => m.r === r && m.c === c);
        if (!exists) {
            killerMoves[depth].unshift({ r, c });
            if (killerMoves[depth].length > 2) killerMoves[depth].pop();
        }
    }
}
function isKillerMove(depth, r, c) {
    if (depth < MAX_KILLER_DEPTH && killerMoves[depth]) {
        return killerMoves[depth].some(m => m.r === r && m.c === c);
    }
    return false;
}
function clearKillerMoves() {
    for (let i = 0; i < MAX_KILLER_DEPTH; i++) killerMoves[i] = [];
}

// ===== DOM CACHE =====
const DOM_CACHE = { statusPanel: null, lessonPanel: null, botMessage: null, botBubble: null };
function getDOM(id) {
    if (!DOM_CACHE[id]) DOM_CACHE[id] = document.getElementById(id);
    return DOM_CACHE[id];
}

// ===== DIRECTIONS - dùng chung =====
const DIRECTIONS = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];

// ===== TRẠNG THÁI BÀN CỜ =====
let boardSize = 30;
let winCount  = 5;
let boardState   = [];
// Reference to GameState.board.infiniteMap - single source of truth
let infiniteMap  = new Map();  // Placeholder, will be synced with GameState.board.infiniteMap
let isInfinite   = true;   // Default true — game dùng bàn vô hạn; sync với GameState khi initializeBoardState chạy
let isBotMove    = false;

let lastMoveR = null, lastMoveC = null;
let winningCellCoords = [];

let currentPlayer = "X";
let isGameActive  = true;
let gameMode      = "ai-god";
let isSolo        = false;
let lastMoveCell  = null;
let humanPiece    = "X";
let botPiece      = "O";

// ===== TIMER =====
let playerTurnTimer   = null;
let gameTotalTimer    = null;
let playerTurnSeconds = 0;
let gameTotalSeconds  = 0;
let playerDangerScore = 0;

// ===== LỊCH SỬ / UNDO =====
let moveCount   = 0;
let moveHistory = [];

// ===== KEYBOARD CURSOR =====
let keyboardCursorR       = 0;
let keyboardCursorC       = 0;
let keyboardCursorVisible = false;

// ===== RANK =====
let pendingRankEntry = null;

// ===== AUTOPLAY FLAG (khai báo sớm để lich-su-va-xep-hang.js dùng được) =====
// Giá trị thật được gán trong autoplay.js
var isAutoplayRunning = false;

// ===== CHUỖI THUA LIÊN TIẾP =====
const LOSS_STREAK_KEY        = 'caro_loss_streak';
const LOSS_STREAK_RECORD_KEY = 'caro_loss_streak_record';
var lossStreak       = parseInt(localStorage.getItem(LOSS_STREAK_KEY))        || 0;
var lossStreakRecord  = parseInt(localStorage.getItem(LOSS_STREAK_RECORD_KEY)) || 0;



// ===== HELPER =====
function withCell(r, c, val, callback) {
    const old = getCell(r, c);
    setCell(r, c, val);
    const result = callback();
    setCell(r, c, old);
    return result;
}

// ===== DEBUG HELPER — expose trạng thái ra window để F12 kiểm tra =====
window.debugGameState = function() {
    const info = {
        isGameActive,
        isInfinite,
        isOnlineMode: typeof isOnlineMode !== 'undefined' ? isOnlineMode : 'undefined (check firebase-online.js)',
        currentPlayer,
        gameMode: typeof gameMode !== 'undefined' ? gameMode : 'undefined',
        infiniteMapSize: infiniteMap.size,
        infCanvasId: typeof infCanvas !== 'undefined' && infCanvas ? infCanvas.id : 'null',
        infCanvasWidth: typeof infCanvasW !== 'undefined' ? infCanvasW : 0,
        infCanvasHeight: typeof infCanvasH !== 'undefined' ? infCanvasH : 0,
        infCanvasInitialized: typeof infCanvasInitialized !== 'undefined' ? infCanvasInitialized : 'undefined',
        myOnlineRole: window.myOnlineRole || null,
        currentTurn: typeof currentTurn !== 'undefined' ? currentTurn : 'undefined'
    };
    console.log('[DEBUG-BOARD] Game State Snapshot:', info);
    return info;
};
console.log('[DEBUG-BOARD] trang-thai.js loaded — call window.debugGameState() in console to inspect state');

// ===== GETTER / SETTER THỐNG NHẤT =====
function getCell(r, c) {
    if (isInfinite) return infiniteMap.get(`${r},${c}`) || "";
    if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) return "W";
    // Guard: boardState chưa khởi tạo hoặc hàng chưa tồn tại
    if (!boardState || !boardState[r]) return "";
    return boardState[r][c] || "";
}
function setCell(r, c, val) {
    const oldVal = getCell(r, c);
    if (isInfinite) {
        if (window.DEBUG_SYNC) {
            console.log('[setCell] infiniteMap reference:', infiniteMap);
            console.log('[setCell] GameState.board.infiniteMap reference:', typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : 'GameState undefined');
            console.log('[setCell] same map?', infiniteMap === (typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : null));
        }

        if (val === "") {
            infiniteMap.delete(`${r},${c}`);
            if (window.DEBUG_SYNC) console.log('[setCell] REMOVE', r, c, 'old=', oldVal, 'size=', infiniteMap.size);
        } else {
            infiniteMap.set(`${r},${c}`, val);
            if (window.DEBUG_SYNC) console.log('[setCell] ADD', r, c, 'player=', val, 'size=', infiniteMap.size);
        }
    } else {
        // Guard: boardState chưa tồn tại hoặc hàng chưa khởi tạo → fallback về infiniteMap
        if (!boardState || !boardState[r]) {
            console.warn('[DEBUG-BOARD] setCell: boardState[' + r + '] undefined, falling back to infiniteMap. isInfinite=' + isInfinite);
            if (val === "") infiniteMap.delete(`${r},${c}`);
            else infiniteMap.set(`${r},${c}`, val);
        } else {
            boardState[r][c] = val;
        }
    }
    updateZobristHash(r, c, oldVal, val);
}

function isValid(r, c) {
    if (isInfinite) return true;
    return r >= 0 && r < boardSize && c >= 0 && c < boardSize;
}

// ===== INITIALIZATION - Sync with GameState =====
function initializeBoardState() {
    if (typeof GameState !== 'undefined' && GameState.board) {
        infiniteMap = GameState.board.infiniteMap;
        isInfinite = GameState.board.isInfinite;
        boardSize = GameState.board.size;
        winCount = GameState.board.winCount;
        console.log('[trang-thai] Synced with GameState:', {
            infiniteMap: infiniteMap ? 'synced' : 'null',
            isInfinite,
            boardSize,
            winCount
        });
    } else {
        // Fallback if GameState not available
        infiniteMap = new Map();
        console.warn('[trang-thai] GameState not available, created fallback infiniteMap');
    }
}

// Initialize immediately if GameState exists
if (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) {
    initializeBoardState();
}
