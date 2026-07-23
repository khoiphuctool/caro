// Load Firebase SDKs theo cách truyền thống
(function() {
    // Load Firebase App SDK
    const script1 = document.createElement('script');
    script1.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
    document.head.appendChild(script1);

    // Load Firebase Database SDK
    const script2 = document.createElement('script');
    script2.src = "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js";
    document.head.appendChild(script2);

    script2.onload = initFirebase;
})();

let db;
let currentRoomId = null;
let myRole = null;       
let currentTurn = 'X';    
let currentRule = 'tu_do';
let currentWinCount = 5; // Mặc định 5 quân
let isOnlineMode = false;
let daXoaBanCoTranNay = false; // Cờ hiệu dọn bàn cờ
const myClientId = 'user_' + Math.random().toString(36).substr(2, 9);

// Authentication variables
let currentUsername = null; // Username for custom auth
let currentUserData = null; // User data from Firebase Database

// Lấy ID cũ hoặc tạo mới nếu chưa có
if (!localStorage.getItem('my_player_id')) {
    const randomId = 'pl_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('my_player_id', randomId);
}
const myPlayerId = localStorage.getItem('my_player_id');

// Store Firebase listeners for cleanup
let roomListener = null;
let roomsListListener = null;
let leaderboardListener = null;
let historyListener = null;

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
// 🔐 AUTHENTICATION FUNCTIONS (CUSTOM DATABASE-BASED)
// ══════════════════════════════════════════════════════════════════

function setupAuthListeners() {
    // Auth UI event listeners
    const authContainer = document.getElementById('auth-container');
    const userLoggedIn = document.getElementById('user-logged-in');
    const authTitle = document.getElementById('auth-title');
    
    // Close auth button
    document.getElementById('btn-close-auth').addEventListener('click', () => {
        authContainer.style.display = 'none';
    });
    
    // Homepage Login button
    document.getElementById('btn-show-login').addEventListener('click', () => {
        authTitle.innerText = '🔐 ĐĂNG NHẬP';
        authContainer.style.display = 'block';
    });
    
    // Homepage Register button
    document.getElementById('btn-show-register').addEventListener('click', () => {
        authTitle.innerText = '📝 ĐĂNG KÝ';
        authContainer.style.display = 'block';
    });
    
    // Login button in auth form
    document.getElementById('btn-login').addEventListener('click', dangNhap);
    
    // Register button in auth form
    document.getElementById('btn-register').addEventListener('click', dangKy);
    
    // Logout button
    document.getElementById('btn-logout').addEventListener('click', dangXuat);
    
    // Show auth container when clicking "Solo Online" if not logged in
    document.getElementById('btn-go-online').addEventListener('click', (e) => {
        if (!currentUsername) {
            e.preventDefault();
            e.stopPropagation();
            authTitle.innerText = '🔐 ĐĂNG NHẬP';
            authContainer.style.display = 'block';
            alert('Vui lòng đăng nhập để chơi Online!');
        }
    });
    
    // Check for existing session on page load
    const savedUsername = localStorage.getItem('current_username');
    const savedUserId = localStorage.getItem('current_user_id');
    if (savedUsername && savedUserId) {
        currentUsername = savedUsername;
        fetchUserData(savedUserId);
        userLoggedIn.style.display = 'block';
    }
}

// 1. ĐĂNG KÝ
function dangKy() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if (!username || !password) {
        alert('Vui lòng nhập tên đăng nhập và mật khẩu!');
        return;
    }
    
    if (username.length < 3) {
        alert('Tên đăng nhập phải có ít nhất 3 ký tự!');
        return;
    }
    
    if (password.length < 4) {
        alert('Mật khẩu phải có ít nhất 4 ký tự!');
        return;
    }
    
    // Check if username already exists
    db.ref('users').orderByChild('username').equalTo(username).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            alert('Tên đăng nhập đã tồn tại! Vui lòng chọn tên khác.');
            return;
        }
        
        // Create new user
        const newUserRef = db.ref('users').push();
        const userId = newUserRef.key;
        
        newUserRef.set({
            username: username,
            password: password, // Note: In production, this should be hashed!
            displayName: username,
            winBot: 0,
            winSolo: 0,
            loseSolo: 0,
            createdAt: Date.now()
        }).then(() => {
            alert("Đăng ký tài khoản thành công!");
            document.getElementById('auth-container').style.display = 'none';
            
            // Auto login after registration
            currentUsername = username;
            localStorage.setItem('current_username', username);
            fetchUserData(userId);
            
            const userLoggedIn = document.getElementById('user-logged-in');
            const authContainer = document.getElementById('auth-container');
            userLoggedIn.style.display = 'block';
            authContainer.style.display = 'none';
        }).catch((error) => {
            console.error("Lỗi đăng ký:", error);
            alert("Lỗi đăng ký: " + error.message);
        });
    });
}

