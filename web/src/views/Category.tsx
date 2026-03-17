import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, Empty } from 'antd'
import type { FileItem } from '@/types'
import { searchByType } from '@/api/file'
import { formatFileSize, getFileColor } from '@/utils'
import FilePreview from '@/components/FilePreview'

const categoryMap: Record<string, { title: string; color: string }> = {
  image: { title: '图片', color: '#e6a23c' },
  video: { title: '视频', color: '#9b59b6' },
  audio: { title: '音频', color: '#e91e63' },
  document: { title: '文档', color: '#1890ff' },
}

export default function Category() {
  const { type = '' } = useParams()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  const info = categoryMap[type] || { title: '分类', color: '#909399' }

  useEffect(() => {
    loadFiles()
  }, [type])

  const loadFiles = async () => {
    setLoading(true)
    try {
      const res = await searchByType(type)
      setFiles(res.data || [])
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ padding: '12px 0', marginBottom: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#303133' }}>
          <span style={{ color: info.color }}>●</span> {info.title}
        </h3>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#909399' }}>加载中...</p>
        </div>
      ) : files.length === 0 ? (
        <Empty description={`暂无${info.title}`} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
          {files.map((file) => (
            <div
              key={file.id}
              onDoubleClick={() => { setPreviewFile(file); setShowPreview(true) }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '20px 12px 16px', background: '#fff', borderRadius: 10,
                cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12, color: getFileColor(file.name, false) }}>📄</div>
              <div className="text-ellipsis" title={file.name} style={{ fontSize: 13, color: '#303133', maxWidth: '100%', textAlign: 'center' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: '#909399', marginTop: 4 }}>{formatFileSize(file.size)}</div>
            </div>
          ))}
        </div>
      )}

      <FilePreview open={showPreview} file={previewFile} onClose={() => setShowPreview(false)} />
    </div>
  )
}
