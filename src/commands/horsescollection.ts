import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };
import { conditionHorse } from '../lib/helpers/horseFuncs.js';

function horseName(slug: string): string {
    const horseData: any = HORSE_VALUES[slug as keyof typeof HORSE_VALUES];
    return horseData?.name ?? slug;
}

export default {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View a collection of horses')
        .addUserOption((option: any) =>
            option.setName('user')
                .setDescription('The user whose collection you want to view')
                .setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;

        const UserHorses = mongoose.model('UserHorses');
        const allUsers = await UserHorses.find();
        const inventory = allUsers.find((u: any) => u.userId === targetUser.id);
        const allPossibleSlugs = Object.keys(HORSE_VALUES).filter((k: string) => {
            const horseData: any = HORSE_VALUES[k as keyof typeof HORSE_VALUES];
            return horseData.comp !== false;
        });

        if (!inventory || !inventory.horses || Array.from(inventory.horses.values()).every((v: any) => v === 0)) {
            const msg = isSelf
                ? "Your stables are empty. Keep talking to find some horses!"
                : `${targetUser.username}'s stables are empty.`;
            await interaction.editReply(msg);
            return;
        }

        let horseListText = "";

        for (const [slug, count] of inventory.horses) {
            if (count <= 0 || !HORSE_VALUES[slug as keyof typeof HORSE_VALUES]) continue;
            const horseData: any = HORSE_VALUES[slug as keyof typeof HORSE_VALUES];
            const val = horseData.value;
            const display = horseName(slug);
            const prefix = slug === "dung_beetle" ? "🪲" : (slug.includes("providence") ? "✨" : "🐎");

            horseListText += `* ${prefix} **${display}**: \`x${count}\` — ($${val.toLocaleString()})\n`;
        }

        const title = isSelf ? "## 🐎 Your Collection 🐎" : `## 🐎 ${targetUser.username}'s Collection 🐎`;
        await interaction.editReply(`${title}\n${horseListText}`);

        if (interaction.channel && 'send' in interaction.channel) {
            conditionHorse(inventory, interaction.channel as any).catch((e: any) => console.error('conditionHorse error:', e));
        }
    }
};
