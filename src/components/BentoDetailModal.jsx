import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/bento-modal.css";

export default function BentoDetailModal({
  open,
  onClose,
  headerIcon = "bi-shop",
  title = "Details",
  code = "",
  hero = null,
  layout = "bento-3",
  sections = [],
  fields = [],
  children = null,
  maxWidth,
  size,
}) {
  // Compute left offset to ensure the dark left navigation sidebar remains 100% visible, active, and unblurred
  const [leftOffset, setLeftOffset] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 991) return "0px";
    const isCollapsed = Boolean(
      typeof document !== "undefined" && (
        document.querySelector(".dashboard-app.sidebar-collapsed") ||
        document.querySelector(".sidebar-collapsed")
      )
    );
    return isCollapsed ? "60px" : "266px";
  });

  useEffect(() => {
    if (!open) return;

    const updateLeftOffset = () => {
      if (window.innerWidth <= 991) {
        setLeftOffset("0px");
      } else {
        const isCollapsed = Boolean(
          document.querySelector(".dashboard-app.sidebar-collapsed") ||
          document.querySelector(".sidebar-collapsed")
        );
        setLeftOffset(isCollapsed ? "60px" : "266px");
      }
    };

    updateLeftOffset();
    window.addEventListener("resize", updateLeftOffset);

    // Watch for collapse/expand toggles on .dashboard-app
    const dashboardApp = document.querySelector(".dashboard-app");
    let observer = null;
    if (dashboardApp && window.MutationObserver) {
      observer = new MutationObserver(updateLeftOffset);
      observer.observe(dashboardApp, { attributes: true, attributeFilter: ["class"] });
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    const handleRouteChange = () => {
      onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handleRouteChange);

    // Lock scrolling on main-content workspace while leaving the sidebar 100% active
    const mainContent = document.querySelector(".main-content");
    const originalMainOverflow = mainContent?.style.overflow;
    if (mainContent) {
      mainContent.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("resize", updateLeftOffset);
      observer?.disconnect();
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handleRouteChange);
      if (mainContent) {
        mainContent.style.overflow = originalMainOverflow || "";
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  const isValueEmpty = (val) => {
    return val === null || val === undefined || val === "" || val === "—" || val === "-";
  };

  const getStatusClass = (statusStr) => {
    if (!statusStr) return "active";
    const s = String(statusStr).toLowerCase().replace(/[\s_-]+/g, "");
    if (
      s.includes("active") ||
      s.includes("operational") ||
      s.includes("completed") ||
      s.includes("verified") ||
      s.includes("paid") ||
      s.includes("instock")
    ) {
      return "active";
    }
    if (
      s.includes("inactive") ||
      s.includes("deactivated") ||
      s.includes("expired") ||
      s.includes("cancelled") ||
      s.includes("failed") ||
      s.includes("outofstock")
    ) {
      return "inactive";
    }
    if (s.includes("pending") || s.includes("created") || s.includes("lowstock")) {
      return "pending";
    }
    return "active";
  };

  const formatCode = (val) => {
    if (!val) return "";
    return String(val).replace(/^Code:\s*/i, "").trim();
  };

  // Check if modal should use compact layout
  const isCompact =
    size === "compact" ||
    maxWidth === "max-w-[480px]" ||
    maxWidth === "max-w-xl" ||
    layout === "borderless-2" ||
    layout === "bento-2";

  const renderField = (field, idx, structured = false) => {
    const isMono =
      field.mono ??
      Boolean(
        field.label &&
          /code|id|serial|reference|shift|uuid|pin/i.test(field.label)
      );

    const isEmail = Boolean(
      field.isEmail ??
      (field.label && /email/i.test(field.label))
    );

    const isPhone = Boolean(
      field.isPhone ??
      (field.label && /phone|mobile|tel/i.test(field.label))
    );

    const isStatus = Boolean(
      field.isStatus ??
      (field.label && /^status$/i.test(field.label.trim()))
    );

    const emptyFallback =
      field.emptyText ||
      (field.label && /phone|email/i.test(field.label)
        ? "Not provided"
        : field.label && /expir/i.test(field.label)
        ? "No Expiration"
        : field.label && /tag|product/i.test(field.label)
        ? "No products listed"
        : field.label && /note/i.test(field.label)
        ? "No notes provided"
        : "Not specified");

    const isEmpty = isValueEmpty(field.value);
    const rawValue = isEmpty ? emptyFallback : field.value;

    return (
      <div
        key={field.key || field.label || idx}
        className={
          structured
            ? `bento-field-card bg-slate-50/60 rounded-xl p-3 border border-slate-100 flex flex-col gap-1 ${
                field.fullWidth ? "col-span-2" : ""
              }`
            : `bento-field ${field.fullWidth ? "full-width" : ""} ${
                field.colSpan ? `col-span-${field.colSpan}` : ""
              }`
        }
      >
        <span className="bento-field-label block text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-normal break-words">
          {field.label}
        </span>

        {field.render ? (
          field.render(rawValue)
        ) : isEmpty ? (
          <span className="bento-field-value empty-state text-xs text-slate-400 italic block">
            {emptyFallback}
          </span>
        ) : isStatus ? (
          <div>
            <span
              className={`bento-status-pill inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusClass(
                rawValue
              )}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {rawValue}
            </span>
          </div>
        ) : isEmail ? (
          <a
            href={`mailto:${rawValue}`}
            className="text-xs font-semibold text-indigo-600 hover:underline break-all block"
          >
            {rawValue}
          </a>
        ) : isPhone ? (
          <a
            href={`tel:${rawValue}`}
            className="text-xs font-semibold text-slate-800 hover:text-indigo-600 block"
          >
            {rawValue}
          </a>
        ) : isMono ? (
          <span className="font-mono text-xs font-bold text-slate-800 block break-words">
            {rawValue}
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-800 leading-relaxed block break-words">
            {rawValue}
          </span>
        )}
      </div>
    );
  };

  // Sizing variants:
  // Compact records (Devices, Tenders, Safe Drops): strictly max-w-[480px]
  // Dense 3-column records (Vendor, Customers, Payments, Coupons, Employees): max-w-4xl
  let widthClass = isCompact ? "max-w-[480px] size-compact" : "max-w-4xl size-wide";
  if (maxWidth === "max-w-4xl") widthClass = "max-w-4xl size-wide";
  if (maxWidth === "max-w-[480px]") widthClass = "max-w-[480px] size-compact";

  const customStyle =
    maxWidth && !maxWidth.startsWith("max-w-")
      ? { maxWidth }
      : undefined;

  const modalJSX = (
    <div
      className="bento-modal-overlay fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
      style={{ left: leftOffset }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`bento-modal-container bg-white w-full ${widthClass} rounded-2xl shadow-2xl border border-slate-100 relative max-h-[90vh] ${
          isCompact ? "overflow-visible" : "overflow-hidden"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bento-modal-title"
        style={customStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header: Category icon badge + Title + Subtitle Code + Top-right X button only */}
        <div className="bento-modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/40">
          <div className="bento-header-left flex items-center gap-3">
            <div className="bento-header-badge p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <i className={`bi ${headerIcon} text-lg`} aria-hidden="true" />
            </div>
            <div className="bento-header-text">
              <h2 id="bento-modal-title" className="bento-header-title text-base font-bold text-slate-800">
                {title}
              </h2>
              {code ? (
                <p className="bento-header-code text-xs text-slate-400 font-mono">
                  Code: <span className="bento-header-code-val font-medium text-slate-600">{formatCode(code)}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Top-Right Close Button (The ONLY Close trigger) */}
          <button
            type="button"
            className="bento-modal-close-btn text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body Content: Tightened to p-4 sm:p-5 to guarantee zero inner vertical scrolling */}
        <div
          className={`bento-modal-body p-4 sm:p-5 space-y-3.5 ${
            isCompact ? "overflow-visible" : "overflow-y-auto"
          }`}
        >
          {/* Hero Highlight Card: py-3 px-4 */}
          {hero && (
            <div className="bento-hero-card flex items-center justify-between py-3 px-4 bg-slate-50/80 rounded-xl border border-slate-200/70">
              <div className="bento-hero-entity flex items-center gap-3.5">
                <div className="bento-hero-icon-box w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 overflow-hidden">
                  {hero.image ? (
                    <img
                      src={hero.image}
                      alt={hero.title}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <i className={`bi ${hero.icon || "bi-shop-window"} text-lg`} aria-hidden="true" />
                  )}
                </div>
                <div className="bento-hero-info">
                  <div className="bento-hero-title-row flex items-center gap-2">
                    <h1 className="bento-hero-name text-base font-bold text-slate-900 leading-tight">
                      {hero.title}
                    </h1>
                    {hero.status && (
                      <span className={`bento-status-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusClass(hero.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {hero.status}
                      </span>
                    )}
                  </div>
                  {hero.subtitle && (
                    <p className="bento-hero-sub text-xs text-slate-500 mt-0.5">
                      {hero.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {hero.metricValue && (
                <div className="bento-hero-metric text-right">
                  <span className="bento-metric-label text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">
                    {hero.metricLabel || "VALUE"}
                  </span>
                  <p
                    className={`bento-metric-value leading-tight ${
                      isCompact
                        ? "text-base font-bold text-slate-800"
                        : "text-xl font-extrabold text-slate-900"
                    }`}
                  >
                    {hero.metricValue}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section Grids (3 Columns or 2 Columns): Full Headings with ZERO Truncation */}
          {sections && sections.length > 0 && (
            <div
              className={`bento-grid ${
                layout === "bento-2"
                  ? "bento-grid-2 grid grid-cols-2 gap-3.5"
                  : "bento-grid-3 grid grid-cols-3 gap-4"
              }`}
            >
              {sections.map((sec, sIdx) => (
                <div
                  key={sec.title || sIdx}
                  className={`bento-card p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-3 ${
                    sec.className || ""
                  } ${sec.colSpan ? `col-span-${sec.colSpan}` : ""}`}
                >
                  {sec.title && (
                    <h3 className="bento-card-header text-[11px] font-bold text-indigo-600 tracking-wider uppercase whitespace-normal break-words">
                      {sec.title}
                    </h3>
                  )}
                  {sec.fields?.map((field, fIdx) => renderField(field, fIdx, false))}
                  {sec.customContent}
                </div>
              ))}
            </div>
          )}

          {/* Structured Background Cards for Compact Key-Values (Image 2) */}
          {(!sections || sections.length === 0) && fields && fields.length > 0 && (
            <div className="bento-structured-fields grid grid-cols-2 gap-3">
              {fields.map((field, idx) => renderField(field, idx, true))}
            </div>
          )}

          {/* Custom Body Content */}
          {children}
        </div>
        {/* Zero bottom buttons inside or outside the modal */}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalJSX, document.body)
    : modalJSX;
}
