export interface LoadingOptions {
  container?: HTMLElement | null;
  lottiePath?: string;
  duration?: number;
}

type LottieAnimator = {
  loadAnimation: (opts: {
    container: HTMLElement;
    renderer: string;
    loop: boolean;
    autoplay: boolean;
    path: string;
    name?: string;
  }) => { destroy: () => void };
};

declare global {
  interface Window {
    bodymovin?: LottieAnimator;
    lottie?: LottieAnimator;
  }
}

function loadLottieScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="bodymovin" i]',
    );
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.13.0/lottie.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Lottie"));
    document.head.appendChild(script);
  });
}

function hideLoading(el: HTMLElement) {
  el.classList.remove("opacity-100");
  el.classList.add(
    "opacity-0",
    "transition-opacity",
    "duration-500",
    "ease-out",
  );
  setTimeout(() => {
    el.style.display = "none";
  }, 500);
}

export async function initLoading(options: LoadingOptions = {}): Promise<void> {
  const {
    container = document.getElementById("loading-icon"),
    lottiePath = "/assets/data/json/loading.json",
    duration = 2000,
  } = options;

  const loading =
    (container?.closest("#loading-screen") as HTMLElement) ??
    document.getElementById("loading-screen");
  if (!loading || !container) return;

  try {
    await loadLottieScript();

    const lottie = window.bodymovin ?? window.lottie;

    if (lottie?.loadAnimation) {
      const anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: lottiePath,
        name: "loading",
      });

      setTimeout(() => {
        anim.destroy();
        hideLoading(loading);
      }, duration);
    } else {
      hideLoading(loading);
    }
  } catch {
    hideLoading(loading);
  }
}
