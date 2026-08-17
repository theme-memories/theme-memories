import "plyr/dist/plyr.css";
import Plyr from "plyr";

document
  .querySelectorAll<HTMLVideoElement>(".article-text video")
  .forEach((video) => {
    new Plyr(video, {
      controls: [
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "fullscreen",
      ],
      settings: ["speed"],
    });
  });

document
  .querySelectorAll<HTMLAudioElement>(".article-text audio")
  .forEach((audio) => {
    new Plyr(audio, {
      controls: [
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
      ],
      settings: ["speed"],
    });
  });

export {};
