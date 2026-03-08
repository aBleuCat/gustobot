const { Events } = require('discord.js');
const { Rule, MutedChannel, HorseConfig, UserHorses, MessageCache, Timeout } = require('../models');
const { updateLolStatsDB } = require('../helpers/lolStats');
const { stringSimilarity } = require('../helpers/similarity');
const { handleBotPing } = require('../helpers/pingHandler');
const { logToModChannel } = require('../helpers/modLog');
const HORSE_VALUES = require('../../horses.json');

function registerMessageHandler(client) {
    client.on(Events.MessageCreate, async msg => {
        if (!msg.guild) return;
        if (msg.author.bot && msg.author.id !== '1428178018802733076') return;

        const content = msg.content.toLowerCase();

        // ── Chat triggers ──────────────────────────────────────────────
        try {
            if (Math.floor(Math.random() * 1000) + 1 === 64) {
                await msg.channel.send("https://tenor.com/view/post-this-cat-ryujinr-grey-cat-gif-13471549557469691566").catch(() => {});
            }

            if (/\b67\b|six seven|six-seven/.test(content)) {
                const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
                if (!isMuted) {
                    const responses = [
                        "grown man btw",
                        "top 2% of students btw",
                        "ok pack it up time to do your learning log",
                        "stuybau",
                        "ts not funny",
                        "in the big 25 wait no thats not right year"
                    ];
                    await msg.reply(responses[Math.floor(Math.random() * responses.length)]).catch(() => {});
                }
            }

            if (/\blol\b/.test(content)) {
                const isMuted = await MutedChannel.findOne({ channelId: msg.channel.id });
                if (!isMuted) {
                    await msg.channel.send("lol").catch(() => {});
                    const stats = await updateLolStatsDB();
                    if (stats.daily % 60 === 0) {
                        await msg.channel.send("<:PensiveKMS:1474277252546957400>\nPeople are starving in Africa because of ts").catch(() => {});
                    } else if (stats.daily % 40 === 0) {
                        await msg.channel.send("Do you not have *anything* better to do?").catch(() => {});
                    } else if (stats.daily % 20 === 0) {
                        await msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif").catch(() => {});
                    }
                }
            }

            if (msg.content.includes("@everyone")) {
                await msg.channel.send("https://cdn.discordapp.com/attachments/1432537640074219640/1446352311319396484/togif.gif").catch(() => {});
            }
        } catch (e) {
            console.error("Trigger Error:", e.message);
        }

        // ── Autorole logic ─────────────────────────────────────────────
        const matchingRules = await Rule.find({ watchUser: msg.author.id, channel: msg.channel.id });
        for (const rule of matchingRules) {
            const msgJson = JSON.stringify(msg).toLowerCase();
            const targetId = rule.targetUser.toLowerCase();

            if (msgJson.includes(targetId)) {
                try {
                    const member = await msg.guild.members.fetch(rule.targetUser).catch(() => null);
                    if (member && !member.roles.cache.has(rule.addRole)) {
                        await member.roles.add(rule.addRole);
                        await member.roles.remove(rule.restoreRole).catch(() => {});

                        await new Timeout({
                            targetUser: rule.targetUser,
                            addRole: rule.addRole,
                            restoreRole: rule.restoreRole,
                            revertAt: Date.now() + rule.durationMs
                        }).save();

                        await logToModChannel(msg.guild, `triggered role swap for ${member.user.tag}`);
                    }
                } catch (e) {
                    console.error("Autorole Error:", e.message);
                }
            }
        }

        // ── Horse spawning ─────────────────────────────────────────────
        const hConfig = await HorseConfig.findOne({ guildId: msg.guild.id });
        if (hConfig && hConfig.enabled) {
            try {
                const DEBOUNCE_MS = 2 * 1000;
                const SIMILARITY_THRESHOLD = 0.70;
                const RECENT_MSG_COUNT = 5;

                const now = Date.now();
                const msgText = msg.content.trim().toLowerCase();

                let cache = await MessageCache.findOne({ userId: msg.author.id, guildId: msg.guild.id });
                if (!cache) cache = new MessageCache({ userId: msg.author.id, guildId: msg.guild.id });

                if (now - cache.lastMessageTime < DEBOUNCE_MS) {
                    console.log(`[HORSE] Debounced ${msg.author.tag}`);
                    return;
                }

                const tooSimilar = cache.recentMessages.some(prev => stringSimilarity(prev, msgText) >= SIMILARITY_THRESHOLD);
                if (tooSimilar) {
                    console.log(`[HORSE] Too similar for ${msg.author.tag}`);
                    return;
                }

                await MessageCache.findOneAndUpdate(
                    { userId: msg.author.id, guildId: msg.guild.id },
                    { lastMessageTime: now, recentMessages: [msgText, ...(cache.recentMessages || [])].slice(0, RECENT_MSG_COUNT) },
                    { upsert: true }
                );

                const targetChan = await msg.guild.channels.fetch(hConfig.channelId).catch(() => msg.channel);
                const horseEntries = Object.entries(HORSE_VALUES);
                const maxVal = Math.max(...horseEntries.map(([_, data]) => data.value));
                const rollRange = maxVal * 10;
                const rand = Math.floor(Math.random() * rollRange);

                // 1 in 200 chance for 3 horse coins from chatting
                if (Math.floor(Math.random() * 200) === 0) {
                    let inventory = await UserHorses.findOne({ userId: msg.author.id });
                    if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });
                    inventory.horseCoins = (inventory.horseCoins || 0) + 3;
                    await inventory.save();
                    await targetChan.send(`<@${msg.author.id}> acquired **3 Horse Coins** 🪙!`);
                }

                console.log(`[HORSE] Roll for ${msg.author.tag}: ${rand}/${rollRange}`);

                let inventory = await UserHorses.findOne({ userId: msg.author.id });
                if (!inventory) inventory = new UserHorses({ userId: msg.author.id, horses: new Map() });

                const sortedHorses = horseEntries.sort((a, b) => b[1].value - a[1].value);
                for (const [name, data] of sortedHorses) {
                    if (name === 'Horse Coin') continue;
                    const rarity = data.value * 10;
                    if (rand % rarity === 0) {
                        inventory.horses.set(name, (inventory.horses.get(name) || 0) + 1);
                        await inventory.save();

                        let prefix = "found the";
                        let decoration = "";
                        if (name.includes("Providence") || name === "Dung Beetle") {
                            prefix = name === "Dung Beetle" ? "gets ✨" : "found the ✨";
                            decoration = "✨";
                        }

                        console.log(`[HORSE] ${msg.author.tag} spawned ${name}!`);
                        await targetChan.send(`<@${msg.author.id}> ${prefix} **${name}**${decoration}!`);
                        if (data.link) await targetChan.send(data.link);
                        break;
                    }
                }
            } catch (e) {
                console.error("Horse Spawn Error:", e.message);
            }
        }

        await handleBotPing(msg, client).catch(e => console.error('PingHandler Error:', e.message));
    });
}

module.exports = { registerMessageHandler };
