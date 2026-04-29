import { Config } from "@remotion/cli/config";

// Use assets/ as the static file dir so audio + screenshots are served at
// /audio/*.mp3, /screenshots/*.png from staticFile().
Config.setPublicDir("assets");

// Encode audio inside the MP4 (default codec h264 already supports AAC audio).
Config.setCodec("h264");

// Concurrency: stay conservative for a 4-CPU laptop running other apps.
Config.setConcurrency(2);
