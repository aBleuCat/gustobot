import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	Collection,
	MessageFlags,
	type SlashCommandBuilder,
	type SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from "discord.js";

type SubcommandModule = {
	data: SlashCommandSubcommandBuilder;
	execute: (
		interaction: ChatInputCommandInteraction,
	) => Promise<void>;
	autocomplete?: (
		interaction: AutocompleteInteraction,
	) => Promise<void>;
};

export class SubcommandLoader {
	private readonly subcommands = new Collection<
		string,
		SubcommandModule
	>();

	private readonly mainCommand: SlashCommandBuilder;
	private readonly folderPath: string;

	constructor(
		mainCommand: SlashCommandBuilder,
		metaUrl: string,
		folderName: string,
	) {
		this.mainCommand = mainCommand;

		// Recreate directory context
		const filename = fileURLToPath(metaUrl);
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const __dirname = path.dirname(filename);
		this.folderPath = path.join(__dirname, folderName);
	}

	async load(): Promise<SlashCommandBuilder> {
		if (!fs.existsSync(this.folderPath)) {
			throw new Error(
				`Subcommand directory not found: ${this.folderPath}`,
			);
		}

		const files = fs
			.readdirSync(this.folderPath)
			.filter(
				(file) =>
					file.endsWith(".ts") || file.endsWith(".js"),
			);

		// Map files to dynamic import promises to load them concurrently
		const importPromises = files.map(async (file) => {
			const filePath = path.join(this.folderPath, file);
			const fileUrl = pathToFileURL(filePath).href;
			 
			const subcommand: SubcommandModule = (await import(
				fileUrl
			)) as SubcommandModule;
			return subcommand;
		});

		const loadedModules = await Promise.all(importPromises);

		for (const subcommand of loadedModules) {
			const uncheckedSubcommand =
				subcommand as Partial<SubcommandModule>;
			if (
				uncheckedSubcommand?.data &&
				uncheckedSubcommand.execute
			) {
				this.mainCommand.addSubcommand(() => subcommand.data);
				this.subcommands.set(
					subcommand.data.name,
					subcommand,
				);
			}
		}

		return this.mainCommand;
	}

	async execute(
		interaction: ChatInputCommandInteraction,
	): Promise<void> {
		const subcommandName = interaction.options.getSubcommand();
		const subcommand = this.subcommands.get(subcommandName);

		if (!subcommand) {
			await interaction.reply({
				content: "Subcommand not found.",
				flags: [MessageFlags.Ephemeral],
			});
			return;
		}

		await subcommand.execute(interaction);
	}

	async autocomplete(
		interaction: AutocompleteInteraction,
	): Promise<void> {
		const subcommandName = interaction.options.getSubcommand();
		const subcommand = this.subcommands.get(subcommandName);

		// Explicitly check that the subcommand exists and contains an autocomplete function
		if (
			subcommand &&
			typeof subcommand.autocomplete === "function"
		) {
			await subcommand.autocomplete(interaction);
		}
	}
}
