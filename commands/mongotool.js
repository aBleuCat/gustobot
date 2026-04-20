const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

// Dynamically load all models from lib/models.js
let AVAILABLE_MODELS = {};
try {
    const models = require('../lib/models.js');
    for (const [name, model] of Object.entries(models)) {
        AVAILABLE_MODELS[name.toLowerCase()] = name;
    }
} catch (e) {
    console.error('MongoTool: Failed to load models:', e.message);
}

const OPERATIONS = {
    'find': 'Find (search) documents',
    'count': 'Count matching documents',
    'delete': 'Delete matching documents',
    'update': 'Update matching documents (use --set for values)',
    'insert': 'Insert a new document (use --set for values)'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mongotool')
        .setDescription('Manage MongoDB documents across any model (Owner Only)')
        .addStringOption(option =>
            option.setName('model')
                .setDescription('The model to operate on (auto-loaded from models.js)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('The action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Find (search)', value: 'find' },
                    { name: 'Count', value: 'count' },
                    { name: 'Delete', value: 'delete' },
                    { name: 'Update', value: 'update' },
                    { name: 'Insert', value: 'insert' }
                ))
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('JSON filter query (e.g., {"authorId": "123"})')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('set')
                .setDescription('JSON values to set/update/insert (e.g., {"field": "value"})')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Max documents to return (for find)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('projection')
                .setDescription('Fields to include/exclude (e.g., {"field": 1} or {"field": 0})')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('verbose')
                .setDescription('Show full document output')
                .setRequired(false)),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        
        if (focused.name === 'model') {
            const search = focused.value.toLowerCase();
            const choices = Object.keys(AVAILABLE_MODELS)
                .filter(name => name.includes(search))
                .map(name => ({ name, value: name }));
            
            // Always include exact match if exists
            if (search && !choices.find(c => c.value === search)) {
                choices.unshift({ name: search, value: search });
            }
            
            await interaction.respond(choices.slice(0, 25));
        }
    },

    async execute(interaction) {
        // Owner ID Check
        if (interaction.user.id !== '934290747623096381') {
            return interaction.reply({
                content: '❌ You do not have permission to use this command. This is an owner-only action.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const modelName = interaction.options.getString('model').toLowerCase();
        const action = interaction.options.getString('action');
        const filterStr = interaction.options.getString('filter');
        const setStr = interaction.options.getString('set');
        const limit = interaction.options.getInteger('limit');
        const projectionStr = interaction.options.getString('projection');
        const verbose = interaction.options.getBoolean('verbose') || false;

        // Validate model exists
        if (!AVAILABLE_MODELS[modelName]) {
            const available = Object.keys(AVAILABLE_MODELS).map(k => `\`${k}\``).join(', ');
            return interaction.reply({
                content: `❌ Unknown model: **${modelName}**\nAvailable models: ${available}`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        const Model = mongoose.model(AVAILABLE_MODELS[modelName]);

        let filter = {};
        let setData = {};
        let projection = {};

        // Parse filter
        if (filterStr) {
            try {
                filter = JSON.parse(filterStr);
            } catch (e) {
                return interaction.reply({
                    content: `❌ Invalid filter JSON: ${e.message}`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        // Parse set data
        if (setStr) {
            try {
                setData = JSON.parse(setStr);
            } catch (e) {
                return interaction.reply({
                    content: `❌ Invalid set JSON: ${e.message}`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        // Parse projection
        if (projectionStr) {
            try {
                projection = JSON.parse(projectionStr);
            } catch (e) {
                return interaction.reply({
                    content: `❌ Invalid projection JSON: ${e.message}`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        try {
            let result;
            const startTime = Date.now();

            switch (action) {
                case 'find':
                    const query = Model.find(filter);
                    if (Object.keys(projection).length > 0) {
                        query.select(projection);
                    }
                    if (limit) {
                        query.limit(limit);
                    }
                    result = await query.lean();

                    if (result.length === 0) {
                        return interaction.reply({
                            content: `🔍 No documents found for model **${modelName}** with filter: \`${JSON.stringify(filter)}\``,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const displayLimit = verbose ? result.length : Math.min(result.length, 5);
                    const preview = result.slice(0, displayLimit).map(doc => 
                        verbose ? JSON.stringify(doc, null, 2) : JSON.stringify(doc)
                    ).join('\n');

                    const response = `📋 Found **${result.length}** documents (showing ${displayLimit}${result.length > displayLimit ? ` of ${result.length}` : ''}):\n\`\`\`json\n${preview}\n\`\`\`${result.length > displayLimit ? `\n_Use \`limit\` option to see more (max 100)_` : ''}`;
                    
                    // Handle long responses
                    if (response.length > 4000) {
                        return interaction.reply({
                            content: `📋 Found **${result.length}** documents. First 5:\n\`\`\`json\n${preview}\n\`\`\``,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    return interaction.reply({ content: response });

                case 'count':
                    result = await Model.countDocuments(filter);
                    return interaction.reply({
                        content: `📊 **${result}** documents match filter: \`${JSON.stringify(filter)}\``,
                        flags: [MessageFlags.Ephemeral]
                    });

                case 'delete':
                    result = await Model.deleteMany(filter);
                    return interaction.reply({
                        content: `🗑️ Deleted **${result.deletedCount}** documents from **${modelName}**`,
                        flags: [MessageFlags.Ephemeral]
                    });

                case 'update':
                    if (Object.keys(setData).length === 0) {
                        return interaction.reply({
                            content: '❌ Update operation requires --set with fields to update',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    result = await Model.updateMany(filter, { $set: setData });
                    return interaction.reply({
                        content: `✏️ Updated **${result.modifiedCount}** documents in **${modelName}**`,
                        flags: [MessageFlags.Ephemeral]
                    });

                case 'insert':
                    if (Object.keys(setData).length === 0) {
                        return interaction.reply({
                            content: '❌ Insert operation requires --set with document fields',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    const newDoc = new Model(setData);
                    result = await newDoc.save();
                    return interaction.reply({
                        content: `✅ Inserted new document into **${modelName}**:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
                        flags: [MessageFlags.Ephemeral]
                    });

                default:
                    return interaction.reply({
                        content: '❌ Unknown operation',
                        flags: [MessageFlags.Ephemeral]
                    });
            }
        } catch (error) {
            console.error('MongoTool Error:', error);
            return interaction.reply({
                content: `❌ Error: ${error.message}`,
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};