/* ============================================================
   TEXT QUEST · 战斗特效
   一个很小的粒子系统，零依赖。game.js 通过 window.FX 调用。

   提供的效果：
     burst()   命中爆散火花
     sparks()  定向飞溅（重击用）
     ring()    冲击波圆环
     slash()   斩击线
     drain()   吸血光点（从敌人飞回玩家）
     flash()   全屏闪光
     center()  取元素中心坐标（用来定位特效）

   在系统设置「减少动效」时会自动关闭，也可以在页面上手动关。
   ============================================================ */
window.FX = (function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let canvas = null;
    let ctx = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let enabled = !reduceMotion;

    const particles = [];
    const rings = [];
    const slashes = [];
    const flashes = [];
    const MAX_PARTICLES = 700;

    const rand = (a, b) => a + Math.random() * (b - a);
    const TAU = Math.PI * 2;

    /* ---------------- 初始化 ---------------- */
    function init(canvasEl) {
        canvas = canvasEl;
        if (!canvas || !canvas.getContext) return;
        ctx = canvas.getContext('2d');
        resize();

        let t = null;
        window.addEventListener('resize', () => {
            clearTimeout(t);
            t = setTimeout(resize, 150);
        });

        let last = performance.now();
        (function loop(now) {
            const dt = Math.min((now - last) / 1000, 0.05);   // 切标签页回来时别一次跳太多
            last = now;
            step(dt);
            requestAnimationFrame(loop);
        })(last);
    }

    function resize() {
        if (!canvas) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth || window.innerWidth;
        H = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function setEnabled(v) {
        enabled = !!v;
        if (!enabled) clearAll();
    }

    function isEnabled() {
        return enabled;
    }

    function clearAll() {
        particles.length = 0;
        rings.length = 0;
        slashes.length = 0;
        flashes.length = 0;
    }

    /* ---------------- 取元素中心（页面坐标） ---------------- */
    function center(element, yRatio) {
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            return {x: W / 2, y: H / 2};
        }
        const r = element.getBoundingClientRect();
        return {
            x: r.left + r.width / 2,
            y: r.top + r.height * (yRatio == null ? 0.38 : yRatio)
        };
    }

    /* ---------------- 生成粒子 ---------------- */
    function push(p) {
        if (particles.length < MAX_PARTICLES) particles.push(p);
    }

    function makeParticle(x, y, opts) {
        return {
            x: x,
            y: y,
            vx: opts.vx,
            vy: opts.vy,
            life: opts.life,
            maxLife: opts.life,
            size: opts.size,
            color: opts.color,
            gravity: opts.gravity || 0,
            drag: opts.drag == null ? 0.99 : opts.drag,
            shape: opts.shape || 'dot',
            target: opts.target || null,
            homing: opts.homing || 0,
            glow: opts.glow !== false
        };
    }

    /** 命中爆散火花 */
    function burst(x, y, opts) {
        if (!enabled) return;
        opts = opts || {};
        const count = opts.count || 16;
        const speed = opts.speed || 260;
        const color = opts.color || '#ffd93d';
        const life = opts.life || 0.55;

        for (let i = 0; i < count; i++) {
            const a = rand(0, TAU);
            const sp = rand(speed * 0.35, speed);
            push(makeParticle(x, y, {
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 40,
                life: rand(life * 0.6, life),
                size: rand(1.6, opts.size || 3.6),
                color: color,
                gravity: opts.gravity == null ? 900 : opts.gravity,
                shape: Math.random() < 0.35 ? 'square' : 'dot'
            }));
        }
    }

    /** 定向飞溅（重击往上喷） */
    function sparks(x, y, opts) {
        if (!enabled) return;
        opts = opts || {};
        const count = opts.count || 18;
        const dir = opts.dir == null ? -Math.PI / 2 : opts.dir;
        const color = opts.color || '#ffd93d';

        for (let i = 0; i < count; i++) {
            const a = dir + rand(-0.75, 0.75);
            const sp = rand(200, 620);
            push(makeParticle(x, y, {
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: rand(0.32, 0.72),
                size: rand(1.4, 3.2),
                color: color,
                gravity: 1300,
                drag: 0.985,
                shape: 'line'
            }));
        }
    }

    /** 冲击波圆环 */
    function ring(x, y, opts) {
        if (!enabled) return;
        opts = opts || {};
        rings.push({
            x: x,
            y: y,
            r: opts.from == null ? 8 : opts.from,
            maxR: opts.radius || 130,
            life: opts.life || 0.5,
            maxLife: opts.life || 0.5,
            color: opts.color || '#ffd93d',
            width: opts.width || 4
        });
    }

    /** 斩击线 */
    function slash(x, y, opts) {
        if (!enabled) return;
        opts = opts || {};
        slashes.push({
            x: x,
            y: y,
            angle: opts.angle == null ? -0.6 : opts.angle,
            length: opts.length || 150,
            life: opts.life || 0.26,
            maxLife: opts.life || 0.26,
            color: opts.color || '#4df3ff',
            width: opts.width || 5,
            curve: opts.curve == null ? 0.35 : opts.curve
        });
    }

    /** 吸血光点：从 from 飞向 to */
    function drain(from, to, opts) {
        if (!enabled) return;
        opts = opts || {};
        const count = opts.count || 22;
        const color = opts.color || '#5cf08a';

        for (let i = 0; i < count; i++) {
            const a = rand(0, TAU);
            const sp = rand(60, 220);
            push(makeParticle(from.x + rand(-26, 26), from.y + rand(-26, 26), {
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: rand(0.55, 1.05),
                size: rand(1.8, 4.2),
                color: color,
                gravity: -60,
                drag: 0.96,
                shape: 'dot',
                target: {x: to.x, y: to.y},
                homing: opts.homing == null ? 9 : opts.homing
            }));
        }
    }

    /** 全屏闪光 */
    function flash(color, alpha, life) {
        if (!enabled) return;
        flashes.push({
            color: color || '#ffffff',
            alpha: alpha == null ? 0.45 : alpha,
            maxAlpha: alpha == null ? 0.45 : alpha,
            life: life || 0.22,
            maxLife: life || 0.22
        });
    }

    /* ---------------- 每帧更新 ---------------- */
    function step(dt) {
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);

        if (!enabled) return;

        // ---- 全屏闪光 ----
        for (let i = flashes.length - 1; i >= 0; i--) {
            const f = flashes[i];
            f.life -= dt;
            if (f.life <= 0) {
                flashes.splice(i, 1);
                continue;
            }
            const t = f.life / f.maxLife;
            ctx.globalAlpha = f.maxAlpha * t * t;
            ctx.fillStyle = f.color;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = 1;

        // ---- 冲击波 ----
        for (let i = rings.length - 1; i >= 0; i--) {
            const g = rings[i];
            g.life -= dt;
            if (g.life <= 0) {
                rings.splice(i, 1);
                continue;
            }
            const t = 1 - g.life / g.maxLife;
            const r = g.r + (g.maxR - g.r) * (1 - Math.pow(1 - t, 3));
            ctx.globalAlpha = (1 - t) * 0.85;
            ctx.strokeStyle = g.color;
            ctx.lineWidth = g.width * (1 - t * 0.6);
            ctx.beginPath();
            ctx.arc(g.x, g.y, r, 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // ---- 斩击线 ----
        for (let i = slashes.length - 1; i >= 0; i--) {
            const s = slashes[i];
            s.life -= dt;
            if (s.life <= 0) {
                slashes.splice(i, 1);
                continue;
            }
            const t = 1 - s.life / s.maxLife;
            const grow = Math.min(1, t * 3.2);
            const fade = 1 - Math.max(0, (t - 0.45) / 0.55);

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.globalAlpha = fade;
            ctx.strokeStyle = s.color;
            ctx.lineCap = 'round';
            ctx.lineWidth = s.width;
            if (s.glow) {
                ctx.shadowColor = s.color;
                ctx.shadowBlur = 18;
            }
            const half = (s.length * grow) / 2;
            ctx.beginPath();
            ctx.moveTo(-half, -half * s.curve);
            ctx.quadraticCurveTo(0, half * s.curve * 0.4, half, half * s.curve);
            ctx.stroke();
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        // ---- 粒子 ----
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            // 吸血：往目标收敛
            if (p.target) {
                const k = Math.min(1, p.homing * dt);
                p.vx += (p.target.x - p.x) * k * 2.2;
                p.vy += (p.target.y - p.y) * k * 2.2;
                p.vx *= 0.90;
                p.vy *= 0.90;
            }

            p.vy += p.gravity * dt;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            const t = p.life / p.maxLife;
            ctx.globalAlpha = Math.min(1, t * 1.6);
            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;

            if (p.glow) {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
            } else {
                ctx.shadowBlur = 0;
            }

            if (p.shape === 'line') {
                ctx.lineWidth = p.size * 0.7;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
                ctx.stroke();
            } else if (p.shape === 'square') {
                const s = p.size * (0.5 + t * 0.7);
                ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.8), 0, TAU);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    return {
        init: init,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        clear: clearAll,
        center: center,
        burst: burst,
        sparks: sparks,
        ring: ring,
        slash: slash,
        drain: drain,
        flash: flash
    };
})();
