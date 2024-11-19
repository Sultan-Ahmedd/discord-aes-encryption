// index.js

// Import required modules
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ],
});

// Set up commands collection
client.commands = new Collection();

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
try {
    await fs.access(dataDir);
} catch {
    await fs.mkdir(dataDir);
}

// Load commands from the 'commands' folder
const commandsPath = path.join(__dirname, 'commands');
let commandFiles;
try {
    commandFiles = await fs.readdir(commandsPath);
} catch (error) {
    console.error('Error reading commands directory:', error);
    process.exit(1);
}

for (const file of commandFiles) {
    if (file.endsWith('.js')) {
        const filePath = path.join(commandsPath, file);
        const fileUrl = new URL(`file://${filePath}`).href;
        const command = await import(fileUrl);

        if (command.default && command.default.data && command.default.data.name) {
            client.commands.set(command.default.data.name, command.default);
        } else {
            console.warn(`Warning: The command at ${filePath} is missing a 'data' property or 'data.name'.`);
        }
    }
}

// Load cross-server messaging handler
import crossServerMessaging from './logging/cross-server-messaging.js';
crossServerMessaging(client);

// Load specific cross-server messaging handler
import specificCrossServerMessaging from './logging/specific-cross-server-messaging.js';
specificCrossServerMessaging(client);

// When the bot is logged in and ready
client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}!`);
});

// Handle interaction events (for slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

// Log in to Discord with your app's token from the environment variable
client.login(process.env.DISCORD_BOT_TOKEN);
