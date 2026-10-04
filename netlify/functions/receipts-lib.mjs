import { timingSafeEqual } from "node:crypto";

const FEE = 70;

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function assertOwnerPassword(password) {
  const expected = process.env.OWNER_PASSWORD || "";
  if (!expected) {
    throw httpError("Admin password is not configured on the server yet.", 500);
  }
  const given = Buffer.from(String(password || ""), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    throw httpError("invalid password", 401);
  }
}

function money(value) {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw httpError("enter the amount received", 400);
  }
  return amount;
}

function receiptNumber() {
  const now = new Date();
  const stamp =
    String(now.getUTCFullYear()) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return "PPH-" + stamp + "-" + suffix;
}

function appKey(token) {
  return "applications/" + token;
}

function idKey(applicationId) {
  return "application-ids/" + encodeURIComponent(applicationId);
}

function proofKey(receiptNumberValue) {
  return "proofs/" + receiptNumberValue;
}

function latestKey(applicationId) {
  return "latest/" + encodeURIComponent(applicationId);
}

async function readJson(store, key) {
  const value = await store.get(key, { type: "json" });
  return value || null;
}

function publicApplication(app, proof) {
  const confirmed = proof && proof.confirmed_amount != null ? Number(proof.confirmed_amount) : null;
  return {
    application_id: app.application_id,
    applicant_name: app.applicant_name,
    applicant_email: app.applicant_email,
    applicant_phone: app.applicant_phone,
    property_address: app.property_address,
    application_fee: app.application_fee,
    confirmed_amount: confirmed,
    receipt_amount: confirmed != null ? confirmed : app.application_fee,
    payment_email: app.payment_email,
    proof_status: proof ? proof.status : null,
    receipt_number: proof ? proof.receipt_number : null,
    screenshot_url: proof ? proof.screenshot_url : null,
    submitted_at: proof ? proof.submitted_at : null,
    confirmed_at: proof ? proof.confirmed_at : null,
    rejected_at: proof ? proof.rejected_at : null,
  };
}

function proofSummary(proof) {
  return {
    application_id: proof.application_id,
    receipt_number: proof.receipt_number,
    status: proof.status,
    screenshot_url: proof.screenshot_url,
    replay: true,
  };
}

async function latestProof(store, applicationId) {
  const number = await store.get(latestKey(applicationId), { type: "text" });
  if (!number) return null;
  return readJson(store, proofKey(number));
}

export async function submitApplication(store, body) {
  const applicationId = text(body.applicationId || body.p_application_id);
  if (!applicationId) throw httpError("application id required", 400);

  const existingToken = await store.get(idKey(applicationId), { type: "text" });
  if (existingToken) {
    const existing = await readJson(store, appKey(existingToken));
    if (existing) {
      return {
        application_id: existing.application_id,
        access_token: existing.access_token,
        application_fee: existing.application_fee,
      };
    }
  }

  const token = crypto.randomUUID();
  const record = {
    application_id: applicationId,
    access_token: token,
    applicant_name: text(body.applicantName || body.p_applicant_name),
    applicant_email: text(body.applicantEmail || body.p_applicant_email),
    applicant_phone: text(body.applicantPhone || body.p_applicant_phone),
    property_address: text(body.propertyAddress || body.p_property_address),
    application_fee: FEE,
    payment_email: text(body.paymentEmail || body.p_payment_email),
    created_at: new Date().toISOString(),
  };

  await store.setJSON(appKey(token), record);
  await store.set(idKey(applicationId), token);
  return {
    application_id: record.application_id,
    access_token: record.access_token,
    application_fee: record.application_fee,
  };
}

export async function getApplicationByToken(store, body) {
  const token = text(body.token || body.p_token);
  if (!token) return null;
  const app = await readJson(store, appKey(token));
  if (!app) return null;
  const proof = await latestProof(store, app.application_id);
  return publicApplication(app, proof);
}

