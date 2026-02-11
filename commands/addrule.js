const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorolechange')
        .setDescription('Create a trigger to change roles temporarily')
        .addUserOption(o => o.setName('messager').setDescription('User who sends message').setRequired(true))
        .addUserOption(o => o.setName('target_user').setDescription('User mentioned').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel to monitor').setRequired(true))
        .addRoleOption(o => o.setName('add_role').setDescription('Role to give temporarily').setRequired(true))
        .addRoleOption(o => o.setName('restore_role').setDescription('Role to restore').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Hours before revert').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const durationMs = interaction.options.getInteger('duration') * 60 * 60 * 1000;
        
        const rule = {
            id: Date.now().toString().slice(-6), // Unique ID for removing later
            watchUser: interaction.options.getUser('messager').id,
            targetUser: interaction.options.getUser('target_user').id,
            channel: interaction.options.getChannel('channel').id,
            addRole: interaction.options.getRole('add_role').id,
            restoreRole: interaction.options.getRole('restore_role').id,
            durationMs: durationMs
        };

        const path = './data/rules.json';
        if (!fs.existsSync('./data')) fs.mkdirSync('./data');
        
        let rules = [];
        if (fs.existsSync(path)) {
            const data = fs.readFileSync(path, 'utf8');
            rules = data ? JSON.parse(data) : [];
        }

        rules.push(rule);
        fs.writeFileSync(path, JSON.stringify(rules, null, 2));

        await interaction.reply({ content: `Rule saved! ID: **${rule.id}**`, ephemeral: true });
    }
};
