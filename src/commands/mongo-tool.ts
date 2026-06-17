import {
	SlashCommandBuilder,
	MessageFlags,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";
import mongoose from "mongoose";
import * as models from "../lib/models.js";

const AVAILABLE_MODELS = new Map<string, string>();
for (const [name, value] of Object.entries(models)) {
	if (typeof value === "function" && "modelName" in value) {
		AVAILABLE_MODELS.set(name.toLowerCase(), name);
	}
}

type JsonObject = Record<string, unknown>;
type ModelRecordThing = mongoose.Model<Record<string, unknown>>;
type ProjectionObject = Record<
	string,
	string | number | boolean | JsonObject
>;

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isJsonObject(value: unknown): value is JsonObject {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value)
	);
}

function parseJsonObject(value: string): JsonObject {
	const parsed = JSON.parse(value) as unknown;
	if (!isJsonObject(parsed)) {
		throw new Error("JSON must be an object");
	}

	return parsed;
}

function isProjectionObject(
	value: JsonObject,
): value is ProjectionObject {
	return Object.values(value).every(
		(item) =>
			typeof item === "string" ||
			typeof item === "number" ||
			typeof item === "boolean" ||
			isJsonObject(item),
	);
}

function parseProjection(value: string): ProjectionObject {
	const parsed = parseJsonObject(value);
	if (!isProjectionObject(parsed)) {
		throw new Error(
			"Projection must be an object with primitive or nested object values",
		);
	}

	return parsed;
}

function buildQueryCriteria(
	filterString: string | undefined,
	containsString: string | undefined,
): Record<string, unknown> {
	const queryCriteria: Record<string, unknown> = {};

	if (filterString) {
		Object.assign(queryCriteria, parseJsonObject(filterString));
	}

	if (containsString) {
		const colonIndex = containsString.indexOf(":");
		if (colonIndex === -1) {
			throw new Error(
				'Invalid --contains format. Use "field:value" (e.g., "content:hello")',
			);
		}

		const field = containsString.slice(0, colonIndex);
		const value = containsString.slice(colonIndex + 1);
		queryCriteria[field] = { $regex: value, $options: "i" };
	}

	return queryCriteria;
}

function buildSetData(
	setString: string | undefined,
): Record<string, unknown> {
	if (!setString) {
		return {};
	}

	const parsed = JSON.parse(setString) as unknown;
	if (!isJsonObject(parsed)) {
		throw new Error("Set data must be a JSON object");
	}

	return parsed;
}

function buildProjectionOption(
	projectionString: string | undefined,
): ProjectionObject {
	return projectionString ? parseProjection(projectionString) : {};
}

async function handleFind(options: {
	modelCtor: ModelRecordThing;
	modelName: string;
	queryCriteria: Record<string, unknown>;
	projection: ProjectionObject;
	limit: number | undefined;
	verbose: boolean;
}): Promise<string> {
	const {
		modelCtor,
		modelName,
		queryCriteria,
		projection,
		limit,
		verbose,
	} = options;
	// eslint-disable-next-line unicorn/no-array-callback-reference
	const query = modelCtor.find(queryCriteria);
	if (Object.keys(projection).length > 0) {
		void query.select(projection);
	}

	if (limit) {
		void query.limit(limit);
	}

	const documents = await query.lean().exec();
	if (documents.length === 0) {
		return `🔍 No documents found for model **${modelName}** with filter: \`${JSON.stringify(queryCriteria)}\``;
	}

	const displayLimit = verbose
		? documents.length
		: Math.min(documents.length, 5);
	const preview = documents
		.slice(0, displayLimit)
		.map((doc) =>
			verbose
				? JSON.stringify(doc, null, 2)
				: JSON.stringify(doc),
		)
		.join("\n");
	return `📋 Found **${documents.length}** documents (showing ${displayLimit}${
		documents.length > displayLimit
			? ` of ${documents.length}`
			: ""
	}):\n\`\`\`json\n${preview}\n\`\`\`${
		documents.length > displayLimit
			? `\n_Use \`limit\` option to see more (max 100)_`
			: ""
	}`;
}

async function handleCount(
	modelCtor: ModelRecordThing,
	queryCriteria: Record<string, unknown>,
): Promise<string> {
	const count = await modelCtor.countDocuments(queryCriteria);
	return `📊 **${count}** documents match filter: \`${JSON.stringify(queryCriteria)}\``;
}

