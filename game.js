/**
 * Bubble Shooter Game Logic
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// Configuration
const GRID_COLS = 9;  // Fewer columns = bigger, cuter bubbles!
const GRID_ROWS = 16; // Adjusted for larger bubbles
const COLORS = [
    '#FF9ECD', // Cotton Candy Pink
    '#87CEEB', // Sky Blue
    '#DDA0DD', // Plum/Lavender
    '#98FB98', // Pale Green/Mint
    '#FFDAB9', // Peach
    '#FFFACD'  // Lemon Chiffon
];
let maxMisses = 5; // Can be upgraded
let bombRadius = 1; // Can be upgraded

// Game State
let grid = [];
let particles = [];
let currentBubble = null;
let nextBubble = null;
let animationId;
let lastTime = 0;
let mouseX = 0;
let mouseY = 0;
let score = 0;
let isGameOver = false;
let isPaused = false;
let misses = 0;
let isShooting = false;
let currentAngle = -Math.PI / 2;
const AIM_SPEED = 0.03;

// Level System
let level = 1;
let bubblesCleared = 0;
const BUBBLES_PER_LEVEL = 30;

// Special Bubble Types
const BUBBLE_NORMAL = 'normal';
const BUBBLE_BOMB = 'bomb';
const BUBBLE_RAINBOW = 'rainbow';
let specialSpawnChance = 0.10; // Can be upgraded in shop

// Player Data (persisted)
let coins = 0;
let highScore = 0;
let maxLevelReached = 1;
let startingLevel = 1;
let ownedItems = [];
let levelScores = {}; // Best scores per level { levelNumber: bestScore }
let secretLevelLastCompleted = null; // Timestamp of last secret level completion
let isSecretLevel = false;
const SECRET_LEVEL_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
const SECRET_LEVEL_FEE = 100;
const SECRET_LEVEL_REWARD = 500;

// ============== NEW FEATURES ==============

// Daily Challenges System
const DAILY_CHALLENGES = [
    { id: 'pop_50', name: 'Pop 50 Bubbles', target: 50, track: 'bubblesPopped' },
    { id: 'clear_3', name: '3 Board Clears', target: 3, track: 'boardClears' },
    { id: 'level_10', name: 'Reach Level 10', target: 10, track: 'maxLevel' },
    { id: 'special_5', name: 'Use 5 Special Bubbles', target: 5, track: 'specialUsed' },
    { id: 'combo_5', name: 'Get a 5x Combo', target: 5, track: 'maxCombo' }
];
let dailyChallenge = { type: null, progress: 0, target: 0, lastDate: null, streak: 0, completed: false };
let dailyStats = { bubblesPopped: 0, boardClears: 0, maxLevel: 1, specialUsed: 0, maxCombo: 0 };

// Power-Up System
let powerUps = { freeze: 0, fire: 0, laser: 0 };
let activePowerUp = null;
let freezeShots = 0; // Shots remaining with freeze active

// Combo System
let comboCount = 0;
let comboMultiplier = 1;
let lastMatchTime = 0;
const COMBO_TIMEOUT = 3000; // 3 seconds to maintain combo

// Achievements System
const ACHIEVEMENTS = [
    { id: 'first_pop', name: 'First Pop', desc: 'Pop your first bubble', reward: 10, check: () => dailyStats.bubblesPopped >= 1 },
    { id: 'combo_master', name: 'Combo Master', desc: 'Get a 5x combo', reward: 25, check: () => dailyStats.maxCombo >= 5 },
    { id: 'color_clear', name: 'Color Clear', desc: 'Clear all of one color', reward: 50, check: () => stats.colorClears >= 1 },
    { id: 'level_10', name: 'Level 10', desc: 'Reach level 10', reward: 30, check: () => maxLevelReached >= 10 },
    { id: 'level_50', name: 'Level 50', desc: 'Reach level 50', reward: 100, check: () => maxLevelReached >= 50 },
    { id: 'board_clear', name: 'Board Clear', desc: 'Clear the entire board', reward: 50, check: () => stats.boardClears >= 1 },
    { id: 'shopaholic', name: 'Shopaholic', desc: 'Buy 3 shop items', reward: 25, check: () => ownedItems.length >= 3 },
    { id: 'secret_hunter', name: 'Secret Hunter', desc: 'Complete the secret level', reward: 100, check: () => stats.secretCompleted },
    { id: 'streak_master', name: 'Streak Master', desc: '7-day challenge streak', reward: 75, check: () => dailyChallenge.streak >= 7 },
    { id: 'ultimate', name: 'Ultimate', desc: 'Reach level 100', reward: 500, check: () => maxLevelReached >= 100 }
];
let unlockedAchievements = [];
let stats = { colorClears: 0, boardClears: 0, secretCompleted: false };
let pendingNotifications = []; // For achievement toasts

// Background Particles for enhanced animations
let backgroundParticles = [];
let screenShakeAmount = 0;
let floatingTexts = [];

// ============== JUICE EFFECTS ==============
let timeScale = 1; // For slow-mo effect
let trailParticles = []; // Projectile trails
let screenFlashAlpha = 0; // Screen flash on big clears
let pendingChainPops = []; // For chain reaction timing
let wobbleOriginX = 0; // For ripple wobble effect
let wobbleOriginY = 0;
let wobbleTime = 0;


// Shop Items
const SHOP_ITEMS = [
    { id: 'extra_life', name: 'Extra Life', icon: '❤️', desc: '+1 miss allowed', price: 50, effect: () => { maxMisses = 6; } },
    { id: 'bomb_boost', name: 'Bomb Boost', icon: '💣', desc: 'Bigger explosions', price: 100, effect: () => { bombRadius = 2; } },
    { id: 'rainbow_boost', name: 'Rainbow+', icon: '🌈', desc: 'More rainbow bubbles', price: 150, effect: () => { specialSpawnChance = 0.15; } },
    { id: 'coin_magnet', name: 'Coin Magnet', icon: '🧲', desc: '+50% coins earned', price: 200, effect: () => { /* Logic in doGameOver */ } },
    { id: 'slow_motion', name: 'Slow Drop', icon: '🐢', desc: 'Even more misses', price: 250, effect: () => { maxMisses = 8; } }
];

// Load saved data
function loadPlayerData() {
    try {
        const saved = localStorage.getItem('bubbleShooterData');
        if (saved) {
            const data = JSON.parse(saved);
            coins = data.coins || 0;
            highScore = data.highScore || 0;
            maxLevelReached = data.maxLevelReached || 1;
            ownedItems = data.ownedItems || [];
            levelScores = data.levelScores || {};
            secretLevelLastCompleted = data.secretLevelLastCompleted || null;

            // New features data
            dailyChallenge = data.dailyChallenge || { type: null, progress: 0, target: 0, lastDate: null, streak: 0, completed: false };
            powerUps = data.powerUps || { freeze: 0, fire: 0, laser: 0 };
            unlockedAchievements = data.unlockedAchievements || [];
            stats = data.stats || { colorClears: 0, boardClears: 0, secretCompleted: false };

            // Reset base values before applying upgrades
            maxMisses = 5;
            bombRadius = 1;
            specialSpawnChance = 0.10;

            // Apply owned effects
            ownedItems.forEach(id => {
                const item = SHOP_ITEMS.find(i => i.id === id);
                if (item) item.effect();
            });

            // Check if daily challenge needs refresh
            checkDailyChallengeRefresh();
        }
    } catch (e) {
        console.log('No saved data found');
    }
}

function savePlayerData() {
    const data = {
        coins, highScore, maxLevelReached, ownedItems, levelScores, secretLevelLastCompleted,
        dailyChallenge, powerUps, unlockedAchievements, stats
    };
    localStorage.setItem('bubbleShooterData', JSON.stringify(data));
}

