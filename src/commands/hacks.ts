import {
	SlashCommandBuilder,
	MessageFlags,
	PermissionFlagsBits,
	EmbedBuilder,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {config, immutConfig, descriptions} from '../lib/config.js';

type ConfigKey = keyof typeof config;
type NumericConfigKey = {
	[K in ConfigKey]: (typeof config)[K] extends number ? K : never;
}[ConfigKey];
type ConfigListKey = Exclude<keyof typeof config.lists, 'botAdmins'>;

const adminIds = immutConfig.admins;

const isConfigKey = (key: string): key is ConfigKey =>
	Object.hasOwn(config, key);

const isNumericConfigKey = (key: string): key is NumericConfigKey =>
	isConfigKey(key) && typeof config[key] === 'number';

const isConfigListKey = (key: string): key is ConfigListKey =>
	key in config.lists && key !== 'botAdmins';

const isListAction = (
	value: string,
): value is 'add' | 'remove' | 'view' =>
	value === 'add' || value === 'remove' || value === 'view';

const renderConfigValue = (value: unknown): string =>
	typeof value === 'object' && value !== null
		? JSON.stringify(value)
		: String(value);

const hacksCommand = {
	data: new SlashCommandBuilder()
		.setName('hacks')
		.setDescription('Admin tools')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand((sub) =>
			sub
				.setName('vars')
				.setDescription('View or modify runtime config variables')
				.addStringOption((option) =>
					option
						.setName('variable')
						.setDescription('The variable to interact with')
						.setRequired(false)
						.setAutocomplete(true),
				)
				.addStringOption((option) =>
					option
						.setName('action')
						.setDescription('What to do with the variable')
						.setRequired(false)
						.addChoices(
							{name: 'get — show current value', value: 'get'},
							{name: 'set — set to a new value', value: 'set'},
							{name: 'add — add to current value', value: 'add'},
						),
				)
				.addNumberOption((option) =>
					option
						.setName('value')
						.setDescription('Value to set or add')
						.setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub.setName('killbot').setDescription('Shut down the bot'),
		)
		.addSubcommand((sub) =>
			sub
				.setName('lists')
				.setDescription('Manage whitelists and blacklists')
				.addStringOption((option) =>
					option
						.setName('listname')
						.setDescription('Which list to modify')
						.setRequired(true)
						.addChoices(
							{
								name: 'Primary Whitelist',
								value: 'primaryTrigWhitelist',
							},
							{
								name: 'Primary Blacklist',
								value: 'primaryTrigBlacklist',
							},
							{
								name: 'Secondary Whitelist',
								value: 'secondaryTrigWhitelist',
							},
							{
								name: 'Secondary Blacklist',
								value: 'secondaryTrigBlacklist',
							},
						),
				)
				.addStringOption((option) =>
					option
						.setName('action')
						.setDescription('Add or remove an ID')
						.setRequired(true)
						.addChoices(
							{name: 'add', value: 'add'},
							{name: 'remove', value: 'remove'},
							{name: 'view', value: 'view'},
						),
				)
				.addStringOption((option) =>
					option
						.setName('id')
						.setDescription('The User/Bot ID to add or remove')
						.setRequired(false),
				),
		),

	async autocomplete(interaction: AutocompleteInteraction) {
		const focused = interaction.options.getFocused().toLowerCase();
		const choices = Object.keys(config)
			.filter((k): k is ConfigKey => isConfigKey(k))
			.filter((k) => k.toLowerCase().includes(focused))
			.map((k) => ({
				name: `${k} (currently: ${renderConfigValue(config[k])})`,
				value: k,
			}))
			.slice(0, 25);
		await interaction.respond(choices);
	},

	async execute(interaction: ChatInputCommandInteraction) {
		if (!adminIds.has(interaction.user.id)) {
			return interaction.reply({
				content: 'you cannot do that bro',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const sub = interaction.options.getSubcommand();

		// Kills bot
		if (sub === 'killbot') {
			await interaction.reply({
				content: 'Shutting down...',
				flags: [MessageFlags.Ephemeral],
			});
			// eslint-disable-next-line unicorn/no-process-exit,n/prefer-global/process
			process.exit(0);
		}

		// Vars
		if (sub === 'vars') {
			const varName = interaction.options.getString('variable');
			const action = interaction.options.getString('action');
			const value = interaction.options.getNumber('value');

			// No variable specified — list all
			if (!varName) {
				const items: string[] = [];
				for (const key of Object.keys(config)) {
					if (!isConfigKey(key)) {
						continue;
					}

					items.push(
						`**${key}**: \`${renderConfigValue(config[key])}\`\n${descriptions[key] ?? ''}`,
					);
				}

				// Split into chunks to avoid 2000 char limit
				const chunks: string[] = [];
				let currentChunk = '';
				for (const item of items) {
					if ((currentChunk + '\n' + item).length > 1900) {
						chunks.push(currentChunk);
						currentChunk = item;
					} else {
						currentChunk += (currentChunk ? '\n' : '') + item;
					}
				}

				if (currentChunk) {
					chunks.push(currentChunk);
				}

				// Send each chunk as a separate embed
				for (let i = 0; i < chunks.length; i++) {
					const embed = new EmbedBuilder()
						.setColor('#00_99_ff')
						.setTitle(`Runtime Config (${i + 1}/${chunks.length})`)
						.setDescription(chunks[i]!);

					if (i === 0) {
						// eslint-disable-next-line no-await-in-loop
						await interaction.reply({
							embeds: [embed],
							flags: [MessageFlags.Ephemeral],
						});
					} else {
						// eslint-disable-next-line no-await-in-loop
						await interaction.followUp({
							embeds: [embed],
							flags: [MessageFlags.Ephemeral],
						});
					}
				}

				return;
			}

			if (!isConfigKey(varName)) {
				return interaction.reply({
					content: `Unknown variable: \`${varName}\``,
					flags: [MessageFlags.Ephemeral],
				});
			}

			const configKey = varName;

			// No action — default to get
			if (!action || action === 'get') {
				return interaction.reply({
					content: `**${configKey}**: \`${renderConfigValue(config[configKey])}\`\n${descriptions[configKey] ?? ''}`,
					flags: [MessageFlags.Ephemeral],
				});
			}

			if (value === null || value === undefined) {
				return interaction.reply({
					content: `You need to provide a value to ${action}.`,
					flags: [MessageFlags.Ephemeral],
				});
			}

			const oldValue = config[configKey];

			if (action === 'set') {
				if (!isNumericConfigKey(configKey)) {
					return interaction.reply({
						content: `Can't set a non-number variable.`,
						flags: [MessageFlags.Ephemeral],
					});
				}

				config[configKey] = value;
				return interaction.reply({
					content: `✅ **${configKey}**: \`${renderConfigValue(oldValue)}\` → \`${value}\``,
					flags: [MessageFlags.Ephemeral],
				});
			}

			if (action === 'add') {
				if (!isNumericConfigKey(configKey)) {
					return interaction.reply({
						content: `Can't add to a non-number variable.`,
						flags: [MessageFlags.Ephemeral],
					});
				}

				config[configKey] += value;
				return interaction.reply({
					content: `✅ **${configKey}**: \`${renderConfigValue(oldValue)}\` + \`${value}\` = \`${renderConfigValue(config[configKey])}\``,
					flags: [MessageFlags.Ephemeral],
				});
			}
		}

		if (sub === 'lists') {
			const listName = interaction.options.getString(
				'listname',
				true,
			);
			const action = interaction.options.getString('action', true);
			const targetId = interaction.options.getString('id');

			if (!isConfigListKey(listName) || !isListAction(action)) {
				return interaction.reply({
					content: 'Invalid list command options provided.',
					flags: [MessageFlags.Ephemeral],
				});
			}

			config.lists[listName] ??= [];

			if (action === 'view') {
				const listString =
					config.lists[listName].length > 0
						? config.lists[listName].join(', ')
						: 'Empty';
				return interaction.reply({
					content: `**${listName}**: ${listString}`,
					flags: [MessageFlags.Ephemeral],
				});
			}

			if (!targetId) {
				return interaction.reply({
					content: 'ID required for this action.',
					flags: [MessageFlags.Ephemeral],
				});
			}

			if (
				action === 'add' &&
				!config.lists[listName].includes(targetId)
			) {
				config.lists[listName].push(targetId);
				return interaction.reply({
					content: `Added \`${targetId}\` to ${listName}`,
					flags: [MessageFlags.Ephemeral],
				});
			}

			if (action === 'remove') {
				config.lists[listName] = config.lists[listName].filter(
					(id) => id !== targetId,
				);
				return interaction.reply({
					content: `Removed \`${targetId}\` from ${listName}`,
					flags: [MessageFlags.Ephemeral],
				});
			}
		}
	},
};

export default hacksCommand;
