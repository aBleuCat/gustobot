import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };
export default {
    data: new SlashCommandBuilder()
        .setName('replacehorses')
        .setDescription('Replace all instances of one horse with another (ADMIN ONLY)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((o) => o
        .setName('oldslug')
        .setDescription('Slug of horse to replace')
        .setRequired(true)
        .setAutocomplete(true))
        .addStringOption((o) => o
        .setName('newslug')
        .setDescription('Slug to replace with')
        .setRequired(true)
        .setAutocomplete(true)),
    async execute(interaction) {
        const oldSlug = interaction.options.getString('oldslug');
        const newSlug = interaction.options.getString('newslug');
        if (!HORSE_VALUES[oldSlug]) {
            await interaction.reply({ content: `Invalid old slug: ${oldSlug}`, flags: MessageFlags.Ephemeral });
        }
        if (!HORSE_VALUES[newSlug]) {
            await interaction.reply({ content: `Invalid new slug: ${newSlug}`, flags: MessageFlags.Ephemeral });
        }
        const UserHorses = mongoose.model('UserHorses');
        const allHorses = await UserHorses.find();
        let totalReplaced = 0;
        for (const inventory of allHorses) {
            const count = inventory.horses.get(oldSlug) || 0;
            if (count > 0) {
                inventory.horses.delete(oldSlug);
                const newCount = (inventory.horses.get(newSlug) || 0) + count;
                inventory.horses.set(newSlug, newCount);
                await inventory.save();
                totalReplaced += count;
            }
        }
        await interaction.reply({
            content: `Replaced **${totalReplaced}** instances of ${oldSlug} → ${newSlug}`,
            flags: MessageFlags.Ephemeral
        });
    }
};
//# sourceMappingURL=replacehorses.js.map