const http = require('http');

// This starts a basic server to satisfy Koyeb's health check
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is online!');
});

// We listen on 0.0.0.0 (all interfaces) and port 8000
const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Health check server is running on port ${PORT}`);
});

console.log("Health check server is running on port 8000");
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cloud'))
    .catch(err => console.error('DB Connection Error:', err));

// --- Database Models ---
const ruleSchema = new mongoose.Schema({
    ruleId: String,
    watchUser: String,
    targetUser: String,
    channel: String,
    addRole: String,
    restoreRole: String,
    durationMs: Number
});
const Rule = mongoose.model('Rule', ruleSchema);

const timeoutSchema = new mongoose.Schema({
    targetUser: String,
    addRole: String,
    restoreRole: String,
    revertAt: Number
});
const Timeout = mongoose.model('Timeout', timeoutSchema);

// --- Command Loading ---
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// --- Background Task: Check for Expired Timeouts ---
setInterval(async () => {
    const now = Date.now();
    const expired = await Timeout.find({ revertAt: { $lte: now } });

    for (const doc of expired) {
        for (const guild of client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch(doc.targetUser).catch(() => null);
                if (member) {
                    await member.roles.remove(doc.addRole).catch(() => {});
                    await member.roles.add(doc.restoreRole).catch(() => {});
                }
            } catch (err) { console.error(err); }
        }
        await doc.deleteOne(); 
    }
}, 10000);

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// --- Interaction Handler (Commands, Buttons, Modals) ---
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
    }

    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, correctAnswer, boldText] = interaction.customId.split('::');
        const modal = new ModalBuilder().setCustomId(`modal::${correctAnswer}::${boldText}`).setTitle('Catch the Countryball');
        const input = new TextInputBuilder().setCustomId('user_answer').setLabel("Name this countryball").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal::')) {
        const [, correctAnswer, boldText] = interaction.customId.split('::');
        const userAnswer = interaction.fields.getTextInputValue('user_answer');
        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            await interaction.reply({ content: `<@${interaction.user.id}> You caught **${correctAnswer}**! (#3653D5, -8%/-7%)\n\nThis is a **${boldText}** that has been added to your completion!` });
        } else {
            await interaction.reply({ content: `<@${interaction.user.id}> Wrong name!`, ephemeral: true });
        }
    }
});

// --- Role Trigger Handler ---
client.on('messageCreate', async msg => {
    if (msg.author.bot) return;

    const matchingRules = await Rule.find({ watchUser: msg.author.id, channel: msg.channel.id });

    for (const rule of matchingRules) {
        const member = msg.mentions.members.get(rule.targetUser);
        if (!member) continue;

        try {
            await member.roles.add(rule.addRole);
            await member.roles.remove(rule.restoreRole).catch(() => {});

            await new Timeout({
                targetUser: rule.targetUser,
                addRole: rule.addRole,
                restoreRole: rule.restoreRole,
                revertAt: Date.now() + rule.durationMs
            }).save();
        } catch (e) { console.error(e); }
    }
});

client.login(process.env.TOKEN);
