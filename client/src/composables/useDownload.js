// 触发浏览器原生下载：把服务端签发的短时效 URL 交给 a[href]，
// 由浏览器边下边写盘 —— 保存框和进度条立即出现，
// 而不是像 blob 方案那样必须等整个文件读进内存后才弹框。
export function triggerDownload(url, filename) {
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
