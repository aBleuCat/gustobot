const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

// Passive lookup
const UserHorses = mongoose.model('UserHorses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View your collection of horses and rare creatures'),
    async execute(interaction) {
        const allUsers = await UserHorses.find();
        const inventory = allUsers.find(u => u.userId === interaction.user.id);

        const allPossibleItems = [
            "Horse of Truth and Affirmation",
            "Horse of Patience and Wisdom",
            "Horse of Comfort and Relaxation",
            "Horse of Lies and Deceit",
            "Horse of Despair and Agony",
            "Dung Beetle"
        ];

        const itemValues = {
            "Dung Beetle": 125,
            "default": 75
        };

        if (!inventory || !inventory.horses || inventory.horses.size === 0) {
            return interaction.reply("Your stables are empty. Keep talking to find some horses!");
        }

        // 1. Calculate user stats and global leaderboard ranking
        const leaderboard = allUsers.map(u => {
            let worth = 0;
            for (const [name, count] of u.horses) {
                const val = itemValues[name] || itemValues.default;
                worth += (val * count);
            }
            return { userId: u.userId, worth };
        }).sort((a, b) => b.worth - a.worth);

        const rank = leaderboard.findIndex(u => u.userId === interaction.user.id) + 1;
        const userWorth = leaderboard.find(u => u.userId === interaction.user.id).worth;

        // 2. Process current inventory display
        let ownedUniqueCount = 0;
        let horseListText = "";
        const ownedItems = new Set();

        for (const [name, count] of inventory.horses) {
            if (count > 0 && allPossibleItems.includes(name)) {
                const prefix = name === "Dung Beetle" ? "🪲" : "🐎";
                horseListText += `* ${prefix} **${name}**: \`x${count}\` \n`;
                ownedItems.add(name);
                ownedUniqueCount++;
            }
        }

        const completionPercentage = Math.round((ownedUniqueCount / allPossibleItems.length) * 100);

        // 3. Handle Missing Items
        const missing = allPossibleItems.filter(item => !ownedItems.has(item));
        let missingText = "";
        if (missing.length > 0) {
            missingText = "\n### Missing Thingamabobs\n" + missing.map(m => `* *${m}*`).join('\n');
        } else {
            missingText = "\n### ✨ Collection Complete! ✨\nYou have mastered the gustovian stables.";
        }

        let responseHeader = `## 🐎 Your Horse Collection 🐎\n-# and other thingamabobs\n` +
                             `**Rank:** #${rank} | **Net Worth:** $${userWorth}\n` +
                             `**Overall Completion:** ${completionPercentage}%\n`;
        
        return interaction.reply(responseHeader + horseListText + missingText);
    }
};
