"use client";

import { useEffect, useState } from "react";
import { Play, ZoomIn } from "lucide-react";

function MediaFallback({ label }) {
  return (
    <div className="media-fallback">
      <div className="media-fallback__badge">{label}</div>
      <div className="media-fallback__text">Media unavailable</div>
    </div>
  );
}

function GalleryMedia({ item, title, expanded = false }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [item?.thumbnailUrl, item?.url]);

  if (!item) return <MediaFallback label="Media" />;
  if (hasError) return <MediaFallback label={item.type === "video" ? "Video" : "Image"} />;

  if (item.type === "video") {
    return (
      <div className={`boat-gallery-video ${expanded ? "is-expanded" : ""}`}>
        <video
          src={item.url}
          playsInline
          muted
          preload="metadata"
          poster={item.thumbnailUrl || undefined}
          className="boat-gallery-video__media"
          onError={() => setHasError(true)}
        />
        <div className="boat-gallery-video__overlay">
          <span className="boat-gallery-video__play">
            <Play className="h-5 w-5" />
          </span>
          <span className="boat-gallery-video__label">Video tour</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`boat-gallery-image ${expanded ? "is-expanded" : ""}`}>
      <img
        src={item.url}
        alt={title}
        className="boat-gallery-image__media"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function BoatMediaGallery({
  mediaItems,
  activeIndex,
  boatName,
  onSelect,
  onOpen,
  onNext,
  onPrevious,
}) {
  const activeItem = mediaItems?.[activeIndex] || null;
  const hasMultipleItems = (mediaItems?.length || 0) > 1;

  if (!activeItem) {
    return (
      <div className="boat-gallery">
        <div className="boat-gallery__stage boat-gallery__stage--empty">
          <MediaFallback label="Media" />
        </div>
      </div>
    );
  }

  return (
    <div className="boat-gallery">
      <button type="button" className="boat-gallery__stage" onClick={() => onOpen(activeIndex)}>
        <GalleryMedia item={activeItem} title={`${boatName} media`} expanded />
        <div className="boat-gallery__chrome">
          <div className="boat-gallery__counter">
            {activeIndex + 1} / {mediaItems.length}
          </div>
          <div className="boat-gallery__zoom">
            <ZoomIn className="h-4 w-4" />
            Tap to expand
          </div>
        </div>
      </button>

      {hasMultipleItems ? (
        <div className="boat-gallery__toolbar">
          <button type="button" className="boat-gallery__toolbar-button" onClick={onPrevious}>
            Previous
          </button>
          <button type="button" className="boat-gallery__toolbar-button" onClick={onNext}>
            Next
          </button>
        </div>
      ) : null}

      {hasMultipleItems ? (
        <div className="boat-gallery__thumbs">
          {mediaItems.map((item, index) => (
            <button
              key={item.id || `${item.url}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className={`boat-gallery__thumb ${index === activeIndex ? "is-active" : ""}`}
              aria-label={`View media ${index + 1}`}
            >
              <GalleryMedia item={item} title={`${boatName} thumbnail`} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
