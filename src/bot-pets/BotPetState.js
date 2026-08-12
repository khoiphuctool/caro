// ══════════════════════════════════════════════════════════════════
// BOT PET STATE - QUẢN LÝ TRẠNG THÁI BOT PET TRONG TRẬN
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// MATCH BOT PET STATE
// State riêng cho mỗi trận, không lưu vào Firebase
// ──────────────────────────────────────────────
if (typeof window !== 'undefined' && typeof window.DEBUG_BOT_RUNTIME === 'undefined') {
    window.DEBUG_BOT_RUNTIME = false;
    window.botRuntimeDebug = function(...args) {
        if (window.DEBUG_BOT_RUNTIME) console.log('[BOT-PET RUNTIME]', ...args);
    };
    window.botRuntimeWarn = function(...args) {
        if (window.DEBUG_BOT_RUNTIME) console.warn('[BOT-PET RUNTIME]', ...args);
    };
}
let matchBotPetState = {
    equippedBotPet: null,
    active: false,
    visual: null,
    runtimeProfile: null
};

// ──────────────────────────────────────────────
// KHỞI TẠO BOT PET STATE KHI VÀO TRẬN
// ──────────────────────────────────────────────
function matchIsBotMatch() {
    const isOnline = typeof window !== 'undefined' && typeof window.isOnlineModeActive === 'function' && window.isOnlineModeActive();
    if (isOnline) return false;

    const currentMode = typeof gameMode !== 'undefined' ? gameMode : (document.getElementById('game-mode')?.value || '');
    if (typeof isBotMode === 'function') {
        return isBotMode(currentMode);
    }
    return typeof currentMode === 'string' && (
        currentMode.startsWith('ai') ||
        currentMode === 'bot-toi-thuong' ||
        currentMode === 'bot-tia-chop' ||
        currentMode === 'bot-than-co'
    );
}

function getMatchBotPetVisual() {
    if (!matchBotPetState.equippedBotPet) return null;
    const botPet = getBotPetById(matchBotPetState.equippedBotPet);
    if (!botPet) return null;
    return {
        id: botPet.id,
        avatar: botPet.avatar,
        name: botPet.name,
        aiProfile: botPet.aiProfile
    };
}
window.getMatchBotPetVisual = getMatchBotPetVisual;

function refreshMatchBotPetRuntimeProfile() {
    if (!matchBotPetState.active || !matchBotPetState.equippedBotPet || !matchIsBotMatch()) {
        matchBotPetState.runtimeProfile = null;
        return null;
    }

    matchBotPetState.runtimeProfile = (typeof resolveBotPetProfile === 'function') ? resolveBotPetProfile(matchBotPetState.equippedBotPet) : null;
    if (!matchBotPetState.runtimeProfile) {
        console.warn('[BotPetState] Runtime profile not available for current Bot Pet or game mode');
        matchBotPetState.runtimeProfile = null;
    }
    return matchBotPetState.runtimeProfile;
}
window.refreshMatchBotPetRuntimeProfile = refreshMatchBotPetRuntimeProfile;

function initMatchBotPetState() {
    const equippedBotPet = getEquippedBotPet();
    matchBotPetState = {
        equippedBotPet: equippedBotPet ? equippedBotPet.id : null,
        active: false,
        visual: equippedBotPet ? {
            id: equippedBotPet.id,
            avatar: equippedBotPet.avatar,
            name: equippedBotPet.name,
            aiProfile: equippedBotPet.aiProfile
        } : null,
        runtimeProfile: null
    };
    console.log('[BotPetState] Initialized:', matchBotPetState);
    return matchBotPetState;
}
window.initMatchBotPetState = initMatchBotPetState;

// ──────────────────────────────────────────────
// LẤY TRẠNG THÁI BOT PET HIỆN TẠI
// ──────────────────────────────────────────────
function getMatchBotPetState() {
    return matchBotPetState;
}
window.getMatchBotPetState = getMatchBotPetState;

function getMatchBotPetProfile() {
    return matchBotPetState.runtimeProfile;
}
window.getMatchBotPetProfile = getMatchBotPetProfile;

function getMatchBotPetVisualState() {
    return matchBotPetState.visual;
}
window.getMatchBotPetVisualState = getMatchBotPetVisualState;

