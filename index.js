const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  EmbedBuilder,
  REST,
  Routes
} = require('discord.js');

// ====== Config (hardcoded per instructions) ======
const GUILD_ID = '1453748039448789189';

// Roles
const ROLE_MEMBERSHIP_COUNT_ID = '1508748021377273886'; // For presence + Members channel
const ROLE_ENLISTED_COUNT_ID = '1509655211608772748'; // For Currently Enlisted channel + embed count

// Bot / channels
const UPDATE_10MIN_CHANNEL_ID = '1508580658492997832';
const UPDATE_1H_CHANNEL_ID = '1508580825845993693';
const NEW_MEMBER_ANNOUNCE_CHANNEL_ID = '1485535519625445396';

// Presence line role count uses ROLE_MEMBERSHIP_COUNT_ID
// Activity format is fixed by requirement; no dynamic presence string constant needed.
const PRESENCE_FORMAT = 'Watching over';

// New member message content (literal)
const NEW_USER_PING = '{New User Ping}';

// Image URL
const LARGE_THUMB_URL = 'https://cdn.discordapp.com/attachments/1456359529704063058/1509656715849896086/fasfas.png?ex=6a19f8e1&is=6a18a761&hm=2ebb728717e261f7c16eee53a02405ac36836e131c1bd6e39319f8d9056892c9&';

// ====== Client ======
// Note: We request GuildMembers so role counts can be computed.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.GuildMember]
});

function safeInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

async function getGuild(guildId) {
  // Prefer cached
  let guild = client.guilds.cache.get(guildId);
  if (guild) return guild;
  // Fallback fetch
  guild = await client.guilds.fetch(guildId);
  return guild;
}

async function getRoleMemberCount(guildId, roleId) {
  const guild = await getGuild(guildId);

  // Always fetch fresh member list to avoid stale/partial caches that can produce 0/1.
  const members = await guild.members.fetch({ withPresences: false });

  let count = 0;
  members.forEach(m => {
    if (m.roles.cache.has(roleId)) count += 1;
  });

  return safeInt(count);
}

async function updateChannelNameMembers() {
  const count = await getRoleMemberCount(GUILD_ID, ROLE_MEMBERSHIP_COUNT_ID);

  // Helpful logs (you can view Render logs to confirm the count is correct)
  console.log(`[NWW] Members role count for ${ROLE_MEMBERSHIP_COUNT_ID}: ${count}`);

  const channel = await client.channels.fetch(UPDATE_10MIN_CHANNEL_ID);
  if (!channel || !channel.edit) return;

  const newName = `Members: ${count}`;
  if (channel.name === newName) return;

  await channel.edit({ name: newName });
}

async function updateChannelNameEnlisted() {
  const count = await getRoleMemberCount(GUILD_ID, ROLE_ENLISTED_COUNT_ID);

  console.log(`[NWW] Enlisted role count for ${ROLE_ENLISTED_COUNT_ID}: ${count}`);

  const channel = await client.channels.fetch(UPDATE_1H_CHANNEL_ID);
  if (!channel || !channel.edit) return;

  const newName = `Currently Enlisted: ${count}`;
  if (channel.name === newName) return;

  await channel.edit({ name: newName });
}

