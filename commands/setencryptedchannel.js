// commands/setencryptedchannel.js

import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType, PermissionsBitField } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const whitelistPath = path.join(__dirname, '..', 'data', 'whitelist.json');
const accessPath = path.join(__dirname, '..', 'data', 'criticalaccess_permission.json');

// Ensure the data directory exists
async function ensureDataDirectory() {
    const dataDir = path.join(__dirname, '..', 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// Load JSON from a given path
async function loadJSON(filePath, defaultData) {
    try {
        await ensureDataDirectory();
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        } else {
            throw error;
        }
    }
}

// Save JSON to a given path
async function saveJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export default {
    data: new SlashCommandBuilder()
        .setName('setencryptedchannel')
        .setDescription('Sets permissions for an existing channel, making it visible only to whitelisted members.')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to set permissions for')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const accessData = await loadJSON(accessPath, { userIds: [] });
            const requesterId = interaction.user.id;

            // Check if the requester has access
            if (!accessData.userIds.includes(requesterId)) {
                return interaction.reply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('channel');

            // Check if the channel exists and is a text channel
            if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
                return interaction.reply({
                    content: 'Please mention a valid text channel.',
                    ephemeral: true,
                });
            }

            const whitelistData = await loadJSON(whitelistPath, { users: [] });
            const whitelist = whitelistData.users;

            // Check if the channel already has the required permissions
            const existingOverwrites = targetChannel.permissionOverwrites.cache;
            const hasWhitelistPermissions = whitelist.every((userId) => {
                const overwrite = existingOverwrites.get(userId);
                return overwrite && overwrite.allow.has(PermissionsBitField.Flags.ViewChannel);
            });

            if (hasWhitelistPermissions) {
                return interaction.reply({
                    content: `✅ The channel ${targetChannel.name} already has the correct permissions set for whitelisted members.`,
                    ephemeral: true,
                });
            }

            // Update the channel permissions
            await targetChannel.permissionOverwrites.set([
                // Deny everyone by default
                {
                    id: targetChannel.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                // Allow access to the whitelisted users
                ...whitelist.map((userId) => ({
                    id: userId,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                })),
            ]);

            // Save the encrypted channel ID to a JSON file
            const encryptedChannelFilePath = path.join(__dirname, '..', 'data', 'encryptedchannelid.json');
            const encryptedChannelData = {
                channelId: targetChannel.id,
            };

            await saveJSON(encryptedChannelFilePath, encryptedChannelData);

            // Send a confirmation message
            return interaction.reply({
                content: `✅ The channel ${targetChannel.name} has been updated with the whitelist permissions successfully and set as the encrypted channel.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error updating channel permissions:', error);
            return interaction.reply({
                content: '❌ There was an error updating the channel permissions.',
                ephemeral: true,
            });
        }
    },
};
