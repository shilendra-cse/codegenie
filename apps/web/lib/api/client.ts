import type { ApiErrorBody, ApiErrorCode, ApiSuccess } from "@hobai/shared";
import axios, {
  type AxiosAdapter,
  type AxiosInstance,
  isAxiosError,
} from "axios";
import { PRODUCT_NAME } from "@hobai/shared/brand";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: ApiErrorCode,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClientOptions = {
  onUnauthorized: () => void;
  adapter?: AxiosAdapter;
};

const UNREACHABLE =
  `Couldn't reach ${PRODUCT_NAME}. Check your connection and try again.`;

function toApiError(error: unknown, onUnauthorized: () => void): ApiError {
  if (!isAxiosError<Partial<ApiErrorBody>>(error) || !error.response) {
    return new ApiError(0, UNREACHABLE);
  }
  const { status, data } = error.response;
  if (status === 401) onUnauthorized();
  return new ApiError(
    status,
    data?.message ?? error.message,
    data?.code,
    data?.data,
  );
}

export function createApiClient({
  onUnauthorized,
  adapter,
}: ApiClientOptions): AxiosInstance {
  const client = axios.create({ baseURL: "/api", adapter });
  client.interceptors.response.use(
    (response) => {
      response.data = (response.data as ApiSuccess<unknown>).data;
      return response;
    },
    (error: unknown) => Promise.reject(toApiError(error, onUnauthorized)),
  );
  return client;
}

function goToSignIn() {
  if (window.location.pathname === "/signin") return;
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/signin?next=${encodeURIComponent(next)}`);
}

export const api = createApiClient({ onUnauthorized: goToSignIn });
