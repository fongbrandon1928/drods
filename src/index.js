import dotenv from 'dotenv';
dotenv.config();

import { Client, Intents } from 'discord.js';
import { handleHelpCommand } from './commands/help.js';
import { handleMapleCommand } from './commands/maple.js';
import { handleBloodwashCommand } from './commands/bloodwash.js';
import { handlePartyrollCommand } from './commands/partyroll.js';
import path from 'node:path';

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.MESSAGE_CONTENT
    ],
    allowedMentions: {
        parse: [],
        repliedUser: false
    }
});

client.once('ready', () => {
    if (client.user) {
        client.user.setActivity('-help');
    }
});

client.on('messageCreate', async (message) => {
    if (message.author?.bot) return;
    if (message.content?.trim() === '-test') {
        message.reply('Test received!');
    }
    
    const handledHelp = await handleHelpCommand(message);
    if (handledHelp) return;

    const handledMaple = await handleMapleCommand(message);
    if (handledMaple) return;

    const handledBloodwash = await handleBloodwashCommand(message);
    if (handledBloodwash) return;

    const handledPartyroll = await handlePartyrollCommand(message);
    if (handledPartyroll) return;

    const rawContent = message.content?.trim() || '';
    if (rawContent.startsWith('-')) {
        message.reply('Invalid command: You can enter "-help" to display all valid commands.');
    }

    // Ilia is happy
    const contentLower = message.content?.toLowerCase() || '';
    if (contentLower.includes('ilia')) {
        message.reply({
            files: [path.join('src', 'images', 'ilia.png')]
        });
        return;
    }
    if (contentLower.includes('valtarius')) {
        message.reply({
            files: [path.join('src', 'images', 'valtarius.png')]
        });
        return;
    }
    if (contentLower.includes('dahs')) {
        message.reply('not david');
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
