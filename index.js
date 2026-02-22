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
const path = require('path');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus 
} = require('@discordjs/voice');

// deploy global commands
const commands = [];
const commandFilesForDeploy = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFilesForDeploy) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Refreshing commands...');
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] });
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Successfully reloaded global (/) commands.');
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates 
    ]
});

// database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Cloud'))
    .catch(err => console.error('DB Connection Error:', err));

// Models
const Rule = mongoose.model('Rule', new mongoose.Schema({ 
    ruleId: String, watchUser: String, targetUser: String, 
    channel: String, addRole: String, restoreRole: String, durationMs: Number 
}));

const ActionResponse = mongoose.model('ActionResponse', new mongoose.Schema({
    trigger: String, 
    response: String 
}));

const Advice = mongoose.model('Advice', new mongoose.Schema({ 
    content: String, authorId: String 
}));

const AdviceBan = mongoose.model('AdviceBan', new mongoose.Schema({ 
    userId: String 
}));

const Timeout = mongoose.model('Timeout', new mongoose.Schema({ 
    targetUser: String, addRole: String, restoreRole: String, revertAt: Number 
}));

const ModChannel = mongoose.model('ModChannel', new mongoose.Schema({ 
    guildId: String, channelId: String 
}));

const MutedChannel = mongoose.model('MutedChannel', new mongoose.Schema({ 
    channelId: String 
}));

const LolStats = mongoose.model('LolStats', new mongoose.Schema({
    id: { type: String, default: "global_stats" },
    allTime: { type: Number, default: 0 },
    weekly: { type: Number, default: 0 },
    daily: { type: Number, default: 0 },
    lastTimestamp: { type: Number, default: 0 },
    lastDay: { type: String, default: "" },
    lastWeek: { type: Number, default: 0 }
}));

// voice logic
const player = createAudioPlayer();

function playScream(guild, channelId) {
    const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
    });

    const resource = createAudioResource(path.join(__dirname, 'scream.mp3'));
    player.play(resource);
    connection.subscribe(player);
}

player.on(AudioPlayerStatus.Idle, () => {
    const resource = createAudioResource(path.join(__dirname, 'scream.mp3'));
    player.play(resource);
});

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

// global reverter
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

