// Load Firebase SDKs tuần tự để tránh lỗi chạy trước khi tải xong
(function() {
    const script1 = document.createElement('script');
    script1.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
    document.head.appendChild(script1);

    script1.onload = function() {
        const script2 = document.createElement('script');
        script2.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js";
        document.head.appendChild(script2);
        script2.onload = initFirebase;
    };
})();

let db;
let currentRoomId = null;
let myRole = null;       
let currentTurn = 'X';    
let currentRule = 'tu_do';
let currentWinCount = 5; 
let isOnlineMode = false;
let daXoaBanCoTranNay = false; 

let currentUsername = null; 
let currentUserData = null; 

// Generate stable player ID if not exists - persists across reloads
if (!localStorage.getItem('my_player_id')) {
    const randomId = 'pl_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('my_player_id', randomId);
}
const myPlayerId = localStorage.getItem('my_player_id');

// Quản lý tất cả các listeners để dọn dẹp triệt để
let roomListener = null;
let roomsListListener = null;
let leaderboardListener = null;
let historyListener = null;
let onlineUsersListener = null;
let invitationListener = null;

function initFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyAM2qB0WixXi-QEPKEvfrpcVPbBqL7FVeU",
      authDomain: "caro-fa824.firebaseapp.com",
      databaseURL: "https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "caro-fa824",
      storageBucket: "caro-fa824.firebasedatabase.app",
      messagingSenderId: "809520185498",
      appId: "1:809520185498:web:905b110905104c81071f23",
      measurementId: "G-6L37K49VN6"
    };

    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    setupAuthListeners();
    setupEventListeners();
}

// ══════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION FUNCTIONS
// ══════════════════════════════════════════════════════════════════

function updateAuthUI(isLoggedIn) {
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnShowRegister = document.getElementById('btn-show-register');
    const userLoggedIn = document.getElementById('user-logged-in');

    if (isLoggedIn) {
        // Nếu đã đăng nhập: Ẩn 2 nút Đăng ký/Đăng nhập, Hiện khu vực tên & Đăng xuất
        if (btnShowLogin) btnShowLogin.style.display = 'none';
        if (btnShowRegister) btnShowRegister.style.display = 'none';
        if (userLoggedIn) userLoggedIn.style.display = 'block';
    } else {
        // Nếu chưa đăng nhập (hoặc Đăng xuất): Hiện lại 2 nút, Ẩn khu vực tên
        if (btnShowLogin) btnShowLogin.style.display = 'inline-block';
        if (btnShowRegister) btnShowRegister.style.display = 'inline-block';
        if (userLoggedIn) userLoggedIn.style.display = 'none';
    }
}

function setupAuthListeners() {
    const authContainer = document.getElementById('auth-container');
    const authTitle = document.getElementById('auth-title');
    
    document.getElementById('btn-close-auth').addEventListener('click', () => { authContainer.style.display = 'none'; });
    document.getElementById('btn-show-login').addEventListener('click', () => { authTitle.innerText = '🔐 ĐĂNG NHẬP'; authContainer.style.display = 'block'; });
    document.getElementById('btn-show-register').addEventListener('click', () => { authTitle.innerText = '📝 ĐĂNG KÝ'; authContainer.style.display = 'block'; });
    document.getElementById('btn-login').addEventListener('click', dangNhap);
    document.getElementById('btn-register').addEventListener('click', dangKy);
    document.getElementById('btn-logout').addEventListener('click', dangXuat);
    
    document.getElementById('btn-go-online').addEventListener('click', (e) => {
        if (!currentUsername) {
            e.preventDefault();
            e.stopPropagation();
            authTitle.innerText = '🔐 ĐĂNG NHẬP';
            authContainer.style.display = 'block';
            alert('Vui lòng đăng nhập để chơi Online!');
        }
    });
    
    // TỰ ĐỘNG ĐĂNG NHẬP KHI TẢI TRANG (Nếu trước đó đã đăng nhập)
    const savedUsername = localStorage.getItem('current_username');
    const savedUserId = localStorage.getItem('current_user_id');
    if (savedUsername && savedUserId) {
        currentUsername = savedUsername;
        fetchUserData(savedUserId);
        updateAuthUI(true); // Ẩn nút ĐK/ĐN, hiện tên người chơi
    } else {
        updateAuthUI(false); // Chưa đăng nhập thì hiện nút ĐK/ĐN
    }
}

function dangKy() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if (!username || !password) { alert('Vui lòng nhập tên đăng nhập và mật khẩu!'); return; }
    if (username.length < 3) { alert('Tên đăng nhập phải có ít nhất 3 ký tự!'); return; }
    if (password.length < 4) { alert('Mật khẩu phải có ít nhất 4 ký tự!'); return; }
    
    db.ref('users').orderByChild('username').equalTo(username).once('value').then((snapshot) => {
        if (snapshot.exists()) { alert('Tên đăng nhập đã tồn tại! Vui lòng chọn tên khác.'); return; }
        
        const newUserRef = db.ref('users').push();
        const userId = newUserRef.key;
        
        newUserRef.set({
            username: username,
            password: password, 
            displayName: username,
            winBot: 0,
            winSolo: 0,
            loseSolo: 0,
            createdAt: Date.now()
        }).then(() => {
            document.getElementById('auth-container').style.display = 'none';
            currentUsername = username;
            localStorage.setItem('current_username', username);
            fetchUserData(userId);
            updateAuthUI(true);
        }).catch((error) => { alert("Lỗi đăng ký: " + error.message); });
    });
}

function dangNhap() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if (!username || !password) { alert('Vui lòng nhập tên đăng nhập và mật khẩu!'); return; }
    
    db.ref('users').orderByChild('username').equalTo(username).once('value').then((snapshot) => {
        if (!snapshot.exists()) { alert('Tên đăng nhập không tồn tại!'); return; }
        
        const users = snapshot.val();
        const userId = Object.keys(users)[0];
        const userData = users[userId];
        
        if (userData.password !== password) { alert('Mật khẩu không đúng!'); return; }
        
        currentUsername = username;
        localStorage.setItem('current_username', username);
        localStorage.setItem('current_user_id', userId);
        
        document.getElementById('auth-container').style.display = 'none';
        fetchUserData(userId);
        updateAuthUI(true);
    }).catch((error) => { alert("Lỗi đăng nhập: " + error.message); });
}

function dangXuat() {
    currentUsername = null;
    currentUserData = null;
    localStorage.removeItem('current_username');
    localStorage.removeItem('current_user_id');
    localStorage.removeItem('current_room_id');
    
    updateAuthUI(false);
    setMyOnlineStatus(null);
}

function fetchUserData(userId) {
    db.ref('users/' + userId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentUserData = data;
            localStorage.setItem('current_user_id', userId);
            
            // Tính toán cấp bậc hiện tại
            const rankHienTai = getRankName(data.winBot, data.winSolo);
            
            document.getElementById('user-display-name').innerText = data.displayName || data.username;
            document.getElementById('my-win-bot').innerText = data.winBot || 0;
            document.getElementById('my-win-solo').innerText = data.winSolo || 0;
            document.getElementById('my-lose-solo').innerText = data.loseSolo || 0;
            
            // Hiển thị Rank ở Sảnh (Hãy đảm bảo anh đã thêm thẻ này ở HTML)
            const myRankEl = document.getElementById('my-rank');
            if (myRankEl) {
                myRankEl.innerText = rankHienTai;
                myRankEl.style.color = "#ff8c00"; // Màu cam nổi bật
                myRankEl.style.fontWeight = "bold";
            }
            
            // Kích hoạt trạng thái online khi đăng nhập thành công
            setMyOnlineStatus('free');
            langNgheDanhSachOnline();
            langNgheLoiMoiDen();
        }
    });
}

function updateUserStats(statType, increment = 1) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    db.ref(`users/${userId}/${statType}`).transaction((currentValue) => (currentValue || 0) + increment);
}
window.updateUserStats = updateUserStats;

function getRankName(winBot, winSolo) {
    const totalWin = (winBot || 0) + (winSolo || 0);
    
    if (totalWin >= 500) return "👑 Đại Cao Thủ";
    if (totalWin >= 200) return "⚔️ Cao Thủ";
    if (totalWin >= 100) return "💎 Kim Cương";
    if (totalWin >= 50)  return "🥇 Vàng";
    if (totalWin >= 25)  return "🥈 Bạc";
    if (totalWin >= 10)  return "🥉 Đồng";
    return "🐣 Học Chơi";
}

function setMyOnlineStatus(statusState) { // statusState có thể là: 'free' (rảnh), 'playing' (đang đánh), hoặc null (offline)
    const userId = localStorage.getItem('current_user_id');
    if (!userId || !db) return;

    const userStatusRef = db.ref(`online_users/${userId}`);
    if (statusState === null) {
        userStatusRef.remove();
    } else {
        userStatusRef.set({
            username: currentUsername,
            displayName: (currentUserData && currentUserData.displayName) ? currentUserData.displayName : currentUsername,
            status: statusState,
            lastActive: Date.now()
        });
        // Tự động xóa tên khỏi danh sách online nếu mất mạng hoặc tắt tab
        userStatusRef.onDisconnect().remove();
    }
}

