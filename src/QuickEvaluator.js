// ══════════════════════════════════════════════════════════════════
// QUICK EVALUATOR - Đánh giá nhanh cho Fast Path
// ══════════════════════════════════════════════════════════════════
// Vai trò: Đánh giá nhanh tactical moves cho tình huống đơn giản
// Gom tất cả tactical scan vào một module
// ══════════════════════════════════════════════════════════════════

const QuickEvaluator = {
    // ===== MAIN EVALUATE FUNCTION =====
    // Input: context { board, rules, player, opponent, ... }
    // Output: { move, reason } hoặc null (nếu cần Deep Path)
    evaluate(context) {
        console.log('[QuickEvaluator] Starting quick evaluation...');
        
        const { board, rules, player, opponent } = context;
        const winCount = rules.winCount || 5;
        const chan2Dau = rules.chan2Dau !== false;
        
        // Get all tactical cells (ô trống lân cận quân đã đánh)
        const allEmpty = this.getAllTacticalCells(board);
        
        // 1. Win Now Check
        const winMove = this.checkWinNow(allEmpty, player, winCount);
        if (winMove) {
            console.log('[QuickEvaluator] Win now:', winMove);
            return { move: winMove, reason: 'Win Now' };
        }
        
        // 2. Block Win Check
        const blockMove = this.checkWinNow(allEmpty, opponent, winCount);
        if (blockMove) {
            console.log('[QuickEvaluator] Block win:', blockMove);
            return { move: blockMove, reason: 'Block Win' };
        }
        
        // 3. Check THREE_OPEN (dangerous) - phải chặn ngay
        const threeOpenBlock = this.checkThreeOpen(allEmpty, opponent, winCount, chan2Dau);
        if (threeOpenBlock) {
            console.log('[QuickEvaluator] Blocking THREE_OPEN:', threeOpenBlock);
            return { move: threeOpenBlock, reason: 'Block THREE_OPEN' };
        }
        
        // 4. Check Forced Four (bot) - FOUR không thể chặn
        const forcedFour = this.checkForcedFour(allEmpty, player, winCount, chan2Dau);
        if (forcedFour) {
            console.log('[QuickEvaluator] Forced four:', forcedFour);
            return { move: forcedFour, reason: 'Forced Four' };
        }
        
        // 5. Check Fork/Double Threat (bot)
        const forkMove = this.checkFork(allEmpty, player, winCount, chan2Dau);
        if (forkMove) {
            console.log('[QuickEvaluator] Fork:', forkMove);
            return { move: forkMove, reason: 'Fork' };
        }
        
        // 6. Check FOUR_OPEN (bot)
        const fourOpen = this.checkFourOpen(allEmpty, player, winCount, chan2Dau);
        if (fourOpen) {
            console.log('[QuickEvaluator] FOUR_OPEN:', fourOpen);
            return { move: fourOpen, reason: 'FOUR_OPEN' };
        }
        
        // 7+8. Smart Blocking + Gap open-end block — đều qua BlockBothEndsAnalyzer
        // getPriorityTacticalMove đã chạy ở ai-nao.js / BotSuperV2 trước khi vào đây,
        // nhưng QuickEvaluator được dùng độc lập trong ContextBuilder nên gọi lại an toàn.
        const smartBlock = this.checkSmartBlock(allEmpty, opponent, winCount, chan2Dau);
        if (smartBlock) {
            console.log('[QuickEvaluator] Smart block (open-end):', smartBlock);
            return { move: smartBlock, reason: 'Smart Block' };
        }
        
        // Không tìm được tactical move rõ ràng -> cần Deep Path
        console.log('[QuickEvaluator] No obvious tactical move, need Deep Path');
        return null;
    },

    // ===== GET ALL TACTICAL CELLS =====
    // Lấy tất cả ô trống lân cận quân đã đánh
    getAllTacticalCells(board) {
        const seen = new Set();
        const result = [];
        
        const addIfEmpty = (r, c) => {
            const key = `${r},${c}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (this.getCell(board, r, c) === '') {
                result.push({ r, c });
            }
        };
        
        board.forEach((val, key) => {
            const [r, c] = key.split(',').map(Number);
            // Check 8 directions với margin 2
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    addIfEmpty(r + dr, c + dc);
                }
            }
        });
        
        return result;
    },

    // ===== GET CELL =====
    getCell(board, r, c) {
        const key = `${r},${c}`;
        return board.get(key) || '';
    },

    // ===== SET CELL =====
    setCell(board, r, c, value) {
        const key = `${r},${c}`;
        if (value === '') {
            board.delete(key);
        } else {
            board.set(key, value);
        }
    },

    // ===== CHECK WIN NOW =====
    // Kiểm tra có nước thắng ngay không
    checkWinNow(allEmpty, player, winCount) {
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        
        for (const { r, c } of allEmpty) {
            if (this.getCell(board, r, c) !== '') continue;
            
            this.setCell(board, r, c, player);
            const win = this.checkWin(r, c, player, winCount);
            this.setCell(board, r, c, '');
            
            if (win) return { r, c };
        }
        
        return null;
    },

    // ===== CHECK WIN =====
    // Kiểm tra thắng tại ô (r, c) — truyền roomRules để áp dụng đúng luật chặn 2 đầu
    checkWin(r, c, player, winCount) {
        if (typeof checkWinSilent === 'function') {
            const rr = (typeof GameState !== 'undefined' && GameState.roomRules)
                ? GameState.roomRules
                : (typeof window !== 'undefined' ? window.roomRules : undefined);
            return checkWinSilent(r, c, rr);
        }
        
        // Fallback: simple count check
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        const directions = [
            { dr: 0, dc: 1 },   // Horizontal
            { dr: 1, dc: 0 },   // Vertical
            { dr: 1, dc: 1 },   // Diagonal \
            { dr: 1, dc: -1 }   // Diagonal /
        ];
        
        for (const { dr, dc } of directions) {
            let count = 1;
            
            // Count forward
            for (let i = 1; i < winCount; i++) {
                const nr = r + dr * i;
                const nc = c + dc * i;
                if (this.getCell(board, nr, nc) === player) {
                    count++;
                } else {
                    break;
                }
            }
            
            // Count backward
            for (let i = 1; i < winCount; i++) {
                const nr = r - dr * i;
                const nc = c - dc * i;
                if (this.getCell(board, nr, nc) === player) {
                    count++;
                } else {
                    break;
                }
            }
            
            if (count >= winCount) return true;
        }
        
        return false;
    },

    // ===== CHECK THREE OPEN =====
    // Kiểm tra THREE_OPEN nguy hiểm
    checkThreeOpen(allEmpty, player, winCount, chan2Dau) {
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        
        // Sử dụng ThreatDetector nếu có
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                if (this.getCell(board, r, c) !== '') continue;
                
                const t = ThreatDetector.evaluateDefenseThreat(r, c, player, winCount, true);
                const hasThreeOpen = t.patternScores && t.patternScores.some(p => 
                    p.pattern === PatternDetector.PATTERN.THREE_OPEN
                );
                
                if (hasThreeOpen) {
                    return { r, c };
                }
            }
        }
        
        // Fallback: simple check
        return null;
    },

    // ===== CHECK FORCED FOUR =====
    // Kiểm tra FOUR không thể chặn
    checkForcedFour(allEmpty, player, winCount, chan2Dau) {
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        
        for (const { r, c } of allEmpty) {
            if (this.getCell(board, r, c) !== '') continue;
            
            this.setCell(board, r, c, player);
            
            let makesFour = false;
            let completionEnds = 0;
            
            const directions = [
                { dr: 0, dc: 1 },
                { dr: 1, dc: 0 },
                { dr: 1, dc: 1 },
                { dr: 1, dc: -1 }
            ];
            
            for (const { dr, dc } of directions) {
                let count = 1;
                let blockedBoth = false;
                
                // Count forward
                for (let i = 1; i < winCount; i++) {
                    const nr = r + dr * i;
                    const nc = c + dc * i;
                    const val = this.getCell(board, nr, nc);
                    if (val === player) {
                        count++;
                    } else if (val !== '') {
                        blockedBoth = true;
                        break;
                    } else {
                        break;
                    }
                }
                
                // Count backward
                for (let i = 1; i < winCount; i++) {
                    const nr = r - dr * i;
                    const nc = c - dc * i;
                    const val = this.getCell(board, nr, nc);
                    if (val === player) {
                        count++;
                    } else if (val !== '') {
                        blockedBoth = true;
                        break;
                    } else {
                        break;
                    }
                }
                
                if (count === winCount - 1 && !blockedBoth) {
                    makesFour = true;
                    completionEnds++;
                }
            }
            
            this.setCell(board, r, c, '');
            
            if (makesFour && completionEnds >= 2) {
                return { r, c };
            }
        }
        
        return null;
    },

    // ===== CHECK FORK =====
    // Kiểm tra fork (nhiều đe dọa cùng lúc)
    checkFork(allEmpty, player, winCount, chan2Dau) {
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                if (this.getCell(board, r, c) !== '') continue;
                
                const t = ThreatDetector.evaluateAttackThreat(r, c, player, winCount, true);
                if (t.maxThreat >= ThreatDetector.THREAT.HIGH) {
                    let threatCount = 0;
                    for (const { pattern } of t.patternScores || []) {
                        if (pattern !== PatternDetector.PATTERN.NONE) {
                            threatCount++;
                        }
                    }
                    if (threatCount >= 2) {
                        return { r, c };
                    }
                }
            }
        }
        
        return null;
    },

    // ===== CHECK FOUR OPEN =====
    // Kiểm tra FOUR_OPEN (1 nước nữa là thắng)
    checkFourOpen(allEmpty, player, winCount, chan2Dau) {
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                if (this.getCell(board, r, c) !== '') continue;
                
                const t = ThreatDetector.evaluateAttackThreat(r, c, player, winCount, true);
                const hasFourOpen = t.patternScores && t.patternScores.some(p => 
                    p.pattern === PatternDetector.PATTERN.FOUR_OPEN
                );
                
                if (hasFourOpen) {
                    return { r, c };
                }
            }
        }
        
        return null;
    },

    // ===== CHECK SMART BLOCK =====
    // Dùng BlockBothEndsAnalyzer làm single source of truth cho mọi loại chặn:
    // - getPriorityTacticalMove: FIVE / open_end_block (FOUR+) / immediate_block
    // - getOpenEndBlockMove: THREE mở 2 đầu và broken chain gap>=1
    // - getBestBlockMoves: fallback cho chuỗi tầm trung >= winCount-2
    checkSmartBlock(allEmpty, opponent, winCount, chan2Dau) {
        if (typeof BlockBothEndsAnalyzer === 'undefined') return null;
        const player = opponent === 'X' ? 'O' : 'X';
        const rules = { winCount, chan2Dau };

        // Ưu tiên 1: priority tactical (win ngay / chặn FOUR+ / chặn đầu mở)
        const priority = BlockBothEndsAnalyzer.getPriorityTacticalMove(player, opponent, rules);
        if (priority) return { r: priority.r, c: priority.c };

        // Ưu tiên 2: open-end block (THREE+ với gap>=1)
        const openEnd = BlockBothEndsAnalyzer.getOpenEndBlockMove(player, opponent, rules);
        if (openEnd) return { r: openEnd.r, c: openEnd.c };

        // Ưu tiên 3: best block moves cho chuỗi tầm trung
        const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(player, opponent, rules, winCount - 2);
        if (blockMoves.length > 0) return { r: blockMoves[0].r, c: blockMoves[0].c };

        return null;
    },

    // ===== CHECK GAP 1-5 BLOCK (deprecated — đã gộp vào checkSmartBlock) =====
    // Giữ lại stub để không lỗi nếu có code cũ còn gọi
    checkGap1Block(allEmpty, opponent, winCount, chan2Dau) {
        return null; // Logic đã được BlockBothEndsAnalyzer trong checkSmartBlock xử lý
    }
};

// Export
window.QuickEvaluator = QuickEvaluator;
