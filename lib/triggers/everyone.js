const { queueMessage } = require('../helpers/messageQueue');

async function handleEveryone(msg) {
    if (!msg.content.includes("@everyone")) return;
    queueMessage({ channel: msg.channel, content: "https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif" });
}

module.exports = { handleEveryone };
