import "dotenv/config";
import mongoose from "mongoose";
import rawHorseValues from "../src/data/horses.json" with { type: "json" };
import { castAsHorseData } from "../src/type-utils.js";
import { UserHorses } from "../src/lib/models.js";

const HORSE_VALUES = castAsHorseData(rawHorseValues);
const isDev = process.argv.includes("--dev");
const mongoUri = isDev
	? process.env.BETA_MONGO_URI
	: process.env.MONGO_URI;

if (!mongoUri) {
	throw new Error(
		`${isDev ? "BETA_MONGO_URI" : "MONGO_URI"} not found in .env`,
	);
}

try {
	await mongoose.connect(mongoUri);
	const users = await UserHorses.find(
		{ optIn: true },
		{ userId: 1, horses: 1 },
	);

	const wealthByUser = users
		.map((user) => {
			let horseWealth = 0;
			for (const [slug, count] of user.horses ?? new Map()) {
				if (count <= 0) continue;
				horseWealth +=
					(HORSE_VALUES[slug]?.value ?? 0) * count;
			}

			return { userId: user.userId, horseWealth };
		})
		.toSorted(
			(a, b) =>
				b.horseWealth - a.horseWealth ||
				a.userId.localeCompare(b.userId),
		);

	console.log(wealthByUser.map(({ horseWealth }) => horseWealth).join("\n"));
} finally {
	await mongoose.disconnect();
}