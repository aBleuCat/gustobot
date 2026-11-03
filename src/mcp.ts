// MCP server embedded in the bot process: code execution + project docs.
// Exposed at /mcp (Streamable HTTP, stateless) by the http server in index.ts.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "discord.js";
import mongoose from "mongoose";
import { z } from "zod";
import * as models from "./lib/models.js";
import { config, immutConfig } from "./lib/config.js";
import queueMessage from "./lib/helpers/message-queue.js";
import devLog from "./lib/helpers/dev-log.js";

const packageJson = JSON.parse(
	fs.readFileSync(
		path.join(import.meta.dirname, "..", "package.json"),
		"utf8",
	),
) as { version?: string };

const version = packageJson.version ?? "0.0.0";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const BEARER_PREFIX = "Bearer ";

type AccessResult = "disabled" | "ok" | "unauthorized";

// Constant-time token comparison via sha256 digests (equal length by construction)
function authorize(request: IncomingMessage): AccessResult {
	const token = process.env.MCP_AUTH_TOKEN;
	if (!token) return "disabled";

	const header = request.headers.authorization;
	if (!header?.startsWith(BEARER_PREFIX)) return "unauthorized";

	const provided = crypto
		.createHash("sha256")
		.update(header.slice(BEARER_PREFIX.length))
		.digest();
	const expected = crypto.createHash("sha256").update(token).digest();
	return crypto.timingSafeEqual(provided, expected) ? "ok" : "unauthorized";
}

// JSON.stringify with Map/Set/Error/BigInt/circular handling
function serialize(value: unknown): string {
	// eslint-disable-next-line @typescript-eslint/no-restricted-types -- WeakSet's type parameter must be an object type
	const seen = new WeakSet<object>();
	const json = JSON.stringify(value, (_key, entry: unknown) => {
		if (typeof entry === "bigint") return entry.toString();
		if (entry instanceof Error)
			{return { name: entry.name, message: entry.message, stack: entry.stack };}

		if (entry instanceof Map)
			{return Object.fromEntries(entry) as Record<string, unknown>;}

		if (entry instanceof Set) return [...entry] as unknown[];
		if (typeof entry === "object" && entry !== null) {
			if (seen.has(entry)) return "[Circular]";
			seen.add(entry);
		}

		return entry;
	}, 2);
	return json ?? String(value);
}

