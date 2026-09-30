/*
 * `lottie-web` publishes declarations for its default entry point only, and that
 * entry bundles every renderer plus the expression engine. The site plays one
 * SVG animation that uses no expressions, so it loads the light player, which
 * has to be pointed at by path and therefore needs declaring here.
 */
declare module "lottie-web/build/player/esm/lottie_light.min.js" {
  import type { AnimationConfigWithData, AnimationItem } from "lottie-web";

  const lottie: {
    loadAnimation: (config: AnimationConfigWithData) => AnimationItem;
  };

  export default lottie;
}