async function updateLolStatsDB() {
    let stats = await LolStats.findOne({ id: "global_stats" });
    if (!stats) stats = new LolStats({ id: "global_stats" });

    const now = new Date();
    const todayStr = now.toDateString();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);

    if (stats.lastDay !== todayStr) { stats.daily = 0; stats.lastDay = todayStr; }
    if (stats.lastWeek !== weekNum) { stats.weekly = 0; stats.lastWeek = weekNum; }

    stats.allTime += 1; stats.weekly += 1; stats.daily += 1;
    stats.lastTimestamp = Date.now();
    await stats.save();
    return stats;
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (interaction.commandName === 'scream') {
            const channel = interaction.options.getChannel('channel');
            if (!channel || channel.type !== 2) return interaction.reply({ content: 'Valid VC only.', flags: [MessageFlags.Ephemeral] });
            playScream(interaction.guild, channel.id);
            return interaction.reply(`The eternal screaming moved to **${channel.name}**.`);
        }

        if (interaction.commandName === 'banadvice') {
            const command = client.commands.get('banadvice');
            if (command) return await command.execute(interaction);
        }

        if (interaction.commandName === 'clearadvicedupes') {
            const command = client.commands.get('clearadvicedupes');
            if (command) return await command.execute(interaction);
        }

        if (interaction.commandName === 'purgeadvicefromuser') {
            const command = client.commands.get('purgeadvicefromuser');
            if (command) return await command.execute(interaction);
        }

        if (interaction.commandName === 'totaladvice') {
            const command = client.commands.get('totaladvice');
            if (command) return await command.execute(interaction);
        }

        if (interaction.commandName === 'advicebanlist') {
            const bans = await AdviceBan.find({});
            if (!bans.length) return interaction.reply("No one is currently banned from giving advice.");
            const list = bans.map(b => `<@${b.userId}>`).join(', ');
            return interaction.reply({ content: `**Banned from Advice:**\n${list}`, flags: [MessageFlags.Ephemeral] });
        }

       if (interaction.commandName === 'impregnate') {
    // Get the user ID from the options
        const user = interaction.options.getUser('user');
        const roleId = '1473123914531213532';

           if (!user) return interaction.reply({ content: 'User not found.', flags: [MessageFlags.Ephemeral] });

           try {
        // Fetch the member from the guild to ensure they aren't null
               const target = await interaction.guild.members.fetch(user.id).catch(() => null);

                if (!target) {
                    return interaction.reply({ content: 'Could not find that member in this server.', flags: [MessageFlags.Ephemeral] });
                }

                await target.roles.add(roleId);
                return interaction.reply(`impregnated ${target.user.username}.`);
            } catch (e) {
                console.error(e);
                return interaction.reply({ content: 'Failed to add the role. Check my permissions.', flags: [MessageFlags.Ephemeral] });
            }
        }

        if (interaction.commandName === 'abortbaby') {
            const roleId = '1473123914531213532';
            await interaction.member.roles.remove(roleId).catch(e => console.error(e));
            return interaction.reply({ content: 'Baby aborted' });
        }

        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
        return;
    }

    // Modal and Button logic remains identical to your provided code...
    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, ans, bold, type, targetId, stats] = interaction.customId.split('::');
        const modal = new ModalBuilder()
            .setCustomId(`modal::${ans}::${bold}::${type}::${targetId}::${stats}::${interaction.message.id}`) 
            .setTitle('Catch the Countryball');
        const answerInput = new TextInputBuilder()
            .setCustomId('user_answer').setLabel("Name of this countryball").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal::')) {
        const [, correctAnswer, boldText, type, targetId, customStats, messageId] = interaction.customId.split('::'); 
        const userAnswer = interaction.fields.getTextInputValue('user_answer');

        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            try {
                const targetUser = await client.users.fetch(targetId);
                const catchWebhook = await interaction.channel.createWebhook({ name: targetUser.displayName, avatar: targetUser.displayAvatarURL() });
                const statString = (customStats === "DEFAULT" || !customStats) ? "(#6463FAC, +5%/+13%)" : customStats;
                let successMsg = type === 'fulltext' ? `<@${interaction.user.id}> You caught **${correctAnswer}**! \`${statString}\` \n \n${boldText}` : `<@${interaction.user.id}> You caught **${correctAnswer}**! \`${statString}\` \n \nThis is a **${boldText}**!`;
                await catchWebhook.send({ content: successMsg });
                await catchWebhook.delete();
                if (messageId) {
                    await disableButtons(interaction.channel.id, messageId, 'Caught!');
                    if (activeSpawns.has(messageId)) { clearTimeout(activeSpawns.get(messageId).timeoutId); activeSpawns.delete(messageId); }
                }
                await interaction.deferUpdate().catch(() => {}); 
                await logToModChannel(interaction.guild, `**Catch**: ${interaction.user.tag} caught **${correctAnswer}**.`);
            } catch (err) { console.error(err); }
        } else {
            try {
                const targetUser = await client.users.fetch(targetId);
                const failWebhook = await interaction.channel.createWebhook({ name: targetUser.displayName, avatar: targetUser.displayAvatarURL() });
                await failWebhook.send({ content: `<@${interaction.user.id}> Wrong name!` });
                await failWebhook.delete();
                await interaction.deferUpdate().catch(() => {});
            } catch (err) { await interaction.reply({ content: `<@${interaction.user.id}> Wrong name!`, flags: [MessageFlags.Ephemeral] }).catch(() => {}); }
        }
    }
});

client.on('messageCreate', async msg => {
    if (!msg.guild || msg.author.bot) return;
    const content = msg.content.toLowerCase();

    const randomNum = Math.floor(Math.random() * 500) + 1;
    if (randomNum === 64) msg.channel.send("https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566");

    const trigger67 = /\b67\b|six seven|six-seven/;
    if (trigger67.test(content)) {
        const responses = ["grown man btw", "top 2% of students btw", "ok pack it up time to do your learning log"];
        msg.reply(responses[Math.floor(Math.random() * responses.length)]);
    }

    if (msg.components.length > 0 && (msg.author.bot || msg.webhookId)) {
        const timeoutId = setTimeout(() => { disableButtons(msg.channel.id, msg.id, 'Expired'); activeSpawns.delete(msg.id); }, 120000);
        activeSpawns.set(msg.id, { channelId: msg.channel.id, timeoutId });
    }

    if (msg.author.id === client.user.id) return;

    if (/\blol\b/.test(content)) {
        const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
        if (!isMuted) {
            msg.channel.send("lol");
            const stats = await updateLolStatsDB();
            if (stats.daily % 60 === 0) {
                msg.channel.send("<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts");
            } else if (stats.daily % 40 === 0) {
                msg.channel.send("Do you not have *anything* better to do?");
            } else if (stats.daily % 20 === 0) {
                msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif");
            }
        }
    }

    if (msg.content.includes("@everyone")) msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif");

    const matchingRules = await Rule.find({ watchUser: msg.author.id, channel: msg.channel.id });
    for (const rule of matchingRules) {
        if (JSON.stringify(msg).toLowerCase().includes(rule.targetUser.toLowerCase()) || msg.mentions.users.has(rule.targetUser)) {
            try {
                const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                if (member) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});
                    await new Timeout({ targetUser: rule.targetUser, addRole: rule.addRole, restoreRole: rule.restoreRole, revertAt: Date.now() + rule.durationMs }).save();
                    await logToModChannel(msg.guild, `**Triggered**: Role swap for ${member.user.tag}.`);
                }
            } catch (e) { console.error(e); }
        }
    }
});

client.login(process.env.TOKEN);
