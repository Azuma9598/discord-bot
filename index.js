require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    Collection, 
    Events, 
    Partials,
    ActivityType,
    Colors,
    codeBlock
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const crypto = require('crypto');
const axios = require('axios');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// ==================== CONFIGURATION ====================
const CONFIG = {
    ALLOWED_ROLE_ID: '1432773041640706149',
    ADMIN_ROLE_ID: '1432773041640706149',
    LOG_CHANNEL_ID: '1432780520571539558',
    WELCOME_CHANNEL_ID: '1432780520571539558',
    REPORT_CHANNEL_ID: '1432780520571539558',
    SUGGESTION_CHANNEL_ID: '1432780520571539558',
    TICKET_CATEGORY_ID: '1432780520571539558',
    BACKUP_INTERVAL: 3600000, // 1 hour
    ECONOMY: {
        DAILY_REWARD: 100,
        WEEKLY_REWARD: 750,
        MONTHLY_REWARD: 3000,
        WORK_MIN: 50,
        WORK_MAX: 200,
        CRIME_SUCCESS_RATE: 0.7,
        CRIME_REWARD: 500,
        CRIME_PENALTY: 300,
        SLOT_MIN_BET: 10,
        SLOT_MAX_BET: 1000,
        LOTTERY_TICKET_PRICE: 100,
        LOTTERY_PRIZE_POOL: 0.8 // 80% of ticket sales
    },
    LEVELS: {
        BASE_XP: 100,
        XP_MULTIPLIER: 1.5,
        COOLDOWN: 60, // seconds
        VOICE_XP_PER_MINUTE: 10,
        MESSAGE_XP_MIN: 15,
        MESSAGE_XP_MAX: 25
    },
    MODERATION: {
        WARN_EXPIRE_DAYS: 30,
        MAX_WARNS: 3,
        MUTE_DURATIONS: {
            1: 3600000, // 1 hour
            2: 21600000, // 6 hours
            3: 86400000 // 24 hours
        },
        AUTO_MOD: {
            SPAM_THRESHOLD: 5,
            SPAM_WINDOW: 5000,
            BAD_WORDS: ['badword1', 'badword2', 'badword3'],
            LINKS: ['discord.gg', 'bit.ly', 'tinyurl'],
            MENTION_LIMIT: 5
        }
    },
    GAMES: {
        HANGMAN_WORD_LIST: ['javascript', 'discord', 'programming', 'developer', 'nodejs', 'typescript', 'python', 'java', 'golang', 'rust'],
        TRIVIA_QUESTIONS: [
            {
                question: "What is the capital of France?",
                options: ["London", "Berlin", "Paris", "Madrid"],
                answer: 2
            },
            {
                question: "Which planet is known as the Red Planet?",
                options: ["Venus", "Mars", "Jupiter", "Saturn"],
                answer: 1
            },
            {
                question: "What is the largest mammal in the world?",
                options: ["Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
                answer: 1
            }
        ],
        RPS_WIN_CONDITIONS: {
            'rock': 'scissors',
            'paper': 'rock',
            'scissors': 'paper'
        }
    }
};

// ==================== ADVANCED LOGGING ====================
const logDir = 'logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880,
            maxFiles: 10
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// ==================== EXPRESS SERVER ====================
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dashboard routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bot Dashboard</title>
            <style>
                body { font-family: Arial; margin: 0; padding: 20px; background: #2c2f33; color: white; }
                .container { max-width: 1200px; margin: 0 auto; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
                .stat-card { background: #23272a; padding: 20px; border-radius: 10px; }
                .stat-card h3 { margin-top: 0; color: #7289da; }
                .stat-value { font-size: 2em; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Bot Dashboard</h1>
                <div class="stats">
                    <div class="stat-card">
                        <h3>Uptime</h3>
                        <div class="stat-value" id="uptime">Loading...</div>
                    </div>
                    <div class="stat-card">
                        <h3>Memory Usage</h3>
                        <div class="stat-value" id="memory">Loading...</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Users</h3>
                        <div class="stat-value" id="users">Loading...</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Servers</h3>
                        <div class="stat-value" id="servers">Loading...</div>
                    </div>
                </div>
            </div>
            <script>
                async function updateStats() {
                    const res = await fetch('/api/stats');
                    const data = await res.json();
                    document.getElementById('uptime').textContent = data.uptime;
                    document.getElementById('memory').textContent = data.memory;
                    document.getElementById('users').textContent = data.users.toLocaleString();
                    document.getElementById('servers').textContent = data.servers;
                }
                updateStats();
                setInterval(updateStats, 5000);
            </script>
        </body>
        </html>
    `);
});

app.get('/api/stats', (req, res) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        uptime: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        users: client?.users?.cache?.size || 0,
        servers: client?.guilds?.cache?.size || 0
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`🌐 Web server running on port ${PORT}`);
});

// ==================== DISCORD CLIENT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.AutoModerationConfiguration,
        GatewayIntentBits.AutoModerationExecution
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
        Partials.ThreadMember
    ]
});

// ==================== DATABASE SYSTEM ====================
class Database {
    constructor() {
        this.data = {
            users: {},
            guilds: {},
            economy: {},
            levels: {},
            warnings: {},
            tickets: {},
            polls: {},
            reminders: {},
            inventory: {},
            marriages: {},
            shop: {},
            games: {},
            logs: {},
            backups: {}
        };
        this.load();
        this.setupAutoSave();
    }

    load() {
        const files = [
            'users.json', 'guilds.json', 'economy.json', 'levels.json',
            'warnings.json', 'tickets.json', 'polls.json', 'reminders.json',
            'inventory.json', 'marriages.json', 'shop.json', 'games.json',
            'logs.json', 'backups.json'
        ];

        files.forEach(file => {
            const filePath = path.join('data', file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const key = file.replace('.json', '');
                    this.data[key] = JSON.parse(content);
                } catch (error) {
                    logger.error(`Error loading ${file}:`, error);
                }
            }
        });
    }

    save() {
        if (!fs.existsSync('data')) fs.mkdirSync('data');
        
        Object.keys(this.data).forEach(key => {
            const filePath = path.join('data', `${key}.json`);
            try {
                fs.writeFileSync(filePath, JSON.stringify(this.data[key], null, 2));
            } catch (error) {
                logger.error(`Error saving ${key}:`, error);
            }
        });
    }

    setupAutoSave() {
        setInterval(() => this.save(), 300000); // Save every 5 minutes
    }

    backup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join('backups', timestamp);
        if (!fs.existsSync('backups')) fs.mkdirSync('backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

        Object.keys(this.data).forEach(key => {
            const filePath = path.join(backupDir, `${key}.json`);
            fs.writeFileSync(filePath, JSON.stringify(this.data[key], null, 2));
        });

        logger.info(`Backup created: ${backupDir}`);
    }

    // User management
    getUser(userId) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {
                id: userId,
                createdAt: Date.now(),
                lastSeen: Date.now(),
                messages: 0,
                commands: 0,
                settings: {
                    timezone: 'Asia/Bangkok',
                    language: 'th',
                    notifications: true,
                    privacy: 'public'
                }
            };
        }
        return this.data.users[userId];
    }

    updateUser(userId, data) {
        const user = this.getUser(userId);
        Object.assign(user, data);
        this.data.users[userId] = user;
        return user;
    }

    // Economy system
    getEconomy(userId) {
        if (!this.data.economy[userId]) {
            this.data.economy[userId] = {
                balance: 0,
                bank: 0,
                dailyStreak: 0,
                lastDaily: 0,
                lastWeekly: 0,
                lastMonthly: 0,
                lastWork: 0,
                lastCrime: 0,
                transactions: [],
                netWorth: 0
            };
        }
        return this.data.economy[userId];
    }

    addMoney(userId, amount, type = 'balance') {
        const economy = this.getEconomy(userId);
        economy[type] += amount;
        economy.netWorth = economy.balance + economy.bank;
        
        economy.transactions.push({
            id: uuidv4(),
            amount,
            type: type === 'balance' ? 'cash' : 'bank',
            timestamp: Date.now(),
            description: 'Manual addition'
        });

        if (economy.transactions.length > 100) {
            economy.transactions = economy.transactions.slice(-100);
        }

        return economy[type];
    }

    // Leveling system
    getLevel(userId) {
        if (!this.data.levels[userId]) {
            this.data.levels[userId] = {
                xp: 0,
                level: 1,
                totalXp: 0,
                messages: 0,
                voiceMinutes: 0,
                lastMessage: 0,
                lastVoice: 0,
                rank: 0
            };
        }
        return this.data.levels[userId];
    }

    addXp(userId, xp) {
        const levelData = this.getLevel(userId);
        levelData.xp += xp;
        levelData.totalXp += xp;

        const requiredXp = this.calculateRequiredXp(levelData.level);
        if (levelData.xp >= requiredXp) {
            levelData.level++;
            levelData.xp -= requiredXp;
            return { leveledUp: true, newLevel: levelData.level };
        }

        return { leveledUp: false };
    }

    calculateRequiredXp(level) {
        return Math.floor(CONFIG.LEVELS.BASE_XP * Math.pow(CONFIG.LEVELS.XP_MULTIPLIER, level - 1));
    }

    // Warning system
    addWarning(userId, guildId, reason, moderatorId) {
        if (!this.data.warnings[guildId]) this.data.warnings[guildId] = {};
        if (!this.data.warnings[guildId][userId]) this.data.warnings[guildId][userId] = [];

        const warning = {
            id: uuidv4(),
            userId,
            guildId,
            reason,
            moderatorId,
            timestamp: Date.now(),
            expires: Date.now() + (CONFIG.MODERATION.WARN_EXPIRE_DAYS * 86400000)
        };

        this.data.warnings[guildId][userId].push(warning);
        return warning;
    }

    getWarnings(userId, guildId) {
        return this.data.warnings[guildId]?.[userId] || [];
    }

    // Shop system
    initShop() {
        if (!this.data.shop.items) {
            this.data.shop.items = [
                {
                    id: 1,
                    name: "VIP Pass",
                    description: "Get VIP status for 30 days",
                    price: 5000,
                    type: "role",
                    roleId: CONFIG.ALLOWED_ROLE_ID,
                    duration: 2592000000, // 30 days
                    stock: -1 // Unlimited
                },
                {
                    id: 2,
                    name: "Custom Color",
                    description: "Get a custom role color",
                    price: 3000,
                    type: "color",
                    stock: 10
                },
                {
                    id: 3,
                    name: "Profile Badge",
                    description: "Show off your badge",
                    price: 1000,
                    type: "badge",
                    badge: "premium",
                    stock: -1
                }
            ];
        }
    }

    // Inventory system
    getInventory(userId) {
        if (!this.data.inventory[userId]) {
            this.data.inventory[userId] = {
                items: [],
                badges: [],
                cosmetics: {},
                storage: {}
            };
        }
        return this.data.inventory[userId];
    }

    addItem(userId, itemId, quantity = 1) {
        const inventory = this.getInventory(userId);
        const existingItem = inventory.items.find(item => item.id === itemId);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            inventory.items.push({ id: itemId, quantity });
        }
    }

    // Game data
    getGameData(userId, game) {
        if (!this.data.games[game]) this.data.games[game] = {};
        if (!this.data.games[game][userId]) {
            this.data.games[game][userId] = {
                wins: 0,
                losses: 0,
                draws: 0,
                streak: 0,
                highestStreak: 0,
                played: 0,
                rating: 1000
            };
        }
        return this.data.games[game][userId];
    }
}

const db = new Database();

// ==================== MEMORY SYSTEM ====================
class MemorySystem {
    constructor() {
        this.memories = new Map();
        this.conversations = new Map();
        this.loadMemories();
    }

    loadMemories() {
        if (fs.existsSync('memories.json')) {
            const data = JSON.parse(fs.readFileSync('memories.json', 'utf8'));
            this.memories = new Map(Object.entries(data));
        }
    }

    saveMemories() {
        const obj = Object.fromEntries(this.memories);
        fs.writeFileSync('memories.json', JSON.stringify(obj, null, 2));
    }

    getUserMemory(userId) {
        if (!this.memories.has(userId)) {
            this.memories.set(userId, {
                affinity: 0,
                mood: 'neutral',
                personality: {},
                preferences: {},
                history: [],
                lastInteraction: Date.now(),
                conversationContext: '',
                memoryBank: []
            });
        }
        return this.memories.get(userId);
    }

    updateUserMemory(userId, updates) {
        const memory = this.getUserMemory(userId);
        Object.assign(memory, updates);
        memory.lastInteraction = Date.now();
        
        // Keep only last 100 interactions
        if (memory.history.length > 100) {
            memory.history = memory.history.slice(-100);
        }

        this.memories.set(userId, memory);
        this.saveMemories();
        return memory;
    }

    addConversation(userId, message, response) {
        const memory = this.getUserMemory(userId);
        memory.history.push({
            timestamp: Date.now(),
            message,
            response,
            mood: memory.mood
        });
        memory.conversationContext = this.extractContext(message, response);
    }

    extractContext(message, response) {
        // Simple context extraction
        const keywords = ['you', 'me', 'we', 'they', 'he', 'she', 'it'];
        const words = [...message.toLowerCase().split(' '), ...response.toLowerCase().split(' ')];
        return words.filter(word => keywords.includes(word)).join(' ');
    }

    getConversationSummary(userId) {
        const memory = this.getUserMemory(userId);
        return {
            totalInteractions: memory.history.length,
            lastInteraction: new Date(memory.lastInteraction).toLocaleString(),
            currentMood: memory.mood,
            affinityLevel: this.getAffinityLevel(memory.affinity)
        };
    }

    getAffinityLevel(affinity) {
        if (affinity >= 100) return 'Soulmate';
        if (affinity >= 50) return 'Best Friend';
        if (affinity >= 20) return 'Friend';
        if (affinity >= 0) return 'Acquaintance';
        if (affinity >= -20) return 'Neutral';
        if (affinity >= -50) return 'Disliked';
        return 'Hated';
    }
}

const memorySystem = new MemorySystem();

// ==================== TOKYO GHOUL SYSTEM ====================
class TokyoGhoulSystem {
    constructor() {
        this.quotes = [
            "ผมไม่ใช่พระเอกในนิยายอะไรหรอก ผมแค่นักศึกษาที่ชอบอ่านหนังสือ เหมือนคนทั่วไป",
            "โลกนี้มันผิดพลาด... มันเต็มไปด้วยความขัดแย้ง",
            "ถ้าผมกินมนุษย์ ผมก็จะกลายเป็นปีศาจ แต่ถ้าผมไม่กิน ผมก็จะตาย",
            "ความเจ็บปวดคือสิ่งที่ทำให้เราเติบโต",
            "ผมแค่ต้องการสถานที่ที่ผมจะอยู่ได้อย่างสงบ",
            "มนุษย์กับกูล... เราต่างก็เป็นสัตว์ประหลาดในสายตาของกันและกัน",
            "การต่อสู้คือการเอาชีวิตรอด",
            "ผมจะไม่ยอมแพ้... ไม่ว่าอะไรจะเกิดขึ้น",
            "ความอ่อนแอคือบาป",
            "โลกนี้มันโหดร้าย... แต่ก็สวยงาม",
            "ฉันจะปกป้องทุกสิ่งที่สำคัญสำหรับฉัน",
            "บางครั้งการหนีก็ไม่ใช่ความอ่อนแอ",
            "ความทรงจำคือสิ่งที่ทำให้เราเป็นเรา",
            "ฉันจะก้าวไปข้างหน้า ไม่ว่าจะเจ็บแค่ไหน",
            "แสงสว่างมักจะมาพร้อมกับความมืด",
            "การสูญเสียคือบทเรียนที่เจ็บปวดที่สุด",
            "ฉันจะไม่ปล่อยให้ใครมาตัดสินฉัน",
            "ความจริงมักจะโหดร้ายกว่าความฝัน",
            "ทุกการเลือกมีผลลัพธ์ของมัน",
            "ฉันจะค้นหาความหมายของการมีชีวิตอยู่"
        ];

        this.characters = {
            kaneki: {
                name: "Ken Kaneki",
                description: "นักศึกษาที่กลายเป็นกูล",
                personality: ["ฉลาด", "ใจดี", "ต่อสู้", "เศร้า", "เด็ดเดี่ยว"],
                abilities: ["Kagune", "Regeneration", "Enhanced Strength"]
            },
            touka: {
                name: "Touka Kirishima",
                description: "กูลสาวผู้แข็งแกร่ง",
                personality: ["แข็งแกร่ง", "อารมณ์ร้อน", "ปกป้องเพื่อน", "ซ่อนอ่อนโยน"],
                abilities: ["Ukaku Kagune", "Speed", "Combat Skills"]
            },
            hide: {
                name: "Hideyoshi Nagachika",
                description: "เพื่อนสนิทของคาเนะกิ",
                personality: ["ร่าเริง", "ซื่อสัตย์", "ฉลาด", "เป็นมิตร"],
                abilities: ["Investigation", "Loyalty", "Support"]
            }
        };

        this.storylines = [
            {
                id: 1,
                title: "การเปลี่ยนผ่าน",
                description: "วันแรกที่กลายเป็นกูล",
                chapters: 10,
                difficulty: "ง่าย"
            },
            {
                id: 2,
                title: "การฝึกฝน",
                description: "เรียนรู้การใช้พลัง",
                chapters: 15,
                difficulty: "ปานกลาง"
            },
            {
                id: 3,
                title: "การเผชิญหน้า",
                description: "พบกับศัตรูที่แท้จริง",
                chapters: 20,
                difficulty: "ยาก"
            }
        ];
    }

    getRandomQuote() {
        return this.quotes[Math.floor(Math.random() * this.quotes.length)];
    }

    getCharacterInfo(name) {
        return this.characters[name.toLowerCase()] || null;
    }

    getStoryline(id) {
        return this.storylines.find(story => story.id === id) || null;
    }

    generateQuest(userLevel) {
        const quests = [
            {
                title: "ล่าผู้ร้าย",
                description: "ตามล่ากูลที่โหดร้าย",
                reward: 100 * userLevel,
                difficulty: Math.min(5, Math.ceil(userLevel / 2)),
                timeLimit: 3600000 // 1 hour
            },
            {
                title: "ปกป้องมนุษย์",
                description: "ปกป้องมนุษย์จากกูล",
                reward: 150 * userLevel,
                difficulty: Math.min(5, Math.ceil(userLevel / 1.5)),
                timeLimit: 7200000 // 2 hours
            },
            {
                title: "ค้นหาความจริง",
                description: "สืบสวนความลับของ CCG",
                reward: 200 * userLevel,
                difficulty: Math.min(5, userLevel),
                timeLimit: 10800000 // 3 hours
            }
        ];

        return quests[Math.floor(Math.random() * quests.length)];
    }
}

const tokyoGhoul = new TokyoGhoulSystem();

// ==================== CLAUDE AI INTEGRATION ====================
class ClaudeAI {
    constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY;
        this.model = 'claude-3-sonnet-20240229';
        this.maxTokens = 1000;
        this.temperature = 0.7;
    }

    async generateResponse(prompt, context = {}) {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                    system: this.createSystemPrompt(context),
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data.content[0].text;
        } catch (error) {
            logger.error('Claude AI Error:', error);
            return "ขอโทษครับ ฉันไม่สามารถตอบได้ในตอนนี้";
        }
    }

    createSystemPrompt(context) {
        const { mood, affinity, personality } = context;
        
        return `คุณคือ Ken Kaneki จากเรื่อง Tokyo Ghoul 
สถานะอารมณ์: ${mood || 'neutral'}
ระดับความสัมพันธ์: ${affinity || 0}
บุคลิก: ปากแข็ง แต่แคร์ผู้อื่น, ฉลาด, ซับซ้อน, มีความลึก
สไตล์การพูด: สั้น กระชับ เบี้ยว โหด แต่แฝงด้วยความห่วงใย
ตอบกลับเป็นภาษาไทยตามสไตล์ของคาเนะกิ
แสดงอารมณ์ด้วย -#อารมณ์ ที่ท้ายข้อความ`;
    }

    async analyzeSentiment(text) {
        const prompt = `Analyze the sentiment of this Thai text: "${text}"
        Return JSON format: {"sentiment": "positive|negative|neutral", "intensity": 0-1, "keywords": []}`;

        try {
            const response = await this.generateResponse(prompt);
            return JSON.parse(response);
        } catch (error) {
            return { sentiment: 'neutral', intensity: 0.5, keywords: [] };
        }
    }
}

const claudeAI = new ClaudeAI();

// ==================== ECONOMY SYSTEM ====================
class EconomySystem {
    constructor() {
        this.jobs = [
            { name: "โปรแกรมเมอร์", salary: { min: 150, max: 300 }, cooldown: 3600000 },
            { name: "นักออกแบบ", salary: { min: 120, max: 250 }, cooldown: 3600000 },
            { name: "ครีเอเตอร์", salary: { min: 100, max: 200 }, cooldown: 3600000 },
            { name: "เทรดเดอร์", salary: { min: 200, max: 500 }, cooldown: 7200000, risk: 0.3 },
            { name: "นักเขียน", salary: { min: 80, max: 180 }, cooldown: 3600000 }
        ];

        this.stocks = {};
        this.initStocks();
    }

    initStocks() {
        this.stocks = {
            'TECH': { price: 100, volatility: 0.1 },
            'FOOD': { price: 50, volatility: 0.05 },
            'ENT': { price: 75, volatility: 0.08 },
            'MED': { price: 120, volatility: 0.07 },
            'AUTO': { price: 60, volatility: 0.06 }
        };
    }

    updateStockPrices() {
        Object.keys(this.stocks).forEach(symbol => {
            const stock = this.stocks[symbol];
            const change = (Math.random() - 0.5) * 2 * stock.volatility;
            stock.price = Math.max(1, stock.price * (1 + change));
            stock.history = stock.history || [];
            stock.history.push({
                price: stock.price,
                timestamp: Date.now()
            });
            if (stock.history.length > 100) stock.history = stock.history.slice(-100);
        });
    }

    async work(userId, jobIndex) {
        const userEco = db.getEconomy(userId);
        const now = Date.now();
        
        if (now - userEco.lastWork < 3600000) {
            const cooldown = Math.ceil((3600000 - (now - userEco.lastWork)) / 60000);
            return { success: false, message: `รออีก ${cooldown} นาที` };
        }

        if (jobIndex < 0 || jobIndex >= this.jobs.length) {
            return { success: false, message: "ไม่มีงานนี้" };
        }

        const job = this.jobs[jobIndex];
        const salary = Math.floor(Math.random() * (job.salary.max - job.salary.min + 1)) + job.salary.min;
        
        if (job.risk && Math.random() < job.risk) {
            return { success: false, message: "งานล้มเหลว! ไม่ได้เงิน" };
        }

        db.addMoney(userId, salary);
        userEco.lastWork = now;
        
        return { 
            success: true, 
            message: `ทำงานเป็น ${job.name} ได้รับ ${salary} บาท`,
            salary 
        };
    }

    async gamble(userId, amount, type) {
        const userEco = db.getEconomy(userId);
        
        if (userEco.balance < amount) {
            return { success: false, message: "เงินไม่พอ" };
        }

        if (amount < 10) {
            return { success: false, message: "เดิมพันขั้นต่ำ 10 บาท" };
        }

        let result;
        switch (type) {
            case 'coin':
                const win = Math.random() > 0.48;
                result = {
                    success: true,
                    win,
                    amount: win ? amount : -amount,
                    message: win ? `ชนะ ${amount} บาท!` : `เสีย ${amount} บาท...`
                };
                break;

            case 'dice':
                const roll = Math.floor(Math.random() * 6) + 1;
                const target = Math.floor(Math.random() * 6) + 1;
                const diceWin = roll > target;
                result = {
                    success: true,
                    win: diceWin,
                    amount: diceWin ? amount * 2 : -amount,
                    message: `คุณทอยได้ ${roll}, คู่ต่อสู้ได้ ${target} - ${diceWin ? 'ชนะ!' : 'แพ้...'}`
                };
                break;

            case 'slots':
                const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '7️⃣'];
                const slots = [
                    symbols[Math.floor(Math.random() * symbols.length)],
                    symbols[Math.floor(Math.random() * symbols.length)],
                    symbols[Math.floor(Math.random() * symbols.length)]
                ];
                
                let winMultiplier = 0;
                if (slots[0] === slots[1] && slots[1] === slots[2]) {
                    winMultiplier = 10;
                } else if (slots[0] === slots[1] || slots[1] === slots[2]) {
                    winMultiplier = 3;
                } else if (slots[0] === slots[2]) {
                    winMultiplier = 2;
                }

                const winAmount = winMultiplier > 0 ? amount * winMultiplier : -amount;
                result = {
                    success: true,
                    win: winMultiplier > 0,
                    amount: winAmount,
                    message: `[${slots.join(' ')}] ${winMultiplier > 0 ? `ชนะ ${winAmount} บาท!` : 'เสีย...'}`,
                    slots
                };
                break;

            default:
                return { success: false, message: "ประเภทการพนันไม่ถูกต้อง" };
        }

        if (result.win) {
            db.addMoney(userId, result.amount);
        } else {
            userEco.balance += result.amount; // Negative amount
        }

        return result;
    }

    async buyStock(userId, symbol, quantity) {
        const userEco = db.getEconomy(userId);
        const stock = this.stocks[symbol];
        
        if (!stock) {
            return { success: false, message: "ไม่พบหุ้นนี้" };
        }

        const totalCost = stock.price * quantity;
        if (userEco.balance < totalCost) {
            return { success: false, message: "เงินไม่พอ" };
        }

        // Add to user's portfolio
        if (!userEco.portfolio) userEco.portfolio = {};
        if (!userEco.portfolio[symbol]) {
            userEco.portfolio[symbol] = { quantity: 0, averagePrice: 0 };
        }

        const current = userEco.portfolio[symbol];
        const newQuantity = current.quantity + quantity;
        const newAverage = (current.averagePrice * current.quantity + totalCost) / newQuantity;
        
        userEco.portfolio[symbol] = {
            quantity: newQuantity,
            averagePrice: newAverage
        };

        userEco.balance -= totalCost;

        return {
            success: true,
            message: `ซื้อหุ้น ${symbol} จำนวน ${quantity} หุ้น ที่ราคาหุ้นละ ${stock.price.toFixed(2)} บาท`,
            totalCost
        };
    }
}

const economySystem = new EconomySystem();

// ==================== LEVELING SYSTEM ====================
class LevelingSystem {
    constructor() {
        this.voiceUsers = new Map();
        this.xpCooldown = new Map();
        this.setupVoiceTracking();
    }

    setupVoiceTracking() {
        setInterval(() => {
            client.guilds.cache.forEach(guild => {
                guild.members.cache.forEach(member => {
                    if (member.voice.channel && !member.user.bot) {
                        const key = `${guild.id}-${member.id}`;
                        const currentTime = this.voiceUsers.get(key) || 0;
                        this.voiceUsers.set(key, currentTime + 1);
                        
                        // Add XP every minute
                        if (currentTime % 1 === 0) {
                            this.addVoiceXp(member.id, guild.id);
                        }
                    }
                });
            });
        }, 60000); // Every minute
    }

    addMessageXp(userId, guildId, messageLength) {
        const cooldownKey = `${userId}-${guildId}`;
        const now = Date.now();
        
        if (this.xpCooldown.has(cooldownKey)) {
            const lastMessage = this.xpCooldown.get(cooldownKey);
            if (now - lastMessage < CONFIG.LEVELS.COOLDOWN * 1000) {
                return false;
            }
        }

        this.xpCooldown.set(cooldownKey, now);
        const xp = Math.floor(messageLength / 10) + 
                   Math.floor(Math.random() * (CONFIG.LEVELS.MESSAGE_XP_MAX - CONFIG.LEVELS.MESSAGE_XP_MIN + 1)) + 
                   CONFIG.LEVELS.MESSAGE_XP_MIN;

        const result = db.addXp(userId, xp);
        const userLevel = db.getLevel(userId);
        
        // Update rank
        this.updateRank(userId, guildId);

        return { xp, leveledUp: result.leveledUp, newLevel: result.newLevel };
    }

    addVoiceXp(userId, guildId) {
        const xp = CONFIG.LEVELS.VOICE_XP_PER_MINUTE;
        const result = db.addXp(userId, xp);
        
        if (result.leveledUp) {
            // Announce level up
            this.announceLevelUp(userId, guildId, result.newLevel);
        }

        return result;
    }

    updateRank(userId, guildId) {
        // Get all users in guild and sort by XP
        const guildMembers = db.data.levels;
        const sorted = Object.entries(guildMembers)
            .filter(([id, data]) => data.totalXp > 0)
            .sort((a, b) => b[1].totalXp - a[1].totalXp);

        sorted.forEach(([id, data], index) => {
            data.rank = index + 1;
        });
    }

    announceLevelUp(userId, guildId, newLevel) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(userId);
        if (!member) return;

        // Find announcement channel
        const channel = guild.channels.cache.find(ch => 
            ch.type === ChannelType.GuildText && 
            ch.name.includes('level')
        ) || guild.systemChannel;

        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('🎉 Level Up!')
                .setDescription(`<@${userId}> ได้เลเวลขึ้นเป็น **${newLevel}**!`)
                .setTimestamp();

            channel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    getLeaderboard(guildId, limit = 10) {
        const guildMembers = db.data.levels;
        const sorted = Object.entries(guildMembers)
            .filter(([id, data]) => data.totalXp > 0)
            .sort((a, b) => b[1].totalXp - a[1].totalXp)
            .slice(0, limit);

        return sorted.map(([userId, data], index) => ({
            rank: index + 1,
            userId,
            level: data.level,
            xp: data.totalXp,
            messages: data.messages
        }));
    }
}

const levelingSystem = new LevelingSystem();

// ==================== MODERATION SYSTEM ====================
class ModerationSystem {
    constructor() {
        this.mutedUsers = new Map();
        this.setupAutoMod();
    }

    setupAutoMod() {
        // Auto moderation checks
        client.on('messageCreate', async message => {
            if (message.author.bot) return;
            
            await this.checkSpam(message);
            await this.checkBadWords(message);
            await this.checkLinks(message);
            await this.checkMentions(message);
        });
    }

    async checkSpam(message) {
        const key = `${message.author.id}-${message.guild.id}`;
        const now = Date.now();
        
        if (!this.messageHistory) this.messageHistory = new Map();
        if (!this.messageHistory.has(key)) {
            this.messageHistory.set(key, []);
        }

        const history = this.messageHistory.get(key);
        history.push(now);
        
        // Keep only messages in the last 5 seconds
        const recent = history.filter(time => now - time < CONFIG.MODERATION.AUTO_MOD.SPAM_WINDOW);
        this.messageHistory.set(key, recent);

        if (recent.length >= CONFIG.MODERATION.AUTO_MOD.SPAM_THRESHOLD) {
            await this.warnUser(message.author.id, message.guild.id, 'Spamming', message.client.user.id);
            await message.delete().catch(() => {});
            
            const warning = await message.channel.send(
                `${message.author}, โปรดหยุดสแปม!`
            );
            
            setTimeout(() => warning.delete().catch(() => {}), 5000);
            return true;
        }
        return false;
    }

    async checkBadWords(message) {
        const content = message.content.toLowerCase();
        const badWords = CONFIG.MODERATION.AUTO_MOD.BAD_WORDS;
        
        for (const word of badWords) {
            if (content.includes(word)) {
                await this.warnUser(message.author.id, message.guild.id, 'Using inappropriate language', message.client.user.id);
                await message.delete().catch(() => {});
                
                const warning = await message.channel.send(
                    `${message.author}, ข้อความของคุณมีคำที่ไม่เหมาะสม!`
                );
                
                setTimeout(() => warning.delete().catch(() => {}), 5000);
                return true;
            }
        }
        return false;
    }

    async checkLinks(message) {
        const content = message.content;
        const links = CONFIG.MODERATION.AUTO_MOD.LINKS;
        
        for (const link of links) {
            if (content.includes(link)) {
                // Check if user has permission to post links
                const member = message.member;
                if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    await message.delete().catch(() => {});
                    
                    const warning = await message.channel.send(
                        `${message.author}, คุณไม่มีสิทธิ์โพสต์ลิงก์!`
                    );
                    
                    setTimeout(() => warning.delete().catch(() => {}), 5000);
                    return true;
                }
            }
        }
        return false;
    }

    async checkMentions(message) {
        const mentions = message.mentions;
        if (mentions.users.size > CONFIG.MODERATION.AUTO_MOD.MENTION_LIMIT) {
            await this.warnUser(message.author.id, message.guild.id, 'Excessive mentions', message.client.user.id);
            await message.delete().catch(() => {});
            
            const warning = await message.channel.send(
                `${message.author}, โปรดอย่าแท็กผู้คนมากเกินไป!`
            );
            
            setTimeout(() => warning.delete().catch(() => {}), 5000);
            return true;
        }
        return false;
    }

    async warnUser(userId, guildId, reason, moderatorId) {
        const warning = db.addWarning(userId, guildId, reason, moderatorId);
        const warnings = db.getWarnings(userId, guildId);
        
        // Check if user should be muted
        if (warnings.length >= CONFIG.MODERATION.MAX_WARNS) {
            await this.muteUser(userId, guildId, CONFIG.MODERATION.MUTE_DURATIONS[warnings.length], reason);
        }
        
        // Log warning
        this.logAction('warn', userId, guildId, { reason, moderatorId });
        
        return warning;
    }

    async muteUser(userId, guildId, duration, reason) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return false;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;

        try {
            // Create mute role if it doesn't exist
            let muteRole = guild.roles.cache.find(role => role.name === 'Muted');
            if (!muteRole) {
                muteRole = await guild.roles.create({
                    name: 'Muted',
                    color: Colors.Grey,
                    permissions: []
                });

                // Update channel permissions
                guild.channels.cache.forEach(async channel => {
                    await channel.permissionOverwrites.edit(muteRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: false
                    }).catch(() => {});
                });
            }

            await member.roles.add(muteRole);
            
            // Schedule unmute
            setTimeout(async () => {
                await member.roles.remove(muteRole).catch(() => {});
                this.mutedUsers.delete(`${guildId}-${userId}`);
            }, duration);

            this.mutedUsers.set(`${guildId}-${userId}`, Date.now() + duration);
            
            // Log mute
            this.logAction('mute', userId, guildId, { duration, reason });
            
            return true;
        } catch (error) {
            logger.error('Mute error:', error);
            return false;
        }
    }

    async kickUser(userId, guildId, reason, moderatorId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return false;

        try {
            await guild.members.kick(userId, reason);
            this.logAction('kick', userId, guildId, { reason, moderatorId });
            return true;
        } catch (error) {
            logger.error('Kick error:', error);
            return false;
        }
    }

    async banUser(userId, guildId, reason, moderatorId, days = 0) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return false;

        try {
            await guild.members.ban(userId, { reason, deleteMessageDays: days });
            this.logAction('ban', userId, guildId, { reason, moderatorId, days });
            return true;
        } catch (error) {
            logger.error('Ban error:', error);
            return false;
        }
    }

    logAction(action, userId, guildId, details) {
        const log = {
            id: uuidv4(),
            action,
            userId,
            guildId,
            timestamp: Date.now(),
            details
        };

        if (!db.data.logs[guildId]) db.data.logs[guildId] = [];
        db.data.logs[guildId].push(log);

        // Keep only last 1000 logs per guild
        if (db.data.logs[guildId].length > 1000) {
            db.data.logs[guildId] = db.data.logs[guildId].slice(-1000);
        }

        // Send to log channel
        this.sendLogEmbed(log);
    }

    async sendLogEmbed(log) {
        try {
            const guild = client.guilds.cache.get(log.guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
            if (!channel || channel.type !== ChannelType.GuildText) return;

            const moderator = await client.users.fetch(log.details.moderatorId).catch(() => ({ username: 'Unknown', discriminator: '0000' }));
            const user = await client.users.fetch(log.userId).catch(() => ({ username: 'Unknown', discriminator: '0000' }));

            let color;
            let title;
            let description;

            switch (log.action) {
                case 'warn':
                    color = Colors.Yellow;
                    title = '⚠️ User Warned';
                    description = `**User:** ${user.tag} (${user.id})\n**Reason:** ${log.details.reason}`;
                    break;
                case 'mute':
                    color = Colors.Orange;
                    title = '🔇 User Muted';
                    description = `**User:** ${user.tag} (${user.id})\n**Duration:** ${this.formatDuration(log.details.duration)}\n**Reason:** ${log.details.reason}`;
                    break;
                case 'kick':
                    color = Colors.Red;
                    title = '👢 User Kicked';
                    description = `**User:** ${user.tag} (${user.id})\n**Reason:** ${log.details.reason}`;
                    break;
                case 'ban':
                    color = Colors.DarkRed;
                    title = '🔨 User Banned';
                    description = `**User:** ${user.tag} (${user.id})\n**Reason:** ${log.details.reason}\n**Delete Messages:** ${log.details.days} days`;
                    break;
                default:
                    return;
            }

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .addFields(
                    { name: 'Moderator', value: `${moderator.tag}`, inline: true },
                    { name: 'Time', value: `<t:${Math.floor(log.timestamp / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Log embed error:', error);
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} วัน`;
        if (hours > 0) return `${hours} ชั่วโมง`;
        if (minutes > 0) return `${minutes} นาที`;
        return `${seconds} วินาที`;
    }
}

const moderationSystem = new ModerationSystem();

// ==================== TICKET SYSTEM ====================
class TicketSystem {
    constructor() {
        this.activeTickets = new Map();
        this.setupTicketCleanup();
    }

    setupTicketCleanup() {
        // Clean up old tickets every hour
        setInterval(() => {
            const now = Date.now();
            Object.keys(db.data.tickets).forEach(guildId => {
                Object.keys(db.data.tickets[guildId]).forEach(ticketId => {
                    const ticket = db.data.tickets[guildId][ticketId];
                    if (ticket.status === 'closed' && now - ticket.closedAt > 604800000) { // 7 days
                        this.deleteTicket(guildId, ticketId);
                    }
                });
            });
        }, 3600000);
    }

    async createTicket(guild, user, reason) {
        const ticketId = `ticket-${Date.now()}`;
        
        try {
            // Create ticket channel
            const channel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: CONFIG.TICKET_CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: CONFIG.ADMIN_ROLE_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            // Create ticket data
            const ticket = {
                id: ticketId,
                guildId: guild.id,
                userId: user.id,
                channelId: channel.id,
                createdAt: Date.now(),
                status: 'open',
                reason: reason || 'No reason provided',
                messages: []
            };

            // Save to database
            if (!db.data.tickets[guild.id]) db.data.tickets[guild.id] = {};
            db.data.tickets[guild.id][ticketId] = ticket;
            this.activeTickets.set(channel.id, ticketId);

            // Send welcome message
            const embed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle('🎫 Ticket Created')
                .setDescription(`สวัสดี ${user}, ตั๋วของคุณถูกสร้างแล้ว!\n**เหตุผล:** ${reason}`)
                .addFields(
                    { name: 'คำสั่ง', value: 'ใช้ `/ticket close` เพื่อปิดตั๋ว\nใช้ `/ticket add @user` เพื่อเพิ่มผู้ใช้\nใช้ `/ticket remove @user` เพื่อลบผู้ใช้' }
                )
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('ปิดตั๋ว')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            await channel.send({ 
                content: `<@&${CONFIG.ADMIN_ROLE_ID}> <@${user.id}>`,
                embeds: [embed],
                components: [row]
            });

            return ticket;
        } catch (error) {
            logger.error('Ticket creation error:', error);
            return null;
        }
    }

    async closeTicket(guildId, ticketId, closerId) {
        const ticket = db.data.tickets[guildId]?.[ticketId];
        if (!ticket) return false;

        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return false;

            const channel = guild.channels.cache.get(ticket.channelId);
            if (channel) {
                // Send closing message
                const embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`ตั๋วนี้ถูกปิดโดย <@${closerId}>`)
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                // Delete channel after delay
                setTimeout(() => {
                    channel.delete().catch(() => {});
                }, 5000);
            }

            // Update ticket status
            ticket.status = 'closed';
            ticket.closedAt = Date.now();
            ticket.closedBy = closerId;

            // Create transcript
            await this.createTranscript(ticket);

            this.activeTickets.delete(ticket.channelId);
            return true;
        } catch (error) {
            logger.error('Ticket closing error:', error);
            return false;
        }
    }

    async createTranscript(ticket) {
        try {
            const guild = client.guilds.cache.get(ticket.guildId);
            const channel = guild?.channels.cache.get(ticket.channelId);
            
            if (!channel) return;

            let transcript = `# Ticket Transcript - ${ticket.id}\n`;
            transcript += `**User:** <@${ticket.userId}>\n`;
            transcript += `**Created:** <t:${Math.floor(ticket.createdAt / 1000)}:F>\n`;
            transcript += `**Closed:** <t:${Math.floor(Date.now() / 1000)}:F>\n`;
            transcript += `**Reason:** ${ticket.reason}\n\n`;
            transcript += `## Messages\n\n`;

            // Fetch messages (last 100)
            const messages = await channel.messages.fetch({ limit: 100 });
            const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            sorted.forEach(message => {
                if (message.author.bot && message.embeds.length > 0) return;
                
                transcript += `[${message.author.username}](${message.createdAt.toISOString()}): ${message.content}\n`;
                if (message.attachments.size > 0) {
                    message.attachments.forEach(attachment => {
                        transcript += `📎 ${attachment.url}\n`;
                    });
                }
            });

            // Save transcript
            const transcriptDir = path.join('transcripts');
            if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir);
            
            const fileName = `${ticket.id}.txt`;
            fs.writeFileSync(path.join(transcriptDir, fileName), transcript);

            ticket.transcript = fileName;
        } catch (error) {
            logger.error('Transcript error:', error);
        }
    }

    deleteTicket(guildId, ticketId) {
        if (db.data.tickets[guildId]?.[ticketId]) {
            delete db.data.tickets[guildId][ticketId];
            
            // Remove empty guild entry
            if (Object.keys(db.data.tickets[guildId]).length === 0) {
                delete db.data.tickets[guildId];
            }
            
            return true;
        }
        return false;
    }
}

