const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

const OWNER_ID = '934290747623096381';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pingtrigs')
        .setDescription('Manage bot ping responses and triggers (owner only)')
        .addSubcommand(sub =>
            sub.setName('add')
               .setDescription('Add a response (random pool) or trigger (if query provided)')
               .addStringOption(o =>
                   o.setName('response').setDescription('What the bot replies').setRequired(true))
               .addStringOption(o =>
                   o.setName('query')
                    .setDescription('Trigger query e.g. "contains:bob !from:bob". Leave blank for random pool')
                    .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
               .setDescription('Remove a response or trigger by its MongoDB _id')
               .addStringOption(o =>
                   o.setName('id').setDescription('MongoDB _id of the entry').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('List all responses and triggers')),

    async execute(interaction) {
        const PingResponse = mongoose.model('PingResponse');
        const PingTrigger  = mongoose.model('PingTrigger');

        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'nope', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const response = interaction.options.getString('response');
            const query    = interaction.options.getString('query') ?? '';

            if (query) {
                const entry = await new PingTrigger({ query, response, authorId: interaction.user.id }).save();
                return interaction.editReply(
                    `Added trigger \`${entry._id}\`\n**Query:** \`${query}\`\n**Response:** ${response}`
                );
            } else {
                const entry = await new PingResponse({ content: response, authorId: interaction.user.id }).save();
                return interaction.editReply(`Added to random pool \`${entry._id}\`:\n> ${response}`);
            }
        }

        if (sub === 'remove') {
            const id = interaction.options.getString('id');
            const deletedResponse = await PingResponse.findByIdAndDelete(id).catch(() => null);
            if (deletedResponse) return interaction.editReply(`Removed pool response \`${id}\`.`);
            const deletedTrigger = await PingTrigger.findByIdAndDelete(id).catch(() => null);
            if (deletedTrigger) return interaction.editReply(`Removed trigger \`${id}\`.`);
            return interaction.editReply(`No entry found with id \`${id}\`.`);
        }

        if (sub === 'list') {
            const [pool, triggers] = await Promise.all([PingResponse.find({}), PingTrigger.find({})]);
            const lines = [];

            if (pool.length) {
                lines.push('**Random Pool:**');
                pool.forEach(r => lines.push(`• \`${r._id}\` — ${r.content.slice(0, 80)}${r.content.length > 80 ? '…' : ''}`));
            }
            if (triggers.length) {
                if (lines.length) lines.push('');
                lines.push('**Triggers:**');
                triggers.forEach(t => lines.push(`• \`${t._id}\` \`${t.query}\`\n  → ${t.response.slice(0, 60)}${t.response.length > 60 ? '…' : ''}`));
            }
            if (!lines.length) return interaction.editReply('Nothing added yet.');

            let out = '';
            for (const line of lines) {
                if ((out + '\n' + line).length > 1900) { out += '\n…(truncated)'; break; }
                out += (out ? '\n' : '') + line;
            }
            return interaction.editReply(out);
        }
    },
};
