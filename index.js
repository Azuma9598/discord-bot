require('dotenv').config();

const express = require('express');
const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');

/* ================= WEB SERVER ================= */
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Discord bot is running');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

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

/* ================= DATABASE (MOCK) ================= */
const db = {};
function memOf(user) {
    if (!db[user.id]) {
        db[user.id] = {
            affinity: 0,
            mood: 'neutral',
            lastSeen: Date.now(),
            history: [],
            chatChannels: [],
            autochat: false
        };
    }
    return db[user.id];
}
function saveDB() {}

/* ================= QUOTES ================= */
const ghoulQuotes = [
    "ข้าคือเงาที่โลกนี้ไม่ต้องการ",
    "โลกนี้มันเน่า… และข้าจะเผามัน",
    "หากข้าคือปีศาจ เจ้าก็คือเหยื่อ",
    "อย่ามองตาข้า ถ้าไม่อยากหลุดจากความจริง",
    "ความอ่อนแอคือบาป",
    "ข้าไม่ใช่ฮีโร่ ข้าคือจุดจบ",
    "ข้าคือฝันร้ายของผู้กล้า",
    "โลกนี้ไม่คู่ควรกับแสงสว่าง",
    "ความกลัวคือพลัง",
    "จงจมลงไปในความมืด"
];

/* ================= READY ================= */
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTION ================= */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.inGuild()) {
        return interaction.reply({
            content: '❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์',
            ephemeral: true
        });
    }

    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
        return interaction.reply({
            content: '❌ คุณไม่มียศที่ใช้คำสั่งนี้ได้',
            ephemeral: true
        });
    }

    const mem = memOf(interaction.user);
    mem.lastSeen = Date.now();

    try {
        switch (interaction.commandName) {

            case 'add_personal': {
                const n = interaction.options.getInteger('amount');
                mem.affinity += n;
                saveDB();
                return interaction.reply(`💖 Affinity ตอนนี้: ${mem.affinity}`);
            }

            case 'clear': {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
                }

                const amount = Math.min(interaction.options.getInteger('amount') || 1, 100);
                const deleted = await interaction.channel.bulkDelete(amount, true);

                return interaction.reply({
                    content: `🚮 ลบ ${deleted.size} ข้อความ`,
                    ephemeral: true
                });
            }

            case 'send': {
                const content = interaction.options.getString('message');
                const channel =
                    interaction.options.getChannel('channel') || interaction.channel;
                const count = Math.min(interaction.options.getInteger('count') || 1, 5);

                for (let i = 0; i < count; i++) {
                    await channel.send({ content });
                }

                return interaction.reply({
                    content: `✅ ส่งแล้ว ${count} ครั้ง`,
                    ephemeral: true
                });
            }

            case 'help': {
                const embed = new EmbedBuilder()
                    .setColor('#00ffff')
                    .setTitle('📜 คำสั่งทั้งหมด')
                    .setDescription(`
/add_personal
/clear
/send
/ghoulmode
/coffee
/setchat
/stopchat
/autochat
/token
/ประกาศ
                    `);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            case 'ghoulmode': {
                mem.mood = 'aggressive';
                saveDB();
                return interaction.reply('🩸 Ghoul mode activated');
            }

            case 'coffee': {
                mem.affinity += 5;
                saveDB();
                return interaction.reply('☕ ดื่มกาแฟแล้ว');
            }

            case 'setchat': {
                const channel = interaction.options.getChannel('channel');
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return interaction.reply('❌ ต้องเป็น Text Channel');
                }

                if (!mem.chatChannels.includes(channel.id)) {
                    mem.chatChannels.push(channel.id);
                }

                saveDB();
                return interaction.reply(`✅ ตั้งห้อง ${channel.name} แล้ว`);
            }

            case 'stopchat': {
                mem.chatChannels = [];
                mem.autochat = false;
                saveDB();
                return interaction.reply('🛑 หยุดพูดคุยทั้งหมดแล้ว');
            }

            case 'autochat': {
                mem.autochat = interaction.options.getString('toggle') === 'on';
                saveDB();
                return interaction.reply(
                    `🤖 Autochat ${mem.autochat ? 'เปิด' : 'ปิด'}`
                );
            }

            case 'token': {
                const quote =
                    ghoulQuotes[Math.floor(Math.random() * ghoulQuotes.length)];
                return interaction.reply(`🗡️ "${quote}"`);
            }

            case 'ประกาศ': {
                const content = interaction.options.getString('message');

                const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('📢 ประกาศ')
                    .setDescription(content)
                    .setTimestamp();

                const channel =
                    client.channels.cache.get(ANNOUNCE_CHANNEL_ID) ||
                    interaction.channel;

                await channel.send({ embeds: [embed] });

                return interaction.reply({
                    content: '✅ ประกาศแล้ว',
                    ephemeral: true
                });
            }
        }
    } catch (err) {
        console.error(err);
        if (!interaction.replied) {
            interaction.reply({
                content: '❌ เกิดข้อผิดพลาด',
                ephemeral: true
            });
        }
    }
});

/* ================= LOGIN ================= */
client.login(process.env.DISCORD_TOKEN);