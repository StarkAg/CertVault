/**
 * Convex client for use from the Express API (Node).
 * Uses CONVEX_URL to talk to your Convex deployment.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

let client = null;

export function getConvexClient() {
  const url = process.env.CONVEX_URL;
  if (!url) return null;
  if (!client) {
    client = new ConvexHttpClient(url);
  }
  return client;
}

export function isConvexConfigured() {
  return Boolean(process.env.CONVEX_URL);
}

/** Map Convex doc to API shape (id, created_at) */
export function docToApi(doc) {
  if (!doc) return null;
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: _id, created_at: _creationTime ? new Date(_creationTime).toISOString() : undefined };
}

export function docsToApi(docs) {
  return (docs || []).map(docToApi);
}

export { api };
