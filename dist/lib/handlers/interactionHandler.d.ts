import type { Client, ModalSubmitInteraction } from 'discord.js';
interface CatchData {
    ans: string;
    bold: string;
    type: string;
    targetId: string;
    stats?: string;
    _expiresAt?: number;
}
declare const catchDataStore: Map<string, CatchData>;
export declare function registerInteractionHandler(client: Client): void;
declare function runNukeCode(code: string, interaction: ModalSubmitInteraction): Promise<any>;
export { catchDataStore, runNukeCode };
//# sourceMappingURL=interactionHandler.d.ts.map