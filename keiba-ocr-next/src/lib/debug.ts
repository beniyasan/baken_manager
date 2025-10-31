export function isDebugBilling() {
  return process.env.DEBUG_BILLING === "1";
}

export function safePrefix(value?: string, n = 8) {
  if (!value) return "(undefined)";
  return `${value.slice(0, n)}… (len=${value.length})`;
}

export function debugLog(...args: any[]) {
  if (isDebugBilling()) {
    console.log("[billing-debug]", ...args);
  }
}
