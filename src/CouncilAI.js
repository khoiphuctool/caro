// ══════════════════════════════════════════════════════════════════
// COUNCIL AI - Final Decision Engine
// ══════════════════════════════════════════════════════════════════
// Vai trò: Bộ quyết định cuối cùng, đánh giá và chọn nước đi tối ưu từ các engine khác
// Không tạo nước đi mới, chỉ đánh giá candidate từ Lightning, Ultimate, v.v.
// ══════════════════════════════════════════════════════════════════

const CouncilAI = {
    // ===== CONFIGURATION =====
    config: {
        // Confidence merge weights (có thể điều chỉnh)
        searchWeight: 0.65,
        threatWeight: 0.20,
        heuristicWeight: 0.15,
        
        // Search depth cho tie-break
        tieBreakDepth: 7,  // +2 so với depth mặc định
        
        // Threshold cho tie-break
        tieBreakThreshold: 500,
        
        // Max candidates để đánh giá
        maxCandidates: 10,
        
        // Verify depth
        verifyDepth: 3
    },

    // ===== MOVE CANDIDATE STRUCTURE =====
    // Input từ các engine khác
    createCandidate(move, source, score, confidence, reason) {
        return {
            move: move,           // { r, c }
            source: source,       // 'Lightning', 'Ultimate', 'TiaChop', etc.
            score: score,         // Score từ engine
            confidence: confidence, // 0-100
            reason: reason,       // String mô tả lý do
            timestamp: Date.now()
        };
    },

    // ===== MAIN DECISION FUNCTION =====
    // candidates: Array of MoveCandidate
    // options: { player, opponent, winCount, depth }
    decide(candidates, options = {}) {
        const player = options.player || botPiece || 'O';
        const opponent = options.opponent || humanPiece || 'X';
        // Resolve winCount: prefer explicit options.roomRules, then options.winCount,
        // then GameState.roomRules, then GameState.board.winCount, then legacy globals
        const wc = (options.roomRules && typeof options.roomRules.winCount === 'number') ? options.roomRules.winCount :
               (typeof options.winCount === 'number' ? options.winCount :
               (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') ? GameState.roomRules.winCount :
               (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') ? GameState.board.winCount :
               (typeof winCount !== 'undefined' ? winCount : 5));
        const depth = options.depth || 5;

        console.log('[CouncilAI] Starting decision with', candidates.length, 'candidates');

        // ══════════════════════════════════════════════════════════════════
        // BƯỚC 1: Loại candidate trùng
        // ══════════════════════════════════════════════════════════════════
        const uniqueCandidates = this.deduplicateCandidates(candidates);
        if (uniqueCandidates.length === 1) {
            console.log('[CouncilAI] Only 1 unique candidate, returning immediately');
            return this.buildFinalMove(uniqueCandidates[0], 100, 'Single candidate');
        }

        // ══════════════════════════════════════════════════════════════════
        // BƯỚC 2 & 3: Mô phỏng cho từng candidate
        // ══════════════════════════════════════════════════════════════════
        const evaluatedCandidates = [];
        for (const candidate of uniqueCandidates) {
            const evaluation = this.simulateCandidate(candidate, player, opponent, wc, depth);
            evaluatedCandidates.push({
                ...candidate,
                evaluation: evaluation
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // BƯỚC 4: Risk Analysis
        // ══════════════════════════════════════════════════════════════════
        for (const candidate of evaluatedCandidates) {
            const risk = CouncilRiskAnalyzer.analyze(candidate.move, player, opponent, wc);
            candidate.risk = risk;
            // Apply penalty cho rủi ro cao
            candidate.evaluation.finalScore -= risk.penalty;
        }

        // ══════════════════════════════════════════════════════════════════
        // BƯỚC 5: Confidence Merge
        // ══════════════════════════════════════════════════════════════════
        for (const candidate of evaluatedCandidates) {
            candidate.evaluation.finalScore = this.mergeConfidence(
                candidate.evaluation.searchScore,
                candidate.evaluation.threatScore,
                candidate.evaluation.heuristicScore,
                candidate.confidence
            );
        }

        // Sắp xếp theo finalScore giảm dần
        evaluatedCandidates.sort((a, b) => b.evaluation.finalScore - a.evaluation.finalScore);

        // ══════════════════════════════════════════════════════════════════
        // BƯỚC 6: Tie Break
        // ══════════════════════════════════════════════════════════════════
        if (evaluatedCandidates.length >= 2) {
            const top1 = evaluatedCandidates[0];
            const top2 = evaluatedCandidates[1];
            const scoreDiff = Math.abs(top1.evaluation.finalScore - top2.evaluation.finalScore);

            if (scoreDiff < this.config.tieBreakThreshold) {
                console.log('[CouncilAI] Tie break needed, score diff:', scoreDiff);
                const tieBreakResult = this.tieBreak([top1, top2], player, opponent, wc);
                if (tieBreakResult) {
                    // Re-sort sau tie-break
                    evaluatedCandidates.sort((a, b) => 
                        (a === tieBreakResult ? 1 : 0) - (b === tieBreakResult ? 1 : 0)
                    );
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // BƯỚC 7: Verify Engine
        // ══════════════════════════════════════════════════════════════════
        const bestCandidate = evaluatedCandidates[0];
        const verified = this.verifyMove(bestCandidate.move, player, opponent, wc, this.config.verifyDepth);
        
        if (!verified.safe) {
            console.log('[CouncilAI] Best candidate failed verification, trying next');
            // Try next candidate
            for (let i = 1; i < evaluatedCandidates.length; i++) {
                const nextVerified = this.verifyMove(evaluatedCandidates[i].move, player, opponent, wc, this.config.verifyDepth);
                if (nextVerified.safe) {
                    return this.buildFinalMove(
                        evaluatedCandidates[i],
                        nextVerified.winningRate,
                        'Verified after rejection'
                    );
                }
            }
            // All failed, return best anyway with warning
            console.warn('[CouncilAI] All candidates failed verification, returning best with warning');
            return this.buildFinalMove(bestCandidate, 50, 'Verification failed - best effort');
        }

        // ══════════════════════════════════════════════════════════════════
        // RETURN FINAL MOVE
        // ══════════════════════════════════════════════════════════════════
        return this.buildFinalMove(
            bestCandidate,
            verified.winningRate,
            bestCandidate.reason + ' (Verified)'
        );
    },

    // ===== HELPER: Deduplicate candidates =====
    deduplicateCandidates(candidates) {
        const seen = new Set();
        const unique = [];
        for (const candidate of candidates) {
            const key = `${candidate.move.r},${candidate.move.c}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(candidate);
            }
        }
        return unique;
    },

    // ===== HELPER: Simulate candidate =====
    simulateCandidate(candidate, player, opponent, winCount, depth) {
        const { r, c } = candidate.move;
        
        // Đánh giá search score (nếu có deep search)
        let searchScore = candidate.score;
        if (typeof getBestMoveWithMinimax === 'function') {
            // Simulate move và search depth 3-5
            setCell(r, c, player);
            try {
                const searchResult = this.quickSearch(player, opponent, winCount, Math.min(depth, 5));
                searchScore = searchResult;
            } catch (e) {
                console.warn('[CouncilAI] Quick search failed:', e);
            }
            setCell(r, c, '');
        }

        // Đánh giá threat score
        let threatScore = 0;
        if (typeof ThreatDetector !== 'undefined') {
            const threat = ThreatDetector.evaluateAttackThreat(r, c, player, winCount, true);
            threatScore = threat.maxThreat * 1000;
        }

        // Đánh giá heuristic score
        let heuristicScore = candidate.score;
        if (typeof quickScore === 'function') {
            heuristicScore = quickScore(r, c, player);
        }

        return {
            searchScore: searchScore,
            threatScore: threatScore,
            heuristicScore: heuristicScore,
            finalScore: 0  // Sẽ được tính trong confidence merge
        };
    },

    // ===== HELPER: Quick search (depth 3-5) =====
    quickSearch(player, opponent, winCount, depth) {
        // Simple minimax với depth thấp
        if (typeof getBestMoveWithMinimax === 'function') {
            try {
                const move = getBestMoveWithMinimax(depth, player);
                if (move && typeof quickScore === 'function') {
                    return quickScore(move.r, move.c, player);
                }
            } catch (e) {
                console.warn('[CouncilAI] Quick search error:', e);
            }
        }
        return 0;
    },

    // ===== HELPER: Merge confidence =====
    mergeConfidence(searchScore, threatScore, heuristicScore, confidence) {
        const searchWeight = this.config.searchWeight;
        const threatWeight = this.config.threatWeight;
        const heuristicWeight = this.config.heuristicWeight;

        const merged = (searchScore * searchWeight) +
                      (threatScore * threatWeight) +
                      (heuristicScore * heuristicWeight);

        // Apply confidence multiplier
        const confidenceMultiplier = confidence / 100;
        return merged * confidenceMultiplier;
    },

    // ===== HELPER: Tie break =====
    tieBreak(candidates, player, opponent, winCount) {
        console.log('[CouncilAI] Tie break with depth', this.config.tieBreakDepth);
        
        let bestCandidate = null;
        let bestScore = -Infinity;

        for (const candidate of candidates) {
            const { r, c } = candidate.move;
            setCell(r, c, player);
            
            let score = 0;
            if (typeof getBestMoveWithMinimax === 'function') {
                try {
                    const move = getBestMoveWithMinimax(this.config.tieBreakDepth, player);
                    if (move && typeof quickScore === 'function') {
                        score = quickScore(move.r, move.c, player);
                    }
                } catch (e) {
                    console.warn('[CouncilAI] Tie break search error:', e);
                }
            }
            
            setCell(r, c, '');
            
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        return bestCandidate;
    },

    // ===== HELPER: Verify move =====
    verifyMove(move, player, opponent, winCount, depth) {
        const { r, c } = move;
        const roomRules = (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules;
        
        // Simulate move
        setCell(r, c, player);
        
        // Check enemy best response
        let safe = true;
        let winningRate = 75; // Default

        if (typeof getAllTacticalCells === 'function') {
            const enemyCands = getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '');
            
            // Check if enemy can force win
            for (const enemyMove of enemyCands) {
                setCell(enemyMove.r, enemyMove.c, opponent);
                const enemyWin = checkWinSilent(enemyMove.r, enemyMove.c, roomRules);
                setCell(enemyMove.r, enemyMove.c, '');
                
                if (enemyWin) {
                    safe = false;
                    winningRate = 0;
                    break;
                }
            }

            if (safe) {
                // Check if we can win next
                setCell(r, c, player);
                for (const ourMove of enemyCands) {
                    setCell(ourMove.r, ourMove.c, player);
                    const ourWin = checkWinSilent(ourMove.r, ourMove.c, roomRules);
                    setCell(ourMove.r, ourMove.c, '');
                    
                    if (ourWin) {
                        winningRate = 95;
                        break;
                    }
                }
            }
        }
        
        setCell(r, c, '');
        
        return {
            safe: safe,
            winningRate: winningRate
        };
    },

    // ===== HELPER: Build final move =====
    buildFinalMove(candidate, winningRate, reason) {
        return {
            move: candidate.move,
            finalScore: candidate.evaluation ? candidate.evaluation.finalScore : candidate.score,
            winningRate: winningRate,
            reason: reason,
            source: candidate.source
        };
    }
};

// ══════════════════════════════════════════════════════════════════
// COUNCIL RISK ANALYZER
// ══════════════════════════════════════════════════════════════════
const CouncilRiskAnalyzer = {
    analyze(move, player, opponent, winCount) {
        const { r, c } = move;
        const roomRules = (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules;
        let penalty = 0;
        const risks = [];

        // Immediate Lose Check
        setCell(r, c, player);
        if (typeof getAllTacticalCells === 'function') {
            const enemyCands = getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '');
            for (const enemyMove of enemyCands) {
                setCell(enemyMove.r, enemyMove.c, opponent);
                const enemyWin = checkWinSilent(enemyMove.r, enemyMove.c, roomRules);
                setCell(enemyMove.r, enemyMove.c, '');
                
                if (enemyWin) {
                    penalty += 100000;
                    risks.push('Immediate Lose');
                    break;
                }
            }
        }
        setCell(r, c, '');

        // Immediate Win Check (bonus, not penalty)
        setCell(r, c, player);
        const ourWin = checkWinSilent(r, c, (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : window.roomRules);
        setCell(r, c, '');
        if (ourWin) {
            penalty -= 50000; // Bonus
        }

        // Double Threat Check (enemy can create)
        if (typeof ThreatDetector !== 'undefined') {
            setCell(r, c, player);
            for (const enemyMove of getAllTacticalCells ? getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '') : []) {
                const threat = ThreatDetector.evaluateAttackThreat(enemyMove.r, enemyMove.c, opponent, winCount, true);
                let threatCount = 0;
                for (const { threat: t } of threat.patternScores || []) {
                    if (t !== ThreatDetector.THREAT.NONE) threatCount++;
                }
                if (threatCount >= 2) {
                    penalty += 20000;
                    risks.push('Enemy Double Threat');
                }
            }
            setCell(r, c, '');
        }

        // Forced Four Check (enemy can create)
        if (typeof DIRECTIONS !== 'undefined' && typeof countLineAndBlocked === 'function') {
            setCell(r, c, player);
            for (const enemyMove of getAllTacticalCells ? getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '') : []) {
                setCell(enemyMove.r, enemyMove.c, opponent);
                for (const { dr, dc } of DIRECTIONS) {
                    const { count, blockedBoth } = countLineAndBlocked(enemyMove.r, enemyMove.c, dr, dc, opponent);
                    if (count === winCount - 1 && !blockedBoth) {
                        penalty += 15000;
                        risks.push('Enemy Forced Four');
                        break;
                    }
                }
                setCell(enemyMove.r, enemyMove.c, '');
            }
            setCell(r, c, '');
        }

        // Open Four Check (enemy can create)
        if (typeof ThreatDetector !== 'undefined') {
            setCell(r, c, player);
            for (const enemyMove of getAllTacticalCells ? getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '') : []) {
                const threat = ThreatDetector.evaluateAttackThreat(enemyMove.r, enemyMove.c, opponent, winCount, true);
                const hasFourOpen = threat.patternScores && threat.patternScores.some(p => 
                    p.pattern === PatternDetector.PATTERN.FOUR_OPEN
                );
                if (hasFourOpen) {
                    penalty += 10000;
                    risks.push('Enemy Open Four');
                }
            }
            setCell(r, c, '');
        }

        // THREE_OPEN Check (enemy can create) - CRITICAL
        // THREE_OPEN → 2 nước nữa là FOUR_OPEN → phải chặn ngay
        if (typeof ThreatDetector !== 'undefined') {
            setCell(r, c, player);
            for (const enemyMove of getAllTacticalCells ? getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '') : []) {
                const threat = ThreatDetector.evaluateAttackThreat(enemyMove.r, enemyMove.c, opponent, winCount, true);
                const hasThreeOpen = threat.patternScores && threat.patternScores.some(p => 
                    p.pattern === PatternDetector.PATTERN.THREE_OPEN
                );
                if (hasThreeOpen) {
                    penalty += 5000;  // Penalty lớn nhưng không quá lớn như FOUR
                    risks.push('Enemy THREE_OPEN (dangerous)');
                }
            }
            setCell(r, c, '');
        }

        return {
            penalty: penalty,
            risks: risks,
            safe: penalty < 50000  // Threshold cho "safe"
        };
    }
};

window.CouncilAI = CouncilAI;
window.CouncilRiskAnalyzer = CouncilRiskAnalyzer;
