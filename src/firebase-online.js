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
            document.getElementById('auth-title').innerText = '🔐 ĐĂNG NHẬP';
            document.getElementById('auth-container').style.display = 'block';
        });
    }
    if (btnRegister && !btnRegister._earlyBound) {
        btnRegister._earlyBound = true;
        btnRegister.addEventListener('click', () => {
            document.getElementById('auth-title').innerText = '📝 ĐĂNG KÝ';
            document.getElementById('auth-container').style.display = 'block';
        });
    }
    if (btnOnline && !btnOnline._earlyBound) {
        btnOnline._earlyBound = true;
        btnOnline.addEventListener('click', (e) => {
            if (!currentUsername) {
                e.preventDefault(); e.stopPropagation();
                document.getElementById('auth-title').innerText = '🔐 ĐĂNG NHẬP';
                document.getElementById('auth-container').style.display = 'block';
                return;
            }
            document.getElementById('lobby-screen').style.display = 'block';
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
            document.getElementById('auth-container').style.display = 'none';
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
const TOTAL_ROOMS = 20;

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
    // Chỉ tạo phòng chưa tồn tại — KHÔNG bao giờ ghi đè phòng đang có dữ liệu
    for (let i = 1; i <= TOTAL_ROOMS; i++) {
        const roomRef = db.ref(`rooms/phong_${i}`);
        roomRef.once('value').then(snap => {
            if (!snap.exists() || snap.val() === null) {
                roomRef.set(taoDataPhongRong(i));
            }
            // Nếu phòng đã tồn tại thì không động vào — dù trạng thái nào
        });
    }
}

function taoDataPhongRong(so) {
    return {
        roomNumber: so,
        name: `Phòng ${so}`,
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
        guestReady: false,
        betAmount: null,
        updatedAt: Date.now()
    };
}

// ══════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION
// ══════════════════════════════════════════════════════════════════
function updateAuthUI(isLoggedIn) {
    const topAuthBtns = document.getElementById('top-auth-buttons');
    const navQuickBtns = document.getElementById('nav-quick-btns');
    const userCard    = document.getElementById('user-info-card');
    if (isLoggedIn) {
        if (topAuthBtns) topAuthBtns.style.display = 'none';
        if (navQuickBtns) navQuickBtns.style.display = 'flex';
        if (userCard)    userCard.style.display    = 'flex';
    } else {
        if (topAuthBtns) topAuthBtns.style.display = 'flex';
        if (navQuickBtns) navQuickBtns.style.display = 'none';
        if (userCard)    userCard.style.display    = 'none';
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
        // DO7.TXT: winSolo/loseSolo renamed to winOnline/loseOnline for clarity (these are Online PvP stats, not Solo local)
        ref.set({ username, password, displayName: username, winBot: 0, winOnline: 0, loseOnline: 0, createdAt: Date.now() })
           .then(() => {
               document.getElementById('auth-container').style.display = 'none';
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
        document.getElementById('auth-container').style.display = 'none';
        fetchUserData(userId);
        updateAuthUI(true);
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
        // DO7.TXT: winSolo/loseSolo renamed to winOnline/loseOnline (with backward compatibility fallback)
        const winOnline = data.winOnline || data.winSolo || 0;
        const loseOnline = data.loseOnline || data.loseSolo || 0;
        const rank = getRankName(data.winBot, winOnline);
        document.getElementById('user-display-name').innerText = data.displayName || data.username;
        document.getElementById('my-win-bot').innerText   = data.winBot   || 0;
        document.getElementById('my-win-solo').innerText  = winOnline;
        document.getElementById('my-lose-solo').innerText = loseOnline;
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

        // Cập nhật số dư Xu trên header
        if (typeof updateCoinDisplay === 'function') updateCoinDisplay(data.coins || 0);

        // Chỉ setup listeners lần đầu
        if (firstLoad) {
            firstLoad = false;
            setMyOnlineStatus('free');
            langNgheDanhSachOnline();
            langNgheLoiMoiDen();
            kiemTraLoiMoiCho(userId); // Kiểm tra lời mời đang chờ
            
            // Thông báo chào mừng khi đăng nhập (chỉ 1 lần)
            if (!welcomeNotificationShown && typeof addNotification === 'function') {
                const displayName = data.displayName || data.username || 'Bạn';
                addNotification('online', `Chào mừng🎉 ${displayName} đã tham gia GAME! Chúc ${displayName} có 1 ngày vui vẻ!`);
                welcomeNotificationShown = true;
            }

            // Khởi tạo hệ thống Xu
            if (typeof initXuSystem === 'function') initXuSystem(userId);

            // Khởi động Room Cleanup Manager sau khi đăng nhập
            startRoomCleanupManager();
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

// DO7.TXT: winSolo parameter renamed to winOnline for clarity (Online PvP stats)
function getRankName(winBot, winOnline) {
    const t = (winBot || 0) + (winOnline || 0);
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
                    const dongY = confirm(`🎮 [${invite.fromPlayerName}] đã mời bạn vào phòng solo! Chấp nhận?`);
                    if (dongY) {
                        vaoPhongLaO(invite.fromRoomId);
                    }
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
            document.getElementById('lobby-screen').style.display = 'block';
            hienDanhSachPhong();
            langNgheBangXepHangOnline();
            langNgheLichSuOnline();
            khoiDongChatTheGioi();
        });
    }
    document.getElementById('btn-close-lobby').addEventListener('click', () => {
        document.getElementById('lobby-screen').style.display = 'none';
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
            if (room.status === 'playing') {
                phucHoiBanCo(savedRoom, () => {
                    langNgheThayDoiPhong(savedRoom);
                    langNgheTinNhan(savedRoom);
                    setMyOnlineStatus('playing');
                });
            } else {
                langNgheThayDoiPhong(savedRoom);
                langNgheTinNhan(savedRoom);
                setMyOnlineStatus('free');
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
        if (!document.getElementById('lobby-screen') ||
            document.getElementById('lobby-screen').style.display === 'none') return;

        const rooms = snap.val();
        container.innerHTML = '';
        const myId = localStorage.getItem('current_user_id');

        for (let i = 1; i <= TOTAL_ROOMS; i++) {
            const roomId = `phong_${i}`;
            const room   = (rooms && rooms[roomId]) || taoDataPhongRong(i);
            const el     = document.createElement('div');
            el.style.cssText = 'padding:10px;margin:5px 0;border:1px solid #ccc;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';

            const laTrongPhong = (myId === room.playerX_id || myId === room.playerO_id);
            let statusTxt = '', bgColor = '#f8f9fa', borderColor = '#ddd', nutHtml = '';

            if (room.status === 'empty') {
                statusTxt = '🟢 Trống';
                nutHtml   = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
            } else if (room.status === 'waiting') {
                bgColor = '#e8f5e9'; borderColor = '#4caf50';
                statusTxt = '⏳ Chờ bắt đầu';
                if (laTrongPhong) {
                    nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;">Vào lại</button>`;
                } else if (!room.playerO_id) {
                    nutHtml = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Solo</button>`;
                } else {
                    nutHtml = `<span style="color:#aaa;font-size:12px;">Đầy</span>`;
                }
            } else if (room.status === 'playing') {
                bgColor = '#fff3e0'; borderColor = '#ff9800';
                statusTxt = '⚔️ Đang chơi';
                if (laTrongPhong) {
                    nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:#ff9800;color:white;border:none;border-radius:4px;cursor:pointer;">🔄 Vào lại</button>`;
                } else {
                    nutHtml = `<button onclick="xemPhong('${roomId}')" style="padding:6px 14px;background:#17a2b8;color:white;border:none;border-radius:4px;cursor:pointer;">👁️ Xem</button>`;
                }
            } else {
                // ended hoặc unknown — hiện như trống
                statusTxt = '🟢 Trống';
                nutHtml   = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
            }

            el.style.backgroundColor = bgColor;
            el.style.borderColor     = borderColor;
            const xN = room.playerX_name || '---';
            const oN = room.playerO_name || '---';
            // Phòng cũ chưa có winCount/chan2Dau/roomNumber → patch lên Firebase
            const wc = room.winCount || 5;
            const c2d = room.chan2Dau ?? true;
            const updates = {};
            if (!room.winCount) { updates.winCount = 5; updates.chan2Dau = true; }
            if (!room.roomNumber) updates.roomNumber = i;
            if (Object.keys(updates).length > 0) db.ref(`rooms/${roomId}`).update(updates);
            const luatTxt = `${wc} quân${c2d ? ' · Chặn 2 đầu' : ''}`;
            el.innerHTML = `
                <div>
                    <div style="font-weight:bold;font-size:14px;">Phòng ${i}</div>
                    <div style="font-size:12px;color:#555;margin-top:2px;">
                        🔴 ${xN} vs 🔵 ${oN}
                        &nbsp;·&nbsp;<span style="color:#888;">${luatTxt}</span>
                        &nbsp;·&nbsp;<b>${statusTxt}</b>
                    </div>
                </div>
                <div>${nutHtml}</div>
            `;
            container.appendChild(el);
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
    const roomRef = db.ref(`rooms/${roomId}`);

    roomRef.transaction(room => {
        // Firebase gọi lần đầu với null — trả null để retry với dữ liệu thực
        if (!room) return null;
        if (room.status === 'playing') return; // abort — đang chơi

        // Kiểm tra phòng "ma": dùng lastPing (chính xác hơn playerStatus string)
        const now = Date.now();
        const PING_DEAD_MS = 65 * 1000; // phải khớp với PING_TIMEOUT_MS trong room-health.js
        const xPingDead = !room.playerX_lastPing || (now - room.playerX_lastPing) > PING_DEAD_MS;
        const oPingDead = !room.playerO_lastPing || (now - room.playerO_lastPing) > PING_DEAD_MS;
        const isStale   = (now - (room.updatedAt || 0)) > ROOM_STALE_MS;
        const xOffline  = room.playerX_status !== 'online';
        const oOffline  = room.playerO_status !== 'online';

        // X là ghost (ping chết hoặc status offline lâu)
        const xIsGhost = room.playerX_id && (xPingDead && (xOffline || isStale));
        // O là ghost
        const oIsGhost = room.playerO_id && (oPingDead && (oOffline || isStale));

        if (xIsGhost) {
            room.playerX_id = ''; room.playerX_name = ''; room.playerX_status = 'offline';
            room.playerX_lastPing = null;
        }
        if (oIsGhost) {
            room.playerO_id = ''; room.playerO_name = ''; room.playerO_status = 'offline';
            room.playerO_lastPing = null;
        }
        // Reset status nếu không còn ai
        if (!room.playerX_id && !room.playerO_id) {
            room.status = 'empty';
        }

        if (!room.playerX_id || room.status === 'empty' || room.status === 'ended') {
            // Ngồi ghế X — reset phòng về waiting sạch
            room.playerX_id       = myId;
            room.playerX_name     = myName;
            room.playerX_status   = 'online';
            room.playerX_lastPing = Date.now();
            room.playerO_id       = '';
            room.playerO_name     = '';
            room.playerO_status   = 'offline';
            room.playerO_lastPing = null;
            room.status           = 'waiting';
            room.winner           = '';
            room.endReason        = '';
            room.moves            = { init: true };
            room.lastMove         = { row: -1, col: -1, by: '' };
            room.updatedAt        = Date.now();
            return room;
        } else if (!room.playerO_id && room.playerX_id !== myId) {
            // Ngồi ghế O
            room.playerO_id       = myId;
            room.playerO_name     = myName;
            room.playerO_status   = 'online';
            room.playerO_lastPing = Date.now();
            room.updatedAt        = Date.now();
            return room;
        }
        // Cả 2 ghế đầy hoặc mình đã ngồi — abort
        return;
    }).then(result => {
        if (!result.committed) { alert('Phòng đã đầy hoặc không thể vào!'); return; }
        const room = result.snapshot.val();
        currentRoomId     = roomId;
        myRole            = room.playerX_id === myId ? 'X' : 'O';
        daXoaBanCoTranNay = false;
        localStorage.setItem('current_room_id', roomId);

        // Đồng bộ avatar & skin lên phòng để đối thủ thấy
        const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
        const profileField = myRole === 'X'
            ? { playerX_avatar: profile.avatarDisplay || '', playerX_skin: profile.skinId || 'skin_default' }
            : { playerO_avatar: profile.avatarDisplay || '', playerO_skin: profile.skinId || 'skin_default' };
        db.ref(`rooms/${roomId}`).update(profileField);

        setupOnDisconnect(roomId, myRole);
        // Đóng lobby và hủy listener danh sách phòng
        if (roomsListListener) {
            db.ref('rooms').off('value', roomsListListener);
            roomsListListener = null;
        }
        document.getElementById('lobby-screen').style.display = 'none';
        batDauGiaoDienOnline();
        langNgheThayDoiPhong(roomId);
        langNgheTinNhan(roomId);
        setMyOnlineStatus('free');
    }).catch(err => { alert('Lỗi kết nối: ' + err.message); });
}
window.ngoimVaoPhong = ngoimVaoPhong;

function vaoLaiPhong(roomId) {
    const myId = localStorage.getItem('current_user_id');
    db.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) { alert('Phòng không tồn tại!'); return; }
        const isX = myId === room.playerX_id;
        const isO = myId === room.playerO_id;
        if (!isX && !isO) { alert('Bạn không thuộc phòng này!'); return; }

        currentRoomId     = roomId;
        myRole            = isX ? 'X' : 'O';
        daXoaBanCoTranNay = true;
        currentTurn       = room.turn || 'X';
        currentRule       = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
        currentWinCount   = room.winCount || 5;
        if (typeof winCount !== 'undefined') winCount = currentWinCount;
        localStorage.setItem('current_room_id', roomId);

        const sf = myRole === 'X' ? 'playerX_status' : 'playerO_status';
        db.ref(`rooms/${roomId}/${sf}`).set('online');
        setupOnDisconnect(roomId, myRole);

        // Làm mới avatar & skin khi vào lại (có thể đã đổi skin)
        const profile2 = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
        const pf2 = myRole === 'X'
            ? { playerX_avatar: profile2.avatarDisplay || '', playerX_skin: profile2.skinId || 'skin_default' }
            : { playerO_avatar: profile2.avatarDisplay || '', playerO_skin: profile2.skinId || 'skin_default' };
        db.ref(`rooms/${roomId}`).update(pf2);

        document.getElementById('lobby-screen').style.display = 'none';
        batDauGiaoDienOnline();
        if (room.status === 'playing') {
            phucHoiBanCo(roomId, () => { langNgheThayDoiPhong(roomId); langNgheTinNhan(roomId); });
        } else {
            langNgheThayDoiPhong(roomId); langNgheTinNhan(roomId);
        }
        setMyOnlineStatus(room.status === 'playing' ? 'playing' : 'free');
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
        return room;
    }).then(result => {
        if (!result.committed) { alert('Ghế O đã có người!'); return; }
        currentRoomId     = roomId;
        myRole            = 'O';
        daXoaBanCoTranNay = false;
        localStorage.setItem('current_room_id', roomId);

        // Đồng bộ avatar & skin lên phòng
        const profile = (typeof getMyPublicProfile === 'function') ? getMyPublicProfile() : {};
        db.ref(`rooms/${roomId}`).update({
            playerO_avatar: profile.avatarDisplay || '',
            playerO_skin:   profile.skinId || 'skin_default'
        });

        setupOnDisconnect(roomId, 'O');
        batDauGiaoDienOnline();
        langNgheThayDoiPhong(roomId);
        langNgheTinNhan(roomId);
        setMyOnlineStatus('free');
    });
}

function xemPhong(roomId) {
    currentRoomId = roomId;
    myRole        = 'viewer';
    daXoaBanCoTranNay = true;
    document.getElementById('lobby-screen').style.display = 'none';
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
    const sf      = role === 'X' ? 'playerX_status'    : 'playerO_status';
    const pingF   = role === 'X' ? 'playerX_lastPing'  : 'playerO_lastPing';
    const sfRef   = db.ref(`rooms/${roomId}/${sf}`);
    const pingRef = db.ref(`rooms/${roomId}/${pingF}`);

    sfRef.onDisconnect().set('offline');
    pingRef.onDisconnect().set(null);  // xóa lastPing khi disconnect → room-health biết là ghost
    db.ref(`rooms/${roomId}`).onDisconnect().update({ updatedAt: Date.now() });

    // Hủy listener cũ của roomId này nếu có
    if (_connectedListeners[roomId]) {
        db.ref('.info/connected').off('value', _connectedListeners[roomId]);
    }
    // Khi reconnect → restore online và cập nhật lastPing
    _connectedListeners[roomId] = db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true && currentRoomId === roomId) {
            sfRef.set('online');
            pingRef.set(Date.now());
            db.ref(`rooms/${roomId}`).update({ updatedAt: Date.now() });
        }
    });
    connectedListener = _connectedListeners[roomId];
}

// ══════════════════════════════════════════════════════════════════
// 🧹 ROOM CLEANUP MANAGER — Dọn phòng "ma" định kỳ
// ══════════════════════════════════════════════════════════════════
let _roomCleanupTimer = null;
const ROOM_STALE_MS   = 90 * 1000;  // 90 giây không hoạt động → phòng bỏ hoang (room-health.js dùng lastPing chính xác hơn)
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
    document.body.classList.add('in-game-active');
    isOnlineMode = true;

    const onlineBanner = document.getElementById('online-status-banner');
    if (onlineBanner) onlineBanner.style.display = 'block';

    if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'none';
    if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'none';
    if (document.querySelector('.panels-wrapper')) document.querySelector('.panels-wrapper').style.display = 'none';
    if (document.getElementById('ui-btn-restart')) document.getElementById('ui-btn-restart').style.display = 'none';
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = 'none';
    // Khung thoại bot → chuyển thành THANH THÔNG BÁO HỆ THỐNG:
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

    if (typeof window.xoaBanCoCu === 'function' && !daXoaBanCoTranNay) window.xoaBanCoCu();
    // Reset hover ngay khi vào phòng
    if (typeof infHoverR !== 'undefined') { infHoverR = null; infHoverC = null; }

    // Initialize Shared Board Engine (DO4.TXT)
    _initSharedBoardOnline();

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

// ── INITIALIZE SHARED BOARD ENGINE FOR ONLINE MODE (DO4.TXT) ─────
let _sharedBoardOnlineInitialized = false;

function _initSharedBoardOnline() {
    // Reset Shared Board Engine if it was initialized for Practice mode
    // This prevents canvas ID conflict between Practice (inf-canvas) and Online (inf-canvas-online)
    if (typeof SharedBoardEngine !== 'undefined' && SharedBoardEngine.Renderer.initialized) {
        console.log('Resetting Shared Board Engine for Online mode (was previously initialized for Practice)');
        SharedBoardEngine.Renderer.destroy();
        SharedBoardEngine.InputController.destroy();
        SharedBoardEngine.ResponsiveLayout.destroy();
        _sharedBoardOnlineInitialized = false;
    }
    
    if (_sharedBoardOnlineInitialized) return;
    
    const canvas = document.getElementById('inf-canvas-online');
    if (!canvas) {
        console.warn('Shared Board Engine Online: canvas not found');
        return;
    }

    // Initialize Shared Board Engine with move callback
    if (typeof SharedBoardEngine !== 'undefined') {
        SharedBoardEngine.init(canvas, _handleOnlineBoardMove);
        _sharedBoardOnlineInitialized = true;
        
        // Set theme
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            SharedBoardEngine.Renderer.setTheme(themeSelect.value);
        }
        
        console.log('Shared Board Engine initialized for Online mode');
    } else {
        console.warn('Shared Board Engine not available, falling back to old system');
    }
}

// ── HANDLE BOARD MOVE FROM SHARED ENGINE (ONLINE) ───────────────
function _handleOnlineBoardMove(worldX, worldY) {
    if (!isOnlineMode || !currentRoomId) return;
    
    // Convert world coordinates to the format expected by Firebase
    // Firebase uses row/col, Shared Board uses world X/Y
    const row = worldY;
    const col = worldX;
    
    // Call the existing online move handler
    if (typeof danhQuanOnline === 'function') {
        danhQuanOnline(row, col);
    }
}

function thoatGiaoDienOnline() {
    document.body.classList.remove('in-game-active');
    isOnlineMode      = false;
    window.onpopstate = null;

    // Đóng overlay ván mới nếu còn hiện
    const vmOv = document.getElementById('van-moi-overlay');
    if (vmOv) vmOv.remove();

    const onlineBanner = document.getElementById('online-status-banner');
    if (onlineBanner) onlineBanner.style.display = 'none';

    if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'block';
    if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'block';
    if (document.querySelector('.panels-wrapper')) document.querySelector('.panels-wrapper').style.display = 'flex';
    if (document.getElementById('ui-btn-restart')) document.getElementById('ui-btn-restart').style.display = 'block';
    const topBarRestore = document.getElementById('top-bar');
    if (topBarRestore) topBarRestore.style.display = 'flex';
    // Trả khung thoại về chế độ BOT (offline đấu máy): bỏ style thông báo hệ thống
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
    if (typeof initGame === 'function') initGame();
}

// ══════════════════════════════════════════════════════════════════
// 🚪 THOÁT PHÒNG
// ══════════════════════════════════════════════════════════════════
function xuLyThoatPhong() {
    if (!currentRoomId) { thoatGiaoDienOnline(); return; }
    roiKhoiPhong();
}
window.xuLyThoatPhong = xuLyThoatPhong;

function roiKhoiPhong(onDone) {
    if (!currentRoomId) { if (onDone) onDone(); return; }
    const rid  = currentRoomId;
    const role = myRole;
    const myId = localStorage.getItem('current_user_id');
    const done = () => { _resetSauThoat(rid); if (onDone) onDone(); };

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
                        playerO_id: '', playerO_name: '', playerO_status: 'offline',
                        guestReady: false,  // O trở thành X mới, slot O trống
                        status: 'waiting', updatedAt: Date.now()
                    }).then(done);
                } else {
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: '', playerX_name: '', playerX_status: 'offline',
                        guestReady: false,
                        status: 'empty', updatedAt: Date.now()
                    }).then(done);
                }
            } else if (role === 'O' && myId === room.playerO_id) {
                db.ref(`rooms/${rid}`).update({
                    playerO_id: '', playerO_name: '', playerO_status: 'offline',
                    guestReady: false,  // Reset SẴN SÀNG khi O rời phòng
                    updatedAt: Date.now()
                }).then(done);
            } else {
                done();
            }

        } else if (room.status === 'ended') {
            if (role === 'viewer') { done(); return; }
            const updates = { updatedAt: Date.now() };
            if (role === 'X' && myId === room.playerX_id) {
                if (room.playerO_id) {
                    Object.assign(updates, {
                        playerX_id: room.playerO_id, playerX_name: room.playerO_name,
                        playerX_status: room.playerO_status || 'offline',
                        playerO_id: '', playerO_name: '', playerO_status: 'offline',
                        status: 'waiting'
                    });
                } else {
                    Object.assign(updates, {
                        playerX_id: '', playerX_name: '', playerX_status: 'offline',
                        status: 'empty'
                    });
                }
            } else if (role === 'O' && myId === room.playerO_id) {
                Object.assign(updates, {
                    playerO_id: '', playerO_name: '', playerO_status: 'offline',
                    status: room.playerX_id ? 'waiting' : 'empty'
                });
            }
            Object.assign(updates, { winner: '', endReason: '', moves: { init: true }, lastMove: { row: -1, col: -1, by: '' } });
            db.ref(`rooms/${rid}`).update(updates).then(done);

        } else {
            done();
        }
    });
}

