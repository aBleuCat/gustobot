import {
	SlashCommandSubcommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import {config} from '../../lib/config.js';
import {devLog} from '../../lib/helpers/dev-log.js';
import {UserHorses} from '../../lib/models.js';
import {horseName} from '../../lib/helpers/horse-funcs.js';
import {handleCommandError} from '../../lib/helpers/error-handlers.js';

const maxAmount = 10 ** 9;
const COMMON_SLUG = 'common_horse';

export const data = new SlashCommandSubcommandBuilder()
	.setName('buy')
	.setDescription('Buy common horses for Horse Coins')
	.addIntegerOption((option) =>
		option
			.setName('count')
			.setDescription('How many to buy')
			.setRequired(false)
			.setMinValue(1)
			.setMaxValue(maxAmount),
	);

export async function execute(
	interaction: ChatInputCommandInteraction,
) {
	await interaction.deferReply();
	const count = interaction.options.getInteger('count') ?? 1;
	const totalCost = config.COMMON_BUY_PRICE * count;

	let inventory = await UserHorses.findOne({
		userId: interaction.user.id,
	});
	const currentCoins = inventory?.horseCoins ?? 0;

	if (currentCoins < totalCost) {
		return interaction.editReply({
			content: `You need **${totalCost}** 🪙 Horse Coins to buy **${count}x** **${horseName(COMMON_SLUG)}**, but you only have **${currentCoins}**.`,
		});
	}

	inventory ??= new UserHorses({
		userId: interaction.user.id,
		horses: new Map(),
		horseCoins: 0,
	});

	inventory.horses.set(
		COMMON_SLUG,
		(inventory.horses.get(COMMON_SLUG) ?? 0) + count,
	);
	inventory.horseCoins = currentCoins - totalCost;
	await inventory.save();
	const name = horseName(COMMON_SLUG);
	devLog(
		`/horsebuy:${interaction.user.tag} bought \`${count}x\` ${name} for ${totalCost} coins. Remaining balance: ${inventory.horseCoins} coins.`,
	).catch((error: unknown) => {
		void handleCommandError(error, interaction);
	});
	return interaction.editReply(
		`You bought ${count > 1 ? `**${count}x** ` : 'a '}**${name}** for **${totalCost}** 🪙 Horse Coin${totalCost === 1 ? '' : 's'}\nBalance: **${inventory.horseCoins}** 🪙`,
	);
}
