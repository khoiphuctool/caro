// ===== SCORE TABLE - Single Source of Truth for AI Scoring =====

const ScoreTable = {
    DEFAULTS: {
        ATTACK:      { FIVE:150000, FOUR_OPEN:12000, FOUR_BLOCKED:2500, THREE_OPEN:7500, THREE_BLOCKED:450, TWO_OPEN:300, TWO_BLOCKED:30 },
        DEFENSE:     { FIVE:150010, FOUR_OPEN:30000, FOUR_BLOCKED:2000, THREE_OPEN:6000, THREE_BLOCKED:300, TWO_OPEN:150, TWO_BLOCKED:10 },
        BONUS:       { DOUBLE_THREE:15000, FOUR_THREE:25000, DOUBLE_FOUR:60000 },
        CENTER_BIAS: { MAX:20, DISTANCE:5 }
    },
    ATTACK:      { FIVE:150000, FOUR_OPEN:12000, FOUR_BLOCKED:2500, THREE_OPEN:7500, THREE_BLOCKED:450, TWO_OPEN:300, TWO_BLOCKED:30 },
    DEFENSE:     { FIVE:150010, FOUR_OPEN:30000, FOUR_BLOCKED:2000, THREE_OPEN:6000, THREE_BLOCKED:300, TWO_OPEN:150, TWO_BLOCKED:10 },
    BONUS:       { DOUBLE_THREE:15000, FOUR_THREE:25000, DOUBLE_FOUR:60000 },
    CENTER_BIAS: { MAX:20, DISTANCE:5 },
    THREAT:  { NONE:0, LOW:1, MEDIUM:2, HIGH:3, CRITICAL:4, WINNING:5 },
    PATTERN: { NONE:0, FIVE:1, FOUR_OPEN:2, FOUR_BLOCKED:3, THREE_OPEN:4, THREE_BLOCKED:5, TWO_OPEN:6, TWO_BLOCKED:7 },
    getScore(t,atk){ var tb=atk?this.ATTACK:this.DEFENSE; switch(t){ case 1:return tb.FIVE; case 2:return tb.FOUR_OPEN; case 3:return tb.FOUR_BLOCKED; case 4:return tb.THREE_OPEN; case 5:return tb.THREE_BLOCKED; case 6:return tb.TWO_OPEN; case 7:return tb.TWO_BLOCKED; default:return 0; } },
    getThreatLevel(t,atk){ if(t===1)return 5; if(t===2)return 4; if(t===3)return 3; if(t===4)return atk?3:4; if(t===5)return 2; if(t===6)return 1; return 0; },
    // DISABLED: loadSettings - chỉ dùng giá trị từ file, không đọc localStorage
    loadSettings(){ /* Disabled - chỉ dùng giá trị từ ScoreTable.js */ },
    // DISABLED: saveSettings - không lưu vào localStorage
    saveSettings(){ /* Disabled - không lưu vào localStorage */ },
    // DISABLED: resetToDefaults - không cần vì không dùng localStorage
    resetToDefaults(){ /* Disabled - không dùng localStorage */ },
    // DISABLED: updateScore - không cho chỉnh sửa runtime
    updateScore(cat,key,val){ /* Disabled - không cho chỉnh sửa runtime */ },
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
            '    // DISABLED: loadSettings - chỉ dùng giá trị từ file, không đọc localStorage',
            '    loadSettings(){ /* Disabled - chỉ dùng giá trị từ ScoreTable.js */ },',
            '    // DISABLED: saveSettings - không lưu vào localStorage',
            '    saveSettings(){ /* Disabled - không lưu vào localStorage */ },',
            '    // DISABLED: resetToDefaults - không cần vì không dùng localStorage',
            '    resetToDefaults(){ /* Disabled - không dùng localStorage */ },',
            '    // DISABLED: updateScore - không cho chỉnh sửa runtime',
            '    updateScore(cat,key,val){ /* Disabled - không cho chỉnh sửa runtime */ },',
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
    },
};
if(typeof module!=="undefined"&&module.exports){ module.exports=ScoreTable; }