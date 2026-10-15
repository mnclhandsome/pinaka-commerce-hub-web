// Single shared location dataset; loaded once, only when needed.
let locationsPromise;
export function loadLocations() {
  if (!locationsPromise) {
    locationsPromise = fetch(import.meta.env.BASE_URL + "data/locations.json")
      .then(response => {
        if (!response.ok) throw new Error("Unable to load location data.");
        return response.json();
      })
      .then(data => data.countries)
      .catch(error => { locationsPromise = undefined; throw error; });
  }
  return locationsPromise;
}
const matches = (value, ...keys) => keys.some(key => key != null && String(key).toLowerCase() === String(value).trim().toLowerCase());
export async function getCountries() {
  return (await loadLocations()).map(({states, ...country}) => country);
}
export async function getStates(countryIdentifier) {
  const country = (await loadLocations()).find(item => matches(countryIdentifier, item.id, item.iso2, item.iso3, item.name));
  return (country?.states || []).map(({cities, ...state}) => state);
}
export async function getCities(countryIdentifier, stateIdentifier) {
  const country = (await loadLocations()).find(item => matches(countryIdentifier, item.id, item.iso2, item.iso3, item.name));
  const state = country?.states.find(item => matches(stateIdentifier, item.id, item.code, item.name));
  return state?.cities || [];
}
