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
// Tab phòng đang chọn: 'normal' hoặc 'vip'
let currentRoomTab = 'normal';
// Chuyển tab phòng
function switchRoomTab(tab) {
    console.log('[DEBUG] switchRoomTab called with:', tab);
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

    console.log('[DEBUG] Tab switched to:', currentRoomTab, 'Calling renderRoomListImmediate');
    renderRoomListImmediate();
}
window.switchRoomTab = switchRoomTab;
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
    const luatTxt = `${wc} quân${c2d ? ' · Chặn 2 đầu' : ''}`;
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

    console.log('[DEBUG] renderRoomListImmediate - Current tab:', currentRoomTab);
    
    // Fetch current rooms data from Firebase
    db.ref('rooms').once('value').then(snap => {
        const rooms = snap.val();
        console.log('[DEBUG] renderRoomListImmediate - Rooms data:', rooms);
        container.innerHTML = '';
        // Render rooms based on current tab
        if (currentRoomTab === 'normal') {
            console.log('[DEBUG] Rendering normal rooms 1-', TOTAL_NORMAL_ROOMS);
            for (let i = 1; i <= TOTAL_NORMAL_ROOMS; i++) {
                const roomId = `phong_${i}`;
                const room   = (rooms && rooms[roomId]) || taoDataPhongRong(i, false);
                const el = renderRoomCard(room, roomId, 'normal');
                container.appendChild(el);
            }
        } else {
            // VIP tab
            console.log('[DEBUG] Rendering VIP rooms 1-', TOTAL_VIP_ROOMS, 'as phong_21-40');
            for (let i = 1; i <= TOTAL_VIP_ROOMS; i++) {
                const roomNum = TOTAL_NORMAL_ROOMS + i;
                const roomId = `phong_${roomNum}`;
                console.log('[DEBUG] Checking VIP room:', roomId, 'Data:', rooms ? rooms[roomId] : 'null');
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
    khoiTao20Phong();
    setupAuthListeners();
    setupEventListeners();
    // Firebase có thể tải xong sau sự kiện load của trang. Khởi tạo ticker lần nữa
    // để các listener thông báo luôn được gắn khi db đã sẵn sàng.
    if (typeof window.initNotificationTicker === 'function') window.initNotificationTicker();
}
// ══════════════════════════════════════════════════════════════════
// 🏠 KHỞI TẠO 20 PHÒNG CỐ ĐỊNH
// Chỉ tạo nếu chưa có — không bao giờ xóa phòng
// ══════════════════════════════════════════════════════════════════
function khoiTao20Phong() {
    console.log('[DEBUG] Creating rooms - Normal:', TOTAL_NORMAL_ROOMS, 'VIP:', TOTAL_VIP_ROOMS);
    // Chỉ tạo phòng chưa tồn tại — KHÔNG bao giờ ghi đè phòng đang có dữ liệu
    // Normal rooms 1-20
    for (let i = 1; i <= TOTAL_NORMAL_ROOMS; i++) {
        const roomRef = db.ref(`rooms/phong_${i}`);
        roomRef.once('value').then(snap => {
            if (!snap.exists() || snap.val() === null) {
                console.log('[DEBUG] Creating normal room:', i);
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
                console.log('[DEBUG] Creating VIP room:', i, 'as phong_' + roomNum);
                roomRef.set(taoDataPhongRong(roomNum, true));
            } else {
                // Sync existing VIP rooms to new betting limits and ensure isVip flag is set
                const room = snap.val();
                const needsUpdate = room.betAmount < XU_CONFIG.VIP_BET_MIN || room.isVip !== true;
                if (needsUpdate) {
                    console.log('[DEBUG] Syncing VIP room:', roomNum, 'isVip:', room.isVip, 'betAmount:', room.betAmount);
                    roomRef.update({
                        isVip: true,
                        betAmount: XU_CONFIG.VIP_BET_MIN,
                        betPot: XU_CONFIG.VIP_BET_MIN * 2
                    });
                } else {
                    console.log('[DEBUG] VIP room already synced:', roomNum);
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
    console.log('[DEBUG] Force syncing all VIP rooms...');
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
            roomRef.update(update).then(() => {
                console.log('[DEBUG] Force synced VIP room:', roomNum, '| status:', room.status);
            }).catch(err => {
                console.error('[DEBUG] Error syncing VIP room:', roomNum, err);
            });
        });
    }
}
function taoDataPhongRong(so, isVip = false) {
    const defaultBet = isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
    console.log('[DEBUG] Creating room data:', { so, isVip, defaultBet });
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
        currentUserData = data;
        localStorage.setItem('current_user_id', userId);
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
    console.log('[OnlineStatus] Set status to:', state, 'for user:', userId);
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
    
    // Kiểm tra xem người nhận có bận không
    db.ref(`users/${targetUid}/currentRoomId`).once('value').then(snap => {
        const targetRoomId = snap.val();
        
        // Nếu người chơi đang trong phòng nào đó → báo bận
        if (targetRoomId) {
            alert(`[${targetName}] đang bận trong phòng khác! Vui lòng thử lại sau.`);
            return;
        }
        
        // Kiểm tra xem người nhận có online không
        db.ref(`online_users/${targetUid}`).once('value').then(snap => {
            const isOnline = snap.exists();
            
            // Gửi lời mời realtime (nếu người đang online sẽ nhận ngay)
            db.ref(`invitations/${targetUid}`).set({
                fromRoomId:     currentRoomId,
                fromPlayerId:   myId,
                fromPlayerName: myName,
                timestamp:      Date.now()
            }).then(() => {
                alert(`Đã gửi lời mời tới [${targetName}]!${isOnline ? '' : ' (Người này hiện offline, sẽ nhận khi online)'}`);
                
                // Luôn lưu lời mời vào danh sách chờ (để họ xem lại khi online)
                db.ref(`pending_invites/${targetUid}`).push({
                    fromRoomId:     currentRoomId,
                    fromPlayerId:   myId,
                    fromPlayerName: myName,
                    timestamp:      Date.now(),
                    status:         'pending'
                });
            }).catch(err => {
                alert('Lỗi gửi lời mời: ' + err.message);
            });
        });
    });
}
window.guiLoiMoiThachDau = guiLoiMoiThachDau;
function langNgheLoiMoiDen() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    if (invitationListener) db.ref(`invitations/${userId}`).off('value', invitationListener);
    invitationListener = db.ref(`invitations/${userId}`).on('value', snap => {
        const invite = snap.val();
        if (!invite) return;
        if (Date.now() - invite.timestamp > 30000) { db.ref(`invitations/${userId}`).remove(); return; }
        // Đang trong phòng rồi thì bỏ qua lời mời, xóa đi
        if (currentRoomId && isOnlineMode) {
            db.ref(`invitations/${userId}`).remove();
            return;
        }
        const dongY = confirm(`🎮 [${invite.fromPlayerName}] mời bạn vào phòng solo! Chấp nhận?`);
        db.ref(`invitations/${userId}`).remove();
        if (!dongY) return;
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
        // YC.TXT FIX: Use centralized GameModeManager to check current mode
        if (typeof GameModeManager !== 'undefined' && GameModeManager.isActive()) {
            const currentMode = GameModeManager.getCurrentMode();
            console.log('[Firebase Online] Skipping Online reconnect - another mode is active:', currentMode);
            return;
        }
        
        const savedRoom = localStorage.getItem('current_room_id');
        const savedUser = localStorage.getItem('current_user_id');
        if (!savedRoom || !savedUser) return;
        db.ref(`rooms/${savedRoom}`).once('value').then(snap => {
            const room = snap.val();
            if (!room || room.status === 'empty' || room.status === 'ended') {
                localStorage.removeItem('current_room_id'); return;
            }
            const isX = savedUser === room.playerX_id;
            const isO = savedUser === room.playerO_id;
            if (!isX && !isO) { localStorage.removeItem('current_room_id'); return; }
            currentRoomId     = savedRoom;
            myRole            = isX ? 'X' : 'O';
            daXoaBanCoTranNay = true;
            currentTurn       = room.turn || 'X';
            currentRule       = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
            currentWinCount   = room.winCount || 5;
            if (typeof winCount !== 'undefined') winCount = currentWinCount;
            const sf = myRole === 'X' ? 'playerX_status' : 'playerO_status';
            db.ref(`rooms/${savedRoom}/${sf}`).set('online');
            setupOnDisconnect(savedRoom, myRole);
            batDauGiaoDienOnline();
            // YC.TXT FIX: Set mode to ONLINE when reconnecting
            if (typeof GameModeManager !== 'undefined') {
                GameModeManager.setMode(GameModes.ONLINE, { roomId: savedRoom, role: myRole });
            }
            // Cập nhật UI ngay lập tức với thông tin phòng hiện tại
            capNhatUIPhongOnline(room);
            if (room.status === 'playing') {
                phucHoiBanCo(savedRoom, () => {
                    langNgheThayDoiPhong(savedRoom);
                    langNgheTinNhan(savedRoom);
                    setMyOnlineStatus('playing');
                    // BUG 5 FIX: Switch to battle view when reconnecting to a playing game
                    if (typeof switchView === 'function') {
                        switchView('battle');
                    }
                    // Hide navigation during battle
                    if (typeof hideTopNavigation === 'function') {
                        hideTopNavigation();
        console.log('[Room] Header hidden for battle');
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
                langNgheThayDoiPhong(savedRoom);
                langNgheTinNhan(savedRoom);
                setMyOnlineStatus('free');
                // BUG 5 FIX: Switch to room view when reconnecting to a waiting game
                if (typeof switchView === 'function') {
                    switchView('room');
                }
            }
        }).catch(() => localStorage.removeItem('current_room_id'));
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
        console.log('[DEBUG] Current tab:', currentRoomTab, 'Rooms data:', rooms);
        container.innerHTML = '';
        // Render rooms based on current tab
        if (currentRoomTab === 'normal') {
            console.log('[DEBUG] Rendering normal rooms 1-', TOTAL_NORMAL_ROOMS);
            for (let i = 1; i <= TOTAL_NORMAL_ROOMS; i++) {
                const roomId = `phong_${i}`;
                const room   = (rooms && rooms[roomId]) || taoDataPhongRong(i, false);
                const el = renderRoomCard(room, roomId, 'normal');
                container.appendChild(el);
            }
        } else {
            // VIP tab
            console.log('[DEBUG] Rendering VIP rooms 1-', TOTAL_VIP_ROOMS, 'as phong_21-40');
            for (let i = 1; i <= TOTAL_VIP_ROOMS; i++) {
                const roomNum = TOTAL_NORMAL_ROOMS + i;
                const roomId = `phong_${roomNum}`;
                console.log('[DEBUG] Checking VIP room:', roomId, 'Data:', rooms ? rooms[roomId] : 'null');
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
    console.log('[Room] Join Start - roomId:', roomId);
    console.log('[DEBUG-ENTER] ngoimVaoPhong called with roomId:', roomId);
    if (!currentUsername) { alert('Vui lòng đăng nhập trước!'); return; }
    const myId   = localStorage.getItem('current_user_id');
    const myName = tenCuaToi();
    
    // YC.TXT FIX: Cleanup previous mode before joining Online
    const currentMode = typeof GameModeManager !== 'undefined' ? GameModeManager.getCurrentMode() : null;
    
    // Cleanup BOT mode
    if (currentMode === 'bot_room' || (typeof GameModes !== 'undefined' && currentMode === GameModes.BOT_ROOM)) {
        if (typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.exitBotRoom === 'function') {
            BotRoomManager.exitBotRoom();
        }
    }
    
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
    console.log('[DEBUG-ENTER] User info:', { myId, myName, currentUsername });
    roomRef.transaction(room => {
        console.log('[DEBUG-ENTER] Transaction - current room data:', room);
        // Firebase gọi lần đầu với null — trả null để retry với dữ liệu thực
        if (!room) {
            console.log('[DEBUG-ENTER] Room is null, returning null to retry');
            return null;
        }
        if (room.status === 'playing') {
            console.log('[DEBUG-ENTER] Room is playing, aborting');
            return; // abort — đang chơi
        }
        // Kiểm tra phòng "ma": status=waiting nhưng playerX offline lâu và không có O
        const now = Date.now();
        const isStale = (now - (room.updatedAt || 0)) > ROOM_STALE_MS;
        const xOffline = room.playerX_status !== 'online';
        if (room.status === 'waiting' && room.playerX_id && !room.playerO_id && xOffline && isStale) {
            // Phòng bỏ hoang — coi như empty, cho người mới vào làm X
            console.log('[DEBUG-ENTER] Room is stale, cleaning up ghost');
            room.playerX_id = ''; room.playerX_name = ''; room.playerX_status = 'offline';
            room.status = 'empty';
        }
        if (!room.playerX_id || room.status === 'empty' || room.status === 'ended') {
            // Ngồi ghế X — reset phòng về waiting sạch
            console.log('[DEBUG-ENTER] Taking X seat');
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
            console.log('[DEBUG-ENTER] Taking O seat');
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
        console.log('[DEBUG-ENTER] Room full or already seated, aborting');
        return;
    }).then(result => {
        console.log('[DEBUG-ENTER] Transaction result:', result);
        if (!result.committed) { 
            console.log('[DEBUG-ENTER] Transaction not committed');
            alert('Phòng đã đầy hoặc không thể vào!'); 
            return; 
        }
        const room = result.snapshot.val();
        console.log('[DEBUG-ENTER] Room after transaction:', room);
        currentRoomId     = roomId;
        console.log('[Room] Join Success - roomId:', roomId, 'role:', myRole);
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
    console.log('[Room] Rejoin Start - roomId:', roomId);
    const myId = localStorage.getItem('current_user_id');
    const myName = tenCuaToi();
    
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
                console.log('[Room] Rejoin Success - roomId:', roomId, 'role:', (isX ? 'X' : 'O'));
                // YC.TXT FIX: Create new session ID for this rejoin
                if (typeof currentSessionId !== 'undefined') currentSessionId = Date.now().toString();
                myRole            = isX ? 'X' : 'O';
                daXoaBanCoTranNay = true;
                currentTurn       = room.turn || 'X';
                currentRule       = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
                currentWinCount   = room.winCount || 5;
                if (typeof winCount !== 'undefined') winCount = currentWinCount;
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
                batDauGiaoDienOnline();
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
                currentWinCount   = r.winCount || 5;
                if (typeof winCount !== 'undefined') winCount = currentWinCount;
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerX_status`).set('online');
                setupOnDisconnect(roomId, 'X');
                const lobbyScreen = document.getElementById('lobby-screen');
                if (lobbyScreen) lobbyScreen.style.display = 'none';
                batDauGiaoDienOnline();
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
                batDauGiaoDienOnline();
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
        batDauGiaoDienOnline();
        langNgheThayDoiPhong(roomId);
        langNgheTinNhan(roomId);
        setMyOnlineStatus('free');
    }).catch(err => {
        console.error('[DEBUG-JOIN-O] Transaction error:', err);
        alert('Lỗi kết nối: ' + err.message);
    });
}
function xemPhong(roomId) {
    currentRoomId = roomId;
    myRole        = 'viewer';
    daXoaBanCoTranNay = true;
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.style.display = 'none';
    batDauGiaoDienOnline();
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
            console.log(`[Cleanup] Phòng ${roomId} bỏ hoang (X offline > 5 phút) → reset empty`);
            return db.ref(`rooms/${roomId}`).update({
                status: 'empty', playerX_id: '', playerX_name: '', playerX_status: 'offline',
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                winner: '', endReason: '', moves: { init: true },
                lastMove: { row: -1, col: -1, by: '' }, updatedAt: now
            });
        }
        if (room.playerX_id && !xOnline && isStale && room.playerO_id && oOnline) {
            // X bỏ hoang nhưng O vẫn online → cho O lên làm X, chờ đối thủ
            console.log(`[Cleanup] Phòng ${roomId}: X offline, O online → O thành chủ phòng`);
            return db.ref(`rooms/${roomId}`).update({
                playerX_id: room.playerO_id, playerX_name: room.playerO_name,
                playerX_status: room.playerO_status,
                playerO_id: '', playerO_name: '', playerO_status: 'offline',
                status: 'waiting', updatedAt: now
            });
        }
        if (isStale && !xOnline && !oOnline) {
            // Cả hai offline lâu → dọn về empty
            console.log(`[Cleanup] Phòng ${roomId}: cả hai offline lâu → reset empty`);
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
            console.log(`[Cleanup] Phòng ${roomId}: đang chơi nhưng cả hai mất kết nối lâu → reset`);
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
            console.log(`[Cleanup] Phòng ${roomId}: ended lâu → reset ${newStatus}`);
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
    console.log('[Room] Battle UI Init Start');
    // YC.TXT FIX: Force full Battle Lifecycle on each join
    // Destroy any existing SharedBoardUI instance to ensure clean state
    if (typeof SharedBoardUI !== 'undefined' && SharedBoardUI.Lifecycle.state === 'running') {
        console.log('[Room] Destroying existing SharedBoardUI before re-init');
        SharedBoardUI.destroy();
    }
    console.log('[DEBUG-BOARD] batDauGiaoDienOnline called', {
        infCanvasInitialized: typeof infCanvasInitialized !== 'undefined' ? infCanvasInitialized : 'undefined',
        infCanvasId: typeof infCanvas !== 'undefined' && infCanvas ? infCanvas.id : 'null',
        isGameActive: typeof isGameActive !== 'undefined' ? isGameActive : 'undefined',
        onlineBoardExists: !!document.getElementById('inf-canvas-online')
    });
    
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
    //         console.log('[DEBUG-BOARD] Reset infCanvasInitialized to force re-init for online canvas');
    //     }
    // }
    // Online luôn dùng infinite canvas
    if (typeof isInfinite !== 'undefined') {
        isInfinite = true;
        console.log('[DEBUG-BOARD] Set isInfinite = true for online mode');
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
        console.log('[Room] Header hidden for battle');
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

    // Clear Online state
    currentRoomId = null;
    myRole = null;

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
    console.log('[Room] Leave Start - roomId:', currentRoomId, 'role:', myRole);
    if (!currentRoomId) { 
        console.log('[Room] Leave - No currentRoomId, skipping');
        if (onDone) onDone(); 
        return; 
    }
    const rid  = currentRoomId;
    const role = myRole;
    const myId = localStorage.getItem('current_user_id');
    const done = () => {
        console.log('[Room] Firebase Leave Success - Removing user currentRoomId');
        // Xóa currentRoomId khỏi Firebase khi thoát
        db.ref(`users/${myId}/currentRoomId`).remove().then(() => {
            console.log('[Room] User currentRoomId removed from Firebase');
            _resetSauThoat(rid);
            // YC.TXT FIX: Force render room list after leave to ensure UI updates
            setTimeout(() => {
                hienDanhSachPhong();
            }, 100);
            if (onDone) onDone();
        }).catch(err => {
            console.error('[Room] Error removing user currentRoomId:', err);
            _resetSauThoat(rid);
            if (onDone) onDone();
        });
    };
    db.ref(`rooms/${rid}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) { done(); return; }
        if (room.status === 'playing') {
            if (role === 'viewer') { done(); return; }
            if (!confirm('Bạn đang đánh. Thoát sẽ bị tính THUA. Tiếp tục?')) return;
            const winner = role === 'X' ? 'O' : 'X';
            db.ref(`rooms/${rid}`).update({
                status: 'ended', winner, endReason: `${role} bỏ cuộc`,
                endedAt: Date.now(), updatedAt: Date.now()
            }).then(done);
        } else if (room.status === 'waiting' || room.status === 'empty') {
            if (role === 'X' && myId === room.playerX_id) {
                if (room.playerO_id) {
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: room.playerO_id, playerX_name: room.playerO_name,
                        playerX_status: room.playerO_status || 'offline',
                        playerX_avatar: room.playerO_avatar || '', playerX_skin: room.playerO_skin || 'skin_default',
                        playerO_id: '', playerO_name: '', playerO_status: 'offline',
                        playerO_avatar: '', playerO_skin: 'skin_default',
                        status: 'waiting', updatedAt: Date.now()
                    }).then(done);
                } else {
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
                // Khách O thoát → reset guestReady và playerOConfirmed
                db.ref(`rooms/${rid}`).update({
                    playerO_id: '', playerO_name: '', playerO_status: 'offline',
                    playerO_avatar: '', playerO_skin: 'skin_default',
                    guestReady: false,
                    playerOConfirmed: null,
                    status: 'waiting', updatedAt: Date.now()
                }).then(done);
            } else {
                done();
            }
        } else {
            done();
        }
    }).catch(() => { done(); });
}
function _resetSauThoat(rid) {
    console.log('[Room] Cleanup Start - roomId:', rid);
    // Dọn listener TRƯỚC khi null currentRoomId
    if (roomListener && rid) {
        db.ref(`rooms/${rid}`).off('value', roomListener);
        roomListener = null;
        console.log('[Room] Room listener removed');
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
            db.ref(`invitations/${userId}`).off('value', invitationListener);
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
    
    console.log('[Room] Session Destroyed - All state variables reset');
    
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
    console.log('[Room] Cleanup Complete - UI returned to Lobby');
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
        const chkChan  = document.getElementById('room-chan-2-dau');
        const selFirst = document.getElementById('room-first-turn');
        const winCount  = selWin   ? parseInt(selWin.value)  : (room.winCount  || 5);
        const chan2Dau  = chkChan  ? chkChan.checked          : (room.chan2Dau  ?? true);
        const firstTurn = selFirst ? selFirst.value           : (room.firstTurn || 'X');
        daXoaBanCoTranNay      = false;
        locallyAppliedLastMove = { row: -2, col: -2 };
        _lastProcessedWinner   = '';
        // Dùng ngưỡng cược đúng theo loại phòng (VIP vs thường)
        const _betMin = room.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        const hasBet = room.betAmount && room.betAmount >= _betMin;
        if (hasBet) {
            // Có cược → kiểm tra O đã sẵn sàng chưa
            const oReady = room.guestReady || room.playerOConfirmed;
            if (!oReady) {
                alert('⏳ Cần đợi khách bấm SẴN SÀNG xác nhận cược trước khi bắt đầu!');
                return;
            }
            // O đã sẵn sàng → đặt cả 2 confirmed rồi bắt đầu ngay
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
            // Không cược → bắt đầu ngay
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
function undoOnlineMove() {
    if (!currentRoomId || !myRole) {
        alert('Bạn không trong phòng!');
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
        
        // Cần ít nhất 1 nước để undo
        if (!room.moves || room.moves.length < 1) {
            alert('Chưa có nước nào để rút!');
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
                const confirmUndo = confirm(`Yêu cầu rút lại 1 nước sẽ tốn ${betAmount.toLocaleString('vi-VN')} Xu nếu đối thủ đồng ý.

Số tiền này sẽ được chuyển cho đối thủ.

Bạn có chắc chắn muốn yêu cầu rút?`);
                if (!confirmUndo) return;
                
                // Gửi request undo lên Firebase
                const moveIndex = Array.isArray(room.moves) ? room.moves.length - 1 : 0;
                db.ref(`rooms/${currentRoomId}`).update({
                    undoRequest: {
                        requester: myRole,
                        requesterId: myId,
                        moveIndex: moveIndex,
                        betAmount: betAmount,
                        timestamp: Date.now()
                    },
                    updatedAt: Date.now()
                }).then(() => {
                    thongBaoHeThong(`↩️ Đã gửi yêu cầu rút nước - chờ đối thủ xác nhận...`);
                });
            });
        } else {
            // Không có cược - request undo miễn phí
            const confirmUndo = confirm('Yêu cầu rút lại 1 nước?');
            if (!confirmUndo) return;
            
            const moveIndex = Array.isArray(room.moves) ? room.moves.length - 1 : 0;
            db.ref(`rooms/${currentRoomId}`).update({
                undoRequest: {
                    requester: myRole,
                    requesterId: myId,
                    moveIndex: moveIndex,
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
    console.log('[DEBUG-UNDO] handleUndoResponse called:', { approved, currentRoomId, myRole });
    
    if (!currentRoomId || !myRole) {
        console.log('[DEBUG-UNDO] Missing currentRoomId or myRole');
        return;
    }
    
    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val();
        console.log('[DEBUG-UNDO] Room data fetched:', { hasRoom: !!room, hasUndoRequest: !!room?.undoRequest });
        
        if (!room || !room.undoRequest) {
            console.log('[DEBUG-UNDO] No room or no undoRequest');
            return;
        }
        
        const request = room.undoRequest;
        console.log('[DEBUG-UNDO] Undo request:', request);
        
        // Chỉ người được request mới có thể approve/reject
        if (request.requester === myRole) {
            console.log('[DEBUG-UNDO] Cannot approve own request');
            alert('Bạn không thể tự duyệt yêu cầu của mình!');
            return;
        }
        
        if (approved) {
            console.log('[DEBUG-UNDO] Approving undo request');
            // Approve: trừ xu từ requester, cộng cho approver, rút nước
            const requesterId = request.requesterId;
            const approverId = localStorage.getItem('current_user_id');
            const betAmount = request.betAmount || 0;
            console.log('[DEBUG-UNDO] Bet amount:', betAmount);
            
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
                            // Hoàn lại xu cho requester nếu fail
                            db.ref(`users/${requesterId}/coins`).transaction(c => (c || 0) + betAmount);
                            alert('Lỗi khi chuyển xu!');
                            return;
                        }
                        
                        // Thực hiện undo trước (cần room.undoRequest để xác định lượt)
                        _performUndo(room, 1, request.requester);
                        
                        // Xóa undo request sau khi undo xong
                        db.ref(`rooms/${currentRoomId}/undoRequest`).remove().then(() => {
                            // Ẩn modal và clear flag sau khi xóa request thành công
                            const undoModal = document.getElementById('undo-request-modal');
                            if (undoModal) undoModal.style.display = 'none';
                            window.undoRequestPending = false;
                        });
                        
                        // Thông báo
                        thongBaoHeThong(`↩️ Đã đồng ý rút nước - nhận ${betAmount.toLocaleString('vi-VN')} Xu!`);
                        
                        if (typeof addNotification === 'function') {
                            addNotification('win', `↩️ Đã duyệt rút +${betAmount.toLocaleString('vi-VN')} Xu`);
                        }
                    });
                });
            } else {
                // Không có cược - undo miễn phí
                console.log('[DEBUG-UNDO] No bet, performing free undo');
                _performUndo(room, 1, request.requester);
                db.ref(`rooms/${currentRoomId}/undoRequest`).remove().then(() => {
                    // Ẩn modal và clear flag sau khi xóa request thành công
                    const undoModal = document.getElementById('undo-request-modal');
                    if (undoModal) undoModal.style.display = 'none';
                    window.undoRequestPending = false;
                });
                thongBaoHeThong('↩️ Đã đồng ý rút nước!');
            }
        } else {
            // Reject: chỉ xóa request, không làm gì khác
            console.log('[DEBUG-UNDO] Rejecting undo request');
            db.ref(`rooms/${currentRoomId}/undoRequest`).remove().then(() => {
                // Ẩn modal và clear flag sau khi xóa request thành công
                const undoModal = document.getElementById('undo-request-modal');
                if (undoModal) undoModal.style.display = 'none';
                window.undoRequestPending = false;
            });
            thongBaoHeThong('❌ Đã từ chối rút nước - trận đấu tiếp tục!');
        }
    });
}
function _performUndo(room, movesToRemove, requesterRole) {
    // Convert room.moves to array if it's an object (Firebase stores arrays as objects)
    const movesArray = Array.isArray(room.moves) ? room.moves : Object.values(room.moves || {});
    
    if (!movesArray || movesArray.length < movesToRemove) return;
    
    // Xóa movesToRemove nước cuối
    const newMoves = movesArray.slice(0, -movesToRemove);
    
    // Lượt quay về người vừa request undo (người bị rút nước)
    const newTurn = requesterRole || 'X';
    
    // Xác định lastMove mới - handle different property name formats
    const lastMove = newMoves.length > 0 ? newMoves[newMoves.length - 1] : null;
    const newLastMove = lastMove ? { 
        row: lastMove.row !== undefined ? lastMove.row : (lastMove.r !== undefined ? lastMove.r : -1), 
        col: lastMove.col !== undefined ? lastMove.col : (lastMove.c !== undefined ? lastMove.c : -1), 
        by: lastMove.by !== undefined ? lastMove.by : (lastMove.player !== undefined ? lastMove.player : '') 
    } : { row: -1, col: -1, by: '' };
    
    console.log('[DEBUG-UNDO] Performing undo:', {
        movesToRemove,
        requesterRole,
        newTurn,
        newMovesCount: newMoves.length,
        newLastMove,
        lastMoveRaw: lastMove,
        originalMovesType: typeof room.moves,
        originalMovesIsArray: Array.isArray(room.moves),
        originalMovesLength: movesArray.length,
        newMovesArray: newMoves
    });
    
    // Cập nhật Firebase
    const updateData = {
        moves: newMoves,
        turn: newTurn,
        lastMove: newLastMove,
        updatedAt: Date.now()
    };
    
    console.log('[DEBUG-UNDO] Firebase update data:', updateData);
    
    db.ref(`rooms/${currentRoomId}`).update(updateData).then(() => {
        console.log('[DEBUG-UNDO] Firebase updated successfully');
        
        // Cập nhật local state
        if (typeof moveHistory !== 'undefined') {
            moveHistory.length = 0;
            newMoves.forEach(m => {
                moveHistory.push({ 
                    r: m.row !== undefined ? m.row : (m.r !== undefined ? m.r : 0), 
                    c: m.col !== undefined ? m.col : (m.c !== undefined ? m.c : 0), 
                    player: m.by !== undefined ? m.by : (m.player !== undefined ? m.player : '') 
                });
            });
        }
        
        // CẬP NHẬT infiniteMap - QUAN TRỌNG: renderInfiniteBoard vẽ từ infiniteMap
        if (typeof infiniteMap !== 'undefined') {
            infiniteMap.clear();
            newMoves.forEach(m => {
                const r = m.row !== undefined ? m.row : (m.r !== undefined ? m.r : 0);
                const c = m.col !== undefined ? m.col : (m.c !== undefined ? m.c : 0);
                const player = m.by !== undefined ? m.by : (m.player !== undefined ? m.player : '');
                infiniteMap.set(`${r},${c}`, player);
            });
            console.log('[DEBUG-UNDO] infiniteMap updated:', {
                size: infiniteMap.size,
                entries: Array.from(infiniteMap.entries())
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
        
        console.log('[DEBUG-UNDO] Local state updated:', {
            currentPlayer,
            currentTurn,
            moveHistoryLength: moveHistory ? moveHistory.length : 0,
            moveHistoryContent: moveHistory ? JSON.stringify(moveHistory) : 'undefined',
            lastMoveR,
            lastMoveC
        });
        
        // Re-render bàn cờ để xóa quân vừa rút
        if (typeof renderInfiniteBoard === 'function') {
            console.log('[DEBUG-UNDO] Calling renderInfiniteBoard...');
            renderInfiniteBoard();
            console.log('[DEBUG-UNDO] Board re-rendered');
        } else {
            console.error('[DEBUG-UNDO] renderInfiniteBoard is not available!');
        }
    });
}
window.undoOnlineMove = undoOnlineMove;
window.handleUndoResponse = handleUndoResponse;
// Helper function to show undo modal
function _showUndoModal(request, betAmount) {
    const undoModal = document.getElementById('undo-request-modal');
    if (!undoModal) {
        // Tạo modal nếu chưa có
        const modal = document.createElement('div');
        modal.id = 'undo-request-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:white;padding:20px;border-radius:10px;max-width:400px;text-align:center;">
                <h3 style="margin-bottom:15px;">↩️ Yêu cầu rút nước</h3>
                <p style="margin-bottom:15px;">Bên ${request.requester} muốn rút lại nước vừa đánh.</p>
                <p style="margin-bottom:15px;">${betAmount > 0 ? `Nếu đồng ý, bạn sẽ nhận ${betAmount.toLocaleString('vi-VN')} Xu.` : 'Không có cược.'}</p>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button onclick="handleUndoResponse(true)" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:5px;cursor:pointer;">Đồng ý</button>
                    <button onclick="handleUndoResponse(false)" style="padding:10px 20px;background:#ef4444;color:white;border:none;border-radius:5px;cursor:pointer;">Từ chối</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        undoModal.style.display = 'flex';
    }
}
// Hàm nội bộ: chỉ X gọi — đẩy status = playing lên Firebase
// Guard chống gọi 2 lần trong cùng 1 phiên
let _dangBatDauGame = false;
function _thucSuBatDauGame(room, winCount, chan2Dau, firstTurn) {
    if (_dangBatDauGame) return;
    _dangBatDauGame = true;
    console.log('[DEBUG-BOARD] _thucSuBatDauGame called:', {
        roomId: currentRoomId,
        winCount,
        chan2Dau,
        firstTurn
    });
    db.ref(`rooms/${currentRoomId}`).update({
        status:           'playing',
        turn:             firstTurn,
        winCount,  chan2Dau, firstTurn,
        winner:           '',
        endReason:        '',
        moves:            { init: true },
        lastMove:         { row: -1, col: -1, by: '' },
        endedAt:          null,
        playerXConfirmed: null,
        playerOConfirmed: null,
        updatedAt:        Date.now()
    }).then(() => {
        _dangBatDauGame = false;
        console.log('[DEBUG-BOARD] Game started successfully, Firebase updated');
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
    const chkChan  = document.getElementById('room-chan-2-dau');
    const selFirst = document.getElementById('room-first-turn');
    if (!selWin || !chkChan) return;
    db.ref(`rooms/${currentRoomId}`).update({
        winCount:  parseInt(selWin.value),
        chan2Dau:  chkChan.checked,
        firstTurn: selFirst ? selFirst.value : 'X',
        updatedAt: Date.now()
    });
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
// Theo dõi đối thủ để thông báo vào phòng / rời phòng / mất kết nối
let _prevOppId = '', _prevOppStatus = '';
// BUG 3 FIX: Track previous status to detect when game just ended
let _prevRoomStatus = '';
// BUG 1 FIX: Track current listening room to prevent duplicate listeners
let _currentListeningRoomId = null;
function langNgheThayDoiPhong(roomId) {
    // BUG 1 FIX: Prevent duplicate listeners for the same room
    if (_currentListeningRoomId === roomId && roomListener) {
        console.log('[Firebase] Already listening to room:', roomId, '- skipping duplicate listener');
        return;
    }
    
    if (roomListener) { db.ref(`rooms/${currentRoomId || roomId}`).off('value', roomListener); roomListener = null; }
    _currentListeningRoomId = roomId;
    roomListener = db.ref(`rooms/${roomId}`).on('value', snap => {
        const room = snap.val();
        if (!room) return; // Phòng cố định không bao giờ null
        console.log('[DEBUG-BOARD] Firebase room data received:', {
            roomId,
            status: room.status,
            turn: room.turn,
            playerX_id: room.playerX_id,
            playerO_id: room.playerO_id,
            winCount: room.winCount,
            chan2Dau: room.chan2Dau,
            moves: room.moves ? Object.keys(room.moves).length : 0,
            lastMove: room.lastMove,
            undoRequest: room.undoRequest
        });
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
        currentWinCount = room.winCount || 5;
        if (typeof winCount !== 'undefined') winCount = currentWinCount;
        const gameInfo = document.getElementById('game-info');
        if (room.status === 'playing') {
            console.log('[DEBUG-BOARD] Room status changed to playing, setting isGameActive = true');
            if (typeof isGameActive !== 'undefined') isGameActive = true;
            // Lần đầu vào trận HOẶC ván mới bắt đầu (daXoaBanCoTranNay = false)
            if (!daXoaBanCoTranNay) {
                daXoaBanCoTranNay = true;
                locallyAppliedLastMove = { row: -2, col: -2 };
                _lastProcessedWinner = '';
                if (typeof window.xoaBanCoCu === 'function') window.xoaBanCoCu();
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
                console.log('[DEBUG-BOARD] Auto-calling renderInfiniteBoard after Firebase data received - Using SharedBoardUI');

                // Use SharedBoardUI for unified canvas initialization
                if (typeof SharedBoardUI !== 'undefined') {
                    const success = SharedBoardUI.init('online');
                    if (!success) {
                        console.error('[DEBUG-BOARD] SharedBoardUI.init failed, falling back to old logic');
                        _doInitOnlineCanvasFallback();
                    } else {
                        // SharedBoardUI.init already calls renderInfiniteBoard
                        console.log('[DEBUG-BOARD] SharedBoardUI.init succeeded');
                        // YC.TXT FIX: Call renderInfiniteBoard after SharedBoardUI.init to ensure canvas renders immediately
                        if (typeof renderInfiniteBoard === 'function') {
                            renderInfiniteBoard();
                            console.log('[DEBUG-BOARD] renderInfiniteBoard called after SharedBoardUI.init');
                        }
                    }
                } else {
                    console.warn('[DEBUG-BOARD] SharedBoardUI not loaded, using fallback logic');
                    _doInitOnlineCanvasFallback();
                }
            };

            // Fallback canvas initialization (old logic)
            const _doInitOnlineCanvasFallback = () => {
                console.log('[DEBUG-BOARD] Using fallback canvas initialization');
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

                    console.log('[DEBUG-BOARD] Canvas dimensions set:', {
                        containerWidth: containerRect.width,
                        containerHeight: containerRect.height,
                        canvasWidth: cvOnline.width,
                        canvasHeight: cvOnline.height
                    });
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
                    console.log('[DEBUG-BOARD] Viewport reset to center after canvas resize:', { vRowF, vColF, infCanvasW, infCanvasH, INF_CS });
                }
                
                if (typeof fitCanvasToContainer === 'function') fitCanvasToContainer();
                if (typeof autoResizeInfCanvas  === 'function') autoResizeInfCanvas();
                if (typeof renderInfiniteBoard  === 'function') renderInfiniteBoard();
            };
            
            // YC.TXT FIX: Measure container directly instead of polling (like Bot Room)
            const sbOnline = document.getElementById('shared-board-online');
            if (sbOnline) {
                // Use requestAnimationFrame to ensure layout has painted
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const rect = sbOnline.getBoundingClientRect();
                        const w = rect.width;
                        const h = rect.height;
                        
                        console.log('[DEBUG-BOARD] Container size measured:', { w, h });
                        
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
            // SYNC infiniteMap từ Firebase moves - QUAN TRỌNG cho undo
            if (typeof infiniteMap !== 'undefined' && room.moves) {
                const movesArray = Array.isArray(room.moves) ? room.moves : Object.values(room.moves);
                infiniteMap.clear();
                movesArray.forEach(m => {
                    const r = m.row !== undefined ? m.row : (m.r !== undefined ? m.r : 0);
                    const c = m.col !== undefined ? m.col : (m.c !== undefined ? m.c : 0);
                    const player = m.by !== undefined ? m.by : (m.player !== undefined ? m.player : '');
                    infiniteMap.set(`${r},${c}`, player);
                });
                console.log('[DEBUG-BOARD] Synced infiniteMap from Firebase:', {
                    size: infiniteMap.size,
                    movesCount: movesArray.length
                });
                
                // YC.TXT FIX: Render AFTER Firebase sync moves completes (like Bot Room renders after GameState)
                if (typeof renderInfiniteBoard === 'function') {
                    renderInfiniteBoard();
                    console.log('[DEBUG-BOARD] renderInfiniteBoard called after Firebase sync moves');
                }
            }
            // Vẽ nước đi mới nhất (cả của mình lẫn đối thủ)
            if (room.lastMove && room.lastMove.by) {
                if (room.lastMove.row !== locallyAppliedLastMove.row || room.lastMove.col !== locallyAppliedLastMove.col) {
                    console.log('[DEBUG-BOARD] Drawing move:', room.lastMove, 'myRole:', myRole);
                    locallyAppliedLastMove.row = room.lastMove.row;
                    locallyAppliedLastMove.col = room.lastMove.col;
                    thucHienVeNuocDi(room.lastMove.row, room.lastMove.col, room.lastMove.by);
                }
            }
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
            // BUG 3 FIX: Detect if this is a new status change from playing to ended
            const justEnded = _prevRoomStatus === 'playing' && room.status === 'ended';
            _prevRoomStatus = room.status;
            
            // BUG 1 FIX: Only process end game if we haven't processed this specific end state yet
            // The guard inside xuLyKetThucVan uses endedAt to prevent duplicate processing
            // We also check if the winner field has changed since last processing
            const vanId = `${currentRoomId}_${room.endedAt || room.updatedAt || ''}`;
            if (_lastProcessedWinner !== vanId) {
                // BUG 3 FIX: If game just ended, wait for render to complete before showing popup
                if (justEnded) {
                    (async () => {
                        // Wait for last move rendering to complete
                        if (typeof renderInfiniteBoardAsync === 'function') {
                            await renderInfiniteBoardAsync();
                        }
                        xuLyKetThucVan(room);
                    })();
                } else {
                    xuLyKetThucVan(room);
                }
            }
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
                    _thucSuBatDauGame(room, room.winCount || 5, room.chan2Dau ?? true, room.firstTurn || 'X');
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
        if (showRules) {
            const selWin   = document.getElementById('room-win-count');
            const chkChan  = document.getElementById('room-chan-2-dau');
            const selFirst = document.getElementById('room-first-turn');
            if (selWin  && document.activeElement !== selWin)  selWin.value    = room.winCount || 5;
            if (chkChan && document.activeElement !== chkChan) chkChan.checked = room.chan2Dau ?? true;
            if (selFirst && document.activeElement !== selFirst) selFirst.value = room.firstTurn || 'X';
        }
    }
    // Nút Bắt đầu & Kick — chỉ X khi waiting có đối thủ
    const showControls = laChuX && coDoiThu && room.status === 'waiting';
    if (btnKick)  btnKick.style.display  = showControls ? 'inline-block' : 'none';
    if (btnStart) {
        btnStart.style.display = showControls ? 'inline-block' : 'none';
        if (showControls) {
            const hasBetPending = room.betAmount && room.betAmount >= 100
                                  && !(room.guestReady || room.playerOConfirmed);
            btnStart.textContent = hasBetPending
                ? '⏳ Chờ khách SẴN SÀNG...'
                : '▶ Bắt đầu';
            btnStart.disabled    = hasBetPending;
            btnStart.style.opacity = hasBetPending ? '0.55' : '1';
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
                console.log('[loadPlayerInfo] Using skin from room data:', roomSkinField, '=', skinId);
            } else {
                skinId = u.equippedSkin || 'skin_default';
                console.log('[loadPlayerInfo] Room skin not found, using user profile skin:', skinId);
            }
        } else {
            skinId = u.equippedSkin || 'skin_default';
            console.log('[loadPlayerInfo] Room not found, using user profile skin:', skinId);
        }
        
        if (role === 'X') {
            window._onlineSkinX = skinId;
            console.log('[loadPlayerInfo] Set _onlineSkinX:', skinId, 'for user:', userId);
        }
        if (role === 'O') {
            window._onlineSkinO = skinId;
            console.log('[loadPlayerInfo] Set _onlineSkinO:', skinId, 'for user:', userId);
        }
        // Cập nhật cursor ngay sau khi skin load xong
        if (typeof updateCursorByTurn === 'function') updateCursorByTurn();
        
        // Re-render bàn cờ sau khi skin load xong để áp dụng skin mới
        if (typeof renderInfiniteBoard === 'function') {
            console.log('[loadPlayerInfo] Re-rendering board after skin load');
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
    // Luôn dùng luật của phòng đang chơi; không phụ thuộc checkbox local của người chơi.
    const isWin = (typeof window.checkWinLogicOld === 'function')
        ? window.checkWinLogicOld(row, col, myRole, currentRule, currentWinCount)
        : ((typeof checkWin === 'function') ? checkWin(row, col) : false);
    const moveKey  = `${row}_${col}`;  // Key xác định ô — dùng để check O(1)
    return roomRef.transaction(data => {
        if (!data) return null; // retry
        if (data.turn !== myRole) return null;
        if (data.status !== 'playing') return null;
        // Kiểm tra ô đã bị đánh chưa — O(1) lookup thay vì O(n) loop
        if (data.moves && data.moves[moveKey]) return null;
        data.turn     = nextTurn;
        data.status   = isWin ? 'ended' : 'playing';
        data.winner   = isWin ? myRole  : '';
        data.lastMove = { row, col, by: myRole, ts: Date.now() };
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
    if (typeof checkWin === 'function' && checkWin(row, col)) {
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
    console.log('[DEBUG-BOARD] phucHoiBanCo called for room:', roomId);
    db.ref(`rooms/${roomId}/moves`).once('value').then(snap => {
        const movesData = snap.val();
        console.log('[DEBUG-BOARD] phucHoiBanCo moves data:', {
            roomId,
            movesData: movesData ? Object.keys(movesData).length + ' entries' : 'null/undefined',
            sample: movesData ? Object.values(movesData).slice(0, 2) : null
        });
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
function xuLyKetThucVan(room) {
    if (!room.winner) return;
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
    if (isPlayer) {
        // BUG 1 FIX (REAL ROOT CAUSE): Don't call playCoinBurstAsync(0) here
        // Animation is already called by:
        // - ketThucCuoc() if there's a bet
        // - onWinSoloXu() if there's no bet
        // Calling it here causes duplicate animation
        
        // BUG 4 FIX: Wait for any running animation to complete before showing popup
        (async () => {
            if (typeof playCoinBurstAsync === 'function') {
                // If animation is already running (from ketThucCuoc or onWinSoloXu), wait for it
                // If not running, this will resolve immediately (no animation started)
                await playCoinBurstAsync(0, '');
            }
            hienUIVanMoi(msg);
        })();
    }
    // Guard chống ghi rank trùng — dùng endedAt (chỉ set 1 lần khi ván kết thúc)
    const vanId = `${currentRoomId}_${room.endedAt || room.updatedAt || ''}`;
    if (_lastProcessedWinner === vanId) return;
    _lastProcessedWinner = vanId;
    const winnerId  = room.winner === 'X' ? room.playerX_id : room.playerO_id;
    const loserId   = room.winner === 'X' ? room.playerO_id : room.playerX_id;
    const myId      = localStorage.getItem('current_user_id');
    // Thắng thực sự = không có endReason "bỏ cuộc" (tức là thắng bằng nước cờ)
    const thangThucSu = !endReason.includes('bỏ cuộc');
    // Chỉ người thắng ghi rank — ưu tiên người thắng ghi để tránh trùng
    if (myId === winnerId) {
        // Kiểm tra có cược không
        const minBetCheck = room.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
        const hasBet = room.betAmount && room.betAmount >= minBetCheck;
        
        // Chỉ +winSolo khi thắng bằng nước cờ thực sự
        if (thangThucSu) {
            db.ref(`users/${winnerId}/winSolo`).transaction(c => (c || 0) + 1);
            capNhatBXH(winName, winnerId);
            // Thưởng xu thắng Solo Online (có giới hạn ngày) - chỉ khi KHÔNG có cược
            if (!hasBet && typeof onWinSoloXu === 'function') onWinSoloXu();
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
        ghiLichSu(`Phòng ${room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?')}`, xName, oName, room.winner, room.winCount || 5);
    } else if (myId === loserId) {
        // Người thua — tính loseSolo
        db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
        if (!winnerId) {
            // Fallback: winner không online
        }
    }
    // Xử lý cược: chỉ gọi từ winner và chỉ khi có cược
    // Loser sẽ nhận xu popup qua transaction của winner
    const minBetCheck = room.isVip ? XU_CONFIG.VIP_BET_MIN : XU_CONFIG.BET_MIN;
    const hasBet = room.betAmount && room.betAmount >= minBetCheck;
    if (myId === winnerId && hasBet && typeof ketThucCuoc === 'function') {
        ketThucCuoc(currentRoomId, room.winner, false);
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
        <p style="margin:10px 0 14px;color:#555;font-size:13px;">Chỉnh luật ở thanh phòng rồi bấm Bắt đầu</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button onclick="xemLaiBanCo()" style="padding:9px 14px;background:#6c757d;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🔍 Xem lại</button>
            <button onclick="batDauVanMoi()" style="padding:9px 20px;background:#28a745;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:bold;">▶ Quay lại phòng chính</button>
            <button onclick="thoatPhongSauVan()" style="padding:9px 12px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Thoát</button>
        </div>
    ` : `
        <p style="margin:10px 0 12px;color:#555;font-size:13px;">Chờ chủ phòng bắt đầu ván mới...</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <button onclick="xemLaiBanCo()" style="padding:9px 14px;background:#6c757d;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🔍 Xem lại</button>
            <button onclick="quayLaiPhongChinhO()" style="padding:9px 16px;background:#28a745;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;">▶ Quay lại phòng chính</button>
            <button onclick="thoatPhongSauVan()" style="padding:9px 12px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Thoát</button>
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
function xemLaiBanCo() {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    // Nút nhỏ góc trên phải để quay lại kết quả
    const existing = document.getElementById('btn-back-to-result');
    if (existing) return;
    const btn = document.createElement('button');
    btn.id = 'btn-back-to-result';
    btn.textContent = '↩ Kết quả ván';
    btn.style.cssText = `
        position:fixed; top:12px; right:12px; z-index:99998;
        padding:8px 14px; background:#6366f1; color:white;
        border:none; border-radius:8px; cursor:pointer;
        font-size:13px; font-weight:bold;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
    `;
    btn.onclick = () => {
        btn.remove();
        const turnEl = document.getElementById('turn-indicator');
        hienUIVanMoi(turnEl ? turnEl.textContent : '');
    };
    document.body.appendChild(btn);
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
    // Reset về waiting — chủ phòng sẽ thấy nút Bắt đầu, chọn lại luật rồi bấm
    // An toàn hơn set playing thẳng vì tránh race condition với O
    db.ref(`rooms/${currentRoomId}`).update({
        status:    'waiting',
        winner:    '',
        endReason: '',
        moves:     { init: true },
        lastMove:  { row: -1, col: -1, by: '' },
        endedAt:   null,
        updatedAt: Date.now()
    });
}
window.batDauVanMoi = batDauVanMoi;
// Khách O bấm "Quay lại phòng chính" — chỉ ẩn overlay, ở lại phòng chờ chủ X bắt đầu
function quayLaiPhongChinhO() {
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();
    const btnBack = document.getElementById('btn-back-to-result');
    if (btnBack) btnBack.remove();
    // Reset local state để sẵn sàng ván mới
    daXoaBanCoTranNay = false;
    locallyAppliedLastMove = { row: -2, col: -2 };
    _lastProcessedWinner = '';
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
