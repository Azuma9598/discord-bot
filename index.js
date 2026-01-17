require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');

// ---------------- Express -----------------
const app = express();
app.get('/', (_, res) => res.send('🤖 Bot running'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Web server running'));

// ---------------- Discord Client -----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ---------------- Memory -----------------
const MEMORY_FILE = './memory.json';
let DB = fs.existsSync(MEMORY_FILE) ? JSON.parse(fs.readFileSync(MEMORY_FILE)) : {};
function saveDB() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(DB, null, 2)); }
function memOf(user) {
    if (!DB[user.id]) DB[user.id] = { 
        name: user.username,
        affinity:0, mood:'neutral', sulk:0,
        lastSeen:Date.now(), talkback:false, history:[]
    };
    return DB[user.id];
}

// ---------------- Claude API -----------------
async function talk(text, mem) {
    try {
        const messages = mem.history
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .concat([{ role: 'user', content: text }])
            .slice(-50);

        const payload = {
            model: 'claude-sonnet-4-20250514',
            max_tokens_to_sample: 350,
            system: `คุณคือ Ken Kaneki ปากแข็ง แต่แคร์ roleplay
สถานะ: affinity:${mem.affinity} mood:${mem.mood}
ตอบสั้น กระชับ เบี้ยว โหด และแสดงความรู้สึกใน -#`,
            messages
        };

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error('Claude API Error:', res.status, await res.text());
            return 'เอ๊ะ...งงไปหมด';
        }

        const data = await res.json();
        if (data?.content && data.content[0]?.text) return data.content[0].text.trim();
        return 'เอ๊ะ...งงไปหมด';
    } catch (e) {
        console.error('Claude API error:', e);
        return 'เอ๊ะ...งงไปหมด';
    }
}

// ---------------- Auto-talk ทุก 10 นาที -----------------
setInterval(async () => {
    const now = Date.now();
    for (const uid in DB) {
        const mem = DB[uid];
        if (!mem.talkback) continue;
        const gap = now - mem.lastSeen;
        if (gap >= 10 * 60 * 1000) {
            mem.lastSeen = now;
            try {
                const channel = client.channels.cache.get('1460867977305002125');
                if (!channel || !channel.isTextBased()) continue;
                const reply = await talk('เงียบไปนานแล้ว...', mem);
                await channel.send(reply);
                mem.history.push({ role: 'assistant', content: reply });
                mem.history = mem.history.slice(-50);
                saveDB();
            } catch (e) { console.error('Auto-talk error:', e); }
        }
    }
}, 5000);

// ---------------- Command Handler -----------------
client.on('messageCreate', async msg => {
    if (msg.author.bot) return;
    if (msg.channel.id !== '1460867977305002125') return;

    const mem = memOf(msg.author);
    mem.lastSeen = Date.now();

    // ถ้าเริ่มด้วย !
    if (msg.content.startsWith('!')) {
        const args = msg.content.slice(1).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();

        try {
            if (cmd === 'talkback') {
                mem.talkback = args[0] === 'on';
                saveDB();
                return msg.reply(`✅ Talkback ${mem.talkback ? 'เปิด' : 'ปิด'} แล้ว`);
            }
            if (cmd === 'add_personal') {
                const n = parseInt(args[0]);
                if (!isNaN(n)) mem.affinity += n;
                saveDB();
                return msg.reply(`💖 ความสนิทตอนนี้ ${mem.affinity}`);
            }
            if (cmd === 'clear') {
                if (!msg.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return msg.reply('❌ ไม่มีสิทธิ์');
                const n = parseInt(args[0]) || 1;
                const deleted = await msg.channel.bulkDelete(n, true);
                return msg.reply(`🚮 ลบ ${deleted.size} ข้อความ`);
            }
            if (cmd === 'send') {
                const content = args.join(' ');
                await msg.channel.send(content);
                return msg.reply('✅ ส่งข้อความแล้ว');
            }
        } catch (e) { console.error('Command error:', e); return msg.reply('❌ เกิดข้อผิดพลาด'); }
        return;
    }

    // ---------------- Auto-talk + Response -----------------
    mem.history.push({ role: 'user', content: msg.content });
    mem.history = mem.history.slice(-50);

    try {
        await msg.channel.sendTyping();
        const reply = await talk(msg.content, mem);
        await msg.reply(reply);
        mem.history.push({ role: 'assistant', content: reply });
        mem.history = mem.history.slice(-50);
        saveDB();
    } catch (e) { console.error('Message reply error:', e); }
});

// ---------------- Login -----------------
client.login(process.env.DISCORD_TOKEN);