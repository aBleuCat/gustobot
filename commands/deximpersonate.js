const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deximpersonate')
        .setDescription('Impersonate a user to spawn a countryball')
        .addUserOption(o => o.setName('target').setDescription('User to impersonate').setRequired(true))
        .addAttachmentOption(o => o.setName('image').setDescription('The image to display').setRequired(true))
        .addStringOption(o => o.setName('formanswer').setDescription('The correct answer').setRequired(true))
        .addStringOption(o => o.setName('boldtext').setDescription('The rarity/type text').setRequired(true))
        .addStringOption(o => o.setName('texttype').setDescription('Format of the success message').setRequired(true)
            .addChoices(
                { name: 'Bold Text (Standard)', value: 'boldtext' },
                { name: 'Full Text (Custom)', value: 'fulltext' }
            ))
        .addStringOption(o => o.setName('stats').setDescription('Custom stats (e.g. #ABCDEF, +1%/+2%). Optional.').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const image = interaction.options.getAttachment('image');
        const ans = interaction.options.getString('formanswer');
        const bold = interaction.options.getString('boldtext');
        const type = interaction.options.getString('texttype');
        const stats = interaction.options.getString('stats') || "DEFAULT"; // Fallback to string "DEFAULT"

        const webhook = await interaction.channel.createWebhook({
            name: target.username,
            avatar: target.displayAvatarURL(),
        });

        // customId format: catch::answer::boldText::textType::targetId::stats
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`catch::${ans}::${bold}::${type}::${target.id}::${stats}`) 
                .setLabel('Catch me')
                .setStyle(ButtonStyle.Primary),
        );

        await webhook.send({
            content: `A wild countryball appeared!`,
            files: [image.url],
            components: [row]
        });

        await webhook.delete();
        await interaction.client.logToModChannel(interaction.guild, `**Spawn**: ${interaction.user.tag} spawned **${ans}** impersonating ${target.tag}.`);
        await interaction.reply({ content: 'Spawned successfully!', ephemeral: true });
    },
};
