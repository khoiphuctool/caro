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

// ── CORE: TOP-4 dùng chung Offline + Online ───────────────────────
/**
 * Tính TOP-4 candidate cho `piece` từ board hiện tại.
 * Offline: piece = humanPiece
 * Online:  piece = myOnlineRole
 * Dùng quickScore — không giả đặt quân, không gọi getBotMove nhiều lần.
 * Swap botPiece/humanPiece tạm trong try/finally để quickScore
 * tính attack + defense từ đúng góc nhìn.
 */
function getTop4CandidatesForPlayer(piece) {
    const opponent = piece === 'X' ? 'O' : 'X';

    let cands = [];
    if (typeof getSearchCandidates === 'function') {
        const raw = getSearchCandidates();
        if (Array.isArray(raw)) {
            cands = raw.filter(({ r, c }) =>
                typeof getCell === 'function' ? getCell(r, c) === '' : true
            );
        }
    }
    if (cands.length === 0) return [];

    const _origBp = typeof botPiece   !== 'undefined' ? botPiece   : null;
    const _origHp = typeof humanPiece !== 'undefined' ? humanPiece : null;

    let top4 = [];
    try {
        if (typeof botPiece   !== 'undefined') botPiece   = piece;
        if (typeof humanPiece !== 'undefined') humanPiece = opponent;

        const scored = cands.map(({ r, c }) => ({
            r, c, threat: null,
            score: typeof quickScore === 'function' ? quickScore(r, c, piece) : 0
        }));
        scored.sort((a, b) => b.score - a.score);
        top4 = scored.slice(0, 4);
    } finally {
        if (_origBp !== null && typeof botPiece   !== 'undefined') botPiece   = _origBp;
        if (_origHp !== null && typeof humanPiece !== 'undefined') humanPiece = _origHp;
    }

    return top4;
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

    console.log('[PET-ONLINE-TRACE]', {
        online, myOnlineRole: myRole, currentTurn: turn,
        localTurn, petActive, equippedBotPet: equipped,
        gameActive: gameOn, candidatesVisible, candidateCount: topCandidates.length
    });

    if (!gameOn)     return _block('game-not-active');
    if (!petActive)  return _block('pet-not-active');
    if (!equipped)   return _block('no-equipped-pet');
    if (!localTurn)  return _block('not-my-turn');

    const piece = _getLocalPiece();
    if (!piece)      return _block('no-local-piece');

    const newCandidates = getTop4CandidatesForPlayer(piece);

    console.log('[PET-ONLINE-TRACE] PASS →', {
        piece, count: newCandidates.length,
        top4: newCandidates.map((c, i) => ({ rank: i + 1, r: c.r, c: c.c, score: c.score }))
    });

    _setState(newCandidates, newCandidates.length > 0);
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
}
window.refreshBotPetCandidatesForCurrentTurn = refreshBotPetCandidatesForCurrentTurn;

function _block(reason) {
    if (topCandidates.length > 0 || candidatesVisible) {
        console.log('[PET-ONLINE-TRACE] BLOCKED:', reason);
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
    console.log('[BotPetCandidateDebug]', result);
    return result;
};
