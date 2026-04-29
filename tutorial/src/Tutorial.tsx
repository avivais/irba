import { AbsoluteFill, Series } from "remotion";
import { ScreenshotScene } from "./scenes/ScreenshotScene";
import { scenes } from "./lib/scene-data";

export function Tutorial() {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={scene.durationFrames}>
            <ScreenshotScene scene={scene} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
