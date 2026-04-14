import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { catchDataStore } from '../lib/handlers/interactionHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deximpersonate')
        .setDescription('Impersonate a user to spawn a countryball')
        .addUserOption((o: any) => o.setName('target').setDescription('User to impersonate').setRequired(true))
        .addAttachmentOption((o: any) => o.setName('image').setDescription('The image to display').setRequired(true))
        .addStringOption((o: any) => o.setName('formanswer').setDescription('The correct answer').setRequired(true))
        .addStringOption((o: any) => o.setName('boldtext').setDescription('The rarity/type text').setRequired(true))
        .addStringOption((o: any) => o.setName('texttype').setDescription('Format of the success message').setRequired(true)
            .addChoices(
                { name: 'Bold Text (Standard)', value: 'boldtext' },
                { name: 'Full Text (Custom)', value: 'fulltext' }
            ))
        .addStringOption((o: any) => o.setName('stats').setDescription('Custom stats (e.g. #ABCDEF, +1%/+2%). Optional.').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const target = interaction.options.getUser('target');
            const image = interaction.options.getAttachment('image');
            const ans = interaction.options.getString('formanswer');
            const bold = interaction.options.getString('boldtext');
            const type = interaction.options.getString('texttype');
            const stats = interaction.options.getString('stats') || "DEFAULT";

            const spawnId = `${target!.id}-${Date.now()}`;
            catchDataStore.set(spawnId, { ans: ans!, bold: bold!, type: type!, targetId: target!.id, stats });

            if (!interaction.channel || !('createWebhook' in interaction.channel)) {
                await interaction.reply({ content: 'Cannot create webhook in this channel type.', flags: MessageFlags.Ephemeral });
                return;
            }

            const webhook = await interaction.channel.createWebhook({
                name: target!.username,
                avatar: target!.displayAvatarURL(),
            });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`catch::${spawnId}`)
                    .setLabel('Catch me')
                    .setStyle(ButtonStyle.Primary),
            );

            await webhook?.send({
                content: `A wild countryball appeared!`,
                files: [image!.url],
                components: [row]
            });
            await webhook?.delete();

            if (interaction.client.logToModChannel) {
                await (interaction.client as any).logToModChannel(interaction.guild, `**Spawn**: ${interaction.user.tag} spawned **${ans}** impersonating ${target!.tag}.`);
            }
            await interaction.reply({ content: 'Spawned successfully!', flags: MessageFlags.Ephemeral });

        } catch (e: any) {
            console.error('[deximpersonate]', e);
            if (!interaction.replied) {
                await interaction.reply({ content: `Error: ${e.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    },
};
