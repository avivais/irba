import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FPS, SCENE_PRE_PAD_SEC, type Scene } from "../lib/scene-data";

/** Per-scene background colors so they're visually distinct in the rough cut. */
const COLORS: Record<Scene["id"], string> = {
  intro: "#0f172a", // slate-900
  login: "#064e3b", // emerald-900
  "browse-sessions": "#1e3a8a", // blue-900
  rsvp: "#7c2d12", // orange-900
  cancel: "#7f1d1d", // red-900
  profile: "#581c87", // purple-900
  outro: "#0f172a",
};

type Props = {
  scene: Scene;
};

/**
 * Rough-cut placeholder: solid color background, Hebrew title and narration
 * text overlaid, audio plays starting after a small pre-pad. Real screenshots
 * + animations replace this once the script is locked.
 */
export function PlaceholderScene({ scene }: Props) {
  const frame = useCurrentFrame();
  const audioStartFrame = SCENE_PRE_PAD_SEC * FPS;

  // Fade title in over the first half-second
  const titleOpacity = interpolate(frame, [0, FPS * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });
  // Fade subtitle in slightly after title
  const subtitleOpacity = interpolate(frame, [FPS * 0.3, FPS * 0.8], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS[scene.id],
        color: "white",
        fontFamily: "Heebo, system-ui, sans-serif",
        direction: "rtl",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "8%",
      }}
    >
      <h1
        style={{
          fontSize: 96,
          fontWeight: 700,
          margin: 0,
          marginBottom: 60,
          opacity: titleOpacity,
        }}
      >
        {scene.title}
      </h1>
      <p
        style={{
          fontSize: 52,
          lineHeight: 1.5,
          margin: 0,
          maxWidth: "85%",
          opacity: subtitleOpacity,
        }}
      >
        {/* Strip the inline SSML tags from the displayed text */}
        {scene.text.replace(/<[^>]+>/g, "")}
      </p>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          fontSize: 28,
          opacity: 0.4,
          direction: "ltr",
        }}
      >
        scene: {scene.id} · {scene.audioDurationSec.toFixed(1)}s
      </div>

      <Audio src={staticFile(scene.audioPath)} startFrom={0} delay={Math.round(audioStartFrame)} />
    </AbsoluteFill>
  );
}
