import { MutedChannel } from '../models.js';
const RESPONSES = [
    'grown man btw',
    'top 2% of students btw',
    'ok pack it up time to do your learning log',
    'stuybau',
    'ts not funny',
    'in the big 25 wait no thats not right year',
];
export async function handleSixSeven(msg) {
    if (!/\b67\b|six seven|six-seven/.test(msg.content.toLowerCase()))
        return;
    const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
    if (isMuted)
        return;
    await msg.reply(RESPONSES[Math.floor(Math.random() * RESPONSES.length)]).catch(() => { });
}
//# sourceMappingURL=sixSeven.js.map