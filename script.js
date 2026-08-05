const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// HUD Elements
const playerHpEl = document.getElementById('player-hp');
const playerTimeEl = document.getElementById('player-time');
const bossHpEl = document.getElementById('boss-hp');
const bossPhaseEl = document.getElementById('boss-phase');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');

const GROUND_Y = 380;
const GRAVITY = 0.55;

let timeScale = 1.0; // Escala global de tempo (para a mecânica de Slow Motion)
let particles = [];
let screenShake = 0;

const keys = { a: false, d: false, w: false, space: false, shift: false, j: false, k: false, r: false };

// ==========================================
// 1. HERÓI: CHRONO KNIGHT
// ==========================================
class Player {
    constructor() { this.reset(); }

    reset() {
        this.x = 100;
        this.y = GROUND_Y - 48;
        this.width = 32;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpForce = -12;
        this.isGrounded = true;

        this.hp = 100;
        this.maxHp = 100;
        this.timeEnergy = 100;
        this.maxTimeEnergy = 100;

        this.facing = 1;
        this.isDashing = false;
        this.canDash = true;
        this.isInvulnerable = false;

        this.isAttacking = false;
        this.attackCooldown = 0;
        this.damage = 25;
        this.ghosts = [];
    }

    update() {
        if (this.hp <= 0) return;

        // Regeração de Energia do Tempo
        if (!keys.k && this.timeEnergy < this.maxTimeEnergy) {
            this.timeEnergy = Math.min(this.maxTimeEnergy, this.timeEnergy + 0.25);
        }

        // Habilidade: Câmera Lenta
        if (keys.k && this.timeEnergy > 5) {
            timeScale = 0.3;
            this.timeEnergy -= 0.8;
            if (Math.random() < 0.3) {
                particles.push({
                    x: this.x + Math.random() * this.width,
                    y: this.y + Math.random() * this.height,
                    vx: 0, vy: -1, size: 2, color: '#00d2ff', life: 15
                });
            }
        } else {
            timeScale = 1.0;
        }

        // Dash Logic
        if (this.isDashing) {
            this.x += this.facing * 14;
            this.ghosts.push({ x: this.x, y: this.y, alpha: 0.5 });
        } else {
            if (keys.a) { this.vx = -this.speed; this.facing = -1; }
            else if (keys.d) { this.vx = this.speed; this.facing = 1; }
            else { this.vx = 0; }

            if ((keys.w || keys.space) && this.isGrounded) {
                this.vy = this.jumpForce;
                this.isGrounded = false;
            }

            if (keys.shift && this.canDash && this.timeEnergy >= 20) {
                this.startDash();
            }

            if (keys.j && this.attackCooldown <= 0) {
                this.startAttack();
            }

            this.vy += GRAVITY;
            this.x += this.vx;
            this.y += this.vy;

            if (this.y >= GROUND_Y - this.height) {
                this.y = GROUND_Y - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }

            this.x = Math.max(10, Math.min(canvas.width - this.width - 10, this.x));
        }

        if (this.attackCooldown > 0) this.attackCooldown--;
        this.ghosts.forEach(g => g.alpha -= 0.1);
        this.ghosts = this.ghosts.filter(g => g.alpha > 0);
    }

    startDash() {
        this.isDashing = true;
        this.canDash = false;
        this.isInvulnerable = true;
        this.timeEnergy -= 20;

        setTimeout(() => {
            this.isDashing = false;
            this.isInvulnerable = false;
        }, 200);

        setTimeout(() => { this.canDash = true; }, 450);
    }

    startAttack() {
        this.isAttacking = true;
        this.attackCooldown = 18;

        const hitBox = {
            x: this.facing === 1 ? this.x + this.width : this.x - 50,
            y: this.y,
            width: 50,
            height: this.height
        };

        if (checkAABB(hitBox, boss)) {
            boss.takeDamage(this.damage);
            screenShake = 5;
        }

        setTimeout(() => { this.isAttacking = false; }, 150);
    }

