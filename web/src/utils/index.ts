/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 1分钟内
  if (diff < 60 * 1000) return '刚刚'
  // 1小时内
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '分钟前'
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  // 今年
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 根据文件名获取图标名称（Element Plus 图标）
 */
export function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return 'Folder'

  const ext = name.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    // 图片
    jpg: 'Picture', jpeg: 'Picture', png: 'Picture', gif: 'Picture',
    bmp: 'Picture', svg: 'Picture', webp: 'Picture', ico: 'Picture',
    // 文档
    pdf: 'Document', doc: 'Document', docx: 'Document',
    xls: 'Document', xlsx: 'Document',
    ppt: 'Document', pptx: 'Document',
    txt: 'Document', md: 'Document',
    // 视频
    mp4: 'VideoCamera', avi: 'VideoCamera', mkv: 'VideoCamera',
    mov: 'VideoCamera', wmv: 'VideoCamera', flv: 'VideoCamera',
    // 音频
    mp3: 'Headset', wav: 'Headset', flac: 'Headset',
    aac: 'Headset', ogg: 'Headset',
    // 压缩包
    zip: 'Files', rar: 'Files', '7z': 'Files', tar: 'Files', gz: 'Files',
    // 代码
    js: 'Document', ts: 'Document', vue: 'Document', jsx: 'Document',
    py: 'Document', go: 'Document', java: 'Document', cpp: 'Document',
    html: 'Document', css: 'Document', json: 'Document',
  }

  return iconMap[ext] || 'DocumentCopy'
}

/**
 * 判断是否可预览
 */
export function isPreviewable(mimeType: string): boolean {
  if (!mimeType) return false
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/')
  )
}

/**
 * 获取文件颜色
 */
export function getFileColor(name: string, isDir: boolean): string {
  if (isDir) return '#f0c040'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const colorMap: Record<string, string> = {
    jpg: '#e6a23c', jpeg: '#e6a23c', png: '#67c23a', gif: '#e6a23c',
    svg: '#409eff', webp: '#e6a23c',
    pdf: '#f56c6c', doc: '#409eff', docx: '#409eff',
    xls: '#67c23a', xlsx: '#67c23a',
    ppt: '#e6a23c', pptx: '#e6a23c',
    txt: '#909399', md: '#909399',
    mp4: '#9b59b6', avi: '#9b59b6', mkv: '#9b59b6',
    mp3: '#e91e63', wav: '#e91e63', flac: '#e91e63',
    zip: '#795548', rar: '#795548', '7z': '#795548',
    js: '#f7df1e', ts: '#3178c6', vue: '#42b883', py: '#3776ab',
    go: '#00add8', java: '#b07219',
  }
  return colorMap[ext] || '#909399'
}
