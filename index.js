const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// สร้าง Express server เพื่อให้ Render ไม่หยุดทำงาน
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 บอท Discord กำลังทำงานอยู่!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server กำลังทำงานที่ port ${PORT}`);
});

// สร้าง Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ตั้งค่าไอดีห้องและยศ (แก้ตามของคุณ)
const ANNOUNCE_CHANNEL_ID = '1432780520571539558';
const REQUIRED_ROLE_IDS = ['1432772884371079208', '1459925314456260719'];
const MENTION_ROLE_ID = '1432795396861595840';

// เมื่อบอทพร้อมใช้งาน
client.once('ready', async () => {
    console.log(`✅ บอทพร้อมใช้งานแล้ว: ${client.user.tag}`);

    // ลงทะเบียน Slash Commands
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
            .setName('send')
            .setDescription('ส่งข้อความไปยังห้องที่กำหนด (จำนวนหลายรอบ)')
            .addStringOption(option =>
                option.setName('ข้อความ')
                    .setDescription('ข้อความที่ต้องการส่ง')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('ห้อง')
                    .setDescription('ห้องที่ต้องการส่งข้อความ')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('จำนวนรอบ')
                    .setDescription('จำนวนครั้งที่ต้องการส่ง (1-10)')
                    .setMinValue(1)
                    .setMaxValue(10)
                    .setRequired(true)),

        new SlashCommandBuilder()
            .setName('help')
            .setDescription('แสดงคำสั่งทั้งหมด')
    ];

    try {
        // เคลียร์คำสั่งเก่าทั้งหมดก่อน
        await client.application.commands.set([]);

        // ลงทะเบียนคำสั่งให้ทุก Guild
        for (const guild of client.guilds.cache.values()) {
            await guild.commands.set(commands);
            console.log(`✅ ลงทะเบียนคำสั่งสำเร็จสำหรับ: ${guild.name}`);
        }
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
    }
});

// จัดการ Slash Commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // คำสั่ง /ประกาศ
    if (commandName === 'ประกาศ') {
        const hasRequiredRole = REQUIRED_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );

        if (!hasRequiredRole) {
            return await interaction.reply({
                content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้! ต้องมียศที่กำหนดเท่านั้น',
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

            const permissions = channel.permissionsFor(interaction.guild.members.me);
            if (!permissions.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.reply({
                    content: '❌ บอทไม่มีสิทธิ์ส่งข้อความในช่องนั้น',
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

    // คำสั่ง /send
    if (commandName === 'send') {
        // ตรวจสอบสิทธิ์ (ต้องมียศที่กำหนด)
        const hasRequiredRole = REQUIRED_ROLE_IDS.some(roleId => 
            interaction.member.roles.cache.has(roleId)
        );

        if (!hasRequiredRole) {
            return await interaction.reply({
                content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้! ต้องมียศที่กำหนดเท่านั้น',
                ephemeral: true
            });
        }

        const message = interaction.options.getString('ข้อความ');
        const targetChannel = interaction.options.getChannel('ห้อง');
        const rounds = interaction.options.getInteger('จำนวนรอบ');

        try {
            // ตรวจสอบว่าเป็น Text Channel หรือไม่
            if (!targetChannel.isTextBased()) {
                return await interaction.reply({
                    content: '❌ ช่องที่เลือกไม่สามารถส่งข้อความได้',
                    ephemeral: true
                });
            }

            // ตรวจสอบสิทธิ์ของบอท
            const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
            if (!permissions.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.reply({
                    content: '❌ บอทไม่มีสิทธิ์ส่งข้อความในช่องนั้น',
                    ephemeral: true
                });
            }

            // ตอบกลับว่ากำลังส่ง
            await interaction.reply({
                content: `📤 กำลังส่งข้อความ ${rounds} รอบไปยัง ${targetChannel}...`,
                ephemeral: true
            });

            // ส่งข้อความตามจำนวนรอบ
            let successCount = 0;
            for (let i = 0; i < rounds; i++) {
                try {
                    await targetChannel.send(message);
                    successCount++;
                    // หน่วงเวลา 1 วินาทีระหว่างรอบ เพื่อป้องกัน rate limit
                    if (i < rounds - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (err) {
                    console.error(`❌ ส่งรอบที่ ${i + 1} ล้มเหลว:`, err);
                }
            }

            // แก้ไขข้อความตอบกลับ
            await interaction.editReply({
                content: `✅ ส่งข้อความสำเร็จ ${successCount}/${rounds} รอบไปยัง ${targetChannel}!`
            });

        } catch (error) {
            console.error('❌ เกิดข้อผิดพลาด:', error);
            await interaction.editReply({
                content: '❌ เกิดข้อผิดพลาดในการส่งข้อความ'
            });
        }
    }

    // คำสั่ง /token
    if (commandName === 'token') {
        const messages = [
            'เสือก',
            'ยุ่ง',
            'เอาไปทำเหี้ยไร',
            'ไปไกลๆ',
            'ไม่มีให้',
            'มีควายอยากได้ แต่กูไม่ให้',
            'เทพไม่พึ่งพาใคร',
            'จะเอาไปทำไร น่องบาว',
            'อร่อย',
            'จะให้แล้วน้า 1 2 ส่ำ ไม่ให้หรอก',
            'โทเคนนะ ตามหาเอาเองฉันซ่อนไว้สักที่นึง',
            'โทเคนนี้ไม่ได้ทำให้รวย…แต่ทำให้เทพต้องหยุดหัวเราะ',
            'เมื่อโทเคนบินได้ ทุกแมวในเมืองก็กลายเป็นผู้พิทักษ์',
            'เทพพูดว่า "ห้ามใช้โทเคน!" แต่เราได้ยินว่า "สนุกสิ!"',
            'โทเคนชิ้นเดียว ทำให้ขนมปังกลายเป็นดาบสงคราม',
            'มนุษย์ถือโทเคนแล้ว…เทพถึงกับต้องยกมือไหว้',
            'โทเคนนี้ไม่ได้ปลุกพลัง แต่มันปลุกความขี้เกียจขั้นเทพ',
            'ถ้าโทเคนพูดได้ มันคงสอนวิธีกินเค้กให้เทพ',
            'โทเคนทำให้วันธรรมดากลายเป็นสงครามเทพสุดฮา',
            'เทพเจ้าเจอโทเคน…แล้วตกใจว่า "นี่มันอะไรของแก!"',
            'โทเคนคือเหตุผลที่แมวในบ้านเราเริ่มฝึกศิลปะป้องกันตัว'
        ];

        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        try {
            await interaction.reply(randomMessage);
        } catch (error) {
            console.error('❌ Error in /token:', error);
        }
    }

    // คำสั่ง /clear
    if (commandName === 'clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({
                content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้! ต้องมีสิทธิ์ Manage Messages',
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
            console.error('❌ เกิดข้อผิดพลาดในการลบข้อความ:', error);
            await interaction.editReply({
                content: '❌ เกิดข้อผิดพลาดในการลบข้อความ (ข้อความที่เก่ากว่า 14 วันไม่สามารถลบได้)'
            });
        }
    }

    // คำสั่ง /help
    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('📋 คำสั่งบอท')
            .setDescription('รายการคำสั่งทั้งหมดของบอท')
            .setColor('#0099ff')
            .addFields(
                {
                    name: '/ประกาศ',
                    value: 'ส่งข้อความประกาศไปยังห้องที่กำหนด\n`/ประกาศ [ข้อความ]`\n*ต้องมียศที่กำหนด*',
                    inline: false
                },
                {
                    name: '/send',
                    value: 'ส่งข้อความไปยังห้องที่กำหนด (หลายรอบ)\n`/send [ข้อความ] [ห้อง] [จำนวนรอบ]`\n*ต้องมียศที่กำหนด*',
                    inline: false
                },
                {
                    name: '/token',
                    value: 'ดู Token ของบอท (ล้อเล่น)\n`/token`',
                    inline: false
                },
                {
                    name: '/clear',
                    value: 'ลบข้อความในช่องนี้\n`/clear [จำนวน]`\n*ต้องมีสิทธิ์ Manage Messages*',
                    inline: false
                },
                {
                    name: '/help',
                    value: 'แสดงคำสั่งทั้งหมด\n`/help`',
                    inline: false
                }
            )
            .setFooter({ text: 'Discord Bot v1.0' })
            .setTimestamp();

        try {
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Error in /help:', error);
        }
    }
});

// Login ด้วย Token จาก Environment Variable
client.login(process.env.DISCORD_TOKEN);
