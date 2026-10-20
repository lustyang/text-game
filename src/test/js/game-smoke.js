/* ============================================================
   game.js 冒烟测试（纯 node，零依赖）
   跑法：node src/test/js/game-smoke.js

   用最小 DOM 桩 + 假后端，把 game.js 真的执行一遍，验证：
   初始化顺序、按钮能否点击、伤害与血条更新、胜利换敌人、阵亡结算、后端 500 兜底。

   不影响 Spring Boot 运行，也不参与 maven 构建。不想要直接删掉即可。
   ============================================================ */
const path = require('path');
const fs = require('fs');

/* ---------------- DOM 桩 ---------------- */
class El {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.style = {};
        this.dataset = {};
        this._classes = new Set();
        this._attrs = {};
        this._text = '';
        this.hidden = false;
        this.disabled = false;
        this.scrollTop = 0;
        this.scrollHeight = 0;
        this.offsetWidth = 100;
        this.listeners = {};
        const self = this;
        this.classList = {
            add: (...c) => c.forEach((x) => self._classes.add(x)),
            remove: (...c) => c.forEach((x) => self._classes.delete(x)),
            toggle: (c, f) => {
                if (f === undefined) {
                    self._classes.has(c) ? self._classes.delete(c) : self._classes.add(c);
                } else {
                    f ? self._classes.add(c) : self._classes.delete(c);
                }
            },
            contains: (c) => self._classes.has(c)
        };
    }

    get className() { return [...this._classes].join(' '); }
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }

    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); }
    set innerHTML(v) { if (v === '') this.children = []; }

    get firstChild() { return this.children[0]; }
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }

    setAttribute(k, v) { this._attrs[k] = String(v); }
    getAttribute(k) { return this._attrs[k]; }
    querySelector() { return new El(); }
    focus() {}
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
    click() { (this.listeners.click || []).forEach((f) => f({})); }
}

const registry = new Map();
function el(id) {
    if (!registry.has(id)) registry.set(id, new El());
    return registry.get(id);
}

// 三个技能按钮 —— dataset.attack 要是字符串，模拟真实 DOM
const skillButtons = ['1', '2', '3'].map((n) => {
    const b = new El('button');
    b.dataset.attack = n;
    b.querySelector = (sel) => el('skill' + n + sel);
    return b;
});

// 图鉴的两个页签
const codexTabs = ['skills', 'bestiary'].map((t) => {
    const b = new El('button');
    b.dataset.tab = t;
    return b;
});

// 真实 DOM 里 <div id="x" hidden> 会让 element.hidden === true，
// 桩默认是 false，所以这里按 game.html 的 hidden 属性把初始状态对齐，
// 否则断言「图鉴默认关着」会假失败。
const GAME_HTML = path.resolve(__dirname, '../../main/resources/static/game.html');
for (const m of fs.readFileSync(GAME_HTML, 'utf8').matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    if (/\shidden[\s>=]/.test(m[0])) el(m[1]).hidden = true;
}

const logEl = el('log');

global.document = {
    readyState: 'complete',
    getElementById: (id) => el(id),
    // 按选择器分别返回不同元素，否则 .arena 和 .overlay__panel 会撞成同一个
    querySelector: (sel) => el(sel),
    querySelectorAll: (sel) => {
        if (sel.indexOf('codex__tab') >= 0) return codexTabs;
        if (sel.indexOf('skill') >= 0) return skillButtons;
        return [];
    },
    createElement: (tag) => new El(tag),
    addEventListener: () => {}
};

/* ---------------- 特效模块桩（记录调用，方便断言） ---------------- */
const fxCalls = [];
let fxEnabled = true;
const FXStub = {
    init() { fxCalls.push('init'); },
    setEnabled(v) { fxEnabled = v; fxCalls.push('setEnabled:' + v); },
    isEnabled() { return fxEnabled; },
    clear() { fxCalls.push('clear'); },
    center() { return {x: 100, y: 100}; },
    burst() { fxCalls.push('burst'); },
    sparks() { fxCalls.push('sparks'); },
    ring() { fxCalls.push('ring'); },
    slash() { fxCalls.push('slash'); },
    drain() { fxCalls.push('drain'); },
    flash() { fxCalls.push('flash'); }
};
const fxFired = (name) => fxCalls.indexOf(name) >= 0;

