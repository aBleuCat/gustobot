import { ActivityType, type Client } from "discord.js";
import { PingResponse } from "../models.js";
import { immutConfig } from "../config.js";
import { randItem, seededRandom } from "../helpers/random-helpers.js";

const activityTypes = [
	ActivityType.Competing,
	ActivityType.Listening,
	ActivityType.Playing,
	ActivityType.Watching,
] as const;

let presenceRotationInterval: NodeJS.Timeout | undefined;

const linkRegex = /^http.*$/iv;

async function rotatePresence(client: Client) {
	try {
		if (!client.user) return;

		const epochHour = Math.floor(
			Temporal.Now.instant().epochMilliseconds /
				immutConfig.HOUR_MS,
		);
		if (seededRandom(epochHour) > 0.5) {
			const statusType =
				randItem(activityTypes) ?? ActivityType.Playing;
			client.user.setPresence({
				status: "online",
				activities: [{ name: "horses", type: statusType }],
			});
			return;
		}

		const generalResponses = await PingResponse.find({
			"trigger.type": null,
		})
			.select("message")
			.lean();
		const response = randItem(
			generalResponses.filter(
				({ message }) =>
					message.trim().length > 0 &&
					message.trim().length < 128 &&
					!linkRegex.test(message.trim()),
			),
		);

		if (!response) {
			console.warn(
				"[PresenceRotation] No general ping responses available; using horse activity",
			);
			client.user.setPresence({
				status: "online",
				activities: [
					{
						name: "horses",
						type: ActivityType.Playing,
					},
				],
			});
			return;
		}

		client.user.setPresence({
			status: "online",
			activities: [
				{
					name: "Custom Status",
					state: response.message.slice(0, 128),
					type: ActivityType.Custom,
				},
			],
		});
	} catch (error: unknown) {
		console.error(
			"[PresenceRotation] Failed to update presence:",
			error,
		);
	}
}

export function startPresenceRotation(client: Client) {
	if (presenceRotationInterval) return;

	void rotatePresence(client);
	presenceRotationInterval = setInterval(() => {
		void rotatePresence(client);
	}, immutConfig.HOUR_MS);
}
