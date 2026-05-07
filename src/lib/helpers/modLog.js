const { ModChannel } = require('../models');

async function logToModChannel(guild, message) {
    const config = await ModChannel.findOne({ guildId: guild.id }).lean();
    if (!config) return;
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (channel) await channel.send(`[LOG]: ${message}`);
}

function init() {
    const {
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
        ActionRowBuilder
    } = require('discord.js');

    const modal = new ModalBuilder()
        .setCustomId('orbital_nuke_modal')
        .setTitle('stab shot');

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

    modal.addComponents(
        new ActionRowBuilder().addComponents(codeInput),
        new ActionRowBuilder().addComponents(linkInput)
    );

    return modal;
}

module.exports = { logToModChannel, init };
