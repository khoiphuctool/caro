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
        
        // 7. Smart Blocking
        const smartBlock = this.checkSmartBlock(allEmpty, opponent, winCount, chan2Dau);
        if (smartBlock) {
            console.log('[QuickEvaluator] Smart block:', smartBlock);
            return { move: smartBlock, reason: 'Smart Block' };
        }

        // 8. Chặn đầu mở cách 1 ô (quan trọng cho luật chặn 2 đầu)
        const gap1Block = this.checkGap1Block(allEmpty, opponent, winCount, chan2Dau);
        if (gap1Block) {
            console.log('[QuickEvaluator] Blocking open end gap 1:', gap1Block);
            return { move: gap1Block, reason: 'Block Open End Gap 1' };
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
    checkSmartBlock(allEmpty, opponent, winCount, chan2Dau) {
        // Dùng BlockBothEndsAnalyzer thay analyzeBlockPositions cũ
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const player = opponent === 'X' ? 'O' : 'X';
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, winCount, winCount - 2);
            if (blockMoves.length > 0) return blockMoves[0];
        }
        return null;
    },

    // ===== CHECK GAP 1-5 BLOCK =====
    // Kiểm tra chặn đầu mở cách 1-5 ô (quan trọng cho luật chặn 2 đầu)
    // Với luật chặn 2 đầu, nếu đầu bị chặn cách 1-5 ô trống, nên chặn đầu kia
    // ƯU TIÊN: Chặn tạo thế cờ có lợi (tạo đòn tấn công, vị trí chiến lược)
    checkGap1Block(allEmpty, opponent, winCount, chan2Dau) {
        if (!chan2Dau) return null; // Chỉ áp dụng khi luật chặn 2 đầu bật
        
        const board = typeof GameState !== 'undefined' && GameState.board ? GameState.board.infiniteMap : infiniteMap;
        const player = opponent === 'X' ? 'O' : 'X';
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];
        
        let bestBlock = null;
        let bestScore = 0;
        
        for (const { r, c } of allEmpty) {
            if (this.getCell(board, r, c) !== '') continue;
            
            // Check xem ô này có phải là đầu mở cách 1-5 ô không
            let isGapOpen = false;
            let bestGapScore = 0;
            
            for (const { dr, dc } of directions) {
                // Check forward
                const nr1 = r + dr;
                const nc1 = c + dc;
                const cell1 = this.getCell(board, nr1, nc1);
                
                if (cell1 === opponent) {
                    // Ô ngay cạnh có quân đối thủ → check xem có chuỗi nguy hiểm không
                    let count = 1;
                    let nr = nr1 + dr;
                    let nc = nc1 + dc;
                    
                    while (this.getCell(board, nr, nc) === opponent) {
                        count++;
                        nr += dr;
                        nc += dc;
                    }
                    
                    // Nếu có chuỗi đủ dài (winCount - 1 hoặc winCount - 2)
                    if (count >= winCount - 2) {
                        // Check ô cách 1-5 ô (đầu mở)
                        for (let gap = 1; gap <= 5; gap++) {
                            const gapR = r - dr * gap;
                            const gapC = c - dc * gap;
                            const gapCell = this.getCell(board, gapR, gapC);
                            
                            if (gapCell === '') {
                                // Đây là đầu mở cách gap ô → nên chặn
                                // Càng gần (gap nhỏ) càng quan trọng
                                const gapScore = (6 - gap) * 1000; // gap=1: 5000, gap=5: 1000
                                if (gapScore > bestGapScore) {
                                    bestGapScore = gapScore;
                                    isGapOpen = true;
                                }
                                break; // Chỉ cần tìm 1 đầu mở là đủ
                            } else if (gapCell !== '' && gapCell !== opponent) {
                                // Ô bị chặn bởi quân khác → vẫn là đầu mở (đối thủ không thể đánh vào đó)
                                const gapScore = (6 - gap) * 500;
                                if (gapScore > bestGapScore) {
                                    bestGapScore = gapScore;
                                    isGapOpen = true;
                                }
                                break;
                            } else {
                                // Ô có quân đối thủ → không phải đầu mở
                                break;
                            }
                        }
                    }
                }
                
                // Check backward
                const br1 = r - dr;
                const bc1 = c - dc;
                const bcell1 = this.getCell(board, br1, bc1);
                
                if (bcell1 === opponent) {
                    let count = 1;
                    let br = br1 - dr;
                    let bc = bc1 - dc;
                    
                    while (this.getCell(board, br, bc) === opponent) {
                        count++;
                        br -= dr;
                        bc -= dc;
                    }
                    
                    if (count >= winCount - 2) {
                        for (let gap = 1; gap <= 5; gap++) {
                            const gapR = r + dr * gap;
                            const gapC = c + dc * gap;
                            const gapCell = this.getCell(board, gapR, gapC);
                            
                            if (gapCell === '') {
                                const gapScore = (6 - gap) * 1000;
                                if (gapScore > bestGapScore) {
                                    bestGapScore = gapScore;
                                    isGapOpen = true;
                                }
                                break;
                            } else if (gapCell !== '' && gapCell !== opponent) {
                                const gapScore = (6 - gap) * 500;
                                if (gapScore > bestGapScore) {
                                    bestGapScore = gapScore;
                                    isGapOpen = true;
                                }
                                break;
                            } else {
                                break;
                            }
                        }
                    }
                }
                
                if (isGapOpen && bestGapScore >= 3000) break; // gap <= 3 là đủ quan trọng
            }
            
            if (isGapOpen) {
                // ══════════════════════════════════════════════════════════════════
                // ĐÁNH GIÁ THẾ CỜ SAU KHI CHẶN (ưu tiên thế cờ có lợi)
                // ══════════════════════════════════════════════════════════════════
                let advantageScore = bestGapScore;
                
                // Simulate chặn
                this.setCell(board, r, c, player);
                
                // Check xem chặn có tạo đòn tấn công không
                let createsAttack = false;
                let attackBonus = 0;
                
                for (const { dr, dc } of directions) {
                    // Check THREE_OPEN
                    let count = 1;
                    let nr = r + dr;
                    let nc = c + dc;
                    while (this.getCell(board, nr, nc) === player) {
                        count++;
                        nr += dr;
                        nc += dc;
                    }
                    let br = r - dr;
                    let bc = c - dc;
                    while (this.getCell(board, br, bc) === player) {
                        count++;
                        br -= dr;
                        bc -= dc;
                    }
                    
                    if (count === winCount - 2) {
                        // Check xem có mở không
                        const headOpen = this.getCell(board, nr, nc) === '';
                        const tailOpen = this.getCell(board, br, bc) === '';
                        if (headOpen || tailOpen) {
                            createsAttack = true;
                            attackBonus += 5000; // Tạo THREE_OPEN
                        }
                    }
                    
                    if (count === winCount - 1) {
                        const headOpen = this.getCell(board, nr, nc) === '';
                        const tailOpen = this.getCell(board, br, bc) === '';
                        if (headOpen || tailOpen) {
                            createsAttack = true;
                            attackBonus += 15000; // Tạo FOUR_OPEN
                        }
                    }
                }
                
                // Check fork (nhiều đe dọa)
                let threatCount = 0;
                for (const { dr, dc } of directions) {
                    let count = 1;
                    let nr = r + dr;
                    let nc = c + dc;
                    while (this.getCell(board, nr, nc) === player) {
                        count++;
                        nr += dr;
                        nc += dc;
                    }
                    let br = r - dr;
                    let bc = c - dc;
                    while (this.getCell(board, br, bc) === player) {
                        count++;
                        br -= dr;
                        bc -= dc;
                    }
                    if (count >= winCount - 2) threatCount++;
                }
                if (threatCount >= 2) {
                    createsAttack = true;
                    attackBonus += 10000; // Tạo fork
                }
                
                // Check vị trí chiến lược (gần trung tâm)
                let strategicBonus = 0;
                if (board.size > 0) {
                    let sr = 0, sc = 0, n = 0;
                    for (const key of board.keys()) {
                        const [kr, kc] = key.split(',').map(Number);
                        sr += kr;
                        sc += kc;
                        n++;
                    }
                    const cr = sr / n, cc = sc / n;
                    const dist = Math.abs(r - cr) + Math.abs(c - cc);
                    if (dist < 3) strategicBonus += 3000;
                    else if (dist < 5) strategicBonus += 2000;
                    else if (dist < 8) strategicBonus += 1000;
                }
                
                // Undo simulate
                this.setCell(board, r, c, '');
                
                // Tổng điểm
                const totalScore = advantageScore + attackBonus + strategicBonus;
                
                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestBlock = { r, c };
                }
            }
        }
        
        return bestBlock;
    }
};

// Export
window.QuickEvaluator = QuickEvaluator;
