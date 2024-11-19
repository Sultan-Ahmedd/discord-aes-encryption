// Import required modules
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
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

// Load commands from the 'commands' folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load commands using URL-based imports
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const fileUrl = new URL(`file://${filePath}`).href;
  const command = await import(fileUrl);
  client.commands.set(command.default.data.name, command.default);
}

// When the bot is logged in and ready
client.once('ready', () => {
  console.log('Bot is online!');
});

// Handle interaction events (for slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

// Log in to Discord with your app's token from the environment variable
client.login(process.env.DISCORD_BOT_TOKEN);