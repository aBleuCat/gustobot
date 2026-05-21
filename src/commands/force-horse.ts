import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import rawHorseValues from '../data/horses.json' with {type: 'json'};
import {conditionHorse} from '../lib/helpers/horse-funcs.js';
import type {IUserHorses} from '../lib/models.js';
import {castAsHorseData, castAsTextBased} from '../type-utils.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const UserHorses = mongoose.model<IUserHorses>('UserHorses');
const HORSE_VALUES = castAsHorseData(rawHorseValues, 5);

export const forceHorseCommand = {
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
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(0),

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
		await interaction.respond(choices.slice(0, 25)).catch(() => undefined);
	},

	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.user.id !== '934290747623096381') {
			return interaction.reply({
				content: 'You are not authorized to use this command.',
				flags: [MessageFlags.Ephemeral],
			});
		}

		const target = interaction.options.getUser('target');
		const type = interaction.options.getString('type');
		if (!target || !type)
			return interaction.reply(
				'Something went wrong when trying to get your input',
			);
		const channel = castAsTextBased(interaction.channel);
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
			content: `<@${target.id}> has magically obtained a **${horseDisplay}**`,
			flags: [MessageFlags.Ephemeral],
		});

		if (horseData.link) {
			await channel.send(horseData.link);
		}

		await conditionHorse(inventory, channel);
	},
};
