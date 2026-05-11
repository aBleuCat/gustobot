const { MutedChannel } = require('../models');
const { updateLolStatsDB } = require('../helpers/lolStats');
const { queueMessage } = require('../helpers/messageQueue');

const TRIGGERS = {
    "\\blol\\b": "lol",
    "\\bis gustobot alive\\b": "yeah",
	"\\bspawn ball": "you should ping everyone to spawn the ball",
};

// Map for milestone-based responses
const MILESTONES = {
    60: "<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts",
    50: "https://cdn.discordapp.com/attachments/1477788764045705419/1495256837681840279/togif.gif",
    40: "Do you not have *anything* better to do?",
    20: "https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif"
};

async function handleLol(msg) {
    const content = msg.content.toLowerCase();
    
    // Find if any key in TRIGGERS matches the message content
    const match = Object.keys(TRIGGERS).find(pattern => new RegExp(pattern).test(content));
    
    if (!match) return;

    const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
    if (isMuted) return;

    // Send the response defined in the TRIGGERS object
    queueMessage({ channel: msg.channel, content: TRIGGERS[match] });
    const stats = await updateLolStatsDB();
    
    // Check milestones (ordered descending to hit the highest modulo first)
    for (const count of [60, 40, 20]) {
        if (stats.daily % count === 0) {
            queueMessage({ channel: msg.channel, content: MILESTONES[count] });
            break; // Prevents multiple milestones triggering at once
        }
    }
}

module.exports = { handleLol };