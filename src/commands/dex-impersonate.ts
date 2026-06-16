import {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionFlagsBits,
	MessageFlags,
	type ChatInputCommandInteraction,
	InteractionContextType,
	ApplicationIntegrationType,
	type MessageActionRowComponentBuilder,
} from 'discord.js';
import {catchDataStore} from '../lib/handlers/interaction-handler.js';
import {castAsWebhookable} from '../type-utils.js';
import {logToModChannel} from '../lib/helpers/mod-log.js';
import {handleCommandError} from '../lib/helpers/error-handlers.js';

/* eslint-disable @typescript-eslint/naming-convention */
const {Guild} = InteractionContextType;
const {GuildInstall} = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */

const dexImpersonateCommand = {
	data: new SlashCommandBuilder()
		.setName('deximpersonate')
		.setDescription('Impersonate a user to spawn a countryball')
		.addUserOption((option) =>
			option
				.setName('target')
				.setDescription('User to impersonate')
				.setRequired(true),
		)
		.addAttachmentOption((option) =>
			option
				.setName('image')
				.setDescription('The image to display')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('formanswer')
				.setDescription('The correct answer')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('boldtext')
				.setDescription('The rarity/type text')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('texttype')
				.setDescription('Format of the success message')
				.setRequired(true)
				.addChoices(
					{name: 'Bold Text (Standard)', value: 'boldtext'},
					{name: 'Full Text (Custom)', value: 'fulltext'},
				),
		)
		.addStringOption((option) =>
			option
				.setName('stats')
				.setDescription(
					'Custom stats (e.g. #ABCDEF, +1%/+2%). Optional.',
				)
				.setRequired(false),
		)
		.setDefaultMemberPermissions(
			PermissionFlagsBits.ManageMessages,
		)
		.setContexts([Guild])
		.setIntegrationTypes([GuildInstall]),

	async execute(interaction: ChatInputCommandInteraction) {
		const target = interaction.options.getUser('target');
		const image = interaction.options.getAttachment('image');
		const answer = interaction.options.getString('formanswer');
		const bold = interaction.options.getString('boldtext');
		const type = interaction.options.getString('texttype');
		const stats =
			interaction.options.getString('stats') ?? 'DEFAULT';
		await interaction.deferReply({
			flags: [MessageFlags.Ephemeral],
		});
		if (!target || !image)
			return interaction.reply(
				'Something went wrong when trying to get your inputted data',
			);
		if (!interaction.guild)
			return interaction.reply(
				'Something went wrong when trying to find your guild',
			);
		// Use a unique key per spawn so multiple spawns don't collide
		const spawnId = `${target.id}-${Date.now()}`;
		catchDataStore.set(spawnId, {
			answer,
			bold,
			type,
			targetId: target.id,
			stats,
		});
		const targetChannel = castAsWebhookable(interaction.channel);
		const webhook = await targetChannel.createWebhook({
			name: target.username,
			avatar: target.displayAvatarURL(),
		});

		const row =
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
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

		logToModChannel(
			interaction.guild,
			`**Spawn**: ${interaction.user.username} spawned **${answer}** impersonating ${target.username}.`,
		).catch(async (error: unknown) =>
			handleCommandError(error, interaction),
		);
		await interaction.editReply({
			content: 'Spawned successfully!',
		});
	},
};

export default dexImpersonateCommand;
