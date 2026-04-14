import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import mongoose from 'mongoose';

export default {
  data: new SlashCommandBuilder()
    .setName('advicegive')
    .setDescription('Add a piece of advice to the goon circle of advice')
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option: any) => option.setName('text').setDescription('The advice').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const Advice = mongoose.model('Advice');
    const AdviceBan = mongoose.model('AdviceBan');
    const text = interaction.options.getString('text')?.trim() || '';

    // 1. Check if the user is banned
    const isBanned = await AdviceBan.findOne({ userId: interaction.user.id });
    if (isBanned) {
      await interaction.reply({
        content: 'You are banned from contributing wisdom to the circle.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 2. Character limit check (100 chars)
    if (text.length > 100) {
      await interaction.reply({
        content: `That's too much wisdom! Please keep it under 100 characters (Current: ${text.length}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (text.length < 3) {
      await interaction.reply({
        content: 'Wisdom must be at least 3 characters long.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 3. Duplicate check (Case-insensitive)
    const existingAdvice = await Advice.findOne({
      content: { $regex: new RegExp(`^${text}$`, 'i') },
    });

    if (existingAdvice) {
      await interaction.reply({
        content: 'This wisdom has already been propagated. Try something more original.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 4. Save
    try {
      const newAdvice = new Advice({
        content: text,
        authorId: interaction.user.id,
      });
      await newAdvice.save();
      await interaction.reply({ content: 'Your wisdom shall be propagated', flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Failed to save advice.', flags: MessageFlags.Ephemeral });
    }
  },
};
