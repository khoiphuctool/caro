// ══════════════════════════════════════════════════════════════════
// FIREBASE ONLINE - HỆ THỐNG 20 PHÒNG CỐ ĐỊNH
// Phòng không bao giờ bị xóa — chỉ reset trạng thái khi trống
// ══════════════════════════════════════════════════════════════════
(function() {
    // Firebase SDK đã được load tĩnh trong <head> của index.html
    // Chỉ cần gọi initFirebase khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            try { initFirebase(); }
            catch(e) { console.error('[Firebase] initFirebase error:', e); }
        });
    } else {
        // DOM đã sẵn sàng (script được defer hoặc ở cuối body)
        try { initFirebase(); }
        catch(e) { console.error('[Firebase] initFirebase error:', e); }
    }
})();
// ── Biến toàn cục ──────────────────────────────────────────────
let db;
let currentRoomId   = null;
let myRole          = null;   // 'X' | 'O' | 'viewer'
let currentTurn     = 'X';
let currentRule     = 'tu_do';
let currentWinCount = 5;
let isOnlineMode    = false;
let daXoaBanCoTranNay = false;
let currentUsername = null;
let currentUserData = null;
let welcomeNotificationShown = false;
if (typeof window !== 'undefined' && typeof window.GameModes === 'undefined') {
    window.GameModes = {
        NONE: 'none',
        BOT_ROOM: 'bot_room',
        TRAINING: 'training',
        SOLO: 'solo',
        ONLINE: 'online',
        REPLAY: 'replay'
    };
}
const GameModes = (typeof window !== 'undefined' && window.GameModes) ? window.GameModes : {
    NONE: 'none',
    BOT_ROOM: 'bot_room',
    TRAINING: 'training',
    SOLO: 'solo',
    ONLINE: 'online',
    REPLAY: 'replay'
};
// ── Bind UI buttons ngay khi DOM ready — không chờ Firebase ──
// Đảm bảo nút Đăng Nhập / Solo Online luôn hoạt động kể cả khi Firebase SDK chậm load
document.addEventListener('DOMContentLoaded', function() {
    const btnLogin    = document.getElementById('btn-show-login');
    const btnRegister = document.getElementById('btn-show-register');
    const btnOnline   = document.getElementById('btn-go-online');
    if (btnLogin && !btnLogin._earlyBound) {
        btnLogin._earlyBound = true;
        btnLogin.addEventListener('click', () => {
            const authTitle = document.getElementById('auth-title');
            if (authTitle) authTitle.innerText = '🔐 ĐĂNG NHẬP';
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.style.display = 'block';
        });
    }
    if (btnRegister && !btnRegister._earlyBound) {
        btnRegister._earlyBound = true;
        btnRegister.addEventListener('click', () => {
            const authTitle = document.getElementById('auth-title');
            if (authTitle) authTitle.innerText = '📝 ĐĂNG KÝ';
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.style.display = 'block';
        });
    }
    if (btnOnline && !btnOnline._earlyBound) {
        btnOnline._earlyBound = true;
        btnOnline.addEventListener('click', (e) => {
            if (!currentUsername) {
                e.preventDefault(); e.stopPropagation();
                const authTitle = document.getElementById('auth-title');
                if (authTitle) authTitle.innerText = '🔐 ĐĂNG NHẬP';
                const authContainer = document.getElementById('auth-container');
                if (authContainer) authContainer.style.display = 'block';
                return;
            }
            const lobbyScreen = document.getElementById('lobby-screen');
            if (lobbyScreen) lobbyScreen.style.display = 'block';
            if (typeof hienDanhSachPhong === 'function') hienDanhSachPhong();
            if (typeof setMyOnlineStatus === 'function') setMyOnlineStatus('free');
            if (typeof khoiDongChatTheGioi === 'function') khoiDongChatTheGioi();
        });
    }
    const btnLoginSubmit = document.getElementById('btn-login');
    const btnRegSubmit   = document.getElementById('btn-register');
    const btnLogout      = document.getElementById('btn-logout');
    if (btnLoginSubmit && !btnLoginSubmit._earlyBound) {
        btnLoginSubmit._earlyBound = true;
        btnLoginSubmit.addEventListener('click', () => { if (typeof dangNhap === 'function') dangNhap(); });
    }
    if (btnRegSubmit && !btnRegSubmit._earlyBound) {
        btnRegSubmit._earlyBound = true;
        btnRegSubmit.addEventListener('click', () => { if (typeof dangKy === 'function') dangKy(); });
    }
    if (btnLogout && !btnLogout._earlyBound) {
        btnLogout._earlyBound = true;
        btnLogout.addEventListener('click', () => { if (typeof dangXuat === 'function') dangXuat(); });
    }
    const btnCloseAuth = document.getElementById('btn-close-auth');
    if (btnCloseAuth && !btnCloseAuth._earlyBound) {
        btnCloseAuth._earlyBound = true;
        btnCloseAuth.addEventListener('click', () => {
            const authContainer = document.getElementById('auth-container');
            if (authContainer) authContainer.style.display = 'none';
        });
    }
});
// Listeners
let roomListener        = null;
let onlineUsersListener = null;
let invitationListener  = null;
let leaderboardListener = null;
let historyListener     = null;
let connectedListener   = null;
// Map lưu connected listeners theo roomId để tránh overwrite
const _connectedListeners = {};
let userDataListener    = null;  // fetchUserData listener
let userDataUserId      = null;
// Tọa độ nước cuối cục bộ (tránh vẽ lặp)
let locallyAppliedLastMove = { row: -2, col: -2 };
// Số phòng cố định
const TOTAL_NORMAL_ROOMS = 20;
const TOTAL_VIP_ROOMS = 20;
const TOTAL_ROOMS = TOTAL_NORMAL_ROOMS + TOTAL_VIP_ROOMS;
// Tab phòng đang chọn: 'bot', 'normal' hoặc 'vip'
let currentRoomTab = 'bot';
function debugLog() {}
// Resolve winCount for a room: prefer explicit room value, else GameState.roomRules, else GameState.board.winCount, else default 5
function resolveRoomWinCount(room) {
    if (room && typeof room.winCount === 'number') return room.winCount;
    if (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') return GameState.roomRules.winCount;
    if (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') return GameState.board.winCount;
    return 5;
}
function cleanupBotRoomBeforeOnlineTransition() {
    const currentMode = typeof GameModeManager !== 'undefined' && typeof GameModeManager.getCurrentMode === 'function'
        ? GameModeManager.getCurrentMode()
        : null;
    const isBotRoomMode = currentMode === 'bot_room'
        || (typeof GameModes !== 'undefined' && currentMode === GameModes.BOT_ROOM)
        || window.isBotRoomMode === true;

    if (!isBotRoomMode) return false;

    if (typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.exitBotRoom === 'function') {
        return BotRoomManager.exitBotRoom();
    }

    return false;
}

// ── Network Mode (Cloud/LAN) ──
let networkMode = localStorage.getItem('caro_network_mode') || 'cloud';
const LAN_EMULATOR_HOST = 'localhost';
const LAN_EMULATOR_PORT = 9000;

function getNetworkModeLabel() {
    return networkMode === 'lan' ? 'Nội bộ' : 'Thế giới';
}

function updateNetworkModeButton() {
    const btn = document.getElementById('btn-network-mode');
    if (!btn) return;
    btn.innerHTML = `🌐 <span>Mạng: ${getNetworkModeLabel()}</span>`;
}

function setNetworkMode(mode) {
    if (mode !== 'cloud' && mode !== 'lan') return;
    networkMode = mode;
    localStorage.setItem('caro_network_mode', mode);
    updateNetworkModeButton();
}

function toggleNetworkMode() {
    const newMode = networkMode === 'cloud' ? 'lan' : 'cloud';
    setNetworkMode(newMode);
    
    // Khi chuyển sang LAN, clear Firebase cache và reload
    if (newMode === 'lan') {
        console.log('[Firebase] Clearing Firebase cache before switching to LAN...');
        // Clear localStorage Firebase cache
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('firebase')) {
                localStorage.removeItem(key);
            }
        });
        // Clear sessionStorage
        sessionStorage.clear();
        console.log('[Firebase] Cache cleared, reloading...');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } else {
        // Khi chuyển sang Thế giới, reload bình thường
        window.location.reload();
    }
}
window.toggleNetworkMode = toggleNetworkMode;

// Export dữ liệu Firebase thủ công
function exportFirebaseData() {
    const networkMode = localStorage.getItem('caro_network_mode') || 'cloud';
    if (networkMode !== 'lan') {
        alert('Chỉ có thể lưu dữ liệu khi ở mode Nội bộ (LAN)');
        return;
    }
    
    if (!confirm('Bạn có muốn lưu dữ liệu server vào disk không?')) {
        return;
    }
    
    // Gọi API export server
    fetch('http://localhost:3001/api/export-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            project: 'fake-server',
            dataDir: 'firebase-data'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('✅ Đã lưu dữ liệu thành công!');
        } else {
            alert('❌ Lỗi lưu dữ liệu: ' + data.error);
        }
    })
    .catch(error => {
        alert('❌ Không thể kết nối tới export server. Hãy chắc chắn export-server.js đang chạy.\n\nLỗi: ' + error.message);
    });
}

// Chuyển tab phòng
function switchRoomTab(tab) {
    currentRoomTab = tab;
    const tabNormal = document.getElementById('tab-normal');
    const tabVip    = document.getElementById('tab-vip');
    const tabBot    = document.getElementById('tab-bot');

    // Reset tất cả tabs về inactive
    if (tabNormal) { tabNormal.style.background = '#e5e7eb'; tabNormal.style.color = '#374151'; }
    if (tabVip)    { tabVip.style.background    = '#e5e7eb'; tabVip.style.color    = '#374151'; }
    if (tabBot)    { tabBot.style.background    = '#e5e7eb'; tabBot.style.color    = '#374151'; }

    // Active tab được chọn
    if (tab === 'normal') {
        if (tabNormal) { tabNormal.style.background = '#6366f1'; tabNormal.style.color = 'white'; }
    } else if (tab === 'vip') {
        if (tabVip) { tabVip.style.background = '#f59e0b'; tabVip.style.color = 'white'; }
    } else if (tab === 'bot') {
        if (tabBot) { tabBot.style.background = '#10b981'; tabBot.style.color = 'white'; }
    }

    renderRoomListImmediate();
}
window.switchRoomTab = switchRoomTab;

// Khởi động tab phòng mặc định theo đúng mục tiêu UX: khi vào web, phòng bot
// phải render ngay lập tức mà không cần click vào tab.
document.addEventListener('DOMContentLoaded', function() {
    currentRoomTab = 'bot';
    if (typeof switchRoomTab === 'function') {
        switchRoomTab('bot');
    } else if (typeof renderRoomListImmediate === 'function') {
        renderRoomListImmediate();
    }
});
// ══════════════════════════════════════════════════════════════════
// 🏠 RENDER ROOM CARD - Tách code render phòng để tránh trùng lặp
// ══════════════════════════════════════════════════════════════════
function renderRoomCard(room, roomId, roomType) {
    const myId = localStorage.getItem('current_user_id');
    const laTrongPhong = (myId === room.playerX_id || myId === room.playerO_id);
    
    let statusTxt = '', bgColor = '', borderColor = '', nutHtml = '';
    let baseStyle = '';
    
    if (roomType === 'vip') {
        baseStyle = 'padding:10px;margin:5px 0;border:2px solid #f59e0b;border-radius:8px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);';
        bgColor = '#fffbeb';
        borderColor = '#f59e0b';
    } else {
        baseStyle = 'padding:10px;margin:5px 0;border:1px solid #ccc;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';
        bgColor = '#f8f9fa';
        borderColor = '#ddd';
    }
    
    if (room.status === 'empty') {
        statusTxt = '🟢 Trống';
        const btnColor = roomType === 'vip' ? '#f59e0b' : '#28a745';
        nutHtml = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
    } else if (room.status === 'waiting') {
        bgColor = roomType === 'vip' ? '#fef3c7' : '#e8f5e9';
        borderColor = roomType === 'vip' ? '#d97706' : '#4caf50';
        statusTxt = '⏳ Chờ bắt đầu';
        if (laTrongPhong) {
            const btnColor = roomType === 'vip' ? '#d97706' : '#4caf50';
            nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;">Vào lại</button>`;
        } else if (!room.playerO_id) {
            const btnColor = roomType === 'vip' ? '#f59e0b' : '#007bff';
            nutHtml = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Solo</button>`;
        } else {
            nutHtml = `<span style="color:#aaa;font-size:12px;">Đầy</span>`;
        }
    } else if (room.status === 'playing') {
        bgColor = roomType === 'vip' ? '#fed7aa' : '#fff3e0';
        borderColor = roomType === 'vip' ? '#ea580c' : '#ff9800';
        statusTxt = '⚔️ Đang chơi';
        if (laTrongPhong) {
            const btnColor = roomType === 'vip' ? '#ea580c' : '#ff9800';
            nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;">🔄 Vào lại</button>`;
        } else {
            const btnColor = roomType === 'vip' ? '#0ea5e9' : '#17a2b8';
            nutHtml = `<button onclick="xemPhong('${roomId}')" style="padding:6px 14px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;">👁️ Xem</button>`;
        }
    } else {
        statusTxt = '🟢 Trống';
        const btnColor = roomType === 'vip' ? '#f59e0b' : '#28a745';
        nutHtml = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
    }
    
    const el = document.createElement('div');
    el.style.cssText = baseStyle;
    el.style.backgroundColor = bgColor;
    el.style.borderColor = borderColor;
    
    const xN = room.playerX_name || '---';
    const oN = room.playerO_name || '---';
    const wc = room.winCount || 5;
    const c2d = room.chan2Dau ?? true;
    const luatTxt = `${wc} quân · ${c2d ? 'Chặn 2 đầu' : 'Không chặn 2 đầu'}`;
    const betTxt = room.betAmount ? room.betAmount.toLocaleString('vi-VN') + ' Xu' : '---';
    const roomNum = roomId.replace('phong_', '');
    
    // VIP room styling
    const roomTitleStyle = roomType === 'vip' 
        ? 'font-weight:bold;font-size:14px;color:#d97706;' 
        : 'font-weight:bold;font-size:14px;';
    const roomTitleText = roomType === 'vip' 
        ? `💎 ${roomNum} VIP` 
        : `Phòng ${roomNum}`;
    const betColor = roomType === 'vip' ? '#d97706' : '#888';
    
    el.innerHTML = `
        <div>
            <div style="${roomTitleStyle}">${roomTitleText}</div>
            <div style="font-size:12px;color:#555;margin-top:2px;">
                🔴 ${xN} vs 🔵 ${oN}
                &nbsp;·&nbsp;<span style="color:#888;">${luatTxt}</span>
                &nbsp;·&nbsp;<span style="color:${betColor};">💰 ${betTxt}</span>
                &nbsp;·&nbsp;<b>${statusTxt}</b>
            </div>
        </div>
        <div>${nutHtml}</div>
    `;
    
    return el;
}

// Render room list immediately from cached data (for tab switching)
function renderRoomListImmediate() {
    const container = document.getElementById('room-list');
    if (!container) return;

    // Tab Bot: không cần Firebase, giao cho BotRoomManager xử lý
    if (currentRoomTab === 'bot') {
        if (typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.openBotLobby === 'function') {
            BotRoomManager.openBotLobby();
        } else {
            container.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b;">Đang tải Phòng Bot...</div>';
        }
        return;
    }
    
    // Fetch current rooms data from Firebase
    db.ref('rooms').once('value').then(snap => {
        const rooms = snap.val();
        container.innerHTML = '';
        // Render rooms based on current tab
        if (currentRoomTab === 'normal') {
            for (let i = 1; i <= TOTAL_NORMAL_ROOMS; i++) {
                const roomId = `phong_${i}`;
                const room   = (rooms && rooms[roomId]) || taoDataPhongRong(i, false);
                const el = renderRoomCard(room, roomId, 'normal');
                container.appendChild(el);
            }
        } else {
            // VIP tab
            for (let i = 1; i <= TOTAL_VIP_ROOMS; i++) {
                const roomNum = TOTAL_NORMAL_ROOMS + i;
                const roomId = `phong_${roomNum}`;
                const room   = (rooms && rooms[roomId]) || taoDataPhongRong(roomNum, true);
                const el = renderRoomCard(room, roomId, 'vip');
                container.appendChild(el);
            }
        }
    });
}
// ══════════════════════════════════════════════════════════════════
// 🔥 KHỞI TẠO FIREBASE
// ══════════════════════════════════════════════════════════════════
function initFirebase() {
    // Luôn dùng Firebase Cloud databaseURL
    firebase.initializeApp({
        apiKey: "AIzaSyAM2qB0WixXi-QEPKEvfrpcVPbBqL7FVeU",
        authDomain: "caro-fa824.firebaseapp.com",
        databaseURL: "https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "caro-fa824",
        storageBucket: "caro-fa824.firebasedatabase.app",
        messagingSenderId: "809520185498",
        appId: "1:809520185498:web:905b110905104c81071f23"
    });
    db = firebase.database();
    
    // Gọi useEmulator() với IP LAN nếu mode là lan
    const networkMode = localStorage.getItem('caro_network_mode') || 'cloud';
    if (networkMode === 'lan') {
        db.useEmulator('192.168.1.64', 9000);
        console.log('[Firebase] Sử dụng LAN emulator 192.168.1.64:9000');
    } else {
        console.log('[Firebase] Sử dụng Firebase Cloud');
    }
    
    updateNetworkModeButton();
    db.ref('.info/serverTimeOffset').on('value', snap => {
        _firebaseServerTimeOffset = parseInt(snap.val(), 10) || 0;
        if (window._lastRoomSnapshot && window._lastRoomSnapshot.status === 'playing') {
            _updateBattleCountdown(window._lastRoomSnapshot);
        }
    });
    khoiTao20Phong();
    setupAuthListeners();
    setupEventListeners();
    // Firebase có thể tải xong sau sự kiện load của trang. Khởi tạo ticker lần nữa
    // để các listener thông báo luôn được gắn khi db đã sẵn sàng.
    if (typeof window.initNotificationTicker === 'function') window.initNotificationTicker();
    // Nếu tab BXH Đại Gia đã được đặt làm mặc định, load lại nó ngay khi Firebase sẵn sàng.
    if (typeof window.switchBxhTab === 'function') {
        window.switchBxhTab(window._initialBxhTab || 'dagia');
    }
}
// ══════════════════════════════════════════════════════════════════
// 🏠 KHỞI TẠO 20 PHÒNG CỐ ĐỊNH
// Chỉ tạo nếu chưa có — không bao giờ xóa phòng
// ══════════════════════════════════════════════════════════════════
function khoiTao20Phong() {
    // Chỉ tạo phòng chưa tồn tại — KHÔNG bao giờ ghi đè phòng đang có dữ liệu
    // Normal rooms 1-20
    for (let i = 1; i <= TOTAL_NORMAL_ROOMS; i++) {
        const roomRef = db.ref(`rooms/phong_${i}`);
        roomRef.once('value').then(snap => {
            if (!snap.exists() || snap.val() === null) {
                roomRef.set(taoDataPhongRong(i, false));
            }
        });
    }
    // VIP rooms 21-40 (VIP 1-20)
    for (let i = 1; i <= TOTAL_VIP_ROOMS; i++) {
        const roomNum = TOTAL_NORMAL_ROOMS + i;
        const roomRef = db.ref(`rooms/phong_${roomNum}`);
        roomRef.once('value').then(snap => {
            if (!snap.exists() || snap.val() === null) {
                roomRef.set(taoDataPhongRong(roomNum, true));
            } else {
                // Sync existing VIP rooms to new betting limits and ensure isVip flag is set
                const room = snap.val();
                const needsUpdate = room.betAmount < XU_CONFIG.VIP_BET_MIN || room.isVip !== true;
                if (needsUpdate) {
                    roomRef.update({
                        isVip: true,
                        betAmount: XU_CONFIG.VIP_BET_MIN,
                        betPot: XU_CONFIG.VIP_BET_MIN * 2
                    });
                }
            }
        });
    }
    
    // Force sync all VIP rooms immediately after init
    setTimeout(dongBoTatCaPhongVIP, 1000);
}