const ticketSystem = new TicketSystem();

// ==================== GAME SYSTEM ====================
class GameSystem {
    constructor() {
        this.activeGames = new Map();
        this.hangmanGames = new Map();
        this.triviaGames = new Map();
        this.rpsChallenges = new Map();
    }

    // Hangman Game
    startHangman(channel, userId, difficulty = 'medium') {
        const words = CONFIG.GAMES.HANGMAN_WORD_LIST;
        const word = words[Math.floor(Math.random() * words.length)].toLowerCase();
        const maxAttempts = difficulty === 'easy' ? 8 : difficulty === 'medium' ? 6 : 4;
        
        const game = {
            id: uuidv4(),
            word,
            guessed: [],
            incorrect: [],
            attempts: maxAttempts,
            maxAttempts,
            startedAt: Date.now(),
            userId,
            channelId: channel.id,
            status: 'playing'
        };

        this.hangmanGames.set(game.id, game);
        this.activeGames.set(channel.id, game.id);

        // Start game timeout
        setTimeout(() => {
            if (this.hangmanGames.get(game.id)?.status === 'playing') {
                this.endHangman(game.id, 'timeout');
            }
        }, 300000); // 5 minutes

        return game;
    }

    guessHangman(gameId, letter) {
        const game = this.hangmanGames.get(gameId);
        if (!game || game.status !== 'playing') return null;

        letter = letter.toLowerCase();
        
        if (game.guessed.includes(letter) || game.incorrect.includes(letter)) {
            return { success: false, message: 'ตัวอักษรนี้ถูกใช้แล้ว' };
        }

        if (game.word.includes(letter)) {
            game.guessed.push(letter);
            
            // Check if won
            const wordSet = new Set(game.word.split(''));
            const guessedSet = new Set(game.guessed);
            const intersection = new Set([...wordSet].filter(x => guessedSet.has(x)));
            
            if (intersection.size === wordSet.size) {
                this.endHangman(gameId, 'won');
                return { success: true, won: true, game };
            }
            
            return { success: true, correct: true, game };
        } else {
            game.incorrect.push(letter);
            game.attempts--;
            
            if (game.attempts <= 0) {
                this.endHangman(gameId, 'lost');
                return { success: true, lost: true, game };
            }
            
            return { success: true, correct: false, game };
        }
    }

