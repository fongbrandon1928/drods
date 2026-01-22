import dotenv from 'dotenv';
dotenv.config();

import path from 'node:path';
import { Client, Intents } from 'discord.js';
import { handleHelpCommand } from './commands/help.js';
import { handleMapleCommand } from './commands/maple.js';
import { handleBloodwashCommand } from './commands/bloodwash.js';
import { handlePartyrollCommand } from './commands/partyroll.js';

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.MESSAGE_CONTENT,
        Intents.FLAGS.GUILD_VOICE_STATES
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

    // Ilia is happy
    const contentLower = message.content?.toLowerCase() || '';
    if (contentLower.includes('ilia')) {
        message.reply('gay');
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
});

const sendVoiceChannelMessage = async (voiceChannel, content) => {
    if (!voiceChannel) return;
    if (typeof voiceChannel.send === 'function') {
        await voiceChannel.send(content);
        return;
    }
    const textChannel = voiceChannel.guild?.channels?.cache?.find(
        (channel) => channel.isText && channel.isText() && channel.name === voiceChannel.name
    );
    if (textChannel) {
        await textChannel.send(content);
        return;
    }
    const fallbackChannel = voiceChannel.guild?.systemChannel;
    if (fallbackChannel) {
        await fallbackChannel.send(content);
    }
};

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.member?.user?.bot) return;
    if (!newState.channelId || newState.channelId === oldState.channelId) return;

    const username = newState.member?.user?.username?.toLowerCase() || '';
    const displayName = newState.member?.displayName?.toLowerCase() || '';
    if (username !== '.jeesoo' && displayName !== '.jeesoo') {
        return;
    }

    await sendVoiceChannelMessage(
        newState.channel,
        'johnguy is here'
    );
});

client.login(process.env.DISCORD_TOKEN);
