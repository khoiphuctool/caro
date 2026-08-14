// ══════════════════════════════════════════════════════════════════
// BOT PET CANDIDATES — TOP-4 HINTS dùng chung Offline + Online
//
// Kiến trúc:
//   getTop4CandidatesForPlayer(piece)   ← CORE dùng chung
//          ↓ getSearchCandidates() → quickScore → sort → TOP-4
//
//   OFFLINE: piece = humanPiece,    isMyTurn = currentPlayer === humanPiece
//   ONLINE:  piece = myOnlineRole,  isMyTurn = currentTurn  === myOnlineRole
//
// Không sửa thuật toán scoring, Evaluation, BlockBothEndsAnalyzer,
// winCount, chan2Dau. Offline giữ nguyên 100%.
// ══════════════════════════════════════════════════════════════════

// ── STATE ────────────────────────────────────────────────────────
let topCandidates = [];
let candidatesVisible = false;

// ── TURN / PIECE ADAPTERS ─────────────────────────────────────────

/** Offline: humanPiece. Online: myOnlineRole. */
function _getLocalPiece() {
    if (_isOnline()) {
        return window.myOnlineRole || null;
    }
    // Offline
    if (typeof humanPiece !== 'undefined' && humanPiece) return humanPiece;
    return 'X';
}

/**
 * true khi đến lượt local player đánh.
 * Offline: currentPlayer === humanPiece  (isBotMove=false guard)
 * Online:  currentTurn   === myOnlineRole
 */
function _isMyTurn() {
    if (_isOnline()) {
        return typeof currentTurn !== 'undefined' && !!window.myOnlineRole
            && currentTurn === window.myOnlineRole;
    }
    // Offline
    if (typeof isBotMove !== 'undefined' && isBotMove === true) return false;
    if (typeof currentPlayer !== 'undefined' && typeof humanPiece !== 'undefined') {
        return currentPlayer === humanPiece;
    }
    return true;
}

function _isOnline() {
    return typeof window !== 'undefined'
        && typeof window.isOnlineModeActive === 'function'
        && window.isOnlineModeActive();
}

function _isGameOn() {
    return typeof isGameActive !== 'undefined' ? isGameActive : true;
}

// ── BOT PET SCORING ENGINE ────────────────────────────────────────
/**
 * Scoring engine phù hợp với từng bot pet đang trang bị.
 * Map aiProfile → hàm scoring tương ứng để gợi ý TOP-4 phản ánh
 * đúng "phong cách tư duy" của bot được trang bị.
 *
 * LƯU Ý: KHÔNG swap botPiece/humanPiece toàn cục — chỉ truyền piece/opponent
 * trực tiếp vào từng hàm engine. Swap toàn cục làm lệch scoring các engine
 * nội bộ (quickScore, evalLine, BlockBothEndsAnalyzer) vì chúng đọc lại biến
 * toàn cục, gây ra điểm ngược chiều so với góc nhìn người chơi.
 */