    endHangman(gameId, result) {
        const game = this.hangmanGames.get(gameId);
        if (!game) return;

        game.status = 'ended';
        game.endedAt = Date.now();
        game.result = result;

        // Give rewards if won
        if (result === 'won') {
            const reward = game.maxAttempts * 50;
            db.addMoney(game.userId, reward);
        }

        this.activeGames.delete(game.channelId);
    }

    getHangmanDisplay(game) {
        const display = game.word.split('').map(letter => 
            game.guessed.includes(letter) ? letter : '_'
        ).join(' ');

        const hangmanStages = [
            `
              +---+
              |   |
                  |
                  |
                  |
                  |
            =========`,
            `
              +---+
              |   |
              O   |
                  |
                  |
                  |
            =========`,
            `
              +---+
              |   |
              O   |
              |   |
                  |
                  |
            =========`,
            `
              +---+
              |   |
              O   |
             /|   |
                  |
                  |
            =========`,
            `
              +---+
              |   |
              O   |
             /|\\  |
                  |
                  |
            =========`,
            `
              +---+
              |   |
              O   |
             /|\\  |
             /    |
                  |
            =========`,
            `
              +---+
              |   |
              O   |
             /|\\  |
             / \\  |
                  |
            =========`
        ];

        const stage = Math.min(game.incorrect.length, hangmanStages.length - 1);
        
        return {
            display,
            stage: hangmanStages[stage],
            incorrect: game.incorrect.join(', ') || 'ไม่มี',
            attempts: game.attempts
        };
    }

