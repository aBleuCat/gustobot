import { execSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";

execSync("swc src -d dist --strip-leading-paths", {
	stdio: "inherit",
});

mkdirSync("dist/data", { recursive: true });
copyFileSync("src/data/horses.json", "dist/data/horses.json");