const BotPetScoringEngine = {

    /**
     * Lấy aiProfile từ bot pet đang trang bị.
     * Trả về null nếu không có bot pet.
     */
    _getAiProfile() {
        try {
            // Online: lấy từ equipped bot pet trực tiếp
            if (typeof _isOnline === 'function' && _isOnline()) {
                const eq = typeof getEquippedBotPet === 'function' ? getEquippedBotPet() : null;
                if (eq) return eq.aiProfile || null;
            }
            const state = typeof getMatchBotPetState === 'function' ? getMatchBotPetState() : null;
            if (!state || !state.equippedBotPet) return null;
            const botPet = typeof getBotPetById === 'function' ? getBotPetById(state.equippedBotPet) : null;
            return botPet ? botPet.aiProfile : null;
        } catch (_) { return null; }
    },

    /**
     * Score tất cả candidates theo đúng engine của bot pet.
     * Trả về mảng {r, c, score} đã sắp xếp giảm dần.
     * KHÔNG swap biến toàn cục — truyền piece/opponent trực tiếp.
     */
    scoreCandidates(cands, piece) {
        const opponent  = piece === 'X' ? 'O' : 'X';
        const aiProfile = this._getAiProfile();

        switch (aiProfile) {
            case 'LIGHTNING':
                return this._scoreLightning(cands, piece, opponent);
            case 'SUPERHUMAN':
                return this._scoreSuperhuman(cands, piece, opponent);
            case 'ULTIMATE':
                return this._scoreUltimate(cands, piece, opponent);
            case 'HARD':
                return this._scoreHard(cands, piece, opponent);
            // EASY, MEDIUM và fallback: dùng Ultimate scoring (có BlockBothEnds)
            // để gợi ý chặn đúng, không chỉ tấn công
            default:
                return this._scoreUltimate(cands, piece, opponent);
        }
    },

    // ── FALLBACK: quickScore thuần — chỉ dùng khi BlockBothEndsAnalyzer không có ──
    _scoreQuick(cands, piece) {
        return cands.map(({ r, c }) => ({
            r, c,
            score: typeof quickScore === 'function' ? quickScore(r, c, piece) : 0
        })).sort((a, b) => b.score - a.score);
    },

    // ── ULTIMATE / DEFAULT: BlockBothEndsAnalyzer scoring ──────────
    // Dùng getDisplayScore — tính cả tấn công lẫn phòng thủ/chặn.
    // Đây là engine cơ bản cho tất cả bot pet (trừ Lightning/Superhuman).
    _scoreUltimate(cands, piece, opponent) {
        const wc = typeof winCount !== 'undefined' ? winCount : 5;
        const roomRules = (typeof GameState !== 'undefined' && GameState.roomRules)
            || { winCount: wc, chan2Dau: typeof getBlockBothEnds === 'function' ? getBlockBothEnds() : false };

        // Nếu không có BlockBothEndsAnalyzer, fallback quickScore
        if (typeof BlockBothEndsAnalyzer === 'undefined' ||
            typeof BlockBothEndsAnalyzer.getDisplayScore !== 'function') {
            return this._scoreQuick(cands, piece);
        }

        return cands.map(({ r, c }) => {
            const fallback = typeof quickScore === 'function' ? quickScore(r, c, piece) : 0;
            const score = BlockBothEndsAnalyzer.getDisplayScore(
                r, c, piece, opponent,
                roomRules.winCount || wc,
                fallback
            );
            return { r, c, score };
        }).sort((a, b) => b.score - a.score);
    },

    // ── HARD: Ultimate scoring + fork bonus ─────────────────────────
    // Thêm điểm thưởng cho các ô tạo được fork (≥2 lines tấn công).
    _scoreHard(cands, piece, opponent) {
        const base = this._scoreUltimate(cands, piece, opponent);

        // Fork detection: setCell → đếm attack lines ≥ THREE_OPEN → restore
        if (typeof setCell !== 'function' || typeof evalLine !== 'function' ||
            typeof DIRECTIONS === 'undefined') return base;

        const FORK_BONUS = 80000;
        const NONE_VAL = (typeof TL !== 'undefined') ? TL.NONE : 0;
        const MIN_THREAT = (typeof TL !== 'undefined') ? TL.THREE_OPEN : 3.5;

        const scored = base.map(({ r, c, score }) => {
            setCell(r, c, piece);
            let atkLines = 0;
            try {
                for (const { dr, dc } of DIRECTIONS) {
                    const res = evalLine(r, c, dr, dc, piece);
                    if (res !== undefined && res !== NONE_VAL && res >= MIN_THREAT) {
                        atkLines++;
                    }
                }
            } finally {
                setCell(r, c, '');
            }
            return { r, c, score: score + (atkLines >= 2 ? FORK_BONUS * atkLines : 0) };
        });
        return scored.sort((a, b) => b.score - a.score);
    },

    // ── LIGHTNING (bot-tia-chop): BotTiaChop evaluatePos ─────────
    // Đọc bàn cờ, chạy evaluatePos giống bot Tia Chớp, lấy điểm từ s[] và q[].
    _scoreLightning(cands, piece, opponent) {
        if (typeof BotTiaChop === 'undefined' ||
            typeof BotTiaChop.readBoard !== 'function' ||
            typeof BotTiaChop.evaluatePos !== 'function') {
            return this._scoreUltimate(cands, piece, opponent);
        }
        try {
            const wc = typeof winCount !== 'undefined' ? winCount : 5;
            const roomRules = (typeof GameState !== 'undefined' && GameState.roomRules)
                || { winCount: wc, chan2Dau: typeof getBlockBothEnds === 'function' ? getBlockBothEnds() : false };
            const chan2Dau = !!roomRules.chan2Dau;

            const { board, minR, minC, rows, cols } = BotTiaChop.readBoard();
            // piece là góc nhìn người chơi — machSq = điểm tấn công của piece
            const machSq = piece    === 'X' ? 1 : -1;
            const userSq = opponent === 'X' ? 1 : -1;

            const s = BotTiaChop.make2D(rows, cols, 0);
            const q = BotTiaChop.make2D(rows, cols, 0);
            // s = tấn công của piece, q = phòng thủ (điểm địch tại ô đó)
            BotTiaChop.evaluatePos(s, machSq, board, rows, cols, roomRules.winCount || wc, minR, minC, chan2Dau, machSq);
            BotTiaChop.evaluatePos(q, userSq, board, rows, cols, roomRules.winCount || wc, minR, minC, chan2Dau, machSq);

            return cands.map(({ r, c }) => {
                const ri = r - minR, ci = c - minC;
                if (ri < 0 || ri >= rows || ci < 0 || ci >= cols) {
                    return { r, c, score: 0 };
                }
                const atk = s[ri][ci] > -1 ? s[ri][ci] : 0;
                const def = q[ri][ci] > -1 ? q[ri][ci] : 0;
                // Lấy max(tấn công, phòng thủ) — phản ánh đúng ưu tiên của Tia Chớp
                return { r, c, score: Math.max(atk, def) };
            }).sort((a, b) => b.score - a.score);
        } catch (_) {
            return this._scoreUltimate(cands, piece, opponent);
        }
    },

    // ── SUPERHUMAN (bot-than-co): Ultimate scoring + BotSuperV2 boost ──
    // Dùng Ultimate scoring cho toàn bộ, sau đó boost ô #1 theo nước
    // thực của BotSuperV2 nếu có. KHÔNG gọi getBotMove đồng bộ nặng —
    // chỉ dùng nếu BotSuperV2 đã sẵn có cached move từ lần tính trước.
    _scoreSuperhuman(cands, piece, opponent) {
        const base = this._scoreUltimate(cands, piece, opponent);

        // Thử boost ô #1 theo nước thực của BotSuperV2
        // Chỉ dùng nếu BotSuperV2 có lastMove cache — không gọi getBotMove đồng bộ
        try {
            const BotSuperV2ref = typeof window.BotSuperV2 !== 'undefined' ? window.BotSuperV2 : null;
            const cachedMove = BotSuperV2ref && BotSuperV2ref._lastSuggestedMove
                ? BotSuperV2ref._lastSuggestedMove
                : null;

            if (cachedMove) {
                const topScore = base.length > 0 ? base[0].score : 1000000;
                const idx = base.findIndex(item => item.r === cachedMove.r && item.c === cachedMove.c);
                if (idx > 0) {
                    base[idx].score = topScore * 1.5;
                    base.sort((a, b) => b.score - a.score);
                } else if (idx === -1 && typeof getCell === 'function' && getCell(cachedMove.r, cachedMove.c) === '') {
                    // Ô này chưa có trong candidates nhưng hợp lệ — thêm vào đầu
                    base.unshift({ r: cachedMove.r, c: cachedMove.c, score: topScore * 1.5 });
                }
            }
        } catch (_) { /* fallback về base */ }

        return base;
    }
};
window.BotPetScoringEngine = BotPetScoringEngine;

