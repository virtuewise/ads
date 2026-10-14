import { DEFAULT_CITY_INPUTS, DEFAULT_PRODUCT_LINE_INPUTS } from '@printsync/motion-engine';
import { Composition } from 'remotion';
import { PrintSyncBrandFilm } from './compositions/PrintSyncBrandFilm';
import { PrintSyncLivingCity } from './compositions/PrintSyncLivingCity';
import { PrintSyncProductLine } from './compositions/PrintSyncProductLine';
import { PrintSyncSignatureFilm } from './compositions/PrintSyncSignatureFilm';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PrintSyncBrandFilm"
        component={PrintSyncBrandFilm}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'PRINTSYNC',
          tagline: 'Your Vision. Our Precision.',
        }}
      />
      <Composition
        id="PrintSyncSignatureFilm"
        component={PrintSyncSignatureFilm}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'PRINTSYNC',
          tagline: 'Your Vision. Our Precision.',
          audioSrc: 'printsync-signature.wav',
        }}
      />
      <Composition
        id="PrintSyncProductLine"
        component={PrintSyncProductLine}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
        // Driven by the shared render-input defaults: brand tokens, curated
        // hero items, per-item choreography and the turntable camera path.
        defaultProps={{ ...DEFAULT_PRODUCT_LINE_INPUTS }}
      />
      <Composition
        id="PrintSyncLivingCity"
        component={PrintSyncLivingCity}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
        // Driven by the shared city defaults: seed, time of day, density,
        // route, camera path and the print items used as advertising content.
        defaultProps={{ ...DEFAULT_CITY_INPUTS }}
      />
    </>
  );
};
