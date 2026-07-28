// ══════════════════════════════════════════════════════════════════
// HỆ THỐNG XU, NHIỆM VỤ, SHOP AVATAR, CƯỢC, BXH ĐẠI GIA
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// CẤU HÌNH
// ──────────────────────────────────────────────
const XU_CONFIG = {
    WELCOME_BONUS: 40000,
    DAILY_CHECKIN: 5000,
    AVATAR_PRICE: 3000,
    BOT_REWARD: { easy: 700, medium: 900, hard: 1200, god: 2000, lightning: 2000 },
    BOT_DAILY_LIMIT: { easy: 10, medium: 12, hard: 10, god: 10, lightning: 10 },
    BOT_BONUS_REWARD: { easy: 10000, medium: 15000, hard: 20000, god: 30000, lightning: 25000 }, // Thưởng khi đạt max limit
    SOLO_WIN_REWARD: 200,      // Thưởng thắng PvP Solo Online
    SOLO_WIN_DAILY_LIMIT: 20,  // Tối đa 20 trận/ngày
    BET_MIN: 100,
    BET_MAX: 5000,
    VIP_BET_MIN: 10000,        // Mức cược tối thiểu cho phòng VIP
    VIP_BET_MAX: 50000         // Mức cược tối đa cho phòng VIP
};

// Map độ khó game-mode → key difficulty
const DIFF_KEY = {
    'ai-easy': 'easy',
    'ai-medium': 'medium',
    'ai-hard': 'hard',
    'ai-god': 'god',
    'bot-tia-chop': 'lightning'
};

// ──────────────────────────────────────────────
// HELPER: lấy userId, db
// ──────────────────────────────────────────────
function _getUid() { return localStorage.getItem('current_user_id'); }
function _getDb()  { return typeof db !== 'undefined' ? db : null; }

// ──────────────────────────────────────────────
// LẤY SỐ DƯ XU (realtime từ currentUserData)
// ──────────────────────────────────────────────
function getMyCoins() {
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        return currentUserData.coins || 0;
    }
    return 0;
}

// Cập nhật số xu hiển thị trên header
function updateCoinDisplay(coins) {
    const el = document.getElementById('xu-balance');
    if (el) el.textContent = (typeof coins === 'number' ? coins : getMyCoins()).toLocaleString('vi-VN') + ' Xu';
}

// Cộng / trừ xu trực tiếp Firebase
function addCoins(amount, reason) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database || amount === 0) return Promise.resolve(false);
    return database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + amount)
        .then(res => {
            if (res.committed) {
                showXuPopup(amount, reason || (amount > 0 ? 'Nhận xu' : 'Trừ xu'));
                if (typeof addNotification === 'function') {
                    const sign = amount > 0 ? '+' : '';
                    addNotification('win', `💰 ${sign}${amount.toLocaleString('vi-VN')} Xu (${reason})`);
                }
            }
            return res.committed;
        });
}
window.addCoins = addCoins;

// ──────────────────────────────────────────────
// WELCOME BONUS (Quà Chào Mừng)
// ──────────────────────────────────────────────
function checkAndGrantWelcomeBonus(uid) {
    const database = _getDb();
    if (!uid || !database) return;
    database.ref(`users/${uid}/claimedWelcome`).once('value').then(snap => {
        if (snap.val()) return;
        database.ref(`users/${uid}/claimedWelcome`).set(true);
        database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + XU_CONFIG.WELCOME_BONUS)
            .then(res => {
                if (!res.committed) return;
                showXuPopup(XU_CONFIG.WELCOME_BONUS, 'Quà chào mừng 🎁');
                renderNhiemVuTab();
                if (typeof addNotification === 'function') {
                    addNotification('win', `🎉 Chào mừng! Bạn nhận được ${XU_CONFIG.WELCOME_BONUS} Xu quà chào mừng!`);
                }
            });
    });
}
window.checkAndGrantWelcomeBonus = checkAndGrantWelcomeBonus;

// Nút nhận quà chào mừng thủ công (nếu chưa nhận)
function nhanQuaChaoMung() {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) { alert('Bạn cần đăng nhập!'); return; }
    database.ref(`users/${uid}/claimedWelcome`).once('value').then(snap => {
        if (snap.val()) {
            alert('Bạn đã nhận quà chào mừng rồi!');
            return;
        }
        database.ref(`users/${uid}/claimedWelcome`).set(true);
        database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + XU_CONFIG.WELCOME_BONUS)
            .then(() => {
                alert(`🎉 Nhận thành công ${XU_CONFIG.WELCOME_BONUS} Xu Quà Chào Mừng!`);
                showXuPopup(XU_CONFIG.WELCOME_BONUS, 'Quà chào mừng 🎁');
                renderNhiemVuTab();
            });
    });
}
window.nhanQuaChaoMung = nhanQuaChaoMung;

