import bannerPagga from "./assets/banner.txt" with { type: "text" };
import bannerBlurvision from "./assets/banner-blurvision.txt" with { type: "text" };
import bannerSlant from "./assets/banner-slant.txt" with { type: "text" };
import bannerBloody from "./assets/banner-bloody.txt" with { type: "text" };

const BANNERS = [bannerPagga, bannerBlurvision, bannerSlant, bannerBloody];

const banner = BANNERS[Math.floor(Math.random() * BANNERS.length)]!.replace(/\n+$/, "");

export function Banner() {
  return (
    <box style={{ flexDirection: "column", alignItems: "center", paddingTop: 1, gap: 1 }}>
      <text fg="#7dcfff">{banner}</text>
      <text fg="#565f89">minimalist terminal coding assistant · type a request and press Enter</text>
    </box>
  );
}
