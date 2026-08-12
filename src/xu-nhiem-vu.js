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
    // Nhiệm vụ 5 quân
    BOT_REWARD_5: { easy: 700, medium: 900, hard: 1200, god: 2000, lightning: 2000, super: 5000 },
    BOT_DAILY_LIMIT_5: { easy: 10, medium: 12, hard: 10, god: 10, lightning: 10, super: 15 },
    BOT_BONUS_REWARD_5: { easy: 10000, medium: 15000, hard: 20000, god: 30000, lightning: 25000, super: 50000 },
    // Nhiệm vụ 6 quân
    BOT_REWARD_6: { easy: 8000, medium: 10000, hard: 12000, god: 15000, lightning: 15000, super: 20000 },
    BOT_DAILY_LIMIT_6: { easy: 8, medium: 10, hard: 8, god: 8, lightning: 8, super: 12 },
    BOT_BONUS_REWARD_6: { easy: 20000, medium: 25000, hard: 30000, god: 40000, lightning: 35000, super: 60000 },
    // Nhiệm vụ 7 quân
    BOT_REWARD_7: { easy: 15000, medium: 18000, hard: 20000, god: 25000, lightning: 25000, super: 30000 },
    BOT_DAILY_LIMIT_7: { easy: 5, medium: 7, hard: 5, god: 5, lightning: 5, super: 8 },
    BOT_BONUS_REWARD_7: { easy: 30000, medium: 35000, hard: 40000, god: 50000, lightning: 45000, super: 80000 },
    // Legacy config (để tương thích)
    BOT_REWARD: { easy: 700, medium: 900, hard: 1200, god: 2000, lightning: 2000, super: 5000 },
    BOT_DAILY_LIMIT: { easy: 10, medium: 12, hard: 10, god: 10, lightning: 10, super: 15 },
    BOT_BONUS_REWARD: { easy: 10000, medium: 15000, hard: 20000, god: 30000, lightning: 25000, super: 50000 },
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
    'bot-toi-thuong': 'god',  // Bot Tối Thượng dùng cùng reward với god
    'bot-tia-chop': 'lightning',
    'bot-than-co': 'super'
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
                if (typeof enqueueNotification === 'function') {
                    const sign = amount > 0 ? '+' : '';
                    enqueueNotification('system_events', { type: 'win', message: `💰 ${sign}${amount.toLocaleString('vi-VN')} Xu (${reason})` });
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
                if (typeof enqueueNotification === 'function') {
                    enqueueNotification('system_events', { type: 'win', message: `🎉 Chào mừng! Bạn nhận được ${XU_CONFIG.WELCOME_BONUS} Xu quà chào mừng!` });
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
                if (typeof enqueueNotification === 'function') {
                    enqueueNotification('system_events', { type: 'win', message: `✅ Điểm danh +${XU_CONFIG.DAILY_CHECKIN} Xu` });
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

function resetBotLimitsIfNeeded(limitsRef, winCount) {
    const today = getTodayStr();
    return limitsRef.once('value').then(snap => {
        const data = snap.val();
        if (!data || data.lastResetDate !== today) {
            return limitsRef.set({
                lastResetDate: today,
                easy: 0, medium: 0, hard: 0, god: 0, lightning: 0, super: 0
            });
        }
    });
}

// Gọi sau khi người chơi thắng bot — trả về số xu thưởng (0 nếu hết lượt)
function processWinBot(modeDiff, winCount) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) return Promise.resolve(0);

    const validKeys = ['easy', 'medium', 'hard', 'god', 'lightning', 'super'];
    let limitKey = modeDiff;
    if (!validKeys.includes(limitKey)) {
        console.warn('[processWinBot] unknown modeDiff, falling back to easy:', modeDiff);
        limitKey = 'easy';
    }

    // Xác định cấu hình dựa trên winCount (5, 6, 7)
    const validWinCounts = [5, 6, 7];
    const wc = validWinCounts.includes(winCount) ? winCount : 5; // default 5 nếu không hợp lệ

    const rewardConfig = XU_CONFIG[`BOT_REWARD_${wc}`] || XU_CONFIG.BOT_REWARD;
    const limitConfig = XU_CONFIG[`BOT_DAILY_LIMIT_${wc}`] || XU_CONFIG.BOT_DAILY_LIMIT;
    const bonusConfig = XU_CONFIG[`BOT_BONUS_REWARD_${wc}`] || XU_CONFIG.BOT_BONUS_REWARD;

    const maxAllowed = limitConfig[limitKey] || 5;
    const reward = rewardConfig[limitKey] || 300;
    const bonusReward = bonusConfig[limitKey] || 0;
    console.log('[processWinBot] limitKey=', limitKey, 'winCount=', wc, 'used/max=', maxAllowed, 'reward=', reward, 'bonus=', bonusReward);

    const limitsRef = database.ref(`users/${uid}/botDailyLimits_${wc}`);
    return resetBotLimitsIfNeeded(limitsRef, wc).then(() => {
        // Đọc giá trị hiện tại trước
        return limitsRef.child(limitKey).once('value').then(snap => {
            const used = snap.val() || 0;
            if (used >= maxAllowed) return 0; // hết lượt

            // Tăng counter bằng transaction để tránh race condition
            return limitsRef.child(limitKey).transaction(cur => {
                const c = cur || 0;
                if (c >= maxAllowed) return; // abort transaction nếu đã đạt giới hạn
                return c + 1;
            }).then(res => {
                if (!res.committed) return 0;
                const newUsed = res.snapshot.val() || 0;

                // Nếu transaction thực sự tăng (newUsed > used) → cộng xu
                if (newUsed <= used) return 0;

                // Nếu đạt max limit, cộng thêm bonus
                const totalReward = (newUsed === maxAllowed) ? (reward + bonusReward) : reward;
                return database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + totalReward)
                    .then(coinsRes => {
                        if (coinsRes.committed) {
                            if (newUsed === maxAllowed && bonusReward > 0) {
                                showXuPopup(bonusReward, `🎉 Hoàn thành ${maxAllowed} trận ${wc} quân!`);
                                if (typeof enqueueNotification === 'function') {
                                    enqueueNotification('system_events', { type: 'win', message: `🎉 Chúc mừng! Hoàn thành ${maxAllowed} trận ${wc} quân, thưởng thêm ${bonusReward} Xu!` });
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

// ──────────────────────────────────────────────
// GIỚI HẠN NHIỆM VỤ THEO SỐ QUÂN THẮNG HÀNG NGÀY
// ──────────────────────────────────────────────
// Lấy trạng thái giới hạn để hiển thị UI
function getBotLimitStatus(cb, winCount) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) { cb(null); return; }
    const validWinCounts = [5, 6, 7];
    const wc = validWinCounts.includes(winCount) ? winCount : 5;
    const limitsRef = database.ref(`users/${uid}/botDailyLimits_${wc}`);
    resetBotLimitsIfNeeded(limitsRef, wc).then(() => {
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
                if (typeof enqueueNotification === 'function') {
                    enqueueNotification('system_events', { type: 'win', message: `🛍️ Mua thành công avatar ${av.emoji} ${av.name}!` });
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
        const updates = { guestReady: true, updatedAt: Date.now() };

        if (room.status === 'ended') {
            updates.rematchRequested = true;
            if (myRole === 'X' || myRole === 'O') {
                updates.rematchRequestedBy = myRole;
            }
            updates.rematchOReady = true;
            if (!room.rematchConfig) {
                updates.rematchConfig = {
                    betAmount: room.betAmount || null,
                    winCount: room.winCount ?? 5,
                    chan2Dau: room.chan2Dau ?? true,
                    firstTurn: room.firstTurn || 'X',
                    isVip: room.isVip || false
                };
            }
        }

        if (hasBet) {
            // Có cược → yêu cầu xác nhận
            const dongY = confirm(`🎰 Chủ phòng cược ${room.betAmount.toLocaleString('vi-VN')} Xu\n\nBạn có đồng ý cược này không?\n\nBấm OK để đồng ý, Cancel để từ chối.`);
            if (!dongY) {
                thongBaoHeThong('❌ Bạn đã từ chối cược — hãy yêu cầu chủ phòng thay đổi cược!');
                return;
            }
            // Đồng ý cược → set cả guestReady và playerOConfirmed
            updates.playerOConfirmed = true;
        }

        database.ref(`rooms/${roomId}`).update(updates);

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
            if (typeof thongBaoHeThong === 'function') {
                thongBaoHeThong(`🎲 Cược ${bet.toLocaleString('vi-VN')} Xu đã kích hoạt. Người thắng sẽ nhận từ người thua.`);
            }
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: `🎲 Cược kích hoạt! Người thắng nhận ${bet.toLocaleString('vi-VN')} Xu từ người thua!` });
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
async function ketThucCuoc(roomId, winnerRole, isDraw) {
    const database = _getDb();
    if (!database) return;
    
    const snap = await database.ref(`rooms/${roomId}`).once('value');
    const room = snap.val();
    if (!room || !room.betAmount) return;
    const bet = room.betAmount || 0;
    const xId = room.betPlayerX;
    const oId = room.betPlayerO;
    if (!xId || !oId) return;
    const myId = localStorage.getItem('current_user_id');
    
    // Guard dựa trên myId để mỗi client chỉ xử lý một lần
    const now = Date.now();
    const guardKey = `${roomId}_${myId}`;
    if (_lastProcessedBetEndRoom === guardKey && (now - _lastProcessedBetEndTime) < 5000) {
        console.log('[BetSystem] Skipping duplicate bet settlement for user:', myId, 'room:', roomId);
        return;
    }
    
    // Đánh dấu đã xử lý cho user này
    _lastProcessedBetEndRoom = guardKey;
    _lastProcessedBetEndTime = now;

    if (isDraw) {
        // Hòa: hoàn lại xu cho cả 2 (không đổi gì)
        setTimeout(() => {
            showXuPopup(0, 'Hòa cược 🤝');
        }, 500); // Delay để bàn cờ kịp render
        if (typeof enqueueNotification === 'function') enqueueNotification('system_events', { type: 'win', message: `🤝 Hòa! Không đổi xu.` });
    } else {
        const winnerId = winnerRole === 'X' ? xId : oId;
        const loserId  = winnerRole === 'X' ? oId  : xId;
        
        // Winner +bet
        const winnerPromise = database.ref(`users/${winnerId}/coins`).transaction(c => (c || 0) + bet)
            .then(() => {
                if (myId === winnerId) {
                    setTimeout(() => {
                        playCoinBurst(bet, 'Thắng cược! 🏆💰');
                    }, 500); // Delay để bàn cờ kịp render nước cuối
                }
            });
        
        // Loser -bet
        const loserPromise = database.ref(`users/${loserId}/coins`).transaction(c => {
            const cur = c || 0;
            if (cur < bet) return 0; // Không âm
            return cur - bet;
        }).then(() => {
            if (myId === loserId) {
                setTimeout(() => {
                    // BUG 2 Fix: Add coin loss animation for loser
                    playCoinBurst(-bet, 'Thua cược -Xu 😔');
                }, 500); // Delay để bàn cờ kịp render nước cuối
            }
        });
        
        await Promise.all([winnerPromise, loserPromise]);
        if (typeof enqueueNotification === 'function') {
            enqueueNotification('system_events', { type: 'win', message: `🏆 Người thắng nhận ${bet.toLocaleString('vi-VN')} Xu từ người thua!` });
        }
    }
    // Xóa dữ liệu cược khỏi phòng
    await Promise.all([
        database.ref(`rooms/${roomId}/betPot`).remove(),
        database.ref(`rooms/${roomId}/betAmount`).remove(),
        database.ref(`rooms/${roomId}/betPlayerX`).remove(),
        database.ref(`rooms/${roomId}/betPlayerO`).remove()
    ]);
}
window.ketThucCuoc = ketThucCuoc;

// ──────────────────────────────────────────────
// BXH ĐẠI GIA (Giàu nhất)
// ──────────────────────────────────────────────
function loadBxhDaiGia(containerId) {
    const database = _getDb();
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!database) {
        container.innerHTML = '<div style="text-align:center;color:#aaa;padding:10px;">Đang kết nối...</div>';
        window._bxhDaiGiaRetryCount = (window._bxhDaiGiaRetryCount || 0) + 1;
        if (window._bxhDaiGiaRetryCount <= 10) {
            setTimeout(() => loadBxhDaiGia(containerId), 300);
        }
        return;
    }
    window._bxhDaiGiaRetryCount = 0;
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
if (typeof window.switchBxhTab === 'function') {
    const dagiaTab = document.getElementById('bxh-tab-dagia');
    if (window._bxhInitialized || (dagiaTab && dagiaTab.classList.contains('active'))) {
        window.switchBxhTab('dagia');
    }
}

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
    if (amount === undefined || amount === null || Number.isNaN(amount)) return;
    const hasLabel = typeof label === 'string' && label.trim() !== '';
    if (amount === 0 && !hasLabel) return;
    const isCong = amount > 0;
    const isLoss = amount < 0;
    const absAmt = Math.abs(amount);
    const text = amount === 0
        ? '0 Xu'
        : (isCong ? '+' : '−') + absAmt.toLocaleString('vi-VN') + ' Xu';
    const sub = label || (isCong ? 'Nhận xu!' : 'Trừ xu');
    const icon = amount > 0 ? '🪙' : amount < 0 ? '💸' : 'ℹ️';

    const el = document.createElement('div');
    el.className = `xu-popup ${isCong ? 'gain' : isLoss ? 'loss' : 'neutral'}`;

    el.innerHTML = `
        <span class="xu-popup-icon">${isCong ? '🪙' : '💸'}</span>
        <div>
            <div class="xu-popup-text">${text}</div>
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
let _coinBurstAnimationActive = false;
let _coinBurstResolveCallback = null;

function playCoinBurst(amount, label) {
    // Nếu amount === 0 thì không chạy hiệu ứng đồng xu (tránh +0 Xu gây nhầm lẫn)
    if (amount === 0) return;
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
    
    // BUG 3 & 4 FIX: Mark animation as active
    _coinBurstAnimationActive = true;
    
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
        
        // BUG 3 & 4 FIX: Mark animation as complete and resolve promise
        _coinBurstAnimationActive = false;
        if (_coinBurstResolveCallback) {
            _coinBurstResolveCallback();
            _coinBurstResolveCallback = null;
        }
    }
    
    animCoins();
}
window.playCoinBurst = playCoinBurst;

// BUG 3 & 4 FIX: Promise-based wrapper to wait for animation completion
let _coinBurstPromise = null;
function playCoinBurstAsync(amount, label) {
    // Reuse the current in-flight animation promise to prevent duplicate queue entries.
    if (_coinBurstPromise) return _coinBurstPromise;

    const promise = new Promise((resolve) => {
        // If animation is already active, wait for it to complete.
        if (_coinBurstAnimationActive) {
            _coinBurstResolveCallback = resolve;
            return;
        }

        // BUG 1 FIX: If called with amount 0, don't start new animation.
        // This is used only to wait for an existing animation.
        if (amount === 0) {
            resolve();
            return;
        }

        // Call original animation
        playCoinBurst(amount, label);

        // Set callback to resolve when animation completes.
        _coinBurstResolveCallback = resolve;

        // Fallback timeout in case animation never completes (safety net)
        setTimeout(() => {
            if (_coinBurstResolveCallback) {
                _coinBurstResolveCallback();
                _coinBurstResolveCallback = null;
            }
        }, 3000);
    });

    _coinBurstPromise = promise;
    return promise.finally(() => {
        _coinBurstPromise = null;
    });
}
window.playCoinBurstAsync = playCoinBurstAsync;

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
                <span class="nv-icon">🎯</span>
                <div>
                    <div class="nv-title">Thắng Bot nhận Xu (Giới hạn ngày)</div>
                    <div class="nv-desc">Thắng 5, 6, 7 quân nhận Xu theo độ khó bot. 3-4 quân không tính.</div>
                </div>
            </div>
        </div>
        <div id="wincount-tabs" style="display:flex;gap:5px;margin-top:8px;">
            <button class="wc-tab-btn active" data-wc="5" style="flex:1;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:#fef3c7;cursor:pointer;">5 Quân</button>
            <button class="wc-tab-btn" data-wc="6" style="flex:1;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;">6 Quân</button>
            <button class="wc-tab-btn" data-wc="7" style="flex:1;padding:8px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;">7 Quân</button>
        </div>
        <div id="wincount-limit-display" style="background:#fef3c7;border-radius:8px;padding:10px;margin-top:8px;font-size:13px;"></div>
    `;
    // Render giới hạn bot (5 quân mặc định)
    let currentWinCount = 5;
    const renderWinCountLimits = (wc) => {
        currentWinCount = wc;
        getBotLimitStatus(limits => {
            const el = document.getElementById('wincount-limit-display');
            if (!el) return;
            if (!limits) { el.innerHTML = '<span style="color:#aaa">Đăng nhập để xem lượt.</span>'; return; }
            
            const rewardConfig = XU_CONFIG[`BOT_REWARD_${wc}`];
            const limitConfig = XU_CONFIG[`BOT_DAILY_LIMIT_${wc}`];
            const bonusConfig = XU_CONFIG[`BOT_BONUS_REWARD_${wc}`];
            
            const rows = [
                { key:'easy',   label:'Bot Dễ',       max: limitConfig.easy,   reward: rewardConfig.easy,   bonus: bonusConfig.easy },
                { key:'medium', label:'Bot Trung Bình',max: limitConfig.medium, reward: rewardConfig.medium, bonus: bonusConfig.medium },
                { key:'hard',   label:'Bot Khó',       max: limitConfig.hard,   reward: rewardConfig.hard,   bonus: bonusConfig.hard },
                { key:'god',    label:'Bot Tối Thượng',max: limitConfig.god,    reward: rewardConfig.god,    bonus: bonusConfig.god },
                { key:'lightning', label:'Bot Tia Chớp',max: limitConfig.lightning, reward: rewardConfig.lightning, bonus: bonusConfig.lightning },
                { key:'super', label:'Bot Thần Cơ', max: limitConfig.super, reward: rewardConfig.super, bonus: bonusConfig.super }
            ];
            el.innerHTML = rows.map(r => {
                const used = limits[r.key] || 0;
                const rem = Math.max(0, r.max - used);
                const pct = Math.round((used / r.max) * 100);
                const bonusText = r.bonus > 0 ? ` (+${r.bonus} Xu khi hoàn thành ${r.max} trận)` : '';
                return `<div style="margin-bottom:6px">
                    <div style="display:flex;justify-content:space-between;font-size:12px">
                        <span>${r.label}: <b style="color:${rem>0?'#d97706':'#dc2626'}">${rem > 0 ? `Hoàn thành ${used}/${r.max} (+${r.reward} Xu${bonusText})` : 'Hết lượt hôm nay'}</b></span>
                    </div>
                    <div style="height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${rem>0?'#f59e0b':'#dc2626'};border-radius:3px;transition:width .3s"></div>
                    </div>
                </div>`;
            }).join('');
        }, wc);
    };
    
    // Tab switching
    setTimeout(() => {
        const tabs = document.querySelectorAll('.wc-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.background = '#fff';
                });
                tab.classList.add('active');
                tab.style.background = '#fef3c7';
                const wc = parseInt(tab.dataset.wc);
                renderWinCountLimits(wc);
            });
        });
        renderWinCountLimits(5);
    }, 100);
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
// Chỉ cộng xu khi winCount >= 5 (3-4 quân không tính nhiệm vụ)
function onWinBotXu(modeName, winCount) {
    const uid = _getUid();
    if (!uid) return;
    
    // Chỉ tính nhiệm vụ khi winCount >= 5
    if (typeof winCount === 'number' && winCount < 5) {
        console.log('[onWinBotXu] winCount < 5, không tính nhiệm vụ. winCount=', winCount);
        return;
    }
    
    // modeName may be either a bot gameMode (e.g. 'bot-tia-chop') or a diff key (e.g. 'lightning')
    const validKeys = ['easy','medium','hard','god','lightning','super'];
    let diff = 'easy';
    if (DIFF_KEY[modeName]) diff = DIFF_KEY[modeName];
    else if (validKeys.includes(modeName)) diff = modeName;
    else diff = 'easy';

    if (diff !== 'super' && modeName === 'bot-than-co') {
        console.warn('[onWinBotXu] Unexpected mapping for bot-than-co, diff=', diff);
    }
    console.log('[onWinBotXu] modeName=', modeName, 'winCount=', winCount, 'resolvedDiff=', diff);
    
    // Xác định winCount (5, 6, 7)
    const validWinCounts = [5, 6, 7];
    const wc = validWinCounts.includes(winCount) ? winCount : 5;
    
    processWinBot(diff, wc).then(earned => {
        console.log('[onWinBotXu] earned=', earned, 'for diff=', diff, 'winCount=', wc);
        if (earned > 0) {
            playCoinBurst(earned, `Thắng ${wc} quân! �`);
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: `� Thắng ${wc} quân! +${earned} Xu` });
            }
        } else {
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: 'Hết lượt nhận Xu từ Bot hôm nay. Thử cấp độ khác hoặc quay lại vào ngày mai!' });
            }
        }
        if (typeof renderNhiemVuTab === 'function') {
            renderNhiemVuTab();
        }
    });
}
window.onWinBotXu = onWinBotXu;

// ──────────────────────────────────────────────
// THƯỞNG XU KHI THẮNG SOLO ONLINE (PvP)
// Giới hạn SOLO_WIN_DAILY_LIMIT trận/ngày
// ──────────────────────────────────────────────
// Guard để tránh gọi nhiều lần cho cùng ván
let _lastProcessedSoloWinRoom = '';
let _lastProcessedSoloWinTime = 0;
function onWinSoloXu() {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) return Promise.resolve();

    // Guard để tránh gọi nhiều lần
    const now = Date.now();
    const roomId = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    if (roomId && _lastProcessedSoloWinRoom === roomId && (now - _lastProcessedSoloWinTime) < 5000) {
        console.log('[SoloXu] Skipping duplicate solo win reward for room:', roomId);
        return Promise.resolve();
    }

    // Không thưởng Solo xu nếu ván này đang có cược (tránh double reward)
    if (roomId) {
        return database.ref(`rooms/${roomId}/betAmount`).once('value').then(snap => {
            const betAmount = snap.val();
            if (betAmount && betAmount > 0) {
                console.log('[SoloXu] Room has bet, skipping solo reward. betAmount=', betAmount);
                return; // có cược → skip solo reward
            }
            _lastProcessedSoloWinRoom = roomId || '';
            _lastProcessedSoloWinTime = now;
            return _runOnWinSoloXu(uid, database);
        });
    }
    _lastProcessedSoloWinRoom = '';
    _lastProcessedSoloWinTime = now;
    return _runOnWinSoloXu(uid, database);
}

function _runOnWinSoloXu(uid, database) {
    const today = getTodayStr();
    const limitsRef = database.ref(`users/${uid}/soloDailyWins`);

    return limitsRef.once('value').then(snap => {
        const data = snap.val() || {};
        // Reset nếu sang ngày mới
        const used = (data.date === today) ? (data.count || 0) : 0;
        const max  = XU_CONFIG.SOLO_WIN_DAILY_LIMIT;
        const reward = XU_CONFIG.SOLO_WIN_REWARD;

        if (used >= max) {
            if (typeof enqueueNotification === 'function') {
                enqueueNotification('system_events', { type: 'win', message: `Đã đạt giới hạn ${max} trận thắng Solo/ngày — quay lại vào ngày mai!` });
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
                        if (typeof enqueueNotification === 'function') {
                            enqueueNotification('system_events', { type: 'win', message: `🏆 Thắng Solo! +${reward} Xu (còn ${rem}/${max} lượt hôm nay)` });
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
