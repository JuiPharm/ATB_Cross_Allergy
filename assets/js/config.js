/**
 * BHH Cross Allergy Checker configuration.
 *
 * Default mode is static JSON for GitHub Pages.
 * To use Google Apps Script instead:
 * 1) Deploy apps-script/Code.gs as Web App.
 * 2) Paste /exec URL below.
 * 3) Set USE_REMOTE_API to true.
 */
window.APP_CONFIG = {
  APP_VERSION: "1.0.0",
  USE_REMOTE_API: false,
  LOCAL_DATA_URL: "data/cross_allergy.json",
  GAS_API_URL: "",
  ENABLE_REMOTE_LOGGING: false,
  HOSPITAL_NAME: "Bangkok Hospital Hatyai",
};