// ──────────────────────────────────────────────
// ĐIỂM DANH HÀNG NGÀY
// ──────────────────────────────────────────────
function getTodayStr() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function diemDanh() {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) { alert('Bạn cần đăng nhập để điểm danh!'); return; }
    const today = getTodayStr();
    database.ref(`users/${uid}/lastCheckin`).once('value').then(snap => {
        if (snap.val() === today) {
            alert('Bạn đã điểm danh hôm nay rồi! Quay lại vào ngày mai nhé 😊');
            return;
        }
        database.ref(`users/${uid}/lastCheckin`).set(today);
        database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + XU_CONFIG.DAILY_CHECKIN)
            .then(() => {
                alert(`✅ Điểm danh thành công! +${XU_CONFIG.DAILY_CHECKIN} Xu`);
                showXuPopup(XU_CONFIG.DAILY_CHECKIN, 'Điểm danh 📅');
                renderNhiemVuTab();
                if (typeof addNotification === 'function') {
                    addNotification('win', `✅ Điểm danh +${XU_CONFIG.DAILY_CHECKIN} Xu`);
                }
            });
    });
}
window.diemDanh = diemDanh;

function isDiemDanhHomNay() {
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        return currentUserData.lastCheckin === getTodayStr();
    }
    return false;
}

// ──────────────────────────────────────────────
// GIỚI HẠN CÀY XU BOT HÀNG NGÀY
// ──────────────────────────────────────────────
function getBotLimits() {
    const database = _getDb();
    const uid = _getUid();
    if (!uid || !database) return Promise.resolve(null);
    return database.ref(`users/${uid}/botDailyLimits`).once('value').then(snap => snap.val());
}

function resetBotLimitsIfNeeded(limitsRef) {
    const today = getTodayStr();
    return limitsRef.once('value').then(snap => {
        const data = snap.val();
        if (!data || data.lastResetDate !== today) {
            return limitsRef.set({
                lastResetDate: today,
                easy: 0, medium: 0, hard: 0, god: 0, lightning: 0
            });
        }
    });
}

// Gọi sau khi người chơi thắng bot — trả về số xu thưởng (0 nếu hết lượt)
function processWinBot(modeDiff) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) return Promise.resolve(0);

    const limitKey = modeDiff; // 'easy'|'medium'|'hard'|'god'|'lightning'
    const maxAllowed = XU_CONFIG.BOT_DAILY_LIMIT[limitKey] || 5;
    const reward = XU_CONFIG.BOT_REWARD[limitKey] || 300;
    const bonusReward = XU_CONFIG.BOT_BONUS_REWARD[limitKey] || 0;

    const limitsRef = database.ref(`users/${uid}/botDailyLimits`);
    return resetBotLimitsIfNeeded(limitsRef).then(() => {
        // Đọc giá trị hiện tại trước
        return limitsRef.child(limitKey).once('value').then(snap => {
            const used = snap.val() || 0;
            if (used >= maxAllowed) return 0; // hết lượt

            // Tăng counter bằng transaction để tránh race condition
            return limitsRef.child(limitKey).transaction(cur => {
                const c = cur || 0;
                if (c >= maxAllowed) return c; // vẫn check lại trong transaction
                return c + 1;
            }).then(res => {
                if (!res.committed) return 0;
                const newUsed = res.snapshot.val() || 0;
                // Nếu transaction thực sự tăng (newUsed = used+1) → cộng xu
                if (newUsed !== used + 1) return 0;

                // Nếu đạt max limit, cộng thêm bonus
                const totalReward = (newUsed === maxAllowed) ? (reward + bonusReward) : reward;
                return database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + totalReward)
                    .then(coinsRes => {
                        if (coinsRes.committed) {
                            if (newUsed === maxAllowed && bonusReward > 0) {
                                showXuPopup(bonusReward, `🎉 Hoàn thành ${maxAllowed} trận!`);
                                if (typeof addNotification === 'function') {
                                    addNotification('win', `🎉 Chúc mừng! Hoàn thành ${maxAllowed} trận, thưởng thêm ${bonusReward} Xu!`);
                                }
                            }
                            return totalReward;
                        }
                        return 0;
                    });
            });
        });
    });
}
window.processWinBot = processWinBot;

// Lấy trạng thái giới hạn để hiển thị UI
function getBotLimitStatus(cb) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) { cb(null); return; }
    const limitsRef = database.ref(`users/${uid}/botDailyLimits`);
    resetBotLimitsIfNeeded(limitsRef).then(() => {
        limitsRef.once('value').then(snap => cb(snap.val()));
    });
}
window.getBotLimitStatus = getBotLimitStatus;

// ──────────────────────────────────────────────
// SHOP AVATAR — dùng SHOP_AVATAR_LIST từ firebase-online.js
// ──────────────────────────────────────────────

function moShopAvatar() {
    document.getElementById('shop-avatar-modal').style.display = 'flex';
    renderShopAvatar();
}
window.moShopAvatar = moShopAvatar;

function dongShopAvatar() {
    document.getElementById('shop-avatar-modal').style.display = 'none';
}
window.dongShopAvatar = dongShopAvatar;