// 2. ĐĂNG NHẬP
function dangNhap() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if (!username || !password) {
        alert('Vui lòng nhập tên đăng nhập và mật khẩu!');
        return;
    }
    
    // Find user by username
    db.ref('users').orderByChild('username').equalTo(username).once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            alert('Tên đăng nhập không tồn tại!');
            return;
        }
        
        const users = snapshot.val();
        const userId = Object.keys(users)[0];
        const userData = users[userId];
        
        // Check password
        if (userData.password !== password) {
            alert('Mật khẩu không đúng!');
            return;
        }
        
        // Login successful
        currentUsername = username;
        localStorage.setItem('current_username', username);
        localStorage.setItem('current_user_id', userId);
        
        alert("Đăng nhập thành công!");
        document.getElementById('auth-container').style.display = 'none';
        
        const userLoggedIn = document.getElementById('user-logged-in');
        userLoggedIn.style.display = 'block';
        
        fetchUserData(userId);
    }).catch((error) => {
        console.error("Lỗi đăng nhập:", error);
        alert("Lỗi đăng nhập: " + error.message);
    });
}

// 3. ĐĂNG XUẤT
function dangXuat() {
    currentUsername = null;
    currentUserData = null;
    localStorage.removeItem('current_username');
    localStorage.removeItem('current_user_id');
    
    const userLoggedIn = document.getElementById('user-logged-in');
    userLoggedIn.style.display = 'none';
    
    alert("Đã đăng xuất!");
}

// 4. LẤY DỮ LIỆU USER TỪ DATABASE
function fetchUserData(userId) {
    db.ref('users/' + userId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentUserData = data;
            localStorage.setItem('current_user_id', userId);
            
            // Cập nhật UI user info panel
            document.getElementById('user-display-name').innerText = data.displayName || data.username;
            document.getElementById('my-win-bot').innerText = data.winBot || 0;
            document.getElementById('my-win-solo').innerText = data.winSolo || 0;
            document.getElementById('my-lose-solo').innerText = data.loseSolo || 0;
        }
    });
}

// 5. CẬP NHẬT THỐNG KÊ USER (WIN BOT, WIN SOLO, LOSE SOLO)
function updateUserStats(statType, increment = 1) {
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    
    const statPath = `users/${userId}/${statType}`;
    db.ref(statPath).transaction((currentValue) => {
        return (currentValue || 0) + increment;
    });
}

// Expose function globally for game logic to call when bot wins occur
window.updateUserStats = updateUserStats;

