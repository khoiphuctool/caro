// ══════════════════════════════════════════════════════════════════
// BOT SIÊU PHÀM - Ultimate Bot (Kết hợp logic tốt nhất từ 3 bot)
// ══════════════════════════════════════════════════════════════════
// Logic từ Bot Tia Chớp:
//   - Scoring system: winningMove (9999999) > openFour (8888888) > twoThrees (7777777)
//   - Weights: [0, 20, 17, 15.4, 14, 10]
//   - Tự động cân bằng attack/defense
//
// Logic từ Bot Tối Thượng:
//   - Pipeline đầy đủ: win now → block win → check enemy FOUR → forced four → block forced four → double threat
//   - Smart blocking (makesDeadFour)
//   - PVS Search depth 5
//   - Neural-sort candidates
//
// Logic từ Bot Siêu Phàm cũ:
//   - Threat assessment
//   - Minimax fallback
// ══════════════════════════════════════════════════════════════════

const BotSuperV1 = {
    // ===== CONFIGURATION =====
    config: {
        winningMove: 9999999,
        openFour: 8888888,
        twoThrees: 7777777,
        weights: [0, 20, 17, 15.4, 14, 10],
        searchDepth: 5,
        topCandidates: 15
    },

    getBotMove(options = {}) {
        const player = options.player || botPiece || 'O';
        const opponent = options.opponent || humanPiece || 'X';
        // Resolve rules: prefer options.roomRules, then GameState.roomRules, then options.winCount or global
        const resolved = options.roomRules ?? (typeof GameState !== 'undefined' ? GameState.roomRules : undefined) ?? (typeof window !== 'undefined' ? window.roomRules : undefined);
        let wc;
        if (resolved && typeof resolved.winCount === 'number') wc = resolved.winCount;
        else if (typeof options.winCount === 'number') wc = options.winCount;
        else if (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') wc = GameState.board.winCount;
        else {
            console.warn('[BotSuper] winCount not found in roomRules/options/GameState; bot may behave unexpectedly. Pass roomRules to getBotMove.');
            wc = typeof winCount !== 'undefined' ? winCount : undefined;
        }
        const depth = options.depth || this.config.searchDepth;

        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const immediate = BlockBothEndsAnalyzer.getPriorityTacticalMove(player, opponent, wc);
            if (immediate) {
                console.log('[BotSuper Ultimate] Shared immediate tactical move:', immediate);
                return { r: immediate.r, c: immediate.c };
            }
        }

        console.log('[BotSuper Ultimate] getBotMove', { player, opponent, winCount: wc, depth });

        // ══════════════════════════════════════════════════════════════════
        // LAYER 0: Nước đầu - random trung tâm
        // ══════════════════════════════════════════════════════════════════
        const moveCount = typeof moveHistory !== 'undefined' ? moveHistory.length : 0;
        if (moveCount <= 2) {
            const allCands = typeof getSearchCandidates === 'function' ? getSearchCandidates() : [];
            if (allCands.length > 0) {
                const pool = allCands.slice(0, Math.max(1, Math.ceil(allCands.length / 2)));
                const randomMove = pool[Math.floor(Math.random() * pool.length)];
                console.log('[BotSuper Ultimate] Early random move:', randomMove);
                return randomMove;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // LAYER 1: Immediate Tactical Scan (Win/Block)
        // ══════════════════════════════════════════════════════════════════
        const allEmpty = typeof getAllTacticalCells === 'function' ? getAllTacticalCells() : [];
        
        // 1a. Win Now
        for (const { r, c } of allEmpty) {
            if (getCell(r, c) !== '') continue;
            setCell(r, c, player);
            const win = checkWinSilent(r, c, (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules);
            setCell(r, c, '');
            if (win) {
                console.log('[BotSuper Ultimate] Win now:', { r, c });
                return { r, c };
            }
        }

        // 1b. Block Win
        for (const { r, c } of allEmpty) {
            if (getCell(r, c) !== '') continue;
            setCell(r, c, opponent);
            const win = checkWinSilent(r, c, (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules);
            setCell(r, c, '');
            if (win) {
                console.log('[BotSuper Ultimate] Block win:', { r, c });
                return { r, c };
            }
        }
        // NOTE: Chặn FOUR đúng đầu mở đã được P3 (BlockBothEndsAnalyzer) trong getBotMove() xử lý trước.

        // 1c. CHẶN THREE/FOUR ĐÚNG ĐẦU MỞ — dùng BlockBothEndsAnalyzer
        // Thay thế ThreatDetector.analyzeBlockPositions (không biết phân biệt đầu mở)
        if (typeof BlockBothEndsAnalyzer !== 'undefined') {
            const blockMoves = BlockBothEndsAnalyzer.getBestBlockMoves(opponent, player, wc, wc - 2);
            if (blockMoves.length > 0) {
                const best = blockMoves[0];
                // Chặn THREE trở lên — FOUR đã bị P3 (ai-nao.js) bắt trước rồi
                // Nhưng nếu P3 bỏ qua (FOUR_OPEN 2 đầu viable), xử lý ở đây
                if (best.chainCount >= wc - 2) {
                    console.log('[BotSuper Ultimate] BlockBothEndsAnalyzer block open end:', best);
                    return { r: best.r, c: best.c };
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // 1d. CHECK BOT WIN OPPORTUNITY - Ưu tiên thắng trước nếu có thể
        // Nếu đối thủ chưa thắng ngay nhưng bot có thể tạo thế cờ thắng trước → tấn công
        // ══════════════════════════════════════════════════════════════════
        
        // Check Forced Four (bot) - FOUR không thể chặn → thắng chắc lượt sau
        let bestForced = null, bestForcedS = -Infinity;
        for (const { r, c } of allEmpty) {
            setCell(r, c, player);
            let makesFour = false;
            if (typeof DIRECTIONS !== 'undefined') {
                for (const { dr, dc } of DIRECTIONS) {
                    if (typeof countLineAndBlocked === 'function') {
                        const { count, blockedBoth } = countLineAndBlocked(r, c, dr, dc, player);
                        if (count === wc - 1 && !blockedBoth) { makesFour = true; break; }
                    }
                }
            }
            setCell(r, c, '');
            if (!makesFour) continue;
            if (typeof countWinningCompletionEnds === 'function') {
                if (countWinningCompletionEnds(r, c, player) >= 2) {
                    const s = typeof quickScore === 'function' ? quickScore(r, c, player) : 0;
                    if (s > bestForcedS) { bestForcedS = s; bestForced = { r, c }; }
                }
            }
        }
        if (bestForced) {
            console.log('[BotSuper Ultimate] Win opportunity - Forced four:', bestForced);
            return bestForced;
        }

        // Check Fork/Double Threat (bot) - nhiều đe dọa cùng lúc
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                const t = ThreatDetector.evaluateAttackThreat(r, c, player, wc, true);
                if (t.maxThreat >= ThreatDetector.THREAT.HIGH) {
                    // Check nếu có fork (nhiều đe dọa)
                    let threatCount = 0;
                    for (const { pattern } of t.patternScores) {
                        if (pattern !== PatternDetector.PATTERN.NONE) {
                            threatCount++;
                        }
                    }
                    if (threatCount >= 2) {
                        console.log('[BotSuper Ultimate] Win opportunity - Fork:', { r, c });
                        return { r, c };
                    }
                }
            }
        }

        // Check FOUR_OPEN (bot) - 1 nước nữa là thắng
        if (typeof ThreatDetector !== 'undefined') {
            for (const { r, c } of allEmpty) {
                const t = ThreatDetector.evaluateAttackThreat(r, c, player, wc, true);
                const hasFourOpen = t.patternScores.some(p => 
                    p.pattern === PatternDetector.PATTERN.FOUR_OPEN
                );
                if (hasFourOpen) {
                    console.log('[BotSuper Ultimate] Win opportunity - FOUR_OPEN:', { r, c });
                    return { r, c };
                }
            }
        }

        // Smart Blocking — đã được 1c xử lý bởi BlockBothEndsAnalyzer ở trên
        // Bỏ ThreatDetector.analyzeBlockPositions vì nó không phân biệt đầu mở

        // ══════════════════════════════════════════════════════════════════
        // LAYER 2: Collect Candidates từ Multiple Engines
        // ══════════════════════════════════════════════════════════════════
        const candidates = [];

        // Candidate từ BotTiaChop (Lightning)
        if (typeof BotTiaChop !== 'undefined' && typeof BotTiaChop.getBotMove === 'function') {
            try {
                const tiaChopMove = BotTiaChop.getBotMove({
                    player: player,
                    opponent: opponent,
                    roomRules: { winCount: wc, chan2Dau: (resolved && typeof resolved.chan2Dau !== 'undefined') ? !!resolved.chan2Dau : true }
                });
                if (tiaChopMove && tiaChopMove.r !== undefined && tiaChopMove.c !== undefined) {
                    if (getCell(tiaChopMove.r, tiaChopMove.c) === '') {
                        candidates.push(CouncilAI.createCandidate(
                            tiaChopMove,
                            'Lightning',
                            9500,  // High score từ TiaChop
                            85,    // High confidence
                            'BotTiaChop scoring system'
                        ));
                    }
                }
            } catch (e) {
                console.warn('[BotSuper Ultimate] BotTiaChop failed:', e);
            }
        }

        // Candidate từ Ultimate (Pipeline + Deep Search)
        const validCands = allEmpty.filter(({ r, c }) => getCell(r, c) === '');
        if (validCands.length > 0) {
            // Get best move from pipeline
            let ultimateMove = null;
            let ultimateScore = 0;
            let ultimateReason = '';

            // Try deep search first
            if (typeof getBestMoveWithMinimax === 'function') {
                try {
                    const minimaxMove = getBestMoveWithMinimax(depth, player);
                    if (minimaxMove && getCell(minimaxMove.r, minimaxMove.c) === '') {
                        ultimateMove = minimaxMove;
                        ultimateScore = typeof quickScore === 'function' ? quickScore(minimaxMove.r, minimaxMove.c, player) : 8000;
                        ultimateReason = 'PVS Deep Search';
                    }
                } catch (e) {
                    console.warn('[BotSuper Ultimate] Minimax failed:', e);
                }
            }

            // Fallback to quick scoring
            if (!ultimateMove) {
                const scored = [];
                for (const { r, c } of validCands.slice(0, 15)) {
                    const res = typeof evalCellFull === 'function' ? evalCellFull(r, c, player, true) : null;
                    const atk = res ? res.score : (typeof quickScore === 'function' ? quickScore(r, c, player) : 0);
                    scored.push({ r, c, atk });
                }
                if (scored.length > 0) {
                    scored.sort((a, b) => b.atk - a.atk);
                    ultimateMove = scored[0];
                    ultimateScore = scored[0].atk;
                    ultimateReason = 'Quick Scoring';
                }
            }

            if (ultimateMove) {
                candidates.push(CouncilAI.createCandidate(
                    ultimateMove,
                    'Ultimate',
                    ultimateScore,
                    90,
                    ultimateReason
                ));
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // LAYER 3: Council AI Decision Engine
        // ══════════════════════════════════════════════════════════════════
        if (typeof CouncilAI !== 'undefined' && candidates.length > 0) {
            console.log('[BotSuper Ultimate] Passing', candidates.length, 'candidates to Council AI');
            try {
                const finalDecision = CouncilAI.decide(candidates, {
                    player: player,
                    opponent: opponent,
                    winCount: wc,
                    depth: depth
                });
                console.log('[BotSuper Ultimate] Council AI decision:', finalDecision);
                return finalDecision.move;
            } catch (e) {
                console.warn('[BotSuper Ultimate] Council AI failed, fallback:', e);
                // Fallback to first candidate
                return candidates[0].move;
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // LAYER 4: Fallback - Direct return nếu Council không khả dụng
        // ══════════════════════════════════════════════════════════════════
        if (candidates.length > 0) {
            console.log('[BotSuper Ultimate] Council unavailable, returning best candidate');
            return candidates[0].move;
        }
    }
};

window.BotSuperV1 = BotSuperV1;