function renderShopAvatar() {
    const grid = document.getElementById('shop-avatar-grid');
    if (!grid) return;
    const owned = (typeof currentUserData !== 'undefined' && currentUserData && currentUserData.ownedAvatars) ? currentUserData.ownedAvatars : ['av_01'];
    const equipped = (typeof currentUserData !== 'undefined' && currentUserData) ? currentUserData.equippedAvatar : null;
    const coins = getMyCoins();
    document.getElementById('shop-xu-display').textContent = coins.toLocaleString('vi-VN') + ' Xu';

    grid.innerHTML = SHOP_AVATAR_LIST.map(av => {
        const isOwned = av.free || owned.includes(av.id);
        const isEquipped = equipped === av.id;
        let btn = '';
        if (isEquipped) {
            btn = `<button class="av-btn av-equipped" disabled>✅ Đang dùng</button>`;
        } else if (isOwned) {
            btn = `<button class="av-btn av-use" onclick="equipAvatar('${av.id}')">Sử dụng</button>`;
        } else {
            btn = `<button class="av-btn av-buy" onclick="buyAvatar('${av.id}')">Mua (${XU_CONFIG.AVATAR_PRICE.toLocaleString('vi-VN')} Xu)</button>`;
        }
        return `<div class="av-card ${isEquipped ? 'av-card-equipped' : ''}">
            <div class="av-emoji">${av.emoji}</div>
            <div class="av-name">${av.name}</div>
            ${!isOwned ? `<div class="av-lock">🔒</div>` : ''}
            ${btn}
        </div>`;
    }).join('');
}

function buyAvatar(avatarId) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) { alert('Bạn cần đăng nhập!'); return; }
    const coins = getMyCoins();
    if (coins < XU_CONFIG.AVATAR_PRICE) {
        alert(`Không đủ Xu! Bạn cần ${XU_CONFIG.AVATAR_PRICE} Xu, hiện có ${coins} Xu.`);
        return;
    }
    const av = SHOP_AVATAR_LIST.find(a => a.id === avatarId);
    if (!av) return;
    const userRef = database.ref(`users/${uid}`);
    userRef.once('value').then(snap => {
        const data = snap.val();
        const owned = data.ownedAvatars || ['av_01'];
        if (owned.includes(avatarId)) { alert('Bạn đã sở hữu avatar này!'); return; }
        // Trừ xu bằng transaction (atomic) trước, rồi mới thêm avatar
        database.ref(`users/${uid}/coins`).transaction(cur => {
            const c = cur || 0;
            if (c < XU_CONFIG.AVATAR_PRICE) return; // abort nếu không đủ xu
            return c - XU_CONFIG.AVATAR_PRICE;
        }).then(res => {
            if (!res.committed) {
                alert('Không đủ Xu hoặc có lỗi xảy ra!');
                return;
            }
            const newOwned = [...owned, avatarId];
            return userRef.update({ ownedAvatars: newOwned }).then(() => {
                showXuPopup(-XU_CONFIG.AVATAR_PRICE, `Mua avatar ${av.emoji}`);
                if (typeof addNotification === 'function') {
                    addNotification('win', `🛍️ Mua thành công avatar ${av.emoji} ${av.name}!`);
                }
                renderShopAvatar();
            });
        });
    });
}
window.buyAvatar = buyAvatar;

function equipAvatar(avatarId) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) return;
    const av = SHOP_AVATAR_LIST.find(a => a.id === avatarId);
    if (!av) return;
    database.ref(`users/${uid}/equippedAvatar`).set(avatarId).then(() => {
        renderShopAvatar();
    });
}
window.equipAvatar = equipAvatar;

// ──────────────────────────────────────────────
// HỆ THỐNG CƯỢC PVP ONLINE
// ──────────────────────────────────────────────
let currentBetAmount = 0;
// Guard để tránh hiển thị popup cược nhiều lần trên cùng client
let _lastProcessedBetRoom = '';
let _lastProcessedBetTime = 0;

// Đặt/hủy cược mới — ghi betAmount lên Firebase, reset guestReady
function datCuocMoi(amount) {
    const database = _getDb();
    const roomId   = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    if (!database || !roomId) return Promise.resolve(false);
    amount = parseInt(amount) || 0;

    // Kiểm tra room có phải VIP không để dùng giới hạn cược phù hợp
    return database.ref(`rooms/${roomId}/isVip`).once('value').then(snap => {
        const isVip = snap.val() === true;
        
        // Phòng VIP bắt buộc phải cược, không cho phép hủy cược (amount=0)
        if (amount === 0) {
            if (isVip) {
                alert('❌ Phòng VIP bắt buộc phải cược! Không thể hủy cược.');
                return Promise.resolve(false);
            }
            // Hủy cược cho phòng thường
            return database.ref(`rooms/${roomId}`).update({
                betAmount:  null,
                guestReady: false,
                playerXConfirmed: null,
                playerOConfirmed: null
            }).then(() => {
                currentBetAmount = 0;
                return true;
            });
        }

        const minBet = isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        const maxBet = isVip ? XU_CONFIG.VIP_BET_MAX : XU_CONFIG.BET_MAX;
        
        if (amount < minBet || amount > maxBet) {
            alert(`Mức cược phải từ ${minBet.toLocaleString('vi-VN')} đến ${maxBet.toLocaleString('vi-VN')} Xu!`);
            return Promise.resolve(false);
        }

        return database.ref(`rooms/${roomId}`).update({
            betAmount:  amount,
            guestReady: false,
            playerXConfirmed: null,
            playerOConfirmed: null
        }).then(() => {
            currentBetAmount = amount;
            thongBaoHeThong(`💰 Đã đặt cược ${amount.toLocaleString('vi-VN')} Xu — khách cần xác nhận lại!`);
            return true;
        });
    });
}
window.datCuocMoi = datCuocMoi;