// Đồng bộ tất cả phòng VIP để đảm bảo isVip=true
// KHÔNG ghi đè betAmount khi phòng đang waiting/playing (tránh reset cược đang hoạt động)
function dongBoTatCaPhongVIP() {
    for (let i = 1; i <= TOTAL_VIP_ROOMS; i++) {
        const roomNum = TOTAL_NORMAL_ROOMS + i;
        const roomRef = db.ref(`rooms/phong_${roomNum}`);
        roomRef.once('value').then(snap => {
            const room = snap.val();
            if (!room) return;
            // Chỉ đồng bộ isVip flag — không đụng vào betAmount khi phòng đang dùng
            const update = { isVip: true };
            // Chỉ reset betAmount về VIP_BET_MIN khi phòng trống/kết thúc
            if (room.status === 'empty' || room.status === 'ended' || !room.status) {
                update.betAmount = XU_CONFIG.VIP_BET_MIN;
                update.betPot    = XU_CONFIG.VIP_BET_MIN * 2;
            }
            roomRef.update(update).catch(err => {
                console.error('[DEBUG] Error syncing VIP room:', roomNum, err);
            });
        });
    }
}
function taoDataPhongRong(so, isVip = false) {
    const defaultBet = isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
    return {
        roomNumber: so,
        name: isVip ? `VIP ${so}` : `Phòng ${so}`,
        isVip: isVip,
        status: 'empty',      // empty | waiting | playing | ended
        playerX_id: '',
        playerX_name: '',
        playerX_status: 'offline',
        playerO_id: '',
        playerO_name: '',
        playerO_status: 'offline',
        turn: 'X',
        winCount: 5,
        chan2Dau: true,
        winner: '',
        lastMove: { row: -1, col: -1, by: '' },
        moves: { init: true },
        betAmount: defaultBet,
        betPot: defaultBet * 2,
        updatedAt: Date.now()
    };
}
// ══════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION
// ══════════════════════════════════════════════════════════════════
function updateAuthUI(isLoggedIn) {
    const topAuthBtns = document.getElementById('top-auth-buttons');
    const userArea    = document.getElementById('user-logged-in');
    if (isLoggedIn) {
        if (topAuthBtns) topAuthBtns.style.display = 'none';
        if (userArea)    userArea.style.display    = 'flex';
    } else {
        if (topAuthBtns) topAuthBtns.style.display = 'flex';
        if (userArea)    userArea.style.display    = 'none';
    }
}
function setupAuthListeners() {
    // Nút đã được bind sớm trong DOMContentLoaded — chỉ bind thêm dangNhap/dangKy/dangXuat
    // nếu chưa được gắn (tránh duplicate listener)
    const btnLogin    = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const btnLogout   = document.getElementById('btn-logout');
    if (btnLogin    && !btnLogin._firebaseBound)    { btnLogin._firebaseBound = true;    btnLogin.addEventListener('click', dangNhap); }
    if (btnRegister && !btnRegister._firebaseBound) { btnRegister._firebaseBound = true; btnRegister.addEventListener('click', dangKy); }
    if (btnLogout   && !btnLogout._firebaseBound)   { btnLogout._firebaseBound = true;   btnLogout.addEventListener('click', dangXuat); }
    const savedUser = localStorage.getItem('current_username');
    const savedId   = localStorage.getItem('current_user_id');
    if (savedUser && savedId) {
        currentUsername = savedUser;
        fetchUserData(savedId);
        updateAuthUI(true);
        
        // Không tự động vào lại phòng ở đây - window load event sẽ xử lý
        // để tránh conflict và hiển thị UI không đúng
    } else {
        updateAuthUI(false);
    }
}
function dangKy() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!username || !password) { alert('Nhập đủ thông tin!'); return; }
    if (username.length < 3)   { alert('Tên ít nhất 3 ký tự!'); return; }
    if (password.length < 4)   { alert('Mật khẩu ít nhất 4 ký tự!'); return; }
    db.ref('users').orderByChild('username').equalTo(username).once('value').then(snap => {
        if (snap.exists()) { alert('Tên đã tồn tại!'); return; }
        const ref = db.ref('users').push();
        ref.set({ username, password, displayName: username, winBot: 0, winSolo: 0, loseSolo: 0, createdAt: Date.now() })
           .then(() => {
               const authContainer = document.getElementById('auth-container');
               if (authContainer) authContainer.style.display = 'none';
               currentUsername = username;
               localStorage.setItem('current_username', username);
               fetchUserData(ref.key);
               updateAuthUI(true);
           });
    });
}
function dangNhap() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!username || !password) { alert('Nhập đủ thông tin!'); return; }
    db.ref('users').orderByChild('username').equalTo(username).once('value').then(snap => {
        if (!snap.exists()) { alert('Tên không tồn tại!'); return; }
        const userId = Object.keys(snap.val())[0];
        const data   = snap.val()[userId];
        if (data.password !== password) { alert('Sai mật khẩu!'); return; }
        currentUsername = username;
        localStorage.setItem('current_username', username);
        localStorage.setItem('current_user_id', userId);
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.style.display = 'none';
        fetchUserData(userId);
        updateAuthUI(true);
        
        // Không tự động vào lại phòng ở đây - window load event sẽ xử lý
        // để tránh conflict và hiển thị UI không đúng
    });
}
function dangXuat() {
    const _doLogout = () => {
        if (userDataListener && userDataUserId) {
            db.ref('users/' + userDataUserId).off('value', userDataListener);
            userDataListener = null; userDataUserId = null;
        }
        currentUsername = null;
        currentUserData = null;
        
        // Cleanup Mailbox Service khi logout
        if (typeof cleanupMailboxService === 'function') {
            cleanupMailboxService();
        }
        localStorage.removeItem('current_username');
        localStorage.removeItem('current_user_id');
        localStorage.removeItem('current_room_id');
        updateAuthUI(false);
        setMyOnlineStatus(null);
        stopRoomCleanupManager();
        welcomeNotificationShown = false;
        // Ẩn panel admin khi đăng xuất
        if (typeof updateAdminPanelVisibility === 'function') updateAdminPanelVisibility();
    };
    if (currentRoomId && myRole && isOnlineMode) {
        roiKhoiPhong(_doLogout);
    } else {
        _doLogout();
    }
}
function fetchUserData(userId) {
    // Hủy listener cũ nếu đang nghe user khác (tránh leak khi đổi tài khoản)
    if (userDataListener && userDataUserId) {
        db.ref('users/' + userDataUserId).off('value', userDataListener);
        userDataListener = null;
    }
    userDataUserId = userId;
    let firstLoad = true;
    userDataListener = db.ref('users/' + userId).on('value', snap => {
        const data = snap.val();
        if (!data) return;
        
        // Initialize ownedBotPets and equippedBotPet if not exist
        if (!data.ownedBotPets) {
            db.ref('users/' + userId + '/ownedBotPets').set([]);
            data.ownedBotPets = [];
        }
        if (data.equippedBotPet === undefined) {
            db.ref('users/' + userId + '/equippedBotPet').set(null);
            data.equippedBotPet = null;
        }
        
        currentUserData = data;
        localStorage.setItem('current_user_id', userId);
        
        // Khởi tạo Mailbox Service
        if (typeof initMailboxService === 'function' && typeof db !== 'undefined') {
            initMailboxService(db, userId);
        }
        
        const rank = getRankName(data.winBot, data.winSolo);
        document.getElementById('user-display-name').innerText = data.displayName || data.username;
        document.getElementById('my-win-bot').innerText   = data.winBot   || 0;
        document.getElementById('my-win-solo').innerText  = data.winSolo  || 0;
        document.getElementById('my-lose-solo').innerText = data.loseSolo || 0;
        const myRankEl = document.getElementById('my-rank');
        if (myRankEl) { myRankEl.innerText = rank; myRankEl.style.color = '#ff8c00'; }
        // Cập nhật avatar top-bar
        const avEl = document.getElementById('user-avatar-display');
        if (avEl) {
            // Ưu tiên equippedAvatar từ SHOP_AVATAR_LIST nếu có
            const equippedId = data.equippedAvatar;
            let avatarContent = '';
            if (equippedId && typeof SHOP_AVATAR_LIST !== 'undefined') {
                const avDef = SHOP_AVATAR_LIST.find(a => a.id === equippedId);
                if (avDef) { avatarContent = avDef.emoji; avEl.style.fontSize = '22px'; }
            }
            // Fallback: emoji cũ lưu trong data.avatar (string emoji trực tiếp)
            if (!avatarContent && data.avatar) {
                avatarContent = data.avatar;
                avEl.style.fontSize = '22px';
            }
            if (!avatarContent) {
                avatarContent = (data.displayName || data.username || '?')[0].toUpperCase();
                avEl.style.fontSize = '16px';
            }
            avEl.textContent = avatarContent;
        }
        // Cập nhật skin đang dùng
        const skinDisplayEl = document.getElementById('user-skin-display');
        if (skinDisplayEl && typeof SHOP_SKIN_LIST !== 'undefined') {
            const equippedSkinId = data.equippedSkin || 'skin_default';
            const skin = SHOP_SKIN_LIST.find(s => s.id === equippedSkinId);
            if (skin) {
                skinDisplayEl.textContent = `Skin: ${skin.name}`;
            } else {
                skinDisplayEl.textContent = 'Skin: Mặc định';
            }
        }
        // Cập nhật bàn cờ đang dùng
        const boardDisplayEl = document.getElementById('user-board-display');
        if (boardDisplayEl && typeof SHOP_BOARD_SKIN_LIST !== 'undefined') {
            const equippedBoardId = data.equippedBoardSkin || 'board_default';
            const board = SHOP_BOARD_SKIN_LIST.find(b => b.id === equippedBoardId);
            if (board) {
                boardDisplayEl.textContent = `Bàn: ${board.name}`;
            } else {
                boardDisplayEl.textContent = 'Bàn: Mặc định';
            }
        }
        const settingsSkinDisplay = document.getElementById('settings-skin-display');
        if (settingsSkinDisplay) {
            const equippedSkinId = data.equippedSkin || 'skin_default';
            const skin = (typeof SHOP_SKIN_LIST !== 'undefined') ? SHOP_SKIN_LIST.find(s => s.id === equippedSkinId) : null;
            settingsSkinDisplay.textContent = skin ? skin.name : 'Mặc định';
        }
        const settingsBoardDisplay = document.getElementById('settings-board-display');
        if (settingsBoardDisplay) {
            const equippedBoardId = data.equippedBoardSkin || 'board_default';
            const board = (typeof SHOP_BOARD_SKIN_LIST !== 'undefined') ? SHOP_BOARD_SKIN_LIST.find(b => b.id === equippedBoardId) : null;
            settingsBoardDisplay.textContent = board ? board.name : 'Mặc định';
        }
        // Cập nhật số dư Xu trên header
        if (typeof updateCoinDisplay === 'function') updateCoinDisplay(data.coins || 0);
        // Chỉ setup listeners lần đầu
        if (firstLoad) {
            firstLoad = false;
            setMyOnlineStatus('free');
            langNgheDanhSachOnline();
            langNgheLoiMoiDen();
            kiemTraLoiMoiCho(userId); // Kiểm tra lời mời đang chờ
            
            // Thông báo chào mừng + khởi tạo listeners ticker sau khi đăng nhập
            if (!welcomeNotificationShown) {
                welcomeNotificationShown = true;
                const displayName = data.displayName || data.username || 'Bạn';
                reinitTickerAfterLogin(displayName);
            }
            // Khởi tạo hệ thống Xu
            if (typeof initXuSystem === 'function') initXuSystem(userId);
            // Khởi động Room Cleanup Manager sau khi đăng nhập
            startRoomCleanupManager();
            // Lắng nghe thông báo từ admin
            langNgheServerNotifications();
        }
        // Cập nhật hiển thị panel admin mỗi lần data thay đổi
        if (typeof updateAdminPanelVisibility === 'function') updateAdminPanelVisibility();
    });
}
function updateUserStats(statType, increment = 1) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    db.ref(`users/${userId}/${statType}`).transaction(cur => (cur || 0) + increment);
}
window.updateUserStats = updateUserStats;
// ── Lắng nghe thông báo từ admin ──
function langNgheServerNotifications() {
    db.ref('server_notifications').limitToLast(10).on('child_added', snapshot => {
        const notif = snapshot.val();
        if (!notif) return;
        // Chỉ hiển thị thông báo trong vòng 5 phút kể từ khi gửi (tránh hiển thị thông báo cũ)
        const now = Date.now();
        if (now - notif.timestamp > 300000) return; // 5 phút = 300000ms
        // Hiển thị thông báo qua ticker
        if (typeof addNotification === 'function') {
            addNotification(notif.type || 'info', notif.message);
        }
        // Hiển thị alert cho thông báo quan trọng
        if (notif.type === 'warning') {
            setTimeout(() => {
                alert(`⚠️ THÔNG BÁO TỪ ADMIN:

${notif.message}`);
            }, 1000);
        }
    });
}
window.langNgheServerNotifications = langNgheServerNotifications;
// Danh sách tài khoản có quyền admin (username hoặc displayName)
const ADMIN_USERS = ['chan', 'chần', 'admin', 'Chần', 'Chan', 'Admin'];
function isAdminUser(userData) {
    if (!userData) return false;
    const name = (userData.username || '').toLowerCase();
    const display = (userData.displayName || '').toLowerCase();
    return ADMIN_USERS.some(a => a.toLowerCase() === name || a.toLowerCase() === display)
        || userData.isAdmin === true;
}
window.isAdminUser = isAdminUser;
function updateAdminPanelVisibility() {
    const isAdmin = isAdminUser(currentUserData);
    const trainingPanel = document.getElementById('admin-training-panel');
    const aiConfigPanel = document.getElementById('admin-ai-config-panel');
    if (trainingPanel) trainingPanel.style.display = isAdmin ? 'flex' : 'none';
    if (aiConfigPanel) aiConfigPanel.style.display = isAdmin ? '' : 'none';
}
window.updateAdminPanelVisibility = updateAdminPanelVisibility;
function getRankName(winBot, winSolo) {
    const t = (winBot || 0) + (winSolo || 0);
    if (t >= 500) return '👑 Đại Cao Thủ';
    if (t >= 200) return '⚔️ Cao Thủ';
    if (t >= 100) return '💎 Kim Cương';
    if (t >= 50)  return '🥇 Vàng';
    if (t >= 25)  return '🥈 Bạc';
    if (t >= 10)  return '🥉 Đồng';
    return '🐣 Gà Con';
}
function setMyOnlineStatus(state) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId || !db) return;
    const ref = db.ref(`online_users/${userId}`);
    if (state === null) {
        ref.remove();
    } else {
        ref.set({
            username:    currentUsername,
            displayName: (currentUserData && currentUserData.displayName) || currentUsername,
            status:      state,
            lastActive:  Date.now()
        });
        ref.onDisconnect().remove();
    }
}
// ══════════════════════════════════════════════════════════════════
// 👥 DANH SÁCH ONLINE & LỜI MỜI
// ══════════════════════════════════════════════════════════════════
function langNgheDanhSachOnline() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    if (onlineUsersListener) db.ref('online_users').off('value', onlineUsersListener);
    onlineUsersListener = db.ref('online_users').on('value', snap => {
        const users = snap.val();
        // Cập nhật danh sách trong sảnh
        const dsEl = document.getElementById('danh-sach-online');
        if (dsEl) renderDanhSachOnlineSanh(users, userId, dsEl);
        // Cập nhật danh sách mời trong phòng
        const roomListEl = document.getElementById('room-online-users-list');
        if (roomListEl) renderDanhSachMoiTrongPhong(users, userId, roomListEl);
    });
}
function renderDanhSachOnlineSanh(users, myId, container) {
    container.innerHTML = '';
    if (!users) { container.innerHTML = "<p style='color:#888;font-size:13px;'>Không có ai trực tuyến.</p>"; return; }
    let count = 0;
    for (const uid in users) {
        if (uid === myId) continue;
        const u = users[uid];
        const free = u.status === 'free';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid #eee;font-size:14px;';
        row.innerHTML = `
            <div><strong>${u.displayName}</strong> <small style="color:${free?'green':'red'}">(${free?'🟢 Rảnh':'🔴 Đang chơi'})</small></div>
            <div>${free ? `<span style="color:#666;font-size:12px;">Chờ tạo phòng</span>` : `<span style="color:#aaa;font-size:12px;">Bận</span>`}</div>
        `;
        container.appendChild(row);
        count++;
    }
    if (count === 0) container.innerHTML = "<p style='color:#888;font-size:13px;'>Không có ai trực tuyến.</p>";
}
function renderDanhSachMoiTrongPhong(users, myId, container) {
    container.innerHTML = '';
    if (!users) { container.innerHTML = '<div style="color:#aaa;text-align:center;padding:10px;">Không có kỳ thủ nào rảnh.</div>'; return; }
    let count = 0;
    for (const uid in users) {
        if (uid === myId) continue;
        const u = users[uid];
        if (u.status !== 'free') continue;
        const row = document.createElement('div');
        row.className = 'invite-user-row';
        const dn = u.displayName || u.username || 'Unknown';
        row.innerHTML = `<span>🟢 ${dn}</span><button class="btn-invite-action" onclick="guiLoiMoiThachDau('${uid}','${dn}')">Mời Solo</button>`;
        container.appendChild(row);
        count++;
    }
    if (count === 0) container.innerHTML = '<div style="color:#aaa;text-align:center;padding:10px;">Không có kỳ thủ nào rảnh.</div>';
}
function guiLoiMoiThachDau(targetUid, targetName) {
    if (!currentRoomId) return;
    const myId   = localStorage.getItem('current_user_id');
    const myName = currentUserData ? currentUserData.displayName : currentUsername;
    
    console.log('[Solo Invite] ===== CHECKING SOLO INVITE =====');
    console.log('[Solo Invite] From:', myId, myName);
    console.log('[Solo Invite] To:', targetUid, targetName);
    
    // Kiểm tra xem người nhận có bận không
    db.ref(`users/${targetUid}/currentRoomId`).once('value').then(snap => {
        const targetRoomId = snap.val();
        
        console.log('[Solo Invite] Checking target currentRoomId:', targetRoomId);
        
        // Nếu người chơi đang trong phòng nào đó → báo bận
        if (targetRoomId) {
            // ══════════════════════════════════════════════════════════════════
            // LOG CHI TIẾT: Tại sao báo bận?
            // ══════════════════════════════════════════════════════════════════
            db.ref(`rooms/${targetRoomId}`).once('value').then(roomSnap => {
                const room = roomSnap.val();
                console.log('[Solo Invite] Checking room state...');
                console.log('[Solo Invite] Target:', targetName);
                console.log('[Solo Invite] Presence: Checking online status...');
                console.log('[Solo Invite] CurrentRoomId:', targetRoomId);
                console.log('[Solo Invite] Room Status:', room ? room.status : 'null');
                console.log('[Solo Invite] Room PlayerX:', room ? room.playerX_id : 'null');
                console.log('[Solo Invite] Room PlayerO:', room ? room.playerO_id : 'null');
                console.log('[Solo Invite] Room Winner:', room ? room.winner : 'null');
                console.log('[Solo Invite] Room EndReason:', room ? room.endReason : 'null');
                console.log('[Solo Invite] Room EndedAt:', room ? room.endedAt : 'null');
                
                // ══════════════════════════════════════════════════════════════════
                // GHOST ROOM FIX: Nếu room empty hoặc ended và không có player nào
                // thì coi như user không bận (ignore currentRoomId)
                // ══════════════════════════════════════════════════════════════════
                if (room && (room.status === 'empty' || room.status === 'ended')) {
                    const hasPlayerX = room.playerX_id && room.playerX_id !== '';
                    const hasPlayerO = room.playerO_id && room.playerO_id !== '';
                    
                    if (!hasPlayerX && !hasPlayerO) {
                        console.log('[Solo Invite] GHOST ROOM DETECTED - Room is empty/ended with no players');
                        console.log('[Solo Invite] Auto-cleaning ghost currentRoomId for target:', targetUid);
                        
                        // Auto cleanup ghost currentRoomId
                        db.ref(`users/${targetUid}/currentRoomId`).remove().then(() => {
                            console.log('[Solo Invite] ✓ Ghost currentRoomId cleaned up');
                        }).catch(err => {
                            console.error('[Solo Invite] ✗ Error cleaning ghost currentRoomId:', err);
                        });
                        
                        // Cho phép mời (coi như user không bận)
                        console.log('[Solo Invite] Proceeding with invite (ghost room ignored)');
                        proceedWithInvite(targetUid, targetName, myId, myName, currentRoomId);
                        return;
                    }
                }
                
                console.log('[Solo Invite] Reason: busy because currentRoomId still active');
                alert(`[${targetName}] đang bận trong phòng khác! Vui lòng thử lại sau.`);
            }).catch(err => {
                console.error('[Solo Invite] Error checking room:', err);
                console.log('[Solo Invite] Target:', targetName);
                console.log('[Solo Invite] CurrentRoomId:', targetRoomId);
                console.log('[Solo Invite] Reason: busy (room check failed)');
                alert(`[${targetName}] đang bận trong phòng khác! Vui lòng thử lại sau.`);
            });
            return;
        }
        
        console.log('[Solo Invite] Target currentRoomId is null - ALLOWED');
        proceedWithInvite(targetUid, targetName, myId, myName, currentRoomId);
    });
}

// ══════════════════════════════════════════════════════════════════
// HELPER: Gửi lời mời sau khi đã kiểm tra busy
// ══════════════════════════════════════════════════════════════════
function proceedWithInvite(targetUid, targetName, myId, myName, fromRoomId) {
    // Kiểm tra xem người nhận có online không
    db.ref(`online_users/${targetUid}`).once('value').then(snap => {
        const isOnline = snap.exists();
        console.log('[Solo Invite] Target online status:', isOnline);
        
        const inviteData = {
            fromRoomId:     fromRoomId,
            fromPlayerId:   myId,
            fromPlayerName: myName,
            timestamp:      Date.now()
        };
        
        console.log('[Solo Invite] ===== CREATING INVITE =====');
        console.log('[Solo Invite] Firebase Path: invitations/' + targetUid);
        console.log('[Solo Invite] Sender:', myId, myName);
        console.log('[Solo Invite] Receiver:', targetUid, targetName);
        console.log('[Solo Invite] Timestamp:', inviteData.timestamp);
        console.log('[Solo Invite] Invite Data:', inviteData);
        
        // Gửi lời mời realtime (nếu người đang online sẽ nhận ngay)
        db.ref(`invitations/${targetUid}`).set(inviteData).then(() => {
            console.log('[Solo Invite] ✓ Invite created successfully');
            console.log('[Solo Invite] Firebase node: invitations/' + targetUid + ' should exist now');
            
            // Verify node was created
            db.ref(`invitations/${targetUid}`).once('value').then(verifySnap => {
                const verifyData = verifySnap.val();
                console.log('[Solo Invite] Verification - Node exists:', !!verifyData);
                console.log('[Solo Invite] Verification - Node data:', verifyData);
                if (verifyData) {
                    console.log('[Solo Invite] Verification - Timestamp matches:', verifyData.timestamp === inviteData.timestamp);
                    console.log('[Solo Invite] Verification - Sender matches:', verifyData.fromPlayerId === myId);
                }
            });
            
            alert(`Đã gửi lời mời tới [${targetName}]!${isOnline ? '' : ' (Người này hiện offline, sẽ nhận khi online)'}`);
            
            // Luôn lưu lời mời vào danh sách chờ (để họ xem lại khi online)
            db.ref(`pending_invites/${targetUid}`).push({
                fromRoomId:     fromRoomId,
                fromPlayerId:   myId,
                fromPlayerName: myName,
                timestamp:      Date.now(),
                status:         'pending'
            }).then(() => {
                console.log('[Solo Invite] ✓ Pending invite stored');
            });
        }).catch(err => {
            console.error('[Solo Invite] ✗ Error sending invitation:', err);
            alert('Lỗi gửi lời mời: ' + err.message);
        });
    });
}
window.guiLoiMoiThachDau = guiLoiMoiThachDau;

