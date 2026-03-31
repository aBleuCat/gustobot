const { Timeout } = require('../models');

let roleReverterInterval = null;

function startRoleReverter(client) {
    if (roleReverterInterval) return;

    roleReverterInterval = setInterval(async () => {
        const expired = await Timeout.find({ revertAt: { $lte: Date.now() } }).lean();
        for (const doc of expired) {
            if (doc.guildId) {
                const guild = client.guilds.cache.get(doc.guildId);
                if (guild) {
                    const member = await guild.members.fetch(doc.targetUser).catch(() => null);
                    if (member) {
                        if (doc.addRole) await member.roles.remove(doc.addRole).catch(() => {});
                        if (doc.restoreRole) await member.roles.add(doc.restoreRole).catch(() => {});
                    }
                }
            } else {
                // Legacy fallback for docs without guildId
                for (const guild of client.guilds.cache.values()) {
                    // Fast skip: if guild doesn't have the role, don't check members
                    if (doc.addRole && !guild.roles.cache.has(doc.addRole)) continue;
                    
                    const member = await guild.members.fetch(doc.targetUser).catch(() => null);
                    if (member) {
                        if (doc.addRole) await member.roles.remove(doc.addRole).catch(() => {});
                        if (doc.restoreRole) await member.roles.add(doc.restoreRole).catch(() => {});
                        break; // Break since we found the guild
                    }
                }
            }
            await doc.deleteOne();
        }
    }, 10000);
}

function stopRoleReverter() {
    if (!roleReverterInterval) return;
    clearInterval(roleReverterInterval);
    roleReverterInterval = null;
}

module.exports = { startRoleReverter, stopRoleReverter };