// Khách O bấm SẴN SÀNG (đồng ý cược hoặc chỉ sẵn sàng)
function oSanSang() {
    const database = _getDb();
    const roomId   = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    if (!database || !roomId) return;

    // Kiểm tra xem có cược không
    database.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) return;

        const minBetCheck = room.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        const hasBet = room.betAmount && room.betAmount >= minBetCheck;

        if (hasBet) {
            // Có cược → yêu cầu xác nhận
            const dongY = confirm(`🎰 Chủ phòng cược ${room.betAmount.toLocaleString('vi-VN')} Xu\n\nBạn có đồng ý cược này không?\n\nBấm OK để đồng ý, Cancel để từ chối.`);
            if (!dongY) {
                thongBaoHeThong('❌ Bạn đã từ chối cược — hãy yêu cầu chủ phòng thay đổi cược!');
                return;
            }
            // Đồng ý cược → set cả guestReady và playerOConfirmed
            database.ref(`rooms/${roomId}`).update({
                guestReady: true,
                playerOConfirmed: true,
                updatedAt: Date.now()
            });
        } else {
            // Không có cược → chỉ cần guestReady
            database.ref(`rooms/${roomId}`).update({
                guestReady: true,
                updatedAt: Date.now()
            });
        }

        // Cập nhật UI
        const btnReady  = document.getElementById('btn-guest-ready');
        const btnCancel = document.getElementById('btn-guest-cancel-ready');
        const msgEl     = document.getElementById('guest-ready-msg');
        if (btnReady)  btnReady.style.display  = 'none';
        if (btnCancel) btnCancel.style.display = 'inline-block';
        if (msgEl)   { msgEl.style.display = 'block'; msgEl.textContent = '✅ Bạn đã sẵn sàng! Chờ chủ phòng bắt đầu...'; }

        if (typeof thongBaoHeThong === 'function') thongBaoHeThong('✅ Đã sẵn sàng — chờ chủ phòng...');
    });
}
window.oSanSang = oSanSang;

// Khách O hủy sẵn sàng
function oHuySanSang() {
    const database = _getDb();
    const roomId   = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    if (!database || !roomId) return;

    database.ref(`rooms/${roomId}`).update({
        guestReady: false,
        playerOConfirmed: null,
        updatedAt: Date.now()
    });

    const btnReady  = document.getElementById('btn-guest-ready');
    const btnCancel = document.getElementById('btn-guest-cancel-ready');
    const msgEl     = document.getElementById('guest-ready-msg');
    if (btnReady)  btnReady.style.display  = 'inline-block';
    if (btnCancel) btnCancel.style.display = 'none';
    if (msgEl)     msgEl.style.display     = 'none';
}
window.oHuySanSang = oHuySanSang;

function thietLapCuoc(roomId, betAmount) {
    const database = _getDb();
    if (!database) return Promise.resolve(false);
    betAmount = parseInt(betAmount);
    
    // Kiểm tra room có phải VIP không để dùng giới hạn cược phù hợp
    return database.ref(`rooms/${roomId}/isVip`).once('value').then(snap => {
        const isVip = snap.val() === true;
        const minBet = isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        const maxBet = isVip ? XU_CONFIG.VIP_BET_MAX : XU_CONFIG.BET_MAX;
        
        if (isNaN(betAmount) || betAmount < minBet || betAmount > maxBet) {
            alert(`Mức cược phải từ ${minBet.toLocaleString('vi-VN')} đến ${maxBet.toLocaleString('vi-VN')} Xu!`);
            return Promise.resolve(false);
        }
        
        return database.ref(`rooms/${roomId}/betAmount`).set(betAmount).then(() => {
            currentBetAmount = betAmount;
            return true;
        });
    });
}
window.thietLapCuoc = thietLapCuoc;

// Gọi khi game bắt đầu — chỉ lưu thông tin cược, không trừ xu
// Xu sẽ được trừ/cộng khi kết thúc trận
function batDauCuoc(roomId, playerXId, playerOId) {
    const database = _getDb();
    if (!database) return Promise.resolve(false);
    
    return Promise.all([
        database.ref(`rooms/${roomId}/betAmount`).once('value'),
        database.ref(`rooms/${roomId}/isVip`).once('value')
    ]).then(([betSnap, isVipSnap]) => {
        const bet = betSnap.val();
        const isVip = isVipSnap.val() === true;
        const minBet = isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        if (!bet || bet < minBet) return false; // không có cược
        
        // Chỉ lưu thông tin người chơi tham gia cược
        return Promise.all([
            database.ref(`rooms/${roomId}/betPlayerX`).set(playerXId),
            database.ref(`rooms/${roomId}/betPlayerO`).set(playerOId)
        ]).then(() => {
            // Popup thông báo cược đã kích hoạt
            showXuPopup(0, `Cược ${bet.toLocaleString('vi-VN')} Xu 🎲`);
            if (typeof addNotification === 'function') {
                addNotification('win', `🎲 Cược kích hoạt! Người thắng nhận ${bet.toLocaleString('vi-VN')} Xu từ người thua!`);
            }
            return true;
        });
    });
}
window.batDauCuoc = batDauCuoc;

