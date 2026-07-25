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
let welcomeNotificationShown = false; // Flag để chỉ hiển thị thông báo chào mừng 1 lần

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
            if (data.avatar) {
                avEl.textContent = data.avatar;
                avEl.style.fontSize = '22px';
            } else {
                avEl.textContent = (data.displayName || data.username || '?')[0].toUpperCase();
                avEl.style.fontSize = '16px';
            }
        }

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
        }
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
    document.getElementById('btn-go-online').addEventListener('click', () => {
        document.getElementById('lobby-screen').style.display = 'block';
        hienDanhSachPhong();
        langNgheBangXepHangOnline();
        langNgheLichSuOnline();
        khoiDongChatTheGioi();
    });
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
            return room;
        } else if (!room.playerO_id && room.playerX_id !== myId) {
            // Ngồi ghế O
            room.playerO_id     = myId;
            room.playerO_name   = myName;
            room.playerO_status = 'online';
            room.updatedAt      = Date.now();
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

    // Hủy listener cũ của roomId này nếu có
    if (_connectedListeners[roomId]) {
        db.ref('.info/connected').off('value', _connectedListeners[roomId]);
    }
    // Khi reconnect → restore online
    _connectedListeners[roomId] = db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true && currentRoomId === roomId) {
            ref.set('online');
        }
    });
    // Giữ connectedListener trỏ đến listener hiện tại (dùng trong cleanup)
    connectedListener = _connectedListeners[roomId];
}

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

    document.getElementById('panel-playerX').style.display = 'none';
    document.getElementById('panel-playerO').style.display = 'none';

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
                        status: 'waiting', updatedAt: Date.now()
                    }).then(done);
                } else {
                    db.ref(`rooms/${rid}`).update({
                        playerX_id: '', playerX_name: '', playerX_status: 'offline',
                        status: 'empty', updatedAt: Date.now()
                    }).then(done);
                }
            } else if (role === 'O' && myId === room.playerO_id) {
                db.ref(`rooms/${rid}`).update({
                    playerO_id: '', playerO_name: '', playerO_status: 'offline', updatedAt: Date.now()
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

function _resetSauThoat(rid) {
    // Dọn listener TRƯỚC khi null currentRoomId
    if (roomListener && rid) {
        db.ref(`rooms/${rid}`).off('value', roomListener);
        roomListener = null;
    }
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

    currentRoomId     = null;
    myRole            = null;
    daXoaBanCoTranNay = false;
    _lastProcessedWinner = '';
    _prevOppId = ''; _prevOppStatus = '';
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
        // Đọc luật từ UI phòng
        const selWin   = document.getElementById('room-win-count');
        const chkChan  = document.getElementById('room-chan-2-dau');
        const selFirst = document.getElementById('room-first-turn');
        const winCount  = selWin   ? parseInt(selWin.value)  : (room.winCount  || 5);
        const chan2Dau  = chkChan  ? chkChan.checked          : (room.chan2Dau  ?? true);
        const firstTurn = selFirst ? selFirst.value           : (room.firstTurn || 'X');

        // Reset local state trước khi push để tránh xử lý nước cũ
        daXoaBanCoTranNay = false;
        locallyAppliedLastMove = { row: -2, col: -2 };
        _lastProcessedWinner = '';

        db.ref(`rooms/${currentRoomId}`).update({
            status:    'playing',
            turn:      firstTurn,
            winCount,
            chan2Dau,
            firstTurn,
            winner:    '',
            endReason: '',
            moves:     { init: true },
            lastMove:  { row: -1, col: -1, by: '' },
            endedAt:   null,
            updatedAt: Date.now()
        });
    });
}
window.chuPhongBatDauGame = chuPhongBatDauGame;

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

            document.getElementById('panel-playerX').style.display = 'flex';
            document.getElementById('panel-playerO').style.display = 'flex';

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
        }

        if (room.status === 'ended' || room.winner) {
            xuLyKetThucVan(room);
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

    // Lấy số phòng từ room.roomNumber hoặc parse từ currentRoomId (tránh hiện "?")
    const roomNum = room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?');
    if (txtTitle) txtTitle.innerText = `Phòng ${roomNum}`;
    // Có người ngồi ghế nhưng tên rỗng → fallback, tránh hiển thị sai "Đang chờ..."
    if (namePX)   namePX.innerText   = room.playerX_id ? tenSafe(room.playerX_name, 'Người chơi X') : 'Đang chờ...';
    if (namePO)   namePO.innerText   = room.playerO_id ? tenSafe(room.playerO_name, 'Người chơi O') : 'Chờ đối thủ...';

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
    if (btnStart) btnStart.style.display = showControls ? 'inline-block' : 'none';
}

