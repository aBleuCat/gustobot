import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';
export default {
    data: new SlashCommandBuilder()
        .setName('pingtrigs')
        .setDescription('Manage custom bot ping responses')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) => sub
        .setName('add')
        .setDescription('Add a ping trigger')
        .addStringOption((o) => o.setName('trigger').setDescription('Trigger word/phrase').setRequired(true))
        .addStringOption((o) => o.setName('response').setDescription('Bot response').setRequired(true))
        .addStringOption((o) => o
        .setName('type')
        .setDescription('Match type')
        .addChoices({ name: 'exact', value: 'exact' }, { name: 'contains', value: 'contains' }, { name: 'author', value: 'author' })
        .setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('list')
        .setDescription('List all triggers'))
        .addSubcommand((sub) => sub
        .setName('remove')
        .setDescription('Remove a trigger')
        .addStringOption((o) => o.setName('id').setDescription('Trigger ID').setRequired(true))),
    async execute(interaction) {
        const PingResponse = mongoose.model('PingResponse');
        const sub = interaction.options.getSubcommand();
        if (sub === 'add') {
            const trigger = interaction.options.getString('trigger');
            const response = interaction.options.getString('response');
            const type = interaction.options.getString('type');
            const doc = new PingResponse({ trigger, response, type, guildId: interaction.guild.id });
            await doc.save();
            await interaction.reply(`Added trigger \`${trigger}\` → \`${response}\` (${type})`);
        }
        else if (sub === 'list') {
            const triggers = await PingResponse.find({ guildId: interaction.guild.id });
            if (!triggers.length)
                await interaction.reply('No triggers setup');
            const list = triggers.map((t) => `**${t._id}**: ${t.trigger} (${t.type}) → ${t.response}`).join('\n');
            await interaction.reply(list);
        }
        else if (sub === 'remove') {
            const id = interaction.options.getString('id');
            await PingResponse.deleteOne({ _id: id });
            await interaction.reply(`Removed trigger ${id}`);
        }
    }
};
//# sourceMappingURL=pingtrigs.js.map