const { Rule, Timeout } = require('../models');
const { logToModChannel } = require('../helpers/modLog');
const { config } = require('../config');

// Cache rules in memory to avoid a DB hit on every message.
// `${watchUser}:${channel}` → { rules, expiresAt }
const ruleCache = new Map();
const RULE_CACHE_TTL_MS = config.RULE_CACHE_TTL_MS;

async function getRules(userId, channelId) {
    const key = `${userId}:${channelId}`;
    const cached = ruleCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.rules;

    const rules = await Rule.find({ watchUser: userId, channel: channelId }).lean();
    ruleCache.set(key, { rules, expiresAt: Date.now() + RULE_CACHE_TTL_MS });
    return rules;
}

async function handleAutorole(msg) {
    if (!msg.guild) return; // Ignore DMs

    const matchingRules = await getRules(msg.author.id, msg.channel.id);
    if (!matchingRules.length) return;

    for (const rule of matchingRules) {
        const targetId = rule.targetUser;

        // STANDARD CHECK: Mentions and Content
        let isMentioned = 
            msg.mentions.users.has(targetId) || 
            msg.content.includes(targetId) ||
            (msg.reference && msg.mentions.repliedUser?.id === targetId);

        // DEEP SCAN: Only runs if the standard check didn't find anything
        // This catches IDs inside Embeds, Components, etc.
        if (!isMentioned) {
            const rawDataString = JSON.stringify(msg.toJSON()).toLowerCase();
            if (rawDataString.includes(targetId.toLowerCase())) {
                isMentioned = true;
            }
        }

        // Logging for Bot-sent messages
        if (msg.author.bot) {
            await logToModChannel(msg.guild, `[Rule]: Found=${isMentioned} | Target ID: ${targetId}`);
        }

        if (isMentioned) {
            try {
                const member = await msg.guild.members.fetch(targetId).catch(() => null);
                
                if (member && !member.roles.cache.has(rule.addRole)) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});

                    await new Timeout({
                        guildId: msg.guild.id,
                        targetUser: targetId,
                        addRole: rule.addRole,
                        restoreRole: rule.restoreRole,
                        revertAt: Date.now() + rule.durationMs
                    }).save();

                    await logToModChannel(msg.guild, `**Success!** Triggered for ${member.user.tag}`);
                }
            } catch (e) {
                console.error("Deep Scan Error:", e);
            }
        }
    }
}

module.exports = { handleAutorole };