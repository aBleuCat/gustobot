import { ModChannel } from '../models.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
export async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id }).lean();
    if (!config)
        return;
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel && 'send' in channel) {
        await channel.send(`[LOG]: ${message}`);
    }
}
export function init() {
    const modal = new ModalBuilder().setCustomId('orbital_nuke_modal').setTitle('stab shot');
    const codeInput = new TextInputBuilder()
        .setCustomId('orbital_nuke_code')
        .setLabel('nuclear launch code')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('inline code or leave empty to use link')
        .setMaxLength(4000);
    const linkInput = new TextInputBuilder()
        .setCustomId('orbital_nuke_link')
        .setLabel('link')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://...');
    modal.addComponents(new ActionRowBuilder().addComponents(codeInput), new ActionRowBuilder().addComponents(linkInput));
    return modal;
}
//# sourceMappingURL=modLog.js.map