// ============== DAILY CHALLENGE SYSTEM ==============

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function checkDailyChallengeRefresh() {
    const today = getTodayString();
    if (dailyChallenge.lastDate !== today) {
        // New day - check if streak continues
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (dailyChallenge.lastDate === yesterdayStr && dailyChallenge.completed) {
            // Streak continues
        } else if (dailyChallenge.lastDate !== yesterdayStr) {
            // Streak broken
            dailyChallenge.streak = 0;
        }

        // Generate new challenge
        generateDailyChallenge();
    }
}

function generateDailyChallenge() {
    const challenge = DAILY_CHALLENGES[Math.floor(Math.random() * DAILY_CHALLENGES.length)];
    dailyChallenge.type = challenge.id;
    dailyChallenge.target = challenge.target;
    dailyChallenge.progress = 0;
    dailyChallenge.lastDate = getTodayString();
    dailyChallenge.completed = false;
    dailyStats = { bubblesPopped: 0, boardClears: 0, maxLevel: 1, specialUsed: 0, maxCombo: 0 };
    savePlayerData();
}

function updateDailyChallenge(stat, value) {
    if (dailyChallenge.completed) return;

    dailyStats[stat] = Math.max(dailyStats[stat], value);

    const challenge = DAILY_CHALLENGES.find(c => c.id === dailyChallenge.type);
    if (challenge && challenge.track === stat) {
        if (stat === 'maxLevel' || stat === 'maxCombo') {
            dailyChallenge.progress = value;
        } else {
            dailyChallenge.progress = dailyStats[stat];
        }

        if (dailyChallenge.progress >= dailyChallenge.target) {
            completeDailyChallenge();
        }
    }
}

function incrementDailyStat(stat) {
    dailyStats[stat]++;
    updateDailyChallenge(stat, dailyStats[stat]);
}

function completeDailyChallenge() {
    if (dailyChallenge.completed) return;
    dailyChallenge.completed = true;
    dailyChallenge.streak++;

    // Reward coins
    let reward = 25;
    if (dailyChallenge.streak >= 30) reward = 500;
    else if (dailyChallenge.streak >= 7) reward = 100;

    coins += reward;
    showNotification(`🎯 Daily Complete! +${reward}💎`, 'success');

    // Check streak achievements
    checkAchievements();
    savePlayerData();
}

function renderDailyChallengeScreen() {
    const challenge = DAILY_CHALLENGES.find(c => c.id === dailyChallenge.type);
    if (!challenge) {
        generateDailyChallenge();
        return renderDailyChallengeScreen();
    }

    const progressPercent = Math.min(100, (dailyChallenge.progress / dailyChallenge.target) * 100);

    document.getElementById('daily-challenge-name').textContent = challenge.name;
    document.getElementById('daily-progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('daily-progress-text').textContent = `${dailyChallenge.progress}/${dailyChallenge.target}`;
    document.getElementById('daily-streak').textContent = `🔥 ${dailyChallenge.streak} day streak`;
    document.getElementById('daily-status').textContent = dailyChallenge.completed ? '✅ COMPLETED!' : '⏳ In Progress';
    document.getElementById('daily-status').className = 'daily-status ' + (dailyChallenge.completed ? 'completed' : 'active');
}

// ============== POWER-UP SYSTEM ==============

function activatePowerUp(type) {
    if (powerUps[type] <= 0 || activePowerUp) return;

    powerUps[type]--;
    activePowerUp = type;

    if (type === 'freeze') {
        freezeShots = 3;
        showNotification('❄️ Freeze Active! No drops for 3 shots', 'power');
    } else if (type === 'fire') {
        showNotification('🔥 Fire Active! Next shot destroys adjacent', 'power');
    } else if (type === 'laser') {
        showNotification('🔫 Laser Active! Click to fire column laser', 'power');
    }

    updatePowerUpUI();
    savePlayerData();
}

function useLaserPowerUp(col) {
    if (activePowerUp !== 'laser') return;

    let destroyed = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
        // Find the actual column at this row based on hex grid offset
        const offset = (r % 2 === 1) ? 0.5 : 0;
        const nearestCol = Math.round(col - offset);
        if (nearestCol >= 0 && nearestCol < GRID_COLS && grid[r][nearestCol]) {
            const b = grid[r][nearestCol];
            b.popping = true;
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(b.x, b.y, b.color));
            }
            grid[r][nearestCol] = null;
            destroyed++;
        }
    }

    score += destroyed * 15;
    activePowerUp = null;
    updatePowerUpUI();

    // Check for floating clusters
    const floating = findFloatingClusters();
    dropBubbles(floating);
    score += floating.length * 20;

    updateUI();
}

function awardPowerUp() {
    const types = ['freeze', 'fire', 'laser'];
    const type = types[Math.floor(Math.random() * types.length)];
    powerUps[type]++;

    const icons = { freeze: '❄️', fire: '🔥', laser: '🔫' };
    showNotification(`${icons[type]} Power-Up Acquired!`, 'power');
    updatePowerUpUI();
    savePlayerData();
}

function updatePowerUpUI() {
    const freezeBtn = document.getElementById('powerup-freeze');
    const fireBtn = document.getElementById('powerup-fire');
    const laserBtn = document.getElementById('powerup-laser');

    if (freezeBtn) {
        freezeBtn.querySelector('.powerup-count').textContent = powerUps.freeze;
        freezeBtn.classList.toggle('active', activePowerUp === 'freeze');
        freezeBtn.disabled = powerUps.freeze === 0 && activePowerUp !== 'freeze';
    }
    if (fireBtn) {
        fireBtn.querySelector('.powerup-count').textContent = powerUps.fire;
        fireBtn.classList.toggle('active', activePowerUp === 'fire');
        fireBtn.disabled = powerUps.fire === 0 && activePowerUp !== 'fire';
    }
    if (laserBtn) {
        laserBtn.querySelector('.powerup-count').textContent = powerUps.laser;
        laserBtn.classList.toggle('active', activePowerUp === 'laser');
        laserBtn.disabled = powerUps.laser === 0 && activePowerUp !== 'laser';
    }
}

// ============== COMBO SYSTEM ==============

function updateCombo(successful) {
    const now = Date.now();

    if (successful) {
        if (now - lastMatchTime < COMBO_TIMEOUT) {
            comboCount++;
        } else {
            comboCount = 1;
        }
        lastMatchTime = now;

        // Update multiplier
        if (comboCount >= 5) {
            comboMultiplier = 3;
        } else if (comboCount >= 3) {
            comboMultiplier = 2;
        } else if (comboCount >= 2) {
            comboMultiplier = 1.5;
        } else {
            comboMultiplier = 1;
        }

        // Track for achievements
        if (comboCount > dailyStats.maxCombo) {
            dailyStats.maxCombo = comboCount;
            updateDailyChallenge('maxCombo', comboCount);
        }

        // Visual feedback
        if (comboCount >= 2) {
            addFloatingText(`${comboCount}x COMBO!`, GAME_WIDTH / 2, GAME_HEIGHT / 2, comboCount >= 5 ? '#FFD700' : '#FFF');
            if (comboCount >= 5) {
                triggerScreenShake(10);
            }
        }
    } else {
        comboCount = 0;
        comboMultiplier = 1;
    }

    updateComboUI();
}

function updateComboUI() {
    const meter = document.getElementById('combo-meter');
    const text = document.getElementById('combo-text');
    if (meter && text) {
        meter.style.display = comboCount >= 2 ? 'block' : 'none';
        text.textContent = `${comboCount}x`;
        meter.className = 'combo-meter';
        if (comboCount >= 5) meter.classList.add('combo-max');
        else if (comboCount >= 3) meter.classList.add('combo-high');
    }
}

// ============== ACHIEVEMENTS SYSTEM ==============

function checkAchievements() {
    for (const achievement of ACHIEVEMENTS) {
        if (!unlockedAchievements.includes(achievement.id) && achievement.check()) {
            unlockAchievement(achievement);
        }
    }
}

