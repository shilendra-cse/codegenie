import type { EcosystemDetector } from "./detector.js";
import { nodeDetector } from "./node/node-detector.js";

export const DETECTORS: EcosystemDetector[] = [nodeDetector];