// ── CORE: TOP-4 dùng chung Offline + Online ───────────────────────
/**
 * Tính TOP-4 candidate cho `piece` từ board hiện tại.
 * Dùng BotPetScoringEngine để scoring phù hợp với bot pet đang trang bị:
 *   EASY/MEDIUM   → BlockBothEndsAnalyzer (tấn công + chặn đúng)
 *   HARD          → Ultimate scoring + fork bonus
 *   ULTIMATE      → BlockBothEndsAnalyzer.getDisplayScore
 *   LIGHTNING     → BotTiaChop.evaluatePos
 *   SUPERHUMAN    → BotSuperV2 cached + ultimate scoring
 *
 * FIX: Khi getSearchCandidates() trả về < 4 ô (bàn gần trống),
 * bổ sung từ getAllTacticalCells() hoặc expand bán kính 3 quanh quân
 * để đảm bảo luôn có đủ 4 ô hiển thị rank 1-2-3-4.
 */
function getTop4CandidatesForPlayer(piece) {
    let cands = [];

    // Ưu tiên dùng getSearchCandidates (có lọc lân cận)
    if (typeof getSearchCandidates === 'function') {
        const raw = getSearchCandidates();
        if (Array.isArray(raw)) {
            cands = raw.filter(({ r, c }) =>
                typeof getCell === 'function' ? getCell(r, c) === '' : true
            );
        }
    }

    // Bổ sung từ getAllTacticalCells nếu chưa đủ 4 ô
    if (cands.length < 4 && typeof getAllTacticalCells === 'function') {
        const tactical = getAllTacticalCells();
        const existing = new Set(cands.map(({ r, c }) => `${r},${c}`));
        for (const cell of tactical) {
            if (!existing.has(`${cell.r},${cell.c}`)) {
                cands.push(cell);
                existing.add(`${cell.r},${cell.c}`);
            }
            if (cands.length >= 8) break;
        }
    }

    // Fallback cuối: expand bán kính 3 quanh quân trên bàn (bàn mới 1-2 quân đầu)
    if (cands.length < 4) {
        const existing = new Set(cands.map(({ r, c }) => `${r},${c}`));
        const tryAdd = (r, c) => {
            const key = `${r},${c}`;
            if (existing.has(key)) return;
            if (typeof getCell === 'function' && getCell(r, c) !== '') return;
            existing.add(key);
            cands.push({ r, c });
        };

        const isInf = typeof isInfinite !== 'undefined' && isInfinite;
        if (isInf) {
            const map = (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap)
                ? GameState.board.infiniteMap
                : (typeof infiniteMap !== 'undefined' ? infiniteMap : new Map());
            map.forEach((_, key) => {
                const [pr, pc] = key.split(',').map(Number);
                for (let dr = -3; dr <= 3; dr++)
                    for (let dc = -3; dc <= 3; dc++)
                        if (dr || dc) tryAdd(pr + dr, pc + dc);
            });
        }
    }

    if (cands.length === 0) return [];

    const scored = BotPetScoringEngine.scoreCandidates(cands, piece);
    return scored.slice(0, 4).map(({ r, c, score }) => ({ r, c, score, threat: null }));
}
window.getTop4CandidatesForPlayer = getTop4CandidatesForPlayer;

