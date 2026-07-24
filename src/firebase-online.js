// ══════════════════════════════════════════════════════════════════
// FIREBASE ONLINE - HỆ THỐNG 20 PHÒNG CỐ ĐỊNH
// Phòng không bao giờ bị xóa — chỉ reset trạng thái khi trống
// ══════════════════════════════════════════════════════════════════
(function() {
    const s1 = document.createElement('script');
    s1.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
    document.head.appendChild(s1);
    s1.onload = function() {
        const s2 = document.createElement('script');
        s2.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js";
        document.head.appendChild(s2);
        s2.onload = initFirebase;
    };
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

// Listeners
let roomListener        = null;
let onlineUsersListener = null;
let invitationListener  = null;
let leaderboardListener = null;
let historyListener     = null;
let connectedListener   = null;

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
}

// ══════════════════════════════════════════════════════════════════
// 🏠 KHỞI TẠO 20 PHÒNG CỐ ĐỊNH
// Chỉ tạo nếu chưa có — không bao giờ xóa phòng
// ══════════════════════════════════════════════════════════════════
function khoiTao20Phong() {
    for (let i = 1; i <= TOTAL_ROOMS; i++) {
        const roomRef = db.ref(`rooms/phong_${i}`);
        roomRef.once('value').then(snap => {
            if (!snap.exists()) {
                roomRef.set(taoDataPhongRong(i));
            } else {
                // Nếu phòng tồn tại nhưng bị kẹt ở trạng thái lạ, reset nhẹ
                const d = snap.val();
                if (!d) roomRef.set(taoDataPhongRong(i));
            }
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
        chan2Dau: false,
        winner: '',
        lastMove: { row: -1, col: -1, by: '' },
        moves: { init: true },
        updatedAt: Date.now()
    };
}

// ══════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION
// ══════════════════════════════════════════════════════════════════
function updateAuthUI(isLoggedIn) {
    const btnLogin    = document.getElementById('btn-show-login');
    const btnRegister = document.getElementById('btn-show-register');
    const userArea    = document.getElementById('user-logged-in');
    if (isLoggedIn) {
        if (btnLogin)    btnLogin.style.display    = 'none';
        if (btnRegister) btnRegister.style.display = 'none';
        if (userArea)    userArea.style.display    = 'block';
    } else {
        if (btnLogin)    btnLogin.style.display    = 'inline-block';
        if (btnRegister) btnRegister.style.display = 'inline-block';
        if (userArea)    userArea.style.display    = 'none';
    }
}

function setupAuthListeners() {
    document.getElementById('btn-close-auth').addEventListener('click', () => {
        document.getElementById('auth-container').style.display = 'none';
    });
    document.getElementById('btn-show-login').addEventListener('click', () => {
        document.getElementById('auth-title').innerText = '🔐 ĐĂNG NHẬP';
        document.getElementById('auth-container').style.display = 'block';
    });
    document.getElementById('btn-show-register').addEventListener('click', () => {
        document.getElementById('auth-title').innerText = '📝 ĐĂNG KÝ';
        document.getElementById('auth-container').style.display = 'block';
    });
    document.getElementById('btn-login').addEventListener('click', dangNhap);
    document.getElementById('btn-register').addEventListener('click', dangKy);
    document.getElementById('btn-logout').addEventListener('click', dangXuat);

    document.getElementById('btn-go-online').addEventListener('click', (e) => {
        if (!currentUsername) {
            e.preventDefault(); e.stopPropagation();
            document.getElementById('auth-title').innerText = '🔐 ĐĂNG NHẬP';
            document.getElementById('auth-container').style.display = 'block';
            alert('Vui lòng đăng nhập để chơi Online!');
        }
    });

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
        ref.set({ username, password, displayName: username, winBot: 0, winSolo: 0, loseSolo: 0, createdAt: Date.now() })
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
    // Nếu đang ngồi trong phòng, giải phóng ghế
    if (currentRoomId && myRole) roiKhoiPhong();
    currentUsername = null;
    currentUserData = null;
    localStorage.removeItem('current_username');
    localStorage.removeItem('current_user_id');
    localStorage.removeItem('current_room_id');
    updateAuthUI(false);
    setMyOnlineStatus(null);
}

function fetchUserData(userId) {
    db.ref('users/' + userId).on('value', snap => {
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
        setMyOnlineStatus('free');
        langNgheDanhSachOnline();
        langNgheLoiMoiDen();
    });
}

function updateUserStats(statType, increment = 1) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    db.ref(`users/${userId}/${statType}`).transaction(cur => (cur || 0) + increment);
}
window.updateUserStats = updateUserStats;

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
    db.ref(`invitations/${targetUid}`).set({
        fromRoomId:     currentRoomId,
        fromPlayerId:   myId,
        fromPlayerName: myName,
        timestamp:      Date.now()
    }).then(() => alert(`Đã gửi lời mời tới [${targetName}]!`));
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

        const dongY = confirm(`🎮 [${invite.fromPlayerName}] mời bạn vào phòng solo! Chấp nhận?`);
        db.ref(`invitations/${userId}`).remove();
        if (!dongY) return;

        // Vào phòng với tư cách O
        vaoPhongLaO(invite.fromRoomId);
    });
}

