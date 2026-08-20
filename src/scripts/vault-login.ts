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
    if (data.errcode === "TURNSTILE_FAILED") {
      showToast("CAPTCHAの確認に失敗しました。");
    } else if (data.errcode === "VERIFY_FAILED") {
      showToast("パスワードが正しくありません。");
    } else {
      showToast("エラーが発生しました。しばらくしてから再試行してください。");
    }
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
