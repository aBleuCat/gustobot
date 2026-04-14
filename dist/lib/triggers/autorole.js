import { Rule, Timeout } from '../models.js';
import { logToModChannel } from '../helpers/modLog.js';
import { config } from '../config.js';
const ruleCache = new Map();
const RULE_CACHE_TTL_MS = config.RULE_CACHE_TTL_MS;
async function getRules(userId, channelId) {
    const key = `${userId}:${channelId}`;
    const cached = ruleCache.get(key);
    if (cached && cached.expiresAt > Date.now())
        return cached.rules;
    const rules = await Rule.find({ watchUser: userId, channel: channelId }).lean();
    ruleCache.set(key, { rules, expiresAt: Date.now() + RULE_CACHE_TTL_MS });
    return rules;
}
export async function handleAutorole(msg) {
    if (!msg.guild)
        return;
    const matchingRules = await getRules(msg.author.id, msg.channel.id);
    if (!matchingRules.length)
        return;
    for (const rule of matchingRules) {
        const targetId = rule.targetUser;
        let isMentioned = msg.mentions.users.has(targetId) || msg.content.includes(targetId) || (msg.reference && msg.mentions.repliedUser?.id === targetId);
        if (!isMentioned) {
            const rawDataString = JSON.stringify(msg.toJSON()).toLowerCase();
            if (rawDataString.includes(targetId.toLowerCase())) {
                isMentioned = true;
            }
        }
        if (msg.author.bot) {
            await logToModChannel(msg.guild, `[Rule]: Found=${isMentioned} | Target ID: ${targetId}`);
        }
        if (isMentioned) {
            try {
                const member = await msg.guild.members.fetch(targetId).catch(() => null);
                if (member && !member.roles.cache.has(rule.addRole)) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => { });
                    await new Timeout({
                        guildId: msg.guild.id,
                        targetUser: targetId,
                        addRole: rule.addRole,
                        restoreRole: rule.restoreRole,
                        revertAt: Date.now() + rule.durationMs,
                    }).save();
                    await logToModChannel(msg.guild, `**Success!** Triggered for ${member.user.tag}`);
                }
            }
            catch (e) {
                console.error('Deep Scan Error:', e);
            }
        }
    }
}
//# sourceMappingURL=autorole.js.map