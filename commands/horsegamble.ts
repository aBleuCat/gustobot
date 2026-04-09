import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import mongoose from 'mongoose';
import { devLog } from '../lib/helpers/devLog';

import { ADMIN_IDS, SAFE_LENGTH } from './horsegamble/constants';
import { horseName, normalizeHorseMap, requiredHorseCoins, getSortedHorseList } from './horsegamble/inventory';
import { handleHorseCoinGamble, handleSingleGamble } from './horsegamble/singleGamble';
import { handleBulkGamble } from './horsegamble/bulkGamble';
import { handleCycleGamble } from './horsegamble/cycleGamble';
import { HorseValues } from './horsegamble/types';

const HORSE_VALUES: HorseValues = require('../horses.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('horsegamble')
        .setDescription('Gamble horses; minimum coin requirement scales with your coin balance')
        .addStringOption(option =>
            option.setName('horse')
                .setDescription('The horse to gamble, "Horse Coin", "top", or "bottom".')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of gamblings (1-100, or 0 for all). For top/bottom: 0 = gamble all.')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(100)
        )
        .addIntegerOption(option =>
            option.setName('cycles')
                .setDescription('Number of times to re-gamble the resulting horses (2-20).')
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(20)
        )
        .addIntegerOption(option =>
            option.setName('bankhorses')
                .setDescription('Protect horses valued above this amount. -0.3 coins banked.')
                .setRequired(false)
                .setMinValue(0)
        )
        .addBooleanOption(option =>
            option.setName('test')
                .setDescription('(Admin only) Simulate gambles without spending horses.')
                .setRequired(false)
        ),

    async autocomplete(interaction: AutocompleteInteraction) {
        try {
            const UserHorses = mongoose.model('UserHorses');
            const focused = interaction.options.getFocused().toLowerCase();
            const inventory = normalizeHorseMap(await UserHorses.findOne({ userId: interaction.user.id }).lean());

            const choices = [
                { name: '📈 top — gamble most valuable horses', value: 'top' },
                { name: '📉 bottom — gamble least valuable horses', value: 'bottom' },
            ];

            if ((inventory?.horseCoins || 0) >= 2) {
                choices.push({ name: '🪙 Horse Coin', value: 'horse_coin' });
            }

            if (inventory?.horses) {
                for (const [slug, count] of (inventory.horses as Map<string, number>).entries()) {
                    if (count > 0 && HORSE_VALUES[slug]) {
                        choices.push({ name: `${horseName(slug)} (x${count})`, value: slug });
                    }
                }
            }

            await interaction.respond(
                choices.filter(c => c.name.toLowerCase().includes(focused)).slice(0, 25)
            );
        } catch (err) {
            console.error('horsegamble autocomplete error:', err);
            try { await interaction.respond([]); } catch { /* swallow */ }
        }
    },

    async execute(interaction: ChatInputCommandInteraction) {
        const UserHorses = mongoose.model('UserHorses');
        const horseSlug = interaction.options.getString('horse')!.trim().toLowerCase();
        const count = interaction.options.getInteger('count') ?? 1;
        const cycles = interaction.options.getInteger('cycles') ?? null;
        const bankAbove = interaction.options.getInteger('bankhorses') ?? null;
        const isTest = interaction.options.getBoolean('test') ?? false;

        devLog(`/horsegamble: User ${interaction.user.id} initiated gamble | horse=${horseSlug} count=${count} cycles=${cycles} bankAbove=${bankAbove} test=${isTest}`);

        const isHorseCoin = horseSlug === 'horse_coin';
        const isTop = horseSlug === 'top';
        const isBottom = horseSlug === 'bottom';
        const isTopBottom = isTop || isBottom;
        const isAdmin = ADMIN_IDS.includes(interaction.user.id);
        const isCycleMode = cycles !== null && cycles >= 2;

        await interaction.deferReply();

        if (isTest && !isAdmin) {
            devLog(`/horsegamble: Test mode denied for non-admin user ${interaction.user.id}`);
            return interaction.editReply({ content: `You don't have permission to use test mode.` });
        }

        if (isCycleMode && isHorseCoin) {
            devLog(`/horsegamble: Cycle mode rejected for horse coin gambling from user ${interaction.user.id}`);
            return interaction.editReply({ content: `Cycle mode cannot be used with Horse Coin gambling. Yet...` });
        }

        if (!isHorseCoin && !isTopBottom && !HORSE_VALUES[horseSlug]) {
            devLog(`/horsegamble: Invalid horse slug "${horseSlug}" from user ${interaction.user.id}`);
            const match = Object.keys(HORSE_VALUES).find(k =>
                HORSE_VALUES[k].name.toLowerCase() === horseSlug || k.toLowerCase() === horseSlug
            );
            const suggestion = match ? ` Did you mean **${horseName(match)}**?` : '';
            return interaction.editReply({ content: `**${horseSlug}** isn't a valid horse.${suggestion}` });
        }

        let inventory: any = isTest ? null : normalizeHorseMap(await UserHorses.findOne({ userId: interaction.user.id }));
        devLog(`/horsegamble: Loaded inventory for user ${interaction.user.id} | coins=${inventory?.horseCoins || 0}`, 'micro');

        if (!isTest) {
            if (!inventory) {
                devLog(`/horsegamble: Creating new inventory for user ${interaction.user.id}`, 'micro');
                inventory = new UserHorses({ userId: interaction.user.id, horses: new Map(), horseCoins: 0 });
            }
            normalizeHorseMap(inventory);

            if ((inventory.horseCoins || 0) < 0) {
                devLog(`/horsegamble: User ${interaction.user.id} has debt of ${inventory.horseCoins}, gamble denied`, 'micro');
                return interaction.editReply({
                    content: `You are in coin debt (**${inventory.horseCoins}**). You cannot gamble until you break even.`
                });
            }

            if (!isHorseCoin) {
                const required = requiredHorseCoins(inventory.horseCoins || 0);
                if ((inventory.horseCoins || 0) < required) {
                    devLog(`/horsegamble: User ${interaction.user.id} insufficient coins | required=${required} have=${inventory.horseCoins}`, 'micro');
                    return interaction.editReply({
                        content: `You need at least **${required}** Horse Coins to gamble horses (ceil(coins/50*TAX)). You have **${inventory.horseCoins || 0}**.`
                    });
                }
            }
        }

        //  Horse Coin gamble 
        if (isHorseCoin) {
            return handleHorseCoinGamble(interaction, inventory, count, isTest);
        }

        //  Build initial horse list ─
        let initialHorsesToGamble: string[] = [];
        devLog(`/horsegamble: Building horse list for user ${interaction.user.id} | isTopBottom=${isTopBottom}`, 'micro');

        if (isTopBottom) {
            if (isTest) {
                return interaction.editReply({ content: `Test mode is not supported with top/bottom (no inventory to simulate against).` });
            }
            const sorted = getSortedHorseList(inventory, isTop ? 'desc' : 'asc');
            if (sorted.length === 0) {
                return interaction.editReply({ content: `You don't have any horses to gamble!` });
            }
            let remaining = count === 0 ? Infinity : count;
            for (const { slug, count: slugCount } of sorted) {
                if (remaining <= 0) break;
                const take = Math.min(slugCount, remaining);
                for (let i = 0; i < Math.min(take, 100000); i++) initialHorsesToGamble.push(slug);
                remaining -= take;
            }
        } else {
            const available = isTest ? 999 : (inventory.horses.get(horseSlug) || 0);
            if (!isTest && available === 0) {
                devLog(`/horsegamble: User ${interaction.user.id} has no ${horseSlug} to gamble`, 'micro');
                return interaction.editReply({ content: `You don't have any **${horseName(horseSlug)}**!` });
            }
            const take = Math.min(count === 0 ? available : Math.min(count, available), 100000);
            initialHorsesToGamble = Array.from({ length: take }, () => horseSlug);
            devLog(`/horsegamble: Building list for user ${interaction.user.id} | slug=${horseSlug} available=${available} taking=${take}`, 'micro');
        }

        if (initialHorsesToGamble.length === 0) {
            return interaction.editReply({ content: `Nothing to gamble!` });
        }

        //  Cycle mode 
        if (isCycleMode) {
            return handleCycleGamble(interaction, inventory, UserHorses, initialHorsesToGamble, cycles!, bankAbove, isTest, isTop, isBottom, horseSlug);
        }

        //  Single gamble 
        if (initialHorsesToGamble.length === 1) {
            return handleSingleGamble(interaction, inventory, UserHorses, initialHorsesToGamble[0], isTest);
        }

        //  Bulk gamble
        return handleBulkGamble(interaction, inventory, UserHorses, initialHorsesToGamble, isTest, isTop, isBottom);
    },
};