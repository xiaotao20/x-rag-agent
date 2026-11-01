import { API_BASE } from './api'

export type CaptchaChallenge = {
  challenge_id: string
  background: string
  piece: string
  image_width: number
  image_height: number
  piece_width: number
  piece_height: number
  piece_y: number
  expires_in: number
}

export type CaptchaTicket = {
  ticket: string
  expires_in: number
}

export type AuthUser = {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
}

/** 认证请求错误。 */
export class AuthApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

/** 读取认证接口错误响应。 */
async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: { msg?: string }) => item.msg ?? JSON.stringify(item))
        .join('；')
    }
    return JSON.stringify(data)
  } catch {
    return response.statusText || `HTTP ${response.status}`
  }
}

/** 发送认证请求并统一处理错误。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...init,
    })
  } catch {
    throw new AuthApiError('无法连接后端服务，请确认 FastAPI 已启动', 0)
  }
  if (!response.ok) {
    throw new AuthApiError(await readError(response), response.status)
  }
  return (await response.json()) as T
}

/** 获取可选拼图挑战。 */
export function getCaptchaChallenge(): Promise<CaptchaChallenge> {
  return request('/api/v1/auth/captcha/challenge')
}

/** 校验拼图并获取一次性 ticket。 */
export function verifyCaptcha(payload: {
  challenge_id: string
  offset: number
  phone: string
}): Promise<CaptchaTicket> {
  return request('/api/v1/auth/captcha/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/** 注册账号。 */
export function registerAccount(
  username: string,
  password: string,
): Promise<AuthUser> {
  return request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

/** 账号密码登录。 */
export function loginAccount(
  username: string,
  password: string,
): Promise<AuthUser> {
  return request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

/** 获取当前登录用户。 */
export function getMe(): Promise<AuthUser> {
  return request('/api/v1/auth/me')
}

/** 退出登录。 */
export function logout(): Promise<{ ok: boolean }> {
  return request('/api/v1/auth/logout', { method: 'POST' })
}
