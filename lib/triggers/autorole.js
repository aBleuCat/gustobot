const { Rule, Timeout } = require('../models');
const { logToModChannel } = require('../helpers/modLog');

async function handleAutorole(msg) {
    const matchingRules = await Rule.find({ watchUser: msg.author.id, channel: msg.channel.id });

    for (const rule of matchingRules) {
        const msgJson = JSON.stringify(msg).toLowerCase();
        const targetId = rule.targetUser.toLowerCase();

        if (msgJson.includes(targetId)) {
            try {
                const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                if (member && !member.roles.cache.has(rule.addRole)) {
                    await member.roles.add(rule.addRole);
                    await member.roles.remove(rule.restoreRole).catch(() => {});

                    await new Timeout({
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
