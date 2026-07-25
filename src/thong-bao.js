// ===== THANH THÔNG BÁO (NOTIFICATION TICKER) =====

// Queue thông báo
let notificationQueue = [];
let maxNotifications = 5; // Số thông báo tối đa hiển thị cùng lúc
let notificationCache = new Map(); // Cache chống lặp tạm thời, không chặn vĩnh viễn
let welcomeShown = false; // Flag để chỉ hiển thị thông báo chào mừng 1 lần
let tickerTimeout = null; // Timeout để tự động ẩn
let notificationListenersStarted = false;
const DISPLAY_TIME = 4000; // Hiển thị 4 giây
const DEDUPE_TIME = 30000; // Không lặp cùng nội dung trong 30 giây

// Thêm thông báo vào queue
function addNotification(type, message) {
    // Tạo cache key để tránh trùng lặp
    const cacheKey = `${type}_${message}`;
    const now = Date.now();
    const lastShown = notificationCache.get(cacheKey) || 0;
    if (now - lastShown < DEDUPE_TIME) return;
    notificationCache.set(cacheKey, now);

    // Giới hạn cache để phiên chạy lâu không tăng bộ nhớ vô hạn.
    for (const [key, timestamp] of notificationCache) {
        if (now - timestamp > DEDUPE_TIME) notificationCache.delete(key);
    }
    
    const notification = {
        type: type, // 'online', 'win', 'chat'
        message: message,
        timestamp: now
    };
    
    notificationQueue.push(notification);
    
    // Giới hạn số lượng thông báo
    if (notificationQueue.length > maxNotifications) {
        notificationQueue.shift();
    }
    
    updateTicker();
    
    // Tự động ẩn sau 4 giây (chỉ reset khi thực sự có thông báo mới)
    if (tickerTimeout) clearTimeout(tickerTimeout);
    tickerTimeout = setTimeout(() => {
        const ticker = document.getElementById('notification-ticker');
        if (ticker) {
            ticker.style.display = 'none';
            notificationQueue = [];
        }
    }, DISPLAY_TIME);
}

// Cập nhật nội dung ticker
function updateTicker() {
    const ticker = document.getElementById('notification-ticker');
    const content = document.getElementById('ticker-content');
    
    if (!ticker || !content) return;
    
    if (notificationQueue.length === 0) {
        ticker.style.display = 'none';
        return;
    }
    
    ticker.style.display = 'block';
    
    // Hiển thị tất cả thông báo
    // Dùng textContent thay vì innerHTML để tên/tin nhắn người dùng không thể chèn HTML.
    content.replaceChildren(...notificationQueue.map(notif => {
        const item = document.createElement('span');
        item.className = `ticker-item ${notif.type}`;
        item.textContent = notif.message;
        return item;
    }));
}

// ===== LISTENER CHO ONLINE/OFFLINE =====
function setupOnlineNotificationListener() {
    // Sử dụng db từ firebase-online.js (global variable)
    if (typeof db === 'undefined' || !db) return;
    
    const myId = localStorage.getItem('current_user_id');
    if (!myId) return;
    
    // child_added chỉ báo người vừa xuất hiện; tránh báo lại cả danh sách khi một user đổi trạng thái.
    db.ref('online_users').on('child_added', snap => {
        if (snap.key === myId) return;
        const user = snap.val();
        if (!user || Date.now() - user.lastActive >= 30000) return;
        const displayName = user.displayName || user.username || 'Người chơi';
        addNotification('online', `🟢 ${displayName} vừa online!`);
    });
}

// ===== LISTENER CHO THẮNG/THUA =====
function setupWinNotificationListener() {
    // Sử dụng db từ firebase-online.js
    if (typeof db === 'undefined' || !db) return;
    
    // Lịch sử thực tế được ghi ở `history` bởi firebase-online.js.
    db.ref('history').limitToLast(10).on('child_added', snap => {
        const match = snap.val();
        if (!match) return;
        
        // Chỉ hiển thị trận đấu kết thúc trong 1 phút
        if (Date.now() - match.timestamp > 60000) return;
        
        const xWon = match.winner === 'X';
        const winnerName = xWon ? match.playerX : match.playerO;
        const loserName = xWon ? match.playerO : match.playerX;
        if (!winnerName || !loserName) return;
        const winCount = match.winCount || 5;
        
        addNotification('win', `🏆 ${winnerName} thắng ${loserName} (${winCount} quân)`);
    });
}

// Thanh thông báo góc bàn cờ CHỈ dùng cho:
// - Lời thoại bot (offline)
// - Trạng thái chiến đấu online ("Đã kết nối", "Đến lượt bạn", "[Tên] chiến thắng")
// KHÔNG đưa chat thế giới vào đây.

// ===== KHỞI TẠO =====
function initNotificationTicker() {
    const myId = localStorage.getItem('current_user_id');
    
    if (!myId) {
        // Người chưa đăng nhập - chỉ hiển thị thông báo chung 1 lần
        if (!welcomeShown) {
            addNotification('online', '🎮 Chào mừng đến với Caro! Đăng nhập để chơi online và nhận thông báo.');
            welcomeShown = true;
        }
        return;
    }
    
    // Người đã đăng nhập - setup các listener (cần Firebase)
    if (typeof db !== 'undefined' && db && !notificationListenersStarted) {
        notificationListenersStarted = true;
        setupOnlineNotificationListener();
        setupWinNotificationListener();
        // Chat thế giới KHÔNG hiện trên thanh thông báo bàn cờ
    }
}

// Export functions để gọi từ nơi khác
window.addNotification = addNotification;
window.initNotificationTicker = initNotificationTicker;

// Gọi ngay khi trang load (không cần đợi Firebase)
window.addEventListener('load', () => {
    setTimeout(initNotificationTicker, 1000);
});
