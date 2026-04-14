import type { Client, TextChannel } from 'discord.js';
import { config } from '../config.js';

let logChannel: TextChannel | null = null;
let bgTasksChannel: TextChannel | null = null;
let microChannel: TextChannel | null = null;
let statusChannel: TextChannel | null = null;

export async function initDevLog(client: Client): Promise<void> {
  try {
    const guild = await client.guilds.fetch(config.DEV_GUILD_ID);

    logChannel = (await guild.channels.fetch(config.DEV_LOG_CHANNEL_ID).catch(() => null)) as TextChannel | null;
    bgTasksChannel = (await guild.channels.fetch(config.BG_TASKS_CHANNEL_ID).catch(() => null)) as TextChannel | null;
    microChannel = (await guild.channels.fetch(config.MICRO_LOG_CHANNEL_ID).catch(() => null)) as TextChannel | null;
    statusChannel = (await guild.channels.fetch(config.STATUS_LOG_CHANNEL).catch(() => null)) as TextChannel | null;

    console.log(`[devLog] System Hooked: Main(#${logChannel?.name}), Status(#${statusChannel?.name})`);
  } catch (e) {
    console.error('[devLog Init Error]:', (e as Error).message);
  }
}

type LogType = 'standard' | 'bg' | 'micro' | 'status';

export async function devLog(message: string, type: LogType = 'standard'): Promise<void> {
  let targetChannel: TextChannel | null = null;
  let secondaryChannel: TextChannel | null = null;

  if (type === 'bg') {
    targetChannel = bgTasksChannel;
  } else if (type === 'micro') {
    targetChannel = microChannel;
  } else if (type === 'status') {
    targetChannel = statusChannel;
  } else {
    targetChannel = logChannel;
    secondaryChannel = microChannel;
  }

  // Fallback to console
  if (!targetChannel) {
    console.log(`[DEV LOG ${type.toUpperCase()}]: ${message}`);
    return;
  }

  try {
    const prefix = type === 'status' ? '' : `\`[DEV LOG]\` `;
    const formattedMsg = `${prefix}${message}`;

    await targetChannel.send(formattedMsg);

    if (secondaryChannel) {
      await secondaryChannel.send(formattedMsg);
    }
  } catch (error) {
    console.error('[devLog Send Error]:', (error as Error).message);
  }
}
