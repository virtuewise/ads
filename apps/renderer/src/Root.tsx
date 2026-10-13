import { Composition } from 'remotion';
import { DEFAULT_PRODUCT_LINE_INPUTS } from '@printsync/motion-engine';
import { PrintSyncBrandFilm } from './compositions/PrintSyncBrandFilm';
import { PrintSyncSignatureFilm } from './compositions/PrintSyncSignatureFilm';
import { PrintSyncProductLine } from './compositions/PrintSyncProductLine';

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
    </>
  );
};
