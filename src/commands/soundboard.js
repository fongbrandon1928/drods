import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {
    AudioPlayerStatus,
    StreamType,
    createAudioPlayer,
    createAudioResource,
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
    VoiceConnectionStatus
} from '@discordjs/voice';
import { MessageActionRow, MessageButton } from 'discord.js';

const SOUND_DIR = path.join('src', 'audio');
const SOUND_EXTENSIONS = ['.ogg', '.mp3'];
const BUTTON_PREFIX = 'sb:';
const LEAVE_BUTTON_ID = 'sb:leave';
const MAX_BUTTONS = 25;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const playersByGuild = new Map();
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
        const player = playersByGuild.get(guildId);
        player?.stop(true);
        playersByGuild.delete(guildId);
        inactivityTimeoutsByGuild.delete(guildId);
    }, INACTIVITY_TIMEOUT_MS);
    inactivityTimeoutsByGuild.set(guildId, timeout);
};

const getSoundNames = () => {
    if (!fs.existsSync(SOUND_DIR)) return [];
    const names = new Set();
    for (const file of fs.readdirSync(SOUND_DIR)) {
        const lower = file.toLowerCase();
        const ext = SOUND_EXTENSIONS.find((extension) => lower.endsWith(extension));
        if (!ext) continue;
        names.add(path.basename(file, ext));
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
};

const buildSoundboardRows = (soundNames) => {
    const rows = [];
    const maxSounds = soundNames.slice(0, MAX_BUTTONS);
    for (let i = 0; i < maxSounds.length; i += 5) {
        const chunk = maxSounds.slice(i, i + 5);
        const row = new MessageActionRow().addComponents(
            chunk.map((name) =>
                new MessageButton()
                    .setCustomId(`${BUTTON_PREFIX}${name}`)
                    .setLabel(name.slice(0, 80))
                    .setStyle('PRIMARY')
            )
        );
        rows.push(row);
    }
    rows.push(
        new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(LEAVE_BUTTON_ID)
                .setLabel('Leave')
                .setStyle('DANGER')
        )
    );
    return rows;
};

const ensureFfmpegPath = () => {
    if (ffmpegPath && !process.env.FFMPEG_PATH) {
        process.env.FFMPEG_PATH = ffmpegPath;
    }
};

const resolveSoundPath = (soundName) => {
    for (const extension of SOUND_EXTENSIONS) {
        const candidate = path.join(SOUND_DIR, `${soundName}${extension}`);
        if (fs.existsSync(candidate)) {
            return { path: candidate, extension };
        }
    }
    return null;
};

const getOrCreatePlayer = (guildId) => {
    const existing = playersByGuild.get(guildId);
    if (existing) return existing;
    const player = createAudioPlayer();
    player.setMaxListeners(25);
    player.on(AudioPlayerStatus.Playing, () => {
        clearInactivityDisconnect(guildId);
    });
    player.on(AudioPlayerStatus.Idle, () => {
        scheduleInactivityDisconnect(guildId);
    });
    player.on('error', (error) => {
        console.error('Audio player error:', error);
        clearInactivityDisconnect(guildId);
        playersByGuild.delete(guildId);
        const activeConnection = getVoiceConnection(guildId);
        activeConnection?.destroy();
    });
    playersByGuild.set(guildId, player);
    return player;
};

const playSoundForMember = async (member, reply, soundName) => {
    if (!/^[a-z0-9_-]+$/i.test(soundName)) {
        await reply('Sound name must be letters, numbers, underscores, or dashes.');
        return true;
    }

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
        await reply('Join a voice channel first.');
        return true;
    }
    if (voiceChannel.type === 'GUILD_STAGE_VOICE') {
        await reply('Stage channels are not supported for soundboard.');
        return true;
    }

    const resolved = resolveSoundPath(soundName);
    if (!resolved) {
        await reply(`Sound not found: ${soundName}`);
        return true;
    }

    ensureFfmpegPath();

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
            console.error('Voice connection error:', error);
        });
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
        } catch (error) {
            console.error('Voice connection failed:', error);
            connection.destroy();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await reply(`Failed to join the voice channel: ${errorMessage}`);
            return true;
        }
    }

    const player = getOrCreatePlayer(guildId);
    const inputType =
        resolved.extension === '.ogg' ? StreamType.OggOpus : StreamType.Arbitrary;
    const resource = createAudioResource(fs.createReadStream(resolved.path), {
        inputType
    });

    clearInactivityDisconnect(guildId);
    connection.subscribe(player);
    player.play(resource);

    return true;
};

export const handleSoundboardCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    const lowerContent = unquotedContent.toLowerCase();
    if (!(lowerContent === '-sb' || lowerContent.startsWith('-sb '))) {
        return false;
    }
    const parts = unquotedContent.split(/\s+/);
    const soundName = parts[1]?.trim();
    if (!soundName) {
        message.reply('Usage: -sb <soundname>');
        return true;
    }

    return playSoundForMember(message.member, (content) => message.reply(content), soundName);
};

export const handleSoundboardPanelCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (unquotedContent.toLowerCase() !== '-sbpanel') {
        return false;
    }

    const soundNames = getSoundNames();
    if (soundNames.length === 0) {
        message.reply('No sounds available.');
        return true;
    }

    const rows = buildSoundboardRows(soundNames);
    await message.reply({ content: 'Soundboard:', components: rows });
    return true;
};

export const handleSoundboardButton = async (interaction) => {
    if (!interaction.isButton()) return false;
    if (!interaction.customId.startsWith(BUTTON_PREFIX)) return false;

    await interaction.deferUpdate();
    if (interaction.customId === LEAVE_BUTTON_ID) {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            await interaction.followUp({ content: 'Join a voice channel first.', ephemeral: true });
            return true;
        }
        const botMember = voiceChannel.guild?.members?.cache?.get(interaction.client.user?.id);
        if (botMember?.voice?.channelId === voiceChannel.id) {
            const guildId = voiceChannel.guild.id;
            clearInactivityDisconnect(guildId);
            playersByGuild.get(guildId)?.stop(true);
            playersByGuild.delete(guildId);
            botMember.voice.disconnect();
            await interaction.followUp({ content: 'Disconnected.', ephemeral: true });
            return true;
        }
        await interaction.followUp({ content: 'I am not in your voice channel.', ephemeral: true });
        return true;
    }

    const soundName = interaction.customId.slice(BUTTON_PREFIX.length);
    await playSoundForMember(
        interaction.member,
        async (content) => {
            await interaction.followUp({ content, ephemeral: true });
        },
        soundName
    );
    return true;
};