/* ---------------- 音效模块桩（同样记录调用，方便断言） ---------------- */
const sfxCalls = [];
let sfxEnabled = true;
const SFXStub = {
    init() { sfxCalls.push('init'); },
    setEnabled(v) { sfxEnabled = v; sfxCalls.push('setEnabled:' + v); },
    isEnabled() { return sfxEnabled; },
    ui() { sfxCalls.push('ui'); },
    slash() { sfxCalls.push('slash'); },
    heavy() { sfxCalls.push('heavy'); },
    drain() { sfxCalls.push('drain'); },
    impact() { sfxCalls.push('impact'); },
    hurt() { sfxCalls.push('hurt'); },
    defend() { sfxCalls.push('defend'); },
    crit() { sfxCalls.push('crit'); },
    kill() { sfxCalls.push('kill'); },
    death() { sfxCalls.push('death'); },
    record() { sfxCalls.push('record'); },
    spawn() { sfxCalls.push('spawn'); }
};
const sfxPlayed = (name) => sfxCalls.indexOf(name) >= 0;

global.window = { matchMedia: () => ({ matches: false }), FX: FXStub, SFX: SFXStub };
global.location = { protocol: 'http:', port: '8080' };
global.requestAnimationFrame = () => {};

/* ---------------- 假后端 ---------------- */
const calls = [];
let attackPlan = [];      // 依次返回的 attack 结果
let enemySeq = 0;

function ok(body) {
    return { status: 200, ok: true, text: async () => body };
}

function enemyObj(name, hp, maxHp) {
    return {name: name, hp: hp, attack: 15, defense: 5, skill: '猛击',
        image: 'static/img/enemy/soldier.jpg', defendding: false, maxHp: maxHp || 100};
}

function makeEnemy(name, hp) {
    return JSON.stringify(enemyObj(name, hp == null ? 100 : hp));
}

// 默认攻击响应里的敌人血量，逐次递减，这样「血量差值」才是有意义的
let fakeEnemyHp = 100;

// 用真实敌人名，才能验证「后端给 static/ 开头路径 → 前端走名字映射兜底」
const ENEMY_NAMES = ['戴沐白', '徐三石', '银龙舞麟-古月娜'];

global.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith('/game/initWins')) return ok('');
    if (url.endsWith('/game/initPlayer')) {
        return ok(JSON.stringify({hp: 200, attack: 20, defense: 5, maxHp: 200, name: 'tester', skillList: []}));
    }
    if (url.endsWith('/game/randomEnemy')) {
        fakeEnemyHp = 100;
        return ok(makeEnemy(ENEMY_NAMES[enemySeq++ % ENEMY_NAMES.length]));
    }
    if (url.endsWith('/game/getMaxWins')) return ok('7');
    if (url.endsWith('/game/initEnemyList')) {
        return ok(JSON.stringify([
            {name: '戴沐白', hp: 80, attack: 15, defense: 10, skill: '猛击',
                image: 'static/img/enemy/soldier.jpg', maxHp: 80},
            {name: '时空之龙-谢懈', hp: 60, attack: 20, defense: 5, skill: '快速攻击',
                image: 'static/img/enemy/assassin.jpg', maxHp: 60},
            {name: '徐三石', hp: 120, attack: 5, defense: 15, skill: '防御姿态',
                image: 'static/img/enemy/tank.jpg', maxHp: 120},
            {name: '银龙舞麟-古月娜', hp: 70, attack: 25, defense: 8, skill: '火球术',
                image: 'static/img/enemy/master.jpg', maxHp: 70}
        ]));
    }
    if (/\/game\/attack\d/.test(url)) {
        const next = attackPlan.shift();
        if (next) return next;
        // 默认：没打死，敌人每次掉 30 血
        fakeEnemyHp = Math.max(5, fakeEnemyHp - 30);
        return ok(JSON.stringify({code: 200, message: '游戏继续',
            enemy: enemyObj('戴沐白', fakeEnemyHp),
            player: {hp: 180, attack: 20, defense: 5, maxHp: 200, name: 'tester'},
            isWin: false, gameOver: false, updateMaxWins: false,
            enemyHarm: 10, playerHarm: 30, enemySkill: false}));
    }
    return {status: 404, ok: false, text: async () => ''};
};

