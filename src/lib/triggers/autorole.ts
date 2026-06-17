import type { Message } from "discord.js";
import type { FlattenMaps } from "mongoose";
import { Rule, Timeout, type IRule } from "../models.js";
import logToModChannel from "../helpers/mod-log.js";
import { config } from "../config.js";

type RuleCacheKey = `${string}:${string}`;
type RuleCacheInstance = {
	rules: Array<FlattenMaps<IRule>>;
	expiresAt: number;
};

const ruleCache = new Map<RuleCacheKey, RuleCacheInstance>();
const { RULE_CACHE_TTL_MS } = config;

async function getRules(
	userId: string,
	channelId: string,
): Promise<Array<FlattenMaps<IRule>>> {
	const key: RuleCacheKey = `${userId}:${channelId}`;
	const cached = ruleCache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.rules;

	const rules = await Rule.find({
		watchUser: userId,
		channel: channelId,
	}).lean();

	ruleCache.set(key, {
		rules,
		expiresAt: Date.now() + RULE_CACHE_TTL_MS,
	});
	return rules;
}

async function handleAutorole(message: Message): Promise<void> {
	if (!message.guild) return;

	const matchingRules = await getRules(
		message.author.id,
		message.channel.id,
	);
	if (matchingRules.length === 0) return;

	const matchesMessage: string[] = [];
	const tasks: Array<Promise<void>> = [];

	for (const rule of matchingRules) {
		const targetId = rule.targetUser;
		let isMentioned = false;

		// Standard Check: Mentions, Exact Content, and Direct Replies
		if (
			message.mentions.users.has(targetId) ||
			message.content.includes(targetId) ||
			(message.reference &&
				message.mentions.repliedUser?.id === targetId)
		) {
			isMentioned = true;

			// Embed/Component Check: Targeted structural check
		} else if (
			(message.embeds.length > 0 &&
				JSON.stringify(message.embeds)
					.toLowerCase()
					.includes(targetId)) ||
			(message.components.length > 0 &&
				JSON.stringify(message.components)
					.toLowerCase()
					.includes(targetId))
		) {
			isMentioned = true;

			// Brute Force Check: Deep API fallback scan (High cost - Last resort)
		} else {
			const rawDataString = JSON.stringify(
				message.toJSON(),
			).toLowerCase();
			if (rawDataString.includes(targetId.toLowerCase())) {
				isMentioned = true;
			}
		}

		// Logging configuration for Bot-sent messages
		if (message.author.bot) {
			matchesMessage.push(
				`[Rule]: Found=${isMentioned} | Target ID: ${targetId}`,
			);
		}

		if (isMentioned) {
			tasks.push(
				(async () => {
					try {
						if (!message.guild) return;
						const member = await message.guild.members
							.fetch(targetId)
							.catch(() => undefined);

						if (
							member &&
							!member.roles.cache.has(rule.addRole)
						) {
							await member.roles.add(rule.addRole);
							await member.roles
								.remove(rule.restoreRole)
								.catch(() => undefined);

							await new Timeout({
								guildId: message.guild.id,
								targetUser: targetId,
								addRole: rule.addRole,
								restoreRole: rule.restoreRole,
								revertAt:
									Date.now() + rule.durationMs,
							}).save();

							matchesMessage.push(
								`**Success!** Triggered rule for ${member.user.tag}`,
							);
						}
					} catch (error) {
						console.error("Deep Scan Error:", error);
					}
				})(),
			);
		}
	}

	// Wait for background tasks to finish logging operations before formatting output
	await Promise.allSettled(tasks);

	if (matchesMessage.length > 0) {
		await logToModChannel(
			message.guild,
			matchesMessage.join("\n"),
		);
	}
}

export default handleAutorole;
