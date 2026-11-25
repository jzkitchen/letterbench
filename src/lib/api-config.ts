/** Deployed Worker. Override with VITE_LETTERBENCH_API when needed. */
export const WORKER_URL_PLACEHOLDER = "https://letterbench-api.eyeshadow-lee.workers.dev";

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
