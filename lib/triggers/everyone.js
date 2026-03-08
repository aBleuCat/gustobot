async function handleEveryone(msg) {
    if (!msg.content.includes("@everyone")) return;
    await msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif").catch(() => {});
}

module.exports = { handleEveryone };
