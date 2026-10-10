import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

import { getFeature } from "../api/features";
import { getFeaturePermissionById } from "../api/featurePermissionsApi";

import "../styles/featurepermissions.css";


const normalizePermission = (response, feature) => {
  const source =
    response?.permission ||
    response?.data?.permission ||
    response?.data ||
    response ||
    {};

  return {
    id:
      source.id ??
      source._id ??
      source.permissionId ??
      source.permission_id ??
      "",

    key:
      source.permissionCode ||
      source.permission_code ||
      source.permissionKey ||
      source.permission_key ||
      source.key ||
      "",

    name:
      source.name ||
      source.permissionName ||
      source.permission_name ||
      "",

    permissionType:
      source.permissionType ||
      source.permission_type ||
      "READ",

    featureId:
      source.featureId ??
      source.feature_id ??
      feature?.id ??
      "",

    featureName:
      source.feature?.name ||
      source.featureName ||
      source.feature_name ||
      feature?.name ||
      "",

    description:
      source.description ||
      source.permissionDescription ||
      source.permission_description ||
      "",

    status:
      String(source.status || "ACTIVE").toUpperCase() === "ACTIVE"
        ? "Active"
        : "Inactive",

    createdAt:
      source.createdAt ||
      source.created_at ||
      "",

    updatedAt:
      source.updatedAt ||
      source.updated_at ||
      "",
  };
};

function DetailField({ label, children, fullWidth = false }) {
  return (
    <label
      className={`fpo-field${
        fullWidth ? " fpo-field-full" : ""
      }`}
    >
      <span className="fpo-label">{label}</span>

      {fullWidth ? (
        <textarea
          value={children || ""}
          readOnly
          rows={3}
        />
      ) : (
        <input
          value={children || ""}
          readOnly
        />
      )}
    </label>
  );
}

export default function FeaturePermissionsOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { featureId, permissionId } = useParams();

  const [permission, setPermission] = useState(
    location.state?.permission
      ? normalizePermission(location.state.permission)
      : null
  );

  const [feature, setFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPermissionDetails() {
      setLoading(true);
      setError("");

      try {
        const [permissionResponse, featureResponse] =
          await Promise.all([
            getFeaturePermissionById(featureId, permissionId),
            getFeature(featureId),
          ]);

        if (cancelled) return;

        const featureData =
          featureResponse?.data?.feature ||
          featureResponse?.data ||
          featureResponse?.feature ||
          featureResponse;

        const permissionData = normalizePermission(
          permissionResponse,
          featureData
        );

        setFeature(featureData);

        setPermission({
          ...permissionData,
          featureName:
            permissionData.featureName ||
            featureData?.name ||
            "",
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              "Unable to load permission details."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (featureId && permissionId) {
      loadPermissionDetails();
    } else {
      setError("Feature ID or permission ID is missing.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [featureId, permissionId]);

  const goBack = () => {
    navigate("/feature-permissions");
  };

  return (
    <section className="fpo-page">
      <div className="fpo-top">
        <button
          type="button"
          className="fpo-back-button"
          onClick={goBack}
          aria-label="Back to Feature Permissions"
          title="Back to Feature Permissions"
        >
          <i className="bi bi-arrow-left" />
        </button>

        <div className="fpo-heading">
          <div className="fpo-title-line">
            <h1>
              {permission?.name || "Permission Overview"}
            </h1>
          </div>

          <p>
            {permission?.description ||
              "View feature permission details and configuration."}
          </p>
        </div>
      </div>

      {loading && (
        <p className="fpo-message">
          Loading permission details...
        </p>
      )}

      {!loading && error && (
        <div className="fpo-error" role="alert">
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && permission && (
        <>
          <nav
            className="fpo-tabs"
            aria-label="Permission sections"
          >
            <button type="button" className="active">
              Permission Details
            </button>
          </nav>

          <section className="fpo-details-card">
            <div className="fpo-card-heading">
              <div className="fpo-card-icon">
                <i className="bi bi-info-circle" />
              </div>

              <div>
                <h2>Permission Details</h2>
                <p>View permission details.</p>
              </div>
            </div>

            <div className="fpo-details-grid">
              <DetailField label="Permission Code">
                {permission.key
                  ? String(permission.key).toUpperCase()
                  : "—"}
              </DetailField>


               <DetailField label="Permission Name">
                {permission.name}
              </DetailField>

            
              <DetailField label="Feature Name">
                {permission.featureName ||
                  feature?.name ||
                  "—"}
              </DetailField>
              
              <DetailField label="Status">
                {permission.status}
              </DetailField>
              
              <DetailField
                label="Description"
                fullWidth
              >
                {permission.description}
              </DetailField>
            </div>
          </section>

          

         
        </>
      )}
    </section>
  );
}

