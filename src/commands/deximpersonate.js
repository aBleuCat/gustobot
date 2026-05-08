const {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionFlagsBits,
	MessageFlags,
} = require('discord.js');
const {catchDataStore} = require('../lib/handlers/interactionHandler');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deximpersonate')
		.setDescription('Impersonate a user to spawn a countryball')
		.addUserOption((o) =>
			o
				.setName('target')
				.setDescription('User to impersonate')
				.setRequired(true),
		)
		.addAttachmentOption((o) =>
			o
				.setName('image')
				.setDescription('The image to display')
				.setRequired(true),
		)
		.addStringOption((o) =>
			o
				.setName('formanswer')
				.setDescription('The correct answer')
				.setRequired(true),
		)
		.addStringOption((o) =>
			o
				.setName('boldtext')
				.setDescription('The rarity/type text')
				.setRequired(true),
		)
		.addStringOption((o) =>
			o
				.setName('texttype')
				.setDescription('Format of the success message')
				.setRequired(true)
				.addChoices(
					{name: 'Bold Text (Standard)', value: 'boldtext'},
					{name: 'Full Text (Custom)', value: 'fulltext'},
				),
		)
		.addStringOption((o) =>
			o
				.setName('stats')
				.setDescription('Custom stats (e.g. #ABCDEF, +1%/+2%). Optional.')
				.setRequired(false),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

	async execute(interaction) {
		try {
			const target = interaction.options.getUser('target');
			const image = interaction.options.getAttachment('image');
			const ans = interaction.options.getString('formanswer');
			const bold = interaction.options.getString('boldtext');
			const type = interaction.options.getString('texttype');
			const stats = interaction.options.getString('stats') || 'DEFAULT';

			// Use a unique key per spawn so multiple spawns don't collide
			const spawnId = `${target.id}-${Date.now()}`;
			catchDataStore.set(spawnId, {
				ans,
				bold,
				type,
				targetId: target.id,
				stats,
			});

			const webhook = await interaction.channel.createWebhook({
				name: target.username,
				avatar: target.displayAvatarURL(),
			});

			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`catch::${spawnId}`)
					.setLabel('Catch me')
					.setStyle(ButtonStyle.Primary),
			);

			await webhook.send({
				content: `A wild countryball appeared!`,
				files: [image.url],
				components: [row],
			});
			await webhook.delete();

			await interaction.client.logToModChannel(
				interaction.guild,
				`**Spawn**: ${interaction.user.tag} spawned **${ans}** impersonating ${target.tag}.`,
			);
			await interaction.reply({
				content: 'Spawned successfully!',
				flags: [MessageFlags.Ephemeral],
			});
		} catch (error) {
			console.error('[deximpersonate]', error);
			if (!interaction.replied) {
				await interaction
					.reply({
						content: `Error: ${error.message}`,
						flags: [MessageFlags.Ephemeral],
					})
					.catch(() => {
});
			}
		}
	},
};
