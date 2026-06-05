# VRChat Age Verify Bot

A Discord bot that verifies users are 18+ by checking their VRChat age verification status and assigns a role automatically.

## Features
- /vrcverify — users verify their VRChat age
- /giverole — manually give 18+ role (admin)
- /removerole — remove 18+ role (admin)
- /checkrole — check if a user has the role (admin)
- /rolestats — see verification stats (admin)
- /privacy — view privacy policy

## Privacy
No data is stored. Credentials are used only to check age status and discarded immediately. There is no database.

## Setup

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your values
4. Run `node register.js` to register slash commands
5. Run `node index.js` to start the bot

## .env values needed

DISCORD_TOKEN=your_bot_token_here

CLIENT_ID=your_application_id_here

GUILD_ID=your_server_id_here

ROLE_18_PLUS_ID=your_role_id_here

SERVER_URL=https://your-domain-or-railway-url-here

PORT=3000

LINK_SECRET=some_long_random_string_here_make_it_at_least_32_chars