function langNgheDanhSachOnline() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;

    if (onlineUsersListener) db.ref('online_users').off('value', onlineUsersListener);

    onlineUsersListener = db.ref('online_users').on('value', (snapshot) => {
        const users = snapshot.val();
        const dsOnlineDiv = document.getElementById('danh-sach-online'); // Anh nhớ tạo div này ở HTML nhé
        if (!dsOnlineDiv) return;

        dsOnlineDiv.innerHTML = "";
        if (!users) {
            dsOnlineDiv.innerHTML = "<p style='color:#888; font-size:13px;'>Không có ai trực tuyến.</p>";
            return;
        }

        let count = 0;
        for (let onlineUserId in users) {
            // Không tự hiện chính mình trong danh sách mời
            if (onlineUserId === userId) continue; 

            const user = users[onlineUserId];
            const userEl = document.createElement('div');
            userEl.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:6px; border-bottom:1px solid #eee; font-size:14px;";

            // Kiểm tra trạng thái rảnh hay đang bận
            let isFree = user.status === 'free';
            let statusDot = isFree ? '🟢 Rảnh' : '🔴 Đang chơi';
            
            // Chỉ hiện nút mời khi mình đang ở trong phòng (có currentRoomId) và đối thủ đang rảnh
            let nutMoiHtml = '';
            if (currentRoomId && isFree) {
                nutMoiHtml = `<button class="btn-invite" data-uid="${onlineUserId}" style="padding:4px 8px; background:#007bff; color:white; border:none; border-radius:3px; cursor:pointer; font-size:12px;">Mời</button>`;
            } else if (!isFree) {
                nutMoiHtml = `<span style="color:#aaa; font-size:12px;">Bận</span>`;
            } else {
                nutMoiHtml = `<span style="color:#666; font-size:12px;">Chờ tạo phòng</span>`;
            }

            userEl.innerHTML = `
                <div><strong>${user.displayName}</strong> <small style="color:${isFree?'green':'red'}; text-margin-left:5px;">(${statusDot})</small></div>
                <div>${nutMoiHtml}</div>
            `;
            dsOnlineDiv.appendChild(userEl);
            count++;
        }

        if (count === 0) {
            dsOnlineDiv.innerHTML = "<p style='color:#888; font-size:13px;'>Không có ai trực tuyến.</p>";
        }

        // Bắt sự kiện click nút Mời
        document.querySelectorAll('.btn-invite').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetUid = e.target.getAttribute('data-uid');
                guiLoiMoiChoi(targetUid);
            });
        });
    });
}

// Hàm gửi lệnh mời lên Firebase của người nhận
function guiLoiMoiChoi(targetUid) {
    // Hàm này đã được thay thế bởi guiLoiMoiThachDau()
    // Giữ lại để tương thích ngược nếu có code cũ gọi
    guiLoiMoiThachDau(targetUid, "");
}

