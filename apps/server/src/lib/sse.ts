import type { RequestHandler, Response } from "express";
import type {
  AuthenticatedRequest,
  AuthenticatedStream,
  PublicStream,
  StreamRoute,
} from "@/types/base.types";

export type SseFrame = { id?: number; data: string } | { comment: string };

export type SseStream = {
  send: (frame: SseFrame) => void;
  signal: AbortSignal;
};

function format(frame: SseFrame) {
  if ("comment" in frame) return `: ${frame.comment}\n\n`;
  const id = frame.id === undefined ? "" : `id: ${frame.id}\n`;
  return `${id}data: ${frame.data}\n\n`;
}

export function openSse(res: Response): SseStream {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.flushHeaders();
  const disconnected = new AbortController();
  res.on("close", () => disconnected.abort());
  return {
    send: (frame) => {
      if (!res.writableEnded) res.write(format(frame));
    },
    signal: disconnected.signal,
  };
}

export function stream<Handler extends AuthenticatedStream | PublicStream>(
  handler: Handler,
): StreamRoute<Handler> {
  return { kind: "stream", handler };
}

export type StreamErrorReporter = (error: unknown, path: string) => void;

export function handleStream(
  stream: AuthenticatedStream,
  reportError: StreamErrorReporter,
): RequestHandler {
  return (req, res, next) => {
    stream(req as AuthenticatedRequest, res)
      .catch((error: unknown) => {
        if (!res.headersSent) return next(error);
        reportError(error, req.path);
      })
      .finally(() => {
        if (res.headersSent && !res.writableEnded) res.end();
      });
  };
}
