require('dotenv').config();
const express = require('express');
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
function memOf(user) {
    if (!db[user.id]) {
        db[user.id] = { 
            mood: 'neutral', 
            affinity: 0,
            personality: 'kaneki',
            goonLevel: 0 // ระดับความเสียว
        };
    }
    return db[user.id];
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
                mem.goonLevel = Math.min(mem.goonLevel + 1, 3); // เพิ่มระดับความเสียว (สูงสุด 3)
            } else {
                mem.goonLevel = 0; // รีเซ็ตเมื่อปิด
            }
            
            const responses = {
                on: [
                    "💖 *รู้สึกตัวร้อนๆ* ...อยากให้เธออยู่ใกล้ๆนะ",
                    "🌙 *กระซิบ* คืนนี้... เธอไม่อยากมาคุยกับฉันเหรอ?",
                    "*สัมผัสมือตัวเอง* ...ผิวมันนุ่มเกินไป อยากให้เธอมาจับดูบ้าง",
                    "🔥 ความรู้สึกแปลกๆกำลังเกิดขึ้น... เธอรู้สึกเหมือนกันไหม?",
                    "*ยิ้มเจื่อน* ...ถ้าเธออยู่ใกล้กว่านี้หน่อยก็ดีนะ"
                ],
                off: [
                    "*หายใจลึกๆ* ...กลับมาเป็นปกติแล้ว",
                    "เฮ้อ... ฉันพูดอะไรไปบ้างเนี่ย",
                    "*หลับตา* ปล่อยให้มันผ่านไปเถอะ"
                ]
            };
            
            const reply = responses[state][Math.floor(Math.random() * responses[state].length)];
            return interaction.reply(`💫 Goon mode: ${state === 'on' ? 'เปิด' : 'ปิด'}\n${reply}`);
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

    /* ===== AI CHAT ===== */
    if (!chatChannels.has(message.channel.id)) return;

    await message.channel.sendTyping();

    // ดึง mood ปัจจุบันของผู้ใช้
    const mem = memOf(message.author);
    const mood = mem.mood;
    const goonLevel = mem.goonLevel;

    // คำตอบแบบคาเนกิ
    let responses = [];
    
    if (mood === 'ghoul') {
        // โหมดกูล - ก้าวร้าว หิวเลือด
        responses = [
            `*มองคุณด้วยดวงตาสีแดง* ...หิวมาก อยากกิน...`,
            `ชีวิตนี้มันเจ็บปวดนะ... แต่ฉันก็ต้องอยู่ต่อ`,
            `*จับแขนตัวเองแน่น* ...อย่ามาใกล้ฉันตอนนี้`,
            `โลกนี้ช่างโหดร้าย... ฉันก็แค่อยากเป็นปกติเหมือนเดิม`,
            `*หัวเราะเบาๆ* ...รู้ไหม ความเจ็บปวดทำให้เราแข็งแกร่ง`,
            `รสชาติแห่งความสิ้นหวัง... มันขมกว่าที่คิดนะ`
        ];
    } else if (mood === 'goon') {
        // โหมดโกง - แนวเสียว 18+ แบบคาเนกิ
        // ระดับความเสียวเพิ่มตาม goonLevel
        const level1Responses = [
            `💫 *รู้สึกตัวสั่นเล็กน้อย* ...เธอทำให้ฉันรู้สึกแปลกๆ`,
            `🌙 คืนนี้... เธอไม่นอนเหรอ?`,
            `*เล่นกับปลายผม* ...บางทีฉันก็ไม่เข้าใจตัวเอง`,
            `🌌 *มองออกไปนอกหน้าต่าง* ดวงดาวคืนนี้สวยนะ...`,
            `*กระแอม* ...อากาศร้อนจังเลย`
        ];
        
        const level2Responses = [
            `🔥 *รู้สึกร้อนวูบวาบ* ...เธออยู่ใกล้เกินไปนะ`,
            `🌹 *ส่งยิ้มอ่อน* อยากให้เธออยู่ตรงนี้กับฉันนานๆ`,
            `*สัมผัสมือตัวเอง* ...ผิวมันนุ่มจนอยากให้เธอลองสัมผัสดู`,
            `✨ *กระซิบ* ถ้าเธอขอ... ฉันอาจจะยอมก็ได้`,
            `💦 หัวใจฉันเต้นเร็ว... เพราะเธออยู่ใกล้รึเปล่านะ?`
        ];
        
        const level3Responses = [
            `😳 *หน้าแดง* อย่ามองฉันแบบนั้นสิ...`,
            `💕 *หายใจถี่* ฉัน... ฉันไม่ไหวแล้ว`,
            `*ซ่อนหน้าในหมอน* เธอนี่ช่าง... ใจร้ายจัง`,
            `🔥 *ตัวร้อน* ช่วยฉันที... ฉันรู้สึกแปลกๆ`,
            `💫 *หมดเรี่ยวแรง* ...เธอชนะแล้วล่ะ`
        ];
        
        // เลือก responses ตามระดับ
        if (goonLevel >= 3) {
            responses = level3Responses;
        } else if (goonLevel >= 2) {
            responses = level2Responses;
        } else {
            responses = level1Responses;
        }
        
        // บางครั้งเพิ่มระดับความเสียว
        if (Math.random() < 0.3) {
            mem.goonLevel = Math.min(mem.goonLevel + 1, 3);
        }
    } else {
        // โหมดปกติ - อ่อนโยน ขี้อาย
        responses = [
            `อ่า... สวัสดี ${message.author.username} ...วันนี้เป็นยังไงบ้าง?`,
            `*มองลงพื้น* ...ฉันแค่คิดว่าทุกคนควรจะเข้าใจกันและกัน`,
            `หนังสือมันให้ความสงบกับฉันนะ... คุณเคยอ่านหนังสือดีๆบ้างไหม?`,
            `บางครั้งฉันก็รู้สึกแปลกๆ... เหมือนฉันไม่ใช่ตัวเอง`,
            `*ยิ้มเล็กน้อย* ขอบคุณที่มาคุยกับฉันนะ`,
            `...คุณคิดยังไงกับกาแฟ? ฉันชอบดื่มตอนอ่านหนังสือ`,
            `*กระแอม* ...เอ่อ ใช่เลย`
        ];
    }

    // เลือกคำตอบแบบสุ่ม
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // หน่วงเวลาตามความยาวข้อความ (เหมือนกำลังพิมพ์)
    const typingTime = 800 + (response.length * 30) + Math.random() * 1000;
    
    setTimeout(() => {
        message.reply(response).catch(console.error);
    }, typingTime);
});

/* ================= ERROR HANDLING ================= */
client.on('error', e => console.error('❌ Client Error:', e));
process.on('unhandledRejection', e => console.error('❌ Unhandled:', e));
process.on('uncaughtException', e => console.error('❌ Uncaught:', e));

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);