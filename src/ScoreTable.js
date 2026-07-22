// ===== SCORE TABLE - Single Source of Truth for AI Scoring =====

const ScoreTable = {
    DEFAULTS: {
        ATTACK: {
            FIVE: 150000,
            FOUR_OPEN: 12000,
            FOUR_BLOCKED: 2500,
            THREE_OPEN: 7500,
            THREE_BLOCKED: 450,
            TWO_OPEN: 300,
            TWO_BLOCKED: 30,
        },
        DEFENSE: {
            FIVE: 90000,
            FOUR_OPEN: 9000,
            FOUR_BLOCKED: 1200,
            THREE_OPEN: 4500,
            THREE_BLOCKED: 300,
            TWO_OPEN: 100,
            TWO_BLOCKED: 10,
        },
        BONUS: {
            DOUBLE_THREE: 20000,
            FOUR_THREE: 25000,
            DOUBLE_FOUR: 60000,
        },
        CENTER_BIAS: {
            MAX: 20,
            DISTANCE: 5,
        }
    },
    ATTACK: {
        FIVE: 150000,
        FOUR_OPEN: 12000,      // tăng — tạo FOUR phải rõ ràng hơn phòng thủ
        FOUR_BLOCKED: 2500,
        THREE_OPEN: 7500,      // tăng — THREE_OPEN tấn công phải > THREE_OPEN phòng thủ
        THREE_BLOCKED: 450,
        TWO_OPEN: 300,
        TWO_BLOCKED: 30,
    },
    DEFENSE: {
        FIVE: 90000,           // tăng — chặn địch thắng là ưu tiên tuyệt đối
        FOUR_OPEN: 9000,
        FOUR_BLOCKED: 1200,
        THREE_OPEN: 4500,      // giảm — không nên phòng thủ THREE hơn tấn công THREE
        THREE_BLOCKED: 300,
        TWO_OPEN: 100,
        TWO_BLOCKED: 10,
    },
    BONUS: {
        DOUBLE_THREE: 20000,   // tăng mạnh — double THREE_OPEN gần như không chặn được
        FOUR_THREE: 25000,     // tăng — combo nguy hiểm nhất
        DOUBLE_FOUR: 60000,    // tăng
    },
    CENTER_BIAS: {
        MAX: 20,
        DISTANCE: 5,
    },
    THREAT: { NONE:0, LOW:1, MEDIUM:2, HIGH:3, CRITICAL:4, WINNING:5 },
    PATTERN: { NONE:0, FIVE:1, FOUR_OPEN:2, FOUR_BLOCKED:3, THREE_OPEN:4, THREE_BLOCKED:5, TWO_OPEN:6, TWO_BLOCKED:7 },

    // Hệ số scale theo số quân thắng — 5 quân = 1.0 (chuẩn)
    WIN_MULTIPLIERS: { 3:0.6, 4:0.8, 5:1.0, 6:1.15, 7:1.3, 8:1.5, 9:1.7, 10:2.0 },

    getScore(t,atk){ var tb=atk?this.ATTACK:this.DEFENSE; switch(t){ case 1:return tb.FIVE; case 2:return tb.FOUR_OPEN; case 3:return tb.FOUR_BLOCKED; case 4:return tb.THREE_OPEN; case 5:return tb.THREE_BLOCKED; case 6:return tb.TWO_OPEN; case 7:return tb.TWO_BLOCKED; default:return 0; } },

    // Lấy điểm đã scale theo winCount — dùng cho AI evaluation
    getScaledScore(t, atk, wc) {
        var base = this.getScore(t, atk);
        var mul = this.WIN_MULTIPLIERS[wc] || 1.0;
        return Math.round(base * mul);
    },
    getThreatLevel(t,atk){ if(t===1)return 5; if(t===2)return 4; if(t===3)return 3; if(t===4)return atk?3:4; if(t===5)return 2; if(t===6)return 1; return 0; },
    loadSettings(){ try{ var s=localStorage.getItem("caro_scoretable_settings"); if(s){ var p=JSON.parse(s); if(p.ATTACK)this.ATTACK={...this.ATTACK,...p.ATTACK}; if(p.DEFENSE)this.DEFENSE={...this.DEFENSE,...p.DEFENSE}; if(p.BONUS)this.BONUS={...this.BONUS,...p.BONUS}; if(p.CENTER_BIAS)this.CENTER_BIAS={...this.CENTER_BIAS,...p.CENTER_BIAS}; } }catch(e){} },
    saveSettings(){ try{ localStorage.setItem("caro_scoretable_settings",JSON.stringify({ATTACK:{...this.ATTACK},DEFENSE:{...this.DEFENSE},BONUS:{...this.BONUS},CENTER_BIAS:{...this.CENTER_BIAS}})); }catch(e){} },
    resetToDefaults(){ this.ATTACK={...this.DEFAULTS.ATTACK}; this.DEFENSE={...this.DEFAULTS.DEFENSE}; this.BONUS={...this.DEFAULTS.BONUS}; this.CENTER_BIAS={...this.DEFAULTS.CENTER_BIAS}; this.saveSettings(); },
    updateScore(cat,key,val){ if(this[cat]&&this[cat][key]!==undefined){ this[cat][key]=parseInt(val); this.saveSettings(); } },
    // ===== XUẤT FILE ScoreTable.js với thông số hiện tại =====
    async exportAsFile() {
        var a = this.ATTACK, d = this.DEFENSE, b = this.BONUS, c = this.CENTER_BIAS;

        // Lấy source code của chính hàm này để nhúng vào file xuất
        var selfSrc = ScoreTable.exportAsFile.toString();

        var lines = [
            '// ===== SCORE TABLE - Single Source of Truth for AI Scoring =====',
            '',
            'const ScoreTable = {',
            '    DEFAULTS: {',
            '        ATTACK:      { FIVE:' + a.FIVE + ', FOUR_OPEN:' + a.FOUR_OPEN + ', FOUR_BLOCKED:' + a.FOUR_BLOCKED + ', THREE_OPEN:' + a.THREE_OPEN + ', THREE_BLOCKED:' + a.THREE_BLOCKED + ', TWO_OPEN:' + a.TWO_OPEN + ', TWO_BLOCKED:' + a.TWO_BLOCKED + ' },',
            '        DEFENSE:     { FIVE:' + d.FIVE + ', FOUR_OPEN:' + d.FOUR_OPEN + ', FOUR_BLOCKED:' + d.FOUR_BLOCKED + ', THREE_OPEN:' + d.THREE_OPEN + ', THREE_BLOCKED:' + d.THREE_BLOCKED + ', TWO_OPEN:' + d.TWO_OPEN + ', TWO_BLOCKED:' + d.TWO_BLOCKED + ' },',
            '        BONUS:       { DOUBLE_THREE:' + b.DOUBLE_THREE + ', FOUR_THREE:' + b.FOUR_THREE + ', DOUBLE_FOUR:' + b.DOUBLE_FOUR + ' },',
            '        CENTER_BIAS: { MAX:' + c.MAX + ', DISTANCE:' + c.DISTANCE + ' }',
            '    },',
            '    ATTACK:      { FIVE:' + a.FIVE + ', FOUR_OPEN:' + a.FOUR_OPEN + ', FOUR_BLOCKED:' + a.FOUR_BLOCKED + ', THREE_OPEN:' + a.THREE_OPEN + ', THREE_BLOCKED:' + a.THREE_BLOCKED + ', TWO_OPEN:' + a.TWO_OPEN + ', TWO_BLOCKED:' + a.TWO_BLOCKED + ' },',
            '    DEFENSE:     { FIVE:' + d.FIVE + ', FOUR_OPEN:' + d.FOUR_OPEN + ', FOUR_BLOCKED:' + d.FOUR_BLOCKED + ', THREE_OPEN:' + d.THREE_OPEN + ', THREE_BLOCKED:' + d.THREE_BLOCKED + ', TWO_OPEN:' + d.TWO_OPEN + ', TWO_BLOCKED:' + d.TWO_BLOCKED + ' },',
            '    BONUS:       { DOUBLE_THREE:' + b.DOUBLE_THREE + ', FOUR_THREE:' + b.FOUR_THREE + ', DOUBLE_FOUR:' + b.DOUBLE_FOUR + ' },',
            '    CENTER_BIAS: { MAX:' + c.MAX + ', DISTANCE:' + c.DISTANCE + ' },',
            '    THREAT:  { NONE:0, LOW:1, MEDIUM:2, HIGH:3, CRITICAL:4, WINNING:5 },',
            '    PATTERN: { NONE:0, FIVE:1, FOUR_OPEN:2, FOUR_BLOCKED:3, THREE_OPEN:4, THREE_BLOCKED:5, TWO_OPEN:6, TWO_BLOCKED:7 },',
            '    getScore(t,atk){ var tb=atk?this.ATTACK:this.DEFENSE; switch(t){ case 1:return tb.FIVE; case 2:return tb.FOUR_OPEN; case 3:return tb.FOUR_BLOCKED; case 4:return tb.THREE_OPEN; case 5:return tb.THREE_BLOCKED; case 6:return tb.TWO_OPEN; case 7:return tb.TWO_BLOCKED; default:return 0; } },',
            '    getThreatLevel(t,atk){ if(t===1)return 5; if(t===2)return 4; if(t===3)return 3; if(t===4)return atk?3:4; if(t===5)return 2; if(t===6)return 1; return 0; },',
            '    loadSettings(){ try{ var s=localStorage.getItem("caro_scoretable_settings"); if(s){ var p=JSON.parse(s); if(p.ATTACK)this.ATTACK={...this.ATTACK,...p.ATTACK}; if(p.DEFENSE)this.DEFENSE={...this.DEFENSE,...p.DEFENSE}; if(p.BONUS)this.BONUS={...this.BONUS,...p.BONUS}; if(p.CENTER_BIAS)this.CENTER_BIAS={...this.CENTER_BIAS,...p.CENTER_BIAS}; } }catch(e){} },',
            '    saveSettings(){ try{ localStorage.setItem("caro_scoretable_settings",JSON.stringify({ATTACK:{...this.ATTACK},DEFENSE:{...this.DEFENSE},BONUS:{...this.BONUS},CENTER_BIAS:{...this.CENTER_BIAS}})); }catch(e){} },',
            '    resetToDefaults(){ this.ATTACK={...this.DEFAULTS.ATTACK}; this.DEFENSE={...this.DEFAULTS.DEFENSE}; this.BONUS={...this.DEFAULTS.BONUS}; this.CENTER_BIAS={...this.DEFAULTS.CENTER_BIAS}; this.saveSettings(); },',
            '    updateScore(cat,key,val){ if(this[cat]&&this[cat][key]!==undefined){ this[cat][key]=parseInt(val); this.saveSettings(); } },',
            '    ' + selfSrc + ',',   // nhúng nguyên source hàm exportAsFile
            '};',
            'if(typeof module!=="undefined"&&module.exports){ module.exports=ScoreTable; }',
        ];
        var content = lines.join('\n');

        if (window.showSaveFilePicker) {
            try {
                var fh = await window.showSaveFilePicker({
                    suggestedName: 'ScoreTable.js',
                    startIn: 'downloads',
                    types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }]
                });
                var writable = await fh.createWritable();
                await writable.write(content);
                await writable.close();
                alert('Đã ghi file! Đặt vào thư mục src/ để áp dụng.');
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }

        // Fallback: tải về
        var blob = new Blob([content], { type: 'text/javascript' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'ScoreTable.js';
        link.click();
        URL.revokeObjectURL(link.href);
    }
};

if(typeof module!=="undefined"&&module.exports){ module.exports=ScoreTable; }