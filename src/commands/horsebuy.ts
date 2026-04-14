import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };
import { config } from '../lib/config.js';
import { devLog } from '../lib/helpers/devLog.js';

const maxAmount = 10 ** 9;
const COMMON_SLUG = 'common_horse';

function horseName(slug: string): string {
  return (HORSE_VALUES as any)[slug]?.name ?? slug;
}

export default {
  data: new SlashCommandBuilder()
    .setName('horsebuy')
    .setDescription('Buy common horses for Horse Coins')
    .addIntegerOption(o =>
      o.setName('count').setDescription('How many to buy').setRequired(false).setMinValue(1).setMaxValue(maxAmount)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const UserHorses = mongoose.model('UserHorses');
    const count = interaction.options.getInteger('count') || 1;
    const totalCost = config.COMMON_BUY_PRICE * count;

    let inventory = await UserHorses.findOne({ userId: interaction.user.id });
    const currentCoins = inventory?.horseCoins || 0;

    if (currentCoins < totalCost) {
      await interaction.editReply({
        content: `You need **${totalCost}** 🪙 Horse Coins to buy **${count}x** **${horseName(COMMON_SLUG)}**, but you only have **${currentCoins}**.`,
      });
    }

    if (!inventory) {
      inventory = new UserHorses({ userId: interaction.user.id, horses: new Map(), horseCoins: 0 });
    }

    inventory.horses.set(COMMON_SLUG, (inventory.horses.get(COMMON_SLUG) || 0) + count);
    inventory.horseCoins = currentCoins - totalCost;
    await inventory.save();
    const name = horseName(COMMON_SLUG);
    devLog(
      `/horsebuy:${interaction.user.tag} bought \`${count}x\` ${name} for ${totalCost} coins. Remaining balance: ${inventory.horseCoins} coins.`
    );
    await interaction.editReply(
      `You bought ${count > 1 ? `**${count}x** ` : 'a '}**${name}** for **${totalCost}** 🪙 Horse Coin${totalCost !== 1 ? 's' : ''}\nBalance: **${inventory.horseCoins}** 🪙`
    );
  },
};
