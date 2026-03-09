const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} = require('discord.js');
const { logToModChannel } = require('../helpers/modLog');

// Temporary in-memory store for catch data, keyed by user ID
// (avoids hitting Discord's 100 char customId limit)
const catchDataStore = new Map();

function registerInteractionHandler(client) {
    client.on(Events.InteractionCreate, async interaction => {
        // Slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            console.log(`[COMMAND]: ${interaction.user.tag} used /${interaction.commandName}`);

            try {
                await command.execute(interaction);
            } catch (e) {
                console.error(e);
                if (!interaction.replied) {
                    await interaction.reply({ content: `Error: ${e.message}`, flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }
            }
            return;
        }

        // Button click — store catch data and show modal
        if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
            const spawnId = interaction.customId.slice('catch::'.length);
            const data = catchDataStore.get(spawnId);
            if (!data) return interaction.reply({ content: 'This catch has expired.', flags: [MessageFlags.Ephemeral] }).catch(() => {});

            // Move data to user-keyed entry for modal retrieval
            catchDataStore.set(interaction.user.id, data);

            const modal = new ModalBuilder()
                .setCustomId('modal')
                .setTitle('Catch the Countryball');
            const answerInput = new TextInputBuilder()
                .setCustomId('user_answer')
                .setLabel("Name of this countryball")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
            await interaction.showModal(modal);
        }

        // Modal submit — check answer
        if (interaction.isModalSubmit() && interaction.customId === 'modal') {
            const data = catchDataStore.get(interaction.user.id);
            if (!data) {
                return interaction.reply({ content: 'Something went wrong, try again.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
            }
            catchDataStore.delete(interaction.user.id);

            const { ans: correctAnswer, bold: boldText, type, targetId, stats: customStats } = data;
            const userAnswer = interaction.fields.getTextInputValue('user_answer');

            if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
                try {
                    const targetUser = await client.users.fetch(targetId);
                    const catchWebhook = await interaction.channel.createWebhook({
                        name: targetUser.displayName,
                        avatar: targetUser.displayAvatarURL()
                    });
                    const statString = (customStats === "DEFAULT" || !customStats)
                        ? "(#6463FAC, +5%/+13%)"
                        : customStats;

                    const successMsg = type === 'fulltext'
                        ? `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \n${boldText}`
                        : `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \nThis is a **${boldText}** that has been added to your completion!`;

                    await catchWebhook.send({ content: successMsg });
                    await catchWebhook.delete();
                    await interaction.deferUpdate().catch(() => {});
                    await logToModChannel(interaction.guild, `${interaction.user.tag} caught ${correctAnswer}`);
                } catch (err) {
                    console.error(err);
                }
            } else {
                try {
                    const targetUser = await client.users.fetch(targetId);
                    const failWebhook = await interaction.channel.createWebhook({
                        name: targetUser.displayName,
                        avatar: targetUser.displayAvatarURL()
                    });
                    await failWebhook.send({ content: `<@${interaction.user.id}> Wrong name!` });
                    await failWebhook.delete();
                    await interaction.deferUpdate().catch(() => {});
                } catch (err) {
                    if (!interaction.replied) {
                        await interaction.reply({ content: `wrong`, flags: [MessageFlags.Ephemeral] }).catch(() => {});
                    }
                }
            }
        }
    });
}

module.exports = { registerInteractionHandler, catchDataStore };
