import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MessageFlags,
	SeparatorBuilder,
	SlashCommandBuilder,
	TextDisplayBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";
import {
	Settings,
	type HorsesSpawnPingSetting,
	type ISettings,
} from "../lib/models.js";
import { immutConfig } from "../lib/config.js";

const pingSettings = [
	"always",
	"rare",
	"very_rare",
	"never",
] as const satisfies readonly HorsesSpawnPingSetting[];

function buildSettingsPanel(
	settings: Pick<ISettings, "horsesOptIn" | "horsesSpawnPing">,
): ContainerBuilder {
	const optInButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("settings:horses:yes")
			.setLabel("Yes")
			.setStyle(
				settings.horsesOptIn
					? ButtonStyle.Success
					: ButtonStyle.Secondary,
			),
		new ButtonBuilder()
			.setCustomId("settings:horses:no")
			.setLabel("No")
			.setStyle(
				settings.horsesOptIn
					? ButtonStyle.Secondary
					: ButtonStyle.Danger,
			),
	);
	const pingButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("settings:ping:always")
			.setLabel("Always")
			.setStyle(
				settings.horsesSpawnPing === "always"
					? ButtonStyle.Primary
					: ButtonStyle.Secondary,
			),
		new ButtonBuilder()
			.setCustomId("settings:ping:rare")
			.setLabel("Rare")
			.setStyle(
				settings.horsesSpawnPing === "rare"
					? ButtonStyle.Primary
					: ButtonStyle.Secondary,
			),
		new ButtonBuilder()
			.setCustomId("settings:ping:very_rare")
			.setLabel("Very rare")
			.setStyle(
				settings.horsesSpawnPing === "very_rare"
					? ButtonStyle.Primary
					: ButtonStyle.Secondary,
			),
		new ButtonBuilder()
			.setCustomId("settings:ping:never")
			.setLabel("Never")
			.setStyle(
				settings.horsesSpawnPing === "never"
					? ButtonStyle.Primary
					: ButtonStyle.Secondary,
			),
	);

	return new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"# Your settings\nGustobot settings, including horse spawn settings. Changes save immediately.",
			),
		)
		.addSeparatorComponents(new SeparatorBuilder().setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"## Opt in to horses\nWhen enabled, horses can spawn from your messages. If disabled, you can still gamble and do other things",
			),
		)
		.addActionRowComponents(optInButtons)
		.addSeparatorComponents(new SeparatorBuilder().setDivider(true))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				"## Horse spawn pings\nChoose which horse spawns ping you in the spawn channel. Horses will only spawn if you are opted in.",
			),
		)
		.addActionRowComponents(pingButtons);
}

async function updateSettings(
	interaction: ButtonInteraction,
): Promise<void> {
	const [, settingName, settingValue] = interaction.customId.split(":");
	let update: Partial<
		Pick<ISettings, "horsesOptIn" | "horsesSpawnPing">
	>;

	if (settingName === "horses" && settingValue === "yes") {
		update = { horsesOptIn: true };
	} else if (settingName === "horses" && settingValue === "no") {
		update = { horsesOptIn: false };
	} else if (settingName === "ping") {
		const pingSetting = pingSettings.find(
			(value) => value === settingValue,
		);
		if (!pingSetting) return;
		update = { horsesSpawnPing: pingSetting };
	} else {
		return;
	}

	const savedSettings = await Settings.findOneAndUpdate(
		{ userId: interaction.user.id },
		{ $set: update },
		{ upsert: true, new: true, setDefaultsOnInsert: true },
	).lean();
	if (!savedSettings) {
		throw new Error(
			`Failed to save settings for user ${interaction.user.id}`,
		);
	}

	await interaction.update({
		components: [buildSettingsPanel(savedSettings)],
	});
}

const settingsCommand = {
	data: new SlashCommandBuilder()
		.setName("settings")
		.setDescription("Edit your personal bot settings"),
	async execute(interaction: ChatInputCommandInteraction) {
		const settings = (await Settings.findOne(
			{ userId: interaction.user.id },
			{ horsesOptIn: 1, horsesSpawnPing: 1 },
		).lean()) ?? {
			horsesOptIn: true,
			horsesSpawnPing: "never" as const,
		};
		const response = await interaction.reply({
			components: [buildSettingsPanel(settings)],
			flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
		});
		const collector = response.createMessageComponentCollector({
			time: immutConfig.MINUTE_MS * 10,
		});

		collector.on("collect", (componentInteraction) => {
			if (!componentInteraction.isButton()) return;
			if (componentInteraction.user.id !== interaction.user.id) {
				void componentInteraction
					.reply({
						content: "Only the person who opened these settings can change them.",
						flags: [MessageFlags.Ephemeral],
					})
					.catch((error: unknown) => {
						console.error(
							"Failed to reject unauthorized settings interaction:",
							error,
						);
					});
				return;
			}

			void updateSettings(componentInteraction).catch(
				(error: unknown) => {
					console.error("Failed to update user settings:", error);
					const errorReply = {
						content: "Couldn't save your settings. Please try again.",
						flags: [MessageFlags.Ephemeral] as const,
					};
					const reportError =
						componentInteraction.deferred ||
						componentInteraction.replied
							? componentInteraction.followUp(errorReply)
							: componentInteraction.reply(errorReply);
					void reportError.catch((replyError: unknown) => {
						console.error(
							"Failed to report settings update error:",
							replyError,
						);
					});
				},
			);
		});
	},
};

export default settingsCommand;
