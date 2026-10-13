import { useThree } from '@react-three/fiber';
import { resolveCameraPlan, type CameraPath } from '@printsync/motion-engine';

interface CameraRigProps {
  /** Camera path from the render input. */
  path: CameraPath;
  /** Normalised progress through the composition, 0 -> 1. */
  progress: number;
  /** Radius of the item layout the camera should frame. */
  radius?: number;
}

/**
 * Applies a resolved camera path to the scene camera.
 *
 * Remotion renders one frame per evaluation, so the pose is applied during
 * render rather than in an animation loop — this keeps the output frame-exact
 * and deterministic, which the whole render pipeline depends on.
 */
export const CameraRig: React.FC<CameraRigProps> = ({ path, progress, radius = 3 }) => {
  const camera = useThree((state) => state.camera);
  const { pose } = resolveCameraPlan(path, progress, radius);
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
  camera.updateProjectionMatrix();
  return null;
};
