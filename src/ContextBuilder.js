// ══════════════════════════════════════════════════════════════════
// CONTEXT BUILDER - Xây dựng context thống nhất
// ══════════════════════════════════════════════════════════════════
// Vai trò: Gom board state, rules, memory, cache thành single context object
// Không tách nhiều module nhỏ - single source of truth
// ══════════════════════════════════════════════════════════════════

const ContextBuilder = {
    // ===== MAIN BUILD FUNCTION =====
    // Input: options { player, opponent, roomRules, ... }
    // Output: context { board, rules, memory, cacheHit, ... }
    build(options = {}) {
        console.log('[ContextBuilder] Building context...');

        const context = {
            // Board state
            board: this.getBoardState(),
            
            // Rules
            rules: this.resolveRules(options),
            
            // Players
            player: options.player || botPiece || 'O',
            opponent: options.opponent || humanPiece || 'X',
            
            // Move history
            moveHistory: this.getMoveHistory(),
            
            // Memory (learning)
            memory: this.getMemory(options),
            
            // Cache
            cacheHit: null,
            
            // Timestamp
            timestamp: Date.now()
        };

        // Check semantic cache
        const cacheResult = this.checkCache(context);
        if (cacheResult) {
            context.cacheHit = cacheResult;
            console.log('[ContextBuilder] Cache hit:', cacheResult);
        }

        console.log('[ContextBuilder] Context built:', {
            boardSize: context.board.size,
            winCount: context.rules.winCount,
            moveCount: context.moveHistory.length,
            cacheHit: !!context.cacheHit
        });

        return context;
    },

    // ===== GET BOARD STATE =====
    // Lấy board state từ GameState
    getBoardState() {
        if (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) {
            return GameState.board.infiniteMap;
        }
        
        // Fallback
        if (typeof infiniteMap !== 'undefined') {
            return infiniteMap;
        }

        return new Map();
    },

    // ===== RESOLVE RULES =====
    // Resolve rules từ nhiều nguồn
    resolveRules(options) {
        // Priority: options.roomRules > GameState.roomRules > window.roomRules > options.winCount > GameState.board.winCount > global winCount
        let winCount, chan2Dau;

        // Try options.roomRules
        if (options.roomRules && typeof options.roomRules.winCount === 'number') {
            winCount = options.roomRules.winCount;
            chan2Dau = options.roomRules.chan2Dau !== undefined ? !!options.roomRules.chan2Dau : true;
        }
        // Try GameState.roomRules
        else if (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') {
            winCount = GameState.roomRules.winCount;
            chan2Dau = GameState.roomRules.chan2Dau !== undefined ? !!GameState.roomRules.chan2Dau : true;
        }
        // Try window.roomRules
        else if (typeof window !== 'undefined' && window.roomRules && typeof window.roomRules.winCount === 'number') {
            winCount = window.roomRules.winCount;
            chan2Dau = window.roomRules.chan2Dau !== undefined ? !!window.roomRules.chan2Dau : true;
        }
        // Try options.winCount
        else if (typeof options.winCount === 'number') {
            winCount = options.winCount;
            chan2Dau = options.chan2Dau !== undefined ? !!options.chan2Dau : true;
        }
        // Try GameState.board.winCount
        else if (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') {
            winCount = GameState.board.winCount;
            chan2Dau = true; // Default
        }
        // Try global winCount
        else if (typeof winCount !== 'undefined') {
            winCount = winCount;
            chan2Dau = true; // Default
        }
        // Default
        else {
            winCount = 5;
            chan2Dau = true;
        }

        return {
            winCount,
            chan2Dau
        };
    },

    // ===== GET MOVE HISTORY =====
    // Lấy move history
    getMoveHistory() {
        if (typeof moveHistory !== 'undefined') {
            return moveHistory;
        }
        return [];
    },

    // ===== GET MEMORY =====
    // Lấy memory từ MemoryManager (unified)
    getMemory(options) {
        if (typeof MemoryManager !== 'undefined' && typeof MemoryManager.getMemory === 'function') {
            return MemoryManager.getMemory(options);
        }
        
        // Fallback: empty memory
        return {
            patterns: [],
            opponentHabits: [],
            successfulMoves: [],
            failedMoves: []
        };
    },

    // ===== CHECK CACHE =====
    // Check semantic cache
    checkCache(context) {
        if (typeof SemanticCache !== 'undefined' && typeof SemanticCache.get === 'function') {
            const hash = this.generateBoardHash(context.board, context.rules);
            return SemanticCache.get(hash);
        }
        return null;
    },

    // ===== GENERATE BOARD HASH =====
    // Generate hash cho board state để cache lookup
    generateBoardHash(board, rules) {
        // Simple hash implementation
        let hash = '';
        
        // Add rules to hash
        hash += `wc:${rules.winCount}|c2d:${rules.chan2Dau ? 1 : 0}|`;
        
        // Add board state to hash (sorted keys for consistency)
        const sortedKeys = Array.from(board.keys()).sort();
        for (const key of sortedKeys) {
            const val = board.get(key);
            hash += `${key}:${val}|`;
        }
        
        // Simple hash function (djb2)
        let hashValue = 5381;
        for (let i = 0; i < hash.length; i++) {
            hashValue = ((hashValue << 5) + hashValue) + hash.charCodeAt(i);
        }
        
        return hashValue.toString(36);
    },

    // ===== UPDATE CACHE =====
    // Update cache với kết quả mới
    updateCache(context, move) {
        if (typeof SemanticCache !== 'undefined' && typeof SemanticCache.set === 'function') {
            const hash = this.generateBoardHash(context.board, context.rules);
            SemanticCache.set(hash, {
                move,
                timestamp: Date.now(),
                context: {
                    boardSize: context.board.size,
                    winCount: context.rules.winCount
                }
            });
        }
    },

    // ===== UPDATE MEMORY =====
    // Update memory với move mới
    updateMemory(context, move, result) {
        if (typeof MemoryManager !== 'undefined' && typeof MemoryManager.updateMemory === 'function') {
            MemoryManager.updateMemory(context, move, result);
        }
    }
};

// Export
window.ContextBuilder = ContextBuilder;
