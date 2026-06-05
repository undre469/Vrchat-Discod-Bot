require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_18_PLUS_ID = process.env.ROLE_18_PLUS_ID;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost';
const PORT = process.env.PORT || 3000;
const LINK_SECRET = process.env.LINK_SECRET || 'changethis_in_env';

const VRCHAT_API = 'https://api.vrchat.cloud/api/1';
const USER_AGENT = 'VRChatAgeVerifyBot/1.0.0 (Discord Age Verification Bot; contact@gmail.com)';

// --- Discord Bot ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('clientReady', async () => {
  console.log(`✅ Bot ready as ${client.user.tag}`);
  client.guilds.cache.forEach(guild => {
    console.log(`📌 Server: ${guild.name} | ID: ${guild.id}`);
  });

  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [
        new SlashCommandBuilder()
          .setName('vrcverify')
          .setDescription('Verify your VRChat age to get the 18+ role')
          .toJSON(),
        new SlashCommandBuilder()
          .setName('giverole')
          .setDescription('Manually assign the 18+ role to a user (Admin only)')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('The user to give the 18+ role to')
              .setRequired(true)
          )
          .toJSON(),
        new SlashCommandBuilder()
          .setName('removerole')
          .setDescription('Remove the 18+ role from a user (Admin only)')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('The user to remove the 18+ role from')
              .setRequired(true)
          )
          .toJSON(),
        new SlashCommandBuilder()
          .setName('checkrole')
          .setDescription('Check if a user has the 18+ role (Admin only)')
          .addUserOption(option =>
            option.setName('user')
              .setDescription('The user to check')
              .setRequired(true)
          )
          .toJSON(),
        new SlashCommandBuilder()
          .setName('rolestats')
          .setDescription('See how many members have the 18+ role (Admin only)')
          .toJSON(),
        new SlashCommandBuilder()
          .setName('privacy')
          .setDescription('View our privacy policy and data practices')
          .toJSON()
      ]
    });
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('❌ Failed to register slash commands:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const isAdmin = interaction.member.permissions.has('ManageRoles');

  // --- /vrcverify ---
  if (interaction.commandName === 'vrcverify') {
    const member = interaction.member;
    if (member.roles.cache.has(ROLE_18_PLUS_ID)) {
      return interaction.reply({
        content: '✅ You already have the 18+ role!',
        flags: 64
      });
    }

    // Generate a signed token that expires in 15 minutes
    const token = jwt.sign(
      { discordId: interaction.user.id },
      LINK_SECRET,
      { expiresIn: '15m' }
    );

    const url = `${SERVER_URL}/verify?token=${token}`;
    try {
      await interaction.reply({
        content: `🔞 Click the link below to verify your VRChat age:\n${url}\n\n⚠️ This link expires in **15 minutes** and can only be used once.\n⚠️ Your credentials are used only to check your age status and are **never stored**.`,
        flags: 64
      });
    } catch (err) {
      console.error('Failed to reply to interaction:', err.message);
    }
  }

  // --- /giverole ---
  if (interaction.commandName === 'giverole') {
    if (!isAdmin) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }
    const targetUser = interaction.options.getUser('user');
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(targetUser.id);
      if (member.roles.cache.has(ROLE_18_PLUS_ID)) {
        return interaction.reply({ content: `⚠️ ${targetUser.tag} already has the 18+ role.`, flags: 64 });
      }
      await member.roles.add(ROLE_18_PLUS_ID);
      console.log(`✅ Admin manually gave 18+ role`);
      return interaction.reply({ content: `✅ Successfully gave the 18+ role to ${targetUser.tag}.`, flags: 64 });
    } catch (err) {
      console.error('❌ giverole error:', err);
      return interaction.reply({ content: '❌ Failed to assign role. Make sure the bot role is above the 18+ role in server settings.', flags: 64 });
    }
  }

  // --- /removerole ---
  if (interaction.commandName === 'removerole') {
    if (!isAdmin) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }
    const targetUser = interaction.options.getUser('user');
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(targetUser.id);
      if (!member.roles.cache.has(ROLE_18_PLUS_ID)) {
        return interaction.reply({ content: `⚠️ ${targetUser.tag} doesn't have the 18+ role.`, flags: 64 });
      }
      await member.roles.remove(ROLE_18_PLUS_ID);
      console.log(`✅ Admin removed 18+ role`);
      return interaction.reply({ content: `✅ Successfully removed the 18+ role from ${targetUser.tag}.`, flags: 64 });
    } catch (err) {
      console.error('❌ removerole error:', err);
      return interaction.reply({ content: '❌ Failed to remove role.', flags: 64 });
    }
  }

  // --- /checkrole ---
  if (interaction.commandName === 'checkrole') {
    if (!isAdmin) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }
    const targetUser = interaction.options.getUser('user');
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(targetUser.id);
      const hasRole = member.roles.cache.has(ROLE_18_PLUS_ID);
      return interaction.reply({
        content: hasRole
          ? `✅ **${targetUser.tag}** has the 18+ role.`
          : `❌ **${targetUser.tag}** does not have the 18+ role.`,
        flags: 64
      });
    } catch (err) {
      console.error('❌ checkrole error:', err);
      return interaction.reply({ content: '❌ Could not find that user in the server.', flags: 64 });
    }
  }

  // --- /rolestats ---
  if (interaction.commandName === 'rolestats') {
    if (!isAdmin) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
    }
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      await guild.members.fetch();
      const totalMembers = guild.memberCount;
      const verifiedMembers = guild.members.cache.filter(m => m.roles.cache.has(ROLE_18_PLUS_ID)).size;
      const percentage = ((verifiedMembers / totalMembers) * 100).toFixed(1);
      return interaction.reply({
        content: `📊 **18+ Role Stats**\n✅ Verified members: **${verifiedMembers}**\n👥 Total members: **${totalMembers}**\n📈 Percentage: **${percentage}%**`,
        flags: 64
      });
    } catch (err) {
      console.error('❌ rolestats error:', err);
      return interaction.reply({ content: '❌ Failed to fetch role stats.', flags: 64 });
    }
  }

  // --- /privacy ---
  if (interaction.commandName === 'privacy') {
    return interaction.reply({
      content: `🔒 **Privacy & Data Policy**\n\n` +
        `**We store absolutely nothing. Here's exactly what happens when you verify:**\n\n` +
        `1️⃣ You submit your VRChat credentials on our secure page\n` +
        `2️⃣ We send them directly to VRChat's API to check your age status\n` +
        `3️⃣ VRChat responds with ✅ or ❌\n` +
        `4️⃣ We assign your role based on that response\n` +
        `5️⃣ Your credentials are gone — never written to disk, never logged\n\n` +
        `**What we never store:**\n` +
        `❌ VRChat username or password\n` +
        `❌ VRChat display name\n` +
        `❌ Email address\n` +
        `❌ Age verification status\n` +
        `❌ Any personal information\n\n` +
        `**There is no database.** Nothing to breach, nothing to leak.\n\n` +
        `📖 Full Terms of Service: [post link here]\n` +
        `💻 Source Code: [your github link here]`,
      flags: 64
    });
  }
});

