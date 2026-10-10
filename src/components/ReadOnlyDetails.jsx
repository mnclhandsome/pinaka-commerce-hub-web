import DeviceNavigation from "./DeviceNavigation";
import "../styles/read-only-details.css";

export default function ReadOnlyDetails({ title, subtitle, listLabel, onBack, data, sections, message }) {
  return (
    <div className="device-view-page read-only-details-page">
      <DeviceNavigation title={title} listLabel={listLabel} onBack={onBack} />
      <div className="device-view-header"><div><h1>{title}</h1><p>{subtitle}</p></div></div>
      {message ? <div className="device-view-card" role="status">{message}</div> : sections.map((section) => (
        <section className="device-view-card" key={section.title}>
          <div className="device-card-header"><div><h2>{section.title}</h2></div></div>
          <div className="device-view-grid">
            {section.fields.map((field) => {
              const value = data[field.key];
              const display = value == null || value === "" ? "—" : Array.isArray(value) ? (value.length ? value.join(", ") : "—") : typeof value === "boolean" ? (value ? "Yes" : "No") : typeof value === "object" ? JSON.stringify(value) : String(value);
              return <div className={`device-view-field${field.fullWidth ? " details-full-width" : ""}`} key={field.key}>
                <label>{field.label}</label>
                <div className="device-view-value">{field.render ? field.render(value, data) : display}</div>
              </div>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
