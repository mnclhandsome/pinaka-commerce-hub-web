import { useLocationOptions } from "../data/useLocationOptions";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import React, { useEffect, useState } from "react";
import PhoneInputModule from "react-phone-input-2";

const PhoneInput = PhoneInputModule.default || PhoneInputModule;
import "react-phone-input-2/lib/style.css";
import {
  User,
  Camera,
  MapPin,
  Settings,
  Upload,
  CalendarDays,
  ChevronDown,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

import "../styles/add-merchant-employee.css";
import "../styles/merchant-form-shared.css";

export default function AddMerchantEmployee({ onSave }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const merchantId = String(
    params.merchantId ||
      searchParams.get("merchantId") ||
      location.state?.merchantId ||
      "",
  );
  return (
    <MerchantEmployeeForm
      key={merchantId}
      merchantId={merchantId}
      initialMerchant={location.state?.merchant}
      onSave={onSave}
      onBack={() =>
        navigate(
          "/merchants" +
            (merchantId ? "?view=" + encodeURIComponent(merchantId) : ""),
        )
      }
    />
  );
}

export function MerchantEmployeeForm({
  merchantId,
  initialMerchant,
  onSave,
  onBack,
  embedded = false,
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const contextError = merchantId
    ? ""
    : "Open Add Employee from a merchant details page.";
  const [showPassword, setShowPassword] = useState(false);

  // Profile image preview
  const [profileImage, setProfileImage] = useState(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pinCode: "",
    country: "",
    merchant: merchantId,
    manager: "",
    username: "",
    password: "",
    employeeLoginPin: "",
    sendCredentials: true,
  });
  const locationOptions = useLocationOptions(formData);


  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    const trimmed = typeof value === "string" ? value.trim() : value;

    switch (name) {
      case "firstName":
        if (!trimmed) return "First Name is required.";
        if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(trimmed)) {
          return "First Name can contain letters, spaces, apostrophes and hyphens only.";
        }
        if (trimmed.length < 2 || trimmed.length > 50) {
          return "First Name must be between 2 and 50 characters.";
        }
        return "";

      case "lastName":
        if (!trimmed) return "Last Name is required.";
        if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(trimmed)) {
          return "Last Name can contain letters, spaces, apostrophes and hyphens only.";
        }
        if (trimmed.length < 2 || trimmed.length > 50) {
          return "Last Name must be between 2 and 50 characters.";
        }
        return "";

      case "email":
        if (!trimmed) return "Email Address is required.";
        if (trimmed.length > 254) return "Email Address is too long.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return "Enter a valid email address.";
        }
        return "";

      case "phone":
        {
          if (!trimmed) return "Phone Number is required.";

          const phoneDigits = trimmed.replace(/\D/g, "");

          if (phoneDigits.length < 8 || phoneDigits.length > 15) {
            return "Enter a valid phone number.";
          }
        }
        return "";

      case "dob":
        if (!trimmed) return "Date of Birth is required.";
        if (Number.isNaN(new Date(trimmed).getTime())) {
          return "Enter a valid date of birth.";
        }
        if (new Date(trimmed) > new Date()) {
          return "Date of Birth cannot be in the future.";
        }
        return "";

      case "gender":
        if (!trimmed) return "Gender is required.";
        if (!["Male", "Female", "Other"].includes(trimmed)) {
          return "Select a valid gender.";
        }
        return "";

      case "address1":
        if (!trimmed) return "Address Line 1 is required.";
        if (trimmed.length < 5 || trimmed.length > 150) {
          return "Address Line 1 must be between 5 and 150 characters.";
        }
        return "";

      case "address2":
        if (trimmed && trimmed.length > 150)
          return "Address Line 2 cannot exceed 150 characters.";
        return "";

      case "city":
        if (!trimmed) return "City is required.";
        if (trimmed.length > 50) return "City cannot exceed 50 characters.";
        return "";

      case "state":
        if (!trimmed) return "State is required.";
        return "";

      case "pinCode":
        return trimmed ? "" : "PIN Code is required.";

      case "country":
        if (!trimmed) return "Country is required.";
        return "";

      case "merchant":
        if (!trimmed) return "Merchant is required.";
        return "";

      case "employeeLoginPin":
        if (!trimmed) return "";
        return /^\d{6}$/.test(trimmed)
          ? ""
          : "Employee Login PIN must be exactly 6 digits.";

      case "username":
        if (!trimmed) return "Username is required.";
        if (!/^[A-Za-z0-9_]{4,30}$/.test(trimmed)) {
          return "Username must be 4-30 characters and use only letters, numbers and underscore.";
        }
        return "";

      case "password":
        if (!trimmed) return "Temporary Password is required.";
        if (trimmed.length < 8)
          return "Password must be at least 8 characters.";
        if (trimmed.length > 64) return "Password cannot exceed 64 characters.";
        if (
          !/[A-Z]/.test(trimmed) ||
          !/[a-z]/.test(trimmed) ||
          !/\d/.test(trimmed) ||
          !/[^A-Za-z0-9]/.test(trimmed)
        ) {
          return "Password must contain uppercase, lowercase, number and special character.";
        }
        return "";

      default:
        return "";
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "dob",
      "gender",
      "address1",
      "city",
      "state",
      "pinCode",
      "country",
      "merchant",
      "username",
      "password",
    ];

    requiredFields.forEach((name) => {
      const error = validateField(name, formData[name]);
      if (error) nextErrors[name] = error;
    });

    if (formData.address2) {
      const error = validateField("address2", formData.address2);
      if (error) nextErrors.address2 = error;
    }

    if (formData.employeeLoginPin) {
      const error = validateField("employeeLoginPin", formData.employeeLoginPin);
      if (error) nextErrors.employeeLoginPin = error;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /* =========================================================
     INPUT CHANGE
  ========================================================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    const nextValue =
      name === "employeeLoginPin"
        ? value.replace(/\D/g, "").slice(0, 6)
        : type === "checkbox"
          ? checked
          : value;

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "country" ? { state: "", city: "" } : name === "state" ? { city: "" } : {}),
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name, nextValue),
      }));
    }
  };

  /* =========================================================
     PROFILE IMAGE UPLOAD
  ========================================================= */

  const handleProfileUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    // Check image type
    if (!file.type.startsWith("image/")) {
      alert("Please select a JPG or PNG image.");
      e.target.value = "";
      return;
    }

    // Maximum 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be less than 2MB.");
      e.target.value = "";
      return;
    }

    // Create preview URL
    const imageUrl = URL.createObjectURL(file);

    setProfileImage(imageUrl);
  };

  /* =========================================================
     CLEANUP IMAGE URL
  ========================================================= */

  useEffect(() => {
    return () => {
      if (profileImage) {
        URL.revokeObjectURL(profileImage);
      }
    };
  }, [profileImage]);

  /* =========================================================
     SAVE EMPLOYEE
  ========================================================= */

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving || contextError) return;
    setSaveError("");

    if (!validateForm()) {
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector(
          ".field-invalid, .employee-phone-invalid .form-control",
        );
        firstInvalid?.focus?.();
      });
      return;
    }

    if (typeof onSave !== "function") {
      setSaveError(
        "Employee saving is not connected. Pass your employee save handler to AddMerchantEmployee.",
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        merchant: merchantId,
        merchantId,
        profileImage,
      });
      onBack();
    } catch (error) {
      setSaveError(error.message || "Unable to save employee.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     BACK
  ========================================================= */

  const handleBack = () => {
    onBack();
  };

  return (
    <div
      className={
        embedded
          ? "add-employee-page merchant-employee-embedded pch-context-form"
          : "add-employee-page pch-context-form"
      }
    >
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="add-employee-header">
        <div>
          <h1>Add Employee</h1>

          <div className="add-employee-breadcrumb">
            <span>Home</span>

            <span className="breadcrumb-arrow">›</span>

            <span>Employees</span>

            <span className="breadcrumb-arrow">›</span>

            <strong>Add Employee</strong>
          </div>
        </div>

        <button
          type="button"
          className="back-employees-btn"
          onClick={handleBack}
        >
          <ArrowLeft size={17} />
          Back to Employees
        </button>
      </div>

      {/* =====================================================
          FORM
      ===================================================== */}

      {contextError && (
        <p role="alert" className="field-error">
          {contextError}
        </p>
      )}
      {saveError && (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      )}
      <form onSubmit={handleSave} autoComplete="off">
        <fieldset
          disabled={saving || Boolean(contextError)}
          className="merchant-employee-fieldset"
        >
          <div className="add-employee-layout">
            {/* =================================================
              LEFT COLUMN
          ================================================= */}

            <div className="add-employee-left">
              {/* =================================================
                PERSONAL INFORMATION
            ================================================= */}

              <section className="employee-card">
                <CardHeader
                  icon={<User size={21} />}
                  title="Personal Information"
                  description="Enter the basic details of the employee."
                />

                <div className="employee-form-grid two-columns">
                  <FormField
                    label="First Name"
                    required
                    name="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={handleChange}
                    error={errors.firstName}
                  />

                  <FormField
                    label="Last Name"
                    required
                    name="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    error={errors.lastName}
                  />

                  <FormField
                    label="Email Address"
                    required
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                  />

                  {/* PHONE */}
                  <div
                    className={`employee-field employee-phone-field${errors.phone ? " employee-phone-invalid" : ""}`}
                  >
                    <label>
                      Phone Number <span>*</span>
                    </label>

                    <PhoneInput
                      country="in"
                      enableSearch
                      countryCodeEditable={false}
                      autoFormat
                      placeholder="Enter phone number"
                      value={formData.phone}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone: value,
                        }))
                      }
                      inputProps={{
                        name: "phone",
                        required: true,
                        autoComplete: "tel",
                      }}
                    />
                    {errors.phone && (
                      <span className="field-error">{errors.phone}</span>
                    )}
                  </div>

                  {/* DATE OF BIRTH */}

                  <div className="employee-field">
                    <label>
                      Date of Birth <span>*</span>
                    </label>

                    <div className="input-with-icon">
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleChange}
                        className={errors.dob ? "field-invalid" : ""}
                      />

                      <CalendarDays size={17} />
                    </div>
                    {errors.dob && (
                      <span className="field-error">{errors.dob}</span>
                    )}
                  </div>

                  {/* GENDER */}

                  <SelectField
                    label={
                      <>
                        Gender <span>*</span>
                      </>
                    }
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    error={errors.gender}
                    placeholder="Select gender"
                    options={["Male", "Female", "Other"]}
                  />
                </div>
              </section>

              {/* =================================================
                ADDRESS
            ================================================= */}

              <section className="employee-card">
                <CardHeader
                  icon={<MapPin size={21} />}
                  title="Address"
                  description="Enter the employee's address details."
                />

                <div className="employee-form-grid two-columns">
                  <FormField
                    label={
                      <>
                        Address Line 1 <span>*</span>
                      </>
                    }
                    name="address1"
                    placeholder="Enter address line 1"
                    value={formData.address1}
                    onChange={handleChange}
                    error={errors.address1}
                  />

                  <FormField
                    label="Address Line 2"
                    name="address2"
                    placeholder="Enter address line 2 (optional)"
                    value={formData.address2}
                    onChange={handleChange}
                    error={errors.address2}
                  />
                </div>

                {locationOptions.error && <p role="alert" className="field-error">{locationOptions.error}</p>}
              <div className="employee-form-grid two-columns" style={{ columnGap: "28px", rowGap: "18px", marginTop: "24px" }}>
                <SelectField label="Country" required name="country" value={formData.country}
                  onChange={handleChange} error={errors.country} options={locationOptions.countries}
                  placeholder={locationOptions.loading ? "Loading countries..." : "Select country"} disabled={locationOptions.loading} />
                <SelectField label="State" required name="state" value={formData.state}
                  onChange={handleChange} error={errors.state} options={locationOptions.states}
                  placeholder={formData.country ? "Select state" : "Select country first"} disabled={locationOptions.loading || !formData.country} />
                <SelectField label="City" required name="city" value={formData.city}
                  onChange={handleChange} error={errors.city} options={locationOptions.cities}
                  placeholder={formData.state ? "Select city" : "Select state first"} disabled={locationOptions.loading || !formData.state} />
                <FormField label="PIN Code" required name="pinCode" placeholder="Enter PIN code"
                  value={formData.pinCode} onChange={handleChange} error={errors.pinCode} />
              </div>
            </section>
            </div>

            {/* =================================================
              RIGHT COLUMN
          ================================================= */}

            <div className="add-employee-right">
              {/* =================================================
                PROFILE PHOTO
            ================================================= */}

              <section className="employee-card profile-photo-card">
                <CardHeader
                  icon={<Camera size={21} />}
                  title="Profile Photo"
                  description="Upload a profile photo for the employee."
                />

                <div className="profile-upload-area">
                  {/* PROFILE IMAGE */}

                  <div className="profile-avatar">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Employee profile"
                        className="profile-avatar-image"
                      />
                    ) : (
                      <User size={39} />
                    )}
                  </div>

                  {/* UPLOAD */}

                  <div>
                    <button
                      type="button"
                      className="upload-photo-btn"
                      onClick={() =>
                        document.getElementById("employee-photo").click()
                      }
                    >
                      <Upload size={17} />

                      {profileImage ? "Change Photo" : "Upload Photo"}
                    </button>

                    <input
                      id="employee-photo"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      hidden
                      onChange={handleProfileUpload}
                    />

                    <div className="upload-help">JPG, PNG (Max 2MB)</div>
                  </div>
                </div>
              </section>

              {/* =================================================
                ACCOUNT SETTINGS
            ================================================= */}

              <section className="employee-card">
                <CardHeader
                  icon={<Settings size={21} />}
                  title="Account Settings"
                  description="Set login and access details."
                />

                <div className="employee-form-grid two-columns">
                  <FormField
                    label="Username"
                    required
                    name="username"
                    placeholder="Enter username"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                  />

                  {/* PASSWORD */}

                  <div className="employee-field">
                    <label>
                      Temporary Password <span>*</span>
                    </label>

                    <div className="password-input">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter temporary password"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        className={errors.password ? "field-invalid" : ""}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <span className="field-error">{errors.password}</span>
                    )}
                  </div>
                  <div className="employee-login-pin-field">
                    <label htmlFor="merchant-create-employee-login-pin">Employee Login PIN</label>
                    <input
                      id="merchant-create-employee-login-pin"
                      name="employeeLoginPin"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={formData.employeeLoginPin}
                      onChange={handleChange}
                      className={errors.employeeLoginPin ? "field-invalid" : ""}
                      aria-describedby="merchant-create-employee-login-pin-help"
                      placeholder="Enter 6-digit PIN"
                    />
                    <small id="merchant-create-employee-login-pin-help" className="employee-login-pin-help">
                      Optional. Enter 6 digits.
                    </small>
                    {errors.employeeLoginPin && <span className="field-error">{errors.employeeLoginPin}</span>}
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* =====================================================
            BOTTOM ACTION BAR
        ===================================================== */}

          <div className="employee-form-actions">
            <button
              type="button"
              className="cancel-employee-btn"
              onClick={handleBack}
            >
              Cancel
            </button>

            <button type="submit" className="save-employee-btn">
              Save Employee
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

function CardHeader({ icon, title, description }) {
  return (
    <div className="pch-form-card-header">
      <div className="pch-form-card-icon">{icon}</div>

      <div>
        <h2>{title}</h2>

        <p>{description}</p>
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  required,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
}) {
  return (
    <div className="employee-field">
      <label>
        {label} {required && <span>*</span>}
      </label>

      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={error ? "field-invalid" : ""}
      />

      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

/* =========================================================
   SELECT FIELD
========================================================= */

function SelectField({
  label,
  required,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled = false,
}) {
  return (
    <div className="employee-field">
      <label>
        {label} {required && <span>*</span>}
      </label>

      <div className="employee-select">
        <select
          name={name}
          disabled={disabled}
          value={value}
          onChange={onChange}
          className={error ? "field-invalid" : ""}
        >
          <option value="">{placeholder}</option>

          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <ChevronDown size={17} className="employee-select-arrow" />
      </div>

      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
