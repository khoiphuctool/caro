// ===== PHÁO HOA & WIN OVERLAY =====

let confettiCanvas = null;
let ctx = null;
let confettiParticles = [];
let confettiRaf = null;

function initConfetti() {
    confettiCanvas = document.getElementById('confetti-canvas');
    if (confettiCanvas) {
        ctx = confettiCanvas.getContext('2d');
        resizeConfettiCanvas();
    }
}

function resizeConfettiCanvas() {
    if (!confettiCanvas) return;
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfettiCanvas);

function randomColor() {
    const colors = ['#f59e0b','#ef4444','#3b82f6','#10b981','#a855f7','#ec4899','#facc15','#ffffff'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function spawnConfetti(count = 160) {
    if (!confettiCanvas || !ctx) {
        // console.warn('Confetti canvas not initialized, skipping spawnConfetti');
        return;
    }
    for (let i = 0; i < count; i++) {
        confettiParticles.push({
            x:     Math.random() * confettiCanvas.width,
            y:     Math.random() * confettiCanvas.height - confettiCanvas.height,
            w:     Math.random() * 10 + 5,
            h:     Math.random() * 6 + 3,
            color: randomColor(),
            rot:   Math.random() * Math.PI * 2,
            rotV:  (Math.random() - 0.5) * 0.15,
            vx:    (Math.random() - 0.5) * 3,
            vy:    Math.random() * 4 + 2,
            alpha: 1,
            decay: Math.random() * 0.005 + 0.003
        });
    }
}

function animateConfetti() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles = confettiParticles.filter(p => p.alpha > 0.02);

    for (let p of confettiParticles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.rotV;
        p.vy  += 0.08;
        p.alpha -= p.decay;
    }

    if (confettiParticles.length > 0) {
        confettiRaf = requestAnimationFrame(animateConfetti);
    } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
}

function startConfetti() {
    if (confettiRaf) cancelAnimationFrame(confettiRaf);
    confettiParticles = [];
    spawnConfetti(180);
    setTimeout(() => spawnConfetti(150), 400);
    setTimeout(() => spawnConfetti(120), 900);
    animateConfetti();
}

function stopConfetti() {
    if (confettiRaf) cancelAnimationFrame(confettiRaf);
    confettiRaf = null;
    confettiParticles = [];
    if (ctx && confettiCanvas) ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// ===== WIN OVERLAY =====
function showWinOverlay(winner, isBotWin, tauntMessage = '', tauntEmoji = '') {
    const oldVanMoi = document.getElementById('van-moi-overlay');
    if (oldVanMoi) oldVanMoi.remove();
    const btnBackToResult = document.getElementById('btn-back-to-result');
    if (btnBackToResult) btnBackToResult.remove();

    const overlay = document.getElementById('win-overlay');
    const emojiEl = document.getElementById('win-emoji');
    const titleEl = document.getElementById('win-title');
    const subEl   = document.getElementById('win-subtitle');
    const btnReview = document.getElementById('btn-review');
    const btnRestart = document.getElementById('btn-restart');
    const btnExitRoom = document.getElementById('btn-exit-room');

    if (!overlay) return;
    if (overlay.classList.contains('show')) return;

    const isOnline = window.isOnlineModeActive && window.isOnlineModeActive();
    if (isOnline && window._suppressOnlineWinOverlay && window._suppressOnlineWinOverlayRoom === (window.currentRoomId || currentRoomId)) {
        return;
    }
    const isDraw = winner === 'draw' || winner === 'tie';
    const localRole = isOnline ? window.myOnlineRole : null;
    const localWon = isDraw ? false : (isOnline
        ? !!localRole && winner === localRole
        : (gameMode === 'solo' ? true : (isBotWin ? winner !== humanPiece : winner === humanPiece)));

    overlay.classList.toggle('winner', localWon);
    overlay.classList.toggle('loser', !localWon && !isDraw);
    overlay.classList.toggle('draw', isDraw);

    if (btnReview) {
        btnReview.style.display = 'inline-block';
        btnReview.textContent = 'XEM LẠI';
        btnReview.onclick = reviewGame;
    }
    if (btnRestart) {
        btnRestart.style.display = 'inline-block';
        btnRestart.textContent = 'ĐẤU LẠI';
        btnRestart.onclick = closeWinAndRestart;
    }
    if (btnExitRoom) btnExitRoom.style.display = window.isBotRoomMode ? 'inline-block' : 'none';

    if (isOnline) {
        if (btnReview) {
            btnReview.textContent = '🔍 XEM LẠI';
            btnReview.onclick = reviewGame;
        }
        if (btnRestart) {
            btnRestart.textContent = '🕹 ĐẤU LẠI';
            btnRestart.onclick = requestRematchFromWinOverlay;
        }
        if (btnExitRoom) {
            btnExitRoom.style.display = 'inline-block';
            btnExitRoom.textContent = '🚪 Quay về phòng';
            btnExitRoom.onclick = returnToRoomFromWinOverlay;
        }
    }

    if (isDraw) {
        emojiEl.textContent = tauntEmoji || '🤝';
        titleEl.textContent = 'HÒA!';
        titleEl.style.color = '#64748b';
        subEl.textContent = tauntMessage || 'Trận đấu kết thúc hòa. Lần sau sẽ thắng được đâu!';
    } else if (gameMode === 'solo') {
        if (localWon) {
            emojiEl.textContent = '🏆';
            titleEl.textContent = 'CHIẾN THẮNG!';
            titleEl.style.color = '#f59e0b';
            subEl.textContent = 'Bạn đã chiến thắng trận đấu. Tiếp tục duy trì phong độ!';
            startConfetti();
        } else {
            emojiEl.textContent = tauntEmoji || '💔';
            titleEl.textContent = 'THẤT BẠI!';
            titleEl.style.color = '#ef4444';
            subEl.textContent = tauntMessage || 'Đối thủ đã thắng ván này. Đừng nản, lần sau cố gắng hơn!';
        }
    } else if (window.isBotVsBotMode) {
        const botWinnerMode = window.BotRoomManager?.botVsBotState
            ? window.BotRoomManager.botVsBotState[winner === 'X' ? 'botXMode' : 'botOMode']
            : null;
        const winnerLabel = botWinnerMode ? `Bot ${winner} (${botWinnerMode})` : `Bot ${winner}`;

        emojiEl.textContent = tauntEmoji || '🤖';
        titleEl.textContent = `BOT ${winner} THẮNG!`;
        titleEl.style.color = '#2563eb';
        subEl.textContent = `Trận đấu Bot vs Bot đã kết thúc. ${winnerLabel} giành chiến thắng!`;

        // ══════════════════════════════════════════════════════════════════
        // Cập nhật thống kê Bot vs Bot
        // ══════════════════════════════════════════════════════════════════
        if (window.BotRoomManager && window.BotRoomManager.botVsBotState) {
            const state = window.BotRoomManager.botVsBotState;
            const statsKey = `${state.botXMode}_vs_${state.botOMode}`;
            
            if (window.BotRoomManager.botVsBotStats && window.BotRoomManager.botVsBotStats[statsKey]) {
                const stats = window.BotRoomManager.botVsBotStats[statsKey];
                stats.totalMatches++;
                
                if (winner === 'X') {
                    stats.winsX++;
                } else if (winner === 'O') {
                    stats.winsO++;
                } else {
                    stats.draws++;
                }
                
                // Lưu lịch sử trận đấu
                stats.matchHistory.push({
                    timestamp: Date.now(),
                    winner,
                    winCount: state.winCount,
                    blockBoth: state.blockBoth
                });
                
                // Giữ tối đa 100 trận lịch sử
                if (stats.matchHistory.length > 100) {
                    stats.matchHistory.shift();
                }
                
                // Lưu vào localStorage
                localStorage.setItem('botVsBotStats', JSON.stringify(window.BotRoomManager.botVsBotStats));
                
                // console.log('[BotVsBot] Stats updated:', stats);
                
                // Hiển thị thống kê
                window.BotRoomManager.displayBotVsBotStats();
            }
        }
    } else if (isOnline) {
        if (localWon) {
            emojiEl.textContent = '🏆';
            titleEl.textContent = 'CHIẾN THẮNG!';
            titleEl.style.color = '#f59e0b';
            subEl.textContent = 'Bạn đã chiến thắng trận đấu. Tiếp tục duy trì phong độ!';
            startConfetti();
        } else {
            emojiEl.textContent = tauntEmoji || '💔';
            titleEl.textContent = 'THẤT BẠI!';
            titleEl.style.color = '#ef4444';
            subEl.textContent = tauntMessage || 'Đối thủ đã thắng ván này. Đừng nản, lần sau cố gắng hơn!';
        }
    } else if (isBotWin) {
        emojiEl.textContent = tauntEmoji || '😢';
        titleEl.textContent = 'THẤT BẠI!';
        titleEl.style.color = '#ef4444';
        subEl.textContent = tauntMessage || 'BOT đã thắng ván này. Hãy thử lại để cải thiện!';
    } else {
        emojiEl.textContent = '🏆';
        titleEl.textContent = 'CHIẾN THẮNG!';
        titleEl.style.color = '#f59e0b';

        const rankData       = loadRank();
        const currentKey     = getRankKey(gameMode, winCount, '♾️ Vô Hạn');
        const currentEntries = rankData[currentKey] || [];
        const tempEntry      = { name: pendingRankEntry?.name || 'Bạn', score: pendingRankEntry?.score || 0, wins: 1 };
        const tempEntries    = [...currentEntries, tempEntry];
        tempEntries.sort((a, b) => (b.score || 0) - (a.score || 0));

        let playerRank = null;
        for (let i = 0; i < tempEntries.length; i++) {
            if (tempEntries[i] === tempEntry) { playerRank = i + 1; break; }
        }

        let rankMessage = 'Bạn đã hạ gục BOT M2 . Bái phục!, chờ anh đẻ ra con M2 đã nha';
        if (playerRank !== null) {
            const medals  = ['1🥇','2🥈','3🥉'];
            const medal   = medals[playerRank - 1] || `#${playerRank}`;
            const score   = tempEntry.score.toLocaleString('vi-VN');
            rankMessage   = `🏅 Thứ hạng: ${medal} · Điểm: ${score}`;
        }
        subEl.textContent = rankMessage;
        startConfetti();
        // Do not call playCoinBurst(0) here; it causes unnecessary animation.
    }

    overlay.classList.add('show');
    if (isOnline) {
        window._suppressOnlineWinOverlay = true;
        window._suppressOnlineWinOverlayRoom = (window.currentRoomId || currentRoomId) || null;
    }
}

function closeWinOverlay() {
    const overlay = document.getElementById('win-overlay');
    if (overlay) overlay.classList.remove('show');
    if (typeof stopConfetti === 'function') stopConfetti();
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        window._suppressOnlineWinOverlay = true;
        window._suppressOnlineWinOverlayRoom = (window.currentRoomId || currentRoomId) || null;
    }
}
window.closeWinOverlay = closeWinOverlay;

function requestRematchFromWinOverlay() {
    const overlay = document.getElementById('win-overlay');
    if (overlay) overlay.classList.remove('show');
    const oldVanMoi = document.getElementById('van-moi-overlay');
    if (oldVanMoi) oldVanMoi.remove();
    const btnBackToResult = document.getElementById('btn-back-to-result');
    if (btnBackToResult) btnBackToResult.remove();

    if (typeof stopConfetti === 'function') stopConfetti();
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        window._suppressOnlineWinOverlay = true;
        window._suppressOnlineWinOverlayRoom = (window.currentRoomId || currentRoomId) || null;
    }

    const roomId = window.currentRoomId || currentRoomId;
    const role = (typeof window.myOnlineRole !== 'undefined') ? window.myOnlineRole : (typeof myRole !== 'undefined' ? myRole : null);
    if (!roomId || !role) {
        if (typeof window.quayLaiPhongChinhO === 'function') window.quayLaiPhongChinhO();
        return;
    }

    db.ref(`rooms/${roomId}`).once('value').then(snap => {
        const room = snap.val();
        if (!room || room.status !== 'ended') {
            if (typeof thongBaoHeThong === 'function') {
                thongBaoHeThong('❌ Chỉ có thể đấu lại khi trận đã kết thúc.');
            }
            return;
        }

        const rematchConfig = room.rematchConfig || {
            betAmount: room.betAmount || null,
            winCount:  room.winCount ?? 5,
            chan2Dau:  room.chan2Dau ?? true,
            firstTurn: room.firstTurn || 'X',
            isVip:     room.isVip || false
        };
        const updates = {
            rematchRequested: true,
            rematchRequestedBy: role,
            rematchConfig,
            rematchXReady: role === 'X',
            rematchOReady: role === 'O',
            updatedAt: Date.now()
        };
        if (role === 'O') {
            const minBetCheck = rematchConfig.isVip ? (typeof XU_CONFIG !== 'undefined' ? XU_CONFIG.VIP_BET_MIN : 10000) : (typeof XU_CONFIG !== 'undefined' ? XU_CONFIG.BET_MIN : 100);
            if (rematchConfig.betAmount && rematchConfig.betAmount >= minBetCheck) {
                updates.playerOConfirmed = true;
                updates.guestReady = true;
            }
        }
        if (role === 'X') {
            updates.playerXConfirmed = true;
        }
        db.ref(`rooms/${roomId}`).update(updates).then(() => {
            if (typeof thongBaoHeThong === 'function') {
                thongBaoHeThong('🕹 Đã gửi yêu cầu đấu lại - chờ đối thủ xác nhận...');
            }
        });
    });
}
window.requestRematchFromWinOverlay = requestRematchFromWinOverlay;

