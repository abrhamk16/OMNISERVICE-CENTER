/* ============================================
   E-DELALA I18N ENGINE
   Usage:
     data-i18n="key"              -> textContent
     data-i18n-placeholder="key"  -> placeholder attr
     data-i18n-html="key"         -> innerHTML (rare, trusted strings only)
     data-i18n-title="key"        -> title attr
     I18N.t(key, {vars})          -> programmatic lookup
   ============================================ */
(function () {
  const STORAGE_KEY = "edelala.lang";

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || "en";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
    document.body && document.body.classList.toggle("lang-am", lang === "am");
    applyTranslations();
    document.dispatchEvent(new CustomEvent("edelala:langchange", { detail: { lang } }));
  }

  function t(key, vars) {
    const lang = getLang();
    const dict = (window.EDELALA_I18N && window.EDELALA_I18N[lang]) || {};
    const fallback = (window.EDELALA_I18N && window.EDELALA_I18N.en) || {};
    let str = dict[key] !== undefined ? dict[key] : (fallback[key] !== undefined ? fallback[key] : key);
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return str;
  }

  function applyTranslations(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    document.querySelectorAll(".lang-toggle button").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === getLang());
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const lang = getLang();
    document.documentElement.setAttribute("lang", lang);
    document.body.classList.toggle("lang-am", lang === "am");
    applyTranslations();
  });

  window.I18N = { t, getLang, setLang, applyTranslations };
})();
