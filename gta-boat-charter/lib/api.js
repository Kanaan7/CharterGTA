import { auth } from "./firebase";

export async function authorizedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const user = auth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function authorizedJson(url, options = {}) {
  const response = await authorizedFetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error || "Request failed");
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
}
