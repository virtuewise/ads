import type { CameraPose } from '@printsync/motion-engine';
import { useThree } from '@react-three/fiber';

interface CameraRigProps {
  /** Resolved camera pose, in scene units. */
  pose: CameraPose;
}

/**
 * Applies a resolved camera pose to the scene camera.
 *
 * Remotion renders one frame per evaluation, so the pose is applied during
 * render rather than in an animation loop — this keeps the output frame-exact
 * and deterministic, which the whole render pipeline depends on. Both the
 * product-line and living-city films resolve their own camera plan in pure,
 * tested code and hand the pose here.
 */
export const CameraRig: React.FC<CameraRigProps> = ({ pose }) => {
  const camera = useThree((state) => state.camera);
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
  camera.updateProjectionMatrix();
  return null;
};