// Gọi khi kết thúc — trao thưởng: winner +bet, loser -bet
// Guard để tránh gọi nhiều lần từ cả 2 client
let _lastProcessedBetEndRoom = '';
let _lastProcessedBetEndTime = 0;
function ketThucCuoc(roomId, winnerRole, isDraw) {
    const database = _getDb();
    if (!database) return;
    
    // Guard để tránh xử lý nhiều lần
    const now = Date.now();
    if (_lastProcessedBetEndRoom === roomId && (now - _lastProcessedBetEndTime) < 5000) {
        console.log('[BetSystem] Skipping duplicate bet settlement for room:', roomId);
        return;
    }
    
    database.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room || !room.betAmount) return;
        const bet = room.betAmount || 0;
        const xId = room.betPlayerX;
        const oId = room.betPlayerO;
        if (!xId || !oId) return;
        const myId = localStorage.getItem('current_user_id');
        
        // Đánh dấu đã xử lý
        _lastProcessedBetEndRoom = roomId;
        _lastProcessedBetEndTime = now;

        if (isDraw) {
            // Hòa: hoàn lại xu cho cả 2 (không đổi gì)
            setTimeout(() => {
                showXuPopup(0, 'Hòa cược 🤝');
            }, 500); // Delay để bàn cờ kịp render
            if (typeof addNotification === 'function') addNotification('win', `🤝 Hòa! Không đổi xu.`);
        } else {
            const winnerId = winnerRole === 'X' ? xId : oId;
            const loserId  = winnerRole === 'X' ? oId  : xId;
            
            // Winner +bet
            database.ref(`users/${winnerId}/coins`).transaction(c => (c || 0) + bet)
                .then(() => {
                    if (myId === winnerId) {
                        setTimeout(() => {
                            playCoinBurst(bet, 'Thắng cược! 🏆💰');
                            showXuPopup(bet, 'Thắng cược +Xu 🏆');
                        }, 500); // Delay để bàn cờ kịp render nước cuối
                    }
                });
            
            // Loser -bet
            database.ref(`users/${loserId}/coins`).transaction(c => {
                const cur = c || 0;
                if (cur < bet) return 0; // Không âm
                return cur - bet;
            }).then(() => {
                if (myId === loserId) {
                    setTimeout(() => {
                        showXuPopup(-bet, 'Thua cược -Xu 😔');
                    }, 500); // Delay để bàn cờ kịp render nước cuối
                }
            });
            
            if (typeof addNotification === 'function') {
                addNotification('win', `🏆 Người thắng nhận ${bet.toLocaleString('vi-VN')} Xu từ người thua!`);
            }
        }
        // Xóa dữ liệu cược khỏi phòng
        database.ref(`rooms/${roomId}/betPot`).remove();
        database.ref(`rooms/${roomId}/betAmount`).remove();
        database.ref(`rooms/${roomId}/betPlayerX`).remove();
        database.ref(`rooms/${roomId}/betPlayerO`).remove();
    });
}
window.ketThucCuoc = ketThucCuoc;

