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
const CHAT_CHANNEL_ID = '1460867977305002125';

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

    if (/รัก|คิดถึง|ชอบ/.test(text)) mem.mood = 'affection';
    else if (/เศร้า|ร้องไห้|เสียใจ/.test(text)) mem.mood = 'sad';
    else if (/โกรธ|เหี้ย|โมโห/.test(text)) mem.mood = 'angry';
    else mem.mood = 'neutral';

    mem.history.push({ role: 'user', content: text });
    if (mem.history.length > 6) mem.history.shift();

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
// 4. Claude AI Chat (debug-friendly)
// ========================
async function getChatResponse(userMessage, memory) {
    try {
        console.log('🔹 เรียก Claude API ด้วยข้อความ:', userMessage);

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
คุณคือบอท Discord แบบ Ken Kaneki
- ปากแข็ง เย็นชา ขี้แกล้ง
- ใช้คำหยาบบางครั้ง เช่น "เหี้ย", "โง่", "งี่เง่า"
- ไม่มี emoji
- ตอบสั้น 1-2 ประโยค
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

        console.log('🔹 Status:', response.status, response.statusText);

        let data;
        try {
            data = await response.json();
            console.log('🔹 Response:', data);
        } catch (e) {
            console.error('❌ ไม่สามารถ parse JSON ได้:', e);
            return `❌ Claude API ตอบไม่ใช่ JSON! Status: ${response.status}`;
        }

        if (response.ok && data.completion) {
            return data.completion;
        } else {
            console.error('❌ Claude API Error:', response.status, response.statusText, data);
            return `❌ Claude API Error: Status ${response.status} - ${JSON.stringify(data)}`;
        }
    } catch (error) {
        console.error('❌ Error calling Claude API:', error);
        return `❌ Error calling Claude API: ${error.message}`;
    }
}

// ========================
// 5. Ready
// ========================
client.once('ready', async () => {
    console.log(`✅ บอทพร้อมใช้งานแล้ว: ${client.user.tag}`);
});

// ========================
// 6. AI Chat อัตโนมัติ
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
        try { await message.reply('❌ เหี้ย...งงหน่อย ลองอีกที'); } catch {}
    }
});

// ========================
// 7. Login
// ========================
client.login(process.env.DISCORD_TOKEN);