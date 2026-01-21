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
        db[user.id] = { mood: 'neutral', affinity: 0 };
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

        new SlashCommandBuilder().setName('ghoulmode').setDescription('Ghoul mode'),
        new SlashCommandBuilder().setName('goonmode').setDescription('Goon mode'),
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
            const mem = memOf(interaction.user);
            mem.mood = mem.mood === 'ghoul' ? 'neutral' : 'ghoul';
            return interaction.reply(`🩸 Ghoul ${mem.mood}`);
        }
        case 'goonmode': {
            const mem = memOf(interaction.user);
            mem.mood = mem.mood === 'goon' ? 'neutral' : 'goon';
            return interaction.reply(`💀 Goon ${mem.mood}`);
        }
        case 'coffee':
            return interaction.reply('☕ *จิบกาแฟ*');
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
        const channel = message.guild.channels.cache.get(channelId);

        if (!channel || channel.type !== ChannelType.GuildText) {
            return message.reply('❌ ID ช่องไม่ถูกต้อง หรือไม่ใช่ Text Channel');
        }

        chatChannels.add(channel.id);
        return message.reply(`✅ เพิ่มห้อง chat: **${channel.name}**`);
    }

    /* ===== !removechat <id> ===== */
    if (cmd === '!removechat') {
        const channelId = args[0];
        if (!chatChannels.has(channelId)) {
            return message.reply('❌ ห้องนี้ไม่ได้อยู่ใน chat list');
        }

        chatChannels.delete(channelId);
        return message.reply(`🛑 ลบห้อง chat แล้ว`);
    }

    /* ===== AI CHAT ===== */
    if (!chatChannels.has(message.channel.id)) return;

    await message.channel.sendTyping();
    message.reply('...').catch(console.error);
});

/* ================= ERROR HANDLING ================= */
client.on('error', e => console.error('❌ Client Error:', e));
process.on('unhandledRejection', e => console.error('❌ Unhandled:', e));
process.on('uncaughtException', e => console.error('❌ Uncaught:', e));

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);