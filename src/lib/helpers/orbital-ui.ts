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
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import { castAsHorseData } from "../../type-utils.js";
import { orbitalRun } from "./orbital-master.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const HORSE_VALUES = castAsHorseData(rawHorseValues, "all");

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

/** Actions that require a horse dropdown before modal. */
const NEEDS_HORSE_SELECT = new Set([
	"horses.get",
	"horses.add",
	"horses.set",
	"horses.remove",
	"spawn.oneshot",
	"spawn.force",
]);

const CATEGORIES = [
	{ label: "Config", value: "config", emoji: "⚙️" },
	{ label: "Coins", value: "coins", emoji: "🪙" },
	{ label: "Horses", value: "horses", emoji: "🐴" },
	{ label: "Spawn", value: "spawn", emoji: "🎲" },
	{ label: "Gamble", value: "gamble", emoji: "🎰" },
	{ label: "Race", value: "race", emoji: "🏁" },
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
	race: [
		{ label: "List", action: "race.list", needsModal: false },
		{ label: "Set Speed", action: "race.speed.set", needsModal: true },
		{ label: "Set Mod", action: "race.speed.modifier", needsModal: true },
		{ label: "Set XP", action: "race.xp.set", needsModal: true },
		{ label: "Free Train", action: "race.freetrain", needsModal: true },
		{ label: "Delete", action: "race.delete", needsModal: true },
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
			placeholder: "SPAWN_COEFFICIENT, COIN_CHANCE, DEBOUNCE_MS...",
			required: true,
		},
		{
			id: "cfg_value",
			label: "New Value",
			style: TextInputStyle.Short,
			placeholder: "numeric or string value",
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
	],
	"horses.add": [
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
	],
	"spawn.force": [
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
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
			label: "No Lose Mode",
			style: TextInputStyle.Short,
			placeholder: "true = never lose, false = normal",
			required: false,
		},
		{
			id: "force_lose_horse",
			label: "Force Lose Horse Name",
			style: TextInputStyle.Short,
			placeholder: "exact horse name, or leave empty",
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
	"race.speed.set": [
		{
			id: "horse_name",
			label: "Trained Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "New Speed",
			style: TextInputStyle.Short,
			placeholder: "185",
			required: true,
		},
	],
	"race.speed.modifier": [
		{
			id: "horse_name",
			label: "Trained Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "New Modifier (e.g. 0.1 for +10%)",
			style: TextInputStyle.Short,
			placeholder: "0.1",
			required: true,
		},
	],
	"race.xp.set": [
		{
			id: "horse_name",
			label: "Trained Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "amount",
			label: "New XP",
			style: TextInputStyle.Short,
			placeholder: "100",
			required: true,
		},
	],
	"race.delete": [
		{
			id: "horse_name",
			label: "Trained Horse Name",
			style: TextInputStyle.Short,
			required: true,
		},
	],
	"race.freetrain": [
		{
			id: "horse_name",
			label: "Trained Horse Name",
			style: TextInputStyle.Short,
			placeholder: "My Free Horse",
			required: true,
		},
		{
			id: "target_user",
			label: "User ID or Username",
			style: TextInputStyle.Short,
			required: true,
		},
		{
			id: "horse_slug",
			label: "Horse Breed (slug)",
			style: TextInputStyle.Short,
			placeholder: "unicorn",
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
// Horse select menu
// ---------------------------------------------------------------------------

/**
Returns modal fields for horse-related actions WITHOUT the horse_name/slug
field (since the horse is selected via dropdown).
*/
function getModalFieldsForHorseAction(
	action: string,
): ModalField[] | undefined {
	switch (action) {
		case "horses.get":
		case "horses.add":
		case "horses.set":
		case "horses.remove": {
			return [
				{
					id: "target_user",
					label: "User ID or Username",
					style: TextInputStyle.Short,
					required: true,
				},
				...(action === "horses.get"
					? []
					: [
							{
								id: "amount",
								label: "Amount",
								style: TextInputStyle.Short,
								placeholder: "1",
								required: true,
							},
						]),
			];
		}

		case "spawn.oneshot":
		case "spawn.force": {
			return [
				{
					id: "target_user",
					label: "User ID or Username",
					style: TextInputStyle.Short,
					required: true,
				},
			];
		}

		default: {
			return undefined;
		}
	}
}

export function buildHorseSelectMenu(
	action: string,
	page = 0,
): {
	components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>>;
} {
	const entries = Object.entries(HORSE_VALUES)
		.toSorted(([, a], [, b]) => b.value - a.value);

	const PAGE_SIZE = 23; // 23 horses + Random = 24 options, room for page button
	const totalPages = Math.ceil(entries.length / PAGE_SIZE);
	const start = page * PAGE_SIZE;
	const pageEntries = entries.slice(start, start + PAGE_SIZE);

	const options = [
		{ label: "\u{1F3B2} Random", value: "__random__" },
		...pageEntries.map(([slug, data]) => ({
			label: data.name,
			value: slug,
			description: `Value: ${data.value} | Speed: ${data.speed}`,
		})),
	];

	const select = new StringSelectMenuBuilder()
		.setCustomId(`orbital_horse:${action}:${page}`)
		.setPlaceholder("Select a horse...")
		.addOptions(...options);

	const rows: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
	];

	// Add page navigation buttons if needed
	if (totalPages > 1) {
		const buttons = new ActionRowBuilder<ButtonBuilder>();
		if (page > 0) {
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId(`orbital_horse_page:${action}:${page - 1}`)
					.setLabel("\u{2B05} Previous")
					.setStyle(ButtonStyle.Secondary),
			);
		}

		if (page < totalPages - 1) {
			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId(`orbital_horse_page:${action}:${page + 1}`)
					.setLabel("Next \u{27A1}")
					.setStyle(ButtonStyle.Secondary),
			);
		}

		if (buttons.components.length > 0) {
			rows.push(buttons);
		}
	}

	return { components: rows };
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
		if (field.placeholder) {
			input.setPlaceholder(field.placeholder);
		}

		if (field.maxLength) {
			input.setMaxLength(field.maxLength);
		}

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

function parseModalField(
	fieldId: string,
	value: string,
	interaction: ModalSubmitInteraction,
	payload: Record<string, unknown>,
): void {
	switch (fieldId) {
		case "target_user": {
			if (/^\d{17,20}$/v.test(value)) {
				payload.userId = value;
			} else {
				payload.username = value;
			}

			return;
		}

		case "amount": {
			parseNumericField(value, payload, "amount");
			return;
		}

		case "multiplier": {
			parseNumericField(value, payload, "multiplier");
			return;
		}

		case "horse_name":
		case "horse_slug": {
			parseHorseField(fieldId, value, payload);
			return;
		}

		case "cfg_key": {
			payload[value] = undefined;
			return;
		}

		case "cfg_value": {
			parseConfigValue(value, interaction, payload);
			return;
		}

		case "no_lose": {
			payload.noLose = value.toLowerCase() === "true";
			return;
		}

		case "force_lose_horse": {
			payload.forceLoseHorseOnce = value;
			return;
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

export function parseModalValues(
	action: string,
	interaction: ModalSubmitInteraction,
): Record<string, unknown> {
	const fields = MODAL_FIELDS[action];
	if (!fields) return {};

	const payload: Record<string, unknown> = {};

	for (const field of fields) {
		const value = interaction.fields.getTextInputValue(field.id);
		if (!value && !field.required) {
			continue;
		}

		parseModalField(field.id, value, interaction, payload);
	}

	return payload;
}

// ---------------------------------------------------------------------------
// Result formatting
// ---------------------------------------------------------------------------

export function buildResultText(result: unknown): string {
	if (result === null || result === undefined) {
		return "✅ (no output)";
	}

	if (typeof result === "string") {
		return result;
	}

	if (
		typeof result === "number" ||
		typeof result === "boolean" ||
		typeof result === "bigint"
	) {
		return String(result);
	}

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
	if (!category) {
		await interaction.deferUpdate().catch(() => undefined);
		return;
	}

	const actionRow = buildActionRow(category);
	const secondRow = buildSecondRow(category);
	const components = [actionRow, secondRow].filter(
		(row): row is ActionRowBuilder<ButtonBuilder> => row !== undefined,
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
	"race.list",
	"cmd.whitelist.list",
	"cmd.whitelist.reset",
]);

export async function handleOrbitalAction(
	interaction: ButtonInteraction,
): Promise<void> {
	const parts = interaction.customId.split(":");
	const action = parts[2];
	if (!action) {
		await interaction
			.reply({ content: "Invalid action.", flags: [MessageFlags.Ephemeral] })
			.catch(() => undefined);
		return;
	}

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

	// Actions that need horse selection first
	if (NEEDS_HORSE_SELECT.has(action)) {
		const { components } = buildHorseSelectMenu(action, 0);
		const embed = new EmbedBuilder()
			.setColor("#ff6600")
			.setTitle("\u{1F3AF} Select a Horse")
			.setDescription(`Choose a horse for **${action}**:`);
		await interaction.update({ embeds: [embed], components });
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

export async function handleOrbitalHorseSelect(
	interaction: StringSelectMenuInteraction,
): Promise<void> {
	const parts = interaction.customId.split(":");
	const action = parts[1];
	// Parts[2] is the page number (embedded in the customId).
	if (!action) {
		await interaction
			.reply({ content: "Invalid action.", flags: [MessageFlags.Ephemeral] })
			.catch(() => undefined);
		return;
	}

	const horseSlug = interaction.values[0];
	if (!horseSlug) {
		await interaction
			.reply({ content: "No horse selected.", flags: [MessageFlags.Ephemeral] })
			.catch(() => undefined);
		return;
	}

	// Build modal for remaining fields (without horse field)
	const modalFields = getModalFieldsForHorseAction(action);
	if (!modalFields) {
		await interaction
			.reply({ content: "Unknown action.", flags: [MessageFlags.Ephemeral] })
			.catch(() => undefined);
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId(`orbital_modal:${action}:${horseSlug}`)
		.setTitle(action);

	for (const field of modalFields) {
		const input = new TextInputBuilder()
			.setCustomId(field.id)
			.setStyle(field.style)
			.setRequired(field.required);

		if (field.placeholder) {
			input.setPlaceholder(field.placeholder);
		}

		if (field.maxLength) {
			input.setMaxLength(field.maxLength);
		}

		const label = new LabelBuilder()
			.setLabel(field.label)
			.setTextInputComponent(input);
		modal.addLabelComponents(label);
	}

	await interaction.showModal(modal);
}

export async function handleOrbitalHorsePage(
	interaction: ButtonInteraction,
): Promise<void> {
	const parts = interaction.customId.split(":");
	const action = parts[1];
	if (!action) return;

	const page = Number(parts[2]) || 0;
	const { components } = buildHorseSelectMenu(action, page);
	await interaction.update({ components });
}

export async function handleOrbitalModal(
	interaction: ModalSubmitInteraction,
): Promise<void> {
	const parts = interaction.customId.split(":");
	const action = parts[1];
	if (!action) {
		await interaction
			.reply({ content: "Invalid action.", flags: [MessageFlags.Ephemeral] })
			.catch(() => undefined);
		return;
	}

	const horseSlug = parts[2]; // May be undefined for non-horse actions
	const payload = parseModalValues(action, interaction);

	// If a horse was selected via dropdown, add it to the payload
	if (horseSlug && horseSlug !== "__random__") {
		if (action.startsWith("horses.")) {
			payload.horseName = HORSE_VALUES[horseSlug]?.name ?? horseSlug;
		} else if (action === "spawn.force") {
			payload.horseSlug = horseSlug;
		} else if (action === "spawn.oneshot") {
			payload.horseName = HORSE_VALUES[horseSlug]?.name ?? horseSlug;
		}
	}

	try {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
		const result = await orbitalRun(action, payload, interaction);
		const text = buildResultText(result);
		await interaction.editReply({
			content: `\`\`\`\n${text.slice(0, 1900)}\n\`\`\``,
		});
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : String(error);
		if (interaction.deferred || interaction.replied) {
			await interaction
				.editReply({ content: `❌ ${message}` })
				.catch(() => undefined);
			return;
		}

		await interaction
			.reply({
				content: `❌ ${message}`,
				flags: [MessageFlags.Ephemeral],
			})
			.catch(() => undefined);
	}
}
