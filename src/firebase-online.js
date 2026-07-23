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
const myClientId = 'user_' + Math.random().toString(36).substr(2, 9);

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

    setupEventListeners();
}

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
        alert(" Đã quay trở lại chế độ đấu Bot!");
        if (typeof window.xoaBanCoCu === "function") window.xoaBanCoCu(); // Reset bàn cờ về đấu bot
    }

    // 1. KHI BẤM TẠO PHÒNG MỚI
    document.getElementById('btn-create').addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value.trim() || "Cơ thủ Caro";
        const inputRoomName = document.getElementById('room-name').value.trim() || `Phòng của ${playerName}`;
        
        // LẤY RIÊNG BIỆT 2 GIÁ TRỊ LUẬT CHƠI ĐỂ GỬI LÊN SERVER
        const winCount = parseInt(document.getElementById('game-win-count').value) || 5;
        const isChan2Dau = document.getElementById('game-chan-2-dau').checked;
        
        const newRoomRef = db.ref('rooms').push();
        currentRoomId = newRoomRef.key;
        myRole = 'X'; 
        currentRule = isChan2Dau ? 'chan_2_dau' : 'tu_do'; // Phục vụ đồng bộ nhanh
        currentWinCount = winCount; // Lưu số quân thắng hiện tại

        const roomData = {
            id: currentRoomId,
            name: inputRoomName,
            winCount: winCount,          // Lưu số quân win lên Firebase
            chan2Dau: isChan2Dau,        // Lưu trạng thái checkbox lên Firebase
            status: "waiting",
            playerX: myClientId,
            playerO: "",
            turn: "X",
            winner: "",
            lastMove: { row: -1, col: -1, by: "" }
        };

        newRoomRef.set(roomData).then(() => {
            // CHƯA VÀO TRẬN ĐÂU: Hiện màn hình thông báo ĐANG CHỜ
            lobbySetupArea.style.display = "none";
            lobbyWaitingArea.style.display = "block";
            
            const textLuat = `Luật: Đủ ${winCount} quân thắng ${isChan2Dau ? '+ Chặn 2 đầu không tính' : ''}`;
            waitingRoomInfo.innerText = `Phòng: ${inputRoomName}\n${textLuat}`;
            
            listenToRoomChanges(currentRoomId);
            newRoomRef.onDisconnect().remove();
        });
    });

    // Nút hủy phòng khi đang trong trạng thái chờ
    document.getElementById('btn-cancel-room').addEventListener('click', () => {
        if (currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).set(null).then(() => {
                currentRoomId = null;
                myRole = null;
                lobbyWaitingArea.style.display = "none";
                lobbySetupArea.style.display = "block";
            });
        }
    });

    // Lắng nghe danh sách phòng tại sảnh
    db.ref('rooms').on('value', (snapshot) => {
        roomListDiv.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            roomListDiv.innerHTML = "<p style='color:#888;'>Chưa có phòng nào. Hãy tạo phòng!</p>";
            return;
        }

        let hasRoom = false;
        for (let key in data) {
            const room = data[key];
            if (room.status === "waiting") {
                hasRoom = true;
                const roomEl = document.createElement('div');
                roomEl.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; margin:5px 0; background:#f8f9fa; border:1px solid #ddd; border-radius:4px;";
                
                const textLuatBoXung = `Cài đặt: Đủ ${room.winCount || 5} quân ${room.chan2Dau ? '[Chặn 2 đầu]' : ''}`;
                roomEl.innerHTML = `
                    <div style="display:flex; flex-direction:column;">
                        <b>${room.name}</b>
                        <small style="color:#666;">${textLuatBoXung}</small>
                    </div>
                    <button class="btn-join" data-id="${room.id}" style="padding:6px 12px; background:#28a745; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">Vào Solo</button>
                `;
                roomListDiv.appendChild(roomEl);
            }
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
        myRole = 'O'; 
        const roomRef = db.ref(`rooms/${roomId}`);
        roomRef.update({ playerO: myClientId, status: "playing" }).then(() => {
            startOnlineMatch();
            listenToRoomChanges(roomId);
            roomRef.onDisconnect().update({ status: "ended", winner: "X (Đối thủ thoát)" });
        });
    }

    // 2. CẬP NHẬT HÀM THEO DÕI TRẠNG THÁI PHÒNG
    function listenToRoomChanges(roomId) {
        const roomRef = db.ref(`rooms/${roomId}`);
        roomRef.on('value', (snapshot) => {
            const room = snapshot.val();
            if (!room) return;

            currentTurn = room.turn;
            currentRule = room.chan2Dau ? 'chan_2_dau' : 'tu_do';
            currentWinCount = room.winCount || 5; // Cập nhật số quân thắng từ Firebase

            // Nếu người chơi thứ 2 vào phòng -> Trạng thái đổi thành "playing"
            if (room.status === "playing") {
                // TẮT TOÀN BỘ SẢNH CHỜ VÀ BẮT ĐẦU VÀO TRẬN ĐẤU ONLINE
                lobbyScreen.style.display = "none";
                lobbyWaitingArea.style.display = "none";
                lobbySetupArea.style.display = "block"; // Reset lại khu vực setup cho lần sau
                
                isOnlineMode = true;
                onlineBanner.style.display = "block";
                
                const displayLuat = `Đủ ${room.winCount || 5} quân ${room.chan2Dau ? '(Chặn 2 đầu)' : ''}`;
                if (currentTurn === myRole) {
                    gameInfo.innerHTML = `<span style='color:#28a745; font-weight:bold;'>Lượt của bạn (${myRole})</span> - Luật: ${displayLuat}`;
                } else {
                    gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn}) đánh...</span> - Luật: ${displayLuat}`;
                }

                // Đồng bộ nước đi của đối thủ
                if (room.lastMove && room.lastMove.row !== -1 && room.lastMove.by !== "") {
                    if (room.lastMove.by !== myRole) {
                        thucHienVeNuocDiDoiThu(room.lastMove.row, room.lastMove.col, room.lastMove.by);
                    }
                }
            }
            
            if (room.status === "ended" || room.winner) {
                gameInfo.innerHTML = `<b style='color:#d9534f;'>Trận đấu kết thúc! Thắng: ${room.winner}</b>`;
            }
        });
    }

    // Hàm đẩy dữ liệu lên Firebase
    window.guiNuocDiLenFirebase = function(row, col) {
        // NẾU KHÔNG PHẢI CHẾ ĐỘ ONLINE -> Cho phép đánh bình thường (Đấu Bot)
        if (!isOnlineMode) return true; 

        if (currentTurn !== myRole) {
            alert("Chưa đến lượt của bạn!");
            return false;
        }
        
        const nextTurn = myRole === 'X' ? 'O' : 'X';
        const roomRef = db.ref(`rooms/${currentRoomId}`);

        // Truyền chính xác quân cờ (myRole), luật của phòng (currentRule) và số quân thắng vào hàm check cờ của anh
        let isWin = false; 
        if (typeof window.checkWinLogicOld === "function") {
             // Lấy winCount từ Firebase room data
             db.ref(`rooms/${currentRoomId}`).once('value', (snapshot) => {
                 const room = snapshot.val();
                 if (room) {
                     isWin = window.checkWinLogicOld(row, col, myRole, currentRule, room.winCount);
                     
                     let winnerValue = isWin ? myRole : "";
                     let statusValue = isWin ? "ended" : "playing";

                     roomRef.update({
                         turn: nextTurn,
                         status: statusValue,
                         winner: winnerValue,
                         lastMove: { row: row, col: col, by: myRole }
                     });
                 }
             });
             return true; // Return true to allow the move, async check will update Firebase
        }

        let winnerValue = isWin ? myRole : "";
        let statusValue = isWin ? "ended" : "playing";

        roomRef.update({
            turn: nextTurn,
            status: statusValue,
            winner: winnerValue,
            lastMove: { row: row, col: col, by: myRole }
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
        
        // Update current player
        if (typeof currentPlayer !== 'undefined') {
            currentPlayer = role;
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
}