    takeDamage(dmg) {
        if (this.isInvulnerable || this.hp <= 0) return;
        this.hp = Math.max(0, this.hp - dmg);
        screenShake = 10;
        if (this.hp <= 0) gameOverScreen.classList.remove('hidden');
    }

    draw() {
        // Rastro do Dash
        this.ghosts.forEach(g => {
            ctx.fillStyle = `rgba(0, 242, 254, ${g.alpha})`;
            ctx.fillRect(g.x, g.y, this.width, this.height);
        });

        ctx.save();
        ctx.fillStyle = this.isInvulnerable ? '#00f2fe' : '#3a86ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Capacete / Visor Brilhante
        ctx.fillStyle = '#00f2fe';
        const eyeX = this.facing === 1 ? this.x + 20 : this.x + 4;
        ctx.fillRect(eyeX, this.y + 10, 8, 4);

        // Espada
        if (this.isAttacking) {
            ctx.fillStyle = '#00f2fe';
            const arcX = this.facing === 1 ? this.x + this.width : this.x - 40;
            ctx.fillRect(arcX, this.y - 10, 40, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 2. BOSS: CHRONOS
// ==========================================
class Boss {
    constructor() { this.reset(); }

    reset() {
        this.width = 80;
        this.height = 110;
        this.x = 640;
        this.y = GROUND_Y - this.height;
        this.hp = 1000;
        this.maxHp = 1000;
        this.phase = 1;
        this.attackTimer = 0;
        this.isAttacking = false;
    }

    update() {
        if (this.hp <= 0) return;

        // O Boss se move mais devagar quando a Câmera Lenta (k) está ativa!
        this.attackTimer += 1 * timeScale;

        const hpPct = (this.hp / this.maxHp) * 100;
        if (hpPct <= 25 && this.phase < 3) this.phase = 3;
        else if (hpPct <= 60 && this.phase < 2) this.phase = 2;

        bossPhaseEl.innerText = `[FASE ${this.phase}]`;

        const cooldown = this.phase === 3 ? 50 : (this.phase === 2 ? 75 : 100);

        if (this.attackTimer >= cooldown) {
            this.executeAttack();
            this.attackTimer = 0;
        }
    }

    executeAttack() {
        this.isAttacking = true;

        // Teletransporte Temporal na Fase 2 e 3
        if (this.phase >= 2) {
            this.x = player.x + (Math.random() > 0.5 ? 120 : -140);
            this.x = Math.max(50, Math.min(670, this.x));
        }

        setTimeout(() => {
            if (checkAABB({ x: this.x - 30, y: this.y, width: this.width + 60, height: this.height }, player)) {
                player.takeDamage(15 + this.phase * 5);
            }
            screenShake = 8;
            this.isAttacking = false;
        }, 300 * (1 / timeScale));
    }

    takeDamage(dmg) {
        this.hp = Math.max(0, this.hp - dmg);
        if (this.hp <= 0) victoryScreen.classList.remove('hidden');
    }

    draw() {
        ctx.save();
        let color = '#ff0055';
        if (this.phase === 2) color = '#ff5500';
        if (this.phase === 3) color = '#9900ff';

        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Core do Tempo
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 40, 12, 0, Math.PI * 2);
        ctx.fill();

        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 0, 85, 0.4)';
            ctx.fillRect(this.x - 30, this.y - 10, this.width + 60, this.height + 20);
        }

        ctx.restore();
    }
}

function checkAABB(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}

const player = new Player();
const boss = new Boss();

// Listeners
window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = true;
    else if (keys.hasOwnProperty(k)) keys[k] = true;
    if (k === 'r') {
        player.reset();
        boss.reset();
        gameOverScreen.classList.add('hidden');
        victoryScreen.classList.add('hidden');
    }
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = false;
    else if (keys.hasOwnProperty(k)) keys[k] = false;
});

window.addEventListener('mousedown', () => player.startAttack());

function updateHUD() {
    playerHpEl.style.width = `${(player.hp / player.maxHp) * 100}%`;
    playerTimeEl.style.width = `${(player.timeEnergy / player.maxTimeEnergy) * 100}%`;
    bossHpEl.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
}