function unlockAchievement(achievement) {
    unlockedAchievements.push(achievement.id);
    coins += achievement.reward;
    showNotification(`🏆 ${achievement.name}! +${achievement.reward}💎`, 'achievement');
    savePlayerData();
}

function renderAchievementsScreen() {
    const container = document.getElementById('achievements-grid');
    container.innerHTML = '';

    for (const achievement of ACHIEVEMENTS) {
        const unlocked = unlockedAchievements.includes(achievement.id);
        const div = document.createElement('div');
        div.className = 'achievement-item' + (unlocked ? ' unlocked' : ' locked');
        div.innerHTML = `
            <div class="achievement-icon">${unlocked ? '🏆' : '🔒'}</div>
            <div class="achievement-info">
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            </div>
            <div class="achievement-reward">${unlocked ? '✓' : `${achievement.reward}💎`}</div>
        `;
        container.appendChild(div);
    }
}

// ============== NOTIFICATIONS ==============

function showNotification(text, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = text;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============== ENHANCED ANIMATIONS ==============

class BackgroundParticle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.size = Math.random() * 3 + 1;
        this.speedY = Math.random() * 0.3 + 0.1;
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.5 + 0.2;
        this.twinkle = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.y -= this.speedY;
        this.x += this.speedX;
        this.twinkle += dt * 2;

        if (this.y < -10) {
            this.y = GAME_HEIGHT + 10;
            this.x = Math.random() * GAME_WIDTH;
        }
    }

    draw(ctx) {
        const alpha = this.opacity * (0.5 + 0.5 * Math.sin(this.twinkle));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function initBackgroundParticles() {
    backgroundParticles = [];
    for (let i = 0; i < 30; i++) {
        backgroundParticles.push(new BackgroundParticle());
    }
}

function triggerScreenShake(amount) {
    screenShakeAmount = amount;
}

class FloatingText {
    constructor(text, x, y, color = '#FFF') {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.5;
        this.vy = -2;
        this.scale = 1;
    }

    update(dt) {
        this.y += this.vy;
        this.life -= dt;
        this.scale = Math.min(1.2, this.scale + dt * 0.5);
        if (this.life < 0.5) {
            this.scale = this.life * 2;
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.font = "bold 24px 'Fredoka One', cursive";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.color;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}

function addFloatingText(text, x, y, color) {
    floatingTexts.push(new FloatingText(text, x, y, color));
}

// Confetti System
class Confetti {
    constructor() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = -20;
        this.size = Math.random() * 8 + 4;
        this.color = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98FB98'][Math.floor(Math.random() * 8)];
        this.vy = Math.random() * 3 + 2;
        this.vx = (Math.random() - 0.5) * 4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
        this.life = 3;
    }

    update(dt) {
        this.y += this.vy;
        this.x += this.vx;
        this.rotation += this.rotationSpeed;
        this.vy += 0.1; // gravity
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
        ctx.restore();
    }
}

let confettiParticles = [];

function spawnConfetti() {
    for (let i = 0; i < 50; i++) {
        confettiParticles.push(new Confetti());
    }
}

// ============== JUICE HELPER CLASSES ==============

// Trail particle for projectile sparkle trail
class TrailParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 0.5;
        this.size = Math.random() * 6 + 3;
        this.sparkle = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.life -= dt * 2;
        this.size *= 0.95;
        this.sparkle += dt * 10;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);

        // Star/sparkle shape
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2 / 5) + this.sparkle;
            const outerR = this.size;
            const innerR = this.size * 0.4;
            ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
            const innerAngle = angle + Math.PI / 5;
            ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// Spawn trail particles behind projectile
function spawnTrailParticle(x, y, color) {
    trailParticles.push(new TrailParticle(x, y, color));
    // Limit trail particles
    if (trailParticles.length > 30) {
        trailParticles.shift();
    }
}

// Trigger slow-mo effect
function triggerSlowMo(duration = 0.5) {
    timeScale = 0.3;
    setTimeout(() => {
        timeScale = 1;
    }, duration * 1000);
}

// Trigger screen flash
function triggerScreenFlash() {
    screenFlashAlpha = 0.5;
}

// Trigger wobble effect from a point
function triggerWobble(x, y) {
    wobbleOriginX = x;
    wobbleOriginY = y;
    wobbleTime = 1;
}

// Chain reaction pop - pops bubbles with delays for domino effect
function popBubblesChain(locations) {
    if (locations.length === 0) return;

    // Sort by distance from center for wave effect
    const centerX = locations.reduce((sum, loc) => {
        const b = grid[loc.r][loc.c];
        return sum + (b ? b.x : 0);
    }, 0) / locations.length;
    const centerY = locations.reduce((sum, loc) => {
        const b = grid[loc.r][loc.c];
        return sum + (b ? b.y : 0);
    }, 0) / locations.length;

    locations.sort((a, b) => {
        const bA = grid[a.r][a.c];
        const bB = grid[b.r][b.c];
        if (!bA || !bB) return 0;
        const distA = Math.hypot(bA.x - centerX, bA.y - centerY);
        const distB = Math.hypot(bB.x - centerX, bB.y - centerY);
        return distA - distB;
    });

    // Trigger wobble from center
    triggerWobble(centerX, centerY);

    // Pop with staggered timing
    locations.forEach((loc, index) => {
        const delay = index * 50; // 50ms between each pop
        setTimeout(() => {
            const b = grid[loc.r][loc.c];
            if (b && !b.popping) {
                b.popping = true;
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(b.x, b.y, b.color));
                }
                grid[loc.r][loc.c] = null;
            }
        }, delay);
    });

    // Slow-mo for big clears
    if (locations.length >= 5) {
        triggerSlowMo(0.4);
    }
}



// ============== SECRET EASTER EGGS ==============

// Secret #1: Konami Code - ↑↑↓↓←→←→ on main menu for 50 free coins
let konamiSequence = [];
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
let konamiLastUsed = null;

document.addEventListener('keydown', (e) => {
    if (!document.getElementById('main-menu').classList.contains('hidden')) {
        konamiSequence.push(e.code);
        if (konamiSequence.length > KONAMI_CODE.length) {
            konamiSequence.shift();
        }
        if (JSON.stringify(konamiSequence) === JSON.stringify(KONAMI_CODE)) {
            const today = getTodayString();
            if (konamiLastUsed !== today) {
                konamiLastUsed = today;
                coins += 50;
                savePlayerData();
                showNotification('🎮 Konami Code! +50💎', 'success');
                konamiSequence = [];
            }
        }
    }
});

// Secret #2: Click title 10 times for Golden Bubble skin
let titleClickCount = 0;
let goldenBubblesUnlocked = false;

function onTitleClick() {
    titleClickCount++;
    if (titleClickCount >= 10 && !goldenBubblesUnlocked) {
        goldenBubblesUnlocked = true;
        localStorage.setItem('goldenBubbles', 'true');
        showNotification('✨ Golden Bubbles Unlocked!', 'achievement');
    }
}

// Load golden bubbles state
if (localStorage.getItem('goldenBubbles') === 'true') {
    goldenBubblesUnlocked = true;
}

// Screen Navigation
function showScreen(screenId) {
    const screens = ['main-menu', 'start-screen', 'levels-screen', 'shop-screen', 'game-over-screen', 'secret-screen', 'pause-menu', 'confirm-exit', 'daily-screen', 'achievements-screen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');

    // Update displays
    if (screenId === 'main-menu') {
        document.getElementById('high-score').textContent = highScore;
    } else if (screenId === 'levels-screen') {
        renderLevelsGrid();
    } else if (screenId === 'shop-screen') {
        document.getElementById('shop-coins').textContent = coins;
        renderShopGrid();
    } else if (screenId === 'secret-screen') {
        updateSecretLevelScreen();
    } else if (screenId === 'daily-screen') {
        renderDailyChallengeScreen();
    } else if (screenId === 'achievements-screen') {
        renderAchievementsScreen();
    }
}

