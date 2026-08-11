"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";

type ProductGalleryProps = {
  images: string[];
  productName: string;
  media?: Array<{ type: "IMAGE" | "VIDEO"; url: string; posterUrl: string | null }>;
};

type MobileImageMetrics = {
  aspectRatio: number;
  orientation: "landscape" | "square" | "portrait";
};

type SelectedMedia =
  | { type: "IMAGE"; index: number }
  | { type: "VIDEO" };

export default function ProductGallery({ images, productName, media = [] }: ProductGalleryProps) {
  const locale = useLocale();
  const baseImages = useMemo(() => images.filter(Boolean), [images]);
  const video = media.find((item) => item.type === "VIDEO");
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const cleanImages = variantImages.length ? variantImages : baseImages;
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia>(() => baseImages.length ? { type: "IMAGE", index: 0 } : { type: "VIDEO" });
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isMobileGallery, setIsMobileGallery] = useState(false);
  const [mobileImageMetrics, setMobileImageMetrics] = useState<Record<string, MobileImageMetrics>>({});
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);

  const selectedIndex = selectedMedia.type === "IMAGE" ? selectedMedia.index : 0;
  const stopVideo = useCallback(() => {
    const player = mainVideoRef.current;
    if (!player) return;
    player.pause();
    if (player.readyState > 0) player.currentTime = 0;
  }, []);

  const selectImage = useCallback((index: number) => {
    stopVideo();
    setSelectedMedia({ type: "IMAGE", index });
    setIsZoomed(false);
  }, [stopVideo]);

  const selectVideo = useCallback(() => {
    setSelectedMedia({ type: "VIDEO" });
    setIsZoomed(false);
    setIsOpen(false);
  }, []);

  const jumpToPhysicalIndex = useCallback((physicalIndex: number) => {
    const track = trackRef.current;
    if (!track) return;
    const previousBehavior = track.style.scrollBehavior;
    track.style.scrollBehavior = "auto";
    track.scrollLeft = physicalIndex * track.clientWidth;
    requestAnimationFrame(() => { track.style.scrollBehavior = previousBehavior; });
  }, []);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    if (!track) return;
    if (behavior === "auto") jumpToPhysicalIndex(index + 1);
    else track.scrollTo({ left: (index + 1) * track.clientWidth, behavior });
  }, [jumpToPhysicalIndex]);

  const closeGallery = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => { const listener = (event: Event) => { const next = (event as CustomEvent<{ images?: string[] }>).detail?.images; const filtered = Array.isArray(next) ? next.filter(Boolean) : []; stopVideo(); setVariantImages(filtered); setSelectedMedia(filtered.length || baseImages.length ? { type: "IMAGE", index: 0 } : { type: "VIDEO" }); setIsZoomed(false); requestAnimationFrame(() => scrollToIndex(0, "auto")); }; window.addEventListener("todijo:variant-images", listener); return () => window.removeEventListener("todijo:variant-images", listener); }, [baseImages.length, scrollToIndex, stopVideo]);

  useEffect(() => () => {
    stopVideo();
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    if (scrollEndTimerRef.current !== null) clearTimeout(scrollEndTimerRef.current);
  }, [stopVideo]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const update = () => setIsMobileGallery(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const hasImages = cleanImages.length > 0;
  const hasMedia = hasImages || Boolean(video);
  const mediaCount = cleanImages.length + (video ? 1 : 0);
  const selectedPosition = selectedMedia.type === "VIDEO" ? cleanImages.length + 1 : selectedIndex + 1;
  const selectedImage = cleanImages[selectedIndex];
  const selectedMobileMetrics = mobileImageMetrics[selectedImage] ?? { aspectRatio: 1, orientation: "square" as const };

  useEffect(() => {
    if (!isMobileGallery) return;
    requestAnimationFrame(() => scrollToIndex(0, "auto"));
  }, [cleanImages, isMobileGallery, scrollToIndex]);

  const showPrevious = useCallback(() => {
    if (cleanImages.length < 2) return;
    const next = (selectedIndex - 1 + cleanImages.length) % cleanImages.length;
    selectImage(next);
    scrollToIndex(next);
  }, [cleanImages.length, scrollToIndex, selectImage, selectedIndex]);

  const showNext = useCallback(() => {
    if (cleanImages.length < 2) return;
    const next = (selectedIndex + 1) % cleanImages.length;
    selectImage(next);
    scrollToIndex(next);
  }, [cleanImages.length, scrollToIndex, selectImage, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGallery();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeGallery, isOpen, showNext, showPrevious]);

  if (!hasMedia) {
    return <div className="productMainPlaceholder">📦</div>;
  }

  const mobileSlides = cleanImages.length > 1
    ? [cleanImages[cleanImages.length - 1], ...cleanImages, cleanImages[0]]
    : cleanImages;

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(distance) < 45) return;
    if (distance > 0) showPrevious();
    else showNext();
  };

  return (
    <>
      <div className={`productGalleryInteractive${mediaCount > 1 ? " hasMediaThumbs" : ""}`}>
        <div className="productMainMediaStage">
          {selectedMedia.type === "VIDEO" && video ? (
          <div className="productMainVideo" aria-label={`${productName} video`}>
            <video ref={mainVideoRef} src={video.url} poster={video.posterUrl ?? undefined} controls preload="metadata" playsInline aria-label={`${productName} video`}/>
          </div>
        ) : isMobileGallery ? (
          <div
            className="productMobileImageTrack"
            ref={trackRef}
            data-orientation={selectedMobileMetrics.orientation}
            style={{ "--mobile-gallery-aspect": selectedMobileMetrics.aspectRatio } as React.CSSProperties}
            onScroll={() => {
              if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
              scrollFrameRef.current = requestAnimationFrame(() => {
                const track = trackRef.current;
                if (!track?.clientWidth) return;
                const physicalIndex = Math.round(track.scrollLeft / track.clientWidth);
                const next = cleanImages.length === 1
                  ? 0
                  : physicalIndex === 0
                    ? cleanImages.length - 1
                    : physicalIndex === cleanImages.length + 1
                      ? 0
                      : physicalIndex - 1;
                setSelectedMedia((current) => current.type === "IMAGE" && current.index === next ? current : { type: "IMAGE", index: next });
                if (scrollEndTimerRef.current !== null) clearTimeout(scrollEndTimerRef.current);
                if (cleanImages.length > 1 && (physicalIndex === 0 || physicalIndex === cleanImages.length + 1)) {
                  scrollEndTimerRef.current = setTimeout(() => {
                    const currentTrack = trackRef.current;
                    if (!currentTrack) return;
                    const destination = physicalIndex === 0 ? cleanImages.length : 1;
                    jumpToPhysicalIndex(destination);
                  }, 90);
                }
              });
            }}
            aria-label="Photos du produit"
          >
            {mobileSlides.map((image, physicalIndex) => {
              const index = cleanImages.length === 1
                ? 0
                : physicalIndex === 0
                  ? cleanImages.length - 1
                  : physicalIndex === cleanImages.length + 1
                    ? 0
                    : physicalIndex - 1;
              return (
                <button
                  type="button"
                  className="productMobileImageSlide"
                  onClick={(event) => {
                    openerRef.current = event.currentTarget;
                    selectImage(index);
                    setIsOpen(true);
                  }}
                  aria-label={`Agrandir l'image ${index + 1} de ${productName}`}
                  key={`mobile-${physicalIndex}-${image}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={`${productName} — image ${index + 1}`}
                    draggable={false}
                    onLoad={(event) => {
                      const loadedImage = event.currentTarget;
                      if (!loadedImage.naturalWidth || !loadedImage.naturalHeight) return;
                      const aspectRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
                      const orientation: MobileImageMetrics["orientation"] = aspectRatio > 1.1
                        ? "landscape"
                        : aspectRatio < 0.9
                          ? "portrait"
                          : "square";
                      setMobileImageMetrics((current) => {
                        const existing = current[image];
                        if (existing?.aspectRatio === aspectRatio && existing.orientation === orientation) return current;
                        return { ...current, [image]: { aspectRatio, orientation } };
                      });
                    }}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            className="productMainImageButton"
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setIsOpen(true);
            }}
            aria-label={`Agrandir l'image ${selectedIndex + 1} de ${productName}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={selectedImage}
              className="productMainImage productMainImageIntrinsic"
              src={selectedImage}
              alt={`${productName} — image ${selectedIndex + 1}`}
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                image.dataset.orientation = image.naturalWidth >= image.naturalHeight ? "landscape" : "portrait";
              }}
            />
            <span className="productZoomHint">⛶ Agrandir</span>
          </button>
          )}
          <span className="productGalleryCounter" aria-live="polite">{selectedPosition} / {mediaCount}</span>
        </div>

        {mediaCount > 1 && (
          <div className="productThumbs productMediaThumbs" aria-label="Médias du produit">
            {cleanImages.map((image, index) => (
              <button
                type="button"
                className={`productThumbButton${selectedMedia.type === "IMAGE" && index === selectedIndex ? " isActive" : ""}`}
                onClick={() => { selectImage(index); scrollToIndex(index); }}
                aria-label={`Afficher l'image ${index + 1}`}
                aria-current={selectedMedia.type === "IMAGE" && index === selectedIndex ? "true" : undefined}
                key={`${image}-${index}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" loading="lazy" />
                <span>{index + 1}</span>
              </button>
            ))}
            {video && <button type="button" className={`productThumbButton productVideoThumb${selectedMedia.type === "VIDEO" ? " isActive" : ""}`} onClick={selectVideo} aria-label={locale === "fr" ? `Afficher la vidéo de ${productName}` : `Show ${productName} video`} aria-current={selectedMedia.type === "VIDEO" ? "true" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {video.posterUrl ? <img src={video.posterUrl} alt="" loading="lazy"/> : <span className="productVideoThumbBackdrop" aria-hidden="true"/>}
              <span className="productVideoThumbPlay" aria-hidden="true">▶</span>
              <small>{locale === "fr" ? "Vidéo" : "Video"}</small>
            </button>}
          </div>
        )}
      </div>

      {isOpen && createPortal((
        <div
          className="productLightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie de ${productName}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGallery();
          }}
        >
          <div className="productLightboxToolbar">
            <span>{selectedIndex + 1} / {cleanImages.length}</span>
            <div>
              <button type="button" onClick={() => setIsZoomed((value) => !value)} aria-label="Zoomer ou dézoomer">
                {isZoomed ? "−" : "+"}
              </button>
              <button type="button" className="productLightboxClose" onClick={closeGallery} aria-label={locale === "fr" ? "Fermer" : "Close"}>×</button>
            </div>
          </div>

          {cleanImages.length > 1 && (
            <button type="button" className="productLightboxArrow isPrevious" onClick={showPrevious} aria-label="Image précédente">‹</button>
          )}

          <div className={`productLightboxImageWrap${isZoomed ? " isZoomed" : ""}`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt={`${productName} — image ${selectedIndex + 1}`}
              onClick={() => setIsZoomed((value) => !value)}
              draggable={false}
            />
          </div>

          {cleanImages.length > 1 && (
            <button type="button" className="productLightboxArrow isNext" onClick={showNext} aria-label="Image suivante">›</button>
          )}

          {cleanImages.length > 1 && (
            <div className="productLightboxThumbs">
              {cleanImages.map((image, index) => (
                <button
                  type="button"
                  className={index === selectedIndex ? "isActive" : ""}
                  onClick={() => selectImage(index)}
                  aria-label={`Afficher l'image ${index + 1}`}
                  key={`lightbox-${image}-${index}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      ), document.body)}
    </>
  );
}
