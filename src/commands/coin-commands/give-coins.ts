import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {UserHorses} from '../../lib/models.js';

export const data = new SlashCommandBuilder()
	.setName('give')
	.setDescription('Give your horse coins to another user!')
	.addUserOption((option) =>
		option
			.setName('target')
			.setDescription('Who to give coins to')
			.setRequired(true),
	)
	.addIntegerOption((option) =>
		option
			.setName('amount')
			.setDescription('How many coins to give')
			.setRequired(true)
			.setMinValue(1),
	);
export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	const target = interaction.options.getUser('target');
	const amount = interaction.options.getInteger('amount');
	if (!target || !amount)
		return interaction.reply(
			'Something went kaboom when trying to get your inputs',
		);

	if (target.id === interaction.user.id) {
		return interaction.reply({
			content: `You can't give coins to yourself!`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (target.bot) {
		return interaction.reply({
			content: `You can't give coins to a bot!`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	const sender = await UserHorses.findOne({
		userId: interaction.user.id,
	});
	if (sender && (sender.horseCoins || 0) < 0) {
		return interaction.reply({
			content: `You are in coin debt (**${sender.horseCoins}**). You can't give coins until you break even.`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	if (!sender || (sender.horseCoins || 0) < amount) {
		return interaction.reply({
			content: `You don't have **${amount}** 🪙 to give!`,
			flags: [MessageFlags.Ephemeral],
		});
	}

	let receiver = await UserHorses.findOne({userId: target.id});
	receiver ??= new UserHorses({
		userId: target.id,
		horses: new Map(),
	});

	sender.horseCoins -= amount;
	receiver.horseCoins = (receiver.horseCoins || 0) + amount;

	await sender.save();
	await receiver.save();

	return interaction.reply(
		`<@${interaction.user.id}> gave **${amount}** 🪙 Horse Coin${amount === 1 ? '' : 's'} to <@${target.id}>!`,
	);
}
