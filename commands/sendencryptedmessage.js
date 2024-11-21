// commands/sendencryptedmessage.js

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
function encryptMessage(message, secretKeyBase64) {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);

    // Convert the base64 key to a buffer and ensure it is exactly 32 bytes
    const keyBuffer = Buffer.from(secretKeyBase64, 'base64');
    if (keyBuffer.length !== 32) {
        throw new Error('Secret key must be 32 bytes for AES-256 encryption.');
    }

    // Create a cipher with the provided key and IV
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

    let encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Return the encrypted message along with the IV for decryption (both in base64)
    return { 
        encryptedMessage: encrypted, 
        iv: iv.toString('base64') 
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('sendencryptedmessage')
        .setDescription('Send an encrypted message to whitelisted users')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            // Defer the reply to give the bot time to process
            await interaction.deferReply({ ephemeral: true });

            const accessData = await loadJSON(accessPath, { userIds: [] });
            const requesterId = interaction.user.id;

            // Check if the requester has access
            if (!accessData.userIds.includes(requesterId)) {
                return interaction.editReply({
                    content: '❌ You do not have permission to use this command.',
                });
            }

            // Load whitelist data
            const whitelistData = await loadJSON(whitelistPath, { users: [] });
            const whitelist = whitelistData.users;

            // Get the message
            const messageText = interaction.options.getString('message');

            // Hardcoded secret key (Base64-encoded 32-byte key)
            const secretKeyBase64 = process.env.ENCRYPTION_KEY || 'f44KFCOk+T5svYt+qW6F8WPVqcmvmjntw3J7G4wtR34=';

            // Encrypt the message
            const { encryptedMessage, iv } = encryptMessage(messageText, secretKeyBase64);

            // Send encrypted messages to whitelisted users and the sender
            const usersToNotify = [requesterId, ...whitelist];
            const uniqueUserIds = [...new Set(usersToNotify)];

            // Track successful and failed message sends
            const successfulSends = [];
            const failedSends = [];

            // Send encrypted messages
            for (const userId of uniqueUserIds) {
                try {
                    const user = await interaction.client.users.fetch(userId);
                    await user.send({
                        content: `🔒 Encrypted Message:
\`\`\`plaintext
${encryptedMessage}
IV: ${iv}
Secret Key: (Private)
\`\`\``
                    });
                    successfulSends.push(userId);
                } catch (error) {
                    console.error(`Error sending encrypted message to user ${userId}:`, error);
                    failedSends.push(userId);
                }
            }

            // Provide feedback about message distribution
            let replyContent = '✅ Encrypted message sent successfully.';
            if (failedSends.length > 0) {
                replyContent += `\n❌ Failed to send to ${failedSends.length} user(s).`;
            }

            return interaction.editReply({ content: replyContent });

        } catch (error) {
            console.error('Error sending encrypted message:', error);
            return interaction.editReply({
                content: '❌ There was an error processing your encrypted message.',
            });
        }
    },
};