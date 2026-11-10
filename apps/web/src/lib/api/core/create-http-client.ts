import { createDelete } from "../methods/delete"
import { createGet } from "../methods/get"
import { createPatch } from "../methods/patch"
import { createPost } from "../methods/post"
import { createPut } from "../methods/put"
import { createRequest } from "./create-request"
import type { HttpClient, HttpClientConfig } from "./types"

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const request = createRequest(config)

  return {
    request,
    get: createGet(request),
    post: createPost(request),
    put: createPut(request),
    patch: createPatch(request),
    delete: createDelete(request),
  }
}
