// ==========================================
// ESTADOS E VARIÁVEIS DO JOGO
// ==========================================
const playerState = {
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    posX: 100,
    posY: 0,
    isDashing: false,
    canDash: true,
    isInvulnerable: false,
    attackRange: 80,
    damage: 15
};

const bossState = {
    hp: 1000,
    maxHp: 1000,
    phase: 1,
    isEnraged: false,
    enrageTime: 60
};

// Referências da DOM
const playerEl = document.getElementById('player');
const bossEl = document.getElementById('boss');
const playerHpBar = document.getElementById('player-hp-bar');
const playerStaminaBar = document.getElementById('player-stamina-bar');
const bossHpBar = document.getElementById('boss-hp-bar');
const bossPhaseText = document.getElementById('boss-phase-text');
const enrageTimerEl = document.getElementById('enrage-timer');

// ==========================================
// LOOP PRINCIPAL & ATUALIZAÇÕES
// ==========================================
function gameLoop() {
    // Regeração de Stamina
    if (playerState.stamina < playerState.maxStamina) {
        playerState.stamina = Math.min(playerState.maxStamina, playerState.stamina + 0.2);
        updateHUD();
    }

    requestAnimationFrame(gameLoop);
}

function updateHUD() {
    playerHpBar.style.width = `${(playerState.hp / playerState.maxHp) * 100}%`;
    playerStaminaBar.style.width = `${(playerState.stamina / playerState.maxStamina) * 100}%`;
    bossHpBar.style.width = `${(bossState.hp / bossState.maxHp) * 100}%`;
}

// ==========================================
// MECÂNICAS DO JOGADOR
// ==========================================
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // Movimentação Simples
    if (key === 'a' || key === 'arrowleft') {
        playerState.posX = Math.max(0, playerState.posX - 15);
        playerEl.style.left = `${playerState.posX}px`;
    }
    if (key === 'd' || key === 'arrowright') {
        playerState.posX = Math.min(760, playerState.posX + 15);
        playerEl.style.left = `${playerState.posX}px`;
    }

    // Dash (Shift)
    if (e.key === 'Shift' && playerState.canDash && playerState.stamina >= 20) {
        executeDash();
    }

    // Ataque (J)
    if (key === 'j') {
        executeAttack();
    }
});

function executeDash() {
    playerState.canDash = false;
    playerState.isDashing = true;
    playerState.isInvulnerable = true;
    playerState.stamina -= 20;

    playerEl.classList.add('dash-active');
    playerState.posX += 80; // Avanço do dash
    playerEl.style.left = `${playerState.posX}px`;

    updateHUD();

    setTimeout(() => {
        playerState.isDashing = false;
        playerState.isInvulnerable = false;
        playerEl.classList.remove('dash-active');
    }, 200);

    setTimeout(() => {
        playerState.canDash = true;
    }, 500);
}

function executeAttack() {
    const bossPosX = 800 - 100 - 80; // Posição calculada do boss
    const distance = Math.abs(playerState.posX - bossPosX);

    if (distance <= playerState.attackRange) {
        damageBoss(playerState.damage);
    }
}

// ==========================================
// LÓGICA E FASES DO CHEFE
// ==========================================
function damageBoss(amount) {
    bossState.hp = Math.max(0, bossState.hp - amount);
    updateHUD();
    checkBossPhases();
}

function checkBossPhases() {
    const hpPercent = (bossState.hp / bossState.maxHp) * 100;

    if (hpPercent <= 10 && bossState.phase < 4) {
        setBossPhase(4);
    } else if (hpPercent <= 40 && bossState.phase < 3) {
        setBossPhase(3);
    } else if (hpPercent <= 75 && bossState.phase < 2) {
        setBossPhase(2);
    }
}

function setBossPhase(phase) {
    bossState.phase = phase;
    bossPhaseText.innerText = `(FASE ${phase})`;

    if (phase === 2) bossEl.className = 'entity boss-p2';
    if (phase === 3) bossEl.className = 'entity boss-p3';
    if (phase === 4) {
        bossEl.className = 'entity boss-p4';
        startEnrageTimer();
    }
}

function startEnrageTimer() {
    bossState.isEnraged = true;
    enrageTimerEl.classList.remove('hidden');

    const timerInterval = setInterval(() => {
        bossState.enrageTime--;
        enrageTimerEl.innerText = bossState.enrageTime;

        if (bossState.enrageTime <= 0) {
            clearInterval(timerInterval);
            if (bossState.hp > 0) {
                alert("💀 O ANIQUILADOR COLAPSOU A REALIDADE! FIM DE JOGO!");
                location.reload();
            }
        }
    }, 1000);
}

