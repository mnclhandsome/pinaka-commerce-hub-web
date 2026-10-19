import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TABLE_CELL_SELECTOR = [
  "td",
  "th",
  "[data-pch-table-cell]",
  ".plans-row > *",
  ".store-types-row > *",
  ".store-features-row > *",
  ".role-template-row > *",
  "[class*='-cell']",
].join(", ");

function isTruncatedByCSS(element) {
  if (!(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);

  // Check for single line ellipsis
  const hasEllipsis =
    style.textOverflow === "ellipsis" &&
    (style.overflow === "hidden" || style.overflowX === "hidden");

  // Check for multi-line line clamp
  const hasLineClamp =
    style.webkitLineClamp &&
    style.webkitLineClamp !== "none" &&
    style.display === "-webkit-box";

  return hasEllipsis || Boolean(hasLineClamp);
}

function getOverflowingText(target) {
  if (!(target instanceof Element)) return null;

  // Ignore action buttons, interactive controls, pills, and status badges
  if (
    target.closest(
      "button, a, input, select, textarea, .list-actions, [class*='actions'], .status-badge, [class*='status-pill'], [class*='badge']"
    )
  ) {
    return null;
  }

  const cell = target.closest(TABLE_CELL_SELECTOR);
  if (!cell) return null;

  // Never treat a row, table or wrapper as an overflowing cell
  if (
    cell.matches(
      "tr, .plans-row, .store-types-row, .store-features-row, .role-template-row, [class*='-row'], [class*='-table']"
    )
  ) {
    return null;
  }

  let element = target;

  while (element && cell.contains(element)) {
    if (
      element.matches?.(
        "tr, .plans-row, .store-types-row, .store-features-row, .role-template-row, [class*='-row'], [class*='-table']"
      )
    ) {
      break;
    }

    const text = element.innerText?.trim();

    // Ignore empty/placeholder characters and single words under 5 characters (prevents short prices, codes, badges)
    if (!text || text === "—" || text === "-" || text.length <= 4) {
      if (element === cell) break;
      element = element.parentElement;
      continue;
    }

    const hasScrollOverflow =
      element.scrollWidth > element.clientWidth + 2 ||
      element.scrollHeight > element.clientHeight + 2;

    // Check if the element itself or its parent enforces CSS truncation
    const isTruncated = isTruncatedByCSS(element) || isTruncatedByCSS(element.parentElement);

    if (hasScrollOverflow && isTruncated) {
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