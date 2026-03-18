import { CONFIG } from '@/src/config'

class ApiClient {
  private baseUrl: string = CONFIG.BASE_URL
  private token: string | null = null

  setToken(t: string | null) {
    this.token = t
  }

  getToken() {
    return this.token
  }

  async request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Cookie: `auth-token=${this.token}` } : {}),
        ...opts?.headers,
      },
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Error desconocido')
    return json.data
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' })
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }
}

export const api = new ApiClient()
