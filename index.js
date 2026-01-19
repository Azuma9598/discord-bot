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
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

/* ================= DISCORD CLIENT ================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/* ================= CONFIG ================= */
const ALLOWED_ROLE_ID = '1432773041640706149';
const ANNOUNCE_CHANNEL_ID = '1432780520571539558';

/* ================= CHAT CHANNELS GLOBAL ================= */
const chatChannels = new Set();

/* ================= DATABASE MOCK ================= */
const db = {};
function memOf(user) {
    if (!db[user.id]) {
        db[user.id] = {
            affinity: 0,
            mood: 'neutral',
            lastSeen: Date.now(),
            history: [],
            autochat: false
        };
    }
    return db[user.id];
}
function saveDB() {}

/* ================= ANTHROPIC CLAUDE API ================= */
async function getClaudeReply(message, mem) {
    let style = '';
    if(mem.mood==='ghoul') style = 'You are hungry for blood, violent, dark.';
    else if(mem.mood==='goon') style = 'You are seductive, naughty, flirty.';
    else style = 'You are calm, neutral, Ken Kaneki style.';

    const systemPrompt = `You are Ken Kaneki from Tokyo Ghoul. ${style}
Respond in his style.
Use:
.(ข้อความ) for actions
-# ข้อความ for inner thoughts
Include mild profanity naturally if appropriate.`;

    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('❌ ไม่พบ ANTHROPIC_API_KEY ใน .env file');
            return '❌ Bot ไม่ได้ตั้งค่า API key';
        }

        console.log('📤 Sending request to Claude API...');

        // ใช้ Claude 3.5 ล่าสุด
        const res = await fetch('https://api.anthropic.com/v1/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY
            },
            body: JSON.stringify({
                model: 'claude-3.5',  // ใช้ model ล่าสุด
                prompt: `${systemPrompt}\n\nHuman: ${message}\n\nAssistant:`,
                max_tokens_to_sample: 200,
                temperature: 0.7
            })
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('❌ Claude API error:', JSON.stringify(data, null, 2));
            if (data.error?.type === 'authentication_error') return '❌ API Key ไม่ถูกต้อง';
            else if (data.error?.type === 'rate_limit_error') return '❌ ใช้งาน API เกินจำนวนที่กำหนด';
            else if (data.error?.type === 'invalid_request_error') return `❌ Request ไม่ถูกต้อง: ${data.error?.message}`;
            return `❌ API Error: ${data.error?.message || 'Unknown error'}`;
        }

        if (!data.completion) {
            console.error('❌ No content in response:', data);
            return '❌ AI ไม่ได้ตอบกลับ';
        }

        const reply = data.completion.trim();
        console.log('✅ Claude reply:', reply);
        return reply;

    } catch(err) {
        console.error('❌ Claude API error:', err);
        if (err.code === 'ENOTFOUND') return '❌ ไม่สามารถเชื่อมต่อ API ได้ (ตรวจสอบอินเทอร์เน็ต)';
        else if (err.name === 'AbortError') return '❌ Request timeout';
        return `❌ เกิดข้อผิดพลาด: ${err.message}`;
    }
}

/* ================= REGISTER GLOBAL SLASH COMMANDS ================= */
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('⚠️ WARNING: ANTHROPIC_API_KEY not found in .env file!');
    } else {
        console.log('✅ ANTHROPIC_API_KEY found');
    }

    const commands = [
        new SlashCommandBuilder().setName('add_personal').setDescription('เพิ่มค่า affinity')
            .addIntegerOption(opt => opt.setName('amount').setDescription('จำนวน').setRequired(true)),
        new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความ')
            .addIntegerOption(opt => opt.setName('amount').setDescription('จำนวนข้อความที่จะลบ')),
        new SlashCommandBuilder().setName('send').setDescription('ส่งข้อความ')
            .addStringOption(opt => opt.setName('message').setDescription('ข้อความ').setRequired(true))
            .addChannelOption(opt => opt.setName('channel').setDescription('เลือก channel'))
            .addIntegerOption(opt => opt.setName('count').setDescription('จำนวนครั้ง')),
        new SlashCommandBuilder().setName('ghoulmode').setDescription('เปิด/ปิด Ghoul mode'),
        new SlashCommandBuilder().setName('goonmode').setDescription('เปิด/ปิด Goon mode'),
        new SlashCommandBuilder().setName('coffee').setDescription('ดื่มกาแฟ'),
        new SlashCommandBuilder().setName('setchat').setDescription('ตั้งห้อง chat')
            .addChannelOption(opt => opt.setName('channel').setDescription('เลือก channel').setRequired(true)),
        new SlashCommandBuilder().setName('stopchat').setDescription('หยุด chat ทุกห้อง'),
        new SlashCommandBuilder().setName('autochat').setDescription('เปิด/ปิด autochat')
            .addStringOption(opt => opt.setName('toggle').setDescription('on หรือ off').setRequired(true)
            .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' })),
        new SlashCommandBuilder().setName('token').setDescription('สุ่มคำเบียวๆ'),
        new SlashCommandBuilder().setName('ประกาศ').setDescription('ประกาศข้อความ')
            .addStringOption(opt => opt.setName('message').setDescription('ข้อความที่จะประกาศ').setRequired(true))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Global slash commands registered!');
    } catch (err) {
        console.error('❌ Failed to register commands:', err);
    }
});

