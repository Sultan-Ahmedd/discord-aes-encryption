// InteractionHandler.js

import { 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
} from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const crossServersPath = path.join(__dirname, 'data', 'cross_servers_list.json');

/**
 * Utility function to load JSON data from a file.
 * If the file doesn't exist, it creates one with the provided default data.
 *
 * @param {string} filePath - The path to the JSON file.
 * @param {any} defaultData - The default data to write if the file doesn't exist.
 * @returns {Promise<any>} - The parsed JSON data.
 */
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

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isButton()) {
            // Handle the initial "Reply" button click
            if (
                interaction.customId.startsWith('reply_') && 
                !interaction.customId.startsWith('reply_person_') && 
                !interaction.customId.startsWith('reply_channel_') && 
                !interaction.customId.startsWith('send_message_')
            ) {
                // Extract the messageId from the customId
                // Expected format: 'reply_{messageId}'
                const parts = interaction.customId.split('_');
                const messageId = parts.slice(1).join('_'); // In case messageId contains underscores

                // Fetch the original message context using messageId
                const crossServersData = await loadJSON(crossServersPath, []);

                const targetEntry = crossServersData.find(entry => 
                    entry.sent_message_id === messageId
                );

                if (!targetEntry) {
                    await interaction.reply({ content: '❌ Unable to find the original sending information.', ephemeral: true });
                    return;
                }

                // Create a "Reply to Person", "Reply to Channel", and "Send a DM" buttons
                const replyToPersonButton = new ButtonBuilder()
                    .setCustomId(`reply_person_${messageId}`)
                    .setLabel('Reply to the Person')
                    .setStyle(ButtonStyle.Primary);

                const replyToChannelButton = new ButtonBuilder()
                    .setCustomId(`reply_channel_${messageId}`)
                    .setLabel('Reply to Channel')
                    .setStyle(ButtonStyle.Secondary);

                const sendMessageButton = new ButtonBuilder()
                    .setCustomId(`send_message_${messageId}`)
                    .setLabel('Send a Message in DMs')
                    .setStyle(ButtonStyle.Success);

                const actionRow = new ActionRowBuilder().addComponents(
                    replyToPersonButton,
                    replyToChannelButton,
                    sendMessageButton
                );

                // Disable the initial "Reply" button to prevent multiple interactions
                const disabledReplyButton = ButtonBuilder.from(interaction.message.components[0].components[0])
                    .setDisabled(true);

                const disabledActionRow = new ActionRowBuilder().addComponents(disabledReplyButton);

                // Update the original message to disable the "Reply" button and add the new reply options
                await interaction.update({
                    components: [disabledActionRow, actionRow]
                });

                return;
            } 
            // Handle specific reply method buttons
            else if (
                interaction.customId.startsWith('reply_person_') || 
                interaction.customId.startsWith('reply_channel_') || 
                interaction.customId.startsWith('send_message_')
            ) {
                // Extract the action and messageId from the customId
                // Expected formats:
                // 'reply_person_{messageId}'
                // 'reply_channel_{messageId}'
                // 'send_message_{messageId}'
                const parts = interaction.customId.split('_');
                const action = parts[1]; // 'person', 'channel', or 'message'
                const messageId = parts.slice(2).join('_'); // In case messageId contains underscores

                // Fetch the original message context using messageId
                const crossServersData = await loadJSON(crossServersPath, []);

                const targetEntry = crossServersData.find(entry => 
                    entry.sent_message_id === messageId
                );

                if (!targetEntry) {
                    await interaction.reply({ content: '❌ Unable to find the original sending information.', ephemeral: true });
                    return;
                }

                // Create unique identifiers for the modal
                const timestamp = Date.now();
                const modalCustomId = `reply_modal_${action}_${messageId}_${timestamp}`;

                // Store necessary data in a Map for later retrieval
                if (!interaction.client.messageContextMap) {
                    interaction.client.messageContextMap = new Map();
                }

                interaction.client.messageContextMap.set(modalCustomId, {
                    replyMethod: action, // 'person', 'channel', or 'dm'
                    sending_serverID: targetEntry.sending_serverID,
                    sending_channelID: targetEntry.sending_channelID,
                    sending_person: targetEntry.sending_person
                });

                // Create the modal for message input
                const modal = new ModalBuilder()
                    .setCustomId(modalCustomId)
                    .setTitle('Your Reply');

                const customUserInput = new TextInputBuilder()
                    .setCustomId('custom_user_input')
                    .setLabel('Custom User (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const messageInput = new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Message')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(customUserInput);
                const secondActionRow = new ActionRowBuilder().addComponents(messageInput);

                modal.addComponents(firstActionRow, secondActionRow);

                await interaction.showModal(modal);
            }
        } 
        else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('reply_modal_')) {
                const parts = interaction.customId.split('_');
                const action = parts[2]; // 'person', 'channel', or 'message'
                const messageId = parts[3];
                const timestamp = parts[4];
                const modalCustomId = interaction.customId;

                const context = interaction.client.messageContextMap.get(modalCustomId);
                if (!context) {
                    await interaction.reply({ content: '❌ Unable to retrieve message context.', ephemeral: true });
                    return;
                }

                const customUser = interaction.fields.getTextInputValue('custom_user_input') || '[Encrypted]';
                const messageContent = interaction.fields.getTextInputValue('message_input');

                let sendingGuild;
                try {
                    sendingGuild = await interaction.client.guilds.fetch(context.sending_serverID);
                    if (!sendingGuild) {
                        throw new Error('Sending guild not found.');
                    }
                } catch (error) {
                    console.error('Error fetching sending guild:', error);
                    await interaction.reply({ content: '❌ Unable to find the sending server.', ephemeral: true });
                    return;
                }

                let targetChannel;
                try {
                    targetChannel = await sendingGuild.channels.fetch(context.sending_channelID);
                    if (!targetChannel || !targetChannel.isTextBased()) {
                        throw new Error('Target channel not found or is not text-based.');
                    }
                } catch (error) {
                    console.error('Error fetching target channel:', error);
                    await interaction.reply({ content: '❌ Unable to find the target channel in the sending server.', ephemeral: true });
                    return;
                }

                const replyEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle(customUser)
                    .addFields(
                        { name: 'Message', value: messageContent }
                    )
                    .setTimestamp();

                try {
                    if (context.replyMethod === 'person') {
                        await targetChannel.send({ content: `<@${context.sending_person}>`, embeds: [replyEmbed] });
                    } else if (context.replyMethod === 'channel') {
                        await targetChannel.send({ embeds: [replyEmbed] });
                    } else if (context.replyMethod === 'message') {
                        const user = await interaction.client.users.fetch(context.sending_person);
                        await user.send({ embeds: [replyEmbed] });
                    } else {
                        // Handle cases where replyMethod is undefined
                        await targetChannel.send({ embeds: [replyEmbed] });
                    }

                    await interaction.reply({ content: '✅ Your reply has been sent.', ephemeral: true });
                } catch (error) {
                    console.error('Error sending reply:', error);
                    await interaction.reply({ content: '❌ There was an error sending your reply.', ephemeral: true });
                }

                interaction.client.messageContextMap.delete(modalCustomId);
            }
        }
    }
};
