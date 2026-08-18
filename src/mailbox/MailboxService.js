// ══════════════════════════════════════════════════════════════════
// MAILBOX SERVICE - HỆ THỐNG HỘP THƯ NHÂN VẬT
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// CẤU HÌNH & STATE
// ──────────────────────────────────────────────
let _mailboxDb = null;
let _mailboxUid = null;
let _inboxListener = null;
let _unreadCountListener = null;
let _unreadCount = 0;

// ──────────────────────────────────────────────
// KHỞI TẠO MAILBOX SERVICE
// ──────────────────────────────────────────────
function initMailboxService(database, uid) {
    _mailboxDb = database;
    _mailboxUid = uid;
    
    // Bắt đầu lắng nghe số tin chưa đọc
    startUnreadCountListener();
    
    console.log('[MailboxService] Initialized for uid:', uid);
}
window.initMailboxService = initMailboxService;

// ──────────────────────────────────────────────
// GỬI TIN NHẮN
// ──────────────────────────────────────────────
async function sendMail(toUid, content, type = 'user') {
    if (!_mailboxDb || !_mailboxUid) {
        console.error('[MailboxService] Not initialized');
        return { success: false, error: 'Not initialized' };
    }

    try {
        const messageId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        const timestamp = Date.now();
        
        // Lấy thông tin người gửi
        const senderSnapshot = await _mailboxDb.ref(`users/${_mailboxUid}`).once('value');
        const senderData = senderSnapshot.val() || {};
        const senderName = senderData.displayName || senderData.username || 'Người chơi';

        // Lấy thông tin người nhận
        const receiverSnapshot = await _mailboxDb.ref(`users/${toUid}`).once('value');
        const receiverData = receiverSnapshot.val() || {};
        const receiverName = receiverData.displayName || receiverData.username || 'Người chơi';

        // Ghi vào inbox của người nhận
        await _mailboxDb.ref(`users/${toUid}/inbox/${messageId}`).set({
            fromUid: _mailboxUid,
            fromName: senderName,
            content: content,
            timestamp: timestamp,
            read: false,
            type: type
        });

        // Ghi vào outbox của người gửi
        await _mailboxDb.ref(`users/${_mailboxUid}/outbox/${messageId}`).set({
            toUid: toUid,
            toName: receiverName,
            content: content,
            timestamp: timestamp,
            type: type
        });

        // Tăng số tin chưa đọc của người nhận
        await _mailboxDb.ref(`users/${toUid}/unreadCount`).transaction(count => (count || 0) + 1);

        console.log('[MailboxService] Mail sent to', toUid);
        return { success: true, messageId };
    } catch (error) {
        console.error('[MailboxService] Error sending mail:', error);
        return { success: false, error: error.message };
    }
}
window.sendMail = sendMail;

// ──────────────────────────────────────────────
// GỬI TIN HỆ THỐNG (tự động khi +/- xu)
// ──────────────────────────────────────────────
async function sendSystemMail(uid, content, type = 'system') {
    if (!_mailboxDb) {
        console.error('[MailboxService] Database not initialized');
        return { success: false, error: 'Database not initialized' };
    }

    try {
        const messageId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        const timestamp = Date.now();

        // Ghi vào inbox của user
        await _mailboxDb.ref(`users/${uid}/inbox/${messageId}`).set({
            fromUid: 'system',
            fromName: 'Hệ Thống',
            content: content,
            timestamp: timestamp,
            read: false,
            type: type
        });

        // Tăng số tin chưa đọc
        await _mailboxDb.ref(`users/${uid}/unreadCount`).transaction(count => (count || 0) + 1);

        console.log('[MailboxService] System mail sent to', uid);
        return { success: true, messageId };
    } catch (error) {
        console.error('[MailboxService] Error sending system mail:', error);
        return { success: false, error: error.message };
    }
}
window.sendSystemMail = sendSystemMail;

// ──────────────────────────────────────────────
// ĐÁNH DẤU ĐÃ ĐỌC
// ──────────────────────────────────────────────
async function markAsRead(messageId) {
    if (!_mailboxDb || !_mailboxUid) {
        console.error('[MailboxService] Not initialized');
        return { success: false, error: 'Not initialized' };
    }

    try {
        const messageRef = _mailboxDb.ref(`users/${_mailboxUid}/inbox/${messageId}`);
        const snapshot = await messageRef.once('value');
        const message = snapshot.val();

        if (!message) {
            return { success: false, error: 'Message not found' };
        }

        if (!message.read) {
            await messageRef.update({ read: true });
            await _mailboxDb.ref(`users/${_mailboxUid}/unreadCount`).transaction(count => Math.max(0, (count || 0) - 1));
        }

        console.log('[MailboxService] Message marked as read:', messageId);
        return { success: true };
    } catch (error) {
        console.error('[MailboxService] Error marking as read:', error);
        return { success: false, error: error.message };
    }
}
window.markAsRead = markAsRead;

// ──────────────────────────────────────────────
// MARK ALL AS READ
// ──────────────────────────────────────────────
async function markAllAsRead() {
    if (!_mailboxDb || !_mailboxUid) {
        console.error('[MailboxService] Not initialized');
        return { success: false, error: 'Not initialized' };
    }

    try {
        const inboxRef = _mailboxDb.ref(`users/${_mailboxUid}/inbox`);
        const snapshot = await inboxRef.once('value');
        const inbox = snapshot.val() || {};

        const updates = {};
        for (const messageId in inbox) {
            if (!inbox[messageId].read) {
                updates[`${messageId}/read`] = true;
            }
        }

        if (Object.keys(updates).length > 0) {
            await inboxRef.update(updates);
            await _mailboxDb.ref(`users/${_mailboxUid}/unreadCount`).set(0);
        }

        console.log('[MailboxService] All messages marked as read');
        return { success: true };
    } catch (error) {
        console.error('[MailboxService] Error marking all as read:', error);
        return { success: false, error: error.message };
    }
}
window.markAllAsRead = markAllAsRead;

