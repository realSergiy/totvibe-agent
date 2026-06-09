import { theme } from '@totvibe/view';

import bannerBloody from '@/assets/banner-bloody.txt' with { type: 'text' };
import bannerBlurvision from '@/assets/banner-blurvision.txt' with { type: 'text' };
import bannerSlant from '@/assets/banner-slant.txt' with { type: 'text' };
import bannerPagga from '@/assets/banner.txt' with { type: 'text' };

const BANNERS = [bannerPagga, bannerBlurvision, bannerSlant, bannerBloody];

const banner = (BANNERS[Math.floor(Math.random() * BANNERS.length)] ?? '').replace(/\n+$/, '');

export const Banner = () => (
  <box style={{ alignItems: 'center', flexDirection: 'column', gap: 1, paddingTop: 1 }}>
    <text fg={theme.brand}>{banner}</text>
    <text fg={theme.muted}>minimalist terminal coding assistant · type a request and press Enter</text>
  </box>
);
