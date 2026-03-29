// lib/helpers/dmlog.js
// Utility for DM logging to admin if enabled
const fs = require('fs');
const path = require('path');
const ADMIN_ID = '853658523786412063';
const TOGGLE_FILE = path.join(__dirname, '../../.dmlogtoggle');

async function dmAdmin(client, message) {
    if (!client || !client.users) return;
    let enabled = false;
    try {
        enabled = fs.existsSync(TOGGLE_FILE) && fs.readFileSync(TOGGLE_FILE, 'utf8').includes('on');
    } catch {}
    if (!enabled) return;
    try {
        const user = await client.users.fetch(ADMIN_ID);
        if (user) await user.send(message);
    } catch {}
}

module.exports = { dmAdmin };
