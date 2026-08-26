type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: "normal" | "compact" | "flexible";
      callback: (token: string) => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
};

const form = document.getElementById("vault-login-form") as HTMLFormElement;
const sitekey = document.getElementById("vault-turnstile")?.dataset.sitekey as
  string | undefined;

const submitBtn = form.querySelector(
  "button[type=submit]",
) as HTMLButtonElement;
const container = document.getElementById("vault-turnstile");
const toastRoot = document.createElement("div");

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: "リクエストを処理できませんでした。",
  INVALID_INPUT: "入力内容を確認してください。",
  TURNSTILE_FAILED: "CAPTCHAの確認に失敗しました。もう一度お試しください。",
  VERIFY_FAILED: "パスワードが正しくありません。",
  RATE_LIMITED: "試行回数が多すぎます。しばらくしてから再試行してください。",
  TOO_MANY_REQUESTS:
    "試行回数が多すぎます。しばらくしてから再試行してください。",
  SESSION_UNAVAILABLE:
    "サーバーで問題が発生しました。しばらくしてから再試行してください。",
  SERVER_ERROR:
    "サーバーで問題が発生しました。しばらくしてから再試行してください。",
  INTERNAL_ERROR:
    "サーバーで問題が発生しました。しばらくしてから再試行してください。",
  UPSTREAM_ERROR:
    "認証サービスに接続できません。しばらくしてから再試行してください。",
  SERVICE_UNAVAILABLE:
    "認証サービスに接続できません。しばらくしてから再試行してください。",
  TIMEOUT: "認証サービスに接続できません。しばらくしてから再試行してください。",
};

const turnstileWindow = window as Window & { turnstile?: TurnstileApi };
let widgetId: string | undefined;
let latestToken = "";

const renderWidget = () => {
  if (!container || !sitekey || !turnstileWindow.turnstile) return;
  widgetId = turnstileWindow.turnstile.render(container, {
    sitekey,
    action: "vault-login",
    size: "flexible",
    callback: (token: string) => {
      latestToken = token;
    },
  });
};

if (turnstileWindow.turnstile) {
  renderWidget();
} else {
  const script = document.createElement("script");
  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.addEventListener("load", renderWidget, { once: true });
  document.head.appendChild(script);
}

const showToast = (message: string) => {
  toastRoot.className = "vault-toast";
  toastRoot.textContent = message;
  document.body.appendChild(toastRoot);
  setTimeout(() => toastRoot.remove(), 4000);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!latestToken) {
    showToast(
      "CAPTCHAの確認が完了していません。少し待ってから再試行してください。",
    );
    return;
  }
  submitBtn.disabled = true;
  let redirecting = false;
  try {
    const formData = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "manual",
      body: JSON.stringify({
        slug: formData.slug,
        input: formData.input,
        turnstile: latestToken,
      }),
    });
    if (response.type === "opaqueredirect" || response.status === 303) {
      redirecting = true;
      window.location.href =
        response.headers.get("Location") ?? `/vault/${formData.slug}`;
      return;
    }
    let data: { errcode?: string } = {};
    try {
      data = (await response.json()) as { errcode?: string };
    } catch {
      /* ignore */
    }
    showToast(
      (data.errcode && ERROR_MESSAGES[data.errcode]) ??
        "エラーが発生しました。しばらくしてから再試行してください。",
    );
    (form.elements.namedItem("input") as HTMLInputElement).value = "";
  } catch {
    showToast("通信エラーが発生しました。");
  } finally {
    submitBtn.disabled = false;
    latestToken = "";
    if (!redirecting && widgetId !== undefined) {
      turnstileWindow.turnstile?.reset(widgetId);
    }
  }
});

export {};
