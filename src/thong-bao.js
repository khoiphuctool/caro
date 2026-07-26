// ===== THANH THÔNG BÁO TOÀN CỤC (GLOBAL NOTIFICATION TICKER) =====
// Ticker cố định ở top màn hình, hiển thị mọi lúc kể cả trong trận

let notificationQueue = [];
let notificationCache = new Map();
let notificationListenersStarted = false;
let welcomeShown = false;
let _tickerAnimDuration = 30; // giây, tự điều chỉnh theo số lượng thông báo

const DEDUPE_TIME = 20000; // không lặp cùng nội dung trong 20 giây
const MAX_QUEUE = 8;

// ── Thêm thông báo vào queue và cập nhật ticker ──
function addNotification(type, message) {
    if (!message) return;
    const cacheKey = `${type}_${message}`;
    const now = Date.now();

    // Dedup
    const lastShown = notificationCache.get(cacheKey) || 0;
    if (now - lastShown < DEDUPE_TIME) return;
    notificationCache.set(cacheKey, now);

    // Dọn cache cũ
    for (const [k, t] of notificationCache) {
        if (now - t > DEDUPE_TIME) notificationCache.delete(k);
    }

    notificationQueue.push({ type, message });
    if (notificationQueue.length > MAX_QUEUE) notificationQueue.shift();

    _renderTicker();
}

// ── Render ticker marquee ──
function _renderTicker() {
    const ticker  = document.getElementById('notification-ticker');
    const content = document.getElementById('ticker-content');
    if (!ticker || !content) return;

    if (notificationQueue.length === 0) {
        ticker.classList.remove('has-content');
        document.body.classList.remove('ticker-on');
        return;
    }

    // Build nội dung: các item cách nhau bằng dấu phân cách
    const fragment = document.createDocumentFragment();
    notificationQueue.forEach((notif, i) => {
        const span = document.createElement('span');
        span.className = `ticker-item ${notif.type}`;
        span.textContent = notif.message;
        fragment.appendChild(span);

        // Dấu phân cách giữa các item
        if (i < notificationQueue.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'ticker-sep';
            sep.textContent = ' ✦ ';
            fragment.appendChild(sep);
        }
    });
    content.replaceChildren(fragment);

    // Điều chỉnh tốc độ scroll theo độ dài nội dung
    const charCount = notificationQueue.reduce((s, n) => s + n.message.length, 0);
    const duration = Math.max(15, Math.min(50, charCount * 0.25));
    content.style.animationDuration = `${duration}s`;

    ticker.classList.add('has-content');
    document.body.classList.add('ticker-on');
}

// ── Listeners ──

function setupOnlineNotificationListener() {
    if (typeof db === 'undefined' || !db) return;
    const myId = localStorage.getItem('current_user_id');
    if (!myId) return;

    db.ref('online_users').on('child_added', snap => {
        if (snap.key === myId) return;
        const user = snap.val();
        if (!user || Date.now() - user.lastActive >= 30000) return;
        const name = user.displayName || user.username || 'Người chơi';
        addNotification('online', `🟢 ${name} vừa trực tuyến`);
    });
}

function setupWinNotificationListener() {
    if (typeof db === 'undefined' || !db) return;

    // Lắng nghe node match_results (broadcast từ firebase-online.js khi kết thúc trận)
    const startTs = Date.now();
    db.ref('match_results').orderByChild('ts').limitToLast(5)
        .on('child_added', snap => {
            const res = snap.val();
            if (!res || !res.msg || res.ts < startTs) return;
            addNotification('win', res.msg);
        });

    // Cũng lắng nghe history cho thắng bot / PvP cũ
    db.ref('history').limitToLast(5).on('child_added', snap => {
        const match = snap.val();
        if (!match || !match.timestamp) return;
        if (Date.now() - match.timestamp > 60000) return; // chỉ kết quả trong 1 phút

        const xWon = match.winner === 'X';
        const winnerName = xWon ? match.playerX : match.playerO;
        const loserName  = xWon ? match.playerO : match.playerX;
        if (!winnerName || !loserName) return;

        // Phân biệt thắng bot hay PvP
        const isBot = loserName.startsWith('🤖') || loserName.toLowerCase().includes('bot');
        if (isBot) {
            addNotification('win', `🏆 ${winnerName} vừa xuất sắc vượt qua ${loserName}!`);
        } else {
            addNotification('win', `⚔️ ${winnerName} đã đánh bại ${loserName}!`);
        }
    });
}

// ── Khởi tạo ──
function initNotificationTicker() {
    const myId = localStorage.getItem('current_user_id');

    if (!myId) {
        if (!welcomeShown) {
            addNotification('online', '🎮 Chào mừng đến Caro Online! Đăng nhập để chơi và nhận thưởng.');
            welcomeShown = true;
        }
        return;
    }

    if (typeof db !== 'undefined' && db && !notificationListenersStarted) {
        notificationListenersStarted = true;
        setupOnlineNotificationListener();
        setupWinNotificationListener();
    }
}

// Gọi lại initNotificationTicker sau khi đăng nhập thành công
function reinitTickerAfterLogin(displayName) {
    welcomeShown = false;
    notificationListenersStarted = false;
    const name = displayName || 'bạn';
    addNotification('welcome', `🎉 Chào mừng ${name} đã quay lại! Chúc ${name} một ngày vui vẻ!`);
    initNotificationTicker();
}

// Export
window.addNotification      = addNotification;
window.initNotificationTicker = initNotificationTicker;
window.reinitTickerAfterLogin = reinitTickerAfterLogin;

window.addEventListener('load', () => setTimeout(initNotificationTicker, 800));
