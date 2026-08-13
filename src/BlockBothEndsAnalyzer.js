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
            // ── Đếm liên tiếp (gap = 0) ──
            let leftCount = 0;
            let rr = r - dr;
            let cc = c - dc;
            while (this._getCell(rr, cc) === player) {
                leftCount += 1;
                rr -= dr;
                cc -= dc;
            }

            let rightCount = 0;
            rr = r + dr;
            cc = c + dc;
            while (this._getCell(rr, cc) === player) {
                rightCount += 1;
                rr += dr;
                cc += dc;
            }

            const total = leftCount + rightCount + 1;
            // FIX Bug 1: bỏ điều kiện "leftCount > 0" / "rightCount > 0".
            // Ô (r,c) là đầu mở nếu ô ngoài cùng phía đó trống, bất kể có quân kề hay không.
            const leftOuter = this._getCell(r - dr * (leftCount + 1), c - dc * (leftCount + 1));
            const rightOuter = this._getCell(r + dr * (rightCount + 1), c + dc * (rightCount + 1));
            const leftOpen = leftOuter === '';
            const rightOpen = rightOuter === '';
            const hasRealOpenEnd = leftOpen || rightOpen;
            const hasDoubleOpen = leftOpen && rightOpen;

            // FOUR hoặc lớn hơn với ít nhất 1 đầu mở → live threat
            if (total >= winCount - 1 && hasRealOpenEnd) return true;
            // THREE mở 2 đầu → nguy hiểm (sẽ thắng sau 2 nước nếu không chặn)
            // Chỉ tính khi total >= winCount-2 để tránh overdetect với winCount nhỏ
            if (total >= winCount - 2 && total >= 3 && hasDoubleOpen) return true;

            // ── Đếm với gap = 1 (broken chain) ──
            // Thế O_XX_XX hay O__XXX_X: đặt vào ô gap là thắng → phải coi là live threat.
            // Quét cửa sổ winCount ô quanh (r,c) theo hướng này, đếm quân player + ô trống.
            const opp = player === 'X' ? 'O' : 'X';
            for (let start = -(winCount - 1); start <= 0; start++) {
                let pCount = 0, emptyCount = 0, hasOpp = false;
                for (let k = 0; k < winCount; k++) {
                    const nr2 = r + dr * (start + k);
                    const nc2 = c + dc * (start + k);
                    const cell2 = this._getCell(nr2, nc2);
                    if (cell2 === player) pCount++;
                    else if (cell2 === opp) { hasOpp = true; break; }
                    else emptyCount++;
                }
                if (hasOpp) continue;
                if (pCount < winCount - 1) continue; // cần ít nhất winCount-1 quân trong cửa sổ
                // Kiểm tra 2 đầu ngoài cửa sổ
                const headR = r + dr * (start - 1), headC = c + dc * (start - 1);
                const tailR = r + dr * (start + winCount), tailC = c + dc * (start + winCount);
                const headCell = this._getCell(headR, headC);
                const tailCell = this._getCell(tailR, tailC);
                const headBlocked = headCell !== '' && headCell !== player;
                const tailBlocked = tailCell !== '' && tailCell !== player;
                if (headBlocked && tailBlocked) continue; // chuỗi chết
                return true; // broken chain còn sống
            }
        }

        return false;
    },

    _hasAnyLiveThreat(player, winCount) {
        const tacticalCells = this._getTacticalCells();
        for (const cell of tacticalCells) {
            if (this._getCell(cell.r, cell.c) !== '') continue;
            if (this._isLiveThreatCell(cell.r, cell.c, player, winCount)) return true;
        }
        return false;
    },

    _simulateBlockKillsThreat(cell, player, opponent, effectiveWinCount) {
        const board = this._getBoard();
        const key = `${cell.r},${cell.c}`;
        const oldValue = board.get(key) || '';
        board.set(key, player);
        const stillThreat = this._hasAnyLiveThreat(opponent, effectiveWinCount);
        board.set(key, oldValue || '');
        if (oldValue === '') board.delete(key);
        return !stillThreat;
    },

    _isEffectiveBlock(cell, player, opponent, effectiveWinCount) {
        // Kiểm tra xem cell có phải là đầu mở / lỗ của chuỗi opponent nguy hiểm không.
        // Ngưỡng: chuỗi có >= effectiveWinCount-2 quân trong cửa sổ winCount (bắt cả THREE mở 2 đầu).
        if (!cell || cell.r == null || cell.c == null) return false;
        if (this._getCell(cell.r, cell.c) !== '') return false;

        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            for (let start = -(effectiveWinCount - 1); start <= 0; start++) {
                let pCount = 0, hasEnemy = false, includesCell = false;
                for (let k = 0; k < effectiveWinCount; k++) {
                    const nr2 = cell.r + dr * (start + k);
                    const nc2 = cell.c + dc * (start + k);
                    if (nr2 === cell.r && nc2 === cell.c) {
                        includesCell = true;
                        continue; // cell trống, chưa đặt
                    }
                    const v = this._getCell(nr2, nc2);
                    if (v === opponent) pCount++;
                    else if (v !== '') { hasEnemy = true; break; }
                }
                if (!includesCell || hasEnemy) continue;
                // Ngưỡng linh hoạt:
                // - >= winCount-1 quân: FOUR → phải chặn
                // - >= winCount-2 quân: THREE mở 2 đầu → nguy hiểm, cần chặn sớm
                if (pCount < effectiveWinCount - 2) continue;

                // Nếu chỉ có winCount-2 quân (THREE), yêu cầu PHẢI mở 2 đầu
                if (pCount === effectiveWinCount - 2) {
                    // Kiểm tra 2 đầu ngoài cửa sổ đều mở
                    const hR = cell.r + dr * (start - 1), hC = cell.c + dc * (start - 1);
                    const tR = cell.r + dr * (start + effectiveWinCount), tC = cell.c + dc * (start + effectiveWinCount);
                    const hV = this._getCell(hR, hC);
                    const tV = this._getCell(tR, tC);
                    const hBlocked = hV !== '' && hV !== opponent;
                    const tBlocked = tV !== '' && tV !== opponent;
                    if (hBlocked || tBlocked) continue; // THREE chỉ nguy hiểm khi mở 2 đầu
                    // Thêm: chuỗi phải liên tiếp (không phải scattered), kiểm tra cell kề quân
                    const adjLeft = this._getCell(cell.r - dr, cell.c - dc);
                    const adjRight = this._getCell(cell.r + dr, cell.c + dc);
                    if (adjLeft !== opponent && adjRight !== opponent) continue; // cell không kề quân
                    return true;
                }

                // FOUR (>= winCount-1 quân): kiểm tra chuỗi chưa chết
                const hR = cell.r + dr * (start - 1), hC = cell.c + dc * (start - 1);
                const tR = cell.r + dr * (start + effectiveWinCount), tC = cell.c + dc * (start + effectiveWinCount);
                const hV = this._getCell(hR, hC);
                const tV = this._getCell(tR, tC);
                const hBlocked = hV !== '' && hV !== opponent;
                const tBlocked = tV !== '' && tV !== opponent;
                if (hBlocked && tBlocked) continue;
                return true;
            }
        }

        return false;
    },

    _evaluateThreatDanger(cell, opponent, effectiveWinCount) {
        let best = null;
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (const { dr, dc } of directions) {
            // ── Đếm chuỗi liên tiếp ──
            let left = 0;
            let rr = cell.r - dr;
            let cc = cell.c - dc;
            while (this._getCell(rr, cc) === opponent) {
                left += 1;
                rr -= dr;
                cc -= dc;
            }

            let right = 0;
            rr = cell.r + dr;
            cc = cell.c + dc;
            while (this._getCell(rr, cc) === opponent) {
                right += 1;
                rr += dr;
                cc += dc;
            }

            let total = left + right + 1;

            // ── Nếu total < 3, thử tìm broken chain (gap=1) ──
            // Quét cửa sổ winCount bao gồm cell, đếm quân opponent và ô trống
            if (total < 3) {
                const opp2 = opponent; // alias
                let brokenTotal = 0;
                let brokenLeftOpen = false, brokenRightOpen = false;
                let found = false;
                for (let start = -(effectiveWinCount - 1); start <= 0; start++) {
                    let pCount = 0, hasEnemy = false;
                    let includesCell = false;
                    for (let k = 0; k < effectiveWinCount; k++) {
                        const nr2 = cell.r + dr * (start + k);
                        const nc2 = cell.c + dc * (start + k);
                        const v = this._getCell(nr2, nc2);
                        if (nr2 === cell.r && nc2 === cell.c) { includesCell = true; }
                        if (v === opp2) pCount++;
                        else if (v !== '') { hasEnemy = true; break; }
                    }
                    if (hasEnemy || !includesCell) continue;
                    if (pCount < effectiveWinCount - 2) continue;
                    // Kiểm tra 2 đầu ngoài cửa sổ
                    const hR = cell.r + dr * (start - 1), hC = cell.c + dc * (start - 1);
                    const tR = cell.r + dr * (start + effectiveWinCount), tC = cell.c + dc * (start + effectiveWinCount);
                    const hCell = this._getCell(hR, hC);
                    const tCell = this._getCell(tR, tC);
                    const hBlk = hCell !== '' && hCell !== opponent;
                    const tBlk = tCell !== '' && tCell !== opponent;
                    if (hBlk && tBlk) continue;
                    brokenTotal = pCount + 1; // +1 cho cell
                    brokenLeftOpen = !hBlk;
                    brokenRightOpen = !tBlk;
                    found = true;
                    break;
                }
                if (!found) continue;
                total = brokenTotal;
                const openEnds2 = (brokenLeftOpen ? 1 : 0) + (brokenRightOpen ? 1 : 0);
                if (openEnds2 <= 0) continue;
                const doubleOpen2 = brokenLeftOpen && brokenRightOpen;
                const score2 = (doubleOpen2 ? 1000000 : 0)
                    + (total >= effectiveWinCount ? 500000 : 0)
                    + (total * 10000)
                    + (openEnds2 * 1000)
                    + (doubleOpen2 ? 5000 : 0)
                    + 1;
                if (!best || score2 > best.score) {
                    best = { score: score2, runLength: total, openEnds: openEnds2, doubleOpen: doubleOpen2, isImmediate: total >= effectiveWinCount - 1 };
                }
                continue;
            }

            const leftOpen = this._getCell(cell.r - dr * (left + 1), cell.c - dc * (left + 1)) === '';
            const rightOpen = this._getCell(cell.r + dr * (right + 1), cell.c + dc * (right + 1)) === '';
            const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
            if (openEnds <= 0) continue;

            const doubleOpen = leftOpen && rightOpen;
            const score = (doubleOpen ? 1000000 : 0)
                + (total >= effectiveWinCount ? 500000 : 0)
                + (total * 10000)
                + (openEnds * 1000)
                + (leftOpen && rightOpen ? 5000 : 0)
                + 1;

            if (!best || score > best.score) {
                best = {
                    score,
                    runLength: total,
                    openEnds,
                    doubleOpen,
                    isImmediate: total >= effectiveWinCount - 1
                };
            }
        }

        return best;
    },

    _bestLiveThreatBlock(player, opponent, effectiveWinCount) {
        const tacticalCells = this._getTacticalCells();
        let best = null;
        let bestPriority = -Infinity;

        for (const cell of tacticalCells) {
            if (this._getCell(cell.r, cell.c) !== '') continue;
            if (!this._isLiveThreatCell(cell.r, cell.c, opponent, effectiveWinCount)) continue;
            if (!this._isEffectiveBlock(cell, player, opponent, effectiveWinCount)) continue;

            const danger = this._evaluateThreatDanger(cell, opponent, effectiveWinCount);
            if (!danger) continue;

            const priority = danger.score + (danger.doubleOpen ? 10000 : 0) + (danger.runLength * 10);
            if (priority > bestPriority) {
                bestPriority = priority;
                best = { r: cell.r, c: cell.c, reason: 'open_end_block', openEnds: danger.openEnds, runLength: danger.runLength };
            }
        }

        return best;
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

        // 2) Chặn threat sống có đầu mở: ưu tiên đúng đầu mở trước khi xét chặn thắng ngay thông thường.
        // Bắt các thế: O_XXXX, O__XXXX (gap>=0) — phải chặn đầu mở để kill threat.
        // Chạy kể cả khi chan2Dau = false vì đây là chặn threat, không phụ thuộc luật chặn 2 đầu.
        {
            const bestOpenEnd = this._bestLiveThreatBlock(player, opponent, effectiveWinCount);
            if (bestOpenEnd) return bestOpenEnd;
        }

        // 3) Nước đối thủ thắng ngay: chỉ chặn khi threat còn sống.
        // Dùng _isLiveThreatCell để filter — tránh chặn chuỗi chết (đã sealed 2 đầu).
        // FIX: bỏ điều kiện nextMoveIsSealed dựa trên _isLiveThreatCell vì nó có thể
        // trả false giả khi chan2Dau=false và chuỗi không có đầu mở theo định nghĩa cũ.
        // Thay bằng: chặn bất cứ nước nào địch sẽ thắng ngay, trừ khi chan2Dau=true
        // và chuỗi đó thực sự chết (cả 2 đầu bị seal kể cả sau khi địch đặt).
        for (const cell of tacticalCells) {
            if (this._isWinningMoveAt(cell.r, cell.c, opponent, effectiveWinCount, chan2Dau)) {
                if (chan2Dau) {
                    // Chặn 2 đầu mode: chỉ chặn nếu chuỗi còn live (chưa dead)
                    const isThreatDead = !this._isLiveThreatCell(cell.r, cell.c, opponent, effectiveWinCount);
                    if (isThreatDead) continue; // chuỗi đã chết, không cần chặn
                }
                return { r: cell.r, c: cell.c, reason: 'immediate_block' };
            }
        }

        return null;
    },

    getOpenEndBlockMove(player, opponent, winCount) {
        const rules = this.resolveRoomRules(winCount);
        const effectiveWinCount = Number.isFinite(rules.winCount) ? rules.winCount : 5;
        // Bỏ guard chan2Dau: THREE mở 2 đầu là threat thực, không phụ thuộc luật chặn 2 đầu.
        // Hàm này bổ sung cho getPriorityTacticalMove — bắt các threat tầm trung (THREE+).

        const tacticalCells = this._getTacticalCells(effectiveWinCount);
        let best = null;
        let bestScore = -Infinity;

        for (const cell of tacticalCells) {
            if (this._getCell(cell.r, cell.c) !== '') continue;
            if (!this._isLiveThreatCell(cell.r, cell.c, opponent, effectiveWinCount)) continue;
            if (!this._isEffectiveBlock(cell, player, opponent, effectiveWinCount)) continue;

            const danger = this._evaluateThreatDanger(cell, opponent, effectiveWinCount);
            if (!danger) continue;

            const score = danger.score;
            if (score > bestScore) {
                bestScore = score;
                best = { r: cell.r, c: cell.c, reason: 'open_end_block', openEnds: danger.openEnds, runLength: danger.runLength };
            }
        }

        return best;
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
