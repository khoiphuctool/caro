// ══════════════════════════════════════════════════════════════════
// MEMORY MANAGER - Unified Memory Management
// ══════════════════════════════════════════════════════════════════
// Vai trò: Quản lý tất cả loại memory (conversation, user, knowledge)
// Single source of truth - không phân mảnh
// ══════════════════════════════════════════════════════════════════

const MemoryManager = {
    // ===== CONFIGURATION =====
    config: {
        // Max entries cho mỗi loại memory
        MAX_PATTERNS: 100,
        MAX_HABITS: 50,
        MAX_MOVES: 200,
        
        // TTL cho memory (milliseconds)
        PATTERN_TTL: 24 * 60 * 60 * 1000,  // 24 hours
        HABIT_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days
        MOVE_TTL: 1 * 60 * 60 * 1000,      // 1 hour
    },

    // ===== MEMORY STORAGE =====
    memory: {
        // Conversation Memory: nước đi trong ván hiện tại
        conversation: {
            moves: [],           // [{r, c, player, timestamp}]
            patterns: [],       // Patterns đã phát hiện
            threats: []         // Threats đã phát hiện
        },
        
        // User Memory: thói quen người chơi
        user: {
            habits: [],         // [{pattern, frequency, lastSeen}]
            preferredMoves: [], // [{position, frequency, success}]
            weaknesses: []      // [{pattern, count}]
        },
        
        // Knowledge Memory: patterns đã học
        knowledge: {
            successfulPatterns: [],  // [{pattern, winCount, successRate}]
            failedPatterns: [],       // [{pattern, failCount}]
            openingBook: []          // [{sequence, winRate}]
        }
    },

    // ===== GET MEMORY =====
    // Lấy memory theo type
    getMemory(options = {}) {
        const type = options.type || 'all';
        
        if (type === 'all') {
            return {
                conversation: this.memory.conversation,
                user: this.memory.user,
                knowledge: this.memory.knowledge
            };
        }
        
        return this.memory[type] || {};
    },

    // ===== UPDATE MEMORY =====
    // Update memory với move mới
    updateMemory(context, move, result) {
        const { player, opponent } = context;
        
        // Update conversation memory
        this.updateConversationMemory(context, move, result);
        
        // Update user memory (nếu có kết quả)
        if (result && result.winner) {
            this.updateUserMemory(context, move, result);
        }
        
        // Update knowledge memory
        this.updateKnowledgeMemory(context, move, result);
        
        // Cleanup old memory
        this.cleanupMemory();
    },

    // ===== UPDATE CONVERSATION MEMORY =====
    updateConversationMemory(context, move, result) {
        const { conversation } = this.memory;
        
        // Add move to conversation
        conversation.moves.push({
            r: move.r,
            c: move.c,
            player: context.player,
            timestamp: Date.now()
        });
        
        // Limit size
        if (conversation.moves.length > this.config.MAX_MOVES) {
            conversation.moves = conversation.moves.slice(-this.config.MAX_MOVES);
        }
    },

    // ===== UPDATE USER MEMORY =====
    updateUserMemory(context, move, result) {
        const { user } = this.memory;
        const { opponent } = context;
        
        // Track opponent's habits (nếu opponent là người)
        if (result.winner === opponent) {
            // Opponent thắng -> ghi nhớ pattern thành công của họ
            this.trackHabit(move, 'success');
        } else if (result.winner === context.player) {
            // Bot thắng -> ghi nhớ pattern thất bại của opponent
            this.trackHabit(move, 'failure');
        }
    },

    // ===== TRACK HABIT =====
    trackHabit(move, type) {
        const { user } = this.memory;
        const habitKey = `${move.r},${move.c}`;
        
        const existingHabit = user.habits.find(h => h.key === habitKey);
        if (existingHabit) {
            existingHabit.frequency++;
            existingHabit.lastSeen = Date.now();
            if (type === 'success') {
                existingHabit.successCount++;
            } else {
                existingHabit.failureCount++;
            }
        } else {
            user.habits.push({
                key: habitKey,
                r: move.r,
                c: move.c,
                frequency: 1,
                successCount: type === 'success' ? 1 : 0,
                failureCount: type === 'failure' ? 1 : 0,
                lastSeen: Date.now()
            });
        }
        
        // Limit size
        if (user.habits.length > this.config.MAX_HABITS) {
            user.habits = user.habits.slice(-this.config.MAX_HABITS);
        }
    },

    // ===== UPDATE KNOWLEDGE MEMORY =====
    updateKnowledgeMemory(context, move, result) {
        const { knowledge } = this.memory;
        
        // Extract pattern từ move
        const pattern = this.extractPattern(context, move);
        
        if (result.winner === context.player) {
            // Bot thắng -> ghi nhớ pattern thành công
            this.trackPattern(pattern, 'success', knowledge.successfulPatterns);
        } else {
            // Bot thua -> ghi nhớ pattern thất bại
            this.trackPattern(pattern, 'failure', knowledge.failedPatterns);
        }
    },

    // ===== EXTRACT PATTERN =====
    extractPattern(context, move) {
        // Simple pattern extraction: local pattern quanh move
        const { board, rules } = context;
        const { r, c } = move;
        const winCount = rules.winCount || 5;
        
        const pattern = [];
        
        // Extract pattern trong window winCount x winCount
        for (let dr = -(winCount - 1); dr <= winCount - 1; dr++) {
            for (let dc = -(winCount - 1); dc <= winCount - 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                const key = `${nr},${nc}`;
                const val = board.get(key);
                pattern.push(val || ' ');
            }
        }
        
        return pattern.join('');
    },

    // ===== TRACK PATTERN =====
    trackPattern(pattern, type, storage) {
        const existing = storage.find(p => p.pattern === pattern);
        
        if (existing) {
            if (type === 'success') {
                existing.count++;
                existing.lastSeen = Date.now();
            } else {
                existing.failCount++;
            }
        } else {
            storage.push({
                pattern,
                count: type === 'success' ? 1 : 0,
                failCount: type === 'failure' ? 1 : 0,
                lastSeen: Date.now()
            });
        }
        
        // Limit size
        if (storage.length > this.config.MAX_PATTERNS) {
            // Remove oldest
            storage.sort((a, b) => a.lastSeen - b.lastSeen);
            storage.shift();
        }
    },

    // ===== CLEANUP MEMORY =====
    // Xóa memory cũ theo TTL
    cleanupMemory() {
        const now = Date.now();
        
        // Cleanup conversation memory
        this.memory.conversation.moves = this.memory.conversation.moves.filter(
            m => now - m.timestamp < this.config.MOVE_TTL
        );
        
        // Cleanup user habits
        this.memory.user.habits = this.memory.user.habits.filter(
            h => now - h.lastSeen < this.config.HABIT_TTL
        );
        
        // Cleanup knowledge patterns
        this.memory.knowledge.successfulPatterns = this.memory.knowledge.successfulPatterns.filter(
            p => now - p.lastSeen < this.config.PATTERN_TTL
        );
        
        this.memory.knowledge.failedPatterns = this.memory.knowledge.failedPatterns.filter(
            p => now - p.lastSeen < this.config.PATTERN_TTL
        );
    },

    // ===== RESET CONVERSATION MEMORY =====
    // Reset conversation memory khi bắt đầu ván mới
    resetConversation() {
        this.memory.conversation = {
            moves: [],
            patterns: [],
            threats: []
        };
    },

    // ===== GET SIMILAR PATTERNS =====
    // Tìm patterns tương tự từ knowledge
    getSimilarPatterns(context, move) {
        const currentPattern = this.extractPattern(context, move);
        const { knowledge } = this.memory;
        
        const similar = [];
        
        // Check successful patterns
        for (const p of knowledge.successfulPatterns) {
            const similarity = this.calculateSimilarity(currentPattern, p.pattern);
            if (similarity > 0.7) {
                similar.push({
                    pattern: p.pattern,
                    similarity,
                    type: 'success',
                    successRate: p.count / (p.count + p.failCount)
                });
            }
        }
        
        // Check failed patterns
        for (const p of knowledge.failedPatterns) {
            const similarity = this.calculateSimilarity(currentPattern, p.pattern);
            if (similarity > 0.7) {
                similar.push({
                    pattern: p.pattern,
                    similarity,
                    type: 'failure',
                    failRate: p.failCount / (p.count + p.failCount)
                });
            }
        }
        
        // Sort by similarity
        similar.sort((a, b) => b.similarity - a.similarity);
        
        return similar.slice(0, 5); // Top 5 similar patterns
    },

    // ===== CALCULATE SIMILARITY =====
    // Tính similarity giữa 2 patterns (simple implementation)
    calculateSimilarity(pattern1, pattern2) {
        if (pattern1.length !== pattern2.length) return 0;
        
        let matches = 0;
        for (let i = 0; i < pattern1.length; i++) {
            if (pattern1[i] === pattern2[i]) {
                matches++;
            }
        }
        
        return matches / pattern1.length;
    },

    // ===== GET PENALTY FOR MOVE =====
    // Lấy penalty cho move dựa trên memory (learning)
    getPenalty(context, move) {
        const similarPatterns = this.getSimilarPatterns(context, move);
        let penalty = 0;
        
        for (const p of similarPatterns) {
            if (p.type === 'failure' && p.failRate > 0.6) {
                penalty += p.similarity * 1000;
            }
        }
        
        return penalty;
    },

    // ===== EXPORT MEMORY =====
    // Export memory để lưu trữ
    exportMemory() {
        return JSON.stringify(this.memory);
    },

    // ===== IMPORT MEMORY =====
    // Import memory từ storage
    importMemory(data) {
        try {
            const imported = JSON.parse(data);
            this.memory = imported;
            return true;
        } catch (e) {
            console.error('[MemoryManager] Failed to import memory:', e);
            return false;
        }
    }
};

// Export
window.MemoryManager = MemoryManager;
