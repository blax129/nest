(() => {
  const STORAGE_KEY = "lang";
  const FALLBACK_STORAGE_KEY = "siteLanguage";
  const LANGS = ["en", "es"];

  function getInitialLang() {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_STORAGE_KEY);
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

  function setupFeedbackForm() {
    const form = document.getElementById("feedbackForm");
    const status = document.getElementById("feedbackStatus");
    if (!form || !status) return;

    const messages = {
      en: {
        sending: "Sending feedback...",
        success: "Thank you for your feedback!",
        error: "Something went wrong. Please try again.",
      },
      es: {
        sending: "Enviando comentario...",
        success: "¡Gracias por sus comentarios!",
        error: "Algo salió mal. Inténtelo de nuevo.",
      },
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const lang = localStorage.getItem(STORAGE_KEY) || "en";
      const copy = messages[lang] || messages.en;
      const submitButton = form.querySelector('button[type="submit"]');

      status.className = "feedback-status";
      status.textContent = copy.sending;
      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error("Feedback submission failed");
        }

        form.reset();
        status.className = "feedback-status is-success";
        status.textContent = copy.success;
      } catch (error) {
        status.className = "feedback-status is-error";
        status.textContent = copy.error;
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  function setupRevealAnimations() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    items.forEach((item) => observer.observe(item));
  }

  function setupGallerySlider() {
    const slides = document.querySelectorAll(".gallery-slide");
    if (slides.length < 2) return;
    const prev = document.querySelector(".gallery-arrow--prev");
    const next = document.querySelector(".gallery-arrow--next");

    let current = 0;

    function showSlide(index) {
      slides[current].classList.remove("is-active");
      current = (index + slides.length) % slides.length;
      slides[current].classList.add("is-active");
    }

    prev?.addEventListener("click", () => showSlide(current - 1));
    next?.addEventListener("click", () => showSlide(current + 1));
    window.setInterval(() => showSlide(current + 1), 4200);
  }

  function applyLanguage(lang) {
    const selectedLang = LANGS.includes(lang) ? lang : "en";

    document.documentElement.lang = selectedLang;
    document.documentElement.dir = "ltr";
    document.body.classList.add("language-is-switching");

    document.querySelectorAll("[data-en]").forEach((el) => {
      setElementText(el, selectedLang);
    });

    document.querySelectorAll("[data-en-placeholder]").forEach((el) => {
      const placeholder = el.dataset[`${selectedLang}Placeholder`] || el.dataset.enPlaceholder;
      if (typeof placeholder === "string") {
        el.setAttribute("placeholder", placeholder);
      }
    });

    if (document.body.dataset.enTitle) {
      document.title = document.body.dataset[`${selectedLang}Title`] || document.body.dataset.enTitle;
    }

    localStorage.setItem(STORAGE_KEY, selectedLang);
    localStorage.setItem(FALLBACK_STORAGE_KEY, selectedLang);
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
        const href = option.getAttribute("href");
        if (option.tagName === "A" && href && href !== "#") {
          localStorage.setItem(STORAGE_KEY, option.dataset.lang || "en");
          localStorage.setItem(FALLBACK_STORAGE_KEY, option.dataset.lang || "en");
          return;
        }
        event.preventDefault();
        applyLanguage(option.dataset.lang);
      });
    });

    applyLanguage(initialLang);
    setupFaqAccordion();
    setupFeedbackForm();
    setupRevealAnimations();
    setupGallerySlider();
  });
})();

/** Chime Pay Anyone emails assigned by Application ID (stable hash). */
window.CHIME_PAYMENT_EMAILS = [
  "info.privatenest@gmail.com",
  "applications.privatenest@gmail.com",
  "privatenesthq@gmail.com",
  "privatenestco@gmail.com",
  "privatenestholdings@gmail.com",
  "contact.privatenest@gmail.com",
  "office.privatenest@gmail.com",
  "admin.privatenest@gmail.com",
];

/** Unsigned Cloudinary upload for payment screenshots (payment page). */
window.CLOUDINARY_CLOUD_NAME = "dibwotfd5";
window.CLOUDINARY_UPLOAD_PRESET = "legacy project";

/** EmailJS — payment screenshot notice (do not reuse the applicant template). */
window.EMAILJS_SERVICE_ID = "service_4blzxar";
window.EMAILJS_PUBLIC_KEY = "X-TTc6mZ7Y4RqKsdI";
window.EMAILJS_PAYMENT_TEMPLATE_ID = "template_n74rpzm";

