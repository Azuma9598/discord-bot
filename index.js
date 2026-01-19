const {
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');

const ALLOWED_ROLE_ID = '1432773041640706149';

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // ต้องอยู่ในเซิร์ฟเวอร์
    if (!interaction.inGuild()) {
        return interaction.reply({
            content: '❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์',
            ephemeral: true
        });
    }

    // 🔐 เช็คยศ
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
        return interaction.reply({
            content: '❌ คุณไม่มียศที่สามารถใช้คำสั่งบอทนี้ได้',
            ephemeral: true
        });
    }

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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
            }

            const n = interaction.options.getInteger('amount') || 1;
            const deleted = await interaction.channel.bulkDelete(n, true);
            return interaction.reply({
                content: `🚮 ลบ ${deleted.size} ข้อความ`,
                ephemeral: true
            });
        }

        if (cmd === 'send') {
            const content = interaction.options.getString('message');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const count = interaction.options.getInteger('count') || 1;

            for (let i = 0; i < count; i++) {
                await channel.send(content);
            }

            return interaction.reply({
                content: `✅ ส่งข้อความ ${count} ครั้งแล้ว`,
                ephemeral: true
            });
        }

        if (cmd === 'help') {
            return interaction.reply(`📜 คำสั่งทั้งหมด:
/talkback
/add_personal
/clear
/send
/status
/reset
/ghoulmode
/coffee
/setchat
/stopchat
/autochat
/token
/ประกาศ`);
        }

        if (cmd === 'status') {
            return interaction.reply(
                `💖 Affinity: ${mem.affinity}\n` +
                `😎 Mood: ${mem.mood}\n` +
                `🕒 Last seen: ${new Date(mem.lastSeen).toLocaleString()}\n` +
                `📢 Chat channels: ${mem.chatChannels.join(', ') || 'none'}\n` +
                `🤖 Autochat: ${mem.autochat}`
            );
        }

        if (cmd === 'reset') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
            }

            mem.history = [];
            mem.affinity = 0;
            mem.mood = 'neutral';
            saveDB();
            return interaction.reply('🔄 รีเซ็ตเรียบร้อย');
        }

        if (cmd === 'ghoulmode') {
            mem.mood = 'aggressive';
            saveDB();
            return interaction.reply('🩸 Ghoul mode activated...');
        }

        if (cmd === 'coffee') {
            mem.affinity += 5;
            saveDB();
            return interaction.reply('☕ ดื่มกาแฟแล้ว');
        }

        if (cmd === 'setchat') {
            const channel = interaction.options.getChannel('channel');
            if (!channel || channel.type !== ChannelType.GuildText) {
                return interaction.reply('❌ ไม่ใช่ text channel');
            }

            if (!mem.chatChannels.includes(channel.id)) {
                mem.chatChannels.push(channel.id);
            }

            saveDB();
            return interaction.reply(`✅ ตั้งห้อง ${channel.name} แล้ว`);
        }

        if (cmd === 'stopchat') {
            mem.chatChannels = [];
            mem.autochat = false;
            mem.talkback = false;
            saveDB();
            return interaction.reply('🛑 หยุดพูดคุยทุกห้องแล้ว');
        }

        if (cmd === 'autochat') {
            const toggle = interaction.options.getString('toggle');
            mem.autochat = toggle === 'on';
            saveDB();
            return interaction.reply(`🤖 Auto-chat ${mem.autochat ? 'เปิด' : 'ปิด'} แล้ว`);
        }

        if (cmd === 'token') {
            const randomQuote = ghoulQuotes[Math.floor(Math.random() * ghoulQuotes.length)];
            return interaction.reply(`🗡️ "${randomQuote}" - Ken Kaneki`);
        }

        if (cmd === 'ประกาศ') {
            const content = interaction.options.getString('message');
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📢 ประกาศ')
                .setDescription(content)
                .setTimestamp();

            const channel = client.channels.cache.get('1432780520571539558') || interaction.channel;
            await channel.send({ embeds: [embed] });

            return interaction.reply({ content: '✅ ประกาศแล้ว', ephemeral: true });
        }

    } catch (err) {
        console.error(err);
        return interaction.reply({
            content: '❌ เกิดข้อผิดพลาด',
            ephemeral: true
        });
    }
});
