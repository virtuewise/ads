import { Composition } from 'remotion';
import { PrintSyncBrandFilm } from './compositions/PrintSyncBrandFilm';
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
    </>
  );
};
