// index.js

import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import interactionHandler from './InteractionHandler.js';

// Import your logging modules
import crossServerChatting from './logging/cross-server-chatting.js';
import crossServerMessaging from './logging/cross-server-messaging.js';
import specificCrossServerMessaging from './logging/specific-cross-server-messaging.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.commands = new Collection();
client.messageContextMap = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
try {
  await fs.access(dataDir);
} catch {
  await fs.mkdir(dataDir);
}

const crossServersPath = path.join(dataDir, 'cross_servers_list.json');
try {
  await fs.access(crossServersPath);
} catch {
  await fs.writeFile(crossServersPath, JSON.stringify([], null, 2));
}

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
    const fileUrl = `file://${filePath}`;
    const command = await import(fileUrl);

    if (command.default && command.default.data && command.default.data.name) {
      client.commands.set(command.default.data.name, command.default);
    } else {
      console.warn(
        `Warning: The command at ${filePath} is missing a 'data' property or 'data.name'.`
      );
    }
  }
}

// Initialize logging modules
crossServerChatting(client);         // For cross-server chatting
crossServerMessaging(client);        // For logging from all channels
specificCrossServerMessaging(client); // For logging from specific channels

client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interactionHandler.name === Events.InteractionCreate) {
    await interactionHandler.execute(interaction);
  }

  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
