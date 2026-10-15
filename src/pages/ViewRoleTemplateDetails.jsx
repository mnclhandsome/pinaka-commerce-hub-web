import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { roleTemplatesApi } from "../api/roleTemplatesApi";

const defaultRoleTemplate = {
  id: "store-manager",
  name: "Store Manager",
  code: "STORE_MANAGER",
  description: "Full store operations access.",
  status: "Active",
};

export default function ViewRoleTemplateOverview() {
  const navigate = useNavigate();
  const { roleId } = useParams();
  const location = useLocation();
  const selectedRole = location.state?.roleTemplate;

  const [roleDetails, setRoleDetails] = useState(
    selectedRole || defaultRoleTemplate
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const tabs = [
    ["overview", "Overview", `/role-templates/${roleId || "store-manager"}`],
    [
      "store-types",
      "Applicable Store Types",
      `/role-templates/${roleId || "store-manager"}/store-types`,
    ],
    [
      "access",
      "Feature & Permission Access",
      `/role-templates/${roleId || "store-manager"}/access`,
    ],
  ];

  useEffect(() => {
    let isMounted = true;

    if (selectedRole) {
      setRoleDetails(selectedRole);
    }

    async function loadRoleDetails() {
      setLoading(true);
      setError("");

      try {
        const response = await roleTemplatesApi.getById(roleId);

        const data =
          response?.data?.data ??
          response?.data ??
          response?.result ??
          response;

        if (isMounted) {
          setRoleDetails({
            name:
              selectedRole?.name ??
              selectedRole?.roleName ??
              data?.name ??
              data?.roleName ??
              defaultRoleTemplate.name,
            code:
              selectedRole?.roleCode ??
              selectedRole?.code ??
              data?.roleCode ??
              data?.code ??
              data?.role_code ??
              defaultRoleTemplate.code,
            description:
              selectedRole?.description ??
              data?.description ??
              defaultRoleTemplate.description,
            status:
              selectedRole?.status ??
              data?.status ??
              defaultRoleTemplate.status,
          });
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError?.message ||
              "Unable to load role template details."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (roleId) loadRoleDetails();

    return () => {
      isMounted = false;
    };
  }, [roleId, selectedRole]);

  return (
    <section className="role-details-page">
      <button
        type="button"
        className="role-details-back"
        onClick={() => navigate("/role-templates")}
        aria-label="Back to role templates"
      >
        <i className="bi bi-arrow-left" />
      </button>

      <div className="role-details-heading">
        <div>
          <h1>{roleDetails.name}</h1>
          <p>Configure store types, features, and permissions for this role template.</p>
        </div>

      </div>

      <nav className="role-details-tabs">
        {tabs.map(([id, label, path]) => (
          <button
            type="button"
            key={id}
            className={id === "overview" ? "active" : ""}
            onClick={() =>
              navigate(path, { state: { roleTemplate: roleDetails } })
            }
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="role-details-card">
        <div className="role-details-card-title">
          <span>
            <i className="bi bi-person-vcard" />
          </span>

          <div>
            <h2>Role Template Details</h2>
            <p>View role template details.</p>
          </div>
        </div>

        {error && (
          <p className="role-error-message" role="alert">
            {error}
          </p>
        )}

        <div className="role-overview-grid">
          <div>
            <span>Role Template Name</span>
            <strong>{loading ? "Loading..." : roleDetails.name}</strong>
          </div>

          <div>
            <span>Role Template Code</span>
            <strong>{loading ? "Loading..." : roleDetails.code}</strong>
          </div>

          <div>
            <span>Status</span>
            <strong className="role-overview-active">
              <i className="bi bi-circle-fill" />
              {loading ? "Loading..." : roleDetails.status}
            </strong>
          </div>

          <div className="role-overview-description">
            <span>Description</span>
            <strong>
              {loading ? "Loading..." : roleDetails.description}
            </strong>
          </div>
        </div>
      </section>
    </section>
  );
}
