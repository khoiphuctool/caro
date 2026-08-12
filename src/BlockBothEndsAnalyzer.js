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

    _checkOpenEndBlock(tacticalCells, opponent, winCount) {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        let bestCandidate = null;
        let bestCount = 0;

        for (const cell of tacticalCells) {
            if (this._getCell(cell.r, cell.c) !== '') continue;
            for (const { dr, dc } of directions) {
                let count = 1;
                let nr = cell.r + dr;
                let nc = cell.c + dc;
                while (this._getCell(nr, nc) === opponent) {
                    count += 1;
                    nr += dr;
                    nc += dc;
                }
                const headEndR = nr;
                const headEndC = nc;

                nr = cell.r - dr;
                nc = cell.c - dc;
                while (this._getCell(nr, nc) === opponent) {
                    count += 1;
                    nr -= dr;
                    nc -= dc;
                }
                const tailEndR = nr;
                const tailEndC = nc;

                if (count < winCount - 1) continue;
                const headBlocked = this._isBlocked(headEndR, headEndC, dr, dc, opponent, winCount);
                const tailBlocked = this._isBlocked(tailEndR, tailEndC, -dr, -dc, opponent, winCount);
                if ((headBlocked && !tailBlocked) || (!headBlocked && tailBlocked)) {
                    if (count > bestCount) {
                        bestCount = count;
                        bestCandidate = { r: cell.r, c: cell.c };
                    }
                }
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

    getPriorityTacticalMove(player, opponent, winCount) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;
        const chan2Dau = !!rules.chan2Dau;
        const tacticalCells = this._getTacticalCells();

        for (const cell of tacticalCells) {
            if (this._isWinningMoveAt(cell.r, cell.c, player, effectiveWinCount, chan2Dau)) {
                return { r: cell.r, c: cell.c, reason: 'immediate_win' };
            }
        }

        for (const cell of tacticalCells) {
            if (this._isWinningMoveAt(cell.r, cell.c, opponent, effectiveWinCount, chan2Dau)) {
                return { r: cell.r, c: cell.c, reason: 'immediate_block' };
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
        const openEndBlock = this._checkOpenEndBlock(tacticalCells, opponent, effectiveWinCount);
        if (openEndBlock) {
            return { r: openEndBlock.r, c: openEndBlock.c, reason: 'open_end_block' };
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

    getDisplayScore(r, c, player, opponent, winCount, fallbackScore = 0) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;

        if (this._isWinningMoveAt(r, c, player, effectiveWinCount, !!rules.chan2Dau)) {
            return (fallbackScore || 0) + 100000;
        }

        if (this._isWinningMoveAt(r, c, opponent, effectiveWinCount, !!rules.chan2Dau)) {
            return (fallbackScore || 0) + 80000;
        }

        return Number.isFinite(fallbackScore) ? fallbackScore : 0;
    }
};

if (typeof window !== 'undefined') {
    window.BlockBothEndsAnalyzer = BlockBothEndsAnalyzer;
    window.resolveBlockBothEndsRule = BlockBothEndsAnalyzer.resolveRoomRules.bind(BlockBothEndsAnalyzer);
}
