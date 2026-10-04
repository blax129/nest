import { getStore } from "@netlify/blobs";
import { receiptActions } from "./receipts-lib.mjs";

function json(body, status) {
  return new Response(body === undefined ? "null" : JSON.stringify(body), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default async function receipts(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body && body.action;
  const handler = receiptActions[action];
  if (!handler) {
    return json({ error: "Unknown action" }, 400);
  }

  try {
    const store = getStore("pph-receipts");
    const result = await handler(store, body || {});
    return json(result == null ? null : result);
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    return json({ error: error && error.message ? error.message : "Request failed" }, status);
  }
}
