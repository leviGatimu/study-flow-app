"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * Lightweight YouTube embed. Shows the thumbnail with a play button and only
 * loads the (heavy) YouTube iframe once the visitor clicks — keeps the page fast.
 */
export default function VideoEmbed({ id, title = "Video" }: { id: string; title?: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[1.5rem] border border-black/[0.06] dark:border-white/10 bg-slate-900 shadow-[0_50px_100px_-35px_rgba(15,23,42,0.6)]">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title}`}
          className="group absolute inset-0 h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            onError={() => setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/10" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-2xl transition-transform duration-300 group-hover:scale-110">
              <Play size={30} className="ml-1 fill-blue-600 text-blue-600" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
