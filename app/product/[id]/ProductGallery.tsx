"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const cleanImages = useMemo(() => images.filter(Boolean), [images]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const hasImages = cleanImages.length > 0;
  const selectedImage = cleanImages[selectedIndex];

  const showPrevious = useCallback(() => {
    if (cleanImages.length < 2) return;
    setSelectedIndex((index) => (index - 1 + cleanImages.length) % cleanImages.length);
    setIsZoomed(false);
  }, [cleanImages.length]);

  const showNext = useCallback(() => {
    if (cleanImages.length < 2) return;
    setSelectedIndex((index) => (index + 1) % cleanImages.length);
    setIsZoomed(false);
  }, [cleanImages.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
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
  }, [isOpen, showNext, showPrevious]);

  if (!hasImages) {
    return <div className="productMainPlaceholder">📦</div>;
  }

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
        <button
          type="button"
          className="productMainImageButton"
          onClick={() => setIsOpen(true)}
          aria-label={`Agrandir l'image ${selectedIndex + 1} de ${productName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="productMainImage" src={selectedImage} alt={`${productName} — image ${selectedIndex + 1}`} />
          <span className="productZoomHint">⛶ Agrandir</span>
        </button>

        {cleanImages.length > 1 && (
          <div className="productThumbs" aria-label="Photos du produit">
            {cleanImages.map((image, index) => (
              <button
                type="button"
                className={`productThumbButton${index === selectedIndex ? " isActive" : ""}`}
                onClick={() => setSelectedIndex(index)}
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

      {isOpen && (
        <div
          className="productLightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie de ${productName}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div className="productLightboxToolbar">
            <span>{selectedIndex + 1} / {cleanImages.length}</span>
            <div>
              <button type="button" onClick={() => setIsZoomed((value) => !value)} aria-label="Zoomer ou dézoomer">
                {isZoomed ? "−" : "+"}
              </button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Fermer la galerie">✕</button>
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
      )}
    </>
  );
}
