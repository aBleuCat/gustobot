import type { ITimeframeStats } from "../lib/models.js";

type Quest = {
	name: string;
	description: string;
	isCompleted: (stats: ITimeframeStats) => boolean;
	completion: (stats: ITimeframeStats) => number;
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
	begOnce: {
		name: "Beg",
		description: "Use your daily beg using `/horses beg`",
		isCompleted: ({ begs }) => begs.begs >= 1,
		completion: ({ begs }) => Math.min(1, begs.begs / 1),
		reward: { horse: "peasantry_beggary" },
		difficulty: "easy",
		category: "begs",
	},
};
const weeklyQuests: Record<string, Quest> = {
	begSixTimes: {
		name: "Beg Sextice",
		description:
			"Beg at least six times this week using `/horses beg`",
		isCompleted: ({ begs }) => begs.begs >= 6,
		completion: ({ begs }) => Math.min(1, begs.begs / 6),
		reward: { horse: "labor_wage" },
		difficulty: "medium",
		category: "begs",
	},
};

const quests = { daily: dailyQuests, weekly: weeklyQuests };
export default quests;
