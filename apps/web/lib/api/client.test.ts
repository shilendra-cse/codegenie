import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./client";

function answer(status: number, body: unknown): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) => {
    const response = {
      data: body,
      status,
      statusText: String(status),
      headers: new AxiosHeaders(),
      config,
    };
    if (status < 400) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${status}`,
        undefined,
        config,
        null,
        response,
      ),
    );
  };
}

const networkDown: AxiosAdapter = (config) =>
  Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));

describe("createApiClient", () => {
  it("calls the API under /api and hands back the envelope's data", async () => {
    let url = "";
    const client = createApiClient({
      onUnauthorized: () => {},
      adapter: (config) => {
        url = `${config.baseURL}${config.url}`;
        return answer(200, {
          status: 200,
          message: "OK",
          type: "success",
          data: { projects: [] },
        })(config);
      },
    });

    const { data } = await client.get<{ projects: unknown[] }>("/projects");

    expect(url).toBe("/api/projects");
    expect(data).toEqual({ projects: [] });
  });

  it("turns an API error into an ApiError with its status, code and message", async () => {
    const client = createApiClient({
      onUnauthorized: () => {},
      adapter: answer(409, {
        status: 409,
        message: "Set up this project's environment first.",
        type: "error",
        code: "PROJECT_NOT_SET_UP",
      }),
    });

    const failure = client.post("/projects/1/tasks", { prompt: "Fix it" });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      status: 409,
      code: "PROJECT_NOT_SET_UP",
      message: "Set up this project's environment first.",
    });
  });

  it("reports a network failure as status 0", async () => {
    const client = createApiClient({
      onUnauthorized: () => {},
      adapter: networkDown,
    });

    await expect(client.get("/projects")).rejects.toMatchObject({
      status: 0,
      message: "Couldn't reach CodeGenie. Check your connection and try again.",
    });
  });

  it("calls onUnauthorized for a 401, and still fails the request", async () => {
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      onUnauthorized,
      adapter: answer(401, {
        status: 401,
        message: "Unauthorized",
        type: "error",
      }),
    });

    await expect(client.get("/projects")).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
