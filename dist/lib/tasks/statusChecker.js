import mongoose from 'mongoose';
import { devLog } from '../helpers/devLog.js';
const status_checker_interval = 2 * 60 * 1000;
export function startStatusChecker() {
    console.log('[StatusChecker] Heartbeat task initialized.');
    setInterval(async () => {
        const now = new Date();
        const nextCheck = new Date(now.getTime() + status_checker_interval);
        const dbStates = ['🔴 Disconnected', '🟢 Connected', '🟡 Connecting', '🟠 Disconnecting'];
        const dbStatus = dbStates[mongoose.connection.readyState] || '❓ Unknown';
        const statusMessage = [
            `**Status Check**`,
            `Last check: <t:${Math.floor(now.getTime() / 1000)}:R>`,
            `Next check: <t:${Math.floor(nextCheck.getTime() / 1000)}:R>`,
            `*If missing, bot is likely offline.*`,
            `**DB:** \`${dbStatus}\``,
        ].join('\n');
        console.log(`[Status] Heartbeat sent. DB: ${dbStatus}`);
        await devLog(statusMessage, 'status');
    }, status_checker_interval);
}
//# sourceMappingURL=statusChecker.js.map