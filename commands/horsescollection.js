const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View your collection of horses and rare creatures'),
    async execute(interaction) {
        const allUsers = await mongoose.model('UserHorses').find();
        const inventory = allUsers.find(u => u.userId === interaction.user.id);
        const allPossibleItems = Object.keys(HORSE_VALUES);

        if (!inventory || !inventory.horses || inventory.horses.size === 0) {
            return interaction.reply("Your stables are empty. Keep talking to find some horses!");
        }

        const leaderboard = allUsers.map(u => {
            let worth = 0;
            for (const [name, count] of u.horses) {
                worth += ((HORSE_VALUES[name] || 0) * count);
            }
            return { userId: u.userId, worth };
        }).sort((a, b) => b.worth - a.worth);

        const rank = leaderboard.findIndex(u => u.userId === interaction.user.id) + 1;
        const userWorth = leaderboard.find(u => u.userId === interaction.user.id).worth;

        let horseListText = "";
        let ownedUniqueCount = 0;
        const ownedItems = new Set();

        for (const [name, count] of inventory.horses) {
            if (count > 0 && HORSE_VALUES[name]) {
                let prefix = name === "Dung Beetle" ? "🪲" : (name.includes("Providence") ? "✨" : "🐎");
                horseListText += `* ${prefix} **${name}**: \`x${count}\` \n`;
                ownedItems.add(name);
                ownedUniqueCount++;
            }
        }

        const completionPercentage = Math.round((ownedUniqueCount / allPossibleItems.length) * 100);
        const missing = allPossibleItems.filter(item => !ownedItems.has(item));
        let missingText = missing.length > 0 
            ? "\n### Missing Thingamabobs\n" + missing.map(m => `* *${m}*`).join('\n')
            : "\n### ✨ Collection Complete! ✨";

        return interaction.reply(`## 🐎 Your Collection 🐎\n**Rank:** #${rank} | **Net Worth:** $${userWorth}\n**Completion:** ${completionPercentage}%\n` + horseListText + missingText);
    }
};