// Alias để các caller cũ vẫn hoạt động
function getTop4Candidates(player) {
    return getTop4CandidatesForPlayer(player);
}
window.getTop4Candidates = getTop4Candidates;

// ── REFRESH — hàm trung tâm ────────────────────────────────────────
/**
 * Kiểm tra điều kiện, gọi core engine, cập nhật state + render 1 lần.
 * Được gọi bởi: makeMove (offline), _syncRoomBoardState (online),
 *               setBotPetActive, PositionEditor patch.
 */
function refreshBotPetCandidatesForCurrentTurn() {
    const online    = _isOnline();
    const myRole    = online ? (window.myOnlineRole || null) : null;
    const turn      = typeof currentTurn !== 'undefined' ? currentTurn : null;
    const localTurn = _isMyTurn();
    // Determine if BotPet is considered active for this client:
    // - Offline: rely on matchBotPetState (isBotPetActive())
    // - Online: allow online companion active state (per-role) as a visual-only active flag
    let petActive = typeof isBotPetActive === 'function' ? isBotPetActive() : false;
    let equipped  = (() => { try { const s = getMatchBotPetState(); return s ? s.equippedBotPet : null; } catch (_) { return null; } })();
    if (online) {
        try {
            const myRoleVal = window.myOnlineRole || (typeof myRole !== 'undefined' ? myRole : null);
            if (myRoleVal && typeof window.isOnlinePetActive === 'function') {
                petActive = petActive || !!window.isOnlinePetActive(myRoleVal);
            }
            // Prefer equipped bot from getEquippedBotPet() for the local online player
            if (typeof getEquippedBotPet === 'function') {
                const eq = getEquippedBotPet();
                if (eq && eq.id) equipped = eq.id;
            } else if (myRoleVal && typeof window.getOnlinePetEquippedId === 'function') {
                const onlineEq = window.getOnlinePetEquippedId(myRoleVal);
                if (onlineEq) equipped = onlineEq;
            }
        } catch (e) {
            console.warn('[BotPetCandidates] online pet state read failed', e);
        }
    }
    const gameOn    = _isGameOn();

    // console.log('[PET-ONLINE-TRACE]', { online, myOnlineRole: myRole, currentTurn: turn, localTurn, petActive, equippedBotPet: equipped,
    //     gameActive: gameOn, candidatesVisible, candidateCount: topCandidates.length });

    if (!gameOn)     return _block('game-not-active');
    if (!petActive)  return _block('pet-not-active');
    if (!equipped)   return _block('no-equipped-pet');
    if (!localTurn)  return _block('not-my-turn');

    const piece = _getLocalPiece();
    if (!piece)      return _block('no-local-piece');

    const newCandidates = getTop4CandidatesForPlayer(piece);

    // console.log('[PET-ONLINE-TRACE] PASS →', { piece, count: newCandidates.length });

    _setState(newCandidates, newCandidates.length > 0);
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
}
window.refreshBotPetCandidatesForCurrentTurn = refreshBotPetCandidatesForCurrentTurn;