// ──────────────────────────────────────────────
// LẤY DANH SÁCH TIN NHẬN
// ──────────────────────────────────────────────
async function getInbox(limit = 50) {
    if (!_mailboxDb || !_mailboxUid) {
        console.error('[MailboxService] Not initialized');
        return [];
    }

    try {
        const snapshot = await _mailboxDb.ref(`users/${_mailboxUid}/inbox`)
            .orderByChild('timestamp')
            .limitToLast(limit)
            .once('value');
        
        const inbox = snapshot.val() || {};
        const messages = Object.entries(inbox)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        return messages;
    } catch (error) {
        console.error('[MailboxService] Error getting inbox:', error);
        return [];
    }
}
window.getInbox = getInbox;

// ──────────────────────────────────────────────
// LẤY DANH SÁCH TIN GỬI
// ──────────────────────────────────────────────
async function getOutbox(limit = 50) {
    if (!_mailboxDb || !_mailboxUid) {
        console.error('[MailboxService] Not initialized');
        return [];
    }

    try {
        const snapshot = await _mailboxDb.ref(`users/${_mailboxUid}/outbox`)
            .orderByChild('timestamp')
            .limitToLast(limit)
            .once('value');
        
        const outbox = snapshot.val() || {};
        const messages = Object.entries(outbox)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        return messages;
    } catch (error) {
        console.error('[MailboxService] Error getting outbox:', error);
        return [];
    }
}
window.getOutbox = getOutbox;

// ──────────────────────────────────────────────
// XÓA TIN NHẮN
// ──────────────────────────────────────────────
async function deleteMessage(messageId, box = 'inbox') {
    if (!_mailboxDb || !_mailboxUid) {
        console.error('[MailboxService] Not initialized');
        return { success: false, error: 'Not initialized' };
    }

    try {
        const messageRef = _mailboxDb.ref(`users/${_mailboxUid}/${box}/${messageId}`);
        const snapshot = await messageRef.once('value');
        const message = snapshot.val();

        if (!message) {
            return { success: false, error: 'Message not found' };
        }

        // Nếu xóa tin chưa đọc, giảm số chưa đọc
        if (box === 'inbox' && !message.read) {
            await _mailboxDb.ref(`users/${_mailboxUid}/unreadCount`).transaction(count => Math.max(0, (count || 0) - 1));
        }

        await messageRef.remove();

        console.log('[MailboxService] Message deleted:', messageId);
        return { success: true };
    } catch (error) {
        console.error('[MailboxService] Error deleting message:', error);
        return { success: false, error: error.message };
    }
}
window.deleteMessage = deleteMessage;

// ──────────────────────────────────────────────
// LẤY SỐ TIN CHƯA ĐỌC
// ──────────────────────────────────────────────
function getUnreadCount() {
    return _unreadCount;
}
window.getUnreadCount = getUnreadCount;

// ──────────────────────────────────────────────
// LISTENER SỐ TIN CHƯA ĐỌC (REALTIME)
// ──────────────────────────────────────────────
function startUnreadCountListener() {
    if (!_mailboxDb || !_mailboxUid) return;
    
    if (_unreadCountListener) {
        _unreadCountListener.off();
    }

    _unreadCountListener = _mailboxDb.ref(`users/${_mailboxUid}/unreadCount`);
    _unreadCountListener.on('value', snapshot => {
        _unreadCount = snapshot.val() || 0;
        
        // Cập nhật UI badge
        updateMailboxBadge();
        
        console.log('[MailboxService] Unread count updated:', _unreadCount);
    });
}

function stopUnreadCountListener() {
    if (_unreadCountListener) {
        _unreadCountListener.off();
        _unreadCountListener = null;
    }
}

// ──────────────────────────────────────────────
// CẬP NHẬT BADGE UI
// ──────────────────────────────────────────────
function updateMailboxBadge() {
    const badge = document.getElementById('mailbox-badge');
    if (!badge) return;

    if (_unreadCount > 0) {
        badge.textContent = _unreadCount > 99 ? '99+' : _unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ──────────────────────────────────────────────
// LẤY DANH SÁCH USERS ONLINE (để chọn người nhận)
// ──────────────────────────────────────────────
async function getOnlineUsers() {
    if (!_mailboxDb) {
        console.error('[MailboxService] Database not initialized');
        return [];
    }

    try {
        const snapshot = await _mailboxDb.ref('users').once('value');
        const users = snapshot.val() || {};
        
        return Object.entries(users)
            .map(([uid, data]) => ({
                uid,
                displayName: data.displayName || data.username || 'Người chơi',
                avatar: data.avatar || '👤',
                isOnline: data.isOnline || false
            }))
            .filter(user => user.uid !== _mailboxUid); // Không hiện chính mình
    } catch (error) {
        console.error('[MailboxService] Error getting online users:', error);
        return [];
    }
}
window.getOnlineUsers = getOnlineUsers;

// ──────────────────────────────────────────────
// CLEANUP
// ──────────────────────────────────────────────
function cleanupMailboxService() {
    stopUnreadCountListener();
    _mailboxDb = null;
    _mailboxUid = null;
    _unreadCount = 0;
    console.log('[MailboxService] Cleaned up');
}
window.cleanupMailboxService = cleanupMailboxService;
