import mongoose from 'mongoose';
import {config, immutConfig} from '../config.js';
import {devLog} from '../helpers/dev-log.js';

const {SECOND_MS} = immutConfig;

function startStatusChecker() {
	console.log('[StatusChecker] Heartbeat task initialized.');

	setInterval(() => {
		(async () => {
			const now = new Date();
			const nextCheck = new Date(
				now.getTime() + config.STATUS_CHECKER_INTERVAL,
			);

			// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
			const dbStates = [
				'🔴 Disconnected',
				'🟢 Connected',
				'🟡 Connecting',
				'🟠 Disconnecting',
			];
			const dbStatus =
				dbStates[mongoose.connection.readyState] ??
				'❓ Unknown';

			const statusMessage = [
				`**Status Check**`,
				`Last check: <t:${Math.floor(now.getTime() / SECOND_MS)}:R>`,
				`Next check: <t:${Math.floor(nextCheck.getTime() / SECOND_MS)}:R>`,
				`*If missing, bot is likely offline.*`,
				`**DB:** \`${dbStatus}\``,
			].join('\n');

			// Log to console
			console.log(`[Status] Heartbeat sent. DB: ${dbStatus}`);

			// Forward to devLog
			await devLog(statusMessage, 'status');
		})();
	}, config.STATUS_CHECKER_INTERVAL);
}

export default startStatusChecker;
