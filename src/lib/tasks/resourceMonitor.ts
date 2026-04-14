import type { Client } from 'discord.js';
import { logToModChannel } from '../helpers/modLog.js';
import { devLog } from '../helpers/devLog.js';

const HEAP_THRESHOLD_MB = 350;
const CPU_WARN_PERCENT = 80;

let lastCpuUsage = process.cpuUsage();
let lastTime = process.hrtime();
let lastWarningTime = 0;
const WARNING_COOLDOWN_MS = 5 * 60 * 1000;

export function startResourceMonitor(client: Client): void {
  console.log('[ResourceMonitor] Started monitoring resources.');

  setInterval(async () => {
    const memory = process.memoryUsage();
    const heapUsedMB = memory.heapUsed / 1024 / 1024;
    const rssMB = memory.rss / 1024 / 1024;

    const currentCpu = process.cpuUsage();
    const currentTime = process.hrtime();

    const userDiff = currentCpu.user - lastCpuUsage.user;
    const systemDiff = currentCpu.system - lastCpuUsage.system;

    const timeDiffMs = (currentTime[0] - lastTime[0]) * 1000 + (currentTime[1] - lastTime[1]) / 1e6;
    const totalCpuMs = (userDiff + systemDiff) / 1000;
    const cpuPercent = (totalCpuMs / timeDiffMs) * 100;

    lastCpuUsage = currentCpu;
    lastTime = currentTime;

    console.log(
      `[ResourceMonitor] Heap: ${heapUsedMB.toFixed(2)} MB | RSS: ${rssMB.toFixed(2)} MB | CPU: ${cpuPercent.toFixed(2)}%`
    );
    await devLog(
      `[ResourceMonitor] Heap: ${heapUsedMB.toFixed(2)} MB | RSS: ${rssMB.toFixed(2)} MB | CPU: ${cpuPercent.toFixed(2)}%`,
      'bg'
    );

    const now = Date.now();
    if (
      (heapUsedMB > HEAP_THRESHOLD_MB || cpuPercent > CPU_WARN_PERCENT) &&
      now - lastWarningTime > WARNING_COOLDOWN_MS
    ) {
      lastWarningTime = now;
      console.warn(
        `[ResourceMonitor] ⚠️ THRESHOLD EXCEEDED - Heap: ${heapUsedMB.toFixed(2)} MB (Limit: ${HEAP_THRESHOLD_MB} MB) | CPU: ${cpuPercent.toFixed(2)}% (Limit: ${CPU_WARN_PERCENT}%)`
      );
      await devLog(
        `[ResourceMonitor] ⚠️ THRESHOLD EXCEEDED - Heap: ${heapUsedMB.toFixed(2)} MB (Limit: ${HEAP_THRESHOLD_MB} MB) | CPU: ${cpuPercent.toFixed(2)}% (Limit: ${CPU_WARN_PERCENT}%)`
      );

      for (const guild of client.guilds.cache.values()) {
        await logToModChannel(
          guild,
          `⚠️ **HIGH RESOURCE USAGE DETECTED**\n**Heap Memory:** ${heapUsedMB.toFixed(2)} MB\n**CPU Usage:** ${cpuPercent.toFixed(
            2
          )}%\nThe bot may become unresponsive or restart.`
        ).catch(() => {});
      }
    }
  }, 15000);
}
