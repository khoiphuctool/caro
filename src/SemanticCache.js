// ══════════════════════════════════════════════════════════════════
// SEMANTIC CACHE - Cache kết quả tương tự
// ══════════════════════════════════════════════════════════════════
// Vai trò: Cache kết quả cho board state tương tự
// Tránh gọi lại engine cho pattern lặp lại
// ══════════════════════════════════════════════════════════════════

const SemanticCache = {
    // ===== CONFIGURATION =====
    config: {
        // Max entries trong cache
        MAX_ENTRIES: 500,
        
        // TTL cho cache entries (milliseconds)
        TTL: 5 * 60 * 1000,  // 5 minutes
        
        // Similarity threshold để coi là "tương tự"
        SIMILARITY_THRESHOLD: 0.85
    },

    // ===== CACHE STORAGE =====
    cache: new Map(),

    // ===== GET =====
    // Lấy cache entry theo hash
    get(hash) {
        const entry = this.cache.get(hash);
        
        if (!entry) return null;
        
        // Check TTL
        if (Date.now() - entry.timestamp > this.config.TTL) {
            this.cache.delete(hash);
            return null;
        }
        
        console.log('[SemanticCache] Cache hit for hash:', hash);
        return entry;
    },

    // ===== SET =====
    // Set cache entry
    set(hash, data) {
        // Check cache size
        if (this.cache.size >= this.config.MAX_ENTRIES) {
            this.evictOldest();
        }
        
        this.cache.set(hash, {
            ...data,
            timestamp: Date.now()
        });
        
        console.log('[SemanticCache] Cache set for hash:', hash);
    },

    // ===== EVICT OLDEST =====
    // Xóa entry cũ nhất khi cache đầy
    evictOldest() {
        let oldestHash = null;
        let oldestTimestamp = Infinity;
        
        for (const [hash, entry] of this.cache) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestHash = hash;
            }
        }
        
        if (oldestHash) {
            this.cache.delete(oldestHash);
            console.log('[SemanticCache] Evicted oldest entry:', oldestHash);
        }
    },

    // ===== FIND SIMILAR =====
    // Tìm cache entry tương tự (không cần hash chính xác)
    findSimilar(boardHash, context) {
        const entries = Array.from(this.cache.entries());
        
        for (const [hash, entry] of entries) {
            // Check TTL
            if (Date.now() - entry.timestamp > this.config.TTL) {
                this.cache.delete(hash);
                continue;
            }
            
            // Calculate similarity
            const similarity = this.calculateSimilarity(boardHash, hash, context);
            
            if (similarity >= this.config.SIMILARITY_THRESHOLD) {
                console.log('[SemanticCache] Found similar cache:', {
                    originalHash: hash,
                    similarity,
                    move: entry.move
                });
                return entry;
            }
        }
        
        return null;
    },

    // ===== CALCULATE SIMILARITY =====
    // Tính similarity giữa 2 hash (simplified)
    calculateSimilarity(hash1, hash2, context) {
        // Simple implementation: so sánh context metadata
        const entry1 = this.cache.get(hash1);
        const entry2 = this.cache.get(hash2);
        
        if (!entry1 || !entry2) return 0;
        
        const ctx1 = entry1.context || {};
        const ctx2 = entry2.context || {};
        
        let similarity = 0;
        let factors = 0;
        
        // Factor 1: Board size similarity
        if (ctx1.boardSize !== undefined && ctx2.boardSize !== undefined) {
            const sizeDiff = Math.abs(ctx1.boardSize - ctx2.boardSize);
            const sizeSimilarity = 1 - (sizeDiff / Math.max(ctx1.boardSize, ctx2.boardSize));
            similarity += sizeSimilarity * 0.4;
            factors++;
        }
        
        // Factor 2: Win count similarity
        if (ctx1.winCount !== undefined && ctx2.winCount !== undefined) {
            if (ctx1.winCount === ctx2.winCount) {
                similarity += 0.3;
            }
            factors++;
        }
        
        // Factor 3: Move count similarity
        if (ctx1.moveCount !== undefined && ctx2.moveCount !== undefined) {
            const moveDiff = Math.abs(ctx1.moveCount - ctx2.moveCount);
            const moveSimilarity = 1 - (moveDiff / Math.max(ctx1.moveCount, ctx2.moveCount, 1));
            similarity += moveSimilarity * 0.3;
            factors++;
        }
        
        return factors > 0 ? similarity / factors : 0;
    },

    // ===== CLEAR =====
    // Xóa toàn bộ cache
    clear() {
        this.cache.clear();
        console.log('[SemanticCache] Cache cleared');
    },

    // ===== CLEANUP =====
    // Xóa entries expired
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [hash, entry] of this.cache) {
            if (now - entry.timestamp > this.config.TTL) {
                this.cache.delete(hash);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log('[SemanticCache] Cleaned up', cleaned, 'expired entries');
        }
    },

    // ===== GET STATS =====
    // Lấy thống kê cache
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.config.MAX_ENTRIES,
            ttl: this.config.TTL,
            hitRate: this.hitRate || 0,
            missRate: this.missRate || 0
        };
    },

    // ===== RECORD HIT =====
    recordHit() {
        this.hits = (this.hits || 0) + 1;
        this.totalRequests = (this.totalRequests || 0) + 1;
        this.hitRate = this.hits / this.totalRequests;
    },

    // ===== RECORD MISS =====
    recordMiss() {
        this.misses = (this.misses || 0) + 1;
        this.totalRequests = (this.totalRequests || 0) + 1;
        this.missRate = this.misses / this.totalRequests;
    }
};

// Export
window.SemanticCache = SemanticCache;