function setupEventListeners() {
    const lobbyScreen = document.getElementById('lobby-screen');
    const lobbySetupArea = document.getElementById('lobby-setup-area');
    const lobbyWaitingArea = document.getElementById('lobby-waiting-area');
    const waitingRoomInfo = document.getElementById('waiting-room-info');
    const roomListDiv = document.getElementById('room-list');
    const gameInfo = document.getElementById('game-info');
    const onlineBanner = document.getElementById('online-status-banner');

    // Khi ấn nút "Solo Online" -> Hiện bảng chọn phòng
    document.getElementById('btn-go-online').addEventListener('click', () => {
        lobbyScreen.style.display = "block";
    });

    // Khi ấn nút dấu "X" ở sảnh chờ -> Ẩn bảng chọn phòng, quay lại đấu Bot
    document.getElementById('btn-close-lobby').addEventListener('click', () => {
        lobbyScreen.style.display = "none";
    });

    // Hàm kích hoạt khi trận đấu bắt đầu
    function startOnlineMatch() {
        isOnlineMode = true;
        lobbyScreen.style.display = "none";     // Ẩn sảnh đi
        onlineBanner.style.display = "block";   // Hiện thanh trạng thái Online lên đầu bàn cờ
        
        // Tùy chọn: Gọi hàm reset bàn cờ cũ của anh ở đây để chuẩn bị chơi mới
        if (typeof window.xoaBanCoCu === "function") window.xoaBanCoCu(); 

        // ẨN PHẦN CHỌN CHẾ ĐỘ BOT TRÊN UI
        const khuVucBot = document.getElementById('ui-config-panel');
        if (khuVucBot) khuVucBot.style.pointerEvents = "none"; // Khóa không cho bấm chọn mức Bot nữa
    }

    // Khi ấn nút "Thoát Online" để quay về đấu Bot
    document.getElementById('btn-quit-match').addEventListener('click', () => {
        if (currentRoomId) {
            // Cập nhật hủy phòng trên Firebase
            db.ref(`rooms/${currentRoomId}`).update({ status: "ended", winner: "Đối thủ bỏ cuộc" });
        }
        thoatCheDoOnline();
    });

    function thoatCheDoOnline() {
        isOnlineMode = false;
        currentRoomId = null;
        myRole = null;
        onlineBanner.style.display = "none";
        
        // ẨN PLAYER PANELS KHI THOÁT ONLINE
        document.getElementById('panel-playerX').style.display = 'none';
        document.getElementById('panel-playerO').style.display = 'none';
        
        alert(" Đã quay trở lại chế độ đấu Bot!");
        if (typeof window.xoaBanCoCu === "function") window.xoaBanCoCu(); // Reset bàn cờ về đấu bot

        // MỞ LẠI CHO CHỌN BOT
        const khuVucBot = document.getElementById('ui-config-panel');
        if (khuVucBot) khuVucBot.style.pointerEvents = "auto";

        // Cleanup Firebase listeners
        cleanupFirebaseListeners();
    }

    // Cleanup Firebase listeners to prevent memory leaks
    function cleanupFirebaseListeners() {
        if (roomListener && currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).off('value', roomListener);
            roomListener = null;
        }
    }

    // Cleanup on page unload to prevent orphaned rooms
    window.addEventListener('beforeunload', () => {
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).update({ 
                status: "ended", 
                winner: isOnlineMode ? (myRole === 'X' ? "O (Người chơi X thoát)" : "X (Người chơi O thoát)") : ""
            });
        }
        cleanupFirebaseListeners();
    });

    // 1. KHI BẤM TẠO PHÒNG MỚI (TẠO ID RIÊNG BIỆT KHÔNG TRÙNG LẶP)
    document.getElementById('btn-create').addEventListener('click', () => {
        // Sử dụng displayName từ user data đã đăng nhập
        const playerName = currentUserData ? currentUserData.displayName : "Cơ thủ Caro";
        const inputRoomName = document.getElementById('room-name').value.trim() || `Phòng của ${playerName}`;
        
        // LẤY RIÊNG BIỆT 2 GIÁ TRỊ LUẬT CHƠI ĐỂ GỬI LÊN SERVER
        const winCount = parseInt(document.getElementById('game-win-count').value) || 5;
        const isChan2Dau = document.getElementById('game-chan-2-dau').checked;
        
        const newRoomRef = db.ref('rooms').push(); // Tạo ID phòng mới hoàn toàn
        currentRoomId = newRoomRef.key;
        myRole = 'X'; 
        currentRule = isChan2Dau ? 'chan_2_dau' : 'tu_do'; // Phục vụ đồng bộ nhanh
        currentWinCount = winCount; // Lưu số quân thắng hiện tại
        daXoaBanCoTranNay = false; // Reset cờ hiệu cho ván mới

        const userId = localStorage.getItem('current_user_id') || myPlayerId;

        const roomData = {
            id: currentRoomId,
            name: inputRoomName,
            winCount: winCount,          // Lưu số quân win lên Firebase
            chan2Dau: isChan2Dau,        // Lưu trạng thái checkbox lên Firebase
            status: "waiting",
            playerX: myClientId,
            playerX_id: userId,     // Lưu custom user ID của chủ phòng
            playerX_name: playerName,  // Lưu tên hiển thị
            playerO: "",
            playerO_id: "",
            playerO_name: "",
            turn: "X",
            winner: "",
            lastMove: { row: -1, col: -1, by: "" },
            moves: { init: true }, // Mảng nước đi trống hoàn toàn cho ván mới
            isBotHidden: true,     // Ẩn bot mặc định khi vào phòng
            playerX_status: 'online',
            playerO_status: 'offline'
        };

        newRoomRef.set(roomData).then(() => {
            // Lưu ID phòng vào localStorage để khôi phục sau F5
            localStorage.setItem('current_room_id', currentRoomId);
            
            // CHƯA VÀO TRẬN ĐÂU: Hiện màn hình thông báo ĐANG CHỜ
            lobbySetupArea.style.display = "none";
            lobbyWaitingArea.style.display = "block";
            
            const textLuat = `Luật: Đủ ${winCount} quân thắng ${isChan2Dau ? '+ Chặn 2 đầu không tính' : ''}`;
            waitingRoomInfo.innerText = `Phòng: ${inputRoomName}\n${textLuat}`;
            
            // Ẩn các thành phần của Bot khi bắt đầu vào trạng thái Online
            anGiaoDienVaThoaiCuaBot(true);
            
            // 🔥 LỆNH QUAN TRỌNG: Nếu chủ phòng ngắt kết nối/tắt tab khi đang đợi, tự động xóa phòng luôn
            newRoomRef.onDisconnect().remove();
            
            listenToRoomChanges(currentRoomId);
        });
    });

    // Nút hủy phòng khi đang trong trạng thái chờ
    document.getElementById('btn-cancel-room').addEventListener('click', () => {
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).set(null).then(() => {
                currentRoomId = null;
                myRole = null;
                daXoaBanCoTranNay = false;
                lobbyWaitingArea.style.display = "none";
                lobbySetupArea.style.display = "block";
                anGiaoDienVaThoaiCuaBot(false); // Hiện lại giao diện Bot
            });
        }
    });

    // Hàm tự động xóa phòng trống quá hạn và phòng ma
    function xoaPhongMaTuDong(allRooms) {
        const now = Date.now();
        Object.keys(allRooms).forEach(roomId => {
            const room = allRooms[roomId];
            
            // 1. Xóa phòng ma: Phòng không có dữ liệu người chơi hoặc dữ liệu không hoàn chỉnh
            if (!room.playerX_id || !room.playerX || (!room.playerO_id && room.status === 'playing')) {
                db.ref(`rooms/${roomId}`).remove();
                console.log(`Đã dọn dẹp phòng ma (không có dữ liệu người chơi): ${roomId}`);
                return;
            }
            
            // 2. Xóa phòng quá hạn: Cả 2 người đều offline quá 1 phút
            if (room.deleteTimeoutTimestamp && now > room.deleteTimeoutTimestamp) {
                db.ref(`rooms/${roomId}`).remove();
                console.log(`Đã dọn dẹp phòng trống quá hạn: ${roomId}`);
            }
            
            // 3. Xóa phòng đang chờ nhưng chủ phòng đã offline
            if (room.status === 'waiting' && room.playerX_status === 'offline') {
                db.ref(`rooms/${roomId}`).remove();
                console.log(`Đã dọn dẹp phòng chờ (chủ phòng offline): ${roomId}`);
            }
        });
    }

    // Lắng nghe danh sách phòng tại sảnh
    roomsListListener = db.ref('rooms').on('value', (snapshot) => {
        const rooms = snapshot.val();
        roomListDiv.innerHTML = "";
        
        if (!rooms) {
            roomListDiv.innerHTML = "<p style='color:#888;'>Chưa có phòng nào. Hãy tạo phòng!</p>";
            return;
        }

        // Gọi hàm dọn dẹp phòng trống quá hạn
        xoaPhongMaTuDong(rooms);

        let hasRoom = false;
        for (let roomId in rooms) {
            const room = rooms[roomId];
            
            // Tạo thẻ div cho từng phòng
            const roomEl = document.createElement('div');
            roomEl.style.padding = "10px";
            roomEl.style.margin = "5px 0";
            roomEl.style.border = "1px solid #ccc";
            roomEl.style.borderRadius = "5px";
            roomEl.style.display = "flex";
            roomEl.style.justifyContent = "space-between";
            roomEl.style.alignItems = "center";

            // BIẾN LƯU TRẠNG THÁI HIỂN THỊ VÀ MÀU SẮC
            let txtTrangThai = "Đang chờ...";
            let nutHanhDongHtml = `<button class="btn-join" data-id="${roomId}" style="padding:6px 12px; background:#28a745; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">Vào Solo</button>`;

            // KIỂM TRA: Nếu trạng thái là "playing" hoặc phòng đã đủ 2 người
            if (room.status === "playing" || (room.playerX && room.playerO)) {
                // Đổi màu nền hoặc màu viền sang ĐỎ để báo hiệu
                roomEl.style.backgroundColor = "#ffe6e6"; // Màu nền hồng đỏ nhạt cho dễ nhìn chữ
                roomEl.style.borderColor = "#ff4d4d";     // Viền đỏ đậm
                roomEl.style.color = "#cc0000";           // Màu chữ đỏ
                
                txtTrangThai = "Đang chơi ⚔️";
                // Phòng đang chơi thì khóa nút không cho người khác bấm vào nữa
                nutHanhDongHtml = `<button disabled style="background-color: #ccc; cursor: not-allowed; padding:6px 12px; border:none; border-radius:3px;">Full</button>`;
            } else {
                // Phòng đang chờ
                roomEl.style.backgroundColor = "#f8f9fa";
                roomEl.style.borderColor = "#ddd";
                roomEl.style.color = "#333";
            }

            const textLuatBoXung = `Cài đặt: Đủ ${room.winCount || 5} quân ${room.chan2Dau ? '[Chặn 2 đầu]' : ''}`;
            
            // Đổ dữ liệu text vào thẻ phòng
            roomEl.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <strong>${room.name}</strong> 
                    <span style="margin-left: 15px; font-weight: bold;">[${txtTrangThai}]</span>
                    <small style="color:#666;">${textLuatBoXung}</small>
                </div>
                <div>
                    ${nutHanhDongHtml}
                </div>
            `;

            roomListDiv.appendChild(roomEl);
            hasRoom = true;
        }
        
        if (!hasRoom) roomListDiv.innerHTML = "<p style='color:#888;'>Chưa có phòng nào. Hãy tạo phòng!</p>";

        document.querySelectorAll('.btn-join').forEach(button => {
            button.addEventListener('click', (e) => {
                joinRoom(e.target.getAttribute('data-id'));
            });
        });
    });

    // Vào phòng
    function joinRoom(roomId) {
        currentRoomId = roomId;
        const roomRef = db.ref(`rooms/${roomId}`);
        
        // Check quyền khi người chơi "Vào lại phòng cũ"
        roomRef.once('value').then((snapshot) => {
            const room = snapshot.val();
            if (!room) {
                alert("Phòng không tồn tại!");
                return;
            }

            // Sử dụng custom user ID nếu có, nếu không thì dùng myPlayerId cũ
            const playerId = localStorage.getItem('current_user_id') || myPlayerId;
            const playerName = currentUserData ? currentUserData.displayName : "Cơ thủ Caro";

            // Kiểm tra xem người chơi đã có trong phòng chưa
            if (playerId === room.playerX_id) {
                myRole = 'X'; // Nhận lại vai chủ phòng
                console.log("Bạn đã quay lại phòng với tư cách quân X");
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerX_status`).set('online');
                db.ref(`rooms/${roomId}/playerX_status`).onDisconnect().set('offline');
                startOnlineMatch();
                listenToRoomChanges(roomId);
            } else if (playerId === room.playerO_id) {
                myRole = 'O'; // Nhận lại vai khách
                console.log("Bạn đã quay lại phòng với tư cách quân O");
                localStorage.setItem('current_room_id', roomId);
                db.ref(`rooms/${roomId}/playerO_status`).set('online');
                db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                startOnlineMatch();
                listenToRoomChanges(roomId);
            } else if (room.playerO && room.playerO_id) {
                // Nếu phòng đầy và ID không khớp => Báo lỗi
                alert("Phòng này đã đầy!");
                return;
            } else {
                // Nếu phòng còn trống, vào với tư cách khách mới
                myRole = 'O';
                roomRef.update({ 
                    playerO: myClientId, 
                    playerO_id: playerId,
                    playerO_name: playerName,
                    status: "playing",
                    playerO_status: 'online'
                }).then(() => {
                    // Lưu ID phòng vào localStorage để khôi phục sau F5
                    localStorage.setItem('current_room_id', roomId);
                    
                    startOnlineMatch();
                    listenToRoomChanges(roomId);
                    // Khi trận đấu bắt đầu, chỉ set status offline cho playerO, không xóa cả phòng
                    db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                });
            }
        });
    }

    // 2. LẮNG NGHE PHÒNG VÀ XÓA SẠCH BÀN CỜ CŨ KHI VÀO TRẬN
    function listenToRoomChanges(roomId) {
        // Cleanup previous room listener if exists
        if (roomListener) {
            db.ref(`rooms/${currentRoomId}`).off('value', roomListener);
        }
        
        const roomRef = db.ref(`rooms/${roomId}`);
        roomListener = roomRef.on('value', (snapshot) => {
            const room = snapshot.val();
            if (!room) return;

            // Ẩn/hiện bot UI dựa trên trạng thái isBotHidden từ Firebase
            const botElement = document.getElementById('bot-avatar');
            if (botElement) {
                if (room.isBotHidden) {
                    botElement.style.display = 'none';
                } else {
                    botElement.style.display = 'block';
                }
            }

            currentTurn = room.turn;
            currentRule = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
            currentWinCount = room.winCount || 5; // Cập nhật số quân thắng từ Firebase
            winCount = currentWinCount; // Đồng bộ trực tiếp vào Core game

            // Xử lý xóa phòng trống (cả 2 người offline)
            const xOnline = room.playerX_status === 'online';
            const oOnline = room.playerO_status === 'online';

            // TRƯỜNG HỢP 1: Còn ít nhất 1 người online (X hoặc O)
            if (xOnline || oOnline) {
                // Xóa lệnh đếm ngược xóa phòng nếu có (vì đã có người ở trong phòng hoặc quay lại kịp)
                if (room.deleteTimeoutTimestamp) {
                    db.ref(`rooms/${room.id}/deleteTimeoutTimestamp`).remove();
                }
                console.log("Vẫn còn người trong phòng, giữ nguyên ván cờ chơi tiếp!");
            } 

            // TRƯỜNG HỢP 2: KHÔNG CÒN AI CẢ (Cả 2 cùng offline)
            if (!xOnline && !oOnline) {
                // Nếu chưa thiết lập thời gian chờ xóa, thì gán thời gian hiện tại + 60 giây
                if (!room.deleteTimeoutTimestamp) {
                    const deleteTime = Date.now() + 60000; // 1 phút sau
                    db.ref(`rooms/${room.id}/deleteTimeoutTimestamp`).set(deleteTime);
                }
            }

            // Nếu người chơi thứ 2 vào phòng -> Trạng thái đổi thành "playing"
            if (room.status === "playing") {
                // KHỞI TẠO VÁN MỚI: Xóa sạch giao diện và dữ liệu cũ đúng 1 lần
                if (!daXoaBanCoTranNay) {
                    if (typeof window.xoaBanCoCu === "function") {
                        window.xoaBanCoCu(); 
                    }
                    daXoaBanCoTranNay = true; 
                    
                    // 🔥 QUAN TRỌNG: Khi trận đấu bắt đầu, hủy lệnh xóa phòng và thay bằng set status offline
                    // Hủy lệnh onDisconnect().remove() cũ của chủ phòng
                    db.ref(`rooms/${roomId}`).onDisconnect().cancel();
                    
                    // Thiết lập onDisconnect mới: chỉ set status offline cho từng người chơi
                    if (myRole === 'X') {
                        // Chủ phòng: set status offline khi mất kết nối
                        db.ref(`rooms/${roomId}/playerX_status`).onDisconnect().set('offline');
                    } else if (myRole === 'O') {
                        // Khách: set status offline khi mất kết nối  
                        db.ref(`rooms/${roomId}/playerO_status`).onDisconnect().set('offline');
                    }
                }

                // TẮT TOÀN BỘ SẢNH CHỜ VÀ BẮT ĐẦU VÀO TRẬN ĐẤU ONLINE
                lobbyScreen.style.display = "none";
                lobbyWaitingArea.style.display = "none";
                lobbySetupArea.style.display = "block"; // Reset lại khu vực setup cho lần sau
                
                isOnlineMode = true;
                onlineBanner.style.display = "block";
                
                // HIỂN THỊ PLAYER PANELS KHI VÀO TRẬN ONLINE
                document.getElementById('panel-playerX').style.display = 'block';
                document.getElementById('panel-playerO').style.display = 'block';
                
                // Đồng bộ UI với cấu hình phòng từ Firebase
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

                // LẤY VÀ HIỂN THỊ DỮ LIỆU USER CHO 2 NGƯỜI CHƠI
                // 1. Lấy dữ liệu quân X (Chủ phòng)
                if (room.playerX_id) {
                    db.ref('users/' + room.playerX_id).once('value').then((userSnap) => {
                        const userX = userSnap.val();
                        if (userX) {
                            document.getElementById('view-name-X').innerText = userX.displayName || userX.username;
                            document.getElementById('view-winbot-X').innerText = userX.winBot || 0;
                            document.getElementById('view-winsolo-X').innerText = userX.winSolo || 0;
                            document.getElementById('view-losesolo-X').innerText = userX.loseSolo || 0;
                        } else {
                            // Fallback nếu chưa có user data
                            document.getElementById('view-name-X').innerText = room.playerX_name || "Người chơi X";
                        }
                    });
                }

                // 2. Lấy dữ liệu quân O (Khách)
                if (room.playerO_id) {
                    db.ref('users/' + room.playerO_id).once('value').then((userSnap) => {
                        const userO = userSnap.val();
                        if (userO) {
                            document.getElementById('view-name-O').innerText = userO.displayName || userO.username;
                            document.getElementById('view-winbot-O').innerText = userO.winBot || 0;
                            document.getElementById('view-winsolo-O').innerText = userO.winSolo || 0;
                            document.getElementById('view-losesolo-O').innerText = userO.loseSolo || 0;
                        } else {
                            // Fallback nếu chưa có user data
                            document.getElementById('view-name-O').innerText = room.playerO_name || "Người chơi O";
                        }
                    });
                } else {
                    // Nếu chưa có khách vào, reset UI bên phải về trạng thái chờ
                    document.getElementById('view-name-O').innerText = "Đang chờ đối thủ...";
                    document.getElementById('view-winbot-O').innerText = "0";
                    document.getElementById('view-winsolo-O').innerText = "0";
                    document.getElementById('view-losesolo-O').innerText = "0";
                }

                // Đồng bộ nước đi từ Firebase
                if (room.moves) {
                    for (let moveId in room.moves) {
                        if (moveId === 'init') continue;
                        const move = room.moves[moveId];
                        if (move.by !== myRole) {
                            thucHienVeNuocDiDoiThu(move.row, move.col, move.by);
                        }
                    }
                }
            }
            
            if (room.status === "ended" || room.winner) {
                gameInfo.innerHTML = `<b style='color:#d9534f;'>Trận đấu kết thúc! Thắng: ${room.winner}</b>`;
                daXoaBanCoTranNay = false; // Chuẩn bị cờ hiệu cho ván tiếp theo
                
                // Cập nhật bảng xếp hạng và user stats khi có người thắng
                if (room.winner && room.winner !== "Đối thủ bỏ cuộc") {
                    // Lấy tên người chơi tương ứng với quân thắng
                    const winnerName = room.winner === 'X' ? 
                        (room.playerX_name || "Người chơi X") :
                        (room.playerO_name || "Người chơi O");
                    
                    const loserName = room.winner === 'X' ? 
                        (room.playerO_name || "Người chơi O") :
                        (room.playerX_name || "Người chơi X");
                    
                    if (winnerName && loserName) {
                        capNhatBangXepHangOnline(winnerName);
                        ghiLichSuTranDauOnline(room.name, winnerName, loserName, room.winner);
                        
                        // Cập nhật user stats (winSolo, loseSolo)
                        const winnerId = room.winner === 'X' ? room.playerX_id : room.playerO_id;
                        const loserId = room.winner === 'X' ? room.playerO_id : room.playerX_id;
                        
                        if (winnerId) {
                            db.ref(`users/${winnerId}/winSolo`).transaction((current) => (current || 0) + 1);
                        }
                        if (loserId) {
                            db.ref(`users/${loserId}/loseSolo`).transaction((current) => (current || 0) + 1);
                        }
                    }
                }
            }
        });
    }

    // 3. ĐẨY NƯỚC ĐI VÀO PHÒNG ONLINE BỀN VỮNG
    window.guiNuocDiLenFirebase = function(row, col) {
        // NẾU KHÔNG PHẢI CHẾ ĐỘ ONLINE -> Cho phép đánh bình thường (Đấu Bot)
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

        // Use transaction to prevent race conditions
        roomRef.transaction((currentData) => {
            if (!currentData) return null;
            if (currentData.turn !== myRole) return null; // Prevent move if not your turn
            return {
                turn: nextTurn,
                status: statusValue,
                winner: winnerValue,
                lastMove: { row: row, col: col, by: myRole }
            };
        }).then(() => {
            // Only push move if transaction succeeded
            const movesRef = db.ref(`rooms/${currentRoomId}/moves`);
            movesRef.push({ row: row, col: col, by: myRole, timestamp: Date.now() });
        }).catch((error) => {
            console.error("Lỗi khi gửi nước đi:", error);
            alert("Có lỗi xảy ra khi gửi nước đi. Vui lòng thử lại!");
            return false;
        });
        
        return true;
    };

    function thucHienVeNuocDiDoiThu(row, col, role) {
        console.log(`Đối thủ đánh vào ô: ${row}, ${col} với quân ${role}`);
        
        // Set the cell value directly
        if (typeof setCell === 'function') {
            setCell(row, col, role);
        }
        
        // Update move history
        if (typeof moveHistory !== 'undefined') {
            moveHistory.push({ r: row, c: col, player: role });
        }
        
        // Update last move tracking
        if (typeof lastMoveR !== 'undefined') {
            lastMoveR = row;
            lastMoveC = col;
        }
        
        // Update current player and switch turn
        if (typeof currentPlayer !== 'undefined') {
            currentPlayer = role === 'X' ? 'O' : 'X';
        }
        
        // Re-render the board
        if (typeof renderInfiniteBoard === 'function') {
            renderInfiniteBoard();
        }
        
        // Update status
        if (typeof updateStatus === 'function') {
            updateStatus();
        }
        
        // Chạy kiểm tra xem nước đi đó đối thủ đã thắng chưa dựa trên luật phòng
        if (typeof window.checkWinLogicOld === "function") {
            window.checkWinLogicOld(row, col, role, currentRule);
        }
    }

    window.isOnlineModeActive = function() {
        return isOnlineMode;
    };

    // Dòng mới thêm: Giúp giao diện biết anh đang cầm quân gì để vẽ cho đúng
    Object.defineProperty(window, 'myOnlineRole', {
        get: function() { return myRole; }
    });

    // 4. HÀM TỔNG HỢP ẨN/HIỆN GIAO DIỆN VÀ THOẠI CỦA BOT
    function anGiaoDienVaThoaiCuaBot(shouldHide) {
        const displayStyle = shouldHide ? "none" : "block";
        const selectStyle = shouldHide ? "none" : "inline-block";
        
        // Ẩn thanh chọn mức độ Bot
        const khuVucBot = document.getElementById('ui-config-panel'); 
        if (khuVucBot) khuVucBot.style.pointerEvents = shouldHide ? "none" : "auto";
        
        // Ẩn khung thoại tin nhắn của Bot
        const khungThoaiBot = document.getElementById('bot-avatar'); 
        if (khungThoaiBot) khungThoaiBot.style.display = displayStyle;
    }

    // 5. HÀM CẬP NHẬT BẢNG XẾP HẠNG ONLINE KHI THẮNG
    function capNhatBangXepHangOnline(tenNguoiThang) {
        if (!tenNguoiThang) return;
        
        // Đường dẫn đến user đó trên Firebase (dùng tên làm ID)
        const userRef = db.ref(`leaderboard/${tenNguoiThang}`);
        
        // Sử dụng increment(1) của Firebase để tự động cộng thêm 1 trận thắng
        userRef.transaction((currentData) => {
            if (currentData === null) {
                return { score: 1, lastUpdated: Date.now() };
            }
            currentData.score = (currentData.score || 0) + 1;
            currentData.lastUpdated = Date.now();
            return currentData;
        }).then(() => {
            console.log(`Đã cộng 1 trận thắng trực tuyến cho: ${tenNguoiThang}`);
        });
    }

    // 6. HÀM GHI LỊCH SỬ TRẬN ĐẤU ONLINE
    function ghiLichSuTranDauOnline(tenRoom, tenNguoiX, tenNguoiO, nguoiThang) {
        const historyRef = db.ref('history');
        const newHistoryRef = historyRef.push(); // Tạo ID lịch sử duy nhất cho trận này

        // Định dạng thời gian hiện tại
        const thoiGian = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

        newHistoryRef.set({
            roomName: tenRoom,
            playerX: tenNguoiX,
            playerO: tenNguoiO,
            winner: nguoiThang, // 'X', 'O' hoặc 'Hòa'
            time: thoiGian,
            timestamp: Date.now()
        }).then(() => {
            console.log("Đã lưu lịch sử trận đấu lên hệ thống.");
            
            // Cleanup old history records (keep only last 100 to prevent data overflow)
            cleanupOldHistory();
        });
    }

    // Cleanup old history records to prevent data overflow
    function cleanupOldHistory() {
        db.ref('history').once('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const historyArray = [];
            for (let id in data) {
                historyArray.push({ id, ...data[id] });
            }

            // Sort by timestamp (oldest first)
            historyArray.sort((a, b) => a.timestamp - b.timestamp);

            // Keep only last 100 records
            if (historyArray.length > 100) {
                const toDelete = historyArray.slice(0, historyArray.length - 100);
                toDelete.forEach(item => {
                    db.ref(`history/${item.id}`).remove();
                });
                console.log(`Đã xóa ${toDelete.length} bản ghi lịch sử cũ để tránh tràn dữ liệu.`);
            }
        });
    }

    // 7. HÀM LẮNG NGHE VÀ HIỂN THỊ BẢNG XẾP HẠNG ONLINE
    function langNgheBangXepHangOnline() {
        const leaderboardRef = db.ref('leaderboard');
        
        leaderboardListener = leaderboardRef.on('value', (snapshot) => {
            const data = snapshot.val();
            const bxhContainer = document.getElementById('bxh-online-container');
            if (!bxhContainer) return;

            bxhContainer.innerHTML = ""; // Xóa bảng cũ đi để vẽ lại

            if (!data) {
                bxhContainer.innerHTML = "<p>Chưa có xếp hạng trực tuyến.</p>";
                return;
            }

            // Chuyển object dữ liệu thành mảng để sắp xếp
            let danhSachXepHang = [];
            for (let name in data) {
                danhSachXepHang.push({
                    name: name,
                    score: data[name].score || 0
                });
            }

            // Sắp xếp giảm dần theo số trận thắng (ai thắng nhiều đứng đầu)
            danhSachXepHang.sort((a, b) => b.score - a.score);

            // Tạo bảng UI
            let tableHtml = `
                <table style="width:100%; text-align:left; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #ccc;">
                            <th>Hạng</th>
                            <th>Kỳ thủ</th>
                            <th>Số trận thắng</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Chỉ lấy top 10 người cao nhất
            danhSachXepHang.slice(0, 10).forEach((user, index) => {
                let iconHang = index === 0 ? "🥇" : (index === 1 ? "🥈" : (index === 2 ? "🥉" : `${index + 1}`));
                tableHtml += `
                    <tr style="border-bottom: 1px solid #eee; height: 35px;">
                        <td>${iconHang}</td>
                        <td><strong>${user.name}</strong></td>
                        <td style="color: green; font-weight: bold;">${user.score} trận</td>
                    </tr>
                `;
            });

            tableHtml += `</tbody></table>`;
            bxhContainer.innerHTML = tableHtml;
        });
    }

    // Chạy luôn hàm này khi load trang để hiển thị bảng xếp hạng ở sảnh
    langNgheBangXepHangOnline();

    // 8. HÀM LẮNG NGHE VÀ HIỂN THỊ LỊCH SỬ TRẬN ĐẤU ONLINE
    function langNgheLichSuOnline() {
        const historyListRef = db.ref('history');

        historyListener = historyListRef.on('value', (snapshot) => {
            const data = snapshot.val();
            const lichSuContainer = document.getElementById('lich-su-online-container');
            if (!lichSuContainer) return;

            lichSuContainer.innerHTML = ""; // Xóa dữ liệu cũ để vẽ lại

            if (!data) {
                lichSuContainer.innerHTML = "<p style='color: #888;'>Chưa có lịch sử trận đấu nào.</p>";
                return;
            }

            // Chuyển object dữ liệu thành mảng để sắp xếp theo thời gian
            let danhSachLichSu = [];
            for (let id in data) {
                danhSachLichSu.push(data[id]);
            }

            // Sắp xếp trận mới nhất lên đầu tiên
            danhSachLichSu.sort((a, b) => b.timestamp - a.timestamp);

            let htmlLichSu = `<div style="max-height: 250px; overflow-y: auto;">`;

            // Chỉ hiển thị tối đa 15 trận gần nhất để tránh lag giao diện
            danhSachLichSu.slice(0, 15).forEach((match) => {
                let thongBaoKetQua = "";
                if (match.winner === "X") {
                    thongBaoKetQua = `🏆 <span style="color: blue; font-weight: bold;">${match.playerX}</span> thắng <span style="color: red;">${match.playerO}</span>`;
                } else if (match.winner === "O") {
                    thongBaoKetQua = `🏆 <span style="color: red; font-weight: bold;">${match.playerO}</span> thắng <span style="color: blue;">${match.playerX}</span>`;
                } else {
                    thongBaoKetQua = `🤝 Hai bên hòa nhau`;
                }

                htmlLichSu += `
                    <div style="padding: 8px; margin-bottom: 6px; border-bottom: 1px dashed #eee; font-size: 14px; display: flex; justify-content: space-between;">
                        <div>
                            <strong>[${match.roomName}]</strong> ${thongBaoKetQua}
                        </div>
                        <div style="color: #666; font-size: 12px;">
                            ${match.time}
                        </div>
                    </div>
                `;
            });

            htmlLichSu += `</div>`;
            lichSuContainer.innerHTML = htmlLichSu;
        });
    }

    // Chạy hàm hiển thị lịch sử ngay khi tải trang sảnh chờ
    langNgheLichSuOnline();

    // Khôi phục phòng sau F5 refresh
    window.addEventListener('load', () => {
        const savedRoomId = localStorage.getItem('current_room_id');
        const myPlayerId = localStorage.getItem('my_player_id');
        
        if (savedRoomId && myPlayerId) {
            db.ref('rooms/' + savedRoomId).once('value').then((snapshot) => {
                const room = snapshot.val();
                if (room) {
                    // Kiểm tra xem mình có đúng là Player cũ trong phòng không
                    if (myPlayerId === room.playerX_id || myPlayerId === room.playerO_id) {
                        console.log("Đang khôi phục lại phòng đấu cũ: " + savedRoomId);
                        
                        // Gán lại ID phòng hiện tại vào biến global
                        currentRoomId = savedRoomId;
                        
                        // Gán lại vai trò
                        myRole = (myPlayerId === room.playerX_id) ? 'X' : 'O';
                        
                        // Cập nhật trạng thái online
                        if (myRole === 'X') {
                            db.ref(`rooms/${savedRoomId}/playerX_status`).set('online');
                            db.ref(`rooms/${savedRoomId}/playerX_status`).onDisconnect().set('offline');
                        } else {
                            db.ref(`rooms/${savedRoomId}/playerO_status`).set('online');
                            db.ref(`rooms/${savedRoomId}/playerO_status`).onDisconnect().set('offline');
                        }
                        
                        // Gọi lại hàm lắng nghe phòng để vẽ lại bàn cờ
                        startOnlineMatch();
                        listenToRoomChanges(savedRoomId);
                    } else {
                        // Nếu phòng đã đổi chủ hoặc mình không liên quan, xóa cache
                        localStorage.removeItem('current_room_id');
                    }
                } else {
                    localStorage.removeItem('current_room_id');
                }
            });
        }
    });
}