async function postNewMemberMessage() {
  // no-op

  const channel = await client.channels.fetch(NEW_MEMBER_ANNOUNCE_CHANNEL_ID);
  if (!channel || !channel.send) return;

  const enlistedCount = await getRoleMemberCount(GUILD_ID, ROLE_ENLISTED_COUNT_ID);

  const embed1 = new EmbedBuilder()
    .setColor(0x5865f2)
    .setDescription(
      `> Welcome to Nexus Worldwide [NWW]. Created by Inferno, Nexus Worldwide is a private military community that strives to revolutionize the player v.s. player combat, along with roleplay style. \\n> - We are actively recruiting new members. If you are interested in joining, please check out our <#1455976758628188364>. \\n> - <#1508580658492997832> \\n> - The current number of enlisted personnel in Nexus Worldwide is {1509655211608772748 number of people w this role in the guild} members.`
    );

  // Replace placeholder with actual count and keep role id in the text per requirement.
  // We keep the exact template but swap the number.
  embed1.setDescription(
    `> Welcome to Nexus Worldwide [NWW]. Created by Inferno, Nexus Worldwide is a private military community that strives to revolutionize the player v.s. player combat, along with roleplay style. 
> - We are actively recruiting new members. If you are interested in joining, please check out our <#1455976758628188364>. 
> - <#1508580658492997832>
> - The current number of enlisted personnel in Nexus Worldwide is {1509655211608772748 number of people w this role in the guild} members.
> - If needed, please create a ticket with our <#1508786581731807232> support to assist you with any inquiries.
> - Make sure you abide by the <#1487892670129897573> at all times, or you may be punished in discord!
> - Following our <#1453775830726742289> is important to ensure that you won't be punished in the near future.
> - Keep up to date with relatively new information in our <#1453776762575126619>. `
  );

  // Put the computed count into the placeholder pattern precisely as requested.
  // We interpret: {1509655211608772748 number of people w this role in the guild} => {<roleId> <number>}
  embed1.setDescription(embed1.data.description.replace(
    `{1509655211608772748 number of people w this role in the guild}`,
    `{1509655211608772748 ${enlistedCount}}`
  ));

  const embed2 = new EmbedBuilder()
    .setColor(0x57f287)
    .setThumbnail(LARGE_THUMB_URL)
    .setDescription('');

  const embed3 = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setDescription('> Have an excellent day! Thank you for joining **Nexus Worldwide [NWW]**!');

  await channel.send({
    content: NEW_USER_PING,
    embeds: [embed1, embed2, embed3]
  });
}

client.once('clientReady', async () => {
  // Register slash commands (guild-scoped) so /update-statistics appears in Discord.
  try {
    const token = process.env.TOKEN;
    const rest = new REST({ version: '10' }).setToken(token);

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      {
        body: [
          {
            name: 'update-statistics',
            description: 'Updates member/enlisted channel statistics now.'
          },
          {
            name: 'personcount',
            description: 'Shows NWW server member statistics.'
          }
        ]
      }
    );

    console.log('[NWW] Slash command /update-statistics registered.');
  } catch (e) {
    console.error('[NWW] Failed to register slash commands:', e);
  }

  // Update immediately on startup
  await updateChannelNameMembers().catch(e => console.error('Immediate 10min channel update failed:', e));
  await updateChannelNameEnlisted().catch(e => console.error('Immediate 1h channel update failed:', e));
  // Presence: Watching over NWW | {ROLE_MEMBERSHIP_COUNT_ID Members}
  try {
    const count = await getRoleMemberCount(GUILD_ID, ROLE_MEMBERSHIP_COUNT_ID);

    client.user.setPresence({
      activities: [
        {
          name: `NWW | ${count} Members`,
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });
  } catch (e) {
    console.error('Failed to set initial presence:', e);
  }

  // Update channels on startup
  try {
    await updateChannelNameMembers();
  } catch (e) {
    console.error('Failed to update 10min channel name on startup:', e);
  }
  try {
    await updateChannelNameEnlisted();
  } catch (e) {
    console.error('Failed to update 1h channel name on startup:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'update-statistics') {
      await updateChannelNameMembers();
      await updateChannelNameEnlisted();
      return await interaction.reply({ content: 'Statistics updated.', ephemeral: true });
    }

    if (interaction.commandName === 'personcount') {
      const guild = await client.guilds.fetch(GUILD_ID);

      // Member count: non-bots
      const members = await guild.members.fetch();
      const nonBots = members.filter(m => !m.user.bot);

      // Online members: non-bots with status != invisible
      // discord.js uses PresenceStatus values; however, some members may not have presence cached.
      // We'll treat undefined as not-online.
      let online = 0;
      nonBots.forEach(m => {
        const status = m.presence?.status;
        if (!status) return;
        if (status !== 'invisible') online += 1;
      });

      const boosters = await guild.fetchBoosts?.();
      const boosterCount = boosters && typeof boosters.size === 'number' ? boosters.size : 0;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(
          `**${guild.name}**\n> **Member Count:** ${nonBots.size}\n> **Online Members:** ${online}\n> **Server Boosters:** ${boosterCount}`
        );

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (e) {
    console.error('Command handler error:', e);
    try {
      await interaction.reply({ content: 'Command failed.', ephemeral: true });
    } catch {}
  }
});

client.on('guildMemberAdd', async (member) => {
  // Only for the configured guild
  if (member.guild.id !== GUILD_ID) return;

  try {
    await postNewMemberMessage();
  } catch (e) {
    console.error('Failed to post new member message:', e);
  }
});

// Every 10 minutes: update Members channel name
setInterval(() => {
  updateChannelNameMembers().catch(e => console.error('10min update failed:', e));
}, 10 * 60 * 1000);

// Every 1 hour: update Currently Enlisted channel name
setInterval(() => {
  updateChannelNameEnlisted().catch(e => console.error('1h update failed:', e));
}, 60 * 60 * 1000);

// Optional: Keep presence fresh occasionally
setInterval(async () => {
  try {
    const count = await getRoleMemberCount(GUILD_ID, ROLE_MEMBERSHIP_COUNT_ID);
    client.user.setPresence({
      activities: [
        { name: `NWW | ${count} Members`, type: ActivityType.Watching }
      ],
      status: 'online'
    });
  } catch (e) {
    console.error('Failed to refresh presence:', e);
  }
}, 10 * 60 * 1000);

// Render requires at least one open HTTP port for web services.
// Provide a minimal server so UptimeRobot can ping /healthz.
const http = require('http');
const port = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});
server.listen(port, () => {
  console.log(`Health server listening on ${port}`);
});

// ===== Prefix + Commands ( + ) =====
const COMMAND_LOG_CHANNEL_ID = '1509676249977454694';
const ADMIN_PERMS = ['Administrator', 'KickMembers', 'BanMembers'];

function hasAdminPerms(member) {
  if (!member?.permissions) return false;
  return ADMIN_PERMS.some(p => member.permissions.has(p));
}

function highestRoleBelow(bannedTarget, executor) {
  const executorTop = executor.roles.highest;
  const targetTop = bannedTarget.roles.highest;
  return targetTop.position < executorTop.position;
}

function formatCommandEmbed({ title, actorTag, bullets, timestamp }) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(
      `> "${actorTag}"\n${bullets
        .map(b => `> - ${b}`)
        .join('\n')}
`
    )
    .setTimestamp(timestamp || new Date());
  return embed;
}

