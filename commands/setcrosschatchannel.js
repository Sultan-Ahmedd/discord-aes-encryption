// setcrosschatchannel.js

import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';

// Paths for data files
const whitelistPath = path.join(process.cwd(), 'data', 'crossmessaging_whitelist.json');
const crossChatChannelsPath = path.join(process.cwd(), 'data', 'cross_chat_channels.json');

// Function to load JSON from a file
async function loadJSON(filePath, defaultData) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, create it with default data
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        } else {
            throw error;
        }
    }
}

// Function to save JSON to a file
async function saveJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export default {
    data: new SlashCommandBuilder()
        .setName('setcrosschatchannel')
        .setDescription('Sets the cross-chat channel for this server.')
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('The channel to set as cross-chat channel.')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            const requesterId = interaction.user.id;

            // Load the whitelist
            const whitelist = await loadJSON(whitelistPath, { userIds: [] });

            // Check if the user is in the whitelist
            if (!whitelist.userIds.includes(requesterId)) {
                return interaction.reply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true,
                });
            }

            // Ensure the user has appropriate permissions
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({
                    content: '❌ You need the "Manage Server" permission to use this command.',
                    ephemeral: true,
                });
            }

            const channel = interaction.options.getChannel('channel');

            // Read the current cross-chat channels
            const crossChatChannels = await loadJSON(crossChatChannelsPath, []);

            // Check if the server already has a cross-chat channel set
            const existingEntryIndex = crossChatChannels.findIndex(
                (entry) => entry.guildId === interaction.guild.id
            );

            if (existingEntryIndex !== -1) {
                // Update the existing entry
                crossChatChannels[existingEntryIndex].channelId = channel.id;
            } else {
                // Add a new entry
                crossChatChannels.push({
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                });
            }

            // Save the updated cross-chat channels to the file
            await saveJSON(crossChatChannelsPath, crossChatChannels);

            return interaction.reply({
                content: `✅ Cross-chat channel has been set to ${channel}.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error in setcrosschatchannel command:', error);
            return interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true,
            });
        }
    },
};
