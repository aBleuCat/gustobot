import path from "node:path";
import type { Pool, PoolQuestion } from "../types.js";

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

const DIR_REGEX = /^dir:\/([\w\-.\/%~]+)\/$/iv;

async function sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

/** Formats a duration in milliseconds as something like "1m 05s" or "12s" */
function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes === 0) return `${seconds}s`;
	return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

class QuizPoolImageLoader {
	/** Flips to true once all image directories have been resolved */
	done = false;

	private get requestsPerSecond() {
		return 10;
	}

	private total = 0;
	private fetched = 0;
	private startTime = 0;

	async initPools(): Promise<void> {
		const questions = Object.values(pools)
			.flatMap((p) => p.pool)
			.filter(
				(question) =>
					typeof question.image === "string" &&
					DIR_REGEX.test(question.image),
			);

		this.total = questions.length;
		this.fetched = 0;

		if (this.total === 0) {
			this.done = true;
			return;
		}

		const pingMs = await this.pingGithub();

		const estimatedMs =
			Math.ceil(this.total / this.requestsPerSecond) * 1000;

		console.log(
			`Found ${this.total} questions whose images are prefixed with "dir:". ` +
				`Estimated time: ${formatDuration(estimatedMs)}. ` +
				`Pinged github and recieved response in ${pingMs} ms`,
		);

		this.startTime = performance.now();

		for (let i = 0; i < this.total; i += this.requestsPerSecond) {
			const batch = questions.slice(
				i,
				i + this.requestsPerSecond,
			);
			// eslint-disable-next-line no-await-in-loop
			await this.processBatch(batch);
		}

		this.done = true;
	}

	private async processBatch(batch: PoolQuestion[]): Promise<void> {
		const batchStart = performance.now();

		await Promise.all(
			batch.map(async (question) =>
				this.processQuestion(question),
			),
		);

		// Only throttle if there's another batch left to send
		const isLastBatch = this.fetched >= this.total;
		if (!isLastBatch) {
			const batchElapsed = performance.now() - batchStart;
			const remainingInSecond = 1000 - batchElapsed;
			if (remainingInSecond > 0) await sleep(remainingInSecond);
		}
	}

	private async processQuestion(
		question: PoolQuestion,
	): Promise<void> {
		await this.fetchImagesForQuestion(question);

		this.fetched++;
		const elapsed = performance.now() - this.startTime;
		const avgPerItem = elapsed / this.fetched;
		const remainingMs = avgPerItem * (this.total - this.fetched);

		console.log(
			`Fetched ${this.fetched} of ${this.total} images. ` +
				`Estimated remaining time: ${formatDuration(remainingMs)}`,
		);
	}

	private async pingGithub(): Promise<number> {
		const start = performance.now();
		const response = await fetch(
			`https://api.github.com/repos/${REPO}`,
			{ headers },
		);
		const elapsed = performance.now() - start;

		if (!response.ok)
			throw new Error(
				`Github ping failed, github responded with ${response.status}`,
			);

		return Math.round(elapsed);
	}

	private async fetchImagesForQuestion(
		question: PoolQuestion,
	): Promise<void> {
		if (typeof question.image !== "string") return;

		const dirMatch = DIR_REGEX.exec(question.image);
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
			const extension = path.extname(item.name).toLowerCase();

			if (
				item.type === "file" &&
				IMAGE_EXTENSIONS.has(extension)
			)
				links.push(item.download_url);
		}

		question.image = links;
	}
}

export const quizPoolImageLoader = new QuizPoolImageLoader();

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
