// ══════════════════════════════════════════════════════════════════
// BOT PET INTEGRATION - HOOK INTO MATCH FLOW
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// PATCH PRACTICE MODE START
// ──────────────────────────────────────────────
function _patchPracticeMode() {
    const waitFn = setInterval(() => {
        if (typeof PracticeMode !== 'undefined' && PracticeMode.startWithBot) {
            clearInterval(waitFn);
            const _origStart = PracticeMode.startWithBot;
            PracticeMode.startWithBot = function(...args) {
                const result = _origStart.apply(this, args);
                // Show Bot Pet companion after a short delay
                setTimeout(() => {
                    if (typeof showBotPetCompanion === 'function') {
                        showBotPetCompanion();
                    }
                }, 500);
                return result;
            };
            console.log('[BotPet] PracticeMode.startWithBot patched');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH ONLINE ROOM START (chuPhongBatDauGame)
// ──────────────────────────────────────────────
function _patchOnlineRoomStart() {
    const waitFn = setInterval(() => {
        if (typeof chuPhongBatDauGame === 'function') {
            clearInterval(waitFn);
            const _origStart = window.chuPhongBatDauGame;
            window.chuPhongBatDauGame = function(...args) {
                const result = _origStart.apply(this, args);
                // Show Bot Pet companion after a short delay
                setTimeout(() => {
                    if (typeof showBotPetCompanion === 'function') {
                        showBotPetCompanion();
                    }
                }, 500);
                return result;
            };
            console.log('[BotPet] chuPhongBatDauGame patched');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH BOT ROOM START
// ──────────────────────────────────────────────
function _patchBotRoom() {
    const waitFn = setInterval(() => {
        if (typeof BotRoomManager !== 'undefined' && BotRoomManager.startBotRoom) {
            clearInterval(waitFn);
            const _origStart = BotRoomManager.startBotRoom;
            BotRoomManager.startBotRoom = function(...args) {
                const result = _origStart.apply(this, args);
                // Show Bot Pet companion after a short delay
                setTimeout(() => {
                    if (typeof showBotPetCompanion === 'function') {
                        showBotPetCompanion();
                    }
                }, 500);
                return result;
            };
            console.log('[BotPet] BotRoomManager.startBotRoom patched');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH MATCH EXIT/END
// ──────────────────────────────────────────────
function _patchMatchExit() {
    // Patch PracticeMode.exit
    const waitFn1 = setInterval(() => {
        if (typeof PracticeMode !== 'undefined' && PracticeMode.exit) {
            clearInterval(waitFn1);
            const _origExit = PracticeMode.exit;
            PracticeMode.exit = function(...args) {
                if (typeof hideBotPetCompanion === 'function') {
                    hideBotPetCompanion();
                }
                return _origExit.apply(this, args);
            };
            console.log('[BotPet] PracticeMode.exit patched');
        }
    }, 300);

    // Patch xuLyThoatPhong (online room exit)
    const waitFn2 = setInterval(() => {
        if (typeof xuLyThoatPhong === 'function') {
            clearInterval(waitFn2);
            const _origExit = window.xuLyThoatPhong;
            window.xuLyThoatPhong = function(...args) {
                if (typeof hideBotPetCompanion === 'function') {
                    hideBotPetCompanion();
                }
                return _origExit.apply(this, args);
            };
            console.log('[BotPet] xuLyThoatPhong patched');
        }
    }, 300);

    // Patch BotRoomManager.exitBotRoom
    const waitFn3 = setInterval(() => {
        if (typeof BotRoomManager !== 'undefined' && BotRoomManager.exitBotRoom) {
            clearInterval(waitFn3);
            const _origExit = BotRoomManager.exitBotRoom;
            BotRoomManager.exitBotRoom = function(...args) {
                if (typeof hideBotPetCompanion === 'function') {
                    hideBotPetCompanion();
                }
                return _origExit.apply(this, args);
            };
            console.log('[BotPet] BotRoomManager.exitBotRoom patched');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// INITIALIZE ALL PATCHES
// ──────────────────────────────────────────────
window.addEventListener('load', () => {
    setTimeout(() => {
        _patchPracticeMode();
        _patchOnlineRoomStart();
        _patchBotRoom();
        _patchMatchExit();
    }, 1000);
});

console.log('[BotPet] Integration loaded');
