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