function gameLoop() {
    ctx.save();

    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.85;
    }

    player.update();
    boss.update();
    updateHUD();

    // Fundo
    ctx.fillStyle = '#060612';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chão
    ctx.fillStyle = '#1f1f3a';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    boss.draw();
    player.draw();

    // Partículas
    particles.forEach(p => {
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    particles = particles.filter(p => p.life > 0);

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

gameLoop();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// HUD Elements
const playerHpEl = document.getElementById('player-hp');
const playerTimeEl = document.getElementById('player-time');
const bossHpEl = document.getElementById('boss-hp');
const bossPhaseEl = document.getElementById('boss-phase');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');

const GROUND_Y = 380;
const GRAVITY = 0.55;

let timeScale = 1.0;
let particles = [];
let projectiles = [];
let screenShake = 0;

const keys = { a: false, d: false, w: false, space: false, shift: false, j: false, k: false, r: false };

// ==========================================
// 1. HERÓI: CHRONO KNIGHT
// ==========================================
class Player {
    constructor() { this.reset(); }

    reset() {
        this.x = 100;
        this.y = GROUND_Y - 48;
        this.width = 32;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpForce = -12;
        this.isGrounded = true;

        this.hp = 100;
        this.maxHp = 100;
        this.timeEnergy = 100;
        this.maxTimeEnergy = 100;

        this.facing = 1;
        this.isDashing = false;
        this.canDash = true;
        this.isInvulnerable = false;

        this.isAttacking = false;
        this.attackCooldown = 0;
        this.damage = 25;
        this.ghosts = [];
    }

    update() {
        if (this.hp <= 0) return;

        // Regeração de Energia do Tempo
        if (!keys.k && this.timeEnergy < this.maxTimeEnergy) {
            this.timeEnergy = Math.min(this.maxTimeEnergy, this.timeEnergy + 0.3);
        }

        // Habilidade: Câmera Lenta
        if (keys.k && this.timeEnergy > 5) {
            timeScale = 0.3;
            this.timeEnergy -= 0.7;
            if (Math.random() < 0.3) {
                particles.push({
                    x: this.x + Math.random() * this.width,
                    y: this.y + Math.random() * this.height,
                    vx: 0, vy: -1, size: 2, color: '#00d2ff', life: 15
                });
            }
        } else {
            timeScale = 1.0;
        }

        // Dash Logic
        if (this.isDashing) {
            this.x += this.facing * 14;
            this.ghosts.push({ x: this.x, y: this.y, alpha: 0.5 });
        } else {
            if (keys.a) { this.vx = -this.speed; this.facing = -1; }
            else if (keys.d) { this.vx = this.speed; this.facing = 1; }
            else { this.vx = 0; }

            if ((keys.w || keys.space) && this.isGrounded) {
                this.vy = this.jumpForce;
                this.isGrounded = false;
            }

            if (keys.shift && this.canDash && this.timeEnergy >= 20) {
                this.startDash();
            }

            if (keys.j && this.attackCooldown <= 0) {
                this.startAttack();
            }

            this.vy += GRAVITY;
            this.x += this.vx;
            this.y += this.vy;

            if (this.y >= GROUND_Y - this.height) {
                this.y = GROUND_Y - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }

            this.x = Math.max(10, Math.min(canvas.width - this.width - 10, this.x));
        }

        if (this.attackCooldown > 0) this.attackCooldown--;
        this.ghosts.forEach(g => g.alpha -= 0.1);
        this.ghosts = this.ghosts.filter(g => g.alpha > 0);
    }

    startDash() {
        this.isDashing = true;
        this.canDash = false;
        this.isInvulnerable = true;
        this.timeEnergy -= 20;

        setTimeout(() => {
            this.isDashing = false;
            this.isInvulnerable = false;
        }, 200);

        setTimeout(() => { this.canDash = true; }, 400);
    }

    startAttack() {
        this.isAttacking = true;
        this.attackCooldown = 16;

        const hitBox = {
            x: this.facing === 1 ? this.x + this.width : this.x - 50,
            y: this.y,
            width: 50,
            height: this.height
        };

        if (checkAABB(hitBox, boss)) {
            boss.takeDamage(this.damage);
            screenShake = 5;
        }

        setTimeout(() => { this.isAttacking = false; }, 150);
    }

    takeDamage(dmg) {
        if (this.isInvulnerable || this.hp <= 0) return;
        this.hp = Math.max(0, this.hp - dmg);
        screenShake = 10;
        if (this.hp <= 0) gameOverScreen.classList.remove('hidden');
    }

    draw() {
        this.ghosts.forEach(g => {
            ctx.fillStyle = `rgba(0, 242, 254, ${g.alpha})`;
            ctx.fillRect(g.x, g.y, this.width, this.height);
        });

        ctx.save();
        ctx.fillStyle = this.isInvulnerable ? '#00f2fe' : '#3a86ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#00f2fe';
        const eyeX = this.facing === 1 ? this.x + 20 : this.x + 4;
        ctx.fillRect(eyeX, this.y + 10, 8, 4);

        if (this.isAttacking) {
            ctx.fillStyle = '#00f2fe';
            const arcX = this.facing === 1 ? this.x + this.width : this.x - 40;
            ctx.fillRect(arcX, this.y - 10, 40, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 2. BOSS: CHRONOS (5 FASES & PODERES PODEROSOS)
// ==========================================
class Boss {
    constructor() { this.reset(); }

    reset() {
        this.width = 80;
        this.height = 110;
        this.x = 640;
        this.y = GROUND_Y - this.height;
        this.hp = 2000;
        this.maxHp = 2000;
        this.phase = 1;
        this.attackTimer = 0;
        this.isAttacking = false;
        this.clones = [];
    }

    update() {
        if (this.hp <= 0) return;

        this.attackTimer += 1 * timeScale;

        // Atualizador de Fases
        const hpPct = (this.hp / this.maxHp) * 100;
        if (hpPct <= 15 && this.phase < 5) this.setPhase(5);
        else if (hpPct <= 35 && this.phase < 4) this.setPhase(4);
        else if (hpPct <= 55 && this.phase < 3) this.setPhase(3);
        else if (hpPct <= 80 && this.phase < 2) this.setPhase(2);

        // Intervalo de Ataque Fica Insano por Fase
        const cooldowns = [0, 90, 70, 50, 35, 12]; // Fase 5 é frenética
        const cooldown = cooldowns[this.phase];

        if (this.attackTimer >= cooldown) {
            this.executeAttack();
            this.attackTimer = 0;
        }

        // Ataques Automáticos Contínuos da Fase 5 (Impossível)
        if (this.phase === 5 && Math.random() < 0.15) {
            // Chuva constante de orbes
            projectiles.push({
                x: Math.random() * canvas.width,
                y: 0,
                vx: (Math.random() - 0.5) * 4,
                vy: 6 + Math.random() * 4,
                radius: 8,
                color: '#ff0033'
            });
        }
    }

    setPhase(p) {
        this.phase = p;
        bossPhaseEl.innerText = p === 5 ? `[FASE 5: APOCALIPSE]` : `[FASE ${p}]`;
        screenShake = 15;
    }

    executeAttack() {
        this.isAttacking = true;

        // PODER 1: Teletransporte & Golpe de Área (Todas as Fases)
        if (this.phase >= 2) {
            this.x = player.x + (Math.random() > 0.5 ? 110 : -130);
            this.x = Math.max(50, Math.min(670, this.x));
        }

        // PODER 2: Disparo de Projetéis Orbitais (Fase 2+)
        if (this.phase >= 2) {
            for (let i = -2; i <= 2; i++) {
                projectiles.push({
                    x: this.x + this.width / 2,
                    y: this.y + 30,
                    vx: i * 3,
                    vy: 3,
                    radius: 7,
                    color: '#ff5500'
                });
            }
        }

        // PODER 3: Clones de Sombra (Fase 3+)
        if (this.phase >= 3) {
            this.clones = [
                { x: 100, y: GROUND_Y - this.height },
                { x: 650, y: GROUND_Y - this.height }
            ];
        }

        // PODER 4: Campo Gravitacional Temporal (Fase 4+)
        if (this.phase >= 4) {
            // Empurra/Puxa o jogador violentamente
            player.vx += (this.x > player.x ? 12 : -12);
        }

        // PODER 5: COLAPSO DA REALIDADE (Fase 5 - Impossível)
        if (this.phase === 5) {
            // Onda de Raio Laser que ocupa metade da arena
            projectiles.push({
                x: 0,
                y: GROUND_Y - 80,
                vx: 0, vy: 0,
                width: canvas.width,
                height: 80,
                isLaser: true,
                duration: 15,
                color: 'rgba(255, 0, 85, 0.8)'
            });
        }

        setTimeout(() => {
            if (checkAABB({ x: this.x - 35, y: this.y, width: this.width + 70, height: this.height }, player)) {
                player.takeDamage(12 + this.phase * 6);
            }
            screenShake = 8 + this.phase * 2;
            this.isAttacking = false;
        }, 250 * (1 / timeScale));
    }

    takeDamage(dmg) {
        this.hp = Math.max(0, this.hp - dmg);
        if (this.hp <= 0) victoryScreen.classList.remove('hidden');
    }

    draw() {
        ctx.save();
        const colors = ['', '#ff0055', '#ff5500', '#9900ff', '#ff00aa', '#000000'];
        let color = colors[this.phase];

        // Clones de Sombra (Fase 3 e 4)
        if (this.phase >= 3) {
            this.clones.forEach(c => {
                ctx.fillStyle = 'rgba(153, 0, 255, 0.35)';
                ctx.fillRect(c.x, c.y, this.width, this.height);
            });
        }

        // Corpo Principal
        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Borda Brilhante na Fase 5
        if (this.phase === 5) {
            ctx.strokeStyle = '#ff0033';
            ctx.lineWidth = 4;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }

        // Núcleo do Tempo
        ctx.fillStyle = this.phase === 5 ? '#ff0000' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 40, 12, 0, Math.PI * 2);
        ctx.fill();

        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 0, 85, 0.5)';
            ctx.fillRect(this.x - 30, this.y - 10, this.width + 60, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 3. GERENCIADOR DE PROJÉTEIS & COLISÃO
// ==========================================
function updateProjectiles() {
    projectiles.forEach((p, index) => {
        if (p.isLaser) {
            p.duration--;
            if (checkAABB(p, player)) player.takeDamage(8);
        } else {
            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;

            // Colisão com Jogador
            const dist = Math.hypot(p.x - (player.x + player.width / 2), p.y - (player.y + player.height / 2));
            if (dist < p.radius + player.width / 2) {
                player.takeDamage(18);
                projectiles.splice(index, 1);
            }
        }
    });

    // Remove projéteis fora de tela ou expirados
    projectiles = projectiles.filter(p => (p.isLaser ? p.duration > 0 : (p.y < canvas.height && p.x > 0 && p.x < canvas.width)));
}

function drawProjectiles() {
    projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        if (p.isLaser) {
            ctx.fillRect(p.x, p.y, p.width, p.height);
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function checkAABB(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}

const player = new Player();
const boss = new Boss();

// Listeners
window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = true;
    else if (keys.hasOwnProperty(k)) keys[k] = true;
    if (k === 'r') {
        player.reset();
        boss.reset();
        projectiles = [];
        gameOverScreen.classList.add('hidden');
        victoryScreen.classList.add('hidden');
    }
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = false;
    else if (keys.hasOwnProperty(k)) keys[k] = false;
});

window.addEventListener('mousedown', () => player.startAttack());

function updateHUD() {
    playerHpEl.style.width = `${(player.hp / player.maxHp) * 100}%`;
    playerTimeEl.style.width = `${(player.timeEnergy / player.maxTimeEnergy) * 100}%`;
    bossHpEl.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
}

function gameLoop() {
    ctx.save();

    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.85;
    }

    player.update();
    boss.update();
    updateProjectiles();
    updateHUD();

    // Fundo da Tela
    ctx.fillStyle = boss.phase === 5 ? '#1a0005' : '#060612';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chão
    ctx.fillStyle = '#1f1f3a';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    boss.draw();
    player.draw();
    drawProjectiles();

    // Partículas
    particles.forEach(p => {
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    particles = particles.filter(p => p.life > 0);

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

gameLoop();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// HUD Elements
const playerHpEl = document.getElementById('player-hp');
const playerTimeEl = document.getElementById('player-time');
const bossHpEl = document.getElementById('boss-hp');
const bossPhaseEl = document.getElementById('boss-phase');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');

const GROUND_Y = 380;
const GRAVITY = 0.55;

let timeScale = 1.0;
let particles = [];
let projectiles = [];
let screenShake = 0;

const keys = { a: false, d: false, w: false, space: false, shift: false, j: false, k: false, r: false };

// ==========================================
// 1. HERÓI: CHRONO KNIGHT
// ==========================================
class Player {
    constructor() { this.reset(); }

    reset() {
        this.x = 100;
        this.y = GROUND_Y - 48;
        this.width = 32;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpForce = -12;
        this.isGrounded = true;

        this.hp = 100;
        this.maxHp = 100;
        this.timeEnergy = 100;
        this.maxTimeEnergy = 100;

        this.facing = 1;
        this.isDashing = false;
        this.canDash = true;
        this.isInvulnerable = false;

        this.isAttacking = false;
        this.attackCooldown = 0;
        this.damage = 35; // Dano levemente aumentado para compensar a vida gigante do boss
        this.ghosts = [];
    }

    update() {
        if (this.hp <= 0) return;

        // Regeração de Energia do Tempo
        if (!keys.k && this.timeEnergy < this.maxTimeEnergy) {
            this.timeEnergy = Math.min(this.maxTimeEnergy, this.timeEnergy + 0.3);
        }

        // Habilidade: Câmera Lenta
        if (keys.k && this.timeEnergy > 5) {
            timeScale = 0.3;
            this.timeEnergy -= 0.7;
            if (Math.random() < 0.3) {
                particles.push({
                    x: this.x + Math.random() * this.width,
                    y: this.y + Math.random() * this.height,
                    vx: 0, vy: -1, size: 2, color: '#00d2ff', life: 15
                });
            }
        } else {
            timeScale = 1.0;
        }

        // Dash Logic
        if (this.isDashing) {
            this.x += this.facing * 14;
            this.ghosts.push({ x: this.x, y: this.y, alpha: 0.5 });
        } else {
            if (keys.a) { this.vx = -this.speed; this.facing = -1; }
            else if (keys.d) { this.vx = this.speed; this.facing = 1; }
            else { this.vx = 0; }

            if ((keys.w || keys.space) && this.isGrounded) {
                this.vy = this.jumpForce;
                this.isGrounded = false;
            }

            if (keys.shift && this.canDash && this.timeEnergy >= 20) {
                this.startDash();
            }

            if (keys.j && this.attackCooldown <= 0) {
                this.startAttack();
            }

            this.vy += GRAVITY;
            this.x += this.vx;
            this.y += this.vy;

            if (this.y >= GROUND_Y - this.height) {
                this.y = GROUND_Y - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }

            this.x = Math.max(10, Math.min(canvas.width - this.width - 10, this.x));
        }

        if (this.attackCooldown > 0) this.attackCooldown--;
        this.ghosts.forEach(g => g.alpha -= 0.1);
        this.ghosts = this.ghosts.filter(g => g.alpha > 0);
    }

    startDash() {
        this.isDashing = true;
        this.canDash = false;
        this.isInvulnerable = true;
        this.timeEnergy -= 20;

        setTimeout(() => {
            this.isDashing = false;
            this.isInvulnerable = false;
        }, 200);

        setTimeout(() => { this.canDash = true; }, 400);
    }

    startAttack() {
        this.isAttacking = true;
        this.attackCooldown = 16;

        const hitBox = {
            x: this.facing === 1 ? this.x + this.width : this.x - 50,
            y: this.y,
            width: 50,
            height: this.height
        };

        if (checkAABB(hitBox, boss)) {
            boss.takeDamage(this.damage);
            screenShake = 5;
        }

        setTimeout(() => { this.isAttacking = false; }, 150);
    }

    takeDamage(dmg) {
        if (this.isInvulnerable || this.hp <= 0) return;
        this.hp = Math.max(0, this.hp - dmg);
        screenShake = 10;
        if (this.hp <= 0) gameOverScreen.classList.remove('hidden');
    }

    draw() {
        this.ghosts.forEach(g => {
            ctx.fillStyle = `rgba(0, 242, 254, ${g.alpha})`;
            ctx.fillRect(g.x, g.y, this.width, this.height);
        });

        ctx.save();
        ctx.fillStyle = this.isInvulnerable ? '#00f2fe' : '#3a86ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#00f2fe';
        const eyeX = this.facing === 1 ? this.x + 20 : this.x + 4;
        ctx.fillRect(eyeX, this.y + 10, 8, 4);

        if (this.isAttacking) {
            ctx.fillStyle = '#00f2fe';
            const arcX = this.facing === 1 ? this.x + this.width : this.x - 40;
            ctx.fillRect(arcX, this.y - 10, 40, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 2. BOSS: CHRONOS (10.000 HP & 5 FASES)
// ==========================================
class Boss {
    constructor() { this.reset(); }

    reset() {
        this.width = 80;
        this.height = 110;
        this.x = 640;
        this.y = GROUND_Y - this.height;
        this.hp = 10000; // Vida aumentada para 10.000!
        this.maxHp = 10000;
        this.phase = 1;
        this.attackTimer = 0;
        this.isAttacking = false;
        this.clones = [];
    }

    update() {
        if (this.hp <= 0) return;

        this.attackTimer += 1 * timeScale;

        // Distribuição de Fases baseada na nova Vida de 10.000 HP
        const hpPct = (this.hp / this.maxHp) * 100;
        if (hpPct <= 20 && this.phase < 5) this.setPhase(5);      // 2.000 HP restantes
        else if (hpPct <= 40 && this.phase < 4) this.setPhase(4); // 4.000 HP restantes
        else if (hpPct <= 60 && this.phase < 3) this.setPhase(3); // 6.000 HP restantes
        else if (hpPct <= 80 && this.phase < 2) this.setPhase(2); // 8.000 HP restantes

        const cooldowns = [0, 90, 70, 50, 35, 12];
        const cooldown = cooldowns[this.phase];

        if (this.attackTimer >= cooldown) {
            this.executeAttack();
            this.attackTimer = 0;
        }

        // Ataques Automáticos Contínuos da Fase 5 (Impossível)
        if (this.phase === 5 && Math.random() < 0.15) {
            projectiles.push({
                x: Math.random() * canvas.width,
                y: 0,
                vx: (Math.random() - 0.5) * 4,
                vy: 6 + Math.random() * 4,
                radius: 8,
                color: '#ff0033'
            });
        }
    }

    setPhase(p) {
        this.phase = p;
        bossPhaseEl.innerText = p === 5 ? `[FASE 5: APOCALIPSE]` : `[FASE ${p}]`;
        screenShake = 15;
    }

    executeAttack() {
        this.isAttacking = true;

        if (this.phase >= 2) {
            this.x = player.x + (Math.random() > 0.5 ? 110 : -130);
            this.x = Math.max(50, Math.min(670, this.x));
        }

        if (this.phase >= 2) {
            for (let i = -2; i <= 2; i++) {
                projectiles.push({
                    x: this.x + this.width / 2,
                    y: this.y + 30,
                    vx: i * 3,
                    vy: 3,
                    radius: 7,
                    color: '#ff5500'
                });
            }
        }

        if (this.phase >= 3) {
            this.clones = [
                { x: 100, y: GROUND_Y - this.height },
                { x: 650, y: GROUND_Y - this.height }
            ];
        }

        if (this.phase >= 4) {
            player.vx += (this.x > player.x ? 12 : -12);
        }

        if (this.phase === 5) {
            projectiles.push({
                x: 0,
                y: GROUND_Y - 80,
                vx: 0, vy: 0,
                width: canvas.width,
                height: 80,
                isLaser: true,
                duration: 15,
                color: 'rgba(255, 0, 85, 0.8)'
            });
        }

        setTimeout(() => {
            if (checkAABB({ x: this.x - 35, y: this.y, width: this.width + 70, height: this.height }, player)) {
                player.takeDamage(12 + this.phase * 6);
            }
            screenShake = 8 + this.phase * 2;
            this.isAttacking = false;
        }, 250 * (1 / timeScale));
    }

    takeDamage(dmg) {
        this.hp = Math.max(0, this.hp - dmg);
        if (this.hp <= 0) victoryScreen.classList.remove('hidden');
    }

    draw() {
        ctx.save();
        const colors = ['', '#ff0055', '#ff5500', '#9900ff', '#ff00aa', '#000000'];
        let color = colors[this.phase];

        if (this.phase >= 3) {
            this.clones.forEach(c => {
                ctx.fillStyle = 'rgba(153, 0, 255, 0.35)';
                ctx.fillRect(c.x, c.y, this.width, this.height);
            });
        }

        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        if (this.phase === 5) {
            ctx.strokeStyle = '#ff0033';
            ctx.lineWidth = 4;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }

        ctx.fillStyle = this.phase === 5 ? '#ff0000' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 40, 12, 0, Math.PI * 2);
        ctx.fill();

        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 0, 85, 0.5)';
            ctx.fillRect(this.x - 30, this.y - 10, this.width + 60, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 3. GERENCIADOR DE PROJÉTEIS & COLISÃO
// ==========================================
function updateProjectiles() {
    projectiles.forEach((p, index) => {
        if (p.isLaser) {
            p.duration--;
            if (checkAABB(p, player)) player.takeDamage(8);
        } else {
            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;

            const dist = Math.hypot(p.x - (player.x + player.width / 2), p.y - (player.y + player.height / 2));
            if (dist < p.radius + player.width / 2) {
                player.takeDamage(18);
                projectiles.splice(index, 1);
            }
        }
    });

    projectiles = projectiles.filter(p => (p.isLaser ? p.duration > 0 : (p.y < canvas.height && p.x > 0 && p.x < canvas.width)));
}

function drawProjectiles() {
    projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        if (p.isLaser) {
            ctx.fillRect(p.x, p.y, p.width, p.height);
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function checkAABB(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}

const player = new Player();
const boss = new Boss();

// Listeners
window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = true;
    else if (keys.hasOwnProperty(k)) keys[k] = true;
    if (k === 'r') {
        player.reset();
        boss.reset();
        projectiles = [];
        gameOverScreen.classList.add('hidden');
        victoryScreen.classList.add('hidden');
    }
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = false;
    else if (keys.hasOwnProperty(k)) keys[k] = false;
});

window.addEventListener('mousedown', () => player.startAttack());

function updateHUD() {
    playerHpEl.style.width = `${(player.hp / player.maxHp) * 100}%`;
    playerTimeEl.style.width = `${(player.timeEnergy / player.maxTimeEnergy) * 100}%`;
    bossHpEl.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
}

function gameLoop() {
    ctx.save();

    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.85;
    }

    player.update();
    boss.update();
    updateProjectiles();
    updateHUD();

    ctx.fillStyle = boss.phase === 5 ? '#1a0005' : '#060612';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1f1f3a';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    boss.draw();
    player.draw();
    drawProjectiles();

    particles.forEach(p => {
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    particles = particles.filter(p => p.life > 0);

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

gameLoop();
