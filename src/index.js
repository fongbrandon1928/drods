import dotenv from 'dotenv';
dotenv.config();

import { Client, Intents } from 'discord.js';
import { handleMapleCommand } from './commands/maple.js';

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.MESSAGE_CONTENT
    ]
});

client.on('messageCreate', async (message) => {
    if (message.author?.bot) return;
    if (message.content?.trim() === '-test') {
        message.reply('Test received!');
    }

    await handleMapleCommand(message);
});

client.login(process.env.DISCORD_TOKEN);
