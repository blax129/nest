(() => {
  const STORAGE_KEY = "lang";
  const LEGACY_STORAGE_KEY = "siteLanguage";
  const LANGS = ["en", "es"];

  function getInitialLang() {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
    return "en";
  }

  function setElementText(el, lang) {
    const value = el.dataset[lang];
    if (typeof value === "string") {
      el.textContent = value;
    }
  }

  function updateSwitcher(lang) {
    document.querySelectorAll(".lang-option").forEach((option) => {
      const isActive = option.dataset.lang === lang;
      option.classList.toggle("active", isActive);
      option.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateOpenFaqHeights() {
    document.querySelectorAll(".faq-item.is-open .faq-item__answer").forEach((answer) => {
      answer.style.maxHeight = `${answer.scrollHeight}px`;
    });
  }

  function toggleFaq(item, shouldOpen) {
    const button = item.querySelector(".faq-item__question");
    const answer = item.querySelector(".faq-item__answer");
    if (!button || !answer) return;

    item.classList.toggle("is-open", shouldOpen);
    button.setAttribute("aria-expanded", String(shouldOpen));
    answer.style.maxHeight = shouldOpen ? `${answer.scrollHeight}px` : "0px";
  }

  function setupFaqAccordion() {
    document.querySelectorAll(".faq-item").forEach((item) => {
      const button = item.querySelector(".faq-item__question");
      if (!button) return;

      button.addEventListener("click", () => {
        toggleFaq(item, !item.classList.contains("is-open"));
      });
    });

    window.addEventListener("resize", updateOpenFaqHeights);
  }

  function applyLanguage(lang) {
    const selectedLang = LANGS.includes(lang) ? lang : "en";

    document.documentElement.lang = selectedLang;
    document.body.classList.add("language-is-switching");

    document.querySelectorAll("[data-en][data-es]").forEach((el) => {
      setElementText(el, selectedLang);
    });

    document.querySelectorAll("[data-en-placeholder][data-es-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", el.dataset[`${selectedLang}Placeholder`]);
    });

    if (document.body.dataset.enTitle && document.body.dataset.esTitle) {
      document.title = document.body.dataset[`${selectedLang}Title`];
    }

    localStorage.setItem(STORAGE_KEY, selectedLang);
    localStorage.setItem(LEGACY_STORAGE_KEY, selectedLang);
    updateSwitcher(selectedLang);
    updateOpenFaqHeights();

    window.setTimeout(() => {
      document.body.classList.remove("language-is-switching");
      updateOpenFaqHeights();
    }, 160);
  }

  window.setLanguage = applyLanguage;

  document.addEventListener("DOMContentLoaded", () => {
    const initialLang = getInitialLang();

    document.querySelectorAll(".lang-option").forEach((option) => {
      option.setAttribute("type", "button");
      option.addEventListener("click", (event) => {
        event.preventDefault();
        applyLanguage(option.dataset.lang);
      });
    });

    applyLanguage(initialLang);
    setupFaqAccordion();
  });
})();