// ══════════════════════════════════════════════════════════════════
// MODE CHANGE CALLBACK - Re-attach invite listener when returning to lobby
// ══════════════════════════════════════════════════════════════════
if (typeof GameModeManager !== 'undefined') {
    GameModeManager.onModeChange(function(newMode, previousMode, context) {
        console.log('[Invite Listener] ===== MODE CHANGE CALLBACK =====');
        console.log('[Invite Listener] Previous mode:', previousMode);
        console.log('[Invite Listener] New mode:', newMode);
        console.log('[Invite Listener] Context:', context);
        
        // When switching to NONE (lobby), re-attach invite listener
        if (newMode === GameModes.NONE && previousMode !== GameModes.NONE) {
            console.log('[Invite Listener] Switching to lobby, re-attaching invite listener...');
            langNgheLoiMoiDen();
        }
        
        // When switching to ONLINE mode, listener should already be attached
        if (newMode === GameModes.ONLINE) {
            console.log('[Invite Listener] Switching to ONLINE mode, listener should be active');
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// 🧪 REGRESSION TEST: Ghost Room Detection
// ══════════════════════════════════════════════════════════════════
// Test để kiểm tra xem sau khi kết thúc trận và thoát phòng,
// Firebase có được cleanup đúng không (không còn ghost room)
window.testGhostRoomCleanup = async function() {
    console.log('[Ghost Room Test] ===== STARTING GHOST ROOM REGRESSION TEST =====');
    
    const myId = localStorage.getItem('current_user_id');
    if (!myId) {
        console.error('[Ghost Room Test] No user ID found');
        return;
    }
    
    // 1. Kiểm tra currentRoomId của user
    console.log('[Ghost Room Test] Step 1: Checking user currentRoomId...');
    const userRoomSnap = await db.ref(`users/${myId}/currentRoomId`).once('value');
    const userRoomId = userRoomSnap.val();
    console.log('[Ghost Room Test] User currentRoomId:', userRoomId);
    
    if (!userRoomId) {
        console.log('[Ghost Room Test] ✓ PASS: User currentRoomId is null (clean)');
        return { passed: true, reason: 'User currentRoomId is null' };
    }
    
    // 2. Kiểm tra room state
    console.log('[Ghost Room Test] Step 2: Checking room state...');
    const roomSnap = await db.ref(`rooms/${userRoomId}`).once('value');
    const room = roomSnap.val();
    
    if (!room) {
        console.log('[Ghost Room Test] ⚠️ WARNING: Room not found but user currentRoomId still exists');
        console.log('[Ghost Room Test] Reason: Ghost room detected (room deleted but user.currentRoomId not cleared)');
        return { passed: false, reason: 'Ghost room: user.currentRoomId exists but room not found' };
    }
    
    console.log('[Ghost Room Test] Room Status:', room.status);
    console.log('[Ghost Room Test] Room PlayerX:', room.playerX_id);
    console.log('[Ghost Room Test] Room PlayerO:', room.playerO_id);
    console.log('[Ghost Room Test] Room Winner:', room.winner);
    console.log('[Ghost Room Test] Room EndedAt:', room.endedAt);
    
    // 3. Kiểm tra xem user có còn trong room không
    const isPlayerX = room.playerX_id === myId;
    const isPlayerO = room.playerO_id === myId;
    
    if (!isPlayerX && !isPlayerO) {
        console.log('[Ghost Room Test] ⚠️ WARNING: User not in room but currentRoomId still exists');
        console.log('[Ghost Room Test] Reason: Ghost room detected (user not in room but currentRoomId not cleared)');
        return { passed: false, reason: 'Ghost room: user not in room but currentRoomId exists' };
    }
    
    // 4. Kiểm tra xem room đã kết thúc chưa
    if (room.status === 'ended') {
        const timeSinceEnd = Date.now() - (room.endedAt || 0);
        console.log('[Ghost Room Test] Room ended', timeSinceEnd, 'ms ago');
        
        if (timeSinceEnd > 60000) { // 1 phút
            console.log('[Ghost Room Test] ⚠️ WARNING: Room ended > 1 min ago but user.currentRoomId not cleared');
            console.log('[Ghost Room Test] Reason: Ghost room detected (room ended long ago but currentRoomId not cleared)');
            return { passed: false, reason: 'Ghost room: room ended > 1 min ago but currentRoomId not cleared' };
        }
    }
    
    // 5. Kiểm tra presence
    console.log('[Ghost Room Test] Step 3: Checking presence...');
    const presenceSnap = await db.ref(`online_users/${myId}`).once('value');
    const isOnline = presenceSnap.exists();
    console.log('[Ghost Room Test] User online:', isOnline);
    
    if (isOnline && room.status === 'ended') {
        console.log('[Ghost Room Test] ⚠️ WARNING: User online but room ended');
        console.log('[Ghost Room Test] Reason: Possible ghost room (user online but in ended room)');
        return { passed: false, reason: 'Possible ghost room: user online but in ended room' };
    }
    
    console.log('[Ghost Room Test] ✓ PASS: No ghost room detected');
    return { passed: true, reason: 'No ghost room detected' };
};

// ══════════════════════════════════════════════════════════════════
// 🧪 REGRESSION TEST: Solo Invite Pipeline
// ══════════════════════════════════════════════════════════════════
// Test để kiểm tra pipeline mời Solo có hoạt động đúng không
window.testSoloInvitePipeline = async function(targetUid, targetName) {
    console.log('[Solo Invite Test] ===== STARTING SOLO INVITE PIPELINE TEST =====');
    console.log('[Solo Invite Test] Target:', targetUid, targetName);
    
    const myId = localStorage.getItem('current_user_id');
    if (!myId) {
        console.error('[Solo Invite Test] No user ID found');
        return { passed: false, reason: 'No user ID' };
    }
    
    // 1. Kiểm tra target currentRoomId
    console.log('[Solo Invite Test] Step 1: Checking target currentRoomId...');
    const targetRoomSnap = await db.ref(`users/${targetUid}/currentRoomId`).once('value');
    const targetRoomId = targetRoomSnap.val();
    console.log('[Solo Invite Test] Target currentRoomId:', targetRoomId);
    
    if (targetRoomId) {
        // 2. Kiểm tra room state
        console.log('[Solo Invite Test] Step 2: Checking target room state...');
        const roomSnap = await db.ref(`rooms/${targetRoomId}`).once('value');
        const room = roomSnap.val();
        
        console.log('[Solo Invite Test] Room Status:', room ? room.status : 'null');
        console.log('[Solo Invite Test] Room PlayerX:', room ? room.playerX_id : 'null');
        console.log('[Solo Invite Test] Room PlayerO:', room ? room.playerO_id : 'null');
        console.log('[Solo Invite Test] Room Winner:', room ? room.winner : 'null');
        console.log('[Solo Invite Test] Room EndedAt:', room ? room.endedAt : 'null');
        
        // 3. Kiểm tra presence
        console.log('[Solo Invite Test] Step 3: Checking target presence...');
        const presenceSnap = await db.ref(`online_users/${targetUid}`).once('value');
        const isOnline = presenceSnap.exists();
        console.log('[Solo Invite Test] Target online:', isOnline);
        
        if (isOnline && room && room.status === 'ended') {
            console.log('[Solo Invite Test] ⚠️ WARNING: Ghost room detected');
            console.log('[Solo Invite Test] Reason: Target online but in ended room');
            return { passed: false, reason: 'Ghost room: target online but in ended room' };
        }
        
        console.log('[Solo Invite Test] Result: Target is busy (in room)');
        return { passed: true, reason: 'Target is busy (correctly detected)', isBusy: true };
    }
    
    console.log('[Solo Invite Test] Result: Target is free');
    return { passed: true, reason: 'Target is free (can invite)', isBusy: false };
};
function langNgheLoiMoiDen() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    
    console.log('[Invite Listener] ===== ATTACHING LISTENER =====');
    console.log('[Invite Listener] Firebase Path: invitations/' + userId);
    console.log('[Invite Listener] Current currentRoomId:', currentRoomId);
    console.log('[Invite Listener] Current isOnlineMode:', isOnlineMode);
    
    if (invitationListener) {
        console.log('[Invite Listener] Removing old listener before attaching new one');
        db.ref(`invitations/${userId}`).off('value', invitationListener);
        invitationListener = null;
    }
    
    invitationListener = db.ref(`invitations/${userId}`).on('value', snap => {
        console.log('[Invite Listener] ===== EVENT RECEIVED =====');
        console.log('[Invite Listener] Firebase Path: invitations/' + userId);
        console.log('[Invite Listener] Snapshot exists:', snap.exists());
        
        const invite = snap.val();
        if (!invite) {
            console.log('[Invite Listener] Invite data is null/undefined');
            return;
        }
        
        console.log('[Invite Listener] Invite Data:', invite);
        console.log('[Invite Listener] Invite ID:', userId);
        console.log('[Invite Listener] Sender:', invite.fromPlayerId, invite.fromPlayerName);
        console.log('[Invite Listener] Timestamp:', invite.timestamp);
        console.log('[Invite Listener] Age (ms):', Date.now() - invite.timestamp);
        
        if (Date.now() - invite.timestamp > 30000) { 
            console.log('[Invite Listener] Invite expired (>30s), removing');
            db.ref(`invitations/${userId}`).remove(); 
            return; 
        }
        
        // Đang trong phòng rồi thì bỏ qua lời mời, xóa đi
        if (currentRoomId && isOnlineMode) {
            console.log('[Invite Listener] User in room, ignoring invite');
            db.ref(`invitations/${userId}`).remove();
            return;
        }
        
        console.log('[Invite Listener] Showing confirm dialog');
        const dongY = confirm(`🎮 [${invite.fromPlayerName}] mời bạn vào phòng solo! Chấp nhận?`);
        console.log('[Invite Listener] User response:', dongY ? 'ACCEPTED' : 'DECLINED');
        
        db.ref(`invitations/${userId}`).remove();
        if (!dongY) {
            console.log('[Invite Listener] Invite declined');
            return;
        }
        
        console.log('[Invite Listener] Invite accepted, joining room:', invite.fromRoomId);
        // Đóng lobby screen nếu đang mở
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        vaoPhongLaO(invite.fromRoomId);
    });
}
function kiemTraLoiMoiCho(userId) {
    // Kiểm tra các lời mời đang chờ trong vòng 5 phút
    const fiveMinutesAgo = Date.now() - 300000;
    db.ref(`pending_invites/${userId}`).once('value').then(snap => {
        const invites = snap.val();
        if (!invites) return;
        
        let count = 0;
        for (const key in invites) {
            const invite = invites[key];
            if (invite.status === 'pending' && invite.timestamp > fiveMinutesAgo) {
                count++;
                // Xóa lời mời đã xử lý
                db.ref(`pending_invites/${userId}/${key}`).update({ status: 'seen' });
                
                setTimeout(() => {
                    // Kiểm tra xem người chơi có bận không trước khi hiện lời mời
                    db.ref(`users/${userId}/currentRoomId`).once('value').then(snap => {
                        const currentRoom = snap.val();
                        if (currentRoom) {
                            // Đang bận, bỏ qua lời mời này
                            return;
                        }
                        
                        const dongY = confirm(`🎮 [${invite.fromPlayerName}] đã mời bạn vào phòng solo! Chấp nhận?`);
                        if (dongY) {
                            // Đóng lobby screen nếu đang mở
                            const lobbyScreen = document.getElementById('lobby-screen');
                            if (lobbyScreen) lobbyScreen.style.display = 'none';
                            vaoPhongLaO(invite.fromRoomId);
                        }
                    });
                }, count * 500); // Delay giữa các lời mời
            }
        }
    });
}
// ══════════════════════════════════════════════════════════════════
// 🎮 SETUP EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════
function setupEventListeners() {
    // btn-go-online: bind Firebase lobby logic
    const btnOnline = document.getElementById('btn-go-online');
    if (btnOnline && !btnOnline._firebaseBound) {
        btnOnline._firebaseBound = true;
        btnOnline.addEventListener('click', () => {
            if (!currentUsername) return;
            const lobbyScreen = document.getElementById('lobby-screen');
            if (lobbyScreen) lobbyScreen.style.display = 'block';
            hienDanhSachPhong();
            langNgheBangXepHangOnline();
            langNgheLichSuOnline();
            khoiDongChatTheGioi();
        });
    }
    document.getElementById('btn-close-lobby').addEventListener('click', () => {
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        // Hủy listener danh sách phòng khi đóng lobby
        if (roomsListListener) {
            db.ref('rooms').off('value', roomsListListener);
            roomsListListener = null;
        }
    });
    document.getElementById('btn-quit-match').addEventListener('click', xuLyThoatPhong);
    document.getElementById('btn-leave-match').addEventListener('click', xuLyThoatPhong);
    // beforeunload — đánh dấu offline qua REST API trước khi tab đóng
    window.addEventListener('beforeunload', () => {
        if (!currentRoomId || !myRole || myRole === 'viewer' || !isOnlineMode) return;
        const sf  = myRole === 'X' ? 'playerX_status' : 'playerO_status';
        const url = `https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/${currentRoomId}/${sf}.json`;
        // sendBeacon đảm bảo request được gửi dù tab đang đóng
        navigator.sendBeacon && navigator.sendBeacon(url, JSON.stringify('offline'));
    });
    // Reconnect khi load lại trang
    window.addEventListener('load', () => {
        let restoredMode = null;
        let reconnectRoomId = null;

        if (typeof GameModeManager !== 'undefined') {
            restoredMode = GameModeManager.restoreMode();
            if (restoredMode !== GameModes.NONE && restoredMode !== GameModes.ONLINE) {
                localStorage.removeItem('current_room_id');
                return;
            }
            if (restoredMode === GameModes.ONLINE) {
                const context = GameModeManager.getContext();
                if (context && context.roomId) {
                    reconnectRoomId = context.roomId;
                }
            }
        }

        const savedRoom = localStorage.getItem('current_room_id');
        const savedUser = localStorage.getItem('current_user_id');
        if (!savedUser) return;

        if (restoredMode !== GameModes.NONE && restoredMode !== GameModes.ONLINE) {
            if (!savedRoom) {
                localStorage.removeItem('current_room_id');
                return;
            }
            console.warn('[Firebase Online] Restored mode mismatch but current_room_id exists; attempting online reconnect anyway:', {
                restoredMode,
                savedRoom
            });
            reconnectRoomId = savedRoom;
        }

        const roomId = savedRoom || reconnectRoomId;
        if (!roomId) return;
        if (!savedRoom && reconnectRoomId) {
            localStorage.setItem('current_room_id', roomId);
        }
        if (savedRoom && reconnectRoomId && savedRoom !== reconnectRoomId) {
            console.warn('[Firebase Online] current_room_id and GameModeManager context mismatch, using current_room_id:', {
                savedRoom,
                contextRoom: reconnectRoomId
            });
        }
        db.ref(`rooms/${roomId}`).once('value').then(snap => {
            const room = snap.val();
            if (!room || room.status === 'empty' || room.status === 'ended') {
                localStorage.removeItem('current_room_id');
                if (typeof GameModeManager !== 'undefined' && GameModeManager.getCurrentMode() === GameModes.ONLINE) {
                    GameModeManager.clearMode();
                }
                return;
            }
            const isX = savedUser === room.playerX_id;
            const isO = savedUser === room.playerO_id;
            if (!isX && !isO) {
                localStorage.removeItem('current_room_id');
                if (typeof GameModeManager !== 'undefined' && GameModeManager.getCurrentMode() === GameModes.ONLINE) {
                    GameModeManager.clearMode();
                }
                return;
            }
            currentRoomId     = roomId;
            myRole            = isX ? 'X' : 'O';
            daXoaBanCoTranNay = true;
            currentTurn       = room.turn || 'X';
            currentRule       = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
            const resolvedWinCount = (room && typeof room.winCount === 'number') ? room.winCount :
                (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') ? GameState.roomRules.winCount :
                (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') ? GameState.board.winCount : 5;
            currentWinCount   = resolvedWinCount;
            if (typeof winCount !== 'undefined') winCount = currentWinCount;
            // Sync room rules vào GameState để checkWinSilent dùng đúng luật
            if (typeof GameState !== 'undefined') {
                GameState.roomRules = {
                    winCount: resolvedWinCount,
                    chan2Dau: typeof room.chan2Dau === 'boolean' ? room.chan2Dau : true,
                    firstTurn: room.firstTurn || 'X'
                };
                if (!GameState.board) GameState.board = {};
                GameState.board.winCount = resolvedWinCount;
            }
            window.roomRules = GameState.roomRules;
            // Invalidate cache để ai-nao.js dùng roomRules mới
            if (typeof invalidateBlockBothEndsCache === 'function') {
                invalidateBlockBothEndsCache();
            }
            const sf = myRole === 'X' ? 'playerX_status' : 'playerO_status';
            const startReconnectOnline = () => {
                db.ref(`rooms/${roomId}/${sf}`).set('online');
                setupOnDisconnect(roomId, myRole);
                if (typeof GameModeManager !== 'undefined') {
                    GameModeManager.setMode(GameModes.ONLINE, { roomId, role: myRole });
                }
                batDauGiaoDienOnline();
                // Cập nhật UI ngay lập tức với thông tin phòng hiện tại
                capNhatUIPhongOnline(room);

                const restoreRoomState = () => {
                    if (room.status === 'playing') {
                        phucHoiBanCo(roomId, () => {
                            langNgheThayDoiPhong(roomId);
                            langNgheTinNhan(roomId);
                            setMyOnlineStatus('playing');
                            // BUG 5 FIX: Switch to battle view when reconnecting to a playing game
                            if (typeof switchView === 'function') {
                                switchView('battle');
                            }
                            // Hide navigation during battle
                            if (typeof hideTopNavigation === 'function') {
                                hideTopNavigation();
                            }
                            // YC.TXT FIX: Restore camera position and zoom level after refresh
                            if (typeof vRowF !== 'undefined' && typeof vColF !== 'undefined') {
                                vRowF = 0;
                                vColF = 0;
                            }
                            if (typeof renderInfiniteBoard === 'function') {
                                renderInfiniteBoard();
                            }
                        });
                    } else {
                        langNgheThayDoiPhong(roomId);
                        langNgheTinNhan(roomId);
                        setMyOnlineStatus('free');
                        // BUG 5 FIX: Switch to room view when reconnecting to a waiting game
                        if (typeof switchView === 'function') {
                            switchView('room');
                        }
                    }
                };

                restoreRoomState();
            };
            prepareOnlineSessionForFirebase(roomId, 'reconnect', myRole).then(startReconnectOnline).catch(startReconnectOnline);
        }).catch(() => localStorage.removeItem('current_room_id'));
    });
}

function prepareOnlineSessionForFirebase(roomId, actionDesc, role) {
    if (typeof cleanupBotRoomBeforeOnlineTransition === 'function') {
        cleanupBotRoomBeforeOnlineTransition();
    }
    const prepareFn = (typeof window !== 'undefined' && typeof window.prepareOnlineSession === 'function')
        ? window.prepareOnlineSession
        : null;
    const promise = prepareFn ? prepareFn(roomId, actionDesc) : Promise.resolve();
    return promise.then(() => {
        if (role && typeof GameModeManager !== 'undefined') {
            GameModeManager.setMode(GameModes.ONLINE, { roomId, role });
        }
    }).catch(() => {
        if (role && typeof GameModeManager !== 'undefined') {
            GameModeManager.setMode(GameModes.ONLINE, { roomId, role });
        }
    });
}
// Listener realtime cho danh sách phòng ở sảnh
let roomsListListener = null;
// ══════════════════════════════════════════════════════════════════
// 🏠 HIỆN DANH SÁCH 20 PHÒNG (realtime)
// ══════════════════════════════════════════════════════════════════
function hienDanhSachPhong() {
    const container = document.getElementById('room-list');
    if (!container) return;
    // Tab Bot không cần Firebase — tránh ghi đè "Đang tải..." lên BotRoomManager
    if (currentRoomTab === 'bot') {
        if (typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.openBotLobby === 'function') {
            BotRoomManager.openBotLobby();
        }
        return;
    }
    container.innerHTML = '<p style="color:#888;">Đang tải...</p>';
    // Hủy listener cũ nếu có
    if (roomsListListener) {
        db.ref('rooms').off('value', roomsListListener);
        roomsListListener = null;
    }
    roomsListListener = db.ref('rooms').on('value', snap => {
        // Không render nếu đã vào phòng (lobby đóng rồi)
        const lobbyScreen = document.getElementById('lobby-screen');
        if (!lobbyScreen || lobbyScreen.style.display === 'none') return;
        // Tab Bot không cần Firebase — BotRoomManager đã xử lý
        if (currentRoomTab === 'bot') return;
        const rooms = snap.val();
        container.innerHTML = '';
        // Render rooms based on current tab
        if (currentRoomTab === 'normal') {
            for (let i = 1; i <= TOTAL_NORMAL_ROOMS; i++) {
                const roomId = `phong_${i}`;
                const room   = (rooms && rooms[roomId]) || taoDataPhongRong(i, false);
                const el = renderRoomCard(room, roomId, 'normal');
                container.appendChild(el);
            }
        } else {
            // VIP tab
            for (let i = 1; i <= TOTAL_VIP_ROOMS; i++) {
                const roomNum = TOTAL_NORMAL_ROOMS + i;
                const roomId = `phong_${roomNum}`;
                const room   = (rooms && rooms[roomId]) || taoDataPhongRong(roomNum, true);
                const el = renderRoomCard(room, roomId, 'vip');
                container.appendChild(el);
            }
        }
    });
}
// ══════════════════════════════════════════════════════════════════
// 🪑 VÀO PHÒNG (NGỒi GHẾ X HOẶC O)
// ══════════════════════════════════════════════════════════════════
function ngoimVaoPhong(roomId) {
    if (!currentUsername) { alert('Vui lòng đăng nhập trước!'); return; }
    const myId   = localStorage.getItem('current_user_id');
    const myName = tenCuaToi();
    const currentMode = typeof GameModeManager !== 'undefined' && typeof GameModeManager.getCurrentMode === 'function'
        ? GameModeManager.getCurrentMode()
        : null;
    
    // YC.TXT FIX: Cleanup previous mode before joining Online
    cleanupBotRoomBeforeOnlineTransition();
    
    // Cleanup REPLAY mode
    if (currentMode === 'replay' || (typeof GameModes !== 'undefined' && currentMode === GameModes.REPLAY)) {
        if (typeof closeHistoryView === 'function') {
            closeHistoryView();
        }
    }
    
    // Cleanup TRAINING mode
    if (currentMode === 'training' || (typeof GameModes !== 'undefined' && currentMode === GameModes.TRAINING)) {
        if (typeof PracticeMode !== 'undefined' && typeof PracticeMode.exit === 'function') {
            PracticeMode.exit();
        }
    }
    
    // Cleanup SOLO mode
    if (currentMode === 'solo' || (typeof GameModes !== 'undefined' && currentMode === GameModes.SOLO)) {
        if (typeof isGameActive !== 'undefined') {
            isGameActive = false;
        }
    }
    
    const roomRef = db.ref(`rooms/${roomId}`);
    roomRef.transaction(room => {
        // Firebase gọi lần đầu với null — trả null để retry với dữ liệu thực
        if (!room) {
            return null;
        }
        if (room.status === 'playing') {
            return; // abort — đang chơi
        }
        // Kiểm tra phòng "ma": status=waiting nhưng playerX offline lâu và không có O
        const now = Date.now();
        const isStale = (now - (room.updatedAt || 0)) > ROOM_STALE_MS;
        const xOffline = room.playerX_status !== 'online';
        if (room.status === 'waiting' && room.playerX_id && !room.playerO_id && xOffline && isStale) {
            // Phòng bỏ hoang — coi như empty, cho người mới vào làm X
            room.playerX_id = ''; room.playerX_name = ''; room.playerX_status = 'offline';
            room.status = 'empty';
        }
        if (!room.playerX_id || room.status === 'empty' || room.status === 'ended') {
            // Ngồi ghế X — reset phòng về waiting sạch
            room.playerX_id     = myId;
            room.playerX_name   = myName;
            room.playerX_status = 'online';
            room.playerO_id     = '';
            room.playerO_name   = '';
            room.playerO_status = 'offline';
            room.status         = 'waiting';
            room.winner         = '';
            room.endReason      = '';
            room.moves          = { init: true };
            room.lastMove       = { row: -1, col: -1, by: '' };
            room.updatedAt      = Date.now();
            // Đồng bộ avatar & skin ngay trong transaction
            const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
            room.playerX_avatar = profile.avatarDisplay || '';
            room.playerX_skin = profile.skinId || 'skin_default';
            return room;
        } else if (!room.playerO_id && room.playerX_id !== myId) {
            // Ngồi ghế O
            room.playerO_id     = myId;
            room.playerO_name   = myName;
            room.playerO_status = 'online';
            room.updatedAt      = Date.now();
            // Đồng bộ avatar & skin ngay trong transaction
            const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
            room.playerO_avatar = profile.avatarDisplay || '';
            room.playerO_skin = profile.skinId || 'skin_default';
            return room;
        }
        // Cả 2 ghế đầy hoặc mình đã ngồi — abort
        return;
    }).then(result => {
        if (!result.committed) { 
            alert('Phòng đã đầy hoặc không thể vào!'); 
            return; 
        }
        const room = result.snapshot.val();
        currentRoomId     = roomId;
        // YC.TXT FIX: Create new session ID for this join
        if (typeof currentSessionId !== 'undefined') currentSessionId = Date.now().toString();
        myRole            = room.playerX_id === myId ? 'X' : 'O';
        daXoaBanCoTranNay = false;
        localStorage.setItem('current_room_id', roomId);
        // Cập nhật currentRoomId lên Firebase để người khác biết đang bận
        db.ref(`users/${myId}/currentRoomId`).set(roomId);

        // YC.TXT FIX: Set mode to ONLINE when entering room
        if (typeof GameModeManager !== 'undefined') {
            GameModeManager.setMode(GameModes.ONLINE, { roomId: roomId, role: myRole });
        }

        setupOnDisconnect(roomId, myRole);
        // Đóng lobby và hủy listener danh sách phòng
        if (roomsListListener) {
            db.ref('rooms').off('value', roomsListListener);
            roomsListListener = null;
        }
        const lobbyScreen = document.getElementById('lobby-screen');
        if (lobbyScreen) lobbyScreen.style.display = 'none';
        batDauGiaoDienOnline();
        langNgheThayDoiPhong(roomId);
        langNgheTinNhan(roomId);
        setMyOnlineStatus('free');
    }).catch(err => { 
        console.error('[DEBUG-ENTER] Transaction error:', err);
        alert('Lỗi kết nối: ' + err.message); 
    });
}
window.ngoimVaoPhong = ngoimVaoPhong;
function vaoLaiPhong(roomId) {
    const myId = localStorage.getItem('current_user_id');
    const myName = tenCuaToi();
    cleanupBotRoomBeforeOnlineTransition();
    
    db.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) {
            alert('Phòng không tồn tại hoặc đã bị xóa!');
            localStorage.removeItem('current_room_id');
            hienDanhSachPhong();
            return;
        }
        
        const isX = myId === room.playerX_id;
        const isO = myId === room.playerO_id;
        
        if (isX || isO) {
            // Vẫn là player cũ → chỉ update avatar/skin
            const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
            const pfUpdate = isX
                ? { playerX_avatar: profile.avatarDisplay || '', playerX_skin: profile.skinId || 'skin_default' }
                : { playerO_avatar: profile.avatarDisplay || '', playerO_skin: profile.skinId || 'skin_default' };
            
            db.ref(`rooms/${roomId}`).update(pfUpdate).then(() => {
                currentRoomId     = roomId;
                // YC.TXT FIX: Create new session ID for this rejoin
                if (typeof currentSessionId !== 'undefined') currentSessionId = Date.now().toString();
                myRole            = isX ? 'X' : 'O';
                daXoaBanCoTranNay = true;
                currentTurn       = room.turn || 'X';
                currentRule       = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
                const resolvedWinCount2 = (room && typeof room.winCount === 'number') ? room.winCount :
                    (typeof GameState !== 'undefined' && GameState.roomRules && typeof GameState.roomRules.winCount === 'number') ? GameState.roomRules.winCount :
                    (typeof GameState !== 'undefined' && GameState.board && typeof GameState.board.winCount === 'number') ? GameState.board.winCount : 5;
                currentWinCount   = resolvedWinCount2;
                if (typeof winCount !== 'undefined') winCount = currentWinCount;
                // Sync room rules vào GameState để checkWinSilent dùng đúng luật
                if (typeof GameState !== 'undefined') {
                    GameState.roomRules = {
                        winCount: resolvedWinCount2,
                        chan2Dau: typeof room.chan2Dau === 'boolean' ? room.chan2Dau : true,
                        firstTurn: room.firstTurn || 'X'
                    };
                    if (!GameState.board) GameState.board = {};
                    GameState.board.winCount = resolvedWinCount2;
                }
                window.roomRules = GameState.roomRules;
                // Invalidate cache để ai-nao.js dùng roomRules mới
                if (typeof invalidateBlockBothEndsCache === 'function') {
                    invalidateBlockBothEndsCache();
                }
                localStorage.setItem('current_room_id', roomId);
                // Cập nhật currentRoomId lên Firebase
                const myId = localStorage.getItem('current_user_id');
                db.ref(`users/${myId}/currentRoomId`).set(roomId);
                const sf = myRole === 'X' ? 'playerX_status' : 'playerO_status';
                db.ref(`rooms/${roomId}/${sf}`).set('online');
                setupOnDisconnect(roomId, myRole);
                const lobbyScreen = document.getElementById('lobby-screen');
                if (lobbyScreen) lobbyScreen.style.display = 'none';
                // YC.TXT FIX: Hide header when rejoining battle
                if (typeof hideTopNavigation === 'function') {
                    hideTopNavigation();
                }
                if (typeof prepareOnlineSessionForFirebase === 'function') {
                    prepareOnlineSessionForFirebase(roomId, 'rejoin', myRole).then(() => batDauGiaoDienOnline()).catch(() => batDauGiaoDienOnline());
                } else {
                    if (typeof GameModeManager !== 'undefined') {
                        GameModeManager.setMode(GameModes.ONLINE, { roomId: roomId, role: myRole });
                    }
                    batDauGiaoDienOnline();
                }
                // Cập nhật UI ngay lập tức với thông tin phòng hiện tại
                capNhatUIPhongOnline(room);
                if (room.status === 'playing') {
                    phucHoiBanCo(roomId, () => { langNgheThayDoiPhong(roomId); langNgheTinNhan(roomId); });
                } else {
                    langNgheThayDoiPhong(roomId); langNgheTinNhan(roomId);
                }
                setMyOnlineStatus(room.status === 'playing' ? 'playing' : 'free');
            }).catch(err => {
                console.error('[DEBUG-REENTER] Update error:', err);
                alert('Lỗi kết nối: ' + err.message);
            });
            return;
        }
        
        // Không còn là player → kiểm tra có slot trống không
        if (room.status === 'playing') {
            // Đang chơi → vào xem
            xemPhong(roomId);
            return;
        }
        
        if (!room.playerX_id || room.status === 'empty' || room.status === 'ended') {
            // Slot X trống → vào làm X
            const roomRef = db.ref(`rooms/${roomId}`);
            roomRef.transaction(r => {
                if (!r) return null;
                if (r.playerX_id && r.playerX_id !== myId) return; // slot đã có người khác
                const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
                r.playerX_id = myId;
                r.playerX_name = myName;
                r.playerX_status = 'online';
                r.playerO_id = '';
                r.playerO_name = '';
                r.playerO_status = 'offline';
                r.status = 'waiting';
                r.winner = '';
                r.endReason = '';
                r.moves = { init: true };
                r.lastMove = { row: -1, col: -1, by: '' };
                r.updatedAt = Date.now();
                r.playerX_avatar = profile.avatarDisplay || '';
                r.playerX_skin = profile.skinId || 'skin_default';
                return r;
            }).then(result => {
                if (!result.committed) { alert('Không thể vào phòng!'); return; }
                const r = result.snapshot.val();
                if (!r) { alert('Phòng không tồn tại!'); return; }
                currentRoomId     = roomId;
                myRole            = 'X';
                daXoaBanCoTranNay = true;
                currentTurn       = r.turn || 'X';
                currentRule       = r.chan2Dau ? 'chan_2_dau' : 'tu_do';
                currentWinCount   = resolveRoomWinCount(r);
                if (typeof winCount !== 'undefined') winCount = currentWinCount;
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerX_status`).set('online');
                setupOnDisconnect(roomId, 'X');
                const lobbyScreen = document.getElementById('lobby-screen');
                if (lobbyScreen) lobbyScreen.style.display = 'none';
                if (typeof prepareOnlineSessionForFirebase === 'function') {
                    prepareOnlineSessionForFirebase(roomId, 'rejoin', 'X').then(() => batDauGiaoDienOnline()).catch(() => batDauGiaoDienOnline());
                } else {
                    if (typeof GameModeManager !== 'undefined') {
                        GameModeManager.setMode(GameModes.ONLINE, { roomId: roomId, role: 'X' });
                    }
                    batDauGiaoDienOnline();
                }
                langNgheThayDoiPhong(roomId); langNgheTinNhan(roomId);
                setMyOnlineStatus('free');
            }).catch(err => {
                console.error('[DEBUG-REENTER] Transaction error:', err);
                alert('Lỗi kết nối: ' + err.message);
            });
        } else if (!room.playerO_id && room.playerX_id !== myId) {
            // Slot O trống → vào làm O
            const roomRef = db.ref(`rooms/${roomId}`);
            roomRef.transaction(r => {
                if (!r) return null;
                if (r.playerO_id && r.playerO_id !== myId) return; // slot đã có người khác
                const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
                r.playerO_id = myId;
                r.playerO_name = myName;
                r.playerO_status = 'online';
                r.updatedAt = Date.now();
                r.playerO_avatar = profile.avatarDisplay || '';
                r.playerO_skin = profile.skinId || 'skin_default';
                return r;
            }).then(result => {
                if (!result.committed) { alert('Không thể vào phòng!'); return; }
                const r = result.snapshot.val();
                if (!r) { alert('Phòng không tồn tại!'); return; }
                currentRoomId     = roomId;
                myRole            = 'O';
                daXoaBanCoTranNay = false;
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerO_status`).set('online');
                setupOnDisconnect(roomId, 'O');
                if (typeof prepareOnlineSessionForFirebase === 'function') {
                    prepareOnlineSessionForFirebase(roomId, 'rejoin', 'O').then(() => batDauGiaoDienOnline()).catch(() => batDauGiaoDienOnline());
                } else {
                    if (typeof GameModeManager !== 'undefined') {
                        GameModeManager.setMode(GameModes.ONLINE, { roomId: roomId, role: 'O' });
                    }
                    batDauGiaoDienOnline();
                }
                langNgheThayDoiPhong(roomId); langNgheTinNhan(roomId);
                setMyOnlineStatus('free');
            }).catch(err => {
                console.error('[DEBUG-REENTER] Transaction error:', err);
                alert('Lỗi kết nối: ' + err.message);
            });
        } else {
            // Không có slot trống → vào xem
            xemPhong(roomId);
        }
    }).catch(err => {
        console.error('[DEBUG-REENTER] Fetch error:', err);
        alert('Lỗi kết nối: ' + err.message);
    });
}
window.vaoLaiPhong = vaoLaiPhong;
function vaoPhongLaO(roomId) {
    if (!currentUsername) { alert('Vui lòng đăng nhập!'); return; }
    cleanupBotRoomBeforeOnlineTransition();
    const myId   = localStorage.getItem('current_user_id');
    const myName = tenCuaToi();
    const roomRef = db.ref(`rooms/${roomId}`);
    roomRef.transaction(room => {
        if (!room) return null; // retry
        if (room.playerO_id && room.playerO_id !== myId) return; // abort — ghế O đã có
        if (room.playerX_id === myId) return; // abort — không tự đấu mình
        room.playerO_id     = myId;
        room.playerO_name   = myName;
        room.playerO_status = 'online';
        room.updatedAt      = Date.now();
        // Đồng bộ avatar & skin ngay trong transaction
        const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
        room.playerO_avatar = profile.avatarDisplay || '';
        room.playerO_skin = profile.skinId || 'skin_default';
        return room;
    }).then(result => {
        if (!result.committed) { alert('Ghế O đã có người!'); return; }
        const room = result.snapshot.val();
        currentRoomId     = roomId;
        myRole            = 'O';
        daXoaBanCoTranNay = false;
        localStorage.setItem('current_room_id', roomId);
        // Cập nhật currentRoomId lên Firebase để người khác biết đang bận
        db.ref(`users/${myId}/currentRoomId`).set(roomId);
        setupOnDisconnect(roomId, 'O');
        if (typeof prepareOnlineSessionForFirebase === 'function') {
            prepareOnlineSessionForFirebase(roomId, 'join-O', 'O').then(() => batDauGiaoDienOnline()).catch(() => batDauGiaoDienOnline());
        } else {
            if (typeof GameModeManager !== 'undefined') {
                GameModeManager.setMode(GameModes.ONLINE, { roomId: roomId, role: 'O' });
            }
            batDauGiaoDienOnline();
        }
        langNgheThayDoiPhong(roomId);
        langNgheTinNhan(roomId);
        setMyOnlineStatus('free');
    }).catch(err => {
        console.error('[DEBUG-JOIN-O] Transaction error:', err);
        alert('Lỗi kết nối: ' + err.message);
    });
}
function xemPhong(roomId) {
    cleanupBotRoomBeforeOnlineTransition();
    currentRoomId = roomId;
    myRole        = 'viewer';
    daXoaBanCoTranNay = true;
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.style.display = 'none';
    const proceedToOnlineView = () => {
        if (typeof GameModeManager !== 'undefined') {
            GameModeManager.setMode(GameModes.ONLINE, { roomId, role: 'viewer' });
        }
        batDauGiaoDienOnline();
    };
    if (typeof prepareOnlineSessionForFirebase === 'function') {
        prepareOnlineSessionForFirebase(roomId, 'view', 'viewer').then(proceedToOnlineView).catch(proceedToOnlineView);
    } else {
        proceedToOnlineView();
    }
    db.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (room && room.status === 'playing') {
            phucHoiBanCo(roomId, () => { langNgheThayDoiPhong(roomId); });
        } else {
            langNgheThayDoiPhong(roomId);
        }
    });
}
window.xemPhong = xemPhong;
// onDisconnect: set offline + cập nhật lastActive để cleanup manager có thể dọn
function setupOnDisconnect(roomId, role) {
    const sf  = role === 'X' ? 'playerX_status' : 'playerO_status';
    const ref = db.ref(`rooms/${roomId}/${sf}`);
    ref.onDisconnect().set('offline');
    // Ghi dấu thời gian mất kết nối để Room Cleanup Manager nhận biết phòng bỏ hoang
    db.ref(`rooms/${roomId}`).onDisconnect().update({ updatedAt: Date.now() });
    // Hủy listener cũ của roomId này nếu có
    if (_connectedListeners[roomId]) {
        db.ref('.info/connected').off('value', _connectedListeners[roomId]);
    }
    // Khi reconnect → restore online và cập nhật lastActive
    _connectedListeners[roomId] = db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true && currentRoomId === roomId) {
            ref.set('online');
            db.ref(`rooms/${roomId}`).update({ updatedAt: Date.now() });
        }
    });
    // Giữ connectedListener trỏ đến listener hiện tại (dùng trong cleanup)
    connectedListener = _connectedListeners[roomId];
}
// ══════════════════════════════════════════════════════════════════
// 🧹 ROOM CLEANUP MANAGER — Dọn phòng "ma" định kỳ
// ══════════════════════════════════════════════════════════════════
let _roomCleanupTimer = null;
const ROOM_STALE_MS   = 5 * 60 * 1000;  // 5 phút không hoạt động → phòng bỏ hoang
const ROOM_CLEANUP_INTERVAL = 60 * 1000; // Quét mỗi 60 giây
function _isPlayerReallyOnline(playerStatus) {
    return playerStatus === 'online';
}
function _cleanupStaleRoom(roomId, room) {
    const now = Date.now();
    const lastActive = room.updatedAt || 0;
    const isStale = (now - lastActive) > ROOM_STALE_MS;
    // Trường hợp 1: status = waiting nhưng playerX offline/không có thực
    if (room.status === 'waiting') {
        const xOnline = _isPlayerReallyOnline(room.playerX_status);
        const oOnline = _isPlayerReallyOnline(room.playerO_status);
        if (!room.playerX_id && !room.playerO_id) {
            // Không có ai — dọn về empty
            return db.ref(`rooms/${roomId}`).update({
                status: 'empty', playerX_id: '', playerX_name: '', playerX_status: 'offline',
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                winner: '', endReason: '', moves: { init: true },
                lastMove: { row: -1, col: -1, by: '' }, updatedAt: now
            });
        }
        if (room.playerX_id && !xOnline && isStale && !room.playerO_id) {
            // playerX bỏ hoang, không có O → dọn về empty
            return db.ref(`rooms/${roomId}`).update({
                status: 'empty', playerX_id: '', playerX_name: '', playerX_status: 'offline',
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                winner: '', endReason: '', moves: { init: true },
                lastMove: { row: -1, col: -1, by: '' }, updatedAt: now
            });
        }
        if (room.playerX_id && !xOnline && isStale && room.playerO_id && oOnline) {
            // X bỏ hoang nhưng O vẫn online → cho O lên làm X, chờ đối thủ
            return db.ref(`rooms/${roomId}`).update({
                playerX_id: room.playerO_id, playerX_name: room.playerO_name,
                playerX_status: room.playerO_status,
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                status: 'waiting', updatedAt: now
            });
        }
        if (isStale && !xOnline && !oOnline) {
            // Cả hai offline lâu → dọn về empty
            return db.ref(`rooms/${roomId}`).update({
                status: 'empty', playerX_id: '', playerX_name: '', playerX_status: 'offline',
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                winner: '', endReason: '', moves: { init: true },
                lastMove: { row: -1, col: -1, by: '' }, updatedAt: now
            });
        }
    }
    // Trường hợp 2: status = playing nhưng cả hai đều offline + stale
    if (room.status === 'playing') {
        const xOnline = _isPlayerReallyOnline(room.playerX_status);
        const oOnline = _isPlayerReallyOnline(room.playerO_status);
        if (!xOnline && !oOnline && isStale) {
            return db.ref(`rooms/${roomId}`).update({
                status: 'empty', playerX_id: '', playerX_name: '', playerX_status: 'offline',
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                winner: '', endReason: '', moves: { init: true },
                lastMove: { row: -1, col: -1, by: '' }, updatedAt: now
            });
        }
    }
    // Trường hợp 3: status = ended lâu mà không ai dọn
    if (room.status === 'ended' && isStale) {
        const xHere = !!room.playerX_id;
        const oHere = !!room.playerO_id;
        const xOnline = _isPlayerReallyOnline(room.playerX_status);
        const oOnline = _isPlayerReallyOnline(room.playerO_status);
        if (!xOnline && !oOnline) {
            const newStatus = (xHere || oHere) ? 'waiting' : 'empty';
            const upd = {
                status: newStatus, winner: '', endReason: '',
                moves: { init: true }, lastMove: { row: -1, col: -1, by: '' }, updatedAt: now
            };
            if (!xHere && !oHere) {
                upd.playerX_id = ''; upd.playerX_name = ''; upd.playerX_status = 'offline';
                upd.playerO_id = ''; upd.playerO_name = ''; upd.playerO_status = 'offline';
            }
            return db.ref(`rooms/${roomId}`).update(upd);
        }
    }
    return Promise.resolve();
}
function runRoomCleanup() {
    if (!db) return;
    db.ref('rooms').once('value').then(snap => {
        const rooms = snap.val();
        if (!rooms) return;
        for (let i = 1; i <= TOTAL_ROOMS; i++) {
            const roomId = `phong_${i}`;
            const room = rooms[roomId];
            if (!room) continue;
            // Không dọn phòng mình đang ở
            if (roomId === currentRoomId) continue;
            _cleanupStaleRoom(roomId, room).catch(e => console.warn('[Cleanup] Lỗi dọn phòng', roomId, e));
        }
    });
}
function startRoomCleanupManager() {
    if (_roomCleanupTimer) clearInterval(_roomCleanupTimer);
    // Chạy lần đầu sau 10 giây (tránh chạy ngay khi login)
    setTimeout(() => {
        runRoomCleanup();
        _roomCleanupTimer = setInterval(runRoomCleanup, ROOM_CLEANUP_INTERVAL);
    }, 10000);
}
function stopRoomCleanupManager() {
    if (_roomCleanupTimer) { clearInterval(_roomCleanupTimer); _roomCleanupTimer = null; }
}
window.runRoomCleanup = runRoomCleanup;
// ══════════════════════════════════════════════════════════════════
// 🎮 GIAO DIỆN PHÒNG ĐẤU
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// 📢 THANH THÔNG BÁO HỆ THỐNG (tái sử dụng khung thoại bot khi online)
// ══════════════════════════════════════════════════════════════
function thongBaoHeThong(msg) {
    const av = document.getElementById('bot-avatar');
    const bm = document.getElementById('bot-message');
    if (!av || !bm) return;
    av.classList.add('online-announce');
    av.style.display = 'flex';
    bm.textContent = msg;
}
window.thongBaoHeThong = thongBaoHeThong;
// ── Tên hiển thị an toàn: displayName → username/name → email → fallback ──
// Tránh trường hợp tài khoản chưa đặt tên (null/undefined/rỗng) làm mất tên người gửi
function tenHienThi(u, fallback) {
    if (u) {
        const t = u.displayName || u.username || u.name ||
                  (u.email ? String(u.email).split('@')[0] : '');
        if (t && String(t).trim()) return String(t).trim();
    }
    return fallback || 'Người chơi';
}
function tenSafe(name, fallback) {
    return (name && String(name).trim()) ? String(name).trim() : (fallback || 'Người chơi');
}
// Tên của chính mình — fallback "Khách xxxx" theo đuôi user id
function tenCuaToi() {
    const myId = localStorage.getItem('current_user_id') || '';
    const fb   = (currentUsername && String(currentUsername).trim())
        ? String(currentUsername).trim()
        : ('Khách ' + (myId ? myId.slice(-4) : Math.floor(Math.random() * 1000)));
    return tenHienThi(currentUserData, fb);
}
function batDauGiaoDienOnline() {
    // YC.TXT FIX: Force full Battle Lifecycle on each join
    // Destroy any existing SharedBoardUI instance to ensure clean state
    if (typeof SharedBoardUI !== 'undefined' && SharedBoardUI.Lifecycle.state === 'running') {
        SharedBoardUI.destroy();
    }
    
    // YC.TXT FIX: Only render Online UI if in ONLINE mode
    const currentMode = typeof GameModeManager !== 'undefined' ? GameModeManager.getCurrentMode() : null;
    const isOnlineModeCheck = currentMode === 'online' || (typeof GameModes !== 'undefined' && currentMode === GameModes.ONLINE);
    
    if (!isOnlineModeCheck) {
        console.warn('[batDauGiaoDienOnline] Skipping Online UI render - not in ONLINE mode:', currentMode);
        return;
    }
    
    document.body.classList.add('in-game-active');
    isOnlineMode = true;
    // YC.TXT FIX: KHÔNG reset infCanvasInitialized - Board First architecture
    // Canvas được inject và giữ nguyên, chỉ reset khi thực sự cần thay đổi canvas
    // if (typeof infCanvasInitialized !== 'undefined') {
    //     const isAlreadyOnlineCanvas = (typeof infCanvas !== 'undefined' && infCanvas && infCanvas.id === 'inf-canvas-online');
    //     if (!isAlreadyOnlineCanvas) {
    //         infCanvasInitialized = false;
    //     }
    // }
    // Online luôn dùng infinite canvas
    if (typeof isInfinite !== 'undefined') {
        isInfinite = true;
    }
    const onlineBanner = document.getElementById('online-status-banner');
    if (onlineBanner) onlineBanner.style.display = 'block';
    const gameTitle = document.getElementById('game-title');
    if (gameTitle) gameTitle.style.display = 'none';
    const controlWrapper = document.querySelector('.control-wrapper');
    if (controlWrapper) controlWrapper.style.display = 'none';
    const panelsWrapper = document.querySelector('.panels-wrapper');
    if (panelsWrapper) panelsWrapper.style.display = 'none';
    const uiBtnRestart = document.getElementById('ui-btn-restart');
    if (uiBtnRestart) uiBtnRestart.style.display = 'none';
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = 'none';
    // Ẩn app-header để bàn cờ chiếm toàn màn hình
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'none';
    // Ẩn navigation khi vào trận
    if (typeof hideTopNavigation === 'function') {
        hideTopNavigation();
    }
    // Khởi tạo chat state (minimized trên mobile, expanded trên desktop)
    if (typeof initBattleChatState === 'function') {
        initBattleChatState();
    }
    // GIỮ avatar bên trái (🤖, sau đổi thành avatar đối thủ khi load được),
    // khung chữ bên cạnh hiện trạng thái trận đấu realtime
    const botAv = document.getElementById('bot-avatar');
    if (botAv) {
        botAv.classList.add('online-announce');
        botAv.style.display = 'flex';
        const face = botAv.querySelector('.bot-face');
        if (face) face.textContent = '🤖';
    }
    thongBaoHeThong('🔗 Đã kết nối phòng đấu!');
    const gms = document.getElementById('game-match-screen');
    if (gms) gms.style.display = 'block';
    // Hiện panel cược cho chủ phòng (X)
    if (typeof capNhatHienThiBetPanel === 'function') capNhatHienThiBetPanel();
    if (typeof window.xoaBanCoCu === 'function' && !daXoaBanCoTranNay) window.xoaBanCoCu();
    // Reset hover ngay khi vào phòng
    
    // Áp dụng board skin từ shop khi vào phòng online
    // Đảm bảo currentUserData đã được cập nhật trước khi áp dụng skin
    const uid = localStorage.getItem('current_user_id');
    if (uid && typeof db !== 'undefined' && db) {
        db.ref(`users/${uid}`).once('value').then(snap => {
            const data = snap.val();
            if (data && typeof currentUserData !== 'undefined') {
                Object.assign(currentUserData, data);
            }
            if (typeof applyBoardSkinToEngine === 'function') {
                applyBoardSkinToEngine();
            }
            if (typeof renderInfiniteBoard === 'function') {
                renderInfiniteBoard();
            }
        });
    } else if (typeof applyBoardSkinToEngine === 'function') {
        setTimeout(() => applyBoardSkinToEngine(), 500);
    }
    if (typeof infHoverR !== 'undefined') { infHoverR = null; infHoverC = null; }
    // Đồng bộ kích thước canvas với khung online sau khi layout ổn định
    setTimeout(() => {
        if (typeof fitCanvasToContainer === 'function') fitCanvasToContainer();
    }, 200);
    // Mobile back button
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = function() {
        if (confirm('Thoát phòng?')) xuLyThoatPhong();
        else window.history.pushState(null, null, window.location.href);
    };
}
function thoatGiaoDienOnline() {
    document.body.classList.remove('in-game-active');
    isOnlineMode      = false;
    window.onpopstate = null;
    
    // YC.TXT FIX: Clear mode from GameModeManager
    if (typeof GameModeManager !== 'undefined') {
        GameModeManager.clearMode();
    }
    
    // YC.TXT FIX: Cleanup Online mode completely
    cleanupOnlineMode();
    
    // Đóng overlay ván mới nếu còn hiện
    const vmOv = document.getElementById('van-moi-overlay');
    if (vmOv) vmOv.remove();
    const onlineBanner = document.getElementById('online-status-banner');
    if (onlineBanner) onlineBanner.style.display = 'none';
    const gameTitle = document.getElementById('game-title');
    if (gameTitle) gameTitle.style.display = 'block';
    const controlWrapper = document.querySelector('.control-wrapper');
    if (controlWrapper) controlWrapper.style.display = 'block';
    const panelsWrapper = document.querySelector('.panels-wrapper');
    if (panelsWrapper) panelsWrapper.style.display = 'flex';
    const uiBtnRestart = document.getElementById('ui-btn-restart');
    if (uiBtnRestart) uiBtnRestart.style.display = 'block';
    const topBarRestore = document.getElementById('top-bar');
    if (topBarRestore) topBarRestore.style.display = 'flex';
    // Hiện lại app-header sau khi rời trận
    const appHeaderRestore = document.getElementById('app-header');
    if (appHeaderRestore) appHeaderRestore.style.display = '';
    // Hiện lại navigation khi thoát trận
    if (typeof showTopNavigation === 'function') {
        showTopNavigation();
    }
    const botAv = document.getElementById('bot-avatar');
    if (botAv) {
        botAv.classList.remove('online-announce');
        botAv.style.display = 'flex';
        const face = botAv.querySelector('.bot-face');
        if (face) face.textContent = '🤖';
    }
    const bmReset = document.getElementById('bot-message');
    if (bmReset) bmReset.textContent = 'Xin chào! Tôi là Bot của anh Chần';
    const gms = document.getElementById('game-match-screen');
    if (gms) gms.style.display = 'none';
    const turnEl = document.getElementById('turn-indicator');
    if (turnEl) { turnEl.textContent = '⏳ Đang chờ bắt đầu...'; turnEl.className = ''; }
    const panelX = document.getElementById('panel-playerX');
    if (panelX) panelX.style.display = 'none';
    const panelO = document.getElementById('panel-playerO');
    if (panelO) panelO.style.display = 'none';
    setMyOnlineStatus('free');
    // REMOVED initGame() call - causes conflicts when exiting online mode
    // The board state should be cleared by _resetSauThoat instead
}

