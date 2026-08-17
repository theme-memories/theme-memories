const [layer1, layer2, layer3] = [
  document.querySelector(".page-parallax-1 .page-parallax-layer"),
  document.querySelector(".page-parallax-2 .page-parallax-layer"),
  document.querySelector(".page-parallax-3 .page-parallax-layer"),
] as (HTMLElement | null)[];

const LAYER_SPEEDS = [1.2, 1, 0.4];

const onScroll = () => {
  const scrollTop = window.scrollY;
  if (layer1)
    layer1.style.transform = `translateY(${-LAYER_SPEEDS[0] * scrollTop}px)`;
  if (layer2)
    layer2.style.transform = `translateY(${-LAYER_SPEEDS[1] * scrollTop}px)`;
  if (layer3)
    layer3.style.transform = `translateY(${-LAYER_SPEEDS[2] * scrollTop}px)`;
};

const updateLayerExtent = () => {
  const maxScroll = Math.max(
    document.documentElement.scrollHeight - window.innerHeight,
    0,
  );
  const setHeight = (layer: HTMLElement | null, speed: number) => {
    if (!layer) return;
    layer.style.height = `${speed * maxScroll + 2 * window.innerHeight}px`;
  };
  setHeight(layer1, LAYER_SPEEDS[0]);
  setHeight(layer2, LAYER_SPEEDS[1]);
  setHeight(layer3, LAYER_SPEEDS[2]);
};

updateLayerExtent();
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateLayerExtent);
window.addEventListener("load", updateLayerExtent);
document.fonts.ready.then(updateLayerExtent);
