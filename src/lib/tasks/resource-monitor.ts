import process from 'node:process';
import type {Client} from 'discord.js';
import {config, immutConfig} from '../config.js';
import {logToAllModChannels} from '../helpers/mod-log.js';
import devLog from '../helpers/dev-log.js';

const {
	HEAP_THRESHOLD_MB,
	CPU_WARN_PERCENT,
	WARNING_COOLDOWN_MS,
	RESOURCE_MONITOR_INTERVAL,
} = config;
const {SECOND_MS} = immutConfig;

let lastCpuUsage = process.cpuUsage();
let lastTime = process.hrtime();
let lastWarningTime = 0;

function startResourceMonitor(client: Client) {
	console.log('[ResourceMonitor] Started monitoring resources.');

	setInterval(() => {
		(async () => {
			const memory = process.memoryUsage();
			const heapUsedMB = memory.heapUsed / 1024 / 1024;
			const rssMB = memory.rss / 1024 / 1024;

			// Calculate CPU usage % for the Node process over the last interval
			const currentCpu = process.cpuUsage();
			const currentTime = process.hrtime();

			const userDiff = currentCpu.user - lastCpuUsage.user;
			const systemDiff =
				currentCpu.system - lastCpuUsage.system;

			const timeDiffMs =
				(currentTime[0] - lastTime[0]) * SECOND_MS +
				(currentTime[1] - lastTime[1]) / 1e6;
			const totalCpuMs = (userDiff + systemDiff) / SECOND_MS;
			const cpuPercent = (totalCpuMs / timeDiffMs) * 100;

			lastCpuUsage = currentCpu;
			lastTime = currentTime;

			// Log to console for local monitoring
			console.log(
				`[ResourceMonitor] Heap: ${heapUsedMB.toFixed(2)} MB | RSS: ${rssMB.toFixed(2)} MB | CPU: ${cpuPercent.toFixed(2)}%`,
			);
			await devLog(
				`[ResourceMonitor] Heap: ${heapUsedMB.toFixed(2)} MB | RSS: ${rssMB.toFixed(2)} MB | CPU: ${cpuPercent.toFixed(2)}%`,
				'bg',
			);

			// Check if thresholds are met and cooldown is expired
			const now = Date.now();
			if (
				(heapUsedMB > HEAP_THRESHOLD_MB ||
					cpuPercent > CPU_WARN_PERCENT) &&
				now - lastWarningTime > WARNING_COOLDOWN_MS
			) {
				lastWarningTime = now;
				console.warn(
					`[ResourceMonitor] ⚠️ THRESHOLD EXCEEDED - Heap: ${heapUsedMB.toFixed(2)} MB (Limit: ${HEAP_THRESHOLD_MB} MB) | CPU: ${cpuPercent.toFixed(2)}% (Limit: ${CPU_WARN_PERCENT}%)`,
				);
				await devLog(
					`[ResourceMonitor] ⚠️ THRESHOLD EXCEEDED - Heap: ${heapUsedMB.toFixed(2)} MB (Limit: ${HEAP_THRESHOLD_MB} MB) | CPU: ${cpuPercent.toFixed(2)}% (Limit: ${CPU_WARN_PERCENT}%)`,
				);

				const logMessage = `⚠️ **HIGH RESOURCE USAGE DETECTED**\n
				**Heap Memory:** ${heapUsedMB.toFixed(2)} MB\n
				**CPU Usage:** ${cpuPercent.toFixed(2)}%\n
				The bot may become unresponsive or restart.`;
				await logToAllModChannels(client, logMessage);
			}
		})();
	}, RESOURCE_MONITOR_INTERVAL); // Check every 15 seconds
}

export {startResourceMonitor};
