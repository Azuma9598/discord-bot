const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 บอท Discord กำลังทำงานอยู่!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server กำลังทำงานที่ port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const ANNOUNCE_CHANNEL_ID = '1432780520571539558';
const REQUIRED_ROLE_IDS = ['1432772884371079208', '1459925314456260719'];
const MENTION_ROLE_ID = '1432795396861595840';

client.once('ready', async () => {
    console.log(`✅ บอทพร้อมใช้งานแล้ว: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('ประกาศ')
            .setDescription('ส่งข้อความประกาศไปยังห้องที่กำหนด')
            .addStringOption(option =>
                option.setName('ข้อความ')
                    .setDescription('ข้อความที่ต้องการประกาศ')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('token')
            .setDescription('ดู Token ของบอท (ล้อเล่น)'),
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('ลบข้อความในช่องนี้')
            .addIntegerOption(option =>
                option.setName('จำนวน')
                    .setDescription('จำนวนข้อความที่ต้องการลบ (1-100)')
                    .setMinValue(1)
                    .setMaxValue(100)
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('แสดงคำสั่งทั้งหมด')
    ];

    try {
        await client.application.commands.set([]);
        for (const guild of client.guilds.cache.values()) {
            await guild.commands.set(commands);
            console.log(`✅ ลงทะเบียนคำสั่งสำเร็จสำหรับ: ${guild.name}`);
        }
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'ประกาศ') {
        const hasRequiredRole = REQUIRED_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );
        if (!hasRequiredRole) {
            return await interaction.reply({
                content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้!',
                ephemeral: true
            });
        }
        const message = interaction.options.getString('ข้อความ');
        try {
            const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
            if (!channel) {
                return await interaction.reply({
                    content: '❌ ไม่พบช่องที่กำหนด',
                    ephemeral: true
                });
            }
            const embed = new EmbedBuilder()
                .setTitle('📢 ประกาศ')
                .setDescription(message)
                .setColor('#FF0000');
            await channel.send({ 
                content: `<@&${MENTION_ROLE_ID}>`,
                embeds: [embed] 
            });
            await interaction.reply({
                content: '✅ ส่งประกาศสำเร็จแล้ว!',
                ephemeral: true
            });
        } catch (error) {
            console.error('❌ เกิดข้อผิดพลาด:', error);
            await interaction.reply({
                content: '❌ เกิดข้อผิดพลาดในการส่งประกาศ',
                ephemeral: true
            });
        }
    }

    if (commandName === 'token') {
        const messages = [
            'เสือก', 'ยุ่ง', 'เอาไปทำเหี้ยไร', 'ไปไกลๆ', 'ไม่มีให้',
            'มีควายอยากได้ แต่กูไม่ให้', 'เทพไม่พึ่งพาใคร',
            'จะเอาไปทำไร น่องบาว', 'อร่อย',
            'จะให้แล้วน้า 1 2 ส่ำ ไม่ให้หรอก',
            'โทเคนนะ ตามหาเอาเองฉันซ่อนไว้สักที่นึง'
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        await interaction.reply(randomMessage);
    }

    if (commandName === 'clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({
                content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้!',
                ephemeral: true
            });
        }
        const amount = interaction.options.getInteger('จำนวน');
        try {
            await interaction.reply({
                content: `🗑️ กำลังลบข้อความ ${amount} ข้อความ...`,
                ephemeral: true
            });
            const deletedMessages = await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply({
                content: `✅ ลบข้อความสำเร็จแล้ว! (ลบไปทั้งหมด ${deletedMessages.size} ข้อความ)`
            });
        } catch (error) {
            console.error('❌ เกิดข้อผิดพลาด:', error);
            await interaction.editReply({
                content: '❌ เกิดข้อผิดพลาดในการลบข้อความ'
            });
        }
    }

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('📋 คำสั่งบอท')
            .setDescription('รายการคำสั่งทั้งหมดของบอท')
            .setColor('#0099ff')
            .addFields(
                { name: '/ประกาศ', value: 'ส่งข้อความประกาศไปยังห้องที่กำหนด', inline: false },
                { name: '/token', value: 'ดู Token ของบอท (ล้อเล่น)', inline: false },
                { name: '/clear', value: 'ลบข้อความในช่องนี้', inline: false },
                { name: '/help', value: 'แสดงคำสั่งทั้งหมด', inline: false }
            )
            .setFooter({ text: 'Discord Bot v1.0' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
