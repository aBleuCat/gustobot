import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChatInputCommandInteraction, 
    ChannelType,
    GuildTextBasedChannel // Use this more specific type
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('sayasme')
        .setDescription('Make the bot say something as you')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption((o: any) => o.setName('text').setDescription('What to say').setRequired(true))
        .addChannelOption((o: any) => o.setName('channel').setDescription('Channel to say it in (optional)')),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const text = interaction.options.getString('text')!;
        const channelOption = interaction.options.getChannel('channel');
        
        const targetChannel = channelOption || interaction.channel;

        // 1. Ensure the channel exists
        // 2. Ensure it's a type that supports .send() (Text or Announcement/News)
        if (
            !targetChannel || 
            !(targetChannel.type === ChannelType.GuildText || targetChannel.type === ChannelType.GuildAnnouncement)
        ) {
            await interaction.reply({ 
                content: 'I can only send messages in server text channels.', 
                ephemeral: true 
            });
            return;
        }

        // Cast to GuildTextBasedChannel, which excludes Partial/Group DMs
        await (targetChannel as GuildTextBasedChannel).send({
            content: `*${interaction.user.username} asks me to say:* ${text}`
        });

        await interaction.reply({ content: 'Done!', ephemeral: true });
    }
};