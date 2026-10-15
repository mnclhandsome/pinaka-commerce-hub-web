import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, User, BriefcaseBusiness, MapPin, Settings } from "lucide-react";
import { getEmployee } from "../api/employees";
import "../styles/employee-view.css";

function displayValue(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return value.name || value.businessName || value.storeName || value.roleName || value.id || "";
  }
  return value == null ? "" : String(value);
}

function Section({ title, icon: Icon, fields, children }) {
  const available = fields.filter(([, value]) => value !== undefined && value !== null && value !== "—");
  return (
    <section className="employee-view-card">
      <div className="employee-view-card-header"><span><Icon size={19} /></span><h2>{title}</h2></div>
      {children}
      <dl className="employee-view-grid">
        {available.map(([label, value]) => (
          <div className="employee-view-field" key={label}>
            <dt>{label}</dt><dd>{displayValue(value) || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function EmployeeView() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setEmployee(null);
    setPhotoError(false);
    getEmployee(employeeId)
      .then((response) => {
        const record = response?.employee || response;
        if (!record || typeof record !== "object" || Array.isArray(record) ||
          !(record.id || record.employeeId || record.employeeCode)) {
          throw new Error("Employee not found.");
        }
        if (active) setEmployee(record);
      })
      .catch((failure) => {
        if (active) setError(failure.message || "Unable to load employee.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employeeId, retry]);

  const photo = employee?.profileImageUrl || employee?.profileImage;
  const assignments = Array.isArray(employee?.storeAssignments) ? employee.storeAssignments : [];

  return (
    <div className="employee-view-page">
      <header className="employee-view-topbar">
        <button type="button" onClick={() => navigate("/employees")}><ArrowLeft size={16} /> Employees</button>
        <span>/</span><strong>View Employee</strong>
      </header>
      <div className="employee-view-header">
        <div><h1>View Employee</h1><p>View employee information, work details, address, and account settings.</p></div>
      </div>
      {loading ? <p role="status">Loading employee...</p> : error ? (
        <div className="employee-view-error" role="alert">{error}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
        </div>
      ) : employee && <div className="employee-view-sections">
        <Section title="Personal Information" icon={User} fields={[
          ["Name", employee.name],
          ["First Name", employee.firstName], ["Last Name", employee.lastName],
          ["Email", employee.email], ["Phone", employee.phone],
          ["Date of Birth", employee.dateOfBirth || employee.dob], ["Gender", employee.gender],
        ]}>
          {photo && !photoError && <img className="employee-view-photo" src={photo}
            alt="Employee profile" onError={() => setPhotoError(true)} />}
        </Section>
        <Section title="Work Information" icon={BriefcaseBusiness} fields={[
          ["Employee Code", employee.employeeCode],
          ["Merchant", employee.merchantName || employee.merchant],
          ["Store", employee.storeName || employee.store], ["Role", employee.role],
          ["Manager", employee.manager], ["Status", employee.status],
        ]}>
          {assignments.length > 0 && <div className="employee-view-assignments">
            <h3>Store Assignments</h3>
            {assignments.map((assignment, index) => <dl className="employee-view-grid" key={index}>
              <div className="employee-view-field"><dt>Store</dt><dd>{displayValue(assignment.storeName || assignment.store) || "Not provided"}</dd></div>
              <div className="employee-view-field"><dt>Roles</dt><dd>{displayValue(assignment.roles) || "Not provided"}</dd></div>
            </dl>)}
          </div>}
        </Section>
        <Section title="Address" icon={MapPin} fields={[
          ["Address Line 1", employee.addressLine1 || employee.address1],
          ["Address Line 2", employee.addressLine2 || employee.address2],
          ["City", employee.city], ["State", employee.state],
          ["Postal Code", employee.postalCode || employee.pinCode], ["Country", employee.country],
        ]} />
        <Section title="Account Settings" icon={Settings} fields={[
          ["Username", employee.username],
          ["Employee Login PIN", employee.loginPin || employee.employeeLoginPin || employee.login_pin || employee.pin],
        ]} />
      </div>}
    </div>
  );
}