// Centralized Firebase listener cleanup manager
function cleanupFirebaseListeners(options = {}) {
    const { 
        cleanupRoom = false, 
        cleanupConnected = false,
        cleanupOnlineUsers = false,
        cleanupInvitation = false,
        cleanupRoomsList = false,
        cleanupLeaderboard = false,
        cleanupHistory = false,
        cleanupWorldChat = false,
        cleanupUserData = false,
        roomId = null
    } = options;

    // Cleanup room listener
    if (cleanupRoom && roomListener) {
        const rid = roomId || currentRoomId;
        if (rid) {
            db.ref(`rooms/${rid}`).off('value', roomListener);
            roomListener = null;
        }
    }

    // Cleanup connected listener
    if (cleanupConnected && roomId && _connectedListeners[roomId]) {
        db.ref('.info/connected').off('value', _connectedListeners[roomId]);
        delete _connectedListeners[roomId];
        connectedListener = null;
    }

    // Cleanup online users listener
    if (cleanupOnlineUsers && onlineUsersListener) {
        db.ref('online_users').off('value', onlineUsersListener);
        onlineUsersListener = null;
    }

    // Cleanup invitation listener
    if (cleanupInvitation && invitationListener) {
        const userId = localStorage.getItem('current_user_id');
        if (userId) {
            db.ref(`invitations/${userId}`).off('value', invitationListener);
        }
        invitationListener = null;
    }

    // Cleanup rooms list listener
    if (cleanupRoomsList && roomsListListener) {
        db.ref('rooms').off('value', roomsListListener);
        roomsListListener = null;
    }

    // Cleanup leaderboard listener
    if (cleanupLeaderboard && leaderboardListener) {
        db.ref('users').off('value', leaderboardListener);
        leaderboardListener = null;
    }

    // Cleanup history listener
    if (cleanupHistory && historyListener) {
        db.ref('history').off('value', historyListener);
        historyListener = null;
    }

    // Cleanup world chat listener
    if (cleanupWorldChat) {
        tatChatTheGioi();
    }

    // Cleanup user data listener
    if (cleanupUserData && userDataListener && userDataUserId) {
        db.ref('users/' + userDataUserId).off('value', userDataListener);
        userDataListener = null;
        userDataUserId = null;
    }
}