    // Trivia Game
    startTrivia(channel, userId, category = 'general') {
        const questions = CONFIG.GAMES.TRIVIA_QUESTIONS;
        const question = questions[Math.floor(Math.random() * questions.length)];
        
        const game = {
            id: uuidv4(),
            question,
            startedAt: Date.now(),
            userId,
            channelId: channel.id,
            status: 'asking',
            answered: false
        };

        this.triviaGames.set(game.id, game);
        this.activeGames.set(`${channel.id}-trivia`, game.id);

        // Timeout after 30 seconds
        setTimeout(() => {
            if (this.triviaGames.get(game.id)?.status === 'asking') {
                this.endTrivia(game.id, 'timeout');
            }
        }, 30000);

        return game;
    }

    answerTrivia(gameId, answerIndex) {
        const game = this.triviaGames.get(gameId);
        if (!game || game.status !== 'asking') return null;

        game.answered = true;
        game.answerTime = Date.now();
        
        if (answerIndex === game.question.answer) {
            this.endTrivia(gameId, 'correct');
            return { correct: true };
        } else {
            this.endTrivia(gameId, 'incorrect');
            return { correct: false };
        }
    }

    endTrivia(gameId, result) {
        const game = this.triviaGames.get(gameId);
        if (!game) return;

        game.status = 'ended';
        game.result = result;

        // Give reward if correct
        if (result === 'correct') {
            const timeTaken = game.answerTime - game.startedAt;
            const reward = Math.max(100, 500 - Math.floor(timeTaken / 100));
            db.addMoney(game.userId, reward);
        }

        this.activeGames.delete(`${game.channelId}-trivia`);
    }

    // Rock Paper Scissors
    createRPSChallenge(challengerId, targetId, bet = 0) {
        const challengeId = uuidv4();
        
        const challenge = {
            id: challengeId,
            challengerId,
            targetId,
            bet,
            createdAt: Date.now(),
            challengerChoice: null,
            targetChoice: null,
            status: 'pending'
        };

        this.rpsChallenges.set(challengeId, challenge);
        
        // Expire after 5 minutes
        setTimeout(() => {
            if (this.rpsChallenges.get(challengeId)?.status === 'pending') {
                this.rpsChallenges.delete(challengeId);
            }
        }, 300000);

        return challenge;
    }

    acceptRPS(challengeId, targetId) {
        const challenge = this.rpsChallenges.get(challengeId);
        if (!challenge || challenge.targetId !== targetId || challenge.status !== 'pending') {
            return null;
        }

        challenge.status = 'accepted';
        return challenge;
    }

    makeRPSChoice(challengeId, userId, choice) {
        const challenge = this.rpsChallenges.get(challengeId);
        if (!challenge) return null;

        if (challenge.challengerId === userId) {
            challenge.challengerChoice = choice;
        } else if (challenge.targetId === userId) {
            challenge.targetChoice = choice;
        } else {
            return null;
        }

        // Check if both have made choices
        if (challenge.challengerChoice && challenge.targetChoice) {
            return this.resolveRPS(challengeId);
        }

        return { waiting: true };
    }

    resolveRPS(challengeId) {
        const challenge = this.rpsChallenges.get(challengeId);
        if (!challenge) return null;

        const { challengerChoice, targetChoice } = challenge;
        
        let result;
        if (challengerChoice === targetChoice) {
            result = 'draw';
        } else if (CONFIG.GAMES.RPS_WIN_CONDITIONS[challengerChoice] === targetChoice) {
            result = 'challenger';
        } else {
            result = 'target';
        }

        challenge.result = result;
        challenge.status = 'completed';
        challenge.completedAt = Date.now();

        // Handle bets
        if (challenge.bet > 0) {
            const challengerEco = db.getEconomy(challenge.challengerId);
            const targetEco = db.getEconomy(challenge.targetId);

            if (result === 'challenger') {
                challengerEco.balance += challenge.bet;
                targetEco.balance -= challenge.bet;
            } else if (result === 'target') {
                challengerEco.balance -= challenge.bet;
                targetEco.balance += challenge.bet;
            }
            // Draw returns bets
        }

        return challenge;
    }
}

const gameSystem = new GameSystem();

// ==================== EVENT SYSTEM ====================
class EventSystem {
    constructor() {
        this.activeEvents = new Map();
        this.eventHistory = [];
        this.scheduledEvents = [];
        this.loadEvents();
    }

    loadEvents() {
        if (fs.existsSync('events.json')) {
            const data = JSON.parse(fs.readFileSync('events.json', 'utf8'));
            this.eventHistory = data.history || [];
            this.scheduledEvents = data.scheduled || [];
        }
    }

    saveEvents() {
        const data = {
            history: this.eventHistory.slice(-1000),
            scheduled: this.scheduledEvents
        };
        fs.writeFileSync('events.json', JSON.stringify(data, null, 2));
    }

    createEvent(name, description, type, startTime, endTime, rewards = {}) {
        const eventId = uuidv4();
        
        const event = {
            id: eventId,
            name,
            description,
            type,
            startTime,
            endTime,
            rewards,
            participants: new Set(),
            leaderboard: {},
            status: 'scheduled'
        };

        this.scheduledEvents.push(event);
        this.saveEvents();

        // Schedule event start
        const timeUntilStart = startTime - Date.now();
        if (timeUntilStart > 0) {
            setTimeout(() => {
                this.startEvent(eventId);
            }, timeUntilStart);
        }

        return event;
    }

    startEvent(eventId) {
        const event = this.scheduledEvents.find(e => e.id === eventId);
        if (!event) return;

        event.status = 'active';
        event.startedAt = Date.now();
        this.activeEvents.set(eventId, event);

        // Announce event
        this.announceEvent(event);

        // Schedule event end
        const duration = event.endTime - event.startTime;
        setTimeout(() => {
            this.endEvent(eventId);
        }, duration);
    }

    endEvent(eventId) {
        const event = this.activeEvents.get(eventId);
        if (!event) return;

        event.status = 'ended';
        event.endedAt = Date.now();
        
        // Distribute rewards
        this.distributeRewards(event);

        // Move to history
        this.eventHistory.push(event);
        this.activeEvents.delete(eventId);
        
        // Remove from scheduled
        this.scheduledEvents = this.scheduledEvents.filter(e => e.id !== eventId);
        
        this.saveEvents();
        this.announceEventEnd(event);
    }

