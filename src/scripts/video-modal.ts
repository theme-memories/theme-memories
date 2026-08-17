import "plyr/dist/plyr.css";
import Plyr from "plyr";

const modal = document.querySelector(".js-video-modal") as HTMLElement | null;
const player = document.querySelector(".js-video-player") as HTMLElement | null;

let instance: Plyr | null = null;

const open = (src: string, poster?: string) => {
  if (!modal || !player) return;
  modal.classList.add("js-open");
  modal.setAttribute("aria-hidden", "false");
  const video = document.createElement("video");
  video.src = src;
  video.playsInline = true;
  video.preload = "metadata";
  if (poster) video.poster = poster;
  player.replaceChildren(video);
  instance = new Plyr(video, {
    controls: [
      "play",
      "progress",
      "current-time",
      "duration",
      "mute",
      "volume",
      "fullscreen",
    ],
  });
};

const close = () => {
  if (!modal) return;
  modal.classList.remove("js-open");
  modal.setAttribute("aria-hidden", "true");
  instance?.destroy();
  instance = null;
  player?.replaceChildren();
};

document.querySelectorAll<HTMLElement>(".js-video").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const src = link.dataset.video;
    if (src) open(src, link.dataset.poster);
  });
});

document
  .querySelectorAll(".js-video-close")
  .forEach((el) => el.addEventListener("click", close));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") close();
});
