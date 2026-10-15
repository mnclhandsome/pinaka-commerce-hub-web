
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TABLE_CELL_SELECTOR = [
  "td",
  "th",
  "[data-pch-table-cell]",
  ".plans-row",
  ".store-types-row",
].join(", ");

function getOverflowingText(target) {
  if (!(target instanceof Element)) return null;

  const cell = target.closest(TABLE_CELL_SELECTOR);
  if (!cell) return null;

  let element = target;

  while (element && cell.contains(element)) {
    const text = element.innerText?.trim();

    if (
      text &&
      (element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1)
    ) {
      return {
        element,
        text,
      };
    }

    if (element === cell) break;
    element = element.parentElement;
  }

  return null;
}

export default function TableOverflowTooltip() {
  const [tooltip, setTooltip] = useState(null);
  const hoveredElementRef = useRef(null);
  const tooltipRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const hideTooltip = useCallback(() => {
    hoveredElementRef.current = null;
    setTooltip(null);
  }, []);

  const updateTooltip = useCallback((x, y) => {
    pointerRef.current = { x, y };

    const target = document.elementFromPoint(x, y);
    const overflow = getOverflowingText(target);

    if (!overflow) {
      hideTooltip();
      return;
    }

    hoveredElementRef.current = overflow.element;

    setTooltip({
      text: overflow.text,
      x,
      y,
    });
  }, [hideTooltip]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      updateTooltip(event.clientX, event.clientY);
    };

    const handlePointerLeave = () => {
      hideTooltip();
    };

    const handleScroll = () => {
      hideTooltip();
    };

    const handleResize = () => {
      hideTooltip();
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateTooltip, hideTooltip]);

  if (!tooltip || typeof document === "undefined") {
    return null;
  }

  const tooltipWidth = 360;
  const tooltipHeight = 100;
  const gap = 14;
  const padding = 12;

  const left = Math.max(
    padding,
    Math.min(
      tooltip.x + gap,
      window.innerWidth - tooltipWidth - padding
    )
  );

  const top = Math.max(
    padding,
    Math.min(
      tooltip.y + gap,
      window.innerHeight - tooltipHeight - padding
    )
  );

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className="pch-overflow-tooltip"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 99999,
        maxWidth: `min(${tooltipWidth}px, calc(100vw - 24px))`,
        pointerEvents: "none",
      }}
    >
      {tooltip.text}
    </div>,
    document.body
  );
}