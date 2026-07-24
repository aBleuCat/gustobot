import type { config } from "../config.js";

export type GambleOverride = {
	noLose: boolean;
	forceLoseHorseOnce: string | undefined;
};

export type OneShotArm = {
	horseName: string | undefined;
};

export type CmdIncludeState = {
	// UserId -> Set of commandNames they are whitelisted for
	usersByUser: Map<string, Set<string>>;
	// CommandName -> UserId they impersonate
	asUserByCommand: Map<string, string>;
};

export type OrbitalState = {
	version: string;
	defaults: typeof config | undefined;

	oneShotArms: Map<string, OneShotArm>; // UserId -> arm
	currentOneShotUser: string | undefined;
	userSpawnMult: Map<string, number>; // UserId -> multiplier
	gambleByUser: Map<string, GambleOverride>; // UserId -> override

	listenerInstalled: boolean;
	cmdWhitelist: CmdIncludeState;
};

let state: OrbitalState | undefined;

export function getOrbitalState(): OrbitalState {
	state ??= {
		version: "orbital-v5-ts",
		defaults: undefined,
		oneShotArms: new Map(),
		currentOneShotUser: undefined,
		userSpawnMult: new Map(),
		gambleByUser: new Map(),
		listenerInstalled: false,
		cmdWhitelist: {
			usersByUser: new Map(),
			asUserByCommand: new Map(),
		},
	};
	return state;
}
