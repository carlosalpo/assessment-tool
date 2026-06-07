"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ScrollXProps = {
  children: React.ReactNode;
  className?: string;
};

const dragThresholdPx = 4;

export function ScrollX({ children, className }: ScrollXProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ active: false, dragging: false, startX: 0, startScrollLeft: 0 });
  const suppressClickRef = React.useRef(false);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const updateScrollState = React.useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const scrollLeft = Math.max(0, element.scrollLeft);
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < maxScrollLeft - 1);
  }, []);

  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();

    const handleScroll = () => updateScrollState();
    const handleWheel = (event: WheelEvent) => {
      if (event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      if (maxScrollLeft <= 0) return;

      const direction = Math.sign(event.deltaY);
      const atLeft = element.scrollLeft <= 0;
      const atRight = element.scrollLeft >= maxScrollLeft - 1;
      if ((direction < 0 && atLeft) || (direction > 0 && atRight)) return;

      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };

    element.addEventListener("scroll", handleScroll);
    element.addEventListener("wheel", handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    if (element.firstElementChild) resizeObserver.observe(element.firstElementChild);

    return () => {
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("wheel", handleWheel);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scrollByPage = React.useCallback((direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const element = scrollRef.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    dragRef.current = {
      active: true,
      dragging: false,
      startX: event.clientX,
      startScrollLeft: element.scrollLeft
    };
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const element = scrollRef.current;
    const drag = dragRef.current;
    if (!element || !drag.active) return;

    const deltaX = event.clientX - drag.startX;
    if (!drag.dragging && Math.abs(deltaX) < dragThresholdPx) return;

    drag.dragging = true;
    suppressClickRef.current = true;
    setIsDragging(true);
    element.scrollLeft = drag.startScrollLeft - deltaX;
    event.preventDefault();
  }

  function endDrag() {
    const wasDragging = dragRef.current.dragging;
    dragRef.current.active = false;
    dragRef.current.dragging = false;
    setIsDragging(false);
    if (wasDragging) window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  return (
    <div className={cn("relative", className)}>
      {canScrollLeft && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent" />
          <button
            type="button"
            aria-label="Desplazar a la izquierda"
            className="absolute left-2 top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-[hsl(var(--surface))]/95 text-foreground shadow-lg transition hover:bg-[hsl(var(--surface-raised))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => scrollByPage(-1)}
          >
            <ChevronLeft size={16} />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto overscroll-x-contain",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab",
          "[scrollbar-color:hsl(var(--border))_hsl(var(--surface-raised))]",
          "[scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:h-3",
          "[&::-webkit-scrollbar-track]:bg-[hsl(var(--surface-raised))]",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:border-2",
          "[&::-webkit-scrollbar-thumb]:border-[hsl(var(--surface-raised))]",
          "[&::-webkit-scrollbar-thumb]:bg-[hsl(var(--border))]",
          "[&::-webkit-scrollbar-thumb:hover]:bg-[hsl(var(--muted-foreground))]"
        )}
        onClickCapture={handleClickCapture}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        {children}
      </div>

      {canScrollRight && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
          <button
            type="button"
            aria-label="Desplazar a la derecha"
            className="absolute right-2 top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-[hsl(var(--surface))]/95 text-foreground shadow-lg transition hover:bg-[hsl(var(--surface-raised))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => scrollByPage(1)}
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}
