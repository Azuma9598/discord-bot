require('dotenv').config();
const express = require('express');
const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const fetch = require('node-fetch'); // Node 20 สามารถใช้ global fetch

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

/* ================= DATABASE MOCK ================= */
const db = {};
function memOf(user) {
    if (!db[user.id]) {
        db[user.id] = {
            affinity: 0,
            mood: 'neutral',      // neutral / ghoul / goon
            lastSeen: Date.now(),
            history: [],
            chatChannels: [],
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

    const prompt = `
You are Ken Kaneki from Tokyo Ghoul. ${style}
Respond to the human message below in his style.
Use:
.(ข้อความ) for actions
-# ข้อความ for inner thoughts
Include mild profanity naturally if appropriate.
Human: ${message}
Assistant:`;

    const res = await fetch('https://api.anthropic.com/v1/complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.ANTHROPIC_API_KEY
        },
        body: JSON.stringify({
            model: 'claude-v1',
            prompt,
            max_tokens_to_sample: 200,
            temperature: 0.7,
            stop_sequences: ["Human:"]
        })
    });
    const data = await res.json();
    return data.completion.trim();
}

/* ================= REGISTER GLOBAL SLASH COMMANDS ================= */
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

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
    } catch (err) { console.error(err); }
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
                if(!mem.chatChannels.includes(channel.id)) mem.chatChannels.push(channel.id);
                saveDB();
                return interaction.reply(`✅ ตั้งห้อง ${channel.name} แล้ว`);
            }
            case 'stopchat': { mem.chatChannels=[]; mem.autochat=false; saveDB(); return interaction.reply('🛑 หยุดพูดคุยทั้งหมดแล้ว'); }
            case 'token': { const quote = ghoulQuotes[Math.floor(Math.random()*ghoulQuotes.length)]; return interaction.reply(`🗡️ "${quote}"`); }
            // ... เพิ่ม case อื่นตามต้องการ
        }
    } catch(err){ console.error(err); if(!interaction.replied) interaction.reply({content:'❌ เกิดข้อผิดพลาด',ephemeral:true}); }
});

/* ================= MESSAGE RESPONSE ================= */
client.on('messageCreate', async message=>{
    if(message.author.bot) return;
    const mem = memOf(message.author);
    if(!mem.chatChannels.includes(message.channel.id)) return;

    try{
        const reply = await getClaudeReply(message.content,mem);
        setTimeout(()=>{ message.reply(reply); }, Math.floor(Math.random()*2000)+500);
    }catch(err){ console.error(err); message.reply('❌ เกิดข้อผิดพลาด AI'); }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);