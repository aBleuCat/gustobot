import path from "node:path";
import type { Pool } from "../types.js";

type GithubFile = {
	type: string;
	name: string;
	download_url: string;
};

function isGithubFile(item: unknown): item is GithubFile {
	return (
		typeof item === "object" &&
		item !== null &&
		"type" in item &&
		typeof item.type === "string" &&
		"name" in item &&
		typeof item.name === "string" &&
		"download_url" in item &&
		typeof item.download_url === "string"
	);
}

const IMAGE_EXTENSIONS = new Set([
	".jpg",
	".jpeg",
	".png",
	".gif",
	".svg",
	".webp",
]);
const REPO = "someguy/something";
const headers = {
	"User-Agent": "node-image-fetch-script",
	Authorization: "Bearer FINE GRAINED TOKEN GOES HERE",
};

export async function initPools() {
	await Promise.all(
		Object.values(pools)
			.flatMap((p) => p.pool)
			.map(async (question) => {
				if (typeof question.image !== "string") return;
				const dirMatch = /^dir:\/([\w\-.\/%~]+)\/$/iv.exec(
					question.image,
				);
				if (!dirMatch) return;
				const folderPath = dirMatch[1];
				const apiUrl = `https://api.github.com/repos/${REPO}/contents/${folderPath}`;

				const response = await fetch(apiUrl, { headers });

				if (!response.ok)
					throw new Error(
						`Github thing failed, github responded with ${response.status}`,
					);

				const contents: unknown = await response.json();

				if (!Array.isArray(contents))
					throw new Error("Expected array from Github API");

				const links: string[] = [];

				for (const item of contents) {
					if (!isGithubFile(item)) return;
					const extension = path
						.extname(item.name)
						.toLowerCase();

					if (
						item.type === "file" &&
						IMAGE_EXTENSIONS.has(extension)
					)
						links.push(item.download_url);
				}

				question.image = links;
			}),
	);
}

const pools: Record<string, Pool> = {
	/** **Placeholder** - The pool "mathTest" is a placeholder for testing */
	mathTest: {
		pool: [
			{
				question: "0+0=",
				answer: /^0$/v,
				answerTxt: "0",
			},
			{
				question: "2+2=",
				answer: /^4$/v,
				answerTxt: "4",
			},
			{
				question: "8+8=",
				answer: /^16$/v,
				answerTxt: "16",
			},
			{
				question: "10,000+10,000=",
				answer: /^20000$/v,
				answerTxt: "20,000",
			},
			{
				question: "1,000,000*10=",
				answer: /^(10000000|ten-? ?million)$/iv,
				answerTxt: "10,000,000",
			},
			{
				question: "900000000000000*900000000000000",
				answer: /^(810(000){9}|eight-? ?hundred-? ?ten-? ?octillion)$/iv,
				answerTxt: "eight hundred ten octillion", // As per request from my younger brother
			},
			{
				question: "8.1*10.1=",
				answer: /^81\.81$/v,
				answerTxt: "81.81",
			},
		],
		metadata: {
			normalizer: (string) => string.replaceAll(",", ""),
		},
	},
	/** **Placeholder** - The pool "test" is a placeholder for testing */
	test: {
		pool: [
			{
				question: "respond with test",
				answer: /test/iv,
				answerTxt: "test",
				image: ["apple", "apple2"],
			},
			{
				question: "respond with trial",
				answer: /trial/iv,
				answerTxt: "trial",
				image: ["banana", "banana2"],
			},
		],
		metadata: {
			normalizer: (string) =>
				string.replaceAll("the", "").trim(),
		},
	},
};

export default pools;
