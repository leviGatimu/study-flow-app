'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { saveUpload, deleteUpload, MAX_AUDIO_UPLOAD_BYTES } from '@/lib/upload';

export async function getSongs() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.song.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });
}

/**
 * Upload a single song. Expects FormData with:
 *  - audio: File (required)
 *  - cover: File (optional album art, usually extracted from ID3 tags client-side)
 *  - title / artist / duration: strings (parsed from tags or filename client-side)
 */
export async function uploadSong(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const audio = formData.get('audio') as File;
  const cover = formData.get('cover') as File | null;
  const title = ((formData.get('title') as string) || '').trim();
  const artist = ((formData.get('artist') as string) || '').trim();
  const lyrics = ((formData.get('lyrics') as string) || '').trim();
  const duration = parseFloat((formData.get('duration') as string) || '');

  if (!audio || audio.size === 0) return { error: 'No audio file provided.' };

  let audioUrl: string;
  try {
    audioUrl = await saveUpload(audio, 'song', MAX_AUDIO_UPLOAD_BYTES);
  } catch (e: any) {
    return { error: e.message || 'Failed to upload audio.' };
  }

  let coverUrl: string | undefined;
  if (cover && cover.size > 0) {
    try {
      coverUrl = await saveUpload(cover, 'cover');
    } catch {
      // Cover art is a nice-to-have; the song still uploads without it.
    }
  }

  const song = await prisma.song.create({
    data: {
      userId,
      title: title || audio.name.replace(/\.[^.]+$/, ''),
      artist: artist || null,
      audioUrl,
      coverUrl: coverUrl || null,
      duration: Number.isFinite(duration) ? duration : null,
      lyrics: lyrics || null
    }
  });

  revalidatePath('/focus');
  return { success: true, song };
}

/** Cache lyrics fetched client-side (LRCLIB) so they never need re-fetching. */
export async function saveSongLyrics(songId: string, lyrics: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const result = await prisma.song.updateMany({
    where: { id: songId, userId },
    data: { lyrics }
  });
  if (result.count === 0) return { error: 'Song not found.' };
  return { success: true };
}

export async function updateSongCover(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const songId = formData.get('songId') as string;
  const cover = formData.get('cover') as File;
  if (!songId || !cover || cover.size === 0) return { error: 'Missing cover image.' };

  const song = await prisma.song.findFirst({ where: { id: songId, userId } });
  if (!song) return { error: 'Song not found.' };

  let coverUrl: string;
  try {
    coverUrl = await saveUpload(cover, 'cover');
  } catch (e: any) {
    return { error: e.message || 'Failed to upload cover.' };
  }

  await deleteUpload(song.coverUrl);
  const updated = await prisma.song.update({ where: { id: songId }, data: { coverUrl } });

  revalidatePath('/focus');
  return { success: true, song: updated };
}

export async function deleteSong(songId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const song = await prisma.song.findFirst({ where: { id: songId, userId } });
  if (!song) return { error: 'Song not found.' };

  await prisma.song.delete({ where: { id: songId } });
  await deleteUpload(song.audioUrl);
  await deleteUpload(song.coverUrl);

  revalidatePath('/focus');
  return { success: true };
}

/** Save an online (Audius) track into the library so it can be liked, queued and added to playlists. */
export async function saveOnlineSong(track: {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  artworkUrl?: string;
  streamUrl?: string;
}) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  if (!track?.id) return { error: 'Invalid track.' };

  const existing = await prisma.song.findFirst({
    where: { userId, externalId: track.id, sourceType: 'AUDIUS' },
  });
  if (existing) return { success: true, song: existing };

  const song = await prisma.song.create({
    data: {
      userId,
      title: track.title || 'Untitled',
      artist: track.artist || null,
      audioUrl: track.streamUrl || '',
      coverUrl: track.artworkUrl || null,
      duration: Number.isFinite(track.duration) ? track.duration! : null,
      sourceType: 'AUDIUS',
      externalId: track.id,
    },
  });

  revalidatePath('/focus');
  return { success: true, song };
}

// ----- Playlists -----

/** Return the user's playlists as lightweight membership lists. */
export async function getPlaylists() {
  const userId = await getUserId();
  if (!userId) return [];

  const playlists = await prisma.playlist.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { songs: { select: { id: true } } },
  });

  return playlists.map((p) => ({
    id: p.id,
    name: p.name,
    songIds: p.songs.map((s) => s.id),
  }));
}

export async function createPlaylist(name: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const trimmed = (name || '').trim().slice(0, 80) || 'New Playlist';
  const playlist = await prisma.playlist.create({ data: { userId, name: trimmed } });

  revalidatePath('/focus');
  return { success: true, playlist: { id: playlist.id, name: playlist.name, songIds: [] as string[] } };
}

export async function renamePlaylist(playlistId: string, name: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const trimmed = (name || '').trim().slice(0, 80);
  if (!trimmed) return { error: 'Name is required.' };

  const result = await prisma.playlist.updateMany({
    where: { id: playlistId, userId },
    data: { name: trimmed },
  });
  if (result.count === 0) return { error: 'Playlist not found.' };

  revalidatePath('/focus');
  return { success: true };
}

export async function deletePlaylist(playlistId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  // Deleting a playlist only removes the grouping — the songs stay in the library.
  const result = await prisma.playlist.deleteMany({ where: { id: playlistId, userId } });
  if (result.count === 0) return { error: 'Playlist not found.' };

  revalidatePath('/focus');
  return { success: true };
}

/** Add or remove a single song from a playlist (membership toggle). */
export async function setSongInPlaylist(playlistId: string, songId: string, include: boolean) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const playlist = await prisma.playlist.findFirst({ where: { id: playlistId, userId }, select: { id: true } });
  if (!playlist) return { error: 'Playlist not found.' };

  const song = await prisma.song.findFirst({ where: { id: songId, userId }, select: { id: true } });
  if (!song) return { error: 'Song not found.' };

  await prisma.playlist.update({
    where: { id: playlistId },
    data: { songs: include ? { connect: { id: songId } } : { disconnect: { id: songId } } },
  });

  revalidatePath('/focus');
  return { success: true };
}
