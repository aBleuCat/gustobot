require('libsodium-wrappers'); // fix voice encryption error
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
    joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection 
} = require('@discordjs/voice');

// init client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates 
    ]
});

client.commands = new Collection();

// models
const Rule = mongoose.model('Rule', new mongoose.Schema({ ruleId: String, watchUser: String, targetUser: String, channel: String, addRole: String, restoreRole: String, durationMs: Number }));
const ActionResponse = mongoose.model('ActionResponse', new mongoose.Schema({ trigger: String, response: String }));
const Advice = mongoose.model('Advice', new mongoose.Schema({ content: String, authorId: String }));
const AdviceBan = mongoose.model('AdviceBan', new mongoose.Schema({ userId: String }));
const Timeout = mongoose.model('Timeout', new mongoose.Schema({ targetUser: String, addRole: String, restoreRole: String, revertAt: Number }));
const ModChannel = mongoose.model('ModChannel', new mongoose.Schema({ guildId: String, channelId: String }));
const MutedChannel = mongoose.model('MutedChannel', new mongoose.Schema({ channelId: String }));
const LolStats = mongoose.model('LolStats', new mongoose.Schema({ id: { type: String, default: "global_stats" }, allTime: { type: Number, default: 0 }, weekly: { type: Number, default: 0 }, daily: { type: Number, default: 0 }, lastTimestamp: { type: Number, default: 0 }, lastDay: { type: String, default: "" }, lastWeek: { type: Number, default: 0 } }));
const HorseConfig = mongoose.model('HorseConfig', new mongoose.Schema({ guildId: String, enabled: Boolean, channelId: String }));
const UserHorses = mongoose.model('UserHorses', new mongoose.Schema({ userId: String, horses: { type: Map, of: Number, default: {} } }));

// load global commands
const globalCommandsData = [];
const globalCommandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of globalCommandFiles) {
    const command = require(`./commands/${file}`);
    globalCommandsData.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
}

// load guild commands
const guildCommandsData = [];
const guildCommandFiles = fs.readdirSync('./guild_commands').filter(file => file.endsWith('.js'));
for (const file of guildCommandFiles) {
    const command = require(`./guild_commands/${file}`);
    guildCommandsData.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
}

// deploy commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: globalCommandsData });
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: guildCommandsData });
    } catch (error) { console.error(error); }
})();

// web server
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('online');
}).listen(process.env.PORT || 8000, '0.0.0.0');

// database
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('db connected'))
    .catch(err => console.error(err));

// voice state
const player = createAudioPlayer();
let screamCount = 0;
const maxScreams = 5;

// play scream logic
client.playScream = function(guild, channelId) {
    screamCount = 1;
    const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
    });
    const resource = createAudioResource(path.join(__dirname, 'scream.mp3'));
    player.play(resource);
    connection.subscribe(player);
};

// scream loop and leave
player.on(AudioPlayerStatus.Idle, () => {
    if (screamCount < maxScreams) {
        screamCount++;
        player.play(createAudioResource(path.join(__dirname, 'scream.mp3')));
    } else {
        const connections = client.guilds.cache.map(g => getVoiceConnection(g.id)).filter(c => c);
        connections.forEach(c => c.destroy());
        screamCount = 0;
    }
});

// watch vc joins
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const botMember = newState.guild.members.me;
    if (!botMember.voice.channelId) return;
    const joined = (!oldState.channelId && newState.channelId) || (oldState.channelId !== newState.channelId);
    if (joined && newState.channelId === botMember.voice.channelId && newState.id !== client.user.id) {
        client.playScream(newState.guild, newState.channelId);
    }
});

// mod logging
async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id });
    if (!config) return;
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel) await channel.send(`[LOG]: ${message}`);
}
client.logToModChannel = logToModChannel;

// role reverter
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

// disable buttons
async function disableButtons(channelId, messageId, label = 'Disabled') {
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;
        const fetched = await channel.messages.fetch(messageId).catch(() => null);
        if (!fetched || !fetched.components.length || fetched.author.id !== client.user.id) return;
        const row = new ActionRowBuilder();
        fetched.components[0].components.forEach(c => {
            row.addComponents(ButtonBuilder.from(c).setDisabled(true).setLabel(label));
        });
        await fetched.edit({ components: [row] });
    } catch (e) { if (e.code !== 50005) console.error(e); }
}

const activeSpawns = new Map(); 

// lol stats db
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