async function handleDelete(
	modelCtor: ModelRecordThing,
	queryCriteria: Record<string, unknown>,
	modelName: string,
): Promise<string> {
	const deleteResult = await modelCtor.deleteMany(queryCriteria);
	return `🗑️ Deleted **${deleteResult.deletedCount}** documents from **${modelName}**`;
}

async function handleUpdate(
	modelCtor: ModelRecordThing,
	queryCriteria: Record<string, unknown>,
	setData: Record<string, unknown>,
	modelName: string,
): Promise<string> {
	const updateResult = await modelCtor.updateMany(queryCriteria, {
		$set: setData,
	});
	return `✏️ Updated **${updateResult.modifiedCount}** documents in **${modelName}**`;
}

async function handleInsert(
	modelCtor: ModelRecordThing,
	setData: Record<string, unknown>,
	modelName: string,
): Promise<string> {
	// eslint-disable-next-line new-cap
	const newDoc = new modelCtor(setData);
	const savedDoc = await newDoc.save();
	return `✅ Inserted new document into **${modelName}**:\n\`\`\`json\n${JSON.stringify(savedDoc, null, 2)}\n\`\`\``;
}

async function sendChunks(
	interaction: ChatInputCommandInteraction,
	message: string,
	chunkSize = 1900,
) {
	if (message.length <= chunkSize) {
		await interaction.reply({
			content: message,
			flags: [MessageFlags.Ephemeral],
		});
		return;
	}

	const chunks: string[] = [];
	while (message.length > chunkSize) {
		chunks.push(message.slice(0, chunkSize));
		message = message.slice(chunkSize);
	}

	if (message.length > 0) {
		chunks.push(message);
	}

	const firstChunk = chunks[0] ?? "";
	await interaction.reply({
		content: firstChunk,
		flags: [MessageFlags.Ephemeral],
	});

	for (let i = 1; i < chunks.length; i += 1) {
		const chunk = chunks[i];
		if (chunk === undefined) {
			continue;
		}

		// eslint-disable-next-line no-await-in-loop
		await interaction.followUp({
			content: chunk,
			flags: [MessageFlags.Ephemeral],
		});
	}
}

