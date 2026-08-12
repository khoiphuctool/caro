// Shared tactical analyzer for all bot flows.
// This module resolves the actual room rule in one place and exposes the
// common API used by the bot pipelines.

const BlockBothEndsAnalyzer = {
    resolveRoomRules(roomRulesOrWinCount) {
        const explicit = (typeof roomRulesOrWinCount === 'object' && roomRulesOrWinCount !== null)
            ? roomRulesOrWinCount
            : null;
        const fromGameState = (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : null;
        const fromWindow = (typeof window !== 'undefined' && window.roomRules) ? window.roomRules : null;
        const source = explicit || fromGameState || fromWindow || {};

        let winCount = 5;
        if (explicit && typeof explicit.winCount === 'number' && Number.isFinite(explicit.winCount)) {
            winCount = explicit.winCount;
        } else if (typeof roomRulesOrWinCount === 'number' && Number.isFinite(roomRulesOrWinCount)) {
            winCount = roomRulesOrWinCount;
        } else if (typeof source.winCount === 'number' && Number.isFinite(source.winCount)) {
            winCount = source.winCount;
        } else if (typeof globalThis.winCount === 'number' && Number.isFinite(globalThis.winCount)) {
            winCount = globalThis.winCount;
        }

        let chan2Dau = true;
        if (explicit && typeof explicit.chan2Dau === 'boolean') {
            chan2Dau = explicit.chan2Dau;
        } else if (typeof source.chan2Dau === 'boolean') {
            chan2Dau = source.chan2Dau;
        } else {
            const id = (typeof window !== 'undefined' && window.isBotVsBotMode) ? 'bot-vs-bot-block-both' : 'block-both-ends';
            const el = (typeof document !== 'undefined') ? document.getElementById(id) : null;
            chan2Dau = !!(el && el.checked);
        }

        return { winCount, chan2Dau };
    },

    _getBoard() {
        if (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap instanceof Map) {
            return GameState.board.infiniteMap;
        }
        if (typeof infiniteMap !== 'undefined' && infiniteMap instanceof Map) {
            return infiniteMap;
        }
        return new Map();
    },

    _getCell(r, c) {
        const board = this._getBoard();
        if (board instanceof Map) {
            return board.get(`${r},${c}`) || '';
        }
        return '';
    },

    _isOutOfBounds(r, c) {
        const board = this._getBoard();
        if (!(board instanceof Map)) return false;
        if (board.has(`${r},${c}`)) return false;
        if (typeof GameState !== 'undefined' && GameState.board && GameState.board.isInfinite === false) {
            const size = GameState.board.size || 0;
            return r < 0 || c < 0 || r >= size || c >= size;
        }
        return false;
    },

    _isBlocked(startR, startC, dr, dc, player, maxEmpty = 5) {
        const opp = player === 'X' ? 'O' : 'X';
        let r = startR;
        let c = startC;
        let empty = 0;

        while (empty <= maxEmpty) {
            const cell = this._getCell(r, c);
            if (cell === 'W') return true;
            if (cell === opp) return true;
            if (cell === player) return false;
            if (cell === '') {
                empty += 1;
                r += dr;
                c += dc;
                continue;
            }
            return false;
        }

        return false;
    },

    _getTacticalCells(maxRadius = 4) {
        const board = this._getBoard();
        const seen = new Set();
        const result = [];

        const addIfEmpty = (r, c) => {
            const key = `${r},${c}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (this._getCell(r, c) === '') {
                result.push({ r, c });
            }
        };

        if (!(board instanceof Map)) return result;

        board.forEach((val, key) => {
            if (val === '') return;
            const [r, c] = key.split(',').map(Number);
            for (let dr = -maxRadius; dr <= maxRadius; dr++) {
                for (let dc = -maxRadius; dc <= maxRadius; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    addIfEmpty(r + dr, c + dc);
                }
            }
        });

        return result;
    },

    _countLine(r, c, dr, dc, player) {
        let count = 1;
        let nr = r + dr;
        let nc = c + dc;
        while (this._getCell(nr, nc) === player) {
            count += 1;
            nr += dr;
            nc += dc;
        }
        const headBlocked = this._isBlocked(nr, nc, dr, dc, player, Math.max(3, (this.resolveRoomRules().winCount || 5)));

        nr = r - dr;
        nc = c - dc;
        while (this._getCell(nr, nc) === player) {
            count += 1;
            nr -= dr;
            nc -= dc;
        }
        const tailBlocked = this._isBlocked(nr, nc, -dr, -dc, player, Math.max(3, (this.resolveRoomRules().winCount || 5)));

        return { count, headBlocked, tailBlocked };
    },

    _isWinningMoveAt(r, c, player, winCount, chan2Dau) {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            let count = 1;
            let nr = r + dr;
            let nc = c + dc;
            while (this._getCell(nr, nc) === player) {
                count += 1;
                nr += dr;
                nc += dc;
            }

            nr = r - dr;
            nc = c - dc;
            while (this._getCell(nr, nc) === player) {
                count += 1;
                nr -= dr;
                nc -= dc;
            }

            if (count < winCount) continue;
            if (!chan2Dau) return true;

            const headBlocked = this._isBlocked(nr + dr, nc + dc, dr, dc, player, winCount);
            const tailBlocked = this._isBlocked(r - dr, c - dc, -dr, -dc, player, winCount);
            if (!(headBlocked && tailBlocked)) return true;
        }

        return false;
    },

    _evaluateOpenEndThreat(cellR, cellC, opponent, winCount) {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        let best = null;
        let bestScore = -Infinity;

        for (const { dr, dc } of directions) {
            let count = 1;
            let nr = cellR + dr;
            let nc = cellC + dc;
            while (this._getCell(nr, nc) === opponent) {
                count += 1;
                nr += dr;
                nc += dc;
            }
            const headNeighbor = this._getCell(nr, nc);
            const headBlocked = headNeighbor !== '' && headNeighbor !== opponent;

            nr = cellR - dr;
            nc = cellC - dc;
            while (this._getCell(nr, nc) === opponent) {
                count += 1;
                nr -= dr;
                nc -= dc;
            }
            const tailNeighbor = this._getCell(nr, nc);
            const tailBlocked = tailNeighbor !== '' && tailNeighbor !== opponent;

            if (count < winCount - 1) continue;
            // A live threat needs at least one open end. A sealed chain like O__XXXX_O is dead.
            if (headBlocked && tailBlocked) continue;

            const openEnds = (headBlocked ? 0 : 1) + (tailBlocked ? 0 : 1);
            const score = count * 100 + openEnds * 1000;

            if (score > bestScore) {
                bestScore = score;
                best = {
                    r: cellR,
                    c: cellC,
                    openEnds,
                    headBlocked,
                    tailBlocked,
                    count
                };
            }
        }

        return best;
    },

    _checkOpenEndBlock(tacticalCells, opponent, winCount) {
        let bestCandidate = null;
        let bestScore = -Infinity;

        for (const cell of tacticalCells) {
            if (this._getCell(cell.r, cell.c) !== '') continue;
            const threat = this._evaluateOpenEndThreat(cell.r, cell.c, opponent, winCount);
            if (!threat) continue;

            const score = threat.count * 100 + threat.openEnds * 1000;
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = { r: cell.r, c: cell.c };
            }
        }

        return bestCandidate;
    },

    _evaluatePotentialThreat(r, c, player, winCount) {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        let best = 0;
        for (const { dr, dc } of directions) {
            let count = 1;
            let nr = r + dr;
            let nc = c + dc;
            while (this._getCell(nr, nc) === player) {
                count += 1;
                nr += dr;
                nc += dc;
            }

            nr = r - dr;
            nc = c - dc;
            while (this._getCell(nr, nc) === player) {
                count += 1;
                nr -= dr;
                nc -= dc;
            }

            if (count >= Math.max(2, winCount - 1)) {
                best = Math.max(best, count);
            }
        }
        return best;
    },

    _isLiveThreatCell(r, c, player, winCount) {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            let left = 0;
            let rr = r - dr;
            let cc = c - dc;
            while (this._getCell(rr, cc) === player) {
                left += 1;
                rr -= dr;
                cc -= dc;
            }

            let right = 0;
            rr = r + dr;
            cc = c + dc;
            while (this._getCell(rr, cc) === player) {
                right += 1;
                rr += dr;
                cc += dc;
            }

            const total = left + right + 1;
            if (total < winCount - 1) continue;

            const leftSideOpen = this._getCell(rr, cc) === '';
            const rightSideOpen = this._getCell(r - dr * (left + 1), c - dc * (left + 1)) === '';
            const liveThreat = leftSideOpen || rightSideOpen;

            // Nếu cả 2 đầu đều bị khóa/đã chặn, coi như threat đã chết.
            // Ví dụ: O__XXXX_O => không còn cần block thêm ô trống trong line nữa.
            if (liveThreat && !(leftSideOpen === false && rightSideOpen === false)) {
                return true;
            }
        }

        return false;
    },

    getPriorityTacticalMove(player, opponent, winCount) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;
        const chan2Dau = !!rules.chan2Dau;
        const tacticalCells = this._getTacticalCells();

        // 1) Nước thắng ngay: nếu đặt ở ô này thì thắng, dù có chặn 2 đầu hay không.
        for (const cell of tacticalCells) {
            if (this._isWinningMoveAt(cell.r, cell.c, player, effectiveWinCount, chan2Dau)) {
                return { r: cell.r, c: cell.c, reason: 'immediate_win' };
            }
        }

        // 2) Nước đối thủ thắng ngay: chỉ chặn khi threat còn sống.
        for (const cell of tacticalCells) {
            if (this._isWinningMoveAt(cell.r, cell.c, opponent, effectiveWinCount, chan2Dau)) {
                // Nếu cả 2 đầu đã đóng lại, threat đã chết => không block thêm ô trống thừa.
                // Ví dụ: O__XXXX_O là đã bị khóa, không cần block nữa.
                const nextMoveIsSealed = !this._isLiveThreatCell(cell.r, cell.c, opponent, effectiveWinCount);
                if (!nextMoveIsSealed) {
                    return { r: cell.r, c: cell.c, reason: 'immediate_block' };
                }
            }
        }

        return null;
    },

    getOpenEndBlockMove(player, opponent, winCount) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;
        const chan2Dau = !!rules.chan2Dau;
        if (!chan2Dau) return null;

        const tacticalCells = this._getTacticalCells(effectiveWinCount);

        for (const cell of tacticalCells) {
            if (this._getCell(cell.r, cell.c) !== '') continue;
            if (this._isLiveThreatCell(cell.r, cell.c, opponent, effectiveWinCount)) {
                return { r: cell.r, c: cell.c, reason: 'open_end_block' };
            }
        }

        return null;
    },

    getBestBlockMoves(player, opponent, winCount, targetChain) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;
        const threshold = Number.isFinite(targetChain) ? targetChain : effectiveWinCount - 1;
        const tacticalCells = this._getTacticalCells();
        const results = [];

        for (const cell of tacticalCells) {
            const blockScore = this._evaluatePotentialThreat(cell.r, cell.c, player, effectiveWinCount);
            if (blockScore >= threshold) {
                results.push({
                    r: cell.r,
                    c: cell.c,
                    chainCount: blockScore,
                    wouldDeadChain: false
                });
            }
        }

        results.sort((a, b) => b.chainCount - a.chainCount);
        return results.slice(0, 5);
    },

    _getOpenEndBias(r, c, player) {
        let totalBias = 0;
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            let left = 0;
            let rr = r - dr;
            let cc = c - dc;
            while (this._getCell(rr, cc) === player) {
                left += 1;
                rr -= dr;
                cc -= dc;
            }

            let right = 0;
            rr = r + dr;
            cc = c + dc;
            while (this._getCell(rr, cc) === player) {
                right += 1;
                rr += dr;
                cc += dc;
            }

            const chain = left + right + 1;
            if (chain < 2) continue;

            const leftOpen = this._getCell(rr, cc) === '';
            const rightOpen = this._getCell(r - dr * (left + 1), c - dc * (left + 1)) === '';
            const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
            const closedEnds = 2 - openEnds;

            totalBias += openEnds * 400 - closedEnds * 120 + chain * 25;
        }

        return totalBias;
    },

    getDisplayScore(r, c, player, opponent, winCount, fallbackScore = 0) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;

        if (this._isWinningMoveAt(r, c, player, effectiveWinCount, !!rules.chan2Dau)) {
            return (fallbackScore || 0) + 100000;
        }

        if (this._isWinningMoveAt(r, c, opponent, effectiveWinCount, !!rules.chan2Dau)) {
            return (fallbackScore || 0) + 80000;
        }

        const playerBias = this._getOpenEndBias(r, c, player);
        const opponentBias = this._getOpenEndBias(r, c, opponent);
        const endBias = playerBias - opponentBias;
        const baseScore = Number.isFinite(fallbackScore) ? fallbackScore : 0;

        // Mục tiêu: đầu mở luôn đáng giá hơn đầu kín. Nếu cùng một dạng chuỗi nhưng một đầu còn trống,
        // ô đó phải có điểm cao hơn rõ rệt, không được xếp ngang nhau như hai đầu đồng giá.
        return baseScore + endBias;
    }
};

if (typeof window !== 'undefined') {
    window.BlockBothEndsAnalyzer = BlockBothEndsAnalyzer;
    window.resolveBlockBothEndsRule = BlockBothEndsAnalyzer.resolveRoomRules.bind(BlockBothEndsAnalyzer);
}