// interactions
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (e) { console.error(e); }
        return;
    }

    // countryball catch button
    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, ans, bold, type, targetId, stats] = interaction.customId.split('::');
        const modal = new ModalBuilder().setCustomId(`modal::${ans}::${bold}::${type}::${targetId}::${stats}::${interaction.message.id}`).setTitle('Catch the Countryball');
        const answerInput = new TextInputBuilder().setCustomId('user_answer').setLabel("Name of this countryball").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
        await interaction.showModal(modal);
    }

    // countryball catch modal
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal::')) {
        const [, correctAnswer, boldText, type, targetId, customStats, messageId] = interaction.customId.split('::'); 
        const userAnswer = interaction.fields.getTextInputValue('user_answer');
        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            try {
                const targetUser = await client.users.fetch(targetId);
                const catchWebhook = await interaction.channel.createWebhook({ name: targetUser.displayName, avatar: targetUser.displayAvatarURL() });
                const statString = (customStats === "DEFAULT" || !customStats) ? "(#6463FAC, +5%/+13%)" : customStats;
                let successMsg = type === 'fulltext' ? `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \n${boldText}` : `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \nThis is a **${boldText}** that has been added to your completion!`;
                await catchWebhook.send({ content: successMsg });
                await catchWebhook.delete();
                if (messageId) {
                    await disableButtons(interaction.channel.id, messageId, 'Caught!');
                    if (activeSpawns.has(messageId)) { clearTimeout(activeSpawns.get(messageId).timeoutId); activeSpawns.delete(messageId); }
                }
                await interaction.deferUpdate().catch(() => {}); 
                await logToModChannel(interaction.guild, `${interaction.user.tag} caught ${correctAnswer}`);
            } catch (err) { console.error(err); }
        } else {
            try {
                const targetUser = await client.users.fetch(targetId);
                const failWebhook = await interaction.channel.createWebhook({ name: targetUser.displayName, avatar: targetUser.displayAvatarURL() });
                await failWebhook.send({ content: `<@${interaction.user.id}> Wrong name!` });
                await failWebhook.delete();
                await interaction.deferUpdate().catch(() => {});
            } catch (err) { if (!interaction.replied) await interaction.reply({ content: `wrong`, flags: [MessageFlags.Ephemeral] }).catch(() => {}); }
        }
    }
});

client.on(Events.MessageCreate, async msg => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const content = msg.content.toLowerCase();

    // 1. STATS & TRIGGERS (Independent)
    try {
        // Random cat
        if (Math.floor(Math.random() * 500) + 1 === 64) msg.channel.send("https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566");

        // 67 trigger
        if (/\b67\b|six seven|six-seven/.test(content)) {
            const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
            if (!isMuted) {
                const responses = ["grown man btw", "top 2% of students btw", "ok pack it up time to do your learning log", "stuybau"];
                msg.reply(responses[Math.floor(Math.random() * responses.length)]);
            }
        }

        // lol tracking
        if (/\blol\b/.test(content)) {
            const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
            if (!isMuted) {
                msg.channel.send("lol");
                const stats = await updateLolStatsDB();
                if (stats.daily % 60 === 0) msg.channel.send("<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts");
                else if (stats.daily % 40 === 0) msg.channel.send("Do you not have *anything* better to do?");
                else if (stats.daily % 20 === 0) msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif");
            }
        }

        if (msg.content.includes("@everyone")) msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif");
    } catch (e) { console.error("Trigger Error:", e.message); }

    // 2. AUTOROLE LOGIC
    const matchingRules = await Rule.find({ watchUser: msg.author.id, channel: msg.channel.id });
    for (const rule of matchingRules) {
        if (JSON.stringify(msg).toLowerCase().includes(rule.targetUser.toLowerCase()) || msg.mentions.users.has(rule.targetUser)) {
            try {
                const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                if (member) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});
                    await new Timeout({ targetUser: rule.targetUser, addRole: rule.addRole, restoreRole: rule.restoreRole, revertAt: Date.now() + rule.durationMs }).save();
                    await logToModChannel(msg.guild, `triggered role swap for ${member.user.tag}`);
                }
            } catch (e) { console.error("Autorole Error:", e.message); }
        }
    }

    // 3. HORSE SPAWNING (Independent Scoping)
    const hConfig = await HorseConfig.findOne({ guildId: msg.guild.id });
    if (hConfig && hConfig.enabled) {
        try {
            const targetChan = await msg.guild.channels.fetch(hConfig.channelId).catch(() => msg.channel);

            // DUNG BEETLE ROLL: 1 in 1500
            if (Math.floor(Math.random() * 1500) === 0) {
                let inventory = await UserHorses.findOne({ userId: msg.author.id });
                if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });

                const count = inventory.horses.get("Dung Beetle") || 0;
                inventory.horses.set("Dung Beetle", count + 1);
                await inventory.save();

                await targetChan.send(`<@${msg.author.id}> gets ✨**Dung Beetle**✨!`);
                await targetChan.send(`https://tenor.com/view/cockroach-spin-dancing-cockroach-gif-17373945`);
            }

            // STANDARD HORSE ROLL: 1 in 750
            if (Math.floor(Math.random() * 750) === 0) {
                const horses = {
                    "Horse of Truth and Affirmation": "https://tenor.com/view/horse-of-truth-horse-of-agreement-horse-horse-agree-agree-gif-12047072666965428527",
                    "Horse of Patience and Wisdom": "https://cdn.discordapp.com/attachments/1470957269330956439/1476908219086409884/IMG_1693.jpg",
                    "Horse of Comfort and Relaxation": "https://cdn.discordapp.com/attachments/1282840454278156353/1407882541465211002/Screenshot_2025-08-20_at_8.22.27_PM.png",
                    "Horse of Lies and Deceit": "https://tenor.com/view/horse-humble-nefarious-horse-reaction-yes-gif-9282847705724326063",
                    "Horse of Despair and Agony": "aka ap chem"
                };

                const horseNames = Object.keys(horses);
                const selectedName = horseNames[Math.floor(Math.random() * horseNames.length)];
                
                let inventory = await UserHorses.findOne({ userId: msg.author.id });
                if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });

                const currentCount = inventory.horses.get(selectedName) || 0;
                inventory.horses.set(selectedName, currentCount + 1);
                await inventory.save();

                await targetChan.send(`<@${msg.author.id}> you found the **${selectedName}**!`);
                await targetChan.send(`${horses[selectedName]}`);
            }
        } catch (e) { console.error("Horse Spawn Error:", e.message); }
    }
});

client.login(process.env.TOKEN);