function langNgheLoiMoiDen() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;

    if (invitationListener) db.ref(`invitations/${userId}`).off('value', invitationListener);

    invitationListener = db.ref(`invitations/${userId}`).on('value', (snapshot) => {
        const invite = snapshot.val();
        if (!invite) return;

        // Bỏ qua lời mời quá cũ (hơn 30 giây)
        if (Date.now() - invite.timestamp > 30000) {
            db.ref(`invitations/${userId}`).remove();
            return;
        }

        // Hiện xác nhận mời chơi
        const dongY = confirm(`Kỳ thủ [${invite.fromPlayerName}] mời bạn vào solo giao lưu! Bạn có đồng ý không?`);
        
        if (dongY) {
            const roomId = invite.fromRoomId;
            // Xóa lời mời trước để tránh lặp popup
            db.ref(`invitations/${userId}`).remove();
            
            // Tiến hành vào phòng trực tiếp và kích hoạt đầy đủ tiến trình game
            currentRoomId = roomId;
            const roomRef = db.ref(`rooms/${roomId}`);
            
            roomRef.once('value').then((roomSnap) => {
                const room = roomSnap.val();
                if (!room) { alert("Phòng không tồn tại hoặc đã bị hủy!"); return; }

                const playerName = currentUserData ? currentUserData.displayName : currentUsername;
                
                // Gán vai trò là O vì người mời mặc định là X
                myRole = 'O'; 
                localStorage.setItem('current_room_id', roomId);
                
                // Cập nhật thông tin Player O vào phòng - dùng userId để đảm bảo consistency
                roomRef.update({ 
                    playerO: userId, 
                    playerO_id: userId,
                    playerO_name: playerName,
                    status: "waiting",  // Giữ waiting để chờ cả 2 ready
                    playerO_status: 'online',
                    playerO_ready: false  // O chưa ready
                }).then(() => {
                    daXoaBanCoTranNay = true; // Ván mới hoàn toàn, không replay
                    if (typeof startOnlineMatch === 'function') startOnlineMatch();
                    listenToRoomChanges(roomId);
                    langNgheTinNhanChat(roomId);
                    db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                    setMyOnlineStatus('playing');
                });
            });
        } else {
            // Từ chối thì xóa lời mời đi
            db.ref(`invitations/${userId}`).remove();
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// 🎮 EVENT LISTENERS & GAME LOGIC ONLINE
// ══════════════════════════════════════════════════════════════════
function setupEventListeners() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const lobbySetupArea = document.getElementById('lobby-setup-area');
    const lobbyWaitingArea = document.getElementById('lobby-waiting-area');
    const waitingRoomInfo = document.getElementById('waiting-room-info');
    const roomListDiv = document.getElementById('room-list');
    const gameInfo = document.getElementById('game-info');
    const onlineBanner = document.getElementById('online-status-banner');

    document.getElementById('btn-go-online').addEventListener('click', () => { lobbyScreen.style.display = "block"; });
    document.getElementById('btn-close-lobby').addEventListener('click', () => { lobbyScreen.style.display = "none"; });

    function startOnlineMatch() {
        // Kích hoạt class khóa cuộn trang trên điện thoại
        document.body.classList.add('in-game-active');
        
        // Thêm listener chặn sự kiện cuộn màn hình ngoài ý muốn trên mobile
        document.addEventListener('touchmove', preventMobileScroll, { passive: false });
        
        isOnlineMode = true;
        lobbyScreen.style.display = "none";
        
        // ══════════════════════════════════════════════════════════════════
        // 🖥️ TỐI ƯU GIAO DIỆN: ẨN MỌI THỨ THỪA THÃI KHI VÀO TRẬN ĐẤU
        // ══════════════════════════════════════════════════════════════════
        if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'none';
        if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'none';
        if (document.querySelector('.panels-wrapper')) document.querySelector('.panels-wrapper').style.display = 'none';
        if (document.getElementById('ui-btn-restart')) document.getElementById('ui-btn-restart').style.display = 'none';
        if (document.getElementById('user-logged-in')) document.getElementById('user-logged-in').style.display = 'none';
        if (document.querySelector('div[style*="Phím tắt:"]')) document.querySelector('div[style*="Phím tắt:"]').style.display = 'none';
        // ════════════════════════════════════════════════════════════════════
        // Ẩn bot avatar khi vào phòng online
        const botAvatar = document.getElementById('bot-avatar');
        if (botAvatar) botAvatar.style.display = 'none';
        // ══════════════════════════════════════════════════════════════════

        // Hiện giao diện phòng đấu chuyên nghiệp
        const gameMatchScreen = document.getElementById('game-match-screen');
        if (gameMatchScreen) gameMatchScreen.style.display = "block";
        
        onlineBanner.style.display = "block";   
        if (typeof window.xoaBanCoCu === "function") window.xoaBanCoCu(); 
        const khuVucBot = document.getElementById('ui-config-panel');
        if (khuVucBot) khuVucBot.style.pointerEvents = "none"; 
        
        // Cập nhật trạng thái online thành "playing" khi vào trận
        setMyOnlineStatus('playing');
        
        // Bổ sung popstate history prevention cho mobile back button
        window.history.pushState(null, null, window.location.href);
        window.onpopstate = function() {
            if (document.body.classList.contains('in-game-active')) {
                window.history.pushState(null, null, window.location.href);
                
                if (myRole === 'viewer') {
                    if (confirm("Bạn muốn thoát giao diện Xem trực tiếp để về Sảnh?")) {
                        thoatCheDoOnline();
                    }
                } else {
                    if (confirm("Bạn đang trong trận đấu! Bạn có chắc chắn muốn bỏ cuộc và thoát ra không?")) {
                        if (typeof hangTran === 'function') {
                            hangTran();
                        } else {
                            thoatCheDoOnline();
                        }
                    }
                }
            }
        };
    }

    // Hàm bổ trợ chặn sự kiện cuộn màn hình ngoài, nhưng KHÔNG chặn cuộn bên trong bàn cờ
    function preventMobileScroll(e) {
        // Nếu điểm vuốt/cuộn nằm TRONG bàn cờ hoặc các nút chức năng của bàn cờ thì CHO PHÉP cuộn
        if (e.target.closest('.ban-co-wrapper') || 
            e.target.closest('#game-match-screen') || 
            e.target.closest('canvas')) {
            return; // Không chặn, cho cuộn bình thường
        }
        
        // Ngược lại, nếu vuốt ra vùng nền ngoài thì mới chặn không cho cuộn màn hình
        e.preventDefault();
    }

    document.getElementById('btn-quit-match').addEventListener('click', () => {
        if (!currentRoomId) { thoatCheDoOnline(); return; }

        // Nếu đang chờ (chưa bắt đầu) thì thoát không tính thua
        db.ref(`rooms/${currentRoomId}`).once('value').then((snap) => {
            const room = snap.val();
            if (!room) { thoatCheDoOnline(); return; }

            if (room.status === 'waiting') {
                // Chưa đánh — thoát tự do, không tính thua/thắng
                thoatPhongDau();
            } else if (room.status === 'playing') {
                if (!confirm("Bạn đang trong ván đấu. Thoát sẽ bị tính THUA. Tiếp tục?")) return;
                // Người bỏ cuộc thua, người kia thắng
                const winner = myRole === 'X' ? 'O' : 'X';
                db.ref(`rooms/${currentRoomId}`).update({
                    status: "ended",
                    winner: winner,
                    endReason: `${myRole} bỏ cuộc`
                }).then(() => thoatCheDoOnline());
            } else {
                // Đã kết thúc rồi thì thoát thẳng
                thoatCheDoOnline();
            }
        });
    });

    function thoatCheDoOnline() {
        document.body.classList.remove('in-game-active');
        document.removeEventListener('touchmove', preventMobileScroll);
        window.onpopstate = null;
        
        isOnlineMode = false;
        const roomIdThoat = currentRoomId; // Lưu lại trước khi null
        currentRoomId = null;
        myRole = null;
        daXoaBanCoTranNay = false;
        localStorage.removeItem('current_room_id');
        onlineBanner.style.display = "none";
        
        if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'block';
        if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'block';
        if (document.querySelector('.panels-wrapper')) document.querySelector('.panels-wrapper').style.display = 'flex';
        if (document.getElementById('ui-btn-restart')) document.getElementById('ui-btn-restart').style.display = 'block';
        if (document.getElementById('user-logged-in')) document.getElementById('user-logged-in').style.display = 'block';
        if (document.querySelector('div[style*="Phím tắt:"]')) document.querySelector('div[style*="Phím tắt:"]').style.display = 'block';
        const botAvatarRestore = document.getElementById('bot-avatar');
        if (botAvatarRestore) botAvatarRestore.style.display = 'flex';

        const gameMatchScreen = document.getElementById('game-match-screen');
        if (gameMatchScreen) gameMatchScreen.style.display = "none";
        
        const turnEl = document.getElementById('turn-indicator');
        if (turnEl) { turnEl.textContent = '⏳ Đang chờ bắt đầu...'; turnEl.className = ''; }
        
        document.getElementById('panel-playerX').style.display = 'none';
        document.getElementById('panel-playerO').style.display = 'none';

        const khuVucBot = document.getElementById('ui-config-panel');
        if (khuVucBot) khuVucBot.style.pointerEvents = "auto";

        setMyOnlineStatus('free');
        cleanupFirebaseListeners(roomIdThoat);

        if (typeof initGame === 'function') initGame();
    }

    function cleanupFirebaseListeners(roomId) {
        const rid = roomId || currentRoomId;
        if (roomListener && rid) {
            db.ref(`rooms/${rid}`).off('value', roomListener);
            roomListener = null;
        }
        if (roomsListListener) {
            db.ref('rooms').off('value', roomsListListener);
            roomsListListener = null;
        }
        if (leaderboardListener) {
            db.ref('leaderboard').off('value', leaderboardListener);
            leaderboardListener = null;
        }
        if (historyListener) {
            db.ref('history').off('value', historyListener);
            historyListener = null;
        }
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
    }

    window.addEventListener('beforeunload', () => {
        if (currentRoomId && isOnlineMode) {
            const statusField = myRole === 'X' ? 'playerX_status' : 'playerO_status';
            // Chỉ đánh dấu offline, KHÔNG kết thúc ván — để người kia có thể chờ reconnect
            navigator.sendBeacon && navigator.sendBeacon('/dev/null'); // flush
            db.ref(`rooms/${currentRoomId}/${statusField}`).set('offline');
            // Nếu sau 60 giây không reconnect, Firebase onDisconnect sẽ xử lý
        }
        cleanupFirebaseListeners(currentRoomId);
    });

    document.getElementById('btn-create').addEventListener('click', () => {
        const userId = localStorage.getItem('current_user_id') || myPlayerId;
        const playerName = currentUserData ? currentUserData.displayName : currentUsername;
        
        if (!userId) {
            alert("Vui lòng đăng nhập để tạo phòng!");
            return;
        }

        // 1. Đọc cấu hình từ giao diện UI
        const inputRoomName = document.getElementById('room-name');
        const tenPhong = inputRoomName ? inputRoomName.value.trim() : `Phòng của ${playerName}`;
        
        const winCountSelect = document.getElementById('game-win-count');
        const soQuanThang = winCountSelect ? parseInt(winCountSelect.value) : 5;
        
        const checkboxChan2Dau = document.getElementById('game-chan-2-dau');
        const laChan2Dau = checkboxChan2Dau ? checkboxChan2Dau.checked : false;

        // 2. Tạo node phòng mới trên Firebase
        const newRoomRef = db.ref('rooms').push();
        const roomId = newRoomRef.key;

        const dataPhong = {
            id: roomId,
            name: tenPhong,
            status: "waiting",           // Trạng thái: Chờ đối thủ vào
            turn: "X",                  // X đi trước
            winCount: soQuanThang,       // Lưu số quân thắng để tính Rank sau này
            chan2Dau: laChan2Dau,        // Lưu luật chặn 2 đầu
            
            // 🪑 Ghế X: Khóa chặt cho người tạo phòng - dùng userId để đảm bảo consistency
            playerX: userId,
            playerX_id: userId,
            playerX_name: playerName,
            playerX_status: "online",
            playerX_ready: false,       // Trạng thái sẵn sàng của player X
            
            // Ghế O: Để trống chờ người vào hoặc được mời
            playerO: "",
            playerO_id: "",
            playerO_name: "",
            playerO_status: "offline",
            playerO_ready: false,       // Trạng thái sẵn sàng của player O
            
            winner: "",
            lastMove: { row: -1, col: -1, by: "" },
            moves: { init: true }, 
            isBotHidden: true,
            createdAt: Date.now()
        };

        newRoomRef.set(dataPhong).then(() => {
            currentRoomId = roomId;
            myRole = 'X';
            currentRule = laChan2Dau ? 'chan_2_dau' : 'tu_do'; 
            currentWinCount = soQuanThang; 
            daXoaBanCoTranNay = false; // Phòng mới, chưa bắt đầu game
            localStorage.setItem('current_room_id', roomId);

            // KHÔNG dùng onDisconnect().remove() — tránh xóa phòng khi mất mạng tạm thời
            // Thay vào đó chỉ đánh dấu playerX offline để hệ thống tự dọn dẹp sau
            db.ref(`rooms/${roomId}/playerX_status`).onDisconnect().set('offline');
            setMyOnlineStatus('free');
            
            // Chuyển giao diện vào phòng đấu
            document.getElementById('lobby-screen').style.display = 'none';
            startOnlineMatch();
            const gameMatchScreen = document.getElementById('game-match-screen');
            if (gameMatchScreen) gameMatchScreen.style.display = 'block';
            
            langNgheDuLieuTrongPhong(roomId);
            langNgheNguoiOnlineDeMoi();
            langNgheTinNhanChat(roomId);
        }).catch((error) => {
            alert("Lỗi tạo phòng: " + error.message);
        });
    });

    document.getElementById('btn-cancel-room').addEventListener('click', () => {
        thoatPhongDau();
    });

    function xoaPhongMaTuDong(allRooms) {
        const now = Date.now();
        Object.keys(allRooms).forEach(roomId => {
            const room = allRooms[roomId];
            // Xóa phòng không có chủ phòng
            if (!room.playerX_id || !room.playerX) {
                db.ref(`rooms/${roomId}`).remove();
                return;
            }
            // Xóa phòng đã kết thúc quá 5 phút
            if (room.status === 'ended' && room.createdAt && (now - room.createdAt) > 300000) {
                db.ref(`rooms/${roomId}`).remove();
                return;
            }
            // Xóa phòng timeout (cả 2 offline lâu)
            if (room.deleteTimeoutTimestamp && now > room.deleteTimeoutTimestamp) {
                db.ref(`rooms/${roomId}`).remove();
                return;
            }
            // Xóa phòng chờ mà chủ đã offline TRÊN 2 PHÚT (tránh xóa khi mới reload/mất mạng tạm)
            if (room.status === 'waiting' && room.playerX_status === 'offline') {
                const taoPhong = room.createdAt || 0;
                if ((now - taoPhong) > 120000) {
                    db.ref(`rooms/${roomId}`).remove();
                }
            }
            // KHÔNG xóa phòng đang chơi dở dù playerO offline tạm — để họ reconnect
        });
    }

    roomsListListener = db.ref('rooms').on('value', (snapshot) => {
        const rooms = snapshot.val();
        roomListDiv.innerHTML = "";
        if (!rooms) {
            roomListDiv.innerHTML = "<p style='color:#888;'>Chưa có phòng nào. Hãy tạo phòng!</p>";
            return;
        }

        xoaPhongMaTuDong(rooms);

        let hasRoom = false;
        for (let roomId in rooms) {
            const room = rooms[roomId];

            // Không hiện phòng đã kết thúc hoặc không có chủ phòng
            if (room.status === 'ended') continue;
            if (!room.playerX_id || !room.playerX) continue;

            const roomEl = document.createElement('div');
            roomEl.style.cssText = "padding:10px; margin:5px 0; border:1px solid #ccc; border-radius:5px; display:flex; justify-content:space-between; align-items:center;";

            let txtTrangThai = "";
            let nutHanhDongHtml = "";
            const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
            const laNguoiTrongPhong = (currentUserId === room.playerX_id || currentUserId === room.playerO_id);

            if (room.status === "playing") {
                roomEl.style.backgroundColor = "#fff3e0";
                roomEl.style.borderColor = "#ff9800";
                txtTrangThai = "Đang chơi ⚔️";

                if (laNguoiTrongPhong) {
                    nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" 
                        style="padding:6px 14px; background:#ff9800; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:13px;">
                        🔄 Vào lại ghế
                    </button>`;
                } else {
                    nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" 
                        style="padding:6px 14px; background:#17a2b8; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">
                        👁️ Xem
                    </button>`;
                }
            } else if (room.playerX && room.playerO && room.status === "waiting") {
                // Chờ chủ phòng bấm bắt đầu
                roomEl.style.backgroundColor = "#e8f5e9";
                roomEl.style.borderColor = "#4caf50";
                txtTrangThai = "Chờ bắt đầu ⏳";
                if (laNguoiTrongPhong) {
                    nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" 
                        style="padding:6px 14px; background:#4caf50; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">
                        Vào lại
                    </button>`;
                }
            } else {
                // Phòng trống chờ người vào
                roomEl.style.backgroundColor = "#f8f9fa";
                roomEl.style.borderColor = "#ddd";
                txtTrangThai = "Đang chờ...";
                nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" 
                    style="padding:6px 14px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:13px;">
                    Vào Solo
                </button>`;
            }

            const xuatX = room.playerX_name || '?';
            const xuatO = room.playerO_name || '---';
            const luatText = `${room.winCount || 5} quân ${room.chan2Dau ? '· Chặn 2 đầu' : ''}`;
            roomEl.innerHTML = `
                <div>
                    <div style="font-weight:bold; font-size:14px;">${room.name}</div>
                    <div style="font-size:12px; color:#555; margin-top:2px;">
                        🔴 ${xuatX} <span style="color:#aaa;">vs</span> 🔵 ${xuatO}
                        &nbsp;·&nbsp; ${luatText}
                        &nbsp;·&nbsp; <b>[${txtTrangThai}]</b>
                    </div>
                </div>
                <div>${nutHanhDongHtml}</div>
            `;
            roomListDiv.appendChild(roomEl);
            hasRoom = true;
        }

        if (!hasRoom) roomListDiv.innerHTML = "<p style='color:#888;'>Chưa có phòng nào. Hãy tạo phòng!</p>";

        document.querySelectorAll('.btn-join').forEach(button => {
            button.addEventListener('click', (e) => { joinRoom(e.target.getAttribute('data-id')); });
        });
    }); // end roomsListListener

    /**
     * PHỤC HỒI BÀN CỜ TỪ FIREBASE KHI RECONNECT
     * Đọc toàn bộ moves đã lưu và vẽ lại lên board
     */
    function phucHoiBanCoTuFirebase(roomId, callback) {
        db.ref(`rooms/${roomId}/moves`).once('value').then((snapshot) => {
            const movesData = snapshot.val();
            if (!movesData) { if (callback) callback(); return; }

            // Xóa board trước khi vẽ lại
            if (typeof infiniteMap !== 'undefined') infiniteMap.clear();
            if (typeof moveHistory !== 'undefined') moveHistory.length = 0;
            if (typeof winningCellCoords !== 'undefined') winningCellCoords.length = 0;
            if (typeof lastMoveR !== 'undefined') { lastMoveR = null; lastMoveC = null; }

            // Sắp xếp moves theo timestamp
            const movesList = Object.values(movesData)
                .filter(m => m && m.row !== undefined && m.col !== undefined && m.by)
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            // Replay từng nước
            movesList.forEach(move => {
                if (typeof setCell === 'function') setCell(move.row, move.col, move.by);
                if (typeof moveHistory !== 'undefined') moveHistory.push({ r: move.row, c: move.col, player: move.by });
                if (typeof lastMoveR !== 'undefined') { lastMoveR = move.row; lastMoveC = move.col; }
            });

            // Set currentPlayer theo lượt cuối
            if (movesList.length > 0) {
                const lastBy = movesList[movesList.length - 1].by;
                if (typeof currentPlayer !== 'undefined') currentPlayer = lastBy === 'X' ? 'O' : 'X';
            }

            if (typeof renderInfiniteBoard === 'function') renderInfiniteBoard();
            if (typeof updateCursorByTurn === 'function') updateCursorByTurn();

            if (callback) callback();
        });
    }

    function joinRoom(roomId) {
        currentRoomId = roomId;
        const roomRef = db.ref(`rooms/${roomId}`);
        
        roomRef.once('value').then((snapshot) => {
            const room = snapshot.val();
            if (!room) { alert("Phòng không tồn tại!"); return; }

            const playerId = localStorage.getItem('current_user_id') || myPlayerId;
            const playerName = currentUserData ? currentUserData.displayName : "Cơ thủ Caro";

            // Hàm chung để reconnect vào phòng đang chơi dở
            function reconnectVaoPhong(role, statusField) {
                myRole = role;
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/${statusField}`).set('online');
                db.ref(`rooms/${roomId}/${statusField}`).onDisconnect().set('offline');
                daXoaBanCoTranNay = true; // Đánh dấu đã vào phòng, tránh xoaBanCoCu
                startOnlineMatch();
                // Nếu ván đang dở thì replay lại board
                if (room.status === 'playing') {
                    phucHoiBanCoTuFirebase(roomId, () => {
                        listenToRoomChanges(roomId);
                        langNgheTinNhanChat(roomId);
                    });
                } else {
                    listenToRoomChanges(roomId);
                    langNgheTinNhanChat(roomId);
                }
            }

            if (playerId === room.playerX_id) {
                reconnectVaoPhong('X', 'playerX_status');
            } else if (playerId === room.playerO_id) {
                reconnectVaoPhong('O', 'playerO_status');
            } else if (room.playerO && room.playerO_id) {
                // Vào xem với tư cách khán giả
                myRole = 'viewer';
                daXoaBanCoTranNay = true;
                startOnlineMatch();
                if (room.status === 'playing') {
                    phucHoiBanCoTuFirebase(roomId, () => {
                        listenToRoomChanges(roomId);
                        langNgheTinNhanChat(roomId);
                    });
                } else {
                    listenToRoomChanges(roomId);
                    langNgheTinNhanChat(roomId);
                }
            } else {
                // Ngồi ghế O mới - dùng userId để đảm bảo consistency
                myRole = 'O';
                roomRef.update({ 
                    playerO: playerId, 
                    playerO_id: playerId,
                    playerO_name: playerName,
                    status: "waiting",  // Giữ waiting để chờ cả 2 ready
                    playerO_status: 'online',
                    playerO_ready: false  // O chưa ready
                }).then(() => {
                    localStorage.setItem('current_room_id', roomId);
                    startOnlineMatch();
                    listenToRoomChanges(roomId);
                    langNgheTinNhanChat(roomId);
                    db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                });
            }
        });
    }

    // Biến lưu trữ tọa độ nước cuối cùng để so khớp tránh vẽ lặp lại
    let locallyAppliedLastMove = { row: -2, col: -2 };

    /**
     * LẲNG NGHE DỮ LIỆU PHÒNG - XỬ LÝ CÁC GHẾ, ĐUỔI & BẮT ĐẦU
     */
    function langNgheDuLieuTrongPhong(roomId) {
        if (roomListener) { db.ref(`rooms/${currentRoomId}`).off('value', roomListener); }
        
        const roomRef = db.ref(`rooms/${roomId}`);
        roomListener = roomRef.on('value', (snapshot) => {
            const room = snapshot.val();
            if (!room) {
                cuongCheVeSanh("Phòng đã bị hủy!");
                return;
            }

            const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;

            // Kiểm tra bị kick (mất ghế khi đang trong phòng)
            const laChuPhong = (currentUserId === room.playerX_id);
            const laKhach = (currentUserId === room.playerO_id);
            if (!laChuPhong && !laKhach && myRole !== 'viewer' && daXoaBanCoTranNay) {
                cuongCheVeSanh("Bạn đã bị mời ra khỏi phòng!");
                return;
            }

            document.getElementById('txt-room-title').innerText = `Phòng: ${room.name}`;
            document.getElementById('name-pX').innerText = room.playerX_name || "Đang chờ...";
            document.getElementById('name-pO').innerText = room.playerO_name || "Đang chờ đối thủ...";

            const coDoiThu = (room.playerO_id !== "");
            const bothReady = room.playerX_ready && room.playerO_ready;

            // Hiển thị nút Ready cho từng người chơi
            const btnReadyX = document.getElementById('btn-ready-X');
            const btnReadyO = document.getElementById('btn-ready-O');
            const readyIndicatorX = document.getElementById('ready-indicator-X');
            const readyIndicatorO = document.getElementById('ready-indicator-O');

            // Player X ready button
            if (laChuPhong && room.status === "waiting") {
                if (room.playerX_ready) {
                    btnReadyX.style.display = "none";
                    readyIndicatorX.style.display = "block";
                } else {
                    btnReadyX.style.display = "inline-block";
                    readyIndicatorX.style.display = "none";
                }
            } else {
                btnReadyX.style.display = "none";
                readyIndicatorX.style.display = "none";
            }

            // Player O ready button
            if (laKhach && room.status === "waiting") {
                if (room.playerO_ready) {
                    btnReadyO.style.display = "none";
                    readyIndicatorO.style.display = "block";
                } else {
                    btnReadyO.style.display = "inline-block";
                    readyIndicatorO.style.display = "none";
                }
            } else {
                btnReadyO.style.display = "none";
                readyIndicatorO.style.display = "none";
            }

            // Hiển thị quyền điều khiển cho Chủ Phòng (Player X)
            if (laChuPhong) {
                // Nếu có đối thủ vào ngồi ghế O và CẢ 2 ĐÃ READY -> Hiện nút Đuổi và nút Bắt đầu
                if (coDoiThu && room.status === "waiting" && bothReady) {
                    document.getElementById('btn-kick-player').style.display = "inline-block";
                    document.getElementById('btn-start-game').style.display = "inline-block";
                    document.getElementById('status-pO').innerText = "Đã sẵn sàng!";
                } else if (coDoiThu && room.status === "waiting") {
                    document.getElementById('btn-kick-player').style.display = "inline-block";
                    document.getElementById('btn-start-game').style.display = "none";
                    document.getElementById('status-pO').innerText = "Chờ sẵn sàng...";
                } else {
                    document.getElementById('btn-kick-player').style.display = "none";
                    document.getElementById('btn-start-game').style.display = "none";
                }
            } else {
                // Đối với khách (Player O hoặc Viewer) ẩn hết các nút quản trị này đi
                document.getElementById('btn-kick-player').style.display = "none";
                document.getElementById('btn-start-game').style.display = "none";
            }

            // Nếu trận đấu đã được bấm Bắt đầu (`status: "playing"`)
            if (room.status === "playing") {
                document.getElementById('status-pX').innerText = "Đang chiến đấu ⚔️";
                document.getElementById('status-pO').innerText = "Đang chiến đấu ⚔️";
                document.getElementById('btn-kick-player').style.display = "none";
                document.getElementById('btn-start-game').style.display = "none";
                
                // Khởi tạo bàn cờ và kích hoạt giao diện chơi - CHỈ làm 1 lần
                if (!daXoaBanCoTranNay) {
                    if (typeof window.xoaBanCoCu === "function") { window.xoaBanCoCu(); }
                    daXoaBanCoTranNay = true; 
                    
                    if (myRole === 'X') { db.ref(`rooms/${roomId}/playerX_status`).onDisconnect().set('offline'); }
                    else if (myRole === 'O') { db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline'); }
                    
                    locallyAppliedLastMove = { row: -2, col: -2 };

                    // Chỉ gọi startOnlineMatch 1 lần khi game bắt đầu
                    if (typeof startOnlineMatch === 'function') {
                        startOnlineMatch();
                    }
                }
            }
        });
    }

    /**
     * HÀM ĐUỔI ĐỐI THỦ (KICK) DÀNH CHO CHỦ PHÒNG
     */
    function kickDoiThu() {
        if (!currentRoomId) return;
        if (confirm("Bạn có chắc chắn muốn đuổi người chơi này ra khỏi phòng không?")) {
            // Reset thông tin Player O về rỗng
            db.ref(`rooms/${currentRoomId}`).update({
                playerO: "",
                playerO_id: "",
                playerO_name: "",
                playerO_status: "offline",
                status: "waiting"
            });
        }
    }

    /**
     * HÀM BẮT ĐẦU GAME DÀNH CHO CHỦ PHÒNG
     */
    function chuPhongBatDauGame() {
        if (!currentRoomId) return;
        // Chuyển trạng thái phòng sang chơi để kích hoạt bàn cờ cho cả 2 bên
        db.ref(`rooms/${currentRoomId}`).update({
            status: "playing"
        });
    }

    /**
     * HÀM SET READY - Người chơi bấm sẵn sàng
     */
    function setReady(role) {
        if (!currentRoomId) return;
        
        const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
        const roomRef = db.ref(`rooms/${currentRoomId}`);
        
        // Kiểm tra xem người chơi có đúng vai trò không
        roomRef.once('value').then((snapshot) => {
            const room = snapshot.val();
            if (!room) return;
            
            const isCorrectPlayer = (role === 'X' && currentUserId === room.playerX_id) || 
                                   (role === 'O' && currentUserId === room.playerO_id);
            
            if (!isCorrectPlayer) {
                alert('Bạn không phải là người chơi này!');
                return;
            }
            
            // Toggle ready status
            const readyField = role === 'X' ? 'playerX_ready' : 'playerO_ready';
            const currentReady = role === 'X' ? room.playerX_ready : room.playerO_ready;
            
            roomRef.update({
                [readyField]: !currentReady
            }).then(() => {
                // Nếu cả 2 đã ready, thông báo cho chủ phòng
                if (role === 'X' && !currentReady && room.playerO_ready) {
                    // X vừa ready, O đã ready trước đó
                    // Không cần làm gì, UI sẽ tự update
                } else if (role === 'O' && !currentReady && room.playerX_ready) {
                    // O vừa ready, X đã ready trước đó
                    // Không cần làm gì, UI sẽ tự update
                }
            });
        });
    }
    window.setReady = setReady;

    /**
     * LẲNG NGHE & HIỂN THỊ DANH SÁCH NGƯỜI ONLINE ĐỂ MỜI
     */
    function langNgheNguoiOnlineDeMoi() {
        db.ref('online_users').on('value', (snapshot) => {
            const users = snapshot.val();
            const listEl = document.getElementById('room-online-users-list');
            if (!listEl) return;
            
            listEl.innerHTML = "";
            
            if (!users) {
                listEl.innerHTML = `<div style="color:#aaa; text-align:center; padding-top:20px;">Không có kỳ thủ nào đang rảnh.</div>`;
                return;
            }

            const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
            let hasUser = false;

            Object.keys(users).forEach(uid => {
                // Không tự mời chính mình và chỉ mời những ai đang rảnh (`status: "free"`) ở ngoài sảnh
                if (uid !== currentUserId && users[uid].status === "free") {
                    hasUser = true;
                    const row = document.createElement('div');
                    row.className = "invite-user-row";
                    const displayN = users[uid].displayName || users[uid].name || 'Unknown';
                    row.innerHTML = `
                        <span>🟢 ${displayN}</span>
                        <button class="btn-invite-action" onclick="guiLoiMoiThachDau('${uid}', '${displayN}')">Mời Solo</button>
                    `;
                    listEl.appendChild(row);
                }
            });
            
            if (!hasUser) {
                listEl.innerHTML = `<div style="color:#aaa; text-align:center; padding-top:20px;">Không có kỳ thủ nào đang rảnh.</div>`;
            }
        });
    }

    /**
     * GỬI LỜI MỜI THÁCH ĐẤU VÀO FIREBASE
     */
    function guiLoiMoiThachDau(targetUid, targetName) {
        if (!currentRoomId) return;
        
        const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
        const myPlayerName = currentUserData ? currentUserData.displayName : currentUsername;
        
        // Đẩy thông tin mời vào nhánh invitations của người nhận
        db.ref(`invitations/${targetUid}`).set({
            fromRoomId: currentRoomId,
            fromPlayerId: currentUserId,
            fromPlayerName: myPlayerName,
            timestamp: Date.now()
        }).then(() => {
            alert(`Đã gửi lời mời thách đấu tới kỳ thủ [${targetName}]!`);
        }).catch((error) => {
            alert("Lỗi gửi lời mời: " + error.message);
        });
    }

    /**
     * HÀM CƯỠNG CHẾ QUAY VỀ SẢNH KHI THOÁT HOẶC BỊ KICK
     */
    function cuongCheVeSanh(thongBao) {
        if (thongBao) alert(thongBao);
        
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).off();
        }
        db.ref('online_users').off();
        
        isOnlineMode = false;
        currentRoomId = null;
        myRole = null;
        daXoaBanCoTranNay = false;
        localStorage.removeItem('current_room_id');

        const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
        if (currentUserId) db.ref(`online_users/${currentUserId}/status`).set("free");
        
        const gameMatchScreen = document.getElementById('game-match-screen');
        if (gameMatchScreen) gameMatchScreen.style.display = 'none';

        // Khôi phục giao diện offline
        if (document.getElementById('game-title')) document.getElementById('game-title').style.display = 'block';
        if (document.querySelector('.control-wrapper')) document.querySelector('.control-wrapper').style.display = 'block';
        const botAv = document.getElementById('bot-avatar');
        if (botAv) botAv.style.display = 'flex';

        document.getElementById('lobby-screen').style.display = 'block';
    }

    /**
     * HÀM THOÁT PHÒNG ĐẤU
     */
    function thoatPhongDau() {
        if (!currentRoomId) { cuongCheVeSanh(); return; }

        const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
        const rid = currentRoomId;

        db.ref(`rooms/${rid}`).once('value', (snapshot) => {
            const room = snapshot.val();
            if (!room) { cuongCheVeSanh(); return; }

            if (room.status === 'playing') {
                // Đang chơi → người thoát thua, phòng kết thúc
                const winner = myRole === 'X' ? 'O' : 'X';
                db.ref(`rooms/${rid}`).update({
                    status: "ended",
                    winner: winner,
                    endReason: `${myRole} bỏ cuộc`
                }).then(() => cuongCheVeSanh());
            } else if (currentUserId === room.playerX_id) {
                // Chủ phòng thoát khi chưa đánh → xóa phòng
                db.ref(`rooms/${rid}`).remove().then(() => cuongCheVeSanh());
            } else if (currentUserId === room.playerO_id) {
                // Khách thoát khi chưa đánh → giải phóng ghế O và reset ready
                db.ref(`rooms/${rid}`).update({
                    playerO: "", playerO_id: "", playerO_name: "",
                    playerO_status: "offline", playerO_ready: false, status: "waiting"
                }).then(() => cuongCheVeSanh());
            } else {
                cuongCheVeSanh();
            }
        });
    }

    /**
     * HÀM GỬI TIN NHẮN ONLINE
     */
    function guiTinNhanOnline() {
        if (!currentRoomId) return;
        
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;
        
        const noiDungText = chatInput.value.trim();
        if (!noiDungText) return;

        // Lấy tên người gửi
        const tenNguoiGui = currentUserData ? currentUserData.displayName : currentUsername;

        db.ref(`rooms/${currentRoomId}/chats`).push({
            sender: tenNguoiGui,
            message: noiDungText,
            timestamp: Date.now()
        }).then(() => {
            chatInput.value = ""; // Xóa ô nhập sau khi gửi
        }).catch((error) => {
            alert("Lỗi gửi tin nhắn: " + error.message);
        });
    }

    /**
     * LẲNG NGHE TIN NHẮN CHAT TRONG PHÒNG
     */
    function langNgheTinNhanChat(roomId) {
        db.ref(`rooms/${roomId}/chats`).on('child_added', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const khungHienThiChat = document.getElementById('chat-messages');
            if (!khungHienThiChat) return;

            // Tạo phần tử tin nhắn mới
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message-line';

            // 🌟 ĐỊNH DẠNG: Bôi đậm tên người chơi (sender) trước nội dung tin nhắn
            messageElement.innerHTML = `<strong>${data.sender}:</strong> ${data.message}`;

            // Thêm vào khung chat và tự động cuộn xuống dưới cùng
            khungHienThiChat.appendChild(messageElement);
            khungHienThiChat.scrollTop = khungHienThiChat.scrollHeight;
        });
    }

    // Hàm cập nhật giao diện phòng đấu chuyên nghiệp
    function capNhatGiaoDienPhongDau(roomData) {
        // 1. Cập nhật tên người chơi chính
        const namePX = document.getElementById('name-pX');
        const namePO = document.getElementById('name-pO');
        const statusPX = document.getElementById('status-pX');
        const statusPO = document.getElementById('status-pO');
        const roomTitle = document.getElementById('txt-room-title');

        if (namePX) namePX.innerText = roomData.playerX_name || "Đang chờ...";
        if (namePO) namePO.innerText = roomData.playerO_name || "Đang chờ...";
        
        if (statusPX) statusPX.innerText = roomData.playerX_status === 'online' ? 'Sẵn sàng' : 'Offline';
        if (statusPO) statusPO.innerText = roomData.playerO_status === 'online' ? 'Sẵn sàng' : 'Offline';
        
        if (roomTitle) {
            const xName = roomData.playerX_name || "Đang chờ...";
            const oName = roomData.playerO_name || "Đang chờ...";
            roomTitle.innerText = `Phòng: ${xName} vs ${oName}`;
        }
        
        // 2. Xử lý hiển thị danh sách Khán giả đang xem
        const viewerListEl = document.getElementById('viewer-list');
        const viewerCountEl = document.getElementById('viewer-count');
        
        if (viewerListEl && viewerCountEl) {
            viewerListEl.innerHTML = ""; // Xóa dữ liệu cũ đi để vẽ lại
            
            if (roomData.viewers) {
                const danhSachViewers = Object.values(roomData.viewers);
                viewerCountEl.innerText = danhSachViewers.length;
                
                danhSachViewers.forEach(tenViewer => {
                    const item = document.createElement('div');
                    item.style.padding = "3px 0";
                    item.innerHTML = `👁️ <span style="color:#555;">${tenViewer}</span> đang xem...`;
                    viewerListEl.appendChild(item);
                });
            } else {
                viewerCountEl.innerText = "0";
                viewerListEl.innerHTML = `<div style="color:#aaa; text-align:center; padding-top:20px;">Chưa có khán giả nào.</div>`;
            }
        }
    }

    function listenToRoomChanges(roomId) {
        if (roomListener) { db.ref(`rooms/${currentRoomId}`).off('value', roomListener); }
        
        const roomRef = db.ref(`rooms/${roomId}`);
        roomListener = roomRef.on('value', (snapshot) => {
            const room = snapshot.val();
            if (!room) return;

            // 🪑 LOGIC 2 CÁI GHẾ CỐ ĐỊNH: Xác định vai trò dựa trên ID tài khoản đang đăng nhập
            const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;
            
            if (currentUserId === room.playerX_id) {
                myRole = 'X'; // Ngồi ghế X
            } else if (currentUserId === room.playerO_id) {
                myRole = 'O'; // Ngồi ghế O
            } else {
                myRole = 'viewer'; // Ai trùng ID với 2 ghế trên thì là Khán giả
            }

            // Cập nhật giao diện phòng đấu chuyên nghiệp
            capNhatGiaoDienPhongDau(room);

            const botElement = document.getElementById('bot-avatar');
            if (botElement) { botElement.style.display = room.isBotHidden ? 'none' : 'flex'; }

            currentTurn = room.turn;
            currentRule = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
            currentWinCount = room.winCount || 5; 
            winCount = currentWinCount; 

            const xOnline = room.playerX_status === 'online';
            const oOnline = room.playerO_status === 'online';

            if (xOnline || oOnline) {
                if (room.deleteTimeoutTimestamp) { db.ref(`rooms/${room.id}/deleteTimeoutTimestamp`).remove(); }
            } else if (!xOnline && !oOnline) {
                if (!room.deleteTimeoutTimestamp) {
                    db.ref(`rooms/${room.id}/deleteTimeoutTimestamp`).set(Date.now() + 60000);
                }
            }

            if (room.status === "playing") {
                if (!daXoaBanCoTranNay) {
                    if (typeof window.xoaBanCoCu === "function") { window.xoaBanCoCu(); }
                    daXoaBanCoTranNay = true; 
                    db.ref(`rooms/${roomId}`).onDisconnect().cancel();
                    
                    if (myRole === 'X') { db.ref(`rooms/${roomId}/playerX_status`).onDisconnect().set('offline'); }
                    else if (myRole === 'O') { db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline'); }
                    
                    locallyAppliedLastMove = { row: -2, col: -2 }; // Reset tọa độ nước đi
                }

                lobbyScreen.style.display = "none";
                lobbyWaitingArea.style.display = "none";
                
                isOnlineMode = true;
                onlineBanner.style.display = "block";
                document.getElementById('panel-playerX').style.display = 'flex';
                document.getElementById('panel-playerO').style.display = 'flex';
                
                const winCountSelect = document.getElementById('win-count');
                const blockBothEndsCheckbox = document.getElementById('block-both-ends');
                if (winCountSelect) winCountSelect.value = currentWinCount;
                if (blockBothEndsCheckbox) blockBothEndsCheckbox.checked = room.chan2Dau;
                
                const displayLuat = `Đủ ${room.winCount || 5} quân ${room.chan2Dau ? '(Chặn 2 đầu)' : ''}`;
                const turnEl = document.getElementById('turn-indicator');
                if (currentTurn === myRole) {
                    gameInfo.innerHTML = `<span style='color:#28a745; font-weight:bold;'>Lượt của bạn (${myRole})</span> - Luật: ${displayLuat}`;
                    if (turnEl) { turnEl.textContent = `🟢 Lượt của bạn (${myRole}) — hãy đánh!`; turnEl.className = 'my-turn'; }
                } else {
                    gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn}) đánh...</span> - Luật: ${displayLuat}`;
                    if (turnEl) { turnEl.textContent = `⏳ Đang chờ đối thủ (${currentTurn}) đánh...`; turnEl.className = 'opponent-turn'; }
                }

                if (room.playerX_id) {
                    db.ref('users/' + room.playerX_id).once('value').then((userSnap) => {
                        const userX = userSnap.val();
                        if (userX) {
                            const rankX = getRankName(userX.winBot, userX.winSolo);
                            document.getElementById('view-name-X').innerText = (userX.displayName || userX.username) + ` (${rankX})`;
                            document.getElementById('view-winbot-X').innerText = userX.winBot || 0;
                            document.getElementById('view-winsolo-X').innerText = userX.winSolo || 0;
                            document.getElementById('view-losesolo-X').innerText = userX.loseSolo || 0;
                        } else {
                            document.getElementById('view-name-X').innerText = room.playerX_name || "Người chơi X";
                        }
                    });
                }

                if (room.playerO_id) {
                    db.ref('users/' + room.playerO_id).once('value').then((userSnap) => {
                        const userO = userSnap.val();
                        if (userO) {
                            const rankO = getRankName(userO.winBot, userO.winSolo);
                            document.getElementById('view-name-O').innerText = (userO.displayName || userO.username) + ` (${rankO})`;
                            document.getElementById('view-winbot-O').innerText = userO.winBot || 0;
                            document.getElementById('view-winsolo-O').innerText = userO.winSolo || 0;
                            document.getElementById('view-losesolo-O').innerText = userO.loseSolo || 0;
                        } else {
                            document.getElementById('view-name-O').innerText = room.playerO_name || "Người chơi O";
                        }
                    });
                } else {
                    document.getElementById('view-name-O').innerText = "Đang chờ đối thủ...";
                    document.getElementById('view-winbot-O').innerText = "0";
                    document.getElementById('view-winsolo-O').innerText = "0";
                    document.getElementById('view-losesolo-O').innerText = "0";
                }

                // 🔥 TỐI ƯU TUYỆT ĐỐI: Chỉ vẽ nước mới nhất từ đối thủ, triệt tiêu vòng lặp for vô tận!
                if (room.lastMove && room.lastMove.by && room.lastMove.by !== myRole) {
                    if (room.lastMove.row !== locallyAppliedLastMove.row || room.lastMove.col !== locallyAppliedLastMove.col) {
                        locallyAppliedLastMove.row = room.lastMove.row;
                        locallyAppliedLastMove.col = room.lastMove.col;
                        thucHienVeNuocDiDoiThu(room.lastMove.row, room.lastMove.col, room.lastMove.by);
                    }
                }
            }
            
            if (room.status === "ended" || room.winner) {
                daXoaBanCoTranNay = false;

                // Phân biệt kết thúc bình thường vs bỏ cuộc
                const endReason = room.endReason || "";
                const laBoQua = endReason.includes("bỏ cuộc");
                
                let thongBaoKetThuc = "";
                if (laBoQua) {
                    const nguoiBoQua = endReason.includes("X") ? (room.playerX_name || "X") : (room.playerO_name || "O");
                    const nguoiThang = room.winner === 'X' ? (room.playerX_name || "X") : (room.playerO_name || "O");
                    thongBaoKetThuc = `🏳️ ${nguoiBoQua} bỏ cuộc. ${nguoiThang} thắng!`;
                } else if (room.winner) {
                    const nguoiThang = room.winner === 'X' ? (room.playerX_name || "X") : (room.playerO_name || "O");
                    thongBaoKetThuc = `🏆 ${nguoiThang} thắng!`;
                } else {
                    thongBaoKetThuc = "Trận đấu kết thúc";
                }

                gameInfo.innerHTML = `<b style='color:#d9534f;'>${thongBaoKetThuc}</b>`;
                const turnEl = document.getElementById('turn-indicator');
                if (turnEl) { turnEl.textContent = thongBaoKetThuc; turnEl.className = ''; }

                // Chỉ cập nhật điểm 1 lần (winner là X hoặc O)
                if (room.winner && (room.winner === 'X' || room.winner === 'O')) {
                    const winnerName = room.winner === 'X' ? (room.playerX_name || "Người chơi X") : (room.playerO_name || "Người chơi O");
                    const loserName  = room.winner === 'X' ? (room.playerO_name || "Người chơi O") : (room.playerX_name || "Người chơi X");
                    const winnerId   = room.winner === 'X' ? room.playerX_id : room.playerO_id;
                    const loserId    = room.winner === 'X' ? room.playerO_id : room.playerX_id;

                    if (winnerName && loserName) {
                        capNhatBangXepHangOnline(winnerName);
                        ghiLichSuTranDauOnline(room.name, winnerName, loserName, room.winner);
                    }
                    if (currentWinCount >= 5) {
                        if (winnerId) db.ref(`users/${winnerId}/winSolo`).transaction(cur => (cur || 0) + 1);
                    }
                    if (loserId) db.ref(`users/${loserId}/loseSolo`).transaction(cur => (cur || 0) + 1);
                }
            }
        });
    }

    window.guiNuocDiLenFirebase = function(row, col) {
        if (!isOnlineMode) return true; 

        if (currentTurn !== myRole) {
            return false; // không phải lượt mình
        }
        
        const nextTurn = myRole === 'X' ? 'O' : 'X';
        const roomRef = db.ref(`rooms/${currentRoomId}`);
        
        // Kiểm tra thắng dựa vào board hiện tại (đã setCell trước đó trong makeMove)
        const isWin = (typeof checkWin === 'function') ? checkWin(row, col) : false;
        const winnerValue = isWin ? myRole : "";
        const statusValue = isWin ? "ended" : "playing";

        // Transaction với validation đầy đủ để tránh race condition
        roomRef.transaction((currentData) => {
            if (!currentData) return null;
            
            // 1. Kiểm tra lượt - chỉ người có lượt mới được đi
            if (currentData.turn !== myRole) return null;
            
            // 2. Kiểm tra cell đã bị chiếm chưa - tránh 2 người cùng đánh 1 ô
            // Moves được lưu dạng array với push key, cần iterate để check
            if (currentData.moves) {
                for (let moveKey in currentData.moves) {
                    const move = currentData.moves[moveKey];
                    if (move && move.row === row && move.col === col) {
                        return null; // Cell đã bị chiếm
                    }
                }
            }
            
            // 3. Kiểm tra trạng thái game - chỉ cho đi khi đang chơi
            if (currentData.status !== "playing") return null;
            
            return {
                ...currentData,
                turn: nextTurn,
                status: statusValue,
                winner: winnerValue,
                lastMove: { row: row, col: col, by: myRole }
            };
        }).then((result) => {
            if (result && result.committed) {
                // Chỉ lưu move khi transaction thành công
                db.ref(`rooms/${currentRoomId}/moves`).push({ row: row, col: col, by: myRole, timestamp: Date.now() });
            }
        }).catch(() => {});
        
        return true;
    };

    function thucHienVeNuocDiDoiThu(row, col, role) {
        if (typeof setCell === 'function') { setCell(row, col, role); }
        if (typeof moveHistory !== 'undefined') { moveHistory.push({ r: row, c: col, player: role }); }
        if (typeof lastMoveR !== 'undefined') { lastMoveR = row; lastMoveC = col; }

        // Căn giữa bàn về nước vừa đánh nếu ra ngoài viewport
        if (typeof infCanvasW !== 'undefined' && typeof INF_CS !== 'undefined') {
            const cols = infCanvasW / INF_CS, rows = infCanvasH / INF_CS;
            if (Math.abs((row - vRowF) - rows / 2) > rows * 0.35 || Math.abs((col - vColF) - cols / 2) > cols * 0.35) {
                vRowF = row - rows / 2; vColF = col - cols / 2;
            }
        }

        if (typeof renderInfiniteBoard === 'function') { renderInfiniteBoard(); }

        // Kiểm tra đối thủ có thắng không
        if (typeof checkWin === 'function' && checkWin(row, col)) {
            if (typeof isGameActive !== 'undefined') isGameActive = false;
            const winnerName = role === (window.myOnlineRole) ? 'Bạn' : 'Đối thủ';
            if (typeof statusPanel !== 'undefined') statusPanel.innerHTML = `🏆 <strong>${role}</strong> chiến thắng!`;
            setTimeout(() => {
                if (typeof showWinOverlay === 'function') showWinOverlay(role, false, '', '');
                if (typeof gameTotalTimer !== 'undefined' && gameTotalTimer) clearInterval(gameTotalTimer);
                if (typeof playerTurnTimer !== 'undefined' && playerTurnTimer) clearInterval(playerTurnTimer);
            }, 500);
            return;
        }

        // Chuyển lượt về mình
        if (typeof currentPlayer !== 'undefined') { currentPlayer = role === 'X' ? 'O' : 'X'; }
        if (typeof updateCursorByTurn === 'function') { updateCursorByTurn(); }
        if (typeof updateStatus === 'function') { updateStatus(); }
    }

    window.isOnlineModeActive = function() { return isOnlineMode; };

    Object.defineProperty(window, 'myOnlineRole', {
        get: function() { return myRole; }
    });

    function anGiaoDienVaThoaiCuaBot(shouldHide) {
        const displayStyle = shouldHide ? "none" : "block";
        const khuVucBot = document.getElementById('ui-config-panel'); 
        if (khuVucBot) khuVucBot.style.pointerEvents = shouldHide ? "none" : "auto";
        const khungThoaiBot = document.getElementById('bot-avatar'); 
        if (khungThoaiBot) khungThoaiBot.style.display = displayStyle;
    }

    function capNhatBangXepHangOnline(tenNguoiThang) {
        if (!tenNguoiThang) return;
        db.ref(`leaderboard/${tenNguoiThang}`).transaction((currentData) => {
            if (currentData === null) { return { score: 1, lastUpdated: Date.now() }; }
            currentData.score = (currentData.score || 0) + 1;
            currentData.lastUpdated = Date.now();
            return currentData;
        });
    }

    function ghiLichSuTranDauOnline(tenRoom, tenNguoiX, tenNguoiO, nguoiThang) {
        const thoiGian = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        db.ref('history').push().set({
            roomName: tenRoom,
            playerX: tenNguoiX,
            playerO: tenNguoiO,
            winner: nguoiThang, 
            time: thoiGian,
            timestamp: Date.now()
        }).then(() => { cleanupOldHistory(); });
    }

    function cleanupOldHistory() {
        db.ref('history').once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const historyArray = [];
            for (let id in data) { historyArray.push({ id, ...data[id] }); }
            historyArray.sort((a, b) => a.timestamp - b.timestamp);

            if (historyArray.length > 100) {
                const toDelete = historyArray.slice(0, historyArray.length - 100);
                toDelete.forEach(item => { db.ref(`history/${item.id}`).remove(); });
            }
        });
    }

    function langNgheBangXepHangOnline() {
        leaderboardListener = db.ref('leaderboard').on('value', (snapshot) => {
            const data = snapshot.val();
            const bxhContainer = document.getElementById('bxh-online-container');
            if (!bxhContainer) return;

            bxhContainer.innerHTML = ""; 
            if (!data) { bxhContainer.innerHTML = "<p>Chưa có xếp hạng trực tuyến.</p>"; return; }

            let danhSachXepHang = [];
            for (let name in data) { danhSachXepHang.push({ name: name, score: data[name].score || 0 }); }
            danhSachXepHang.sort((a, b) => b.score - a.score);

            let tableHtml = `<table style="width:100%; text-align:left; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #ccc;">
                                        <th>Hạng</th><th>Kỳ thủ</th><th>Số trận thắng</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            danhSachXepHang.slice(0, 10).forEach((user, index) => {
                let iconHang = index === 0 ? "🥇" : (index === 1 ? "🥈" : (index === 2 ? "🥉" : `${index + 1}`));
                tableHtml += `<tr style="border-bottom: 1px solid #eee; height: 35px;">
                                <td>${iconHang}</td>
                                <td><strong>${user.name}</strong></td>
                                <td style="color: green; font-weight: bold;">${user.score} trận</td>
                             </tr>`;
            });

            tableHtml += `</tbody></table>`;
            bxhContainer.innerHTML = tableHtml;
        });
    }
    langNgheBangXepHangOnline();

    function langNgheLichSuOnline() {
        historyListener = db.ref('history').on('value', (snapshot) => {
            const data = snapshot.val();
            const lichSuContainer = document.getElementById('lich-su-online-container');
            if (!lichSuContainer) return;

            lichSuContainer.innerHTML = ""; 
            if (!data) { lichSuContainer.innerHTML = "<p style='color: #888;'>Chưa có lịch sử trận đấu nào.</p>"; return; }

            let danhSachLichSu = [];
            for (let id in data) { danhSachLichSu.push(data[id]); }
            danhSachLichSu.sort((a, b) => b.timestamp - a.timestamp);

            let htmlLichSu = `<div style="max-height: 250px; overflow-y: auto;">`;
            danhSachLichSu.slice(0, 15).forEach((match) => {
                let thongBaoKetQua = "";
                if (match.winner === "X") { thongBaoKetQua = `🏆 <span style="color: blue; font-weight: bold;">${match.playerX}</span> thắng <span style="color: red;">${match.playerO}</span>`; }
                else if (match.winner === "O") { thongBaoKetQua = `🏆 <span style="color: red; font-weight: bold;">${match.playerO}</span> thắng <span style="color: blue;">${match.playerX}</span>`; }
                else { thongBaoKetQua = `🤝 Hai bên hòa nhau`; }

                htmlLichSu += `<div style="padding: 8px; margin-bottom: 6px; border-bottom: 1px dashed #eee; font-size: 14px; display: flex; justify-content: space-between;">
                                    <div><strong>[${match.roomName}]</strong> ${thongBaoKetQua}</div>
                                    <div style="color: #666; font-size: 12px;">${match.time}</div>
                               </div>`;
            });

            htmlLichSu += `</div>`;
            lichSuContainer.innerHTML = htmlLichSu;
        });
    }
    langNgheLichSuOnline();

    window.addEventListener('load', () => {
        const savedRoomId = localStorage.getItem('current_room_id');
        const myPlayerIdVal = localStorage.getItem('my_player_id');
        const savedUserId = localStorage.getItem('current_user_id');
        
        if (savedRoomId && (myPlayerIdVal || savedUserId)) {
            db.ref('rooms/' + savedRoomId).once('value').then((snapshot) => {
                const room = snapshot.val();
                if (!room) { localStorage.removeItem('current_room_id'); return; }

                // Ưu tiên dùng userId nếu đã đăng nhập, nếu chưa thì dùng myPlayerId
                const playerId = savedUserId || myPlayerIdVal;
                const isPlayer = (playerId === room.playerX_id || playerId === room.playerO_id);
                if (!isPlayer) { localStorage.removeItem('current_room_id'); return; }

                // Ván đã kết thúc — không reconnect
                if (room.status === 'ended') { localStorage.removeItem('current_room_id'); return; }

                currentRoomId = savedRoomId;
                myRole = (playerId === room.playerX_id) ? 'X' : 'O';
                daXoaBanCoTranNay = true; // Tránh xoaBanCoCu chạy lại trong listenToRoomChanges

                // Khôi phục trạng thái game
                currentTurn = room.turn || 'X';
                currentRule = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
                currentWinCount = room.winCount || 5;
                if (typeof winCount !== 'undefined') winCount = currentWinCount;

                const statusField = myRole === 'X' ? 'playerX_status' : 'playerO_status';
                db.ref(`rooms/${savedRoomId}/${statusField}`).set('online');
                db.ref(`rooms/${savedRoomId}/${statusField}`).onDisconnect().set('offline');

                startOnlineMatch();

                if (room.status === 'playing') {
                    // Replay bàn cờ dở rồi mới lắng nghe
                    phucHoiBanCoTuFirebase(savedRoomId, () => {
                        listenToRoomChanges(savedRoomId);
                        langNgheTinNhanChat(savedRoomId);
                        setMyOnlineStatus('playing');
                    });
                } else {
                    listenToRoomChanges(savedRoomId);
                    langNgheTinNhanChat(savedRoomId);
                    setMyOnlineStatus('free');
                }
            }).catch((error) => {
                console.error('Lỗi reconnect:', error);
                localStorage.removeItem('current_room_id');
            });
        }
    });
}
