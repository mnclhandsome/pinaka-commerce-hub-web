import { useLocationOptions } from "../data/useLocationOptions";
import { EmployeeToast, EmployeeDeleteDialog } from "../components/EmployeeFeedback";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listMerchants } from "../api/merchants";

import {
  User,
  Camera,
  BriefcaseBusiness,
  MapPin,
  Settings,
  Upload,
  CalendarDays,
  ChevronDown,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

import "../styles/add-employee.css";
import "../styles/editemployee.css";

// import { updateEmployee } from "../api/employees";
import {
  updateEmployee,
  uploadEmployeeProfileImage,
  getEmployeeProfileImage,
  deleteEmployeeProfileImage,
} from "../api/employees";

/* =========================================================
   STORE ROLE ASSIGNMENT STYLES
========================================================= */

const storeRoleStyles = `
  .field-error {
    display: block;
    margin-top: 5px;
    color: #dc2626;
    font-size: 12px;
    line-height: 1.3;
  }
 
  .field-invalid {
    border-color: #dc2626 !important;
  }
 
  .employee-phone-invalid .form-control {
    border-color: #dc2626 !important;
  }
 
  .work-information-card {
    overflow: visible;
  }
 
  .work-merchant-field {
    margin-top: 24px;
  }
 
  .employee-login-pin-field {
    margin-top: 20px;
  }
 
  .employee-login-pin-field label {
    display: block;
    margin-bottom: 7px;
    color: #17233d;
    font-size: 15px;
    font-weight: 600;
  }
 
  .employee-login-pin-field label span {
    color: #e11d48;
  }
 
  .employee-login-pin-field input {
    width: 100%;
    height: 46px;
    padding: 0 14px;
    border: 1px solid #d4dfed;
    border-radius: 8px;
    background: #fff;
    color: #1c3154;
    font-size: 15px;
    outline: none;
    box-sizing: border-box;
    letter-spacing: 2px;
  }
 
  .employee-login-pin-field input::placeholder {
    color: #91a3bd;
    letter-spacing: 0;
  }
 
  .employee-login-pin-field input:focus {
    border-color: #8172ef;
    box-shadow: 0 0 0 3px rgba(129, 114, 239, .10);
  }
 
  .employee-login-pin-help {
    display: block;
    margin-top: 6px;
    color: #7b8da8;
    font-size: 12px;
  }
 
  .employee-api-error {
    margin-bottom: 15px;
    padding: 11px 14px;
    border: 1px solid #fecaca;
    border-radius: 8px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 13px;
  }
 
  .save-employee-btn:disabled {
    opacity: .6;
    cursor: not-allowed;
  }
 
  @media (max-width: 900px) {
    .store-assignment-card {
      grid-template-columns: minmax(0, 1fr) 36px;
    }
  }
`;

function StoreRoleAssignmentStyles() {
  return <style>{storeRoleStyles}</style>;
}

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeId(employee) {
  return (
    employee.employeeId || employee.employee_id || employee.id || employee._id
  );
}

function getEmployeeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Extract human-readable Business Name from Merchant Object or String
function getMerchantName(m) {
  if (!m) return "";
  if (typeof m === "string") return m;
  return (
    m.businessName ||
    m.business_name ||
    m.legalBusinessName ||
    m.legal_business_name ||
    m.name ||
    m.ownerName ||
    m.id ||
    ""
  );
}

/* =========================================================
   EDIT EMPLOYEE COMPONENT
========================================================= */

export default function EditEmployee({ employee: employeeProp, onBack: onBackProp, onSave: onSaveProp } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const employee =  employeeProp ||  location.state?.employee || {};
  const employeeId = useMemo(() => getEmployeeId(employee), [employee]);

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmPhotoDelete, setConfirmPhotoDelete] = useState(false);

  // DYNAMIC MERCHANTS STATE
  const [merchants, setMerchants] = useState([]);
  const [loadingMerchants, setLoadingMerchants] = useState(true);

  // FETCH MERCHANTS FROM API ON MOUNT
  useEffect(() => {
    let active = true;

    listMerchants()
      .then((data) => {
        if (active) {
          setMerchants(data);
          setLoadingMerchants(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load merchants:", err);
        if (active) setLoadingMerchants(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const [profileImage, setProfileImage] = useState(
    employee.profileImageUrl || employee.profileImage || null,
  );

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [deletingProfileImage, setDeletingProfileImage] = useState(false);
  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    getEmployeeProfileImage(employeeId)
      .then((response) => {
        if (!active) return;
        const savedEmployee = response?.employee;
        setProfileImage(savedEmployee?.profileImageUrl || null);
        const savedPin = savedEmployee?.loginPin || savedEmployee?.employeeLoginPin || savedEmployee?.login_pin || savedEmployee?.pin;
        if (savedPin) {
          setFormData((current) => ({ ...current, employeeLoginPin: String(savedPin) }));
        }
      })
      .catch((error) => {
        if (active) setNotice(error.message || "Unable to load the saved profile photo.");
      });
    return () => { active = false; };
  }, [employeeId]);

  const [formData, setFormData] = useState({
    firstName: employee.firstName || employee.name?.split(" ")[0] || "",
    lastName:
      employee.lastName || employee.name?.split(" ").slice(1).join(" ") || "",
    email: employee.email || "",
    phone: employee.phone || "",
    dob: getEmployeeDate(employee.dateOfBirth || employee.dob),
    gender: employee.gender || "",
    address1: employee.addressLine1 || employee.address1 || "",
    address2: employee.addressLine2 || employee.address2 || "",
    city: employee.city || "",
    state: employee.state || "",
    pinCode: employee.postalCode || employee.pinCode || "",
    country: employee.country || "",

    // Set initial merchant to Business Name or merchant string
    merchantId:
      employee.merchantId ||
      employee.merchant_id ||
      employee.merchant?.id ||
      employee.merchant?.uuid ||
      "",

    merchant: getMerchantName(employee.merchant) || employee.merchantName || "",

    employeeLoginPin: employee.loginPin || employee.employeeLoginPin || employee.login_pin || employee.pin || "",
    manager: employee.manager || "",
    username: employee.username || employee.employeeCode || employee.id || "",
    status: String(employee.status || "INACTIVE").toUpperCase() === "ACTIVE" ? "Active" : "Inactive",
    password: "",
    sendCredentials: employee.sendCredentials ?? true,
  });
  const locationOptions = useLocationOptions(formData);


  const [errors, setErrors] = useState({});

  /* =========================================================
     VALIDATION
  ========================================================= */

  const validateField = (name, value) => {
    const trimmed = typeof value === "string" ? value.trim() : value;

    switch (name) {
      case "employeeLoginPin":
        if (!trimmed) return "";
        return /^\d{6}$/.test(trimmed) ? "" : "Employee Login PIN must be exactly 6 digits.";

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

      case "phone": {
        if (!trimmed) return "Phone Number is required.";
        const phoneDigits = trimmed.replace(/\D/g, "");
        if (phoneDigits.length < 8 || phoneDigits.length > 15) {
          return "Enter a valid phone number.";
        }
        return "";
      }

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
        if (trimmed && trimmed.length > 150) {
          return "Address Line 2 cannot exceed 150 characters.";
        }
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

      case "username":
        if (!trimmed) return "Username is required.";
        if (!/^[A-Za-z0-9_]{4,30}$/.test(trimmed)) {
          return "Username must be 4-30 characters and use only letters, numbers and underscore.";
        }
        return "";

      case "status":
        return ["Active", "Inactive"].includes(value) ? "" : "Select Active or Inactive.";

      case "password":
        if (!value) return "";
        if (trimmed.length < 8) return "Temporary password must be at least 8 characters.";
        if (trimmed.length > 128) return "Temporary password cannot exceed 128 characters.";
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
      "status",
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

    if (formData.password) {
      const error = validateField("password", formData.password);
      if (error) nextErrors.password = error;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /* =========================================================
     INPUT CHANGE HANDLERS
  ========================================================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

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

  const handlePhoneChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      phone: value,
    }));

    if (errors.phone) {
      setErrors((prev) => ({
        ...prev,
        phone: validateField("phone", value),
      }));
    }
  };

  /* =========================================================
     PROFILE IMAGE
  ========================================================= */

  const handleProfileUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!employeeId) {
      setNotice("Employee ID is missing.");
      e.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setNotice("Please select a JPG or PNG image.");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotice("Image size must be less than 2MB.");
      e.target.value = "";
      return;
    }

    try {
      setUploadingProfileImage(true);

      // Show selected image immediately
      const previewUrl = URL.createObjectURL(file);
      setProfileImage(previewUrl);
      setProfileImageFile(file);

      const response = await uploadEmployeeProfileImage(employeeId, file);

      console.log("Profile image upload response:", response);

      const uploadedImageUrl =
        response?.profileImageUrl ||
        response?.employee?.profileImageUrl ||
        null;

      if (!uploadedImageUrl || response?.success === false) {
        throw new Error(response?.message || "The server did not return a saved profile image.");
      }
      setProfileImage(uploadedImageUrl);

      setProfileImageFile(null);

      setNotice("Profile photo updated successfully.");
    } catch (error) {
      console.error("Profile image upload failed:", error);

      // Restore the previous image if upload failed
      setProfileImage(
        employee.profileImageUrl || employee.profileImage || null,
      );

      setProfileImageFile(null);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to upload profile photo.";

      setNotice(Array.isArray(message) ? message.join(", ") : String(message));
    } finally {
      setUploadingProfileImage(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (profileImage && profileImage.startsWith("blob:")) {
        URL.revokeObjectURL(profileImage);
      }
    };
  }, [profileImage]);
  const handleDeleteProfileImage = async () => {
    if (!employeeId || !profileImage) return;

    setConfirmPhotoDelete(false);

    try {
      setDeletingProfileImage(true);

      await deleteEmployeeProfileImage(employeeId);

      setProfileImage(null);
      setProfileImageFile(null);

      setNotice("Profile photo deleted successfully.");
    } catch (error) {
      console.error("Delete profile image failed:", error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to delete profile photo.";

      setNotice(Array.isArray(message) ? message.join(", ") : String(message));
    } finally {
      setDeletingProfileImage(false);
    }
  };
  /* =========================================================
     UPDATE EMPLOYEE API CALL
  ========================================================= */

  const handleSave = async (e) => {
    e.preventDefault();
    setApiError("");

    if (!employeeId) {
      setApiError(
        "Employee ID is missing. Please return to the Employees list and try again.",
      );
      return;
    }

    if (!validateForm()) {
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector(
          ".field-invalid, .employee-phone-invalid .form-control",
        );
        firstInvalid?.focus?.();
      });
      return;
    }

    setSaving(true);

    try {
       const response = await updateEmployee(employeeId, formData);
      console.log("Employee update response:", response);

      if (onSaveProp) {
        await onSaveProp(response);
      } else {
        navigate("/employees", { state: { employeeMessage: "Employee updated successfully." } });
      }
    } catch (error) {
      console.error("Update employee failed:", error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to update employee. Please try again.";

      setApiError(
        Array.isArray(message) ? message.join(", ") : String(message),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (onBackProp) onBackProp();
    else navigate("/employees");
  };


  return (
    <div className={`add-employee-page${employeeProp ? " merchant-employee-edit" : ""}`}>
      <StoreRoleAssignmentStyles />

      {/* PAGE HEADER */}
      <div className="add-employee-header">
        <div>
          <h1>Edit Employee</h1>

          <div className="add-employee-breadcrumb">
            <span>Home</span>
            <span className="breadcrumb-arrow">›</span>
            <span>Employees</span>
            <span className="breadcrumb-arrow">›</span>
            <strong>Edit Employee</strong>
          </div>
        </div>

        <button
          type="button"
          className="back-employees-btn"
          onClick={handleBack}
        >
           <ArrowLeft size={17} />
          {onBackProp ? "Back to Merchant Employees" : "Back to Employees"}
        </button>
      </div>

      {/* API ERROR BANNER */}
      <EmployeeToast message={notice || apiError} onClose={() => { setNotice(""); setApiError(""); }} />
      {confirmPhotoDelete && <EmployeeDeleteDialog title="Delete Profile Photo?" description="Are you sure you want to remove this employee’s profile photo?" busy={deletingProfileImage} onCancel={() => setConfirmPhotoDelete(false)} onConfirm={handleDeleteProfileImage} />}

      {/* FORM */}
      <form onSubmit={handleSave} autoComplete="off">
        <div className="add-employee-layout">
          {/* LEFT COLUMN */}
          <div className="add-employee-left">
            {/* PERSONAL INFORMATION */}
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
                  className={`employee-field ${
                    errors.phone ? "employee-phone-invalid" : ""
                  }`}
                >
                  <label>
                    Phone Number <span>*</span>
                  </label>

                  <input
                    type="tel"
                    id="employee-phone"
                    name="phone"
                    aria-label="Phone Number"
                    placeholder="Enter phone number, including country code"
                    value={formData.phone}
                    onChange={(event) => handlePhoneChange(event.target.value)}
                    required
                    autoComplete="tel"
                    className={errors.phone ? "field-invalid" : ""}
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
                  </div>

                  {errors.dob && (
                    <span className="field-error">{errors.dob}</span>
                  )}
                </div>

                {/* GENDER */}
                <SelectField
                  label="Gender"
                  required
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  error={errors.gender}
                  placeholder="Select gender"
                  options={["Male", "Female", "Other"]}
                />
              </div>
            </section>

            {/* ADDRESS */}
            <section className="employee-card">
              <CardHeader
                icon={<MapPin size={21} />}
                title="Address"
                description="Enter the employee's address details."
              />

              <div className="employee-form-grid two-columns">
                <FormField
                  label="Address Line 1"
                  required
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

          {/* RIGHT COLUMN */}
          <div className="add-employee-right">
            {/* PROFILE PHOTO */}
            <section className="employee-card profile-photo-card">
              <CardHeader
                icon={<Camera size={21} />}
                title="Profile Photo"
                description="Upload a profile photo for the employee."
              />

              <div className="profile-upload-area">
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

            {/* WORK INFORMATION */}
            <section className="employee-card work-information-card">
              <CardHeader
                icon={<BriefcaseBusiness size={21} />}
                title="Work Information"
                description="Assign roles to one or more stores under the selected merchant."
              />

              <div className="employee-field">
                <label htmlFor="employee-code">Employee Code</label>
                <input id="employee-code" name="employeeCode" value={employee.employeeCode || employee.employee_code || ""} readOnly />
              </div>

              <div style={{ marginTop: "24px" }}>
                <SelectField
                  label="Status"
                  required
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={["Active", "Inactive"]}
                  error={errors.status}
                />
              </div>

              {/* DYNAMIC MERCHANT DROPDOWN */}
              {/* MERCHANT - DISPLAY ONLY */}
              <div className="employee-field work-merchant-field">
                <label>
                  Merchant <span>*</span>
                </label>

                <input
                  type="text"
                  name="merchant"
                  value={formData.merchant}
                  readOnly
                  className="merchant-readonly-field"
                />
              </div>
            </section>

            {/* ACCOUNT SETTINGS */}
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

                <div className="employee-field">
                  <label htmlFor="employee-temporary-password">Temporary Password</label>

                  <div className="password-input">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="employee-temporary-password"
                      name="password"
                      placeholder="Enter a new temporary password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      spellCheck={false}
                      autoCapitalize="none"

                      className={errors.password ? "field-invalid" : ""}
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? "Hide temporary password" : "Show temporary password"}
                      aria-pressed={showPassword}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setShowPassword((visible) => !visible);
                        document.getElementById("employee-temporary-password")?.focus();
                      }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>



                  {errors.password && (
                    <span className="field-error">{errors.password}</span>
                  )}
                </div>

                <div className="employee-login-pin-field">
                  <label htmlFor="edit-employee-login-pin">Employee Login PIN</label>
                  <input
                    id="edit-employee-login-pin"
                    name="employeeLoginPin"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={formData.employeeLoginPin}
                    onChange={handleChange}
                    placeholder="Enter 6-digit PIN"
                  />
                  <small className="employee-login-pin-help">PIN is shown openly. Enter 6 digits to update it.</small>
                  {errors.employeeLoginPin && <span className="field-error">{errors.employeeLoginPin}</span>}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="employee-form-actions">
          <button
            type="button"
            className="cancel-employee-btn"
            onClick={handleBack}
            disabled={saving}
          >
            Cancel
          </button>

          <button type="submit" className="save-employee-btn" disabled={saving}>
            {saving ? "Updating..." : "Update Employee"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================
   CARD HEADER COMPONENT
========================================================= */

function CardHeader({ icon, title, description }) {
  return (
    <div className="employee-card-header">
      <div className="employee-card-icon">{icon}</div>

      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

/* =========================================================
   INPUT FIELD COMPONENT
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
        {label}
        {required && <span> *</span>}
      </label>

      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={name === "username" ? "off" : undefined}
        className={error ? "field-invalid" : ""}
      />

      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

/* =========================================================
   SELECT FIELD COMPONENT
========================================================= */

function SelectField({
  label,
  required,
  name,
  value,
  onChange,
  placeholder,
  options = [],
  error,
  disabled = false,
}) {
  return (
    <div className="employee-field">
      <label>
        {label}
        {required && <span> *</span>}
      </label>

      <div className="employee-select">
        <select
          name={name}
          disabled={disabled}
          value={value}
          onChange={onChange}
          className={error ? "field-invalid" : ""}
        >
          {!value && <option value="">{placeholder}</option>}

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <ChevronDown size={17} className="employee-select-arrow" />
      </div>

      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
