// ══════════════════════════════════════════════════════════════════
// BOT PET STATE - QUẢN LÝ TRẠNG THÁI BOT PET TRONG TRẬN
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// MATCH BOT PET STATE
// State riêng cho mỗi trận, không lưu vào Firebase
// ──────────────────────────────────────────────
let matchBotPetState = {
    equippedBotPet: null,
    active: false,
    runtimeProfile: null
};

// ──────────────────────────────────────────────
// KHỞI TẠO BOT PET STATE KHI VÀO TRẬN
// ──────────────────────────────────────────────
function initMatchBotPetState() {
    const equippedBotPet = getEquippedBotPet();
    const runtimeProfile = equippedBotPet ? getBotPetRuntimeProfile(equippedBotPet.id) : null;
    matchBotPetState = {
        equippedBotPet: equippedBotPet ? equippedBotPet.id : null,
        active: true, // Mặc định bật khi vào trận
        runtimeProfile
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
    return matchBotPetState.active && matchBotPetState.equippedBotPet !== null;
}
window.isBotPetActive = isBotPetActive;

// ──────────────────────────────────────────────
// BẬT/TẮT BOT PET
// Không ảnh hưởng game engine, chỉ thay đổi UI
// ──────────────────────────────────────────────
function toggleBotPetActive() {
    if (matchBotPetState.equippedBotPet === null) {
        alert('Bạn chưa trang bị Bot Pet!');
        return;
    }
    
    matchBotPetState.active = !matchBotPetState.active;
    console.log('[BotPetState] Toggled:', matchBotPetState.active);
    
    // Update UI
    if (typeof updateBotPetUI === 'function') {
        updateBotPetUI();
    }
}
window.toggleBotPetActive = toggleBotPetActive;

// ──────────────────────────────────────────────
// BẬT BOT PET
// ──────────────────────────────────────────────
function setBotPetActive(active) {
    if (matchBotPetState.equippedBotPet === null) {
        return;
    }
    
    matchBotPetState.active = active;
    console.log('[BotPetState] Set active:', active);
    
    // Update UI
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
