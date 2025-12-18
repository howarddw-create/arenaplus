import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { TokenConfig } from "../../constants";

export interface TokenSelectOption
  extends Pick<TokenConfig, "symbol" | "name" | "image"> {
  description?: string;
  meta?: string;
}

interface TokenSelectProps {
  options: TokenSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const TokenSelect: React.FC<TokenSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select token",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownStyles, setDropdownStyles] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (!options.find((option) => option.symbol === internalValue)) {
      setInternalValue(value || "");
    }
  }, [options, internalValue, value]);

  const selectedOption = useMemo(
    () => options.find((option) => option.symbol === internalValue),
    [options, internalValue]
  );

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dropdownEl = dropdownRef.current;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const offset = 8;

    const dropdownHeight = dropdownEl?.offsetHeight ?? 0;

    let width = Math.min(rect.width, viewportWidth - margin * 2);
    let left = Math.max(margin, Math.min(rect.left, viewportWidth - margin - width));

    let top = rect.bottom + offset;
    if (dropdownHeight) {
      const spaceBelow = viewportHeight - rect.bottom - offset;
      const spaceAbove = rect.top - offset;

      if (spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight) {
        top = Math.max(
          margin,
          Math.min(rect.top - dropdownHeight - offset, viewportHeight - dropdownHeight - margin)
        );
      } else if (spaceBelow < dropdownHeight) {
        top = Math.max(
          margin,
          Math.min(rect.bottom + offset, viewportHeight - dropdownHeight - margin)
        );
      } else {
        top = Math.min(
          rect.bottom + offset,
          viewportHeight - dropdownHeight - margin
        );
      }
    } else {
      top = Math.min(rect.bottom + offset, viewportHeight - margin);
    }

    setDropdownStyles((prev) => ({ ...prev, top, left, width }));
  }, [isOpen, options.length]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        containerRef.current.contains(event.target as Node)
      ) {
        return;
      }
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(event.target as Node)
      ) {
        return;
      }
      if (
        containerRef.current &&
        containerRef.current.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleReposition = () => updateDropdownPosition();

    updateDropdownPosition();
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const preventWheel = (event: WheelEvent) => {
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(event.target as Node)
      ) {
        return;
      }
      event.preventDefault();
    };

    const preventTouch = (event: TouchEvent) => {
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(event.target as Node)
      ) {
        return;
      }
      event.preventDefault();
    };

    const preventKeyScroll = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        return;
      }
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(document.activeElement)
      ) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("wheel", preventWheel, { passive: false });
    window.addEventListener("touchmove", preventTouch, { passive: false });
    window.addEventListener("keydown", preventKeyScroll, { capture: true });

    return () => {
      window.removeEventListener("wheel", preventWheel);
      window.removeEventListener("touchmove", preventTouch);
      window.removeEventListener("keydown", preventKeyScroll, { capture: true });
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (disabled || !options.length) return;
    setIsOpen((prev) => !prev);
  };

  const handleOptionClick = (symbol: string) => {
    if (symbol !== internalValue) {
      setInternalValue(symbol);
      onChange(symbol);
    } else {
      onChange(symbol);
    }
    setIsOpen(false);
  };

  const isDisabled = disabled || options.length === 0;
  const activePlaceholder =
    isDisabled && placeholder === "Select token"
      ? "No options available"
      : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        className={`group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm transition focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
          isOpen && !isDisabled ? "border-blue-400" : "hover:border-blue-400"
        } ${
          isDisabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer"
        }`}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.image ? (
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white shadow">
              <img
                src={selectedOption.image}
                alt={`${selectedOption.symbol} token`}
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-xs font-bold uppercase text-white shadow">
              {(selectedOption?.symbol || placeholder).slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="flex flex-col truncate">
            <span>{selectedOption ? selectedOption.symbol : activePlaceholder}</span>
            {selectedOption?.description && (
              <span className="text-xs font-medium text-slate-400">
                {selectedOption.description}
              </span>
            )}
          </span>
        </span>
        <span
          className={`ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {isOpen && options.length > 0 &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: dropdownStyles.top,
              left: dropdownStyles.left,
              width: dropdownStyles.width,
            }}
            className="z-[10010] origin-top rounded-2xl border border-white/60 bg-white/95 p-2 shadow-2xl backdrop-blur"
            ref={dropdownRef}
          >
            <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-1">
              {options.map((option) => {
                const isSelected = option.symbol === selectedOption?.symbol;
                return (
                  <button
                    key={option.symbol}
                    type="button"
                    onClick={() => handleOptionClick(option.symbol)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                      isSelected
                        ? "bg-gradient-to-r from-blue-500/15 via-white to-emerald-500/15 text-blue-700"
                        : "text-slate-600 hover:bg-blue-50/80 hover:text-blue-700"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {option.image ? (
                        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white shadow">
                          <img
                            src={option.image}
                            alt={`${option.symbol} token`}
                            className="h-full w-full object-cover"
                          />
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-xs font-bold uppercase text-white shadow">
                          {option.symbol.slice(0, 2)}
                        </span>
                      )}
                      <span className="text-left">
                        <span className="block text-sm font-semibold">
                          {option.symbol}
                        </span>
                        <span className="block text-xs font-medium text-slate-400">
                          {option.description || option.name}
                        </span>
                      </span>
                    </span>
                    {isSelected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a.98.98 0 00-1.408-.012l-6.19 6.096-2.402-2.09a.979.979 0 10-1.284 1.478l3.088 2.684a.98.98 0 001.332-.048l6.738-6.63a.98.98 0 00.126-1.478z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