function _resetSauThoat(rid) {
    // Centralized cleanup - remove all listeners when leaving room
    cleanupFirebaseListeners({
        cleanupRoom: true,
        cleanupConnected: true,
        cleanupOnlineUsers: true,
        cleanupInvitation: true,
        cleanupRoomsList: true,
        cleanupLeaderboard: true,
        cleanupHistory: true,
        cleanupWorldChat: true,
        roomId: rid
    });

    // Hủy tất cả offline cleanup timers cho phòng này
    ['X', 'O'].forEach(r => {
        const k = `${rid}_${r}`;
        if (_offlineCleanupTimers[k]) { clearTimeout(_offlineCleanupTimers[k]); delete _offlineCleanupTimers[k]; }
    });

    currentRoomId     = null;
    myRole            = null;
    daXoaBanCoTranNay = false;
    _lastProcessedWinner = '';
    _dangBatDauGame   = false;
    _prevOppId = ''; _prevOppStatus = '';
    window._onlineSkinX = 'skin_default';
    window._onlineSkinO = 'skin_default';
    localStorage.removeItem('current_room_id');
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

        // ── ĐIỀU KIỆN BẮT ĐẦU (theo DO1.txt Phần 6) ──
        // Guest phải SẴN SÀNG dù có cược hay không
        if (!room.guestReady) {
            alert('Đối thủ chưa bấm SẴN SÀNG — không thể bắt đầu!');
            return;
        }
        const hasBet = room.betAmount && room.betAmount >= 100;

        const selWin   = document.getElementById('room-win-count');
        const chkChan  = document.getElementById('room-chan-2-dau');
        const selFirst = document.getElementById('room-first-turn');
        const winCount  = selWin   ? parseInt(selWin.value)  : (room.winCount  || 5);
        const chan2Dau  = chkChan  ? chkChan.checked          : (room.chan2Dau  ?? true);
        const firstTurn = selFirst ? selFirst.value           : (room.firstTurn || 'X');

        daXoaBanCoTranNay      = false;
        locallyAppliedLastMove = { row: -2, col: -2 };
        _lastProcessedWinner   = '';

        // Bắt đầu ngay — không còn trạng thái bet_confirm
        _thucSuBatDauGame(room, winCount, chan2Dau, firstTurn);
    });
}
window.chuPhongBatDauGame = chuPhongBatDauGame;

