import type { Client, GuildMember } from "discord.js";
import { Timeout } from "../models.js";
import { config } from "../config.js";

let roleReverterInterval: NodeJS.Timeout | undefined;

async function updateMemberRoles(member: GuildMember, doc: any) {
	const promises = [];

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (doc.addRole) {
		promises.push(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
			member.roles.remove(doc.addRole).catch(() => undefined),
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (doc.restoreRole) {
		promises.push(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
			member.roles.add(doc.restoreRole).catch(() => undefined),
		);
	}

	await Promise.all(promises);
}

export function startRoleReverter(client: Client) {
	if (roleReverterInterval) return;

	roleReverterInterval = setInterval(() => {
		(async () => {
			const expired = await Timeout.find({
				revertAt: { $lte: Date.now() },
			}).lean();

			const deletionPromises = expired.map(async (doc) => {
				if (doc.guildId) {
					const guild = client.guilds.cache.get(
						doc.guildId,
					);
					if (guild) {
						const member = await guild.members
							.fetch(doc.targetUser)
							.catch(() => undefined);
						if (member) {
							await updateMemberRoles(member, doc);
						}
					}
				} else {
					// Legacy fallback for docs without guildId
					const guildArray = [
						...client.guilds.cache.values(),
					];

					for (const guild of guildArray) {
						// Fast skip: if guild doesn't have the role, don't check members
						if (
							doc.addRole &&
							!guild.roles.cache.has(doc.addRole)
						) {
							continue;
						}

						// eslint-disable-next-line no-await-in-loop
						const member = await guild.members
							.fetch(doc.targetUser)
							.catch(() => undefined);
						if (member) {
							// eslint-disable-next-line no-await-in-loop
							await updateMemberRoles(member, doc);
							break; // Break since found the guild
						}
					}
				}

				await Timeout.deleteOne({ _id: doc._id });
			});

			await Promise.all(deletionPromises);
		})();
	}, config.ROLE_REVERTER_INTERVAL);
}

export function stopRoleReverter() {
	if (!roleReverterInterval) return;
	clearInterval(roleReverterInterval);
	roleReverterInterval = undefined;
}
