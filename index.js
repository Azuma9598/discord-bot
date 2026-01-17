require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ---------------- Error Handling -----------------
client.on('error', err => console.error('Discord Client Error:', err));
client.on('warn', info => console.warn('Discord Client Warning:', info));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));

// ---------------- Memory -----------------
const MEMORY_FILE = './memory.json';
let DB = fs.existsSync(MEMORY_FILE) ? JSON.parse(fs.readFileSync(MEMORY_FILE)) : {};
function saveDB() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(DB, null, 2)); }
function memOf(user) {
    if (!DB[user.id]) DB[user.id] = { 
        name: user.username,
        affinity:0, trust:0, fear:0, tease:0, mood:'neutral', sulk:0, tension:0,
        lastSeen:Date.now(), talkback:false, talkedBack:false, history:[]
    };
    return DB[user.id];
}

// ---------------- Claude API (แก้แล้ว) -----------------
async function talk(text, mem) {
    try {
        const messages = mem.history
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .concat([{ role: 'user', content: text }])
            .slice(-50);

        const payload = {
            model: 'claude-sonnet-4-20250514',
            max_tokens_to_sample: 350,
            system: `
คุณคือ Ken Kaneki ปากแข็ง แต่แคร์ roleplay
สถานะ: affinity:${mem.affinity} trust:${mem.trust} tease:${mem.tease} sulk:${mem.sulk}
รูปแบบตอบ: พูด: ... -# ความคิดในใจ`,
            messages: messages
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
        if (data?.content && data.content[0]?.text) {
            return data.content[0].text.trim();
        }

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
        if (gap >= 10 * 60 * 1000) { // 10 นาที
            mem.lastSeen = now;
            try {
                // บังคับห้องนี้เท่านั้น
                const channel = client.channels.cache.get('1460867977305002125');
                if (!channel || !channel.isTextBased()) continue;
                const reply = await talk('เงียบไปนานแล้ว...', mem);
                await channel.send(reply);
                mem.history.push({ role: 'assistant', content: reply });
                mem.history = mem.history.slice(-50);
                saveDB();
            } catch (e) {
                console.error('Auto-talk error:', e);
            }
        }
    }
}, 5000);

// ---------------- Message Handler -----------------
client.on('messageCreate', async msg => {
    if (msg.author.bot) return;
    if (msg.channel.id !== '1460867977305002125') return; // บังคับห้องนี้

    const mem = memOf(msg.author);
    mem.lastSeen = Date.now();
    mem.talkedBack = false;
    mem.history.push({ role: 'user', content: msg.content });
    mem.history = mem.history.slice(-50);

    try {
        await msg.channel.sendTyping();
        const reply = await talk(msg.content, mem);
        await msg.reply(reply);
        mem.history.push({ role: 'assistant', content: reply });
        mem.history = mem.history.slice(-50);
        saveDB();
    } catch (e) {
        console.error('Message reply error:', e);
    }
});

// ---------------- Slash Commands -----------------
let vcConnection = null;
const audioPlayer = createAudioPlayer();

client.once('ready', async () => {
    await client.application.commands.set([
        new SlashCommandBuilder().setName('join').setDescription('ให้บอทเข้าห้อง VC'),
        new SlashCommandBuilder().setName('play').setDescription('เล่นเพลง YouTube')
            .addStringOption(o => o.setName('url').setRequired(true)),
        new SlashCommandBuilder().setName('talkback').setDescription('เปิด/ปิด talkback')
            .addStringOption(o => o.setName('onoff')
                .addChoices({ name:'on', value:'on' }, { name:'off', value:'off' })
                .setRequired(true)),
        new SlashCommandBuilder().setName('add_personal').setDescription('ปรับความสนิท')
            .addIntegerOption(o => o.setName('จำนวน').setRequired(true)),
        new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความ')
            .addIntegerOption(o => o.setName('จำนวน').setRequired(true)),
        new SlashCommandBuilder().setName('send').setDescription('ส่งข้อความ')
            .addStringOption(o => o.setName('ข้อความ').setRequired(true))
            .addChannelOption(o => o.setName('ห้อง').setRequired(true))
    ]);
    console.log(`✅ Bot ready: ${client.user.tag}`);
});

client.on('interactionCreate', async i => {
    const mem = memOf(i.user);
    if (!i.isChatInputCommand()) return;

    try {
        if (i.commandName === 'join') {
            if (!i.member.voice.channel) return i.reply({ content: '❌ ต้องอยู่ VC ก่อน', ephemeral: true });
            vcConnection = joinVoiceChannel({
                channelId: i.member.voice.channel.id,
                guildId: i.guild.id,
                adapterCreator: i.guild.voiceAdapterCreator
            });
            vcConnection.subscribe(audioPlayer);
            return i.reply({ content: '✅ เข้าห้อง VC แล้ว', ephemeral: true });
        }

        if (i.commandName === 'play') {
            const url = i.options.getString('url');
            if (!vcConnection) return i.reply({ content: '❌ บอทยังไม่ได้เข้าห้อง VC', ephemeral: true });
            const stream = ytdl(url, { filter: 'audioonly' });
            audioPlayer.play(createAudioResource(stream));
            return i.reply({ content: `🎵 กำลังเล่น: ${url}`, ephemeral: true });
        }

        if (i.commandName === 'talkback') {
            mem.talkback = i.options.getString('onoff') === 'on';
            mem.talkedBack = false;
            saveDB();
            return i.reply({ content: 'ตั้งค่า talkback แล้ว', ephemeral: true });
        }

        if (i.commandName === 'add_personal') {
            mem.affinity += i.options.getInteger('จำนวน');
            saveDB();
            return i.reply({ content: `ความสนิทตอนนี้ ${mem.affinity}`, ephemeral: true });
        }

        if (i.commandName === 'clear') {
            if (!i.member.permissions.has(PermissionFlagsBits.ManageMessages))
                return i.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
            const n = i.options.getInteger('จำนวน');
            const deleted = await i.channel.bulkDelete(n, true);
            return i.reply({ content: `🚮 ลบ ${deleted.size} ข้อความ`, ephemeral: true });
        }

        if (i.commandName === 'send') {
            const msg = i.options.getString('ข้อความ');
            const ch = i.options.getChannel('ห้อง');
            await ch.send(msg);
            return i.reply({ content: '✅ ส่งข้อความแล้ว', ephemeral: true });
        }
    } catch (e) {
        console.error('Slash command error:', e);
        try { await i.reply({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true }); } catch {}
    }
});

// ---------------- Login -----------------
client.login(process.env.DISCORD_TOKEN);