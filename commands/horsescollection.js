const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const { conditionHorse } = require('../lib/helpers/horseFuncs');

function horseName(slug) {
    return HORSE_VALUES[slug]?.name ?? slug;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View a collection of horses')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose collection you want to view')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;

        const allUsers = await mongoose.model('UserHorses').find();
        const inventory = allUsers.find(u => u.userId === targetUser.id);
        const allPossibleSlugs = Object.keys(HORSE_VALUES).filter(k => HORSE_VALUES[k].comp !== false);

        if (!inventory || !inventory.horses || Array.from(inventory.horses.values()).every(v => v === 0)) {
            return interaction.editReply(isSelf
                ? "Your stables are empty. Keep talking to find some horses!"
                : `${targetUser.username}'s stables are empty.`);
        }

        const leaderboard = allUsers.map(u => {
            let worth = 0;
            for (const [slug, count] of u.horses) {
                worth += ((HORSE_VALUES[slug]?.value || 0) * count);
            }
            return { userId: u.userId, worth };
        }).sort((a, b) => b.worth - a.worth);

        const rank = leaderboard.findIndex(u => u.userId === targetUser.id) + 1;
        const userWorth = leaderboard.find(u => u.userId === targetUser.id)?.worth || 0;

        let horseListText = "";
        let ownedUniqueCount = 0;
        const ownedSlugs = new Set();

        for (const [slug, count] of inventory.horses) {
            if (count > 0 && HORSE_VALUES[slug] && HORSE_VALUES[slug].comp !== false) {
                const val = HORSE_VALUES[slug].value;
                const display = horseName(slug);
                let prefix = slug === "dung_beetle" ? "🪲" : (slug.includes("providence") ? "✨" : "🐎");
                horseListText += `* ${prefix} **${display}**: \`x${count}\` — ($${val.toLocaleString()})\n`;
                ownedSlugs.add(slug);
                ownedUniqueCount++;
            }
        }

        const completionPercentage = Math.round((ownedUniqueCount / allPossibleSlugs.length) * 100);
        const missing = allPossibleSlugs.filter(slug => !ownedSlugs.has(slug));

        let missingHeader = isSelf ? "### Missing Thingamabobs" : `### Missing from ${targetUser.username}'s Stable`;
        let missingText = "";
        if (missing.length > 0) {
            missingText = `\n${missingHeader}\n` + missing.map(slug => {
                const mVal = HORSE_VALUES[slug]?.value || 0;
                return `* *${horseName(slug)}* ($${mVal.toLocaleString()})`;
            }).join('\n');
        } else {
            missingText = isSelf
                ? "\n### ✨ You have mastered the gustovian stables! ✨"
                : `\n### ✨ ${targetUser.username} has mastered the stables! ✨`;
        }

        const title = isSelf ? "## 🐎 Your Collection 🐎" : `## 🐎 ${targetUser.username}'s Collection 🐎`;
        await interaction.editReply(`${title}\n**Rank:** #${rank} | **Net Worth:** $${userWorth.toLocaleString()}\n**Completion:** ${completionPercentage}%\n` + horseListText + missingText);

        // Run after reply so it never blocks the interaction response
        conditionHorse(inventory, interaction.channel).catch(e => console.error('conditionHorse error:', e));
    }
};