const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');

/* ================= Web ================= */
const app = express();
app.get('/', (_, res) => res.send('Bot running'));
app.listen(process.env.PORT || 3000);

/* ================= Discord ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
const CHAT_CHANNEL_ID = '1460867977305002125';

/* ================= Persistent Memory ================= */
const FILE = './memory.json';
let DB = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};
const save = () => fs.writeFileSync(FILE, JSON.stringify(DB, null, 2));

function memOf(user){
  if(!DB[user.id]){
    DB[user.id] = {
      name: user.username,
      affinity: 0,        // ความสนิท
      trust: 0,           // ความไว้ใจ
      mood: 'neutral',    // อารมณ์หลัก
      tension: 0,         // ความอึดอัด/กดดัน
      sulk: 0,            // งอน
      style: 'normal',    // สไตล์คุยของผู้ใช้
      lastSeen: Date.now(),
      history: []
    };
  }
  return DB[user.id];
}

/* ================= Time & Personality ================= */
function timeTone(){
  const h = new Date().getHours();
  if(h < 6) return 'ดึก อ่อน ล้า';
  if(h < 12) return 'เช้า ห้วน';
  if(h < 18) return 'กลางวัน ปกติ';
  return 'ค่ำ เงียบ ลึก';
}

function persona(mem){
  if(mem.affinity < 5) return 'เย็น ห่าง เหน็บ';
  if(mem.affinity < 15) return 'เบี้ยว ปากแข็ง';
  if(mem.affinity < 30) return 'แคร์ลึก แต่ปฏิเสธ';
  return 'ผูกพันสูง ห่วงมาก แต่ไม่พูดดี';
}

function sulkState(mem){
  if(mem.sulk >= 4) return 'งอนเงียบ';
  if(mem.sulk >= 2) return 'ประชด';
  return 'ปกติ';
}

/* ================= Emotion Engine ================= */
function updateEmotion(mem, text){
  const now = Date.now();
  const gap = now - mem.lastSeen;

  // หายไปนานแล้วสนิท → งอน
  if(gap > 1000*60*40 && mem.affinity > 10) mem.sulk++;

  // พูดสั้น/ห้วน
  if(text.length <= 3) mem.tension++;

  // ง้อ
  if(/ขอโทษ|ง้อ|โอ๋|ผิดไปแล้ว/.test(text)){
    mem.sulk -= 2;
    mem.trust += 1;
  }

  // แสดงความห่วง
  if(/คิดถึง|ห่วง/.test(text)){
    mem.affinity++;
    mem.trust++;
  }

  // จำกัดค่า
  mem.sulk = Math.max(0, Math.min(5, mem.sulk));
  mem.tension = Math.max(0, Math.min(5, mem.tension));
  mem.trust = Math.max(0, Math.min(20, mem.trust));

  mem.lastSeen = now;
}

/* ================= Claude ================= */
async function talk(text, mem){
  const res = await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key':process.env.ANTHROPIC_API_KEY,
      'anthropic-version':'2023-06-01'
    },
    body:JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:350,
      system:`
คุณคือ "คนจริง" ไม่ใช่ AI
พิมพ์เหมือนพูด ไม่มี emoji
มีคำหยาบได้บ้าง
ปากแข็ง เบี้ยว ประชดเป็น
แคร์ลึก แต่ปฏิเสธ

สถานะ:
เวลา: ${timeTone()}
ความสนิท: ${mem.affinity}
ความไว้ใจ: ${mem.trust}
อารมณ์: ${mem.mood}
งอน: ${sulkState(mem)}
นิสัย: ${persona(mem)}

รูปแบบคำตอบ:
พูด: (คำพูด)
-# (ความคิดในใจ ที่แคร์กว่า)

ตอบ 1–2 ประโยค
ห้ามบอกว่าตัวเองเป็น AI
`,
      messages:[
        ...mem.history,
        {role:'user',content:text}
      ]
    })
  });

  const d = await res.json();
  return d?.content?.[0]?.text || 'เงียบไปเลยว่ะ';
}

/* ================= Message ================= */
client.on('messageCreate', async msg=>{
  if(msg.author.bot) return;
  if(msg.channel.id !== CHAT_CHANNEL_ID) return;

  const mem = memOf(msg.author);
  updateEmotion(mem, msg.content);
  mem.affinity++;

  await msg.channel.sendTyping();
  const r = await talk(msg.content, mem);
  await msg.reply(r);

  mem.history.push({role:'user',content:msg.content});
  mem.history.push({role:'assistant',content:r});
  if(mem.history.length>10) mem.history = mem.history.slice(-10);
  save();
});

/* ================= Slash ================= */
client.once('ready', async ()=>{
  const cmds = [
    new SlashCommandBuilder()
      .setName('add_personal')
      .setDescription('เพิ่ม/ลดความสนิท')
      .addIntegerOption(o=>o.setName('จำนวน').setRequired(true)),
    new SlashCommandBuilder()
      .setName('set_emotion')
      .setDescription('ตั้งอารมณ์ให้บอท')
      .addStringOption(o=>o.setName('อารมณ์').setRequired(true))
  ];
  await client.application.commands.set(cmds);
  console.log('Ready');
});

client.on('interactionCreate', async i=>{
  if(!i.isChatInputCommand()) return;
  const mem = memOf(i.user);

  if(i.commandName==='add_personal'){
    mem.affinity += i.options.getInteger('จำนวน');
    if(mem.affinity<0) mem.affinity=0;
    save();
    return i.reply({content:`ความสนิทตอนนี้ ${mem.affinity}`,ephemeral:true});
  }

  if(i.commandName==='set_emotion'){
    mem.mood = i.options.getString('อารมณ์');
    save();
    return i.reply({content:`ตั้งอารมณ์เป็น "${mem.mood}" แล้ว`,ephemeral:true});
  }
});

/* ================= Login ================= */
client.login(process.env.DISCORD_TOKEN);