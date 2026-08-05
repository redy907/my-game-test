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