// ──────────────────────────────────────────────
// BXH ĐẠI GIA (Giàu nhất)
// ──────────────────────────────────────────────
function loadBxhDaiGia(containerId) {
    const database = _getDb();
    const container = document.getElementById(containerId);
    if (!database || !container) return;
    container.innerHTML = '<div style="text-align:center;color:#aaa;padding:10px;">Đang tải...</div>';

    database.ref('users').orderByChild('coins').limitToLast(50).once('value').then(snap => {
        const users = snap.val();
        if (!users) { container.innerHTML = '<div style="color:#aaa;padding:10px;">Chưa có dữ liệu.</div>'; return; }
        const list = Object.entries(users)
            .map(([uid, u]) => ({ uid, name: u.displayName || u.username || 'Ẩn danh', coins: u.coins || 0 }))
            .filter(u => u.coins > 0)
            .sort((a, b) => b.coins - a.coins)
            .slice(0, 50);

        if (list.length === 0) { container.innerHTML = '<div style="color:#aaa;padding:10px;">Chưa có ai có Xu.</div>'; return; }

        const crowns = ['👑','🥈','🥉'];
        const titles = ['Đại Gia Số 1','Đại Gia Số 2','Đại Gia Số 3'];
        container.innerHTML = list.map((u, i) => {
            const isTop3 = i < 3;
            const medal = isTop3 ? crowns[i] : `#${i+1}`;
            const titleBadge = isTop3 ? `<span class="dagia-title">${titles[i]}</span>` : '';
            return `<div class="dagia-item ${isTop3 ? 'dagia-top'+(i+1) : ''}">
                <span class="dagia-medal">${medal}</span>
                <span class="dagia-name">${escapeHtml(u.name)}${titleBadge}</span>
                <span class="dagia-coins">💰 ${u.coins.toLocaleString('vi-VN')} Xu</span>
            </div>`;
        }).join('');
    });
}
window.loadBxhDaiGia = loadBxhDaiGia;

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────────
// HIỆU ỨNG THÔNG BÁO XU (+100 Xu)
// Gọi: showXuPopup(amount, label?)
//   amount > 0 → cộng xu (vàng)
//   amount < 0 → trừ xu (đỏ)
// ──────────────────────────────────────────────
function showXuPopup(amount, label) {
    if (!amount || amount === 0) return;
    const isCong = amount > 0;
    const absAmt = Math.abs(amount);
    const text   = (isCong ? '+' : '−') + absAmt.toLocaleString('vi-VN') + ' Xu';
    const sub    = label || (isCong ? 'Nhận xu!' : 'Trừ xu');

    const el = document.createElement('div');
    el.className = 'xu-popup';
    if (!isCong) {
        el.style.borderColor = '#f87171';
        el.style.boxShadow   = '0 0 16px rgba(248,113,113,0.5), 0 4px 12px rgba(0,0,0,0.3)';
    }

    el.innerHTML = `
        <span class="xu-popup-icon">${isCong ? '🪙' : '💸'}</span>
        <div>
            <div class="xu-popup-text" style="color:${isCong ? '#FFD700' : '#f87171'}">${text}</div>
            <div class="xu-popup-sub">${sub}</div>
        </div>
    `;

    // Định vị: bám theo xu-balance trên header
    const anchor = document.getElementById('xu-balance') || document.getElementById('xu-header-area');
    let baseTop = 80; // fallback nếu không tìm được anchor
    let baseLeft = '50%';
    let useCenter = true;

    if (anchor) {
        const rect = anchor.getBoundingClientRect();
        baseLeft = Math.max(8, rect.left - 20) + 'px';
        baseTop  = rect.bottom + 8;
        useCenter = false;
    }

    // Tính offset dọc để các popup xếp chồng không đè nhau
    const existing = document.querySelectorAll('.xu-popup');
    const stackOffset = existing.length * 72; // mỗi popup cao ~60px + gap 12px

    if (useCenter) {
        el.style.left      = '50%';
        el.style.top       = (baseTop + stackOffset) + 'px';
        el.style.transform = 'translateX(-50%)';
    } else {
        el.style.left = baseLeft;
        el.style.top  = (baseTop + stackOffset) + 'px';
    }

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
window.showXuPopup = showXuPopup;

// ──────────────────────────────────────────────
// HIỆU ỨNG NỔ XU (Coin burst animation)
// ──────────────────────────────────────────────
function playCoinBurst(amount, label) {
    // Popup +xu vàng với label tùy chỉnh
    showXuPopup(amount, label || 'Nhận thưởng! 🎉');

    // Hiệu ứng đồng xu nổ trên canvas
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    let coins = [];
    let animationId = null;
    let startTime = Date.now();
    const MAX_DURATION = 2000; // 2 giây
    
    // Tạo particles (giảm từ 30 xuống 20 để tối ưu)
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3;
        coins.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            alpha: 1, 
            size: Math.random() * 12 + 8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }

    function animCoins() {
        // Kiểm tra thời gian
        if (Date.now() - startTime > MAX_DURATION) {
            stopAnimation();
            return;
        }
        
        // Clear canvas trước mỗi frame
        ctx2.clearRect(0, 0, canvas.width, canvas.height);
        
        // Lọc particles còn visible
        coins = coins.filter(c => c.alpha > 0.05);
        if (coins.length === 0) {
            stopAnimation();
            return;
        }
        
        // Render mỗi particle
        for (const c of coins) {
            ctx2.save();
            ctx2.globalAlpha = c.alpha;
            ctx2.translate(c.x, c.y);
            ctx2.rotate(c.rotation);
            
            // Vẽ hình tròn vàng với gradient (thay vì emoji)
            const gradient = ctx2.createRadialGradient(0, 0, 0, 0, 0, c.size);
            gradient.addColorStop(0, '#FFD700'); // Vàng sáng
            gradient.addColorStop(0.7, '#FFA500'); // Cam
            gradient.addColorStop(1, '#FF8C00'); // Cam đậm
            
            ctx2.beginPath();
            ctx2.arc(0, 0, c.size, 0, Math.PI * 2);
            ctx2.fillStyle = gradient;
            ctx2.fill();
            
            // Thêm viền vàng nhạt
            ctx2.strokeStyle = '#FFF8DC';
            ctx2.lineWidth = 1;
            ctx2.stroke();
            
            ctx2.restore();
            
            // Cập nhật vị trí
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.25; // Gravity
            c.rotation += c.rotationSpeed;
            c.alpha -= 0.02; // Fade out
        }
        
        animationId = requestAnimationFrame(animCoins);
    }
    
    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        ctx2.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    animCoins();
}
window.playCoinBurst = playCoinBurst;

