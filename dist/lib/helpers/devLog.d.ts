import type { Client } from 'discord.js';
export declare function initDevLog(client: Client): Promise<void>;
type LogType = 'standard' | 'bg' | 'micro' | 'status';
export declare function devLog(message: string, type?: LogType): Promise<void>;
export {};
//# sourceMappingURL=devLog.d.ts.map