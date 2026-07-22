// ===== GAME STATE - Centralized State Management =====
// Replaces scattered global variables with a single state object
// This ensures consistency and makes features like Undo, Replay, Multiplayer easier

const GameState = {
    // ===== BOARD STATE =====
    board: {
        size: 30,
        winCount: 5,
        state: [],           // For fixed board
        infiniteMap: null,  // For infinite board (Map)
        isInfinite: false,
    },

    // ===== GAME STATUS =====
    status: {
        isActive: true,
        currentPlayer: 'X',
        moveCount: 0,
        moveHistory: [],
        winner: null,
    },

    // ===== PLAYER CONFIGURATION =====
    players: {
        mode: 'ai-god',      // solo, ai-easy, ai-medium, ai-hard, ai-god
        isSolo: false,
        humanPiece: 'X',
        botPiece: 'O',
        isBotMove: false,
    },

    // ===== BOARD TRACKING =====
    tracking: {
        lastMoveR: null,
        lastMoveC: null,
        lastMoveCell: null,
        winningCellCoords: [],
    },

    // ===== TIMER STATE =====
    timer: {
        playerTurnTimer: null,
        gameTotalTimer: null,
        playerTurnSeconds: 0,
        gameTotalSeconds: 0,
    },

    // ===== KEYBOARD CURSOR =====
    cursor: {
        r: 0,
        c: 0,
        visible: false,
    },

    // ===== TRAINING STATE =====
    training: {
        isRunning: false,
        isLocked: false,      // Lock configuration during training
        gamesRemaining: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        botXMode: 'ai-medium',
        botOMode: 'ai-easy',
        learningEnabled: true,
    },

    // ===== DEBUG STATE =====
    debug: {
        enabled: false,
        logLevel: 'info',    // error, warn, info, debug
        logs: [],
        maxLogs: 100,
    },

    // ===== INITIALIZATION =====
    initialize() {
        this.board.state = [];
        this.board.infiniteMap = new Map();
        this.board.isInfinite = true;
        this.board.winCount = 5;
        
        this.status.isActive = true;
        this.status.currentPlayer = 'X';
        this.status.moveCount = 0;
        this.status.moveHistory = [];
        this.status.winner = null;
        
        this.players.mode = 'ai-god';
        this.players.isSolo = false;
        this.players.humanPiece = 'X';
        this.players.botPiece = 'O';
        this.players.isBotMove = false;
        
        this.tracking.lastMoveR = null;
        this.tracking.lastMoveC = null;
        this.tracking.lastMoveCell = null;
        this.tracking.winningCellCoords = [];
        
        this.timer.playerTurnSeconds = 0;
        this.timer.gameTotalSeconds = 0;
        
        this.cursor.r = 0;
        this.cursor.c = 0;
        this.cursor.visible = false;
        
        this.training.isRunning = false;
        this.training.isLocked = false;
    },

    // ===== STATE GETTERS =====
    getBoard() {
        return this.board.isInfinite ? this.board.infiniteMap : this.board.state;
    },

    getCurrentPlayer() {
        return this.status.currentPlayer;
    },

    getMoveHistory() {
        return this.status.moveHistory;
    },

    isGameActive() {
        return this.status.isActive;
    },

    isTraining() {
        return this.training.isRunning;
    },

    isTrainingLocked() {
        return this.training.isLocked;
    },

    // ===== STATE SETTERS =====
    setBoardState(r, c, value) {
        if (this.board.isInfinite) {
            if (value === "") {
                this.board.infiniteMap.delete(`${r},${c}`);
                // Đồng bộ với global infiniteMap
                if (typeof infiniteMap !== 'undefined') {
                    infiniteMap.delete(`${r},${c}`);
                }
            } else {
                this.board.infiniteMap.set(`${r},${c}`, value);
                // Đồng bộ với global infiniteMap
                if (typeof infiniteMap !== 'undefined') {
                    infiniteMap.set(`${r},${c}`, value);
                }
            }
        } else {
            if (r >= 0 && r < this.board.size && c >= 0 && c < this.board.size) {
                this.board.state[r][c] = value;
            }
        }
    },

    getBoardCell(r, c) {
        if (this.board.isInfinite) {
            return this.board.infiniteMap.get(`${r},${c}`) || "";
        } else {
            if (r >= 0 && r < this.board.size && c >= 0 && c < this.board.size) {
                return this.board.state[r][c];
            }
            return "W"; // Wall/out of bounds
        }
    },

    setCurrentPlayer(player) {
        this.status.currentPlayer = player;
    },

    setGameActive(active) {
        this.status.isActive = active;
    },

    addMoveToHistory(r, c, player) {
        this.status.moveHistory.push({ r, c, player });
        this.status.moveCount++;
    },

    // ===== TRAINING LOCK =====
    lockTraining() {
        this.training.isLocked = true;
    },

    unlockTraining() {
        this.training.isLocked = false;
    },

    // ===== DEBUG LOGGING =====
    log(level, message, data = null) {
        if (!this.debug.enabled) return;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };
        
        this.debug.logs.push(logEntry);
        
        // Keep only last maxLogs entries
        if (this.debug.logs.length > this.debug.maxLogs) {
            this.debug.logs.shift();
        }
        
        // Console output based on log level
        const shouldLog = this.shouldLog(level);
        if (shouldLog) {
            console.log(`[${level.toUpperCase()}] ${message}`, data || '');
        }
    },

    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.debug.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex <= currentLevelIndex;
    },

    getLogs(level = null) {
        if (level) {
            return this.debug.logs.filter(log => log.level === level);
        }
        return this.debug.logs;
    },

    clearLogs() {
        this.debug.logs = [];
    },

    enableDebug(enabled = true, logLevel = 'info') {
        this.debug.enabled = enabled;
        this.debug.logLevel = logLevel;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}
