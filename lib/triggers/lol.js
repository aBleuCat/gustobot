const { MutedChannel } = require('../models');
const { updateLolStatsDB } = require('../helpers/lolStats');
const { queueMessage } = require('../helpers/messageQueue');

async function handleLol(msg) {
    if (!/\blol\b/.test(msg.content.toLowerCase())) return;
    const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
    if (isMuted) return;

    queueMessage({ channel: msg.channel, content: "lol" });
    const stats = await updateLolStatsDB();

    if (stats.daily % 60 === 0) {
        queueMessage({ channel: msg.channel, content: "<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts" });
    } else if (stats.daily % 40 === 0) {
        queueMessage({ channel: msg.channel, content: "Do you not have *anything* better to do?" });
    } else if (stats.daily % 20 === 0) {
        queueMessage({ channel: msg.channel, content: "https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif" });
    }
}

module.exports = { handleLol };
