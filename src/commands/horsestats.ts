import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };

const HORSES_PER_PAGE = 15;

function horseName(slug: string): string {
  return (HORSE_VALUES as Record<string, any>)[slug]?.name ?? slug;
}

function gini(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) numerator += Math.abs(sorted[i] - sorted[j]);
  return numerator / (2 * n * n * mean);
}

function buildBreakdownPage(sortedHorses: Array<[string, number]>, page: number): string {
  const totalPages = Math.ceil(sortedHorses.length / HORSES_PER_PAGE);
  const slice = sortedHorses.slice(page * HORSES_PER_PAGE, (page + 1) * HORSES_PER_PAGE);
  const lines = [
    `🐴 **Horse Breakdown** (page ${page + 1}/${totalPages})`,
    '',
    ...slice.map(([slug, count]) => `* **${horseName(slug)}**: ${count}`),
  ];
  return lines.join('\n');
}

function buildPageButtons(page: number, totalPages: number, statsId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hstats::${statsId}::${page - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`hstats::${statsId}::${page + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1),
  );
}

const breakdownStore = new Map<string, Array<[string, number]>>();

export default {
  data: new SlashCommandBuilder().setName('horsestats').setDescription('View global horse economy statistics'),

  handleButton: async function (interaction: ButtonInteraction): Promise<void> {
    const [, statsId, pageStr] = interaction.customId.split('::');
    const page = parseInt(pageStr);
    const sortedHorses = breakdownStore.get(statsId);

    if (!sortedHorses) {
      await interaction.reply({ content: 'This stats session has expired. Run /horsestats again.', flags: MessageFlags.Ephemeral });
      return;
    }

    const totalPages = Math.ceil(sortedHorses.length / HORSES_PER_PAGE);
    const content = buildBreakdownPage(sortedHorses, page);
    const row = buildPageButtons(page, totalPages, statsId);
    await interaction.update({ content, components: [row] });
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const UserHorses = mongoose.model('UserHorses');
    const allUsers = await UserHorses.find({});

    if (!allUsers.length) {
      await interaction.editReply('No horse data yet!');
      return;
    }

    const horseCounts: Record<string, number> = {};
    const playerWealth: number[] = [];
    const playerHorseCounts: number[] = [];
    let totalCoins = 0;
    let totalHorses = 0;
    let totalWealth = 0;
    let playersWithHorses = 0;

    for (const user of allUsers) {
      let userWealth = 0;
      let userHorseCount = 0;
      totalCoins += user.horseCoins || 0;

      if (user.horses) {
        for (const [slug, count] of user.horses.entries()) {
          horseCounts[slug] = (horseCounts[slug] || 0) + count;
          const price = (HORSE_VALUES as Record<string, any>)[slug]?.value || 1;
          userWealth += price * count;
          userHorseCount += count;
          totalHorses += count;
        }
      }

      if (userHorseCount) {
        playersWithHorses++;
        playerHorseCounts.push(userHorseCount);
      }
      playerWealth.push(userWealth);
      totalWealth += userWealth;
    }

    const sortedHorses = Object.entries(horseCounts).sort((a, b) => b[1] - a[1]);
    const totalPages = Math.ceil(sortedHorses.length / HORSES_PER_PAGE);
    const statsId = Math.random().toString(36).slice(2, 9);
    breakdownStore.set(statsId, sortedHorses);
    setTimeout(() => breakdownStore.delete(statsId), 10 * 60 * 1000);

    const giniWealth = gini(playerWealth);
    const giniHorses = gini(playerHorseCounts);
    const avgWealthPerPlayer = Math.round(totalWealth / allUsers.length);
    const avgHorsesPerPlayer = parseFloat((totalHorses / allUsers.length).toFixed(2));

    const statsText = [
      `**Global Horse Economy Statistics**`,
      ``,
      `👥 Players: ${allUsers.length}`,
      `🪙 Total Coins: ${totalCoins}`,
      `🐴 Total Horses: ${totalHorses} (${playersWithHorses} have horses)`,
      `💰 Total Wealth: ${totalWealth}`,
      ``,
      `📊 **Distribution (Gini)**:`,
      `• Wealth Gini: ${(giniWealth * 100).toFixed(2)}%`,
      `• Horse Gini: ${(giniHorses * 100).toFixed(2)}%`,
      ``,
      `📈 **Per Player Averages**:`,
      `• Avg Wealth: ${avgWealthPerPlayer}`,
      `• Avg Horses: ${avgHorsesPerPlayer}`,
    ].join('\n');

    const firstPageContent = buildBreakdownPage(sortedHorses, 0);
    const row = buildPageButtons(0, totalPages, statsId);

    await interaction.editReply({
      content: statsText + '\n\n' + firstPageContent,
      components: [row],
    });
  },
};
