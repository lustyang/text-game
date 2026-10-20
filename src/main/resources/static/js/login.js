/* ============================================================
   TEXT QUEST · 登录页逻辑
   后端接口（LoginController）：
     POST /user/login     username, password  -> LoginResult{code,message,success}
     POST /user/register  username, password  -> LoginResult{code,message,success}
     POST /game/getMaxWins                    -> int（读取 session 中的 user）
   ============================================================ */
(function () {
    'use strict';

    /* ============================================================
       1. 接口地址
       页面放在 src/main/resources/static 下、由 Spring Boot 托管时，
       这里留空字符串即可（同源，JSESSIONID 自动带上，最省事）。
       如果用 VSCode Live Server / 直接双击打开 HTML，会自动指向本机 8080。
       ============================================================ */
    const LOCAL_BACKEND = 'http://localhost:8080';   // 后端地址，按需修改
    const DEV_PORTS = ['5500', '5501', '63342', '5173', '3000', '8080', '8081']; // 常见前端开发端口

    const API_BASE = (function () {
        if (location.protocol === 'file:') return LOCAL_BACKEND;          // 双击打开的本地文件
        if (DEV_PORTS.indexOf(location.port) !== -1 &&
            location.port !== '8080') return LOCAL_BACKEND;               // 前端开发服务器
        return '';                                                        // 同源（Spring Boot 托管）
    })();

    /* ============================================================
       2. 校验规则 —— 与 LoginServiceImpl 保持一致，别改错
          username: ".{3,16}"            3-16 个字符
          password: "(a-zA-Z1-9){3,16}"  3-16 位，仅字母和数字，且不含 0
       ============================================================ */
    const RE_USERNAME = /^.{3,16}$/;
    const RE_PASSWORD = /^[a-zA-Z1-9]{3,16}$/;

    const HINT_USERNAME = '3-16 个字符';
    const HINT_PASSWORD = '3-16 位，仅字母和数字 1-9（不含 0）';

    /* ============================================================
       3. DOM
       ============================================================ */
    const $ = (id) => document.getElementById(id);

    const el = {
        authPanel: $('authPanel'),
        profilePanel: $('profilePanel'),

        tabs: document.querySelector('.tabs'),
        tabLogin: $('tabLogin'),
        tabRegister: $('tabRegister'),

        form: $('authForm'),
        username: $('username'),
        password: $('password'),
        peekBtn: $('peekBtn'),

        fieldUsername: $('fieldUsername'),
        fieldPassword: $('fieldPassword'),
        usernameHint: $('usernameHint'),
        passwordHint: $('passwordHint'),

        submitBtn: $('submitBtn'),
        submitLabel: $('submitLabel'),
        submitDots: $('submitDots'),

        swapText: $('swapText'),
        swapBtn: $('swapBtn'),

        dialog: $('dialog'),
        dialogIcon: $('dialogIcon'),
        dialogText: $('dialogText'),

        tagline: $('tagline'),

        avatar: $('avatar'),
        profileName: $('profileName'),
        profileWins: $('profileWins'),
        profileLevel: $('profileLevel'),
        startGameBtn: $('startGameBtn'),
        logoutBtn: $('logoutBtn'),
        profileDialog: $('profileDialog'),
        profileDialogText: $('profileDialogText'),

        sfxToggle: $('sfxToggle')
    };

    const state = { mode: 'login', busy: false };

    /* ============================================================
       4. 音效（用 WebAudio 现场合成，不需要音频文件）
       ============================================================ */
    const Sfx = (function () {
        let ctx = null;
        let on = true;

        function ensure() {
            if (ctx) return ctx;
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try {
                ctx = new AC();
            } catch (e) {
                return null;
            }
            return ctx;
        }

        function tone(freq, dur, type, vol) {
            if (!on) return;
            const c = ensure();
            if (!c) return;
            if (c.state === 'suspended') c.resume();
            try {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = type || 'square';
                osc.frequency.value = freq;
                osc.connect(gain);
                gain.connect(c.destination);
                const t = c.currentTime;
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.linearRampToValueAtTime(vol || 0.05, t + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                osc.start(t);
                osc.stop(t + dur + 0.03);
            } catch (e) { /* 忽略 */ }
        }

        return {
            blip: () => tone(660, 0.06, 'square', 0.03),
            ok: () => {
                tone(523, 0.09, 'square', 0.05);
                setTimeout(() => tone(784, 0.18, 'square', 0.05), 90);
            },
            err: () => tone(170, 0.22, 'sawtooth', 0.05),
            toggle(v) {
                on = v;
                if (v) tone(880, 0.08, 'square', 0.04);
            },
            isOn: () => on
        };
    })();

    /* ============================================================
       5. 打字机效果（多个元素各自独立排队）
       ============================================================ */
    const typers = new WeakMap();

    function typeText(node, text, speed, onDone) {
        const prev = typers.get(node);
        if (prev) clearInterval(prev.timer);

        const rec = { timer: null, full: text, i: 0 };
        typers.set(node, rec);
        node.textContent = '';

        rec.timer = setInterval(() => {
            rec.i += 1;
            node.textContent = rec.full.slice(0, rec.i);
            if (rec.i >= rec.full.length) {
                clearInterval(rec.timer);
                typers.delete(node);
                if (onDone) onDone();
            }
        }, speed || 26);

        return rec;
    }

    /* ============================================================
       6. 提示对话框
       ============================================================ */
    let dialogTimer = null;

    function showDialog(kind, text, autoHide) {
        clearTimeout(dialogTimer);
        el.dialog.hidden = false;
        el.dialog.className = 'dialog' + (kind === 'error' ? '' : ' is-' + kind);
        el.dialogIcon.textContent = kind === 'error' ? '✖' : (kind === 'ok' ? '✔' : '◈');
        typeText(el.dialogText, text, 22);

        if (autoHide) {
            dialogTimer = setTimeout(hideDialog, autoHide);
        }
    }

    function hideDialog() {
        clearTimeout(dialogTimer);
        el.dialog.hidden = true;
        el.dialogText.textContent = '';
    }

    function shakePanel() {
        el.authPanel.classList.remove('is-shake');
        // 强制回流，让动画能连续触发
        void el.authPanel.offsetWidth;
        el.authPanel.classList.add('is-shake');
    }

    /* ============================================================
       7. 表单校验
       ============================================================ */
    function checkUsername(v) {
        if (!v) return '角色名不能为空';
        if (!RE_USERNAME.test(v)) return '角色名需 ' + HINT_USERNAME;
        return '';
    }

    function checkPassword(v, mode) {
        if (!v) return '通行密钥不能为空';
        // 登录时后端只做密码比对，不校验格式，所以这里也只查非空
        if (mode === 'register' && !RE_PASSWORD.test(v)) return '密钥需 ' + HINT_PASSWORD;
        return '';
    }

    function paintField(fieldEl, hintEl, msg, emptyHint) {
        fieldEl.classList.toggle('is-bad', msg !== '');
        fieldEl.classList.toggle('is-good', msg === '' && hintEl.dataset.filled === '1');
        hintEl.textContent = msg || emptyHint || '';
    }

    /**
     * 校验单个输入框并上色。
     * force = true（失焦 / 提交时）一定会提示；false（输入过程中）只在
     * 之前已经报错的情况下更新，避免用户刚敲第一个字母就被红字刷屏。
     * 返回 '' 表示通过。
     */
    function applyValidation(input, fieldEl, hintEl, checker, emptyHint, force) {
        const value = input.value.trim();
        const msg = checker(value);
        hintEl.dataset.filled = value ? '1' : '';

        if (msg && !force && !fieldEl.classList.contains('is-bad')) {
            fieldEl.classList.remove('is-good');
            hintEl.textContent = emptyHint || '';
            return msg;
        }
        paintField(fieldEl, hintEl, msg, emptyHint);
        return msg;
    }

    const hintFor = (base) => (state.mode === 'register' ? base : '');

    /** 返回 '' 表示全部通过，否则返回第一条错误信息 */
    function validateAll() {
        const um = applyValidation(el.username, el.fieldUsername, el.usernameHint,
            checkUsername, hintFor(HINT_USERNAME), true);
        const pm = applyValidation(el.password, el.fieldPassword, el.passwordHint,
            (v) => checkPassword(v, state.mode), hintFor(HINT_PASSWORD), true);
        return um || pm || '';
    }

    /* ============================================================
       8. 模式切换（登录 / 注册）
       ============================================================ */
    function setMode(mode, focus) {
        state.mode = mode;

        const isReg = mode === 'register';
        el.tabs.classList.toggle('is-register', isReg);
        el.tabLogin.classList.toggle('is-active', !isReg);
        el.tabRegister.classList.toggle('is-active', isReg);
        el.tabLogin.setAttribute('aria-selected', String(!isReg));
        el.tabRegister.setAttribute('aria-selected', String(isReg));

        el.submitLabel.textContent = isReg ? '创 建 存 档' : '开 始 冒 险';
        el.swapText.textContent = isReg ? '已经有存档了？' : '还没有存档？';
        el.swapBtn.textContent = isReg ? '返回登录 →' : '立即注册 →';

        el.password.setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
        el.username.placeholder = isReg ? '给勇者取个名字…' : '请输入角色名…';
        el.password.placeholder = isReg ? '设置通行密钥…' : '请输入通行密钥…';

        hideDialog();
        el.fieldUsername.className = 'field';
        el.fieldPassword.className = 'field';
        el.usernameHint.dataset.filled = '';
        el.passwordHint.dataset.filled = '';
        el.usernameHint.textContent = isReg ? HINT_USERNAME : '';
        el.passwordHint.textContent = isReg ? HINT_PASSWORD : '';

        if (focus) el.username.focus();
    }

    /* ============================================================
       9. 调用后端
       ============================================================ */
    async function postForm(path, params) {
        let res;
        try {
            res = await fetch(API_BASE + path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: new URLSearchParams(params).toString(),
                credentials: 'include'   // 关键：带上 JSESSIONID，登录态才存得住
            });
        } catch (e) {
            throw new Error('无法连接服务器，请确认后端已启动（' + (API_BASE || location.origin) + '）');
        }
        if (!res.ok) {
            throw new Error('服务器返回 HTTP ' + res.status + '，请检查后端日志');
        }
        try {
            return await res.json();
        } catch (e) {
            throw new Error('返回内容不是 JSON，接口地址可能不对');
        }
    }

    /**
     * 读取 session 里的最高连胜（现在走 GameController 的 /game/getMaxWins）；
     * 接口直接返回一个 int。三种结果分清楚，提示才不会误导人：
     *   { available: true, value }        接口正常
     *   { available: false, reason:'missing' }  后端还没提供这个接口（404）
     *   { available: false, reason:'error' }    session 失效 / 网络问题
     */
    async function fetchMaxWins() {
        try {
            const res = await fetch(API_BASE + '/game/getMaxWins', {
                method: 'POST',
                credentials: 'include'
            });
            if (res.status === 404) return { available: false, reason: 'missing' };
            if (!res.ok) return { available: false, reason: 'error' };   // 未登录时后端会 500
            const n = Number((await res.text()).trim());
            return Number.isFinite(n)
                ? { available: true, value: n }
                : { available: false, reason: 'error' };
        } catch (e) {
            return { available: false, reason: 'error' };
        }
    }

    /* ============================================================
       10. 提交逻辑
       ============================================================ */
    function setBusy(busy, label) {
        state.busy = busy;
        el.submitBtn.disabled = busy;
        el.username.disabled = busy;
        el.password.disabled = busy;
        el.submitDots.hidden = !busy;
        el.submitLabel.textContent = busy ? (label || '连 接 中') : (state.mode === 'register' ? '创 建 存 档' : '开 始 冒 险');
    }

    async function handleSubmit(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        await doAuth();
    }

    /** 真正干活的地方：登录或注册都走这里 */
    async function doAuth() {
        if (state.busy) return;

        const username = el.username.value.trim();
        const password = el.password.value.trim();

        const firstError = validateAll();
        if (firstError) {
            showDialog('error', firstError, 4000);
            shakePanel();
            Sfx.err();
            return;
        }

        const isReg = state.mode === 'register';
        setBusy(true, isReg ? '创 建 中' : '连 接 中');
        hideDialog();

        try {
            const data = await postForm(isReg ? '/user/register' : '/user/login', { username, password });

            if (!data || data.success !== true) {
                const msg = (data && data.message) ? data.message : '操作失败，请重试';
                showDialog('error', msg, 5000);
                shakePanel();
                Sfx.err();
                return;
            }

            Sfx.ok();

            if (isReg) {
                // 注意：后端注册接口不会写 session，所以注册成功后要再自动登录一次
                setMode('login');
                el.username.value = username;
                el.password.value = password;
                showDialog('ok', '存档创建成功！正在为你载入…');
                setTimeout(() => {
                    hideDialog();
                    doAuth();
                }, 900);
                return;
            }

            showDialog('ok', '登录成功，正在载入冒险者档案…');
            setTimeout(() => showProfile(username), 700);

        } catch (err) {
            showDialog('error', err.message || '未知错误', 6000);
            shakePanel();
            Sfx.err();
        } finally {
            setBusy(false);
        }
    }

    /* ============================================================
       11. 登录成功 -> 冒险者档案
       ============================================================ */
    function levelOf(wins) {
        if (wins >= 10) return 'LV.5 传说冒险者';
        if (wins >= 6) return 'LV.4 精英冒险者';
        if (wins >= 3) return 'LV.3 熟练冒险者';
        if (wins >= 1) return 'LV.2 正式冒险者';
        return 'LV.1 见习冒险者';
    }

    async function showProfile(username) {
        hideDialog();
        el.authPanel.hidden = true;
        el.profilePanel.hidden = false;

        el.profileName.textContent = username;
        el.avatar.textContent = username.slice(0, 1).toUpperCase();
        el.profileWins.textContent = '…';
        el.profileLevel.textContent = 'LV.? 鉴定中';

        const wins = await fetchMaxWins();
        if (wins.available) {
            el.profileWins.textContent = String(wins.value);
            el.profileLevel.textContent = levelOf(wins.value);
        } else {
            el.profileWins.textContent = '—';
            el.profileLevel.textContent = 'LV.1 见习冒险者';
            showProfileDialog(
                wins.reason === 'missing'
                    ? '战绩接口 /game/getMaxWins 还没开放，先开始冒险吧 ✦'
                    : '读取最高连胜失败，登录态可能已失效',
                6000);
        }

        el.startGameBtn.focus();
    }

    function showProfileDialog(text, autoHide) {
        el.profileDialog.hidden = false;
        typeText(el.profileDialogText, text, 22);
        if (autoHide) setTimeout(() => { el.profileDialog.hidden = true; }, autoHide);
    }

    function backToAuth() {
        el.profilePanel.hidden = true;
        el.authPanel.hidden = false;
        el.password.value = '';
        setMode(state.mode, true);
    }

    /* ============================================================
       12. 星空背景
       ============================================================ */
    function initStarfield() {
        const canvas = $('starfield');
        if (!canvas || !canvas.getContext) return;

        const ctx = canvas.getContext('2d');
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let stars = [];
        let w = 0;
        let h = 0;
        let shooting = null;

        function build() {
            const count = Math.round(Math.min(200, (w * h) / 9000));
            stars = [];
            for (let i = 0; i < count; i++) {
                const roll = Math.random();
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: Math.random() * 1.4 + 0.3,
                    speed: Math.random() * 0.3 + 0.05,
                    phase: Math.random() * Math.PI * 2,
                    color: roll < 0.1 ? '77,243,255' : (roll < 0.16 ? '255,61,129' : '255,255,255')
                });
            }
        }

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = canvas.clientWidth || window.innerWidth;
            h = canvas.clientHeight || window.innerHeight;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            build();
        }

        function draw(time) {
            ctx.clearRect(0, 0, w, h);

            for (let i = 0; i < stars.length; i++) {
                const s = stars[i];
                if (!reduce) {
                    s.y += s.speed;
                    if (s.y > h + 2) {
                        s.y = -2;
                        s.x = Math.random() * w;
                    }
                }
                const alpha = reduce ? 0.7 : 0.3 + 0.7 * Math.abs(Math.sin(time * 0.0008 + s.phase));
                ctx.beginPath();
                ctx.fillStyle = 'rgba(' + s.color + ',' + alpha.toFixed(3) + ')';
                ctx.arc(s.x, s.y, s.r, 0, 6.28318);
                ctx.fill();
            }

            // 偶尔来一颗流星
            if (!reduce) {
                if (!shooting && Math.random() < 0.004) {
                    shooting = {
                        x: Math.random() * w * 0.8,
                        y: Math.random() * h * 0.4,
                        vx: 5 + Math.random() * 4,
                        vy: 2 + Math.random() * 2,
                        life: 1
                    };
                }
                if (shooting) {
                    const s = shooting;
                    const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
                    grad.addColorStop(0, 'rgba(255,255,255,' + s.life.toFixed(2) + ')');
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12);
                    ctx.stroke();

                    s.x += s.vx;
                    s.y += s.vy;
                    s.life -= 0.012;
                    if (s.life <= 0 || s.x > w + 60 || s.y > h + 60) shooting = null;
                }
            }
        }

        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resize, 150);
        });

        resize();

        if (reduce) {
            draw(0);
        } else {
            (function loop(t) {
                draw(t);
                requestAnimationFrame(loop);
            })(0);
        }
    }

    /* ============================================================
       13. 标题下方滚动的台词
       ============================================================ */
    function initTagline() {
        const phrases = [
            '在无尽回廊中，寻找唯一的出口……',
            '每一次选择，都会改写结局。',
            '击败守卫，刷新你的最高连胜。',
            '输入名字，唤醒沉睡的存档。'
        ];
        let pi = 0;

        function cycle() {
            const text = phrases[pi % phrases.length];
            pi++;
            let i = 0;
            const timer = setInterval(() => {
                el.tagline.textContent = text.slice(0, ++i);
                if (i >= text.length) {
                    clearInterval(timer);
                    setTimeout(() => {
                        const back = setInterval(() => {
                            el.tagline.textContent = text.slice(0, --i);
                            if (i <= 0) {
                                clearInterval(back);
                                cycle();
                            }
                        }, 18);
                    }, 2200);
                }
            }, 70);
        }

        cycle();
    }

    /* ============================================================
       14. 事件绑定
       ============================================================ */
    function bindEvents() {
        el.tabLogin.addEventListener('click', () => { Sfx.blip(); setMode('login', true); });
        el.tabRegister.addEventListener('click', () => { Sfx.blip(); setMode('register', true); });
        el.swapBtn.addEventListener('click', () => {
            Sfx.blip();
            setMode(state.mode === 'login' ? 'register' : 'login', true);
        });

        el.form.addEventListener('submit', handleSubmit);

        // 输入时实时清掉错误状态（不在输入过程中主动报新错）
        el.username.addEventListener('input', () => {
            const msg = applyValidation(el.username, el.fieldUsername, el.usernameHint,
                checkUsername, hintFor(HINT_USERNAME), false);
            if (!msg) hideDialog();
        });

        el.password.addEventListener('input', () => {
            const msg = applyValidation(el.password, el.fieldPassword, el.passwordHint,
                (v) => checkPassword(v, state.mode), hintFor(HINT_PASSWORD), false);
            if (!msg) hideDialog();
        });

        // 失焦时才提示格式问题，避免边输边骂
        el.username.addEventListener('blur', () => {
            applyValidation(el.username, el.fieldUsername, el.usernameHint,
                checkUsername, hintFor(HINT_USERNAME), true);
        });

        el.password.addEventListener('blur', () => {
            applyValidation(el.password, el.fieldPassword, el.passwordHint,
                (v) => checkPassword(v, state.mode), hintFor(HINT_PASSWORD), true);
        });

        // 显示 / 隐藏密钥
        el.peekBtn.addEventListener('click', () => {
            const show = el.password.type === 'password';
            el.password.type = show ? 'text' : 'password';
            el.peekBtn.textContent = show ? '◉' : '◎';
            el.peekBtn.setAttribute('aria-pressed', String(show));
            el.peekBtn.setAttribute('aria-label', show ? '隐藏密钥' : '显示密钥');
            el.peekBtn.classList.toggle('is-on', show);
            el.password.focus();
            Sfx.blip();
        });

        el.startGameBtn.addEventListener('click', () => {
            Sfx.blip();
            // 进入战斗页（game.html 里会依次调 /game/initWins、initPlayer、randomEnemy）
            location.href = 'game.html';
        });

        el.logoutBtn.addEventListener('click', () => {
            Sfx.blip();
            backToAuth();
        });

        el.sfxToggle.addEventListener('click', () => {
            const next = !Sfx.isOn();
            Sfx.toggle(next);
            el.sfxToggle.setAttribute('aria-pressed', String(next));
            el.sfxToggle.textContent = next ? '♪ 音效：开' : '♪ 音效：关';
        });

        // 输入框上的按键音，纯粹为了手感
        [el.username, el.password].forEach((input) => {
            input.addEventListener('keydown', (e) => {
                if (e.key.length === 1 || e.key === 'Backspace') Sfx.blip();
            });
        });

        // Esc 关闭提示
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !el.dialog.hidden) hideDialog();
        });
    }

    /* ============================================================
       15. 启动
       ============================================================ */
    function init() {
        initStarfield();
        initTagline();
        bindEvents();
        setMode('login');
        el.username.focus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
