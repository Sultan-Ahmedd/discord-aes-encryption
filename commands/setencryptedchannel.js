// Import required modules
import { SlashCommandBuilder, ChannelType, PermissionsBitField } from 'discord.js'; // Import PermissionsBitField
import fs from 'fs';
import path from 'path';

// Read the whitelist.json file to get the authorized users
const whitelistPath = path.join(process.cwd(), 'data/whitelist.json'); // Ensure correct path resolution
let whitelist = [];

try {
  const data = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
  whitelist = data.users || []; // Access the "users" array from the JSON file
  console.log('Whitelist:', whitelist); // Debugging line to check the data
} catch (err) {
  console.error('Error reading whitelist file:', err);
}

// Define the command
export default {
  data: new SlashCommandBuilder()
    .setName('setencryptedchannel')
    .setDescription('Sets permissions for an existing channel, making it visible only to whitelisted members.')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel to set permissions for')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(8), // Only Admins can run this command

  async execute(interaction) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: 'You do not have permission to run this command.',
        ephemeral: true,
      });
    }

    try {
      // Get the channel mentioned by the user
      const channel = interaction.options.getChannel('channel');
      
      // Check if the channel exists and is a text channel using ChannelType.GuildText
      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: 'Please mention a valid text channel.',
          ephemeral: true,
        });
      }

      // Check if the channel already has the required permissions
      const existingOverwrites = channel.permissionOverwrites.cache;
      const hasWhitelistPermissions = whitelist.every((userId) => {
        const overwrite = existingOverwrites.get(userId);
        return overwrite && overwrite.allow.has(PermissionsBitField.Flags.ViewChannel);
      });

      if (hasWhitelistPermissions) {
        return interaction.reply({
          content: `The channel ${channel.name} already has the correct permissions set for whitelisted members.`,
          ephemeral: true,
        });
      }

      // Update the channel permissions
      await channel.permissionOverwrites.set([ 
        // Deny everyone by default
        {
          id: channel.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        // Allow access to the whitelisted users
        ...whitelist.map((userId) => ({
          id: userId,
          allow: [PermissionsBitField.Flags.ViewChannel],
        })),
      ]);

      // Create the data folder if it doesn't exist
      const dataFolderPath = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataFolderPath)) {
        fs.mkdirSync(dataFolderPath);
      }

      // Save the encrypted channel ID to a JSON file
      const encryptedChannelFilePath = path.join(dataFolderPath, 'encryptedchannelid.json');
      const encryptedChannelData = {
        channelId: channel.id,
      };

      fs.writeFileSync(encryptedChannelFilePath, JSON.stringify(encryptedChannelData, null, 2), 'utf8');

      // Send a confirmation message
      return interaction.reply({
        content: `The channel ${channel.name} has been updated with the whitelist permissions successfully and set as the encrypted channel.`,
      });
    } catch (error) {
      console.error('Error updating channel permissions:', error);
      return interaction.reply({
        content: 'There was an error updating the channel permissions.',
        ephemeral: true,
      });
    }
  },
};
