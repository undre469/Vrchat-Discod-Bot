require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

console.log('🔄 Starting...');
console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('GUILD_ID:', process.env.GUILD_ID);
console.log('TOKEN exists:', !!process.env.DISCORD_TOKEN);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
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
}).then(result => {
  console.log(`✅ Registered ${result.length} commands:`);
  result.forEach(cmd => console.log(`   /${cmd.name}`));
}).catch(err => {
  console.error('❌ Error:', err.message);
  console.error('❌ Full:', JSON.stringify(err, null, 2));
});