// Inicializa o jogo
gameLoop();
/**
 * SOMBRA DO VAZIO - Game Engine 2D Pixel Art
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Elements HUD
const playerHpFill = document.getElementById('player-hp-fill');
const playerStaminaFill = document.getElementById('player-stamina-fill');
const bossHpFill = document.getElementById('boss-hp-fill');
const bossPhaseTag = document.getElementById('boss-phase-tag');
const enrageOverlay = document.getElementById('enrage-overlay');
const timerSecEl = document.getElementById('timer-sec');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');

// Game Constants
const GROUND_Y = 380;
const GRAVITY = 0.6;

// Teclas Pressionadas
const keys = {
    a: false, d: false, w: false, space: false,
    shift: false, j: false, r: false,
    arrowleft: false, arrowright: false, arrowup: false
};

// Partículas e Efeitos de Texto
let particles = [];
let floatingTexts = [];
let screenShake = 0;

// ==========================================
// 1. CLASSE DO JOGADOR (Yatagarasu / Corvo)
// ==========================================
class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 120;
        this.y = GROUND_Y - 48;
        this.width = 36;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpForce = -12;
        this.isGrounded = true;

        this.hp = 100;
        this.maxHp = 100;
        this.stamina = 100;
        this.maxStamina = 100;

        this.facing = 1; // 1 = Direita, -1 = Esquerda
        this.state = 'IDLE'; // IDLE, RUN, JUMP, DASH, ATTACK, HIT, DEAD
        this.animTimer = 0;

        // Dash & i-frames
        this.isDashing = false;
        this.canDash = true;
        this.isInvulnerable = false;
        this.dashCooldown = 0;

        // Attack
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.attackDamage = 22;
        this.attackBox = { x: 0, y: 0, width: 50, height: 40 };

        // Visual Trail
        this.ghosts = [];
    }

    update() {
        if (this.hp <= 0) {
            this.state = 'DEAD';
            return;
        }

        // Timers
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.attackCooldown > 0) this.attackCooldown--;

        // Stamina Regen
        if (this.stamina < this.maxStamina && !this.isDashing) {
            this.stamina = Math.min(this.maxStamina, this.stamina + 0.35);
        }

        // Handle States
        if (this.isDashing) {
            this.x += this.facing * 12;
            // Ghost trail effect
            if (this.animTimer % 2 === 0) {
                this.ghosts.push({ x: this.x, y: this.y, alpha: 0.6 });
            }
        } else {
            // Movement Controls
            const moveLeft = keys.a || keys.arrowleft;
            const moveRight = keys.d || keys.arrowright;

            if (moveLeft) {
                this.vx = -this.speed;
                this.facing = -1;
                if (this.isGrounded && !this.isAttacking) this.state = 'RUN';
            } else if (moveRight) {
                this.vx = this.speed;
                this.facing = 1;
                if (this.isGrounded && !this.isAttacking) this.state = 'RUN';
            } else {
                this.vx = 0;
                if (this.isGrounded && !this.isAttacking) this.state = 'IDLE';
            }

            // Jump
            if ((keys.w || keys.space || keys.arrowup) && this.isGrounded) {
                this.vy = this.jumpForce;
                this.isGrounded = false;
                this.state = 'JUMP';
                createDustParticles(this.x + 18, this.y + 48, 6);
            }

            // Dash Trigger
            if (keys.shift && this.canDash && this.stamina >= 25) {
                this.startDash();
            }

            // Attack Trigger
            if (keys.j && this.attackCooldown === 0) {
                this.startAttack();
            }

            // Gravity & Physics
            this.vy += GRAVITY;
            this.x += this.vx;
            this.y += this.vy;

            // Ground Collision
            if (this.y >= GROUND_Y - this.height) {
                this.y = GROUND_Y - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }

            // Screen Bounds
            this.x = Math.max(10, Math.min(canvas.width - this.width - 10, this.x));
        }

        // Update Ghost Trails
        this.ghosts.forEach(g => g.alpha -= 0.08);
        this.ghosts = this.ghosts.filter(g => g.alpha > 0);

        this.animTimer++;
    }

    startDash() {
        this.isDashing = true;
        this.canDash = false;
        this.isInvulnerable = true;
        this.stamina -= 25;
        this.state = 'DASH';

        setTimeout(() => {
            this.isDashing = false;
            this.isInvulnerable = false;
        }, 220);

        setTimeout(() => {
            this.canDash = true;
        }, 500);
    }

    startAttack() {
        this.isAttacking = true;
        this.attackCooldown = 22;
        this.state = 'ATTACK';

        // Set Hitbox
        this.attackBox.x = this.facing === 1 ? this.x + this.width : this.x - this.attackBox.width;
        this.attackBox.y = this.y + 5;

        // Check Hit on Boss
        if (checkAABB(this.attackBox, boss)) {
            boss.takeDamage(this.attackDamage);
            createSparkParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, 12);
            screenShake = 6;
        }

        setTimeout(() => {
            this.isAttacking = false;
        }, 180);
    }

    takeDamage(dmg) {
        if (this.isInvulnerable || this.hp <= 0) return;

        this.hp = Math.max(0, this.hp - dmg);
        this.state = 'HIT';
        screenShake = 12;
        addFloatingText(`-${Math.round(dmg)}`, this.x + 10, this.y - 10, '#ff4757');
        createSparkParticles(this.x + 18, this.y + 24, 10, '#ff4757');

        if (this.hp <= 0) {
            gameOverScreen.classList.remove('hidden');
        }
    }

    draw() {
        // Render Ghosts (Dash effect)
        this.ghosts.forEach(g => {
            ctx.fillStyle = `rgba(0, 210, 255, ${g.alpha})`;
            ctx.fillRect(g.x, g.y, this.width, this.height);
        });

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        if (this.facing === -1) ctx.scale(-1, 1);

        // Body Base (Guerreiro Corvo Yatagarasu)
        const bob = Math.sin(this.animTimer * 0.15) * 2;

        // Asas / Capa de Penas
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.moveTo(-18, -10 + bob);
        ctx.lineTo(-28, 15);
        ctx.lineTo(-8, 20);
        ctx.fill();

        // Armadura / Corpo
        ctx.fillStyle = this.isInvulnerable ? '#00d2ff' : '#2b2b40';
        ctx.fillRect(-12, -18 + (this.state === 'RUN' ? bob : 0), 24, 36);

        // Máscara de Corvo (Bico)
        ctx.fillStyle = '#eccc68';
        ctx.beginPath();
        ctx.moveTo(4, -14);
        ctx.lineTo(18, -8);
        ctx.lineTo(4, -4);
        ctx.fill();

        // Olho Brilhante
        ctx.fillStyle = '#00f2fe';
        ctx.fillRect(2, -14, 4, 3);

        // Espada / Lâmina
        if (this.isAttacking) {
            ctx.fillStyle = '#00f2fe';
            ctx.beginPath();
            ctx.arc(10, 0, 32, -Math.PI / 3, Math.PI / 3);
            ctx.lineTo(10, 0);
            ctx.fill();
        } else {
            // Katana nas costas
            ctx.strokeStyle = '#c8d6e5';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-10, 10);
            ctx.lineTo(15, -25);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// ==========================================
// 2. CLASSE DO BOSS (O Aniquilador)
// ==========================================
class Boss {
    constructor() {
        this.reset();
    }

    reset() {
        this.width = 90;
        this.height = 120;
        this.x = 620;
        this.y = GROUND_Y - this.height;

        this.hp = 1000;
        this.maxHp = 1000;
        this.phase = 1;

        this.attackTimer = 0;
        this.attackInterval = 110;
        this.isAttacking = false;

        // Phase 4 Enrage
        this.isEnraged = false;
        this.enrageTimer = 60;
        this.enrageInterval = null;
    }

    update() {
        if (this.hp <= 0) return;

        this.attackTimer++;

        // Phase Logic Transitions
        const hpPct = (this.hp / this.maxHp) * 100;
        if (hpPct <= 10 && this.phase < 4) this.setPhase(4);
        else if (hpPct <= 40 && this.phase < 3) this.setPhase(3);
        else if (hpPct <= 75 && this.phase < 2) this.setPhase(2);

        // Attack AI Routine
        if (this.attackTimer >= this.attackInterval) {
            this.executeAttack();
            this.attackTimer = 0;
        }
    }

    setPhase(p) {
        this.phase = p;
        bossPhaseTag.innerText = `[FASE ${p}]`;

        if (p === 2) {
            this.attackInterval = 85;
            createSparkParticles(this.x + 45, this.y + 60, 30, '#ff4757');
        } else if (p === 3) {
            this.attackInterval = 65;
            createSparkParticles(this.x + 45, this.y + 60, 40, '#a55eea');
        } else if (p === 4) {
            this.attackInterval = 45;
            this.isEnraged = true;
            enrageOverlay.classList.remove('hidden');
            this.startEnrageCountdown();
        }
    }

    startEnrageCountdown() {
        if (this.enrageInterval) clearInterval(this.enrageInterval);
        this.enrageInterval = setInterval(() => {
            this.enrageTimer--;
            timerSecEl.innerText = this.enrageTimer;

            if (this.enrageTimer <= 0) {
                clearInterval(this.enrageInterval);
                if (player.hp > 0) {
                    player.takeDamage(999); // Instant Kill Collapse
                }
            }
        }, 1000);
    }

    executeAttack() {
        if (player.hp <= 0) return;

        this.isAttacking = true;

        // Boss investida / teletransporte perto do jogador na Fase 3 e 4
        if (this.phase >= 3) {
            this.x = player.x + (Math.random() > 0.5 ? 90 : -130);
            this.x = Math.max(50, Math.min(650, this.x));
        }

        // Dano de área
        setTimeout(() => {
            const attackBox = {
                x: this.x - 40,
                y: GROUND_Y - 60,
                width: this.width + 80,
                height: 60
            };

            if (checkAABB(attackBox, player)) {
                const dmg = 18 + (this.phase * 5);
                player.takeDamage(dmg);
            }

            createSparkParticles(this.x + 45, GROUND_Y - 10, 20, '#ff4757');
            screenShake = 10;
            this.isAttacking = false;
        }, 300);
    }

    takeDamage(dmg) {
        if (this.hp <= 0) return;

        this.hp = Math.max(0, this.hp - dmg);
        addFloatingText(`-${Math.round(dmg)}`, this.x + 30, this.y - 15, '#eccc68');

        if (this.hp <= 0) {
            if (this.enrageInterval) clearInterval(this.enrageInterval);
            victoryScreen.classList.remove('hidden');
        }
    }

    draw() {
        ctx.save();

        // Visual do Chefe por Fase
        let bossColor = '#4b6584';
        if (this.phase === 2) bossColor = '#d9534f';
        if (this.phase === 3) bossColor = '#8e44ad';
        if (this.phase === 4) bossColor = '#c0392b';

        // Sombra de chão
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, GROUND_Y, 50, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corpo Colossal
        ctx.fillStyle = bossColor;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Detalhes da Armadura
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(this.x + 15, this.y + 20, this.width - 30, this.height - 40);

        // Olho Vermelho Central
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 35, 8 + (this.phase * 2), 0, Math.PI * 2);
        ctx.fill();

        // Animação de Ataque / Espada
        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 71, 87, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, GROUND_Y - 20, 120, 0, Math.PI, true);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ==========================================
// 3. SISTEMA DE PARTÍCULAS E TEXTOS FLOANTES
// ==========================================
function createSparkParticles(x, y, count, color = '#00f2fe') {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 4 + 2,
            color,
            life: 25
        });
    }
}

function createDustParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2,
            size: Math.random() * 5 + 3,
            color: '#57606f',
            life: 20
        });
    }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, color, life: 35 });
}

function updateParticles() {
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);

    floatingTexts.forEach(t => {
        t.y -= 0.8;
        t.life--;
    });
    floatingTexts = floatingTexts.filter(t => t.life > 0);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    floatingTexts.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.font = 'bold 16px "Courier New"';
        ctx.fillText(t.text, t.x, t.y);
    });
}

// ==========================================
// 4. COLISÕES & UTILS
// ==========================================
function checkAABB(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// Instâncias
const player = new Player();
const boss = new Boss();

// ==========================================
// 5. INPUT LISTENERS
// ==========================================
window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = true;
    else if (keys.hasOwnProperty(k)) keys[k] = true;

    if (k === 'r') restartGame();
});

window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') keys.space = false;
    else if (keys.hasOwnProperty(k)) keys[k] = false;
});

window.addEventListener('mousedown', e => {
    if (e.button === 0) player.startAttack();
});

function restartGame() {
    player.reset();
    boss.reset();
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    enrageOverlay.classList.add('hidden');
}

// ==========================================
// 6. GAME LOOP PRINCIPAL
// ==========================================
function updateHUD() {
    playerHpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    playerStaminaFill.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
    bossHpFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
}

function renderScenario() {
    // Fundo Gradiente Neobrutalista
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0a14');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lua de Sangue no fundo
    ctx.fillStyle = boss.phase >= 4 ? '#ff4757' : '#2f3542';
    ctx.beginPath();
    ctx.arc(400, 120, 70, 0, Math.PI * 2);
    ctx.fill();

    // Chão Pixel Art
    ctx.fillStyle = '#2f3542';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = '#747d8c';
    ctx.fillRect(0, GROUND_Y, canvas.width, 4);
}

function gameLoop() {
    ctx.save();

    // Screen Shake effect
    if (screenShake > 0) {
        const rx = (Math.random() - 0.5) * screenShake;
        const ry = (Math.random() - 0.5) * screenShake;
        ctx.translate(rx, ry);
        screenShake *= 0.85;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Update
    player.update();
    boss.update();
    updateParticles();
    updateHUD();

    // Draw
    renderScenario();
    boss.draw();
    player.draw();
    drawParticles();

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

// Iniciar Jogo
gameLoop();
