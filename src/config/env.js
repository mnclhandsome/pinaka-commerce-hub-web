const trimSlash = (value = "") => value.replace(/\/+$/, "");
 
export const APP_ENV = import.meta.env.VITE_APP_ENV || import.meta.env.MODE;
 
export const API_BASE_URL = trimSlash(
  import.meta.env.VITE_API_BASE_URL || "/connector/api/v1"
);
 