// ══════════════════════════════════════════════════════════════════
// ROOM HEALTH SYSTEM v2.0
// Giải quyết ghost player: tính trạng thái từ lastPing thực tế,
// không dùng playerStatus string làm nguồn dữ liệu chính.
// ══════════════════════════════════════════════════════════════════

(function() {
'use strict';

// ── Hằng số ────────────────────────────────────────────────────
const PING_INTERVAL_MS   = 20 * 1000;  // gửi heartbeat mỗi 20 giây
const PING_TIMEOUT_MS    = 60 * 1000;  // mất ping > 60s → coi là ghost
const HEALTH_CHECK_MS    = 30 * 1000;  // health check toàn bộ phòng mỗi 30s
const AFK_WARN_MS        = 2 * 60 * 1000;   // 2 phút không hoạt động → cảnh báo
const AFK_KICK_MS        = 2.5 * 60 * 1000; // 2.5 phút → kick

// ── State ──────────────────────────────────────────────────────
let _pingTimer       = null;
let _healthTimer     = null;
let _afkTimer        = null;
let _lastActivity    = Date.now();
let _afkWarned       = false;
let _db              = null;  // set sau khi firebase ready

// ── Khởi động sau khi Firebase sẵn sàng ───────────────────────
// Gộp tất cả load listeners vào 1 chỗ
window.addEventListener('load', () => {
    // 1. Chờ db được khởi tạo (initFirebase xong)
    const waitDb = setInterval(() => {
        if (typeof db !== 'undefined' && db) {
            _db = db;
            clearInterval(waitDb);
            console.log('[RoomHealth] Firebase ready, khởi động health system');
        }
    }, 500);

    // 2. PATCH hienDanhSachPhong — Tính status TỪ DỮ LIỆU THỰC TẾ
    setTimeout(() => {
        const waitFn = setInterval(() => {
            if (typeof hienDanhSachPhong === 'function' && _db) {
                clearInterval(waitFn);
                _patchRoomListRender();
            }
        }, 300);
    }, 500);

    // 3. PATCH ngoimVaoPhong — Dọn ghost TRƯỚC KHI cho vào phòng
    setTimeout(() => {
        const waitFn2 = setInterval(() => {
            if (typeof ngoimVaoPhong === 'function' && _db) {
                clearInterval(waitFn2);
                _patchNgoimVaoPhong();
            }
        }, 300);
    }, 600);

    // 4. HOOKS: Tự động start/stop heartbeat + AFK khi vào/thoát phòng
    setTimeout(() => {
        const waitHooks = setInterval(() => {
            if (typeof batDauGiaoDienOnline === 'function' && typeof thoatGiaoDienOnline === 'function') {
                clearInterval(waitHooks);
                _hookOnlineEvents();
            }
        }, 400);
    }, 800);

    // 5. Ghi dấu activity khi đánh cờ (makeMove)
    setTimeout(() => {
        const waitMakeMove = setInterval(() => {
            if (typeof makeMove === 'function') {
                clearInterval(waitMakeMove);
                const _origMakeMove = window.makeMove;
                window.makeMove = function() {
                    _touchActivity();
                    return _origMakeMove.apply(this, arguments);
                };
            }
        }, 500);
    }, 1000);
});

// ── Cập nhật lastActivity khi có tương tác ────────────────────
function _touchActivity() {
    _lastActivity = Date.now();
    _afkWarned    = false;
}
window._touchActivity = _touchActivity;

// Lắng nghe các sự kiện user
['mousedown','keydown','touchstart','click'].forEach(evt => {
    document.addEventListener(evt, _touchActivity, { passive: true });
});

// ══════════════════════════════════════════════════════════════════
// HEARTBEAT — Gửi lastPing lên Firebase mỗi 20 giây
// ══════════════════════════════════════════════════════════════════
function startHeartbeat() {
    stopHeartbeat();
    _sendPing(); // gửi ngay lập tức
    _pingTimer = setInterval(_sendPing, PING_INTERVAL_MS);
}

function stopHeartbeat() {
    if (_pingTimer) { clearInterval(_pingTimer); _pingTimer = null; }
}

function _sendPing() {
    if (!_db) return;
    const roomId = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    const role   = (typeof myRole !== 'undefined') ? myRole : null;
    if (!roomId || !role || role === 'viewer') return;

    const now  = Date.now();
    const field = role === 'X' ? 'playerX_lastPing' : 'playerO_lastPing';
    _db.ref(`rooms/${roomId}`).update({ [field]: now, updatedAt: now })
       .catch(() => {}); // im lặng nếu offline
}
window.startHeartbeat = startHeartbeat;
window.stopHeartbeat  = stopHeartbeat;

// ══════════════════════════════════════════════════════════════════
// HELPER: Kiểm tra người chơi có thực sự còn sống không
// Dùng lastPing thay vì playerStatus string
// ══════════════════════════════════════════════════════════════════
function isPlayerAlive(room, role) {
    const now       = Date.now();
    const pingField = role === 'X' ? 'playerX_lastPing' : 'playerO_lastPing';
    const statField = role === 'X' ? 'playerX_status'  : 'playerO_status';
    const lastPing  = room[pingField] || 0;
    const status    = room[statField] || 'offline';

    // Có ping gần đây → sống
    if (lastPing && (now - lastPing) < PING_TIMEOUT_MS) return true;
    // Không có ping nhưng status là online và updatedAt gần → vẫn tạm chấp nhận
    if (status === 'online' && (now - (room.updatedAt || 0)) < PING_TIMEOUT_MS) return true;
    return false;
}
window.isPlayerAlive = isPlayerAlive;

// ── Tính trạng thái THỰC TẾ của phòng từ dữ liệu người chơi ──
function deriveRoomStatus(room) {
    if (!room) return 'empty';

    const hasX    = !!room.playerX_id;
    const hasO    = !!room.playerO_id;
    const xAlive  = hasX && isPlayerAlive(room, 'X');
    const oAlive  = hasO && isPlayerAlive(room, 'O');

    // Phòng đang chơi: chỉ tính là playing nếu có đủ 2 người sống
    if (room.status === 'playing' && xAlive && oAlive) return 'playing';

    // Có người đang chờ
    if (xAlive && oAlive) return 'waiting';
    if (xAlive || oAlive) return 'waiting';

    return 'empty';
}
window.deriveRoomStatus = deriveRoomStatus;

// ══════════════════════════════════════════════════════════════════
// HEALTH CHECK — Dọn ghost player mỗi 30 giây
// Chỉ xóa người KHÔNG còn ping, KHÔNG đụng người đang online
// ══════════════════════════════════════════════════════════════════
function startHealthCheck() {
    stopHealthCheck();
    setTimeout(runHealthCheck, 5000); // chạy lần đầu sau 5s
    _healthTimer = setInterval(runHealthCheck, HEALTH_CHECK_MS);
}

function stopHealthCheck() {
    if (_healthTimer) { clearInterval(_healthTimer); _healthTimer = null; }
}

function runHealthCheck() {
    if (!_db) return;
    const myRoomId = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;

    _db.ref('rooms').once('value').then(snap => {
        const rooms = snap.val();
        if (!rooms) return;

        // Check normal rooms 1-20
        for (let i = 1; i <= 20; i++) {
            const roomId = `phong_${i}`;
            const room   = rooms[roomId];
            if (!room) continue;
            if (roomId === myRoomId) continue; // không dọn phòng mình đang ở

            _healthCheckRoom(roomId, room);
        }
        
        // Check VIP rooms 21-40
        for (let i = 21; i <= 40; i++) {
            const roomId = `phong_${i}`;
            const room   = rooms[roomId];
            if (!room) continue;
            if (roomId === myRoomId) continue; // không dọn phòng mình đang ở

            _healthCheckRoom(roomId, room);
        }
    }).catch(() => {});
}
window.runHealthCheck = runHealthCheck;

function _healthCheckRoom(roomId, room) {
    if (!_db || !room) return;
    const now    = Date.now();
    const hasX   = !!room.playerX_id;
    const hasO   = !!room.playerO_id;
    const xAlive = hasX && isPlayerAlive(room, 'X');
    const oAlive = hasO && isPlayerAlive(room, 'O');

    // Không có ghost → không làm gì
    const hasGhostX = hasX && !xAlive;
    const hasGhostO = hasO && !oAlive;
    if (!hasGhostX && !hasGhostO) return;

    const updates = { updatedAt: now };

    // Xóa ghost X
    if (hasGhostX) {
        console.log(`[HealthCheck] Phòng ${roomId}: Ghost X "${room.playerX_name}" → xóa`);
        updates.playerX_id     = '';
        updates.playerX_name   = '';
        updates.playerX_status = 'offline';
        updates.playerX_lastPing = null;
    }

    // Xóa ghost O
    if (hasGhostO) {
        console.log(`[HealthCheck] Phòng ${roomId}: Ghost O "${room.playerO_name}" → xóa`);
        updates.playerO_id     = '';
        updates.playerO_name   = '';
        updates.playerO_status = 'offline';
        updates.playerO_lastPing = null;
    }

    // Tính lại trạng thái sau khi xóa ghost
    const remainX = hasGhostX ? false : xAlive;
    const remainO = hasGhostO ? false : oAlive;

    if (!remainX && !remainO) {
        // Không còn ai → reset hoàn toàn
        updates.status    = 'empty';
        updates.winner    = '';
        updates.endReason = '';
        updates.moves     = { init: true };
        updates.lastMove  = { row: -1, col: -1, by: '' };
        updates.betAmount = null;
        updates.betPot    = null;
        updates.guestReady = false;
        // DO7.TXT: OLD STATE MACHINE - DEPRECATED (use guestReady instead)
        updates.playerXConfirmed = null;
        updates.playerOConfirmed = null;
    } else if (remainO && !remainX && hasGhostX) {
        // Chỉ còn O → O lên làm X (chủ phòng mới)
        console.log(`[HealthCheck] Phòng ${roomId}: chỉ còn O → O thành chủ phòng mới`);
        updates.playerX_id     = room.playerO_id;
        updates.playerX_name   = room.playerO_name;
        updates.playerX_status = room.playerO_status;
        updates.playerX_lastPing = room.playerO_lastPing || null;
        updates.playerO_id     = '';
        updates.playerO_name   = '';
        updates.playerO_status = 'offline';
        updates.playerO_lastPing = null;
        updates.status         = 'waiting';
        updates.winner         = '';
        updates.endReason      = '';
        updates.guestReady     = false;  // slot O mới trống, reset
    } else {
        // Vẫn còn người chơi hợp lệ
        updates.status = (remainX && remainO) ? (room.status || 'waiting') : 'waiting';
        if (updates.status === 'playing' && (!remainX || !remainO)) {
            updates.status = 'waiting'; // không thể chơi nếu thiếu người
        }
    }

    _db.ref(`rooms/${roomId}`).update(updates).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════
// AFK DETECTION — Cảnh báo và kick sau 2–2.5 phút không hoạt động
// ══════════════════════════════════════════════════════════════════
function startAfkDetection() {
    stopAfkDetection();
    _afkTimer = setInterval(_checkAfk, 15000); // kiểm tra mỗi 15s
}

function stopAfkDetection() {
    if (_afkTimer) { clearInterval(_afkTimer); _afkTimer = null; }
}

function _checkAfk() {
    const roomId = (typeof currentRoomId !== 'undefined') ? currentRoomId : null;
    const role   = (typeof myRole !== 'undefined') ? myRole : null;
    if (!roomId || !role || role === 'viewer') return;

    const idle = Date.now() - _lastActivity;

    if (!_afkWarned && idle >= AFK_WARN_MS) {
        _afkWarned = true;
        const secLeft = Math.round((AFK_KICK_MS - idle) / 1000);
        _showAfkWarning(secLeft > 0 ? secLeft : 30);
    }

    if (idle >= AFK_KICK_MS) {
        console.log('[RoomHealth] AFK timeout → tự động rời phòng');
        _hideAfkWarning();
        stopAfkDetection();
        if (typeof xuLyThoatPhong === 'function') xuLyThoatPhong();
    }
}

function _showAfkWarning(secLeft) {
    let box = document.getElementById('afk-warning-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'afk-warning-box';
        box.style.cssText = [
            'position:fixed','bottom:80px','left:50%','transform:translateX(-50%)',
            'background:#1e293b','color:#fbbf24','border:2px solid #f59e0b',
            'border-radius:12px','padding:14px 24px','z-index:99999',
            'font-size:14px','font-weight:700','text-align:center',
            'box-shadow:0 8px 32px rgba(0,0,0,.5)','min-width:280px'
        ].join(';');
        document.body.appendChild(box);
    }
    box.innerHTML = `
        ⚠️ Bạn đang không hoạt động!<br>
        <span style="font-size:12px;color:#94a3b8;">Sẽ rời phòng trong ~${secLeft}s nếu không có tương tác</span><br>
        <button onclick="window._touchActivity();document.getElementById('afk-warning-box').remove()"
            style="margin-top:8px;padding:6px 20px;background:#10b981;color:#fff;border:none;
                   border-radius:20px;cursor:pointer;font-weight:700;font-size:13px;">
            Tôi vẫn ở đây ✋
        </button>
    `;
}

function _hideAfkWarning() {
    const box = document.getElementById('afk-warning-box');
    if (box) box.remove();
}
window._hideAfkWarning = _hideAfkWarning;

// ══════════════════════════════════════════════════════════════════
// PATCH hienDanhSachPhong — Tính status TỪ DỮ LIỆU THỰC TẾ
// Override render để dùng deriveRoomStatus thay vì room.status
// ══════════════════════════════════════════════════════════════════
// Đã gộp vào window.addEventListener('load' chính (dòng 27)

function _patchRoomListRender() {
    const _origHien = window.hienDanhSachPhong;
    window.hienDanhSachPhong = function() {
        if (!_db) { _origHien.apply(this, arguments); return; }

        const container = document.getElementById('room-list');
        if (!container) return;

        // Hủy listener cũ
        if (typeof roomsListListener !== 'undefined' && roomsListListener) {
            _db.ref('rooms').off('value', roomsListListener);
        }

        // Listener mới — tính status từ thực tế
        const newListener = _db.ref('rooms').on('value', snap => {
            if (!document.getElementById('lobby-screen') ||
                document.getElementById('lobby-screen').style.display === 'none') return;

            const rooms = snap.val();
            container.innerHTML = '';
            const myId = localStorage.getItem('current_user_id');

            for (let i = 1; i <= 20; i++) {
                const roomId = `phong_${i}`;
                const room   = (rooms && rooms[roomId]) || (typeof taoDataPhongRong === 'function' ? taoDataPhongRong(i) : {});

                // ── TÍNH STATUS TỪ THỰC TẾ ──
                const derived = deriveRoomStatus(room);

                const el = document.createElement('div');
                el.style.cssText = 'padding:10px;margin:5px 0;border:1px solid #ccc;border-radius:6px;display:flex;justify-content:space-between;align-items:center;';

                const laTrongPhong = (myId === room.playerX_id || myId === room.playerO_id);
                let statusTxt = '', bgColor = '#f8f9fa', borderColor = '#ddd', nutHtml = '';

                // Người chơi sống thực sự
                const xAlive = !!room.playerX_id && isPlayerAlive(room, 'X');
                const oAlive = !!room.playerO_id && isPlayerAlive(room, 'O');

                if (derived === 'empty') {
                    statusTxt = '🟢 Trống';
                    nutHtml   = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Phòng</button>`;
                } else if (derived === 'playing') {
                    bgColor = '#fff3e0'; borderColor = '#ff9800';
                    statusTxt = '⚔️ Đang chơi';
                    if (laTrongPhong) {
                        nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:#ff9800;color:white;border:none;border-radius:4px;cursor:pointer;">🔄 Vào lại</button>`;
                    } else {
                        nutHtml = `<button onclick="xemPhong('${roomId}')" style="padding:6px 14px;background:#17a2b8;color:white;border:none;border-radius:4px;cursor:pointer;">👁️ Xem</button>`;
                    }
                } else { // waiting
                    bgColor = '#e8f5e9'; borderColor = '#4caf50';
                    statusTxt = '⏳ Chờ bắt đầu';
                    if (laTrongPhong) {
                        nutHtml = `<button onclick="vaoLaiPhong('${roomId}')" style="padding:6px 14px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;">Vào lại</button>`;
                    } else if (!oAlive) {
                        nutHtml = `<button onclick="ngoimVaoPhong('${roomId}')" style="padding:6px 14px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Vào Solo</button>`;
                    } else {
                        nutHtml = `<span style="color:#aaa;font-size:12px;">Đầy</span>`;
                    }
                }

                el.style.backgroundColor = bgColor;
                el.style.borderColor     = borderColor;
                const xN  = (xAlive && room.playerX_name) ? room.playerX_name : '---';
                const oN  = (oAlive && room.playerO_name) ? room.playerO_name : '---';
                const wc  = room.winCount || 5;
                const c2d = room.chan2Dau ?? true;
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

            // Patch guard sau mỗi lần render
            if (typeof _patchRoomButtons === 'function') setTimeout(_patchRoomButtons, 50);
        });

        // Ghi đè roomsListListener toàn cục (để cleanup đúng)
        if (typeof window !== 'undefined') window._newRoomsListListener = newListener;
        try { roomsListListener = newListener; } catch(e) {}
    };

    console.log('[RoomHealth] hienDanhSachPhong patched — dùng deriveRoomStatus');
}

// ══════════════════════════════════════════════════════════════════
// PATCH ngoimVaoPhong — Dọn ghost TRƯỚC KHI cho vào phòng
// ══════════════════════════════════════════════════════════════════
// Đã gộp vào window.addEventListener('load' chính (dòng 27)

function _patchNgoimVaoPhong() {
    const _origNgoi = window.ngoimVaoPhong;
    window.ngoimVaoPhong = function(roomId) {
        console.log('[RoomHealth-Patch] ngoimVaoPhong called with roomId:', roomId);
        if (!_db) { 
            console.log('[RoomHealth-Patch] _db not available, calling original');
            _origNgoi.apply(this, arguments); 
            return; 
        }

        // Đọc room trước để kiểm tra ghost
        _db.ref(`rooms/${roomId}`).once('value').then(snap => {
            const room = snap.val();
            console.log('[RoomHealth-Patch] Room data:', room);
            if (!room) { 
                console.log('[RoomHealth-Patch] Room not found, calling original');
                _origNgoi.apply(this, [roomId]); 
                return; 
            }

            const xAlive = !!room.playerX_id && isPlayerAlive(room, 'X');
            const oAlive = !!room.playerO_id && isPlayerAlive(room, 'O');
            const now    = Date.now();
            console.log('[RoomHealth-Patch] Player status:', { xAlive, oAlive, playerX_id: room.playerX_id, playerO_id: room.playerO_id });

            // Nếu có ghost → dọn trước rồi mới vào
            if ((room.playerX_id && !xAlive) || (room.playerO_id && !oAlive)) {
                const cleanUpdates = { updatedAt: now };
                if (room.playerX_id && !xAlive) {
                    cleanUpdates.playerX_id = ''; cleanUpdates.playerX_name = '';
                    cleanUpdates.playerX_status = 'offline'; cleanUpdates.playerX_lastPing = null;
                }
                if (room.playerO_id && !oAlive) {
                    cleanUpdates.playerO_id = ''; cleanUpdates.playerO_name = '';
                    cleanUpdates.playerO_status = 'offline'; cleanUpdates.playerO_lastPing = null;
                }
                // Nếu không còn ai sau khi dọn → reset status
                const afterX = room.playerX_id && !xAlive ? false : xAlive;
                const afterO = room.playerO_id && !oAlive ? false : oAlive;
                if (!afterX && !afterO) {
                    cleanUpdates.status = 'empty';
                    cleanUpdates.winner = ''; cleanUpdates.endReason = '';
                    cleanUpdates.moves = { init: true };
                    cleanUpdates.lastMove = { row: -1, col: -1, by: '' };
                }
                console.log(`[RoomHealth-Patch] Dọn ghost trong phòng ${roomId} trước khi vào`, cleanUpdates);
                _db.ref(`rooms/${roomId}`).update(cleanUpdates).then(() => {
                    console.log('[RoomHealth-Patch] Ghost cleaned, calling original ngoimVaoPhong');
                    _origNgoi.apply(window, [roomId]);
                }).catch(err => {
                    console.error('[RoomHealth-Patch] Error cleaning ghost:', err);
                    _origNgoi.apply(window, [roomId]); 
                });
            } else {
                // Không có ghost → vào thẳng
                console.log('[RoomHealth-Patch] No ghost, calling original ngoimVaoPhong');
                _origNgoi.apply(window, [roomId]);
            }
        }).catch(err => {
            console.error('[RoomHealth-Patch] Error reading room:', err);
            _origNgoi.apply(window, [roomId]); 
        });
    };
    console.log('[RoomHealth] ngoimVaoPhong patched — tự dọn ghost trước khi vào');
}

// ══════════════════════════════════════════════════════════════════
// HOOKS: Tự động start/stop heartbeat + AFK khi vào/thoát phòng
// ══════════════════════════════════════════════════════════════════
// Đã gộp vào window.addEventListener('load' chính (dòng 27)

function _hookOnlineEvents() {
    // Patch batDauGiaoDienOnline → bắt đầu heartbeat + AFK
    // Dùng event-style thay vì override trực tiếp để tránh conflict với index.html bridge
    const _origBat = window.batDauGiaoDienOnline;
    window.batDauGiaoDienOnline = function() {
        if (typeof _origBat === 'function') _origBat.apply(this, arguments);
        startHeartbeat();
        startAfkDetection();
        _touchActivity();
    };

    // Patch thoatGiaoDienOnline: thêm cleanup vào TRƯỚC khi các override khác chạy
    // Dùng wrapper chain an toàn
    const _origThoat = window.thoatGiaoDienOnline;
    window.thoatGiaoDienOnline = function() {
        stopHeartbeat();
        stopAfkDetection();
        _hideAfkWarning();
        if (typeof _origThoat === 'function') _origThoat.apply(this, arguments);
        // Sau khi thoát xong → chạy health check ngay để dọn phòng vừa rời
        setTimeout(runHealthCheck, 500);
    };

    // Bắt đầu health check định kỳ ngay khi có db
    const waitDb3 = setInterval(() => {
        if (_db) {
            clearInterval(waitDb3);
            startHealthCheck();
        }
    }, 1000);

    console.log('[RoomHealth] Hooks gắn thành công');
}

// Ghi dấu activity khi đánh cờ (makeMove)
// Đã gộp vào window.addEventListener('load' chính (dòng 27)

console.log('[RoomHealth] room-health.js loaded');

})(); // end IIFE
