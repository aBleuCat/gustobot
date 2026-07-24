import type {
	Client,
	ChatInputCommandInteraction,
	Interaction,
	Message,
} from "discord.js";
import { config } from "../config.js";
import { forceSpawnHorse } from "../triggers/horse-spawner.js";
import { UserHorses, HorseConfig, OrbitalScript } from "../models.js";
import rawHorseValues from "../../data/horses.json" with { type: "json" };
import {
	castAsHorseData,
	returnAsTextBased,
} from "../../type-utils.js";
import stringSimilarity from "./similarity-helper.js";
import dmAdmin from "./dm-log.js";
import queueMessage from "./message-queue.js";
import { getOrbitalState } from "./orbital-state.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const HORSE_POOL = Object.keys(HORSE_VALUES).filter(
	(n) => n !== "Horse Coin",
);
const DEFAULT_OWNER_BY_COMMAND: Record<string, string> = {
	hacks: "934290747623096381",
};

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let clientRef: Client | undefined;
let spawnerWrapped = false;

// Lazy-loaded horse spawner default export (avoids circular import at top level)
let _handleHorseSpawn:
	| ((message: Message) => Promise<void>)
	| undefined;

async function callHandleHorseSpawn(message: Message): Promise<void> {
	if (!_handleHorseSpawn) {
		const mod = await import("../triggers/horse-spawner.js");
		_handleHorseSpawn = mod.default;
	}

	return _handleHorseSpawn(message);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function toUserId(
	payload: Record<string, unknown> | undefined,
	interaction: Interaction | undefined,
): string {
	if (payload?.userId !== undefined)
		return safeString(payload.userId);

	if (
		payload?.username !== undefined &&
		interaction?.guild?.members
	) {
		const norm = safeString(payload.username)
			.trim()
			.toLowerCase();
		let best: string | undefined;
		let bestScore = 0.7;

		for (const member of interaction.guild.members.cache.values()) {
			const uname = member.user.username.toLowerCase();
			const dname = member.displayName?.toLowerCase() ?? "";

			if (uname === norm || dname === norm)
				return member.user.id;

			const score = stringSimilarity(norm, uname);
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

	if (interaction?.user?.id) return interaction.user.id;
	throw new Error("Must specify userId or username");
}

function resolveHorseName(
	input: string | undefined,
): string | undefined {
	if (!input) return undefined;
	if (HORSE_VALUES[input]) return input;

	const norm = input.trim().toLowerCase();
	let best: string | undefined;
	let bestScore = 0.7;

	for (const name of Object.keys(HORSE_VALUES)) {
		if (name.toLowerCase() === norm) return name;
		const score = stringSimilarity(norm, name.toLowerCase());
		if (score > bestScore) {
			best = name;
			bestScore = score;
		}
	}

	return best;
}

function mustHorse(name: string): string {
	const resolved = resolveHorseName(name);
	if (!resolved) throw new Error(`Unknown horse: ${name}`);
	return resolved;
}

function randHorse(): string {
	return HORSE_POOL[Math.floor(Math.random() * HORSE_POOL.length)]!;
}

async function getInv(userId: string) {
	let inv = await UserHorses.findOne({ userId });
	inv ??= new UserHorses({
		userId,
		horses: new Map(),
		horseCoins: 0,
	});
	return inv;
}

function applyConfigPatch(
	patch: Record<string, unknown> | undefined,
): void {
	if (!patch) return;
	for (const [k, v] of Object.entries(patch)) {
		if (Object.hasOwn(config, k) && v !== undefined) {
			(config as Record<string, unknown>)[k] = v;
		}
	}
}

// ---------------------------------------------------------------------------
// One-shot listener
// ---------------------------------------------------------------------------

function installOneShotListener(client: Client): void {
	const S = getOrbitalState();
	if (S.listenerInstalled) return;
	S.listenerInstalled = true;

	// eslint-disable-next-line @typescript-eslint/strict-void-return
	client.on("messageCreate", async (message) => {
		try {
			if (!message.guild || message.author.bot) return;
			if (!S.currentOneShotUser) return;
			if (message.author.id !== S.currentOneShotUser) return;

			const arm = S.oneShotArms.get(message.author.id);
			if (!arm) return;

			await dmAdmin(
				client,
				`[DMLOG] OneShot triggered by ${message.author.tag} (${message.author.id}) in guild ${message.guild.id}`,
			);

			S.oneShotArms.delete(message.author.id);
			S.currentOneShotUser = undefined;

			let horseName = arm.horseName
				? resolveHorseName(arm.horseName)
				: undefined;
			horseName ??= randHorse();

			const inv = await getInv(message.author.id);
			inv.horses.set(
				horseName,
				(inv.horses.get(horseName) ?? 0) + 1,
			);
			inv.markModified("horses");

			const hCfg = await HorseConfig.findOne({
				guildId: message.guild.id,
			}).lean();
			const target = hCfg?.channelId
				? await message.guild.channels
						.fetch(hCfg.channelId)
						.catch(() => null)
				: null;
			const out = returnAsTextBased(target ?? message.channel);
			if (out instanceof Error) return;

			const horseDisplay =
				HORSE_VALUES[horseName]?.name ?? horseName;
			await Promise.all([
				inv.save(),
				queueMessage({
					channel: out,
					content: `<@${message.author.id}> found the **${horseDisplay}**!`,
					priority: 2,
				}),
				HORSE_VALUES[horseName]?.link
					? queueMessage({
							channel: out,
							content: HORSE_VALUES[horseName]!.link,
							priority: 2,
						})
					: Promise.resolve(),
			]);
		} catch (error: unknown) {
			const detail =
				error instanceof Error
					? (error.stack ?? error.message)
					: String(error);
			await dmAdmin(client, `[DMLOG] OneShot Error: ${detail}`);
		}
	});
}

// ---------------------------------------------------------------------------
// Spawn multiplier wrapper
// ---------------------------------------------------------------------------

function installSpawnerWrapper(client: Client): void {
	if (spawnerWrapped) return;
	spawnerWrapped = true;

	const S = getOrbitalState();

	// eslint-disable-next-line @typescript-eslint/strict-void-return
	client.on("messageCreate", async (message) => {
		const m = S.userSpawnMult.get(message.author.id);
		if (!m) return;

		const old = config.SPAWN_COEFFICIENT;
		config.SPAWN_COEFFICIENT = Math.max(1, old * m);
		try {
			await callHandleHorseSpawn(message);
		} finally {
			config.SPAWN_COEFFICIENT = old;
		}
	});
}

// ---------------------------------------------------------------------------
// Command impersonation helpers
// ---------------------------------------------------------------------------

function ensureCommandPatch(
	client: Client,
	commandName: string,
	asUserId: string,
): void {
	const S = getOrbitalState();
	const cmd = client.commands.get(commandName);
	if (!cmd) throw new Error(`Command not found: ${commandName}`);

	S.cmdWhitelist.asUserByCommand.set(commandName, asUserId);

	const originalExecute = cmd.execute;

	cmd.execute = async function (interaction) {
		// Check if this user is whitelisted for this command
		const userCmds = S.cmdWhitelist.usersByUser.get(
			interaction.user.id,
		);
		const isWhitelisted = Boolean(userCmds?.has(commandName));
		if (!isWhitelisted)
			return originalExecute.call(cmd, interaction);

		// Spoof the interaction's user to the impersonated target
		const targetUserId =
			S.cmdWhitelist.asUserByCommand.get(commandName) ?? "";
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		const spoofed = Object.create(
			interaction,
		) as ChatInputCommandInteraction;
		Object.defineProperty(spoofed, "user", {
			value: { ...interaction.user, id: targetUserId },
			writable: false,
			configurable: true,
		});
		return originalExecute.call(cmd, spoofed);
	};
}

function isCommandStillUsed(commandName: string): boolean {
	const S = getOrbitalState();
	for (const cmds of S.cmdWhitelist.usersByUser.values()) {
		if (cmds.has(commandName)) return true;
	}

	return false;
}

function maybeUnpatchCommand(
	client: Client,
	commandName: string,
): void {
	if (isCommandStillUsed(commandName)) return;

	const cmd = client.commands.get(commandName);
	void cmd; // Wrapper self-checks via whitelist; no-op if empty

	const S = getOrbitalState();
	S.cmdWhitelist.asUserByCommand.delete(commandName);
}

// ---------------------------------------------------------------------------
// orbital.run — the core API dispatch
// ---------------------------------------------------------------------------

async function orbitalRun(
	action: string,
	payload: Record<string, unknown> = {},
	interaction?: Interaction,
): Promise<unknown> {
	const S = getOrbitalState();

	// -- help / status -------------------------------------------------------

	if (action === "help") {
		return {
			version: S.version,
			actions: [
				"status",
				"config.get",
				"config.set",
				"config.reset",
				"coins.get",
				"coins.set",
				"coins.add",
				"coins.remove",
				"horses.get",
				"horses.set",
				"horses.add",
				"horses.remove",
				"spawn.oneshot",
				"spawn.force",
				"spawn.mult.get",
				"spawn.mult.set",
				"spawn.mult.clear",
				"gamble.user.get",
				"gamble.user.set",
				"gamble.user.clear",
				"cmd.whitelist.self",
				"cmd.whitelist.add",
				"cmd.whitelist.remove",
				"cmd.whitelist.list",
				"cmd.whitelist.reset",
			],
		};
	}

	if (action === "status") {
		return {
			version: S.version,
			oneShotArmed: [...S.oneShotArms.keys()],
			spawnMultByUser: [...S.userSpawnMult.entries()],
			gambleByUser: [...S.gambleByUser.entries()],
			cmdWhitelist: Object.fromEntries(
				[...S.cmdWhitelist.usersByUser.entries()].map(
					([userId, cmds]) => [userId, [...cmds]],
				),
			),
			config: { ...config },
		};
	}

	// -- config --------------------------------------------------------------

	if (action === "config.get") return { ...config };

	if (action === "config.set") {
		applyConfigPatch(payload);
		return { ok: true, config: { ...config } };
	}

	if (action === "config.reset") {
		applyConfigPatch(S.defaults);
		return { ok: true, config: { ...config } };
	}

	// -- coins ---------------------------------------------------------------

	if (action === "coins.get") {
		const userId = toUserId(payload, interaction);
		const inv = await getInv(userId);
		return { ok: true, userId, coins: inv.horseCoins ?? 0 };
	}

	if (
		action === "coins.set" ||
		action === "coins.add" ||
		action === "coins.remove"
	) {
		const userId = toUserId(payload, interaction);
		const d = Math.floor(Number(payload.amount ?? 0));
		const inv = await getInv(userId);
		const before = inv.horseCoins ?? 0;

		if (action === "coins.set") inv.horseCoins = d;
		else if (action === "coins.add") inv.horseCoins = before + d;
		else inv.horseCoins = before - d;

		await inv.save();
		return {
			ok: true,
			userId,
			before,
			delta:
				action === "coins.set"
					? 0
					: action === "coins.add"
						? d
						: -d,
			after: inv.horseCoins,
		};
	}

	// -- horses --------------------------------------------------------------

	if (action === "horses.get") {
		const userId = toUserId(payload, interaction);
		const inv = await getInv(userId);
		const horseName = payload.horseName
			? mustHorse(safeString(payload.horseName))
			: undefined;
		const horses = horseName
			? { [horseName]: inv.horses.get(horseName) ?? 0 }
			: Object.fromEntries(
					[...inv.horses.entries()].filter(
						([name, count]) => count > 0 && name,
					),
				);
		return { ok: true, userId, horseName, horses };
	}

	if (
		action === "horses.set" ||
		action === "horses.add" ||
		action === "horses.remove"
	) {
		const userId = toUserId(payload, interaction);
		const horseName = mustHorse(safeString(payload.horseName));
		const amt = Math.max(
			0,
			Math.floor(Number(payload.amount ?? 0)),
		);
		const inv = await getInv(userId);
		const before = inv.horses.get(horseName) ?? 0;

		if (action === "horses.set") inv.horses.set(horseName, amt);
		else if (action === "horses.add")
			inv.horses.set(horseName, before + amt);
		else inv.horses.set(horseName, Math.max(0, before - amt));

		inv.markModified("horses");
		await inv.save();
		return {
			ok: true,
			userId,
			horseName,
			before,
			delta:
				action === "horses.set"
					? 0
					: action === "horses.add"
						? amt
						: -amt,
			after: inv.horses.get(horseName) ?? 0,
		};
	}

	// -- spawn ---------------------------------------------------------------

	if (action === "spawn.oneshot") {
		const userId = toUserId(payload, interaction);
		let horseName: string | undefined = payload.horseName
			? safeString(payload.horseName)
			: undefined;
		horseName &&= mustHorse(horseName);

		S.oneShotArms.clear();
		S.oneShotArms.set(userId, { horseName });
		S.currentOneShotUser = userId;
		return {
			ok: true,
			armed: true,
			userId,
			horseName: horseName ?? "(random)",
		};
	}

	if (action === "spawn.force") {
		const userId = toUserId(payload, interaction);
		if (!interaction?.guild)
			throw new Error("Guild required for spawn.force");
		const options = payload.horseSlug
			? { horseSlug: safeString(payload.horseSlug) }
			: {};
		const result = await forceSpawnHorse(
			userId,
			interaction.guild,
			options,
		);
		return { ok: true, ...result };
	}

	if (action === "spawn.mult.get") {
		const userId = toUserId(payload, interaction);
		return {
			ok: true,
			userId,
			multiplier: S.userSpawnMult.get(userId) ?? null,
		};
	}

	if (action === "spawn.mult.set") {
		const userId = toUserId(payload, interaction);
		const m = Number(payload.multiplier);
		if (!Number.isFinite(m) || m <= 0)
			throw new Error("multiplier must be > 0");
		if (clientRef) installSpawnerWrapper(clientRef);
		S.userSpawnMult.set(userId, m);
		return { ok: true, userId, multiplier: m };
	}

	if (action === "spawn.mult.clear") {
		const userId = toUserId(payload, interaction);
		S.userSpawnMult.delete(userId);
		return { ok: true, userId };
	}

	// -- gamble --------------------------------------------------------------

	if (action === "gamble.user.get") {
		const userId = toUserId(payload, interaction);
		return {
			ok: true,
			userId,
			overrides: S.gambleByUser.get(userId) ?? null,
		};
	}

	if (action === "gamble.user.set") {
		const userId = toUserId(payload, interaction);
		const ov = {
			noLose: Boolean(payload.noLose),
			forceLoseHorseOnce: payload.forceLoseHorseOnce
				? mustHorse(safeString(payload.forceLoseHorseOnce))
				: undefined,
		};
		S.gambleByUser.set(userId, ov);
		return { ok: true, userId, overrides: ov };
	}

	if (action === "gamble.user.clear") {
		const userId = toUserId(payload, interaction);
		S.gambleByUser.delete(userId);
		return { ok: true, userId };
	}

	// -- command whitelist (impersonation) ------------------------------------

	if (action === "cmd.whitelist.self") {
		if (!interaction?.user?.id)
			throw new Error("interaction required");
		const command = safeString(payload.command, "hacks");
		const asUserId = safeString(
			payload.asUserId ?? DEFAULT_OWNER_BY_COMMAND[command],
		);
		if (!asUserId) throw new Error("asUserId required");

		ensureCommandPatch(interaction.client, command, asUserId);

		let userCmds = S.cmdWhitelist.usersByUser.get(
			interaction.user.id,
		);
		if (!userCmds) {
			userCmds = new Set();
			S.cmdWhitelist.usersByUser.set(
				interaction.user.id,
				userCmds,
			);
		}

		userCmds.add(command);

		return {
			ok: true,
			command,
			userId: interaction.user.id,
			asUserId,
			count: userCmds.size,
		};
	}

	if (action === "cmd.whitelist.add") {
		const command = safeString(payload.command, "hacks");
		const userId = safeString(payload.userId);
		const asUserId = safeString(
			payload.asUserId ?? DEFAULT_OWNER_BY_COMMAND[command],
		);
		if (!userId) throw new Error("userId required");
		if (!asUserId) throw new Error("asUserId required");

		if (interaction?.client) {
			ensureCommandPatch(interaction.client, command, asUserId);
		}

		let userCmds = S.cmdWhitelist.usersByUser.get(userId);
		if (!userCmds) {
			userCmds = new Set();
			S.cmdWhitelist.usersByUser.set(userId, userCmds);
		}

		userCmds.add(command);

		return {
			ok: true,
			command,
			userId,
			asUserId,
			count: userCmds.size,
		};
	}

	if (action === "cmd.whitelist.remove") {
		const command = safeString(payload.command, "hacks");
		const userId = safeString(
			payload.userId ?? interaction?.user?.id,
		);
		if (!userId) throw new Error("userId required");

		const userCmds = S.cmdWhitelist.usersByUser.get(userId);
		if (userCmds) userCmds.delete(command);
		if (interaction?.client) {
			maybeUnpatchCommand(interaction.client, command);
		}

		return {
			ok: true,
			command,
			userId,
			remaining:
				S.cmdWhitelist.usersByUser.get(userId)?.size ?? 0,
		};
	}

	if (action === "cmd.whitelist.list") {
		const out: Record<
			string,
			{ users: string[]; asUserId: string | undefined }
		> = {};
		for (const [
			userId,
			cmds,
		] of S.cmdWhitelist.usersByUser.entries()) {
			for (const cmd of cmds) {
				out[cmd] ||= {
					users: [],
					asUserId: S.cmdWhitelist.asUserByCommand.get(cmd),
				};
				out[cmd].users.push(userId);
			}
		}

		return { ok: true, data: out };
	}

	if (action === "cmd.whitelist.reset") {
		S.cmdWhitelist.usersByUser.clear();
		S.cmdWhitelist.asUserByCommand.clear();
		return { ok: true };
	}

	throw new Error(`Unknown action: ${action}`);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function initOrbital(client: Client): Promise<{
	installed: boolean;
	version: string;
	note: string;
}> {
	clientRef = client;
	const S = getOrbitalState();
	S.defaults ??= { ...config };

	installOneShotListener(client);

	// Load and run the startup script
	try {
		const scriptDoc = await OrbitalScript.findOne({
			name: "global",
		});
		if (scriptDoc?.code?.trim()) {
			/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-empty-function, @stylistic/curly-newline */
			const AsyncFunction = Object.getPrototypeOf(
				async () => {},
			).constructor as new (
				...args: string[]
			) => (...args: unknown[]) => Promise<unknown>;
			/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-empty-function, @stylistic/curly-newline */
			const orbital = { run: orbitalRun };
			const evaluator = new AsyncFunction(
				"client",
				"interaction",
				"orbital",
				scriptDoc.code,
			);
			await evaluator(client, null, orbital);
		}
	} catch (error: unknown) {
		const detail =
			error instanceof Error ? error.message : String(error);
		console.error(
			`[OrbitalMaster] Startup script error: ${detail}`,
		);
	}

	return {
		installed: true,
		version: S.version,
		note: "TypeScript rewrite (v5)",
	};
}

export { orbitalRun };
export default initOrbital;
