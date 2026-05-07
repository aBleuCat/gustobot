const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

const OWNER_ID = '934290747623096381';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pingtrigs')
        .setDescription('Manage bot ping responses and triggers (owner only)')
        .addSubcommand(sub =>
            sub.setName('add')
               .setDescription('Add a response to the random pool or with a trigger')
               .addStringOption(o =>
                   o.setName('response').setDescription('What the bot replies').setRequired(true))
               .addStringOption(o =>
                   o.setName('triggertype')
                    .setDescription('Type of trigger (leave blank for random pool)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'contains', value: 'contains' },
                        { name: 'author', value: 'author' },
                        { name: 'exact', value: 'exact' }
                    ))
               .addStringOption(o =>
                   o.setName('triggertext')
                    .setDescription('Trigger text or user ID (required if trigger type is set)')
                    .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
               .setDescription('Remove an entry by its MongoDB _id')
               .addStringOption(o =>
                   o.setName('id').setDescription('MongoDB _id of the entry').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('List all responses and triggers')),

    async execute(interaction) {
        const PingResponse = mongoose.model('PingResponse');

        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'nope', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const response = interaction.options.getString('response');
            const triggerType = interaction.options.getString('triggertype');
            const triggerText = interaction.options.getString('triggertext');

            if (triggerType && !triggerText) {
                return interaction.editReply('You set a trigger type but no trigger text!');
            }

            const entry = await PingResponse.create({
                message: response,
                trigger: triggerType ? { type: triggerType, text: triggerText } : {}
            });

            return interaction.editReply(
                triggerType
                    ? `Added trigger \`${entry._id}\`\n**Type:** \`${triggerType}\` **Text:** \`${triggerText}\`\n**Response:** ${response}`
                    : `Added to random pool \`${entry._id}\`:\n> ${response}`
            );
        }

        if (sub === 'remove') {
            const id = interaction.options.getString('id');
            const deleted = await PingResponse.findByIdAndDelete(id).catch(() => null);
            if (deleted) return interaction.editReply(`Removed \`${id}\`.`);
            return interaction.editReply(`No entry found with id \`${id}\`.`);
        }

        if (sub === 'list') {
            const all = await PingResponse.find({});
            if (!all.length) return interaction.editReply('Nothing added yet.');

            const pool = all.filter(e => !e.trigger?.type);
            const triggers = all.filter(e => e.trigger?.type);
            const lines = [];

            if (pool.length) {
                lines.push('**Random Pool:**');
                pool.forEach(r => lines.push(`• \`${r._id}\` — ${r.message.slice(0, 80)}${r.message.length > 80 ? '…' : ''}`));
            }
            if (triggers.length) {
                if (lines.length) lines.push('');
                lines.push('**Triggers:**');
                triggers.forEach(t => lines.push(`• \`${t._id}\` \`${t.trigger.type}:${t.trigger.text}\`\n  → ${t.message.slice(0, 60)}${t.message.length > 60 ? '…' : ''}`));
            }

            // Split into chunks of 1900 characters to be safe
            const chunks = [];
            let currentChunk = '';

            for (const line of lines) {
                if ((currentChunk + '\n' + line).length > 1900) {
                    chunks.push(currentChunk);
                    currentChunk = line;
                } else {
                    currentChunk += (currentChunk ? '\n' : '') + line;
                }
            }
            if (currentChunk) chunks.push(currentChunk);

            // Edit the initial deferred reply with the first chunk
            await interaction.editReply(chunks[0]);

            // Send subsequent chunks as follow-up messages
            if (chunks.length > 1) {
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({ content: chunks[i], ephemeral: true });
                }
            }
        }
    },
};