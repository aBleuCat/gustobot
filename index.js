const http = require('http');
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');

// --- 1. KOYEB HEALTH CHECK (Crucial for Port 8000) ---
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is online!');
}).listen(8000, '0.0.0.0');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // REQUIRED for mentions
        GatewayIntentBits.GuildMembers
    ]
});

// --- 2. DATABASE CONNECTION & MODELS ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cloud'))
    .catch(err => console.error('DB Connection Error:', err));

const ruleSchema = new mongoose.Schema({
    ruleId: String, watchUser: String, targetUser: String,
    channel: String, addRole: String, restoreRole: String, durationMs: Number
});
const Rule = mongoose.model('Rule', ruleSchema);

const timeoutSchema = new mongoose.Schema({
    targetUser: String, addRole: String, restoreRole: String, revertAt: Number
});
const Timeout = mongoose.model('Timeout', timeoutSchema);

// --- Mod Channel Schema ---
const modChannelSchema = new mongoose.Schema({
    guildId: String,
    channelId: String
});
const ModChannel = mongoose.model('ModChannel', modChannelSchema);

// --- Helper Function for Logging ---
async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id });
    if (!config) return;

    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel) {
        await channel.send(`[LOG]: ${message}`);
    }
}

// --- 3. COMMAND LOADING ---
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// --- 4. EXPIRED TIMEOUT CHECKER ---
setInterval(async () => {
    const expired = await Timeout.find({ revertAt: { $lte: Date.now() } });
    for (const doc of expired) {
        for (const guild of client.guilds.cache.values()) {
            const member = await guild.members.fetch(doc.targetUser).catch(() => null);
            if (member) {
                await member.roles.remove(doc.addRole).catch(() => {});
                await member.roles.add(doc.restoreRole).catch(() => {});
            }
        }
        await doc.deleteOne();
    }
}, 10000);

// --- 5. INTERACTION HANDLER ---
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (e) { console.error(e); }
});

// --- 6. SELECTIVE ROLE TRIGGER (Mention Only) ---
client.on('messageCreate', async msg => {
    // 1. ONLY ignore Gustobot himself (prevents infinite loops)
    // We allow other bots to trigger the rule now.
    if (msg.author.id === client.user.id || !msg.guild) return;

    const matchingRules = await Rule.find({ 
        watchUser: msg.author.id, 
        channel: msg.channel.id 
    });

    for (const rule of matchingRules) {
        // 2. Check if the bot message actually mentions the target
        if (msg.mentions.users.has(rule.targetUser)) {
            try {
                const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                if (member) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});
                    
                    await new Timeout({
                        targetUser: rule.targetUser, 
                        addRole: rule.addRole,
                        restoreRole: rule.restoreRole, 
                        revertAt: Date.now() + rule.durationMs
                    }).save();
                    
                    console.log(`✅ Rule triggered by bot: ${msg.author.tag}`);
                    await logToModChannel(msg.guild, `${member.user.tag} was given <@&${rule.addRole}> because ${msg.author.tag} mentioned them.`);
                }
            } catch (e) { 
                console.error(e); 
            }
        }
    }
});

client.login(process.env.TOKEN);
