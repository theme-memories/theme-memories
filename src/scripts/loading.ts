import lottie from "lottie-web/build/player/lottie_light.js";
import animationData from "../assets/loading.json";

lottie.loadAnimation({
  container: document.getElementById("loading-icon")!,
  renderer: "svg",
  loop: true,
  autoplay: true,
  animationData,
});

const MIN_DISPLAY = 1200;
const startedAt = Date.now();

const hide = () => {
  const remaining = MIN_DISPLAY - (Date.now() - startedAt);
  setTimeout(
    () => {
      document.getElementById("loading")?.classList.add("loading-hidden");
    },
    Math.max(0, remaining),
  );
};

if (document.readyState === "complete") {
  hide();
} else {
  window.addEventListener("load", hide);
}