// ══════════════════════════════════════════════════════════════════
// 🎮 SETUP EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════
function setupEventListeners() {
    document.getElementById('btn-go-online').addEventListener('click', () => {
        document.getElementById('lobby-screen').style.display = 'block';
        hienDanhSachPhong();
        langNgheBangXepHangOnline();
        langNgheLichSuOnline();
    });
    document.getElementById('btn-close-lobby').addEventListener('click', () => {
        document.getElementById('lobby-screen').style.display = 'none';
    });
    document.getElementById('btn-quit-match').addEventListener('click', xuLyThoatPhong);
    document.getElementById('btn-leave-match').addEventListener('click', xuLyThoatPhong);

    // Nút Bắt đầu game (chỉ chủ phòng)
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) btnStart.addEventListener('click', chuPhongBatDauGame);

    // Nút kick player O
    const btnKick = document.getElementById('btn-kick-player');
    if (btnKick) btnKick.addEventListener('click', kickDoiThu);

    // Nút ready
    const btnReadyX = document.getElementById('btn-ready-X');
    if (btnReadyX) btnReadyX.addEventListener('click', () => setReady('X'));
    const btnReadyO = document.getElementById('btn-ready-O');
    if (btnReadyO) btnReadyO.addEventListener('click', () => setReady('O'));

    // beforeunload
    window.addEventListener('beforeunload', () => {
        if (currentRoomId && isOnlineMode) {
            const sf = myRole === 'X' ? 'playerX_status' : 'playerO_status';
            db.ref(`rooms/${currentRoomId}/${sf}`).set('offline');
        }
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

// ══════════════════════════════════════════════════════════════════
// 🏠 HIỆN DANH SÁCH 20 PHÒNG
// ══════════════════════════════════════════════════════════════════
function hienDanhSachPhong() {
    const container = document.getElementById('room-list');
    container.innerHTML = '<p style="color:#888;">Đang tải...</p>';

    db.ref('rooms').once('value').then(snap => {
        const rooms = snap.val();
        if (!rooms) { container.innerHTML = '<p>Không có phòng.</p>'; return; }
        container.innerHTML = '';
        const myId = localStorage.getItem('current_user_id');

        for (let i = 1; i <= TOTAL_ROOMS; i++) {
            const roomId = `phong_${i}`;
            const room   = rooms[roomId] || taoDataPhongRong(i);
            const el     = document.createElement('div');
            el.style.cssText = 'padding:10px;margin:5px 0;border:1px solid #ccc;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';

            const laTrongPhong = (myId === room.playerX_id || myId === room.playerO_id);
            let statusTxt = '', bgColor = '#f8f9fa', borderColor = '#ddd', nutHtml = '';

            if (room.status === 'empty') {
                statusTxt   = '🟢 Trống';
                nutHtml     = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
            } else if (room.status === 'waiting') {
                bgColor     = '#e8f5e9'; borderColor = '#4caf50';
                statusTxt   = '⏳ Chờ người chơi';
                const xName = room.playerX_name || '?';
                const oName = room.playerO_name || '---';
                if (laTrongPhong) {
                    nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;">Vào lại</button>`;
                } else if (!room.playerO_id) {
                    nutHtml = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Solo</button>`;
                } else {
                    nutHtml = `<span style="color:#aaa;font-size:12px;">Đầy</span>`;
                }
            } else if (room.status === 'playing') {
                bgColor     = '#fff3e0'; borderColor = '#ff9800';
                statusTxt   = '⚔️ Đang chơi';
                if (laTrongPhong) {
                    nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:#ff9800;color:white;border:none;border-radius:4px;cursor:pointer;">🔄 Vào lại</button>`;
                } else {
                    nutHtml = `<button onclick="xemPhong('${roomId}')" style="padding:6px 14px;background:#17a2b8;color:white;border:none;border-radius:4px;cursor:pointer;">👁️ Xem</button>`;
                }
            } else {
                statusTxt = '⬜ Trống';
                nutHtml   = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
            }

            el.style.backgroundColor = bgColor;
            el.style.borderColor     = borderColor;
            const xN = room.playerX_name || '---';
            const oN = room.playerO_name || '---';
            el.innerHTML = `
                <div>
                    <div style="font-weight:bold;font-size:14px;">Phòng ${i}</div>
                    <div style="font-size:12px;color:#555;margin-top:2px;">
                        🔴 ${xN} vs 🔵 ${oN} &nbsp;·&nbsp; <b>${statusTxt}</b>
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
    const myName = currentUserData ? currentUserData.displayName : currentUsername;
    const roomRef = db.ref(`rooms/${roomId}`);

    // Dùng transaction để tránh race condition 2 người cùng vào
    roomRef.transaction(room => {
        if (!room) return;
        if (room.status === 'playing') return; // Đang chơi, không được vào ghế

        if (!room.playerX_id || room.status === 'empty') {
            // Ngồi ghế X (chủ phòng)
            room.playerX_id     = myId;
            room.playerX_name   = myName;
            room.playerX_status = 'online';
            room.status         = 'waiting';
            room.updatedAt      = Date.now();
            return room;
        } else if (!room.playerO_id && room.playerX_id !== myId) {
            // Ngồi ghế O
            room.playerO_id     = myId;
            room.playerO_name   = myName;
            room.playerO_status = 'online';
            room.updatedAt      = Date.now();
            return room;
        }
        // Không còn ghế trống
        return;
    }).then(result => {
        if (!result.committed) { alert('Phòng đã đầy hoặc không thể vào!'); return; }
        const room = result.snapshot.val();
        currentRoomId = roomId;
        myRole        = room.playerX_id === myId ? 'X' : 'O';
        daXoaBanCoTranNay = false;
        localStorage.setItem('current_room_id', roomId);

        setupOnDisconnect(roomId, myRole);
        document.getElementById('lobby-screen').style.display = 'none';
        batDauGiaoDienOnline();
        langNgheThayDoiPhong(roomId);
        langNgheTinNhan(roomId);
        setMyOnlineStatus('free');
    });
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
    const myName = currentUserData ? currentUserData.displayName : currentUsername;
    const roomRef = db.ref(`rooms/${roomId}`);

    roomRef.transaction(room => {
        if (!room) return;
        if (room.playerO_id && room.playerO_id !== myId) return; // Ghế O đã có người
        if (room.playerX_id === myId) return; // Không tự đấu mình
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

// onDisconnect: chỉ set offline, không xóa phòng
function setupOnDisconnect(roomId, role) {
    const sf  = role === 'X' ? 'playerX_status' : 'playerO_status';
    const ref = db.ref(`rooms/${roomId}/${sf}`);
    ref.onDisconnect().set('offline');
    // Khi reconnect, tự restore online
    if (connectedListener) db.ref('.info/connected').off('value', connectedListener);
    connectedListener = db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true && currentRoomId === roomId) {
            ref.set('online');
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// 🎮 GIAO DIỆN PHÒNG ĐẤU
// ══════════════════════════════════════════════════════════════════
function batDauGiaoDienOnline() {
    document.body.classList.add('in-game-active');
    isOnlineMode = true;

    const onlineBanner = document.getElementById('online-status-banner');
    if (onlineBanner) onlineBanner.style.display = 'block';

    if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'none';
    if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'none';
    if (document.querySelector('.panels-wrapper')) document.querySelector('.panels-wrapper').style.display = 'none';
    if (document.getElementById('ui-btn-restart')) document.getElementById('ui-btn-restart').style.display = 'none';
    if (document.getElementById('user-logged-in')) document.getElementById('user-logged-in').style.display = 'none';
    const botAv = document.getElementById('bot-avatar');
    if (botAv) botAv.style.display = 'none';

    const gms = document.getElementById('game-match-screen');
    if (gms) gms.style.display = 'block';

    if (typeof window.xoaBanCoCu === 'function' && !daXoaBanCoTranNay) window.xoaBanCoCu();

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

    const onlineBanner = document.getElementById('online-status-banner');
    if (onlineBanner) onlineBanner.style.display = 'none';

    if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'block';
    if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'block';
    if (document.querySelector('.panels-wrapper')) document.querySelector('.panels-wrapper').style.display = 'flex';
    if (document.getElementById('ui-btn-restart')) document.getElementById('ui-btn-restart').style.display = 'block';
    if (document.getElementById('user-logged-in')) document.getElementById('user-logged-in').style.display = 'block';
    const botAv = document.getElementById('bot-avatar');
    if (botAv) botAv.style.display = 'flex';

    const gms = document.getElementById('game-match-screen');
    if (gms) gms.style.display = 'none';

    const turnEl = document.getElementById('turn-indicator');
    if (turnEl) { turnEl.textContent = '⏳ Đang chờ bắt đầu...'; turnEl.className = ''; }

    document.getElementById('panel-playerX').style.display = 'none';
    document.getElementById('panel-playerO').style.display = 'none';

    // Dọn listener
    if (roomListener && currentRoomId) {
        db.ref(`rooms/${currentRoomId}`).off('value', roomListener);
        roomListener = null;
    }
    if (connectedListener) {
        db.ref('.info/connected').off('value', connectedListener);
        connectedListener = null;
    }

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

function roiKhoiPhong() {
    if (!currentRoomId) return;
    const rid  = currentRoomId;
    const role = myRole;
    const myId = localStorage.getItem('current_user_id');

    db.ref(`rooms/${rid}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) { _resetSauThoat(rid); return; }

        if (room.status === 'playing') {
            if (role === 'viewer') { _resetSauThoat(rid); return; }
            // Người chơi thoát khi đang đánh = thua
            if (!confirm('Bạn đang đánh. Thoát sẽ bị tính THUA. Tiếp tục?')) return;
            const winner = role === 'X' ? 'O' : 'X';
            db.ref(`rooms/${rid}`).update({ status: 'ended', winner, endReason: `${role} bỏ cuộc` })
              .then(() => _resetSauThoat(rid));
        } else if (room.status === 'waiting' || room.status === 'empty') {
            if (role === 'X' && myId === room.playerX_id) {
                // Chủ phòng thoát → giải phóng ghế X, reset phòng về empty nếu không có O
                if (room.playerO_id) {
                    // Có O → O lên làm chủ (ghế X)
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: room.playerO_id, playerX_name: room.playerO_name, playerX_status: 'online',
                        playerO_id: '', playerO_name: '', playerO_status: 'offline', updatedAt: Date.now()
                    }).then(() => _resetSauThoat(rid));
                } else {
                    // Phòng trống hoàn toàn → reset về empty
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: '', playerX_name: '', playerX_status: 'offline',
                        status: 'empty', updatedAt: Date.now()
                    }).then(() => _resetSauThoat(rid));
                }
            } else if (role === 'O' && myId === room.playerO_id) {
                // Khách thoát → giải phóng ghế O
                db.ref(`rooms/${rid}`).update({
                    playerO_id: '', playerO_name: '', playerO_status: 'offline', updatedAt: Date.now()
                }).then(() => _resetSauThoat(rid));
            } else {
                _resetSauThoat(rid);
            }
        } else {
            _resetSauThoat(rid);
        }
    });
}

