import {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	EmbedBuilder,
	MessageFlags,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	LabelBuilder,
	type ModalSubmitInteraction,
	type StringSelectMenuInteraction,
	type ButtonInteraction,
} from "discord.js";
import { orbitalRun } from "./orbital-master.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalField = {
	id: string;
	label: string;
	style: TextInputStyle;
	placeholder?: string;
	required: boolean;
	maxLength?: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
	{ label: "Config", value: "config", emoji: "⚙️" },
	{ label: "Coins", value: "coins", emoji: "🪙" },
	{ label: "Horses", value: "horses", emoji: "🐴" },
	{ label: "Spawn", value: "spawn", emoji: "🎲" },
	{ label: "Gamble", value: "gamble", emoji: "🎰" },
	{ label: "Code", value: "code", emoji: "💻" },
] as const;

const CATEGORY_ACTIONS: Record<
	string,
	Array<{ label: string; action: string; needsModal: boolean }>
> = {
	config: [
		{ label: "Get All", action: "config.get", needsModal: false },
		{ label: "Set", action: "config.set", needsModal: true },
		{ label: "Reset", action: "config.reset", needsModal: false },
	],
	coins: [
		{ label: "Get", action: "coins.get", needsModal: true },
		{ label: "Add", action: "coins.add", needsModal: true },
		{ label: "Set", action: "coins.set", needsModal: true },
		{ label: "Remove", action: "coins.remove", needsModal: true },
	],
	horses: [
		{ label: "Get", action: "horses.get", needsModal: true },
		{ label: "Add", action: "horses.add", needsModal: true },
		{ label: "Set", action: "horses.set", needsModal: true },
		{
			label: "Remove",
			action: "horses.remove",
			needsModal: true,
		},
	],
	spawn: [
		{
			label: "Oneshot",
			action: "spawn.oneshot",
			needsModal: true,
		},
		{ label: "Force", action: "spawn.force", needsModal: true },
		{
			label: "Mult Get",
			action: "spawn.mult.get",
			needsModal: true,
		},
		{
			label: "Mult Set",
			action: "spawn.mult.set",
			needsModal: true,
		},
		{
			label: "Mult Clear",
			action: "spawn.mult.clear",
			needsModal: true,
		},
	],
	gamble: [
		{ label: "Get", action: "gamble.user.get", needsModal: true },
		{ label: "Set", action: "gamble.user.set", needsModal: true },
		{
			label: "Clear",
			action: "gamble.user.clear",
			needsModal: true,
		},
	],
	code: [
		{
			label: "Execute",
			action: "code.execute",
			needsModal: true,
		},
	],
};

const MODAL_FIELDS: Record<string, ModalField[]> = {
	"config.set": [
		{
			id: "cfg_key",
			label: "Config Key",
			style: TextInputStyle.Short,
			placeholder: "SPAWN_COEFFICIENT",
			required: true,
		},
		{
			id: "cfg_value",
			label: "Value",
			style: TextInputStyle.Short,
			placeholder: "15",
			required: true,
		},
	],
	"coins.get": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
	],
	"coins.add": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "Amount",
			style: TextInputStyle.Short,
			placeholder: "100",
			required: true,
		},
	],
	"coins.set": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "Amount",
			style: TextInputStyle.Short,
			placeholder: "100",
			required: true,
		},
	],
	"coins.remove": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "Amount",
			style: TextInputStyle.Short,
			placeholder: "100",
			required: true,
		},
	],
	"horses.get": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_name",
			label: "Horse Name (optional)",
			style: TextInputStyle.Short,
			placeholder: "leave empty for all",
			required: false,
		},
	],
	"horses.add": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_name",
			label: "Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "Amount",
			style: TextInputStyle.Short,
			placeholder: "1",
			required: true,
		},
	],
	"horses.set": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_name",
			label: "Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "Amount",
			style: TextInputStyle.Short,
			placeholder: "1",
			required: true,
		},
	],
	"horses.remove": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_name",
			label: "Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "Amount",
			style: TextInputStyle.Short,
			placeholder: "1",
			required: true,
		},
	],
	"spawn.oneshot": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_name",
			label: "Horse Name (optional)",
			style: TextInputStyle.Short,
			placeholder: "leave empty for random",
			required: false,
		},
	],
	"spawn.force": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_slug",
			label: "Horse Slug (optional)",
			style: TextInputStyle.Short,
			placeholder: "leave empty for random",
			required: false,
		},
	],
	"spawn.mult.get": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
	],
	"spawn.mult.set": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "multiplier",
			label: "Multiplier",
			style: TextInputStyle.Short,
			placeholder: "2.5",
			required: true,
		},
	],
	"spawn.mult.clear": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
	],
	"gamble.user.get": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
	],
	"gamble.user.set": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "no_lose",
			label: "No Lose (true/false)",
			style: TextInputStyle.Short,
			placeholder: "false",
			required: false,
		},
		{
			id: "force_lose_horse",
			label: "Force Lose Horse (optional)",
			style: TextInputStyle.Short,
			placeholder: "horse name",
			required: false,
		},
	],
	"gamble.user.clear": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
	],
	"code.execute": [
		{
			id: "code",
			label: "Code",
			style: TextInputStyle.Paragraph,
			placeholder:
				"JavaScript code with access to client, guild, channel, user",
			required: true,
			maxLength: 4000,
		},
	],
};

