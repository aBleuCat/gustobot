import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import mongoose from 'mongoose';
import type {IUserHorses} from '../../lib/models.js';

export const data = new SlashCommandSubcommandBuilder()
	.setName('count')
	.setDescription('Check horse coin balance')
	.addUserOption((option) =>
		option
			.setName('user')
			.setDescription('User to check (optional, defaults to you)')
			.setRequired(false),
	);
export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const UserHorses = mongoose.model<IUserHorses>('UserHorses');
	const targetUser =
		interaction.options.getUser('user') ?? interaction.user;
	const inventory = await UserHorses.findOne({
		userId: targetUser.id,
	});
	const coins = inventory?.horseCoins ?? 0;

	return interaction.reply({
		content: `<@${targetUser.id}> has **${coins}** 🪙 Horse Coin${coins === 1 ? '' : 's'}`,
	});
}