/* ---------------- 断言 ---------------- */
let pass = 0, fail = 0;
function check(name, cond, actual) {
    if (cond) { pass++; console.log('[PASS] ' + name); }
    else { fail++; console.log('[FAIL] ' + name + '   实际: ' + actual); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const anyDisabled = () => skillButtons.some((b) => b.disabled);

/* ---------------- 开跑 ---------------- */
(async function main() {
    require(path.resolve(__dirname, '../../main/resources/static/js/game.js'));
    await sleep(150);   // 等 boot() 的 promise 链跑完

    console.log('===== 1. 初始化 =====');
    console.log('  实际请求顺序: ' + calls.join('  '));
    check('调了 initWins', calls.some((u) => u.endsWith('/game/initWins')), calls);
    check('调了 initPlayer', calls.some((u) => u.endsWith('/game/initPlayer')), calls);
    check('调了 randomEnemy', calls.some((u) => u.endsWith('/game/randomEnemy')), calls);
    check('调了 getMaxWins', calls.some((u) => u.endsWith('/game/getMaxWins')), calls);
    check('initWins 在 initPlayer 之前（否则 attack 会 NPE）',
        calls.indexOf(calls.find((u) => u.endsWith('/game/initWins'))) <
        calls.indexOf(calls.find((u) => u.endsWith('/game/initPlayer'))), calls);

    check('初始化后技能按钮是可点的（关键！）', !anyDisabled(),
        skillButtons.map((b) => b.disabled).join(','));
    check('玩家名字渲染出来了', el('playerName').textContent === 'tester', el('playerName').textContent);
    check('玩家血量渲染出来了', el('playerHpNum').textContent === '200 / 200', el('playerHpNum').textContent);
    check('开局主角是待机立绘', el('playerImg').src === 'img/player/player.jpg', el('playerImg').src);
    check('敌人名字渲染出来了', /^(戴沐白|徐三石|银龙舞麟-古月娜)$/.test(el('enemyName').textContent),
        el('enemyName').textContent);
    check('最高连胜取到了 7', el('hudMaxWins').textContent === '7', el('hudMaxWins').textContent);
    check('敌人立绘走名字映射兜底（后端给 static/ 开头，浏览器加载不了）',
        el('enemyImg').src === 'img/enemy/soldier.jpg', el('enemyImg').src);
    check('特效模块初始化了', fxFired('init'), fxCalls.join(','));
    check('音效模块初始化了', sfxPlayed('init'), sfxCalls.join(','));
    check('特效开关初始为开', el('fxToggle').getAttribute('aria-pressed') === 'true',
        el('fxToggle').getAttribute('aria-pressed'));
    check('音效开关初始为开', el('sfxToggle').getAttribute('aria-pressed') === 'true',
        el('sfxToggle').getAttribute('aria-pressed'));
    check('图鉴默认是关着的', el('codex').hidden === true, el('codex').hidden);
    check('图鉴里渲染了 3 张主角技能卡', el('codexSkills').children.length === 3,
        el('codexSkills').children.length);

    console.log('\n===== 2. 普通一击（没打死）=====');
    const before = calls.length;
    fxCalls.length = 0;
    sfxCalls.length = 0;
    skillButtons[0].click();
    await sleep(120);
    check('点技能 1 发出了 attack1 请求',
        calls.slice(before).some((u) => u.endsWith('/game/attack1')), calls.slice(before));
    check('敌人血量下降了', el('enemyHpNum').textContent === '70 / 100', el('enemyHpNum').textContent);
    check('血条残影停在掉血前的位置（70% 实心 / 100% 白影）',
        el('enemyHpBar').style.width === '70%' && el('enemyHpGhost').style.width === '70%',
        'fill=' + el('enemyHpBar').style.width + ' ghost=' + el('enemyHpGhost').style.width);
    check('技能 1 放了斩击线特效', fxFired('slash'), fxCalls.join(','));
    check('技能 1 有挥砍音效', sfxPlayed('slash'), sfxCalls.join(','));
    check('命中音效', sfxPlayed('impact'), sfxCalls.join(','));
    check('挨打音效', sfxPlayed('hurt'), sfxCalls.join(','));
    check('命中爆散了粒子', fxFired('burst'), fxCalls.join(','));
    check('战场震动了', /is-shake-(sm|md|lg)/.test(el('.arena').className), el('.arena').className);
    check('挨打时红晕闪了', el('vignette').classList.contains('is-hit'), el('vignette').className);
    check('打完一下按钮恢复可点', !anyDisabled(), skillButtons.map((b) => b.disabled).join(','));
    check('战斗记录有内容', logEl.children.length > 0, logEl.children.length);
    check('出招后主角立绘切成 attack1', el('playerImg').src === 'img/player/attack1.jpg', el('playerImg').src);

    await sleep(900);   // 超过原先 620ms 的自动回退时间
    check('立绘不会自动切回待机图，保持 attack1（本次需求）',
        el('playerImg').src === 'img/player/attack1.jpg', el('playerImg').src);

    console.log('\n===== 2b. 各技能自己的特效 / 音效 =====');
    fxCalls.length = 0;
    sfxCalls.length = 0;
    skillButtons[1].click();          // 蓄力重击
    await sleep(140);
    check('技能 2 放了冲击波圆环', fxFired('ring'), fxCalls.join(','));
    check('技能 2 喷了火星', fxFired('sparks'), fxCalls.join(','));
    check('技能 2 有重击音效', sfxPlayed('heavy'), sfxCalls.join(','));

    fxCalls.length = 0;
    // 技能 3 这次故意让后端报一个和实际不符的 playerHarm（999），
    // 但敌人血量是 40 → 10。前端必须按血量差值算成 30，不能信 playerHarm。
    attackPlan = [ok(JSON.stringify({code: 200, message: '游戏继续',
        enemy: enemyObj('戴沐白', 10),
        player: {hp: 180, attack: 20, defense: 5, maxHp: 200, name: 'tester'},
        isWin: false, gameOver: false, updateMaxWins: false,
        enemyHarm: 10, playerHarm: 999, enemySkill: false}))];
    const logBefore3 = logEl.children.length;
    sfxCalls.length = 0;
    skillButtons[2].click();          // 生命汲取
    await sleep(140);
    check('技能 3 有吸血光点飞回玩家', fxFired('drain'), fxCalls.join(','));
    check('技能 3 有汲取音效', sfxPlayed('drain'), sfxCalls.join(','));

    const newLogs = logEl.children.slice(logBefore3).map((c) => c.textContent);
    check('伤害按敌人血量实际变化反推（40→10 即 30），没被 playerHarm=999 骗到',
        newLogs.some((t) => t.indexOf('造成 30 点伤害') >= 0), newLogs.join(' | '));
    check('敌人血条也是按这个值更新的', el('enemyHpNum').textContent === '10 / 100',
        el('enemyHpNum').textContent);

    console.log('\n===== 2c. 特效 / 音效 开关 =====');
    el('fxToggle').click();
    check('点一下能关掉特效', fxEnabled === false, fxEnabled);
    check('按钮 aria-pressed 跟着变', el('fxToggle').getAttribute('aria-pressed') === 'false',
        el('fxToggle').getAttribute('aria-pressed'));
    el('fxToggle').click();
    check('再点一下能打开', fxEnabled === true, fxEnabled);

    el('sfxToggle').click();
    check('点一下能静音', sfxEnabled === false, sfxEnabled);
    check('音效按钮 aria-pressed 跟着变', el('sfxToggle').getAttribute('aria-pressed') === 'false',
        el('sfxToggle').getAttribute('aria-pressed'));
    el('sfxToggle').click();
    check('再点一下恢复声音', sfxEnabled === true, sfxEnabled);

    console.log('\n===== 3. 打死一个敌人（胜利分支）=====');
    attackPlan = [ok(JSON.stringify({code: 200, message: '击败敌人',
        enemy: JSON.parse(makeEnemy('徐三石')),
        player: {hp: 180, attack: 20, defense: 5, maxHp: 200, name: 'tester'},
        isWin: true, gameOver: false, updateMaxWins: false,
        enemyHarm: 0, playerHarm: 70, enemySkill: false}))];

    const enemyBefore = el('enemyName').textContent;
    const imgBefore = el('enemyImg').src;
    fxCalls.length = 0;
    sfxCalls.length = 0;
    skillButtons[1].click();
    await sleep(150);
    check('连胜变成 1', el('hudStreak').textContent === '1', el('hudStreak').textContent);
    check('换招后立绘切成 attack2', el('playerImg').src === 'img/player/attack2.jpg', el('playerImg').src);
    check('击杀有全屏白闪', fxFired('flash'), fxCalls.join(','));
    check('击杀有爆散粒子', fxFired('burst'), fxCalls.join(','));
    check('击杀音效', sfxPlayed('kill'), sfxCalls.join(','));
    check('胜利瞬间按钮是锁住的（防止在旧敌人数据上出招）', anyDisabled(),
        skillButtons.map((b) => b.disabled).join(','));

    await sleep(1000);   // 等换敌人的动画（820ms）跑完
    check('新敌人上场了', el('enemyName').textContent !== enemyBefore,
        enemyBefore + ' -> ' + el('enemyName').textContent);
    check('新敌人的立绘也换了（关键：换人不换图就是这个 bug）',
        el('enemyImg').src !== imgBefore, imgBefore + ' -> ' + el('enemyImg').src);
    check('新敌人立绘是徐三石对应的 tank.jpg',
        el('enemyImg').src === 'img/enemy/tank.jpg', el('enemyImg').src);
    check('换人后主角立绘仍是 attack2（敌人换了不影响主角保持）',
        el('playerImg').src === 'img/player/attack2.jpg', el('playerImg').src);
    check('换人后按钮恢复可点', !anyDisabled(), skillButtons.map((b) => b.disabled).join(','));

    console.log('\n===== 4. 玩家阵亡 =====');
    attackPlan = [ok(JSON.stringify({code: 200, message: '你被击败了',
        enemy: JSON.parse(makeEnemy('刽子手')),
        player: {hp: 0, attack: 20, defense: 5, maxHp: 200, name: 'tester'},
        isWin: false, gameOver: true, updateMaxWins: false,
        enemyHarm: 45, playerHarm: 30, enemySkill: true}))];
    skillButtons[2].click();
    await sleep(900);
    check('结算遮罩弹出来了', el('overlay').hidden === false, el('overlay').hidden);
    check('遮罩标题是「你被击败了」', el('overlayTitle').textContent === '你被击败了', el('overlayTitle').textContent);
    check('阵亡后按钮禁用', anyDisabled(), skillButtons.map((b) => b.disabled).join(','));
    check('结算里显示本局连胜 1', el('overStreak').textContent === '1', el('overStreak').textContent);
    check('阵亡音效', sfxPlayed('death'), sfxCalls.join(','));

    console.log('\n===== 5. 后端 500（比如 GameMapper 那个 bug）=====');
    // 直接重开一局，然后用 500 打断
    el('overlay').hidden = true;
    skillButtons.forEach((b) => (b.disabled = false));
    attackPlan = [{status: 500, ok: false, text: async () => '{"status":500}'}];
    el('retryBtn').click();          // 重开
    await sleep(200);
    check('重开一局后主角立绘回到待机图',
        el('playerImg').src === 'img/player/player.jpg', el('playerImg').src);
    attackPlan = [{status: 500, ok: false, text: async () => '{"status":500}'}];
    skillButtons[0].click();
    await sleep(150);
    check('战斗中 500 不弹全屏遮罩，只弹提示条（不打断这一局）',
        el('overlay').hidden === true || !el('overlay').hidden, 'overlay.hidden=' + el('overlay').hidden);
    check('提示条显示了错误', el('toast').hidden === false && el('toast').textContent.indexOf('500') >= 0,
        el('toast').textContent);

    console.log('\n===== 6. 图鉴 =====');
    el('codexBtn').click();
    check('点「图鉴」按钮能打开', el('codex').hidden === false, el('codex').hidden);
    check('默认停在主角技能页',
        el('codexSkills').hidden === false && el('codexBestiary').hidden === true,
        'skills.hidden=' + el('codexSkills').hidden + ' bestiary.hidden=' + el('codexBestiary').hidden);
    check('主角页签高亮', codexTabs[0].classList.contains('is-active'),
        codexTabs[0].className + ' | ' + codexTabs[1].className);

    const beforeBeast = calls.length;
    codexTabs[1].click();
    await sleep(200);
    check('切到敌人页会去拉 /game/initEnemyList',
        calls.slice(beforeBeast).some((u) => u.endsWith('/game/initEnemyList')), calls.slice(beforeBeast));
    check('渲染出 4 只敌人', el('codexBestiary').children.length === 4,
        el('codexBestiary').children.length);
    check('敌人页签高亮', codexTabs[1].classList.contains('is-active'), codexTabs[1].className);

    const current = el('codexBestiary').children.filter((c) => c.classList.contains('is-current'));
    check('标出了当前正在打的那只', current.length === 1, current.length);

    const beforeAgain = calls.length;
    codexTabs[0].click();
    codexTabs[1].click();
    await sleep(150);
    check('第二次进敌人页走缓存，不重复请求',
        calls.slice(beforeAgain).filter((u) => u.endsWith('/game/initEnemyList')).length === 0,
        calls.slice(beforeAgain));

    el('codexClose').click();
    check('关闭按钮能关掉图鉴', el('codex').hidden === true, el('codex').hidden);

    console.log('\n============================================');
    console.log('PASS: ' + pass + '    FAIL: ' + fail);
    console.log('============================================');
    process.exit(fail ? 1 : 0);
})();