// ──────────────────────────────────────────────
// TAB NHIỆM VỤ
// ──────────────────────────────────────────────
function renderNhiemVuTab() {
    const container = document.getElementById('nhiem-vu-container');
    if (!container) return;
    const uid = _getUid();
    if (!uid) {
        container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">Đăng nhập để xem nhiệm vụ.</div>';
        return;
    }
    const data = (typeof currentUserData !== 'undefined' && currentUserData) ? currentUserData : {};
    const claimed = data.claimedWelcome;
    const checkedIn = data.lastCheckin === getTodayStr();

    container.innerHTML = `
        <div class="nv-item">
            <div class="nv-info">
                <span class="nv-icon">🎁</span>
                <div>
                    <div class="nv-title">Quà Chào Mừng</div>
                    <div class="nv-desc">Nhận ${XU_CONFIG.WELCOME_BONUS.toLocaleString('vi-VN')} Xu khi đăng ký tài khoản mới</div>
                </div>
            </div>
            ${claimed
                ? `<button class="nv-btn nv-done" disabled>✅ Đã nhận</button>`
                : `<button class="nv-btn nv-claim" onclick="nhanQuaChaoMung()">Nhận ${XU_CONFIG.WELCOME_BONUS} Xu</button>`}
        </div>
        <div class="nv-item">
            <div class="nv-info">
                <span class="nv-icon">📅</span>
                <div>
                    <div class="nv-title">Điểm Danh Hàng Ngày</div>
                    <div class="nv-desc">Nhận ${XU_CONFIG.DAILY_CHECKIN} Xu mỗi ngày (reset lúc 00:00)</div>
                </div>
            </div>
            ${checkedIn
                ? `<button class="nv-btn nv-done" disabled>✅ Đã điểm danh</button>`
                : `<button class="nv-btn nv-claim" onclick="diemDanh()">Điểm Danh +${XU_CONFIG.DAILY_CHECKIN} Xu</button>`}
        </div>
        <div class="nv-item">
            <div class="nv-info">
                <span class="nv-icon">🤖</span>
                <div>
                    <div class="nv-title">Thắng Bot nhận Xu (Giới hạn ngày)</div>
                    <div class="nv-desc">Thắng Bot nhận Xu. Xem giới hạn lượt bên dưới.</div>
                </div>
            </div>
        </div>
        <div id="bot-limit-display" style="background:#f0fdf4;border-radius:8px;padding:10px;margin-top:8px;font-size:13px;"></div>
    `;
    // Render giới hạn bot
    getBotLimitStatus(limits => {
        const el = document.getElementById('bot-limit-display');
        if (!el) return;
        if (!limits) { el.innerHTML = '<span style="color:#aaa">Đăng nhập để xem lượt.</span>'; return; }
        const rows = [
            { key:'easy',   label:'Bot Dễ',       max: XU_CONFIG.BOT_DAILY_LIMIT.easy,   reward: XU_CONFIG.BOT_REWARD.easy,   bonus: XU_CONFIG.BOT_BONUS_REWARD.easy },
            { key:'medium', label:'Bot Trung Bình',max: XU_CONFIG.BOT_DAILY_LIMIT.medium, reward: XU_CONFIG.BOT_REWARD.medium, bonus: XU_CONFIG.BOT_BONUS_REWARD.medium },
            { key:'hard',   label:'Bot Khó',       max: XU_CONFIG.BOT_DAILY_LIMIT.hard,   reward: XU_CONFIG.BOT_REWARD.hard,   bonus: XU_CONFIG.BOT_BONUS_REWARD.hard },
            { key:'god',    label:'Bot Tối Thượng',max: XU_CONFIG.BOT_DAILY_LIMIT.god,    reward: XU_CONFIG.BOT_REWARD.god,    bonus: XU_CONFIG.BOT_BONUS_REWARD.god },
            { key:'lightning', label:'Bot Tia Chớp',max: XU_CONFIG.BOT_DAILY_LIMIT.lightning, reward: XU_CONFIG.BOT_REWARD.lightning, bonus: XU_CONFIG.BOT_BONUS_REWARD.lightning }
        ];
        el.innerHTML = rows.map(r => {
            const used = limits[r.key] || 0;
            const rem = Math.max(0, r.max - used);
            const pct = Math.round((used / r.max) * 100);
            const bonusText = r.bonus > 0 ? ` (+${r.bonus} Xu khi hoàn thành ${r.max} trận)` : '';
            return `<div style="margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;font-size:12px">
                    <span>${r.label}: <b style="color:${rem>0?'#16a34a':'#dc2626'}">${rem > 0 ? `Hoàn thành ${used}/${r.max} (+${r.reward} Xu${bonusText})` : 'Hết lượt hôm nay'}</b></span>
                </div>
                <div style="height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${rem>0?'#22c55e':'#dc2626'};border-radius:3px;transition:width .3s"></div>
                </div>
            </div>`;
        }).join('');
    });
}
window.renderNhiemVuTab = renderNhiemVuTab;

