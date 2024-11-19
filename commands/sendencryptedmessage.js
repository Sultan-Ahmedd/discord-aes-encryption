import { SlashCommandBuilder } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import crypto from 'crypto';

// Helper function to generate a random 6-character string
function generateRandomName() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomName = '';
    for (let i = 0; i < 6; i++) {
        randomName += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `aes256 {${randomName}}`;
}

// Helper function to encrypt a message with AES-256
function encryptMessage(message, secretKeyBase64) {
    const algorithm = 'aes-256-cbc'; // AES-256 with CBC mode
    const iv = crypto.randomBytes(16); // Initialization vector

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
    return { encryptedMessage: encrypted, iv: iv.toString('base64') };
}

export default {
    data: new SlashCommandBuilder()
        .setName('sendencryptedmessage')
        .setDescription('Send an encrypted message to the encrypted channel')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('show-user')
                .setDescription('Whether to include the username in the embed title')
                .setRequired(false) // The boolean option is not required
        ),
    
    async execute(interaction) {
        try {
            // Retrieve the message input from the user
            const messageContent = interaction.options.getString('message');
            const showUser = interaction.options.getBoolean('show-user') ?? false; // Default to false if not provided

            // Encryption key (this should be a 32-byte key for AES-256) in Base64 format
            const secretKeyBase64 = 'f44KFCOk+T5svYt+qW6F8WPVqcmvmjntw3J7G4wtR34='; // Correct 32-byte key in base64 format

            // Encrypt the message
            const { encryptedMessage, iv } = encryptMessage(messageContent, secretKeyBase64);

            // Read the encrypted channel ID from the file
            const filePath = path.join(process.cwd(), 'data', 'encryptedchannelid.json');
            let encryptedChannelId;

            // Check if the file exists and parse it
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                encryptedChannelId = data.channelId;
            } else {
                return interaction.reply({ content: 'Encrypted channel not set. Please configure the encrypted channel first.', ephemeral: true });
            }

            // Retrieve the encrypted channel by ID
            const channel = await interaction.client.channels.fetch(encryptedChannelId);
            if (!channel) {
                return interaction.reply({ content: 'Encrypted channel not found. Please ensure the channel is set correctly.', ephemeral: true });
            }

            // Create a webhook in the channel to send the message
            let webhook = await channel.fetchWebhooks();
            webhook = webhook.find(wh => wh.name === 'AnonWebhook');

            if (!webhook) {
                // If the webhook doesn't exist, create a new one
                webhook = await channel.createWebhook({
                    name: 'AnonWebhook',
                    avatar: 'https://i.imgur.com/AfFp7pu.png', // Optional: You can change the avatar URL to anything you like
                });
            }

            // Determine the webhook name (either random or username)
            let webhookUsername;
            if (showUser) {
                webhookUsername = interaction.user.username; // Use the user's username
            } else {
                webhookUsername = generateRandomName(); // Use a randomly generated name
            }

            // Send the encrypted message to the encrypted channel as a webhook
            await webhook.send({
                content: `Encrypted message: ${encryptedMessage}\nIV: ${iv}\nSecret Key (Base64): ${secretKeyBase64}`, // Sending encrypted message, IV, and secret key in base64
                username: webhookUsername,
                avatarURL: 'https://i.imgur.com/OZKRaRi.png', // Optional: Change the avatar to something you want
            });

            // Confirm that the message was sent
            return interaction.reply({ content: 'Encrypted message sent successfully!', ephemeral: true });

        } catch (error) {
            console.error('Error sending encrypted message:', error);
            return interaction.reply({ content: 'There was an error sending the encrypted message. Please try again later.', ephemeral: true });
        }
    },
};
