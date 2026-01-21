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
        db[user.id] = {
            mood: 'neutral',
            affinity: 0
        };
    }
    return db[user.id];
}

/* ================= PERMISSION CHECK ================= */
function isOwner(userId) {
    return userId === OWNER_ID;
}
function isAdmin(member) {
    return member.roles.cache.some(role => ADMIN_ROLES.has(role.id));
}

/* ================= READY ================= */
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('set-admin')
            .setDescription('ตั้ง Admin (Owner เท่านั้น)')
            .addRoleOption(o =>
                o.setName('role')
                 .setDescription('เลือกยศ')
                 .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('remove-admin')
            .setDescription('ลบ Admin (Owner เท่านั้น)')
            .addRoleOption(o =>
                o.setName('role')
                 .setDescription('เลือกยศ')
                 .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('setchat')
            .setDescription('ตั้งห้อง chat (Text Channel เท่านั้น)')
            .addChannelOption(o =>
                o.setName('channel')
                 .setDescription('เลือก Text Channel')
                 .setRequired(true)
                 .addChannelTypes(ChannelType.GuildText) // ✅ แก้ตรงนี้
            ),

        new SlashCommandBuilder()
            .setName('stopchat')
            .setDescription('หยุด chat'),

        new SlashCommandBuilder()
            .setName('ghoulmode')
            .setDescription('เปิด/ปิด Ghoul mode'),

        new SlashCommandBuilder()
            .setName('goonmode')
            .setDescription('เปิด/ปิด Goon mode'),

        new SlashCommandBuilder()
            .setName('coffee')
            .setDescription('ดื่มกาแฟ')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
    );

    console.log('✅ Slash commands registered');
});

/* ================= INTERACTION ================= */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) {
        return interaction.reply({ content: '❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์', ephemeral: true });
    }

    /* ===== OWNER ONLY ===== */
    if (['set-admin', 'remove-admin'].includes(interaction.commandName)) {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({
                content: '❌ คำสั่งนี้ใช้ได้เฉพาะ Owner เท่านั้น',
                ephemeral: true
            });
        }
    }
    /* ===== OWNER + ADMIN ===== */
    else {
        if (!isOwner(interaction.user.id) && !isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ คุณไม่ได้อยู่ใน Whitelist',
                ephemeral: true
            });
        }
    }

    /* ===== COMMAND HANDLER ===== */
    switch (interaction.commandName) {

        case 'set-admin': {
            const role = interaction.options.getRole('role');
            ADMIN_ROLES.add(role.id);
            return interaction.reply(`✅ ตั้งยศ **${role.name}** เป็น Admin แล้ว`);
        }

        case 'remove-admin': {
            const role = interaction.options.getRole('role');
            ADMIN_ROLES.delete(role.id);
            return interaction.reply(`🛑 ลบยศ **${role.name}** ออกจาก Admin แล้ว`);
        }

        case 'setchat': {
            const channel = interaction.options.getChannel('channel');
            chatChannels.add(channel.id);
            return interaction.reply(`✅ ตั้งห้อง chat เป็น **${channel.name}**`);
        }

        case 'stopchat':
            chatChannels.clear();
            return interaction.reply('🛑 หยุด chat ทั้งหมดแล้ว');

        case 'ghoulmode': {
            const mem = memOf(interaction.user);
            mem.mood = mem.mood === 'ghoul' ? 'neutral' : 'ghoul';
            return interaction.reply(`🩸 Ghoul ${mem.mood === 'ghoul' ? 'ON' : 'OFF'}`);
        }

        case 'goonmode': {
            const mem = memOf(interaction.user);
            mem.mood = mem.mood === 'goon' ? 'neutral' : 'goon';
            return interaction.reply(`💀 Goon ${mem.mood === 'goon' ? 'ON' : 'OFF'}`);
        }

        case 'coffee':
            return interaction.reply('☕ *จิบกาแฟเงียบๆ*');
    }
});

/* ================= MESSAGE CHAT ================= */
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!chatChannels.has(message.channel.id)) return;
    if (!isOwner(message.author.id) && !isAdmin(message.member)) return;

    await message.channel.sendTyping();
    message.reply('...').catch(console.error);
});

/* ================= ERROR HANDLING ================= */
client.on('error', err => console.error('❌ Discord Client Error:', err));
client.on('shardError', err => console.error('❌ Shard Error:', err));
process.on('unhandledRejection', err => console.error('❌ Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('❌ Uncaught Exception:', err));

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);