// Pause System
function togglePause() {
    if (isGameOver) return;

    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pause-menu');

    if (isPaused) {
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
    }
}

// Exit Confirmation System
let pendingExitDestination = null;

function confirmExit(destination) {
    pendingExitDestination = destination;
    document.getElementById('confirm-score-value').textContent = score;
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('confirm-exit').classList.remove('hidden');
}

function cancelExit() {
    pendingExitDestination = null;
    document.getElementById('confirm-exit').classList.add('hidden');
    document.getElementById('pause-menu').classList.remove('hidden');
}

function confirmExitNow() {
    if (!pendingExitDestination) return;

    // Reset game state
    isPaused = false;
    document.getElementById('confirm-exit').classList.add('hidden');
    document.getElementById('ui-layer').classList.add('hidden');
    if (animationId) cancelAnimationFrame(animationId);

    // Navigate to destination
    switch (pendingExitDestination) {
        case 'home':
            showScreen('main-menu');
            break;
        case 'levels':
            showScreen('levels-screen');
            break;
        case 'shop':
            showScreen('shop-screen');
            break;
    }

    pendingExitDestination = null;
}

// Legacy functions (kept for backwards compatibility but now unused)
function goToHome() {
    confirmExit('home');
}

function goToLevels() {
    confirmExit('levels');
}

function goToShop() {
    confirmExit('shop');
}

// Star rating thresholds
const STAR_THRESHOLDS = {
    ONE_STAR: 0,      // Just completing gives 1 star
    TWO_STARS: 500,   // Score 500+ for 2 stars
    THREE_STARS: 1000 // Score 1000+ for 3 stars
};

function getStarsForScore(score) {
    if (score >= STAR_THRESHOLDS.THREE_STARS) return 3;
    if (score >= STAR_THRESHOLDS.TWO_STARS) return 2;
    if (score >= STAR_THRESHOLDS.ONE_STAR) return 1;
    return 0;
}

function getStarsHTML(stars) {
    if (stars === 0) return '';
    const filled = '⭐'.repeat(stars);
    const empty = '☆'.repeat(3 - stars);
    return `<span class="level-stars">${filled}${empty}</span>`;
}

function getWorldClass(levelNum) {
    if (levelNum >= 40) return 'world-galaxy';
    if (levelNum >= 20) return 'world-moon';
    return 'world-sky';
}

function renderLevelsGrid() {
    const skyGrid = document.getElementById('levels-grid-sky');
    const moonGrid = document.getElementById('levels-grid-moon');
    const galaxyGrid = document.getElementById('levels-grid-galaxy');

    skyGrid.innerHTML = '';
    moonGrid.innerHTML = '';
    galaxyGrid.innerHTML = '';

    // Calculate total stars for progress
    let totalStars = 0;
    const maxStars = 100 * 3; // 100 levels x 3 stars each

    for (let i = 1; i <= 100; i++) {
        const isUnlocked = i <= maxLevelReached;
        const isCurrent = i === maxLevelReached;
        const bestScore = levelScores[i] || 0;
        const stars = isUnlocked && bestScore > 0 ? getStarsForScore(bestScore) : 0;
        totalStars += stars;

        const worldClass = getWorldClass(i);

        const btn = document.createElement('button');
        btn.className = `level-btn ${isUnlocked ? 'unlocked' : 'locked'} ${worldClass}`;
        if (isCurrent) btn.classList.add('current-level');

        if (isUnlocked) {
            btn.innerHTML = `
                <span class="level-num">${i}</span>
                ${stars > 0 ? getStarsHTML(stars) : '<span class="level-stars">☆☆☆</span>'}
            `;
            btn.onclick = () => {
                startingLevel = i;
                showScreen('start-screen');
            };
        } else {
            btn.innerHTML = `<span class="lock-icon">🔒</span>`;
        }

        // Add to appropriate world grid
        if (i <= 19) {
            skyGrid.appendChild(btn);
        } else if (i <= 39) {
            moonGrid.appendChild(btn);
        } else {
            galaxyGrid.appendChild(btn);
        }
    }

    // Update progress bar
    const progressPercent = (maxLevelReached / 100) * 100;
    document.getElementById('levels-progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('levels-progress-text').textContent = `${totalStars}/${maxStars} ⭐`;

    // Update quick play button
    document.getElementById('quick-play-level').textContent = maxLevelReached;

    // Auto-scroll to current world
    setTimeout(() => {
        const container = document.getElementById('levels-worlds-container');
        if (maxLevelReached >= 40) {
            document.getElementById('world-galaxy').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (maxLevelReached >= 20) {
            document.getElementById('world-moon').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            container.scrollTop = 0;
        }
    }, 100);
}

function quickPlayHighest() {
    startingLevel = maxLevelReached;
    showScreen('start-screen');
}

function renderShopGrid() {
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
        const owned = ownedItems.includes(item.id);
        const canAfford = coins >= item.price;

        const div = document.createElement('div');
        div.className = 'shop-item';
        div.innerHTML = `
            <div class="shop-item-info">
                <span class="shop-item-icon">${item.icon}</span>
                <div>
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                </div>
            </div>
            <button class="shop-buy-btn ${owned ? 'owned' : ''}" 
                    ${owned || !canAfford ? 'disabled' : ''}>
                ${owned ? '✓ OWNED' : `💎 ${item.price}`}
            </button>
        `;

        if (!owned && canAfford) {
            div.querySelector('.shop-buy-btn').onclick = () => buyItem(item);
        }
        grid.appendChild(div);
    });
}

function buyItem(item) {
    if (coins >= item.price && !ownedItems.includes(item.id)) {
        coins -= item.price;
        ownedItems.push(item.id);
        item.effect();
        savePlayerData();
        renderShopGrid();
        document.getElementById('shop-coins').textContent = coins;
    }
}

// Secret Level System
function isSecretLevelAvailable() {
    if (!secretLevelLastCompleted) return true;
    const now = Date.now();
    const timeSince = now - secretLevelLastCompleted;
    return timeSince >= SECRET_LEVEL_COOLDOWN_MS;
}

function getSecretLevelTimeRemaining() {
    if (!secretLevelLastCompleted) return 0;
    const now = Date.now();
    const timeSince = now - secretLevelLastCompleted;
    const remaining = SECRET_LEVEL_COOLDOWN_MS - timeSince;
    return Math.max(0, remaining);
}

function formatTimeRemaining(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
    }
    return `${hours}h ${minutes}m`;
}

function updateSecretLevelScreen() {
    const statusEl = document.getElementById('secret-status');
    const playBtn = document.getElementById('secret-play-btn');

    const available = isSecretLevelAvailable();
    const canAfford = coins >= SECRET_LEVEL_FEE;

    if (!available) {
        const remaining = getSecretLevelTimeRemaining();
        statusEl.textContent = `🔒 Locked - Available in ${formatTimeRemaining(remaining)}`;
        statusEl.className = 'secret-status locked';
        playBtn.disabled = true;
        playBtn.textContent = '🔒 LOCKED';
    } else if (!canAfford) {
        statusEl.textContent = `Need ${SECRET_LEVEL_FEE - coins} more 💎`;
        statusEl.className = 'secret-status';
        playBtn.disabled = true;
        playBtn.textContent = '💎 NOT ENOUGH';
    } else {
        statusEl.textContent = '✨ Ready to challenge!';
        statusEl.className = 'secret-status available';
        playBtn.disabled = false;
        playBtn.textContent = '🔮 ENTER';
    }
}

