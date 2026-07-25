// ══════════════════════════════════════════════════════════════════
// HỆ THỐNG XU, NHIỆM VỤ, SHOP AVATAR, CƯỢC, BXH ĐẠI GIA
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// CẤU HÌNH
// ──────────────────────────────────────────────
const XU_CONFIG = {
    WELCOME_BONUS: 1000,
    DAILY_CHECKIN: 500,
    AVATAR_PRICE: 3000,
    BOT_REWARD: { easy: 300, medium: 400, hard: 400, god: 500 },
    BOT_DAILY_LIMIT: { easy: 5, medium: 8, hard: 10, god: 15 },
    BET_MIN: 100,
    BET_MAX: 5000
};

// Map độ khó game-mode → key difficulty
const DIFF_KEY = {
    'ai-easy': 'easy',
    'ai-medium': 'medium',
    'ai-hard': 'hard',
    'ai-god': 'god'
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
                easy: 0, medium: 0, hard: 0, god: 0
            });
        }
    });
}

// Gọi sau khi người chơi thắng bot — trả về số xu thưởng (0 nếu hết lượt)
function processWinBot(modeDiff) {
    const uid = _getUid();
    const database = _getDb();
    if (!uid || !database) return Promise.resolve(0);

    const limitKey = modeDiff; // 'easy'|'medium'|'hard'|'god'
    const maxAllowed = XU_CONFIG.BOT_DAILY_LIMIT[limitKey] || 5;
    const reward = XU_CONFIG.BOT_REWARD[limitKey] || 300;

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
                return database.ref(`users/${uid}/coins`).transaction(cur => (cur || 0) + reward)
                    .then(coinsRes => coinsRes.committed ? reward : 0);
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

function thietLapCuoc(roomId, betAmount) {
    const database = _getDb();
    if (!database) return Promise.resolve(false);
    betAmount = parseInt(betAmount);
    if (isNaN(betAmount) || betAmount < XU_CONFIG.BET_MIN || betAmount > XU_CONFIG.BET_MAX) {
        alert(`Mức cược phải từ ${XU_CONFIG.BET_MIN} đến ${XU_CONFIG.BET_MAX.toLocaleString('vi-VN')} Xu!`);
        return Promise.resolve(false);
    }
    return database.ref(`rooms/${roomId}/betAmount`).set(betAmount).then(() => {
        currentBetAmount = betAmount;
        return true;
    });
}
window.thietLapCuoc = thietLapCuoc;

// Gọi khi game bắt đầu — tạm trừ xu 2 người vào pot
function batDauCuoc(roomId, playerXId, playerOId) {
    const database = _getDb();
    if (!database) return Promise.resolve(false);
    return database.ref(`rooms/${roomId}/betAmount`).once('value').then(snap => {
        const bet = snap.val();
        if (!bet || bet < XU_CONFIG.BET_MIN) return false; // không có cược
        // Kiểm tra cả 2 người đủ xu trước
        return Promise.all([
            database.ref(`users/${playerXId}/coins`).once('value'),
            database.ref(`users/${playerOId}/coins`).once('value')
        ]).then(([xSnap, oSnap]) => {
            const xCoins = xSnap.val() || 0;
            const oCoins = oSnap.val() || 0;
            if (xCoins < bet || oCoins < bet) {
                database.ref(`rooms/${roomId}/betAmount`).remove();
                if (typeof addNotification === 'function') {
                    addNotification('win', '⚠️ Cược bị hủy vì một người không đủ Xu!');
                }
                return false;
            }
            // Trừ xu từng người bằng transaction, rollback nếu bất kỳ bên nào fail
            return database.ref(`users/${playerXId}/coins`).transaction(c => {
                const cur = c || 0;
                if (cur < bet) return; // abort
                return cur - bet;
            }).then(xRes => {
                if (!xRes.committed) {
                    database.ref(`rooms/${roomId}/betAmount`).remove();
                    if (typeof addNotification === 'function') addNotification('win', '⚠️ Cược bị hủy: người X không đủ Xu!');
                    return false;
                }
                return database.ref(`users/${playerOId}/coins`).transaction(c => {
                    const cur = c || 0;
                    if (cur < bet) return; // abort
                    return cur - bet;
                }).then(oRes => {
                    if (!oRes.committed) {
                        // Hoàn lại xu cho X vì O fail
                        database.ref(`users/${playerXId}/coins`).transaction(c => (c || 0) + bet);
                        database.ref(`rooms/${roomId}/betAmount`).remove();
                        if (typeof addNotification === 'function') addNotification('win', '⚠️ Cược bị hủy: người O không đủ Xu!');
                        return false;
                    }
                    // Cả 2 đã trừ thành công → lưu pot
                    return Promise.all([
                        database.ref(`rooms/${roomId}/betPot`).set(bet * 2),
                        database.ref(`rooms/${roomId}/betPlayerX`).set(playerXId),
                        database.ref(`rooms/${roomId}/betPlayerO`).set(playerOId)
                    ]).then(() => {
                        // Popup trừ xu cho người chơi hiện tại
                        showXuPopup(-bet, 'Cược PVP 🎲');
                        if (typeof addNotification === 'function') {
                            addNotification('win', `🎲 Cược kích hoạt! Pot: ${(bet * 2).toLocaleString('vi-VN')} Xu — người thắng nhận tất!`);
                        }
                        return true;
                    });
                });
            });
        });
    });
}
window.batDauCuoc = batDauCuoc;

// Gọi khi kết thúc — trao thưởng
function ketThucCuoc(roomId, winnerRole, isDraw) {
    const database = _getDb();
    if (!database) return;
    database.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room || !room.betPot) return;
        const pot = room.betPot;
        const bet = room.betAmount || 0;
        const xId = room.betPlayerX;
        const oId = room.betPlayerO;
        if (!xId || !oId) return;

        if (isDraw) {
            database.ref(`users/${xId}/coins`).transaction(c => (c || 0) + bet);
            database.ref(`users/${oId}/coins`).transaction(c => (c || 0) + bet);
            showXuPopup(bet, 'Hoàn cược (hòa) 🤝');
            if (typeof addNotification === 'function') addNotification('win', `🤝 Hòa! Xu cược hoàn lại.`);
        } else {
            const winnerId = winnerRole === 'X' ? xId : oId;
            database.ref(`users/${winnerId}/coins`).transaction(c => (c || 0) + pot)
                .then(() => {
                    const myId = localStorage.getItem('current_user_id');
                    if (myId === winnerId) showXuPopup(pot, 'Thắng cược 🏆');
                    if (typeof addNotification === 'function') {
                        addNotification('win', `🏆 Người thắng nhận ${pot.toLocaleString('vi-VN')} Xu từ cược!`);
                    }
                });
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
    showXuPopup(amount, label || 'Nhận thưởng! �');

    // Hiệu ứng đồng xu nổ trên canvas
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    let coins = [];
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 4;
        coins.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            alpha: 1, size: Math.random() * 16 + 10
        });
    }

    function animCoins() {
        coins = coins.filter(c => c.alpha > 0.05);
        if (coins.length === 0) return;
        for (const c of coins) {
            ctx2.save();
            ctx2.globalAlpha = c.alpha;
            ctx2.font = `${c.size}px serif`;
            ctx2.fillText('🪙', c.x, c.y);
            ctx2.restore();
            c.x += c.vx; c.y += c.vy;
            c.vy += 0.3;
            c.alpha -= 0.025;
        }
        requestAnimationFrame(animCoins);
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
            { key:'easy',   label:'Bot Dễ',       max: XU_CONFIG.BOT_DAILY_LIMIT.easy,   reward: XU_CONFIG.BOT_REWARD.easy },
            { key:'medium', label:'Bot Trung Bình',max: XU_CONFIG.BOT_DAILY_LIMIT.medium, reward: XU_CONFIG.BOT_REWARD.medium },
            { key:'hard',   label:'Bot Khó',       max: XU_CONFIG.BOT_DAILY_LIMIT.hard,   reward: XU_CONFIG.BOT_REWARD.hard },
            { key:'god',    label:'Bot Tối Thượng',max: XU_CONFIG.BOT_DAILY_LIMIT.god,    reward: XU_CONFIG.BOT_REWARD.god }
        ];
        el.innerHTML = rows.map(r => {
            const used = limits[r.key] || 0;
            const rem = Math.max(0, r.max - used);
            const pct = Math.round((used / r.max) * 100);
            return `<div style="margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;font-size:12px">
                    <span>${r.label}: <b style="color:${rem>0?'#16a34a':'#dc2626'}">${rem > 0 ? `Còn ${rem}/${r.max} lượt (+${r.reward} Xu)` : 'Hết lượt hôm nay'}</b></span>
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
    // Cập nhật hiển thị xu header
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        updateCoinDisplay(currentUserData.coins || 0);
    }
}
window.initXuSystem = initXuSystem;
