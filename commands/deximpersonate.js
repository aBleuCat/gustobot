const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deximpersonate')
        .setDescription('Impersonate a user to spawn a countryball')
        .addUserOption(option => 
            option.setName('target').setDescription('User to impersonate').setRequired(true))
        .addAttachmentOption(option => 
            option.setName('image').setDescription('The image to display').setRequired(true))
        .addStringOption(option => 
            option.setName('formanswer').setDescription('The correct answer').setRequired(true))
        .addStringOption(option => 
            option.setName('boldtext').setDescription('The rarity/type text').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const image = interaction.options.getAttachment('image');
        const ans = interaction.options.getString('formanswer');
        const bold = interaction.options.getString('boldtext');

        const webhook = await interaction.channel.createWebhook({
            name: target.username,
            avatar: target.displayAvatarURL(),
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`catch::${ans}::${bold}`) 
                .setLabel('Catch me')
                .setStyle(ButtonStyle.Primary),
        );

        await webhook.send({
            content: `A wild countryball appeared!`,
            files: [image.url],
            components: [row]
        });

        await webhook.delete();
        await interaction.reply({ content: 'Spawned successfully!', ephemeral: true });
    },
};