function startSecretLevel() {
    if (!isSecretLevelAvailable() || coins < SECRET_LEVEL_FEE) return;

    // Deduct entry fee
    coins -= SECRET_LEVEL_FEE;
    savePlayerData();

    // Set secret level mode
    isSecretLevel = true;

    // Hide screens and show game
    document.getElementById('secret-screen').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');

    resize();
    initSecretLevelGrid();

    score = 0;
    misses = 0;
    level = 99; // Display as level 99 for the secret level
    bubblesCleared = 0;
    isGameOver = false;
    isShooting = false;
    particles = [];
    currentAngle = -Math.PI / 2;
    nextBubble = getNextBubble();

    // Make it MUCH harder
    maxMisses = 3; // Only 3 misses allowed

    updateUI();
    updateMissIndicator();

    if (animationId) cancelAnimationFrame(animationId);
    lastTime = performance.now();
    loop(lastTime);
}

function initSecretLevelGrid() {
    // Secret level starts with MORE rows and harder patterns
    grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        let row = [];
        for (let c = 0; c < GRID_COLS; c++) {
            row.push(null);
        }
        grid.push(row);
    }

    // Fill 8 rows instead of 5 - much harder!
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            grid[r][c] = new Bubble(r, c, getRandomColor());
        }
    }
    console.log('Secret level grid initialized with 8 rows');
}

// Dimensions
let TILE_WIDTH = 0;
let ROW_HEIGHT = 0;
let RADIUS = 0;
let OFFSET_X = 0;
let GAME_WIDTH = 0;
let GAME_HEIGHT = 0;

// Setup Canvas size
function resize() {
    const aspectRatio = 3 / 4;
    let w = Math.min(window.innerWidth - 20, 600);
    if (w < 300) w = 300; // Minimum width safety
    let h = w / aspectRatio;

    if (h > window.innerHeight - 20) {
        h = window.innerHeight - 20;
        w = h * aspectRatio;
    }

    canvas.width = w;
    canvas.height = h;
    container.style.width = `${w}px`;
    container.style.height = `${h}px`;

    GAME_WIDTH = w;
    GAME_HEIGHT = h;

    TILE_WIDTH = GAME_WIDTH / (GRID_COLS + 0.5);
    RADIUS = TILE_WIDTH / 2 - 1;
    ROW_HEIGHT = RADIUS * Math.sqrt(3);
    console.log('Resized:', { w, h, TILE_WIDTH, RADIUS, ROW_HEIGHT });

    drawMissIndicator();
}

window.addEventListener('resize', () => {
    resize();
    if (!isGameOver && grid.length > 0) draw();
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    updateAngleFromMouse();
});

canvas.addEventListener('click', e => {
    if (isGameOver || isShooting || isPaused || !nextBubble) return;
    shootBubbleWithAngle(currentAngle);
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
    mouseY = e.touches[0].clientY - rect.top;
    updateAngleFromMouse();
}, { passive: false });

canvas.addEventListener('touchstart', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
    mouseY = e.touches[0].clientY - rect.top;
    updateAngleFromMouse();
});

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (isGameOver || isShooting || isPaused || !nextBubble) return;
    shootBubbleWithAngle(currentAngle);
});

// Keyboard Controls
document.addEventListener('keydown', e => {
    // Escape key for pause - works even when game over
    if (e.code === 'Escape') {
        e.preventDefault();
        // Only allow pause if game is active (UI layer visible)
        if (!document.getElementById('ui-layer').classList.contains('hidden')) {
            togglePause();
        }
        return;
    }

    if (isGameOver || isPaused) return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (!isShooting && nextBubble) {
                shootBubbleWithAngle(currentAngle);
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            currentAngle = Math.max(-Math.PI + 0.1, currentAngle - AIM_SPEED);
            updateMouseFromAngle();
            break;
        case 'ArrowRight':
            e.preventDefault();
            currentAngle = Math.min(-0.1, currentAngle + AIM_SPEED);
            updateMouseFromAngle();
            break;
    }
});

function updateAngleFromMouse() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT - RADIUS * 2;
    let dx = mouseX - cx;
    let dy = mouseY - cy;
    if (dy > -10) dy = -10;
    currentAngle = Math.atan2(dy, dx);
    // Clamp angle to valid range (pointing upward)
    currentAngle = Math.max(-Math.PI + 0.1, Math.min(-0.1, currentAngle));
}

function updateMouseFromAngle() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT - RADIUS * 2;
    mouseX = cx + Math.cos(currentAngle) * 100;
    mouseY = cy + Math.sin(currentAngle) * 100;
}

function shootBubbleWithAngle(angle) {
    isShooting = true;
    const startX = GAME_WIDTH / 2;
    const startY = GAME_HEIGHT - RADIUS * 2;
    currentBubble = new Projectile(startX, startY, nextBubble.color, angle, nextBubble.type);
    nextBubble = getNextBubble();
}

// --- Classes ---

// Helper to convert hex to rgba
function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

class Bubble {
    constructor(r, c, color, type = BUBBLE_NORMAL) {
        this.r = r;
        this.c = c;
        this.color = color;
        this.type = type;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.visible = true;
        this.popping = false;
        this.popScale = 1;
        this.dropping = false;
        this.vy = 0;
        this.vx = 0;
        this.animTime = Math.random() * Math.PI * 2; // For animations

        this.calculatePos();
        this.x = this.targetX;
        this.y = this.targetY;
    }

    calculatePos() {
        const offset = (this.r % 2 === 1) ? TILE_WIDTH / 2 : 0;
        this.targetX = (this.c * TILE_WIDTH) + TILE_WIDTH / 2 + offset;
        this.targetY = (this.r * ROW_HEIGHT) + TILE_WIDTH / 2;
    }

    update(dt) {
        this.animTime += dt * 3; // Animate special bubbles
        if (this.dropping) {
            this.vy += 0.5;
            this.y += this.vy;
            this.x += this.vx;
            if (this.y > GAME_HEIGHT + RADIUS * 2) {
                this.visible = false;
            }
        } else if (this.popping) {
            this.popScale -= 5 * dt;
            if (this.popScale <= 0) this.visible = false;
        } else {
            this.calculatePos();
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.x += dx * 10 * dt;
            this.y += dy * 10 * dt;
        }
    }

