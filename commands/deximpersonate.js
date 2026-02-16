const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deximpersonate')
        .setDescription('Impersonate a user to spawn a countryball')
        .addUserOption(o => o.setName('target').setDescription('User to impersonate').setRequired(true))
        .addAttachmentOption(o => o.setName('image').setDescription('The image to display').setRequired(true))
        .addStringOption(o => o.setName('formanswer').setDescription('The correct answer').setRequired(true))
        .addStringOption(o => o.setName('boldtext').setDescription('The rarity/type text').setRequired(true))
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

        // We store the target.id at the end of the customId
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`catch::${ans}::${bold}::${target.id}`) 
                .setLabel('Catch me')
                .setStyle(ButtonStyle.Primary),
        );

        await webhook.send({
            content: `A wild countryball appeared!`,
            files: [image.url],
            components: [row]
        });

        await webhook.delete();
        
        // Log the spawn to your mod channel
        await interaction.client.logToModChannel(interaction.guild, `**Spawn**: ${interaction.user.tag} spawned **${ans}** impersonating ${target.tag}.`);
        
        await interaction.reply({ content: 'Spawned successfully!', ephemeral: true });
    },
};
