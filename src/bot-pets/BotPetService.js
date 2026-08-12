// ══════════════════════════════════════════════════════════════════
// BOT PET SERVICE - LOGIC MUA/TRANG BỊ BOT THÚ CƯNG
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────
function _botPetGetUid() { 
    return localStorage.getItem('current_user_id'); 
}

function _botPetGetDb() { 
    return typeof db !== 'undefined' ? db : null; 
}

function _botPetGetUserData() {
    const uid = _botPetGetUid();
    if (!uid) return {};
    const database = _botPetGetDb();
    if (!database) return {};
    // Trả về currentUserData nếu có
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        return currentUserData;
    }
    // Nếu không có currentUserData, reload từ Firebase
    database.ref(`users/${uid}`).once('value').then(snap => {
        const data = snap.val();
        if (data && typeof currentUserData !== 'undefined') {
            Object.assign(currentUserData, data);
        }
    });
    return {};
}

// ──────────────────────────────────────────────
// KIỂM TRA ĐÃ SỞ HỮU BOT PET CHƯA
// ──────────────────────────────────────────────
function hasBotPet(botPetId) {
    // Kiểm tra trực tiếp từ currentUserData
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        const owned = Array.isArray(currentUserData.ownedBotPets) ? currentUserData.ownedBotPets : [];
        return owned.includes(botPetId);
    }
    console.warn('[BotPetService] hasBotPet: currentUserData unavailable, returning false until Firebase data loads');
    return false;
}
window.hasBotPet = hasBotPet;

// ──────────────────────────────────────────────
// LẤY BOT PET ĐANG TRANG BỊ
// ──────────────────────────────────────────────
function getEquippedBotPet() {
    // Ưu tiên currentUserData (đã được fetch từ Firebase)
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        const equippedId = currentUserData.equippedBotPet || null;
        if (!equippedId) {
            console.log('[BotPetService] getEquippedBotPet: no equippedBotPet in currentUserData');
            return null;
        }
        const botPet = getBotPetById(equippedId);
        console.log('[BotPetService] getEquippedBotPet from currentUserData:', botPet);
        return botPet;
    }
    
    // Fallback: khi currentUserData chưa có, không thể trả về sync result.
    // Caller nên đảm bảo currentUserData đã load trước khi dùng Bot Pet runtime.
    const uid = (typeof _botPetGetUid === 'function') ? _botPetGetUid() : null;
    const database = (typeof _botPetGetDb === 'function') ? _botPetGetDb() : null;
    if (uid && database) {
        console.warn('[BotPetService] getEquippedBotPet: currentUserData unavailable, returning null; consider waiting for Firebase listener');
    } else {
        console.warn('[BotPetService] getEquippedBotPet: no uid/db available');
    }
    return null;
}
window.getEquippedBotPet = getEquippedBotPet;

// ──────────────────────────────────────────────
// MUA BOT PET
// ──────────────────────────────────────────────
function muaBotPet(botPetId) {
    const botPet = getBotPetById(botPetId);
    if (!botPet) {
        alert('Bot Pet không tồn tại!');
        return;
    }
    
    if (hasBotPet(botPetId)) {
        alert('Bạn đã sở hữu Bot Pet này rồi!');
        return;
    }
    
    const uid = (typeof _botPetGetUid === 'function') ? _botPetGetUid() : null;
    const database = (typeof _botPetGetDb === 'function') ? _botPetGetDb() : null;
    if (!uid || !database) {
        alert('Bạn cần đăng nhập để mua Bot Pet!');
        return;
    }
    
    const price = botPet.price;
    const currentXu = typeof getMyCoins === 'function' ? getMyCoins() : 0;
    
    if (currentXu < price) {
        alert(`Bạn không đủ xu! Cần ${price.toLocaleString('vi-VN')} Xu, bạn có ${currentXu.toLocaleString('vi-VN')} Xu.`);
        return;
    }
    
    if (!confirm(`Mua "${botPet.name}" với giá ${price.toLocaleString('vi-VN')} Xu?`)) {
        return;
    }
    
    // Transaction Firebase để trừ xu và thêm bot pet
    const userRef = database.ref(`users/${uid}`);
    userRef.transaction((currentData) => {
        if (!currentData) return null;
        
        // Kiểm tra lại ownership trong transaction để tránh double purchase
        const owned = Array.isArray(currentData.ownedBotPets) ? currentData.ownedBotPets : [];
        if (owned.includes(botPetId)) {
            return; // Abort nếu đã sở hữu
        }
        
        const currentCoins = Number(currentData.coins || 0);
        if (currentCoins < price) {
            return; // Abort nếu không đủ xu
        }
        
        return Object.assign({}, currentData, {
            coins: currentCoins - price,
            ownedBotPets: owned.concat(botPetId)
        });
    }, (error, committed, snapshot) => {
        if (error) {
            alert('Lỗi khi mua Bot Pet: ' + error.message);
        } else if (!committed) {
            alert('Không đủ xu hoặc bạn đã sở hữu Bot Pet này!');
        } else {
            const newData = snapshot.val();
            if (typeof currentUserData !== 'undefined') {
                currentUserData.coins = newData.coins;
                currentUserData.ownedBotPets = newData.ownedBotPets || [];
            }
            if (typeof updateCoinDisplay === 'function') updateCoinDisplay();
            if (typeof showXuPopup === 'function') {
                showXuPopup(-price, `Mua ${botPet.name} ${botPet.avatar}`);
            }
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: `🛍️ Mua thành công "${botPet.name}"!` });
            }
            alert(`Đã mua "${botPet.name}" thành công!`);
            // Render UI trực tiếp với dữ liệu mới
            if (typeof renderShopBotPet === 'function') renderShopBotPet();
        }
    });
}
window.muaBotPet = muaBotPet;

