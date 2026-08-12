// ===== CACHE - Zobrist Hash and Transposition Table =====
// Enhanced caching system for AI performance optimization

const Cache = {
    // ===== ZOBRIST HASHING =====
    zobrist: {
        table: [],
        size: 100,
        hash: 0,
        
        initialize() {
            this.table = [];
            for (let r = 0; r < this.size; r++) {
                this.table[r] = [];
                for (let c = 0; c < this.size; c++) {
                    this.table[r][c] = [
                        Math.floor(Math.random() * 0xFFFFFFFF),
                        Math.floor(Math.random() * 0xFFFFFFFF),
                        Math.floor(Math.random() * 0xFFFFFFFF)
                    ];
                }
            }
            this.hash = 0;
        },

        getIndex(r) {
            return ((r % this.size) + this.size) % this.size;
        },

        getColIndex(c) {
            return ((c % this.size) + this.size) % this.size;
        },

        update(r, c, oldPiece, newPiece) {
            const zr = this.getIndex(r);
            const zc = this.getColIndex(c);
            const oldVal = oldPiece === '' ? 0 : (oldPiece === 'X' ? 1 : 2);
            const newVal = newPiece === '' ? 0 : (newPiece === 'X' ? 1 : 2);
            this.hash ^= this.table[zr][zc][oldVal];
            this.hash ^= this.table[zr][zc][newVal];
        },

        get() {
            return this.hash;
        },

        reset() {
            this.hash = 0;
        }
    },

    // ===== TRANSPOSITION TABLE =====
    transposition: {
        table: new Map(),
        maxSize: 100000,
        hits: 0,
        misses: 0,
        replacements: 0,

        lookup(hash, depth, alpha, beta) {
            const entry = this.table.get(hash);
            if (entry && entry.depth >= depth) {
                this.hits++;
                if (entry.flag === 'exact') return entry.value;
                if (entry.flag === 'lower' && entry.value >= alpha) return entry.value;
                if (entry.flag === 'upper' && entry.value <= beta) return entry.value;
            }
            this.misses++;
            return null;
        },

        store(hash, depth, value, flag) {
            if (this.table.size >= this.maxSize) {
                // Replace oldest entry (simple replacement strategy)
                const firstKey = this.table.keys().next().value;
                this.table.delete(firstKey);
                this.replacements++;
            }
            this.table.set(hash, { depth, value, flag, timestamp: Date.now() });
        },

        clear() {
            this.table.clear();
            this.hits = 0;
            this.misses = 0;
            this.replacements = 0;
        },

        getStats() {
            return {
                size: this.table.size,
                hits: this.hits,
                misses: this.misses,
                hitRate: this.hits + this.misses > 0 ? 
                    (this.hits / (this.hits + this.misses) * 100).toFixed(2) + '%' : '0%',
                replacements: this.replacements
            };
        }
    },

    // ===== KILLER MOVE HEURISTIC =====
    killer: {
        moves: [],
        maxDepth: 20,

        initialize() {
            this.moves = [];
            for (let i = 0; i < this.maxDepth; i++) {
                this.moves[i] = [];
            }
        },

        add(depth, r, c) {
            if (depth < this.maxDepth) {
                const exists = this.moves[depth].some(m => m.r === r && m.c === c);
                if (!exists) {
                    this.moves[depth].unshift({ r, c });
                    if (this.moves[depth].length > 2) {
                        this.moves[depth].pop();
                    }
                }
            }
        },

        isKiller(depth, r, c) {
            if (depth < this.maxDepth && this.moves[depth]) {
                return this.moves[depth].some(m => m.r === r && m.c === c);
            }
            return false;
        },

        clear() {
            for (let i = 0; i < this.maxDepth; i++) {
                this.moves[i] = [];
            }
        },

        getStats() {
            let totalMoves = 0;
            for (let i = 0; i < this.maxDepth; i++) {
                totalMoves += this.moves[i].length;
            }
            return {
                totalMoves,
                depthsUsed: this.moves.filter((m, i) => m.length > 0).length
            };
        }
    },

    // ===== HISTORY HEURISTIC =====
    history: {
        table: new Map(),
        maxAge: 100,

        increment(r, c) {
            const key = `${r},${c}`;
            const current = this.table.get(key) || 0;
            this.table.set(key, current + 1);
        },

        getScore(r, c) {
            const key = `${r},${c}`;
            return this.table.get(key) || 0;
        },

        clear() {
            this.table.clear();
        },

        getStats() {
            return {
                size: this.table.size,
                totalScore: Array.from(this.table.values()).reduce((a, b) => a + b, 0)
            };
        }
    },

    // ===== EVALUATION CACHE =====
    evaluation: {
        cache: new Map(),
        maxSize: 5000,
        hits: 0,
        misses: 0,

        get(r, c, player, winCount) {
            const key = `${r},${c},${player},${winCount}`;
            const entry = this.cache.get(key);
            if (entry) {
                this.hits++;
                return entry;
            }
            this.misses++;
            return null;
        },

        set(r, c, player, winCount, evaluation) {
            const key = `${r},${c},${player},${winCount}`;
            if (this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(key, evaluation);
        },

        clear() {
            this.cache.clear();
            this.hits = 0;
            this.misses = 0;
        },

        getStats() {
            return {
                size: this.cache.size,
                hits: this.hits,
                misses: this.misses,
                hitRate: this.hits + this.misses > 0 ? 
                    (this.hits / (this.hits + this.misses) * 100).toFixed(2) + '%' : '0%'
            };
        }
    },

    // ===== INITIALIZATION =====
    initialize() {
        this.zobrist.initialize();
        this.killer.initialize();
    },

    // ===== CLEAR ALL CACHES =====
    clearAll() {
        this.zobrist.reset();
        this.transposition.clear();
        this.killer.clear();
        this.history.clear();
        this.evaluation.clear();
    },

    // ===== GET COMPREHENSIVE STATS =====
    getAllStats() {
        return {
            zobrist: {
                hash: this.zobrist.hash.toString(16)
            },
            transposition: this.transposition.getStats(),
            killer: this.killer.getStats(),
            history: this.history.getStats(),
            evaluation: this.evaluation.getStats()
        };
    },

    // ===== LOG CACHE STATS =====
    logStats() {
        const stats = this.getAllStats();
        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log('cache', 'info', 'Cache statistics', stats);
        } else {
            console.log('Cache Statistics:', stats);
        }
    }
};

// Initialize cache on load
Cache.initialize();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cache;
}
