const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const UserHorses = mongoose.model('UserHorses');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsescollection')
        .setDescription('View your collection of horses'),
    async execute(interaction) {
        const inventory = await UserHorses.findOne({ userId: interaction.user.id });

        if (!inventory || !inventory.horses || inventory.horses.size === 0) {
            return interaction.reply("Your stables are empty. Keep talking to find some horses!");
        }
      
        const totalUniqueHorses = 5;
        let ownedUniqueCount = 0;
        let horseListText = "";
        for (const [name, count] of inventory.horses) {
            if (count > 0) {
                horseListText += `* **${name}**: \`x${count}\` \n`;
                ownedUniqueCount++;
            }
        }

        if (ownedUniqueCount === 0) {
            return interaction.reply("Your stables are empty, unfortunately.");
        }

        const completionPercentage = (ownedUniqueCount / totalUniqueHorses) * 100;

        let responseHeader = `## 🐎 Your Horse Collection 🐎\n **Horse Completion: ${completionPercentage}%**\n`;
        
        return interaction.reply(responseHeader + horseListText);
    }
};
