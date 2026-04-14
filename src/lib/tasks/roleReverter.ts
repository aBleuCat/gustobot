import type { Client } from 'discord.js';
import { Timeout } from '../models.js';

let roleReverterInterval: NodeJS.Timer | null = null;

export function startRoleReverter(client: Client): void {
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
        for (const guild of client.guilds.cache.values()) {
          if (doc.addRole && !guild.roles.cache.has(doc.addRole)) continue;

          const member = await guild.members.fetch(doc.targetUser).catch(() => null);
          if (member) {
            if (doc.addRole) await member.roles.remove(doc.addRole).catch(() => {});
            if (doc.restoreRole) await member.roles.add(doc.restoreRole).catch(() => {});
            break;
          }
        }
      }
      await Timeout.deleteOne({ _id: doc._id });
    }
  }, 10000);
}

export function stopRoleReverter(): void {
  if (!roleReverterInterval) return;
  clearInterval(roleReverterInterval as any);
  roleReverterInterval = null;
}