function _block(reason) {
    if (topCandidates.length > 0 || candidatesVisible) {
    // console.log('[PET-ONLINE-TRACE] BLOCKED:', reason);
    }
    _setState([], false);
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
}

function _setState(candidates, visible) {
    topCandidates = candidates;
    candidatesVisible = visible;
}

// ── PUBLIC HOOKS ──────────────────────────────────────────────────

/** Hook từ makeMove() sau mỗi nước đi */
function updateCandidates() {
    const petActive = typeof isBotPetActive === 'function' ? isBotPetActive() : false;
    if (!petActive && !candidatesVisible) return;
    refreshBotPetCandidatesForCurrentTurn();
}
window.updateCandidates = updateCandidates;

/** Hook từ setBotPetActive */
function toggleCandidates(active) {
    if (!active) {
        _setState([], false);
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
        return;
    }
    refreshBotPetCandidatesForCurrentTurn();
}
window.toggleCandidates = toggleCandidates;

// ── GETTERS ───────────────────────────────────────────────────────
function getCurrentCandidates() { return topCandidates; }
window.getCurrentCandidates = getCurrentCandidates;

function areCandidatesVisible() { return candidatesVisible; }
window.areCandidatesVisible = areCandidatesVisible;

function clearCandidatesFromBoard() {
    _setState([], false);
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
}
window.clearCandidatesFromBoard = clearCandidatesFromBoard;

function showCandidatesOnBoard(candidates) {
    if (!candidates || candidates.length === 0) {
        clearCandidatesFromBoard();
        return;
    }
    _setState(candidates, true);
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
}
window.showCandidatesOnBoard = showCandidatesOnBoard;

// ── DIAGNOSTIC ────────────────────────────────────────────────────
window.botPetCandidateDebug = function () {
    const canvas = typeof infCanvas !== 'undefined' ? infCanvas : null;
    const ctx    = typeof infCtx    !== 'undefined' ? infCtx    : null;
    const state  = typeof getMatchBotPetState === 'function' ? getMatchBotPetState() : null;
    const el     = document.getElementById('show-cell-scores') || document.getElementById('show-cell-scores-bot');
    const result = {
        isGameActive:    _isGameOn(),
        isOnline:        _isOnline(),
        isBotMatch:      typeof matchIsBotMatch === 'function' ? matchIsBotMatch() : 'unknown',
        currentPlayer:   typeof currentPlayer !== 'undefined' ? currentPlayer : 'undef',
        currentTurn:     typeof currentTurn   !== 'undefined' ? currentTurn   : 'undef',
        humanPiece:      typeof humanPiece    !== 'undefined' ? humanPiece    : 'undef',
        botPiece:        typeof botPiece      !== 'undefined' ? botPiece      : 'undef',
        myOnlineRole:    window.myOnlineRole  || 'undef',
        localPiece:      _getLocalPiece(),
        isMyTurn:        _isMyTurn(),
        petActive:       state ? state.active : false,
        equippedPetId:   state ? state.equippedBotPet : null,
        runtimeProfile:  state ? state.runtimeProfile : null,
        candidatesVisible,
        candidateCount:  topCandidates.length,
        candidates:      topCandidates.map((c, i) => ({ rank: i + 1, row: c.r, col: c.c, score: c.score })),
        showScores:      el ? el.checked : false,
        cellScoresCount: window.cellScores ? Object.keys(window.cellScores).length : 0,
        canvasType:      canvas ? canvas.constructor.name : 'undef',
        contextType:     ctx    ? ctx.constructor.name    : 'undef',
        canvasId:        canvas ? canvas.id               : 'undef'
    };
    // console.log('[BotPetCandidateDebug]', result);
    return result;
};
