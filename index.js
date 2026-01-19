require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const winston = require('winston');

// ---------------- Dynamic fetch import -----------------
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ---------------- Logging -----------------
const logger = winston.createLogger({
    level: 'info',
    transports: [new winston.transports.File({ filename: 'bot.log' })]
});

// ---------------- Express -----------------
const app = express();
app.get('/', (_, res) => res.send('🤖 Bot running'));
app.listen(process.env.PORT || 3000, () => logger.info('🌐 Web server running'));

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
        lastSeen:Date.now(), talkback:false, history:[],
        cooldown:0, chatChannels: [], autochat:false
    };
    return DB[user.id];
}

// ---------------- Tokyo Ghoul Quotes for /token -----------------
const ghoulQuotes = [
    "ผมไม่ใช่พระเอกในนิยายอะไรหรอก ผมแค่นักศึกษาที่ชอบอ่านหนังสือ เหมือนคนทั่วไป",
    "โลกนี้มันผิดพลาด... มันเต็มไปด้วยความขัดแย้ง",
    "ถ้าผมกินมนุษย์ ผมก็จะกลายเป็นปีศาจ แต่ถ้าผมไม่กิน ผมก็จะตาย",
    "ความเจ็บปวดคือสิ่งที่ทำให้เราเติบโต",
    "ผมแค่ต้องการสถานที่ที่ผมจะอยู่ได้อย่างสงบ",
    "มนุษย์กับกูล... เราต่างก็เป็นสัตว์ประหลาดในสายตาของกันและกัน",
    "การต่อสู้คือการเอาชีวิตรอด",
    "ผมจะไม่ยอมแพ้... ไม่ว่าอะไรจะเกิดขึ้น",
    "ความอ่อนแอคือบาป",
    "โลกนี้มันโหดร้าย... แต่ก็สวยงาม"
    // เพิ่ม quotes เบียวๆ เพิ่มเติมได้ที่นี่
];

// ---------------- Claude API -----------------
async function talk(text, mem) {
    try {
        const messages = mem.history
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .concat([{ role: 'user', content: text }])
            .slice(-50);

        const payload = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 350,
            system: `คุณคือ Ken Kaneki ปากแข็ง แต่แคร์ roleplay
สถานะ: affinity:\( {mem.affinity} mood: \){mem.mood}
ตอบสั้น กระชับ เบี้ยว โหด และแสดงความรู้สึกใน -#`,
            messages
        };

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            logger.error('Claude API Error:', res.status, await res.text());
            return 'เอ๊ะ...งงไปหมด';
        }

        const data = await res.json();
        if (data?.content && data.content[0]?.text) return data.content[0].text.trim();
        return 'เอ๊ะ...งงไปหมด';
    } catch (e) {
        logger.error('Claude API error:', e);
        return 'เอ๊ะ...งงไปหมด';
    }
}

// ---------------- Auto-talk/Auto-chat ทุก 5 นาที (ถ้าเปิด autochat) -----------------
setInterval(async () => {
    const now = Date.now();
    for (const uid in DB) {
        const mem = DB[uid];
        if (!mem.autochat && !mem.talkback) continue; // ถ้าเปิดอย่างใดอย่างหนึ่ง
        const gap = now - mem.lastSeen;
        if (gap >= 5 * 60 * 1000) { // 5 นาที
            mem.lastSeen = now;
            try {
                // เลือก channel จาก chatChannels (random ถ้ามีหลาย)
                if (mem.chatChannels.length === 0) continue;
                const channelId = mem.chatChannels[Math.floor(Math.random() * mem.chatChannels.length)];
                const channel = client.channels.cache.get(channelId);
                if (!channel || !channel.isTextBased()) continue;
                const reply = await talk('เงียบไปนานแล้ว...', mem);
                await channel.send(reply);
                mem.history.push({ role: 'assistant', content: reply });
                mem.history = mem.history.slice(-50);
                saveDB();
            } catch (e) { logger.error('Auto-chat error:', e); }
        }
    }
}, 5000); // เช็คทุก 5 วินาที แต่ action ทุก 5 นาที

