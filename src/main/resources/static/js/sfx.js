/* ============================================================
   TEXT QUEST · 战斗音效
   全部用 WebAudio 现场合成，不需要任何音频文件。
   game.js 通过 window.SFX 调用；没加载这个文件会退化成静音。

   提供的音效：
     slash()    普通攻击的挥砍「唰」
     heavy()    蓄力重击的低频闷响
     drain()    生命汲取的往上的吸力
     impact()   命中
     hurt()     玩家挨打
     defend()   敌人防御姿态的金属「叮」
     kill()     击杀（爆破 + 上行和弦）
     death()    玩家阵亡（下行）
     record()   刷新纪录 / 连胜里程碑
     crit()     大伤害的额外高音
     spawn()    新敌人登场
     ui()       界面点击

   浏览器自动播放策略：AudioContext 必须由用户手势解冻，
   所以 init() 会挂一次性监听，第一次点击/按键时自动 resume。
   ============================================================ */
window.SFX = (function () {
    'use strict';

    let ctx = null;
    let master = null;
    let noiseBuffer = null;
    let enabled = true;
    let unlockBound = false;

    /* ---------------- 初始化 ---------------- */
    function ensure() {
        if (ctx) {
            if (ctx.state === 'suspended') ctx.resume();
            return ctx;
        }

        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;

        try {
            ctx = new AC();
        } catch (e) {
            return null;
        }

        master = ctx.createGain();
        master.gain.value = 0.5;

        // 挂个压缩器，多个音效同时响的时候不至于爆音
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 6;
        master.connect(comp);
        comp.connect(ctx.destination);

        // 白噪声缓冲，挥砍/爆破都用它
        const len = Math.floor(ctx.sampleRate * 0.6);
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        return ctx;
    }

    function init() {
        ensure();
        if (unlockBound) return;
        unlockBound = true;
        const h = () => { ensure(); };
        window.addEventListener('pointerdown', h, {once: true});
        window.addEventListener('keydown', h, {once: true});
    }

    function setEnabled(v) {
        if (v) {
            enabled = true;
            blip(true);
        } else {
            blip(false);
            enabled = false;
        }
    }

    function isEnabled() {
        return enabled;
    }

    /* ---------------- 两个基础发声单元 ---------------- */

    /** 单音。给 f1 就会从 f0 滑到 f1 */
    function tone(opt) {
        if (!enabled) return;
        const c = ensure();
        if (!c || !master) return;

        try {
            const t = c.currentTime + (opt.delay || 0);
            const osc = c.createOscillator();
            const g = c.createGain();

            osc.type = opt.type || 'square';
            osc.frequency.setValueAtTime(Math.max(1, opt.f0), t);
            if (opt.f1 != null) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(1, opt.f1), t + opt.dur);
            }

            const vol = opt.vol == null ? 0.12 : opt.vol;
            const atk = opt.attack == null ? 0.005 : opt.attack;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + atk);
            g.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);

            osc.connect(g);
            g.connect(master);
            osc.start(t);
            osc.stop(t + opt.dur + 0.03);
        } catch (e) { /* 静默失败，不能因为音效把游戏搞崩 */ }
    }

    /** 噪声 + 扫频滤波，做「唰」「砰」「轰」这类质感 */
    function noise(opt) {
        if (!enabled) return;
        const c = ensure();
        if (!c || !master || !noiseBuffer) return;

        try {
            const t = c.currentTime + (opt.delay || 0);
            const src = c.createBufferSource();
            src.buffer = noiseBuffer;
            src.loop = true;

            const flt = c.createBiquadFilter();
            flt.type = opt.filterType || 'bandpass';
            flt.Q.value = opt.q == null ? 1 : opt.q;
            flt.frequency.setValueAtTime(Math.max(40, opt.from), t);
            if (opt.to != null) {
                flt.frequency.exponentialRampToValueAtTime(Math.max(40, opt.to), t + opt.dur);
            }

            const g = c.createGain();
            const vol = opt.vol == null ? 0.15 : opt.vol;
            const atk = opt.attack == null ? 0.004 : opt.attack;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + atk);
            g.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);

            src.connect(flt);
            flt.connect(g);
            g.connect(master);
            src.start(t);
            src.stop(t + opt.dur + 0.03);
        } catch (e) { /* 同上 */ }
    }

    /* ---------------- 开 / 关 的提示音 ---------------- */
    function blip(on) {
        // 直接走 tone，注意关的时候要先出声再改 enabled（外部已经这么做了）
        if (on) tone({f0: 700, f1: 1150, type: 'square', dur: 0.1, vol: 0.07});
        else tone({f0: 700, f1: 360, type: 'square', dur: 0.12, vol: 0.07});
    }

    /* ---------------- 具体音效 ---------------- */

    /** 界面点击 */
    function ui() {
        tone({f0: 640, f1: 900, type: 'square', dur: 0.055, vol: 0.045});
    }

    /** 普通攻击：挥砍的「唰」 */
    function slash() {
        noise({from: 5200, to: 900, dur: 0.17, vol: 0.16, q: 0.9});
        tone({f0: 1500, f1: 520, type: 'triangle', dur: 0.1, vol: 0.05});
    }

    /** 蓄力重击：低频闷响 + 冲击噪声 */
    function heavy() {
        tone({f0: 210, f1: 45, type: 'sine', dur: 0.34, vol: 0.3});
        noise({from: 1800, to: 200, dur: 0.26, vol: 0.2, filterType: 'lowpass', q: 0.7, delay: 0.02});
        tone({f0: 900, f1: 300, type: 'square', dur: 0.12, vol: 0.06});
    }

    /** 生命汲取：往上抽的吸力感 */
    function drain() {
        tone({f0: 240, f1: 1350, type: 'sawtooth', dur: 0.42, vol: 0.075});
        tone({f0: 520, f1: 2600, type: 'sine', dur: 0.42, vol: 0.045, delay: 0.04});
        noise({from: 380, to: 2600, dur: 0.4, vol: 0.06, q: 2.4, delay: 0.05});
    }

    /** 命中。big = true 时更沉更响 */
    function impact(big) {
        noise({
            from: big ? 2600 : 3600,
            to: 480,
            dur: big ? 0.2 : 0.12,
            vol: big ? 0.2 : 0.13,
            q: 0.8
        });
        tone({f0: big ? 150 : 245, f1: 60, type: 'square', dur: 0.12, vol: big ? 0.16 : 0.09});
    }

    /** 玩家挨打：更闷更凶 */
    function hurt() {
        tone({f0: 155, f1: 55, type: 'sawtooth', dur: 0.26, vol: 0.2});
        noise({from: 1200, to: 180, dur: 0.2, vol: 0.14, filterType: 'lowpass'});
    }

    /** 敌人进入防御姿态：金属「叮」 */
    function defend() {
        tone({f0: 1900, f1: 1680, type: 'triangle', dur: 0.22, vol: 0.1});
        tone({f0: 2870, f1: 2480, type: 'triangle', dur: 0.18, vol: 0.055, delay: 0.012});
        noise({from: 6000, to: 3000, dur: 0.1, vol: 0.05, q: 3});
    }

    /** 大伤害的额外高音 */
    function crit() {
        tone({f0: 2400, f1: 1050, type: 'square', dur: 0.14, vol: 0.075, delay: 0.03});
    }

    /** 击杀：爆破 + 上行和弦 */
    function kill() {
        noise({from: 4200, to: 120, dur: 0.44, vol: 0.26, filterType: 'lowpass', q: 0.6});
        [523, 659, 784, 1047].forEach((f, i) => {
            tone({f0: f, type: 'square', dur: 0.26, vol: 0.085, delay: 0.06 + i * 0.06});
        });
    }

    /** 玩家阵亡：下行 */
    function death() {
        [440, 349, 262, 175].forEach((f, i) => {
            tone({f0: f, f1: f * 0.9, type: 'sawtooth', dur: 0.44, vol: 0.1, delay: i * 0.16});
        });
        noise({from: 900, to: 90, dur: 0.9, vol: 0.11, filterType: 'lowpass', delay: 0.1});
    }

    /** 刷新纪录 / 连胜里程碑 */
    function record() {
        [659, 784, 988, 1319].forEach((f, i) => {
            tone({f0: f, type: 'square', dur: 0.2, vol: 0.095, delay: i * 0.08});
        });
    }

    /** 新敌人登场 */
    function spawn() {
        tone({f0: 300, f1: 900, type: 'triangle', dur: 0.18, vol: 0.065});
        noise({from: 700, to: 2400, dur: 0.16, vol: 0.05, q: 2, delay: 0.02});
    }

    return {
        init: init,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        ui: ui,
        slash: slash,
        heavy: heavy,
        drain: drain,
        impact: impact,
        hurt: hurt,
        defend: defend,
        crit: crit,
        kill: kill,
        death: death,
        record: record,
        spawn: spawn
    };
})();
