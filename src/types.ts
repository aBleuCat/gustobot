import { Client, Collection } from 'discord.js';

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, any>;
    orbital: any;
    logToModChannel: Function;
  }
}
