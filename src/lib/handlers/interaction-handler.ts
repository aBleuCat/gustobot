import util from "node:util";
import process from "node:process";
import { Buffer } from "node:buffer";
import vm from "node:vm";
import {
	Events,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	AttachmentBuilder,
	type Client,
	type Interaction,
	type ButtonInteraction,
	type ModalSubmitInteraction,
	type StringSelectMenuInteraction,
} from "discord.js";
import { config, immutConfig } from "../config.js";
import devLog from "../helpers/dev-log.js";
import logToModChannel, { init } from "../helpers/mod-log.js";
import { isOrbitalOwner } from "../helpers/orbital-identity.js";
import {
	handleOrbitalCategory,
	handleOrbitalAction,
	handleOrbitalModal,
} from "../helpers/orbital-ui.js";
import { OrbitalScript } from "../models.js";
import { handleCommandError } from "../helpers/error-handlers.js";
import { castAsWebhookable } from "../../type-utils.js";
/* eslint-disable id-denylist -- Catch data uses the legacy `type` field name. */
// Catch data store
type CatchDataStoreValue = {
	ans: string;
	bold: string;
	type: string;
	targetId: string;
	stats?: string;
	_expiresAt?: number;
};

const { CATCH_DATA_TTL_MS, CATCH_DATA_CLEANUP_INTERVAL_MS } = config;
const catchDataStore = new Map<string, CatchDataStoreValue>();
type OrbitalUiInteraction =
	| StringSelectMenuInteraction
	| ButtonInteraction
	| ModalSubmitInteraction;

function startCatchDataCleanup(): void {
	setInterval(() => {
		const now = Date.now();
		for (const [key, value] of catchDataStore) {
			if (
				value._expiresAt !== undefined &&
				value._expiresAt <= now
			) {
				catchDataStore.delete(key);
			}
		}
	}, CATCH_DATA_CLEANUP_INTERVAL_MS);
}

// Registration
function registerInteractionHandler(client: Client) {
	startCatchDataCleanup();
	client.on(
		Events.InteractionCreate,
		(interaction: Interaction) => {
			void handleInteraction(client, interaction);
		},
	);
}

// Main handler with reduced complexity

async function handleInteraction(
	client: Client,
	interaction: Interaction,
) {
	if (interaction.isAutocomplete()) {
		return handleAutocomplete(client, interaction);
	}

	if (interaction.isChatInputCommand()) {
		return handleSlashCommand(client, interaction);
	}

	if (
		interaction.isButton() &&
		interaction.customId.startsWith("catch::")
	) {
		return handleButtonCatch(interaction);
	}

	if (
		interaction.isStringSelectMenu() &&
		interaction.customId === "orbital_cat"
	) {
		return handleOrbitalUiInteraction(interaction, async () =>
			handleOrbitalCategory(interaction),
		);
	}

	if (
		interaction.isButton() &&
		interaction.customId.startsWith("orbital_act:")
	) {
		return handleOrbitalUiInteraction(interaction, async () =>
			handleOrbitalAction(interaction),
		);
	}

	if (interaction.isModalSubmit()) {
		if (interaction.customId.startsWith("orbital_modal:")) {
			return handleOrbitalUiInteraction(interaction, async () =>
				handleOrbitalModal(interaction),
			);
		}

		if (interaction.customId === "orbital_nuke_modal") {
			return handleModalOrbitalNuke(interaction);
		}

		if (interaction.customId === "modal") {
			return handleModalCatchAnswer(client, interaction);
		}
	}
}

async function handleOrbitalUiInteraction(
	interaction: OrbitalUiInteraction,
	handler: () => Promise<void>,
): Promise<void> {
	try {
		await handler();
	} catch (error: unknown) {
		console.error("Orbital UI interaction error:", error);
		const content = "❌ An orbital action failed. Check the bot logs.";
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ content }).catch(() => undefined);
			return;
		}

		await interaction
			.reply({ content, flags: [MessageFlags.Ephemeral] })
			.catch(() => undefined);
	}
}

// Extracted Sub-handlers

async function handleAutocomplete(
	client: Client,
	interaction: Interaction,
) {
	if (!interaction.isAutocomplete()) return;
	const command = client.commands.get(interaction.commandName);
	if (command?.autocomplete) {
		await command
			.autocomplete(interaction)
			.catch((error: unknown) => {
				console.error("Autocomplete Error:", error);
			});
	}
}

