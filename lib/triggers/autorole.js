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
    const matchingRules = await getRules(msg.author.id, msg.channel.id);

    for (const rule of matchingRules) {
        const targetId = rule.targetUser;

        const msgJson = JSON.stringify(msg.toJSON());
    const targetsUser =
        msg.content.includes(targetId) ||
        msg.mentions.users.has(targetId) ||
        (msg.reference && msg.mentions.repliedUser && msg.mentions.repliedUser.id === targetId) ||
        msgJson.includes(targetId);
        if (targetsUser) {
            try {
                const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                if (member && !member.roles.cache.has(rule.addRole)) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});

                    await new Timeout({
                        guildId: msg.guild.id,
                        targetUser: rule.targetUser,
                        addRole: rule.addRole,
                        restoreRole: rule.restoreRole,
                        revertAt: Date.now() + rule.durationMs
                    }).save();

                    await logToModChannel(msg.guild, `triggered role swap for ${member.user.tag}`);
                }
            } catch (e) {
                console.error("Autorole Error:", e.message);
            }
        }
    }
}

module.exports = { handleAutorole };
