import { SlashCommandBuilder } from '@discordjs/builders';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const whitelistPath = path.join(__dirname, '..', 'data', 'whitelist.json');

// Function to load whitelist
async function loadWhitelist() {
    try {
        const data = await fs.readFile(whitelistPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return { users: [] }; // If the file doesn't exist or can't be read, return an empty whitelist
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
        content: encrypted.toString('base64')
    };
}

// Function to decrypt text using AES-256-CBC
function decryptText(hash) {
    const algorithm = 'aes-256-cbc';
    const secretKeyBase64 = process.env.ENCRYPTION_KEY || 'f44KFCOk+T5svYt+qW6F8WPVqcmvmjntw3J7G4wtR34=';

    // Convert the base64 key to a buffer and ensure it is exactly 32 bytes
    const keyBuffer = Buffer.from(secretKeyBase64, 'base64');
    if (keyBuffer.length !== 32) {
        throw new Error('Secret key must be 32 bytes for AES-256 encryption.');
    }

    const decipher = crypto.createDecipheriv(
        algorithm,
        keyBuffer,
        Buffer.from(hash.iv, 'base64')
    );

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(hash.content, 'base64')),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
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
        const messageText = interaction.options.getString('text');
        const whitelist = await loadWhitelist();

        // Encrypt the message
        const encrypted = encryptText(messageText);

        // Limit the encrypted content size to fit within Discord's max length
        const encryptedContent = encrypted.content.slice(0, 1000);  // Truncate to 1000 characters

        // Generate a shorter distorted version
        const distortedText = generateDistortedText(Math.min(messageText.length, 1000));

        // Create the message content
        let content = '';

        // Add hidden encrypted data (truncated if necessary)
        content += `||​${JSON.stringify({
            iv: encrypted.iv,
            content: encryptedContent,
        })}​||`;

        // Add visible content in the public chat (distorted text)
        content += `\n🔒 Encrypted Message: ${distortedText}`;

        // Send the encrypted message to the public chat
        await interaction.reply({
            content,
            allowedMentions: { parse: [] }
        });

        // Get the whitelisted users
        const isWhitelisted = whitelist.users.includes(interaction.user.id);

        // Send the decrypted message as a DM to the whitelisted users and the sender
        if (isWhitelisted || interaction.user.id === interaction.user.id) {
            const decryptedMessage = decryptText({
                iv: encrypted.iv,
                content: encrypted.content,
            });

            // Send the decrypted message as a DM to the user who sent the message and the whitelisted users
            try {
                const usersToNotify = [interaction.user.id, ...whitelist.users];

                for (const userId of usersToNotify) {
                    const user = await interaction.client.users.fetch(userId);
                    await user.send({
                        content: `🔓 Decrypted Message: ${decryptedMessage}\n(Only you can see this message.)`
                    });
                }
            } catch (error) {
                console.error('Error sending DM:', error);
            }
        }
    },
};