function _resetSauThoat(rid) {
    currentRoomId     = null;
    myRole            = null;
    daXoaBanCoTranNay = false;
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
        db.ref(`rooms/${currentRoomId}`).update({ status: 'playing', turn: 'X', updatedAt: Date.now() });
    });
}
window.chuPhongBatDauGame = chuPhongBatDauGame;

function kickDoiThu() {
    if (!currentRoomId || myRole !== 'X') return;
    if (!confirm('Đuổi người chơi này ra khỏi phòng?')) return;
    db.ref(`rooms/${currentRoomId}`).update({
        playerO_id: '', playerO_name: '', playerO_status: 'offline',
        playerO_ready: false, updatedAt: Date.now()
    });
}
window.kickDoiThu = kickDoiThu;

function setReady(role) {
    if (!currentRoomId) return;
    const myId = localStorage.getItem('current_user_id');
    db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room) return;
        const ok = (role === 'X' && myId === room.playerX_id) || (role === 'O' && myId === room.playerO_id);
        if (!ok) { alert('Không phải ghế của bạn!'); return; }
        const field = role === 'X' ? 'playerX_ready' : 'playerO_ready';
        db.ref(`rooms/${currentRoomId}/${field}`).set(!room[field]);
    });
}
window.setReady = setReady;

