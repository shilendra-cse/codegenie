import { getHttpServer, startServer } from "@/server.js";
import { registerGracefulShutdown } from "./lib/shutdown.js";

registerGracefulShutdown(getHttpServer);

void startServer();
