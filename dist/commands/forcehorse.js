import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };
import { conditionHorse } from '../lib/helpers/horseFuncs.js';
const UserHorses = mongoose.model('UserHorses');
export default {
    data: new SlashCommandBuilder()
        .setName('forcehorse')
        .setDescription('Owner Only: Give a user a horse or a rare creature')
        .addUserOption((o) => o.setName('target').setDescription('The user to receive the item').setRequired(true))
        .addStringOption((o) => o
        .setName('type')
        .setDescription('The type')
        .setRequired(true)
        .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toString().toLowerCase();
        const choices = Object.entries(HORSE_VALUES)
            .filter(([slug, data]) => data.name.toLowerCase().includes(focusedValue) ||
            slug.toLowerCase().includes(focusedValue))
            .map(([slug, data]) => ({
            name: data.name,
            value: slug
        }));
        await interaction.respond(choices.slice(0, 25)).catch(() => { });
    },
    async execute(interaction) {
        if (interaction.user.id !== '934290747623096381') {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }
        const target = interaction.options.getUser('target');
        const type = interaction.options.getString('type');
        const horseData = HORSE_VALUES[type];
        if (!horseData) {
            await interaction.reply({ content: "Invalid horse type selected.", ephemeral: true });
            return;
        }
        let inventory = await UserHorses.findOne({ userId: target.id });
        if (!inventory) {
            inventory = new UserHorses({ userId: target.id, horses: new Map() });
        }
        const currentCount = inventory.horses.get(type) || 0;
        inventory.horses.set(type, currentCount + 1);
        await inventory.save();
        const horseDisplay = horseData.name;
        await interaction.reply({
            content: `<@${target.id}> has magically obtained a **${horseDisplay}**`,
            ephemeral: false
        });
        if (horseData.link && 'send' in interaction.channel) {
            await interaction.channel.send(horseData.link);
        }
        if (interaction.channel && 'send' in interaction.channel) {
            await conditionHorse(inventory, interaction.channel).catch((e) => console.error(e));
        }
    }
};
//# sourceMappingURL=forcehorse.js.map