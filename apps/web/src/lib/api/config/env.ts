import { API_PROXY_PREFIX } from "@/lib/bff/constants"

export const API_BASE_URL = API_PROXY_PREFIX

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`