window.logBotPetRuntimeAudit = function() {
    const equippedBotPet = (typeof getEquippedBotPet === 'function') ? getEquippedBotPet() : null;
    const equippedBotPetProfile = (typeof getEquippedBotPetProfile === 'function') ? getEquippedBotPetProfile() : null;
    const selectedMode = document.getElementById('game-mode')?.value || (typeof modeSelect !== 'undefined' ? modeSelect.value : undefined);
    console.log('[BotPetAudit] currentUserData.equippedBotPet:', typeof currentUserData !== 'undefined' ? currentUserData?.equippedBotPet : undefined,
                'equippedBotPet:', equippedBotPet,
                'equippedBotPetProfile:', equippedBotPetProfile,
                'matchBotPetState:', matchBotPetState,
                'gameModeSelect:', selectedMode,
                'globalGameMode:', typeof gameMode !== 'undefined' ? gameMode : undefined,
                'isBotRoomMode:', window.isBotRoomMode,
                'roomRules:', typeof GameState !== 'undefined' ? GameState.roomRules : window.roomRules);
};

window.auditBotPetRuntimeSelection = function() {
    const selectedMode = document.getElementById('game-mode')?.value;
    const botPetProfile = (typeof getEquippedBotPetProfile === 'function') ? getEquippedBotPetProfile() : null;
    const botPetActive = (typeof isBotPetActive === 'function') ? isBotPetActive() : false;
    const useBotPetRuntime = botPetActive && botPetProfile && typeof isValidBotPetRuntimeMode === 'function' && isValidBotPetRuntimeMode(selectedMode);
    const resolvedMode = useBotPetRuntime ? botPetProfile.gameMode : selectedMode;
    console.log('[BotPetAudit] runtime selection', {
        selectedMode,
        botPetProfile,
        botPetActive,
        useBotPetRuntime,
        resolvedMode
    });
    return {
        selectedMode,
        botPetProfile,
        botPetActive,
        useBotPetRuntime,
        resolvedMode
    };
};

// ──────────────────────────────────────────────
// KIỂM TRA BOT PET CÓ ĐANG BẬT KHÔNG
// ──────────────────────────────────────────────
function isBotPetActive() {
    const hasEquipped = !!matchBotPetState.equippedBotPet;
    const validProfile = hasEquipped && typeof getEquippedBotPetProfile === 'function' ? !!getEquippedBotPetProfile() : false;
    return hasEquipped && validProfile && matchBotPetState.active;
}
window.isBotPetActive = isBotPetActive;

// ──────────────────────────────────────────────
// BẬT/TẮT BOT PET
// Không ảnh hưởng game engine, chỉ thay đổi UI
// ──────────────────────────────────────────────
function toggleBotPetActive() {
    const prev = matchBotPetState.active;
    setBotPetActive(!prev);
    if (window.DEBUG_BOT_RUNTIME) {
        console.log('[BotPetUI] toggle | active:', prev, '->', matchBotPetState.active);
    }
}
window.toggleBotPetActive = toggleBotPetActive;

// ──────────────────────────────────────────────
// BẬT/TẮT BOT PET
// ──────────────────────────────────────────────
function setBotPetActive(active) {
    if (matchBotPetState.equippedBotPet === null) {
        console.warn('[BotPetState] Cannot set active, no equipped Bot Pet');
        return;
    }

    const equippedBotPet = getBotPetById(matchBotPetState.equippedBotPet);
    if (!equippedBotPet) {
        matchBotPetState.active = false;
        matchBotPetState.visual = null;
        matchBotPetState.runtimeProfile = null;
        console.warn('[BotPetState] Equipped Bot Pet ID invalid; disabling Bot Pet');
    } else {
        matchBotPetState.active = active;
        matchBotPetState.visual = {
            id: equippedBotPet.id,
            avatar: equippedBotPet.avatar,
            name: equippedBotPet.name,
            aiProfile: equippedBotPet.aiProfile
        };
        refreshMatchBotPetRuntimeProfile();
    }

    console.log('[BotPetState] Set active:', active, 'state:', matchBotPetState);
    
    // Toggle candidates (Top-4 moves)
    if (typeof toggleCandidates === 'function') {
        toggleCandidates(active);
    }
    
    if (typeof updateBotPetUI === 'function') {
        updateBotPetUI();
    }
}
window.setBotPetActive = setBotPetActive;

// ──────────────────────────────────────────────
// CLEANUP BOT PET STATE KHI RỜI TRẬN
// ──────────────────────────────────────────────
function cleanupMatchBotPetState() {
    console.log('[BotPetState] Cleanup before:', matchBotPetState);
    matchBotPetState = {
        equippedBotPet: null,
        active: false,
        visual: null,
        runtimeProfile: null
    };
    console.log('[BotPetState] Cleanup after:', matchBotPetState);
}
window.cleanupMatchBotPetState = cleanupMatchBotPetState;

// ──────────────────────────────────────────────
// LẤY BOT PET ĐANG TRANG BỊ TRONG TRẬN
// ──────────────────────────────────────────────
function getMatchBotPet() {
    if (!matchBotPetState.equippedBotPet) return null;
    return getBotPetById(matchBotPetState.equippedBotPet);
}
window.getMatchBotPet = getMatchBotPet;