function loadPlayerInfo(userId, role) {
    db.ref('users/' + userId).once('value').then(snap => {
        const u = snap.val();
        if (!u) return;
        const rank        = getRankName(u.winBot, u.winSolo);
        // Tên an toàn — tài khoản chưa đặt tên vẫn có fallback, không lọt lỗi mất tên
        const displayName = tenHienThi(u, 'Người chơi ' + role);
        const avatar      = u.avatar || displayName[0].toUpperCase();
        const isEmoji     = avatar.length <= 2 && /\p{Emoji}/u.test(avatar);

        // Avatar đối thủ lên thanh thông báo hệ thống (cạnh khung chữ, góc bàn cờ)
        if ((myRole === 'X' || myRole === 'O') && role !== myRole) {
            const annFace = document.querySelector('#bot-avatar.online-announce .bot-face');
            if (annFace) annFace.textContent = isEmoji ? avatar : '🤖';
        }

        // Panel bên cạnh bàn cờ (panel-playerX/O)
        const nameEl = document.getElementById(`view-name-${role}`);
        if (nameEl) nameEl.innerText = displayName + ` (${rank})`;
        const wbEl = document.getElementById(`view-winbot-${role}`);
        if (wbEl) wbEl.innerText = u.winBot || 0;
        const wsEl = document.getElementById(`view-winsolo-${role}`);
        if (wsEl) wsEl.innerText = u.winSolo || 0;
        const lsEl = document.getElementById(`view-losesolo-${role}`);
        if (lsEl) lsEl.innerText = u.loseSolo || 0;

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
        hienUIVanMoi(msg);
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
        // Chỉ +winSolo khi thắng bằng nước cờ thực sự
        if (thangThucSu) {
            db.ref(`users/${winnerId}/winSolo`).transaction(c => (c || 0) + 1);
            capNhatBXH(winName, winnerId);
        }
        // Thua do bỏ cuộc vẫn tính loseSolo cho người thua
        if (loserId) db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
        ghiLichSu(`Phòng ${room.roomNumber || (currentRoomId ? currentRoomId.replace('phong_', '') : '?')}`, xName, oName, room.winner, room.winCount || 5);
    } else if (myId === loserId && !winnerId) {
        // Fallback nếu winner không online
        db.ref(`users/${loserId}/loseSolo`).transaction(c => (c || 0) + 1);
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
const AVATAR_LIST = [
    '😀','😎','🥷','👾','🤖','🦁','🐯','🐼','🦊','🐸',
    '🐲','🦅','🔥','⚡','💎','🌟','🎯','🏆','👑','🎮',
    '🔆','💢','💫','💨','💤','🔱','💦','💥','✔','💗'
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

        document.getElementById('st-win-bot').textContent  = currentUserData.winBot   || 0;
        document.getElementById('st-win-solo').textContent = currentUserData.winSolo  || 0;
        document.getElementById('st-lose-solo').textContent= currentUserData.loseSolo || 0;
        document.getElementById('st-rank').textContent     = getRankName(currentUserData.winBot, currentUserData.winSolo);
    }

    // Build avatar picker
    const pickerGrid = document.querySelector('#avatar-picker > div');
    if (pickerGrid && pickerGrid.children.length === 0) {
        AVATAR_LIST.forEach(emoji => {
            const btn = document.createElement('button');
            btn.textContent = emoji;
            btn.style.cssText = 'font-size:22px; background:none; border:2px solid transparent; border-radius:8px; cursor:pointer; padding:4px; transition:border-color .15s;';
            btn.onmouseover = () => btn.style.borderColor = '#6366f1';
            btn.onmouseout  = () => btn.style.borderColor = 'transparent';
            btn.onclick = () => chonAvatar(emoji);
            pickerGrid.appendChild(btn);
        });
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