const mongoTool = {
	data: new SlashCommandBuilder()
		.setName("mongotool")
		.setDescription(
			"Manage MongoDB documents across any model (Owner Only)",
		)
		.addStringOption((option) =>
			option
				.setName("model")
				.setDescription(
					"The model to operate on (auto-loaded from models.js)",
				)
				.setRequired(true)
				.setAutocomplete(true),
		)
		.addStringOption((option) =>
			option
				.setName("action")
				.setDescription("The action to perform")
				.setRequired(true)
				.addChoices(
					{ name: "Find (search)", value: "find" },
					{ name: "Count", value: "count" },
					{ name: "Delete", value: "delete" },
					{ name: "Update", value: "update" },
					{ name: "Insert", value: "insert" },
				),
		)
		.addStringOption((option) =>
			option
				.setName("filter")
				.setDescription(
					'JSON filter query (e.g., {"authorId": "123"})',
				)
				.setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName("contains")
				.setDescription(
					'Search field contains value (e.g., "content:hello")',
				)
				.setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName("set")
				.setDescription(
					'JSON values to set/update/insert (e.g., {"field": "value"})',
				)
				.setRequired(false),
		)
		.addIntegerOption((option) =>
			option
				.setName("limit")
				.setDescription("Max documents to return (for find)")
				.setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName("projection")
				.setDescription(
					'Fields to include/exclude (e.g., {"field": 1} or {"field": 0})',
				)
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName("verbose")
				.setDescription("Show full document output")
				.setRequired(false),
		),

	async autocomplete(interaction: AutocompleteInteraction) {
		const focused = interaction.options.getFocused(true);

		if (focused.name === "model") {
			const search = String(focused.value).toLowerCase();
			const choices = [...AVAILABLE_MODELS.keys()]
				.filter((name) => name.includes(search))
				.map((name) => ({ name, value: name }));

			if (
				search &&
				!choices.some((choice) => choice.value === search)
			) {
				choices.unshift({ name: search, value: search });
			}

			await interaction.respond(choices.slice(0, 25));
		}
	},

	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.user.id !== "934290747623096381") {
			return sendChunks(
				interaction,
				"❌ You do not have permission to use this command. This is an owner-only action.",
			);
		}

		const modelName = interaction.options
			.getString("model", true)
			.toLowerCase();
		const action = interaction.options.getString("action", true);
		const filterString =
			interaction.options.getString("filter") ?? undefined;
		const containsString =
			interaction.options.getString("contains") ?? undefined;
		const setString =
			interaction.options.getString("set") ?? undefined;
		const limit =
			interaction.options.getInteger("limit") ?? undefined;
		const projectionString =
			interaction.options.getString("projection") ?? undefined;
		const verbose =
			interaction.options.getBoolean("verbose") ?? false;

		const availableModelName = AVAILABLE_MODELS.get(modelName);
		if (!availableModelName) {
			const available = [...AVAILABLE_MODELS.keys()]
				.map((name) => `\`${name}\``)
				.join(", ");
			return sendChunks(
				interaction,
				`❌ Unknown model: **${modelName}**
Available models: ${available}`,
			);
		}

		const modelClass = mongoose.model<Record<string, unknown>>(
			availableModelName,
		);

		let queryCriteria: Record<string, unknown>;
		let setData: Record<string, unknown>;
		let projection: ProjectionObject;

		try {
			queryCriteria = buildQueryCriteria(
				filterString,
				containsString,
			);
			setData = buildSetData(setString);
			projection = buildProjectionOption(projectionString);
		} catch (error: unknown) {
			return sendChunks(
				interaction,
				`❌ ${getErrorMessage(error)}`,
			);
		}

		try {
			let result: string;
			switch (action) {
				case "find": {
					result = await handleFind({
						modelCtor: modelClass,
						modelName,
						queryCriteria,
						projection,
						limit,
						verbose,
					});
					break;
				}

				case "count": {
					result = await handleCount(
						modelClass,
						queryCriteria,
					);
					break;
				}

				case "delete": {
					result = await handleDelete(
						modelClass,
						queryCriteria,
						modelName,
					);
					break;
				}

				case "update": {
					if (Object.keys(setData).length === 0) {
						return sendChunks(
							interaction,
							"❌ Update operation requires --set with fields to update",
						);
					}

					result = await handleUpdate(
						modelClass,
						queryCriteria,
						setData,
						modelName,
					);
					break;
				}

				case "insert": {
					if (Object.keys(setData).length === 0) {
						return sendChunks(
							interaction,
							"❌ Insert operation requires --set with document fields",
						);
					}

					result = await handleInsert(
						modelClass,
						setData,
						modelName,
					);
					break;
				}

				default: {
					return sendChunks(
						interaction,
						"❌ Unknown operation",
					);
				}
			}

			return sendChunks(interaction, result);
		} catch (error: unknown) {
			console.error("MongoTool Error:", error);
			return sendChunks(
				interaction,
				`❌ Error: ${getErrorMessage(error)}`,
			);
		}
	},
};

export default mongoTool;
