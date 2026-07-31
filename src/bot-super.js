// ══════════════════════════════════════════════════════════════════
// BOT SIÊU PHÀM - Prototype mạnh hơn dựa trên eval + shallow lookahead
// Ý tưởng: gom các ô ứng viên (neighbours), đánh giá bằng evalCellFull,
// chọn top-N, thực hiện lookahead 1 nước (đối thủ) để đánh giá phản ứng,
// chọn nước tối ưu theo heuristic: attackScore - 0.9 * opponentBest
// Tích hợp dễ dàng, không làm thay đổi kiến trúc chính.
// ══════════════════════════════════════════════════════════════════

const BotSuper = {
    getBotMove(options = {}) {
        const player = options.player || botPiece || 'O';
        const opponent = options.opponent || humanPiece || 'X';
        const wc = options.winCount || winCount || 5;
        const depth = options.depth || 5;

        console.log('[BotSuper] getBotMove', { player, opponent, winCount: wc, depth });

        // Immediate win / block logic
        if (typeof getSearchCandidates === 'function') {
            const allCands = getSearchCandidates();
            for (const { r, c } of allCands) {
                if (getCell(r, c) !== '') continue;
                setCell(r, c, player);
                const isWin = checkWinSilent(r, c);
                setCell(r, c, '');
                if (isWin) {
                    console.log('[BotSuper] immediate winning move', { r, c });
                    return { r, c };
                }
            }
            for (const { r, c } of allCands) {
                if (getCell(r, c) !== '') continue;
                setCell(r, c, opponent);
                const oppWin = checkWinSilent(r, c);
                setCell(r, c, '');
                if (oppWin) {
                    console.log('[BotSuper] immediate block move', { r, c });
                    return { r, c };
                }
            }
        }

        // Prepare candidates around existing stones.
        let cands = [];
        if (typeof getSearchCandidates === 'function') {
            cands = getSearchCandidates().filter(({ r, c }) => getCell(r, c) === '');
        } else if (typeof getAllTacticalCells === 'function') {
            cands = getAllTacticalCells().filter(({ r, c }) => getCell(r, c) === '');
        }

        if (cands.length === 0) {
            return { r: 0, c: 0 };
        }

        // Block immediate opponent live threats first.
        if (typeof findLiveThreats === 'function') {
            const opponentThreats = findLiveThreats(opponent, Math.max(2, wc - 1));
            if (opponentThreats.length > 0) {
                const block = opponentThreats.find(({ r, c }) => getCell(r, c) === '');
                if (block) {
                    return block;
                }
            }
        }

        // Use threat assessment to rank candidates.
        let threatInfo = null;
        if (typeof assessThreats === 'function') {
            threatInfo = assessThreats(cands, player, opponent);
        }

        // If there is a clear defend move, prioritize it.
        if (threatInfo && threatInfo.bestDefendMove && threatInfo.bestAttackMove) {
            const defendScore = threatInfo.bestDefendMove.score || 0;
            const attackScore = threatInfo.bestAttackMove.score || 0;
            if (defendScore >= attackScore * 0.85 || defendScore > 25000) {
                return { r: threatInfo.bestDefendMove.r, c: threatInfo.bestDefendMove.c };
            }
        }

        // Order candidates by combined threat and quick score.
        cands.sort((a, b) => {
            const aThreat = threatInfo ? ((threatInfo.bestAttackMove?.r === a.r && threatInfo.bestAttackMove?.c === a.c ? threatInfo.bestAttackMove.score : 0) +
                                          (threatInfo.bestDefendMove?.r === a.r && threatInfo.bestDefendMove?.c === a.c ? threatInfo.bestDefendMove.score : 0)) : 0;
            const bThreat = threatInfo ? ((threatInfo.bestAttackMove?.r === b.r && threatInfo.bestAttackMove?.c === b.c ? threatInfo.bestAttackMove.score : 0) +
                                          (threatInfo.bestDefendMove?.r === b.r && threatInfo.bestDefendMove?.c === b.c ? threatInfo.bestDefendMove.score : 0)) : 0;
            return (bThreat + quickScore(b.r, b.c, player)) - (aThreat + quickScore(a.r, a.c, player));
        });

        const topCands = cands.slice(0, Math.min(cands.length, 12));

        // If a strong attack candidate is clear, prioritize it.
        if (threatInfo && threatInfo.bestAttackMove && threatInfo.bestAttackMove.score > 25000) {
            return { r: threatInfo.bestAttackMove.r, c: threatInfo.bestAttackMove.c };
        }

        // Use deep search on top candidates when available.
        if (typeof getBestMoveWithMinimax === 'function') {
            const bestMove = getBestMoveWithMinimax(depth, player);
            if (bestMove && getCell(bestMove.r, bestMove.c) === '') {
                return bestMove;
            }
        }

        // Evaluate remaining candidates with evalCellFull if search wasn't available.
        const scored = [];
        for (const { r, c } of topCands) {
            const res = typeof evalCellFull === 'function' ? evalCellFull(r, c, player, true) : null;
            const atk = res ? res.score : quickScore(r, c, player);
            scored.push({ r, c, atk });
        }
        if (scored.length > 0) {
            scored.sort((a, b) => b.atk - a.atk);
            return { r: scored[0].r, c: scored[0].c };
        }

        return topCands[0] || { r: 0, c: 0 };
    }
};

window.BotSuper = BotSuper;
