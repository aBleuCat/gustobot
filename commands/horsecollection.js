const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

// Passive lookup
const UserHorses = mongoose.model('UserHorses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View your collection of horses and rare creatures'),
    async execute(interaction) {
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });

        // Define all "Thingamabobs"
        const allPossibleItems = [
            "Horse of Truth and Affirmation",
            "Horse of Patience and Wisdom",
            "Horse of Comfort and Relaxation",
            "Horse of Lies and Deceit",
            "Horse of Despair and Agony",
            "Dung Beetle"
        ];

        if (!inventory || !inventory.horses || inventory.horses.size === 0) {
            return interaction.reply("Your stables are empty. Keep talking to find some horses!");
        }

        let ownedUniqueCount = 0;
        let horseListText = "";
        const ownedItems = new Set();

        // Process inventory
        for (const [name, count] of inventory.horses) {
            if (count > 0 && allPossibleItems.includes(name)) {
                const prefix = name === "Dung Beetle" ? "🪲" : "🐎";
                horseListText += `* ${prefix} **${name}**: \`x${count}\` \n`;
                
                ownedItems.add(name);
                ownedUniqueCount++;
            }
        }

        if (ownedUniqueCount === 0) {
            return interaction.reply("Your stables are empty, unfortunately.");
        }

        // Calculate percentage (e.g., 1/6, 2/6, etc.)
        const completionPercentage = Math.round((ownedUniqueCount / allPossibleItems.length) * 100);

        // Calculate missing items
        const missing = allPossibleItems.filter(item => !ownedItems.has(item));
        let missingText = "";
        if (missing.length > 0) {
            missingText = "\n### Missing Thingamabobs\n" + missing.map(m => `* *${m}*`).join('\n');
        } else {
            missingText = "\n### ✨ Collection Complete! ✨\nYou have mastered the gustovian stables.";
        }

        let responseHeader = `## 🐎 Your Horse Collection 🐎\n-# and other thingamabobs\n**Overall Completion: ${completionPercentage}%**\n`;
        
        return interaction.reply(responseHeader + horseListText + missingText);
    }
};