type AsyncFunctionClass = new (
	...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

const ASYNC_FUNCTION_CLASS: AsyncFunctionClass = (
	Object.getPrototypeOf(async () => 0) as { constructor: AsyncFunctionClass }
).constructor;

async function executeCode(
	code: string,
	timeoutMs: number,
	client: Client,
): Promise<CallToolResult> {
	let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
	try {
		const runFunction = new ASYNC_FUNCTION_CLASS(
			"models",
			"mongoose",
			"client",
			"config",
			"immutConfig",
			"queueMessage",
			"devLog",
			"fetch",
			code,
		);
		const outcome = await Promise.race([
			runFunction(
				models,
				mongoose,
				client,
				config,
				immutConfig,
				queueMessage,
				devLog,
				fetch,
			),
			new Promise<never>((_resolve, reject) => {
				timeoutTimer = setTimeout(() => {
					reject(
						new Error(
							`Code execution timed out after ${timeoutMs} ms`,
						),
					);
				}, timeoutMs);
			}),
		]);
		return { content: [{ type: "text", text: serialize(outcome) }] };
	} catch (error: unknown) {
		return {
			content: [{ type: "text", text: serialize(error) }],
			isError: true,
		};
	} finally {
		if (timeoutTimer) clearTimeout(timeoutTimer);
	}
}

const ENV_VARS: ReadonlyArray<readonly [string, string]> = [
	["PORT", "HTTP port for the health endpoint and MCP (default 8000)"],
	[
		"MCP_AUTH_TOKEN",
		"Bearer token for /mcp; when unset the MCP endpoint returns 404",
	],
	["TOKEN", "Production bot token"],
	["CLIENT_ID", "Production Discord application/client id"],
	["GUILD_ID", "Production guild id (command registration)"],
	["MONGO_URI", "Production MongoDB connection string"],
	["BETA_TOKEN", "Dev-mode bot token (pnpm dev)"],
	["BETA_CLIENT_ID", "Dev-mode client id"],
	["BETA_GUILD_ID", "Dev-mode guild id"],
	["BETA_MONGO_URI", "Dev-mode MongoDB connection string"],
];

function listSourceTree(dir: string, depth: number): string {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	entries.sort((left, right) => left.name.localeCompare(right.name));
	const lines: string[] = [];
	for (const entry of entries) {
		lines.push(
			`${"  ".repeat(depth)}${entry.isDirectory() ? `${entry.name}/` : entry.name}`,
		);
		if (entry.isDirectory())
			{lines.push(listSourceTree(path.join(dir, entry.name), depth + 1));}
	}

	return lines.join("\n");
}

type RegisteredModel = (typeof models)[keyof typeof models];

function listModelFields(model: RegisteredModel): string[] {
	const fields: string[] = [];
	for (const [field, schemaType] of Object.entries(model.schema.paths)) {
		if (field === "__v") continue;
		const instance =
			(schemaType as { instance?: string }).instance ?? "Mixed";
		fields.push(`- \`${field}\`: ${instance}`);
	}

	return fields;
}

function listModels(): string {
	const sections: string[] = [];
	for (const [name, model] of Object.entries(models)) {
		sections.push(
			`### ${name}\n\n- collection: \`${model.collection.name}\`\n${listModelFields(model).join("\n")}\n`,
		);
	}

	return sections.join("\n");
}

function buildProjectDocs(): string {
	const envRows = ENV_VARS.map(
		([name, purpose]) =>
			`| ${name} | ${purpose} | ${process.env[name] === undefined ? "not set" : "set"} |`,
	);
	return [
		"# gustobot — project documentation",
		"",
		"Discord bot (moderation, advice, gambling/horses, utility) built with",
		"discord.js v14, MongoDB via mongoose, TypeScript (ESM) on Node.js,",
		"managed with pnpm. Entry point: `src/index.ts`.",
		"",
		"## Source tree",
		"",
		"```",
		listSourceTree(import.meta.dirname, 0),
		"```",
		"",
		"## Environment variables",
		"",
		"| Variable | Purpose | Status |",
		"| --- | --- | --- |",
		...envRows,
		"",
		"Values are never shown here. Dev mode (`pnpm dev`, argv `dev`) uses the",
		"`BETA_*` set; production uses the plain set. Auth for this MCP endpoint is",
		"the `MCP_AUTH_TOKEN` bearer token.",
		"",
		"## Mongoose models (`src/lib/models.ts`)",
		"",
		"The bot connects to MongoDB at startup, so queries run live against the",
		"same connection the bot uses.",
		"",
		listModels(),
		"## `run_code` bindings",
		"",
		"| Name | Description |",
		"| --- | --- |",
		"| `models` | Namespace of all mongoose models, e.g. `await models.UserHorses.findOne({ userId: \"123\" })` |",
		"| `mongoose` | The connected mongoose instance |",
		"| `client` | The live discord.js `Client` (`client.channels.cache`, `client.guilds.cache`, ...) |",
		"| `config` | Mutable runtime config from `src/lib/config.ts` (spawn rates, thresholds, rate limits, lists) |",
		"| `immutConfig` | Constants (`SECOND_MS`…`DAY_MS`, `DISCORD_MSG_CHAR_LIMIT`, `ADMINS` Set) |",
		"| `queueMessage` | Rate-limited send: `queueMessage({ channel, content, embeds?, reply?, priority?, allowedMentions? })` |",
		"| `devLog` | `await devLog(message, type?)` — writes to the dev log channel |",
		"| `fetch` | Global `fetch` for outbound HTTP requests |",
		"",
		"## `run_code` behavior",
		"",
		"- Runs as an async function body; `await` is allowed, `return` gives the result.",
		"- The result is JSON-serialized (Maps/Sets/Errors are converted, circular references are marked).",
		`- Default timeout ${DEFAULT_TIMEOUT_MS} ms (max ${MAX_TIMEOUT_MS} ms); timeouts and thrown errors come back as tool errors.`,
	].join("\n");
}

function createMcpServer(client: Client): McpServer {
	const server = new McpServer({ name: "gustobot", version });
	server.registerTool(
		"run_code",
		{
			title: "Run JavaScript in the bot process",
			description:
				"Execute JavaScript inside the running bot process with live access to the database and Discord client. "
				+ "The code runs as an async function body; use `return` for the result, which is JSON-serialized. "
				+ "Bindings: `models` (mongoose models namespace), `mongoose`, `client` (discord.js Client), "
				+ "`config`, `immutConfig`, `queueMessage`, `devLog`, `fetch`. "
				+ "Call `project_docs` first for model schemas and project structure. "
				+ "Errors and timeouts are returned as tool errors.",
			inputSchema: {
				code: z
					.string()
					.describe(
						"JavaScript source to execute. May use `await`; the value returned by `return` is the tool result.",
					),
				timeoutMs: z
					.number()
					.int()
					.min(1000)
					.max(MAX_TIMEOUT_MS)
					.optional()
					.describe(
						`Execution timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS})`,
					),
			},
		},
		async ({ code, timeoutMs }) =>
			executeCode(code, timeoutMs ?? DEFAULT_TIMEOUT_MS, client),
	);
	server.registerTool(
		"project_docs",
		{
			title: "Project documentation",
			description:
				"Return documentation for this project: source tree, environment variables (names/status only), "
				+ "mongoose model schemas with field types, and the bindings available to `run_code`.",
		},
		async () => ({ content: [{ type: "text", text: buildProjectDocs() }] }),
	);
	return server;
}

function jsonRpcError(code: number, message: string): string {
	return JSON.stringify({
		jsonrpc: "2.0",
		error: { code, message },
		id: null,
	});
}

export async function handleMcpRequest(
	request: IncomingMessage,
	result: ServerResponse,
	client: Client,
): Promise<void> {
	const access = authorize(request);
	if (access === "disabled") {
		result.writeHead(404, { "Content-Type": "text/plain" });
		result.end("Not found");
		return;
	}

	if (access === "unauthorized") {
		result.writeHead(401, {
			"Content-Type": "application/json",
			"WWW-Authenticate": 'Bearer realm="mcp"',
		});
		result.end(jsonRpcError(-32_001, "Unauthorized"));
		return;
	}

	// Stateless mode: no GET SSE stream, no session to DELETE
	if (request.method !== "POST") {
		result.writeHead(405, {
			Allow: "POST",
			"Content-Type": "application/json",
		});
		result.end(
			jsonRpcError(-32_000, "Method not allowed (stateless MCP: use POST)"),
		);
		return;
	}

	const mcpServer = createMcpServer(client);
	// The sessionIdGenerator option is omitted (undefined) for stateless mode
	const transport = new StreamableHTTPServerTransport({
		enableJsonResponse: true,
	});
	result.on("close", () => {
		void transport.close();
		void mcpServer.close();
	});
	await mcpServer.connect(transport);
	await transport.handleRequest(request, result);
}
