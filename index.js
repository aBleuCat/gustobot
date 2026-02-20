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

// --- Command Deployment ---
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
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// for render
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

// database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cloud'))
    .catch(err => console.error('DB Connection Error:', err));

const Rule = mongoose.model('Rule', new mongoose.Schema({ 
    ruleId: String, watchUser: String, targetUser: String, 
    channel: String, addRole: String, restoreRole: String, durationMs: Number 
}));

const Advice = mongoose.model('Advice', new mongoose.Schema({ 
    content: String, authorId: String 
}));

const Timeout = mongoose.model('Timeout', new mongoose.Schema({ 
    targetUser: String, addRole: String, restoreRole: String, revertAt: Number 
}));

const ModChannel = mongoose.model('ModChannel', new mongoose.Schema({ 
    guildId: String, channelId: String 
}));

// New model for mutelol
const MutedChannel = mongoose.model('MutedChannel', new mongoose.Schema({ 
    channelId: String 
}));

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

// Global Reverter
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

async function disableButtons(channelId, messageId, label = 'Disabled') {
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;
        const fetched = await channel.messages.fetch(messageId).catch(() => null);
        if (!fetched || !fetched.components.length) return;
        if (fetched.components[0].components[0].disabled) return;

        const row = new ActionRowBuilder();
        fetched.components[0].components.forEach(c => {
            row.addComponents(ButtonBuilder.from(c).setDisabled(true).setLabel(label));
        });
        await fetched.edit({ components: [row] });
    } catch (e) { console.error("Error disabling buttons:", e); }
}

const activeSpawns = new Map(); 

// JSON Helper for tspmo
function updateLolStats() {
    const filePath = './tspmo.json';
    let stats = { count: 0, lastTimestamp: 0 };
    if (fs.existsSync(filePath)) {
        try { stats = JSON.parse(fs.readFileSync(filePath)); } catch (e) { stats = { count: 0, lastTimestamp: 0 }; }
    }
    const now = Date.now();
    // Reset if it's been more than 30 minutes (you can change this number)
    if (now - stats.lastTimestamp > 1800000) {
        stats.count = 1;
    } else {
        stats.count += 1;
    }
    stats.lastTimestamp = now;
    stats.lastDate = new Date().toLocaleString();
    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));
    return stats.count;
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
        return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, ans, bold, type, targetId, stats] = interaction.customId.split('::');
        const modal = new ModalBuilder()
            .setCustomId(`modal::${ans}::${bold}::${type}::${targetId}::${stats}::${interaction.message.id}`) 
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
        const [, correctAnswer, boldText, type, targetId, customStats, messageId] = interaction.customId.split('::'); 
        const userAnswer = interaction.fields.getTextInputValue('user_answer');

        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            try {
                const targetUser = await client.users.fetch(targetId);
                const catchWebhook = await interaction.channel.createWebhook({
                    name: targetUser.displayName,
                    avatar: targetUser.displayAvatarURL(),
                });
                
                const statString = (customStats === "DEFAULT" || !customStats) ? "(#6463FAC, +5%/+13%)" : customStats;
                
                let successMsg;
                if (type === 'fulltext') {
                    successMsg = `<@${interaction.user.id}> You caught **${correctAnswer}**! \`${statString}\` \n \n${boldText}`;
                } else {
                    successMsg = `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \nThis is a **${boldText}** that has been added to your completion!`;
                }
                
                await catchWebhook.send({ content: successMsg });
                await catchWebhook.delete();
                
                if (messageId) {
                    await disableButtons(interaction.channel.id, messageId, 'Caught!');
                    if (activeSpawns.has(messageId)) {
                        clearTimeout(activeSpawns.get(messageId).timeoutId);
                        activeSpawns.delete(messageId);
                    }
                }

                await interaction.deferUpdate().catch(() => {}); 
                await logToModChannel(interaction.guild, `**Catch**: ${interaction.user.tag} caught **${correctAnswer}**.`);
            } catch (err) { console.error(err); }
        } else {
            try {
                const targetUser = await client.users.fetch(targetId);
                const failWebhook = await interaction.channel.createWebhook({
                    name: targetUser.displayName,
                    avatar: targetUser.displayAvatarURL(),
                });
                await failWebhook.send({ content: `<@${interaction.user.id}> Wrong name!` });
                await failWebhook.delete();
                await interaction.deferUpdate().catch(() => {});
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: `<@${interaction.user.id}> Wrong name!`, flags: [MessageFlags.Ephemeral] }).catch(() => {});
            }
        }
    }
});

// message scanning
client.on('messageCreate', async msg => {
    if (!msg.guild) return;

    // 1. Cat logic (Before self-ignore so bot can see messages, but it won't trigger itself because of step 2)
    const randomNum = Math.floor(Math.random() * 100) + 1;
    if (randomNum === 64) {
        msg.channel.send("https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566");
    }

    // Button tracking for bot messages
    if (msg.components.length > 0 && (msg.author.bot || msg.webhookId)) {
        const timeoutId = setTimeout(() => {
            disableButtons(msg.channel.id, msg.id, 'Expired');
            activeSpawns.delete(msg.id);
        }, 120000);
        activeSpawns.set(msg.id, { channelId: msg.channel.id, timeoutId });
    }

    // 2. Ignore self
    if (msg.author.id === client.user.id) return;

    // 3. LOL Logic
    const content = msg.content.toLowerCase();
    if (/\blol\b/.test(content)) {
        const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
        if (!isMuted) {
            msg.channel.send("lol");
            const count = updateLolStats();
            if (count === 20) {
                msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif");
            } else if (count === 40) {
                msg.channel.send("Do you not have *anything* better to do");
            }
        }
    }

    // 4. Everyone trigger
    if (msg.content.includes("@everyone")) {
        msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif");
    }

    // 5. Role Rules
    const matchingRules = await Rule.find({ watchUser: msg.author.id, channel: msg.channel.id });
    for (const rule of matchingRules) {
        const rawDataString = JSON.stringify(msg).toLowerCase();
        const targetId = rule.targetUser.toLowerCase();
        const isMentioned = rawDataString.includes(targetId) || msg.mentions.users.has(rule.targetUser);
        
        if (msg.author.bot) {
            await logToModChannel(msg.guild, `Scan: Found=${isMentioned}, Target: ${targetId}`);
        }

        if (isMentioned) {
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
                    await logToModChannel(msg.guild, `**Triggered!** Role swap for ${member.user.tag}`);
                }
            } catch (e) { console.error(e); }
        }
    }
});

client.login(process.env.TOKEN);
