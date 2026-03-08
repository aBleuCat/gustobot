require('libsodium-wrappers'); // Fix voice encryption
const http = require('http');
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const { REST, Routes } = require('discord.js');

// Handlers & tasks
const { registerInteractionHandler } = require('./lib/handlers/interactionHandler');
const { registerMessageHandler } = require('./lib/handlers/messageHandler');
const { startRoleReverter } = require('./lib/tasks/roleReverter');
const { logToModChannel } = require('./lib/helpers/modLog');

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

    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('db connected'))
        .catch(err => console.error(err));

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Refreshing commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: globalCommandsData });
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: guildCommandsData });
        console.log('Commands reloaded');
    } catch (error) {
        console.error(error);
    }
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

client.login(process.env.TOKEN);