// ══════════════════════════════════════════════════════════════════
// 👂 LẮNG NGHE THAY ĐỔI PHÒNG (REALTIME)
// ══════════════════════════════════════════════════════════════════
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

        // Cập nhật giao diện phòng chờ
        capNhatUIPhong(room);

        currentTurn     = room.turn || 'X';
        currentRule     = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
        currentWinCount = room.winCount || 5;
        if (typeof winCount !== 'undefined') winCount = currentWinCount;

        const gameInfo = document.getElementById('game-info');

        if (room.status === 'playing') {
            // Lần đầu vào trận HOẶC ván mới bắt đầu
            if (!daXoaBanCoTranNay) {
                daXoaBanCoTranNay = true;
                if (typeof window.xoaBanCoCu === 'function') window.xoaBanCoCu();
                locallyAppliedLastMove = { row: -2, col: -2 };
                _lastProcessedWinner = '';
                // Ẩn overlay ván mới nếu còn hiện
                const old = document.getElementById('van-moi-overlay');
                if (old) old.remove();
                setMyOnlineStatus('playing');
            }

            document.getElementById('panel-playerX').style.display = 'flex';
            document.getElementById('panel-playerO').style.display = 'flex';

            // Hiển thị lượt
            const turnEl = document.getElementById('turn-indicator');
            const luat   = `${room.winCount || 5} quân${room.chan2Dau ? ' (Chặn 2 đầu)' : ''}`;
            if (currentTurn === myRole) {
                if (gameInfo) gameInfo.innerHTML = `<span style='color:#28a745;font-weight:bold;'>Lượt của bạn (${myRole})</span> — ${luat}`;
                if (turnEl)   { turnEl.textContent = `🟢 Lượt của bạn (${myRole}) — hãy đánh!`; turnEl.className = 'my-turn'; }
            } else {
                if (gameInfo) gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn})...</span> — ${luat}`;
                if (turnEl)   { turnEl.textContent = `⏳ Đang chờ đối thủ (${currentTurn})...`; turnEl.className = 'opponent-turn'; }
            }

            // Vẽ nước đi mới nhất từ đối thủ
            if (room.lastMove && room.lastMove.by && room.lastMove.by !== myRole) {
                if (room.lastMove.row !== locallyAppliedLastMove.row || room.lastMove.col !== locallyAppliedLastMove.col) {
                    locallyAppliedLastMove.row = room.lastMove.row;
                    locallyAppliedLastMove.col = room.lastMove.col;
                    thucHienVeNuocDi(room.lastMove.row, room.lastMove.col, room.lastMove.by);
                }
            }

            // Load thông tin người chơi
            if (room.playerX_id) loadPlayerInfo(room.playerX_id, 'X');
            if (room.playerO_id) loadPlayerInfo(room.playerO_id, 'O');
        }

        if (room.status === 'ended' || room.winner) {
            xuLyKetThucVan(room);
        }

        // Phòng bị reset về empty (cả 2 đã thoát)
        if (room.status === 'empty' && isOnlineMode && myRole !== 'viewer') {
            _resetSauThoat(roomId);
        }
    });
}

function capNhatUIPhong(room) {
    const txtTitle  = document.getElementById('txt-room-title');
    const namePX    = document.getElementById('name-pX');
    const namePO    = document.getElementById('name-pO');
    const statusPX  = document.getElementById('status-pX');
    const statusPO  = document.getElementById('status-pO');
    const btnStart  = document.getElementById('btn-start-game');
    const btnKick   = document.getElementById('btn-kick-player');
    const btnReadyX = document.getElementById('btn-ready-X');
    const btnReadyO = document.getElementById('btn-ready-O');
    const rdIndX    = document.getElementById('ready-indicator-X');
    const rdIndO    = document.getElementById('ready-indicator-O');

    if (txtTitle) txtTitle.innerText = `Phòng ${room.roomNumber || '?'}`;
    if (namePX)   namePX.innerText   = room.playerX_name || 'Đang chờ...';
    if (namePO)   namePO.innerText   = room.playerO_name || 'Chờ đối thủ...';

    const myId      = localStorage.getItem('current_user_id');
    const laChuX    = myId === room.playerX_id;
    const laKhachO  = myId === room.playerO_id;
    const coDoiThu  = !!room.playerO_id;
    const bothReady = room.playerX_ready && room.playerO_ready;

    if (statusPX) statusPX.innerText = room.playerX_status === 'online' ? 'Sẵn sàng' : 'Offline';
    if (statusPO) statusPO.innerText = coDoiThu ? (room.playerO_status === 'online' ? 'Sẵn sàng' : 'Offline') : 'Trống ghế';

    // LED trạng thái kết nối
    const ledX = document.getElementById('led-pX');
    const ledO = document.getElementById('led-pO');
    if (ledX) { ledX.style.background = room.playerX_status === 'online' ? '#28a745' : '#dc3545'; }
    if (ledO) { ledO.style.background = coDoiThu && room.playerO_status === 'online' ? '#28a745' : '#aaa'; }

    if (room.status === 'waiting') {
        // Nút ready
        if (btnReadyX) btnReadyX.style.display = laChuX  && !room.playerX_ready ? 'inline-block' : 'none';
        if (btnReadyO) btnReadyO.style.display = laKhachO && !room.playerO_ready ? 'inline-block' : 'none';
        if (rdIndX)    rdIndX.style.display    = laChuX  && room.playerX_ready  ? 'block' : 'none';
        if (rdIndO)    rdIndO.style.display    = laKhachO && room.playerO_ready  ? 'block' : 'none';

        // Nút Bắt đầu & Kick — chỉ chủ phòng
        if (btnKick)  btnKick.style.display  = laChuX && coDoiThu ? 'inline-block' : 'none';
        if (btnStart) btnStart.style.display = laChuX && coDoiThu ? 'inline-block' : 'none';
    } else {
        if (btnReadyX) btnReadyX.style.display = 'none';
        if (btnReadyO) btnReadyO.style.display = 'none';
        if (rdIndX)    rdIndX.style.display    = 'none';
        if (rdIndO)    rdIndO.style.display    = 'none';
        if (btnKick)   btnKick.style.display   = 'none';
        if (btnStart)  btnStart.style.display  = 'none';
    }
}

function loadPlayerInfo(userId, role) {
    db.ref('users/' + userId).once('value').then(snap => {
        const u = snap.val();
        if (!u) return;
        const rank = getRankName(u.winBot, u.winSolo);
        document.getElementById(`view-name-${role}`).innerText    = (u.displayName || u.username) + ` (${rank})`;
        document.getElementById(`view-winbot-${role}`).innerText  = u.winBot   || 0;
        document.getElementById(`view-winsolo-${role}`).innerText = u.winSolo  || 0;
        document.getElementById(`view-losesolo-${role}`).innerText= u.loseSolo || 0;
    });
}

// ══════════════════════════════════════════════════════════════════
// ♟️ GỬI NƯỚC ĐI & VẼ BÀN CỜ
// ══════════════════════════════════════════════════════════════════
window.guiNuocDiLenFirebase = function(row, col) {
    if (!isOnlineMode) return true;
    if (currentTurn !== myRole) return false;

    const nextTurn = myRole === 'X' ? 'O' : 'X';
    const roomRef  = db.ref(`rooms/${currentRoomId}`);
    const isWin    = (typeof checkWin === 'function') ? checkWin(row, col) : false;

    roomRef.transaction(data => {
        if (!data) return null;
        if (data.turn !== myRole) return null;
        if (data.status !== 'playing') return null;
        // Kiểm tra ô đã bị đánh chưa
        if (data.moves) {
            for (const k in data.moves) {
                const m = data.moves[k];
                if (m && m.row === row && m.col === col) return null;
            }
        }
        data.turn     = nextTurn;
        data.status   = isWin ? 'ended' : 'playing';
        data.winner   = isWin ? myRole  : '';
        data.lastMove = { row, col, by: myRole };
        return data;
    }).then(result => {
        if (result && result.committed) {
            db.ref(`rooms/${currentRoomId}/moves`).push({ row, col, by: myRole, timestamp: Date.now() });
        }
    }).catch(() => {});

    return true;
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

        if (typeof infiniteMap  !== 'undefined') infiniteMap.clear();
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

    const xName     = room.playerX_name || 'X';
    const oName     = room.playerO_name || 'O';
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

    // Hiện UI chọn ván mới (chỉ với người chơi thực, không phải viewer)
    if (myRole === 'X' || myRole === 'O') {
        hienUIVanMoi(msg);
    }

    // Cập nhật rank & lịch sử — chỉ 1 lần duy nhất cho mỗi ván
    // Dùng guard bằng updatedAt để tránh cả 2 client cùng ghi
    const vanId = `${currentRoomId}_${room.updatedAt || ''}`;
    if (_lastProcessedWinner === vanId) return;
    _lastProcessedWinner = vanId;

    const winnerId = room.winner === 'X' ? room.playerX_id : room.playerO_id;
    const loserId  = room.winner === 'X' ? room.playerO_id : room.playerX_id;
    const myId     = localStorage.getItem('current_user_id');

    // Chỉ người thắng hoặc thua mới ghi — ưu tiên người thắng ghi
    if (myId === winnerId) {
        db.ref(`users/${winnerId}/winSolo`).transaction(c => (c || 0) + 1);
        if (loserId) db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
        capNhatBXH(winName, winnerId);
        ghiLichSu(`Phòng ${room.roomNumber || '?'}`, xName, oName, room.winner);
    } else if (myId === loserId && !winnerId) {
        // Fallback nếu winner không online
        db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
    }
}

// ══════════════════════════════════════════════════════════════════
// 🔄 UI VÁN MỚI & CHỈNH LUẬT
// ══════════════════════════════════════════════════════════════════
function hienUIVanMoi(msg) {
    // Xóa overlay cũ nếu có
    const old = document.getElementById('van-moi-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'van-moi-overlay';
    overlay.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:white; padding:24px 32px; border-radius:12px;
        box-shadow:0 4px 24px rgba(0,0,0,0.25); z-index:99999;
        font-family:Arial; text-align:center; min-width:300px;
    `;

    // Chỉnh luật — chỉ chủ phòng (X) mới được đổi
    const isX = myRole === 'X';
    const luatHTML = isX ? `
        <div style="margin:14px 0; padding:12px; background:#f8f9fa; border-radius:8px; text-align:left;">
            <div style="font-weight:bold; margin-bottom:8px;">⚙️ Luật ván tiếp:</div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <label>Số quân thắng:</label>
                <select id="vm-win-count" style="padding:4px 8px; border-radius:4px; border:1px solid #ddd;">
                    <option value="3">3 quân</option>
                    <option value="4">4 quân</option>
                    <option value="5" selected>5 quân</option>
                    <option value="6">6 quân</option>
                    <option value="7">7 quân</option>
                </select>
                <label style="cursor:pointer;">
                    <input type="checkbox" id="vm-chan-2-dau"> Chặn 2 đầu
                </label>
            </div>
        </div>
        <button onclick="batDauVanMoi()" style="padding:10px 24px; background:#28a745; color:white; border:none; border-radius:6px; cursor:pointer; font-size:15px; font-weight:bold; margin-right:8px;">▶ Ván Mới</button>
        <button onclick="thoatPhongSauVan()" style="padding:10px 18px; background:#dc3545; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;">Thoát</button>
    ` : `
        <div style="margin:10px 0; color:#666; font-size:14px;">Chờ chủ phòng bắt đầu ván mới...</div>
        <button onclick="thoatPhongSauVan()" style="padding:10px 18px; background:#dc3545; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;">Thoát phòng</button>
    `;

    overlay.innerHTML = `
        <div style="font-size:20px; font-weight:bold; color:#333; margin-bottom:4px;">${msg}</div>
        ${luatHTML}
    `;
    document.body.appendChild(overlay);

    // Điền luật hiện tại vào form
    if (isX && currentRoomId) {
        db.ref(`rooms/${currentRoomId}`).once('value').then(snap => {
            const r = snap.val(); if (!r) return;
            const sel = document.getElementById('vm-win-count');
            const chk = document.getElementById('vm-chan-2-dau');
            if (sel) sel.value = r.winCount || 5;
            if (chk) chk.checked = !!r.chan2Dau;
        });
    }
}

