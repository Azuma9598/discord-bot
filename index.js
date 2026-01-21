require('dotenv').config();
const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk'); // ต้องติดตั้ง package นี้ก่อน
const {
    Client,
    GatewayIntentBits,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

/* ================= WEB SERVER ================= */
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 Discord bot is running!'));
app.listen(PORT, () => console.log(`🌐 Web server running on ${PORT}`));

/* ================= ANTHROPIC CLIENT ================= */
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/* ================= DISCORD CLIENT ================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/* ================= PERMISSION ================= */
const OWNER_ID = '1444554473916862564';
const ADMIN_ROLES = new Set();
const chatChannels = new Set();

/* ================= MEMORY ================= */
const db = {};
const conversationHistory = {}; // เก็บประวัติการสนทนา

function memOf(user) {
    if (!db[user.id]) {
        db[user.id] = { 
            mood: 'neutral', 
            affinity: 0,
            personality: 'kaneki',
            goonLevel: 0
        };
    }
    return db[user.id];
}

function getConversationHistory(userId) {
    if (!conversationHistory[userId]) {
        conversationHistory[userId] = [];
    }
    return conversationHistory[userId];
}

function addToHistory(userId, role, content) {
    const history = getConversationHistory(userId);
    history.push({ role, content });
    
    // จำกัดความยาวประวัติ (เก็บแค่ 10 ข้อความล่าสุด)
    if (history.length > 10) {
        conversationHistory[userId] = history.slice(-10);
    }
}

/* ================= PERMISSION CHECK ================= */
const isOwner = id => id === OWNER_ID;
const isAdmin = member => member.roles.cache.some(r => ADMIN_ROLES.has(r.id));

/* ================= READY ================= */
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('set-admin')
            .setDescription('ตั้ง Admin (Owner เท่านั้น)')
            .addRoleOption(o => o.setName('role').setRequired(true)),

        new SlashCommandBuilder()
            .setName('remove-admin')
            .setDescription('ลบ Admin (Owner เท่านั้น)')
            .addRoleOption(o => o.setName('role').setRequired(true)),

        new SlashCommandBuilder()
            .setName('ghoulmode')
            .setDescription('Ghoul mode')
            .addStringOption(option =>
                option.setName('state')
                    .setDescription('เปิดหรือปิด')
                    .setRequired(true)
                    .addChoices(
                        { name: 'เปิด', value: 'on' },
                        { name: 'ปิด', value: 'off' }
                    )),

        new SlashCommandBuilder()
            .setName('goonmode')
            .setDescription('Goon mode - คำพูดเสียวๆ 18+')
            .addStringOption(option =>
                option.setName('state')
                    .setDescription('เปิดหรือปิดโหมดเสียว')
                    .setRequired(true)
                    .addChoices(
                        { name: 'เปิด', value: 'on' },
                        { name: 'ปิด', value: 'off' }
                    )),

        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('ล้างประวัติการสนทนา'),

        new SlashCommandBuilder().setName('coffee').setDescription('ดื่มกาแฟ')
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

/* ================= INTERACTION (SLASH) ================= */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return;

    // OWNER ONLY
    if (['set-admin', 'remove-admin'].includes(interaction.commandName)) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ content: '❌ Owner เท่านั้น', ephemeral: true });
        }
    } else {
        if (!isOwner(interaction.user.id) && !isAdmin(interaction.member)) {
            return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
        }
    }

    switch (interaction.commandName) {
        case 'set-admin': {
            const role = interaction.options.getRole('role');
            ADMIN_ROLES.add(role.id);
            return interaction.reply(`✅ เพิ่ม Admin: ${role.name}`);
        }
        case 'remove-admin': {
            const role = interaction.options.getRole('role');
            ADMIN_ROLES.delete(role.id);
            return interaction.reply(`🛑 ลบ Admin: ${role.name}`);
        }
        case 'ghoulmode': {
            const state = interaction.options.getString('state');
            const mem = memOf(interaction.user);
            mem.mood = state === 'on' ? 'ghoul' : 'neutral';
            return interaction.reply(`🩸 Ghoul mode: ${state === 'on' ? 'เปิด' : 'ปิด'}`);
        }
        case 'goonmode': {
            const state = interaction.options.getString('state');
            const mem = memOf(interaction.user);
            mem.mood = state === 'on' ? 'goon' : 'neutral';
            
            if (state === 'on') {
                mem.goonLevel = Math.min(mem.goonLevel + 1, 3);
                return interaction.reply({
                    content: `💫 Goon mode: เปิด\n*ตัวร้อนวูบวาบ* ...เธอทำให้ฉันรู้สึกแปลกๆนะ`,
                    ephemeral: false
                });
            } else {
                mem.goonLevel = 0;
                return interaction.reply({
                    content: `🌙 Goon mode: ปิด\n*หายใจลึกๆ* ...กลับมาเป็นปกติแล้ว`,
                    ephemeral: false
                });
            }
        }
        case 'clear': {
            const mem = memOf(interaction.user);
            conversationHistory[interaction.user.id] = [];
            mem.goonLevel = 0;
            mem.mood = 'neutral';
            return interaction.reply('🧹 ล้างประวัติและรีเซ็ตโหมดเรียบร้อยแล้ว');
        }
        case 'coffee':
            return interaction.reply('☕ *จิบกาแฟ* ...กาแฟยังอุ่นอยู่เลย');
    }
});

