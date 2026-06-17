import {
	type Guild,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	LabelBuilder,
	type Client,
} from 'discord.js';
import {ModChannel} from '../models.js';

async function logToModChannel(guild: Guild, message: string) {
	const config = await ModChannel.findOne({
		guildId: guild.id,
	}).lean();
	if (!config) return;
	const channel = await guild.channels
		.fetch(config.channelId)
		.catch(() => undefined);
	if (channel?.isTextBased())
		await channel.send(`[LOG]: ${message}`);
}

export async function logToAllModChannels(
	client: Client,
	message: string,
) {
	const modChannelIds = new Set(
		await ModChannel.distinct('guildId'),
	);
	const logArray = client.guilds.cache
		.values()
		.filter((guild) => modChannelIds.has(guild.id))
		.map(async (guild) => logToModChannel(guild, message));
	await Promise.all(logArray);
}

export function init() {
	const modal = new ModalBuilder()
		.setCustomId('orbital_nuke_modal')
		.setTitle('stab shot');

	const codeInput = new LabelBuilder()
		.setLabel('nuclear launch code')
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId('orbital_nuke_code')
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(false)
				.setPlaceholder(
					'inline code or leave empty to use link',
				)
				.setMaxLength(4000),
		);

	const linkInput = new LabelBuilder()
		.setLabel('link')
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId('orbital_nuke_link')
				.setStyle(TextInputStyle.Short)
				.setRequired(false)
				.setPlaceholder('https://...'),
		);

	modal.addLabelComponents(codeInput, linkInput);

	return modal;
}

export default logToModChannel;
