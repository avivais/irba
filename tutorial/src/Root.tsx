import { Composition } from "remotion";
import { Tutorial } from "./Tutorial";
import { FPS, HEIGHT, WIDTH, totalDurationFrames } from "./lib/scene-data";

export function Root() {
  return (
    <>
      <Composition
        id="Tutorial"
        component={Tutorial}
        durationInFrames={totalDurationFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
}