async function handleSlashCommand(
	client: Client,
	interaction: Interaction,
) {
	if (!interaction.isChatInputCommand()) return;
	const command = client.commands.get(interaction.commandName);
	if (!command) {
		await interaction
			.reply({
				content:
					"This command is currently unavailable. The bot may be updating.",
				flags: [MessageFlags.Ephemeral],
			})
			.catch(() => undefined);
		return;
	}

	if (interaction.commandName !== "orbital") {
		const logMessage = `[COMMAND]: ${interaction.user.tag} used /${interaction.commandName} in guild ${interaction.guildId}`;
		console.log(logMessage);
		devLog(logMessage).catch((error: unknown) => {
			console.error("Failed to devLog", error);
		});
	}

	try {
		const isOwner = isOrbitalOwner(interaction.user.id);

		if (isOwner && interaction.commandName === "sayasme") {
			const message = interaction.options.getString("message");
			if (message === "./login") {
				await interaction.showModal(init());
				return;
			}
		}

		await command.execute(interaction);
	} catch (error: unknown) {
		handleCommandError(error, interaction).catch(() => undefined);
	}
}

async function handleButtonCatch(interaction: Interaction) {
	if (!interaction.isButton()) return;
	const spawnId = interaction.customId.slice("catch::".length);
	const data = catchDataStore.get(spawnId);
	if (!data) {
		await interaction
			.reply({
				content: "This catch has expired.",
				flags: [MessageFlags.Ephemeral],
			})
			.catch(() => undefined);
		return;
	}

	catchDataStore.delete(spawnId);
	catchDataStore.set(interaction.user.id, {
		...data,
		_expiresAt: Date.now() + CATCH_DATA_TTL_MS,
	});

	const modal = new ModalBuilder()
		.setCustomId("modal")
		.setTitle("Catch the Countryball");
	const answerInput = new LabelBuilder()
		.setLabel("Name of this countryball")
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId("user_answer")
				.setStyle(TextInputStyle.Short)
				.setRequired(true),
		);
	modal.addLabelComponents(answerInput);
	await interaction.showModal(modal);
}