// ── GUEST: Bấm SẴN SÀNG ───────────────────────────────────────
// DO1.txt Phần 5: Guest ấn SẴN SÀNG → Firebase guestReady = true
// Host thấy, mới được phép bấm Bắt đầu
function oSanSang() {
    if (!currentRoomId || myRole !== 'O') return;
    // Kiểm tra đủ xu nếu có cược
    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) return;
        const hasBet = room.betAmount && room.betAmount >= 100;
        if (hasBet) {
            // Kiểm tra guest đủ xu
            const myId = localStorage.getItem('current_user_id');
            db.ref(`users/${myId}/coins`).once('value').then(xuSnap => {
                const xu = xuSnap.val() || 0;
                if (xu < room.betAmount) {
                    alert(`Bạn không đủ Xu! Cần ${Number(room.betAmount).toLocaleString('vi-VN')} Xu, bạn có ${Number(xu).toLocaleString('vi-VN')} Xu.`);
                    return;
                }
                _ghiGuestReady(room);
            });
        } else {
            _ghiGuestReady(room);
        }
    });
}
window.oSanSang = oSanSang;

function _ghiGuestReady(room) {
    db.ref(`rooms/${currentRoomId}`).update({ guestReady: true, updatedAt: Date.now() }).then(() => {
        thongBaoHeThong('✅ Bạn đã SẴN SÀNG — đang chờ chủ phòng bắt đầu...');
        _capNhatNutSanSang(true);
    });
}

