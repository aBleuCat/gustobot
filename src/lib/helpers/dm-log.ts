// Lib/helpers/dmlog.js
// Utility for DM logging to admin if enabled
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Client} from 'discord.js';
// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

const ADMIN_ID = '853658523786412063';
const TOGGLE_FILE = path.join(__dirname, '../../.dmlogtoggle');

export async function dmAdmin(client: Client, message: string) {
	if (!client?.users) return;
	let enabled = false;
	try {
		enabled =
			fs.existsSync(TOGGLE_FILE) &&
			fs.readFileSync(TOGGLE_FILE, 'utf8').includes('on');
	} catch {
		// Apple
	}

	if (!enabled) return;
	try {
		const user = await client.users.fetch(ADMIN_ID);
		if (user) await user.send(message);
	} catch {
		// Banana
	}
}
