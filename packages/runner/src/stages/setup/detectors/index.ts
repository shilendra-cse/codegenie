import type { EcosystemDetector } from "../core/detector.js";
import { nodeDetector } from "./node/node-detector.js";

export const DETECTORS: EcosystemDetector[] = [nodeDetector];
