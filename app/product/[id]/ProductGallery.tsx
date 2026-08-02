"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const locale = useLocale();
  const baseImages = useMemo(() => images.filter(Boolean), [images]);
  const [variantImages, setVariantImages] = useState<string[]>([]);
  const cleanImages = variantImages.length ? variantImages : baseImages;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isMobileGallery, setIsMobileGallery] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => { const listener = (event: Event) => { const next = (event as CustomEvent<{ images?: string[] }>).detail?.images; setVariantImages(Array.isArray(next) ? next.filter(Boolean) : []); setSelectedIndex(0); setIsZoomed(false); requestAnimationFrame(() => scrollToIndex(0, "auto")); }; window.addEventListener("todijo:variant-images", listener); return () => window.removeEventListener("todijo:variant-images", listener); }, [scrollToIndex]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    if (scrollEndTimerRef.current !== null) clearTimeout(scrollEndTimerRef.current);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const update = () => setIsMobileGallery(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const hasImages = cleanImages.length > 0;
  const selectedImage = cleanImages[selectedIndex];

  useEffect(() => {
    if (!isMobileGallery) return;
    requestAnimationFrame(() => scrollToIndex(0, "auto"));
  }, [cleanImages, isMobileGallery, scrollToIndex]);

  const showPrevious = useCallback(() => {
    if (cleanImages.length < 2) return;
    setSelectedIndex((index) => { const next = (index - 1 + cleanImages.length) % cleanImages.length; scrollToIndex(next); return next; });
    setIsZoomed(false);
  }, [cleanImages.length, scrollToIndex]);

  const showNext = useCallback(() => {
    if (cleanImages.length < 2) return;
    setSelectedIndex((index) => { const next = (index + 1) % cleanImages.length; scrollToIndex(next); return next; });
    setIsZoomed(false);
  }, [cleanImages.length, scrollToIndex]);

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

  if (!hasImages) {
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
      <div className="productGalleryInteractive">
        {isMobileGallery ? (
          <div
            className="productMobileImageTrack"
            ref={trackRef}
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
                setSelectedIndex((current) => current === next ? current : next);
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
                    setSelectedIndex(index);
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
            <img className="productMainImage productMainImageIntrinsic" src={selectedImage} alt={`${productName} — image ${selectedIndex + 1}`} draggable={false} />
            <span className="productZoomHint">⛶ Agrandir</span>
          </button>
        )}
        <span className="productGalleryCounter" aria-live="polite">{selectedIndex + 1} / {cleanImages.length}</span>

        {!isMobileGallery && cleanImages.length > 1 && (
          <div className="productThumbs" aria-label="Photos du produit">
            {cleanImages.map((image, index) => (
              <button
                type="button"
                className={`productThumbButton${index === selectedIndex ? " isActive" : ""}`}
                onClick={() => { setSelectedIndex(index); scrollToIndex(index); }}
                aria-label={`Afficher l'image ${index + 1}`}
                aria-current={index === selectedIndex ? "true" : undefined}
                key={`${image}-${index}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" loading="lazy" />
                <span>{index + 1}</span>
              </button>
            ))}
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
                  onClick={() => { setSelectedIndex(index); setIsZoomed(false); }}
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