// ──────────────────────────────────────────────
// TRANG BỊ BOT PET
// ──────────────────────────────────────────────
function trangBiBotPet(botPetId) {
    if (!hasBotPet(botPetId)) {
        alert('Bạn chưa sở hữu Bot Pet này!');
        return;
    }
    
    const uid = (typeof _botPetGetUid === 'function') ? _botPetGetUid() : null;
    const database = (typeof _botPetGetDb === 'function') ? _botPetGetDb() : null;
    if (!uid || !database) {
        alert('Bạn cần đăng nhập để trang bị Bot Pet!');
        return;
    }
    
    const botPet = getBotPetById(botPetId);
    
    const userRef = database.ref(`users/${uid}`);
    userRef.update({
        equippedBotPet: botPetId
    }, (error) => {
        if (error) {
            alert('Lỗi khi trang bị Bot Pet: ' + error.message);
        } else {
            if (typeof currentUserData !== 'undefined') {
                currentUserData.equippedBotPet = botPetId;
            }
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: `✅ Đã trang bị "${botPet.name}" ${botPet.avatar}` });
            }
            alert('Đã trang bị Bot Pet thành công!');
            // Render UI trực tiếp
            if (typeof renderShopBotPet === 'function') renderShopBotPet();
        }
    });
}
window.trangBiBotPet = trangBiBotPet;

function boTrangBiBotPet() {
    const uid = (typeof _botPetGetUid === 'function') ? _botPetGetUid() : null;
    const database = (typeof _botPetGetDb === 'function') ? _botPetGetDb() : null;
    if (!uid || !database) {
        alert('Bạn cần đăng nhập để gỡ Bot Pet!');
        return;
    }

    if (typeof currentUserData !== 'undefined' && currentUserData) {
        currentUserData.equippedBotPet = null;
    }

    database.ref(`users/${uid}/equippedBotPet`).set(null, (error) => {
        if (error) {
            alert('Lỗi khi gỡ Bot Pet: ' + error.message);
            return;
        }

        if (typeof matchBotPetState !== 'undefined') {
            matchBotPetState.active = false;
            matchBotPetState.visual = null;
            matchBotPetState.runtimeProfile = null;
        }

        if (typeof updateBotPetUI === 'function') updateBotPetUI();
        if (typeof renderShopBotPet === 'function') renderShopBotPet();
        alert('Đã gỡ trang bị Bot Pet thành công!');
    });
}
window.boTrangBiBotPet = boTrangBiBotPet;

// ──────────────────────────────────────────────
// KHỞI TẠO: Đảm bảo ownedBotPets tồn tại
// ──────────────────────────────────────────────
function initBotPetSystem(uid) {
    const database = _botPetGetDb();
    if (!uid || !database) return;
    database.ref(`users/${uid}/ownedBotPets`).once('value').then(snap => {
        const owned = snap.val();
        if (!Array.isArray(owned)) {
            database.ref(`users/${uid}/ownedBotPets`).set([]);
        }
    });
    database.ref(`users/${uid}/equippedBotPet`).once('value').then(snap => {
        if (snap.val() === undefined) {
            database.ref(`users/${uid}/equippedBotPet`).set(null);
        }
    });
}
window.initBotPetSystem = initBotPetSystem;

// ──────────────────────────────────────────────
// VALIDATE EQUIPPED BOT PET
// ──────────────────────────────────────────────
function validateEquippedBotPet() {
    const userData = (typeof _botPetGetUserData === 'function') ? _botPetGetUserData() : {};
    const equippedId = userData.equippedBotPet;
    const owned = Array.isArray(userData.ownedBotPets) ? userData.ownedBotPets : [];
    
    // Nếu equipped bot không nằm trong owned, tự động bỏ trang bị
    if (equippedId && !owned.includes(equippedId)) {
        const uid = _botPetGetUid();
        const database = _botPetGetDb();
        if (uid && database) {
            database.ref(`users/${uid}/equippedBotPet`).set(null);
            if (typeof currentUserData !== 'undefined') {
                currentUserData.equippedBotPet = null;
            }
            console.warn('[BotPet] Invalid equipped bot pet removed:', equippedId);
        }
    }
}
window.validateEquippedBotPet = validateEquippedBotPet;
