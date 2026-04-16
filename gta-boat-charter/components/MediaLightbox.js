"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";

function MediaFallback({ label }) {
  return (
    <div className="media-fallback">
      <div className="media-fallback__badge">{label}</div>
      <div className="media-fallback__text">Media unavailable</div>
    </div>
  );
}

function LightboxMedia({ item, title }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [item?.thumbnailUrl, item?.url]);

  if (!item) return <MediaFallback label="No media" />;
  if (hasError) return <MediaFallback label={item.type === "video" ? "Video" : "Image"} />;

  if (item.type === "video") {
    return (
      <div className="lightbox-media-shell">
        <video
          key={item.url}
          src={item.url}
          controls
          playsInline
          autoPlay
          preload="metadata"
          poster={item.thumbnailUrl || undefined}
          className="lightbox-media"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="lightbox-media-shell">
      <img
        key={item.url}
        src={item.url}
        alt={title}
        className="lightbox-media"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function MediaLightbox({
  open,
  mediaItems,
  activeIndex,
  title,
  onClose,
  onNext,
  onPrevious,
  onSelect,
}) {
  const touchStartRef = useRef(null);
  const hasMultipleItems = (mediaItems?.length || 0) > 1;
  const activeItem = mediaItems?.[activeIndex] || null;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (!hasMultipleItems) return;
      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft") onPrevious();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasMultipleItems, onClose, onNext, onPrevious, open]);

  const counterLabel = useMemo(() => {
    if (!mediaItems?.length) return "";
    return `${activeIndex + 1} / ${mediaItems.length}`;
  }, [activeIndex, mediaItems]);

  if (!open || !activeItem) return null;

  return (
    <div
      className="media-lightbox"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button type="button" className="media-lightbox__close" onClick={onClose} aria-label="Close media viewer">
        <X className="h-5 w-5" />
      </button>

      {hasMultipleItems ? (
        <button type="button" className="media-lightbox__nav media-lightbox__nav--prev" onClick={onPrevious} aria-label="Previous media">
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}

      {hasMultipleItems ? (
        <button type="button" className="media-lightbox__nav media-lightbox__nav--next" onClick={onNext} aria-label="Next media">
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div
        className="media-lightbox__content"
        onTouchStart={(event) => {
          touchStartRef.current = event.changedTouches?.[0]?.clientX || null;
        }}
        onTouchEnd={(event) => {
          if (!hasMultipleItems || touchStartRef.current == null) return;
          const touchEnd = event.changedTouches?.[0]?.clientX || 0;
          const delta = touchEnd - touchStartRef.current;
          touchStartRef.current = null;

          if (Math.abs(delta) < 48) return;
          if (delta < 0) onNext();
          if (delta > 0) onPrevious();
        }}
      >
        <div className="media-lightbox__meta">
          <div className="media-lightbox__title">{title}</div>
          {counterLabel ? <div className="media-lightbox__counter">{counterLabel}</div> : null}
        </div>

        <LightboxMedia item={activeItem} title={title} />

        {hasMultipleItems ? (
          <div className="media-lightbox__rail">
            {mediaItems.map((item, index) => (
              <button
                key={item.id || `${item.url}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                className={`media-lightbox__thumb ${index === activeIndex ? "is-active" : ""}`}
                aria-label={`Open media ${index + 1}`}
              >
                {item.type === "video" ? (
                  <div className="media-lightbox__thumb-video">
                    {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : null}
                    <span className="media-lightbox__thumb-play">
                      <Play className="h-3.5 w-3.5" />
                    </span>
                  </div>
                ) : (
                  <img src={item.thumbnailUrl || item.url} alt="" />
                )}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