// ---------------------------------------------------------------------------
// Panel builders
// ---------------------------------------------------------------------------

export function buildOrbitalPanel() {
	const select = new StringSelectMenuBuilder()
		.setCustomId("orbital_cat")
		.setPlaceholder("Select a category...")
		.addOptions(
			...CATEGORIES.map((c) => ({
				label: c.label,
				value: c.value,
				emoji: c.emoji,
			})),
		);

	const row =
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			select,
		);

	const embed = new EmbedBuilder()
		.setColor("#ff6600")
		.setTitle("🎯 Orbital Cannon")
		.setDescription("Select a category to begin.")
		.setFooter({ text: "v5-ts • 5 minute timeout" });

	return {
		embeds: [embed],
		components: [row],
	};
}

export function buildActionRow(
	category: string,
): ActionRowBuilder<ButtonBuilder> | undefined {
	const actions = CATEGORY_ACTIONS[category];
	if (!actions) return undefined;

	const buttons = actions.map((a) =>
		new ButtonBuilder()
			.setCustomId(`orbital_act:${category}:${a.action}`)
			.setLabel(a.label)
			.setStyle(ButtonStyle.Secondary),
	);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		...buttons.slice(0, 5),
	);
}

export function buildSecondRow(
	category: string,
): ActionRowBuilder<ButtonBuilder> | undefined {
	const actions = CATEGORY_ACTIONS[category];
	if (!actions || actions.length <= 5) return undefined;

	const buttons = actions
		.slice(5)
		.map((a) =>
			new ButtonBuilder()
				.setCustomId(`orbital_act:${category}:${a.action}`)
				.setLabel(a.label)
				.setStyle(ButtonStyle.Secondary),
		);

	if (buttons.length === 0) return undefined;
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		...buttons,
	);
}

// ---------------------------------------------------------------------------
// Modal builders
// ---------------------------------------------------------------------------

export function buildModal(action: string): ModalBuilder | undefined {
	const fields = MODAL_FIELDS[action];
	if (!fields) return undefined;

	const modal = new ModalBuilder()
		.setCustomId(`orbital_modal:${action}`)
		.setTitle(action);

	for (const field of fields) {
		const input = new TextInputBuilder()
			.setCustomId(field.id)
			.setStyle(field.style)
			.setRequired(field.required);
		if (field.placeholder)
			input.setPlaceholder(field.placeholder);
		if (field.maxLength) input.setMaxLength(field.maxLength);

		const label = new LabelBuilder()
			.setLabel(field.label)
			.setTextInputComponent(input);
		modal.addLabelComponents(label);
	}

	return modal;
}

// ---------------------------------------------------------------------------
// Modal value parsing
// ---------------------------------------------------------------------------

function parseNumericField(
	value: string,
	payload: Record<string, unknown>,
	targetKey: string,
): void {
	const parsed = Number(value);
	payload[targetKey] = parsed;
}

function parseConfigValue(
	value: string,
	interaction: ModalSubmitInteraction,
	payload: Record<string, unknown>,
): void {
	const keyInput = interaction.fields.getTextInputValue("cfg_key");
	if (!keyInput) return;
	const parsed = Number(value);
	payload[keyInput] = Number.isFinite(parsed) ? parsed : value;
}

function parseHorseField(
	fieldId: string,
	value: string,
	payload: Record<string, unknown>,
): void {
	const targetKey =
		fieldId === "horse_slug" ? "horseSlug" : "horseName";
	payload[targetKey] = value || undefined;
}

