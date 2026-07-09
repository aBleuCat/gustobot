import { pathToFileURL } from "node:url";
import path from "node:path";

const mods = [
	"./src/commands/horse-main.ts",
	"./src/commands/horse-coin-main.ts",
	"./src/commands/trade-main.ts",
];

for (const mod of mods) {
	const abs = path.resolve(mod);
	const url = pathToFileURL(abs).href;
	console.log("importing", mod);
	try {
		await import(url);
		console.log("loaded", mod);
	} catch (error) {
		console.error("failed", mod, error);
	}
}
