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
const myClientId = 'user_' + Math.random().toString(36).substr(2, 9);

let currentUsername = null; 
let currentUserData = null; 

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
            alert("Đăng ký tài khoản thành công! Tự động đăng nhập...");
            document.getElementById('auth-container').style.display = 'none';
            
            // THỰC HIỆN TỰ ĐỘNG ĐĂNG NHẬP NGAY SAU KHI ĐĂNG KÝ
            currentUsername = username;
            localStorage.setItem('current_username', username);
            fetchUserData(userId);
            updateAuthUI(true); // Ẩn ngay 2 nút Đăng ký / Đăng nhập
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
        
        alert("Đăng nhập thành công!");
        document.getElementById('auth-container').style.display = 'none';
        fetchUserData(userId);
        updateAuthUI(true); // Đăng nhập thành công -> Ẩn 2 nút ĐK/ĐN
    }).catch((error) => { alert("Lỗi đăng nhập: " + error.message); });
}

function dangXuat() {
    currentUsername = null;
    currentUserData = null;
    localStorage.removeItem('current_username');
    localStorage.removeItem('current_user_id');
    
    alert("Đã đăng xuất!");
    updateAuthUI(false); // Đăng xuất -> Hiện lại 2 nút ĐK/ĐN để người khác dùng
    
    // Xóa trạng thái online khi đăng xuất
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
    if (!currentRoomId) return;
    
    db.ref(`users/${targetUid}/invitation`).set({
        fromUid: localStorage.getItem('current_user_id'),
        fromName: (currentUserData && currentUserData.displayName) ? currentUserData.displayName : currentUsername,
        roomId: currentRoomId,
        timestamp: Date.now()
    }).then(() => {
        alert("Đã gửi lời mời! Đang chờ đối thủ phản hồi...");
    });
}

