/** Replace the subdomain, or set VITE_LETTERBENCH_API, after the Worker is deployed. */
export const WORKER_URL_PLACEHOLDER = "https://letterbench-api.<account-subdomain>.workers.dev";

export const PASSWORD_HEADER = "X-Family-Password";

export function workerUrl(): string {
  const configured = import.meta.env.VITE_LETTERBENCH_API;
  if (typeof configured === "string") {
    const trimmed = configured.trim().replace(/\/$/, "");
    if (trimmed && !trimmed.includes("<")) return trimmed;
  }
  return WORKER_URL_PLACEHOLDER;
}

export function workerUrlIsPlaceholder(url = workerUrl()): boolean {
  return url.includes("<account-subdomain>");
}