// ──────────────────────────────────────────────
// MỞ / ĐÓNG CÁC MODAL CHÍNH
// ──────────────────────────────────────────────
function moNhiemVu() {
    document.getElementById('nhiem-vu-modal').style.display = 'flex';
    renderNhiemVuTab();
}
window.moNhiemVu = moNhiemVu;
function dongNhiemVu() { document.getElementById('nhiem-vu-modal').style.display = 'none'; }
window.dongNhiemVu = dongNhiemVu;

function moBxhDaiGia() {
    document.getElementById('bxh-dagia-modal').style.display = 'flex';
    loadBxhDaiGia('bxh-dagia-list');
}
window.moBxhDaiGia = moBxhDaiGia;
function dongBxhDaiGia() { document.getElementById('bxh-dagia-modal').style.display = 'none'; }
window.dongBxhDaiGia = dongBxhDaiGia;

// ──────────────────────────────────────────────
// HOOK VÀO LOGIC GAME: cộng xu khi thắng bot
// ──────────────────────────────────────────────
// Gọi hàm này từ logic-game.js sau khi xác nhận thắng bot
function onWinBotXu(modeName) {
    const uid = _getUid();
    if (!uid) return;
    const diff = DIFF_KEY[modeName] || 'easy';
    processWinBot(diff).then(earned => {
        if (earned > 0) {
            playCoinBurst(earned, 'Thắng Bot! 🏆');
            if (typeof addNotification === 'function') {
                addNotification('win', `🏆 Thắng Bot! +${earned} Xu`);
            }
        } else {
            if (typeof addNotification === 'function') {
                addNotification('win', 'Hết lượt nhận Xu từ Bot hôm nay. Thử cấp độ khác hoặc quay lại vào ngày mai!');
            }
        }
    });
}
window.onWinBotXu = onWinBotXu;

// ──────────────────────────────────────────────
// THƯỞNG XU KHI THẮNG SOLO ONLINE (PvP)
// Giới hạn SOLO_WIN_DAILY_LIMIT trận/ngày
// ──────────────────────────────────────────────
function onWinSoloXu() {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) return;

    // Không thưởng Solo xu nếu ván này đang có cược (tránh double reward)
    const roomId = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    if (roomId) {
        database.ref(`rooms/${roomId}/betPot`).once('value').then(snap => {
            if (snap.val() > 0) return; // có cược → skip solo reward
            _runOnWinSoloXu(uid, database);
        });
        return;
    }
    _runOnWinSoloXu(uid, database);
}

function _runOnWinSoloXu(uid, database) {
    const today = getTodayStr();
    const limitsRef = database.ref(`users/${uid}/soloDailyWins`);

    limitsRef.once('value').then(snap => {
        const data = snap.val() || {};
        // Reset nếu sang ngày mới
        const used = (data.date === today) ? (data.count || 0) : 0;
        const max  = XU_CONFIG.SOLO_WIN_DAILY_LIMIT;
        const reward = XU_CONFIG.SOLO_WIN_REWARD;

        if (used >= max) {
            if (typeof addNotification === 'function') {
                addNotification('win', `Đã đạt giới hạn ${max} trận thắng Solo/ngày — quay lại vào ngày mai!`);
            }
            return;
        }

        // Transaction tăng counter và cộng xu
        return limitsRef.transaction(() => ({ date: today, count: used + 1 }))
            .then(res => {
                if (!res.committed) return;
                return database.ref(`users/${uid}/coins`).transaction(c => (c || 0) + reward)
                    .then(coinsRes => {
                        if (!coinsRes.committed) return;
                        const rem = max - (used + 1);
                        playCoinBurst(reward, `Thắng Solo Online! 🏆`);
                        if (typeof addNotification === 'function') {
                            addNotification('win', `🏆 Thắng Solo! +${reward} Xu (còn ${rem}/${max} lượt hôm nay)`);
                        }
                    });
            });
    });
}
window.onWinSoloXu = onWinSoloXu;

// ──────────────────────────────────────────────
// KHỞI TẠO: gọi sau khi Firebase sẵn sàng
// ──────────────────────────────────────────────
function initXuSystem(uid) {
    if (!uid) return;
    // Tặng avatar mặc định nếu chưa có
    const database = _getDb();
    if (!database) return;
    database.ref(`users/${uid}/ownedAvatars`).once('value').then(snap => {
        if (!snap.val()) {
            database.ref(`users/${uid}/ownedAvatars`).set(['av_01']);
        }
    });
    database.ref(`users/${uid}/equippedAvatar`).once('value').then(snap => {
        if (!snap.val()) {
            database.ref(`users/${uid}/equippedAvatar`).set('av_01');
        }
    });
    // Kiểm tra welcome bonus
    checkAndGrantWelcomeBonus(uid);
    // Khởi tạo hệ thống skin quân cờ
    if (typeof initSkinSystem === 'function') initSkinSystem(uid);
    // Cập nhật hiển thị xu header
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        updateCoinDisplay(currentUserData.coins || 0);
    }
}
window.initXuSystem = initXuSystem;
