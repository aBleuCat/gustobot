const http = require('http');
require('dotenv').config();
const { 
    Client, GatewayIntentBits, Collection, Events, 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, MessageFlags 
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

// --- 1. KOYEB HEALTH CHECK ---
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is online!');
}).listen(8000, '0.0.0.0');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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
// Exporting for use in command files if needed
client.logToModChannel = logToModChannel;

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

// --- 5. INTERACTION HANDLER (Commands, Buttons, Modals) ---
client.on(Events.InteractionCreate, async interaction => {
    // A. Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { 
            await command.execute(interaction); 
        } catch (e) { 
            console.error(e); 
        }
        return;
    }

    // B. Button Logic (Extracts targetId for the modal)
    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, ans, bold, targetId] = interaction.customId.split('::');
        
        const modal = new ModalBuilder()
            .setCustomId(`modal::${ans}::${bold}::${targetId}`)
            .setTitle('Catch the Countryball');
        
        const answerInput = new TextInputBuilder()
            .setCustomId('user_answer')
            .setLabel("Name of this countryball")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
        await interaction.showModal(modal);
    }

    // C. Modal Submission Logic
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal::')) {
        const [, correctAnswer, boldText, targetId] = interaction.customId.split('::');
        const userAnswer = interaction.fields.getTextInputValue('user_answer');

        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            try {
                const targetUser = await client.users.fetch(targetId);
                
                const catchWebhook = await interaction.channel.createWebhook({
                    name: targetUser.username,
                    avatar: targetUser.displayAvatarURL(),
                });

                const successMsg = `<@${interaction.user.id}> caught **${correctAnswer}**!\n \n \`(#6463FAC, +5%/+13%)\` This is a **${boldText}** that has been added to your collection!`;

                await catchWebhook.send({ content: successMsg });
                await catchWebhook.delete();

                await interaction.deferUpdate().catch(() => {}); 
                
                await logToModChannel(interaction.guild, `**Catch**: ${interaction.user.tag} caught **${correctAnswer}**.`);
            } catch (err) {
                console.error("Webhook catch error:", err);
            }
        } else {
            await interaction.reply({ content: `Wrong name!`, flags: [MessageFlags.Ephemeral] });
        }
    }
});

// --- 6. SELECTIVE ROLE TRIGGER ---
client.on('messageCreate', async msg => {
    // Ignores only THIS bot. Other bots will trigger rules.
    if (msg.author.id === client.user.id || !msg.guild) return;

    const matchingRules = await Rule.find({ 
        watchUser: msg.author.id, 
        channel: msg.channel.id 
    });

    // DEBUG: Log when a bot posts in a channel with rules
    if (msg.author.bot && matchingRules.length > 0) {
        let debugInfo = `message from ${msg.author.tag} (${msg.author.id})\n`;
        debugInfo += `Found ${matchingRules.length} rule(s)\n`;
        debugInfo += `Content: "${msg.content.substring(0, 100)}"\n`;
        debugInfo += `Embeds: ${msg.embeds.length}`;
        
        if (msg.embeds.length > 0) {
            msg.embeds.forEach((embed, i) => {
                debugInfo += `\nEmbed ${i} description: "${embed.description?.substring(0, 100) || 'none'}"`;
            });
        }
        
        await logToModChannel(msg.guild, debugInfo);
    }

    for (const rule of matchingRules) {
        let isMentioned = false;
        let mentionSource = '';
        
        // 1. Check msg.mentions collection (normal text mentions)
        if (msg.mentions.users.has(rule.targetUser)) {
            isMentioned = true;
            mentionSource = 'msg.mentions';
        }
        
        // 2. Check message content directly (catches all text-based mentions)
        if (!isMentioned && msg.content) {
            const mentionPattern1 = `<@${rule.targetUser}>`;
            const mentionPattern2 = `<@!${rule.targetUser}>`;
            if (msg.content.includes(mentionPattern1) || msg.content.includes(mentionPattern2)) {
                isMentioned = true;
                mentionSource = 'msg.content';
            }
        }
        
        // 3. Check embeds (all fields)
        if (!isMentioned && msg.embeds.length > 0) {
            for (const embed of msg.embeds) {
                const parts = [
                    embed.description || '',
                    embed.title || '',
                    embed.author?.name || '',
                    embed.footer?.text || '',
                    ...(embed.fields || []).map(f => `${f.name} ${f.value}`)
                ];
                
                const searchArea = parts.join(' ');
                const mentionPattern1 = `<@${rule.targetUser}>`;
                const mentionPattern2 = `<@!${rule.targetUser}>`;
                
                if (searchArea.includes(mentionPattern1) || searchArea.includes(mentionPattern2)) {
                    isMentioned = true;
                    mentionSource = 'embed';
                    break;
                }
            }
        }

        // DEBUG: Log detection result for bots
        if (msg.author.bot) {
            await logToModChannel(
                msg.guild, 
                `Rule ${rule.ruleId}: Target=<@${rule.targetUser}>, Mentioned=${isMentioned}, Source=${mentionSource || 'none'}`
            );
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
                    
                    await logToModChannel(msg.guild, `**Role swap triggered!** (via ${mentionSource})\nRole swap: ${member.user.tag} given <@&${rule.addRole}> (Triggered by ${msg.author.tag})`);
                }
            } catch (e) { 
                console.error('Role swap error:', e);
                await logToModChannel(msg.guild, `**Role swap ERROR**: ${e.message}`);
            }
        }
    }
});

client.login(process.env.TOKEN);
