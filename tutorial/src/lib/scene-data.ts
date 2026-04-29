import scriptJson from "../script.json" with { type: "json" };
import durationsJson from "../../assets/audio/durations.json" with { type: "json" };

/** Padding (seconds) added before+after each clip's audio for breathing room. */
export const SCENE_PRE_PAD_SEC = 0.3;
export const SCENE_POST_PAD_SEC = 0.5;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type SceneId =
  | "intro"
  | "login"
  | "browse-sessions"
  | "rsvp"
  | "cancel"
  | "profile"
  | "outro";

export type Scene = {
  id: SceneId;
  title: string;
  text: string;
  audioDurationSec: number;
  audioPath: string;
  screenshotPath: string;
  /** Total scene duration including padding. */
  durationFrames: number;
};

const durations = durationsJson as Record<SceneId, number>;

export const scenes: Scene[] = (scriptJson as { id: SceneId; title: string; text: string }[]).map(
  (s) => {
    const audioSec = durations[s.id];
    if (typeof audioSec !== "number") {
      throw new Error(`No duration for scene '${s.id}' — run npm run tts first.`);
    }
    const totalSec = SCENE_PRE_PAD_SEC + audioSec + SCENE_POST_PAD_SEC;
    return {
      id: s.id,
      title: s.title,
      text: s.text,
      audioDurationSec: audioSec,
      audioPath: `/audio/${s.id}.mp3`,
      screenshotPath: `/screenshots/${s.id}-1.png`,
      durationFrames: Math.ceil(totalSec * FPS),
    };
  },
);

export const totalDurationFrames = scenes.reduce(
  (acc, s) => acc + s.durationFrames,
  0,
);
