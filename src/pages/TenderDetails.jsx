import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { tendorsApi } from "../api/tendors";
import "../styles/tenders.css";

const initialTender = {
  code: "",
  name: "",
  status: "",
};

function mapTender(tender) {
  const rawStatus = String(tender.status || "").toUpperCase();

  return {
    id: tender.id,
    code: tender.code || tender.tendorCode || "",
    name: tender.tendorName || tender.name || "",
    status:
      rawStatus === "INACTIVE" || rawStatus === "DELETED"
        ? "Inactive"
        : rawStatus === "ACTIVE"
          ? "Active"
          : tender.status || "Active",
    createdAt: tender.createdAt || tender.created_at || null,
    updatedAt: tender.updatedAt || tender.updated_at || null,
  };
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TenderDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenderId } = useParams();

  const [tender, setTender] = useState(() => {
    const initial = location.state?.tender;
    return initial ? mapTender(initial) : initialTender;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchTender() {
      try {
        setLoading(true);
        setError("");

        const response = await tendorsApi.getById(tenderId);
        const found = response?.tendor || response?.tender || response?.data?.tendor || response?.data?.tender || response?.data || response;

        if (!found || typeof found !== "object" || !found.id) {
          throw new Error("Tender details could not be found.");
        }

        if (!cancelled) {
          setTender(mapTender(found));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load tender details.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTender();

    return () => {
      cancelled = true;
    };
  }, [tenderId]);

  return (
    <section className="tender-details-page">
      <div className="tender-details-top">
        <button
          type="button"
          className="tender-details-back"
          onClick={() => navigate("/tenders")}
          aria-label="Back to Tenders"
          title="Back to Tenders"
        >
          <i className="bi bi-arrow-left" />
        </button>

        <div className="tender-details-heading">
          <div className="tender-title-line">
            <h1>{tender.name || "Tender Overview"}</h1>

          </div>

          <p>View tender details and availability.</p>
        </div>
      </div>

      {loading && <p>Loading tender details...</p>}

      {error && (
        <div className="tender-details-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <nav
            className="tender-details-tabs"
            aria-label="Tender sections"
          >
            <button type="button" className="active">
              Tender Details
            </button>
          </nav>

          <section className="tender-details-card">
            <div className="tender-details-card-heading">
              <div className="tender-details-icon">
                <i className="bi bi-info-circle" />
              </div>

              <div>
                <h2>Tender Details</h2>
                <p>View the saved tender information.</p>
              </div>
            </div>

            <div className="tender-details-grid">
              <label className="tender-details-field">
                <span>Tender Code</span>
                <input value={tender.code} readOnly />
              </label>

              <label className="tender-details-field">
                <span>Status</span>
                <input
                  value={tender.status}
                  readOnly
                  className={
                    tender.status.toLowerCase() === "active"
                      ? "tender-details-active"
                      : "tender-details-inactive"
                  }
                />
              </label>
            </div>

            <div className="tender-details-grid">
              <label className="tender-details-field">
                <span>Tender Name</span>
                <input value={tender.name} readOnly />
              </label>

              <label className="tender-details-field">
                <span>Created At</span>
                <input value={formatDate(tender.createdAt)} readOnly />
              </label>
            </div>

            <div className="tender-details-grid">
              <label className="tender-details-field">
                <span>Updated At</span>
                <input value={formatDate(tender.updatedAt)} readOnly />
              </label>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
