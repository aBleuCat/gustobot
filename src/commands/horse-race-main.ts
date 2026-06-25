import {
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
	InteractionContextType,
	ApplicationIntegrationType,
	EmbedBuilder,
} from "discord.js";
import { config } from "../lib/config.js";
import type { ITrainedHorsesProps } from "../lib/models.js";
import { fetchWithTimeout } from "../lib/helpers/timeout-helpers.js";
import { SubcommandLoader } from "./lib/subcommand-loader.js";

const { RACE_WAITING_DURATION } = config;

type Color = "red" | "blue";

type UpdateAction = (
	update: EmbedBuilder,
	rawUpdate: Array<ITrainedHorsesProps | undefined>,
) => void;

export type ReadyRaceChallenge = {
	readonly red: {
		id: string;
		horse?: ITrainedHorsesProps | undefined;
	};

	readonly blue: {
		id: string;
		horse?: ITrainedHorsesProps | undefined;
	};
};

export class UnreadyRaceChallenge {
	public readonly promise: Promise<ReadyRaceChallenge | undefined>;
	private resolveFn!: (value: ReadyRaceChallenge) => void;
	private resolveStatus: "waiting" | "ready" | "expired" =
		"waiting";

	private readonly red: {
		id: string;
		horse?: ITrainedHorsesProps | undefined;
	};

	private readonly blue: {
		id: string;
		horse?: ITrainedHorsesProps | undefined;
	};

	constructor(
		redId: string,
		blueId: string,
		private readonly updateAction?: UpdateAction,
	) {
		this.red = { id: redId };
		this.blue = { id: blueId };

		const successPromise = new Promise<ReadyRaceChallenge>(
			(resolve) => {
				this.resolveFn = resolve;
			},
		);

		this.promise = fetchWithTimeout(
			successPromise,
			RACE_WAITING_DURATION,
		);

		void this.promise.then((result) => {
			this.resolveStatus =
				result === undefined ? "expired" : "ready";
		});
	}

	public addHorse(
		color: Color,
		horse: ITrainedHorsesProps,
		force?: boolean,
	): void {
		this.checkStatus();

		if (!this[color].horse || force) {
			this[color].horse = horse;
			if (this.updateAction)
				this.updateAction(this.horsesEmbed, this.horses);
			return;
		}

		throw new Error("There is already a horse");
	}

	public removeHorse(color: Color): void {
		this.checkStatus();

		this[color].horse = undefined;
		if (this.updateAction)
			this.updateAction(this.horsesEmbed, this.horses);
	}

	public toReady(): ReadyRaceChallenge {
		this.checkStatus();

		if (!this.red.horse || !this.blue.horse)
			throw new Error("The horses have not been specified");
		const finalRaceChallenge = {
			red: this.red,
			blue: this.blue,
		};
		this.resolveFn(finalRaceChallenge);
		return finalRaceChallenge;
	}

	public get horses(): Array<ITrainedHorsesProps | undefined> {
		return [this.red.horse, this.blue.horse];
	}

	public get isReady(): boolean {
		return Boolean(this.red.horse && this.blue.horse);
	}

	public get horsesEmbed() {
		const fields = this.horses.map((horse) => {
			if (!horse) return undefined;
			return `${horse.name}, a ${horse.breed}`;
		});
		const [redHorseField = "none", blueHorseField = "none"] =
			fields;
		return new EmbedBuilder()
			.setColor("#954535")
			.setTitle("Selected Horses")
			.addFields(
				{
					name: "Red",
					value: redHorseField,
				},
				{
					name: "Blue",
					value: blueHorseField,
				},
			);
	}

	private checkStatus(): void {
		if (this.resolveStatus === "expired")
			throw new Error("This challenge has already expired");
		if (this.resolveStatus === "ready")
			throw new Error(
				"This challenge has already become ready and proceeded",
			);
	}
}
// eslint-disable-next-line unicorn/prevent-abbreviations -- yo chill whats the problemo with calling my thing a texan horse master
export const raceMaster = {
	raceMap: new Map<string, UnreadyRaceChallenge>(),
	new(
		channelId: string,
		redId: string,
		blueId: string,
		updateAction: UpdateAction,
	) {
		if (this.exists(channelId))
			throw new Error(
				`A race challenge is already active in channel ${channelId}`,
			);
		const race = new UnreadyRaceChallenge(
			redId,
			blueId,
			updateAction,
		);
		this.raceMap.set(channelId, race);

		void race.promise.finally(() => {
			this.raceMap.delete(channelId);
		});

		return race;
	},
	get(channelId: string) {
		return this.raceMap.get(channelId);
	},
	exists(channelId: string): boolean {
		return this.raceMap.has(channelId);
	},
	close(channelId: string): ReadyRaceChallenge {
		const race = this.raceMap.get(channelId);
		if (!race)
			throw new Error(
				`No race in channel ${channelId} found in the race map`,
			);

		return race.toReady();
	},
};

/* eslint-disable @typescript-eslint/naming-convention */
const { Guild } = InteractionContextType;
const { GuildInstall } = ApplicationIntegrationType;
/* eslint-enable @typescript-eslint/naming-convention */

const mainCommand = new SlashCommandBuilder()
	.setName("race")
	.setDescription("Horse racing!")
	.setContexts([Guild])
	.setIntegrationTypes([GuildInstall]);

const loader = new SubcommandLoader(
	mainCommand,
	import.meta.url,
	"race-commands",
);

await loader.load();

const raceCommand = {
	data: mainCommand,
	async execute(interaction: ChatInputCommandInteraction) {
		await loader.execute(interaction);
	},
	async autocomplete(interaction: AutocompleteInteraction) {
		await loader.autocomplete(interaction);
	},
};

export default raceCommand;
