// 触发浏览器下载文件（创建临时 <a> 并点击）

export function triggerFileDownload(url: string) {
  const link = document.createElement('a')
  link.setAttribute('href', url)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function buildExportUrl(basePath: string, params: URLSearchParams) {
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}