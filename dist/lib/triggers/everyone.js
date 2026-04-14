export async function handleEveryone(msg) {
    if (!msg.content.includes('@everyone'))
        return;
    if (!('send' in msg.channel))
        return;
    await msg
        .channel.send('https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif')
        .catch(() => { });
}
//# sourceMappingURL=everyone.js.map