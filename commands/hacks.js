const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { config, descriptions } = require('../lib/config');

const OWNER_ID = '934290747623096381';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hacks')
        .setDescription('Admin tools')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('vars')
            .setDescription('View or modify runtime config variables')
            .addStringOption(o => o
                .setName('variable')
                .setDescription('The variable to interact with')
                .setRequired(false)
                .setAutocomplete(true)
            )
            .addStringOption(o => o
                .setName('action')
                .setDescription('What to do with the variable')
                .setRequired(false)
                .addChoices(
                    { name: 'get — show current value', value: 'get' },
                    { name: 'set — set to a new value', value: 'set' },
                    { name: 'add — add to current value', value: 'add' },
                )
            )
            .addNumberOption(o => o
                .setName('value')
                .setDescription('Value to set or add')
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('killbot')
            .setDescription('Shut down the bot')
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const choices = Object.keys(config)
            .filter(k => k.toLowerCase().includes(focused))
            .map(k => ({ name: `${k} (currently: ${config[k]})`, value: k }))
            .slice(0, 25);
        await interaction.respond(choices);
    },

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'you cannot do that bro', flags: [MessageFlags.Ephemeral] });
        }

        const sub = interaction.options.getSubcommand();

        // ── killbot ──────────────────────────────────────────────────
        if (sub === 'killbot') {
            await interaction.reply({ content: 'Shutting down...', flags: [MessageFlags.Ephemeral] });
            process.exit(0);
        }

        // ── vars ─────────────────────────────────────────────────────
        if (sub === 'vars') {
            const varName = interaction.options.getString('variable');
            const action = interaction.options.getString('action');
            const value = interaction.options.getNumber('value');

            // No variable specified — list all
            if (!varName) {
                const items = Object.entries(config).map(([k, v]) =>
                    `**${k}**: \`${v}\`\n${descriptions[k] || ''}`
                );
                
                // Split into chunks to avoid 2000 char limit
                const chunks = [];
                let currentChunk = '';
                for (const item of items) {
                    if ((currentChunk + '\n' + item).length > 1900) {
                        chunks.push(currentChunk);
                        currentChunk = item;
                    } else {
                        currentChunk += (currentChunk ? '\n' : '') + item;
                    }
                }
                if (currentChunk) chunks.push(currentChunk);

                // Send each chunk as a separate embed
                for (let i = 0; i < chunks.length; i++) {
                    const embed = new EmbedBuilder()
                        .setColor(0x0099ff)
                        .setTitle(`Runtime Config (${i + 1}/${chunks.length})`)
                        .setDescription(chunks[i]);
                    
                    if (i === 0) {
                        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
                    } else {
                        await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
                    }
                }
                return;
            }

            if (!(varName in config)) {
                return interaction.reply({ content: `Unknown variable: \`${varName}\``, flags: [MessageFlags.Ephemeral] });
            }

            // No action — default to get
            if (!action || action === 'get') {
                return interaction.reply({
                    content: `**${varName}**: \`${config[varName]}\`\n${descriptions[varName] || ''}`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (value === null || value === undefined) {
                return interaction.reply({ content: `You need to provide a value to ${action}.`, flags: [MessageFlags.Ephemeral] });
            }

            const oldVal = config[varName];

            if (action === 'set') {
                config[varName] = value;
                return interaction.reply({ content: `✅ **${varName}**: \`${oldVal}\` → \`${value}\``, flags: [MessageFlags.Ephemeral] });
            }

            if (action === 'add') {
                if (typeof config[varName] !== 'number') {
                    return interaction.reply({ content: `Can't add to a non-number variable.`, flags: [MessageFlags.Ephemeral] });
                }
                config[varName] += value;
                return interaction.reply({ content: `✅ **${varName}**: \`${oldVal}\` + \`${value}\` = \`${config[varName]}\``, flags: [MessageFlags.Ephemeral] });
            }
        }
    }
};
