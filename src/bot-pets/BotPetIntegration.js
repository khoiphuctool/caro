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
            // console.log('[BotPet] PracticeMode.startWithBot patched');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH ONLINE ROOM START
// Hook vào batDauGiaoDienOnline (hàm chính khi vào trận online)
// Gọi mountOnlineBotPets() — KHÔNG gọi showBotPetCompanion() (offline only)
// ──────────────────────────────────────────────
function _patchOnlineRoomStart() {
    const waitFn = setInterval(() => {
        if (typeof batDauGiaoDienOnline === 'function') {
            clearInterval(waitFn);
            const _origStart = window.batDauGiaoDienOnline;
            window.batDauGiaoDienOnline = function(...args) {
                const result = _origStart.apply(this, args);
                // Mount Online Pet compact UI sau khi battle view sẵn sàng
                // KHÔNG gọi showBotPetCompanion (offline), KHÔNG đổi gameMode/AI
                setTimeout(() => {
                    if (typeof mountOnlineBotPets === 'function') {
                        mountOnlineBotPets();
                    }
                }, 600);
                return result;
            };
            // console.log('[BotPet] batDauGiaoDienOnline patched for Online Pet UI');
        }
    }, 300);

    // Cũng patch chuPhongBatDauGame nếu tồn tại (host start game)
    const waitFn2 = setInterval(() => {
        if (typeof chuPhongBatDauGame === 'function') {
            clearInterval(waitFn2);
            const _origStart = window.chuPhongBatDauGame;
            window.chuPhongBatDauGame = function(...args) {
                const result = _origStart.apply(this, args);
                setTimeout(() => {
                    if (typeof mountOnlineBotPets === 'function') {
                        mountOnlineBotPets();
                    }
                }, 600);
                return result;
            };
            // console.log('[BotPet] chuPhongBatDauGame patched for Online Pet UI');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH BOT ROOM START
// ──────────────────────────────────────────────
function _patchBotRoom() {
    const waitFn = setInterval(() => {
        if (typeof BotRoomManager !== 'undefined' && BotRoomManager.startBotBattle) {
            clearInterval(waitFn);
            const _origStart = BotRoomManager.startBotBattle;
            BotRoomManager.startBotBattle = function(...args) {
                const result = _origStart.apply(this, args);
                // Show Bot Pet companion after battle view is rendered
                setTimeout(() => {
                    if (typeof showBotPetCompanion === 'function') {
                        showBotPetCompanion();
                    }
                }, 500);
                return result;
            };
            // console.log('[BotPet] BotRoomManager.startBotBattle patched');
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
            // console.log('[BotPet] PracticeMode.exit patched');
        }
    }, 300);

    // Patch xuLyThoatPhong (online room exit)
    const waitFn2 = setInterval(() => {
        if (typeof xuLyThoatPhong === 'function') {
            clearInterval(waitFn2);
            const _origExit = window.xuLyThoatPhong;
            window.xuLyThoatPhong = function(...args) {
                // Cleanup Online Pet UI khi rời phòng online
                if (typeof unmountOnlineBotPets === 'function') {
                    unmountOnlineBotPets();
                }
                if (typeof hideBotPetCompanion === 'function') {
                    hideBotPetCompanion();
                }
                return _origExit.apply(this, args);
            };
            // console.log('[BotPet] xuLyThoatPhong patched');
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
            // console.log('[BotPet] BotRoomManager.exitBotRoom patched');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH loadPlayerInfo (online room)
// Sau khi load user info, cũng load equippedBotPet
// và gọi setOpponentOnlinePet để render compact pet
// Không ảnh hưởng gameplay — chỉ visual companion
// ──────────────────────────────────────────────
function _patchLoadPlayerInfo() {
    const waitFn = setInterval(() => {
        if (typeof loadPlayerInfo === 'function') {
            clearInterval(waitFn);
            const _orig = window.loadPlayerInfo;
            window.loadPlayerInfo = function(userId, role, ...rest) {
                const result = _orig.call(this, userId, role, ...rest);
                setTimeout(() => {
                    const currentMode = typeof GameModeManager !== 'undefined' && typeof GameModeManager.getCurrentMode === 'function'
                        ? GameModeManager.getCurrentMode()
                        : null;
                    const isOnline = currentMode === 'online' || (typeof GameModes !== 'undefined' && currentMode === GameModes.ONLINE);
                    if (!isOnline) return;

                    const database = (typeof _botPetGetDb === 'function') ? _botPetGetDb() : (typeof db !== 'undefined' ? db : null);
                    if (!database || !userId) return;

                    database.ref(`users/${userId}/equippedBotPet`).once('value').then(snap => {
                        const petId = snap.val() || null;
                        if (typeof setOpponentOnlinePet === 'function') {
                            setOpponentOnlinePet(role, petId);
                        }
                    }).catch(() => {});
                }, 200);
                return result;
            };
            // console.log('[BotPet] loadPlayerInfo patched for Online Pet UI');
        }
    }, 500);
}

// ──────────────────────────────────────────────
// PATCH makeAIMove — BUG 1 FIX
// Sau khi bot đặt quân xong (isBotMove = false),
// trigger refreshBotPetCandidatesForCurrentTurn() để
// regenerate TOP-4 cho human turn.
// Không tính TOP-4 trong lúc bot đang suy nghĩ.
// ──────────────────────────────────────────────
function _patchMakeAIMove() {
    const waitFn = setInterval(() => {
        if (typeof makeAIMove === 'function') {
            clearInterval(waitFn);
            const _orig = window.makeAIMove;
            window.makeAIMove = function(...args) {
                const result = _orig.apply(this, args);
                // Sau khi makeAIMove xong: isBotMove đã được set về false,
                // currentPlayer đã flip sang humanPiece.
                // Dùng setTimeout(0) để đảm bảo tất cả synchronous state đã settle.
                setTimeout(() => {
                    if (typeof refreshBotPetCandidatesForCurrentTurn === 'function') {
                        refreshBotPetCandidatesForCurrentTurn();
                    }
                }, 0);
                return result;
            };
            // console.log('[BotPet] makeAIMove patched for post-bot TOP-4 refresh');
        }
    }, 300);
}

// ──────────────────────────────────────────────
// PATCH PositionEditor.placePiece — BUG 2 FIX
// Sau khi Position Editor thay đổi board,
// trigger refreshBotPetCandidatesForCurrentTurn().
// ──────────────────────────────────────────────
function _patchPositionEditor() {
    const waitFn = setInterval(() => {
        if (typeof PositionEditor !== 'undefined' && PositionEditor.placePiece) {
            clearInterval(waitFn);
            const _origPlace = PositionEditor.placePiece;
            PositionEditor.placePiece = function(...args) {
                const result = _origPlace.apply(this, args);
                // Board đã thay đổi — refresh candidates theo turn hiện tại
                setTimeout(() => {
                    if (typeof refreshBotPetCandidatesForCurrentTurn === 'function') {
                        refreshBotPetCandidatesForCurrentTurn();
                    }
                }, 0);
                return result;
            };
            // Cũng patch undo/redo/clear vì chúng đều thay đổi board
            ['undo', 'redo', 'clear'].forEach(method => {
                if (typeof PositionEditor[method] === 'function') {
                    const _origMethod = PositionEditor[method];
                    PositionEditor[method] = function(...args) {
                        const result = _origMethod.apply(this, args);
                        setTimeout(() => {
                            if (typeof refreshBotPetCandidatesForCurrentTurn === 'function') {
                                refreshBotPetCandidatesForCurrentTurn();
                            }
                        }, 0);
                        return result;
                    };
                }
            });
            // console.log('[BotPet] PositionEditor.placePiece/undo/redo/clear patched for TOP-4 refresh');
        }
    }, 500);
}
window.addEventListener('load', () => {
    setTimeout(() => {
        _patchPracticeMode();
        _patchOnlineRoomStart();
        _patchBotRoom();
        _patchMatchExit();
        _patchLoadPlayerInfo();
        _patchMakeAIMove();
        _patchPositionEditor();
    }, 1000);
});

// console.log('[BotPet] Integration loaded');
