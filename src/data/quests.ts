import type { ITimeframeStats } from "../lib/models.js";

type Quest = {
	name: string;
	description: string;
	isCompleted: (stats: ITimeframeStats) => boolean;
	getCompletion: (stats: ITimeframeStats) => number;
	reward: {
		coins?: number;
		horse?: string;
	};
	difficulty: "easy" | "medium" | "hard";
	category:
		| "gambling"
		| "spawns"
		| "begs"
		| "donations"
		| "races"
		| "leaderboard"
		| "trade";
	guaranteed?: boolean;
};

const dailyQuests: Record<string, Quest> = {
	gambleFiveTimes: {
		name: "Gamble Quintice",
		description:
			"Use `/horses gamble` to gamble five times. Doesn't matter if you win or lose.",
		isCompleted: ({ gambling }) => gambling.totalGambles >= 5,
		getCompletion: ({ gambling }) =>
			Math.min(gambling.totalGambles, 5) / 5,
		reward: { coins: 5 },
		difficulty: "easy",
		category: "gambling",
	},
	winGamblingThreeTimes: {
		name: "Get Three Gambling Wins",
		description: "Use `/horses gamble` and win three times.",
		isCompleted: ({ gambling }) => gambling.wins >= 3,
		getCompletion: ({ gambling }) =>
			Math.min(1, gambling.wins / 3),
		reward: { horse: "common_horse", coins: 5 },
		difficulty: "medium",
		category: "gambling",
	},
	winGamblingTenTimes: {
		name: "Get Ten Gambling Wins",
		description:
			"Use `/horses gamble` and win ten times. Trust me. Gambling will change your life.",
		isCompleted: ({ gambling }) => gambling.wins >= 10,
		getCompletion: ({ gambling }) =>
			Math.min(1, gambling.wins / 10),
		reward: { horse: "stupidity_ignorance", coins: 8 },
		difficulty: "medium",
		category: "gambling",
	},
	raceOnce: {
		name: "Race Against Someone",
		description:
			"Use `/race start` to challenge someone to a race. Both of you must have a trained horse to race. Train horses with `/horses train`",
		isCompleted: ({ races }) =>
			races.racesLost + races.racesWon >= 1,
		getCompletion: ({ races }) =>
			Math.min(1, races.racesLost + races.racesWon),
		reward: { coins: 5 },
		difficulty: "easy",
		category: "races",
	},
	winRaceOnce: {
		name: "Win a Race",
		description:
			"Use `/race start` to challenge someone to a race. Both of you must have a trained horse to race. Train horses with `/horses train`",
		isCompleted: ({ races }) => races.racesWon >= 1,
		getCompletion: ({ races }) => Math.min(1, races.racesWon),
		reward: { horse: "logic_reason" },
		difficulty: "medium",
		category: "races",
	},
	begOnce: {
		name: "Beg",
		description: "Use your daily beg using `/horses beg`.",
		isCompleted: ({ begs }) => begs.begs >= 1,
		getCompletion: ({ begs }) => Math.min(1, begs.begs / 1),
		reward: { horse: "peasantry_beggary" },
		difficulty: "easy",
		category: "begs",
	},
};
const weeklyQuests: Record<string, Quest> = {
	begSixTimes: {
		name: "Beg Sextice",
		description:
			"Beg at least six times this week using `/horses beg`.",
		isCompleted: ({ begs }) => begs.begs >= 6,
		getCompletion: ({ begs }) => Math.min(1, begs.begs / 6),
		reward: { horse: "labor_wage" },
		difficulty: "medium",
		category: "begs",
	},
};

const quests = { daily: dailyQuests, weekly: weeklyQuests };
export default quests;
