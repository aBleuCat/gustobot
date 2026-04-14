import { SlashCommandBuilder, PermissionFlagsBits, AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import mongoose from 'mongoose';
import HORSE_VALUES from '../horses.json' assert { type: 'json' };
import { conditionHorse } from '../lib/helpers/horseFuncs.js';

const UserHorses = mongoose.model('UserHorses');

export default {
    data: new SlashCommandBuilder()
        .setName('forcehorse')
        .setDescription('Owner Only: Give a user a horse or a rare creature')
        .addUserOption((o: any) => o.setName('target').setDescription('The user to receive the item').setRequired(true))
        .addStringOption((o: any) => o 
            .setName('type')
            .setDescription('The type')
            .setRequired(true)
            .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const focusedValue = interaction.options.getFocused().toString().toLowerCase();
        
        const choices = Object.entries(HORSE_VALUES)
            .filter(([slug, data]: any) => 
                data.name.toLowerCase().includes(focusedValue) || 
                slug.toLowerCase().includes(focusedValue)
            )
            .map(([slug, data]: any) => ({
                name: data.name,
                value: slug
            }));

        await interaction.respond(choices.slice(0, 25)).catch(() => {});
    },

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (interaction.user.id !== '934290747623096381') {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('target');
        const type = interaction.options.getString('type');
        
        const horseData: any = HORSE_VALUES[type as keyof typeof HORSE_VALUES];
        if (!horseData) {
            await interaction.reply({ content: "Invalid horse type selected.", ephemeral: true });
            return;
        }

        let inventory = await UserHorses.findOne({ userId: target!.id });
        if (!inventory) {
            inventory = new UserHorses({ userId: target!.id, horses: new Map() });
        }

        const currentCount = inventory.horses.get(type) || 0;
        inventory.horses.set(type, currentCount + 1);
        
        await inventory.save();

        const horseDisplay = horseData.name;
        await interaction.reply({ 
            content: `<@${target!.id}> has magically obtained a **${horseDisplay}**`, 
            ephemeral: false 
        });

        if (horseData.link && 'send' in interaction.channel!) {
            await (interaction.channel as any).send(horseData.link);
        }

        if (interaction.channel && 'send' in interaction.channel) {
            await conditionHorse(inventory, interaction.channel as any).catch((e: any) => console.error(e));
        }
    }
};