function batDauVanMoi() {
    if (!currentRoomId || myRole !== 'X') return;
    const sel = document.getElementById('vm-win-count');
    const chk = document.getElementById('vm-chan-2-dau');
    const winCount  = sel ? parseInt(sel.value) : 5;
    const chan2Dau  = chk ? chk.checked : false;

    // Reset bàn cờ & trạng thái phòng
    db.ref(`rooms/${currentRoomId}`).update({
        status:   'playing',
        turn:     'X',
        winner:   '',
        endReason:'',
        winCount:  winCount,
        chan2Dau:  chan2Dau,
        moves:    { init: true },
        lastMove: { row: -1, col: -1, by: '' },
        updatedAt: Date.now()
    }).then(() => {
        const old = document.getElementById('van-moi-overlay');
        if (old) old.remove();
        // Reset bàn cờ local
        daXoaBanCoTranNay = false;
        locallyAppliedLastMove = { row: -2, col: -2 };
        _lastProcessedWinner = '';
        if (typeof window.xoaBanCoCu === 'function') window.xoaBanCoCu();
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
function guiTinNhanOnline() {
    if (!currentRoomId) return;
    const inp = document.getElementById('chat-input');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    const name = currentUserData ? currentUserData.displayName : currentUsername;
    db.ref(`rooms/${currentRoomId}/chats`).push({ sender: name, message: text, timestamp: Date.now() })
      .then(() => { inp.value = ''; });
}
window.guiTinNhanOnline = guiTinNhanOnline;

function guiQuickChat(msg) {
    if (!currentRoomId) return;
    const name = currentUserData ? currentUserData.displayName : currentUsername;
    db.ref(`rooms/${currentRoomId}/chats`).push({ sender: name, message: msg, timestamp: Date.now() });
}
window.guiQuickChat = guiQuickChat;

function toggleQuickChatMenu() {
    const m = document.getElementById('quick-chat-menu');
    if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
window.toggleQuickChatMenu = toggleQuickChatMenu;

function langNgheTinNhan(roomId) {
    db.ref(`rooms/${roomId}/chats`).on('child_added', snap => {
        const d = snap.val();
        if (!d) return;
        const box = document.getElementById('chat-messages');
        if (!box) return;
        const el = document.createElement('div');
        el.className = 'chat-message-line';
        el.innerHTML = `<strong>${d.sender}:</strong> ${d.message}`;
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
    });
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

function ghiLichSu(roomName, xName, oName, winner) {
    const time = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    db.ref('history').push().set({ roomName, playerX: xName, playerO: oName, winner, time, timestamp: Date.now() })
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
        let html = '<div style="max-height:250px;overflow-y:auto;">';
        list.slice(0, 15).forEach(m => {
            const kq = m.winner === 'X'
                ? `🏆 <span style="color:blue;font-weight:bold;">${m.playerX}</span> thắng <span style="color:red;">${m.playerO}</span>`
                : m.winner === 'O'
                ? `🏆 <span style="color:red;font-weight:bold;">${m.playerO}</span> thắng <span style="color:blue;">${m.playerX}</span>`
                : '🤝 Hòa';
            html += `<div style="padding:8px;margin-bottom:6px;border-bottom:1px dashed #eee;font-size:14px;display:flex;justify-content:space-between;">
                <div><strong>[${m.roomName}]</strong> ${kq}</div>
                <div style="color:#666;font-size:12px;">${m.time}</div>
            </div>`;
        });
        box.innerHTML = html + '</div>';
    });
}

// ══════════════════════════════════════════════════════════════════
// 🔧 EXPOSE GLOBALS
// ══════════════════════════════════════════════════════════════════
window.isOnlineModeActive = function() { return isOnlineMode; };
Object.defineProperty(window, 'myOnlineRole', { get: function() { return myRole; } });
window.boQuaDisconnect    = function() {};  // stub
