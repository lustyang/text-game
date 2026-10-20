/* ============================================================
   TEXT QUEST · 战斗页逻辑
   对接 GameController（注意：所有接口都是 POST，且依赖 session）

     POST /game/initWins        -> void       把 session 里的 wins 置 0
     POST /game/initPlayer      -> HeroCharacter
     POST /game/initEnemyList   -> List<EnemyCharacter>
     POST /game/randomEnemy     -> EnemyCharacter
     POST /game/attack1|2|3     -> GameResult
     POST /game/getMaxWins      -> int

   调用顺序有讲究：initWins / initPlayer / randomEnemy 必须在 attack 之前调，
   否则后端读 session 会 NPE（500）。
   ============================================================ */
(function () {
    'use strict';

    /* ============================================================
       1. 配置 —— 技能名字、图片路径都集中在这里，想改只改这一块
       ============================================================ */
    const CONFIG = {
        // 技能文案。name/desc 显示在技能按钮上，formula/detail/tags 显示在图鉴里。
        // 公式是按 GameServiceImpl 里 attack1/2/3 的真实算法写的，改了后端记得同步这里。
        skills: {
            1: {
                name: '普通攻击',
                desc: '攻击 − 防御，无消耗',
                formula: '伤害 = 攻击 − 敌人防御',
                detail: '最稳的一招，没有任何代价。敌人处于防御姿态时伤害减半，' +
                    '算完最低也会造成 1 点伤害。血量不足时另外两招会退化，只有这招永远可用。',
                tags: ['无消耗', '稳定']
            },
            2: {
                name: '蓄力重击',
                desc: '自损 10 血，伤害翻倍',
                formula: '伤害 = 攻击 × 2 − 敌人防御（自身先扣 10 点生命）',
                detail: '牺牲 10 点生命换双倍攻击，主要爆发手段。' +
                    '生命值 ≤ 10 时会自动退化成普通攻击 —— 所以不会因为这一下把自己打死。',
                tags: ['自损 10 生命', '高爆发']
            },
            3: {
                name: '生命汲取',
                desc: '自损 10 血，吸血回血',
                formula: '吸取 10~20 点生命回复自身，敌人同时受到同等伤害',
                detail: '先扣自身 10 点生命，然后随机吸取 10~20 点生命回血（不超过生命上限），' +
                    '敌人受到和吸取量同等的伤害；若敌人正处于防御姿态，这部分伤害减半。' +
                    '能打能回，是续航的核心手段。生命值 ≤ 10 时同样会退化成普通攻击。',
                tags: ['自损 10 生命', '吸血', '续航']
            }
        },

        /**
         * 敌人技能说明。
         * 后端只给了技能名（EnemyCharacter.skill），具体机制是硬编码在
         * GameServiceImpl.enemyTurn() 里按敌人名字 switch 的，所以这里按名字对应。
         * 四只都是「50% 概率触发特殊效果，否则普通攻击」。
         */
        enemySkillInfo: {
            '戴沐白': {
                skill: '猛击',
                formula: '50% 概率造成「攻击 × 1.5」的伤害',
                detail: '血厚防高的正面对手。平时是普通攻击，有一半概率打出 1.5 倍重击。' +
                    '攻击力 15，正面磨也能赢。'
            },
            '时空之龙-谢懈': {
                skill: '快速攻击',
                formula: '50% 概率连击，伤害直接翻倍（×2）',
                detail: '四只里血最少、爆发最凶。连击判定成功时伤害翻倍，' +
                    '但它只有 60 点生命，基本两下就能秒掉。'
            },
            '徐三石': {
                skill: '防御姿态',
                formula: '50% 概率进入防御姿态，你下一次攻击伤害减半',
                detail: '血最厚（120）、防御最高（15），但攻击力只有 5，几乎打不动你。' +
                    '防御姿态只能挡一次，被打破就恢复常态。用普通攻击磨最稳，' +
                    '别在它身上浪费技能 2 扣掉的血。'
            },
            '银龙舞麟-古月娜': {
                skill: '火球术',
                formula: '50% 概率造成「攻击 × 1.8」的伤害',
                detail: '攻击力全场最高（25）。火球术按 1.8 倍结算，一发能打掉你 40 点生命，' +
                    '连挨两下就很危险。血少的时候优先集火秒掉它。'
            }
        },

        // 玩家立绘
        player: {
            idle: 'img/player/player.jpg',
            attack: {
                1: 'img/player/attack1.jpg',
                2: 'img/player/attack2.jpg',
                3: 'img/player/attack3.jpg'
            }
        },

        // 敌人名字 -> 立绘。只有当后端没返回可用路径时才用这里兜底，
        // 所以后端 image 字段修好或没修好，页面都能正常显示。
        enemyByName: {
            '戴沐白': 'img/enemy/soldier.jpg',
            '时空之龙-谢懈': 'img/enemy/assassin.jpg',
            '徐三石': 'img/enemy/tank.jpg',
            '银龙舞麟-古月娜': 'img/enemy/master.jpg'
        },
        enemyFallback: 'img/enemy/enemy.jpg',

        // 动画节奏（毫秒）
        timing: {
            enemySwapDelay: 820     // 击败敌人后隔多久换新敌人上场
        }
    };

    /* ============================================================
       2. 接口地址 —— 与登录页保持同一套判断
       ============================================================ */
    const LOCAL_BACKEND = 'http://localhost:8080';
    const DEV_PORTS = ['5500', '5501', '63342', '5173', '3000', '8080', '8081'];

    const API_BASE = (function () {
        if (location.protocol === 'file:') return LOCAL_BACKEND;
        if (DEV_PORTS.indexOf(location.port) !== -1 && location.port !== '8080') return LOCAL_BACKEND;
        return '';
    })();

    // 图片加载失败时的占位图（内联 SVG，不额外请求）
    const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">' +
        '<rect width="120" height="160" fill="#0c1026"/>' +
        '<text x="60" y="88" font-size="44" text-anchor="middle" fill="#2a3a7a">?</text></svg>');

    /* ============================================================
       战斗特效 / 音效模块（js/fx.js、js/sfx.js）
       没加载对应文件时退化成空操作，绝不影响战斗逻辑本身
       ============================================================ */
    const NO_FX = {
        init() {}, setEnabled() {}, isEnabled: () => false, clear() {},
        center: () => ({x: 0, y: 0}),
        burst() {}, sparks() {}, ring() {}, slash() {}, drain() {}, flash() {}
    };
    const FX = window.FX || NO_FX;

    const NO_SFX = {
        init() {}, setEnabled() {}, isEnabled: () => false,
        ui() {}, slash() {}, heavy() {}, drain() {}, impact() {}, hurt() {},
        defend() {}, crit() {}, kill() {}, death() {}, record() {}, spawn() {}
    };
    const SFX = window.SFX || NO_SFX;

    /* ============================================================
       3. DOM
       ============================================================ */
    const $ = (id) => document.getElementById(id);

    const el = {
        streak: $('hudStreak'),
        maxWins: $('hudMaxWins'),
        restartBtn: $('restartBtn'),
        logoutBtn: $('logoutBtn'),

        playerCard: $('playerCard'),
        playerImg: $('playerImg'),
        playerFx: $('playerFx'),
        playerName: $('playerName'),
        playerHpNum: $('playerHpNum'),
        playerHpBar: $('playerHpBar'),
        playerHpGhost: $('playerHpGhost'),
        playerAtk: $('playerAtk'),
        playerDef: $('playerDef'),

        enemyCard: $('enemyCard'),
        enemyImg: $('enemyImg'),
        enemyFx: $('enemyFx'),
        enemyName: $('enemyName'),
        enemyHpNum: $('enemyHpNum'),
        enemyHpBar: $('enemyHpBar'),
        enemyHpGhost: $('enemyHpGhost'),
        enemyAtk: $('enemyAtk'),
        enemyDef: $('enemyDef'),
        enemySkillChip: $('enemySkillChip'),
        enemyDefendChip: $('enemyDefendChip'),
        enemyTag: $('enemyTag'),

        skills: document.querySelectorAll('.skill[data-attack]'),
        log: $('log'),
        clearLogBtn: $('clearLogBtn'),

        overlay: $('overlay'),
        overlayPanel: document.querySelector('.overlay__panel'),
        overlayTitle: $('overlayTitle'),
        overlaySub: $('overlaySub'),
        overStreak: $('overStreak'),
        overMax: $('overMax'),
        retryBtn: $('retryBtn'),
        backBtn: $('backBtn'),

        toast: $('toast'),

        // 特效相关
        arena: document.querySelector('.arena'),
        vignette: $('vignette'),
        banner: $('banner'),
        bannerText: $('bannerText'),
        fxToggle: $('fxToggle'),
        sfxToggle: $('sfxToggle'),

        // 图鉴相关
        codex: $('codex'),
        codexBtn: $('codexBtn'),
        codexClose: $('codexClose'),
        codexTabs: document.querySelectorAll('.codex__tab'),
        codexSkills: $('codexSkills'),
        codexBestiary: $('codexBestiary')
    };

    const state = {
        player: null,
        enemy: null,
        streak: 0,          // 本局连胜（后端没暴露 wins，前端自己记）
        maxWins: null,      // 历史最高（来自 /game/getMaxWins）
        busy: false,
        over: false,
        prevPlayerPct: null,   // 上一帧的血条百分比，用来算血条残影
        prevEnemyPct: null
    };

    /* ============================================================
       4. 工具
       ============================================================ */
    class ApiError extends Error {
        constructor(message, kind) {
            super(message);
            this.kind = kind;   // login | network | http | parse
        }
    }

    /**
     * 后端所有接口都是 POST + 依赖 session，所以统一走这里。
     * 401/403 一定是登录态没了；500 不一定 —— 后端在 session 字段为 null 时会
     * NPE，但别的地方出 bug（比如 SQL 参数名写错）也是 500，所以分开对待：
     * 开局阶段收到 500 基本等于没登录，战斗中收到 500 则更可能是后端异常。
     */
    async function post(path) {
        let res;
        try {
            res = await fetch(API_BASE + path, {method: 'POST', credentials: 'include'});
        } catch (e) {
            throw new ApiError('连不上服务器，请确认后端已启动', 'network');
        }

        if (res.status === 401 || res.status === 403) {
            throw new ApiError('登录状态已失效', 'login');
        }
        if (res.status === 500) {
            throw new ApiError('后端异常（HTTP 500），具体看后端控制台的异常堆栈', 'server');
        }
        if (!res.ok) {
            throw new ApiError('服务器返回 HTTP ' + res.status, 'http');
        }

        const text = (await res.text()).trim();
        if (!text) return null;                       // /game/initWins 返回 void，body 是空的

        try {
            return JSON.parse(text);
        } catch (e) {
            throw new ApiError('返回内容不是 JSON', 'parse');
        }
    }

    function hpPercent(c) {
        if (!c || !c.maxHp) return 0;
        return Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
    }

    /** 后端返回的 image 可能是 null / file: 本地路径，这里只认能用的那种 */
    function resolveEnemyImage(enemy) {
        const raw = enemy && enemy.image;
        if (typeof raw === 'string') {
            const v = raw.trim();
            if (/^(https?:)?\/\//.test(v) || v.startsWith('/') || v.startsWith('img/')) return v;
        }
        return CONFIG.enemyByName[enemy && enemy.name] || CONFIG.enemyFallback;
    }

    function setImg(imgEl, src) {
        imgEl.onerror = function () {
            this.onerror = null;
            this.src = PLACEHOLDER;
        };
        imgEl.src = src;
    }

    /** 敌人是否处于防御姿态（兼容 defendding / isDefendding 两种字段名） */
    function isDefending(enemy) {
        if (!enemy) return false;
        return enemy.defendding === true || enemy.isDefendding === true;
    }

    /**
     * 兼容两种 JSON 字段名。
     * GameResult 里的 getter 叫 isIsWin() / isGameOver()，Jackson 序列化出来
     * 到底是 isWin 还是 isIsWin 取决于版本和命名策略，这里两个都认。
     */
    function flag(obj, a, b) {
        if (!obj) return false;
        if (typeof obj[a] === 'boolean') return obj[a];
        if (typeof obj[b] === 'boolean') return obj[b];
        return false;
    }

    /* ============================================================
       5. 战斗记录
       ============================================================ */
    function logLine(text, kind) {
        const li = document.createElement('li');
        li.className = 'k-' + (kind || 'sys');
        li.textContent = text;
        el.log.appendChild(li);
        el.log.scrollTop = el.log.scrollHeight;

        // 只留最近 60 条，避免越滚越卡
        while (el.log.children.length > 60) el.log.removeChild(el.log.firstChild);
    }

    function clearLog() {
        el.log.innerHTML = '';
    }

    /* ============================================================
       6. 特效
       ============================================================ */
    function floatNumber(fxEl, text, kind, big) {
        const span = document.createElement('span');
        span.className = 'dmg dmg--' + kind + (big ? ' dmg--crit' : '');
        span.textContent = text;
        span.style.left = (26 + Math.random() * 48) + '%';
        span.style.top = (22 + Math.random() * 34) + '%';
        fxEl.appendChild(span);
        setTimeout(() => span.remove(), 1150);
    }

    function flash(fxEl) {
        fxEl.classList.remove('is-hit');
        void fxEl.offsetWidth;          // 强制回流，让动画能连续触发
        fxEl.classList.add('is-hit');
    }

    function shake(card) {
        card.classList.remove('is-hit');
        void card.offsetWidth;
        card.classList.add('is-hit');
        setTimeout(() => card.classList.remove('is-hit'), 420);
    }

    function lunge(card) {
        card.classList.remove('is-attacking');
        void card.offsetWidth;
        card.classList.add('is-attacking');
        setTimeout(() => card.classList.remove('is-attacking'), 380);
    }

    /* ---------------- 以下都是新增的打击感特效 ---------------- */

    /** 战场震动，level 1~3，伤害越大抖得越狠 */
    function screenShake(level) {
        const a = el.arena;
        if (!a) return;
        const cls = 'is-shake-' + (level >= 3 ? 'lg' : level === 2 ? 'md' : 'sm');
        a.classList.remove('is-shake-sm', 'is-shake-md', 'is-shake-lg');
        void a.offsetWidth;
        a.classList.add(cls);
        setTimeout(() => a.classList.remove(cls), level >= 3 ? 440 : 300);
    }

    /** 受伤时屏幕边缘红一下 */
    function vignetteHit() {
        const v = el.vignette;
        if (!v) return;
        v.classList.remove('is-hit');
        void v.offsetWidth;
        v.classList.add('is-hit');
    }

    /** 残血时常驻脉冲红晕 */
    function updateLowHpVignette() {
        const v = el.vignette;
        if (!v || !state.player) return;
        v.classList.toggle('is-low', hpPercent(state.player) <= 30 && !state.over);
    }

    /** 连胜里程碑横幅 */
    function showBanner(text) {
        const b = el.banner;
        if (!b) return;
        el.bannerText.textContent = text;
        b.hidden = false;
        // 重置动画，保证连续触发也能重播
        el.bannerText.style.animation = 'none';
        void el.bannerText.offsetWidth;
        el.bannerText.style.animation = '';
        clearTimeout(showBanner._t);
        showBanner._t = setTimeout(() => { b.hidden = true; }, 1750);
    }

    /** 角色卡上特效该出现的位置 */
    function centerOf(card, ratio) {
        return FX.center(card, ratio == null ? 0.38 : ratio);
    }

    /**
     * 每个技能各自的特效
     *   1 普通攻击：两道交叉斩击线
     *   2 蓄力重击：冲击波 + 向上飞溅的火星 + 全屏微闪
     *   3 生命汲取：绿色光点从敌人飞回玩家
     */
    function skillFX(skillNo, fromCard, toCard) {
        const from = centerOf(fromCard);
        const to = centerOf(toCard);

        if (skillNo === 1) {
            FX.slash(to.x, to.y, {angle: -0.55, length: 170, color: '#4df3ff'});
            setTimeout(() => FX.slash(to.x, to.y, {angle: 0.62, length: 150, color: '#bff9ff', curve: -0.3}), 70);
        } else if (skillNo === 2) {
            FX.ring(to.x, to.y, {color: '#ffd93d', radius: 150, width: 5});
            FX.sparks(to.x, to.y, {count: 20, color: '#ffd93d', dir: -Math.PI / 2});
            FX.flash('#ffd93d', 0.16, 0.16);
        } else if (skillNo === 3) {
            FX.ring(to.x, to.y, {color: '#5cf08a', radius: 95, width: 3});
            FX.drain(to, from, {count: 24, color: '#5cf08a'});
        }
    }

    /** 敌人挨打 */
    function enemyHitFX(damage) {
        const c = centerOf(el.enemyCard);
        FX.burst(c.x, c.y, {count: 14 + Math.min(18, Math.round(damage / 3)), color: '#ffd93d'});
        FX.flash('#ffffff', damage >= 30 ? 0.2 : 0.09, 0.14);
        screenShake(damage >= 30 ? 3 : damage >= 18 ? 2 : 1);
    }

    /** 玩家挨打 */
    function playerHitFX(damage) {
        const c = centerOf(el.playerCard);
        FX.burst(c.x, c.y, {count: 12 + Math.min(14, Math.round(damage / 3)), color: '#ff5b5b'});
        vignetteHit();
        screenShake(damage >= 30 ? 3 : 2);
    }

    /** 敌人被击败：白闪 + 金色爆散 */
    function enemyDeathFX() {
        const c = centerOf(el.enemyCard);
        FX.burst(c.x, c.y, {count: 60, color: '#ffd93d', speed: 460, size: 4.4, life: 0.9});
        FX.burst(c.x, c.y, {count: 26, color: '#ffffff', speed: 300, size: 3, life: 0.6});
        FX.ring(c.x, c.y, {color: '#ffffff', radius: 210, width: 6, life: 0.62});
        FX.flash('#ffffff', 0.5, 0.3);
        screenShake(3);
    }

    /** 玩家阵亡：暗红爆散 */
    function playerDeathFX() {
        const c = centerOf(el.playerCard);
        FX.burst(c.x, c.y, {count: 44, color: '#ff3d3d', speed: 340, size: 4, life: 1});
        FX.flash('#ff2b2b', 0.4, 0.38);
        screenShake(3);
    }

    /** 敌人进入防御姿态：青色护盾环 */
    function defendFX() {
        const c = centerOf(el.enemyCard);
        FX.ring(c.x, c.y, {color: '#4df3ff', radius: 130, width: 4, life: 0.6});
    }

    function toast(msg, ok) {
        el.toast.hidden = false;
        el.toast.className = 'toast' + (ok ? ' is-ok' : '');
        el.toast.textContent = msg;
        clearTimeout(toast._t);
        toast._t = setTimeout(() => {
            el.toast.hidden = true;
        }, 4200);
    }

    /* ============================================================
       7. 渲染
       ============================================================ */
    function renderStats(bumpStreak) {
        el.streak.textContent = String(state.streak);
        el.maxWins.textContent = state.maxWins === null ? '—' : String(state.maxWins);

        if (bumpStreak) {
            el.streak.classList.remove('is-bump');
            void el.streak.offsetWidth;
            el.streak.classList.add('is-bump');
        }
    }

    /**
     * 更新血条并处理「残影」。
     * 掉血时：白影先停在旧长度，实心条立刻缩短，白影延迟一会儿才追上去，
     * 中间露出的那段白色就是这一下掉了多少血 —— 打击感主要靠它。
     * 返回本次百分比，留给下次比较。
     */
    function applyBar(fillEl, ghostEl, pct, prevPct) {
        if (!fillEl) return pct;

        if (ghostEl && prevPct != null && pct < prevPct) {
            ghostEl.style.transition = 'none';
            ghostEl.style.width = prevPct + '%';
            void ghostEl.offsetWidth;        // 强制回流，让上面这行立刻生效
            ghostEl.style.transition = '';   // 恢复 CSS 里的延迟过渡
        }

        fillEl.style.width = pct + '%';
        if (ghostEl) ghostEl.style.width = pct + '%';
        return pct;
    }

    function renderPlayer() {
        const p = state.player;
        if (!p) return;

        const pct = hpPercent(p);
        el.playerName.textContent = p.name || '勇者';
        el.playerHpNum.textContent = p.hp + ' / ' + p.maxHp;
        state.prevPlayerPct = applyBar(el.playerHpBar, el.playerHpGhost, pct, state.prevPlayerPct);
        el.playerHpBar.classList.toggle('is-low', pct <= 30);
        el.playerAtk.textContent = p.attack;
        el.playerDef.textContent = p.defense;
        updateLowHpVignette();
    }

    function renderEnemy() {
        const e = state.enemy;
        if (!e) return;

        const pct = hpPercent(e);
        el.enemyName.textContent = e.name || '???';
        el.enemyTag.textContent = '敌人';
        el.enemyHpNum.textContent = e.hp + ' / ' + e.maxHp;
        state.prevEnemyPct = applyBar(el.enemyHpBar, el.enemyHpGhost, pct, state.prevEnemyPct);
        el.enemyHpBar.classList.toggle('is-low', pct <= 30);
        el.enemyAtk.textContent = e.attack;
        el.enemyDef.textContent = e.defense;
        el.enemySkillChip.textContent = e.skill || '—';
        el.enemyDefendChip.hidden = !isDefending(e);
    }

    /**
     * 切换主角立绘。
     * 出招图不自动切回待机图 —— 打完一直保持那张，直到下一次出招
     * （或者重开一局时由 boot() 切回 player.jpg）。
     * 用一个变量记住当前是哪张，避免每次重复设置同一个 src。
     */
    let playerImageSrc = null;

    function setPlayerImage(src) {
        if (playerImageSrc === src) return;
        playerImageSrc = src;
        setImg(el.playerImg, src);
    }

    /** 换上一个新敌人（带登场动画） */
    function spawnEnemy(enemy) {
        if (!enemy || !enemy.name) {
            logLine('后端没有返回敌人数据', 'lose');
            return;
        }
        const card = el.enemyCard;
        card.classList.remove('is-dead');
        void card.offsetWidth;                 // 让上一条 die 动画彻底结束

        state.enemy = enemy;
        setImg(el.enemyImg, resolveEnemyImage(enemy));
        // 新敌人满血登场，这里把上一只的血量记忆清掉，免得血条残影乱跳
        state.prevEnemyPct = null;
        renderEnemy();

        card.classList.add('is-spawning');
        setTimeout(() => card.classList.remove('is-spawning'), 600);

        // 登场特效：一圈扫描环
        const c = centerOf(card);
        FX.ring(c.x, c.y, {color: '#4df3ff', radius: 150, width: 3, life: 0.7});
        SFX.spawn();

        logLine('遭遇 ' + enemy.name + '（技能：' + (enemy.skill || '未知') + '）', 'enemy');
    }

    function setBusy(busy) {
        state.busy = busy;
        el.skills.forEach((b) => {
            b.disabled = busy || state.over;
        });
        el.restartBtn.disabled = busy;
    }

    /* ============================================================
       8. 开局
       ============================================================ */
    async function boot() {
        if (state.busy) return;

        setBusy(true);
        hideOverlay();
        clearLog();
        state.over = false;
        state.streak = 0;
        state.player = null;
        state.enemy = null;
        renderStats();

        // 把敌人卡片的死亡状态复位
        el.enemyCard.classList.remove('is-dead', 'is-spawning');
        el.playerCard.classList.remove('is-dead', 'is-spawning');
        setPlayerImage(CONFIG.player.idle);

        // 特效状态复位
        FX.clear();
        state.prevPlayerPct = null;
        state.prevEnemyPct = null;
        if (el.vignette) el.vignette.classList.remove('is-low', 'is-hit');
        if (el.banner) el.banner.hidden = true;

        logLine('进入无尽回廊……', 'sys');

        try {
            // initWins 必须最先调：不然后面 attack 里的 (int) session.getAttribute("wins") 会 NPE
            await post('/game/initWins');
            renderStats();

            const player = await post('/game/initPlayer');
            if (!player || !player.name) throw new ApiError('后端没有返回玩家数据', 'parse');
            state.player = player;
            renderPlayer();
            logLine('勇者 ' + player.name + ' 已就位（HP ' + player.hp + ' / 攻击 ' + player.attack + ' / 防御 ' + player.defense + '）', 'sys');

            const enemy = await post('/game/randomEnemy');
            spawnEnemy(enemy);

            await refreshMaxWins();
            logLine('按 1 / 2 / 3 选择招式', 'sys');
        } catch (e) {
            handleError(e, true);
        } finally {
            setBusy(false);
        }
    }

    async function refreshMaxWins() {
        try {
            const v = await post('/game/getMaxWins');
            if (typeof v === 'number' && isFinite(v)) {
                state.maxWins = v;
                renderStats();
            }
        } catch (e) {
            // 拿不到就不显示，不影响战斗
            state.maxWins = null;
            renderStats();
        }
    }

    /* ============================================================
       9. 出招
       ============================================================ */
    async function attack(skillNo) {
        if (state.busy || state.over) return;
        if (!state.player || !state.enemy) {
            toast('游戏还没初始化好，点「重开」试试');
            return;
        }

        setBusy(true);
        hideOverlay();

        const skillDef = CONFIG.skills[skillNo];
        lunge(el.playerCard);
        setPlayerImage(CONFIG.player.attack[skillNo]);
        skillFX(skillNo, el.playerCard, el.enemyCard);   // 技能特效

        // 出招音效立刻响，不等接口返回 —— 等返回再响手感会很钝
        if (skillNo === 1) SFX.slash();
        else if (skillNo === 2) SFX.heavy();
        else SFX.drain();

        let swapPending = false;
        try {
            const r = await post('/game/attack' + skillNo);
            if (!r) throw new ApiError('接口没有返回内容', 'parse');
            swapPending = applyResult(r, skillNo, skillDef) === true;
        } catch (e) {
            handleError(e);
        } finally {
            // 注意：这里故意不把立绘切回待机图 —— 出招图会一直留着，
            // 直到玩家下一次出招（或重开一局）
            // 击败敌人时要等新敌人上场后再解锁，否则玩家会在「已倒下的旧敌人」数据上出招
            if (!swapPending) setBusy(false);
        }
    }

    /**
     * 算出这一下敌人实际掉了多少血。
     *
     * 不直接信后端报的 playerHarm —— 它并不总等于真实伤害。典型例子：技能 3
     * 在敌人处于防御姿态时只造成 playerHarm / 2，但 playerHarm 本身没被改，
     * 报出来的还是全量。所以这里优先用「敌人血量的实际变化」反推。
     * 打死敌人时响应里的 enemy 已经换成下一只了，拿不到差值，才退回用 playerHarm。
     */
    function dealtDamage(result, prevEnemyHp) {
        const reported = result.playerHarm || 0;
        if (prevEnemyHp == null || !result.enemy || typeof result.enemy.hp !== 'number') {
            return reported;
        }
        const delta = prevEnemyHp - result.enemy.hp;
        return delta >= 0 ? delta : reported;
    }

    function applyResult(r, skillNo, skillDef) {
        const prevPlayerHp = state.player ? state.player.hp : 0;

        const isWin = flag(r, 'isWin', 'isIsWin');
        const gameOver = flag(r, 'gameOver', 'isGameOver');
        const newRecord = flag(r, 'updateMaxWins', 'isUpdateMaxWins');
        const enemySkill = flag(r, 'enemySkill', 'isEnemySkill');

        // ---------- 玩家状态以服务端为准 ----------
        if (r.player && r.player.name) state.player = r.player;

        // ---------- 打赢了 ----------
        if (isWin) {
            // 注意：后端在 isWin 时把 gameResult.enemy 换成了「下一个敌人」，
            // 所以这里先用本地缓存的旧敌人把血条打到 0、播倒下动画，再换新的。
            const defeated = state.enemy;
            // 打死时拿不到血量差值（响应里的 enemy 已被换成下一只），只能用 playerHarm
            const dealt = r.playerHarm || 0;

            if (defeated) {
                state.enemy = Object.assign({}, defeated, {hp: Math.max(0, defeated.hp - dealt)});
                renderEnemy();
            }
            if (dealt > 0) floatNumber(el.enemyFx, '−' + dealt, 'enemy', dealt >= 30);
            flash(el.enemyFx);
            shake(el.enemyCard);
            enemyDeathFX();
            SFX.kill();
            if (dealt >= 30) SFX.crit();
            renderPlayer();

            logLine('你使用「' + skillDef.name + '」，造成 ' + dealt + ' 点伤害', 'player');
            logLine('击败了 ' + (defeated ? defeated.name : '敌人') + '！', 'win');

            // 技能 2 / 3 的自损血，或者技能 3 的吸血，在这里体现
            const delta = state.player.hp - prevPlayerHp;
            if (delta > 0) floatNumber(el.playerFx, '+' + delta, 'heal');

            state.streak += 1;
            renderStats(true);

            // 连胜里程碑来一发横幅
            const milestone = state.streak === 3 || state.streak === 5 || state.streak % 10 === 0;
            if (milestone) showBanner(state.streak + ' 连 胜 !');

            if (newRecord) {
                state.maxWins = state.maxWins === null ? state.streak : Math.max(state.maxWins, state.streak);
                renderStats();
                logLine('★ 刷新历史最高连胜：' + state.streak, 'record');
            }

            // 里程碑和刷新纪录都值得来一声，但同一回合只响一次，别叠在一起
            if (milestone || newRecord) SFX.record();

            el.enemyCard.classList.add('is-dead');

            setTimeout(() => {
                spawnEnemy(r.enemy);
                setBusy(false);          // 新敌人上场后才解锁按钮
                // 后端会把新纪录写库，回来对齐一下真实值
                if (newRecord) refreshMaxWins();
            }, CONFIG.timing.enemySwapDelay);

            return true;                 // 告诉 attack()：别在 finally 里解锁
        }

        // ---------- 没打死 ----------
        // 先记下敌人挨打前的血量，用差值反推真实伤害
        const prevEnemyHp = state.enemy ? state.enemy.hp : null;
        const dealt = dealtDamage(r, prevEnemyHp);

        // 敌人状态以服务端为准
        // （漏了这一步的话敌人血条永远不动、防御姿态也不会亮）
        if (r.enemy && r.enemy.name) state.enemy = r.enemy;

        if (dealt > 0) floatNumber(el.enemyFx, '−' + dealt, 'enemy', dealt >= 30);
        logLine('你使用「' + skillDef.name + '」，造成 ' + dealt + ' 点伤害', 'player');
        flash(el.enemyFx);
        shake(el.enemyCard);
        if (dealt > 0) {
            enemyHitFX(dealt);
            SFX.impact(dealt >= 30);
            if (dealt >= 30) SFX.crit();
        }
        renderEnemy();

        // ---------- 敌人反击 ----------
        const taken = r.enemyHarm || 0;
        if (taken > 0) {
            floatNumber(el.playerFx, '−' + taken, 'player', taken >= 30);
            flash(el.playerFx);
            shake(el.playerCard);
            playerHitFX(taken);
            SFX.hurt();
            const who = state.enemy ? state.enemy.name : '敌人';
            logLine(who + (enemySkill ? ' 发动了技能，' : ' 反击，') + '你受到 ' + taken + ' 点伤害', 'enemy');
        } else if (enemySkill) {
            const who = state.enemy ? state.enemy.name : '敌人';
            logLine(who + ' 进入防御姿态', 'enemy');
            defendFX();
            SFX.defend();
        }

        renderPlayer();

        // 技能 2 / 3 的自损血（没打死敌人时也能看出来）
        const delta = state.player.hp - prevPlayerHp;
        if (delta > 0) floatNumber(el.playerFx, '+' + delta, 'heal');

        // ---------- 玩家阵亡 ----------
        if (gameOver) {
            state.over = true;
            setBusy(false);
            el.playerCard.classList.add('is-dead');
            playerDeathFX();
            SFX.death();
            if (el.vignette) el.vignette.classList.remove('is-low');
            logLine('你被击败了……', 'lose');
            setTimeout(() => showOverlay('lost'), 620);
        }
    }

    /* ============================================================
       10. 错误处理
       ============================================================ */
    /**
     * fatal = true 表示「开局就没法继续」（boot 阶段），这种情况下即使是 500
     * 也弹遮罩——因为开局 500 基本只有一个原因：session 里没有 user。
     * 战斗中（fatal = false）的 500 则只弹提示条，不打断当前这局。
     */
    function handleError(e, fatal) {
        const kind = (e && e.kind) || 'http';

        if (kind === 'login' || (fatal && kind === 'server')) {
            state.over = true;
            setBusy(false);
            logLine('登录状态已失效（后端读不到 session 里的用户）', 'lose');
            showOverlay('error');
            return;
        }

        toast(e.message || '出错了');
        logLine('出错了：' + (e.message || '未知错误'), 'lose');
    }

    /* ============================================================
       11. 结算遮罩
       ============================================================ */
    function showOverlay(type) {
        el.overlay.hidden = false;
        el.overlayPanel.className = 'overlay__panel is-' + type;
        if (el.vignette) el.vignette.classList.remove('is-low');

        if (type === 'lost') {
            el.overlayTitle.textContent = '你被击败了';
            el.overlaySub.textContent = '回廊的灯火又暗了一分……再来一次？';
            el.retryBtn.hidden = false;
            el.backBtn.textContent = '回 到 登 录';
        } else if (type === 'error') {
            el.overlayTitle.textContent = '登录状态已失效';
            el.overlaySub.textContent = '后端读不到 session 里的用户，请重新登录后再进入战斗。';
            el.retryBtn.hidden = true;
            el.backBtn.textContent = '前 往 登 录 页';
        }

        el.overStreak.textContent = String(state.streak);
        el.overMax.textContent = state.maxWins === null ? '—' : String(state.maxWins);
        el.retryBtn.focus();
    }

    function hideOverlay() {
        el.overlay.hidden = true;
    }

    /* ============================================================
       11b. 图鉴（主角技能 / 敌人）
       ============================================================ */
    let bestiaryCache = null;      // 后端返回的敌人列表，只拉一次
    let bestiaryLoading = false;

    /** 建元素的简写，免得满屏 createElement */
    function h(tag, className, text) {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (text != null) n.textContent = text;
        return n;
    }

    function isCodexOpen() {
        return !!el.codex && !el.codex.hidden;
    }

    function openCodex(tab) {
        if (!el.codex) return;
        el.codex.hidden = false;
        setCodexTab(tab || 'skills');
        if (el.codexClose) el.codexClose.focus();
    }

    function closeCodex() {
        if (el.codex) el.codex.hidden = true;
    }

    function setCodexTab(tab) {
        const isSkills = tab !== 'bestiary';

        el.codexTabs.forEach((b) => {
            const on = (b.dataset.tab === 'bestiary') !== isSkills;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', String(on));
        });

        if (el.codexSkills) el.codexSkills.hidden = !isSkills;
        if (el.codexBestiary) el.codexBestiary.hidden = isSkills;

        if (!isSkills) loadBestiary();
    }

    /** 主角三个技能，直接按 CONFIG.skills 渲染 */
    function renderCodexSkills() {
        const box = el.codexSkills;
        if (!box) return;
        box.innerHTML = '';

        Object.keys(CONFIG.skills).forEach((key) => {
            const s = CONFIG.skills[key];

            const card = h('article', 'skillcard');
            card.dataset.skill = key;
            card.appendChild(h('span', 'skillcard__key', key));

            const head = h('div', 'skillcard__head');
            head.appendChild(h('span', 'skillcard__name', s.name));

            const tags = h('span', 'skillcard__tags');
            (s.tags || []).forEach((t) => {
                let cls = 'tag';
                if (t.indexOf('自损') >= 0) cls += ' tag--cost';
                else if (t.indexOf('吸血') >= 0 || t.indexOf('续航') >= 0) cls += ' tag--gain';
                tags.appendChild(h('span', cls, t));
            });
            head.appendChild(tags);
            card.appendChild(head);

            card.appendChild(h('p', 'skillcard__formula', s.formula));
            card.appendChild(h('p', 'skillcard__detail', s.detail));
            box.appendChild(card);
        });
    }

    /** 敌人列表来自后端 /game/initEnemyList，第一次打开图鉴时拉，之后走缓存 */
    async function loadBestiary() {
        if (bestiaryCache) {
            renderBestiary(bestiaryCache);   // 重渲染一次，顺便更新「当前对手」标记
            return;
        }
        if (bestiaryLoading) return;
        bestiaryLoading = true;

        const box = el.codexBestiary;
        if (box) {
            box.innerHTML = '';
            box.appendChild(h('p', 'codex__note', '正在读取敌人数据……'));
        }

        try {
            const list = await post('/game/initEnemyList');
            bestiaryCache = Array.isArray(list) ? list : [];
            renderBestiary(bestiaryCache);
        } catch (e) {
            if (box) {
                box.innerHTML = '';
                box.appendChild(h('p', 'codex__note',
                    '读取敌人数据失败：' + (e && e.message ? e.message : '未知错误')));
            }
        } finally {
            bestiaryLoading = false;
        }
    }

    function statCell(cls, label, value) {
        const span = h('span', cls);
        span.textContent = label + ' ';
        span.appendChild(h('b', null, String(value)));
        return span;
    }

    function renderBestiary(list) {
        const box = el.codexBestiary;
        if (!box) return;
        box.innerHTML = '';

        if (!list.length) {
            box.appendChild(h('p', 'codex__note', '后端没有返回敌人数据'));
            return;
        }

        list.forEach((e) => {
            const info = CONFIG.enemySkillInfo[e.name] || {};
            const card = h('article', 'beastcard');
            if (state.enemy && state.enemy.name === e.name) card.classList.add('is-current');

            const pic = h('div', 'beastcard__pic');
            const img = document.createElement('img');
            img.alt = e.name || '敌人';
            setImg(img, resolveEnemyImage(e));
            pic.appendChild(img);
            card.appendChild(pic);

            const main = h('div', 'beastcard__main');

            const head = h('div', 'beastcard__head');
            head.appendChild(h('span', 'beastcard__name', e.name || '???'));
            head.appendChild(h('span', 'beastcard__skill', info.skill || e.skill || '未知技能'));
            main.appendChild(head);

            const stats = h('div', 'beastcard__stats');
            stats.appendChild(statCell('is-hp', '生命', e.maxHp));
            stats.appendChild(statCell('is-atk', '攻击', e.attack));
            stats.appendChild(statCell('is-def', '防御', e.defense));
            main.appendChild(stats);

            main.appendChild(h('p', 'beastcard__formula',
                info.formula || '该敌人的技能机制暂无说明'));
            main.appendChild(h('p', 'beastcard__detail',
                info.detail || '这是后端返回的敌人，前端还没为它补充技能说明。'));

            card.appendChild(main);
            box.appendChild(card);
        });
    }

    /* ============================================================
       12. 星空背景（与登录页同一套效果，独立一份以免动到已验证的登录页）
       ============================================================ */
    function initStarfield() {
        const canvas = document.getElementById('starfield');
        if (!canvas || !canvas.getContext) return;

        const ctx = canvas.getContext('2d');
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let stars = [];
        let w = 0;
        let h = 0;
        let shooting = null;

        function build() {
            const count = Math.round(Math.min(160, (w * h) / 11000));
            stars = [];
            for (let i = 0; i < count; i++) {
                const roll = Math.random();
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: Math.random() * 1.3 + 0.3,
                    speed: Math.random() * 0.26 + 0.04,
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

        function draw(t) {
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
                const alpha = reduce ? 0.7 : 0.3 + 0.7 * Math.abs(Math.sin(t * 0.0008 + s.phase));
                ctx.beginPath();
                ctx.fillStyle = 'rgba(' + s.color + ',' + alpha.toFixed(3) + ')';
                ctx.arc(s.x, s.y, s.r, 0, 6.28318);
                ctx.fill();
            }

            if (!reduce) {
                if (!shooting && Math.random() < 0.003) {
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
       13. 事件绑定
       ============================================================ */
    /** 音效开关（SFX.setEnabled 内部会先播一声提示音再切换状态） */
    function toggleSound() {
        const next = !SFX.isEnabled();
        SFX.setEnabled(next);
        if (el.sfxToggle) el.sfxToggle.setAttribute('aria-pressed', String(next));
    }

    function bindEvents() {
        el.skills.forEach((btn) => {
            btn.addEventListener('click', () => attack(Number(btn.dataset.attack)));
        });

        el.restartBtn.addEventListener('click', () => { SFX.ui(); boot(); });
        el.retryBtn.addEventListener('click', () => { SFX.ui(); boot(); });
        el.clearLogBtn.addEventListener('click', () => { SFX.ui(); clearLog(); });

        el.backBtn.addEventListener('click', () => {
            location.href = 'index.html';
        });

        el.logoutBtn.addEventListener('click', () => {
            location.href = 'index.html';
        });

        // 特效开关
        el.fxToggle.addEventListener('click', () => {
            const next = !FX.isEnabled();
            FX.setEnabled(next);
            el.fxToggle.setAttribute('aria-pressed', String(next));
            SFX.ui();
            if (next) {
                const c = centerOf(el.enemyCard);
                FX.ring(c.x, c.y, {color: '#4df3ff', radius: 130});
            }
        });

        // 音效开关
        el.sfxToggle.addEventListener('click', () => {
            toggleSound();
        });

        // 图鉴
        el.codexBtn.addEventListener('click', () => { SFX.ui(); openCodex('skills'); });
        el.codexClose.addEventListener('click', () => { SFX.ui(); closeCodex(); });
        el.codexTabs.forEach((b) => {
            b.addEventListener('click', () => { SFX.ui(); setCodexTab(b.dataset.tab); });
        });
        // 点遮罩空白处也能关
        el.codex.addEventListener('click', (e) => {
            if (e.target === el.codex) closeCodex();
        });

        // 键盘：1/2/3 出招，R 重开，C 打开图鉴，Esc 关闭图鉴
        document.addEventListener('keydown', (e) => {
            if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;

            // 图鉴打开时只响应关闭 —— 否则按 1/2/3 会偷偷出招
            if (isCodexOpen()) {
                if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                    e.preventDefault();
                    closeCodex();
                } else if (e.key === 'm' || e.key === 'M') {
                    e.preventDefault();
                    toggleSound();
                }
                return;
            }

            if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                SFX.ui();
                openCodex('skills');
                return;
            }

            // M 静音开关，任何时候都能用
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                toggleSound();
                return;
            }

            if (e.key === '1' || e.key === '2' || e.key === '3') {
                e.preventDefault();
                attack(Number(e.key));
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                boot();
            }
        });
    }

    /* ============================================================
       14. 启动
       ============================================================ */
    function init() {
        initStarfield();
        FX.init($('fxCanvas'));            // 粒子特效层
        SFX.init();                        // 音效（首次点击时自动解冻 AudioContext）
        bindEvents();

        // 特效开关的初始状态（系统开了「减少动效」时默认就是关的）
        if (el.fxToggle) {
            el.fxToggle.setAttribute('aria-pressed', String(FX.isEnabled()));
        }
        if (el.sfxToggle) {
            el.sfxToggle.setAttribute('aria-pressed', String(SFX.isEnabled()));
        }

        // 技能名字/说明也从 CONFIG 写进去，改 CONFIG 就够
        el.skills.forEach((btn) => {
            const no = Number(btn.dataset.attack);
            const def = CONFIG.skills[no];
            btn.querySelector('.skill__name').textContent = def.name;
            btn.querySelector('.skill__desc').textContent = def.desc;
        });

        // 图鉴里的主角技能卡只渲染一次（内容不会变）
        renderCodexSkills();

        setImg(el.playerImg, CONFIG.player.idle);
        renderStats();

        // 注意：这里千万别先 setBusy(true)！
        // boot() 开头有 state.busy 的重入保护，先置 busy 会让它直接 return，
        // 结果就是游戏永远初始化不了、按钮一直禁用。让 boot() 自己去置忙。
        boot();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
