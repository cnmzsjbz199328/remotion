import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(85);
Config.setCodec("h264");
Config.setConcurrency(4);
Config.setPixelFormat("yuv420p");