// ══ YC.TXT FIX: Cleanup Online mode completely ═════════════════════
function cleanupOnlineMode() {
    // Cleanup SharedBoardUI if used
    if (typeof SharedBoardUI !== 'undefined') {
        SharedBoardUI.destroy();
    }

    // Clear Firebase listeners
    if (typeof currentRoomId !== 'undefined' && currentRoomId) {
        if (typeof db !== 'undefined') {
            db.ref(`rooms/${currentRoomId}`).off();
        }
    }
    if (roomListener && currentRoomId) {
        if (typeof db !== 'undefined') {
            db.ref(`rooms/${currentRoomId}`).off('value', roomListener);
        }
        roomListener = null;
    }
    _currentListeningRoomId = null;

    // Reset battle countdown UI / timer in case online mode exits mid-game
    if (typeof _resetBattleCountdown === 'function') {
        _resetBattleCountdown();
    }

    // Clear Online state
    currentRoomId = null;
    myRole = null;
    window._suppressOnlineWinOverlay = false;
    window._suppressOnlineWinOverlayRoom = null;

    // Clear localStorage
    localStorage.removeItem('current_room_id');
}
// ══════════════════════════════════════════════════════════════════
// 🚪 THOÁT PHÒNG
// ══════════════════════════════════════════════════════════════════
function xuLyThoatPhong() {
    // Show navigation when exiting battle
    if (typeof showTopNavigation === 'function') {
        showTopNavigation();
    }
    if (!currentRoomId) { thoatGiaoDienOnline(); return; }
    roiKhoiPhong();
}
window.xuLyThoatPhong = xuLyThoatPhong;
// ══ YC.TXT FIX: Đầu hàng trong Online Room ═════════════════════════════════
function surrenderOnlineGame() {
    if (!currentRoomId || !myRole) {
        alert('Bạn không trong phòng!');
        return;
    }
    
    if (myRole === 'viewer') {
        alert('Người xem không thể đầu hàng!');
        return;
    }
    
    if (confirm('Bạn có chắc muốn đầu hàng? Bạn sẽ thua trận này.')) {
        db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
            const room = snap.val();
            if (!room || room.status !== 'playing') {
                alert('Trận đấu chưa bắt đầu hoặc đã kết thúc!');
                return;
            }
            
            const opponentRole = myRole === 'X' ? 'O' : 'X';
            const opponentName = myRole === 'X' ? room.playerO_name : room.playerX_name;
            
            // Cập nhật kết quả trên Firebase
            db.ref(`rooms/${currentRoomId}`).update({
                status: 'ended',
                winner: opponentRole,
                endReason: `${myRole} đầu hàng`,
                endedAt: Date.now()
            }).then(() => {
                thongBaoHeThong(`🏳️ Bạn đã đầu hàng! ${opponentName} thắng!`);
            });
        });
    }
}
window.surrenderOnlineGame = surrenderOnlineGame;
function roiKhoiPhong(onDone) {
    if (!currentRoomId) { 
        if (onDone) onDone(); 
        return; 
    }
    const rid  = currentRoomId;
    const role = myRole;
    const myId = localStorage.getItem('current_user_id');
    
    console.log('[Room Cleanup] ===== LEAVING ROOM =====');
    console.log('[Room Cleanup] RoomId:', rid);
    console.log('[Room Cleanup] Role:', role);
    console.log('[Room Cleanup] UserId:', myId);
    
    const done = () => {
        // Xóa currentRoomId khỏi Firebase khi thoát
        console.log('[Room Cleanup] Removing currentRoomId from Firebase...');
        db.ref(`users/${myId}/currentRoomId`).remove().then(() => {
            console.log('[Room Cleanup] ✓ currentRoomId removed successfully');
            // Xóa localStorage để tránh auto rejoin
            localStorage.removeItem('current_room_id');
            console.log('[Room Cleanup] ✓ localStorage current_room_id removed');
            _resetSauThoat(rid);
            // Re-attach invite listener after leaving room
            console.log('[Room Cleanup] Re-attaching invite listener...');
            langNgheLoiMoiDen();
            // YC.TXT FIX: Force render room list after leave to ensure UI updates
            setTimeout(() => {
                hienDanhSachPhong();
            }, 100);
            if (onDone) onDone();
        }).catch(err => {
            console.error('[Room Cleanup] ✗ Error removing user currentRoomId:', err);
            // Vẫn xóa localStorage ngay cả khi Firebase lỗi
            localStorage.removeItem('current_room_id');
            console.log('[Room Cleanup] ✓ localStorage current_room_id removed (fallback)');
            _resetSauThoat(rid);
            // Re-attach invite listener even on error
            console.log('[Room Cleanup] Re-attaching invite listener (fallback)...');
            langNgheLoiMoiDen();
            if (onDone) onDone();
        });
    };
    db.ref(`rooms/${rid}`).once('value').then(snap => {
        const room = snap.val();
        console.log('[Room Cleanup] Current room status:', room ? room.status : 'null');
        console.log('[Room Cleanup] Room playerX_id:', room ? room.playerX_id : 'null');
        console.log('[Room Cleanup] Room playerO_id:', room ? room.playerO_id : 'null');
        
        if (!room) { 
            console.log('[Room Cleanup] Room not found, cleaning up anyway');
            done(); 
            return; 
        }
        if (room.status === 'playing') {
            if (role === 'viewer') { done(); return; }
            if (!confirm('Bạn đang đánh. Thoát sẽ bị tính THUA. Tiếp tục?')) return;
            const winner = role === 'X' ? 'O' : 'X';
            console.log('[Room Cleanup] Forcing end due to surrender, winner:', winner);
            db.ref(`rooms/${rid}`).update({
                status: 'ended', winner, endReason: `${role} bỏ cuộc`,
                endedAt: Date.now(), updatedAt: Date.now()
            }).then(done);
        } else if (room.status === 'waiting' || room.status === 'empty') {
            if (role === 'X' && myId === room.playerX_id) {
                if (room.playerO_id) {
                    console.log('[Room Cleanup] Host leaving, transferring to guest');
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: room.playerO_id, playerX_name: room.playerO_name,
                        playerX_status: room.playerO_status || 'offline',
                        playerX_avatar: room.playerO_avatar || '', playerX_skin: room.playerO_skin || 'skin_default',
                        playerO_id: '', playerO_name: '', playerO_status: 'offline',
                        playerO_avatar: '', playerO_skin: 'skin_default',
                        status: 'waiting', updatedAt: Date.now()
                    }).then(done);
                } else {
                    console.log('[Room Cleanup] Host leaving, resetting room to empty');
                    // Không xóa phòng, chỉ reset về empty để có thể vào lại
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: '', playerX_name: '', playerX_status: 'offline',
                        playerX_avatar: '', playerX_skin: 'skin_default',
                        playerO_id: '', playerO_name: '', playerO_status: 'offline',
                        playerO_avatar: '', playerO_skin: 'skin_default',
                        status: 'empty', winner: '', endReason: '',
                        moves: { init: true }, lastMove: { row: -1, col: -1, by: '' },
                        updatedAt: Date.now()
                    }).then(done);
                }
            } else if (role === 'O' && myId === room.playerO_id) {
                console.log('[Room Cleanup] Guest leaving, resetting guest slot');
                // Khách O thoát → reset guestReady và playerOConfirmed
                db.ref(`rooms/${rid}`).update({
                    playerO_id: '', playerO_name: '', playerO_status: 'offline',
                    playerO_avatar: '', playerO_skin: 'skin_default',
                    guestReady: false,
                    playerOConfirmed: null,
                    status: 'waiting', updatedAt: Date.now()
                }).then(done);
            } else if (role === 'X' && myId !== room.playerX_id) {
                // Host đã chuyển quyền cho người khác, nhưng user cũ vẫn có currentRoomId
                console.log('[Room Cleanup] Host transferred, cleaning up old host currentRoomId');
                done();
            } else if (role === 'O' && myId !== room.playerO_id) {
                // Guest đã bị thay thế, nhưng user cũ vẫn có currentRoomId
                console.log('[Room Cleanup] Guest replaced, cleaning up old guest currentRoomId');
                done();
            } else {
                console.log('[Room Cleanup] Not a player, just cleaning up');
                done();
            }
        } else {
            console.log('[Room Cleanup] Room status:', room.status, '- cleaning up');
            done();
        }
    }).catch(err => {
        console.error('[Room Cleanup] Error checking room:', err);
        done(); 
    });
}
function _resetSauThoat(rid) {
    // Dọn listener TRƯỚC khi null currentRoomId
    if (roomListener && rid) {
        db.ref(`rooms/${rid}`).off('value', roomListener);
        roomListener = null;
    }
    // BUG 1 FIX: Reset listening room ID
    _currentListeningRoomId = null;
    // Dọn connected listener theo roomId
    if (rid && _connectedListeners[rid]) {
        db.ref('.info/connected').off('value', _connectedListeners[rid]);
        delete _connectedListeners[rid];
        connectedListener = null;
    }
    // (Chat phòng đã gộp vào Chat Thế Giới — dọn ở tatChatTheGioi() bên dưới)
    // BUG 4 FIX: Clean up all other listeners when leaving room
    if (onlineUsersListener) {
        db.ref('online_users').off('value', onlineUsersListener);
        onlineUsersListener = null;
    }
    if (invitationListener) {
        const userId = localStorage.getItem('current_user_id');
        if (userId) {
            console.log('[Invite Listener] ===== REMOVING LISTENER (room cleanup) =====');
            console.log('[Invite Listener] Firebase Path: invitations/' + userId);
            db.ref(`invitations/${userId}`).off('value', invitationListener);
            console.log('[Invite Listener] ✓ Listener removed');
        }
        invitationListener = null;
    }
    if (roomsListListener) {
        db.ref('rooms').off('value', roomsListListener);
        roomsListListener = null;
    }
    if (leaderboardListener) {
        db.ref('users').off('value', leaderboardListener);
        leaderboardListener = null;
    }
    if (historyListener) {
        db.ref('history').off('value', historyListener);
        historyListener = null;
    }
    // Clean up world chat listener
    tatChatTheGioi();
    // Hủy tất cả offline cleanup timers cho phòng này
    ['X', 'O'].forEach(r => {
        const k = `${rid}_${r}`;
        if (_offlineCleanupTimers[k]) { clearTimeout(_offlineCleanupTimers[k]); delete _offlineCleanupTimers[k]; }
    });
    // YC.TXT FIX: Reset ALL Room State variables
    currentRoomId     = null;
    myRole            = null;
    daXoaBanCoTranNay = false;
    _lastProcessedWinner = '';
    _dangBatDauGame   = false;
    _prevOppId = ''; _prevOppStatus = '';
    window._onlineSkinX = 'skin_default';
    window._onlineSkinO = 'skin_default';
    localStorage.removeItem('current_room_id');
    
    // Reset additional session state variables
    if (typeof currentPlayerSlot !== 'undefined') currentPlayerSlot = null;
    if (typeof currentSessionId !== 'undefined') currentSessionId = null;
    if (typeof isInRoom !== 'undefined') isInRoom = false;
    if (typeof isInBattle !== 'undefined') isInBattle = false;
    if (typeof readyState !== 'undefined') readyState = false;
    if (typeof cachedRoomData !== 'undefined') cachedRoomData = null;
    if (typeof opponent !== 'undefined') opponent = null;
    
    
    // Clear board state to prevent conflicts when returning to lobby
    if (typeof infiniteMap !== 'undefined') {
        infiniteMap.clear();
    }
    if (typeof moveHistory !== 'undefined') {
        moveHistory.length = 0;
    }
    if (typeof isGameActive !== 'undefined') {
        isGameActive = false;
    }
    
    thoatGiaoDienOnline();
}
// ══════════════════════════════════════════════════════════════════
// ▶️ BẮT ĐẦU / KICK / READY
// ══════════════════════════════════════════════════════════════════
function chuPhongBatDauGame() {
    if (!currentRoomId || myRole !== 'X') return;
    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room || !room.playerO_id) { alert('Cần có đối thủ mới bắt đầu được!'); return; }
        const selWin   = document.getElementById('room-win-count');
        const radioYes = document.getElementById('room-chan-2-dau-yes');
        const radioNo  = document.getElementById('room-chan-2-dau-no');
        const selFirst = document.getElementById('room-first-turn');
        const winCount  = selWin   ? parseInt(selWin.value)  : resolveRoomWinCount(room);
        const chan2Dau  = radioYes ? radioYes.checked : (room.chan2Dau ?? true);
        const firstTurn = selFirst ? selFirst.value           : (room.firstTurn || 'X');
        daXoaBanCoTranNay      = false;
        locallyAppliedLastMove = { row: -2, col: -2 };
        _lastProcessedWinner   = '';
        // Dùng ngưỡng cược đúng theo loại phòng (VIP vs thường)
        const _betMin = room.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        const hasBet = room.betAmount && room.betAmount >= _betMin;
        // Always require guest to press READY before host can start, regardless of bet
        const oReady = room.guestReady || room.playerOConfirmed;
        if (!oReady) {
            alert('⏳ Cần đợi khách bấm SẴN SÀNG trước khi bắt đầu!');
            return;
        }
        // If guest is ready, proceed: for bets set confirmed state, otherwise start game
        if (hasBet) {
            db.ref(`rooms/${currentRoomId}`).update({
                status:             'bet_confirm',
                winCount,  chan2Dau, firstTurn,
                winner:             '',
                endReason:          '',
                playerXConfirmed:   true,
                playerOConfirmed:   true,
                updatedAt:          Date.now()
            });
        } else {
            _thucSuBatDauGame(room, winCount, chan2Dau, firstTurn);
        }
    });
}
window.chuPhongBatDauGame = chuPhongBatDauGame;
// ===== UNDO MOVE IN ONLINE MODE =====
// Request-approve mechanism: người vừa đánh request undo, đối thủ approve/reject
// Chỉ rút 1 nước (nước của người vừa đánh)
// Nếu approve: trừ xu từ requester, cộng cho approver, rút nước
// Nếu reject: không làm gì, người kia đánh tiếp
// Trong khi chờ approve: không thể đánh tiếp
// Helper: Lấy mảng nước đi đã sắp xếp theo thứ tự timestamp tăng dần
function getSortedMovesArray(roomMoves) {
    if (!roomMoves) return [];
    const arr = Array.isArray(roomMoves) ? roomMoves : Object.values(roomMoves);
    return arr.filter(m => m && (m.row !== undefined || m.r !== undefined)).sort((a, b) => (a.timestamp || a.ts || 0) - (b.timestamp || b.ts || 0));
}

// Helper: Cập nhật giao diện thanh điều khiển dưới bàn cờ (Trận đấu vs Kết thúc)
function _updateBattleBottomBar(isEnded) {
    const bar = document.getElementById('battle-bottom-bar');
    if (!bar) return;
    if (isEnded) {
        bar.innerHTML = `
            <button class="battle-control-btn" style="background:#16a34a;color:white;font-weight:bold;" onclick="requestRematchFromWinOverlay()" title="Đấu lại">
                🕹 Đấu lại
            </button>
            <button class="battle-control-btn" style="background:#6c757d;color:white;font-weight:bold;" onclick="xemLaiBanCo()" title="Xem lại">
                🔍 Xem lại
            </button>
            <button class="battle-control-btn battle-exit-btn" onclick="thoatPhongSauVan()" title="Thoát">
                🚪 Thoát
            </button>
        `;
    } else {
        // Determine undo/button state from latest room snapshot
        const lastRoom = (typeof window._lastRoomSnapshot !== 'undefined') ? window._lastRoomSnapshot : null;
        const myUndoUsed = lastRoom && lastRoom.undoUsed && (typeof myRole !== 'undefined') && lastRoom.undoUsed[myRole];
        const undoPending = (typeof window.undoRequestPending !== 'undefined' && window.undoRequestPending) || (lastRoom && lastRoom.undoRequest);
        let undoBtnAttrs = 'class="battle-control-btn" id="btn-battle-undo"';
        let undoBtnText = '↶ Undo';
        let undoTitle = 'Hoàn tác';
        if (undoPending) {
            undoBtnAttrs += ' disabled';
            undoTitle = 'Đang chờ xác nhận rút nước từ đối thủ';
            undoBtnText = '↶ Undo (chờ)';
        } else if (myUndoUsed) {
            undoBtnAttrs += ' disabled';
            undoTitle = 'Bạn đã dùng quyền Undo của ván này';
            undoBtnText = '↶ Undo';
        } else {
            undoBtnAttrs += ' onclick="if(typeof undoOnlineMove === \'function\') undoOnlineMove();"';
        }

        bar.innerHTML = `
            <button ${undoBtnAttrs} title="${undoTitle}">${undoBtnText}</button>
            <button class="battle-control-btn battle-surrender-btn" id="btn-battle-surrender" onclick="if(typeof surrenderOnlineGame === 'function') surrenderOnlineGame();" title="Đầu hàng">
                🏳️ Đầu hàng
            </button>
            <button class="battle-control-btn battle-exit-btn" id="btn-battle-exit" onclick="confirmExitBattle()" title="Thoát">
                🚪 Thoát trận
            </button>
        `;
    }
}
window._updateBattleBottomBar = _updateBattleBottomBar;

