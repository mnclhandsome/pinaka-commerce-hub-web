import { Children, Fragment, useId, useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/filter-dropdown.css";

// The noninteractive select retains each screen's existing CSS sizing. Only the
// overlaid trigger and portalled listbox receive user interaction.
export default function FilterDropdown({ children, value, defaultValue, onChange, disabled, renderFooter, triggerIcon, preserveToolbarLayout = false, ...props }) {
  const id = useId();
  const nativeRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const typed = useRef({ text: "", time: 0 });
  const [localValue, setLocalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);
  const [triggerStyle, setTriggerStyle] = useState({});
  const [triggerPosition, setTriggerPosition] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const flatten = (nodes) => Children.toArray(nodes).flatMap((child) => child?.type === Fragment ? flatten(child.props.children) : [child]);
  const optionText = (nodes) => Children.toArray(nodes).map((node) => typeof node === "object" ? optionText(node.props?.children) : String(node)).join("");
  const options = flatten(children).filter((child) => child?.type === "option").map((child) => ({
    value: String(child.props.value ?? optionText(child.props.children)),
    label: optionText(child.props.children), disabled: Boolean(child.props.disabled), hidden: Boolean(child.props.hidden),
  }));
  const selectedValue = String(value ?? localValue ?? options[0]?.value ?? "");
  const selected = options.findIndex((option) => option.value === selectedValue);

  useLayoutEffect(() => {
    const syncStyle = () => {
      const style = getComputedStyle(nativeRef.current);
      const keys = ["font", "color", "backgroundColor", "border", "borderRadius", "padding", "boxShadow", "textAlign",
        ...(preserveToolbarLayout ? ["backgroundImage", "backgroundPosition", "backgroundRepeat", "backgroundSize"] : [])];
      const rect = nativeRef.current.getBoundingClientRect();
      setTriggerStyle({ ...Object.fromEntries(keys.map((key) => [key, style[key]])),
        width: rect.width, height: rect.height,
        left: preserveToolbarLayout ? 0 : nativeRef.current.offsetLeft,
        top: preserveToolbarLayout ? 0 : nativeRef.current.offsetTop });
      if (preserveToolbarLayout) {
        const parentRect = nativeRef.current.parentElement.getBoundingClientRect();
        setTriggerPosition({ position: "absolute", left: rect.left - parentRect.left, top: rect.top - parentRect.top, width: rect.width, height: rect.height, zIndex: 100 });
      }
    };
    const parent = nativeRef.current.parentElement;
    const anchored = preserveToolbarLayout && !parent.classList.contains("pch-filter-anchor");
    if (anchored) parent.classList.add("pch-filter-anchor");
    syncStyle();
    const observer = new ResizeObserver(syncStyle);
    observer.observe(nativeRef.current);
    if (preserveToolbarLayout) {
      // Keep the overlay anchored when forms above the toolbar expand or collapse.
      for (let parent = nativeRef.current.parentElement; parent && parent !== document.body; parent = parent.parentElement) observer.observe(parent);
    }
    window.addEventListener("resize", syncStyle);
    return () => { observer.disconnect(); window.removeEventListener("resize", syncStyle); if (anchored) parent.classList.remove("pch-filter-anchor"); };
  }, [props.className, preserveToolbarLayout]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const menu = menuRef.current;
      if (!menu) return;
      // Measure content at the trigger's width, including padding, borders, and
      // the optional footer, without changing the menu's current scroll position.
      const menuWidth = Math.min(rect.width, Math.max(0, window.innerWidth - 16));
      menu.style.width = `${menuWidth}px`;
      const menuStyle = getComputedStyle(menu);
      const contentHeight = menu.scrollHeight + parseFloat(menuStyle.borderTopWidth) + parseFloat(menuStyle.borderBottomWidth);
      const below = Math.max(0, window.innerHeight - rect.bottom - 12);
      const above = Math.max(0, rect.top - 12);
      const upwards = below < contentHeight && above > below;
      const height = upwards ? above : below;
      const overflowing = contentHeight > height;
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const nextPosition = { width: menuWidth, left: Math.max(8, Math.min(rect.left, maxLeft)),
        maxHeight: overflowing ? height : "none", overflowY: overflowing ? "auto" : "hidden",
        ...(upwards ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) };
      menu.style.maxHeight = overflowing ? `${height}px` : "none";
      menu.style.overflowY = nextPosition.overflowY;
      menu.style.left = `${nextPosition.left}px`;
      menu.style.top = nextPosition.top === undefined ? "auto" : `${nextPosition.top}px`;
      menu.style.bottom = nextPosition.bottom === undefined ? "auto" : `${nextPosition.bottom}px`;
      setPosition(nextPosition);
      setTooltip(null);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(triggerRef.current);
    const contentObserver = new MutationObserver(place);
    contentObserver.observe(menuRef.current, { childList: true, subtree: true, characterData: true });
    const onScroll = (event) => { if (!menuRef.current?.contains(event.target)) place(); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => { observer.disconnect(); contentObserver.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", onScroll, true); };
  }, [open, options.length, preserveToolbarLayout]);

  useEffect(() => {
    if (open && position) {
      const element = optionRefs.current[active];
      const menu = menuRef.current;
      if (element && menu) {
        const optionTop = element.offsetTop;
        const optionBottom = optionTop + element.offsetHeight;
        if (optionTop < menu.scrollTop) menu.scrollTop = optionTop;
        else if (optionBottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = optionBottom - menu.clientHeight;
      }
      const frame = requestAnimationFrame(() => {
        if (element) showTooltip({ currentTarget: element }, options[active].label);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [open, active, Boolean(position)]);

  const close = (restore = true) => {
    setOpen(false); setPosition(null); setTooltip(null);
    if (restore) triggerRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); };
  }, [open]);
  useEffect(() => { if (disabled) close(false); }, [disabled]);

  const choose = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setLocalValue(option.value);
    nativeRef.current.value = option.value;
    onChange?.({ target: nativeRef.current, currentTarget: nativeRef.current, type: "change" });
    close();
  };
  const move = (step) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (active + step * i + options.length) % options.length;
      if (!options[next].disabled && !options[next].hidden) { setActive(next); break; }
    }
  };
  const keyDown = (event) => {
    if (event.target.closest(".pch-filter-footer") && event.key !== "Escape") return;
    if (event.key === "Tab") {
      if (renderFooter && open && !event.shiftKey) return;
      close(); return;
    }
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        setActive(selected >= 0 && !options[selected].disabled ? selected : options.findIndex((option) => !option.disabled && !option.hidden));
        setOpen(true);
      } else if (event.key === "ArrowDown") move(1);
      else if (event.key === "ArrowUp") move(-1);
      else if (event.key === "Home") setActive(options.findIndex((option) => !option.disabled && !option.hidden));
      else if (event.key === "End") setActive(options.findLastIndex((option) => !option.disabled && !option.hidden));
      else choose(active);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      typed.current = { text: (now - typed.current.time < 700 ? typed.current.text : "") + event.key.toLowerCase(), time: now };
      const next = options.findIndex((option) => !option.disabled && !option.hidden && option.label.toLowerCase().startsWith(typed.current.text));
      if (next >= 0) { if (open) setActive(next); else choose(next); }
    }
  };
  const showTooltip = (event, label) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) { setTooltip(null); return; }
    const rect = element.getBoundingClientRect();
    setTooltip({ label, left: Math.max(8, Math.min(rect.left, window.innerWidth - 260)), top: rect.top > 50 ? rect.top - 38 : rect.bottom + 4 });
  };
  const sizingControl = <select {...props} ref={nativeRef} value={selectedValue} disabled={disabled} onChange={() => {}}
      id={undefined} aria-hidden="true" tabIndex={-1} className={`${props.className || ""} ${preserveToolbarLayout ? "pch-master-filter-sizing" : "pch-filter-sizing"}`}>
      {children}
    </select>;
  const trigger = <button type="button" ref={triggerRef} id={props.id} className="pch-filter-trigger" style={triggerStyle}
      disabled={disabled} role="combobox" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-label={props["aria-label"] || options[0]?.label || "Filter"}
      title={options[selected]?.label} onKeyDown={keyDown}
      onClick={() => { if (open) close(); else { setActive(selected >= 0 && !options[selected].disabled ? selected : options.findIndex((option) => !option.disabled && !option.hidden)); setOpen(true); } }}>
      {triggerIcon}<span>{options[selected]?.label || ""}</span>
      {(!preserveToolbarLayout || !triggerStyle.backgroundImage || triggerStyle.backgroundImage === "none") && <i className="bi bi-chevron-down" aria-hidden="true" />}
    </button>;
  return <>
    {preserveToolbarLayout ? <>
      {sizingControl}
      {triggerPosition && <span className="pch-filter-dropdown" style={triggerPosition}>{trigger}</span>}
    </> : <span className="pch-filter-dropdown">{sizingControl}{trigger}</span>}
    {open && createPortal(<div ref={menuRef} id={id} role="listbox" aria-label={props["aria-label"] || "Filter options"}
      className="pch-filter-menu" style={position || { visibility: "hidden" }} onKeyDown={keyDown}>
      {options.map((option, index) => option.hidden ? null : <button type="button" role="option" key={`${option.value}-${index}`}
        ref={(element) => { optionRefs.current[index] = element; }} tabIndex={index === active ? 0 : -1}
        disabled={option.disabled} aria-selected={index === selected} className="pch-filter-option"
        onFocus={(event) => { setActive(index); showTooltip(event, option.label); }}
        onMouseEnter={(event) => showTooltip(event, option.label)} onMouseLeave={() => setTooltip(null)}
        onClick={() => choose(index)}>{option.label}</button>)}
      {renderFooter && <div className="pch-filter-footer">{renderFooter(() => close())}</div>}
    </div>, document.body)}
    {tooltip && open && createPortal(<div role="tooltip" className="pch-filter-tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.label}</div>, document.body)}
  </>;
}