export function parseModalValues(
	action: string,
	interaction: ModalSubmitInteraction,
): Record<string, unknown> {
	const fields = MODAL_FIELDS[action];
	if (!fields) return {};

	const payload: Record<string, unknown> = {};

	for (const field of fields) {
		const value = interaction.fields.getTextInputValue(field.id);
		if (!value && !field.required) continue;

		switch (field.id) {
			case "target_user": {
				if (/^\d{17,20}$/v.test(value))
					payload.userId = value;
				else payload.username = value;
				break;
			}

			case "amount": {
				parseNumericField(value, payload, "amount");
				break;
			}

			case "multiplier": {
				parseNumericField(value, payload, "multiplier");
				break;
			}

			case "horse_name":
			case "horse_slug": {
				parseHorseField(field.id, value, payload);
				break;
			}

			case "cfg_key": {
				payload[value] = undefined;
				break;
			}

			case "cfg_value": {
				parseConfigValue(value, interaction, payload);
				break;
			}

			case "no_lose": {
				payload.noLose = value.toLowerCase() === "true";
				break;
			}

			case "force_lose_horse": {
				payload.forceLoseHorseOnce = value;
				break;
			}

			case "code": {
				payload.code = value;
				break;
			}

			default: {
				break;
			}
		}
	}

	return payload;
}

// ---------------------------------------------------------------------------
// Result formatting
// ---------------------------------------------------------------------------

export function buildResultText(result: unknown): string {
	if (result === null || result === undefined)
		return "✅ (no output)";
	if (typeof result === "string") return result;
	if (
		typeof result === "number" ||
		typeof result === "boolean" ||
		typeof result === "bigint"
	)
		return String(result);
	if (typeof result === "object") {
		try {
			return JSON.stringify(result, null, 2);
		} catch {
			return "[unprintable object]";
		}
	}

	return "⚠️ (unserializable result)";
}

// ---------------------------------------------------------------------------
// Interaction handlers
// ---------------------------------------------------------------------------

export async function handleOrbitalCategory(
	interaction: StringSelectMenuInteraction,
): Promise<void> {
	const category = interaction.values[0];
	if (!category) return;

	const actionRow = buildActionRow(category);
	const secondRow = buildSecondRow(category);
	const components = [actionRow, secondRow].filter(
		(r): r is ActionRowBuilder<ButtonBuilder> => r !== null,
	);

	const embed = new EmbedBuilder()
		.setColor("#ff6600")
		.setTitle(
			`🎯 Orbital Cannon — ${CATEGORIES.find((c) => c.value === category)?.label ?? category}`,
		)
		.setDescription("Select an action below.");

	await interaction.update({
		embeds: [embed],
		components,
	});
}

const IMMEDIATE_ACTIONS = new Set([
	"config.get",
	"config.reset",
	"status",
	"cmd.whitelist.list",
	"cmd.whitelist.reset",
]);

export async function handleOrbitalAction(
	interaction: ButtonInteraction,
): Promise<void> {
	const parts = interaction.customId.split(":");
	const action = parts[2];
	if (!action) return;

	// Immediate actions (no modal needed)
	if (IMMEDIATE_ACTIONS.has(action)) {
		await interaction.deferUpdate();
		const result = await orbitalRun(action, {}, interaction);
		const text = buildResultText(result);
		await interaction.editReply({
			content: `\`\`\`\n${text.slice(0, 1900)}\n\`\`\``,
		});
		return;
	}

	// Code.execute uses the existing nuke modal from mod-log
	if (action === "code.execute") {
		const { init } = await import("./mod-log.js");
		await interaction.showModal(init());
		return;
	}

	// Actions that need a modal
	const modal = buildModal(action);
	if (!modal) {
		await interaction.reply({
			content: "Unknown action.",
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	await interaction.showModal(modal);
}

export async function handleOrbitalModal(
	interaction: ModalSubmitInteraction,
): Promise<void> {
	const parts = interaction.customId.split(":");
	const action = parts[1];
	if (!action) return;

	const payload = parseModalValues(action, interaction);

	try {
		await interaction.deferUpdate();
		const result = await orbitalRun(action, payload, interaction);
		const text = buildResultText(result);
		await interaction.editReply({
			content: `\`\`\`\n${text.slice(0, 1900)}\n\`\`\``,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : String(error);
		await interaction
			.editReply({ content: `❌ ${message}` })
			.catch(() => undefined);
	}
}