// Hủy sẵn sàng (nếu chủ phòng đổi cược → guest cần xác nhận lại)
function oHuySanSang() {
    if (!currentRoomId || myRole !== 'O') return;
    db.ref(`rooms/${currentRoomId}`).update({ guestReady: false, updatedAt: Date.now() }).then(() => {
        thongBaoHeThong('↩️ Đã hủy SẴN SÀNG.');
        _capNhatNutSanSang(false);
    });
}
window.oHuySanSang = oHuySanSang;

// Cập nhật trạng thái nút SẴN SÀNG cục bộ
function _capNhatNutSanSang(isReady) {
    const btnReady  = document.getElementById('btn-guest-ready');
    const btnCancel = document.getElementById('btn-guest-cancel-ready');
    if (btnReady)  btnReady.style.display  = isReady ? 'none'         : 'inline-block';
    if (btnCancel) btnCancel.style.display = isReady ? 'inline-block' : 'none';
}
window._capNhatNutSanSang = _capNhatNutSanSang;

// ── HOST: Đặt cược mới (DO1.txt Phần 5) ──────────────────────
// Khi host thay đổi cược → reset guestReady
function datCuocMoi(amount) {
    if (!currentRoomId || myRole !== 'X') return Promise.resolve(false);
    const myId = localStorage.getItem('current_user_id');
    return db.ref(`users/${myId}/coins`).once('value').then(xuSnap => {
        const xu = xuSnap.val() || 0;
        if (amount > 0 && xu < amount) {
            alert(`Bạn không đủ Xu! Cần ${Number(amount).toLocaleString('vi-VN')} Xu, bạn có ${Number(xu).toLocaleString('vi-VN')} Xu.`);
            return false;
        }
        // Reset guestReady khi host đặt/đổi cược (DO1.txt Phần 7: BET_UPDATED → GUEST phải xem lại)
        return db.ref(`rooms/${currentRoomId}`).update({
            betAmount:  amount > 0 ? amount : null,
            guestReady: false,
            updatedAt:  Date.now()
        }).then(() => {
            const msg = amount > 0
                ? `💰 Đã đặt cược ${Number(amount).toLocaleString('vi-VN')} Xu — chờ đối thủ sẵn sàng`
                : '🚫 Đã hủy cược';
            thongBaoHeThong(msg);
            return true;
        });
    });
}
window.datCuocMoi = datCuocMoi;

// Hàm nội bộ: chỉ X gọi — đẩy status = playing lên Firebase
// Guard chống gọi 2 lần trong cùng 1 phiên
let _dangBatDauGame = false;
function _thucSuBatDauGame(room, winCount, chan2Dau, firstTurn) {
    if (_dangBatDauGame) return;
    _dangBatDauGame = true;
    db.ref(`rooms/${currentRoomId}`).update({
        status:           'playing',
        turn:             firstTurn,
        winCount,  chan2Dau, firstTurn,
        winner:           '',
        endReason:        '',
        moves:            { init: true },
        lastMove:         { row: -1, col: -1, by: '' },
        endedAt:          null,
        guestReady:       null,   // reset để ván sau dùng lại
        // DO7.TXT: OLD STATE MACHINE - DEPRECATED (use guestReady instead)
        playerXConfirmed: null,
        playerOConfirmed: null,
        updatedAt:        Date.now()
    }).then(() => {
        _dangBatDauGame = false;
        if (typeof batDauCuoc === 'function' && room.playerX_id && room.playerO_id) {
            batDauCuoc(currentRoomId, room.playerX_id, room.playerO_id);
        }
    }).catch(() => { _dangBatDauGame = false; });
}

// DO7.TXT: OLD STATE MACHINE - DEPRECATED (use guestReady instead)
// O chấp nhận cược → ghi playerOConfirmed = true
// X nhận qua listener, kiểm tra cả 2 cờ rồi bắt đầu
// NEW STATE MACHINE: X Bet → O Ready (guestReady) → X Start
function oChapNhanCuoc() {
    // DO7.TXT: This function is DEPRECATED - use oSanSang() instead
    console.warn('oChapNhanCuoc() is deprecated - use oSanSang() for new state machine');
    if (!currentRoomId || myRole !== 'O') return;
    db.ref(`rooms/${currentRoomId}`).update({ playerOConfirmed: true, updatedAt: Date.now() });
    const betConfirmBtns = document.getElementById('bet-confirm-btns');
    if (betConfirmBtns) betConfirmBtns.style.display = 'none';
    thongBaoHeThong('✅ Đã xác nhận cược — đang chờ bắt đầu...');
}
window.oChapNhanCuoc = oChapNhanCuoc;

