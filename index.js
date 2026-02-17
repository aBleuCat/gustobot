const http = require('http');
require('dotenv').config();
const { 
    Client, GatewayIntentBits, Collection, Events, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, MessageFlags, ButtonBuilder 
} = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');

const { REST, Routes } = require('discord.js');

const commands = [];
const commandFilesForDeploy = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFilesForDeploy) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// for koyeb / render
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is online!');
}).listen(process.env.PORT || 8000, '0.0.0.0');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// mongols database
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

const modChannelSchema = new mongoose.Schema({
    guildId: String,
    channelId: String
});
const ModChannel = mongoose.model('ModChannel', modChannelSchema);

async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id });
    if (!config) return;
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel) await channel.send(`[LOG]: ${message}`);
}
client.logToModChannel = logToModChannel;

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

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

// Helper to disable buttons
async function disableButtons(message, label = 'Disabled') {
    try {
        const fetched = await message.channel.messages.fetch(message.id).catch(() => null);
        if (!fetched || !fetched.components.length) return;
        
        const row = new ActionRowBuilder();
        fetched.components[0].components.forEach(c => {
            row.addComponents(ButtonBuilder.from(c).setDisabled(true).setLabel(label));
        });
        await fetched.edit({ components: [row] });
    } catch (e) { console.error("Error disabling buttons:", e); }
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, ans, bold, type, targetId] = interaction.customId.split('::');
        const modal = new ModalBuilder()
            .setCustomId(`modal::${ans}::${bold}::${type}::${targetId}`)
            .setTitle('Catch the Countryball');
        const answerInput = new TextInputBuilder()
            .setCustomId('user_answer')
            .setLabel("Name of this countryball")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal::')) {
        const [, correctAnswer, boldText, type, targetId] = interaction.customId.split('::');
        const userAnswer = interaction.fields.getTextInputValue('user_answer');

        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            try {
                const targetUser = await client.users.fetch(targetId);
                const catchWebhook = await interaction.channel.createWebhook({
                    name: targetUser.username,
                    avatar: targetUser.displayAvatarURL(),
                });
                
                let successMsg;
                if (type === 'fulltext') {
                    successMsg = `<@${interaction.user.id}> caught **${correctAnswer}**! \`(#6463FAC, +5%/+13%)\` \n \n${boldText}`;
                } else {
                    successMsg = `<@${interaction.user.id}> caught **${correctAnswer}**! \`(#6463FAC, +5%/+13%)\` \n \nThis is a **${boldText}** added to your collection!`;
                }
                
                await catchWebhook.send({ content: successMsg });
                await catchWebhook.delete();

                // SUCCESS: Manually disable buttons immediately
                if (interaction.message) {
                    const row = new ActionRowBuilder();
                    interaction.message.components[0].components.forEach(c => {
                        row.addComponents(ButtonBuilder.from(c).setDisabled(true).setLabel('Caught!'));
                    });
                    await interaction.message.edit({ components: [row] }).catch(() => {});
                }

                await interaction.deferUpdate().catch(() => {}); 
                await logToModChannel(interaction.guild, `**Catch**: ${interaction.user.tag} caught **${correctAnswer}**.`);
            } catch (err) { console.error(err); }
        } else {
            // FAILURE: Webhook impersonation for "Wrong name!"
            try {
                const failWebhook = await interaction.channel.createWebhook({
                    name: interaction.user.username,
                    avatar: interaction.user.displayAvatarURL(),
                });
                await failWebhook.send({ content: `<@${interaction.user.tag}> Wrong name!` });
                await failWebhook.delete();
                await interaction.deferUpdate().catch(() => {});
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: `<@${interaction.user.tag}> Wrong name!`});
            }
        }
    }
});

client.on('messageCreate', async msg => {
    if (msg.author.id === client.user.id || !msg.guild) return;

    if (msg.author.id === client.user.id && msg.components.length > 0) {
        setTimeout(() => disableButtons(msg, 'Expired'), 120000);
    }

    const matchingRules = await Rule.find({ 
        watchUser: msg.author.id, 
        channel: msg.channel.id 
    });

    for (const rule of matchingRules) {
        const rawDataString = JSON.stringify(msg).toLowerCase();
        const targetId = rule.targetUser.toLowerCase();
        
        const isMentioned = rawDataString.includes(targetId) || msg.mentions.users.has(rule.targetUser);

        if (msg.author.bot) {
            await logToModChannel(msg.guild, `Scan: Found=${isMentioned} | Target: ${targetId}`);
        }

        if (isMentioned) {
            try {
                const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                if (member) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});
                    await new Timeout({
                        targetUser: rule.targetUser, addRole: rule.addRole,
                        restoreRole: rule.restoreRole, revertAt: Date.now() + rule.durationMs
                    }).save();
                    await logToModChannel(msg.guild, `**Triggered!** Role swap for ${member.user.tag}`);
                }
            } catch (e) { console.error(e); }
        }
    }
});

client.login(process.env.TOKEN);
