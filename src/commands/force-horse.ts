import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from 'discord.js';
import rawHorseValues from '../data/horses.json' with {type: 'json'};
import {conditionHorse} from '../lib/helpers/horse-funcs.js';
import {UserHorses} from '../lib/models.js';
import {castAsHorseData} from '../type-utils.js';
import {immutConfig} from '../lib/config.js';

const HORSE_VALUES = castAsHorseData(rawHorseValues, 5);

const forceHorseCommand = {
	data: new SlashCommandBuilder()
		.setName('forcehorse')
		.setDescription(
			'Owner Only: Give a user a horse or a rare creature',
		)
		.addUserOption((option) =>
			option
				.setName('target')
				.setDescription('The user to receive the item')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('The type')
				.setRequired(true)
				.setAutocomplete(true),
		)
		.addBooleanOption((option) =>
			option
				.setName('ephemeral')
				.setDescription(
					'Shall everyone see the spawn message?',
				)
				.setRequired(false),
		),

	async autocomplete(interaction: AutocompleteInteraction) {
		const focusedValue = interaction.options
			.getFocused()
			.toLowerCase();

		// Filter horses based on the input
		const choices = Object.entries(HORSE_VALUES)
			.filter(
				([slug, data]) =>
					data.name.toLowerCase().includes(focusedValue) ||
					slug.toLowerCase().includes(focusedValue),
			)
			.map(([slug, data]) => ({
				name: data.name,
				value: slug,
			}));

		// Discord limits autocomplete to 25 results
		await interaction
			.respond(choices.slice(0, 25))
			.catch(() => undefined);
	},

	async execute(interaction: ChatInputCommandInteraction) {
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content:
					'You are not authorized to use this command.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const target = interaction.options.getUser('target');
		const type = interaction.options.getString('type');
		const isEphemeral =
			interaction.options.getBoolean('ephemeral') ?? true;
		if (!target || !type)
			return interaction.reply(
				'Something went wrong when trying to get your input',
			);
		// Verify the horse type exists in data
		const horseData = HORSE_VALUES[type];
		if (!horseData) {
			return interaction.reply({
				content: 'Invalid horse type selected.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		let inventory = await UserHorses.findOne({userId: target.id});
		inventory ??= new UserHorses({
			userId: target.id,
			horses: new Map(),
		});

		const currentCount = inventory.horses.get(type) ?? 0;
		inventory.horses.set(type, currentCount + 1);

		await inventory.save();

		const horseDisplay = horseData.name;
		await interaction.reply({
			content: `A ${horseDisplay} has been materialized and given to <@${target.id}>`,
			flags: [MessageFlags.Ephemeral],
		});
		await interaction.followUp({
			content: `<@${target.id}> has magically obtained a **${horseDisplay}**`,
			flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
		});

		if (horseData.link)
			await interaction.followUp({
				content: horseData.link,
				flags: isEphemeral ? [MessageFlags.Ephemeral] : [],
			});

		await conditionHorse(inventory, {interaction});
	},
};

export default forceHorseCommand;