    draw(ctx) {
        if (!this.visible) return;

        ctx.save();

        // Calculate wobble offset for ripple effect
        let wobbleOffsetX = 0;
        let wobbleOffsetY = 0;
        if (wobbleTime > 0 && !this.popping && !this.dropping) {
            const dist = Math.hypot(this.x - wobbleOriginX, this.y - wobbleOriginY);
            const maxDist = 200;
            if (dist < maxDist) {
                const strength = (1 - dist / maxDist) * wobbleTime * 8;
                const angle = Math.atan2(this.y - wobbleOriginY, this.x - wobbleOriginX);
                wobbleOffsetX = Math.cos(angle) * Math.sin(wobbleTime * 15) * strength;
                wobbleOffsetY = Math.sin(angle) * Math.sin(wobbleTime * 15) * strength;
            }
        }

        ctx.translate(this.x + wobbleOffsetX, this.y + wobbleOffsetY);

        if (this.popping) {
            ctx.scale(this.popScale, this.popScale);
        }

        // Outer glow for cute effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Main bubble body - semi-transparent for glass effect
        const baseGrad = ctx.createRadialGradient(
            -RADIUS * 0.3, -RADIUS * 0.4, 0,
            0, 0, RADIUS
        );
        baseGrad.addColorStop(0, this.color);
        baseGrad.addColorStop(0.7, hexToRgba(this.color, 0.8));
        baseGrad.addColorStop(1, hexToRgba(this.color, 0.5));

        ctx.beginPath();
        ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = baseGrad;
        ctx.fill();

        ctx.shadowBlur = 0;

        // Glass-like inner gradient
        const innerGrad = ctx.createRadialGradient(
            -RADIUS * 0.2, -RADIUS * 0.2, RADIUS * 0.1,
            0, 0, RADIUS
        );
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        innerGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        innerGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Main highlight - big shine
        ctx.beginPath();
        ctx.ellipse(-RADIUS * 0.25, -RADIUS * 0.3, RADIUS * 0.35, RADIUS * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();

        // Small sparkle accent
        ctx.beginPath();
        ctx.arc(-RADIUS * 0.4, -RADIUS * 0.45, RADIUS * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();

        // Soft edge ring for depth
        ctx.beginPath();
        ctx.arc(0, 0, RADIUS - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Golden bubble effect when easter egg unlocked
        if (goldenBubblesUnlocked) {
            // Golden shimmer ring
            const goldenHue = 45 + Math.sin(this.animTime * 2) * 10;
            ctx.beginPath();
            ctx.arc(0, 0, RADIUS + 2, 0, Math.PI * 2);
            ctx.strokeStyle = `hsl(${goldenHue}, 100%, 50%)`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FFD700';
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Extra golden sparkles
            const sparkleAngle = this.animTime * 3;
            for (let i = 0; i < 3; i++) {
                const angle = sparkleAngle + (i * Math.PI * 2 / 3);
                const sx = Math.cos(angle) * RADIUS * 0.7;
                const sy = Math.sin(angle) * RADIUS * 0.7;
                const sparkleSize = 2 + Math.sin(this.animTime * 4 + i) * 1;
                ctx.beginPath();
                ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
            }
        }

        // Special bubble indicators
        if (this.type === BUBBLE_BOMB) {
            // Bomb icon - pulsing effect
            const pulse = 1 + Math.sin(this.animTime * 2) * 0.1;
            ctx.font = `bold ${RADIUS * 0.8 * pulse}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#333';
            ctx.fillText('💣', 0, 2);
        } else if (this.type === BUBBLE_RAINBOW) {
            // Rainbow swirl indicator
            const hue = (this.animTime * 50) % 360;
            ctx.beginPath();
            ctx.arc(0, 0, RADIUS * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = `bold ${RADIUS * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText('✨', 0, 0);
        }

        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, color, angle, type = BUBBLE_NORMAL) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.speed = 1200;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.radius = RADIUS;
        this.active = true;
        this.animTime = 0;
    }

    update(dt) {
        if (!this.active) return;
        this.animTime += dt * 3;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Spawn trail particles for sparkle effect
        if (Math.random() < 0.4) {
            spawnTrailParticle(this.x, this.y, this.color);
        }

        // Wall collisions
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -1;
        } else if (this.x + this.radius > GAME_WIDTH) {
            this.x = GAME_WIDTH - this.radius;
            this.vx *= -1;
        }

        // Ceiling collision
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.snapToGrid();
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shine
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        // Golden projectile effect when easter egg unlocked
        if (goldenBubblesUnlocked) {
            const goldenHue = 45 + Math.sin(this.animTime * 2) * 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = `hsl(${goldenHue}, 100%, 50%)`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#FFD700';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Special type indicators
        if (this.type === BUBBLE_BOMB) {
            const pulse = 1 + Math.sin(this.animTime * 2) * 0.1;
            ctx.font = `bold ${this.radius * 0.8 * pulse}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#333';
            ctx.fillText('💣', 0, 2);
        } else if (this.type === BUBBLE_RAINBOW) {
            const hue = (this.animTime * 50) % 360;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.font = `bold ${this.radius * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText('✨', 0, 0);
        }

        ctx.restore();
    }

    snapToGrid() {
        let bestDist = Infinity;
        let bestR = -1;
        let bestC = -1;

        const approxRow = Math.floor(this.y / ROW_HEIGHT);
        const startRow = Math.max(0, approxRow - 2);
        const endRow = Math.min(GRID_ROWS - 1, approxRow + 2);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (grid[r][c]) continue;

                const offset = (r % 2 === 1) ? TILE_WIDTH / 2 : 0;
                const cx = (c * TILE_WIDTH) + TILE_WIDTH / 2 + offset;
                const cy = (r * ROW_HEIGHT) + TILE_WIDTH / 2;

                const dist = Math.hypot(this.x - cx, this.y - cy);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestR = r;
                    bestC = c;
                }
            }
        }

        if (bestR !== -1) {
            placeBubble(bestR, bestC, this.color, this.type);
            this.active = false;
            isShooting = false;
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 1.5 + 0.5;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, RADIUS / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- Game Logic Functions ---

function initGrid() {
    grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        let row = [];
        for (let c = 0; c < GRID_COLS; c++) {
            row.push(null);
        }
        grid.push(row);
    }

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            grid[r][c] = new Bubble(r, c, getRandomColor());
        }
    }
    console.log('Grid initialized', grid);
}

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getExistingColors() {
    const colors = new Set();
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && grid[r][c].visible) {
                colors.add(grid[r][c].color);
            }
        }
    }
    if (colors.size === 0) return COLORS;
    return Array.from(colors);
}

function getNextBubble() {
    const validColors = getExistingColors();
    const color = validColors[Math.floor(Math.random() * validColors.length)];

    // Determine bubble type - special bubbles spawn with low chance
    let type = BUBBLE_NORMAL;
    const rand = Math.random();
    if (rand < specialSpawnChance) {
        type = BUBBLE_BOMB;
    } else if (rand < specialSpawnChance * 2) {
        type = BUBBLE_RAINBOW;
    }

    return new Bubble(0, 0, color, type);
}

function shootBubble() {
    isShooting = true;

    const startX = GAME_WIDTH / 2;
    const startY = GAME_HEIGHT - RADIUS * 2;

    let dx = mouseX - startX;
    let dy = mouseY - startY;

    if (dy > -10) dy = -10;

    const angle = Math.atan2(dy, dx);

    currentBubble = new Projectile(startX, startY, nextBubble.color, angle);

    nextBubble = getNextBubble();
}

function placeBubble(r, c, color, type = BUBBLE_NORMAL) {
    grid[r][c] = new Bubble(r, c, color, type);

    let totalPopped = 0;
    let wasSuccessfulMatch = false;

    // Handle Fire power-up - destroys all adjacent bubbles
    if (activePowerUp === 'fire') {
        const fireTargets = [];
        const neighbors = getNeighbors(r, c);
        fireTargets.push({ r, c });
        for (const n of neighbors) {
            if (grid[n.r][n.c]) {
                fireTargets.push(n);
            }
        }
        popBubbles(fireTargets);
        totalPopped = fireTargets.length;
        score += Math.floor(totalPopped * 15 * comboMultiplier);
        activePowerUp = null;
        updatePowerUpUI();
        wasSuccessfulMatch = true;
        incrementDailyStat('specialUsed');
    }
    // Handle special bubble effects
    else if (type === BUBBLE_BOMB) {
        // Bomb: Explode all bubbles in a radius
        const bombTargets = [];
        for (let dr = -bombRadius; dr <= bombRadius; dr++) {
            for (let dc = -bombRadius; dc <= bombRadius; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc]) {
                    bombTargets.push({ r: nr, c: nc });
                }
            }
        }
        popBubblesChain(bombTargets);
        totalPopped = bombTargets.length;
        score += Math.floor(totalPopped * 15 * comboMultiplier);
        wasSuccessfulMatch = true;
        incrementDailyStat('specialUsed');

    } else if (type === BUBBLE_RAINBOW) {
        // Rainbow: Clear ALL bubbles of the matched color
        const colorTargets = [];
        for (let gr = 0; gr < GRID_ROWS; gr++) {
            for (let gc = 0; gc < GRID_COLS; gc++) {
                if (grid[gr][gc] && grid[gr][gc].color === color) {
                    colorTargets.push({ r: gr, c: gc });
                }
            }
        }
        popBubblesChain(colorTargets);
        totalPopped = colorTargets.length;
        score += Math.floor(totalPopped * 20 * comboMultiplier);
        wasSuccessfulMatch = true;
        incrementDailyStat('specialUsed');

        // Check if we cleared ALL of a color (for achievement)
        let colorStillExists = false;
        for (let gr = 0; gr < GRID_ROWS; gr++) {
            for (let gc = 0; gc < GRID_COLS; gc++) {
                if (grid[gr][gc] && grid[gr][gc].color === color) {
                    colorStillExists = true;
                    break;
                }
            }
        }
        if (!colorStillExists && totalPopped > 0) {
            stats.colorClears++;
        }

    } else {
        // Normal bubble - standard match-3 logic
        const matches = findMatches(r, c, color);

        if (matches.length >= 3) {
            popBubblesChain(matches);
            totalPopped = matches.length;
            score += Math.floor(matches.length * 10 * comboMultiplier);
            wasSuccessfulMatch = true;
        } else {
            // Miss - reset combo
            updateCombo(false);

            // Handle freeze power-up
            if (freezeShots > 0) {
                freezeShots--;
                if (freezeShots === 0) {
                    activePowerUp = null;
                    updatePowerUpUI();
                }
                // No row added while frozen
            } else {
                misses++;
                if (misses >= maxMisses) {
                    addRow();
                    misses = 0;
                }
            }
            updateMissIndicator();
            checkGameOver();
            return;
        }
    }

    // Update combo on successful match
    if (wasSuccessfulMatch) {
        updateCombo(true);
    }

    // Check for floating clusters after any pop
    const floating = findFloatingClusters();
    dropBubbles(floating);
    score += Math.floor(floating.length * 20 * comboMultiplier);
    totalPopped += floating.length;

    // Track bubbles popped for daily challenge
    for (let i = 0; i < totalPopped; i++) {
        incrementDailyStat('bubblesPopped');
    }

    // Screen shake on big clears
    if (totalPopped >= 10) {
        triggerScreenShake(8);
        // Award power-up for big clears
        if (Math.random() < 0.5) {
            awardPowerUp();
        }
    }

    // Level progression
    const oldLevel = level;
    bubblesCleared += totalPopped;
    if (bubblesCleared >= BUBBLES_PER_LEVEL) {
        level++;
        bubblesCleared = 0;

        // Confetti celebration on level up!
        spawnConfetti();
        addFloatingText(`LEVEL ${level}!`, GAME_WIDTH / 2, GAME_HEIGHT / 3, '#FFD700');

        // Update daily challenge for level tracking
        updateDailyChallenge('maxLevel', level);
    }

    updateUI();
    checkBoardClear();
    checkGameOver();
    checkAchievements();
}

