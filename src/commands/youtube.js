import ffmpegPath from 'ffmpeg-static';
import play from 'play-dl';
import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
    VoiceConnectionStatus
} from '@discordjs/voice';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_QUEUE_PREVIEW_ITEMS = 10;
const MAX_PLAYLIST_ITEMS = 50;
const guildStates = new Map();
const inactivityTimeoutsByGuild = new Map();

const clearInactivityDisconnect = (guildId) => {
    const timeout = inactivityTimeoutsByGuild.get(guildId);
    if (timeout) {
        clearTimeout(timeout);
        inactivityTimeoutsByGuild.delete(guildId);
    }
};

const scheduleInactivityDisconnect = (guildId) => {
    clearInactivityDisconnect(guildId);
    const timeout = setTimeout(() => {
        const connection = getVoiceConnection(guildId);
        if (connection) {
            connection.destroy();
        }
        const state = guildStates.get(guildId);
        state?.player?.stop(true);
        guildStates.delete(guildId);
        inactivityTimeoutsByGuild.delete(guildId);
    }, INACTIVITY_TIMEOUT_MS);
    inactivityTimeoutsByGuild.set(guildId, timeout);
};

const ensureFfmpegPath = () => {
    if (ffmpegPath && !process.env.FFMPEG_PATH) {
        process.env.FFMPEG_PATH = ffmpegPath;
    }
};

const getOrCreateState = (guildId) => {
    const existing = guildStates.get(guildId);
    if (existing) return existing;
    const player = createAudioPlayer();
    player.setMaxListeners(25);
    const state = {
        player,
        queue: [],
        current: null
    };
    guildStates.set(guildId, state);

    player.on(AudioPlayerStatus.Playing, () => {
        clearInactivityDisconnect(guildId);
    });
    player.on(AudioPlayerStatus.Idle, async () => {
        const activeState = guildStates.get(guildId);
        if (!activeState) return;
        if (activeState.queue.length === 0) {
            activeState.current = null;
            scheduleInactivityDisconnect(guildId);
            return;
        }
        await playNextTrack(guildId);
    });
    player.on('error', async (error) => {
        console.error('YouTube audio player error:', error);
        const activeState = guildStates.get(guildId);
        if (!activeState) return;
        activeState.current = null;
        if (activeState.queue.length > 0) {
            await playNextTrack(guildId);
            return;
        }
        scheduleInactivityDisconnect(guildId);
    });
    return state;
};

const normalizeUrl = (value) => {
    if (!value) return '';
    return value.trim().replace(/^["']|["']$/g, '');
};

const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'live/unknown';
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const ensureMemberInSameVoiceChannel = async (member, guildId, reply) => {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
        await reply('I am not connected to a voice channel.');
        return false;
    }
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
        await reply('Join my voice channel first.');
        return false;
    }
    if (connection.joinConfig.channelId !== voiceChannel.id) {
        await reply('Join the same voice channel as me to control playback.');
        return false;
    }
    return true;
};

const connectToMemberVoice = async (member, reply) => {
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
        await reply('Join a voice channel first.');
        return null;
    }
    if (voiceChannel.type === 'GUILD_STAGE_VOICE') {
        await reply('Stage channels are not supported for YouTube playback.');
        return null;
    }

    const guildId = voiceChannel.guild.id;
    let connection = getVoiceConnection(guildId);
    if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
        if (connection) {
            connection.destroy();
        }
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });
        connection.on('error', (error) => {
            console.error('YouTube voice connection error:', error);
        });
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
        } catch (error) {
            console.error('YouTube voice connection failed:', error);
            connection.destroy();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await reply(`Failed to join the voice channel: ${errorMessage}`);
            return null;
        }
    }
    return { connection, guildId };
};

const buildTrackFromVideoInfo = (videoDetails, requestedBy) => ({
    title: videoDetails.title || 'Unknown title',
    url: `https://www.youtube.com/watch?v=${videoDetails.id}`,
    durationInSec: Number(videoDetails.durationInSec) || 0,
    requestedBy
});

const enqueueFromVideoUrl = async (url, requestedBy) => {
    const info = await play.video_basic_info(url);
    const details = info.video_details;
    if (!details?.id) {
        throw new Error('Could not read video details.');
    }
    return [buildTrackFromVideoInfo(details, requestedBy)];
};

const enqueueFromPlaylistUrl = async (url, requestedBy) => {
    const playlist = await play.playlist_info(url, { incomplete: true });
    const videos = await playlist.all_videos();
    const tracks = [];
    for (const video of videos.slice(0, MAX_PLAYLIST_ITEMS)) {
        if (!video?.id) continue;
        tracks.push({
            title: video.title || 'Unknown title',
            url: `https://www.youtube.com/watch?v=${video.id}`,
            durationInSec: Number(video.durationInSec) || 0,
            requestedBy
        });
    }
    return tracks;
};