/* ================= INTERACTION ================= */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) return interaction.reply({ content: '❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์', ephemeral: true });
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) return interaction.reply({ content: '❌ คุณไม่มียศที่ใช้คำสั่งนี้ได้', ephemeral: true });

    const mem = memOf(interaction.user);
    mem.lastSeen = Date.now();

    try {
        switch(interaction.commandName){
            case 'goonmode': {
                mem.mood = (mem.mood==='goon')?'neutral':'goon';
                saveDB();
                return interaction.reply(`💀 Goon mode ${mem.mood==='goon'?'เปิด':'ปิด'} แล้ว`);
            }
            case 'ghoulmode': {
                mem.mood = (mem.mood==='ghoul')?'neutral':'ghoul';
                saveDB();
                return interaction.reply(`🩸 Ghoul mode ${mem.mood==='ghoul'?'เปิด':'ปิด'} แล้ว`);
            }
            case 'setchat': {
                const channel = interaction.options.getChannel('channel');
                if(!channel||channel.type!==ChannelType.GuildText) return interaction.reply('❌ ต้องเป็น Text Channel');
                chatChannels.add(channel.id);
                return interaction.reply(`✅ ตั้งห้อง ${channel.name} แล้ว (bot จะตอบกลับข้อความในห้องนี้)`);
            }
            case 'stopchat': {
                chatChannels.clear();
                return interaction.reply('🛑 หยุดพูดคุยทั้งหมดแล้ว');
            }
            case 'token': {
                const quotes = [
                    "ข้าคือเงาที่โลกนี้ไม่ต้องการ",
                    "โลกนี้มันเน่า… และข้าจะเผามัน",
                    "หากข้าคือปีศาจ เจ้าก็คือเหยื่อ",
                    "อย่ามองตาข้า ถ้าไม่อยากหลุดจากความจริง",
                    "ความอ่อนแอคือบาป"
                ];
                return interaction.reply(`🗡️ "${quotes[Math.floor(Math.random()*quotes.length)]}"`);
            }
        }
    } catch(err){
        console.error('❌ Interaction error:', err);
        if(!interaction.replied && !interaction.deferred) {
            interaction.reply({content:'❌ เกิดข้อผิดพลาด',ephemeral:true}).catch(console.error);
        }
    }
});

/* ================= MESSAGE RESPONSE ================= */
client.on('messageCreate', async message => {
    if(message.author.bot) return;
    if(!chatChannels.has(message.channel.id)) return;

    console.log(`💬 Received message from ${message.author.tag}: ${message.content}`);

    try {
        const mem = memOf(message.author);
        await message.channel.sendTyping();
        const reply = await getClaudeReply(message.content, mem);
        setTimeout(() => {
            message.reply(reply).catch(err => console.error('❌ Failed to send reply:', err));
        }, Math.floor(Math.random() * 2000) + 500);

    } catch(err) {
        console.error('❌ Message handling error:', err);
        message.reply('❌ เกิดข้อผิดพลาดในการประมวลผล').catch(console.error);
    }
});

/* ================= ERROR HANDLING ================= */
client.on('error', error => console.error('❌ Discord client error:', error));
process.on('unhandledRejection', error => console.error('❌ Unhandled promise rejection:', error));

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Failed to login:', err);
    process.exit(1);
});