import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} from '@discordjs/voice';

export const handleFirechickenCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (unquotedContent.toLowerCase() !== '-firechicken') {
        return false;
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
        message.reply('Join a voice channel first.');
        return true;
    }
    if (voiceChannel.type === 'GUILD_STAGE_VOICE') {
        message.reply('Stage channels are not supported for firechicken.');
        return true;
    }

    if (ffmpegPath && !process.env.FFMPEG_PATH) {
        process.env.FFMPEG_PATH = ffmpegPath;
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    connection.on('error', (error) => {
        console.error('Voice connection error:', error);
    });

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch (error) {
        console.error('Voice connection failed:', error);
        connection.destroy();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        message.reply(`Failed to join the voice channel: ${errorMessage}`);
        return true;
    }

    const player = createAudioPlayer();
    const audioPath = path.join('src', 'audio', 'firechicken.mp3');
    const resource = createAudioResource(audioPath);

    connection.subscribe(player);
    player.play(resource);

    player.on('error', (error) => {
        console.error('Audio player error:', error);
        connection.destroy();
    });

    player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
    });

    return true;
};
