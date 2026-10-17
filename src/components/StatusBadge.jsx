import React from "react";

/**
 * Standardized pixel-perfect StatusBadge component.
 * Ensures consistent 96px x 32px dimensions, capsule border radius (9999px),
 * strict flex centering, 8px dot, and standardized Active/Inactive color palette.
 *
 * @param {Object} props
 * @param {string} props.status - "Active" | "Inactive" (case-insensitive)
 * @param {string} [props.className] - Optional additional CSS class name(s)
 * @param {React.ReactNode} [props.children] - Optional custom label override
 */
export default function StatusBadge({ status, className = "", children }) {
  const normalized = String(status || "").trim().toLowerCase();
  const isActive = normalized === "active";
  const stateModifier = isActive ? "status-badge--active active" : "status-badge--inactive inactive";
  const label = children || (status ? String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase() : (isActive ? "Active" : "Inactive"));

  return (
    <span className={`status-badge ${stateModifier} ${className}`.trim()}>
      <i className="status-badge__dot" aria-hidden="true" />
      <span className="status-badge__text">{label}</span>
    </span>
  );
}

