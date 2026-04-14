import { Collection } from 'discord.js';
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
        orbital: any;
        logToModChannel: Function;
    }
}
//# sourceMappingURL=types.d.ts.map