    announceEvent(event) {
        client.guilds.cache.forEach(guild => {
            const channel = guild.channels.cache.find(ch => 
                ch.type === ChannelType.GuildText && 
                (ch.name.includes('event') || ch.name.includes('announcement'))
            ) || guild.systemChannel;

            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(Colors.Gold)
                    .setTitle(`🎉 ${event.name} ได้เริ่มต้นแล้ว!`)
                    .setDescription(event.description)
                    .addFields(
                        { name: 'ประเภท', value: event.type, inline: true },
                        { name: 'ระยะเวลา', value: this.formatDuration(event.endTime - event.startTime), inline: true },
                        { name: 'รางวัล', value: Object.entries(event.rewards).map(([key, value]) => `${key}: ${value}`).join('\n') || 'ไม่มี' }
                    )
                    .setFooter({ text: 'ใช้คำสั่ง /event join เพื่อเข้าร่วม!' })
                    .setTimestamp();

                channel.send({ embeds: [embed] }).catch(() => {});
            }
        });
    }

    announceEventEnd(event) {
        client.guilds.cache.forEach(guild => {
            const channel = guild.channels.cache.find(ch => 
                ch.type === ChannelType.GuildText && 
                (ch.name.includes('event') || ch.name.includes('announcement'))
            ) || guild.systemChannel;

            if (channel) {
                // Get top 3 participants
                const sorted = Object.entries(event.leaderboard)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3);

                const embed = new EmbedBuilder()
                    .setColor(Colors.Purple)
                    .setTitle(`🎊 ${event.name} จบแล้ว!`)
                    .setDescription('ผลลัพธ์ของอีเวนต์:')
                    .setTimestamp();

                if (sorted.length > 0) {
                    embed.addFields(
                        { 
                            name: '🏆 อันดับ 1', 
                            value: `<@${sorted[0][0]}> - ${sorted[0][1]} คะแนน`,
                            inline: false 
                        }
                    );

                    if (sorted.length > 1) {
                        embed.addFields(
                            { 
                                name: '🥈 อันดับ 2', 
                                value: `<@${sorted[1][0]}> - ${sorted[1][1]} คะแนน`,
                                inline: true 
                            },
                            { 
                                name: '🥉 อันดับ 3', 
                                value: `<@${sorted[2][0]}> - ${sorted[2][1]} คะแนน`,
                                inline: true 
                            }
                        );
                    }
                }

                channel.send({ embeds: [embed] }).catch(() => {});
            }
        });
    }

    joinEvent(eventId, userId) {
        const event = this.activeEvents.get(eventId);
        if (!event || event.status !== 'active') return false;

        event.participants.add(userId);
        if (!event.leaderboard[userId]) {
            event.leaderboard[userId] = 0;
        }

        return true;
    }

    addEventPoints(eventId, userId, points) {
        const event = this.activeEvents.get(eventId);
        if (!event || !event.participants.has(userId)) return false;

        event.leaderboard[userId] = (event.leaderboard[userId] || 0) + points;
        return true;
    }

    distributeRewards(event) {
        const sorted = Object.entries(event.leaderboard)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        sorted.forEach(([userId], index) => {
            let reward;
            switch (index) {
                case 0: reward = event.rewards.first || 1000; break;
                case 1: reward = event.rewards.second || 500; break;
                case 2: reward = event.rewards.third || 250; break;
                default: reward = 0;
            }

            if (reward > 0) {
                db.addMoney(userId, reward);
                
                // Give badge for winning
                const inventory = db.getInventory(userId);
                if (!inventory.badges.includes(`${event.name}_winner`)) {
                    inventory.badges.push(`${event.name}_winner`);
                }
            }
        });
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} วัน ${hours % 24} ชั่วโมง`;
        if (hours > 0) return `${hours} ชั่วโมง ${minutes % 60} นาที`;
        if (minutes > 0) return `${minutes} นาที ${seconds % 60} วินาที`;
        return `${seconds} วินาที`;
    }

    getActiveEvents() {
        return Array.from(this.activeEvents.values()).filter(event => event.status === 'active');
    }

    getUpcomingEvents() {
        return this.scheduledEvents.filter(event => event.startTime > Date.now());
    }
}

const eventSystem = new EventSystem();

// ==================== MUSIC SYSTEM ====================
class MusicSystem {
    constructor() {
        this.queues = new Map();
        this.connections = new Map();
        this.setupVoiceHandlers();
    }

    setupVoiceHandlers() {
        client.on('voiceStateUpdate', (oldState, newState) => {
            // Clean up empty voice channels
            if (oldState.channelId && !newState.channelId) {
                this.checkEmptyChannel(oldState.channelId);
            }
        });
    }

    async play(guildId, voiceChannelId, track) {
        try {
            // Get or create queue
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, {
                    tracks: [],
                    current: null,
                    volume: 100,
                    loop: false,
                    loopQueue: false,
                    playing: false
                });
            }

            const queue = this.queues.get(guildId);
            
            // Add track to queue
            if (track) {
                queue.tracks.push(track);
            }

            // If not playing and there are tracks, start playing
            if (!queue.playing && queue.tracks.length > 0) {
                await this.startPlayback(guildId, voiceChannelId);
            }

            return queue;
        } catch (error) {
            logger.error('Music play error:', error);
            return null;
        }
    }

    async startPlayback(guildId, voiceChannelId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const queue = this.queues.get(guildId);
        if (!queue || queue.tracks.length === 0) return;

        try {
            // Join voice channel
            const voiceChannel = guild.channels.cache.get(voiceChannelId);
            if (!voiceChannel) return;

            // Get connection
            let connection = this.connections.get(guildId);
            if (!connection) {
                const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
                
                connection = joinVoiceChannel({
                    channelId: voiceChannelId,
                    guildId: guildId,
                    adapterCreator: guild.voiceAdapterCreator
                });

                const player = createAudioPlayer();
                connection.subscribe(player);

                this.connections.set(guildId, { connection, player });

                // Setup player events
                player.on(AudioPlayerStatus.Idle, () => {
                    this.nextTrack(guildId);
                });

                player.on('error', error => {
                    logger.error('Audio player error:', error);
                    this.nextTrack(guildId);
                });
            }

            // Play next track
            await this.nextTrack(guildId);
        } catch (error) {
            logger.error('Playback error:', error);
        }
    }

    async nextTrack(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue) return;

        const connectionData = this.connections.get(guildId);
        if (!connectionData) return;

        const { player } = connectionData;

        if (queue.loop && queue.current) {
            // Loop current track
            await this.playTrack(guildId, queue.current);
        } else if (queue.tracks.length > 0) {
            // Get next track
            const track = queue.tracks.shift();
            queue.current = track;
            await this.playTrack(guildId, track);

            if (queue.loopQueue) {
                queue.tracks.push(track);
            }
        } else {
            // No more tracks
            queue.playing = false;
            queue.current = null;
            
            // Leave after 5 minutes of inactivity
            setTimeout(() => {
                const currentQueue = this.queues.get(guildId);
                if (!currentQueue || !currentQueue.playing) {
                    this.stop(guildId);
                }
            }, 300000);
        }
    }

    async playTrack(guildId, track) {
        const queue = this.queues.get(guildId);
        if (!queue) return;

        const connectionData = this.connections.get(guildId);
        if (!connectionData) return;

        const { player } = connectionData;

        try {
            const { createAudioResource } = require('@discordjs/voice');
            const ytdl = require('ytdl-core');
            
            const stream = ytdl(track.url, { 
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25 
            });
            
            const resource = createAudioResource(stream, { inlineVolume: true });
            resource.volume.setVolume(queue.volume / 100);
            
            player.play(resource);
            queue.playing = true;

            // Update now playing message
            this.sendNowPlaying(guildId, track);
        } catch (error) {
            logger.error('Track play error:', error);
            this.nextTrack(guildId);
        }
    }

    async sendNowPlaying(guildId, track) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const queue = this.queues.get(guildId);
        if (!queue) return;

        // Find music channel
        const channel = guild.channels.cache.find(ch => 
            ch.type === ChannelType.GuildText && 
            ch.name.includes('music')
        );

        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle('🎵 Now Playing')
                .setDescription(`**[${track.title}](${track.url})**`)
                .addFields(
                    { name: 'Duration', value: this.formatDuration(track.duration), inline: true },
                    { name: 'Requested by', value: `<@${track.requestedBy}>`, inline: true },
                    { name: 'Queue', value: `${queue.tracks.length} tracks remaining`, inline: true }
                )
                .setThumbnail(track.thumbnail)
                .setTimestamp();

            channel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    stop(guildId) {
        const queue = this.queues.get(guildId);
        const connectionData = this.connections.get(guildId);

        if (connectionData) {
            connectionData.player.stop();
            connectionData.connection.destroy();
            this.connections.delete(guildId);
        }

        if (queue) {
            this.queues.delete(guildId);
        }
    }

    skip(guildId) {
        const connectionData = this.connections.get(guildId);
        if (connectionData) {
            connectionData.player.stop();
            return true;
        }
        return false;
    }

    pause(guildId) {
        const connectionData = this.connections.get(guildId);
        if (connectionData && connectionData.player.state.status === 'playing') {
            connectionData.player.pause();
            return true;
        }
        return false;
    }

    resume(guildId) {
        const connectionData = this.connections.get(guildId);
        if (connectionData && connectionData.player.state.status === 'paused') {
            connectionData.player.unpause();
            return true;
        }
        return false;
    }

    setVolume(guildId, volume) {
        const queue = this.queues.get(guildId);
        if (queue) {
            volume = Math.max(0, Math.min(200, volume));
            queue.volume = volume;
            
            const connectionData = this.connections.get(guildId);
            if (connectionData && connectionData.player.state.resource) {
                connectionData.player.state.resource.volume.setVolume(volume / 100);
            }
            
            return volume;
        }
        return null;
    }

    shuffle(guildId) {
        const queue = this.queues.get(guildId);
        if (queue && queue.tracks.length > 0) {
            for (let i = queue.tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
            }
            return true;
        }
        return false;
    }

    checkEmptyChannel(channelId) {
        this.connections.forEach((data, guildId) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const voiceChannel = guild.channels.cache.get(channelId);
                if (voiceChannel && voiceChannel.members.size === 1) {
                    // Only bot is in channel, leave after 1 minute
                    setTimeout(() => {
                        const updatedChannel = guild.channels.cache.get(channelId);
                        if (updatedChannel && updatedChannel.members.size === 1) {
                            this.stop(guildId);
                        }
                    }, 60000);
                }
            }
        });
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    async search(query) {
        try {
            const ytdl = require('ytdl-core');
            const yts = require('yt-search');
            
            const searchResult = await yts(query);
            return searchResult.videos.slice(0, 10).map(video => ({
                title: video.title,
                url: video.url,
                duration: video.duration.seconds,
                thumbnail: video.thumbnail,
                views: video.views,
                author: video.author.name
            }));
        } catch (error) {
            logger.error('YouTube search error:', error);
            return [];
        }
    }
}

const musicSystem = new MusicSystem();

// ==================== REMINDER SYSTEM ====================
class ReminderSystem {
    constructor() {
        this.reminders = new Map();
        this.loadReminders();
        this.setupChecker();
    }

    loadReminders() {
        const reminders = db.data.reminders;
        Object.entries(reminders).forEach(([userId, userReminders]) => {
            userReminders.forEach(reminder => {
                if (reminder.time > Date.now()) {
                    this.scheduleReminder(reminder);
                }
            });
        });
    }

    setupChecker() {
        // Check reminders every minute
        setInterval(() => {
            this.checkReminders();
        }, 60000);
    }

    async createReminder(userId, time, message, channelId = null) {
        const reminderId = uuidv4();
        const reminder = {
            id: reminderId,
            userId,
            time,
            message,
            channelId,
            createdAt: Date.now(),
            notified: false
        };

        // Save to database
        if (!db.data.reminders[userId]) db.data.reminders[userId] = [];
        db.data.reminders[userId].push(reminder);

        // Keep only last 100 reminders per user
        if (db.data.reminders[userId].length > 100) {
            db.data.reminders[userId] = db.data.reminders[userId].slice(-100);
        }

        // Schedule reminder
        this.scheduleReminder(reminder);

        return reminder;
    }

    scheduleReminder(reminder) {
        const timeUntil = reminder.time - Date.now();
        if (timeUntil <= 0) return;

        setTimeout(() => {
            this.triggerReminder(reminder.id);
        }, timeUntil);

        this.reminders.set(reminder.id, reminder);
    }

    async triggerReminder(reminderId) {
        const reminder = this.reminders.get(reminderId);
        if (!reminder || reminder.notified) return;

        try {
            const user = await client.users.fetch(reminder.userId);
            if (!user) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle('⏰ Reminder')
                .setDescription(reminder.message)
                .addFields(
                    { name: 'Set at', value: `<t:${Math.floor(reminder.createdAt / 1000)}:F>`, inline: true },
                    { name: 'Triggered at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

            if (reminder.channelId) {
                const channel = client.channels.cache.get(reminder.channelId);
                if (channel && channel.type === ChannelType.GuildText) {
                    await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] });
                }
            } else {
                await user.send({ embeds: [embed] });
            }

            reminder.notified = true;
            this.cleanupOldReminders();
        } catch (error) {
            logger.error('Reminder trigger error:', error);
        }
    }

    checkReminders() {
        const now = Date.now();
        this.reminders.forEach((reminder, id) => {
            if (reminder.time <= now && !reminder.notified) {
                this.triggerReminder(id);
            }
        });
    }

    cleanupOldReminders() {
        const oneWeekAgo = Date.now() - 604800000; // 7 days
        this.reminders.forEach((reminder, id) => {
            if (reminder.notified && reminder.time < oneWeekAgo) {
                this.reminders.delete(id);
            }
        });

        // Clean up database
        Object.keys(db.data.reminders).forEach(userId => {
            db.data.reminders[userId] = db.data.reminders[userId].filter(
                reminder => reminder.time > oneWeekAgo || !reminder.notified
            );
            
            if (db.data.reminders[userId].length === 0) {
                delete db.data.reminders[userId];
            }
        });
    }

    getUserReminders(userId) {
        return db.data.reminders[userId] || [];
    }

    deleteReminder(userId, reminderId) {
        if (!db.data.reminders[userId]) return false;

        const initialLength = db.data.reminders[userId].length;
        db.data.reminders[userId] = db.data.reminders[userId].filter(
            reminder => reminder.id !== reminderId
        );

        if (this.reminders.has(reminderId)) {
            this.reminders.delete(reminderId);
        }

        return db.data.reminders[userId].length < initialLength;
    }
}

const reminderSystem = new ReminderSystem();

// ==================== POLL SYSTEM ====================
class PollSystem {
    constructor() {
        this.activePolls = new Map();
        this.loadPolls();
    }

    loadPolls() {
        const polls = db.data.polls;
        Object.entries(polls).forEach(([pollId, poll]) => {
            if (poll.endsAt > Date.now()) {
                this.activePolls.set(pollId, poll);
            }
        });
    }

    async createPoll(channelId, question, options, duration = 86400000) {
        const pollId = uuidv4();
        
        const poll = {
            id: pollId,
            channelId,
            question,
            options: options.map((option, index) => ({
                id: index,
                text: option,
                votes: 0,
                voters: []
            })),
            createdAt: Date.now(),
            endsAt: Date.now() + duration,
            totalVotes: 0,
            voters: new Set()
        };

        // Save to database
        db.data.polls[pollId] = poll;
        this.activePolls.set(pollId, poll);

        // Schedule end
        setTimeout(() => {
            this.endPoll(pollId);
        }, duration);

        // Create poll message
        const message = await this.createPollMessage(poll);
        poll.messageId = message.id;

        return poll;
    }

    async createPollMessage(poll) {
        const channel = client.channels.cache.get(poll.channelId);
        if (!channel) return null;

        const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('📊 Poll')
            .setDescription(poll.question)
            .addFields(
                poll.options.map((option, index) => ({
                    name: `${index + 1}. ${option.text}`,
                    value: `คะแนน: ${option.votes} | ${this.getPercentage(option.votes, poll.totalVotes)}%`,
                    inline: false
                }))
            )
            .setFooter({ text: `โหวตโดยใช้ปฏิกิริยาด้านล่าง | จบใน: ${this.formatTimeRemaining(poll.endsAt)}` })
            .setTimestamp();

        const row = new ActionRowBuilder();
        for (let i = 0; i < poll.options.length; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_${poll.id}_${i}`)
                    .setLabel(`${i + 1}`)
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        const message = await channel.send({ embeds: [embed], components: [row] });
        
        // Add reactions for mobile users
        for (let i = 0; i < poll.options.length; i++) {
            await message.react(`${i + 1}️⃣`).catch(() => {});
        }

        return message;
    }

    async vote(pollId, userId, optionIndex) {
        const poll = this.activePolls.get(pollId);
        if (!poll || poll.endsAt <= Date.now()) return false;

        // Check if user already voted
        if (poll.voters.has(userId)) {
            // Remove previous vote
            const previousOption = poll.options.find(opt => opt.voters.includes(userId));
            if (previousOption) {
                previousOption.votes--;
                previousOption.voters = previousOption.voters.filter(id => id !== userId);
            }
        }

        // Add new vote
        const option = poll.options[optionIndex];
        if (!option) return false;

        option.votes++;
        option.voters.push(userId);
        poll.voters.add(userId);
        poll.totalVotes++;

        // Update poll message
        await this.updatePollMessage(poll);

        return true;
    }

    async updatePollMessage(poll) {
        const channel = client.channels.cache.get(poll.channelId);
        if (!channel || !poll.messageId) return;

        try {
            const message = await channel.messages.fetch(poll.messageId);
            if (!message) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('📊 Poll')
                .setDescription(poll.question)
                .addFields(
                    poll.options.map((option, index) => ({
                        name: `${index + 1}. ${option.text}`,
                        value: `คะแนน: ${option.votes} | ${this.getPercentage(option.votes, poll.totalVotes)}%`,
                        inline: false
                    }))
                )
                .setFooter({ text: `โหวตโดยใช้ปฏิกิริยาด้านล่าง | จบใน: ${this.formatTimeRemaining(poll.endsAt)}` })
                .setTimestamp();

            const row = new ActionRowBuilder();
            for (let i = 0; i < poll.options.length; i++) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_${poll.id}_${i}`)
                        .setLabel(`${i + 1}`)
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            await message.edit({ embeds: [embed], components: [row] });
        } catch (error) {
            logger.error('Update poll message error:', error);
        }
    }

    async endPoll(pollId) {
        const poll = this.activePolls.get(pollId);
        if (!poll) return;

        poll.endedAt = Date.now();
        this.activePolls.delete(pollId);

        // Find winner
        let winner = null;
        let maxVotes = 0;
        
        poll.options.forEach(option => {
            if (option.votes > maxVotes) {
                maxVotes = option.votes;
                winner = option;
            }
        });

        // Send results
        const channel = client.channels.cache.get(poll.channelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor(Colors.Gold)
                .setTitle('🎊 Poll Results')
                .setDescription(poll.question)
                .addFields(
                    poll.options.map(option => ({
                        name: option.text,
                        value: `คะแนน: ${option.votes} | ${this.getPercentage(option.votes, poll.totalVotes)}%`,
                        inline: false
                    }))
                )
                .setFooter({ 
                    text: winner ? `ผู้ชนะ: ${winner.text} (${winner.votes} คะแนน)` : 'ไม่มีผู้ชนะ' 
                })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }
    }

    getPercentage(votes, total) {
        if (total === 0) return 0;
        return ((votes / total) * 100).toFixed(1);
    }

    formatTimeRemaining(endsAt) {
        const remaining = endsAt - Date.now();
        if (remaining <= 0) return 'จบแล้ว';

        const minutes = Math.floor(remaining / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} วัน`;
        if (hours > 0) return `${hours} ชั่วโมง`;
        return `${minutes} นาที`;
    }
}

const pollSystem = new PollSystem();

// ==================== WELCOME SYSTEM ====================
class WelcomeSystem {
    constructor() {
        this.setupWelcomeMessages();
    }

    setupWelcomeMessages() {
        client.on('guildMemberAdd', async member => {
            await this.sendWelcomeMessage(member);
            await this.assignDefaultRole(member);
            await this.logJoin(member);
        });

        client.on('guildMemberRemove', async member => {
            await this.sendGoodbyeMessage(member);
            await this.logLeave(member);
        });
    }