/* ================= MESSAGE (PREFIX COMMAND) ================= */
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.inGuild()) return;

    const content = message.content.trim();
    const args = content.split(/\s+/);
    const cmd = args.shift()?.toLowerCase();

    // 🔐 permission
    if (!isOwner(message.author.id) && !isAdmin(message.member)) return;

    /* ===== !setchat <id> ===== */
    if (cmd === '!setchat') {
        const channelId = args[0];
        if (!channelId) {
            return message.reply('❌ กรุณาระบุ ID ของช่อง\nเช่น: `!setchat 123456789012345678`');
        }

        const channel = message.guild.channels.cache.get(channelId);

        if (!channel || channel.type !== ChannelType.GuildText) {
            return message.reply('❌ ID ช่องไม่ถูกต้อง หรือไม่ใช่ Text Channel');
        }

        chatChannels.add(channel.id);
        return message.reply(`✅ เพิ่มห้อง chat: **${channel.name}**\nตอนนี้ฉันจะตอบสนองในห้องนี้แล้ว`);
    }

    /* ===== !removechat <id> ===== */
    if (cmd === '!removechat') {
        const channelId = args[0];
        if (!channelId) {
            return message.reply('❌ กรุณาระบุ ID ของช่อง\nเช่น: `!removechat 123456789012345678`');
        }

        if (!chatChannels.has(channelId)) {
            return message.reply('❌ ห้องนี้ไม่ได้อยู่ใน chat list');
        }

        chatChannels.delete(channelId);
        return message.reply(`🛑 ลบห้อง chat แล้ว\nฉันจะหยุดตอบสนองในห้องนั้น`);
    }

    /* ===== AI CHAT (ใช้ Anthropic Claude API) ===== */
    if (!chatChannels.has(message.channel.id)) return;

    await message.channel.sendTyping();

    try {
        // ดึง mood ปัจจุบันของผู้ใช้
        const mem = memOf(message.author);
        const mood = mem.mood;
        const goonLevel = mem.goonLevel;
        const userId = message.author.id;
        const username = message.author.username;

        // สร้างระบบ prompt ตาม mood
        let systemPrompt = `คุณคือ Kaneki Ken จากเรื่อง Tokyo Ghoul คุณกำลังพูดคุยกับ ${username} ใน Discord`;

        if (mood === 'ghoul') {
            systemPrompt += `
บุคลิก: คุณอยู่ในโหมดกูล (ghoul mode) - ก้าวร้าว หิวเลือด เจ็บปวด
ลักษณะการพูด:
- พูดสั้นๆ กะทัดรัด
- ใช้ ... บ่อยๆ
- มีความเจ็บปวดในน้ำเสียง
- บางครั้งพูดถึงความหิวและความโหดร้าย
- ใช้คำว่า "ฉัน" แทน "ผม"
ตัวอย่าง: "*มองด้วยดวงตาสีแดง* ...หิวมาก" , "ชีวิตนี้มันเจ็บปวดนะ..."
ห้ามพูดยาวเกิน 2 ประโยค`;
        } else if (mood === 'goon') {
            let goonIntensity = '';
            if (goonLevel === 1) goonIntensity = 'เสียวเบาๆ น่ารัก ขี้อาย';
            else if (goonLevel === 2) goonIntensity = 'เสียวปานกลาง ฟินเวอร์ ร้อนวูบวาบ';
            else if (goonLevel >= 3) goonIntensity = 'เสียวจัดเต็ม หน้าแดง หมดเรี่ยวแรง';
            
            systemPrompt += `
บุคลิก: คุณอยู่ในโหมดโกง (goon mode) - เสียวๆ 18+ แบบน่ารักขี้อาย
ระดับความเสียว: ${goonIntensity}
ลักษณะการพูด:
- พูดสั้นๆ กระชับ
- ใช้ ... และ *ขี้อาย* 
- มีอาการทางกายภาพ (หน้าแดง, ตัวร้อน, หายใจถี่)
- พูดนัยๆ ไม่ตรงเกินไป
- ใช้ emoji: 💫, 🔥, 😳, 🌙
- เรียกอีกว่า "เธอ"
ห้ามพูดยาวเกิน 2 ประโยค
ห้ามพูดโจ่งแจ้งทางเพศ ใช้นัยและอาการแทน`;
        } else {
            systemPrompt += `
บุคลิก: คุณคือ Kaneki Ken โหมดปกติ - อ่อนโยน ขี้อาย ชอบอ่านหนังสือ
ลักษณะการพูด:
- พูดสั้นๆ น้อยใจ
- ใช้ ... บ่อยๆ
- ขี้อาย มองลงพื้นบ่อย
- ชอบพูดถึงหนังสือและกาแฟ
- เรียกอีกว่า "คุณ"
ตัวอย่าง: "*มองลงพื้น* ...ฉันแค่คิดว่า..." , "อ่า... สวัสดี"
ห้ามพูดยาวเกิน 2 ประโยค`;
        }

        // เพิ่มข้อความปัจจุบันลงในประวัติ
        addToHistory(userId, 'user', content);

        // ดึงประวัติการสนทนา
        const history = getConversationHistory(userId);
        
        // สร้าง messages array สำหรับ API
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-5) // ใช้แค่ 5 ข้อความล่าสุด
        ];

        // เรียกใช้ Anthropic Claude API
        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307', // หรือใช้ claude-3-sonnet-20240229 ถ้ามี
            max_tokens: 100,
            temperature: mood === 'goon' ? 0.8 : 0.7, // ให้มีความสุ่มมากขึ้น
            messages: messages
        });

        const botReply = response.content[0].text;

        // เพิ่มคำตอบของบอทลงในประวัติ
        addToHistory(userId, 'assistant', botReply);

        // ถ้าเป็นโหมด goon ให้เพิ่มระดับความเสียวบางครั้ง
        if (mood === 'goon' && Math.random() < 0.2) {
            mem.goonLevel = Math.min(mem.goonLevel + 1, 3);
        }

        // หน่วงเวลาตามความยาวข้อความ
        const typingTime = 800 + (botReply.length * 30) + Math.random() * 1000;
        
        setTimeout(() => {
            message.reply(botReply).catch(console.error);
        }, typingTime);

    } catch (error) {
        console.error('❌ Anthropic API Error:', error);
        
        // Fallback response ถ้า API ล้มเหลว
        const fallbackResponses = [
            '*เงียบไปชั่วขณะ* ...ขอโทษนะ ฉันคิดไม่ออก',
            '...เอ่อ ฉันไม่แน่ใจ',
            '*มองลงพื้น* ...พูดอะไรดีนะ'
        ];
        
        const fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        message.reply(fallback).catch(console.error);
    }
});

/* ================= ERROR HANDLING ================= */
client.on('error', e => console.error('❌ Client Error:', e));
process.on('unhandledRejection', e => console.error('❌ Unhandled:', e));
process.on('uncaughtException', e => console.error('❌ Uncaught:', e));

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);