import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  width?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "bottom",
  width = "max-w-[330px]",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const hideTimer = useRef<number | null>(null);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Compute fixed coordinates for portal tooltip
  const computeCoords = () => {
    const el = triggerRef.current;
    const tt = tooltipRef.current;
    if (!el || !tt) return;
    const rect = el.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    let top = 0;
    let left = 0;
    const gap = 12;
    switch (position) {
      case "top":
        top = rect.top - ttRect.height - gap;
        left = rect.left + rect.width / 2 - ttRect.width / 2;
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - ttRect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - ttRect.height / 2;
        left = rect.left - ttRect.width - gap;
        break;
      case "right":
      default:
        top = rect.top + rect.height / 2 - ttRect.height / 2;
        left = rect.right + gap;
        break;
    }
    // Keep within viewport bounds with minimal 8px margin
    const margin = 8;
    top = Math.max(margin, Math.min(top, window.innerHeight - ttRect.height - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - ttRect.width - margin));
    setCoords({ top, left });
  };

  useEffect(() => {
    if (!isVisible) return;
    computeCoords();
    const onResize = () => computeCoords();
    const onScroll = () => computeCoords();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isVisible, position]);

  const safeShow = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setIsVisible(true);
  };

  const delayedHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimer.current = null;
    }, 120);
  };

  return (
    <div className="inline-block" ref={triggerRef}>
      {React.cloneElement(children, {
        onMouseEnter: safeShow,
        onMouseLeave: delayedHide,
        onFocus: safeShow,
        onBlur: delayedHide,
        className: `${children.props.className || ""} cursor-pointer`,
      })}

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`${width} fixed z-[9999]`}
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { top: -9999, left: -9999 }
            }
            onMouseEnter={safeShow}
            onMouseLeave={delayedHide}
          >
            <div className="cursor-pointer rounded-lg border border-slate-200 bg-white/95 p-3 text-sm text-slate-700 shadow-xl backdrop-blur-sm">
              {content}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
