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

// for koyeb
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

// logging function
async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id });
    if (!config) return;

    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel) {
        await channel.send(`[LOG]: ${message}`);
    }
}
// if needed
client.logToModChannel = logToModChannel;

// logging
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// timeout checker
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

// interactions
client.on(Events.InteractionCreate, async interaction => {
    // Slash Commands
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

    // Button
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

    // Modal Submission
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

                const successMsg = `<@${interaction.user.id}> caught **${correctAnswer}**! \`(#6463FAC, +5%/+13%)\` \n \nThis is a **${boldText}** that has been added to your collection!`;

                await catchWebhook.send({ content: successMsg });
                await catchWebhook.delete();

                // DISABLE THE BUTTON
                if (interaction.message) {
                    const row = new ActionRowBuilder();
                    interaction.message.components[0].components.forEach(c => {
                        row.addComponents(ButtonBuilder.from(c).setDisabled(true));
                    });
                    await interaction.message.edit({ components: [row] });
                }

                await interaction.deferUpdate().catch(() => {}); 
                
                await logToModChannel(interaction.guild, `**Catch**: ${interaction.user.tag} caught **${correctAnswer}**.`);
            } catch (err) {
                console.error("Webhook catch error:", err);
            }
        } else {
            await interaction.reply({ content: `<@${interaction.user.id}> Wrong name!`});
        }
    }
});

// role trigger
client.on('messageCreate', async msg => {
    // ignore this bot only
    if (msg.author.id === client.user.id || !msg.guild) return;

    const matchingRules = await Rule.find({ 
        watchUser: msg.author.id, 
        channel: msg.channel.id 
    });

    for (const rule of matchingRules) {
        let isMentioned = false;
        let mentionSource = '';
        
        // 1. Direct mentions (Discord Collection)
        if (msg.mentions.users.has(rule.targetUser)) {
            isMentioned = true;
            mentionSource = 'msg.mentions';
        }
        
        // 2. Bruteforce Regex Content Search (Matches even if content looks empty to Discord)
        if (!isMentioned) {
            const idPattern = new RegExp(rule.targetUser);
            if (idPattern.test(msg.content)) {
                isMentioned = true;
                mentionSource = 'regex_content';
            }
        }
        
        // 3. Fallback to embeds
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
                const idPattern = new RegExp(rule.targetUser);
                
                if (idPattern.test(searchArea)) {
                    isMentioned = true;
                    mentionSource = 'embed_scan';
                    break;
                }
            }
        }

        // 4. Interaction User Check (Specific to Ballsdex)
        if (!isMentioned && msg.interaction && msg.interaction.user.id === rule.targetUser) {
            isMentioned = true;
            mentionSource = 'interaction_user';
        }

        // --- ENHANCED LOGGING ---
        if (msg.author.bot) {
            let scanLog = `Rule ${rule.ruleId}: Target=<@${rule.targetUser}>, Mentioned=${isMentioned}, Source=${mentionSource || 'none'}`;
            scanLog += `\n**Content Scanned**: "${msg.content || '(Empty)'}"`;
            if (msg.embeds.length > 0) scanLog += `\n**Embed Scanned**: "${msg.embeds[0].description || '(No Description)'}"`;
            
            await logToModChannel(msg.guild, scanLog);
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