function langNgheLoiMoiDen() {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;

    if (invitationListener) db.ref(`users/${userId}/invitation`).off('value', invitationListener);

    invitationListener = db.ref(`users/${userId}/invitation`).on('value', (snapshot) => {
        const invite = snapshot.val();
        if (!invite) return;

        // Bỏ qua lời mời quá cũ (hơn 30 giây)
        if (Date.now() - invite.timestamp > 30000) {
            db.ref(`users/${userId}/invitation`).remove();
            return;
        }

        // Hiện xác nhận mời chơi
        const dongY = confirm(`Kỳ thủ [${invite.fromName}] mời bạn vào solo giao lưu! Bạn có đồng ý không?`);
        
        if (dongY) {
            const roomId = invite.roomId;
            // Xóa lời mời trước để tránh lặp popup
            db.ref(`users/${userId}/invitation`).remove();
            
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
                
                // Cập nhật thông tin Player O vào phòng
                roomRef.update({ 
                    playerO: myClientId, 
                    playerO_id: userId,
                    playerO_name: playerName,
                    status: "playing",
                    playerO_status: 'online'
                }).then(() => {
                    // Chạy hàm đổi giao diện sang bàn cờ Online
                    if (typeof startOnlineMatch === 'function') {
                        startOnlineMatch();
                    } else {
                        // Cấu hình giao diện thủ công nếu hàm startOnlineMatch nằm trong scope khác
                        document.getElementById('lobby-screen').style.display = "none";     
                        document.getElementById('online-status-banner').style.display = "block";   
                        if (typeof window.xoaBanCoCu === "function") window.xoaBanCoCu(); 
                    }
                    
                    // Lắng nghe thay đổi của bàn cờ
                    listenToRoomChanges(roomId);
                    // Đặt trạng thái ngắt kết nối
                    db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                    // Chuyển trạng thái cá nhân sang đang chơi
                    setMyOnlineStatus('playing');
                });
            });
        } else {
            // Từ chối thì xóa lời mời đi
            db.ref(`users/${userId}/invitation`).remove();
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
                // Đẩy lại state để giữ họ ở lại trang
                window.history.pushState(null, null, window.location.href);
                
                if (myRole === 'viewer') {
                    if (confirm("Bạn muốn thoát giao diện Xem trực tiếp để về Sảnh?")) {
                        thoatCheDoOnline();
                    }
                } else {
                    if (confirm("Bạn đang trong trận đấu! Bạn có chắc chắn muốn bỏ cuộc và thoát ra không?")) {
                        // Gọi hàm xử lý chịu thua / rời phòng
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

    // Hàm bổ trợ chặn sự kiện cuộn
    function preventMobileScroll(e) {
        // Nếu sự kiện vuốt chạm diễn ra ngoài khu vực bàn cờ, chặn hoàn toàn để không bị lướt thoát trang
        if (!e.target.closest('#ui-game-container')) {
            e.preventDefault();
        }
    }

    document.getElementById('btn-quit-match').addEventListener('click', () => {
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).update({ status: "ended", winner: "Đối thủ bỏ cuộc" });
        }
        thoatCheDoOnline();
    });

    function thoatCheDoOnline() {
        // Xóa class khóa để người dùng lướt điện thoại bình thường ở sảnh
        document.body.classList.remove('in-game-active');
        
        // Gỡ bỏ listener chặn cuộn
        document.removeEventListener('touchmove', preventMobileScroll);
        
        // Xóa popstate handler
        window.onpopstate = null;
        
        isOnlineMode = false;
        currentRoomId = null;
        myRole = null;
        onlineBanner.style.display = "none";
        
        document.getElementById('panel-playerX').style.display = 'none';
        document.getElementById('panel-playerO').style.display = 'none';
        
        alert("Đã quay trở lại chế độ đấu Bot!");
        if (typeof window.xoaBanCoCu === "function") window.xoaBanCoCu(); 

        const khuVucBot = document.getElementById('ui-config-panel');
        if (khuVucBot) khuVucBot.style.pointerEvents = "auto";

        // Quay về trạng thái "free" khi thoát online
        setMyOnlineStatus('free');

        cleanupFirebaseListeners();
    }

    function cleanupFirebaseListeners() {
        if (roomListener && currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).off('value', roomListener);
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
                db.ref(`users/${userId}/invitation`).off('value', invitationListener);
            }
            invitationListener = null;
        }
    }

    window.addEventListener('beforeunload', () => {
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).update({ 
                status: "ended", 
                winner: isOnlineMode ? (myRole === 'X' ? "O (Người chơi X thoát)" : "X (Người chơi O thoát)") : ""
            });
        }
        cleanupFirebaseListeners();
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
            
            // 🪑 Ghế X: Khóa chặt cho người tạo phòng
            playerX: myClientId,
            playerX_id: userId,
            playerX_name: playerName,
            playerX_status: "online",
            
            // Ghế O: Để trống chờ người vào hoặc được mời
            playerO: "",
            playerO_id: "",
            playerO_name: "",
            playerO_status: "offline",
            
            winner: "",
            lastMove: { row: -1, col: -1, by: "" },
            moves: { init: true }, 
            isBotHidden: true,
            createdAt: Date.now()
        };

        newRoomRef.set(dataPhong).then(() => {
            currentRoomId = roomId;
            myRole = 'X'; // Mình là chủ phòng, cố định ghế X
            currentRule = laChan2Dau ? 'chan_2_dau' : 'tu_do'; 
            currentWinCount = soQuanThang; 
            daXoaBanCoTranNay = false;
            localStorage.setItem('current_room_id', roomId);

            // 🧹 TỐI ƯU: Đặt lệnh tự động dọn dẹp nếu chủ phòng đột ngột tắt tab khi đang chờ
            newRoomRef.onDisconnect().remove();

            // 3. Chuyển sang giao diện bàn cờ và bắt đầu lắng nghe thay đổi
            if (typeof startOnlineMatch === 'function') {
                startOnlineMatch();
            }
            listenToRoomChanges(roomId);

            // Cập nhật trạng thái cá nhân sang free để người khác thấy trong danh sách online
            setMyOnlineStatus('free');
            
            alert(`Tạo phòng thành công! Hãy dùng tính năng Mời để gọi bạn chơi.`);
        }).catch((error) => {
            alert("Lỗi tạo phòng: " + error.message);
        });
    });

    document.getElementById('btn-cancel-room').addEventListener('click', () => {
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).set(null).then(() => {
                currentRoomId = null;
                myRole = null;
                daXoaBanCoTranNay = false;
                lobbyWaitingArea.style.display = "none";
                lobbySetupArea.style.display = "block";
                anGiaoDienVaThoaiCuaBot(false); 
            });
        }
    });

    function xoaPhongMaTuDong(allRooms) {
        const now = Date.now();
        Object.keys(allRooms).forEach(roomId => {
            const room = allRooms[roomId];
            if (!room.playerX_id || !room.playerX || (!room.playerO_id && room.status === 'playing')) {
                db.ref(`rooms/${roomId}`).remove();
                return;
            }
            if (room.deleteTimeoutTimestamp && now > room.deleteTimeoutTimestamp) {
                db.ref(`rooms/${roomId}`).remove();
            }
            if (room.status === 'waiting' && room.playerX_status === 'offline') {
                db.ref(`rooms/${roomId}`).remove();
            }
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
            const roomEl = document.createElement('div');
            roomEl.style.padding = "10px";
            roomEl.style.margin = "5px 0";
            roomEl.style.border = "1px solid #ccc";
            roomEl.style.borderRadius = "5px";
            roomEl.style.display = "flex";
            roomEl.style.justifyContent = "space-between";
            roomEl.style.alignItems = "center";

            let txtTrangThai = "Đang chờ...";
            let nutHanhDongHtml = "";
            const currentUserId = localStorage.getItem('current_user_id') || myPlayerId;

            // Kiểm tra xem người đang ở sảnh có phải là 1 trong 2 đấu thủ của phòng này không
            const laNguoiTrongPhong = (currentUserId === room.playerX_id || currentUserId === room.playerO_id);

            if (room.status === "playing" || (room.playerX && room.playerO)) {
                // PHÒNG ĐÃ ĐỦ 2 ĐẤU THỦ HOẶC ĐANG TRONG TRẬN ĐẤU
                roomEl.style.backgroundColor = "#ffe6e6"; 
                roomEl.style.borderColor = "#ff4d4d";     
                roomEl.style.color = "#cc0000";           
                txtTrangThai = "Đang chơi ⚔️";
                
                if (laNguoiTrongPhong) {
                    // 🔥 Nếu là anh (hoặc đối thủ) vô tình F5 ra ngoài, hiện nút "Vào lại ghế" để tiếp tục đánh
                    nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" style="padding:6px 12px; background:#ffc107; color:#212529; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">Vào lại ghế</button>`;
                } else {
                    // 🔥 Nếu là người khác (Khán giả), hiện nút "Vào xem" chứ không khóa Full nữa
                    nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" style="padding:6px 12px; background:#17a2b8; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">Vào xem</button>`;
                }
            } else {
                // PHÒNG ĐANG TRỐNG GHẾ CHỜ NGƯỜI VÀO SOLO
                roomEl.style.backgroundColor = "#f8f9fa";
                roomEl.style.borderColor = "#ddd";
                roomEl.style.color = "#333";
                txtTrangThai = "Đang chờ...";
                
                nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" style="padding:6px 12px; background:#28a745; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">Vào Solo</button>`;
            }

            const textLuatBoXung = `Cài đặt: Đủ ${room.winCount || 5} quân ${room.chan2Dau ? '[Chặn 2 đầu]' : ''}`;
            roomEl.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <strong>${room.name}</strong> 
                    <span style="margin-left: 15px; font-weight: bold;">[${txtTrangThai}]</span>
                    <small style="color:#666;">${textLuatBoXung}</small>
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
    });

    function joinRoom(roomId) {
        currentRoomId = roomId;
        const roomRef = db.ref(`rooms/${roomId}`);
        
        roomRef.once('value').then((snapshot) => {
            const room = snapshot.val();
            if (!room) { alert("Phòng không tồn tại!"); return; }

            const playerId = localStorage.getItem('current_user_id') || myPlayerId;
            const playerName = currentUserData ? currentUserData.displayName : "Cơ thủ Caro";

            if (playerId === room.playerX_id) {
                myRole = 'X'; 
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerX_status`).set('online');
                db.ref(`rooms/${roomId}/playerX_status`).onDisconnect().set('offline');
                startOnlineMatch();
                listenToRoomChanges(roomId);
            } else if (playerId === room.playerO_id) {
                myRole = 'O'; 
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerO_status`).set('online');
                db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                startOnlineMatch();
                listenToRoomChanges(roomId);
            } else if (room.playerO && room.playerO_id) {
                alert("Phòng này đã đầy!");
                return;
            } else {
                myRole = 'O';
                roomRef.update({ 
                    playerO: myClientId, 
                    playerO_id: playerId,
                    playerO_name: playerName,
                    status: "playing",
                    playerO_status: 'online'
                }).then(() => {
                    localStorage.setItem('current_room_id', roomId);
                    startOnlineMatch();
                    listenToRoomChanges(roomId);
                    db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                });
            }
        });
    }

    // Biến lưu trữ tọa độ nước cuối cùng để so khớp tránh vẽ lặp lại
    let locallyAppliedLastMove = { row: -2, col: -2 };

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

            const botElement = document.getElementById('bot-avatar');
            if (botElement) { botElement.style.display = room.isBotHidden ? 'none' : 'block'; }

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
                lobbySetupArea.style.display = "block"; 
                
                isOnlineMode = true;
                onlineBanner.style.display = "block";
                document.getElementById('panel-playerX').style.display = 'block';
                document.getElementById('panel-playerO').style.display = 'block';
                
                const winCountSelect = document.getElementById('win-count');
                const blockBothEndsCheckbox = document.getElementById('block-both-ends');
                if (winCountSelect) winCountSelect.value = currentWinCount;
                if (blockBothEndsCheckbox) blockBothEndsCheckbox.checked = room.chan2Dau;
                
                const displayLuat = `Đủ ${room.winCount || 5} quân ${room.chan2Dau ? '(Chặn 2 đầu)' : ''}`;
                if (currentTurn === myRole) {
                    gameInfo.innerHTML = `<span style='color:#28a745; font-weight:bold;'>Lượt của bạn (${myRole})</span> - Luật: ${displayLuat}`;
                } else {
                    gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn}) đánh...</span> - Luật: ${displayLuat}`;
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
                gameInfo.innerHTML = `<b style='color:#d9534f;'>Trận đấu kết thúc! Thắng: ${room.winner}</b>`;
                daXoaBanCoTranNay = false; 
                
                if (room.winner && room.winner !== "Đối thủ bỏ cuộc") {
                    const winnerName = room.winner === 'X' ? (room.playerX_name || "Người chơi X") : (room.playerO_name || "Người chơi O");
                    const loserName = room.winner === 'X' ? (room.playerO_name || "Người chơi O") : (room.playerX_name || "Người chơi X");
                    
                    if (winnerName && loserName) {
                        capNhatBangXepHangOnline(winnerName);
                        ghiLichSuTranDauOnline(room.name, winnerName, loserName, room.winner);
                        
                        const winnerId = room.winner === 'X' ? room.playerX_id : room.playerO_id;
                        const loserId = room.winner === 'X' ? room.playerO_id : room.playerX_id;
                        
                        // Chỉ cộng điểm khi cấu hình phòng yêu cầu từ 5 quân thắng trở lên
                        if (currentWinCount >= 5) {
                            if (winnerId) { db.ref(`users/${winnerId}/winSolo`).transaction((current) => (current || 0) + 1); }
                        } else {
                            console.log("Trận đấu dưới 5 quân thắng, không tính vào điểm Rank.");
                        }
                        if (loserId) { db.ref(`users/${loserId}/loseSolo`).transaction((current) => (current || 0) + 1); }
                    }
                }
            }
        });
    }

    window.guiNuocDiLenFirebase = function(row, col) {
        if (!isOnlineMode) return true; 

        if (currentTurn !== myRole) {
            alert("Chưa đến lượt của bạn!");
            return false;
        }
        
        const nextTurn = myRole === 'X' ? 'O' : 'X';
        const roomRef = db.ref(`rooms/${currentRoomId}`);
        
        let isWin = false; 
        if (typeof window.checkWinLogicOld === "function") {
             isWin = window.checkWinLogicOld(row, col, myRole, currentRule, currentWinCount);
        }
        let winnerValue = isWin ? myRole : "";
        let statusValue = isWin ? "ended" : "playing";

        roomRef.transaction((currentData) => {
            if (!currentData) return null;
            if (currentData.turn !== myRole) return null; 
            return {
                ...currentData,
                turn: nextTurn,
                status: statusValue,
                winner: winnerValue,
                lastMove: { row: row, col: col, by: myRole }
            };
        }).then(() => {
            db.ref(`rooms/${currentRoomId}/moves`).push({ row: row, col: col, by: myRole, timestamp: Date.now() });
        }).catch((error) => {
            alert("Có lỗi xảy ra khi gửi nước đi. Vui lòng thử lại!");
            return false;
        });
        
        return true;
    };

    function thucHienVeNuocDiDoiThu(row, col, role) {
        if (typeof setCell === 'function') { setCell(row, col, role); }
        if (typeof moveHistory !== 'undefined') { moveHistory.push({ r: row, c: col, player: role }); }
        if (typeof lastMoveR !== 'undefined') { lastMoveR = row; lastMoveC = col; }
        if (typeof currentPlayer !== 'undefined') { currentPlayer = role === 'X' ? 'O' : 'X'; }
        if (typeof renderInfiniteBoard === 'function') { renderInfiniteBoard(); }
        if (typeof updateStatus === 'function') { updateStatus(); }
        if (typeof window.checkWinLogicOld === "function") {
            window.checkWinLogicOld(row, col, role, currentRule);
        }
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
        
        if (savedRoomId && myPlayerIdVal) {
            db.ref('rooms/' + savedRoomId).once('value').then((snapshot) => {
                const room = snapshot.val();
                if (room && (myPlayerIdVal === room.playerX_id || myPlayerIdVal === room.playerO_id)) {
                    currentRoomId = savedRoomId;
                    myRole = (myPlayerIdVal === room.playerX_id) ? 'X' : 'O';
                    
                    if (myRole === 'X') {
                        db.ref(`rooms/${savedRoomId}/playerX_status`).set('online');
                        db.ref(`rooms/${savedRoomId}/playerX_status`).onDisconnect().set('offline');
                    } else {
                        db.ref(`rooms/${savedRoomId}/playerO_status`).set('online');
                        db.ref(`rooms/${savedRoomId}/playerO_status`).onDisconnect().set('offline');
                    }
                    startOnlineMatch();
                    listenToRoomChanges(savedRoomId);
                } else {
                    localStorage.removeItem('current_room_id');
                }
            });
        }
    });
}
