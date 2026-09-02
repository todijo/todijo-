"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function PremiumHeroSlider({ children, productCollage, previous, next }: { children: React.ReactNode; productCollage: React.ReactNode; previous: string; next: string }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const select = (value: number) => setSlide((value + 2) % 2);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % 2), 7500);
    return () => window.clearInterval(timer);
  }, [paused]);
  return <section className="premiumHeroSlider" aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) select(slide + (delta < 0 ? 1 : -1)); touchStart.current = null; }}>
    <div className={`premiumHeroTrack slide-${slide}`}>
      <article className="premiumHeroSlide lifestyleSlide" aria-hidden={slide !== 0}>
        <Image src="/images/homepage/hero-shopping.webp" alt="" fill priority sizes="100vw" className="premiumHeroArtwork"/>
        <div className="premiumHeroShade"/><div className="premiumHeroCopy">{children}</div>
      </article>
      <article className="premiumHeroSlide productsSlide" aria-hidden={slide !== 1}>
        <Image src="/images/homepage/hero-shopping.webp" alt="" fill sizes="100vw" className="premiumHeroArtwork"/>
        <div className="premiumHeroShade"/><div className="premiumHeroCopy">{children}</div><div className="premiumHeroProducts">{productCollage}</div>
      </article>
    </div>
    <button className="premiumHeroArrow previous" type="button" onClick={() => select(slide - 1)} aria-label={previous}><ArrowLeft/></button>
    <button className="premiumHeroArrow next" type="button" onClick={() => select(slide + 1)} aria-label={next}><ArrowRight/></button>
    <div className="premiumHeroDots">{[0,1].map((index) => <button key={index} type="button" className={slide === index ? "active" : ""} onClick={() => select(index)} aria-label={`${index + 1} / 2`} aria-current={slide === index ? "true" : undefined}/>)}</div>
  </section>;
}
