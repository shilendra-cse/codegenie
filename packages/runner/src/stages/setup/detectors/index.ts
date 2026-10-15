import type { EcosystemDetector } from "../core/detector.js";
import { nodeDetector } from "./node/node-detector.js";

/** Detectors tried in order; the first match wins. Add new ecosystems here. */
export const DETECTORS: EcosystemDetector[] = [nodeDetector];
