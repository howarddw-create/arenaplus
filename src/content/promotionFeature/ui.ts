const SPINNER_STYLE_ID = "arex-spinner-style";
const SHIMMER_STYLE_ID = "arex-shimmer-style";
const MODAL_STYLE_ID = "arex-modal-style";

export function normalizeAuthToken(token?: string | null): string {
  const trimmed = (token || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("Bearer ") ? trimmed : `Bearer ${trimmed}`;
}

export function ensureSpinnerKeyframes() {
  if (document.getElementById(SPINNER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SPINNER_STYLE_ID;
  style.textContent = `@keyframes arex-spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);}}`;
  document.head.appendChild(style);
}

export function ensureShimmerStyles() {
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes arex-shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
  `;
  document.head.appendChild(style);
}

export function ensureModalStyles() {
  if (document.getElementById(MODAL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = MODAL_STYLE_ID;
  style.textContent = `
    .arex-modal {
      width: min(900px, 96vw);
      height: min(90vh, 760px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(17,17,20,.96), rgba(12,12,15,.98));
      backdrop-filter: blur(10px) saturate(120%);
      border: 1px solid rgba(255,255,255,.06);
      color: #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(0,0,0,.7);
      padding: 20px;
    }
    .arex-modal-header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .arex-header-left {
      justify-self: start;
      display: flex;
      align-items: center;
    }
    .arex-header-center {
      justify-self: center;
      display: flex;
      align-items: center;
    }
    .arex-header-right {
      justify-self: end;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .arex-controls-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    @media (max-width: 600px) {
      .arex-modal {
        padding: 12px;
        height: 85vh;
      }
      .arex-modal-header {
        gap: 8px;
        margin-bottom: 10px;
      }
    }
    @media (max-height: 700px) {
      .arex-modal {
        height: 95vh;
      }
    }
  `;
  document.head.appendChild(style);
}

const envTokenRaw = ((import.meta as any)?.env?.VITE_APP_AUTH_TOKEN || "").trim();
export const FALLBACK_AUTH_TOKEN = normalizeAuthToken(envTokenRaw);
