const {SlashCommandBuilder} = require('discord.js');
const mongoose = require('mongoose');
const HORSE_VALUES = require('../horses.json');
const {conditionHorse} = require('../lib/helpers/horseFuncs.js');

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
				.setRequired(false))
		.addBooleanOption(option =>
			option.setName('ephemeral')
				.setDescription('Whether to show the collection ephemeral or publicly in the channel (defaults to ephemeral)')),
	async execute(interaction) {
		const ephemeral = interaction.options.getBoolean('ephemeral') ?? true;
		await interaction.deferReply({ephemeral});
		const targetUser = interaction.options.getUser('user') || interaction.user;
		const isSelf = targetUser.id === interaction.user.id;

		const allUsers = await mongoose.model('UserHorses').find();
		const inventory = allUsers.find(u => u.userId === targetUser.id);
		const allPossibleSlugs = Object.keys(HORSE_VALUES).filter(k => HORSE_VALUES[k].comp !== false);

		if (!inventory || !inventory.horses || [...inventory.horses.values()].every(v => v === 0)) {
			return interaction.editReply({
				content: isSelf
					? 'Your stables are empty. Keep talking to find some horses!'
					: `${targetUser.username}'s stables are empty.`, ephemeral,
			});
		}

		const leaderboard = allUsers.map(u => {
			let worth = 0;
			for (const [slug, count] of u.horses) {
				worth += ((HORSE_VALUES[slug]?.value || 0) * count);
			}

			return {userId: u.userId, worth};
		}).toSorted((a, b) => b.worth - a.worth);

		const rank = leaderboard.findIndex(u => u.userId === targetUser.id) + 1;
		const userWorth = leaderboard.find(u => u.userId === targetUser.id)?.worth || 0;

		let horseListText = '';
		let compHorseText = '';
		let nonCompHorseText = '';
		let ownedUniqueCount = 0;
		const ownedSlugs = new Set();

		for (const [slug, count] of inventory.horses) {
			if (count <= 0 || !HORSE_VALUES[slug]) {
				continue;
			}

			const {value} = HORSE_VALUES[slug];
			const display = horseName(slug);
			const isComp = HORSE_VALUES[slug].comp !== false;
			const prefix = slug === 'dung_beetle' ? '🪲' : (slug.includes('providence') ? '✨' : '🐎');

			if (isComp) {
				compHorseText += `* ${prefix} **${display}**: \`x${count}\` — ($${value.toLocaleString()})\n`;
				ownedSlugs.add(slug);
				ownedUniqueCount++;
			} else {
				// If comp:false, show if owned, counts to wealth but not completion
				nonCompHorseText += `* 👻 **${display}**: \`x${count}\` — ($${value.toLocaleString()})\n`;
			}
		}

		horseListText = compHorseText + (nonCompHorseText ? `\n### 👻 Specials and Secrets\n${nonCompHorseText}` : '');

		const completionPercentage = Math.round((ownedUniqueCount / allPossibleSlugs.length) * 100);
		const missing = allPossibleSlugs.filter(slug => !ownedSlugs.has(slug));

		const missingHeader = isSelf ? '### Missing Thingamabobs' : `### Missing from ${targetUser.username}'s Stable`;
		let missingText = '';
		if (missing.length > 0) {
			missingText = `\n${missingHeader}\n` + missing.map(slug => {
				const mValue = HORSE_VALUES[slug]?.value || 0;
				return `* *${horseName(slug)}* ($${mValue.toLocaleString()})`;
			}).join('\n');
		} else {
			missingText = isSelf
				? '\n### ✨ You have mastered the gustovian stables! ✨'
				: `\n### ✨ ${targetUser.username} has mastered the stables! ✨`;
		}

		const title = isSelf ? '## 🐎 Your Collection 🐎' : `## 🐎 ${targetUser.username}'s Collection 🐎`;
		await interaction.editReply(`${title}\n**Rank:** #${rank} | **Net Worth:** $${userWorth.toLocaleString()}\n**Completion:** ${completionPercentage}%\n` + horseListText + missingText);

		// Run after reply so it never blocks the interaction response
		conditionHorse(inventory, interaction.channel).catch(error => console.error('conditionHorse error:', error));
	},
};