export async function submitPaymentProof(store, body) {
  const token = text(body.token || body.p_token);
  const screenshotUrl = text(body.screenshotUrl || body.p_screenshot_url);
  const publicId = text(body.publicId || body.p_cloudinary_public_id);
  if (!token) throw httpError("application token required", 400);
  if (!screenshotUrl) throw httpError("screenshot url required", 400);

  const app = await readJson(store, appKey(token));
  if (!app) throw httpError("application not found", 404);

  const current = await latestProof(store, app.application_id);
  if (current && (current.status === "paid" || current.status === "pending")) {
    return proofSummary(current);
  }

  let created = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const number = receiptNumber();
    const existing = await readJson(store, proofKey(number));
    if (existing) continue;
    created = {
      application_id: app.application_id,
      access_token: app.access_token,
      applicant_name: app.applicant_name,
      applicant_email: app.applicant_email,
      applicant_phone: app.applicant_phone,
      property_address: app.property_address,
      application_fee: app.application_fee,
      payment_email: app.payment_email,
      receipt_number: number,
      status: "pending",
      screenshot_url: screenshotUrl,
      cloudinary_public_id: publicId,
      confirmed_amount: null,
      submitted_at: new Date().toISOString(),
      confirmed_at: null,
      rejected_at: null,
    };
    await store.setJSON(proofKey(number), created);
    await store.set(latestKey(app.application_id), number);
    break;
  }

  if (!created) throw httpError("could not create a receipt number", 500);
  return {
    application_id: created.application_id,
    receipt_number: created.receipt_number,
    status: created.status,
    screenshot_url: created.screenshot_url,
    replay: false,
  };
}

export async function getPublicReceiptStatus(store, body) {
  const number = text(body.receiptNumber || body.p_receipt_number);
  if (!number) return null;
  const proof = await readJson(store, proofKey(number));
  if (!proof) return null;
  return {
    receipt_number: proof.receipt_number,
    status: proof.status,
  };
}

async function allProofs(store) {
  const listed = await store.list({ prefix: "proofs/" });
  const rows = [];
  for (const blob of listed.blobs || []) {
    const row = await readJson(store, blob.key);
    if (row) rows.push(row);
  }
  const rank = { pending: 0, rejected: 1, paid: 2 };
  rows.sort(function (a, b) {
    const statusDelta = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (statusDelta !== 0) return statusDelta;
    return String(b.submitted_at || "").localeCompare(String(a.submitted_at || ""));
  });
  return rows;
}

export async function ownerListProofs(store, body) {
  assertOwnerPassword(body.password || body.p_password);
  const rows = await allProofs(store);
  return rows.map(function (row) {
    return {
      application_id: row.application_id,
      access_token: row.access_token,
      applicant_name: row.applicant_name,
      applicant_email: row.applicant_email,
      applicant_phone: row.applicant_phone,
      property_address: row.property_address,
      application_fee: row.application_fee,
      payment_email: row.payment_email,
      receipt_number: row.receipt_number,
      status: row.status,
      screenshot_url: row.screenshot_url,
      confirmed_amount: row.confirmed_amount,
      submitted_at: row.submitted_at,
      confirmed_at: row.confirmed_at,
      rejected_at: row.rejected_at,
    };
  });
}

export async function ownerConfirmProof(store, body) {
  assertOwnerPassword(body.password || body.p_password);
  const number = text(body.receiptNumber || body.p_receipt_number);
  const amount = money(body.amount != null ? body.amount : body.p_amount);
  const proof = await readJson(store, proofKey(number));
  if (!proof) throw httpError("receipt not found", 404);
  if (proof.status === "paid") {
    return {
      receipt_number: proof.receipt_number,
      status: proof.status,
      confirmed_amount: proof.confirmed_amount,
      replay: true,
    };
  }
  if (proof.status !== "pending") {
    throw httpError("only pending proofs can be confirmed", 400);
  }
  proof.status = "paid";
  proof.confirmed_amount = amount;
  proof.confirmed_at = new Date().toISOString();
  await store.setJSON(proofKey(number), proof);
  return {
    receipt_number: proof.receipt_number,
    status: proof.status,
    confirmed_amount: proof.confirmed_amount,
    replay: false,
  };
}

export async function ownerRejectProof(store, body) {
  assertOwnerPassword(body.password || body.p_password);
  const number = text(body.receiptNumber || body.p_receipt_number);
  const proof = await readJson(store, proofKey(number));
  if (!proof) throw httpError("receipt not found", 404);
  if (proof.status === "rejected") {
    return {
      receipt_number: proof.receipt_number,
      status: proof.status,
      replay: true,
    };
  }
  if (proof.status !== "pending") {
    throw httpError("only pending proofs can be rejected", 400);
  }
  proof.status = "rejected";
  proof.rejected_at = new Date().toISOString();
  await store.setJSON(proofKey(number), proof);
  return {
    receipt_number: proof.receipt_number,
    status: proof.status,
    replay: false,
  };
}

export const receiptActions = {
  submit_application: submitApplication,
  get_application_by_token: getApplicationByToken,
  submit_payment_proof: submitPaymentProof,
  get_public_receipt_status: getPublicReceiptStatus,
  owner_list_proofs: ownerListProofs,
  owner_confirm_proof: ownerConfirmProof,
  owner_reject_proof: ownerRejectProof,
};