async function logCommandUsage(guild, embed) {
  try {
    const ch = await client.channels.fetch(COMMAND_LOG_CHANNEL_ID);
    if (!ch?.send) return;
    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error('Failed logging command usage:', e);
  }
}

client.on('messageCreate', async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = (message.content || '').trim();
    if (!content.startsWith('+')) return;

    const [rawCmd, ...rest] = content.slice(1).split(/\s+/);
    const cmd = (rawCmd || '').toLowerCase();

    // Helper: count role members accurately
    const roleCount = async (roleId) => getRoleMemberCount(GUILD_ID, roleId);

    const isAdmin = hasAdminPerms(message.member);

    if (cmd === 'updatestatistics') {
      if (!isAdmin) {
        const embed = formatCommandEmbed({
          title: 'Command: +updatestatistics',
          actorTag: message.author.tag,
          bullets: ['denied (missing admin perms)'],
          timestamp: new Date()
        });
        await logCommandUsage(message.guild, embed);
        return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      await updateChannelNameMembers();
      await updateChannelNameEnlisted();

      const embed = formatCommandEmbed({
        title: 'Command: +updatestatistics',
        actorTag: message.author.tag,
        bullets: [
          `updated channel ${UPDATE_10MIN_CHANNEL_ID} name`,
          `updated channel ${UPDATE_1H_CHANNEL_ID} name`
        ],
        timestamp: new Date()
      });

      await logCommandUsage(message.guild, embed);
      // Keep command execution confirmations private for non-public commands.
      return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (cmd === 'personcount') {
      // Public view required: message should be sent in channel.
      // The embed response itself should still not reveal who ran it? Requirement says command works public view rather than private.
      const guild = await client.guilds.fetch(GUILD_ID);
      const members = await guild.members.fetch();
      const nonBots = members.filter(m => !m.user.bot);

      let online = 0;
      nonBots.forEach(m => {
        const status = m.presence?.status;
        if (!status) return;
        if (status !== 'invisible') online += 1;
      });

      const boosters = await guild.fetchBoosts?.();
      const boosterCount = boosters && typeof boosters.size === 'number' ? boosters.size : 0;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Command: +personcount')
        .setDescription(
          `**${guild.name}**\n> **Member Count:** ${nonBots.size}\n> **Online Members:** ${online}\n> **Server Boosters:** ${boosterCount}`
        )
        .setTimestamp(new Date());

      const logEmbed = formatCommandEmbed({
        title: 'Command: +personcount',
        actorTag: message.author.tag,
        bullets: [`publicly displayed member statistics`],
        timestamp: new Date()
      });
      await logCommandUsage(message.guild, logEmbed);

      return await message.channel.send({ embeds: [embed] });
    }

    if (cmd === 'say') {
      // Admin-only; public message output, but command usage confirmation is private.
      if (!isAdmin) {
        const embed = formatCommandEmbed({
          title: 'Command: +say',
          actorTag: message.author.tag,
          bullets: ['denied (missing admin perms)'],
          timestamp: new Date()
        });
        await logCommandUsage(message.guild, embed);
        return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      const sayText = rest.join(' ').trim();
      if (!sayText) return await message.reply('Usage: +say <message>');

      // Publicly send message
      await message.channel.send(sayText);

      const embed = formatCommandEmbed({
        title: 'Command: +say',
        actorTag: message.author.tag,
        bullets: [`sent a public message`],
        timestamp: new Date()
      });
      await logCommandUsage(message.guild, embed);

      // Private confirmation (reply is private-ish if used as reply; best-effort)
      return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    if (cmd === 'kick' || cmd === 'ban') {
      if (!isAdmin) {
        const embed = formatCommandEmbed({
          title: `Command: +${cmd}`,
          actorTag: message.author.tag,
          bullets: ['denied (missing admin perms)'],
          timestamp: new Date()
        });
        await logCommandUsage(message.guild, embed);
        return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      // Parse: +kick @user <reason...>
      // +ban @user <reason...> [time]
      // If time provided: treat last token as number of minutes for softban
      const target = message.mentions.members.first();
      if (!target) return await message.reply('Usage: +kick/+ban @user <reason> [time minutes]');

      // Role hierarchy check
      if (!highestRoleBelow(target, message.member)) {
        const embed = formatCommandEmbed({
          title: `Command: +${cmd}`,
          actorTag: message.author.tag,
          bullets: ['target has equal/higher role than executor (blocked)'],
          timestamp: new Date()
        });
        await logCommandUsage(message.guild, embed);
        return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      // Extract reason/time from the message
      const textAfterMention = rest.join(' ');
      const tokens = textAfterMention.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) return await message.reply('Please provide a reason.');

      let timeMinutes;
      const last = tokens[tokens.length - 1];
      if (/^\d+$/.test(last)) {
        timeMinutes = parseInt(last, 10);
        tokens.pop();
      }
      const reason = tokens.join(' ');

      const now = new Date();

      if (cmd === 'kick') {
        await target.kick(reason);

        const embed = formatCommandEmbed({
          title: 'Command: +kick',
          actorTag: message.author.tag,
          bullets: [`kicked ${target.user.tag}`, `reason: ${reason}`],
          timestamp: now
        });
        await logCommandUsage(message.guild, embed);
        return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }

      if (cmd === 'ban') {
        if (timeMinutes && timeMinutes > 0) {
          // softban: ban then unban after time
          await target.ban({ reason });
          setTimeout(async () => {
            try {
              await message.guild.members.unban(target.id, 'softban duration ended');
            } catch (e) {
              console.error('Softban unban failed:', e);
            }
          }, timeMinutes * 60 * 1000);

          const embed = formatCommandEmbed({
            title: 'Command: +ban (softban)',
            actorTag: message.author.tag,
            bullets: [`softbanned ${target.user.tag}`, `reason: ${reason}`, `duration: ${timeMinutes} minutes`],
            timestamp: now
          });
          await logCommandUsage(message.guild, embed);
          return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }

        await target.ban({ reason });
        const embed = formatCommandEmbed({
          title: 'Command: +ban',
          actorTag: message.author.tag,
          bullets: [`banned ${target.user.tag}`, `reason: ${reason}`],
          timestamp: now
        });
        await logCommandUsage(message.guild, embed);
        return await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
      }
    }
  } catch (e) {
    console.error('messageCreate handler error:', e);
  }
});

client.login(process.env.TOKEN);



