require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Events } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// --- Background Task: Check for Expired Timeouts ---
setInterval(async () => {
    const activePath = './data/active_timeouts.json';
    if (!fs.existsSync(activePath)) return;

    let active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
    const now = Date.now();
    let needsUpdate = false;

    for (let i = active.length - 1; i >= 0; i--) {
        const timeout = active[i];
        if (now >= timeout.revertAt) {
            const guild = client.guilds.cache.first();
            if (guild) {
                try {
                    const member = await guild.members.fetch(timeout.targetUser).catch(() => null);
                    if (member) {
                        await member.roles.remove(timeout.addRole).catch(() => {});
                        await member.roles.add(timeout.restoreRole).catch(() => {});
                    }
                } catch (err) { console.error(err); }
            }
            active.splice(i, 1);
            needsUpdate = true;
        }
    }
    if (needsUpdate) fs.writeFileSync(activePath, JSON.stringify(active, null, 2));
}, 10000);

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Error executing command.', ephemeral: true });
        }
    }

    // --- Countryball Button & Modal Logic ---
    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
        const [, correctAnswer, boldText] = interaction.customId.split('::');
        const modal = new ModalBuilder().setCustomId(`modal::${correctAnswer}::${boldText}`).setTitle('Catch the Countryball');
        const answerInput = new TextInputBuilder().setCustomId('user_answer').setLabel("Name of this countryball").setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal::')) {
        const [, correctAnswer, boldText] = interaction.customId.split('::');
        const userAnswer = interaction.fields.getTextInputValue('user_answer');
        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            await interaction.reply({ content: `<@${interaction.user.id}> You caught **${correctAnswer}**! (#3653D5, -8%/-7%)\n\nThis is a **${boldText}** that has been added to your completion!` });
        } else {
            await interaction.reply({ content: `<@${interaction.user.id}> Wrong name!`, ephemeral: true });
        }
    }
});

client.on('messageCreate', async msg => {
    if (msg.author.bot) return;
    const rulesPath = './data/rules.json';
    if (!fs.existsSync(rulesPath)) return;
    
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

    for (const rule of rules) {
        if (msg.author.id !== rule.watchUser) continue;
        if (msg.channel.id !== rule.channel) continue;

        const member = msg.mentions.members.get(rule.targetUser);
        if (!member) continue;

        try {
            // 1. Give the temporary role
            await member.roles.add(rule.addRole);
            
            // 2. REMOVE the restore role immediately so they don't have both
            await member.roles.remove(rule.restoreRole).catch(() => {
                console.log("Member didn't have the restore role to remove.");
            });
            
            // 3. Log it to active_timeouts.json so the background task knows to swap them back later
            const activePath = './data/active_timeouts.json';
            let active = [];
            if (fs.existsSync(activePath)) {
                const activeData = fs.readFileSync(activePath, 'utf8');
                active = activeData ? JSON.parse(activeData) : [];
            }
            
            active.push({
                targetUser: rule.targetUser,
                addRole: rule.addRole,
                restoreRole: rule.restoreRole,
                revertAt: Date.now() + rule.durationMs
            });
            
            fs.writeFileSync(activePath, JSON.stringify(active, null, 2));
        } catch (e) { 
            console.error("Failed to trigger role swap:", e); 
        }
    }
});

client.login(process.env.TOKEN);