function checkBoardClear() {
    let hasBubbles = false;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c]) { hasBubbles = true; break; }
        }
    }
    if (!hasBubbles) {
        if (isSecretLevel) {
            // SECRET LEVEL VICTORY!
            coins += SECRET_LEVEL_REWARD;
            secretLevelLastCompleted = Date.now();
            score += 5000; // Big bonus for secret level clear

            // Reset secret level state
            isSecretLevel = false;
            maxMisses = 5;
            if (ownedItems.includes('extra_life')) maxMisses = 6;
            if (ownedItems.includes('slow_motion')) maxMisses = 8;

            savePlayerData();

            // Show victory screen
            isGameOver = true;
            document.getElementById('final-score').textContent = score;
            document.getElementById('coins-earned').textContent = SECRET_LEVEL_REWARD;
            document.getElementById('new-high').textContent = '🎉 SECRET LEVEL COMPLETE! 🎉';
            document.getElementById('new-high').style.display = 'block';
            document.getElementById('ui-layer').classList.add('hidden');
            document.getElementById('game-over-screen').classList.remove('hidden');
        } else {
            // BASS DROP! Board cleared - massive celebration
            triggerScreenShake(20); // Big shake
            triggerScreenFlash(); // Flash effect
            spawnConfetti(); // Lots of confetti
            spawnConfetti(); // Double confetti!
            addFloatingText('BOARD CLEAR!', GAME_WIDTH / 2, GAME_HEIGHT / 3, '#FFD700');

            // Track for achievements
            stats.boardClears++;
            incrementDailyStat('boardClears');

            score += 1000;
            initGrid();
        }
    }
}

function getNeighbors(r, c) {
    const neighbors = [];
    const isOdd = r % 2 === 1;

    const directions = isOdd ?
        [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] :
        [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];

    for (let dir of directions) {
        const nr = r + dir[0];
        const nc = c + dir[1];

        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            neighbors.push({ r: nr, c: nc });
        }
    }
    return neighbors;
}

function findMatches(startR, startC, color) {
    const matches = [];
    const queue = [{ r: startR, c: startC }];
    const visited = new Set();
    visited.add(`${startR},${startC}`);

    matches.push({ r: startR, c: startC });

    while (queue.length > 0) {
        const { r, c } = queue.shift();
        const neighbors = getNeighbors(r, c);

        for (let n of neighbors) {
            const key = `${n.r},${n.c}`;
            if (!visited.has(key) && grid[n.r][n.c] && grid[n.r][n.c].color === color && !grid[n.r][n.c].popping) {
                visited.add(key);
                matches.push(n);
                queue.push(n);
            }
        }
    }
    return matches;
}

function findFloatingClusters() {
    const connected = new Set();
    const queue = [];

    for (let c = 0; c < GRID_COLS; c++) {
        if (grid[0][c] && !grid[0][c].popping) {
            queue.push({ r: 0, c: c });
            connected.add(`0,${c}`);
        }
    }

    while (queue.length > 0) {
        const { r, c } = queue.shift();
        const neighbors = getNeighbors(r, c);

        for (let n of neighbors) {
            const key = `${n.r},${n.c}`;
            if (grid[n.r][n.c] && !grid[n.r][n.c].popping && !connected.has(key)) {
                connected.add(key);
                queue.push(n);
            }
        }
    }

    const floating = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && !grid[r][c].popping) {
                if (!connected.has(`${r},${c}`)) {
                    floating.push({ r: r, c: c });
                }
            }
        }
    }
    return floating;
}

function popBubbles(locations) {
    for (let loc of locations) {
        const b = grid[loc.r][loc.c];
        if (b) {
            b.popping = true;
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(b.x, b.y, b.color));
            }
        }
        grid[loc.r][loc.c] = null;
    }
}

function dropBubbles(locations) {
    for (let loc of locations) {
        const b = grid[loc.r][loc.c];
        if (b) {
            b.dropping = true;
            b.vx = (Math.random() - 0.5) * 5;
            b.vy = -Math.random() * 5;
            grid[loc.r][loc.c] = null;
            particles.push({
                update: (dt) => {
                    b.update(dt);
                    if (b.y > GAME_HEIGHT + 100) return false;
                    return true;
                },
                draw: (ctx) => b.draw(ctx)
            });
        }
    }
}

function addRow() {
    for (let c = 0; c < GRID_COLS; c++) {
        if (grid[GRID_ROWS - 1][c]) {
            doGameOver();
            return;
        }
    }

    for (let r = GRID_ROWS - 1; r > 0; r--) {
        for (let c = 0; c < GRID_COLS; c++) {
            grid[r][c] = grid[r - 1][c];
            if (grid[r][c]) {
                grid[r][c].r = r;
            }
        }
    }

    for (let c = 0; c < GRID_COLS; c++) {
        grid[0][c] = new Bubble(0, c, getRandomColor());
    }

    checkGameOver();
}

function checkGameOver() {
    const dangerRow = GRID_ROWS - 2;

    for (let r = dangerRow; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] && !grid[r][c].dropping && !grid[r][c].popping) {
                doGameOver();
                return;
            }
        }
    }
}

