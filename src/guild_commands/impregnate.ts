import {
	SlashCommandBuilder,
	MessageFlags,
	type ChatInputCommandInteraction,
	InteractionContextType,
} from 'discord.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
const {Guild} = InteractionContextType;

const impregnateCommand = {
	data: new SlashCommandBuilder()
		.setName('impregnate')
		.setDescription('impregnate someone')
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('user to impregnate')
				.setRequired(true),
		)
		.setContexts([Guild]),
	async execute(interaction: ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user');
		const roleId = '1473123914531213532';

		try {
			if (!interaction.guild)
				return interaction.reply({
					content: 'You suck couldnt find ur guild holy L',
				});
			if (!user)
				return interaction.reply({
					content:
						"Couldn't get your inputs for user, try again",
				});
			const target = await interaction.guild.members
				.fetch(user.id)
				.catch(() => undefined);
			if (!target)
				return interaction.reply({
					content: 'Member not found.',
					flags: [MessageFlags.Ephemeral],
				});

			await target.roles.add(roleId);
			return interaction.reply(
				`impregnated ${target.user.username}.`,
			);
		} catch (error) {
			console.error('Impregnation command error:', error);
			return interaction.reply({
				content: 'Failed to impregnate',
				flags: [MessageFlags.Ephemeral],
			});
		}
	},
};

export default impregnateCommand;