const playNextTrack = async (guildId) => {
    const state = guildStates.get(guildId);
    if (!state) return false;
    if (state.queue.length === 0) {
        state.current = null;
        return false;
    }

    const connection = getVoiceConnection(guildId);
    if (!connection) {
        state.current = null;
        state.queue = [];
        return false;
    }

    const nextTrack = state.queue.shift();
    if (!nextTrack) {
        state.current = null;
        return false;
    }

    const stream = await play.stream(nextTrack.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(stream.stream, {
        inputType: stream.type
    });
    state.current = nextTrack;
    clearInactivityDisconnect(guildId);
    connection.subscribe(state.player);
    state.player.play(resource);
    return true;
};

const buildQueueReply = (state) => {
    const lines = [];
    if (state.current) {
        lines.push(`Now playing: ${state.current.title} (${formatDuration(state.current.durationInSec)})`);
    } else {
        lines.push('Now playing: nothing');
    }
    if (state.queue.length === 0) {
        lines.push('Queue is empty.');
        return lines.join('\n');
    }
    lines.push(`Queue length: ${state.queue.length}`);
    const preview = state.queue.slice(0, MAX_QUEUE_PREVIEW_ITEMS);
    for (const [index, item] of preview.entries()) {
        lines.push(`${index + 1}. ${item.title} (${formatDuration(item.durationInSec)})`);
    }
    if (state.queue.length > MAX_QUEUE_PREVIEW_ITEMS) {
        lines.push(`...and ${state.queue.length - MAX_QUEUE_PREVIEW_ITEMS} more.`);
    }
    return lines.join('\n');
};

const handlePlayCommand = async (message, unquotedContent) => {
    const parts = unquotedContent.split(/\s+/);
    const url = normalizeUrl(parts[1]);
    if (!url) {
        await message.reply('Usage: -yt <youtube_url>');
        return true;
    }

    const validation = play.yt_validate(url);
    if (validation !== 'video' && validation !== 'playlist') {
        await message.reply('Please provide a valid YouTube video or playlist URL.');
        return true;
    }

    ensureFfmpegPath();
    const connectionData = await connectToMemberVoice(message.member, (content) => message.reply(content));
    if (!connectionData) return true;

    const guildId = connectionData.guildId;
    const state = getOrCreateState(guildId);
    const requestedBy = message.author?.username || 'unknown';

    try {
        let newTracks = [];
        if (validation === 'video') {
            newTracks = await enqueueFromVideoUrl(url, requestedBy);
        } else {
            newTracks = await enqueueFromPlaylistUrl(url, requestedBy);
        }

        if (newTracks.length === 0) {
            await message.reply('No playable videos found in that playlist.');
            return true;
        }

        state.queue.push(...newTracks);
        clearInactivityDisconnect(guildId);
        connectionData.connection.subscribe(state.player);

        if (state.player.state.status !== AudioPlayerStatus.Playing) {
            await playNextTrack(guildId);
        }

        if (validation === 'playlist') {
            await message.reply(`Added ${newTracks.length} tracks from playlist to queue.`);
        } else {
            await message.reply(`Added to queue: ${newTracks[0].title}`);
        }
    } catch (error) {
        console.error('Failed to enqueue YouTube audio:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await message.reply(`Failed to play this YouTube URL: ${errorMessage}`);
    }
    return true;
};

const handleStopCommand = async (message, guildId) => {
    const inSameChannel = await ensureMemberInSameVoiceChannel(message.member, guildId, (content) => message.reply(content));
    if (!inSameChannel) return true;

    clearInactivityDisconnect(guildId);
    const state = guildStates.get(guildId);
    state?.player?.stop(true);
    guildStates.delete(guildId);

    const connection = getVoiceConnection(guildId);
    connection?.destroy();

    await message.reply('Stopped playback and disconnected.');
    return true;
};

const handleSkipCommand = async (message, guildId) => {
    const inSameChannel = await ensureMemberInSameVoiceChannel(message.member, guildId, (content) => message.reply(content));
    if (!inSameChannel) return true;

    const state = guildStates.get(guildId);
    if (!state || (!state.current && state.queue.length === 0)) {
        await message.reply('Nothing is currently playing.');
        return true;
    }
    state.player.stop();
    await message.reply('Skipped current track.');
    return true;
};

const handleNowPlayingCommand = async (message, guildId) => {
    const state = guildStates.get(guildId);
    if (!state || !state.current) {
        await message.reply('Nothing is currently playing.');
        return true;
    }
    await message.reply(
        `Now playing: ${state.current.title} (${formatDuration(state.current.durationInSec)})\n${state.current.url}`
    );
    return true;
};

const handleQueueCommand = async (message, guildId) => {
    const state = guildStates.get(guildId);
    if (!state) {
        await message.reply('Queue is empty.');
        return true;
    }
    await message.reply(buildQueueReply(state));
    return true;
};

export const handleYoutubeCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    const lowerContent = unquotedContent.toLowerCase();
    const firstToken = lowerContent.split(/\s+/)[0] || '';

    const isPlayCommand = lowerContent === '-yt' || lowerContent.startsWith('-yt ');
    const isStopCommand = firstToken === '-ytstop' || firstToken === '-stop';
    const isSkipCommand = firstToken === '-ytskip' || firstToken === '-skip';
    const isQueueCommand = firstToken === '-ytq' || firstToken === '-queue';
    const isNowPlayingCommand = firstToken === '-ytnp' || firstToken === '-np';
    if (!isPlayCommand && !isStopCommand && !isSkipCommand && !isQueueCommand && !isNowPlayingCommand) {
        return false;
    }

    const guildId = message.guild?.id;
    if (!guildId) {
        await message.reply('YouTube commands are only available in servers.');
        return true;
    }

    if (isPlayCommand) return handlePlayCommand(message, unquotedContent);
    if (isStopCommand) return handleStopCommand(message, guildId);
    if (isSkipCommand) return handleSkipCommand(message, guildId);
    if (isQueueCommand) return handleQueueCommand(message, guildId);
    if (isNowPlayingCommand) return handleNowPlayingCommand(message, guildId);
    return false;
};