// DO7.TXT: OLD STATE MACHINE - DEPRECATED
// O từ chối → xóa cược, về lại waiting, dọn cờ xác nhận
function oTuChoiCuoc() {
    // DO7.TXT: This function is DEPRECATED - use oHuySanSang() instead
    console.warn('oTuChoiCuoc() is deprecated - use oHuySanSang() for new state machine');
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

function langNgheThayDoiPhong(roomId) {
    if (roomListener) { db.ref(`rooms/${currentRoomId || roomId}`).off('value', roomListener); roomListener = null; }

    roomListener = db.ref(`rooms/${roomId}`).on('value', snap => {
        const room = snap.val();
        if (!room) return; // Phòng cố định không bao giờ null

        const myId = localStorage.getItem('current_user_id');

        // Cập nhật role theo Firebase (đảm bảo đúng)
        if (myId === room.playerX_id)      myRole = 'X';
        else if (myId === room.playerO_id) myRole = 'O';
        else if (myRole !== 'viewer')      myRole = 'viewer';

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
            setTimeout(() => {
                if (typeof fitCanvasToContainer === 'function') fitCanvasToContainer();
                if (typeof autoResizeInfCanvas  === 'function') autoResizeInfCanvas();
                // Use Shared Board Engine instead of old renderInfiniteBoard
                if (typeof SharedBoardEngine !== 'undefined') {
                    SharedBoardEngine.Renderer.updateViewport();
                    SharedBoardEngine.update();
                } else if (typeof renderInfiniteBoard === 'function') {
                    renderInfiniteBoard();
                }
            }, 50);

            // Hiển thị lượt
            const turnEl = document.getElementById('turn-indicator');
            const luat   = `${room.winCount || 5} quân${room.chan2Dau ? ' (Chặn 2 đầu)' : ''}`;
            if (currentTurn === myRole) {
                if (gameInfo) gameInfo.innerHTML = `<span style='color:#28a745;font-weight:bold;'>Lượt của bạn (${myRole})</span> — ${luat}`;
                if (turnEl)   { turnEl.textContent = `🟢 Lượt của bạn (${myRole}) — hãy đánh!`; turnEl.className = 'my-turn'; }
                if (!daThongBaoSnapshot) thongBaoHeThong('🟢 Đến lượt bạn đánh!');
            } else if (myRole === 'viewer') {
                if (turnEl) { turnEl.textContent = `👁️ Đang xem — lượt của ${currentTurn}`; turnEl.className = ''; }
                if (!daThongBaoSnapshot) thongBaoHeThong(`👁️ Đang xem — lượt của ${currentTurn}...`);
            } else {
                if (gameInfo) gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn})...</span> — ${luat}`;
                if (turnEl)   { turnEl.textContent = `⏳ Đang chờ đối thủ (${currentTurn})...`; turnEl.className = 'opponent-turn'; }
                if (!daThongBaoSnapshot) thongBaoHeThong(`⏳ Đang chờ ${oppName} đánh...`);
            }

            // Vẽ nước đi mới nhất từ đối thủ
            if (room.lastMove && room.lastMove.by && room.lastMove.by !== myRole) {
                if (room.lastMove.row !== locallyAppliedLastMove.row || room.lastMove.col !== locallyAppliedLastMove.col) {
                    locallyAppliedLastMove.row = room.lastMove.row;
                    locallyAppliedLastMove.col = room.lastMove.col;
                    thucHienVeNuocDi(room.lastMove.row, room.lastMove.col, room.lastMove.by);
                }
            }

            // Hiển thị pot cược đang diễn ra (nếu có)
            const betInfoEl = document.getElementById('bet-info-o');
            if (betInfoEl) {
                if (room.betPot && room.betPot > 0) {
                    betInfoEl.style.display = 'block';
                    betInfoEl.textContent = `🎲 Đang cược: ${Number(room.betPot).toLocaleString('vi-VN')} Xu — người thắng nhận tất!`;
                } else {
                    betInfoEl.style.display = 'none';
                }
            }
        }

        if (room.status === 'ended' || room.winner) {
            xuLyKetThucVan(room);
        }

        // ── Phòng đang CHỜ (waiting): cập nhật thanh thông báo ──
        if (room.status === 'waiting' && !room.winner && !daThongBaoSnapshot) {
            const hasBet     = !!(room.betAmount && room.betAmount >= 100);
            const guestReady = !!room.guestReady;
            const turnEl     = document.getElementById('turn-indicator');

            if (myRole === 'X') {
                if (!oppId) {
                    if (turnEl) { turnEl.textContent = '⏳ Đang chờ đối thủ vào phòng...'; turnEl.className = ''; }
                    thongBaoHeThong('⏳ Đang chờ đối thủ vào phòng...');
                } else if (!guestReady) {
                    // Chờ guest SẴN SÀNG (dù có cược hay không)
                    if (hasBet) {
                        if (turnEl) { turnEl.textContent = `🟡 Đang chờ ${oppName} SẴN SÀNG...`; turnEl.className = 'opponent-turn'; }
                        thongBaoHeThong(`🟡 Đã đặt cược — chờ ${oppName} SẴN SÀNG...`);
                    } else {
                        if (turnEl) { turnEl.textContent = `⏳ Chờ ${oppName} bấm SẴN SÀNG...`; turnEl.className = 'opponent-turn'; }
                        if (!daThongBaoSnapshot) thongBaoHeThong(`⏳ Chờ ${oppName} bấm SẴN SÀNG...`);
                    }
                } else {
                    if (turnEl) { turnEl.textContent = `🟢 ${oppName} đã SẴN SÀNG — bấm BẮT ĐẦU!`; turnEl.className = 'my-turn'; }
                    thongBaoHeThong(`🟢 ${oppName} đã SẴN SÀNG — hãy bắt đầu trận!`);
                }            } else if (myRole === 'O') {
                if (hasBet && !guestReady) {
                    if (turnEl) { turnEl.textContent = `💰 Cược ${Number(room.betAmount).toLocaleString('vi-VN')} Xu — bấm SẴN SÀNG để xác nhận`; turnEl.className = 'opponent-turn'; }
                } else if (hasBet && guestReady) {
                    if (turnEl) { turnEl.textContent = '✅ Bạn đã SẴN SÀNG — đang chờ chủ phòng bắt đầu...'; turnEl.className = ''; }
                } else if (!hasBet && !guestReady) {
                    if (turnEl) { turnEl.textContent = '⏳ Bấm SẴN SÀNG để cho phép chủ phòng bắt đầu'; turnEl.className = 'opponent-turn'; }
                } else {
                    if (turnEl) { turnEl.textContent = '✅ Đã SẴN SÀNG — đang chờ chủ phòng bắt đầu...'; turnEl.className = ''; }
                }
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
            // Reset nút SẴN SÀNG cho O
            if (myRole === 'O') _capNhatNutSanSang(false);
        }

        // Phòng bị reset về empty → tự thoát ra sảnh không cần alert
        if (room.status === 'empty' && isOnlineMode && myRole !== 'viewer') {
            _resetSauThoat(roomId);
        }

        // ── TỰ DỌN GHẾ KHI NGƯỜI CHƠI OFFLINE ──────────────────────────
        // Chỉ xử lý khi phòng không đang chơi (playing)
        if (room.status !== 'playing') {
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

    const roomNum = room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?');
    if (txtTitle) txtTitle.innerText = `Phòng ${roomNum}`;

    if (namePX) namePX.innerText = room.playerX_id ? tenSafe(room.playerX_name, 'Người chơi X') : 'Đang chờ...';
    if (namePO) namePO.innerText = room.playerO_id ? tenSafe(room.playerO_name, 'Người chơi O') : 'Chờ đối thủ...';

    const myId     = localStorage.getItem('current_user_id');
    const laChuX   = myId === room.playerX_id;
    const laKhach  = myId === room.playerO_id;
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

    // Nút Kick
    if (btnKick) btnKick.style.display = (laChuX && coDoiThu && room.status === 'waiting') ? 'inline-block' : 'none';

    // ════════════════════════════════════════════════════════
    // HỆ THỐNG CƯỢC MỚI (DO1.txt Phần 5–8)
    // State machine: NO_BET → HOST_BET_PLACED → GUEST_READY → READY_TO_START
    // ════════════════════════════════════════════════════════
    const hasBet      = !!(room.betAmount && room.betAmount >= 100);
    const guestReady  = !!room.guestReady;
    const isWaiting   = room.status === 'waiting';

    // ── PANEL CƯỢC CHO CHỦ PHÒNG (X) ──
    const betPanelX = document.getElementById('bet-panel-room');
    if (betPanelX) betPanelX.style.display = (laChuX && isWaiting) ? 'block' : 'none';

    // Trạng thái cược phía chủ phòng
    const betStatusX = document.getElementById('bet-status-host');
    if (betStatusX && laChuX && isWaiting) {
        if (!hasBet) {
            betStatusX.textContent = '';
        } else if (!guestReady) {
            betStatusX.innerHTML = `<span style="color:#f59e0b">💰 Bạn đã đặt cược: ${Number(room.betAmount).toLocaleString('vi-VN')} Xu</span><br><span style="color:#94a3b8; font-size:11px;">🟡 Đang chờ đối thủ SẴN SÀNG...</span>`;
        } else {
            betStatusX.innerHTML = `<span style="color:#10b981">💰 Cược: ${Number(room.betAmount).toLocaleString('vi-VN')} Xu</span><br><span style="color:#10b981; font-weight:bold;">🟢 Đối thủ đã SẴN SÀNG!</span>`;
        }
    }

    // ── NÚT BẮT ĐẦU (chỉ X) ──
    // Điều kiện enable: có đối thủ + (không cược HOẶC (có cược VÀ guest đã ready))
    if (btnStart && isWaiting) {
        btnStart.style.display = (laChuX && coDoiThu) ? 'inline-block' : 'none';
        const canStart = laChuX && coDoiThu && guestReady;
        btnStart.disabled = !canStart;
        btnStart.style.opacity  = canStart ? '1' : '0.5';
        btnStart.style.cursor   = canStart ? 'pointer' : 'not-allowed';
        btnStart.title = canStart ? '' : (!coDoiThu ? 'Chưa có đối thủ' : 'Đối thủ chưa SẴN SÀNG');
        btnStart.textContent = guestReady ? '▶️ BẮT ĐẦU TRẬN' : 'BẮT ĐẦU 🎮';
    } else if (btnStart) {
        btnStart.style.display = 'none';
        btnStart.disabled = false;
    }

    // ── PANEL THÔNG TIN CƯỢC CHO KHÁCH (O) ──
    const betInfoO = document.getElementById('bet-info-o');
    const betInfoText = document.getElementById('bet-info-o-text');
    const betConfirmBtns = document.getElementById('bet-confirm-btns');

    if (betInfoO) {
        if (laKhach && isWaiting) {
            betInfoO.style.display = 'block';
            if (hasBet) {
                if (betInfoText) betInfoText.innerHTML = `⚠️ Chủ phòng cược: <b>${Number(room.betAmount).toLocaleString('vi-VN')} Xu</b> — Bạn có đồng ý không?`;
            } else {
                if (betInfoText) betInfoText.textContent = 'Không có cược — bấm SẴN SÀNG để bắt đầu.';
            }
            if (betConfirmBtns) {
                betConfirmBtns.style.display = 'flex';
                _capNhatNutSanSang(guestReady);
            }
            // Thông báo sau khi sẵn sàng
            const readyMsgEl = document.getElementById('guest-ready-msg');
            if (readyMsgEl) {
                readyMsgEl.textContent = '✅ Bạn đã SẴN SÀNG — đang chờ chủ phòng bắt đầu...';
                readyMsgEl.style.display = guestReady ? 'block' : 'none';
            }
        } else if (!isWaiting) {
            betInfoO.style.display = 'none';
            if (betConfirmBtns) betConfirmBtns.style.display = 'none';
        }
    }

    // Khi đang playing: ẩn toàn bộ bet UI
    if (room.status === 'playing' || room.status === 'ended') {
        if (betInfoO) betInfoO.style.display = 'none';
        if (betPanelX) betPanelX.style.display = 'none';
    }
}

function loadPlayerInfo(userId, role) {
    db.ref('users/' + userId).once('value').then(snap => {
        const u = snap.val();
        if (!u) return;
        // DO7.TXT: winSolo renamed to winOnline (with backward compatibility fallback)
        const winOnline = u.winOnline || u.winSolo || 0;
        const loseOnline = u.loseOnline || u.loseSolo || 0;
        const rank = getRankName(u.winBot, winOnline);
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
        const skinId = u.equippedSkin || 'skin_default';
        if (role === 'X') window._onlineSkinX = skinId;
        if (role === 'O') window._onlineSkinO = skinId;

        // Re-render bàn cờ ngay để skin hiện đúng (fix race condition)
        if (typeof SharedBoardEngine !== 'undefined') {
            setTimeout(() => SharedBoardEngine.update(), 50);
        } else if (typeof renderInfiniteBoard === 'function') {
            setTimeout(renderInfiniteBoard, 50);
        }

        // Avatar đối thủ lên thanh thông báo hệ thống
        if ((myRole === 'X' || myRole === 'O') && role !== myRole) {
            const annFace = document.querySelector('#bot-avatar.online-announce .bot-face');
            if (annFace) annFace.textContent = isEmoji ? avatar : displayName[0].toUpperCase();
        }

        // Panel bên cạnh bàn cờ
        const nameEl = document.getElementById(`view-name-${role}`);
        if (nameEl) nameEl.innerText = displayName + ` (${rank})`;
        const wbEl = document.getElementById(`view-winbot-${role}`);
        if (wbEl) wbEl.innerText = u.winBot || 0;
        const wsEl = document.getElementById(`view-winsolo-${role}`);
        if (wsEl) wsEl.innerText = winOnline;
        const lsEl = document.getElementById(`view-losesolo-${role}`);
        if (lsEl) lsEl.innerText = loseOnline;

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
        if (typeof SharedBoardEngine !== 'undefined') {
            SharedBoardEngine.update();
        } else if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
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

    // Use Shared Board Engine for rendering
    if (typeof SharedBoardEngine !== 'undefined') {
        // Add move to Shared Board Engine
        SharedBoardEngine.BoardState.addMove(col, row, role);
        // DO NOT auto-center camera - let user control camera independently
        // Camera state (zoom, pan) must persist across moves
        SharedBoardEngine.update();
    } else {
        // Fallback to old system
        if (typeof infCanvasW !== 'undefined' && typeof INF_CS !== 'undefined') {
            const cols = infCanvasW / INF_CS, rows = infCanvasH / INF_CS;
            if (Math.abs((row - vRowF) - rows / 2) > rows * 0.35 || Math.abs((col - vColF) - cols / 2) > cols * 0.35) {
                vRowF = row - rows / 2; vColF = col - cols / 2;
            }
        }
        if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
    }

    if (typeof checkWin === 'function' && checkWin(row, col)) {
        if (typeof isGameActive !== 'undefined') isGameActive = false;
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
        if (!movesData) { if (callback) callback(); return; }

        // Use Shared Board Engine for board restoration
        if (typeof SharedBoardEngine !== 'undefined') {
            SharedBoardEngine.BoardState.clear();
            // DO NOT reset camera - let user control camera independently
            // Camera state (zoom, pan) must persist across reconnections
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
            // Add to Shared Board Engine
            if (typeof SharedBoardEngine !== 'undefined') {
                SharedBoardEngine.BoardState.addMove(m.col, m.row, m.by);
            }
        });

        if (list.length > 0) {
            const last = list[list.length - 1].by;
            if (typeof currentPlayer !== 'undefined') currentPlayer = last === 'X' ? 'O' : 'X';
        }
        // Use Shared Board Engine for rendering
        if (typeof SharedBoardEngine !== 'undefined') {
            SharedBoardEngine.update();
        } else if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
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
        hienUIVanMoi(msg);
    }

    // Guard chống ghi rank trùng — dùng winner + roomId + moves count (ổn định, không thay đổi sau khi ván kết thúc)
    const movesCount = room.moves ? Object.keys(room.moves).length : 0;
    const vanId = `${currentRoomId}_${room.winner}_${movesCount}`;
    if (_lastProcessedWinner === vanId) return;
    _lastProcessedWinner = vanId;

    const winnerId  = room.winner === 'X' ? room.playerX_id : room.playerO_id;
    const loserId   = room.winner === 'X' ? room.playerO_id : room.playerX_id;
    const myId      = localStorage.getItem('current_user_id');
    // Thắng thực sự = không có endReason "bỏ cuộc" (tức là thắng bằng nước cờ)
    const thangThucSu = !endReason.includes('bỏ cuộc');

    // Chỉ người thắng ghi rank — ưu tiên người thắng ghi để tránh trùng
    if (myId === winnerId) {
        // DO7.TXT: winSolo/loseSolo renamed to winOnline/loseOnline (Online PvP stats)
        // Chỉ +winOnline khi thắng bằng nước cờ thực sự
        if (thangThucSu) {
            db.ref(`users/${winnerId}/winOnline`).transaction(c => (c || 0) + 1);
            capNhatBXH(winName, winnerId);
        }
        // Thua do bỏ cuộc vẫn tính loseOnline cho người thua
        if (loserId) db.ref(`users/${loserId}/loseOnline`).transaction(c => (c || 0) + 1);
        ghiLichSu(`Phòng ${room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?')}`, xName, oName, room.winner, room.winCount || 5);

        // Xử lý cược: trao thưởng cho người thắng
        if (typeof ketThucCuoc === 'function') {
            ketThucCuoc(currentRoomId, room.winner, false);
        }
    } else if (myId === loserId) {
        // DO7.TXT: loseSolo renamed to loseOnline (Online PvP stats)
        // Người thua ghi loseOnline (phòng trường hợp người thắng offline không ghi được)
        if (winnerId) {
            // Người thắng online → họ sẽ tự ghi; ta chỉ ghi khi chắc chắn chưa được ghi
        } else {
            db.ref(`users/${loserId}/loseOnline`).transaction(c => (c || 0) + 1);
        }
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
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px;">
            <button onclick="xemLaiBanCo()" style="padding:9px 14px;background:#6c757d;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🔍 Xem lại</button>
            <button onclick="thoatPhongSauVan()" style="padding:9px 14px;background:#dc3545;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Thoát</button>
        </div>
        <p style="margin:10px 0 0;color:#888;font-size:12px;">Chờ chủ phòng bắt đầu ván mới...</p>
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
    db.ref(`rooms/${currentRoomId}`).update({
        status:    'waiting',
        winner:    '',
        endReason: '',
        moves:     { init: true },
        lastMove:  { row: -1, col: -1, by: '' },
        endedAt:   null,
        guestReady: false,   // Reset sẵn sàng để ván mới guest phải bấm lại
        updatedAt: Date.now()
    });
}
window.batDauVanMoi = batDauVanMoi;

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
    // DO7.TXT: winSolo renamed to winOnline (with backward compatibility fallback)
    leaderboardListener = db.ref('users').on('value', snap => {
        const d   = snap.val();
        const box = document.getElementById('bxh-online-container');
        if (!box) return;
        if (!d) { box.innerHTML = '<p>Chưa có xếp hạng.</p>'; return; }

        const list = Object.values(d)
            .filter(u => u && u.username)
            .map(u => ({
                name:     u.displayName || u.username,
                winOnline: u.winOnline || u.winSolo || 0,
                winBot:   u.winBot   || 0,
                loseOnline: u.loseOnline || u.loseSolo || 0,
                rank:     getRankName(u.winBot, u.winOnline || u.winSolo || 0)
            }))
            .filter(u => (u.winOnline || u.winSolo || 0) > 0 || u.winBot > 0)
            .sort((a, b) => b.winOnline - a.winOnline || b.winBot - a.winBot);

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
                <td style="padding:4px;color:green;font-weight:bold;">${u.winOnline}</td>
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

    // orderByKey: push key của Firebase đã theo thứ tự thời gian — không cần .indexOn,
    // tránh cảnh báo "Using an unspecified index" và không tải thừa dữ liệu về client
    worldChatListener = db.ref('world_chat')
        .orderByKey()
        .limitToLast(60)
        .on('child_added', snap => {
            const d = snap.val();
            if (!d) return;
            hienTinChatTheGioi(d);
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

function moCapNhatTaiKhoan() {
    const modal = document.getElementById('account-settings-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Điền thông tin hiện tại
    if (currentUserData) {
        const dn = document.getElementById('settings-display-name');
        if (dn) dn.value = currentUserData.displayName || currentUserData.username || '';

        const av = document.getElementById('settings-avatar-display');
        if (av) av.textContent = currentUserData.avatar || (currentUserData.displayName || '?')[0].toUpperCase();

        // DO7.TXT: winSolo/loseSolo renamed to winOnline/loseOnline (with backward compatibility fallback)
        const winOnline = currentUserData.winOnline || currentUserData.winSolo || 0;
        const loseOnline = currentUserData.loseOnline || currentUserData.loseSolo || 0;
        document.getElementById('st-win-bot').textContent  = currentUserData.winBot   || 0;
        document.getElementById('st-win-solo').textContent = winOnline;
        document.getElementById('st-lose-solo').textContent = loseOnline;
        document.getElementById('st-rank').textContent     = getRankName(currentUserData.winBot, winOnline);
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
    document.getElementById('avatar-picker').style.display = 'none';
}
window.dongCapNhatTaiKhoan = dongCapNhatTaiKhoan;

function moChonAvatar() {
    const picker = document.getElementById('avatar-picker');
    if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}
window.moChonAvatar = moChonAvatar;

function chonAvatar(emoji) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    db.ref(`users/${userId}`).update({ avatar: emoji }).then(() => {
        const av1 = document.getElementById('settings-avatar-display');
        if (av1) av1.textContent = emoji;
        const av2 = document.getElementById('user-avatar-display');
        if (av2) av2.textContent = emoji;
        document.getElementById('avatar-picker').style.display = 'none';
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
