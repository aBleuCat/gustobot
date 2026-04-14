import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ID = '853658523786412063';
const TOGGLE_FILE = path.join(__dirname, '../../.dmlogtoggle');
export async function dmAdmin(client, message) {
    if (!client || !client.users)
        return;
    let enabled = false;
    try {
        enabled = fs.existsSync(TOGGLE_FILE) && fs.readFileSync(TOGGLE_FILE, 'utf8').includes('on');
    }
    catch { }
    if (!enabled)
        return;
    try {
        const user = await client.users.fetch(ADMIN_ID);
        if (user)
            await user.send(message);
    }
    catch { }
}
//# sourceMappingURL=dmlog.js.map