function doGameOver() {
    isGameOver = true;

    // Calculate coins earned (1 coin per 100 points, minimum 1)
    let coinsEarned = Math.max(1, Math.floor(score / 100));
    if (ownedItems.includes('coin_magnet')) {
        coinsEarned = Math.floor(coinsEarned * 1.5);
    }
    coins += coinsEarned;

    // Check for high score (only for normal mode)
    const isNewHigh = !isSecretLevel && score > highScore;
    if (isNewHigh) {
        highScore = score;
    }

    // Update max level reached (only for normal mode)
    if (!isSecretLevel && level > maxLevelReached) {
        maxLevelReached = level;
    }

    // Update best score for the level that was played (only for normal mode)
    if (!isSecretLevel && score > 0) {
        const currentBest = levelScores[startingLevel] || 0;
        if (score > currentBest) {
            levelScores[startingLevel] = score;
        }
    }

    // Reset secret level mode and restore upgrades
    if (isSecretLevel) {
        isSecretLevel = false;
        // Restore maxMisses based on owned items
        maxMisses = 5;
        if (ownedItems.includes('extra_life')) maxMisses = 6;
        if (ownedItems.includes('slow_motion')) maxMisses = 8;
    }

    savePlayerData();

    // Update UI
    document.getElementById('final-score').textContent = score;
    document.getElementById('coins-earned').textContent = coinsEarned;
    document.getElementById('new-high').style.display = isNewHigh ? 'block' : 'none';
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('coins-display').textContent = coins;
    updateTheme();
}

function updateTheme() {
    const body = document.body;
    body.classList.remove('theme-sky', 'theme-moon', 'theme-galaxy');

    if (level >= 40) {
        body.classList.add('theme-galaxy');
    } else if (level >= 20) {
        body.classList.add('theme-moon');
    } else {
        body.classList.add('theme-sky');
    }
}

function updateMissIndicator() {
    const container = document.getElementById('misses-indicator');
    container.innerHTML = '';
    for (let i = 0; i < maxMisses; i++) {
        const dot = document.createElement('div');
        dot.className = 'miss-dot' + (i < misses ? ' active' : '');
        container.appendChild(dot);
    }
}

function drawMissIndicator() {
    updateMissIndicator();
}

// Main Loop
function update(dt) {
    // Apply timeScale for slow-mo effect
    dt *= timeScale;

    // Update screen shake decay
    if (screenShakeAmount > 0) {
        screenShakeAmount *= 0.9;
        if (screenShakeAmount < 0.5) screenShakeAmount = 0;
    }

    // Update wobble time decay
    if (wobbleTime > 0) {
        wobbleTime -= dt * 3;
        if (wobbleTime < 0) wobbleTime = 0;
    }

    // Update screen flash decay
    if (screenFlashAlpha > 0) {
        screenFlashAlpha -= dt * 3;
        if (screenFlashAlpha < 0) screenFlashAlpha = 0;
    }

    // Update trail particles
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        trailParticles[i].update(dt);
        if (trailParticles[i].life <= 0) trailParticles.splice(i, 1);
    }

    // Update background particles (always, even when paused for visual effect)
    for (const bp of backgroundParticles) {
        bp.update(dt);
    }

    // Update floating texts (always)
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update(dt);
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }

    // Update confetti (always)
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
        confettiParticles[i].update(dt);
        if (confettiParticles[i].life <= 0) confettiParticles.splice(i, 1);
    }

    if (isGameOver || isPaused) {
        return;
    }

    if (isShooting && currentBubble instanceof Projectile) {
        currentBubble.update(dt);

        const checkRadius = TILE_WIDTH * 1.5;
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const b = grid[r][c];
                if (b && !b.popping && !b.dropping) {
                    const dist = Math.hypot(currentBubble.x - b.x, currentBubble.y - b.y);
                    if (dist < RADIUS * 2) {
                        currentBubble.snapToGrid();
                        r = GRID_ROWS;
                        c = GRID_COLS;
                    }
                }
            }
        }
    }

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c]) grid[r][c].update(dt);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.life !== undefined) {
            p.update(dt);
            if (p.life <= 0) particles.splice(i, 1);
        } else {
            const alive = p.update(dt);
            if (!alive) particles.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply screen shake
    ctx.save();
    if (screenShakeAmount > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeAmount;
        const shakeY = (Math.random() - 0.5) * screenShakeAmount;
        ctx.translate(shakeX, shakeY);
    }

    // Draw background particles first
    for (const bp of backgroundParticles) {
        bp.draw(ctx);
    }

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c]) grid[r][c].draw(ctx);
        }
    }

    for (let p of particles) {
        p.draw(ctx);
    }

    // Draw trail particles (sparkle trails)
    for (const tp of trailParticles) {
        tp.draw(ctx);
    }

    if (!isGameOver) {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT - RADIUS * 2;

        if (isShooting && currentBubble) {
            currentBubble.draw(ctx);
        } else if (nextBubble) {
            ctx.save();
            ctx.translate(cx, cy);

            ctx.beginPath();
            ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = nextBubble.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-RADIUS * 0.3, -RADIUS * 0.3, RADIUS * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();

            ctx.restore();
        }

        let angle = currentAngle;

        // Draw aim guide line with BOUNCE PREVIEW
        if (!isShooting) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);

            // Simulate trajectory with bounces
            let simX = cx;
            let simY = cy;
            let simVX = Math.cos(angle);
            let simVY = Math.sin(angle);
            const maxPoints = 200;
            const stepSize = 5;

            ctx.beginPath();
            ctx.moveTo(simX, simY);

            for (let i = 0; i < maxPoints; i++) {
                simX += simVX * stepSize;
                simY += simVY * stepSize;

                // Wall bounce
                if (simX < RADIUS) {
                    simX = RADIUS;
                    simVX *= -1;
                } else if (simX > GAME_WIDTH - RADIUS) {
                    simX = GAME_WIDTH - RADIUS;
                    simVX *= -1;
                }

                // Stop at ceiling or if going too far
                if (simY < RADIUS * 2 || simY > cy) {
                    ctx.lineTo(simX, simY);
                    break;
                }

                // Check collision with existing bubbles
                let hitBubble = false;
                for (let r = 0; r < GRID_ROWS && !hitBubble; r++) {
                    for (let c = 0; c < GRID_COLS && !hitBubble; c++) {
                        const b = grid[r][c];
                        if (b && !b.popping && !b.dropping) {
                            const dist = Math.hypot(simX - b.x, simY - b.y);
                            if (dist < RADIUS * 2) {
                                hitBubble = true;
                            }
                        }
                    }
                }

                if (hitBubble) {
                    ctx.lineTo(simX, simY);
                    // Draw landing indicator circle
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(simX, simY, RADIUS, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.setLineDash([]);
                    ctx.stroke();
                    break;
                }

                ctx.lineTo(simX, simY);
            }

            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.fillStyle = '#eee';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.rect(0, -5, 60, 10);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        const dangerY = (GRID_ROWS - 2) * ROW_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(0, dangerY);
        ctx.lineTo(GAME_WIDTH, dangerY);
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.2)';
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw floating texts
    for (const ft of floatingTexts) {
        ft.draw(ctx);
    }

    // Draw confetti
    for (const c of confettiParticles) {
        c.draw(ctx);
    }

    // Draw screen flash overlay (for bass drop effect)
    if (screenFlashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${screenFlashAlpha})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Restore from screen shake
    ctx.restore();
}

function loop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!isPaused) {
        update(dt);
    }
    draw();

    animationId = requestAnimationFrame(loop);
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');

    resize();
    initGrid();
    initBackgroundParticles();

    score = 0;
    misses = 0;
    level = startingLevel; // Use selected level
    bubblesCleared = 0;
    isGameOver = false;
    isShooting = false;
    particles = [];
    floatingTexts = [];
    confettiParticles = [];
    comboCount = 0;
    comboMultiplier = 1;
    activePowerUp = null;
    freezeShots = 0;
    currentAngle = -Math.PI / 2;
    nextBubble = getNextBubble();

    updateUI();
    updateMissIndicator();
    updatePowerUpUI();
    updateComboUI();

    if (animationId) cancelAnimationFrame(animationId);
    lastTime = performance.now();
    console.log('Starting loop with lastTime:', lastTime);
    loop(lastTime);
}

// Init
resize();
loadPlayerData();
showScreen('main-menu');
// Initial draw to show something on background (optional)
initGrid();
draw();
