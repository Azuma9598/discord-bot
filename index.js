const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// ========================
// 0. Express Server
// ========================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 บอท Discord กำลังทำงานอยู่!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server กำลังทำงานที่ port ${PORT}`);
});

// ========================
// 1. Discord Client
// ========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ========================
// 2. ตั้งค่า
// ========================
const ANNOUNCE_CHANNEL_ID = '1432780520571539558';
const REQUIRED_ROLE_IDS = ['1432772884371079208', '1459925314456260719'];
const MENTION_ROLE_ID = '1432795396861595840';
const CHAT_CHANNEL_ID = '1460867977305002125'; // ช่องแชท AI

// ========================
// 3. ระบบความจำคน (Affinity + Mood + Context)
// ========================
const userMemory = new Map();

function updateUserMemory(message) {
    const id = message.author.id;

    if (!userMemory.has(id)) {
        userMemory.set(id, {
            name: message.author.username,
            affinity: 0,
            mood: 'neutral',
            history: [],
            lastTalk: Date.now()
        });
    }

    const mem = userMemory.get(id);

    mem.affinity += 1;
    mem.lastTalk = Date.now();

    const text = message.content;

    // วิเคราะห์อารมณ์หยาบๆ
    if (/รัก|คิดถึง|ชอบ/.test(text)) mem.mood = 'affection';
    else if (/เศร้า|ร้องไห้|เสียใจ/.test(text)) mem.mood = 'sad';
    else if (/โกรธ|เหี้ย|โมโห/.test(text)) mem.mood = 'angry';
    else mem.mood = 'neutral';

    // เก็บประวัติ chat ล่าสุด 6 ข้อความ
    mem.history.push({ role: 'user', content: text });
    if (mem.history.length > 6) mem.history.shift();

    // ระบบหวงถ้าพูดถึงคนอื่นและ affinity สูง
    if (/ใคร|คนอื่น|เขา/.test(text) && mem.affinity > 10) mem.mood = 'jealous';

    return mem;
}

function getTimeMood() {
    const hour = new Date().getHours();
    if (hour >= 0 && hour <= 5) return 'night-soft';
    if (hour >= 6 && hour <= 11) return 'calm';
    if (hour >= 12 && hour <= 18) return 'normal';
    return 'dark';
}

// ========================
// 4. Claude AI Chat
// ========================
async function getChatResponse(userMessage, memory) {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY || '',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 500,
                messages: [
                    {
                        role: 'system',
                        content: `
คุณคือบอท Discord แบบ Ken Kaneki จาก Tokyo Ghoul
- ปากแข็ง เย็นชา ขี้แกล้ง
- ใช้คำหยาบบางครั้ง เช่น "เหี้ย", "โง่", "งี่เง่า"
- ไม่มี emoji
- ต้องตอบสั้น 1-2 ประโยค
- ระบุ 2 ส่วน: พูด / -# ความคิดในใจ

ข้อมูลผู้ใช้:
- ชื่อ: ${memory.name}
- ความสนิท: ${memory.affinity}
- อารมณ์ล่าสุด: ${memory.mood}
- ช่วงเวลา: ${getTimeMood()}

กฎความสัมพันธ์:
- affinity < 5 : เย็น เบี้ยว ห่าง
- affinity 5–15 : แกล้ง ห่วง แต่ปากแข็ง
- affinity > 15 : หวง ปกป้อง แต่ยังปากแข็ง
- ผู้ใช้เศร้า → อ่อนโยนแต่ยังทำเป็นเฉย
- ผู้ใช้แสดงความรัก → ปฏิเสธแรงขึ้นแต่ความคิดในใจหวั่นไหว
- ถ้าพูดถึงคนอื่นและ affinity > 10 → mood = jealous

ประวัติแชทล่าสุด: ${memory.history.map(h => h.content).join(' | ')}
`
                    },
                    ...memory.history,
                    { role: 'user', content: userMessage }
                ]
            })
        });

        if (!response.ok) {
            console.error('Claude API Error:', response.status, response.statusText);
            return 'เหี้ยเอ้ย...งงไปหมด ลองใหม่';
        }

        const data = await response.json();
        if (data.content && data.content[0] && data.content[0].text) {
            return data.content[0].text;
        }
        return 'อืม...ฉันไม่รู้จะตอบยังไงเหี้ยๆ';
    } catch (error) {
        console.error('Error calling Claude API:', error);
        return 'โธ่เอ๊ย...มีปัญหานิดหน่อย';
    }
}

// ========================
// 5. เมื่อบอทพร้อม
// ========================
client.once('ready', async () => {
    console.log(`✅ บอทพร้อมใช้งานแล้ว: ${client.user.tag}`);

    // ลงทะเบียน Slash Commands
    const commands = [
        new SlashCommandBuilder().setName('ประกาศ').setDescription('ส่งข้อความประกาศ').addStringOption(opt => opt.setName('ข้อความ').setDescription('ข้อความ').setRequired(true)),
        new SlashCommandBuilder().setName('token').setDescription('ดู Token ของบอท (ล้อเล่น)'),
        new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความ').addIntegerOption(opt => opt.setName('จำนวน').setDescription('จำนวนข้อความ').setRequired(true).setMinValue(1).setMaxValue(100)),
        new SlashCommandBuilder().setName('send').setDescription('ส่งข้อความหลายรอบ').addStringOption(opt => opt.setName('ข้อความ').setDescription('ข้อความ').setRequired(true)).addChannelOption(opt => opt.setName('ห้อง').setDescription('ช่อง').setRequired(true)).addIntegerOption(opt => opt.setName('จำนวนรอบ').setDescription('จำนวน').setRequired(true).setMinValue(1).setMaxValue(10)),
        new SlashCommandBuilder().setName('help').setDescription('แสดงคำสั่งทั้งหมด')
    ];

    try {
        await client.application.commands.set([]);
        for (const guild of client.guilds.cache.values()) {
            await guild.commands.set(commands);
            console.log(`✅ ลงทะเบียนคำสั่งสำหรับ: ${guild.name}`);
        }
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

// ========================
// 6. ระบบตอบแชทอัตโนมัติ
// ========================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== CHAT_CHANNEL_ID) return;
    if (message.content.startsWith('/')) return;

    try {
        await message.channel.sendTyping();
        const memory = updateUserMemory(message);
        const response = await getChatResponse(message.content, memory);
        await message.reply(response);
        console.log(`💬 AI ตอบ: "${message.content}" -> "${response}"`);
    } catch (error) {
        console.error('❌ Chat error:', error);
        try { await message.reply('เหี้ย...งงหน่อย ลองอีกที'); } catch {}
    }
});

// ========================
// 7. จัดการ Slash Commands
// ========================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // ที่เหลือใช้โค้ด Slash Commands ของคุณเดิมได้เลย
});

// ========================
// 8. Login
// ========================
client.login(process.env.DISCORD_TOKEN);