// ========== 游戏大厅切换逻辑 ==========
const hallContainer = document.querySelector('.hall-container');
const tankContainer = document.getElementById('tankGameContainer');

document.querySelectorAll('.game-card[data-game="tank"]').forEach(card => {
    card.addEventListener('click', () => {
        hallContainer.style.display = 'none';
        tankContainer.style.display = 'block';
        if (typeof initTankGame === 'function') initTankGame();
    });
});

function backToHall() {
    hallContainer.style.display = 'block';
    tankContainer.style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (e.target.id === 'backToHallBtn') backToHall();
});

// ========== 坦克大战游戏代码（豪华整合版）==========
function initTankGame() {
    // 防止重复初始化
    if (window.tankInitialized) return;
    window.tankInitialized = true;
    
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreSpan = document.getElementById('score');
    const livesSpan = document.getElementById('lives');
    const killsSpan = document.getElementById('kills');
    const totalScoreSpan = document.getElementById('totalScore');
    const restartBtn = document.getElementById('restartBtn');
    const shopBtn = document.getElementById('shopBtn');
    const modal = document.getElementById('shopModal');
    const closeBtn = document.querySelector('.close');
    const skinGrid = document.getElementById('skinGrid');
    const modalTotalScoreSpan = document.getElementById('modalTotalScore');
    const comboCountSpan = document.getElementById('comboCount');
    const comboMultiplierSpan = document.getElementById('comboMultiplier');
    const comboPanel = document.getElementById('comboPanel');
    const powerupSlotSpan = document.getElementById('powerupSlot');
    const dailyMissionSpan = document.getElementById('dailyMission');
    const dailyRewardSpan = document.getElementById('dailyReward');
    const dailyStatusSpan = document.getElementById('dailyStatus');

    const W = 900, H = 700;
    const TANK_SIZE = 36;
    const BULLET_SIZE = 6;
    
    // ========== 游戏状态 ==========
    let currentGameScore = 0;
    let totalScore = 0;
    let lives = 3;
    let kills = 0;
    let gameOver = false;
    let level = 1;
    
    // 难度系统
    let difficulty = 'normal';
    let difficultySettings = {
        easy: { enemySpeed: 0.8, enemyShootDelay: 90, playerSpeed: 4, enemyCount: 2, bossHp: 8 },
        normal: { enemySpeed: 1.2, enemyShootDelay: 70, playerSpeed: 3.5, enemyCount: 3, bossHp: 12 },
        hard: { enemySpeed: 1.8, enemyShootDelay: 50, playerSpeed: 3, enemyCount: 4, bossHp: 16 }
    };
    let currentDifficultySetting = difficultySettings.normal;
    
    // 连击系统
    let combo = 0;
    let comboMultiplier = 1;
    let lastKillTime = 0;
    const COMBO_TIMEOUT = 3000;
    
    // 道具系统
    let heldPowerup = null;
    let shieldActive = false;
    let shieldEndTime = 0;
    let doubleShotActive = false;
    let doubleShotEndTime = 0;
    
    // 每日挑战
    let dailyMission = { type: 'kill', target: 10, current: 0, reward: 200, completed: false };
    
    // Boss战
    let bossActive = false;
    let boss = null;
    
    // 皮肤系统
    let currentSkin = 'dragon';
    let ownedSkins = new Set(['dragon']);
    let skins = {};
    
    // 动态物体
    let bullets = [];
    let enemies = [];
    let powerups = [];
    let base = { x: W/2 - 30, y: H - 80, w: 60, h: 40, hp: 3 };
    let bricks = [];
    let steelWalls = [];
    const BRICK_SIZE = 30;
    
    // 玩家
    let player = {
        x: W/2 - TANK_SIZE/2,
        y: H - 150,
        w: TANK_SIZE,
        h: TANK_SIZE,
        direction: 'up',
        shootCooldown: 0,
        invincibleFrames: 0,
        speed: 3.5
    };
    
    const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false, space: false, keyJ: false };
    
    // ========== 初始化每日挑战 ==========
    function initDailyChallenge() {
        let today = new Date().toDateString();
        let saved = localStorage.getItem('tankDaily');
        if (saved) {
            let data = JSON.parse(saved);
            if (data.date === today) {
                dailyMission = data.mission;
                dailyMission.completed = data.completed;
                dailyMission.current = data.current;
            } else {
                generateDailyMission();
            }
        } else {
            generateDailyMission();
        }
        updateDailyUI();
    }
    
    function generateDailyMission() {
        let types = ['kill', 'combo', 'noHit'];
        let type = types[Math.floor(Math.random() * 3)];
        if (type === 'kill') {
            dailyMission = { type: 'kill', target: 10 + Math.floor(Math.random() * 10), current: 0, reward: 200, completed: false };
            dailyMissionSpan.innerText = `击毁 ${dailyMission.target} 个敌人`;
        } else if (type === 'combo') {
            dailyMission = { type: 'combo', target: 15 + Math.floor(Math.random() * 15), current: 0, reward: 300, completed: false };
            dailyMissionSpan.innerText = `达成 ${dailyMission.target} 连击`;
        } else {
            dailyMission = { type: 'noHit', target: 1, current: 0, reward: 500, completed: false };
            dailyMissionSpan.innerText = `无伤通关一局`;
        }
        dailyRewardSpan.innerText = `奖励 +${dailyMission.reward}`;
        dailyMission.completed = false;
        dailyMission.current = 0;
    }
    
    function updateDailyUI() {
        if (dailyMission.completed) {
            dailyStatusSpan.innerText = '✓ 已完成';
            dailyStatusSpan.style.color = '#44ff88';
        } else {
            if (dailyMission.type === 'kill') dailyStatusSpan.innerText = `进度: ${dailyMission.current}/${dailyMission.target}`;
            else if (dailyMission.type === 'combo') dailyStatusSpan.innerText = `最高: ${dailyMission.current}/${dailyMission.target}`;
            else dailyStatusSpan.innerText = '未完成';
            dailyStatusSpan.style.color = '#ffaa44';
        }
        let today = new Date().toDateString();
        localStorage.setItem('tankDaily', JSON.stringify({ date: today, mission: dailyMission, completed: dailyMission.completed, current: dailyMission.current }));
    }
    
    function checkDailyProgress(type, value) {
        if (dailyMission.completed) return;
        if (type === 'kill' && dailyMission.type === 'kill') {
            dailyMission.current += value;
            if (dailyMission.current >= dailyMission.target) completeDaily();
        } else if (type === 'combo' && dailyMission.type === 'combo') {
            if (value > dailyMission.current) dailyMission.current = value;
            if (dailyMission.current >= dailyMission.target) completeDaily();
        }
        updateDailyUI();
    }
    
    function completeDaily() {
        dailyMission.completed = true;
        totalScore += dailyMission.reward;
        saveTotalScore();
        updateUI();
        updateDailyUI();
        alert(`🎉 完成每日挑战！获得 ${dailyMission.reward} 积分！`);
    }
    
    // ========== 连击系统 ==========
    function updateCombo() {
        let now = Date.now();
        if (now - lastKillTime > COMBO_TIMEOUT) {
            combo = 0;
            comboMultiplier = 1;
        }
        comboCountSpan.innerText = combo;
        comboMultiplierSpan.innerText = `(x${comboMultiplier})`;
        if (combo > 0) comboPanel.classList.add('combo-active');
        else comboPanel.classList.remove('combo-active');
    }
    
    function addKill() {
        let now = Date.now();
        if (now - lastKillTime <= COMBO_TIMEOUT) {
            combo++;
        } else {
            combo = 1;
        }
        lastKillTime = now;
        comboMultiplier = Math.min(1 + Math.floor(combo / 10), 5);
        updateCombo();
        checkDailyProgress('combo', combo);
    }
    
    // ========== 道具系统 ==========
    function spawnPowerup(x, y) {
        let types = ['bomb', 'shield', 'double'];
        let type = types[Math.floor(Math.random() * 3)];
        powerups.push({ x: x, y: y, w: 20, h: 20, type: type });
    }
    
    function usePowerup() {
        if (!heldPowerup) return false;
        if (heldPowerup === 'bomb') {
            enemies = [];
            if (bossActive && boss) boss.hp = 0;
        } else if (heldPowerup === 'shield') {
            shieldActive = true;
            shieldEndTime = Date.now() + 8000;
        } else if (heldPowerup === 'double') {
            doubleShotActive = true;
            doubleShotEndTime = Date.now() + 10000;
        }
        heldPowerup = null;
        powerupSlotSpan.innerText = '无';
        return true;
    }
    
    function updatePowerups() {
        let now = Date.now();
        if (shieldActive && now > shieldEndTime) shieldActive = false;
        if (doubleShotActive && now > doubleShotEndTime) doubleShotActive = false;
    }
    
    // ========== 难度设置 ==========
    function setDifficulty(diff) {
        difficulty = diff;
        currentDifficultySetting = difficultySettings[diff];
        player.speed = currentDifficultySetting.playerSpeed;
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            if (btn.dataset.diff === diff) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }
    
    // ========== Boss系统 ==========
    function spawnBoss() {
        bossActive = true;
        boss = {
            x: W/2 - 40,
            y: 60,
            w: 80,
            h: 80,
            hp: currentDifficultySetting.bossHp,
            maxHp: currentDifficultySetting.bossHp,
            direction: 'down',
            shootTimer: 0
        };
        enemies = [];
    }
    
    function updateBoss() {
        if (!bossActive || !boss) return;
        boss.shootTimer++;
        if (boss.shootTimer > 40) {
            boss.shootTimer = 0;
            shoot('enemy', boss.x + boss.w/2, boss.y + boss.h/2, 'down');
            if (Math.random() > 0.5) shoot('enemy', boss.x + boss.w/2, boss.y + boss.h/2, 'left');
            if (Math.random() > 0.5) shoot('enemy', boss.x + boss.w/2, boss.y + boss.h/2, 'right');
        }
        let speed = 1.5;
        let dx = player.x - boss.x;
        if (Math.abs(dx) > 20) boss.x += dx > 0 ? speed : -speed;
        boss.x = Math.min(Math.max(boss.x, 20), W - boss.w - 20);
    }
    
    function drawBoss() {
        if (!bossActive || !boss) return;
        ctx.fillStyle = '#8a2a2a';
        ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
        ctx.fillStyle = '#aa4a4a';
        ctx.fillRect(boss.x+10, boss.y+10, boss.w-20, boss.h-20);
        ctx.fillStyle = '#ffaa44';
        ctx.fillRect(boss.x+30, boss.y-10, 20, 10);
        let hpPercent = boss.hp / boss.maxHp;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(boss.x, boss.y-15, boss.w * hpPercent, 8);
        ctx.fillStyle = '#ffff44';
        ctx.fillText('BOSS', boss.x+25, boss.y-5);
    }
    
    // ========== 皮肤系统 ==========
    function drawCommonTank(x, y, dir, bodyColor, accentColor) {
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x+4, y+2, 28, 4);
        ctx.fillRect(x+4, y+30, 28, 4);
        ctx.fillStyle = '#2a2a2a';
        for(let i = 0; i < 4; i++) {
            ctx.fillRect(x+6 + i*7, y+32, 3, 3);
            ctx.fillRect(x+6 + i*7, y+1, 3, 3);
        }
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x+6, y+8, 24, 20);
        ctx.fillStyle = accentColor;
        ctx.fillRect(x+12, y+13, 12, 10);
        ctx.fillStyle = '#5a5a5a';
        let centerX = x + 18, centerY = y + 18;
        if(dir === 'up') ctx.fillRect(centerX-3, y-6, 6, 14);
        else if(dir === 'down') ctx.fillRect(centerX-3, y+28, 6, 14);
        else if(dir === 'left') ctx.fillRect(x-6, centerY-3, 14, 6);
        else ctx.fillRect(x+28, centerY-3, 14, 6);
        ctx.fillStyle = '#ffcc66';
        if(dir === 'up') ctx.fillRect(centerX-1, y-4, 2, 4);
        else if(dir === 'down') ctx.fillRect(centerX-1, y+30, 2, 4);
        else if(dir === 'left') ctx.fillRect(x-4, centerY-1, 4, 2);
        else ctx.fillRect(x+30, centerY-1, 4, 2);
    }
    
    function initSkins() {
        skins = {
            dragon: { name: '🐉 中国龙', price: 0, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#c52a1a','#ffcc44') },
            tiger: { name: '🐅 虎斑', price: 500, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#e87c2a','#ffaa44') },
            ink: { name: '🎋 水墨', price: 500, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#4a5a6a','#8899aa') },
            steampunk: { name: '⚙️ 蒸汽朋克', price: 800, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#b87c3a','#ddaa66') },
            mecha: { name: '🤖 未来机甲', price: 1000, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#4a6e8a','#88ccff') },
            halloween: { name: '🎃 万圣节', price: 600, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#e87c2a','#ff8844') },
            dinosaur: { name: '🦖 恐龙时代', price: 700, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#5a8a3a','#88aa66') },
            sakura: { name: '🌸 樱花', price: 550, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#e8a0b0','#ffccee') },
            frost: { name: '❄️ 冰霜', price: 750, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#8accee','#aaddff') },
            magma: { name: '🔥 岩浆', price: 850, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#aa3a1a','#ffaa66') },
            galaxy: { name: '🌌 星空', price: 900, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#2a2a5a','#ccaaff') },
            graffiti: { name: '🎨 涂鸦', price: 450, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#8a6a4a','#ffaa88') },
            ghost: { name: '👻 幽灵', price: 650, draw: (x,y,dir) => drawCommonTank(x,y,dir,'#aaeeff','#ccffff') }
        };
    }
    
    // ========== 地图初始化 ==========
    function initMap() {
        bricks = [];
        for(let i = 0; i < 12; i++) {
            for(let j = 0; j < 5; j++) {
                if((i+j) % 3 !== 0 || (i > 3 && i < 8)) {
                    bricks.push({x: 50 + i * BRICK_SIZE, y: 60 + j * BRICK_SIZE, w: BRICK_SIZE-2, h: BRICK_SIZE-2});
                }
            }
        }
        for(let i = 0; i < 6; i++) {
            bricks.push({x: base.x - 40 + i * BRICK_SIZE, y: base.y - 35, w: BRICK_SIZE-2, h: BRICK_SIZE-2});
        }
    }
    
    function initSteelBoundary() {
        steelWalls = [];
        for(let x = 0; x < W; x += BRICK_SIZE) {
            steelWalls.push({x: x, y: 0, w: BRICK_SIZE, h: BRICK_SIZE});
            steelWalls.push({x: x, y: H - BRICK_SIZE, w: BRICK_SIZE, h: BRICK_SIZE});
        }
        for(let y = 0; y < H; y += BRICK_SIZE) {
            steelWalls.push({x: 0, y: y, w: BRICK_SIZE, h: BRICK_SIZE});
            steelWalls.push({x: W - BRICK_SIZE, y: y, w: BRICK_SIZE, h: BRICK_SIZE});
        }
    }
    
    function rectCollide(r1, r2) {
        return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
    }
    
    // ========== 玩家移动 ==========
    function movePlayer() {
        if(gameOver || shieldActive) return;
        let moveX = 0, moveY = 0;
        let speed = player.speed;
        if (keys.ArrowLeft || keys.a) moveX = -speed;
        if (keys.ArrowRight || keys.d) moveX = speed;
        if (keys.ArrowUp || keys.w) moveY = -speed;
        if (keys.ArrowDown || keys.s) moveY = speed;
        if(moveX === 0 && moveY === 0) return;
        
        let oldX = player.x;
        player.x += moveX;
        if(player.x < 10) player.x = 10;
        if(player.x + player.w > W - 10) player.x = W - player.w - 10;
        for(let brick of bricks) if(rectCollide(player, brick)) { player.x = oldX; break; }
        for(let wall of steelWalls) if(rectCollide(player, wall)) { player.x = oldX; break; }
        
        let oldY = player.y;
        player.y += moveY;
        if(player.y < 10) player.y = 10;
        if(player.y + player.h > H - 10) player.y = H - player.h - 10;
        for(let brick of bricks) if(rectCollide(player, brick)) { player.y = oldY; break; }
        for(let wall of steelWalls) if(rectCollide(player, wall)) { player.y = oldY; break; }
        
        if(moveX > 0) player.direction = 'right';
        if(moveX < 0) player.direction = 'left';
        if(moveY > 0) player.direction = 'down';
        if(moveY < 0) player.direction = 'up';
        if(player.invincibleFrames > 0) player.invincibleFrames--;
    }
    
    // ========== 敌人AI ==========
    class SmartEnemy {
        constructor(x, y) {
            this.x = x; this.y = y; this.w = TANK_SIZE; this.h = TANK_SIZE;
            this.direction = 'down'; this.shootTimer = Math.floor(Math.random() * 50); this.avoidTimer = 0;
        }
        update(player, bullets, otherEnemies) {
            let danger = false;
            for(let bullet of bullets) if(bullet.owner === 'player' && Math.hypot(this.x - bullet.x, this.y - bullet.y) < 80) { danger = true; break; }
            let moveX = 0, moveY = 0; const speed = currentDifficultySetting.enemySpeed;
            if(danger || this.avoidTimer > 0) {
                this.avoidTimer = 40;
                moveX = (Math.random() - 0.5) * speed; moveY = (Math.random() - 0.5) * speed;
            } else {
                let dx = player.x - this.x, dy = player.y - this.y;
                if(Math.abs(dx) > Math.abs(dy)) { moveX = dx > 0 ? speed : -speed; this.direction = dx > 0 ? 'right' : 'left'; }
                else { moveY = dy > 0 ? speed : -speed; this.direction = dy > 0 ? 'down' : 'up'; }
            }
            let oldX = this.x, oldY = this.y;
            this.x += moveX; this.y += moveY;
            this.x = Math.min(Math.max(this.x, 10), W - this.w - 10);
            this.y = Math.min(Math.max(this.y, 10), H - this.h - 10);
            for(let brick of bricks) if(rectCollide(this, brick)) { this.x = oldX; this.y = oldY; break; }
            for(let wall of steelWalls) if(rectCollide(this, wall)) { this.x = oldX; this.y = oldY; break; }
            if(this.avoidTimer > 0) this.avoidTimer--;
        }
        shoot() { this.shootTimer++; if(this.shootTimer > currentDifficultySetting.enemyShootDelay) { this.shootTimer = 0; return true; } return false; }
    }
    
    let enemiesList = [];
    
    function shoot(owner, fromX, fromY, direction) {
        bullets.push({ x: fromX - BULLET_SIZE/2, y: fromY - BULLET_SIZE/2, w: BULLET_SIZE, h: BULLET_SIZE, direction: direction, owner: owner });
        if (owner === 'player' && doubleShotActive) {
            let dirs = direction === 'up' || direction === 'down' ? ['left', 'right'] : ['up', 'down'];
            bullets.push({ x: fromX - BULLET_SIZE/2 - 10, y: fromY - BULLET_SIZE/2, w: BULLET_SIZE, h: BULLET_SIZE, direction: dirs[0], owner: owner });
            bullets.push({ x: fromX - BULLET_SIZE/2 + 10, y: fromY - BULLET_SIZE/2, w: BULLET_SIZE, h: BULLET_SIZE, direction: dirs[1], owner: owner });
        }
    }
    
    function updateBullets() {
        const bulletSpeed = 5;
        for(let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            switch(b.direction) { case 'up': b.y -= bulletSpeed; break; case 'down': b.y += bulletSpeed; break; case 'left': b.x -= bulletSpeed; break; case 'right': b.x += bulletSpeed; break; }
        }
        bullets = bullets.filter(b => {
            if(b.x + b.w < 0 || b.x > W || b.y + b.h < 0 || b.y > H) return false;
            for(let i = 0; i < bricks.length; i++) if(rectCollide(b, bricks[i])) { bricks.splice(i,1); return false; }
            for(let wall of steelWalls) if(rectCollide(b, wall)) return false;
            return true;
        });
    }
    
    function updateUI() {
        scoreSpan.innerText = currentGameScore;
        livesSpan.innerText = lives;
        killsSpan.innerText = kills;
        totalScoreSpan.innerText = totalScore;
    }
    
    function draw() {
        ctx.clearRect(0,0,W,H);
        ctx.fillStyle = '#2a5a3a'; ctx.fillRect(0,0,W,H);
        for(let brick of bricks) { ctx.fillStyle = '#b87c4f'; ctx.fillRect(brick.x, brick.y, brick.w, brick.h); ctx.fillStyle = '#9a5e3a'; ctx.fillRect(brick.x+4, brick.y+4, brick.w-8, brick.h-8); }
        for(let wall of steelWalls) { ctx.fillStyle = '#6a6e7b'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h); ctx.fillStyle = '#8a8e9b'; ctx.fillRect(wall.x+4, wall.y+4, wall.w-8, wall.h-8); }
        ctx.fillStyle = '#aa8866'; ctx.fillRect(base.x, base.y, base.w, base.h);
        ctx.fillStyle = '#ddccaa'; ctx.fillRect(base.x+10, base.y+10, 40, 20);
        ctx.fillStyle = '#aa5533'; ctx.beginPath(); ctx.moveTo(base.x+30, base.y+15); ctx.lineTo(base.x+20, base.y+30); ctx.lineTo(base.x+40, base.y+30); ctx.fill();
        for(let i = 0; i < base.hp; i++) { ctx.fillStyle = '#ff6644'; ctx.fillRect(base.x + 5 + i*15, base.y+base.h-8, 10, 5); }
        if(skins[currentSkin]) skins[currentSkin].draw(player.x, player.y, player.direction);
        if (shieldActive) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#88aaff'; ctx.fillRect(player.x-2, player.y-2, player.w+4, player.h+4); ctx.globalAlpha = 1; }
        if (bossActive) drawBoss();
        for(let enemy of enemiesList) {
            ctx.fillStyle = '#bf5a4c'; ctx.fillRect(enemy.x+6, enemy.y+8, 24, 20);
            ctx.fillStyle = '#8c3a2a'; ctx.fillRect(enemy.x+12, enemy.y+13, 12, 10);
            ctx.fillStyle = '#4a3a2a'; ctx.fillRect(enemy.x+4, enemy.y+2, 28, 4); ctx.fillRect(enemy.x+4, enemy.y+30, 28, 4);
            let ex = enemy.x+18, ey = enemy.y+18;
            if(enemy.direction === 'up') ctx.fillRect(ex-3, enemy.y-6, 6, 14);
            else if(enemy.direction === 'down') ctx.fillRect(ex-3, enemy.y+28, 6, 14);
            else if(enemy.direction === 'left') ctx.fillRect(enemy.x-6, ey-3, 14, 6);
            else ctx.fillRect(enemy.x+28, ey-3, 14, 6);
        }
        for(let bullet of bullets) { ctx.fillStyle = bullet.owner === 'player' ? '#ffff99' : '#ff9944'; ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h); }
        for(let p of powerups) {
            ctx.fillStyle = '#ffdd88'; ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#ffaa44'; ctx.fillRect(p.x+4, p.y+4, p.w-8, p.h-8);
            ctx.fillStyle = '#000'; ctx.font = '12px monospace';
            if(p.type === 'bomb') ctx.fillText('💣', p.x+5, p.y+15);
            if(p.type === 'shield') ctx.fillText('🛡', p.x+5, p.y+15);
            if(p.type === 'double') ctx.fillText('⚡', p.x+5, p.y+15);
        }
        if(gameOver) { ctx.font = 'bold 40px monospace'; ctx.fillStyle = '#ffccaa'; ctx.fillText(lives>0 && base.hp>0 ? '胜利!' : 'GAME OVER', W/2-80, H/2); }
    }
    
    function updateGame() {
        if(!gameOver) {
            movePlayer();
            if (bossActive) updateBoss();
            for(let i = 0; i < enemiesList.length; i++) {
                enemiesList[i].update(player, bullets, enemiesList);
                if(enemiesList[i].shoot()) shoot('enemy', enemiesList[i].x + TANK_SIZE/2, enemiesList[i].y + TANK_SIZE/2, enemiesList[i].direction);
            }
            updateBullets();
            updatePowerups();
            
            for(let i = 0; i < bullets.length; i++) {
                const bullet = bullets[i];
                if(bullet.owner === 'player') {
                    if (bossActive && boss && rectCollide(bullet, boss)) {
                        bullets.splice(i,1);
                        boss.hp--;
                        if (boss.hp <= 0) {
                            bossActive = false;
                            boss = null;
                            currentGameScore += 500;
                            totalScore += 500;
                            kills += 5;
                            addKill();
                            updateUI(); saveTotalScore();
                        }
                        i--; continue;
                    }
                    for(let j = 0; j < enemiesList.length; j++) {
                        if(rectCollide(bullet, enemiesList[j])) {
                            bullets.splice(i,1); enemiesList.splice(j,1);
                            let points = 20 * comboMultiplier;
                            currentGameScore += points; totalScore += points; kills++;
                            addKill();
                            updateUI(); saveTotalScore();
                            checkDailyProgress('kill', 1);
                            if(Math.random() < 0.2) spawnPowerup(enemiesList[j]?.x || 0, enemiesList[j]?.y || 0);
                            i--; break;
                        }
                    }
                } else if(bullet.owner === 'enemy') {
                    if(rectCollide(bullet, player) && player.invincibleFrames === 0 && !shieldActive) {
                        bullets.splice(i,1); lives--; player.invincibleFrames = 60; updateUI();
                        combo = 0; comboMultiplier = 1; updateCombo();
                        if(lives <= 0) gameOver = true;
                        else { player.x = W/2 - TANK_SIZE/2; player.y = H - 150; }
                        i--;
                    }
                    if(rectCollide(bullet, base)) { base.hp--; bullets.splice(i,1); if(base.hp <= 0) gameOver = true; i--; updateUI(); }
                }
            }
            
            if(player.shootCooldown > 0) player.shootCooldown--;
            if((keys.space || keys.keyJ) && player.shootCooldown === 0 && !gameOver) {
                shoot('player', player.x + TANK_SIZE/2, player.y + TANK_SIZE/2, player.direction);
                player.shootCooldown = doubleShotActive ? 20 : 35;
            }
            
            for(let i = 0; i < powerups.length; i++) {
                if(rectCollide(player, powerups[i])) {
                    heldPowerup = powerups[i].type;
                    powerupSlotSpan.innerText = heldPowerup === 'bomb' ? '💣 炸弹' : (heldPowerup === 'shield' ? '🛡 护盾' : '⚡ 双倍');
                    powerups.splice(i,1); i--;
                }
            }
            
            if (keys.keyB && heldPowerup) { usePowerup(); keys.keyB = false; }
            
            if(enemiesList.length === 0 && !bossActive && !gameOver) {
                if (level % 3 === 0) {
                    spawnBoss();
                } else {
                    level++;
                    let enemyCount = currentDifficultySetting.enemyCount + Math.floor(level/3);
                    for(let i = 0; i < enemyCount; i++) enemiesList.push(new SmartEnemy(100 + (i % 5) * 70, 70 + Math.floor(i/5) * 60));
                }
            }
        }
        draw();
        requestAnimationFrame(updateGame);
    }
    
    // ========== 积分持久化 ==========
    function loadTotalScore() { let saved = localStorage.getItem('tankTotalScore'); if(saved) totalScore = parseInt(saved) || 0; updateUI(); }
    function saveTotalScore() { localStorage.setItem('tankTotalScore', totalScore); updateUI(); }
    
    function loadSkins() {
        let saved = localStorage.getItem('tankOwnedSkins');
        if(saved) ownedSkins = new Set(JSON.parse(saved));
        else ownedSkins = new Set(['dragon']);
        let savedSkin = localStorage.getItem('tankCurrentSkin');
        if(savedSkin && ownedSkins.has(savedSkin)) currentSkin = savedSkin;
        else currentSkin = 'dragon';
    }
    function saveOwnedSkins() { localStorage.setItem('tankOwnedSkins', JSON.stringify([...ownedSkins])); }
    function saveCurrentSkin() { localStorage.setItem('tankCurrentSkin', currentSkin); }
    
    function buySkin(skinId) {
        let skin = skins[skinId];
        if(!skin || ownedSkins.has(skinId)) return false;
        if(totalScore >= skin.price) {
            totalScore -= skin.price; ownedSkins.add(skinId);
            saveTotalScore(); saveOwnedSkins(); renderShop(); updateUI();
            return true;
        }
        return false;
    }
    function equipSkin(skinId) { if(ownedSkins.has(skinId)) { currentSkin = skinId; saveCurrentSkin(); renderShop(); } }
    
    function renderShop() {
        if(!skinGrid) return;
        modalTotalScoreSpan.innerText = totalScore;
        skinGrid.innerHTML = '';
        for(let [id, skin] of Object.entries(skins)) {
            let owned = ownedSkins.has(id), equipped = (currentSkin === id);
            let card = document.createElement('div');
            card.className = `skin-card ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`;
            let previewDiv = document.createElement('div');
            previewDiv.className = 'skin-preview-container';
            let canvas = document.createElement('canvas');
            canvas.width = 100; canvas.height = 100;
            canvas.className = 'skin-preview-canvas';
            let tempCtx = canvas.getContext('2d');
            tempCtx.fillStyle = '#1a2a1a'; tempCtx.fillRect(0, 0, 100, 100);
            let bodyColor, accentColor;
            switch(id) {
                case 'dragon': bodyColor = '#c52a1a'; accentColor = '#ffcc44'; break;
                case 'tiger': bodyColor = '#e87c2a'; accentColor = '#ffaa44'; break;
                case 'ink': bodyColor = '#4a5a6a'; accentColor = '#8899aa'; break;
                case 'steampunk': bodyColor = '#b87c3a'; accentColor = '#ddaa66'; break;
                case 'mecha': bodyColor = '#4a6e8a'; accentColor = '#88ccff'; break;
                case 'halloween': bodyColor = '#e87c2a'; accentColor = '#ff8844'; break;
                case 'dinosaur': bodyColor = '#5a8a3a'; accentColor = '#88aa66'; break;
                case 'sakura': bodyColor = '#e8a0b0'; accentColor = '#ffccee'; break;
                case 'frost': bodyColor = '#8accee'; accentColor = '#aaddff'; break;
                case 'magma': bodyColor = '#aa3a1a'; accentColor = '#ffaa66'; break;
                case 'galaxy': bodyColor = '#2a2a5a'; accentColor = '#ccaaff'; break;
                case 'graffiti': bodyColor = '#8a6a4a'; accentColor = '#ffaa88'; break;
                default: bodyColor = '#c52a1a'; accentColor = '#ffcc44';
            }
            let x=32, y=32;
            tempCtx.fillStyle = '#4a3a2a';
            tempCtx.fillRect(x+4, y+2, 28, 4); tempCtx.fillRect(x+4, y+30, 28, 4);
            tempCtx.fillStyle = '#2a2a2a';
            for(let i=0;i<4;i++) { tempCtx.fillRect(x+6+i*7, y+32, 3, 3); tempCtx.fillRect(x+6+i*7, y+1, 3, 3); }
            tempCtx.fillStyle = bodyColor; tempCtx.fillRect(x+6, y+8, 24, 20);
            tempCtx.fillStyle = accentColor; tempCtx.fillRect(x+12, y+13, 12, 10);
            tempCtx.fillStyle = '#5a5a5a';
            tempCtx.fillRect(x+15, y-6, 6, 14);
            previewDiv.appendChild(canvas);
            let nameDiv = document.createElement('div'); nameDiv.className = 'skin-name'; nameDiv.innerText = skin.name;
            let priceDiv = document.createElement('div'); priceDiv.className = `skin-price ${owned ? 'owned' : ''}`; priceDiv.innerText = owned ? '✓ 已拥有' : `💰 ${skin.price} 积分`;
            let btnDiv = document.createElement('div');
            if (!owned) {
                let btn = document.createElement('button'); btn.innerText = '购买'; btn.className = 'buy-btn';
                btn.onclick = (e) => { e.stopPropagation(); if(buySkin(id)) renderShop(); else alert('积分不足！'); };
                btnDiv.appendChild(btn);
            } else if (!equipped) {
                let btn = document.createElement('button'); btn.innerText = '装备'; btn.className = 'equip-btn';
                btn.onclick = (e) => { e.stopPropagation(); equipSkin(id); renderShop(); };
                btnDiv.appendChild(btn);
            } else {
                let btn = document.createElement('button'); btn.innerText = '已装备 ✓'; btn.disabled = true; btn.className = 'equip-btn equipped';
                btnDiv.appendChild(btn);
            }
            card.appendChild(previewDiv); card.appendChild(nameDiv); card.appendChild(priceDiv); card.appendChild(btnDiv);
            let rarity = document.createElement('div');
            rarity.style.cssText = 'position: absolute; top: 8px; right: 8px; font-size: 0.7rem; background: #000000aa; padding: 2px 8px; border-radius: 20px;';
            if (skin.price === 0) rarity.innerText = '⭐'; else if (skin.price < 600) rarity.innerText = '💚'; else if (skin.price < 800) rarity.innerText = '💙'; else rarity.innerText = '💜';
            card.appendChild(rarity);
            skinGrid.appendChild(card);
        }
    }
    
    function restart() {
        gameOver = false; currentGameScore = 0; lives = 3; kills = 0; level = 1; combo = 0; comboMultiplier = 1; heldPowerup = null;
        shieldActive = false; doubleShotActive = false; bossActive = false; boss = null;
        bullets = []; powerups = []; base.hp = 3;
        player = { x: W/2 - TANK_SIZE/2, y: H - 150, w: TANK_SIZE, h: TANK_SIZE, direction: 'up', shootCooldown: 0, invincibleFrames: 0, speed: currentDifficultySetting.playerSpeed };
        enemiesList = [];
        for(let i = 0; i < currentDifficultySetting.enemyCount; i++) enemiesList.push(new SmartEnemy(120 + i*70, 70));
        initMap(); updateUI(); updateCombo(); powerupSlotSpan.innerText = '无';
    }
    
    function handleKeyDown(e) {
        let key = e.key;
        if(key === ' ' || key === 'Space' || key === 'j' || key === 'J') { keys.space = true; keys.keyJ = true; e.preventDefault(); }
        if(key === 'b' || key === 'B') { keys.keyB = true; usePowerup(); e.preventDefault(); }
        if(key === 'w' || key === 'W') keys.w = true;
        if(key === 's' || key === 'S') keys.s = true;
        if(key === 'a' || key === 'A') keys.a = true;
        if(key === 'd' || key === 'D') keys.d = true;
        if(key === 'ArrowUp') keys.ArrowUp = true;
        if(key === 'ArrowDown') keys.ArrowDown = true;
        if(key === 'ArrowLeft') keys.ArrowLeft = true;
        if(key === 'ArrowRight') keys.ArrowRight = true;
    }
    function handleKeyUp(e) {
        let key = e.key;
        if(key === ' ' || key === 'Space' || key === 'j' || key === 'J') { keys.space = false; keys.keyJ = false; }
        if(key === 'w' || key === 'W') keys.w = false;
        if(key === 's' || key === 'S') keys.s = false;
        if(key === 'a' || key === 'A') keys.a = false;
        if(key === 'd' || key === 'D') keys.d = false;
        if(key === 'ArrowUp') keys.ArrowUp = false;
        if(key === 'ArrowDown') keys.ArrowDown = false;
        if(key === 'ArrowLeft') keys.ArrowLeft = false;
        if(key === 'ArrowRight') keys.ArrowRight = false;
    }
    
    // 事件绑定
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
    });
    
    initSkins(); initSteelBoundary(); initMap(); initDailyChallenge();
    for(let i = 0; i < currentDifficultySetting.enemyCount; i++) enemiesList.push(new SmartEnemy(120 + i*70, 70));
    loadTotalScore(); loadSkins(); updateUI();
    restartBtn.addEventListener('click', () => restart());
    shopBtn.addEventListener('click', () => { renderShop(); modal.style.display = 'block'; });
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => { if(e.target === modal) modal.style.display = 'none'; });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    updateGame();
    setInterval(updateCombo, 100);
    
    console.log('坦克大战豪华版已启动！新功能：难度选择、连击系统、道具系统、Boss战、每日挑战');
}