async function handleModalOrbitalNuke(
	interaction: ModalSubmitInteraction,
) {
	const isOwner = isOrbitalOwner(interaction.user.id);

	if (!isOwner) {
		await interaction
			.reply({
				content: "lmao you thought",
				flags: [MessageFlags.Ephemeral],
			})
			.catch(() => undefined);
		return;
	}

	let code = interaction.fields.getTextInputValue(
		"orbital_nuke_code",
	);
	const link = interaction.fields.getTextInputValue(
		"orbital_nuke_link",
	);

	if (link && !code) {
		try {
			const { default: fetch } = await import("node-fetch");
			const response = await fetch(link);
			code = await response.text();
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: String(error);
			await interaction
				.reply({
					content: `Failed to fetch link: ${errorMessage}`,
					flags: MessageFlags.Ephemeral,
				})
				.catch(() => undefined);
			return;
		}
	}

	if (!code) {
		await interaction
			.reply({
				content: "No code or link provided",
				flags: [MessageFlags.Ephemeral],
			})
			.catch(() => undefined);
		return;
	}

	if (code.trim().startsWith("//startup")) {
		const scriptBody = code.replace(/^\/\/startup/v, "").trim();
		let doc = await OrbitalScript.findOne({ name: "global" });
		doc ??= new OrbitalScript({ name: "global" });
		doc.code = scriptBody;
		await doc.save();
		await interaction.reply({
			content: "Startup script updated.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	await launchNuke(interaction, code).catch(() => undefined);
}

async function handleModalCatchAnswer(
	client: Client,
	interaction: ModalSubmitInteraction,
) {
	const data = catchDataStore.get(interaction.user.id);
	if (
		!data ||
		(data._expiresAt !== undefined &&
			data._expiresAt <= Date.now())
	) {
		catchDataStore.delete(interaction.user.id);
		await interaction
			.reply({
				content: "Something went wrong, try again.",
				flags: [MessageFlags.Ephemeral],
			})
			.catch(() => undefined);
		return;
	}

	catchDataStore.delete(interaction.user.id);

	const {
		ans: correctAnswer,
		bold: boldText,
		type,
		targetId,
		stats: customStats,
	} = data;
	const userAnswer =
		interaction.fields.getTextInputValue("user_answer");

	if (
		userAnswer.trim().toLowerCase() ===
		correctAnswer.toLowerCase()
	) {
		try {
			const targetUser = await client.users.fetch(targetId);
			const catchWebhook = await castAsWebhookable(
				interaction.channel,
			).createWebhook({
				name: targetUser.displayName,
				avatar: targetUser.displayAvatarURL(),
			});

			const statString =
				customStats === "DEFAULT" || !customStats
					? "(#6463FAC, +5%/+13%)"
					: customStats;
			const successMessage =
				type === "fulltext"
					? `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \n${boldText}`
					: `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \nThis is a **${boldText}** that has been added to your completion!`;

			await catchWebhook.send({ content: successMessage });
			await catchWebhook.delete();
			await interaction.deferUpdate().catch(() => undefined);
			if (interaction.guild) {
				await logToModChannel(
					interaction.guild,
					`${interaction.user.tag} caught ${correctAnswer}`,
				);
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: String(error);
			console.error(error);
			devLog(`Error: ${errorMessage}`).catch(
				(logError: unknown) => {
					console.error("Failed to devLog", logError);
				},
			);
		}
	} else {
		try {
			const targetUser = await client.users.fetch(targetId);
			const failWebhook = await castAsWebhookable(
				interaction.channel,
			).createWebhook({
				name: targetUser.displayName,
				avatar: targetUser.displayAvatarURL(),
			});
			await failWebhook.send({
				content: `<@${interaction.user.id}> Wrong name!`,
			});
			await failWebhook.delete();
			await interaction.deferUpdate().catch(() => undefined);
		} catch {
			if (!interaction.replied) {
				await interaction
					.reply({
						content: "wrong",
						flags: [MessageFlags.Ephemeral],
					})
					.catch(() => undefined);
			}
		}
	}
}

// Nuke helpers

async function launchNuke(
	interaction: ModalSubmitInteraction,
	code: string,
) {
	try {
		const result = await runNukeCode(code, interaction);
		return await reportDamage(
			interaction,
			result === null || result === undefined
				? "(no output)"
				: typeof result === "string"
					? result
					: util.inspect(result, {
							depth: 1,
							maxArrayLength: 25,
							breakLength: 100,
						}),
			"nuke-output",
		);
	} catch (error: unknown) {
		return reportDamage(
			interaction,
			error instanceof Error && error.stack
				? error.stack
				: String(error),
			"nuke-error",
		);
	}
}

type NukeInteraction = {
	client: Client;
	guild: undefined;
	channel: undefined;
	user: Client["user"];
};

export async function runNukeCode(
	code: string,
	interaction: ModalSubmitInteraction | NukeInteraction,
): Promise<unknown> {
	const context = vm.createContext({
		interaction,
		console,
	});

	const scriptText = `
		(async () => {
			const client = interaction.client;
			const guild = interaction.guild;
			const channel = interaction.channel;
			const user = interaction.user;
			${code}
		})();
	`;

	const script = new vm.Script(scriptText);
	return script.runInContext(context);
}

async function reportDamage(
	interaction: ModalSubmitInteraction,
	text: string,
	fileBaseName: string,
) {
	// 1. Filter out undefined variables and capture them safely
	const secrets = [
		process.env.TOKEN,
		process.env.MONGO_URI,
		process.env.CLIENT_ID,
	].filter(Boolean);

	let safeText = text;

	// 2. Loop through the verified string array
	for (const secret of secrets) {
		// A quick inline check completely satisfies the compiler here
		if (!secret) continue;
		safeText = safeText.split(secret).join("[REDACTED]");
	}

	const codeBlock = `\`\`\`js\n${safeText}\n\`\`\``;
	if (codeBlock.length <= immutConfig.DISCORD_MSG_CHAR_LIMIT) {
		return interaction.reply({
			content: codeBlock,
			flags: [MessageFlags.Ephemeral],
			allowedMentions: { parse: [] },
		});
	}

	return interaction.reply({
		content: "damage report",
		files: [
			new AttachmentBuilder(Buffer.from(safeText, "utf8"), {
				name: `${fileBaseName}.txt`,
			}),
		],
		flags: [MessageFlags.Ephemeral],
		allowedMentions: { parse: [] },
	});
}
/* eslint-enable id-denylist */

export { catchDataStore };
export default registerInteractionHandler;
