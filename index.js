const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

/* =========================
   0. Express (กัน Render หลับ)
========================= */
const app = express();
app.get('/', (_, res) => res.send('Bot running'));
app.listen(process.env.PORT || 3000);

/* =========================
   1. Discord Client
========================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/* =========================
   2. Config
========================= */
const CHAT_CHANNEL_ID = '1460867977305002125';

/* =========================
   3. Memory System
========================= */
const memoryMap = new Map();

function getTimeMood() {
    const h = new Date().getHours();
    if (h < 6) return 'night';
    if (h < 12) return 'morning';
    if (h < 18) return 'day';
    return 'dark';
}

function updateMemory(message) {
    const id = message.author.id;

    if (!memoryMap.has(id)) {
        memoryMap.set(id, {
            name: message.author.username,
            affinity: 0,
            mood: 'neutral',
            history: []
        });
    }

    const mem = memoryMap.get(id);
    mem.affinity++;

    const text = message.content;

    if (/รัก|คิดถึง|ชอบ/.test(text)) mem.mood = 'affection';
    else if (/เศร้า|เสียใจ|ร้องไห้/.test(text)) mem.mood = 'sad';
    else if (/เหี้ย|โกรธ|โมโห/.test(text)) mem.mood = 'angry';
    else mem.mood = 'neutral';

    // ❌ ห้ามมี system
    mem.history.push({ role: 'user', content: text });
    if (mem.history.length > 6) mem.history.shift();

    return mem;
}

/* =========================
   4. Claude AI (แก้สมบูรณ์)
========================= */
async function getChatResponse(userMessage, memory) {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 500,

                // ✅ system ต้องอยู่นอก messages
                system: `
คุณคือบอท Discord บุคลิก Ken Kaneki
- ปากแข็ง เบี้ยว เย็นชา
- ใช้คำหยาบได้ เช่น เหี้ย โง่ งี่เง่า
- ไม่มี emoji
- ทุกคำตอบต้องมี 2 ส่วน:
1) คำพูด
2) -# ความคิดในใจ (ตรงข้าม)

ข้อมูลผู้ใช้:
ชื่อ: ${memory.name}
ความสนิท: ${memory.affinity}
อารมณ์: ${memory.mood}
เวลา: ${getTimeMood()}
`,

                // ✅ messages = user / assistant เท่านั้น
                messages: [
                    ...memory.history,
                    { role: 'user', content: userMessage }
                ]
            })
        });

        const data = await response.json();

        // ✅ วิธีอ่านคำตอบที่ถูกต้อง
        if (response.ok && data.content?.[0]?.text) {
            return data.content[0].text;
        }

        console.error('Claude API Error:', data);
        return 'เหี้ย…ระบบแม่งรวน ลองใหม่';

    } catch (err) {
        console.error('Claude Fetch Error:', err);
        return 'เหี้ยเอ้ย เซิร์ฟเวอร์ล้ม';
    }
}

/* =========================
   5. Message Handler
========================= */
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== CHAT_CHANNEL_ID) return;

    try {
        await message.channel.sendTyping();
        const memory = updateMemory(message);
        const reply = await getChatResponse(message.content, memory);
        await message.reply(reply);
    } catch (e) {
        console.error(e);
        message.reply('เหี้ย…พัง');
    }
});

/* =========================
   6. Ready + Login
========================= */
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);