// ---------------- Message Handler for non-command chats -----------------
client.on('messageCreate', async msg => {
    if (msg.author.bot) return;
    if (msg.content.startsWith('/')) return; // Skip ถ้าเป็น slash (แต่จริงๆ slash ไม่ trigger messageCreate)

    const mem = memOf(msg.author);
    mem.lastSeen = Date.now();

    // Cooldown check สำหรับ non-command
    if (Date.now() - mem.cooldown < 5000) {
        return msg.reply('⏳ ช้าๆ นะ รอ 5 วินาที');
    }
    mem.cooldown = Date.now();

    // เช็คถ้ามี chatChannels และ channel นี้อยู่ใน list หรือไม่
    if (mem.chatChannels.length > 0 && !mem.chatChannels.includes(msg.channel.id) && !msg.channel.isDMBased()) {
        return; // ไม่ตอบถ้าไม่อยู่ใน chatChannels
    }

    // Process chat
    mem.history.push({ role: 'user', content: msg.content });
    mem.history = mem.history.slice(-50);

    try {
        await msg.channel.sendTyping();
        const reply = await talk(msg.content, mem);
        await msg.reply(reply);
        mem.history.push({ role: 'assistant', content: reply });
        mem.history = mem.history.slice(-50);

        // Parse mood จาก reply
        const moodMatch = reply.match(/-#(\w+)/);
        if (moodMatch) mem.mood = moodMatch[1];

        // Auto-adjust affinity
        const goodWords = ['ขอบคุณ', 'ชอบ', 'ดี', 'เจ๋ง'];
        const badWords = ['แย่', 'เกลียด', 'โง่'];
        if (goodWords.some(w => msg.content.includes(w))) mem.affinity += 1;
        if (badWords.some(w => msg.content.includes(w))) mem.affinity -= 1;
        if (mem.affinity > 50) mem.mood = 'happy';
        if (mem.affinity < -10) mem.mood = 'angry';

        saveDB();
    } catch (e) { logger.error('Message reply error:', e); }
});

// ---------------- Slash Command Handler -----------------
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const mem = memOf(interaction.user);
    mem.lastSeen = Date.now();

    const cmd = interaction.commandName;

    try {
        if (cmd === 'talkback') {
            const toggle = interaction.options.getString('toggle');
            mem.talkback = toggle === 'on';
            saveDB();
            return interaction.reply(`✅ Talkback ${mem.talkback ? 'เปิด' : 'ปิด'} แล้ว`);
        }
        if (cmd === 'add_personal') {
            const n = interaction.options.getInteger('amount');
            mem.affinity += n;
            saveDB();
            return interaction.reply(`💖 ความสนิทตอนนี้ ${mem.affinity}`);
        }
        if (cmd === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
            const n = interaction.options.getInteger('amount') || 1;
            const deleted = await interaction.channel.bulkDelete(n, true);
            return interaction.reply({ content: `🚮 ลบ ${deleted.size} ข้อความ`, ephemeral: true });
        }
        if (cmd === 'send') {
            const content = interaction.options.getString('message');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const count = interaction.options.getInteger('count') || 1;
            for (let i = 0; i < count; i++) {
                await channel.send(content);
            }
            return interaction.reply({ content: `✅ ส่งข้อความ ${count} ครั้งแล้ว`, ephemeral: true });
        }
        if (cmd === 'help') {
            return interaction.reply(`📜 คำสั่งทั้งหมด:
/talkback - เปิด/ปิด auto-talk เดิม
/add_personal - เพิ่ม affinity
/clear - ลบข้อความ (admin only)
/send - ส่งข้อความจากบอท
/status - เช็คสถานะตัวเอง
/reset - รีเซ็ต history (admin only)
/weather - เช็คอากาศ
/ghoulmode - เปิดโหมด ghoul
/coffee - ดื่มกาแฟเพิ่ม affinity
/setchat - ตั้งห้องสำหรับพูดคุย
/stopchat - หยุดพูดคุยทุกห้อง
/autochat - เปิด/ปิด auto-chat
/token - สุ่มคำเบียวๆ โตเกียวกูล
/ประกาศ - ประกาศ embed สีแดง`);
        }
        if (cmd === 'status') {
            return interaction.reply(`💖 Affinity: ${mem.affinity} | 😎 Mood: ${mem.mood} | 🕒 Last seen: ${new Date(mem.lastSeen).toLocaleString()} | 📢 Chat channels: ${mem.chatChannels.join(', ') || 'none'} | Autochat: ${mem.autochat}`);
        }
        if (cmd === 'reset') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
            mem.history = [];
            mem.affinity = 0;
            mem.mood = 'neutral';
            saveDB();
            return interaction.reply('🔄 รีเซ็ตเรียบร้อย');
        }
        if (cmd === 'weather') {
            const city = interaction.options.getString('city');
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=\( {city}&appid= \){process.env.OPENWEATHER_API_KEY}&units=metric`);
                const data = await res.json();
                if (data.cod !== 200) return interaction.reply('❌ ไม่พบเมือง');
                return interaction.reply(`🌤️ ใน ${data.name}: ${data.weather[0].description}, ${data.main.temp}°C`);
            } catch (e) { return interaction.reply('❌ Error'); }
        }
        if (cmd === 'ghoulmode') {
            mem.mood = 'aggressive';
            saveDB();
            return interaction.reply('🩸 Ghoul mode activated... อย่ามายุ่ง');
        }
        if (cmd === 'coffee') {
            mem.affinity += 5;
            saveDB();
            return interaction.reply('☕ ดื่มกาแฟ... รู้สึกดีขึ้นนิดหน่อย');
        }
        if (cmd === 'setchat') {
            const channel = interaction.options.getChannel('channel');
            if (!channel || channel.type !== ChannelType.GuildText) return interaction.reply('❌ ไม่พบห้องหรือไม่ใช่ text channel');
            if (!mem.chatChannels.includes(channel.id)) mem.chatChannels.push(channel.id);
            saveDB();
            return interaction.reply(`✅ ตั้งห้อง ${channel.name} สำหรับพูดคุยแล้ว (รวม ${mem.chatChannels.length} ห้อง)`);
        }
        if (cmd === 'stopchat') {
            mem.chatChannels = [];
            mem.autochat = false;
            mem.talkback = false;
            saveDB();
            return interaction.reply('🛑 หยุดพูดคุยทุกห้องและปิด auto แล้ว');
        }
        if (cmd === 'autochat') {
            const toggle = interaction.options.getString('toggle');
            mem.autochat = toggle === 'on';
            saveDB();
            return interaction.reply(`✅ Auto-chat ${mem.autochat ? 'เปิด' : 'ปิด'} แล้ว (ทุก 5 นาทีในห้องที่ set ถ้าเงียบ)`);
        }
        if (cmd === 'token') {
            const randomQuote = ghoulQuotes[Math.floor(Math.random() * ghoulQuotes.length)];
            return interaction.reply(`🗡️ "${randomQuote}" - Ken Kaneki`);
        }
        if (cmd === 'ประกาศ') {
            const content = interaction.options.getString('message');
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // สีแดง
                .setTitle('ประกาศ!')
                .setDescription(content)
                .setTimestamp();
            const channel = client.channels.cache.get('1432780520571539558') || interaction.channel;
            await channel.send({ embeds: [embed] });
            return interaction.reply({ content: '✅ ประกาศแล้ว', ephemeral: true });
        }
    } catch (e) { logger.error('Command error:', e); return interaction.reply({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true }); }
});

// ---------------- Deploy Slash Commands (run with node index.js deploy) -----------------
const commands = [
    new SlashCommandBuilder().setName('talkback').setDescription('เปิด/ปิด talkback')
        .addStringOption(option => option.setName('toggle').setDescription('on/off').setRequired(true).addChoices({name: 'on', value: 'on'}, {name: 'off', value: 'off'})),
    new SlashCommandBuilder().setName('add_personal').setDescription('เพิ่ม affinity')
        .addIntegerOption(option => option.setName('amount').setDescription('จำนวน').setRequired(true)),
    new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความ')
        .addIntegerOption(option => option.setName('amount').setDescription('จำนวน').setRequired(false)),
    new SlashCommandBuilder().setName('send').setDescription('ส่งข้อความ')
        .addStringOption(option => option.setName('message').setDescription('ข้อความ').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('ห้องที่จะส่ง').setRequired(false))
        .addIntegerOption(option => option.setName('count').setDescription('จำนวนครั้ง').setRequired(false)),
    new SlashCommandBuilder().setName('help').setDescription('แสดงคำสั่งทั้งหมด'),
    new SlashCommandBuilder().setName('status').setDescription('เช็คสถานะ'),
    new SlashCommandBuilder().setName('reset').setDescription('รีเซ็ต history (admin only)'),
    new SlashCommandBuilder().setName('weather').setDescription('เช็คอากาศ')
        .addStringOption(option => option.setName('city').setDescription('เมือง').setRequired(true)),
    new SlashCommandBuilder().setName('ghoulmode').setDescription('เปิด ghoul mode'),
    new SlashCommandBuilder().setName('coffee').setDescription('ดื่มกาแฟเพิ่ม affinity'),
    new SlashCommandBuilder().setName('setchat').setDescription('ตั้งห้องสำหรับพูดคุย')
        .addChannelOption(option => option.setName('channel').setDescription('ห้อง').setRequired(true)),
    new SlashCommandBuilder().setName('stopchat').setDescription('หยุดพูดคุยทุกห้อง'),
    new SlashCommandBuilder().setName('autochat').setDescription('เปิด/ปิด auto-chat')
        .addStringOption(option => option.setName('toggle').setDescription('on/off').setRequired(true).addChoices({name: 'on', value: 'on'}, {name: 'off', value: 'off'})),
    new SlashCommandBuilder().setName('token').setDescription('สุ่มคำเบียวๆ โตเกียวกูล'),
    new SlashCommandBuilder().setName('ประกาศ').setDescription('ประกาศ embed สีแดง')
        .addStringOption(option => option.setName('message').setDescription('ข้อความ').setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    if (process.argv[2] === 'deploy') {
        try {
            console.log('Started refreshing application (/) commands.');
            await rest.put(Routes.applicationCommands(process.env.APPLICATION_ID), { body: commands });
            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }
        process.exit(0);
    }
})();

// ---------------- Login -----------------
client.login(process.env.DISCORD_TOKEN);