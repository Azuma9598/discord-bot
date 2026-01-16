const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

/* ================= Express ================= */
const app = express();
app.get('/', (_, res) => res.send('Bot running'));
app.listen(process.env.PORT || 3000);

/* ================= Discord ================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CHAT_CHANNEL_ID = '1460867977305002125';

/* ================= Memory ================= */
const memoryMap = new Map();

function getTimeMood() {
    const h = new Date().getHours();
    if (h < 6) return 'night';
    if (h < 12) return 'morning';
    if (h < 18) return 'day';
    return 'dark';
}

function getMemory(user) {
    if (!memoryMap.has(user.id)) {
        memoryMap.set(user.id, {
            name: user.username,
            affinity: 0,
            mood: 'neutral',
            history: []
        });
    }
    return memoryMap.get(user.id);
}

/* ================= Claude ================= */
async function getChatResponse(text, mem) {
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 500,

                system: `
คุณคือบอท Discord บุคลิกเย็นชา ปากแข็ง
- ใช้คำพูดแรงได้บ้าง
- ไม่มี emoji
- ทุกคำตอบต้องมี:
1) คำพูด
2) -# ความคิดในใจ (ตรงข้าม)

ชื่อผู้ใช้: ${mem.name}
ความสนิท: ${mem.affinity}
อารมณ์: ${mem.mood}
เวลา: ${getTimeMood()}
`,

                messages: [
                    ...mem.history,
                    { role: 'user', content: text }
                ]
            })
        });

        const data = await res.json();

        // ✅ ถ้ามี text ถือว่าสำเร็จทันที
        if (data?.content?.[0]?.text) {
            return data.content[0].text;
        }

        console.error('Claude bad response:', data);
        return 'ตอบไม่ได้ ลองใหม่อีกที';

    } catch (err) {
        console.error('Claude fetch error:', err);
        return 'ระบบขัดข้อง';
    }
}

/* ================= Message Handler ================= */
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (msg.channel.id !== CHAT_CHANNEL_ID) return;

    const mem = getMemory(msg.author);

    // วิเคราะห์อารมณ์ (ยังไม่ใส่ history)
    const t = msg.content;
    mem.affinity++;

    if (/รัก|คิดถึง|ชอบ/.test(t)) mem.mood = 'affection';
    else if (/เศร้า|เสียใจ/.test(t)) mem.mood = 'sad';
    else if (/โกรธ|โมโห/.test(t)) mem.mood = 'angry';
    else mem.mood = 'neutral';

    try {
        await msg.channel.sendTyping();

        const reply = await getChatResponse(t, mem);

        // ✅ ตอบ Discord แค่ครั้งเดียว
        await msg.reply(reply);

        // ✅ ค่อยบันทึก memory หลังตอบ
        mem.history.push({ role: 'user', content: t });
        mem.history.push({ role: 'assistant', content: reply });

        // จำกัด history
        if (mem.history.length > 10) {
            mem.history = mem.history.slice(-10);
        }

    } catch (e) {
        console.error(e);
    }
});

/* ================= Ready ================= */
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);