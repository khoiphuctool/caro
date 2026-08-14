// ══════════════════════════════════════════════════════════════════
// INTENT ROUTER - Phân loại request và chọn pipeline
// ══════════════════════════════════════════════════════════════════
// Vai trò: Phân loại request, xác định độ khó, chọn pipeline (Fast/Deep)
// Không thực hiện reasoning - chỉ routing
// ══════════════════════════════════════════════════════════════════

const IntentRouter = {
    // ===== CONFIGURATION =====
    config: {
        // Threshold để quyết định Fast vs Deep Path
        COMPLEXITY_THRESHOLD: 0.3,
        
        // Move count threshold cho early game
        EARLY_GAME_MOVES: 2,
        
        // Tactical move confidence threshold
        TACTICAL_CONFIDENCE: 0.8
    },

    // ===== MAIN ROUTING FUNCTION =====
    // Input: context { board, rules, moveHistory, ... }
    // Output: 'FAST' | 'DEEP'
    route(context) {
        const complexity = this.calculateComplexity(context);
        const isEarlyGame = this.isEarlyGame(context);
        const hasObviousTactical = this.hasObviousTacticalMove(context);

        // console.log('[IntentRouter] Routing decision:', {
            // complexity,
            // isEarlyGame,
            // hasObviousTactical,
            // decision: isEarlyGame || hasObviousTactical || complexity < this.config.COMPLEXITY_THRESHOLD ? 'FAST' : 'DEEP'
        // });

        // Fast Path conditions
        if (isEarlyGame) return 'FAST';
        if (hasObviousTactical) return 'FAST';
        if (complexity < this.config.COMPLEXITY_THRESHOLD) return 'FAST';

        // Deep Path for complex situations
        return 'DEEP';
    },

    // ===== CALCULATE COMPLEXITY =====
    // Tính độ phức tạp của tình huống hiện tại
    // Return: 0-1 (0 = đơn giản, 1 = phức tạp)
    calculateComplexity(context) {
        let complexity = 0;

        const { board, rules, moveHistory } = context;

        // Factor 1: Số quân trên bàn (càng nhiều càng phức tạp)
        const pieceCount = board.size || 0;
        const pieceComplexity = Math.min(pieceCount / 50, 1); // Max at 50 pieces
        complexity += pieceComplexity * 0.3;

        // Factor 2: Win count (càng thấp càng phức tạp)
        const winCount = rules.winCount || 5;
        const winCountComplexity = winCount <= 3 ? 0.4 : (winCount >= 6 ? 0.1 : 0.2);
        complexity += winCountComplexity * 0.2;

        // Factor 3: Số lượng threats trên bàn
        const threatCount = this.countThreats(context);
        const threatComplexity = Math.min(threatCount / 10, 1);
        complexity += threatComplexity * 0.3;

        // Factor 4: Độ phân tán quân (càng phân tán càng phức tạp)
        const dispersion = this.calculateDispersion(context);
        const dispersionComplexity = dispersion;
        complexity += dispersionComplexity * 0.2;

        return Math.min(complexity, 1);
    },

    // ===== IS EARLY GAME =====
    // Kiểm tra có phải early game không
    isEarlyGame(context) {
        const moveCount = context.moveHistory ? context.moveHistory.length : 0;
        return moveCount <= this.config.EARLY_GAME_MOVES;
    },

    // ===== HAS OBVIOUS TACTICAL MOVE =====
    // Kiểm tra có nước đi chiến thuật rõ ràng không
    hasObviousTacticalMove(context) {
        const { board, rules, player, opponent } = context;

        // Check Win Now
        if (this.hasWinningMove(board, player, rules)) return true;

        // Check Block Win
        if (this.hasWinningMove(board, opponent, rules)) return true;

        // Check Forced Four
        if (this.hasForcedFour(board, player, rules)) return true;

        // Check THREE_OPEN (dangerous)
        if (this.hasThreeOpen(board, opponent, rules)) return true;

        return false;
    },

    // ===== COUNT THREATS =====
    // Đếm số lượng threats trên bàn
    countThreats(context) {
        const { board, rules, player, opponent } = context;
        let threatCount = 0;

        // Simple threat counting (không dùng full ThreatDetector để tránh overhead)
        board.forEach((val, key) => {
            const [r, c] = key.split(',').map(Number);
            
            // Check threats cho player
            if (val === player) {
                if (this.checkLineThreat(r, c, player, rules)) threatCount++;
            }
            
            // Check threats cho opponent
            if (val === opponent) {
                if (this.checkLineThreat(r, c, opponent, rules)) threatCount++;
            }
        });

        return threatCount;
    },

    // ===== CALCULATE DISPERSION =====
    // Tính độ phân tán quân trên bàn
    // Return: 0-1 (0 = tập trung, 1 = phân tán)
    calculateDispersion(context) {
        const { board } = context;
        
        if (board.size === 0) return 0;

        const positions = [];
        board.forEach((val, key) => {
            const [r, c] = key.split(',').map(Number);
            positions.push({ r, c });
        });

        // Calculate centroid
        const sumR = positions.reduce((sum, p) => sum + p.r, 0);
        const sumC = positions.reduce((sum, p) => sum + p.c, 0);
        const centroidR = sumR / positions.length;
        const centroidC = sumC / positions.length;

        // Calculate average distance from centroid
        const avgDistance = positions.reduce((sum, p) => {
            return sum + Math.abs(p.r - centroidR) + Math.abs(p.c - centroidC);
        }, 0) / positions.length;

        // Normalize to 0-1 (assuming max reasonable distance is 10)
        return Math.min(avgDistance / 10, 1);
    },

    // ===== HAS WINNING MOVE =====
    // Kiểm tra có nước thắng ngay không
    hasWinningMove(board, player, rules) {
        const winCount = rules.winCount || 5;
        
        // Check mỗi ô trống lân cận
        for (const [key, val] of board) {
            if (val !== player) continue;
            
            const [r, c] = key.split(',').map(Number);
            
            // Check 4 hướng
            const directions = [
                { dr: 0, dc: 1 },   // Horizontal
                { dr: 1, dc: 0 },   // Vertical
                { dr: 1, dc: 1 },   // Diagonal \
                { dr: 1, dc: -1 }   // Diagonal /
            ];

            for (const { dr, dc } of directions) {
                let count = 1;
                
                // Check forward
                for (let i = 1; i < winCount; i++) {
                    const nr = r + dr * i;
                    const nc = c + dc * i;
                    const key = `${nr},${nc}`;
                    if (board.get(key) === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                
                // Check backward
                for (let i = 1; i < winCount; i++) {
                    const nr = r - dr * i;
                    const nc = c - dc * i;
                    const key = `${nr},${nc}`;
                    if (board.get(key) === player) {
                        count++;
                    } else {
                        break;
                    }
                }

                if (count >= winCount) return true;
            }
        }

        return false;
    },

    // ===== HAS FORCED FOUR =====
    // Kiểm tra có FOUR không thể chặn không
    hasForcedFour(board, player, rules) {
        const winCount = rules.winCount || 5;
        const chan2Dau = rules.chan2Dau !== false;

        // Simplified check - không full implementation để tránh overhead
        // Chỉ check cơ bản, detailed check để cho Tool Executor
        return false; // Placeholder - implement chi tiết trong Tool Executor
    },

    // ===== HAS THREE OPEN =====
    // Kiểm tra có THREE_OPEN nguy hiểm không
    hasThreeOpen(board, player, rules) {
        // Simplified check - detailed check để cho Tool Executor
        return false; // Placeholder
    },

    // ===== CHECK LINE THREAT =====
    // Kiểm tra threat trên một hướng
    checkLineThreat(r, c, player, rules) {
        // Simplified threat detection
        // Detailed detection để cho Tool Executor
        return false; // Placeholder
    }
};

// Export
window.IntentRouter = IntentRouter;
