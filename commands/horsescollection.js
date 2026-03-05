const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View a collection of horses')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose collection you want to view')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;
        
        const allUsers = await mongoose.model('UserHorses').find();
        const inventory = allUsers.find(u => u.userId === targetUser.id);
        const allPossibleItems = Object.keys(HORSE_VALUES);

        if (!inventory || !inventory.horses || Array.from(inventory.horses.values()).every(v => v === 0)) {
            return interaction.reply(isSelf 
                ? "Your stables are empty. Keep talking to find some horses!" 
                : `${targetUser.username}'s stables are empty.`);
        }

        const leaderboard = allUsers.map(u => {
            let worth = 0;
            for (const [name, count] of u.horses) {
                worth += ((HORSE_VALUES[name]?.value || 0) * count);
            }
            return { userId: u.userId, worth };
        }).sort((a, b) => b.worth - a.worth);

        const rank = leaderboard.findIndex(u => u.userId === targetUser.id) + 1;
        const userWorth = leaderboard.find(u => u.userId === targetUser.id)?.worth || 0;

        let horseListText = "";
        let ownedUniqueCount = 0;
        const ownedItems = new Set();

        // --- LIST OWNED HORSES ---
        for (const [name, count] of inventory.horses) {
            if (count > 0 && HORSE_VALUES[name]) {
                const val = HORSE_VALUES[name].value;
                let prefix = name === "Dung Beetle" ? "🪲" : (name.includes("Providence") ? "✨" : "🐎");
                
                horseListText += `* ${prefix} **${name}**: \`x${count}\` — ($${val.toLocaleString()})\n`;
                ownedItems.add(name);
                ownedUniqueCount++;
            }
        }

        const completionPercentage = Math.round((ownedUniqueCount / allPossibleItems.length) * 100);
        const missing = allPossibleItems.filter(item => !ownedItems.has(item));
        
        // --- LIST MISSING HORSES ---
        let missingHeader = isSelf ? "### Missing Thingamabobs" : `### Missing from ${targetUser.username}'s Stable`;
        let missingText = "";

        if (missing.length > 0) {
            missingText = `\n${missingHeader}\n` + missing.map(m => {
                const mVal = HORSE_VALUES[m]?.value || 0;
                return `* *${m}* ($${mVal.toLocaleString()})`;
            }).join('\n');
        } else {
            missingText = isSelf 
                ? "\n### ✨ You have mastered the gustovian stables! ✨" 
                : `\n### ✨ ${targetUser.username} has mastered the stables! ✨`;
        }

        const title = isSelf ? "## 🐎 Your Collection 🐎" : `## 🐎 ${targetUser.username}'s Collection 🐎`;

        return interaction.reply(`${title}\n**Rank:** #${rank} | **Net Worth:** $${userWorth.toLocaleString()}\n**Completion:** ${completionPercentage}%\n` + horseListText + missingText);
    }
};
