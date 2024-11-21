import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { WebhookClient } from 'discord.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const accessPath = path.join(__dirname, '..', 'data', 'criticalaccess_permission.json');

// Function to load JSON from a given path
async function loadJSON(filePath, defaultData) {
    try {
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

// Function to generate a random username
function generateRandomUsername() {
    const adjectives = ['Silent', 'Ghost', 'Shadow', 'Whisper', 'Phantom', 'Stealth', 'Covert', 'Masked'];
    const nouns = ['Agent', 'Operative', 'Specter', 'Sentinel', 'Guardian', 'Wraith', 'Shade', 'Phantom'];
    const numbers = Array.from({length: 3}, () => Math.floor(Math.random() * 10)).join('');

    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]} ${numbers}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('anon')
        .setDescription('Send an anonymous message via webhook')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send anonymously')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('customuser')
                .setDescription('Custom username (optional)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restrict to administrators

    async execute(interaction) {
        try {
            // Load access data
            const accessData = await loadJSON(accessPath, { userIds: [] });
            const requesterId = interaction.user.id;

            // Check if the requester has access
            if (!accessData.userIds.includes(requesterId)) {
                return interaction.reply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
            }

            // Defer the reply to give the bot time to process
            await interaction.deferReply({ ephemeral: true });

            // Retrieve command options
            const messageContent = interaction.options.getString('message');
            const customUser = interaction.options.getString('customuser') || generateRandomUsername();

            let avatarData = null;
            try {
                // Fetch the profile picture with error handling
                const profilePictureUrl = 'https://cdn.discordapp.com/attachments/1308354380931665991/1308392083698225152/Spetsnaz_emblem.png';
                const profilePictureResponse = await axios.get(profilePictureUrl, { responseType: 'arraybuffer' });
                avatarData = `data:image/png;base64,${Buffer.from(profilePictureResponse.data, 'binary').toString('base64')}`;
            } catch (imageError) {
                console.error('Error fetching profile picture:', imageError);
                // Proceed without avatar if image fetch fails
            }

            // Create a webhook in the current channel
            const webhook = await interaction.channel.createWebhook({
                name: customUser,
                avatar: avatarData, // This will be null if image fetch failed
            });

            // Send the message via the webhook
            await webhook.send({
                content: messageContent,
                username: customUser,
            });

            // Provide feedback to the command executor
            await interaction.editReply({ 
                content: `✅ Anonymous message sent successfully as ${customUser}.`,
                ephemeral: true 
            });

            // Optional: Delete the webhook after sending
            setTimeout(async () => {
                try {
                    await webhook.delete('Cleanup after anonymous message');
                } catch (deleteError) {
                    console.error('Error deleting webhook:', deleteError);
                }
            }, 5000); // Delete after 5 seconds

        } catch (error) {
            console.error('Error in anonymous message command:', error);
            return interaction.editReply({ 
                content: '❌ An unexpected error occurred. Please try again later.',
                ephemeral: true 
            });
        }
    },
};