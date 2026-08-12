const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// HUD
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
// 1. JOGADOR: GHOST BLADE
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
        this.speed = 5.5;
        this.jumpForce = -12.5;
        this.isGrounded = true;

        this.hp = 100;
        this.maxHp = 100;
        this.energy = 100;
        this.maxEnergy = 100;

        this.facing = 1;
        this.isDashing = false;
        this.canDash = true;
        this.isInvulnerable = false;
        this.isStunned = false;
        this.stunTimer = 0;

        this.isAttacking = false;
        this.attackCooldown = 0;
        this.damage = 45;
        this.ghosts = [];
    }

    update() {
        if (this.hp <= 0) return;

        // Efeito de Stun
        if (this.isStunned) {
            this.stunTimer--;
            if (this.stunTimer <= 0) this.isStunned = false;
            return;
        }

        // Regeração de Energia
        if (!keys.k && this.energy < this.maxEnergy) {
            this.energy = Math.min(this.maxEnergy, this.energy + 0.4);
        }

        // Habilidade Slow Motion
        if (keys.k && this.energy > 5) {
            timeScale = 0.25;
            this.energy -= 0.8;
            if (Math.random() < 0.3) {
                particles.push({
                    x: this.x + Math.random() * this.width,
                    y: this.y + Math.random() * this.height,
                    vx: 0, vy: -1, size: 2, color: '#00bfff', life: 15
                });
            }
        } else {
            timeScale = 1.0;
        }

        // Movimentação & Dash
        if (this.isDashing) {
            this.x += this.facing * 15;
            this.ghosts.push({ x: this.x, y: this.y, alpha: 0.5 });
        } else {
            if (keys.a) { this.vx = -this.speed; this.facing = -1; }
            else if (keys.d) { this.vx = this.speed; this.facing = 1; }
            else { this.vx = 0; }

            if ((keys.w || keys.space) && this.isGrounded) {
                this.vy = this.jumpForce;
                this.isGrounded = false;
            }

            if (keys.shift && this.canDash && this.energy >= 20) {
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
        this.energy -= 20;

        setTimeout(() => {
            this.isDashing = false;
            this.isInvulnerable = false;
        }, 200);

        setTimeout(() => { this.canDash = true; }, 380);
    }

    startAttack() {
        this.isAttacking = true;
        this.attackCooldown = 14;

        const hitBox = {
            x: this.facing === 1 ? this.x + this.width : this.x - 55,
            y: this.y - 10,
            width: 55,
            height: this.height + 20
        };

        if (checkAABB(hitBox, boss)) {
            boss.takeDamage(this.damage);
            screenShake = 6;
        }

        setTimeout(() => { this.isAttacking = false; }, 140);
    }

    applyStun(duration) {
        if (this.isInvulnerable) return;
        this.isStunned = true;
        this.stunTimer = duration;
        particles.push({ x: this.x + 16, y: this.y - 10, vx: 0, vy: -1, size: 8, color: '#00ffff', life: 40 });
    }

    takeDamage(dmg) {
        if (this.isInvulnerable || this.hp <= 0) return;
        this.hp = Math.max(0, this.hp - dmg);
        screenShake = 12;
        if (this.hp <= 0) gameOverScreen.classList.remove('hidden');
    }

    draw() {
        this.ghosts.forEach(g => {
            ctx.fillStyle = `rgba(0, 191, 255, ${g.alpha})`;
            ctx.fillRect(g.x, g.y, this.width, this.height);
        });

        ctx.save();
        ctx.fillStyle = this.isStunned ? '#00ffff' : (this.isInvulnerable ? '#00ffff' : '#8a2be2');
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Olho
        ctx.fillStyle = '#00ffff';
        const eyeX = this.facing === 1 ? this.x + 22 : this.x + 4;
        ctx.fillRect(eyeX, this.y + 10, 6, 4);

        // Espada
        if (this.isAttacking) {
            ctx.fillStyle = '#00ffff';
            const arcX = this.facing === 1 ? this.x + this.width : this.x - 45;
            ctx.fillRect(arcX, this.y - 10, 45, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 2. BOSS: VOID SENTINEL (7 FASES & PODERES)
// ==========================================
class Boss {
    constructor() { this.reset(); }

    reset() {
        this.width = 90;
        this.height = 120;
        this.x = 630;
        this.y = GROUND_Y - this.height;
        this.hp = 15000;
        this.maxHp = 15000;
        this.phase = 1;
        this.attackTimer = 0;
        this.isAttacking = false;
        
        // Mecânicas
        this.isShielded = false;
        this.clones = [];
        this.ultimateCharge = 0;
        this.isChargingUltimate = false;
    }

    update() {
        if (this.hp <= 0) return;

        this.attackTimer += 1 * timeScale;

        // Sistema de Troca das 7 Fases
        const hpPct = (this.hp / this.maxHp) * 100;
        if (hpPct <= 10 && this.phase < 7) this.setPhase(7);      // Fase 7: Apocalipse (1.500 HP)
        else if (hpPct <= 25 && this.phase < 6) this.setPhase(6); // Fase 6: Gravidade Zero (3.750 HP)
        else if (hpPct <= 40 && this.phase < 5) this.setPhase(5); // Fase 5: Escudo Absoluto (6.000 HP)
        else if (hpPct <= 55 && this.phase < 4) this.setPhase(4); // Fase 4: Raio Paralisante (8.250 HP)
        else if (hpPct <= 70 && this.phase < 3) this.setPhase(3); // Fase 3: Ilusões do Vazio (10.500 HP)
        else if (hpPct <= 85 && this.phase < 2) this.setPhase(2); // Fase 2: Atração Gravitacional (12.750 HP)

        // Carga da Ultimate na Fase 7
        if (this.isChargingUltimate) {
            this.ultimateCharge += 1 * timeScale;
            if (this.ultimateCharge >= 100) {
                this.triggerSuperNova();
                this.isChargingUltimate = false;
                this.ultimateCharge = 0;
            }
            return;
        }

        // Cooldowns por fase (frenético na fase 7)
        const cooldowns = [0, 80, 65, 50, 40, 30, 22, 10];
        const cooldown = cooldowns[this.phase];

        if (this.attackTimer >= cooldown) {
            this.executeAttack();
            this.attackTimer = 0;
        }

        // Atração Gravitacional constante na Fase 2 e Fase 6
        if ((this.phase === 2 || this.phase === 6) && Math.random() < 0.3) {
            player.vx += (this.x > player.x ? 1.8 : -1.8);
        }

        // Mísseis Teleguiados constantes na Fase 5 e 7
        if ((this.phase === 5 || this.phase === 7) && Math.random() < 0.08) {
            projectiles.push({
                x: this.x + this.width / 2,
                y: this.y,
                vx: (Math.random() - 0.5) * 4,
                vy: -5,
                radius: 8,
                isHoming: true,
                color: '#ff00aa'
            });
        }
    }

    setPhase(p) {
        this.phase = p;
        bossPhaseEl.innerText = p === 7 ? `[FASE 7: APOCALIPSE]` : `[FASE ${p}/7]`;
        screenShake = 20;

        if (p === 5) this.isShielded = true; // Fase 5 ganha escudo inicial
    }

    executeAttack() {
        this.isAttacking = true;

        // Fase 7 ativa Ultimate aleatoriamente
        if (this.phase === 7 && Math.random() < 0.4 && !this.isChargingUltimate) {
            this.isChargingUltimate = true;
            return;
        }

        // PODER: Teletransporte
        if (this.phase >= 2) {
            this.x = player.x + (Math.random() > 0.5 ? 110 : -130);
            this.x = Math.max(40, Math.min(670, this.x));
        }

        // PODER: Raio de Stun (Fase 4, 6 e 7)
        if ((this.phase === 4 || this.phase >= 6) && Math.random() < 0.35) {
            projectiles.push({
                x: this.x + this.width / 2,
                y: this.y + 30,
                vx: player.x > this.x ? 9 : -9,
                vy: 0,
                radius: 12,
                isStunRay: true,
                color: '#00ffff'
            });
        }

        // PODER: Clones Sombra (Fase 3 e 7)
        if (this.phase === 3 || this.phase === 7) {
            this.clones = [
                { x: 80, y: GROUND_Y - this.height },
                { x: 640, y: GROUND_Y - this.height }
            ];
        }

        // PODER: Espinhos de Solo (Fase 6 e 7)
        if (this.phase >= 6) {
            projectiles.push({
                x: player.x - 20,
                y: GROUND_Y - 40,
                width: 70,
                height: 40,
                isSpike: true,
                duration: 25,
                color: '#a600ff'
            });
        }

        // Dano de Área no Melee
        setTimeout(() => {
            if (checkAABB({ x: this.x - 40, y: this.y, width: this.width + 80, height: this.height }, player)) {
                player.takeDamage(12 + this.phase * 4);
            }
            screenShake = 8 + this.phase * 2;
            this.isAttacking = false;
        }, 220 * (1 / timeScale));
    }

    triggerSuperNova() {
        screenShake = 40;
        if (!player.isInvulnerable) {
            player.takeDamage(85);
        }
    }

    takeDamage(dmg) {
        if (this.isShielded) {
            // Desativa escudo após tomar 3 ataques
            this.isShielded = false;
            particles.push({ x: this.x + 45, y: this.y + 60, vx: 0, vy: -2, size: 12, color: '#00ffff', life: 25 });
            return;
        }

        this.hp = Math.max(0, this.hp - dmg);
        if (this.hp <= 0) victoryScreen.classList.remove('hidden');
    }

    draw() {
        ctx.save();
        const colors = ['', '#6c5ce7', '#a600ff', '#e84393', '#00cec9', '#d63031', '#fdcb6e', '#000000'];
        let color = colors[this.phase];

        // Desenhar Clones
        if (this.phase === 3 || this.phase === 7) {
            this.clones.forEach(c => {
                ctx.fillStyle = 'rgba(166, 0, 255, 0.3)';
                ctx.fillRect(c.x, c.y, this.width, this.height);
            });
        }

        // Corpo
        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Escudo da Fase 5
        if (this.isShielded) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 5;
            ctx.strokeRect(this.x - 8, this.y - 8, this.width + 16, this.height + 16);
        }

        // Carga de Ultimate (Fase 7)
        if (this.isChargingUltimate) {
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.ultimateCharge * 1.8, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Núcleo
        ctx.fillStyle = this.phase === 7 ? '#ff0000' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 45, 14, 0, Math.PI * 2);
        ctx.fill();

        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 0, 85, 0.5)';
            ctx.fillRect(this.x - 30, this.y - 10, this.width + 60, this.height + 20);
        }

        ctx.restore();
    }
}

// ==========================================
// 3. PROJÉTEIS & COLISÕES
// ==========================================
function updateProjectiles() {
    projectiles.forEach((p, index) => {
        if (p.isSpike) {
            p.duration--;
            if (checkAABB(p, player)) player.takeDamage(6);
        } else {
            // Se for Teleguiado (Homing)
            if (p.isHoming) {
                const angle = Math.atan2((player.y + 24) - p.y, (player.x + 16) - p.x);
                p.vx = Math.cos(angle) * 4;
                p.vy = Math.sin(angle) * 4;
            }

            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;

            const dist = Math.hypot(p.x - (player.x + player.width / 2), p.y - (player.y + player.height / 2));
            if (dist < p.radius + player.width / 2) {
                if (p.isStunRay) player.applyStun(80);
                else player.takeDamage(18);

                projectiles.splice(index, 1);
            }
        }
    });

    projectiles = projectiles.filter(p => (p.isSpike ? p.duration > 0 : (p.y < canvas.height && p.x > 0 && p.x < canvas.width)));
}

function drawProjectiles() {
    projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        if (p.isSpike) {
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

// Eventos de Teclado
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
    playerTimeEl.style.width = `${(player.energy / player.maxEnergy) * 100}%`;
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

    // Cenário
    ctx.fillStyle = boss.phase === 7 ? '#140008' : '#05030a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chão
    ctx.fillStyle = '#1c1233';
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
