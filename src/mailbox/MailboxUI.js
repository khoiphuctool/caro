// ══════════════════════════════════════════════════════════════════
// MAILBOX UI - GIAO DIỆN HỘP THƯ NHÂN VẬT
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// MỞ / ĐÓNG MODAL HỘP THƯ
// ──────────────────────────────────────────────
function moHopThu() {
    const modal = document.getElementById('mailbox-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderMailbox();
}
window.moHopThu = moHopThu;

function dongHopThu() {
    const modal = document.getElementById('mailbox-modal');
    if (modal) modal.style.display = 'none';
}
window.dongHopThu = dongHopThu;

// ──────────────────────────────────────────────
// MỬNG FORM VIẾT THƯ
// ──────────────────────────────────────────────
function moVietThu() {
    const form = document.getElementById('mailbox-write-form');
    if (!form) return;
    form.style.display = 'flex';
    loadOnlineUsers();
}
window.moVietThu = moVietThu;

function dongVietThu() {
    const form = document.getElementById('mailbox-write-form');
    if (form) form.style.display = 'none';
    
    // Reset form
    const recipientSelect = document.getElementById('mail-recipient');
    const contentInput = document.getElementById('mail-content');
    if (recipientSelect) recipientSelect.value = '';
    if (contentInput) contentInput.value = '';
}
window.dongVietThu = dongVietThu;

// ──────────────────────────────────────────────
// RENDER HỘP THƯ
// ──────────────────────────────────────────────
async function renderMailbox() {
    const tab = getCurrentMailboxTab();
    
    if (tab === 'inbox') {
        await renderInbox();
    } else if (tab === 'outbox') {
        await renderOutbox();
    }
}

function getCurrentMailboxTab() {
    const inboxTab = document.getElementById('mailbox-tab-inbox');
    const outboxTab = document.getElementById('mailbox-tab-outbox');
    
    if (inboxTab && inboxTab.classList.contains('active')) return 'inbox';
    if (outboxTab && outbox.classList.contains('active')) return 'outbox';
    return 'inbox';
}

// ──────────────────────────────────────────────
// RENDER TIN NHẬN
// ──────────────────────────────────────────────
async function renderInbox() {
    const container = document.getElementById('mailbox-messages');
    if (!container) return;

    container.innerHTML = '<div class="mailbox-loading">Đang tải...</div>';

    const messages = await getInbox(50);
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="mailbox-empty">📭 Chưa có tin nhắn nào</div>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isUnread = !msg.read;
        const isSystem = msg.type === 'system';
        const timeStr = formatMailTime(msg.timestamp);
        const fromName = isSystem ? '🔔 Hệ Thống' : msg.fromName;
        
        return `
            <div class="mailbox-message ${isUnread ? 'mailbox-unread' : ''} ${isSystem ? 'mailbox-system' : ''}" 
                 data-id="${msg.id}">
                <div class="mailbox-message-header">
                    <span class="mailbox-sender">${fromName}</span>
                    <span class="mailbox-time">${timeStr}</span>
                    ${isUnread ? '<span class="mailbox-unread-dot"></span>' : ''}
                </div>
                <div class="mailbox-content">${escapeHtml(msg.content)}</div>
                <div class="mailbox-actions">
                    ${isUnread ? `<button class="mailbox-btn mailbox-btn-read" onclick="markAsRead('${msg.id}'); renderInbox();">Đánh dấu đã đọc</button>` : ''}
                    <button class="mailbox-btn mailbox-btn-delete" onclick="deleteMailMessage('${msg.id}', 'inbox'); renderInbox();">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
}

// ──────────────────────────────────────────────
// RENDER TIN GỬI
// ──────────────────────────────────────────────
async function renderOutbox() {
    const container = document.getElementById('mailbox-messages');
    if (!container) return;

    container.innerHTML = '<div class="mailbox-loading">Đang tải...</div>';

    const messages = await getOutbox(50);
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="mailbox-empty">📭 Chưa gửi tin nhắn nào</div>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const timeStr = formatMailTime(msg.timestamp);
        
        return `
            <div class="mailbox-message" data-id="${msg.id}">
                <div class="mailbox-message-header">
                    <span class="mailbox-sender">📤 Đến: ${msg.toName}</span>
                    <span class="mailbox-time">${timeStr}</span>
                </div>
                <div class="mailbox-content">${escapeHtml(msg.content)}</div>
                <div class="mailbox-actions">
                    <button class="mailbox-btn mailbox-btn-delete" onclick="deleteMailMessage('${msg.id}', 'outbox'); renderOutbox();">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
}

// ──────────────────────────────────────────────
// CHUYỂN TAB
// ──────────────────────────────────────────────
function switchMailboxTab(tab) {
    const inboxTab = document.getElementById('mailbox-tab-inbox');
    const outboxTab = document.getElementById('mailbox-tab-outbox');
    
    if (tab === 'inbox') {
        inboxTab.classList.add('active');
        outboxTab.classList.remove('active');
    } else {
        outboxTab.classList.add('active');
        inboxTab.classList.remove('active');
    }
    
    renderMailbox();
}
window.switchMailboxTab = switchMailboxTab;

// ──────────────────────────────────────────────
// GỬI TIN NHẮN
// ──────────────────────────────────────────────
async function guiThu() {
    const recipientSelect = document.getElementById('mail-recipient');
    const contentInput = document.getElementById('mail-content');
    
    if (!recipientSelect || !contentInput) return;
    
    const toUid = recipientSelect.value;
    const content = contentInput.value.trim();
    
    if (!toUid) {
        alert('Vui lòng chọn người nhận');
        return;
    }
    
    if (!content) {
        alert('Vui lòng nhập nội dung tin nhắn');
        return;
    }
    
    if (content.length > 500) {
        alert('Nội dung tin nhắn không được quá 500 ký tự');
        return;
    }
    
    const result = await sendMail(toUid, content);
    
    if (result.success) {
        alert('Đã gửi tin nhắn thành công!');
        dongVietThu();
        renderOutbox();
    } else {
        alert('Gửi tin nhắn thất bại: ' + result.error);
    }
}
window.guiThu = guiThu;

// ──────────────────────────────────────────────
// XÓA TIN NHẮN
// ──────────────────────────────────────────────
async function deleteMailMessage(messageId, box) {
    if (!confirm('Bạn có chắc muốn xóa tin nhắn này?')) return;
    
    const result = await deleteMessage(messageId, box);
    
    if (!result.success) {
        alert('Xóa tin nhắn thất bại: ' + result.error);
    }
}
window.deleteMailMessage = deleteMailMessage;

// ──────────────────────────────────────────────
// MARK ALL AS READ
// ──────────────────────────────────────────────
async function markAllAsReadAction() {
    const result = await markAllAsRead();
    
    if (result.success) {
        renderInbox();
    } else {
        alert('Đánh dấu đã đọc thất bại: ' + result.error);
    }
}
window.markAllAsReadAction = markAllAsReadAction;

// ──────────────────────────────────────────────
// LOAD DANH SÁCH USERS ONLINE
// ──────────────────────────────────────────────
async function loadOnlineUsers() {
    const select = document.getElementById('mail-recipient');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Chọn người nhận --</option>';
    
    const users = await getOnlineUsers();
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.uid;
        option.textContent = `${user.avatar} ${user.displayName} ${user.isOnline ? '🟢' : '⚫'}`;
        select.appendChild(option);
    });
    
    // Thêm listener cho character count
    const textarea = document.getElementById('mail-content');
    const charCount = document.getElementById('mail-char-count');
    if (textarea && charCount) {
        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
        });
    }
}

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────
function formatMailTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Nếu trong vòng 1 phút
    if (diff < 60000) return 'Vừa xong';
    
    // Nếu trong vòng 1 giờ
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} phút trước`;
    }
    
    // Nếu trong vòng 24 giờ
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} giờ trước`;
    }
    
    // Nếu trong vòng 7 ngày
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days} ngày trước`;
    }
    
    // Hiển thị ngày tháng
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
