import { useEffect, useState } from "react";
import { loadLocations } from "./locations";
export function useLocationOptions(form) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadLocations().then(data => { if (active) setLocations(data); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const retain = (values, current) => [...new Set([...values, ...(current ? [current] : [])])];
  const equals = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
  const country = locations.find(item => [item.name, item.iso2, item.iso3].some(value => equals(value, form.country)));
  const state = country?.states.find(item => [item.name, item.code].some(value => equals(value, form.state)));
  return { loading, error,
    selectedCountry: country || null,
    countries: retain(locations.map(item => item.name), form.country),
    states: retain((country?.states || []).map(item => item.name), form.state),
    cities: retain((state?.cities || []).map(item => item.name), form.city),
  };
}
