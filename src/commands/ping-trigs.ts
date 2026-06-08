import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js';
import {immutConfig} from '../lib/config.js';
import {PingResponse, type IPingResponse} from '../lib/models.js';

function buildList(
	randomPool: IPingResponse[],
	triggeredPool: IPingResponse[],
) {
	const lines: string[] = [];

	if (randomPool.length > 0) {
		lines.push('**Random Pool:**');
		for (const poolItem of randomPool) {
			lines.push(
				`• \`${poolItem._id.toString()}\` — ${poolItem.message.slice(0, 80)}${poolItem.message.length > 80 ? '…' : ''}`,
			);
		}
	}

	if (triggeredPool.length > 0) {
		if (lines.length > 0) lines.push('');
		lines.push('**Triggers:**');
		for (const triggerItem of triggeredPool) {
			lines.push(
				`• \`${triggerItem._id.toString()}\` \`${triggerItem.trigger.type}:${triggerItem.trigger.text}\`\n  → ${triggerItem.message.slice(0, 60)}${triggerItem.message.length > 60 ? '…' : ''}`,
			);
		}
	}

	const chunks: string[] = [];
	let currentChunk = '';

	for (const line of lines) {
		if ((currentChunk + '\n' + line).length > 1900) {
			chunks.push(currentChunk);
			currentChunk = line;
		} else {
			currentChunk += (currentChunk ? '\n' : '') + line;
		}
	}

	if (currentChunk) chunks.push(currentChunk);

	return chunks;
}

const pingTrigCommand = {
	data: new SlashCommandBuilder()
		.setName('pingtrigs')
		.setDescription(
			'Manage bot ping responses and triggers (owner only)',
		)
		.addSubcommand((sub) =>
			sub
				.setName('add')
				.setDescription(
					'Add a response to the random pool or with a trigger',
				)
				.addStringOption((option) =>
					option
						.setName('response')
						.setDescription('What the bot replies')
						.setRequired(true),
				)
				.addStringOption((option) =>
					option
						.setName('triggertype')
						.setDescription(
							'Type of trigger (leave blank for random pool)',
						)
						.setRequired(false)
						.addChoices(
							{name: 'contains', value: 'contains'},
							{name: 'author', value: 'author'},
							{name: 'exact', value: 'exact'},
						),
				)
				.addStringOption((option) =>
					option
						.setName('triggertext')
						.setDescription(
							'Trigger text or user ID (required if trigger type is set)',
						)
						.setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('remove')
				.setDescription('Remove an entry by its MongoDB _id')
				.addStringOption((option) =>
					option
						.setName('id')
						.setDescription('MongoDB _id of the entry')
						.setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('list')
				.setDescription('List all responses and triggers'),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!immutConfig.ADMINS.has(interaction.user.id)) {
			return interaction.reply({
				content: 'nope',
				flags: [MessageFlags.Ephemeral],
			});
		}

		await interaction.deferReply({
			flags: [MessageFlags.Ephemeral],
		});
		const sub = interaction.options.getSubcommand();

		switch (sub) {
			case 'add': {
				const response =
					interaction.options.getString('response');
				const triggerType =
					interaction.options.getString('triggertype');
				const triggerText =
					interaction.options.getString('triggertext');

				if (triggerType && !triggerText) {
					return interaction.editReply(
						'You set a trigger type but no trigger text!',
					);
				}

				const entry = await PingResponse.create({
					message: response,
					trigger: triggerType
						? {type: triggerType, text: triggerText}
						: {},
				});

				return interaction.editReply(
					triggerType
						? `Added trigger \`${entry._id.toString()}\`\n**Type:** \`${triggerType}\` **Text:** \`${triggerText}\`\n**Response:** ${response}`
						: `Added to random pool \`${entry._id.toString()}\`:\n> ${response}`,
				);
			}

			case 'remove': {
				const id = interaction.options.getString('id');
				const deleted = await PingResponse.findByIdAndDelete(
					id,
				).catch(() => undefined);

				if (deleted)
					return interaction.editReply(
						`Removed \`${id}\`.`,
					);
				return interaction.editReply(
					`No entry found with id \`${id}\`.`,
				);
			}

			case 'list': {
				const allEntries = await PingResponse.find({});
				if (allEntries.length === 0)
					return interaction.editReply(
						'Nothing added yet.',
					);

				const randomPool = allEntries.filter(
					(entry) => !entry.trigger?.type,
				);
				const triggeredPool = allEntries.filter(
					(entry) => entry.trigger?.type,
				);
				const chunks = buildList(randomPool, triggeredPool);

				if (chunks[0]) await interaction.editReply(chunks[0]);

				if (chunks.length > 1) {
					const followUpPromises = chunks
						.slice(1)
						.map(async (chunk) =>
							interaction.followUp({
								content: chunk,
								flags: [MessageFlags.Ephemeral],
							}),
						);
					await Promise.all(followUpPromises);
				}

				return;
			}

			default: {
				return interaction.editReply('Unknown subcommand.');
			}
		}
	},
};

export default pingTrigCommand;