// ===== UNDO MOVE IN ONLINE MODE =====
// Request-approve mechanism: người vừa đánh request undo, đối thủ approve/reject
function undoOnlineMove() {
    if (!currentRoomId || !myRole || myRole === 'viewer' || !db) {
        alert('Bạn không ở trong trận đấu!');
        return;
    }
    
    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) return;
        
        // Chỉ cho phép undo khi đang chơi
        if (room.status !== 'playing') {
            alert('Chỉ có thể rút nước khi đang chơi!');
            return;
        }
        
        // Chỉ người vừa đánh mới có thể request undo (kiểm tra lastMove)
        const lastMove = room.lastMove;
        if (!lastMove || lastMove.by !== myRole) {
            alert('Chỉ người vừa đánh mới có thể yêu cầu rút nước!');
            return;
        }
        
        const movesArray = getSortedMovesArray(room.moves);
        if (!movesArray || movesArray.length < 1) {
            alert('Chưa có nước nào để rút!');
            return;
        }
        
        // Giới hạn: mỗi người chỉ được undo 1 lần trong 1 trận
        // room.undoUsed is an object { X: bool, O: bool }
        if (room.undoUsed && room.undoUsed[myRole]) {
            alert('Bạn đã dùng quyền rút nước trong trận này rồi!');
            return;
        }

        // Kiểm tra đã có undo request pending chưa
        if (room.undoRequest) {
            alert('Đang có yêu cầu rút nước đang chờ xử lý!');
            return;
        }
        
        const myId = localStorage.getItem('current_user_id');
        const hasBet = room.betAmount && room.betAmount >= 100;
        
        if (hasBet) {
            // Kiểm tra đủ xu để trả phí undo
            const betAmount = room.betAmount;
            db.ref(`users/${myId}/coins`).once('value').then(snap => {
                const myCoins = snap.val() || 0;
                if (myCoins < betAmount) {
                    alert(`Bạn cần ${betAmount.toLocaleString('vi-VN')} Xu để rút nước! Hiện có: ${myCoins.toLocaleString('vi-VN')} Xu`);
                    return;
                }
                
                // Xác nhận undo
                const confirmUndo = confirm(`Yêu cầu rút lại 1 nước sẽ tốn ${betAmount.toLocaleString('vi-VN')} Xu nếu đối thủ đồng ý.\n\nSố tiền này sẽ được chuyển cho đối thủ.\n\nBạn có chắc chắn muốn yêu cầu rút?`);
                if (!confirmUndo) return;
                
                // Gửi request undo lên Firebase
                db.ref(`rooms/${currentRoomId}`).update({
                    undoRequest: {
                        requester: myRole,
                        requesterId: myId,
                        moveIndex: movesArray.length - 1,
                        betAmount: betAmount,
                        timestamp: Date.now()
                    },
                    updatedAt: Date.now()
                }).then(() => {
                    thongBaoHeThong(`↩️ Đã gửi yêu cầu rút nước - chờ đối thủ xác nhận...`);
                });
            });
        } else {
            // Không có cược - vẫn bắt buộc yêu cầu đối thủ xác nhận
            const confirmUndo = confirm('Yêu cầu rút lại 1 nước? Nước đi sẽ chỉ được rút nếu đối thủ đồng ý.');
            if (!confirmUndo) return;
            
            db.ref(`rooms/${currentRoomId}`).update({
                undoRequest: {
                    requester: myRole,
                    requesterId: myId,
                    moveIndex: movesArray.length - 1,
                    betAmount: 0,
                    timestamp: Date.now()
                },
                updatedAt: Date.now()
            }).then(() => {
                thongBaoHeThong(`↩️ Đã gửi yêu cầu rút nước - chờ đối thủ xác nhận...`);
            });
        }
    });
}

// Xử lý approve/reject undo request
function handleUndoResponse(approved) {
    if (!currentRoomId || !myRole) {
        return;
    }
    
    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val();
        
        if (!room || !room.undoRequest) {
            return;
        }
        
        const request = room.undoRequest;
        
        // Chỉ người được request mới có thể approve/reject
        if (request.requester === myRole) {
            alert('Bạn không thể tự duyệt yêu cầu của mình!');
            return;
        }
        
        if (approved) {
            const requesterId = request.requesterId;
            const approverId = localStorage.getItem('current_user_id');
            const betAmount = request.betAmount || 0;
            
            if (betAmount > 0) {
                // Trừ xu từ requester
                db.ref(`users/${requesterId}/coins`).transaction(c => (c || 0) - betAmount).then(result => {
                    if (!result.committed) {
                        alert('Lỗi khi trừ xu!');
                        return;
                    }
                    
                    // Cộng xu cho approver
                    db.ref(`users/${approverId}/coins`).transaction(c => (c || 0) + betAmount).then(oppResult => {
                        if (!oppResult.committed) {
                            db.ref(`users/${requesterId}/coins`).transaction(c => (c || 0) + betAmount);
                            alert('Lỗi khi chuyển xu!');
                            return;
                        }
                        
                        _performUndo(room, 1, request.requester);
                        
                        db.ref(`rooms/${currentRoomId}/undoRequest`).remove().then(() => {
                            const undoModal = document.getElementById('undo-request-modal');
                            if (undoModal) undoModal.style.display = 'none';
                            window.undoRequestPending = false;
                        });
                        
                        thongBaoHeThong(`↩️ Đã đồng ý rút nước - nhận ${betAmount.toLocaleString('vi-VN')} Xu!`);
                        if (typeof addNotification === 'function') {
                            addNotification('win', `↩️ Đã duyệt rút +${betAmount.toLocaleString('vi-VN')} Xu`);
                        }
                    });
                });
            } else {
                // Không có cược - undo miễn phí khi đối thủ đồng ý
                _performUndo(room, 1, request.requester);
                db.ref(`rooms/${currentRoomId}/undoRequest`).remove().then(() => {
                    const undoModal = document.getElementById('undo-request-modal');
                    if (undoModal) undoModal.style.display = 'none';
                    window.undoRequestPending = false;
                });
                thongBaoHeThong('↩️ Đã đồng ý rút nước!');
            }
        } else {
            // Reject: xóa request
            db.ref(`rooms/${currentRoomId}/undoRequest`).remove().then(() => {
                const undoModal = document.getElementById('undo-request-modal');
                if (undoModal) undoModal.style.display = 'none';
                window.undoRequestPending = false;
            });
            thongBaoHeThong('❌ Đã từ chối rút nước - trận đấu tiếp tục!');
        }
    });
}

function _performUndo(room, movesToRemove, requesterRole) {
    const movesArray = getSortedMovesArray(room.moves);
    if (!movesArray || movesArray.length < movesToRemove) return;
    
    const newMoves = movesArray.slice(0, -movesToRemove);
    const newTurn = requesterRole || 'X';
    
    const newMovesObject = {};
    newMoves.forEach(m => {
        const r = m.row !== undefined ? m.row : m.r;
        const c = m.col !== undefined ? m.col : m.c;
        const by = m.by !== undefined ? m.by : m.player;
        const ts = m.timestamp || m.ts || Date.now();
        newMovesObject[`${r}_${c}`] = { row: r, col: c, by: by, timestamp: ts };
    });
    
    const lastMove = newMoves.length > 0 ? newMoves[newMoves.length - 1] : null;
    const newLastMove = lastMove ? { 
        row: lastMove.row !== undefined ? lastMove.row : lastMove.r, 
        col: lastMove.col !== undefined ? lastMove.col : lastMove.c, 
        by: lastMove.by !== undefined ? lastMove.by : lastMove.player 
    } : { row: -1, col: -1, by: '' };
    
    // Cập nhật ngay locallyAppliedLastMove để langNgheThayDoiPhong không trigger thucHienVeNuocDi thừa
    if (typeof locallyAppliedLastMove !== 'undefined') {
        locallyAppliedLastMove.row = newLastMove.row;
        locallyAppliedLastMove.col = newLastMove.col;
    }
    
    // Mark that this requester has used their undo in this match
    const prevUndo = room && room.undoUsed ? room.undoUsed : { X: false, O: false };
    const newUndo = Object.assign({}, prevUndo);
    newUndo[requesterRole] = true;

    const roomRef = db.ref(`rooms/${currentRoomId}`);
    // Use transaction to apply undo atomically and avoid race conditions
    roomRef.transaction(data => {
        if (!data) return data;
        // Ensure there is still an undoRequest by this requester (safety check)
        if (!data.undoRequest || data.undoRequest.requester !== requesterRole) return;
        // Ensure requester hasn't used undo already
        if (data.undoUsed && data.undoUsed[requesterRole]) return;

        data.moves = newMovesObject;
        data.turn = newTurn;
        data.turnStartedAt = firebase.database.ServerValue.TIMESTAMP;
        data.lastMove = newLastMove;
        if (!data.undoUsed) data.undoUsed = { X: false, O: false };
        data.undoUsed[requesterRole] = true;
        data.updatedAt = Date.now();
        return data;
    }).then(result => {
        if (!result.committed) {
            console.warn('[DEBUG-UNDO] Undo transaction not committed or aborted');
            return;
        }

        if (typeof moveHistory !== 'undefined') {
            moveHistory.length = 0;
            newMoves.forEach(m => {
                moveHistory.push({ 
                    r: m.row !== undefined ? m.row : m.r, 
                    c: m.col !== undefined ? m.col : m.c, 
                    player: m.by !== undefined ? m.by : m.player 
                });
            });
        }

        if (typeof infiniteMap !== 'undefined') {
            infiniteMap.clear();
            newMoves.forEach(m => {
                const r = m.row !== undefined ? m.row : m.r;
                const c = m.col !== undefined ? m.col : m.c;
                const player = m.by !== undefined ? m.by : m.player;
                infiniteMap.set(`${r},${c}`, player);
            });
        }

        if (typeof lastMoveR !== 'undefined') {
            lastMoveR = newLastMove.row === -1 ? null : newLastMove.row;
            lastMoveC = newLastMove.col === -1 ? null : newLastMove.col;
        }
        if (typeof currentPlayer !== 'undefined') {
            currentPlayer = newTurn;
        }
        if (typeof currentTurn !== 'undefined') {
            currentTurn = newTurn;
        }

        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
    }).catch(err => {
        console.error('[DEBUG-UNDO] Undo transaction error:', err);
    });
}
window.undoOnlineMove = undoOnlineMove;
window.handleUndoResponse = handleUndoResponse;

// Helper function to show undo modal
function _showUndoModal(request, betAmount) {
    let undoModal = document.getElementById('undo-request-modal');
    if (!undoModal) {
        undoModal = document.createElement('div');
        undoModal.id = 'undo-request-modal';
        undoModal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(undoModal);
    }
    undoModal.innerHTML = `
        <div style="background:white;padding:24px;border-radius:12px;max-width:380px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
            <h3 style="margin-bottom:12px;color:#1e293b;font-size:18px;">↩️ Yêu cầu rút nước</h3>
            <p style="margin-bottom:12px;color:#475569;font-size:14px;">Bên <b>${request.requester}</b> muốn rút lại nước vừa đánh.</p>
            <p style="margin-bottom:18px;color:#64748b;font-size:13px;">${betAmount > 0 ? `Nếu đồng ý, bạn sẽ nhận <b>${betAmount.toLocaleString('vi-VN')} Xu</b>.` : 'Ván cược 0 xu.'}</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button onclick="handleUndoResponse(true)" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;">🟢 Đồng ý</button>
                <button onclick="handleUndoResponse(false)" style="padding:10px 20px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;">❌ Từ chối</button>
            </div>
        </div>
    `;
    undoModal.style.display = 'flex';
}

