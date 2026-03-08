const { Timeout } = require('../models');

function startRoleReverter(client) {
    setInterval(async () => {
        const expired = await Timeout.find({ revertAt: { $lte: Date.now() } });
        for (const doc of expired) {
            for (const guild of client.guilds.cache.values()) {
                const member = await guild.members.fetch(doc.targetUser).catch(() => null);
                if (member) {
                    await member.roles.remove(doc.addRole).catch(() => {});
                    await member.roles.add(doc.restoreRole).catch(() => {});
                }
            }
            await doc.deleteOne();
        }
    }, 10000);
}

module.exports = { startRoleReverter };
