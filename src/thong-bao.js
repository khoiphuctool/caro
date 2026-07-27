// ===== THANH THÔNG BÁO TOÀN CỤC (GLOBAL NOTIFICATION TICKER) =====
// Ticker cố định ở top màn hình, hiển thị mọi lúc kể cả trong trận

let notificationQueue = [];   // chờ hiển thị
let notificationCache = new Map();
let notificationListenersStarted = false;
let welcomeShown = false;
let tickerRunning = false;    // đang cuộn hay không

const DEDUPE_TIME = 20000;
const MAX_QUEUE = 8;

// ── Thêm thông báo vào queue ──
function addNotification(type, message) {
    if (!message) return;
    const cacheKey = `${type}_${message}`;
    const now = Date.now();

    const lastShown = notificationCache.get(cacheKey) || 0;
    if (now - lastShown < DEDUPE_TIME) return;
    notificationCache.set(cacheKey, now);

    for (const [k, t] of notificationCache) {
        if (now - t > DEDUPE_TIME) notificationCache.delete(k);
    }

    notificationQueue.push({ type, message });
    if (notificationQueue.length > MAX_QUEUE) notificationQueue.shift();

    // Nếu ticker đang ẩn thì khởi động lại, còn đang chạy thì để tự nhiên
    if (!tickerRunning) _startTicker();
}

// ── Lấy batch hiện tại và cuộn 1 lần ──
function _startTicker() {
    if (notificationQueue.length === 0) return;

    const ticker  = document.getElementById('notification-ticker');
    const content = document.getElementById('ticker-content');
    if (!ticker || !content) return;

    // Snapshot toàn bộ queue hiện tại vào ticker
    const batch = notificationQueue.splice(0);

    const fragment = document.createDocumentFragment();
    batch.forEach((notif, i) => {
        const span = document.createElement('span');
        span.className = `ticker-item ${notif.type}`;
        span.textContent = notif.message;
        fragment.appendChild(span);
        if (i < batch.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'ticker-sep';
            sep.textContent = ' ✦ ';
            fragment.appendChild(sep);
        }
    });
    content.replaceChildren(fragment);

    // Tính duration theo độ dài text
    const charCount = batch.reduce((s, n) => s + n.message.length, 0);
    const duration  = Math.max(15, Math.min(50, charCount * 0.25));

    // Reset animation
    content.style.animation = 'none';
    content.offsetHeight; // force reflow
    content.style.animation = '';
    content.style.animationDuration = `${duration}s`;

    tickerRunning = true;
    ticker.classList.add('has-content');
    document.body.classList.add('ticker-on');
}

// ── Sau khi cuộn xong: ẩn hoặc chạy tiếp nếu có thông báo mới vào trong lúc đang chạy ──
(function _setupTickerEnd() {
    function init() {
        const content = document.getElementById('ticker-content');
        if (!content) { window.addEventListener('load', init, { once: true }); return; }
        content.addEventListener('animationend', () => {
            tickerRunning = false;
            if (notificationQueue.length > 0) {
                // Có thông báo mới vào trong lúc đang cuộn → chạy tiếp ngay
                _startTicker();
            } else {
                // Hết thông báo → ẩn
                const ticker = document.getElementById('notification-ticker');
                if (ticker) ticker.classList.remove('has-content');
                document.body.classList.remove('ticker-on');
            }
        });
    }
    init();
})();

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

    // Lắng nghe history chỉ cho thắng bot (tránh trùng với match_results cho trận online)
    db.ref('history').limitToLast(5).on('child_added', snap => {
        const match = snap.val();
        if (!match || !match.timestamp) return;
        if (Date.now() - match.timestamp > 60000) return; // chỉ kết quả trong 1 phút

        const xWon = match.winner === 'X';
        const winnerName = xWon ? match.playerX : match.playerO;
        const loserName  = xWon ? match.playerO : match.playerX;
        if (!winnerName || !loserName) return;

        // Chỉ thông báo khi thắng bot (bỏ qua PvP vì match_results đã xử lý)
        const isBot = loserName.startsWith('🤖') || loserName.toLowerCase().includes('bot');
        if (isBot) {
            addNotification('win', `🏆 ${winnerName} vừa xuất sắc vượt qua ${loserName}!`);
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
    welcomeShown = true; // Đã đăng nhập rồi, không cần hiển thị welcome cho guest nữa
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
