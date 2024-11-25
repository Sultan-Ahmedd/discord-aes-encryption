// commands/sendpmessage.js

import { SlashCommandBuilder } from '@discordjs/builders';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const whitelistPath = path.join(__dirname, '..', 'data', 'whitelist.json');
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

// Function to encrypt text using AES-256-CBC
function encryptText(text) {
    const algorithm = 'aes-256-cbc';
    const secretKeyBase64 = process.env.ENCRYPTION_KEY || 'f44KFCOk+T5svYt+qW6F8WPVqcmvmjntw3J7G4wtR34=';

    // Convert the base64 key to a buffer and ensure it is exactly 32 bytes
    const keyBuffer = Buffer.from(secretKeyBase64, 'base64');
    if (keyBuffer.length !== 32) {
        throw new Error('Secret key must be 32 bytes for AES-256 encryption.');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    return {
        iv: iv.toString('base64'),
        content: encrypted.toString('base64'),
    };
}

// Function to generate distorted text
function generateDistortedText(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
}

export default {
    data: new SlashCommandBuilder()
        .setName('sendpmessage')
        .setDescription('Send an encrypted message in public chats')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The message to encrypt')
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
                    ephemeral: true,
                });
            }

            const messageText = interaction.options.getString('text');
            const whitelistData = await loadJSON(whitelistPath, { users: [] });
            const whitelist = whitelistData.users;

            // Encrypt the message
            const encrypted = encryptText(messageText);

            // Limit the encrypted content size to fit within Discord's max length
            const encryptedContent = encrypted.content.slice(0, 1000); // Truncate to 1000 characters

            // Generate a shorter distorted version
            const distortedText = generateDistortedText(Math.min(messageText.length, 1000));

            // Create the message content
            let content = '';

            // Add hidden encrypted data without zero-width characters
            content += `||${JSON.stringify({
                iv: encrypted.iv,
                content: encryptedContent,
            })}||`;

            // Add visible content in the public chat (distorted text)
            content += `\n🔒 Encrypted Message: ${distortedText}`;

            // Send the encrypted message to the public chat
            await interaction.channel.send({
                content,
                allowedMentions: { parse: [] },
            });

            // Acknowledge the interaction privately without public output
            await interaction.deferReply({ ephemeral: true });
            await interaction.deleteReply(); // Deletes the ephemeral acknowledgment instantly

            // Check if the sender is whitelisted
            const isWhitelisted = whitelist.includes(requesterId);

            // Send the decrypted message as a DM to the whitelisted users and the sender
            if (isWhitelisted) {
                const decryptedMessage = {
                    iv: encrypted.iv,
                    content: encrypted.content,
                };

                const usersToNotify = [requesterId, ...whitelist];
                const uniqueUserIds = [...new Set(usersToNotify)];

                for (const userId of uniqueUserIds) {
                    const user = await interaction.client.users.fetch(userId);
                    await user.send({
                        content: `🔓 Decrypted Message: ${messageText}\n(Only you can see this message.)`,
                    });
                }
            }
        } catch (error) {
            console.error('Error sending encrypted message:', error);
            return interaction.reply({
                content: '❌ There was an error processing your encrypted message.',
                ephemeral: true,
            });
        }
    },
};