// Modal xác nhận Đấu lại (Rematch) từ đối thủ
function _showRematchModal(room) {
    const modalId = 'rematch-confirm-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(modal);
    }
    const requesterRole = room.rematchRequestedBy || (myRole === 'X' ? 'O' : 'X');
    const requesterName = requesterRole === 'X' ? tenSafe(room.playerX_name, 'Chủ phòng X') : tenSafe(room.playerO_name, 'Người chơi O');
    modal.innerHTML = `
        <div style="background:white;padding:24px;border-radius:12px;max-width:380px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
            <h3 style="margin-bottom:12px;color:#1e293b;font-size:18px;">🕹 Yêu cầu Đấu lại</h3>
            <p style="margin-bottom:18px;color:#475569;font-size:14px;"><b>${requesterName} (${requesterRole})</b> muốn đấu lại ván mới với cùng luật chơi.</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button onclick="handleRematchResponse(true)" style="padding:10px 20px;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;">🟢 Đồng ý</button>
                <button onclick="handleRematchResponse(false)" style="padding:10px 20px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;">❌ Từ chối</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function handleRematchResponse(approved) {
    const modal = document.getElementById('rematch-confirm-modal');
    if (modal) modal.style.display = 'none';
    if (!currentRoomId) return;

    if (approved) {
        const updates = { updatedAt: Date.now() };
        if (myRole === 'X') updates.rematchXReady = true;
        if (myRole === 'O') updates.rematchOReady = true;

        db.ref(`rooms/${currentRoomId}`).update(updates).then(() => {
            db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
                const room = snap.val();
                if (room && typeof maybeAutoStartRematch === 'function') {
                    maybeAutoStartRematch(room);
                }
            });
        });
    } else {
        db.ref(`rooms/${currentRoomId}`).update({
            rematchRequested: false,
            rematchRequestedBy: null,
            rematchXReady: false,
            rematchOReady: false,
            updatedAt: Date.now()
        }).then(() => {
            if (typeof thongBaoHeThong === 'function') {
                thongBaoHeThong('❌ Bạn đã từ chối đấu lại.');
            }
        });
    }
}
window.handleRematchResponse = handleRematchResponse;
// Hàm nội bộ: chỉ X gọi — đẩy status = playing lên Firebase
// Guard chống gọi 2 lần trong cùng 1 phiên
let _dangBatDauGame = false;
function _thucSuBatDauGame(room, winCount, chan2Dau, firstTurn) {
    if (_dangBatDauGame) return;
    _dangBatDauGame = true;
    
    console.log('[RULE-AUDIT] _thucSuBatDauGame called with:', { winCount, chan2Dau, firstTurn });
    
    // Sync room rules vào GameState trước khi bắt đầu game (synchronously)
    if (typeof GameState !== 'undefined') {
        GameState.roomRules = {
            winCount: winCount,
            chan2Dau: chan2Dau,
            firstTurn: firstTurn
        };
        if (!GameState.board) GameState.board = {};
        GameState.board.winCount = winCount;
        console.log('[RULE-AUDIT] GameState.roomRules set to:', GameState.roomRules);
    }
    window.roomRules = GameState.roomRules;
    // CẦN invalidate ngay để getBlockBothEnds() re-read trước khi game logic chạy
    if (typeof invalidateBlockBothEndsCache === 'function') {
        invalidateBlockBothEndsCache();
    }
    db.ref(`rooms/${currentRoomId}`).update({
        status:           'playing',
        turn:             firstTurn,
        turnStartedAt:    firebase.database.ServerValue.TIMESTAMP,
        winCount,  chan2Dau, firstTurn,
        winner:           '',
        endReason:        '',
        moves:            { init: true },
        lastMove:         { row: -1, col: -1, by: '' },
        endedAt:          null,
        rematchRequested: false,
        rematchXReady:    false,
        rematchOReady:    false,
        guestReady:       false,
        playerXConfirmed: null,
        playerOConfirmed: null,
        // Reset per-player undo usage when a new game actually starts
        undoUsed:         { X: false, O: false },
        // Clear any pending undo request
        undoRequest:      null,
        updatedAt:        firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        _dangBatDauGame = false;
        
        // BUG 1 DEBUG: Log event when game starts
        if (typeof Bug1DebugLogger !== 'undefined') {
            Bug1DebugLogger.logEvent('Game.start', 'online');
        }
        
        if (typeof batDauCuoc === 'function' && room.playerX_id && room.playerO_id) {
            batDauCuoc(currentRoomId, room.playerX_id, room.playerO_id);
        }
        if (typeof capNhatHienThiBetPanel === 'function') capNhatHienThiBetPanel();
    }).catch(err => {
        _dangBatDauGame = false;
        console.error('[DEBUG-BOARD] Failed to start game:', err);
    });
}
// O chấp nhận cược → ghi playerOConfirmed = true
// X nhận qua listener, kiểm tra cả 2 cờ rồi bắt đầu
function oChapNhanCuoc() {
    if (!currentRoomId || myRole !== 'O') return;
    db.ref(`rooms/${currentRoomId}`).update({ playerOConfirmed: true, updatedAt: Date.now() });
    const betConfirmBtns = document.getElementById('bet-confirm-btns');
    if (betConfirmBtns) betConfirmBtns.style.display = 'none';
    thongBaoHeThong('✅ Đã xác nhận cược — đang chờ bắt đầu...');
}
window.oChapNhanCuoc = oChapNhanCuoc;
// O từ chối → xóa cược, về lại waiting, dọn cờ xác nhận
function oTuChoiCuoc() {
    if (!currentRoomId || myRole !== 'O') return;
    db.ref(`rooms/${currentRoomId}`).update({
        status:           'waiting',
        betAmount:        null,
        playerXConfirmed: null,
        playerOConfirmed: null,
        updatedAt:        Date.now()
    }).then(() => {
        thongBaoHeThong('❌ O từ chối cược — cược đã bị hủy!');
    });
}
window.oTuChoiCuoc = oTuChoiCuoc;
// Chủ phòng thay đổi luật realtime — lưu lên Firebase ngay để O thấy
function capNhatLuatPhong() {
    if (!currentRoomId || myRole !== 'X') return;
    const selWin   = document.getElementById('room-win-count');
    const radioYes = document.getElementById('room-chan-2-dau-yes');
    const radioNo  = document.getElementById('room-chan-2-dau-no');
    const selFirst = document.getElementById('room-first-turn');
    if (!selWin || (!radioYes && !radioNo)) return;
    const newWinCount = parseInt(selWin.value);
    const newChan2Dau = radioYes ? radioYes.checked : true;
    const newFirstTurn = selFirst ? selFirst.value : 'X';
    db.ref(`rooms/${currentRoomId}`).update({
        winCount:  newWinCount,
        chan2Dau:  newChan2Dau,
        firstTurn: newFirstTurn,
        updatedAt: Date.now()
    });
    // Sync ngay xuống GameState.roomRules để đảm bảo logic checkWinSilent dùng đúng luật (synchronously)
    if (typeof GameState !== 'undefined') {
        GameState.roomRules = {
            winCount: newWinCount,
            chan2Dau: newChan2Dau,
            firstTurn: newFirstTurn
        };
        if (!GameState.board) GameState.board = {};
        GameState.board.winCount = newWinCount;
    }
    window.roomRules = GameState.roomRules;
    // Cache invalidation sẽ được xử lý bởi listener khi db.update() fire
}
window.capNhatLuatPhong = capNhatLuatPhong;
function kickDoiThu() {
    if (!currentRoomId || myRole !== 'X') return;
    if (!confirm('Đuổi người chơi này ra khỏi phòng?')) return;
    db.ref(`rooms/${currentRoomId}`).update({
        playerO_id: '', playerO_name: '', playerO_status: 'offline',
        updatedAt: Date.now()
    });
}
window.kickDoiThu = kickDoiThu;
function setReady(role) {} // Không dùng nữa — chủ phòng bấm Bắt đầu trực tiếp
window.setReady = setReady;
// ══════════════════════════════════════════════════════════════════
// 👂 LẮNG NGHE THAY ĐỔI PHÒNG (REALTIME)
// ══════════════════════════════════════════════════════════════════
// Map lưu timeout tự dọn ghế khi offline
const _offlineCleanupTimers = {};
let _firebaseServerTimeOffset = 0;
const ONLINE_AFK_TIMEOUT_SEC = 150;
const _onlineBattleCountdown = {
    interval: null,
    secondsLeft: ONLINE_AFK_TIMEOUT_SEC,
    activeTurn: null,
    turnStartMs: null,
    timeoutAttempted: false
};

function getServerTimeMs() {
    return Date.now() + (_firebaseServerTimeOffset || 0);
}

function _formatBattleCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function _updateBattleTimerDisplay(role, seconds, isActive) {
    const el = document.getElementById(`battle-timer-${role.toLowerCase()}`);
    if (!el) return;
    el.textContent = _formatBattleCountdown(seconds);
    el.style.background = isActive ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.08)';
    el.style.color = isActive ? '#16a34a' : '#94a3b8';
}

function _renderBattleCountdown() {
    const active = _onlineBattleCountdown.activeTurn;
    _updateBattleTimerDisplay('X', active === 'X' ? _onlineBattleCountdown.secondsLeft : ONLINE_AFK_TIMEOUT_SEC, active === 'X');
    _updateBattleTimerDisplay('O', active === 'O' ? _onlineBattleCountdown.secondsLeft : ONLINE_AFK_TIMEOUT_SEC, active === 'O');
}

function _resetBattleCountdown() {
    if (_onlineBattleCountdown.interval) {
        clearInterval(_onlineBattleCountdown.interval);
        _onlineBattleCountdown.interval = null;
    }
    _onlineBattleCountdown.secondsLeft = ONLINE_AFK_TIMEOUT_SEC;
    _onlineBattleCountdown.activeTurn = null;
    _onlineBattleCountdown.turnStartMs = null;
    _onlineBattleCountdown.timeoutAttempted = false;
    _renderBattleCountdown();
}

function _startBattleCountdown(turn, turnStartedAt) {
    if (!turn) return;
    if (_onlineBattleCountdown.interval) {
        clearInterval(_onlineBattleCountdown.interval);
        _onlineBattleCountdown.interval = null;
    }
    _onlineBattleCountdown.activeTurn = turn;
    _onlineBattleCountdown.turnStartMs = turnStartedAt || null;
    _onlineBattleCountdown.timeoutAttempted = false;
    _renderBattleCountdown();
    _onlineBattleCountdown.interval = setInterval(() => {
        const now = getServerTimeMs();
        const turnStartMs = _onlineBattleCountdown.turnStartMs;
        let remainingMs = ONLINE_AFK_TIMEOUT_SEC * 1000;
        if (turnStartMs) {
            remainingMs = (turnStartMs + ONLINE_AFK_TIMEOUT_SEC * 1000) - now;
        }
        _onlineBattleCountdown.secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
        _renderBattleCountdown();
        if (remainingMs <= 0) {
            clearInterval(_onlineBattleCountdown.interval);
            _onlineBattleCountdown.interval = null;
            _handleOnlineBattleTimeout(_onlineBattleCountdown.activeTurn);
        }
    }, 250);
}

function _handleOnlineBattleTimeout(timedOutRole) {
    if (!timedOutRole || !currentRoomId || !db) return;
    if (_onlineBattleCountdown.timeoutAttempted) {
        return;
    }
    _onlineBattleCountdown.timeoutAttempted = true;
    currentTurn = null;
    const winner = timedOutRole === 'X' ? 'O' : 'X';
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    roomRef.transaction(room => {
        if (!room || room.status !== 'playing' || room.turn !== timedOutRole) return;
        // Only end the game once if the turn still belongs to the timed-out player
        room.status     = 'ended';
        room.winner     = winner;
        room.endReason  = `${timedOutRole} hết giờ`;
        room.endedAt    = firebase.database.ServerValue.TIMESTAMP;
        room.updatedAt  = firebase.database.ServerValue.TIMESTAMP;
        return room;
    }).catch(err => {
        console.error('[DEBUG-ONLINE] Failed to commit online timeout:', err);
    });
}

function _updateBattleCountdown(room) {
    if (!room || room.status !== 'playing') {
        _resetBattleCountdown();
        return;
    }
    const turn = room.turn || 'X';
    const turnStartedAt = room.turnStartedAt || null;
    const now = getServerTimeMs();
    let remainingMs = ONLINE_AFK_TIMEOUT_SEC * 1000;
    if (turnStartedAt) {
        remainingMs = (turnStartedAt + ONLINE_AFK_TIMEOUT_SEC * 1000) - now;
    }
    const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
    const shouldRestart = turn !== _onlineBattleCountdown.activeTurn || _onlineBattleCountdown.turnStartMs !== turnStartedAt;
    _onlineBattleCountdown.secondsLeft = secondsLeft;
    _renderBattleCountdown();
    if (shouldRestart) {
        _startBattleCountdown(turn, turnStartedAt);
    }
    if (turnStartedAt && remainingMs <= 0) {
        clearInterval(_onlineBattleCountdown.interval);
        _onlineBattleCountdown.interval = null;
        _handleOnlineBattleTimeout(turn);
        return;
    }
}

// Theo dõi đối thủ để thông báo vào phòng / rời phòng / mất kết nối
let _prevOppId = '', _prevOppStatus = '';
// BUG 3 FIX: Track previous status to detect when game just ended
let _prevRoomStatus = '';
// BUG 1 FIX: Track current listening room to prevent duplicate listeners
let _currentListeningRoomId = null;

function _syncRoomBoardState(room) {
    // ══════════════════════════════════════════════════════════════════
    // CANONICAL BOARD MAP: Ensure infiniteMap === GameState.board.infiniteMap
    // ══════════════════════════════════════════════════════════════════
    console.log('[BOARD-SYNC-IDENTITY]', {
        isInfinite: typeof isInfinite !== 'undefined' ? isInfinite : 'undefined',
        gameStateIsInfinite: (typeof GameState !== 'undefined' && GameState.board) ? GameState.board.isInfinite : 'undefined',
        sameMap: (typeof infiniteMap !== 'undefined' && typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) 
            ? (infiniteMap === GameState.board.infiniteMap) 
            : 'undefined',
        globalSize: typeof infiniteMap !== 'undefined' ? infiniteMap.size : 'undefined',
        gameStateSize: (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) ? GameState.board.infiniteMap.size : 'undefined'
    });
    
    // Ensure GameState.board structure exists and is canonical
    if (typeof GameState !== 'undefined') {
        if (!GameState.board) GameState.board = {};
        GameState.board.isInfinite = true;
        
        // If GameState.board.infiniteMap doesn't exist or is different from global infiniteMap,
        // make them the same reference
        if (!GameState.board.infiniteMap || GameState.board.infiniteMap !== infiniteMap) {
            if (typeof infiniteMap !== 'undefined') {
                GameState.board.infiniteMap = infiniteMap;
                console.log('[BOARD-SYNC-IDENTITY] Canonical map established: GameState.board.infiniteMap = infiniteMap');
            } else {
                // If global infiniteMap doesn't exist yet, create it and sync
                if (typeof Map !== 'undefined') {
                    infiniteMap = new Map();
                    GameState.board.infiniteMap = infiniteMap;
                    console.log('[BOARD-SYNC-IDENTITY] Created new canonical infiniteMap');
                }
            }
        }
    }
    
    // Ensure global isInfinite is true
    if (typeof isInfinite !== 'undefined') isInfinite = true;
    
    const movesArray = room.moves ? (Array.isArray(room.moves) ? room.moves : Object.values(room.moves)) : [];
    
    // Clear the canonical map (only once, since they're the same reference now)
    if (typeof infiniteMap !== 'undefined') infiniteMap.clear();
    
    if (typeof moveHistory !== 'undefined') moveHistory.length = 0;
    if (typeof winningCellCoords !== 'undefined') winningCellCoords.length = 0;
    if (typeof lastMoveR !== 'undefined') { lastMoveR = null; lastMoveC = null; }

    const validMoves = movesArray
        .filter(m => m && (m.row !== undefined || m.r !== undefined) && (m.col !== undefined || m.c !== undefined) && (m.by !== undefined || m.player !== undefined))
        .sort((a, b) => (a.timestamp || a.ts || 0) - (b.timestamp || b.ts || 0));

    validMoves.forEach(m => {
        const r = m.row !== undefined ? m.row : m.r;
        const c = m.col !== undefined ? m.col : m.c;
        const player = m.by !== undefined ? m.by : m.player;
        if (typeof setCell === 'function') setCell(r, c, player);
        if (typeof moveHistory !== 'undefined') moveHistory.push({ r, c, player });
        if (typeof lastMoveR !== 'undefined') { lastMoveR = r; lastMoveC = c; }
    });

    const roomLastMove = room.lastMove && (room.lastMove.row !== undefined || room.lastMove.col !== undefined)
        ? room.lastMove
        : (validMoves.length ? validMoves[validMoves.length - 1] : null);
    if (roomLastMove && typeof lastMoveR !== 'undefined') {
        lastMoveR = roomLastMove.row;
        lastMoveC = roomLastMove.col;
    }
    
    // ══════════════════════════════════════════════════════════════════
    // BOARD-SYNC-AFTER-RESTORE: Verify canonical map and sample cells
    // ══════════════════════════════════════════════════════════════════
    console.log('[BOARD-SYNC-AFTER-RESTORE]', {
        sameMap: (typeof infiniteMap !== 'undefined' && typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) 
            ? (infiniteMap === GameState.board.infiniteMap) 
            : 'undefined',
        globalSize: typeof infiniteMap !== 'undefined' ? infiniteMap.size : 'undefined',
        gameStateSize: (typeof GameState !== 'undefined' && GameState.board && GameState.board.infiniteMap) ? GameState.board.infiniteMap.size : 'undefined',
        sample: {
            left: typeof getCell === 'function' ? getCell(5, 6) : 'no-getCell',
            x1: typeof getCell === 'function' ? getCell(5, 7) : 'no-getCell',
            x2: typeof getCell === 'function' ? getCell(5, 8) : 'no-getCell',
            x3: typeof getCell === 'function' ? getCell(5, 9) : 'no-getCell',
            x4: typeof getCell === 'function' ? getCell(5, 10) : 'no-getCell',
            x5: typeof getCell === 'function' ? getCell(5, 11) : 'no-getCell',
            right: typeof getCell === 'function' ? getCell(5, 12) : 'no-getCell'
        }
    });

    console.log('[Firebase-Timing] Step 1: Firebase board update received');
    
    if (typeof currentTurn !== 'undefined') {
        const oldTurn = currentTurn;
        currentTurn = room.turn || currentTurn;
        console.log('[Firebase-Timing] Step 2: currentTurn updated:', oldTurn, '→', currentTurn);
    }
    if (typeof currentPlayer !== 'undefined') currentPlayer = room.turn || currentPlayer;
    if (typeof locallyAppliedLastMove !== 'undefined' && roomLastMove) {
        locallyAppliedLastMove.row = roomLastMove.row;
        locallyAppliedLastMove.col = roomLastMove.col;
    }
    
    // Check if it's local player's turn BEFORE rendering
    const isLocalTurn = (typeof currentTurn !== 'undefined' && typeof window !== 'undefined' && window.myOnlineRole) 
        ? currentTurn === window.myOnlineRole 
        : false;
    console.log('[Firebase-Timing] Step 3: localTurn check:', isLocalTurn, '(currentTurn:', currentTurn, ', myOnlineRole:', typeof window !== 'undefined' ? window.myOnlineRole : 'undefined', ')');
    
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    if (typeof updateCursorByTurn === 'function') updateCursorByTurn();
    if (typeof updateStatus === 'function') updateStatus();
    if (typeof window !== 'undefined' && window.onlineMovePending) window.onlineMovePending = false;
    
    // Bot Pet Candidate Hint: Refresh candidates after board sync and turn update
    // This ensures candidates are recalculated when it's the local player's turn
    if (typeof refreshBotPetCandidatesForCurrentTurn === 'function') {
        console.log('[Firebase-Timing] Step 4: Calling refreshBotPetCandidatesForCurrentTurn()');
        setTimeout(() => {
            console.log('[Firebase-Timing] Step 5: refreshBotPetCandidatesForCurrentTurn() executing');
            refreshBotPetCandidatesForCurrentTurn();
            console.log('[Firebase-Timing] Step 6: refreshBotPetCandidatesForCurrentTurn() completed');
        }, 0);
    }
}

function langNgheThayDoiPhong(roomId) {
    // BUG 1 FIX: Prevent duplicate listeners for the same room
    if (_currentListeningRoomId === roomId && roomListener) {
        return;
    }
    
    if (roomListener) { db.ref(`rooms/${currentRoomId || roomId}`).off('value', roomListener); roomListener = null; }
    _currentListeningRoomId = roomId;
    roomListener = db.ref(`rooms/${roomId}`).on('value', snap => {
        const room = snap.val();
        if (!room) return; // Phòng cố định không bao giờ null
        // Keep a quick-access copy of last room snapshot for UI helpers
        window._lastRoomSnapshot = room;
        
        // BUG 1 DEBUG: Log event when Firebase room data received
        if (typeof Bug1DebugLogger !== 'undefined') {
            Bug1DebugLogger.logEvent('Firebase.room.data-received', 'online');
        }
        const myId = localStorage.getItem('current_user_id');
        // Cập nhật role theo Firebase (đảm bảo đúng)
        if (myId === room.playerX_id)      myRole = 'X';
        else if (myId === room.playerO_id) myRole = 'O';
        else if (myRole !== 'viewer')      myRole = 'viewer';
        // Xử lý undo request - hiển thị UI approve/reject cho đối thủ
        if (room.undoRequest) {
            const request = room.undoRequest;
            const isRequester = request.requester === myRole;
            
            // Set global flag để block moves
            window.undoRequestPending = true;
            
            if (!isRequester && myRole !== 'viewer') {
                // Đối thủ nhận được request - check xu của người request trước khi hiển thị modal
                const requesterId = request.requesterId;
                const betAmount = request.betAmount || 0;
                
                if (betAmount > 0) {
                    // Check xu của người request trước
                    db.ref(`users/${requesterId}/coins`).once('value').then(snap => {
                        const requesterCoins = snap.val() || 0;
                        if (requesterCoins < betAmount) {
                            // Người request không đủ xu - tự động reject
                            db.ref(`rooms/${currentRoomId}/undoRequest`).remove();
                            thongBaoHeThong('❌ Người yêu cầu rút không đủ Xu - yêu cầu bị hủy!');
                            return;
                        }
                        
                        // Đủ xu - hiển thị modal approve/reject
                        _showUndoModal(request, betAmount);
                    });
                } else {
                    // Không có cược - hiển thị modal ngay
                    _showUndoModal(request, 0);
                }
            } else if (isRequester) {
                // Người request - hiển thị thông báo đang chờ
                thongBaoHeThong('↩️ Đang chờ đối thủ xác nhận rút nước...');
            }
        } else {
            // Không có request - ẩn modal nếu có và clear flag
            const undoModal = document.getElementById('undo-request-modal');
            if (undoModal) undoModal.style.display = 'none';
            window.undoRequestPending = false;
        }

        // Xử lý rematch request - hiển thị UI xác nhận cho đối thủ
        if (room.rematchRequested && room.status === 'ended') {
            const requesterRole = room.rematchRequestedBy;
            if (requesterRole && requesterRole !== myRole && myRole !== 'viewer') {
                _showRematchModal(room);
            }
        } else {
            const rematchModal = document.getElementById('rematch-confirm-modal');
            if (rematchModal) rematchModal.style.display = 'none';
        }
        // Kiểm tra bị kick (ghế của mình bị reset)
        if (myRole !== 'viewer' && isOnlineMode) {
            const wasX = (myRole === 'X' && myId !== room.playerX_id && daXoaBanCoTranNay);
            const wasO = (myRole === 'O' && myId !== room.playerO_id && daXoaBanCoTranNay);
            if (wasX || wasO) {
                alert('Bạn đã bị đưa ra khỏi phòng!');
                _resetSauThoat(roomId);
                return;
            }
        }
        // ── Thông báo đối thủ vào phòng / rời phòng / mất kết nối (chỉ với người chơi) ──
        // daThongBaoSnapshot = true → snapshot này đã có thông báo sự kiện,
        // không để thông báo trạng thái (lượt/chờ) ghi đè mất ngay lập tức
        let daThongBaoSnapshot = false;
        let oppId = '', oppName = 'Đối thủ';
        if (myRole === 'X' || myRole === 'O') {
            oppId           = myRole === 'X' ? (room.playerO_id     || '') : (room.playerX_id     || '');
            const oppStatus = myRole === 'X' ? (room.playerO_status || '') : (room.playerX_status || '');
            oppName         = tenSafe(myRole === 'X' ? room.playerO_name : room.playerX_name, 'Đối thủ');
            if (_prevOppId && !oppId) {
                thongBaoHeThong('🚪 Đối thủ đã rời phòng.');
                daThongBaoSnapshot = true;
            } else if (!_prevOppId && oppId) {
                thongBaoHeThong(`🤝 ${oppName} đã vào phòng!`);
                daThongBaoSnapshot = true;
            } else if (oppId && _prevOppId === oppId && _prevOppStatus === 'online' && oppStatus === 'offline') {
                thongBaoHeThong(`📡 ${oppName} mất kết nối...`);
                daThongBaoSnapshot = true;
            }
            _prevOppId = oppId; _prevOppStatus = oppStatus;
        }
        // Cập nhật giao diện phòng chờ
        capNhatUIPhong(room);
        // Luôn cập nhật avatar/tên người chơi khi có thay đổi trong phòng (waiting hoặc playing)
        if (room.playerX_id) loadPlayerInfo(room.playerX_id, 'X');
        if (room.playerO_id) loadPlayerInfo(room.playerO_id, 'O');
        // Nếu không có O thì reset avatar slot O về mặc định
        if (!room.playerO_id) {
            const slotOAv = document.querySelector('#slot-playerO .avatar-circle');
            if (slotOAv) { slotOAv.textContent = 'O'; slotOAv.style.fontSize = ''; }
            const pcOAv = document.querySelector('#panel-playerO .pc-avatar');
            if (pcOAv) { pcOAv.textContent = 'O'; pcOAv.style.fontSize = ''; }
            const nameOEl = document.getElementById('view-name-O');
            if (nameOEl) nameOEl.innerText = 'Đang chờ...';
        }
        currentTurn     = room.turn || 'X';
        currentRule     = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
        currentWinCount = resolveRoomWinCount(room);
        
        // ══════════════════════════════════════════════════════════════════
        // SINGLE SOURCE OF TRUTH: Sync room rules from Firebase BEFORE board sync
        // ══════════════════════════════════════════════════════════════════
        const roomWinCount = typeof room.winCount === 'number' ? room.winCount : 5;
        const roomChan2Dau = typeof room.chan2Dau === 'boolean' ? room.chan2Dau : (room.chan2Dau ?? true);
        const roomFirstTurn = room.firstTurn || 'X';
        
        console.log('[RULE-AUDIT]', {
            mode: 'ONLINE',
            roomId: roomId,
            winCount: roomWinCount,
            chan2Dau: roomChan2Dau,
            source: 'ONLINE_FIREBASE',
            timestamp: Date.now()
        });
        
        // Sync single source of truth for room rules to GameState
        try {
            if (typeof GameState !== 'undefined') {
                GameState.roomRules = {
                    winCount: roomWinCount,
                    chan2Dau: roomChan2Dau,
                    firstTurn: roomFirstTurn
                };
                // Also sync board.winCount for legacy modules that read GameState.board.winCount
                if (!GameState.board) GameState.board = {};
                GameState.board.winCount = roomWinCount;
                
                console.log('[RULE-AUDIT] GameState.roomRules synced from Firebase:', GameState.roomRules);
            }
            // Invalidate cache để ai-nao.js dùng roomRules mới
            if (typeof invalidateBlockBothEndsCache === 'function') {
                invalidateBlockBothEndsCache();
            }
        } catch (e) { console.warn('[SyncRoomRules] failed to set GameState.roomRules', e); }
        // Expose as window.roomRules for compatibility
        window.roomRules = (typeof GameState !== 'undefined' && GameState.roomRules) ? GameState.roomRules : { winCount: roomWinCount, chan2Dau: roomChan2Dau, firstTurn: roomFirstTurn };
        if (typeof winCount !== 'undefined') winCount = currentWinCount;
        _updateBattleCountdown(room);
        const gameInfo = document.getElementById('game-info');
        if (room.status === 'playing') {
            if (typeof _updateBattleBottomBar === 'function') _updateBattleBottomBar(false);
            const rematchModal = document.getElementById('rematch-confirm-modal');
            if (rematchModal) rematchModal.style.display = 'none';
            if (typeof isGameActive !== 'undefined') isGameActive = true;
            // Lần đầu vào trận HOẶC ván mới bắt đầu (daXoaBanCoTranNay = false)
            if (!daXoaBanCoTranNay) {
                daXoaBanCoTranNay = true;
                locallyAppliedLastMove = { row: -2, col: -2 };
                _lastProcessedWinner = '';
                if (typeof window.xoaBanCoCu === 'function') {
        window.xoaBanCoCu();
        window._suppressOnlineWinOverlay = false;
        window._suppressOnlineWinOverlayRoom = null;
    }
                // Ẩn overlay và nút xem lại
                const old = document.getElementById('van-moi-overlay');
                if (old) old.remove();
                const btnBack = document.getElementById('btn-back-to-result');
                if (btnBack) btnBack.remove();
                setMyOnlineStatus('playing');
            }
            const panelX = document.getElementById('panel-playerX');
            if (panelX) panelX.style.display = 'flex';
            const panelO = document.getElementById('panel-playerO');
            if (panelO) panelO.style.display = 'flex';
            // Resize lại canvas sau khi player card xuất hiện làm thay đổi layout
            // Dùng timeout dài hơn để đảm bảo layout CSS đã paint xong
            const _doInitOnlineCanvas = () => {
                // Use SharedBoardUI for unified canvas initialization
                if (typeof SharedBoardUI !== 'undefined') {
                    const success = SharedBoardUI.init('online');
                    if (!success) {
                        console.error('[DEBUG-BOARD] SharedBoardUI.init failed, falling back to old logic');
                        _doInitOnlineCanvasFallback();
                    } else {
                        // SharedBoardUI.init already calls renderInfiniteBoard
                        if (typeof renderInfiniteBoard === 'function') {
                            renderInfiniteBoard();
                        }
                    }
                } else {
                    console.warn('[DEBUG-BOARD] SharedBoardUI not loaded, using fallback logic');
                    _doInitOnlineCanvasFallback();
                }
            };

            // Fallback canvas initialization (old logic)
            const _doInitOnlineCanvasFallback = () => {
                const cvOnline = document.getElementById('inf-canvas-online');
                const sbOnline = document.getElementById('shared-board-online');
                
                if (cvOnline && sbOnline) {
                    // YC.TXT FIX: Use container dimensions directly (like Bot Room)
                    const containerRect = sbOnline.getBoundingClientRect();
                    const containerWidth = containerRect.width || window.innerWidth;
                    const containerHeight = containerRect.height || window.innerHeight;

                    // Set canvas internal dimensions to match container
                    cvOnline.width = containerWidth;
                    cvOnline.height = containerHeight;
                    cvOnline.style.width = '100%';
                    cvOnline.style.height = '100%';
                } else {
                    console.warn('[DEBUG-BOARD] inf-canvas-online or shared-board-online NOT found in DOM!');
                }
                
                // YC.TXT FIX: Pass canvas element to initInfCanvas instead of hardcoding
                if (typeof initInfCanvas === 'function' && cvOnline) {
                    initInfCanvas(cvOnline);
                }
                
                // Update infCanvasW/infCanvasH for renderer
                if (typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
                    infCanvasW = cvOnline.width;
                    infCanvasH = cvOnline.height;
                }
                
                // YC.TXT FIX: Reset viewport to center AFTER canvas has correct size (like Bot Room)
                if (typeof vRowF !== 'undefined' && typeof vColF !== 'undefined' &&
                    typeof INF_CS !== 'undefined' && typeof infCanvasW !== 'undefined' && typeof infCanvasH !== 'undefined') {
                    vRowF = -Math.floor(infCanvasH / INF_CS / 2);
                    vColF = -Math.floor(infCanvasW / INF_CS / 2);
                }
                
                if (typeof fitCanvasToContainer === 'function') fitCanvasToContainer();
                if (typeof autoResizeInfCanvas  === 'function') autoResizeInfCanvas();
                if (typeof renderInfiniteBoard  === 'function') renderInfiniteBoard();
            };
            
            // YC.TXT FIX: Measure container directly instead of polling (like Bot Room)
            const sbOnline = document.getElementById('shared-board-online');
            if (sbOnline) {
                // BUG 1 DEBUG: Log event before requestAnimationFrame
                if (typeof Bug1DebugLogger !== 'undefined') {
                    Bug1DebugLogger.logEvent('Firebase.before-requestAnimationFrame', 'online');
                }
                
                // BUG 1 DEBUG: Log metrics before requestAnimationFrame
                if (typeof Bug1DebugLogger !== 'undefined') {
                    Bug1DebugLogger.logMetrics('Firebase.before-requestAnimationFrame', 'online');
                }
                
                // Use requestAnimationFrame to ensure layout has painted
                requestAnimationFrame(() => {
                    // BUG 1 DEBUG: Log event after first requestAnimationFrame
                    if (typeof Bug1DebugLogger !== 'undefined') {
                        Bug1DebugLogger.logEvent('requestAnimationFrame.callback-1', 'online');
                    }
                    
                    // BUG 1 DEBUG: Log metrics after first requestAnimationFrame
                    if (typeof Bug1DebugLogger !== 'undefined') {
                        Bug1DebugLogger.logMetrics('Firebase.after-first-RAF', 'online');
                    }
                    
                    requestAnimationFrame(() => {
                        const rect = sbOnline.getBoundingClientRect();
                        const w = rect.width;
                        const h = rect.height;
                        
                        
                        // BUG 1 DEBUG: Log event before canvas init
                        if (typeof Bug1DebugLogger !== 'undefined') {
                            Bug1DebugLogger.logEvent('Firebase.before-canvas-init', 'online');
                        }
                        
                        // BUG 1 DEBUG: Log metrics before canvas init
                        if (typeof Bug1DebugLogger !== 'undefined') {
                            Bug1DebugLogger.logMetrics('Firebase.before-canvas-init', 'online');
                        }
                        
                        // Initialize canvas regardless of size (like Bot Room)
                        _doInitOnlineCanvas();
                    });
                });
            } else {
                console.warn('[DEBUG-BOARD] shared-board-online container not found, initializing immediately');
                _doInitOnlineCanvas();
            }
            // Hiển thị lượt
            const turnEl = document.getElementById('turn-indicator');
            const luat   = `${room.winCount || 5} quân${room.chan2Dau ? ' (Chặn 2 đầu)' : ''}`;
            const myRoleLC  = myRole ? myRole.toLowerCase() : '';
            const oppRoleLC = myRole === 'X' ? 'o' : 'x';
            if (currentTurn === myRole) {
                if (gameInfo) gameInfo.innerHTML = `<span style='color:#28a745;font-weight:bold;'>Lượt của bạn (${myRole})</span> — ${luat}`;
                if (turnEl)   { turnEl.textContent = `🟢 Lượt của bạn (${myRole}) — hãy đánh!`; turnEl.className = 'my-turn'; }
                // battle-view indicators
                const biMe  = document.getElementById(`battle-indicator-${myRoleLC}`);
                const biOpp = document.getElementById(`battle-indicator-${oppRoleLC}`);
                if (biMe)  { biMe.textContent  = '🟢 Lượt của bạn!'; biMe.className  = 'battle-indicator'; }
                if (biOpp) { biOpp.textContent = 'Đang chờ...';       biOpp.className = 'battle-indicator inactive'; }
                if (!daThongBaoSnapshot) thongBaoHeThong('🟢 Đến lượt bạn đánh!');
            } else if (myRole === 'viewer') {
                if (turnEl) { turnEl.textContent = `👁️ Đang xem — lượt của ${currentTurn}`; turnEl.className = ''; }
                if (!daThongBaoSnapshot) thongBaoHeThong(`👁️ Đang xem — lượt của ${currentTurn}...`);
            } else {
                if (gameInfo) gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn})...</span> — ${luat}`;
                if (turnEl)   { turnEl.textContent = `⏳ Đang chờ đối thủ (${currentTurn})...`; turnEl.className = 'opponent-turn'; }
                // battle-view indicators
                const biMe2  = document.getElementById(`battle-indicator-${myRoleLC}`);
                const biOpp2 = document.getElementById(`battle-indicator-${oppRoleLC}`);
                if (biMe2)  { biMe2.textContent  = 'Đang chờ...';          biMe2.className  = 'battle-indicator inactive'; }
                if (biOpp2) { biOpp2.textContent = '🟢 Lượt đối thủ...'; biOpp2.className = 'battle-indicator'; }
                if (!daThongBaoSnapshot) thongBaoHeThong(`⏳ Đang chờ ${oppName} đánh...`);
            }
            // SYNC board state from Firebase
            _syncRoomBoardState(room);
            // Hiển thị pot cược đang diễn ra (nếu có)
            const betInfoEl = document.getElementById('bet-info-o');
            if (betInfoEl) {
                if (room.betAmount && room.betAmount > 0) {
                    betInfoEl.style.display = 'block';
                    betInfoEl.textContent = `🎲 Đang cược: ${Number(room.betAmount).toLocaleString('vi-VN')} Xu/người — Pot: ${Number(room.betAmount * 2).toLocaleString('vi-VN')} Xu`;
                } else {
                    betInfoEl.style.display = 'none';
                }
            }
        }
        if (room.status === 'ended' || room.winner) {
            _syncRoomBoardState(room);
            if (typeof _updateBattleBottomBar === 'function') _updateBattleBottomBar(true);
            // BUG 3 FIX: Detect if this is a new status change from playing to ended
            const justEnded = _prevRoomStatus === 'playing' && room.status === 'ended';
            _prevRoomStatus = room.status;
            
            // BUG 1 FIX: Only process end game if we haven't processed this specific end state yet
            // Use endedAt as the stable identifier for the finished match.
            const vanId = room.endedAt
                ? `${currentRoomId}_${room.winner || ''}_${room.endedAt}`
                : `${currentRoomId}_${room.updatedAt || ''}`;
            if (_lastProcessedWinner !== vanId) {
                // BUG 3 FIX: If game just ended, wait for render to complete before showing popup
                if (justEnded) {
                    (async () => {
                        // Wait for last move rendering to complete
                        if (typeof renderInfiniteBoardAsync === 'function') {
                            await renderInfiniteBoardAsync();
                        }
                        await xuLyKetThucVan(room);
                    })();
                } else {
                    xuLyKetThucVan(room);
                }
            }
            maybeAutoStartRematch(room);
        } else {
            _prevRoomStatus = room.status;
        }
        // ── Chờ O xác nhận cược ──
        if (room.status === 'bet_confirm') {
            const turnEl = document.getElementById('turn-indicator');
            if (myRole === 'X') {
                // X chờ O xác nhận — chỉ X mới được gọi _thucSuBatDauGame
                if (turnEl) { turnEl.textContent = `⏳ Đang chờ ${tenSafe(room.playerO_name,'O')} xác nhận cược...`; turnEl.className = 'opponent-turn'; }
                thongBaoHeThong('⏳ Đang chờ đối thủ xác nhận cược...');
                // Cả hai đã xác nhận → bắt đầu game
                    if (room.playerXConfirmed && room.playerOConfirmed) {
                    _thucSuBatDauGame(room, resolveRoomWinCount(room), room.chan2Dau ?? true, room.firstTurn || 'X');
                }
            } else if (myRole === 'O') {
                // O thấy popup xác nhận — kể cả khi refresh/vào lại phòng
                const bet = room.betAmount;
                if (turnEl) { turnEl.textContent = `🎲 Chủ phòng mời cược ${Number(bet).toLocaleString('vi-VN')} Xu — hãy xác nhận!`; turnEl.className = 'opponent-turn'; }
                const betInfoEl      = document.getElementById('bet-info-o');
                const betInfoText    = document.getElementById('bet-info-o-text');
                const betConfirmBtns = document.getElementById('bet-confirm-btns');
                if (betInfoEl) betInfoEl.style.display = 'block';
                if (betInfoText) betInfoText.textContent = `🎲 Chủ phòng đặt cược ${Number(bet).toLocaleString('vi-VN')} Xu — chấp nhận hay từ chối?`;
                // Chỉ hiện nút nếu O chưa bấm xác nhận
                if (betConfirmBtns) betConfirmBtns.style.display = room.playerOConfirmed ? 'none' : 'flex';
                if (!room.playerOConfirmed) thongBaoHeThong(`🎲 Xác nhận cược ${Number(bet).toLocaleString('vi-VN')} Xu?`);
                else thongBaoHeThong('✅ Đã xác nhận cược — đang chờ bắt đầu...');
            }
        } else {
            // Ẩn nút xác nhận khi không ở trạng thái bet_confirm
            const betConfirmBtns = document.getElementById('bet-confirm-btns');
            if (betConfirmBtns) betConfirmBtns.style.display = 'none';
        }
        // ── Phòng đang CHỜ (waiting): cập nhật thanh thông báo để không bị kẹt
        // ở nội dung tĩnh "Đã kết nối phòng đấu!" ──
        if (room.status === 'waiting' && !room.winner && !daThongBaoSnapshot) {
            if (myRole === 'X' || myRole === 'O') {
                thongBaoHeThong(oppId
                    ? `🤝 ${oppName} đã sẵn sàng — chờ bắt đầu ván!`
                    : '⏳ Đang chờ đối thủ vào phòng...');
            } else {
                thongBaoHeThong('👁️ Đang chờ trận đấu bắt đầu...');
            }
        }
        // Phòng reset về waiting sau ván kết thúc (chủ phòng bấm Ván Mới)
        // → cả X và O đều cần reset bàn cũ và ẩn overlay
        if (room.status === 'waiting' && !room.winner && daXoaBanCoTranNay === true
            && room.moves && Object.keys(room.moves).length <= 1) {
            daXoaBanCoTranNay = false;
            locallyAppliedLastMove = { row: -2, col: -2 };
            _lastProcessedWinner = '';
            if (typeof window.xoaBanCoCu === 'function') window.xoaBanCoCu();
            const vmOld = document.getElementById('van-moi-overlay');
            if (vmOld) vmOld.remove();
            const btnBack2 = document.getElementById('btn-back-to-result');
            if (btnBack2) btnBack2.remove();
            const turnEl2 = document.getElementById('turn-indicator');
            if (turnEl2) { turnEl2.textContent = '⏳ Đang chờ bắt đầu...'; turnEl2.className = ''; }
        }
        // Phòng bị reset về empty → tự thoát ra sảnh không cần alert
        if (room.status === 'empty' && isOnlineMode && myRole !== 'viewer') {
            _resetSauThoat(roomId);
        }
        // ── TỰ DỌN GHẾ KHI NGƯỜI CHƠI OFFLINE ──────────────────────────
        // Chỉ xử lý khi phòng không đang chơi (playing) và không đang chờ xác nhận cược
        if (room.status !== 'playing' && room.status !== 'bet_confirm') {
            const myId = localStorage.getItem('current_user_id');
            // Kiểm tra X offline (và không phải mình)
            if (room.playerX_id && room.playerX_id !== myId && room.playerX_status === 'offline') {
                if (!_offlineCleanupTimers[`${roomId}_X`]) {
                    _offlineCleanupTimers[`${roomId}_X`] = setTimeout(() => {
                        delete _offlineCleanupTimers[`${roomId}_X`];
                        // Kiểm tra lại trước khi dọn
                        db.ref(`rooms/${roomId}`).once('value').then(s => {
                            const r = s.val();
                            if (!r || r.playerX_status !== 'offline' || r.status === 'playing' || r.status === 'ended') return;
                            // Nếu có O thì O lên ghế X, không thì reset phòng
                            if (r.playerO_id) {
                                db.ref(`rooms/${roomId}`).update({
                                    playerX_id: r.playerO_id, playerX_name: r.playerO_name, playerX_status: 'online',
                                    playerO_id: '', playerO_name: '', playerO_status: 'offline',
                                    status: 'waiting', updatedAt: Date.now()
                                });
                            } else {
                                db.ref(`rooms/${roomId}`).update({
                                    playerX_id: '', playerX_name: '', playerX_status: 'offline',
                                    status: 'empty', updatedAt: Date.now()
                                });
                            }
                        });
                    }, 30000); // 30 giây
                }
            } else {
                // X online hoặc không có X → hủy timer nếu đang chạy
                if (_offlineCleanupTimers[`${roomId}_X`]) {
                    clearTimeout(_offlineCleanupTimers[`${roomId}_X`]);
                    delete _offlineCleanupTimers[`${roomId}_X`];
                }
            }
            // Kiểm tra O offline (và không phải mình)
            if (room.playerO_id && room.playerO_id !== myId && room.playerO_status === 'offline') {
                if (!_offlineCleanupTimers[`${roomId}_O`]) {
                    _offlineCleanupTimers[`${roomId}_O`] = setTimeout(() => {
                        delete _offlineCleanupTimers[`${roomId}_O`];
                        db.ref(`rooms/${roomId}`).once('value').then(s => {
                            const r = s.val();
                            if (!r || r.playerO_status !== 'offline' || r.status === 'playing' || r.status === 'ended') return;
                            db.ref(`rooms/${roomId}`).update({
                                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                                updatedAt: Date.now()
                            });
                        });
                    }, 30000);
                }
            } else {
                if (_offlineCleanupTimers[`${roomId}_O`]) {
                    clearTimeout(_offlineCleanupTimers[`${roomId}_O`]);
                    delete _offlineCleanupTimers[`${roomId}_O`];
                }
            }
        }
    });
}
function capNhatUIPhong(room) {
    const txtTitle = document.getElementById('txt-room-title');
    const namePX   = document.getElementById('name-pX');
    const namePO   = document.getElementById('name-pO');
    const statusPX = document.getElementById('status-pX');
    const statusPO = document.getElementById('status-pO');
    const btnStart = document.getElementById('btn-start-game');
    const btnKick  = document.getElementById('btn-kick-player');
    // Lấy số phòng từ room.roomNumber hoặc parse từ currentRoomId (tránh hiện "?")
    const roomNum = room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?');
    if (txtTitle) txtTitle.innerText = `Phòng ${roomNum}`;
    // Có người ngồi ghế nhưng tên rỗng → fallback, tránh hiển thị sai "Đang chờ..."
    if (namePX)   namePX.innerText   = room.playerX_id ? tenSafe(room.playerX_name, 'Người chơi X') : 'Đang chờ...';
    if (namePO)   namePO.innerText   = room.playerO_id ? tenSafe(room.playerO_name, 'Người chơi O') : 'Chờ đối thủ...';
    // Cập nhật avatar trong versus card (room-view) từ dữ liệu phòng
    const rvAvX = document.getElementById('room-avatar-x');
    if (rvAvX) {
        if (room.playerX_avatar) {
            rvAvX.textContent = room.playerX_avatar;
            rvAvX.style.fontSize = '24px';
        } else {
            // Reset avatar về mặc định khi ghế trống
            rvAvX.textContent = 'X';
            rvAvX.style.fontSize = '';
        }
    }
    const rvAvO = document.getElementById('room-avatar-o');
    if (rvAvO) {
        if (room.playerO_avatar) {
            rvAvO.textContent = room.playerO_avatar;
            rvAvO.style.fontSize = '24px';
        } else {
            // Reset avatar về mặc định khi ghế trống
            rvAvO.textContent = 'O';
            rvAvO.style.fontSize = '';
        }
    }
    const myId     = localStorage.getItem('current_user_id');
    const laChuX   = myId === room.playerX_id;
    const coDoiThu = !!room.playerO_id;
    if (statusPX) statusPX.innerText = room.playerX_status === 'online' ? 'Sẵn sàng' : 'Offline';
    if (statusPO) statusPO.innerText = coDoiThu ? (room.playerO_status === 'online' ? 'Sẵn sàng' : 'Offline') : 'Trống ghế';
    // LED kết nối
    const ledX = document.getElementById('led-pX');
    const ledO = document.getElementById('led-pO');
    if (ledX) ledX.style.background = room.playerX_status === 'online' ? '#28a745' : '#dc3545';
    if (ledO) ledO.style.background = coDoiThu && room.playerO_status === 'online' ? '#28a745' : '#aaa';
    // Panel luật — chỉ X thấy khi waiting
    const rulesPanel = document.getElementById('room-rules-panel');
    if (rulesPanel) {
        const showRules = laChuX && room.status === 'waiting';
        rulesPanel.style.display = showRules ? 'block' : 'none';
        const selWin   = document.getElementById('room-win-count');
        const radioYes = document.getElementById('room-chan-2-dau-yes');
        const radioNo  = document.getElementById('room-chan-2-dau-no');
        const selFirst = document.getElementById('room-first-turn');
        if (selWin  && document.activeElement !== selWin)  selWin.value    = (typeof resolveRoomWinCount === 'function' ? resolveRoomWinCount(room) : (room.winCount || 5));
        if (radioYes && radioNo && document.activeElement !== radioYes && document.activeElement !== radioNo) {
            const chan2Dau = room.chan2Dau ?? true;
            radioYes.checked = !!chan2Dau;
            radioNo.checked  = !chan2Dau;
        }
        if (selFirst && document.activeElement !== selFirst) selFirst.value = room.firstTurn || 'X';
    }
    // Nút Bắt đầu & Kick — chỉ X khi waiting có đối thủ
    const showControls = laChuX && coDoiThu && room.status === 'waiting';
    const oReady = room.guestReady || room.playerOConfirmed;
    if (btnKick)  btnKick.style.display  = showControls ? 'inline-block' : 'none';
    if (btnStart) {
        btnStart.style.display = showControls ? 'inline-block' : 'none';
        if (showControls) {
            btnStart.textContent = oReady
                ? '▶ Bắt đầu'
                : '⏳ Chờ khách SẴN SÀNG...';
            btnStart.disabled    = !oReady;
            btnStart.style.opacity = !oReady ? '0.55' : '1';
        }
    }
    // Panel cược — X thấy ô nhập khi waiting
    const betPanel = document.getElementById('bet-panel-room');
    if (betPanel) {
        betPanel.style.display = (laChuX && room.status === 'waiting') ? 'block' : 'none';
    }
    // bet-info-o: khi waiting hiện thông báo tĩnh cho O; khi bet_confirm thì realtime listener xử lý
    const betInfo  = document.getElementById('bet-info-o');
    const betInfoText = document.getElementById('bet-info-o-text');
    const btnGuestReady = document.getElementById('btn-guest-ready');
    const btnGuestCancel = document.getElementById('btn-guest-cancel-ready');
    if (betInfo) {
        if (!laChuX && (room.status === 'waiting' || room.status === 'bet_confirm')) {
            const hasBet = room.betAmount && room.betAmount >= 100;
            betInfo.style.display = hasBet ? 'block' : 'none';
            if (hasBet) {
                if (betInfoText) betInfoText.textContent =
                    `🎲 Chủ phòng đặt cược: ${Number(room.betAmount).toLocaleString('vi-VN')} Xu — hãy xác nhận!`;
            }
            // Luôn hiển thị nút SẴN SÀNG cho khách O khi vào phòng
            const myId = localStorage.getItem('current_user_id');
            const isCurrentGuest = myId && myId === room.playerO_id;
            const oConfirmed = room.playerOConfirmed || room.guestReady;
            
            if (btnGuestReady) {
                // Chỉ hiện nút nếu là khách O hiện tại
                if (isCurrentGuest) {
                    // Nếu chưa xác nhận → hiện nút Sẵn sàng
                    if (!oConfirmed) {
                        btnGuestReady.style.display = 'inline-block';
                        if (btnGuestCancel) btnGuestCancel.style.display = 'none';
                    } else {
                        btnGuestReady.style.display = 'none';
                        if (btnGuestCancel) btnGuestCancel.style.display = 'inline-block';
                    }
                } else {
                    // Không phải khách O → ẩn cả 2 nút
                    btnGuestReady.style.display = 'none';
                    if (btnGuestCancel) btnGuestCancel.style.display = 'none';
                }
            }
            const guestMsg = document.getElementById('guest-ready-msg');
            if (oConfirmed && isCurrentGuest) {
                if (guestMsg) { guestMsg.style.display = 'block'; guestMsg.textContent = '✅ Đã sẵn sàng! Chờ chủ phòng bắt đầu...'; }
            } else {
                if (guestMsg) guestMsg.style.display = 'none';
            }
        } else if (room.status !== 'bet_confirm') {
            betInfo.style.display = 'none';
            // Ẩn nút Sẵn sàng khi không phải khách O
            if (btnGuestReady) btnGuestReady.style.display = 'none';
            if (btnGuestCancel) btnGuestCancel.style.display = 'none';
        }
    }
}
function capNhatUIPhongOnline(room) {
    if (!room) return;
    // Load thông tin cả 2 người chơi ngay lập tức
    if (room.playerX_id) loadPlayerInfo(room.playerX_id, 'X');
    if (room.playerO_id) loadPlayerInfo(room.playerO_id, 'O');
    
    // YC.TXT FIX: Reset avatar về mặc định khi ghế trống
    if (!room.playerX_id) {
        const slotXAv = document.querySelector('#slot-playerX .avatar-circle');
        if (slotXAv) { slotXAv.textContent = 'X'; slotXAv.style.fontSize = ''; }
        const pcXAv = document.querySelector('#panel-playerX .pc-avatar');
        if (pcXAv) { pcXAv.textContent = 'X'; pcXAv.style.fontSize = ''; }
    }
    if (!room.playerO_id) {
        const slotOAv = document.querySelector('#slot-playerO .avatar-circle');
        if (slotOAv) { slotOAv.textContent = 'O'; slotOAv.style.fontSize = ''; }
        const pcOAv = document.querySelector('#panel-playerO .pc-avatar');
        if (pcOAv) { pcOAv.textContent = 'O'; pcOAv.style.fontSize = ''; }
    }
}
function loadPlayerInfo(userId, role) {
    // Load user data và room data song song để tối ưu tốc độ
    const userPromise = db.ref('users/' + userId).once('value');
    let roomPromise = Promise.resolve(null);
    
    if (currentRoomId) {
        roomPromise = db.ref(`rooms/${currentRoomId}`).once('value');
    }
    
    Promise.all([userPromise, roomPromise]).then(([userSnap, roomSnap]) => {
        const u = userSnap.val();
        if (!u) return;
        const rank        = getRankName(u.winBot, u.winSolo);
        const displayName = tenHienThi(u, 'Người chơi ' + role);
        // Lấy avatar: ưu tiên equippedAvatar (shop), fallback avatar cũ, fallback chữ cái đầu
        let avatar = '';
        if (u.equippedAvatar && typeof SHOP_AVATAR_LIST !== 'undefined') {
            const avDef = SHOP_AVATAR_LIST.find(a => a.id === u.equippedAvatar);
            if (avDef) avatar = avDef.emoji;
        }
        if (!avatar && u.avatar) avatar = u.avatar;
        if (!avatar) avatar = displayName[0].toUpperCase();
        const isEmoji = avatar.length <= 2 && /\p{Emoji}/u.test(avatar);
        // Lưu skinId của người chơi này để bàn cờ dùng khi render
        // Ưu tiên skin từ room data (được set khi join), fallback về user profile
        let skinId = 'skin_default';
        const room = roomSnap ? roomSnap.val() : null;
        if (room) {
            const roomSkinField = role === 'X' ? 'playerX_skin' : 'playerO_skin';
            if (room[roomSkinField]) {
                skinId = room[roomSkinField];
            } else {
                skinId = u.equippedSkin || 'skin_default';
            }
        } else {
            skinId = u.equippedSkin || 'skin_default';
        }
        
        if (role === 'X') {
            window._onlineSkinX = skinId;
        }
        if (role === 'O') {
            window._onlineSkinO = skinId;
        }
        // Cập nhật cursor ngay sau khi skin load xong
        if (typeof updateCursorByTurn === 'function') updateCursorByTurn();
        
        // Re-render bàn cờ sau khi skin load xong để áp dụng skin mới
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
        // Avatar đối thủ lên thanh thông báo hệ thống
        if ((myRole === 'X' || myRole === 'O') && role !== myRole) {
            const annFace = document.querySelector('#bot-avatar.online-announce .bot-face');
            if (annFace) annFace.textContent = isEmoji ? avatar : displayName[0].toUpperCase();
        }
        // ── battle-view (index.html: view-battle) ──
        const roleLC = role.toLowerCase(); // 'x' hoặc 'o'
        const battleAv = document.getElementById(`battle-avatar-${roleLC}`);
        if (battleAv) {
            battleAv.textContent = avatar;
            battleAv.style.fontSize = isEmoji ? '28px' : '18px';
        }
        const battleName = document.getElementById(`battle-name-${roleLC}`);
        if (battleName) battleName.textContent = `${displayName} (${rank})`;
        const battleStats = document.getElementById(`battle-stats-${roleLC}`);
        if (battleStats) battleStats.textContent = `🤖 ${u.winBot||0} · ⚔️ ${u.winSolo||0} · 📉 ${u.loseSolo||0}`;
        // room-view: avatar trong versus-container (slot card)
        const roomAvX = document.getElementById('room-avatar-x');
        const roomAvO = document.getElementById('room-avatar-o');
        const roomAv = role === 'X' ? roomAvX : roomAvO;
        if (roomAv) {
            roomAv.textContent = avatar;
            roomAv.style.fontSize = isEmoji ? '28px' : '18px';
        }
        const roomName = document.getElementById(`name-p${role}`);
        if (roomName) roomName.textContent = displayName;
        // Panel bên cạnh bàn cờ (index1.html)
        const nameEl = document.getElementById(`view-name-${role}`);
        if (nameEl) nameEl.innerText = displayName + ` (${rank})`;
        // Avatar trên panel bên cạnh bàn cờ
        const pcAv = document.querySelector(`#panel-player${role} .pc-avatar`);
        if (pcAv) {
            pcAv.textContent = avatar;
            pcAv.style.fontSize = isEmoji ? '28px' : '20px';
        }
        // Avatar trong versus-container (slot-playerX/O)
        const slotAv = document.querySelector(`#slot-player${role} .avatar-circle`);
        if (slotAv) {
            slotAv.textContent = avatar;
            slotAv.style.fontSize = isEmoji ? '26px' : '18px';
        }
        // Hiển thị skin preview trên panel (nếu có element)
        const skinPreviewEl = document.getElementById(`skin-preview-${role}`);
        if (skinPreviewEl && typeof getSkinById === 'function') {
            const skin = getSkinById(skinId);
            skinPreviewEl.textContent = role === 'X' ? skin.icon_X : skin.icon_O;
            skinPreviewEl.title = skin.name;
        }
        // Render lại bàn cờ để áp dụng skin đúng cho từng bên
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    });
}
// ══════════════════════════════════════════════════════════════════
// ♟️ GỬI NƯỚC ĐI & VẼ BÀN CỜ
// ══════════════════════════════════════════════════════════════════
window.guiNuocDiLenFirebase = function(row, col) {
    if (!isOnlineMode || currentTurn !== myRole || !currentRoomId || !db) {
        return Promise.resolve(false);
    }
    const nextTurn = myRole === 'X' ? 'O' : 'X';
    const roomRef  = db.ref(`rooms/${currentRoomId}`);
    
    // ══════════════════════════════════════════════════════════════════
    // SINGLE SOURCE OF TRUTH: Use Firebase room rules, NOT hardcoded default
    // ══════════════════════════════════════════════════════════════════
    let roomRules = (typeof GameState !== 'undefined' && GameState.roomRules) 
        ? GameState.roomRules 
        : null;
    
    if (!roomRules) {
        // Fallback: read from Firebase room snapshot if GameState.roomRules is undefined
        const lastRoom = (typeof window !== 'undefined' && window._lastRoomSnapshot) 
            ? window._lastRoomSnapshot 
            : null;
        if (lastRoom) {
            roomRules = {
                winCount: typeof lastRoom.winCount === 'number' ? lastRoom.winCount : 5,
                chan2Dau: typeof lastRoom.chan2Dau === 'boolean' ? lastRoom.chan2Dau : (lastRoom.chan2Dau ?? true),
                firstTurn: lastRoom.firstTurn || 'X'
            };
            console.log('[RULE-AUDIT] guiNuocDiLenFirebase using Firebase room snapshot:', roomRules);
        } else {
            // Final fallback - should rarely happen if langNgheThayDoiPhong synced correctly
            roomRules = { winCount: 5, chan2Dau: true, firstTurn: 'X' };
            console.warn('[RULE-AUDIT] guiNuocDiLenFirebase using FINAL fallback (GameState.roomRules and Firebase snapshot both undefined):', roomRules);
        }
    }
    
    console.log('[RULE-AUDIT]', {
        mode: 'ONLINE',
        action: 'guiNuocDiLenFirebase',
        roomId: currentRoomId,
        winCount: roomRules.winCount,
        chan2Dau: roomRules.chan2Dau,
        source: roomRules === (typeof GameState !== 'undefined' && GameState.roomRules) ? 'GAMESTATE_ROOM_RULES' : 'ONLINE_FIREBASE_SNAPSHOT',
        timestamp: Date.now()
    });
    
    console.log('[RULE-WIN-TRACE]', {
        mode: 'ONLINE',
        action: 'guiNuocDiLenFirebase',
        player: myRole,
        row, col,
        winCount: roomRules.winCount,
        chan2Dau: roomRules.chan2Dau,
        blockedTwoEnds: !!roomRules.chan2Dau,
        source: 'guiNuocDiLenFirebase',
        roomId: currentRoomId,
        roomRules: roomRules
    });
    
    const isWin = (typeof checkWinSilent === 'function') ? checkWinSilent(row, col, roomRules) : false;
    const moveKey  = `${row}_${col}`;  // Key xác định ô — dùng để check O(1)
    return roomRef.transaction(data => {
        if (!data) return null; // retry
        if (data.turn !== myRole) return null;
        if (data.status !== 'playing') return null;
        // Block move submission while an undo request is pending
        if (data.undoRequest) return null;
        // Kiểm tra ô đã bị đánh chưa — O(1) lookup thay vì O(n) loop
        if (data.moves && data.moves[moveKey]) return null;
        data.turn     = nextTurn;
        data.status   = isWin ? 'ended' : 'playing';
        data.winner   = isWin ? myRole  : '';
        data.lastMove = { row, col, by: myRole, ts: Date.now() };
        if (!isWin) data.turnStartedAt = firebase.database.ServerValue.TIMESTAMP;
        if (isWin) data.endedAt = Date.now();
        data.updatedAt = Date.now();
        // Ghi nước đi vào moves với key tọa độ
        if (!data.moves) data.moves = {};
        data.moves[moveKey] = { row, col, by: myRole, timestamp: Date.now() };
        return data;
    }).then(result => !!result.committed)
      .catch(() => false);
};
function thucHienVeNuocDi(row, col, role) {
    console.log('[RULE-AUDIT] thucHienVeNuocDi called with:', { row, col, role });
    
    if (typeof setCell === 'function')      setCell(row, col, role);
    if (typeof moveHistory !== 'undefined') moveHistory.push({ r: row, c: col, player: role });
    if (typeof lastMoveR   !== 'undefined') { lastMoveR = row; lastMoveC = col; }
    if (typeof infCanvasW !== 'undefined' && typeof INF_CS !== 'undefined') {
        const cols = infCanvasW / INF_CS, rows = infCanvasH / INF_CS;
        if (Math.abs((row - vRowF) - rows / 2) > rows * 0.35 || Math.abs((col - vColF) - cols / 2) > cols * 0.35) {
            vRowF = row - rows / 2; vColF = col - cols / 2;
        }
    }
    if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    
    // ══════════════════════════════════════════════════════════════════
    // SINGLE SOURCE OF TRUTH: Use Firebase room rules, NOT offline checkbox
    // ══════════════════════════════════════════════════════════════════
    let roomRules = (typeof GameState !== 'undefined' && GameState.roomRules) 
        ? GameState.roomRules 
        : null;
    
    if (!roomRules && isOnlineMode) {
        // Online mode: read from Firebase room snapshot if GameState.roomRules is undefined
        const lastRoom = (typeof window !== 'undefined' && window._lastRoomSnapshot) 
            ? window._lastRoomSnapshot 
            : null;
        if (lastRoom) {
            roomRules = {
                winCount: typeof lastRoom.winCount === 'number' ? lastRoom.winCount : 5,
                chan2Dau: typeof lastRoom.chan2Dau === 'boolean' ? lastRoom.chan2Dau : (lastRoom.chan2Dau ?? true),
                firstTurn: lastRoom.firstTurn || 'X'
            };
            console.log('[RULE-AUDIT] thucHienVeNuocDi using Firebase room snapshot:', roomRules);
        } else {
            // Final fallback - should rarely happen if langNgheThayDoiPhong synced correctly
            roomRules = { winCount: 5, chan2Dau: true, firstTurn: 'X' };
            console.warn('[RULE-AUDIT] thucHienVeNuocDi using FINAL fallback (GameState.roomRules and Firebase snapshot both undefined):', roomRules);
        }
    }
    
    console.log('[RULE-AUDIT]', {
        mode: isOnlineMode ? 'ONLINE' : 'OFFLINE',
        action: 'thucHienVeNuocDi',
        roomId: currentRoomId,
        winCount: roomRules ? roomRules.winCount : 'undefined',
        chan2Dau: roomRules ? roomRules.chan2Dau : 'undefined',
        source: roomRules === (typeof GameState !== 'undefined' && GameState.roomRules) ? 'GAMESTATE_ROOM_RULES' : (isOnlineMode ? 'ONLINE_FIREBASE_SNAPSHOT' : 'OFFLINE_CHECKBOX'),
        timestamp: Date.now()
    });
    
    if (typeof checkWin === 'function' && checkWin(row, col, roomRules)) {
        console.log('[RULE-WIN-TRACE]', {
            mode: isOnlineMode ? 'ONLINE' : 'OFFLINE',
            player: role,
            row, col,
            winCount: roomRules ? roomRules.winCount : 'unknown',
            chan2Dau: roomRules ? roomRules.chan2Dau : 'unknown',
            blockedTwoEnds: roomRules ? !!roomRules.chan2Dau : 'unknown',
            source: 'thucHienVeNuocDi',
            roomId: currentRoomId,
            result: 'WIN'
        });
        if (typeof isGameActive !== 'undefined') isGameActive = false;
        // Show navigation when game ends
        if (typeof showTopNavigation === 'function') {
            showTopNavigation();
        }
        setTimeout(() => {
            if (typeof showWinOverlay === 'function') showWinOverlay(role, false, '', '');
            if (typeof gameTotalTimer  !== 'undefined' && gameTotalTimer)  clearInterval(gameTotalTimer);
            if (typeof playerTurnTimer !== 'undefined' && playerTurnTimer) clearInterval(playerTurnTimer);
        }, 500);
        return;
    }
    if (typeof currentPlayer  !== 'undefined') currentPlayer = role === 'X' ? 'O' : 'X';
    if (typeof updateCursorByTurn === 'function') updateCursorByTurn();
    if (typeof updateStatus       === 'function') updateStatus();
}
function phucHoiBanCo(roomId, callback) {
    db.ref(`rooms/${roomId}/moves`).once('value').then(snap => {
        const movesData = snap.val();
        if (!movesData) {
            console.warn('[DEBUG-BOARD] No moves data found in Firebase, using fallback — board will be empty');
            if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
            if (callback) callback();
            return;
        }
        // BUG 5 FIX: Use setCell to clear board instead of direct infiniteMap.clear()
        // This ensures GameState synchronization
        if (typeof infiniteMap  !== 'undefined') {
            infiniteMap.clear();
            // Also clear GameState if available
            if (typeof GameState !== 'undefined' && GameState.board.infiniteMap) {
                GameState.board.infiniteMap.clear();
            }
        }
        if (typeof moveHistory  !== 'undefined') moveHistory.length = 0;
        if (typeof winningCellCoords !== 'undefined') winningCellCoords.length = 0;
        if (typeof lastMoveR    !== 'undefined') { lastMoveR = null; lastMoveC = null; }
        const list = Object.values(movesData)
            .filter(m => m && m.row !== undefined && m.col !== undefined && m.by)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        list.forEach(m => {
            if (typeof setCell      === 'function') setCell(m.row, m.col, m.by);
            if (typeof moveHistory  !== 'undefined') moveHistory.push({ r: m.row, c: m.col, player: m.by });
            if (typeof lastMoveR    !== 'undefined') { lastMoveR = m.row; lastMoveC = m.col; }
        });
        if (list.length > 0) {
            const last = list[list.length - 1].by;
            if (typeof currentPlayer !== 'undefined') currentPlayer = last === 'X' ? 'O' : 'X';
        }
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
        if (typeof updateCursorByTurn  === 'function') updateCursorByTurn();
        if (callback) callback();
    });
}
// ══════════════════════════════════════════════════════════════════
// 🏁 KẾT THÚC VÁN
// ══════════════════════════════════════════════════════════════════
// Guard tránh cập nhật rank nhiều lần cho cùng 1 ván
let _lastProcessedWinner = '';
async function xuLyKetThucVan(room) {
    if (!room.winner) return;
    
    console.log('[Game End] ===== GAME ENDED =====');
    console.log('[Game End] RoomId:', currentRoomId);
    console.log('[Game End] Winner:', room.winner);
    console.log('[Game End] EndReason:', room.endReason);
    console.log('[Game End] EndedAt:', room.endedAt);
    console.log('[Game End] Room Status:', room.status);
    console.log('[Game End] PlayerX_id:', room.playerX_id);
    console.log('[Game End] PlayerO_id:', room.playerO_id);
    
    const vanId = room.endedAt
        ? `${currentRoomId}_${room.winner || ''}_${room.endedAt}`
        : `${currentRoomId}_${room.winner || ''}_${room.updatedAt || ''}`;
    if (_lastProcessedWinner === vanId) return;
    _lastProcessedWinner = vanId;
    daXoaBanCoTranNay = false;
    const xName     = tenSafe(room.playerX_name, 'Người chơi X');
    const oName     = tenSafe(room.playerO_name, 'Người chơi O');
    const winName   = room.winner === 'X' ? xName : oName;
    const loseName  = room.winner === 'X' ? oName : xName;
    const endReason = room.endReason || '';
    let msg = endReason.includes('bỏ cuộc')
        ? `🏳️ ${endReason.includes('X') ? xName : oName} bỏ cuộc. ${winName} thắng!`
        : `🏆 ${winName} thắng!`;
    const gameInfo = document.getElementById('game-info');
    if (gameInfo) gameInfo.innerHTML = `<b style='color:#d9534f;'>${msg}</b>`;
    const turnEl = document.getElementById('turn-indicator');
    if (turnEl) { turnEl.textContent = msg; turnEl.className = ''; }
    // Thanh thông báo hệ thống: [Tên người thắng] đã giành chiến thắng!
    thongBaoHeThong(endReason.includes('bỏ cuộc')
        ? `🏳️ ${loseName} bỏ cuộc — ${winName} đã giành chiến thắng!`
        : `🏆 ${winName} đã giành chiến thắng!`);
    // Hiện UI chọn ván mới (chỉ với người chơi thực, không phải viewer)
    const myIdKetThuc = localStorage.getItem('current_user_id');
    const isPlayer = myRole === 'X' || myRole === 'O' ||
                     myIdKetThuc === room.playerX_id || myIdKetThuc === room.playerO_id;
    const minBetCheck = room.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
    const hasBet = Number(room.betAmount || 0) >= minBetCheck;
    if (isPlayer) {
        // BUG 1 FIX (REAL ROOT CAUSE): Don't call playCoinBurstAsync(0) here.
        // The coin reward animation is fired by the reward/settlement code itself,
        // so only wait for that in-flight animation and then show the rematch popup.
        if (typeof playCoinBurstAsync === 'function') {
            await playCoinBurstAsync(0, '');
        }
        hienUIVanMoi(msg);
    }
    const winnerId  = room.winner === 'X' ? room.playerX_id : room.playerO_id;
    const loserId   = room.winner === 'X' ? room.playerO_id : room.playerX_id;
    const myId      = localStorage.getItem('current_user_id');
    // Thắng thực sự = không có endReason "bỏ cuộc" (tức là thắng bằng nước cờ)
    const thangThucSu = !endReason.includes('bỏ cuộc');
    // Chỉ người thắng ghi rank — ưu tiên người thắng ghi để tránh trùng
    if (myId === winnerId) {
        
        // Chỉ +winSolo khi thắng bằng nước cờ thực sự
        if (thangThucSu) {
            await db.ref(`users/${winnerId}/winSolo`).transaction(c => (c || 0) + 1);
            capNhatBXH(winName, winnerId);
            // Thay đổi: chỉ gọi onWinSoloXu khi phòng có betAmount > 0 (không thưởng khi bet = 0)
            if (hasBet && typeof onWinSoloXu === 'function') await onWinSoloXu();
            // Broadcast kết quả lên ticker toàn server
            const _roomNum = room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?');
            db.ref('match_results').push({
                msg: `🏆 ${winName} đã đánh bại ${loseName} tại Phòng ${_roomNum}!`,
                ts: Date.now()
            });
        } else {
            // Thắng do đối thủ bỏ cuộc — chỉ thưởng nếu không có cược
            // Nếu có cược, ketThucCuoc sẽ xử lý đầy đủ
            if (!hasBet && typeof showXuPopup === 'function') {
                showXuPopup(Math.floor((XU_CONFIG ? XU_CONFIG.SOLO_WIN_REWARD : 200) / 2), 'Đối thủ bỏ cuộc 🏳️');
            }
        }
        // Thua do bỏ cuộc vẫn tính loseSolo cho người thua
        if (loserId) db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
        ghiLichSu(`Phòng ${room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?')}`, xName, oName, room.winner, resolveRoomWinCount(room));
    } else if (myId === loserId) {
        // Người thua — tính loseSolo
        db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
        if (!winnerId) {
            // Fallback: winner không online
        }
    }
    // Xử lý cược: gọi từ cả winner và loser khi có cược
    // Winner và loser đều nhận xu popup tương ứng
    if (hasBet && typeof ketThucCuoc === 'function') {
        await ketThucCuoc(currentRoomId, room.winner, false);
    }

    // Preserve rematch configuration so O can confirm keep-cược/luật
    if (typeof db !== 'undefined' && currentRoomId) {
        db.ref(`rooms/${currentRoomId}`).update({
            rematchConfig: {
                betAmount: room.betAmount || null,
                winCount: resolveRoomWinCount(room),
                chan2Dau: room.chan2Dau ?? true,
                firstTurn: room.firstTurn || 'X',
                isVip: room.isVip || false
            },
            rematchRequested: false,
            updatedAt: Date.now()
        });
    }
}
// ══════════════════════════════════════════════════════════════════
// 🔄 UI VÁN MỚI & CHỈNH LUẬT
// ══════════════════════════════════════════════════════════════════
function hienUIVanMoi(msg) {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    // Xóa nút xem lại nếu còn
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();
    const winOv = document.getElementById('win-overlay');
    if (winOv) winOv.classList.remove('show');
    if (typeof stopConfetti === 'function') stopConfetti();
    const overlay = document.createElement('div');
    overlay.id = 'van-moi-overlay';
    overlay.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:white; padding:24px 28px; border-radius:14px;
        box-shadow:0 8px 32px rgba(0,0,0,0.3); z-index:99999;
        font-family:Arial; text-align:center; min-width:260px; max-width:360px;
    `;
    const isX = myRole === 'X';
    const actHTML = isX ? `
        <p style="margin:10px 0 14px;color:#555;font-size:13px;">Chỉnh luật ở thanh phòng rồi bấm ĐẤU LẠI hoặc Bắt đầu.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button onclick="xemLaiBanCo()" style="padding:9px 14px;background:#6c757d;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🔍 Xem lại</button>
            <button onclick="requestRematchFromWinOverlay()" style="padding:9px 20px;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:bold;">🕹 Đấu lại</button>
            <button onclick="thoatPhongSauVan()" style="padding:9px 12px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Thoát</button>
        </div>
    ` : `
        <p style="margin:10px 0 12px;color:#555;font-size:13px;">Chờ chủ phòng bắt đầu ván mới — hoặc bấm Đồng Ý để giữ cược/luật cũ.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button onclick="xemLaiBanCo()" style="padding:9px 14px;background:#6c757d;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🔍 Xem lại</button>
            <button onclick="oSanSangVaQuayVePhong()" style="padding:9px 16px;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;">🟢 Đồng ý chơi lại giữ cược</button>
            <button onclick="thoatPhongSauVan()" style="padding:9px 12px;background:#dc2626;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Thoát</button>
        </div>
    `;
    overlay.innerHTML = `
        <div style="font-size:40px;margin-bottom:8px;">🏆</div>
        <div style="font-size:18px;font-weight:bold;color:#333;margin-bottom:4px;">${msg}</div>
        ${actHTML}
    `;
    document.body.appendChild(overlay);
    if (isX) {
        const rulesPanel = document.getElementById('room-rules-panel');
        if (rulesPanel) rulesPanel.style.display = 'block';
    }
}
function oSanSangVaQuayVePhong() {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();
    const winOv = document.getElementById('win-overlay');
    if (winOv) winOv.classList.remove('show');
    const rematchModal = document.getElementById('rematch-confirm-modal');
    if (rematchModal) rematchModal.style.display = 'none';
    if (typeof window.oSanSang === 'function') {
        window.oSanSang();
    }
    if (typeof window.quayLaiPhongChinhO === 'function') {
        window.quayLaiPhongChinhO();
    }
}
function xemLaiBanCo() {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    const winOv = document.getElementById('win-overlay');
    if (winOv) winOv.classList.remove('show');
    const rematchModal = document.getElementById('rematch-confirm-modal');
    if (rematchModal) rematchModal.style.display = 'none';
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();

    if (typeof _updateBattleBottomBar === 'function') _updateBattleBottomBar(true);
}
window.xemLaiBanCo = xemLaiBanCo;
function batDauVanMoi() {
    if (!currentRoomId || myRole !== 'X') return;
    // Reset local
    daXoaBanCoTranNay = false;
    locallyAppliedLastMove = { row: -2, col: -2 };
    _lastProcessedWinner = '';
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();
    if (typeof window.xoaBanCoCu === 'function') window.xoaBanCoCu();

    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val() || {};
        const rematchConfig = room.rematchConfig || {
            betAmount: room.betAmount || null,
            winCount:  resolveRoomWinCount(room),
            chan2Dau:  room.chan2Dau ?? true,
            firstTurn: room.firstTurn || 'X',
            isVip:     room.isVip || false
        };
        const updates = {
            status:            'waiting',
            winner:            '',
            endReason:         '',
            moves:             { init: true },
            lastMove:          { row: -1, col: -1, by: '' },
            endedAt:           null,
            turnStartedAt:     null,
            rematchRequested:  false,
            rematchXReady:     false,
            rematchOReady:     false,
            guestReady:        false,
            playerXConfirmed:  null,
            playerOConfirmed:  null,
            // Per-player undo usage: reset for new match
            undoUsed:          { X: false, O: false },
            updatedAt:         firebase.database.ServerValue.TIMESTAMP
        };
        const isRematch = Boolean(room.rematchConfig || room.status === 'ended');
        if (isRematch) {
            updates.betAmount = rematchConfig.betAmount || null;
            updates.betPot = 0;
            updates.winCount = rematchConfig.winCount;
            updates.chan2Dau = rematchConfig.chan2Dau;
            updates.firstTurn = rematchConfig.firstTurn;
            updates.isVip = rematchConfig.isVip;
            updates.rematchConfig = rematchConfig;
            updates.rematchRequested = !!room.rematchRequested;
            // Preserve rematch-related flags if the guest already accepted
            updates.guestReady = room.guestReady || false;
            updates.playerOConfirmed = room.playerOConfirmed || null;
            updates.playerXConfirmed = room.playerXConfirmed || null;
            updates.rematchXReady = room.rematchXReady || false;
            updates.rematchOReady = room.rematchOReady || false;
        } else {
            updates.betAmount = null;
            updates.betPot = 0;
            updates.guestReady = false;
            updates.playerOConfirmed = null;
            updates.playerXConfirmed = null;
            updates.rematchConfig = null;
            updates.rematchRequested = false;
        }
        db.ref(`rooms/${currentRoomId}`).update(updates);
    });
}
window.batDauVanMoi = batDauVanMoi;

function getRematchConfigFromRoom(room) {
    return room.rematchConfig || {
        betAmount: room.betAmount || null,
        winCount:  resolveRoomWinCount(room),
        chan2Dau:  room.chan2Dau ?? true,
        firstTurn: room.firstTurn || 'X',
        isVip:     room.isVip || false
    };
}

function maybeAutoStartRematch(room) {
    if (!room || room.status !== 'ended' || !room.rematchRequested) return;
    if (!room.rematchXReady || !room.rematchOReady) return;
    if (!currentRoomId || myRole !== 'X') return;

    const rematchConfig = getRematchConfigFromRoom(room);
    const minBetCheck = rematchConfig.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
    const hasBet = rematchConfig.betAmount && rematchConfig.betAmount >= minBetCheck;

    if (hasBet) {
        db.ref(`rooms/${currentRoomId}`).update({
            status:           'bet_confirm',
            winCount:         rematchConfig.winCount,
            chan2Dau:         rematchConfig.chan2Dau,
            firstTurn:        rematchConfig.firstTurn,
            isVip:            rematchConfig.isVip,
            betAmount:        rematchConfig.betAmount,
            betPot:           0,
            guestReady:       true,
            playerXConfirmed: true,
            playerOConfirmed: true,
            rematchRequested: false,
            rematchXReady:    false,
            rematchOReady:    false,
            rematchConfig,
            // Reset undo usage when preparing rematch with bet
            undoUsed:         { X: false, O: false },
            // Clear pending undo requests
            undoRequest:      null,
            updatedAt:        Date.now()
        });
    } else {
        _thucSuBatDauGame(room, rematchConfig.winCount, rematchConfig.chan2Dau, rematchConfig.firstTurn);
    }
}

// Khách O bấm "Quay lại phòng chính" — chỉ ẩn overlay, ở lại phòng chờ chủ X bắt đầu
function quayLaiPhongChinhO() {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();
    // Reset local state để sẵn sàng ván mới
    daXoaBanCoTranNay = false;
    locallyAppliedLastMove = { row: -2, col: -2 };
    if (typeof window.xoaBanCoCu === 'function') window.xoaBanCoCu();
    // Cập nhật UI chờ
    const turnEl = document.getElementById('turn-indicator');
    if (turnEl) { turnEl.textContent = '⏳ Chờ chủ phòng bắt đầu ván mới...'; turnEl.className = ''; }
    thongBaoHeThong('⏳ Đang chờ chủ phòng bắt đầu ván mới...');
}
window.quayLaiPhongChinhO = quayLaiPhongChinhO;
function thoatPhongSauVan() {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    const winOv = document.getElementById('win-overlay');
    if (winOv) winOv.classList.remove('show');
    const rmModal = document.getElementById('rematch-confirm-modal');
    if (rmModal) rmModal.style.display = 'none';
    const udModal = document.getElementById('undo-request-modal');
    if (udModal) udModal.style.display = 'none';
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();
    xuLyThoatPhong();
}
window.thoatPhongSauVan = thoatPhongSauVan;
// ══════════════════════════════════════════════════════════════════
// 💬 CHAT
// ══════════════════════════════════════════════════════════════════
// 💬 CHAT — ĐÃ GỘP VÀO CHAT THẾ GIỚI: toàn bộ chat (sảnh, trong phòng, quick chat)
// dùng chung kênh world_chat — ai gửi thì mọi người online đều thấy ở cả lobby lẫn phòng đấu.
function guiTinNhanOnline() {
    const inp = document.getElementById('chat-input');
    if (!inp) return;
    guiChatTheGioiCore(inp.value, inp);
}
window.guiTinNhanOnline = guiTinNhanOnline;
function guiQuickChat(msg) {
    guiChatTheGioiCore(msg, null);
}
window.guiQuickChat = guiQuickChat;
function toggleQuickChatMenu() {
    const m = document.getElementById('quick-chat-menu');
    if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
window.toggleQuickChatMenu = toggleQuickChatMenu;
// Trong phòng đấu: không còn chat riêng theo phòng — chỉ cần đảm bảo
// listener Chat Thế Giới đang chạy (tham số roomId cũ không cần nữa)
function langNgheTinNhan() {
    khoiDongChatTheGioi();
}
// ══════════════════════════════════════════════════════════════════
// 🏆 BXH & LỊCH SỬ
// ══════════════════════════════════════════════════════════════════
function capNhatBXH(winnerName, winnerId) {
    // Ghi vào leaderboard theo tên (để hiển thị BXH)
    if (!winnerName) return;
    db.ref(`leaderboard/${winnerName}`).transaction(d => {
        if (!d) return { score: 1, userId: winnerId || '', lastUpdated: Date.now() };
        d.score = (d.score || 0) + 1;
        d.userId = winnerId || d.userId || '';
        d.lastUpdated = Date.now();
        return d;
    });
}
function ghiLichSu(roomName, xName, oName, winner, winCount = 5) {
    const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    db.ref('history').push().set({ roomName, playerX: xName, playerO: oName, winner, winCount, time, timestamp: Date.now() })
      .then(cleanupOldHistory);
}
function cleanupOldHistory() {
    db.ref('history').once('value', snap => {
        const d = snap.val(); if (!d) return;
        const arr = Object.entries(d).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.timestamp - b.timestamp);
        if (arr.length > 100) arr.slice(0, arr.length - 100).forEach(item => db.ref(`history/${item.id}`).remove());
    });
}
function langNgheBangXepHangOnline() {
    if (leaderboardListener) { db.ref('users').off('value', leaderboardListener); }
    // Lấy rank trực tiếp từ winSolo của users
    leaderboardListener = db.ref('users').on('value', snap => {
        const d   = snap.val();
        const box = document.getElementById('bxh-online-container');
        if (!box) return;
        if (!d) { box.innerHTML = '<p>Chưa có xếp hạng.</p>'; return; }
        const list = Object.values(d)
            .filter(u => u && u.username)
            .map(u => ({
                name:     u.displayName || u.username,
                winSolo:  u.winSolo  || 0,
                winBot:   u.winBot   || 0,
                loseSolo: u.loseSolo || 0,
                rank:     getRankName(u.winBot, u.winSolo)
            }))
            .filter(u => u.winSolo > 0 || u.winBot > 0)
            .sort((a, b) => b.winSolo - a.winSolo || b.winBot - a.winBot);
        if (!list.length) { box.innerHTML = '<p style="color:#888;">Chưa có dữ liệu.</p>'; return; }
        let html = `<table style="width:100%;text-align:left;border-collapse:collapse;font-size:13px;">
            <thead><tr style="border-bottom:2px solid #ccc;">
                <th style="padding:4px;">Hạng</th>
                <th style="padding:4px;">Kỳ thủ</th>
                <th style="padding:4px;">Cấp bậc</th>
                <th style="padding:4px;">⚔️Thắng</th>
                <th style="padding:4px;">🤖Bot</th>
            </tr></thead><tbody>`;
        list.slice(0, 20).forEach((u, i) => {
            const icon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            html += `<tr style="border-bottom:1px solid #eee;height:32px;">
                <td style="padding:4px;">${icon}</td>
                <td style="padding:4px;"><strong>${u.name}</strong></td>
                <td style="padding:4px;font-size:12px;">${u.rank}</td>
                <td style="padding:4px;color:green;font-weight:bold;">${u.winSolo}</td>
                <td style="padding:4px;color:#666;">${u.winBot}</td>
            </tr>`;
        });
        box.innerHTML = html + '</tbody></table>';
    });
}
function langNgheLichSuOnline() {
    if (historyListener) { db.ref('history').off('value', historyListener); }
    historyListener = db.ref('history').on('value', snap => {
        const d   = snap.val();
        const box = document.getElementById('lich-su-online-container');
        if (!box) return;
        if (!d) { box.innerHTML = '<p style="color:#888;">Chưa có lịch sử.</p>'; return; }
        const list = Object.values(d).sort((a, b) => b.timestamp - a.timestamp);
        // Không bọc thêm div overflow — container HTML đã có max-height + overflow-y
        let html = '';
        list.slice(0, 15).forEach(m => {
            const kq = m.winner === 'X'
                ? `🏆 <span style="color:blue;font-weight:bold;">${m.playerX}</span> thắng <span style="color:red;">${m.playerO}</span>`
                : m.winner === 'O'
                ? `🏆 <span style="color:red;font-weight:bold;">${m.playerO}</span> thắng <span style="color:blue;">${m.playerX}</span>`
                : '🤝 Hòa';
            html += `<div style="padding:6px 0;border-bottom:1px dashed #eee;font-size:13px;display:flex;justify-content:space-between;gap:8px;">
                <div><strong>[${m.roomName}]</strong> ${kq}</div>
                <div style="color:#999;font-size:11px;white-space:nowrap;">${m.time}</div>
            </div>`;
        });
        box.innerHTML = html;
    });
}
// ══════════════════════════════════════════════════════════════════
// 🔧 EXPOSE GLOBALS
// ══════════════════════════════════════════════════════════════════
window.isOnlineModeActive = function() { return isOnlineMode; };
Object.defineProperty(window, 'myOnlineRole', { get: function() { return myRole; } });
window.boQuaDisconnect    = function() {};  // stub
// Skin của từng bên trong phòng online (được set bởi loadPlayerInfo)
if (typeof window._onlineSkinX === 'undefined') window._onlineSkinX = 'skin_default';
if (typeof window._onlineSkinO === 'undefined') window._onlineSkinO = 'skin_default';
// ══════════════════════════════════════════════════════════════════
// 🌍 CHAT THẾ GIỚI
// ══════════════════════════════════════════════════════════════════
let worldChatListener = null;
// Escape HTML để tránh chèn thẻ vào kênh chat chung
function escChatHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Vẽ 1 tin chat thế giới ra CẢ 2 khung: lobby (#world-chat-messages) + phòng đấu (#chat-messages)
function hienTinChatTheGioi(d) {
    const sender  = escChatHtml(tenSafe(d.sender, 'Người chơi'));
    const message = escChatHtml(d.message);
    const timeStr = new Date(d.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    // Phân màu: người đang trong phòng đấu (đỏ cam) / người ở sảnh - khán giả (tím xanh)
    const senderColor = d.inRoom ? '#dc2626' : '#6366f1';
    const badge       = d.inRoom ? '⚔️ ' : '';
    const boxLobby = document.getElementById('world-chat-messages');
    if (boxLobby) {
        const el = document.createElement('div');
        el.style.cssText = 'margin-bottom:5px; font-size:13px; line-height:1.4; word-break:break-word;';
        el.innerHTML = `<span style="color:${senderColor};font-weight:bold;">${badge}${sender}</span> <span style="color:#aaa;font-size:11px;">${timeStr}</span><br>${message}`;
        boxLobby.appendChild(el);
        boxLobby.scrollTop = boxLobby.scrollHeight; // tự cuộn xuống tin mới nhất
    }
    const boxRoom = document.getElementById('chat-messages');
    if (boxRoom) {
        const el = document.createElement('div');
        el.className = 'chat-message-line';
        el.innerHTML = `<strong style="color:${senderColor};">${badge}[${sender}]:</strong> ${message}`;
        boxRoom.appendChild(el);
        boxRoom.scrollTop = boxRoom.scrollHeight; // tự cuộn xuống tin mới nhất
    }
}
function khoiDongChatTheGioi() {
    // BUG 4 FIX: Clean up old listener before registering new one
    if (worldChatListener) {
        db.ref('world_chat').off('child_added', worldChatListener);
        worldChatListener = null;
    }
    // Xóa nội dung cũ ở cả 2 khung trước khi replay 60 tin gần nhất (tránh trùng)
    ['world-chat-messages', 'chat-messages'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.innerHTML = '';
    });
    // Lưu timestamp để chỉ thông báo tin nhắn mới (không spam tin cũ khi load)
    const startTs = Date.now();
    // orderByKey: push key của Firebase đã theo thứ tự thời gian — không cần .indexOn,
    // tránh cảnh báo "Using an unspecified index" và không tải thừa dữ liệu về client
    worldChatListener = db.ref('world_chat')
        .orderByKey()
        .limitToLast(60)
        .on('child_added', snap => {
            const d = snap.val();
            if (!d) return;
            hienTinChatTheGioi(d);
            // Chỉ thông báo tin nhắn mới (không phải tin nhắn cũ khi load lại)
            if (d.timestamp && d.timestamp >= startTs) {
                const sender = d.sender || 'Người chơi';
                const msg = d.message || '';
                if (typeof addNotification === 'function') {
                    addNotification('chat', `💬 ${sender}: ${msg}`);
                }
            }
        });
}
// BUG 4 FIX: Add cleanup function for world chat listener
function tatChatTheGioi() {
    if (worldChatListener) {
        db.ref('world_chat').off('child_added', worldChatListener);
        worldChatListener = null;
    }
}
// Lõi gửi chat thế giới dùng chung: ô chat lobby, ô chat trong phòng, quick chat
function guiChatTheGioiCore(rawText, inpToClear) {
    if (!currentUsername) { alert('Vui lòng đăng nhập để chat!'); return; }
    const text = (rawText || '').trim();
    if (!text) return;
    const name = tenCuaToi();
    // Giới hạn spam: 2 giây cooldown giữa các tin
    const now = Date.now();
    const lastSent = parseInt(sessionStorage.getItem('wc_last') || '0');
    if (now - lastSent < 2000) { return; }
    sessionStorage.setItem('wc_last', now);
    db.ref('world_chat').push({
        sender:    name,
        message:   text,
        // Đánh dấu người gửi đang đấu trong phòng (để phân màu với người xem/sảnh)
        inRoom:    (isOnlineMode && currentRoomId && myRole !== 'viewer') ? currentRoomId : '',
        timestamp: now
    }).then(() => {
        if (inpToClear) inpToClear.value = '';
        // Dọn tin cũ — giữ tối đa 200 tin. orderByKey không cần index, query 1 lần duy nhất
        db.ref('world_chat').orderByKey().once('value').then(all => {
            const total = all.numChildren();
            if (total > 200) {
                // Xóa 50 tin cũ nhất bằng 1 lệnh update multi-path (thay vì 50 remove rời rạc)
                const updates = {};
                let count = 0;
                all.forEach(child => {
                    if (count < 50) { updates[child.key] = null; count++; }
                });
                db.ref('world_chat').update(updates);
            }
        });
    });
}
function guiChatTheGioi() {
    const inp = document.getElementById('world-chat-input');
    if (!inp) return;
    guiChatTheGioiCore(inp.value, inp);
}
window.guiChatTheGioi = guiChatTheGioi;
// ══════════════════════════════════════════════════════════════════
// ⚙️ CÀI ĐẶT TÀI KHOẢN
// ══════════════════════════════════════════════════════════════════
const SHOP_AVATAR_LIST = [
    { id: 'av_01', emoji: '😀', name: 'Mặc Định', free: true },
    { id: 'av_02', emoji: '😎', name: 'Ngầu Nè', free: false },
    { id: 'av_03', emoji: '🍤', name: 'TÔM ', free: false },
    { id: 'av_04', emoji: '👾', name: 'Quái Vật', free: false },
    { id: 'av_05', emoji: '🤖', name: 'Robot', free: false },
    { id: 'av_06', emoji: '🦁', name: 'Sư Tử', free: false },
    { id: 'av_07', emoji: '🐯', name: 'Hổ Dữ', free: false },
    { id: 'av_08', emoji: '🐼', name: 'Gấu Trúc', free: false },
    { id: 'av_09', emoji: '🦊', name: 'Cáo Tinh', free: false },
    { id: 'av_10', emoji: '🐸', name: 'Ếch Xanh', free: false },
    { id: 'av_11', emoji: '🐲', name: 'Rồng Vàng', free: false },
    { id: 'av_12', emoji: '🦅', name: 'Đại Bàng', free: false },
    { id: 'av_13', emoji: '🔥', name: 'Ngọn Lửa', free: false },
    { id: 'av_14', emoji: '⚡', name: 'Sét Vàng', free: false },
    { id: 'av_15', emoji: '💎', name: 'Kim Cương', free: false },
    { id: 'av_16', emoji: '🌟', name: 'Ngôi Sao', free: false },
    { id: 'av_17', emoji: '🎯', name: 'Bắn Tỉa', free: false },
    { id: 'av_18', emoji: '🏆', name: 'Vô Địch', free: false },
    { id: 'av_19', emoji: '👑', name: 'Vương Miện', free: false },
    { id: 'av_20', emoji: '🎮', name: 'Game Thủ', free: false },
    { id: 'av_21', emoji: '🔆', name: 'Ánh Sáng', free: false },
    { id: 'av_22', emoji: '💢', name: 'Giận Dữ', free: false },
    { id: 'av_23', emoji: '💫', name: 'Hào Quang', free: false },
    { id: 'av_24', emoji: '💨', name: 'Gió Lốc', free: false },
    { id: 'av_25', emoji: '💤', name: 'Ngủ Gật', free: false },
    { id: 'av_26', emoji: '🔱', name: 'Tam Giác', free: false },
    { id: 'av_27', emoji: '💦', name: 'Nước', free: false },
    { id: 'av_28', emoji: '💥', name: 'Nổ', free: false },
    { id: 'av_29', emoji: '✔', name: 'Check', free: false },
    { id: 'av_30', emoji: '💗', name: 'Trái Tim', free: false }
];
function _getRank(wins, losses) {
    const total = wins + losses;
    if (total === 0) return '🐣 Gà Con';
    const winRate = wins / total;
    if (total < 5) return '🐣 Gà Con';
    if (winRate < 0.3) return '🐤 Gà Mới';
    if (winRate < 0.5) return '🐔 Gà Chơi';
    if (winRate < 0.7) return '🦅 Đại Bàng';
    if (winRate < 0.85) return '🦁 Sư Tử';
    if (total < 20) return '🐉 Rồng';
    return '👑 Hoàng Đế';
}
function moCapNhatTaiKhoan() {
    const modal = document.getElementById('account-settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    // Cập nhật thống kê
    if (typeof currentUserData !== 'undefined' && currentUserData) {
        const data = currentUserData;
        
        // Xu
        const xuEl = document.getElementById('settings-xu-display');
        if (xuEl) xuEl.textContent = (data.coins || 0).toLocaleString('vi-VN');
        
        // Cấp độ
        const wins = data.wins || 0;
        const losses = data.losses || 0;
        const level = Math.floor((wins + losses) / 10) + 1;
        const levelEl = document.getElementById('settings-level-display');
        if (levelEl) levelEl.textContent = 'Lv.' + level;
        
        // Thắng/Thua
        const winsEl = document.getElementById('settings-wins-display');
        if (winsEl) winsEl.textContent = wins;
        const lossesEl = document.getElementById('settings-losses-display');
        if (lossesEl) lossesEl.textContent = losses;
        
        // Skin Quân
        const skinsEl = document.getElementById('settings-skins-display');
        if (skinsEl) skinsEl.textContent = (data.ownedSkins || []).length;
        
        // Bàn Cờ
        const boardsEl = document.getElementById('settings-boards-display');
        if (boardsEl) boardsEl.textContent = (data.ownedBoardSkins || []).length;
        
        // Cập nhật thống kê cũ (để tương thích)
        const stWinBot = document.getElementById('st-win-bot');
        if (stWinBot) stWinBot.textContent = data.wins || 0;
        const stRank = document.getElementById('st-rank');
        if (stRank) {
            const rank = _getRank(wins, losses);
            stRank.textContent = rank;
        }
        
        // Điền thông tin hiện tại
        const dn = document.getElementById('settings-display-name');
        if (dn) dn.value = data.displayName || data.username || '';
        const av = document.getElementById('settings-avatar-display');
        if (av) av.textContent = data.avatar || (data.displayName || '?')[0].toUpperCase();
    }
    
    // Build avatar picker — redirect sang Shop Avatar
    const pickerGrid = document.querySelector('#avatar-picker > div');
    if (pickerGrid) {
        pickerGrid.innerHTML = `<div style="padding:6px 0;font-size:13px;color:#6b7280;text-align:center;width:100%;">
            Chọn avatar trong <button onclick="dongCapNhatTaiKhoan();moShopAvatar();" style="padding:4px 10px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">🎭 Shop Avatar</button>
        </div>`;
    }
}
window.moCapNhatTaiKhoan = moCapNhatTaiKhoan;
function dongCapNhatTaiKhoan() {
    const modal = document.getElementById('account-settings-modal');
    if (modal) modal.style.display = 'none';
    // Xóa input mật khẩu khi đóng
    ['settings-old-pass','settings-new-pass','settings-confirm-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const avatarPicker = document.getElementById('avatar-picker');
    if (avatarPicker) avatarPicker.style.display = 'none';
}
window.dongCapNhatTaiKhoan = dongCapNhatTaiKhoan;
function moChonAvatar() {
    const picker = document.getElementById('avatar-picker');
    if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}
window.moChonAvatar = moChonAvatar;
function moGioiThieu() {
    const modal = document.getElementById('gioi-thieu-modal');
    if (modal) modal.style.display = 'flex';
}
window.moGioiThieu = moGioiThieu;
function dongGioiThieu() {
    const modal = document.getElementById('gioi-thieu-modal');
    if (modal) modal.style.display = 'none';
}
window.dongGioiThieu = dongGioiThieu;
function chonAvatar(emoji) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    db.ref(`users/${userId}`).update({ avatar: emoji }).then(() => {
        const av1 = document.getElementById('settings-avatar-display');
        if (av1) av1.textContent = emoji;
        const av2 = document.getElementById('user-avatar-display');
        if (av2) av2.textContent = emoji;
        const avatarPicker = document.getElementById('avatar-picker');
        if (avatarPicker) avatarPicker.style.display = 'none';
    });
}
window.chonAvatar = chonAvatar;
function luuTenHienThi() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    const inp = document.getElementById('settings-display-name');
    const newName = inp ? inp.value.trim() : '';
    if (!newName) { alert('Tên không được để trống!'); return; }
    if (newName.length < 2) { alert('Tên ít nhất 2 ký tự!'); return; }
    if (newName.length > 20) { alert('Tên tối đa 20 ký tự!'); return; }
    // Kiểm tra tên mới có bị trùng với user khác không
    db.ref('users').orderByChild('username').equalTo(newName).once('value').then(snap => {
        if (snap.exists()) {
            const existingId = Object.keys(snap.val())[0];
            if (existingId !== userId) {
                alert('❌ Tên này đã có người dùng, chọn tên khác!');
                return;
            }
        }
        // Cập nhật cả username lẫn displayName lên server
        db.ref(`users/${userId}`).update({ username: newName, displayName: newName }).then(() => {
            alert('✅ Đã cập nhật tên! Đăng nhập bằng tên mới từ lần sau.');
            // Cập nhật local
            if (currentUserData) {
                currentUserData.displayName = newName;
                currentUserData.username = newName;
            }
            currentUsername = newName;
            localStorage.setItem('current_username', newName);
            // Cập nhật top-bar tên
            const nameEl = document.getElementById('user-display-name');
            if (nameEl) nameEl.innerText = newName;
            // Cập nhật avatar chữ cái nếu chưa có emoji avatar
            const avEl = document.getElementById('user-avatar-display');
            if (avEl && !currentUserData?.avatar) {
                avEl.textContent = newName[0].toUpperCase();
            }
            // Cập nhật online_users nếu đang online
            setMyOnlineStatus(isOnlineMode ? 'playing' : 'free');
        });
    });
}
window.luuTenHienThi = luuTenHienThi;
function luuMatKhau() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId || !currentUserData) return;
    const oldPass  = document.getElementById('settings-old-pass').value;
    const newPass  = document.getElementById('settings-new-pass').value;
    const confPass = document.getElementById('settings-confirm-pass').value;
    if (!oldPass || !newPass || !confPass) { alert('Vui lòng nhập đủ thông tin!'); return; }
    if (oldPass !== currentUserData.password) { alert('❌ Mật khẩu hiện tại không đúng!'); return; }
    if (newPass.length < 4) { alert('Mật khẩu mới phải ít nhất 4 ký tự!'); return; }
    if (newPass !== confPass) { alert('❌ Mật khẩu mới không khớp!'); return; }
    db.ref(`users/${userId}`).update({ password: newPass }).then(() => {
        alert('✅ Đã đổi mật khẩu thành công!');
        ['settings-old-pass','settings-new-pass','settings-confirm-pass'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    });
}
window.luuMatKhau = luuMatKhau;
