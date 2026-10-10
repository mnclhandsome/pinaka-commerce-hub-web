import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getVendor } from "../api/vendors";
import ReadOnlyDetails from "../components/ReadOnlyDetails";

const fields = (entries) => entries.map(([key, label]) => ({
  key, label,
  ...(key === "vendorType" ? {
    render: (value) => ["ORGANIZER", "ORGANIZATION"].includes(String(value || "").toUpperCase()) ? "Organizer" : "Supplier",
  } : {}),
}));
const sections = [
  { title: "Vendor Information", fields: fields([["code", "Vendor Code"], ["name", "Vendor Name"], ["vendorType", "Vendor Type"], ["category", "Products Supplied"], ["status", "Status"]]) },
  { title: "Contact Information", fields: fields([["contactPerson", "Contact Person Name"], ["phone", "Phone Number"], ["email", "Email Address"]]) },
  { title: "Business Address", fields: fields([["addressLine1", "Address Line 1"], ["addressLine2", "Address Line 2"], ["city", "City"], ["state", "State"], ["zipCode", "ZIP Code"], ["country", "Country"]]) },
];

export default function VendorView() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cached = String(location.state?.vendor?.id) === vendorId ? location.state.vendor : null;
  const [vendor, setVendor] = useState(cached);
  const [message, setMessage] = useState(cached ? "" : "Loading vendor...");
  useEffect(() => {
    if (cached) { setVendor(cached); setMessage(""); return; }
    const controller = new AbortController();
    setVendor(null);
    setMessage("Loading vendor...");
    getVendor(vendorId, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setVendor(data); setMessage(data?.id ? "" : "Vendor not found."); }
    }).catch((error) => {
      if (!controller.signal.aborted) setMessage(error?.message || "Failed to load vendor.");
    });
    return () => controller.abort();
  }, [vendorId, cached]);
  return <ReadOnlyDetails title="View Vendor"
    subtitle="View vendor information, contact details, and business information."
    listLabel="Vendors" onBack={() => navigate(location.state?.backTo || "/vendors")}
    data={vendor} message={message} sections={sections} />;
}
