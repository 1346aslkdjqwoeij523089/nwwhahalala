const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  EmbedBuilder
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

  // Ensure members are available; if the guild is large, this can be heavy,
  // but it is the most reliable approach for counting role members.
  // For most bots, this requires GuildMembers intent.
  // If members are already cached, this is cheap.
if (!guild.members.cache.size) {
    await guild.members.fetch({ withPresences: false });
  }

  const count = guild.members.cache.filter(m => m.roles.cache.has(roleId)).size;
  return safeInt(count);
}

async function updateChannelNameMembers() {
  const count = await getRoleMemberCount(GUILD_ID, ROLE_MEMBERSHIP_COUNT_ID);

  const channel = await client.channels.fetch(UPDATE_10MIN_CHANNEL_ID);
  if (!channel || !channel.edit) return;

  const newName = `Members: ${count}`;
  if (channel.name === newName) return;

  await channel.edit({ name: newName });
}

async function updateChannelNameEnlisted() {
  const count = await getRoleMemberCount(GUILD_ID, ROLE_ENLISTED_COUNT_ID);

  const channel = await client.channels.fetch(UPDATE_1H_CHANNEL_ID);
  if (!channel || !channel.edit) return;

  const newName = `Currently Enlisted: ${count}`;
  if (channel.name === newName) return;

  await channel.edit({ name: newName });
}

async function postNewMemberMessage() {
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

client.login(process.env.TOKEN);