/** EmailJS — paid-receipt email to the applicant (separate account). */
window.EMAILJS_PAID_PUBLIC_KEY = "KCAHVFrJSzxYDLsKQ";
window.EMAILJS_PAID_SERVICE_ID = "service_b7vipz6";
window.EMAILJS_PAID_TEMPLATE_ID = "template_ulu44ue";

window.SUPABASE_URL = "https://hkyeuxtkpltgnpnxythz.supabase.co";
window.SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhreWV1eHRrcGx0Z25wbnh5dGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTg4NjgsImV4cCI6MjEwMzU3NDg2OH0.FZTm5e_yHdqF0s9CT6BysJUd1qMjaaE4277WQyncHjE";

window.supabaseRpc = async function supabaseRpc(fnName, args) {
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(url + "/rest/v1/rpc/" + fnName, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error_description || data.hint)) ||
      text ||
      "Supabase request failed";
    throw new Error(message);
  }

  return data;
};

window.saveApplicationRecord = async function saveApplicationRecord(fields) {
  return window.supabaseRpc("submit_application", {
    p_application_id: fields.applicationId || "",
    p_applicant_name: fields.applicantName || "",
    p_applicant_email: fields.applicantEmail || "",
    p_applicant_phone: fields.applicantPhone || "",
    p_property_address: fields.propertyAddress || "",
    p_payment_email: fields.paymentEmail || "",
  });
};

window.loadApplicationRecord = async function loadApplicationRecord(token) {
  if (!token) return null;
  return window.supabaseRpc("get_application_by_token", { p_token: token });
};

window.savePaymentProof = async function savePaymentProof(fields) {
  return window.supabaseRpc("submit_payment_proof", {
    p_token: fields.token || "",
    p_screenshot_url: fields.screenshotUrl || "",
    p_cloudinary_public_id: fields.publicId || "",
  });
};

window.getPublicReceiptStatus = async function getPublicReceiptStatus(receiptNumber) {
  if (!receiptNumber) return null;
  return window.supabaseRpc("get_public_receipt_status", {
    p_receipt_number: receiptNumber,
  });
};

window.ownerListProofs = async function ownerListProofs(password) {
  return window.supabaseRpc("owner_list_proofs", { p_password: password });
};

window.ownerConfirmProof = async function ownerConfirmProof(password, receiptNumber) {
  return window.supabaseRpc("owner_confirm_proof", {
    p_password: password,
    p_receipt_number: receiptNumber,
  });
};

window.ownerRejectProof = async function ownerRejectProof(password, receiptNumber) {
  return window.supabaseRpc("owner_reject_proof", {
    p_password: password,
    p_receipt_number: receiptNumber,
  });
};

window.receiptPageUrl = function receiptPageUrl(token) {
  const url = new URL("receipt.html", window.location.href);
  url.search = "";
  if (token) url.searchParams.set("token", token);
  return url.toString();
};

window.adminPageUrl = function adminPageUrl() {
  const url = new URL("admin.html", window.location.href);
  url.search = "";
  return url.toString();
};

window.verifyPageUrl = function verifyPageUrl(receiptNumber) {
  const url = new URL("verify.html", window.location.href);
  url.search = "";
  if (receiptNumber) url.searchParams.set("r", receiptNumber);
  return url.toString();
};

window.sendPaidReceiptEmail = async function sendPaidReceiptEmail(row) {
  if (!window.emailjs) {
    throw new Error("EmailJS is not loaded");
  }
  const publicKey = window.EMAILJS_PAID_PUBLIC_KEY;
  const serviceId = window.EMAILJS_PAID_SERVICE_ID;
  const templateId = window.EMAILJS_PAID_TEMPLATE_ID;
  if (!publicKey || !serviceId || !templateId) {
    throw new Error("Paid-receipt EmailJS is not configured");
  }
  if (!row || !row.applicant_email) {
    throw new Error("Applicant email is missing");
  }

  emailjs.init({ publicKey: publicKey });
  return emailjs.send(serviceId, templateId, {
    applicant_email: row.applicant_email,
    email: row.applicant_email,
    applicant_name: row.applicant_name || "",
    application_id: row.application_id || "",
    receipt_number: row.receipt_number || "",
    property_address: row.property_address || "",
    receipt_url: window.receiptPageUrl(row.access_token),
  });
};

window.getChimePaymentEmail = function getChimePaymentEmail(applicationId) {
  const emails = window.CHIME_PAYMENT_EMAILS;
  if (!emails || !emails.length) return "";
  if (!applicationId) return emails[0];

  const id = String(applicationId);
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return emails[hash % emails.length];
};
