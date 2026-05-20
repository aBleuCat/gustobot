import {
	SlashCommandBuilder,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IUserHorses} from '../lib/models.js';

export const forceCoinsCommand = {
	data: new SlashCommandBuilder()
		.setName('forcecoins')
		.setDescription('Owner Only: Give horse coins to a user')
		.addUserOption((option) =>
			option
				.setName('target')
				.setDescription('The user to receive coins')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('How many coins to give')
				.setRequired(true)
				.setMinValue(1),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.user.id !== '934290747623096381') {
			return interaction.reply({
				content: `You are not authorized to use this command.`,
				flags: [MessageFlags.Ephemeral],
			});
		}

		// eslint-disable-next-line @typescript-eslint/naming-convention
		const UserHorses = mongoose.model<IUserHorses>('UserHorses');
		const target = interaction.options.getUser('target');
		const amount = interaction.options.getInteger('amount');
		if (!target || !amount)
			return interaction.reply(
				"Uh oh something exploded kaboom and I didn't get your input",
			);

		let inventory = await UserHorses.findOne({userId: target.id});
		inventory ??= new UserHorses({
			userId: target.id,
			horses: new Map(),
		});

		inventory.horseCoins = (inventory.horseCoins || 0) + amount;
		await inventory.save();

		return interaction.reply(
			`<@${target.id}> has been given **${amount}** 🪙 Horse Coin${amount === 1 ? '' : 's'}!`,
		);
	},
};
