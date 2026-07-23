import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentRoomId = null;
let myRole = null;       
let currentTurn = 'X';    
let currentRule = 'tu_do';
let isOnlineMode = false; // Biến kiểm tra xem có đang chơi Online hay chơi với Bot
const myClientId = 'user_' + Math.random().toString(36).substr(2, 9);

const lobbyScreen = document.getElementById('lobby-screen');
const roomListDiv = document.getElementById('room-list');
const gameInfo = document.getElementById('game-info');
const onlineBanner = document.getElementById('online-status-banner');

// --- ĐÓNG MỞ GIAO DIỆN LOBBY VÀ CHUYỂN ĐỔI CHẾ ĐỘ ---

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
        update(ref(db, `rooms/${currentRoomId}`), { status: "ended", winner: "Đối thủ bỏ cuộc" });
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

// --- LOGIC XỬ LÝ FIREBASE (GIỮ NGUYÊN BẢN CŨ CỦA ANH VÀ THAY ĐỔI HÀM CHUYỂN MÀN HÌNH) ---

// Tạo phòng
document.getElementById('btn-create').addEventListener('click', () => {
    const playerName = document.getElementById('player-name').value.trim() || "Cơ thủ Caro";
    // Lấy tên phòng do anh nhập, nếu để trống thì tự động lấy tên mặc định
    const inputRoomName = document.getElementById('room-name').value.trim() || `Phòng của ${playerName}`;
    const rule = document.getElementById('game-rule').value;
    
    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    currentRoomId = newRoomRef.key;
    myRole = 'X'; 
    currentRule = rule;

    const roomData = {
        id: currentRoomId,
        name: inputRoomName, // Đẩy tên phòng tùy chỉnh lên Firebase
        rule: rule,
        status: "waiting",
        playerX: myClientId,
        playerO: "",
        turn: "X",
        winner: "",
        lastMove: { row: -1, col: -1, by: "" }
    };

    set(newRoomRef, roomData).then(() => {
        startOnlineMatch();
        listenToRoomChanges(currentRoomId);
        onDisconnect(newRoomRef).remove();
    });
});

// Lắng nghe danh sách phòng tại sảnh
onValue(ref(db, 'rooms'), (snapshot) => {
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
            const ruleText = room.rule === 'tu_do' ? 'Tự Do' : 'Chặn 2 Đầu';
            roomEl.innerHTML = `
                <span><b>${room.name}</b> (<small>${ruleText}</small>)</span>
                <button class="btn-join" data-id="${room.id}" style="padding:4px 10px; background:#28a745; color:white; border:none; border-radius:3px; cursor:pointer;">Vào Solo</button>
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
    const roomRef = ref(db, `rooms/${roomId}`);
    update(roomRef, { playerO: myClientId, status: "playing" }).then(() => {
        startOnlineMatch();
        listenToRoomChanges(roomId);
        onDisconnect(roomRef).update({ status: "ended", winner: "X (Đối thủ thoát)" });
    });
}

// Đồng bộ nước đi
function listenToRoomChanges(roomId) {
    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) return;

        currentTurn = room.turn;
        currentRule = room.rule;

        if (room.status === "waiting") {
            gameInfo.innerText = "Đang chờ đối thủ vào phòng...";
        } 
        else if (room.status === "playing") {
            const displayRule = currentRule === 'tu_do' ? 'Tự Do' : 'Chặn 2 Đầu';
            if (currentTurn === myRole) {
                gameInfo.innerHTML = `<span style='color:#28a745; font-weight:bold;'>Lượt của bạn (${myRole})</span> - Luật: ${displayRule}`;
            } else {
                gameInfo.innerHTML = `<span style='color:#dc3545;'>Chờ đối thủ (${currentTurn}) đánh...</span>`;
            }

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

// Đẩy dữ liệu lên Firebase
export function guiNuocDiLenFirebase(row, col) {
    // NẾU KHÔNG PHẢI CHẾ ĐỘ ONLINE -> Cho phép đánh bình thường (Đấu Bot)
    if (!isOnlineMode) return true; 

    if (currentTurn !== myRole) {
        alert("Chưa đến lượt của bạn!");
        return false;
    }
    
    const nextTurn = myRole === 'X' ? 'O' : 'X';
    const roomRef = ref(db, `rooms/${currentRoomId}`);

    let isWin = false; 
    if (typeof checkWin === "function") {
         // Temporarily set the rule for checkWin
         const blockCheckbox = document.getElementById('block-both-ends');
         const originalValue = blockCheckbox ? blockCheckbox.checked : true;
         
         if (blockCheckbox) {
             blockCheckbox.checked = (currentRule === 'chan_2_dau');
         }
         
         isWin = checkWin(row, col);
         
         // Restore original value
         if (blockCheckbox) {
             blockCheckbox.checked = originalValue;
         }
    }

    let winnerValue = isWin ? myRole : "";
    let statusValue = isWin ? "ended" : "playing";

    update(roomRef, {
        turn: nextTurn,
        status: statusValue,
        winner: winnerValue,
        lastMove: { row: row, col: col, by: myRole }
    });
    
    return true;
}

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
}

window.guiNuocDiLenFirebase = guiNuocDiLenFirebase;
window.isOnlineModeActive = () => isOnlineMode;