    async sendWelcomeMessage(member) {
        try {
            const channel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID) || 
                          member.guild.systemChannel;
            
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle(`🎉 ยินดีต้อนรับ ${member.user.username}!`)
                .setDescription(`ยินดีต้อนรับสู่ **${member.guild.name}**!`)
                .addFields(
                    { name: '👤 ผู้ใช้', value: `${member.user.tag}`, inline: true },
                    { name: '🆔 ID', value: member.id, inline: true },
                    { name: '📅 เข้าร่วม', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `คุณเป็นสมาชิกคนที่ ${member.guild.memberCount}` })
                .setTimestamp();

            await channel.send({ 
                content: `ยินดีต้อนรับ <@${member.id}>!`,
                embeds: [embed] 
            });
        } catch (error) {
            logger.error('Welcome message error:', error);
        }
    }

    async sendGoodbyeMessage(member) {
        try {
            const channel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID) || 
                          member.guild.systemChannel;
            
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(`👋 ลาก่อน ${member.user.username}!`)
                .setDescription(`**${member.user.tag}** ได้ออกจากเซิร์ฟเวอร์แล้ว`)
                .addFields(
                    { name: '⏰ อยู่กับเรา', value: this.formatDuration(Date.now() - member.joinedTimestamp), inline: true },
                    { name: '📅 ออกเมื่อ', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `เหลือสมาชิก ${member.guild.memberCount} คน` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Goodbye message error:', error);
        }
    }

    async assignDefaultRole(member) {
        try {
            const role = member.guild.roles.cache.get(CONFIG.ALLOWED_ROLE_ID);
            if (role) {
                await member.roles.add(role);
            }
        } catch (error) {
            logger.error('Assign role error:', error);
        }
    }

    async logJoin(member) {
        const logChannel = member.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (!logChannel) return;

        try {
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('📥 User Joined')
                .setDescription(`${member.user.tag} ได้เข้าร่วมเซิร์ฟเวอร์`)
                .addFields(
                    { name: 'ID', value: member.id, inline: true },
                    { name: 'Account Age', value: this.formatDuration(Date.now() - member.user.createdTimestamp), inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Join log error:', error);
        }
    }

    async logLeave(member) {
        const logChannel = member.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (!logChannel) return;

        try {
            const embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('📤 User Left')
                .setDescription(`${member.user.tag} ได้ออกจากเซิร์ฟเวอร์`)
                .addFields(
                    { name: 'ID', value: member.id, inline: true },
                    { name: 'Joined At', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                    { name: 'Stay Duration', value: this.formatDuration(Date.now() - member.joinedTimestamp), inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('Leave log error:', error);
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} วัน`;
        if (hours > 0) return `${hours} ชั่วโมง`;
        if (minutes > 0) return `${minutes} นาที`;
        return `${seconds} วินาที`;
    }
}

const welcomeSystem = new WelcomeSystem();

// ==================== AI CHAT SYSTEM ====================
class AIChatSystem {
    constructor() {
        this.conversations = new Map();
        this.setupAutoCleanup();
    }

    setupAutoCleanup() {
        // Clean up old conversations every hour
        setInterval(() => {
            const now = Date.now();
            this.conversations.forEach((convo, key) => {
                if (now - convo.lastActivity > 3600000) { // 1 hour
                    this.conversations.delete(key);
                }
            });
        }, 3600000);
    }

    async getResponse(userId, message, context = {}) {
        const memory = memorySystem.getUserMemory(userId);
        const conversation = this.getConversation(userId);
        
        // Add to conversation history
        conversation.messages.push({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Prepare context for AI
        const aiContext = {
            mood: memory.mood,
            affinity: memory.affinity,
            personality: memory.personality,
            conversationHistory: conversation.messages.slice(-10),
            userInfo: db.getUser(userId)
        };

        // Get AI response
        const response = await claudeAI.generateResponse(message, aiContext);
        
        // Add to conversation
        conversation.messages.push({
            role: 'assistant',
            content: response,
            timestamp: Date.now()
        });

        // Update memory
        this.updateMemoryFromResponse(userId, response, memory);
        
        // Update conversation activity
        conversation.lastActivity = Date.now();
        
        return response;
    }

    getConversation(userId) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                messages: [],
                createdAt: Date.now(),
                lastActivity: Date.now(),
                topic: '',
                sentiment: 'neutral'
            });
        }
        return this.conversations.get(userId);
    }

    updateMemoryFromResponse(userId, response, memory) {
        // Extract mood from response
        const moodMatch = response.match(/-#(\w+)/);
        if (moodMatch) {
            memory.mood = moodMatch[1];
        }

        // Analyze response sentiment
        const positiveWords = ['ดี', 'ยินดี', 'ชอบ', 'ขอบคุณ', 'สุข'];
        const negativeWords = ['ไม่ดี', 'เกลียด', 'โกรธ', 'เศร้า', 'ผิดหวัง'];
        
        let sentimentChange = 0;
        const responseLower = response.toLowerCase();
        
        positiveWords.forEach(word => {
            if (responseLower.includes(word)) sentimentChange += 0.1;
        });
        
        negativeWords.forEach(word => {
            if (responseLower.includes(word)) sentimentChange -= 0.1;
        });

        memory.affinity += sentimentChange;
        memory.affinity = Math.max(-100, Math.min(100, memory.affinity));
        
        memorySystem.updateUserMemory(userId, memory);
    }

    getConversationSummary(userId) {
        const conversation = this.getConversation(userId);
        const memory = memorySystem.getUserMemory(userId);
        
        return {
            messageCount: conversation.messages.length,
            lastActivity: new Date(conversation.lastActivity).toLocaleString(),
            currentMood: memory.mood,
            affinity: memory.affinity,
            topic: conversation.topic || 'ไม่ระบุ'
        };
    }

    clearConversation(userId) {
        if (this.conversations.has(userId)) {
            this.conversations.delete(userId);
            return true;
        }
        return false;
    }
}

const aiChatSystem = new AIChatSystem();

// ==================== CLIENT EVENT HANDLERS ====================
client.on('ready', () => {
    logger.info(`🤖 Logged in as ${client.user.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);
    
    // Set bot status
    client.user.setPresence({
        activities: [{
            name: 'Tokyo Ghoul | /help',
            type: ActivityType.Watching
        }],
        status: 'online'
    });

    // Initialize systems
    economySystem.initStocks();
    db.initShop();
    
    // Start background tasks
    startBackgroundTasks();
});

client.on('guildCreate', guild => {
    logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
    
    // Send welcome message to system channel
    const channel = guild.systemChannel || guild.channels.cache.find(ch => 
        ch.type === ChannelType.GuildText && 
        ch.permissionsFor(guild.me).has(PermissionFlagsBits.SendMessages)
    );
    
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('🤖 สวัสดี!')
            .setDescription('ขอบคุณที่เชิญฉันเข้ามาในเซิร์ฟเวอร์!\nฉันคือบอทที่ได้รับแรงบันดาลใจจาก Tokyo Ghoul')
            .addFields(
                { name: 'คำสั่ง', value: 'ใช้ `/help` เพื่อดูคำสั่งทั้งหมด' },
                { name: 'การตั้งค่า', value: 'ใช้ `/setup` เพื่อตั้งค่าเบื้องต้น' }
            )
            .setTimestamp();
        
        channel.send({ embeds: [embed] });
    }
});

client.on('guildDelete', guild => {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content.startsWith('/')) return;

    // Update user stats
    const user = db.updateUser(message.author.id, {
        lastSeen: Date.now(),
        messages: (db.getUser(message.author.id).messages || 0) + 1
    });

    // Add XP for message
    if (message.guild) {
        const xpResult = levelingSystem.addMessageXp(
            message.author.id,
            message.guild.id,
            message.content.length
        );
        
        if (xpResult && xpResult.leveledUp) {
            // Level up notification
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setDescription(`🎉 <@${message.author.id}> เลเวลขึ้นเป็น **${xpResult.newLevel}**!`)
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    // AI Response if in chat channel
    const mem = memorySystem.getUserMemory(message.author.id);
    if (mem.talkback) {
        // Check cooldown
        if (Date.now() - (mem.cooldown || 0) < 5000) return;
        
        mem.cooldown = Date.now();
        
        // Check if in allowed channels
        if (mem.chatChannels.length > 0 && 
            !mem.chatChannels.includes(message.channel.id) && 
            !message.channel.isDMBased()) {
            return;
        }

        // Get AI response
        try {
            await message.channel.sendTyping();
            const response = await aiChatSystem.getResponse(message.author.id, message.content);
            
            if (response && response.trim()) {
                await message.reply(response);
                
                // Update memory history
                memorySystem.addConversation(message.author.id, message.content, response);
            }
        } catch (error) {
            logger.error('AI response error:', error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    // Check role permission for all commands
    const allowedRoleId = CONFIG.ALLOWED_ROLE_ID;
    
    if (interaction.isChatInputCommand()) {
        if (!interaction.member.roles.cache.has(allowedRoleId)) {
            return interaction.reply({ 
                content: '❌ คุณไม่มีบทบาทที่จำเป็นสำหรับใช้คำสั่งนี้', 
                ephemeral: true 
            });
        }
    }

    if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
    }

    if (interaction.isModalSubmit()) {
        await handleModalInteraction(interaction);
    }

    if (interaction.isStringSelectMenu()) {
        await handleSelectMenuInteraction(interaction);
    }
});

// ==================== SLASH COMMAND HANDLERS ====================
const commandHandlers = {
    // Basic Commands
    async help(interaction) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('📚 คำสั่งทั้งหมด')
            .setDescription('รายการคำสั่งของบอท')
            .addFields(
                { name: '🎮 เกมส์', value: '`/hangman`, `/trivia`, `/rps`, `/slot`, `/coinflip`' },
                { name: '💰 เศรษฐกิจ', value: '`/balance`, `/daily`, `/work`, `/gamble`, `/shop`' },
                { name: '📈 เลเวล', value: '`/rank`, `/leaderboard`, `/level`' },
                { name: '🎫 ตั๋ว', value: '`/ticket create`, `/ticket close`, `/ticket add`, `/ticket remove`' },
                { name: '⚙️ การจัดการ', value: '`/clear`, `/warn`, `/mute`, `/kick`, `/ban`' },
                { name: '🎵 เพลง', value: '`/play`, `/stop`, `/skip`, `/queue`, `/volume`' },
                { name: '📊 โพล', value: '`/poll create`, `/poll end`' },
                { name: '⏰ ตัวเตือน', value: '`/reminder set`, `/reminder list`, `/reminder delete`' },
                { name: '🎪 อีเวนต์', value: '`/event create`, `/event join`, `/event list`' },
                { name: '🤖 AI', value: '`/chat`, `/memory`, `/mood`, `/ghoul`' },
                { name: '🔧 อื่นๆ', value: '`/weather`, `/userinfo`, `/serverinfo`, `/avatar`' }
            )
            .setFooter({ text: 'Total Commands: 50+' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async ping(interaction) {
        const sent = await interaction.reply({ 
            content: '🏓 Pinging...', 
            fetchReply: true 
        });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📶 Latency', value: `${latency}ms`, inline: true },
                { name: '🌐 API Latency', value: `${apiLatency}ms`, inline: true },
                { name: '🆙 Uptime', value: formatUptime(), inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    // AI Chat Commands
    async chat(interaction) {
        const message = interaction.options.getString('message');
        
        await interaction.deferReply();
        
        try {
            const response = await aiChatSystem.getResponse(interaction.user.id, message);
            await interaction.editReply(response);
        } catch (error) {
            await interaction.editReply('❌ เกิดข้อผิดพลาดในการสร้างคำตอบ');
        }
    },

    async memory(interaction) {
        const summary = memorySystem.getConversationSummary(interaction.user.id);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Purple)
            .setTitle('🧠 Memory Status')
            .addFields(
                { name: '💭 Total Interactions', value: summary.totalInteractions.toString(), inline: true },
                { name: '😊 Current Mood', value: summary.currentMood, inline: true },
                { name: '💖 Affinity Level', value: summary.affinityLevel, inline: true },
                { name: '🕒 Last Interaction', value: summary.lastInteraction, inline: false }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async ghoul(interaction) {
        const quote = tokyoGhoul.getRandomQuote();
        
        const embed = new EmbedBuilder()
            .setColor(Colors.DarkRed)
            .setTitle('🗡️ Tokyo Ghoul Quote')
            .setDescription(`"${quote}"`)
            .setFooter({ text: '- Ken Kaneki' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    // Economy Commands
    async balance(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const economy = db.getEconomy(user.id);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setTitle(`💰 ${user.username}'s Balance`)
            .addFields(
                { name: '💵 Cash', value: `${economy.balance} บาท`, inline: true },
                { name: '🏦 Bank', value: `${economy.bank} บาท`, inline: true },
                { name: '📈 Net Worth', value: `${economy.netWorth} บาท`, inline: true },
                { name: '📊 Daily Streak', value: `${economy.dailyStreak} วัน`, inline: true },
                { name: '💳 Total Transactions', value: economy.transactions.length.toString(), inline: true }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async daily(interaction) {
        const economy = db.getEconomy(interaction.user.id);
        const now = Date.now();
        const lastDaily = economy.lastDaily || 0;
        
        // Check if already claimed today
        if (now - lastDaily < 86400000) {
            const nextDaily = lastDaily + 86400000;
            const timeLeft = formatTimeRemaining(nextDaily - now);
            return interaction.reply({ 
                content: `⏳ คุณได้รับรางวัลประจำวันแล้ว! รออีก ${timeLeft}`,
                ephemeral: true 
            });
        }
        
        // Calculate streak
        const isConsecutive = now - lastDaily < 172800000; // Within 48 hours
        if (isConsecutive) {
            economy.dailyStreak++;
        } else {
            economy.dailyStreak = 1;
        }
        
        // Calculate reward
        let reward = CONFIG.ECONOMY.DAILY_REWARD;
        if (economy.dailyStreak >= 7) reward *= 2;
        if (economy.dailyStreak >= 30) reward *= 3;
        
        // Add bonus for streak milestones
        if (economy.dailyStreak % 7 === 0) reward += 500;
        if (economy.dailyStreak % 30 === 0) reward += 2000;
        
        db.addMoney(interaction.user.id, reward);
        economy.lastDaily = now;
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setTitle('🎁 Daily Reward')
            .setDescription(`คุณได้รับ ${reward} บาท!`)
            .addFields(
                { name: '📊 Streak', value: `${economy.dailyStreak} วัน`, inline: true },
                { name: '💰 Balance', value: `${economy.balance} บาท`, inline: true }
            )
            .setFooter({ text: `กลับมาใหม่ใน 24 ชั่วโมง!` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async work(interaction) {
        const jobIndex = interaction.options.getInteger('job') || 0;
        
        await interaction.deferReply();
        
        const result = await economySystem.work(interaction.user.id, jobIndex);
        
        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('💼 Work Complete')
                .setDescription(result.message)
                .addFields(
                    { name: '💰 Salary', value: `${result.salary} บาท`, inline: true },
                    { name: '⏰ Cooldown', value: '1 ชั่วโมง', inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ 
                content: `❌ ${result.message}`,
                ephemeral: true 
            });
        }
    },

    // Game Commands
    async hangman(interaction) {
        const difficulty = interaction.options.getString('difficulty') || 'medium';
        
        const game = gameSystem.startHangman(interaction.channel, interaction.user.id, difficulty);
        
        const display = gameSystem.getHangmanDisplay(game);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('🎮 Hangman Game')
            .setDescription('ทายคำศัพท์โดยพิมพ์ตัวอักษร!')
            .addFields(
                { name: 'คำ', value: `\`${display.display}\``, inline: false },
                { name: 'ตัวอักษรที่ผิด', value: display.incorrect || 'ไม่มี', inline: true },
                { name: 'เหลือโอกาส', value: `${display.attempts}/${game.maxAttempts}`, inline: true },
                { name: 'ความยาก', value: difficulty, inline: true }
            )
            .setFooter({ text: `Game ID: ${game.id} | หมดเวลาใน 5 นาที` })
            .setTimestamp();
        
        await interaction.reply({ 
            content: `🎮 ${interaction.user} เริ่มเกม Hangman!`,
            embeds: [embed] 
        });
    },

    async trivia(interaction) {
        const category = interaction.options.getString('category') || 'general';
        
        const game = gameSystem.startTrivia(interaction.channel, interaction.user.id, category);
        
        const row = new ActionRowBuilder();
        game.question.options.forEach((option, index) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`trivia_${game.id}_${index}`)
                    .setLabel(option)
                    .setStyle(ButtonStyle.Primary)
            );
        });
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Purple)
            .setTitle('❓ Trivia Game')
            .setDescription(game.question.question)
            .setFooter({ text: 'หมดเวลาใน 30 วินาที' })
            .setTimestamp();
        
        await interaction.reply({ 
            content: `🧠 ${interaction.user} เริ่มเกม Trivia!`,
            embeds: [embed],
            components: [row]
        });
    },

    // Music Commands
    async play(interaction) {
        const query = interaction.options.getString('song');
        
        await interaction.deferReply();
        
        try {
            const results = await musicSystem.search(query);
            if (results.length === 0) {
                return interaction.editReply('❌ ไม่พบเพลง');
            }
            
            const track = results[0];
            const voiceChannel = interaction.member.voice.channel;
            
            if (!voiceChannel) {
                return interaction.editReply('❌ คุณต้องอยู่ในช่องเสียง');
            }
            
            track.requestedBy = interaction.user.id;
            
            const queue = await musicSystem.play(interaction.guild.id, voiceChannel.id, track);
            
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('🎵 เพลงถูกเพิ่มเข้าคิว')
                .setDescription(`**[${track.title}](${track.url})**`)
                .addFields(
                    { name: 'Duration', value: musicSystem.formatDuration(track.duration), inline: true },
                    { name: 'Position', value: `${queue.tracks.length}`, inline: true }
                )
                .setThumbnail(track.thumbnail)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Play command error:', error);
            await interaction.editReply('❌ เกิดข้อผิดพลาด');
        }
    },

    // Moderation Commands
    async clear(interaction) {
        const amount = interaction.options.getInteger('amount') || 100;
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ 
                content: '❌ คุณไม่มีสิทธิ์ลบข้อความ',
                ephemeral: true 
            });
        }
        
        if (amount < 1 || amount > 100) {
            return interaction.reply({ 
                content: '❌ กรุณาระบุจำนวนระหว่าง 1-100',
                ephemeral: true 
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const messages = await interaction.channel.bulkDelete(amount, true);
            
            const embed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setDescription(`✅ ลบข้อความแล้ว ${messages.size} ข้อความ`)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Log the action
            moderationSystem.logAction('clear', interaction.user.id, interaction.guild.id, {
                amount: messages.size,
                channelId: interaction.channel.id
            });
        } catch (error) {
            await interaction.editReply('❌ เกิดข้อผิดพลาดในการลบข้อความ');
        }
    },

    async warn(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'ไม่มีเหตุผล';
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ 
                content: '❌ คุณไม่มีสิทธิ์เตือนผู้ใช้',
                ephemeral: true 
            });
        }
        
        await interaction.deferReply();
        
        try {
            const warning = await moderationSystem.warnUser(
                user.id,
                interaction.guild.id,
                reason,
                interaction.user.id
            );
            
            const embed = new EmbedBuilder()
                .setColor(Colors.Yellow)
                .setTitle('⚠️ User Warned')
                .setDescription(`**User:** ${user.tag} (${user.id})`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Total Warnings', value: db.getWarnings(user.id, interaction.guild.id).length.toString(), inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('❌ เกิดข้อผิดพลาด');
        }
    },

    // Level Commands
    async rank(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const levelData = db.getLevel(user.id);
        const rankData = levelingSystem.getLeaderboard(interaction.guild.id).find(r => r.userId === user.id);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Purple)
            .setTitle(`🏆 ${user.username}'s Rank`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '📊 Level', value: levelData.level.toString(), inline: true },
                { name: '⭐ XP', value: `${levelData.xp}/${levelingSystem.calculateRequiredXp(levelData.level)}`, inline: true },
                { name: '🏅 Rank', value: rankData ? `#${rankData.rank}` : 'N/A', inline: true },
                { name: '💬 Messages', value: levelData.messages.toString(), inline: true },
                { name: '🎤 Voice Time', value: `${Math.floor(levelData.voiceMinutes)} นาที`, inline: true },
                { name: '📈 Total XP', value: levelData.totalXp.toString(), inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async leaderboard(interaction) {
        const type = interaction.options.getString('type') || 'level';
        const limit = interaction.options.getInteger('limit') || 10;
        
        let entries = [];
        let title = '';
        
        switch (type) {
            case 'level':
                entries = levelingSystem.getLeaderboard(interaction.guild.id, limit);
                title = '🏆 Level Leaderboard';
                break;
            case 'money':
                const allEconomy = Object.entries(db.data.economy)
                    .map(([userId, data]) => ({
                        userId,
                        netWorth: data.netWorth
                    }))
                    .sort((a, b) => b.netWorth - a.netWorth)
                    .slice(0, limit);
                
                entries = allEconomy.map((entry, index) => ({
                    rank: index + 1,
                    userId: entry.userId,
                    value: entry.netWorth
                }));
                title = '💰 Money Leaderboard';
                break;
            case 'messages':
                const allUsers = Object.entries(db.data.users)
                    .map(([userId, data]) => ({
                        userId,
                        messages: data.messages || 0
                    }))
                    .sort((a, b) => b.messages - a.messages)
                    .slice(0, limit);
                
                entries = allUsers.map((entry, index) => ({
                    rank: index + 1,
                    userId: entry.userId,
                    value: entry.messages
                }));
                title = '💬 Messages Leaderboard';
                break;
        }
        
        const description = entries.map(entry => {
            return `**${entry.rank}.** <@${entry.userId}> - ${entry.value} ${type === 'money' ? 'บาท' : ''}`;
        }).join('\n') || 'ไม่มีข้อมูล';
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: `แสดง ${entries.length} อันดับแรก` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    // Ticket Commands
    async ticket(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                const reason = interaction.options.getString('reason') || 'ไม่มีเหตุผล';
                const ticket = await ticketSystem.createTicket(interaction.guild, interaction.user, reason);
                
                if (ticket) {
                    await interaction.reply({ 
                        content: `✅ ตั๋วถูกสร้างแล้ว! <#${ticket.channelId}>`,
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: '❌ ไม่สามารถสร้างตั๋วได้',
                        ephemeral: true 
                    });
                }
                break;
                
            case 'close':
                const ticketId = interaction.options.getString('id') || 
                               ticketSystem.activeTickets.get(interaction.channel.id);
                
                if (!ticketId) {
                    return interaction.reply({ 
                        content: '❌ ไม่พบตั๋วหรือไม่ใช่ช่องตั๋ว',
                        ephemeral: true 
                    });
                }
                
                const closed = await ticketSystem.closeTicket(interaction.guild.id, ticketId, interaction.user.id);
                
                if (closed) {
                    await interaction.reply({ 
                        content: '✅ ปิดตั๋วเรียบร้อยแล้ว',
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: '❌ ไม่สามารถปิดตั๋วได้',
                        ephemeral: true 
                    });
                }
                break;
        }
    },

    // Poll Commands
    async poll(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                const question = interaction.options.getString('question');
                const options = interaction.options.getString('options').split(',');
                const duration = interaction.options.getInteger('duration') || 24;
                
                if (options.length < 2 || options.length > 10) {
                    return interaction.reply({ 
                        content: '❌ กรุณาระบุตัวเลือก 2-10 ตัว',
                        ephemeral: true 
                    });
                }
                
                const poll = await pollSystem.createPoll(
                    interaction.channel.id,
                    question,
                    options,
                    duration * 3600000
                );
                
                if (poll) {
                    await interaction.reply({ 
                        content: '✅ สร้างโพลเรียบร้อยแล้ว!',
                        ephemeral: true 
                    });
                }
                break;
                
            case 'end':
                const pollId = interaction.options.getString('id');
                
                if (!pollId) {
                    return interaction.reply({ 
                        content: '❌ กรุณาระบุ ID โพล',
                        ephemeral: true 
                    });
                }
                
                await pollSystem.endPoll(pollId);
                await interaction.reply({ 
                    content: '✅ ปิดโพลเรียบร้อยแล้ว',
                    ephemeral: true 
                });
                break;
        }
    },

    // Reminder Commands
    async reminder(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'set':
                const time = interaction.options.getString('time');
                const message = interaction.options.getString('message');
                
                // Parse time (e.g., "1h30m", "2d", "30m")
                let milliseconds = 0;
                const timeRegex = /(\d+)([dhms])/g;
                let match;
                
                while ((match = timeRegex.exec(time)) !== null) {
                    const value = parseInt(match[1]);
                    const unit = match[2];
                    
                    switch (unit) {
                        case 'd': milliseconds += value * 86400000; break;
                        case 'h': milliseconds += value * 3600000; break;
                        case 'm': milliseconds += value * 60000; break;
                        case 's': milliseconds += value * 1000; break;
                    }
                }
                
                if (milliseconds === 0) {
                    return interaction.reply({ 
                        content: '❌ เวลาไม่ถูกต้อง (ใช้รูปแบบเช่น 1h30m, 2d, 30m)',
                        ephemeral: true 
                    });
                }
                
                const reminder = await reminderSystem.createReminder(
                    interaction.user.id,
                    Date.now() + milliseconds,
                    message,
                    interaction.channel.id
                );
                
                const embed = new EmbedBuilder()
                    .setColor(Colors.Blue)
                    .setTitle('⏰ ตั้งตัวเตือนแล้ว')
                    .setDescription(`ฉันจะเตือนคุณ <t:${Math.floor((Date.now() + milliseconds) / 1000)}:R>`)
                    .addFields(
                        { name: 'Message', value: message, inline: false },
                        { name: 'Duration', value: formatDuration(milliseconds), inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
                
            case 'list':
                const reminders = reminderSystem.getUserReminders(interaction.user.id);
                
                if (reminders.length === 0) {
                    return interaction.reply({ 
                        content: '📭 คุณไม่มีตัวเตือน',
                        ephemeral: true 
                    });
                }
                
                const reminderList = reminders.map(reminder => {
                    return `• **${reminder.message}** - <t:${Math.floor(reminder.time / 1000)}:R> (ID: ${reminder.id})`;
                }).join('\n');
                
                const embed2 = new EmbedBuilder()
                    .setColor(Colors.Blue)
                    .setTitle('📋 Your Reminders')
                    .setDescription(reminderList)
                    .setFooter({ text: `Total: ${reminders.length}` })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed2], ephemeral: true });
                break;
        }
    },

    // Event Commands
    async event(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
                    return interaction.reply({ 
                        content: '❌ คุณไม่มีสิทธิ์สร้างอีเวนต์',
                        ephemeral: true 
                    });
                }
                
                const name = interaction.options.getString('name');
                const description = interaction.options.getString('description');
                const duration = interaction.options.getInteger('duration') || 1;
                
                const event = eventSystem.createEvent(
                    name,
                    description,
                    'community',
                    Date.now(),
                    Date.now() + (duration * 3600000),
                    {
                        first: 1000,
                        second: 500,
                        third: 250
                    }
                );
                
                const embed = new EmbedBuilder()
                    .setColor(Colors.Gold)
                    .setTitle('🎪 Event Created')
                    .setDescription(`**${name}** ถูกสร้างแล้ว!`)
                    .addFields(
                        { name: 'Description', value: description, inline: false },
                        { name: 'Duration', value: `${duration} ชั่วโมง`, inline: true },
                        { name: 'Starts', value: '<t:' + Math.floor(event.startTime / 1000) + ':R>', inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                break;
                
            case 'join':
                const eventId = interaction.options.getString('id');
                
                if (!eventId) {
                    // Get active events
                    const activeEvents = eventSystem.getActiveEvents();
                    
                    if (activeEvents.length === 0) {
                        return interaction.reply({ 
                            content: '❌ ไม่มีอีเวนต์ที่กำลังเปิดอยู่',
                            ephemeral: true 
                        });
                    }
                    
                    const eventList = activeEvents.map(event => {
                        return `• **${event.name}** - ID: ${event.id}`;
                    }).join('\n');
                    
                    const embed2 = new EmbedBuilder()
                        .setColor(Colors.Blue)
                        .setTitle('🎪 Active Events')
                        .setDescription(eventList)
                        .setFooter({ text: 'ใช้ /event join <id> เพื่อเข้าร่วม' })
                        .setTimestamp();
                    
                    return interaction.reply({ embeds: [embed2], ephemeral: true });
                }
                
                const joined = eventSystem.joinEvent(eventId, interaction.user.id);
                
                if (joined) {
                    await interaction.reply({ 
                        content: '✅ คุณได้เข้าร่วมอีเวนต์แล้ว!',
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: '❌ ไม่สามารถเข้าร่วมอีเวนต์ได้',
                        ephemeral: true 
                    });
                }
                break;
        }
    },

    // Utility Commands
    async userinfo(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ 
                content: '❌ ไม่พบผู้ใช้ในเซิร์ฟเวอร์นี้',
                ephemeral: true 
            });
        }
        
        const userData = db.getUser(user.id);
        const levelData = db.getLevel(user.id);
        const economyData = db.getEconomy(user.id);
        
        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .map(role => role.toString())
            .join(', ') || 'ไม่มี';
        
        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor || Colors.Blue)
            .setTitle(`📊 ${user.username}'s Information`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '👤 Username', value: user.tag, inline: true },
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                { name: '🎭 Roles', value: roles.length > 1024 ? 'Too many roles' : roles, inline: false },
                { name: '📊 Level', value: levelData.level.toString(), inline: true },
                { name: '💰 Balance', value: `${economyData.balance} บาท`, inline: true },
                { name: '💬 Messages', value: userData.messages?.toString() || '0', inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async serverinfo(interaction) {
        const guild = interaction.guild;
        
        const channels = guild.channels.cache;
        const members = guild.members.cache;
        const roles = guild.roles.cache;
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle(`📊 ${guild.name} Information`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '🆔 ID', value: guild.id, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '📈 Humans', value: `${members.filter(m => !m.user.bot).size}`, inline: true },
                { name: '🤖 Bots', value: `${members.filter(m => m.user.bot).size}`, inline: true },
                { name: '📚 Channels', value: `${channels.size}`, inline: true },
                { name: '💬 Text', value: `${channels.filter(c => c.type === ChannelType.GuildText).size}`, inline: true },
                { name: '🎤 Voice', value: `${channels.filter(c => c.type === ChannelType.GuildVoice).size}`, inline: true },
                { name: '🎭 Roles', value: `${roles.size}`, inline: true },
                { name: '😄 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                { name: '🎨 Stickers', value: `${guild.stickers.cache.size}`, inline: true }
            )
            .setImage(guild.bannerURL({ size: 1024 }))
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async avatar(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle(`🖼️ ${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .addFields(
                { name: 'PNG', value: `[Link](${user.displayAvatarURL({ format: 'png', size: 4096 })})`, inline: true },
                { name: 'JPG', value: `[Link](${user.displayAvatarURL({ format: 'jpg', size: 4096 })})`, inline: true },
                { name: 'WEBP', value: `[Link](${user.displayAvatarURL({ format: 'webp', size: 4096 })})`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },

    async weather(interaction) {
        const city = interaction.options.getString('city');
        
        await interaction.deferReply();
        
        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=th`);
            const data = await response.json();
            
            if (data.cod !== 200) {
                return interaction.editReply('❌ ไม่พบเมืองหรือเกิดข้อผิดพลาด');
            }
            
            const embed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle(`🌤️ สภาพอากาศที่ ${data.name}, ${data.sys.country}`)
                .setThumbnail(`http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`)
                .addFields(
                    { name: '🌡️ อุณหภูมิ', value: `${data.main.temp}°C`, inline: true },
                    { name: '💨 ความชื้น', value: `${data.main.humidity}%`, inline: true },
                    { name: '💨 ลม', value: `${data.wind.speed} m/s`, inline: true },
                    { name: '🌅 ความกดอากาศ', value: `${data.main.pressure} hPa`, inline: true },
                    { name: '👁️ ทัศนวิสัย', value: `${data.visibility / 1000} km`, inline: true },
                    { name: '☁️ สภาพอากาศ', value: data.weather[0].description, inline: true }
                )
                .setFooter({ text: 'ข้อมูลจาก OpenWeatherMap' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Weather error:', error);
            await interaction.editReply('❌ เกิดข้อผิดพลาดในการดึงข้อมูล');
        }
    }
};

// ==================== INTERACTION HANDLERS ====================
async function handleButtonInteraction(interaction) {
    const [type, id, data] = interaction.customId.split('_');
    
    switch (type) {
        case 'close_ticket':
            const ticketId = ticketSystem.activeTickets.get(interaction.channel.id);
            if (ticketId) {
                await ticketSystem.closeTicket(interaction.guild.id, ticketId, interaction.user.id);
                await interaction.reply({ content: '✅ ปิดตั๋วเรียบร้อยแล้ว', ephemeral: true });
            }
            break;
            
        case 'poll':
            const pollId = id;
            const optionIndex = parseInt(data);
            
            const voted = await pollSystem.vote(pollId, interaction.user.id, optionIndex);
            if (voted) {
                await interaction.reply({ content: '✅ โหวตเรียบร้อยแล้ว!', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ ไม่สามารถโหวตได้', ephemeral: true });
            }
            break;
            
        case 'trivia':
            const triviaId = id;
            const answerIndex = parseInt(data);
            
            const result = gameSystem.answerTrivia(triviaId, answerIndex);
            if (result) {
                const message = result.correct ? '✅ คำตอบถูกต้อง!' : '❌ คำตอบผิด!';
                await interaction.reply({ content: message, ephemeral: true });
            }
            break;
    }
}

async function handleModalInteraction(interaction) {
    // Handle modal submissions
    // This can be expanded based on your modal needs
    await interaction.reply({ content: '✅ รับข้อมูลแล้ว!', ephemeral: true });
}

async function handleSelectMenuInteraction(interaction) {
    // Handle select menu interactions
    await interaction.reply({ content: '✅ รับข้อมูลแล้ว!', ephemeral: true });
}

// ==================== BACKGROUND TASKS ====================
function startBackgroundTasks() {
    // Update stock prices every 5 minutes
    setInterval(() => {
        economySystem.updateStockPrices();
    }, 300000);
    
    // Backup database every hour
    setInterval(() => {
        db.backup();
    }, CONFIG.BACKUP_INTERVAL);
    
    // Update bot status every 30 minutes
    setInterval(() => {
        const statuses = [
            `Tokyo Ghoul | ${client.guilds.cache.size} servers`,
            `with ${client.users.cache.size} users | /help`,
            'Tokyo Ghoul | Created by Ken Kaneki',
            'Tokyo Ghoul | Fighting for survival'
        ];
        
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        client.user.setPresence({
            activities: [{
                name: status,
                type: ActivityType.Watching
            }],
            status: 'online'
        });
    }, 1800000);
    
    logger.info('Background tasks started');
}

// ==================== UTILITY FUNCTIONS ====================
function formatUptime() {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatTimeRemaining(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} วัน ${hours % 24} ชั่วโมง`;
    if (hours > 0) return `${hours} ชั่วโมง ${minutes % 60} นาที`;
    if (minutes > 0) return `${minutes} นาที ${seconds % 60} วินาที`;
    return `${seconds} วินาที`;
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} วัน`;
    if (hours > 0) return `${hours} ชั่วโมง`;
    if (minutes > 0) return `${minutes} นาที`;
    return `${seconds} วินาที`;
}

// ==================== COMMAND REGISTRATION ====================
const commands = [
    // Basic Commands
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('แสดงคำสั่งทั้งหมด'),
    
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('ตรวจสอบความเร็วของบอท'),
    
    // AI Chat Commands
    new SlashCommandBuilder()
        .setName('chat')
        .setDescription('พูดคุยกับบอท')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('ข้อความที่ต้องการส่ง')
                .setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('memory')
        .setDescription('ดูสถานะความจำของบอท'),
    
    new SlashCommandBuilder()
        .setName('ghoul')
        .setDescription('สุ่มคำพูดจาก Tokyo Ghoul'),
    
    // Economy Commands
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('ดูยอดเงิน')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('ผู้ใช้ที่ต้องการดู')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('daily')
        .setDescription('รับรางวัลประจำวัน'),
    
    new SlashCommandBuilder()
        .setName('work')
        .setDescription('ทำงานหารายได้')
        .addIntegerOption(option => 
            option.setName('job')
                .setDescription('ประเภทงาน')
                .setRequired(false)
                .addChoices(
                    { name: 'โปรแกรมเมอร์', value: 0 },
                    { name: 'นักออกแบบ', value: 1 },
                    { name: 'ครีเอเตอร์', value: 2 },
                    { name: 'เทรดเดอร์', value: 3 },
                    { name: 'นักเขียน', value: 4 }
                )),
    
    // Game Commands
    new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('เล่นเกม Hangman')
        .addStringOption(option => 
            option.setName('difficulty')
                .setDescription('ระดับความยาก')
                .setRequired(false)
                .addChoices(
                    { name: 'ง่าย', value: 'easy' },
                    { name: 'ปานกลาง', value: 'medium' },
                    { name: 'ยาก', value: 'hard' }
                )),
    
    new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('เล่นเกมตอบคำถาม')
        .addStringOption(option => 
            option.setName('category')
                .setDescription('หมวดหมู่')
                .setRequired(false)
                .addChoices(
                    { name: 'ทั่วไป', value: 'general' },
                    { name: 'วิทยาศาสตร์', value: 'science' },
                    { name: 'บันเทิง', value: 'entertainment' }
                )),
    
    // Music Commands
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('เล่นเพลง')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('ชื่อหรือลิงก์เพลง')
                .setRequired(true)),
    
    // Moderation Commands
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('ลบข้อความหลายข้อความ')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('จำนวนข้อความที่ต้องการลบ (1-100)')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('เตือนผู้ใช้')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('ผู้ใช้ที่ต้องการเตือน')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('เหตุผล')
                .setRequired(false)),
    
    // Level Commands
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('ดูอันดับของคุณ')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('ผู้ใช้ที่ต้องการดู')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('ดูตารางคะแนน')
        .addStringOption(option => 
            option.setName('type')
                .setDescription('ประเภทตารางคะแนน')
                .setRequired(false)
                .addChoices(
                    { name: 'เลเวล', value: 'level' },
                    { name: 'เงิน', value: 'money' },
                    { name: 'ข้อความ', value: 'messages' }
                ))
        .addIntegerOption(option => 
            option.setName('limit')
                .setDescription('จำนวนอันดับที่ต้องการแสดง')
                .setRequired(false)),
    
    // Ticket Commands
    new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('จัดการตั๋ว')
        .addSubcommand(subcommand => 
            subcommand.setName('create')
                .setDescription('สร้างตั๋วใหม่')
                .addStringOption(option => 
                    option.setName('reason')
                        .setDescription('เหตุผล')
                        .setRequired(false)))
        .addSubcommand(subcommand => 
            subcommand.setName('close')
                .setDescription('ปิดตั๋ว')
                .addStringOption(option => 
                    option.setName('id')
                        .setDescription('ID ตั๋ว')
                        .setRequired(false))),
    
    // Poll Commands
    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('จัดการโพล')
        .addSubcommand(subcommand => 
            subcommand.setName('create')
                .setDescription('สร้างโพลใหม่')
                .addStringOption(option => 
                    option.setName('question')
                        .setDescription('คำถาม')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('options')
                        .setDescription('ตัวเลือก (คั่นด้วยเครื่องหมายจุลภาค)')
                        .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('duration')
                        .setDescription('ระยะเวลา (ชั่วโมง)')
                        .setRequired(false)))
        .addSubcommand(subcommand => 
            subcommand.setName('end')
                .setDescription('ปิดโพล')
                .addStringOption(option => 
                    option.setName('id')
                        .setDescription('ID โพล')
                        .setRequired(true))),
    
    // Reminder Commands
    new SlashCommandBuilder()
        .setName('reminder')
        .setDescription('จัดการตัวเตือน')
        .addSubcommand(subcommand => 
            subcommand.setName('set')
                .setDescription('ตั้งตัวเตือน')
                .addStringOption(option => 
                    option.setName('time')
                        .setDescription('เวลา (เช่น 1h30m, 2d, 30m)')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('message')
                        .setDescription('ข้อความเตือน')
                        .setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand.setName('list')
                .setDescription('ดูรายการตัวเตือน')),
    
    // Event Commands
    new SlashCommandBuilder()
        .setName('event')
        .setDescription('จัดการอีเวนต์')
        .addSubcommand(subcommand => 
            subcommand.setName('create')
                .setDescription('สร้างอีเวนต์ใหม่')
                .addStringOption(option => 
                    option.setName('name')
                        .setDescription('ชื่ออีเวนต์')
                        .setRequired(true))
                .addStringOption(option => 
                    option.setName('description')
                        .setDescription('คำอธิบาย')
                        .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('duration')
                        .setDescription('ระยะเวลา (ชั่วโมง)')
                        .setRequired(false)))
        .addSubcommand(subcommand => 
            subcommand.setName('join')
                .setDescription('เข้าร่วมอีเวนต์')
                .addStringOption(option => 
                    option.setName('id')
                        .setDescription('ID อีเวนต์')
                        .setRequired(false))),
    
    // Utility Commands
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('ดูข้อมูลผู้ใช้')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('ผู้ใช้ที่ต้องการดู')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('ดูข้อมูลเซิร์ฟเวอร์'),
    
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('ดูรูปโปรไฟล์')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('ผู้ใช้ที่ต้องการดู')
                .setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('weather')
        .setDescription('ดูสภาพอากาศ')
        .addStringOption(option => 
            option.setName('city')
                .setDescription('ชื่อเมือง')
                .setRequired(true))
].map(command => command.toJSON());

// ==================== CLIENT SETUP ====================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    // Check role permission
    const allowedRoleId = CONFIG.ALLOWED_ROLE_ID;
    if (!interaction.member.roles.cache.has(allowedRoleId)) {
        return interaction.reply({ 
            content: '❌ คุณไม่มีบทบาทที่จำเป็นสำหรับใช้คำสั่งนี้', 
            ephemeral: true 
        });
    }
    
    const commandName = interaction.commandName;
    const handler = commandHandlers[commandName];
    
    if (handler) {
        try {
            await handler(interaction);
        } catch (error) {
            logger.error(`Command error (${commandName}):`, error);
            await interaction.reply({ 
                content: '❌ เกิดข้อผิดพลาดในการรันคำสั่ง', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
});

// ==================== DEPLOY COMMANDS ====================
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    if (process.argv[2] === 'deploy') {
        try {
            logger.info('Started refreshing application (/) commands.');
            
            await rest.put(
                Routes.applicationCommands(process.env.APPLICATION_ID),
                { body: commands }
            );
            
            logger.info('Successfully reloaded application (/) commands.');
        } catch (error) {
            logger.error('Command deployment error:', error);
        }
        process.exit(0);
    }
})();

// ==================== LOGIN ====================
client.login(process.env.DISCORD_TOKEN);

// ==================== ERROR HANDLING ====================
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== EXPORT FOR TESTING ====================
module.exports = {
    client,
    db,
    memorySystem,
    tokyoGhoul,
    economySystem,
    levelingSystem,
    moderationSystem,
    ticketSystem,
    gameSystem,
    eventSystem,
    musicSystem,
    reminderSystem,
    pollSystem,
    welcomeSystem,
    aiChatSystem,
    commandHandlers
};