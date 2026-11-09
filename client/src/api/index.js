const BASE_URL = '/api'

async function request(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.hash = '#/login'
    throw new Error('登录已过期')
  }

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('服务器响应异常')
  }
  if (!res.ok) {
    throw new Error(data.error || '请求失败')
  }
  return data
}

export function get(path) {
  return request(path)
}

export function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) })
}

export function put(path, body) {
  return request(path, { method: 'PUT', body: JSON.stringify(body) })
}

export function del(path) {
  return request(path, { method: 'DELETE' })
}

// 长耗时请求（如 Git 部署）：默认 150 秒超时，超时给出可读提示
export function postWithTimeout(path, body, timeoutMs = 150000) {
  const token = localStorage.getItem('token')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body),
    signal: controller.signal
  })
    .then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem('token')
        window.location.hash = '#/login'
        throw new Error('登录已过期')
      }
      let data
      try {
        data = await res.json()
      } catch {
        throw new Error('服务器响应异常')
      }
      if (!res.ok) throw new Error(data.error || '请求失败')
      return data
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        throw new Error('请求超时，后端可能仍在部署，稍后刷新列表确认结果')
      }
      throw err
    })
    .finally(() => clearTimeout(timer))
}

// 文件直链 — 上传（FormData，含可选过期时间），列表，删除
export function uploadDirectLink(file, expiresAt) {
  const token = localStorage.getItem('token')
  const form = new FormData()
  form.append('file', file)
  if (expiresAt) form.append('expiresAt', expiresAt)
  return fetch(`${BASE_URL}/directlink/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  }).then(async (res) => {
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.hash = '#/login'
      throw new Error('登录已过期')
    }
    let data
    try { data = await res.json() } catch { throw new Error('服务器响应异常') }
    if (!res.ok) throw new Error(data.error || '上传失败')
    return data
  })
}

export function listDirectLinks() {
  return get('/directlink')
}

export function deleteDirectLink(token) {
  return del(`/directlink/${encodeURIComponent(token)}`)
}
