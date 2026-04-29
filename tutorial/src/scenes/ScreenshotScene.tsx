import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS, SCENE_PRE_PAD_SEC, type Scene } from "../lib/scene-data";

/** Title-card duration: how long the Hebrew scene title is visible at the
 * start of each scene before fading away to reveal the screenshot. */
const TITLE_VISIBLE_SEC = 1.4;
const TITLE_FADE_SEC = 0.4;

type Props = {
  scene: Scene;
};

export function ScreenshotScene({ scene }: Props) {
  const frame = useCurrentFrame();
  const { width: vidW, height: vidH } = useVideoConfig();

  // Audio offset: small pre-pad so the picture is on screen before narrator
  // starts speaking.
  const audioStartFrame = Math.round(SCENE_PRE_PAD_SEC * FPS);

  // Title-card timing in frames
  const titleFadeOutStart = TITLE_VISIBLE_SEC * FPS;
  const titleFadeOutEnd = (TITLE_VISIBLE_SEC + TITLE_FADE_SEC) * FPS;
  const titleOpacity = interpolate(
    frame,
    [0, FPS * 0.3, titleFadeOutStart, titleFadeOutEnd],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // Image pans vertically across its full duration so tall screenshots are
  // visible end-to-end. Scaled to fit width=vidW, height grows proportionally.
  // The pan is clamped so we never scroll past the image bottom.
  // Approximate intrinsic dims — kept conservative so we never overshoot.
  // The CSS object-fit/translateY does the actual layout.
  const totalDurationFrames = scene.durationFrames;
  // Pan progress 0→1 over the whole scene, but eased so it feels gentle.
  const panProgress = interpolate(frame, [0, totalDurationFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Screenshot: scaled to fit width, panned vertically */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(scene.screenshotPath)}
          style={{
            width: vidW,
            height: "auto",
            display: "block",
            // Translate up by (panProgress × max-overflow). The max-overflow is
            // computed in CSS via calc() using the natural image height — but
            // since we don't know it at render-time, use a transform that
            // works generically: translateY(-{panProgress * 100%} of overflow).
            // Easier: use scrollTop semantics — wrap with a positioned container
            // and translateY by a CSS calc that references the image height.
            transform: `translateY(calc((${vidH}px - 100%) * ${panProgress}))`,
            willChange: "transform",
          }}
        />
      </div>

      {/* Title-card overlay — fades in fast, holds, fades out */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${titleOpacity * 0.55})`,
          opacity: titleOpacity > 0 ? 1 : 0,
          pointerEvents: "none",
        }}
      >
        <AbsoluteFill
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            direction: "rtl",
            padding: "8%",
          }}
        >
          <h1
            style={{
              fontFamily: "Heebo, system-ui, sans-serif",
              fontSize: 96,
              fontWeight: 700,
              color: "white",
              margin: 0,
              textShadow: "0 4px 24px rgba(0,0,0,0.6)",
              opacity: titleOpacity,
            }}
          >
            {scene.title}
          </h1>
        </AbsoluteFill>
      </AbsoluteFill>

      <Audio src={staticFile(scene.audioPath)} delay={audioStartFrame} />
    </AbsoluteFill>
  );
}