function closeWinAndRestart() {
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        requestRematchFromWinOverlay();
        return;
    }
    document.getElementById('win-overlay').classList.remove('show');
    const oldVanMoi = document.getElementById('van-moi-overlay');
    if (oldVanMoi) oldVanMoi.remove();
    stopConfetti();

    if (window.isBotRoomMode && typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.replayBotBattle === 'function') {
        BotRoomManager.replayBotBattle();
        return;
    }

    // Sử dụng requestAnimationFrame để chuyển đổi mượt hơn
    requestAnimationFrame(() => {
        initGame();
        // Keep navigation hidden during replay/restart
        if (typeof hideTopNavigation === 'function') {
            hideTopNavigation();
        }
    });
}

function reviewGame() {
    const winOv = document.getElementById('win-overlay');
    if (winOv) winOv.classList.remove('show');
    const oldVanMoi = document.getElementById('van-moi-overlay');
    if (oldVanMoi) oldVanMoi.remove();
    const btnBackToResult = document.getElementById('btn-back-to-result');
    if (btnBackToResult) btnBackToResult.remove();
    if (typeof xemLaiBanCo === 'function') {
        xemLaiBanCo();
        return;
    }
    stopConfetti();
    requestAnimationFrame(() => {
        if (isInfinite && winningCellCoords.length > 0) {
            const [wr, wc] = winningCellCoords[Math.floor(winningCellCoords.length / 2)];
            if (typeof vRowF !== 'undefined' && typeof vColF !== 'undefined' && 
                typeof infCanvasH !== 'undefined' && typeof INF_CS !== 'undefined' &&
                typeof infCanvasW !== 'undefined' && typeof renderInfiniteBoard === 'function') {
                vRowF = wr - (infCanvasH / INF_CS) / 2;
                vColF = wc - (infCanvasW / INF_CS) / 2;
                renderInfiniteBoard();
            }
        }
        statusPanel.innerHTML = `⬆️ Đang xem lại ván đấu &nbsp;|&nbsp; <button onclick="closeWinAndRestart()" style="padding:4px 16px;border-radius:8px;border:none;cursor:pointer;font-weight:bold;font-size:0.9rem;">🔄 Đấu Lại</button>`;
    });
}

function returnToRoomFromWinOverlay() {
    const overlay = document.getElementById('win-overlay');
    if (overlay) overlay.classList.remove('show');
    stopConfetti();
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        window._suppressOnlineWinOverlay = true;
        window._suppressOnlineWinOverlayRoom = (window.currentRoomId || currentRoomId) || null;
    }

    if (typeof window.quayLaiPhongChinhO === 'function') {
        window.quayLaiPhongChinhO();
    }
}

function exitRoomFromWinOverlay() {
    const overlay = document.getElementById('win-overlay');
    if (overlay) overlay.classList.remove('show');
    stopConfetti();
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        window._suppressOnlineWinOverlay = true;
        window._suppressOnlineWinOverlayRoom = (window.currentRoomId || currentRoomId) || null;
    }
    if (window.isBotRoomMode && typeof BotRoomManager !== 'undefined' && typeof BotRoomManager.exitBotRoom === 'function') {
        BotRoomManager.exitBotRoom();
        return;
    }
    if (typeof window.thoatPhongSauVan === 'function') {
        window.thoatPhongSauVan();
        return;
    }
}
