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
        console.warn('Confetti canvas not initialized, skipping spawnConfetti');
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
    const overlay = document.getElementById('win-overlay');
    const emojiEl = document.getElementById('win-emoji');
    const titleEl = document.getElementById('win-title');
    const subEl   = document.getElementById('win-subtitle');
    const btnReview = document.getElementById('btn-review');
    const btnRestart = overlay.querySelector('.btn-play-again:not(#btn-review)');

    if (gameMode === 'solo') {
        emojiEl.textContent = '🏆';
        titleEl.textContent = `NGƯỜI ${winner} CHIẾN THẮNG!`;
        titleEl.style.color = winner === 'X' ? '#2563eb' : '#dc2626';
        subEl.textContent   = `Người ${winner} đã giành chiến thắng ván này.`;
        startConfetti();
        // Solo: chỉ hiện nút Xem lại, ẩn nút Đấu lại
        if (btnReview) btnReview.style.display = 'inline-block';
        if (btnRestart) btnRestart.style.display = 'none';
    } else if (isBotWin) {
        emojiEl.textContent = tauntEmoji || 'THUA ĐẬM 💀';
        titleEl.textContent = 'rất cố gắng , cần tu luyện thêm!';
        titleEl.style.color = '#ef4444';
        subEl.textContent   = tauntMessage || 'Gừng càng già càng cay — bó tay thì gặp anh Chần!';
        // Bot: hiện cả 2 nút
        if (btnReview) btnReview.style.display = 'inline-block';
        if (btnRestart) btnRestart.style.display = 'inline-block';
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
        // Hiệu ứng nổ xu
        if (typeof playCoinBurst === 'function') setTimeout(() => playCoinBurst(0), 600);
        // Win bot: hiện cả 2 nút
        if (btnReview) btnReview.style.display = 'inline-block';
        if (btnRestart) btnRestart.style.display = 'inline-block';
    }

    overlay.classList.add('show');
}

function closeWinAndRestart() {
    document.getElementById('win-overlay').classList.remove('show');
    stopConfetti();
    
    // Sử dụng requestAnimationFrame để chuyển đổi mượt hơn
    requestAnimationFrame(() => {
        initGame();
    });
}

function reviewGame() {
    // Chặn review khi đang chơi online
    if (window.isOnlineModeActive && window.isOnlineModeActive()) {
        alert("Bạn đang trong trận đấu Online, không thể xem lại ván cờ!");
        return;
    }
    
    document.getElementById('win-overlay').classList.remove('show');
    stopConfetti();
    
    // Sử dụng requestAnimationFrame để render mượt hơn
    requestAnimationFrame(() => {
        // Use Shared Board Engine for camera positioning (DO6.TXT)
        if (typeof SharedBoardEngine !== 'undefined' && winningCellCoords.length > 0) {
            const [wr, wc] = winningCellCoords[Math.floor(winningCellCoords.length / 2)];
            SharedBoardEngine.Camera.setPosition(wc, wr);
            SharedBoardEngine.update();
        } else if (isInfinite && winningCellCoords.length > 0) {
            // Fallback to old system
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
