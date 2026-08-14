// ══════════════════════════════════════════════════════════════════
// RESPONSE OPTIMIZER - Format và final validation
// ══════════════════════════════════════════════════════════════════
// Vai trò: Format output, validate move, update cache/memory
// Không reasoning - chỉ format và validation
// ══════════════════════════════════════════════════════════════════

const ResponseOptimizer = {
    // ===== MAIN OPTIMIZE FUNCTION =====
    // Input: move {r, c}, context, reason
    // Output: {r, c} (validated and formatted)
    optimize(move, context, reason) {
        // console.log('[ResponseOptimizer] Optimizing response:', { move, reason });
        
        // 1. Validate move
        const validated = this.validateMove(move, context);
        if (!validated.valid) {
            console.error('[ResponseOptimizer] Move validation failed:', validated.error);
            return null;
        }
        
        // 2. Format output
        const formatted = this.formatMove(move, reason);
        
        // 3. Update cache
        this.updateCache(context, move);
        
        // 4. Update memory
        this.updateMemory(context, move);
        
        // console.log('[ResponseOptimizer] Response optimized:', formatted);
        return formatted;
    },

    // ===== VALIDATE MOVE =====
    // Validate move không trống và hợp lệ
    validateMove(move, context) {
        if (!move || move.r === undefined || move.c === undefined) {
            return { valid: false, error: 'Move is undefined' };
        }
        
        const { board } = context;
        const boardKey = `${move.r},${move.c}`;
        const currentValue = board.get(boardKey);
        
        if (currentValue !== '' && currentValue !== undefined) {
            return { valid: false, error: 'Cell is not empty' };
        }
        
        return { valid: true };
    },

    // ===== FORMAT MOVE =====
    // Format move thành {r, c}
    formatMove(move, reason) {
        return {
            r: move.r,
            c: move.c,
            score: Number.isFinite(move.score) ? move.score : 0,
            reason: reason || 'search',
            source: 'BotSuperV2'
        };
    },

    // ===== UPDATE CACHE =====
    // Update cache với kết quả mới
    updateCache(context, move) {
        if (typeof ContextBuilder !== 'undefined' && typeof ContextBuilder.updateCache === 'function') {
            ContextBuilder.updateCache(context, move);
        }
    },

    // ===== UPDATE MEMORY =====
    // Update memory với move mới
    updateMemory(context, move) {
        if (typeof MemoryManager !== 'undefined' && typeof MemoryManager.updateMemory === 'function') {
            MemoryManager.updateMemory(context, move, null); // null result vì chưa có kết quả
        }
    },

    // ===== FINAL VALIDATION =====
    // Final validation trước khi return
    finalValidation(move, context) {
        // Double-check move không trống
        const { board } = context;
        const boardKey = `${move.r},${move.c}`;
        const currentValue = board.get(boardKey);
        
        if (currentValue !== '' && currentValue !== undefined) {
            console.error('[ResponseOptimizer] Final validation failed: cell not empty');
            return false;
        }
        
        return true;
    }
};

// Export
window.ResponseOptimizer = ResponseOptimizer;