client.on('error', (err) => {
  console.error('Discord client error:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
});

client.login(DISCORD_TOKEN);

// --- Web Server ---
const app = express();
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Skip ngrok browser warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Limit body size
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts. Please wait 15 minutes and try again.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/do-verify', limiter);
app.use('/verify', limiter);

const page = (title, color, body) => `
  <html>
  <head>
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: sans-serif; max-width: 440px; margin: 60px auto; padding: 0 20px; background: #1a1a2e; color: #eee; }
      h2 { color: ${color}; }
      a { color: #7289da; }
      input { width: 100%; padding: 10px; margin: 6px 0 14px; border-radius: 6px; border: none; background: #2c2f48; color: #fff; }
      label { font-size: 14px; color: #ccc; }
      button { width: 100%; padding: 12px; background: #7289da; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; margin-top: 6px; }
      button:hover { background: #5b6eae; }
      .note { font-size: 12px; color: #888; margin-top: 16px; }
    </style>
  </head>
  <body>${body}</body>
  </html>
`;

// Step 1 — Show login form
app.get('/verify', (req, res) => {
  const { token } = req.query;

  // Verify the JWT token
  let discordId;
  try {
    const decoded = jwt.verify(token, LINK_SECRET);
    discordId = decoded.discordId;
  } catch (err) {
    return res.status(400).send(page('Link Expired', '#e74c3c', `
      <h2>Link Expired or Invalid</h2>
      <p>This verification link has expired or is invalid.</p>
      <p>Please use <strong>/vrcverify</strong> in Discord to get a new link.</p>
    `));
  }

  res.send(page('VRChat Age Verification', '#7289da', `
    <h2>VRChat Age Verification</h2>
    <p>Log in with your VRChat account. Credentials are used <strong>only</strong> to check your age status and are <strong>never stored</strong>.</p>
    <form method="POST" action="/do-verify">
      <input type="hidden" name="token" value="${token}" />
      <label>VRChat Username or Email</label>
      <input type="text" name="username" required autocomplete="off" />
      <label>Password</label>
      <input type="password" name="password" required />
      <label>2FA Code <span style="color:#666">(leave blank if not enabled)</span></label>
      <input type="text" name="totp" autocomplete="off" maxlength="6" />
      <button type="submit">Verify My Age →</button>
    </form>
    <p class="note">Credentials are transmitted securely and never stored. No database exists on this server.</p>
    <p class="note">Only use this on trusted servers. This page is not affiliated with VRChat.</p>
  `));
});

// Step 2 — Handle login + age check
app.post('/do-verify', async (req, res) => {
  const { username, password, totp, token } = req.body;
  req.body = {};

  // Verify the JWT token
  let discordId;
  try {
    const decoded = jwt.verify(token, LINK_SECRET);
    discordId = decoded.discordId;
  } catch (err) {
    return res.status(400).send(page('Link Expired', '#e74c3c', `
      <h2>Link Expired or Invalid</h2>
      <p>This verification link has expired or is invalid.</p>
      <p>Please use <strong>/vrcverify</strong> in Discord to get a new link.</p>
    `));
  }

  // Sanitize inputs
  const cleanUsername = validator.escape(username?.trim() || '');
  const cleanTotp = validator.escape(totp?.trim() || '');

  if (!cleanUsername || !password) {
    return res.send('Missing fields. Please go back and try again.');
  }

  try {
    const jar = new CookieJar();
    const http = wrapper(axios.create({
      jar,
      withCredentials: true,
      baseURL: VRCHAT_API,
      timeout: 10000,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }));

    const encoded = Buffer.from(
      `${encodeURIComponent(cleanUsername)}:${encodeURIComponent(password)}`
    ).toString('base64');

    console.log(`🔐 Attempting VRChat login...`);
    const loginRes = await http.get('/auth/user', {
      headers: {
        'Authorization': `Basic ${encoded}`,
        'User-Agent': USER_AGENT
      }
    });

    let userData = loginRes.data;
    console.log(`Checking 2FA status...`);

    if (Array.isArray(userData.requiresTwoFactorAuth) && userData.requiresTwoFactorAuth.length > 0) {
      const twoFactorType = userData.requiresTwoFactorAuth[0];

      if (!cleanTotp) {
        return res.send(page('2FA Required', '#e67e22', `
          <h2>2FA Required</h2>
          <p>Your VRChat account has <strong>${twoFactorType === 'emailOtp' ? 'email' : 'authenticator app'} 2FA</strong> enabled.</p>
          <p>Please go back and enter your 2FA code in the field provided.</p>
          <a href="javascript:history.back()">← Go Back</a>
        `));
      }

      const twoFaEndpoint = twoFactorType === 'emailOtp'
        ? '/auth/twofactorauth/emailotp/verify'
        : '/auth/twofactorauth/totp/verify';

      console.log(`Verifying 2FA...`);
      const twoFaRes = await http.post(twoFaEndpoint, { code: cleanTotp });

      if (!twoFaRes.data?.verified) {
        return res.send(page('Invalid 2FA', '#e74c3c', `
          <h2>❌ Invalid 2FA Code</h2>
          <p>The 2FA code you entered was incorrect or expired. Please go back and try again.</p>
          <a href="javascript:history.back()">← Go Back</a>
        `));
      }

      console.log(`2FA verified, re-fetching user data...`);
      const userRes = await http.get('/auth/user');
      userData = userRes.data;
    }

    console.log(`Checking age verification status...`);
    await handleVerification(userData, discordId, res);

  } catch (err) {
    const status = err.response?.status;
    const errData = err.response?.data;
    console.error(`VRChat API error [${status}]:`, JSON.stringify(errData) || err.message);

    if (status === 401) {
      return res.send(page('Login Failed', '#e74c3c', `
        <h2>Login Failed</h2>
        <p>Incorrect username or password. Please go back and try again.</p>
        <a href="javascript:history.back()">← Go Back</a>
      `));
    }

    if (status === 429) {
      return res.send(page('Rate Limited', '#e74c3c', `
        <h2>Rate Limited</h2>
        <p>Too many login attempts. Please wait a few minutes and try again.</p>
      `));
    }

    res.send(page('Error', '#e74c3c', `
      <h2>Error</h2>
      <p>Something went wrong while contacting VRChat. Please try again later.</p>
    `));
  }
});

// Step 3 — Assign Discord role
async function handleVerification(userData, discordId, res) {
  const { ageVerificationStatus, ageVerified } = userData;

  if (ageVerified === true && ageVerificationStatus === '18+') {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(discordId);

      if (member.roles.cache.has(ROLE_18_PLUS_ID)) {
        return res.send(page('Already Verified', '#2ecc71', `
          <h2>Already Verified</h2>
          <p>You already have the 18+ role in Discord. You're good to go!</p>
        `));
      }

      await member.roles.add(ROLE_18_PLUS_ID);
      console.log(`Role assigned successfully`);

      return res.send(page('Verified!', '#2ecc71', `
        <h2>Verified!</h2>
        <p>Your VRChat age verification checks out.</p>
        <p>The <strong>18+</strong> role has been assigned in Discord. You can close this page.</p>
      `));

    } catch (err) {
      console.error('Discord role error:', err);
      return res.send(page('Role Assignment Failed', '#e74c3c', `
        <h2>Role Assignment Failed</h2>
        <p>Your VRChat account is age verified, but the bot couldn't assign the role. Please contact a moderator.</p>
      `));
    }

  } else {
    return res.send(page('Not Verified', '#e74c3c', `
      <h2>Not Age Verified</h2>
      <p>Your VRChat account does not have 18+ age verification. The role has not been assigned.</p>
      <p>To get verified, visit your <a href="https://vrchat.com/home/profile" target="_blank">VRChat profile settings</a> and complete age verification.</p>
    `));
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).send(page('Error', '#e74c3c', `
    <h2>Server Error</h2>
    <p>Something went wrong. Please try again later.</p>
  `));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Web server running on port ${PORT}`));