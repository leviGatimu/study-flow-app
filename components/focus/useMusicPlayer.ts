'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Song, PlaylistInfo } from '@/lib/types';
import {
  uploadSong, deleteSong as deleteSongAction, updateSongCover, saveSongLyrics,
  createPlaylist as createPlaylistAction, renamePlaylist as renamePlaylistAction,
  deletePlaylist as deletePlaylistAction, setSongInPlaylist, saveOnlineSong,
} from '@/lib/music-actions';
import { resolveOnlineStream, type OnlineTrack } from '@/lib/online-music';
import { extractSongMetadata, readAudioDuration } from '@/lib/id3';
import { extractPalette, fallbackPalette, Palette } from '@/lib/palette';
import { fetchLyricsFromLrclib } from '@/lib/lyrics';

interface MusicPlayerOptions {
  /** Master gate — music only plays while the focus session is running. */
  sessionRunning: boolean;
  muted: boolean;
  volume: number;
}

export const DEFAULT_PALETTE: Palette = ['#8e1f2f', '#1f3a8e', '#d94a5e', '#101935'];

export function useMusicPlayer(
  initialSongs: Song[],
  { sessionRunning, muted, volume }: MusicPlayerOptions,
  initialPlaylists: PlaylistInfo[] = []
) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>(initialPlaylists);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [musicOn, setMusicOn] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [uploading, setUploading] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lyricsFetchedRef = useRef<Set<string>>(new Set());
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeatOne);
  const songsRef = useRef(songs);
  const activePlaylistIdRef = useRef(activePlaylistId);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeatOne; }, [repeatOne]);
  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { activePlaylistIdRef.current = activePlaylistId; }, [activePlaylistId]);

  // The active playlist filters the full library down to a playable queue.
  // With no playlist selected the queue is simply every song.
  const activePlaylist = activePlaylistId ? playlists.find(p => p.id === activePlaylistId) ?? null : null;
  const queue = useMemo(() => {
    if (!activePlaylist) return songs;
    const ids = new Set(activePlaylist.songIds);
    return songs.filter(s => ids.has(s.id));
  }, [songs, activePlaylist]);

  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const currentSong = queue.length > 0 ? queue[Math.min(currentIndex, queue.length - 1)] : null;
  const isPlaying = sessionRunning && musicOn && !!currentSong;

  const pickNextIndex = useCallback((dir: 1 | -1) => {
    const total = queueRef.current.length;
    if (total === 0) return 0;
    setCurrentIndex(prev => {
      if (shuffleRef.current && total > 1) {
        let next = prev;
        while (next === prev) next = Math.floor(Math.random() * total);
        return next;
      }
      return (prev + dir + total) % total;
    });
  }, []);

  const next = useCallback(() => pickNextIndex(1), [pickNextIndex]);
  const prev = useCallback(() => pickNextIndex(-1), [pickNextIndex]);

  // One persistent audio element for the whole session.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    // Allow the WebAudio analyser to read both local and (CORS-enabled) online streams.
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      if (repeatRef.current) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (queueRef.current.length > 1) {
        pickNextIndex(1);
      } else {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
    };
  }, [pickNextIndex]);

  // Load the current track. Online songs resolve a fresh stream URL each time
  // (the Audius node that serves a track can change), so we never play a stale URL.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    let cancelled = false;

    (async () => {
      let src = currentSong.audioUrl;
      const online = (currentSong as any).sourceType === 'AUDIUS';
      if (online && (currentSong as any).externalId) {
        try {
          src = await resolveOnlineStream((currentSong as any).externalId);
        } catch {
          // Fall back to whatever URL we stored.
        }
      }
      if (cancelled || !src) return;
      if (!audio.src.endsWith(encodeURI(src))) {
        audio.src = src;
        setCurrentTime(0);
        setDuration(currentSong.duration || 0);
        if (isPlaying) audio.play().catch(() => {});
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  // Play / pause to match session + user intent.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      // Lazily route the element through WebAudio so the gradient can react
      // to the music. Must happen once and persist for the element's life.
      if (!audioCtxRef.current) {
        try {
          const ctx = new AudioContext();
          const source = ctx.createMediaElementSource(audio);
          const node = ctx.createAnalyser();
          node.fftSize = 256;
          node.smoothingTimeConstant = 0.82;
          source.connect(node);
          node.connect(ctx.destination);
          audioCtxRef.current = ctx;
          setAnalyser(node);
        } catch {
          // Autoplay policies or unsupported context — audio still plays.
        }
      }
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    return () => { audioCtxRef.current?.close().catch(() => {}); };
  }, []);

  // Resolve lyrics for the current song: embedded/cached first, else LRCLIB
  // (then cache to the DB so it's a one-time lookup per song).
  useEffect(() => {
    let cancelled = false;
    if (!currentSong) {
      setLyrics(null);
      return;
    }
    if (currentSong.lyrics) {
      setLyrics(currentSong.lyrics);
      return;
    }
    setLyrics(null);
    if (lyricsFetchedRef.current.has(currentSong.id)) return;
    lyricsFetchedRef.current.add(currentSong.id);

    const song = currentSong;
    fetchLyricsFromLrclib(song.title, song.artist, song.duration).then(found => {
      if (!found) return;
      if (!cancelled) setLyrics(found);
      setSongs(prevSongs => prevSongs.map(s => (s.id === song.id ? { ...s, lyrics: found } : s)));
      saveSongLyrics(song.id, found).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [currentSong?.id, currentSong?.lyrics]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = muted;
    audio.volume = volume;
  }, [muted, volume]);

  // Re-light the room: pull the palette from the current cover art.
  useEffect(() => {
    let cancelled = false;
    if (!currentSong) {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    const seed = `${currentSong.title}-${currentSong.artist ?? ''}`;
    if (currentSong.coverUrl) {
      extractPalette(currentSong.coverUrl, seed).then(p => { if (!cancelled) setPalette(p); });
    } else {
      setPalette(fallbackPalette(seed));
    }
    return () => { cancelled = true; };
  }, [currentSong?.id, currentSong?.coverUrl]);

  // Mirror the current track + palette to localStorage so the Electron mini
  // widget (a separate window) can show now-playing info and match the tint.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentSong) {
      localStorage.setItem('study-flow-now-playing', JSON.stringify({
        title: currentSong.title,
        artist: currentSong.artist,
        coverUrl: currentSong.coverUrl,
        palette
      }));
    } else {
      localStorage.removeItem('study-flow-now-playing');
    }
  }, [currentSong, palette]);

  useEffect(() => {
    return () => { localStorage.removeItem('study-flow-now-playing'); };
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const togglePlay = useCallback(() => setMusicOn(prev => !prev), []);

  const selectSong = useCallback((id: string) => {
    const qIdx = queueRef.current.findIndex(s => s.id === id);
    if (qIdx >= 0) {
      setCurrentIndex(qIdx);
      setMusicOn(true);
      return;
    }
    // Song isn't in the active playlist — fall back to the full library.
    const allIdx = songsRef.current.findIndex(s => s.id === id);
    if (allIdx >= 0) {
      setActivePlaylistId(null);
      setCurrentIndex(allIdx);
      setMusicOn(true);
    }
  }, []);

  /** Switch the playable queue to a playlist (or null for the whole library). */
  const selectPlaylist = useCallback((id: string | null) => {
    setActivePlaylistId(id);
    setCurrentIndex(0);
    setMusicOn(true);
  }, []);

  const createPlaylist = useCallback(async (name: string) => {
    const res = await createPlaylistAction(name);
    if (res && 'playlist' in res && res.playlist) {
      setPlaylists(prev => [...prev, res.playlist]);
      return res.playlist;
    }
    return null;
  }, []);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    setPlaylists(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
    await renamePlaylistAction(id, name).catch(() => {});
  }, []);

  const deletePlaylist = useCallback(async (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    setActivePlaylistId(prev => (prev === id ? null : prev));
    await deletePlaylistAction(id).catch(() => {});
  }, []);

  /** Add/remove a song from a playlist, updating local membership optimistically. */
  const toggleSongInPlaylist = useCallback(async (playlistId: string, songId: string) => {
    let include = false;
    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      const has = p.songIds.includes(songId);
      include = !has;
      return { ...p, songIds: has ? p.songIds.filter(s => s !== songId) : [...p.songIds, songId] };
    }));
    await setSongInPlaylist(playlistId, songId, include).catch(() => {});
  }, []);

  // ----- Online (Audius) -----

  /** Persist an online track into the library (so it can be queued, liked, added to playlists). */
  const addOnlineSong = useCallback(async (track: OnlineTrack): Promise<Song | null> => {
    const existing = songsRef.current.find(s => (s as any).externalId === track.id);
    if (existing) return existing;
    const res = await saveOnlineSong({
      id: track.id, title: track.title, artist: track.artist,
      duration: track.duration, artworkUrl: track.artworkUrl, streamUrl: track.streamUrl,
    });
    if (res && 'song' in res && res.song) {
      const song = res.song as Song;
      setSongs(prev => (prev.some(s => s.id === song.id) ? prev : [...prev, song]));
      return song;
    }
    return null;
  }, []);

  /** Add the track to the library if needed, then start playing it from the full library. */
  const playOnlineSong = useCallback(async (track: OnlineTrack) => {
    const song = await addOnlineSong(track);
    if (!song) return;
    setActivePlaylistId(null);
    setPendingPlayId(song.id);
  }, [addOnlineSong]);

  // Once a freshly-added song lands in the queue, jump to it and play.
  useEffect(() => {
    if (!pendingPlayId) return;
    const idx = queueRef.current.findIndex(s => s.id === pendingPlayId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setMusicOn(true);
      setPendingPlayId(null);
    }
  }, [pendingPlayId, songs, activePlaylistId]);

  /** Parse tags client-side, then ship audio + extracted cover to the server. */
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    for (const file of Array.from(files)) {
      setUploading(prevNames => [...prevNames, file.name]);
      try {
        const [meta, songDuration] = await Promise.all([
          extractSongMetadata(file),
          readAudioDuration(file)
        ]);

        const formData = new FormData();
        formData.append('audio', file);
        formData.append('title', meta.title || file.name.replace(/\.[^.]+$/, ''));
        if (meta.artist) formData.append('artist', meta.artist);
        if (meta.lyrics) formData.append('lyrics', meta.lyrics);
        if (songDuration) formData.append('duration', String(songDuration));
        if (meta.picture) {
          const ext = meta.picture.type.includes('png') ? 'png' : 'jpg';
          formData.append('cover', new File([meta.picture], `art.${ext}`, { type: meta.picture.type }));
        }

        const result = await uploadSong(formData);
        if (result && 'song' in result && result.song) {
          const uploaded = result.song;
          setSongs(prevSongs => [...prevSongs, uploaded]);
          // If a specific playlist is open, drop the new song straight into it.
          const pid = activePlaylistIdRef.current;
          if (pid) {
            setPlaylists(prev => prev.map(p => (p.id === pid ? { ...p, songIds: [...p.songIds, uploaded.id] } : p)));
            setSongInPlaylist(pid, uploaded.id, true).catch(() => {});
          }
        } else if (result && 'error' in result && result.error) {
          setUploadError(`${file.name}: ${result.error}`);
        }
      } catch {
        setUploadError(`${file.name}: upload failed.`);
      } finally {
        setUploading(prevNames => prevNames.filter(n => n !== file.name));
      }
    }
  }, []);

  const removeSong = useCallback(async (id: string) => {
    const qIdx = queueRef.current.findIndex(s => s.id === id);
    setSongs(prevSongs => prevSongs.filter(s => s.id !== id));
    // Drop it from any playlist membership we track locally too.
    setPlaylists(prev => prev.map(p => ({ ...p, songIds: p.songIds.filter(sid => sid !== id) })));
    if (qIdx >= 0) {
      setCurrentIndex(prevIdx => {
        const newLen = queueRef.current.length - 1;
        if (newLen <= 0) return 0;
        if (qIdx < prevIdx) return prevIdx - 1;
        return Math.min(prevIdx, newLen - 1);
      });
    }
    await deleteSongAction(id).catch(() => {});
  }, []);

  const setCover = useCallback(async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('songId', id);
    formData.append('cover', file);
    const result = await updateSongCover(formData);
    if (result && 'song' in result && result.song) {
      const updated = result.song;
      setSongs(prevSongs => prevSongs.map(s => (s.id === id ? updated : s)));
    }
  }, []);

  /** Up-next list in play order, excluding the current song. */
  const upNext = useMemo(() => {
    if (queue.length <= 1) return [] as Song[];
    const ordered = [...queue.slice(currentIndex + 1), ...queue.slice(0, currentIndex)];
    return ordered;
  }, [queue, currentIndex]);

  return {
    songs, currentSong, currentIndex, upNext, queue,
    isPlaying, musicOn, togglePlay,
    next, prev, selectSong,
    shuffle, toggleShuffle: () => setShuffle(s => !s),
    repeatOne, toggleRepeatOne: () => setRepeatOne(r => !r),
    currentTime, duration, seek,
    palette, lyrics, analyser,
    uploadFiles, uploading, uploadError, removeSong, setCover,
    // Playlists
    playlists, activePlaylistId, activePlaylist,
    selectPlaylist, createPlaylist, renamePlaylist, deletePlaylist, toggleSongInPlaylist,
    // Online
    addOnlineSong, playOnlineSong,
  };
}
