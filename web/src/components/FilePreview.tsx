import { useState, useEffect } from 'react'
import { Modal, Spin, Button, Space } from 'antd'
import { DownloadOutlined, FileUnknownOutlined } from '@ant-design/icons'
import type { FileItem } from '@/types'
import { getPreviewUrl, getDownloadUrl } from '@/api/file'
import { formatFileSize } from '@/utils'

interface Props {
  open: boolean
  file: FileItem | null
  onClose: () => void
}

function getPreviewType(mimeType: string): string {
  if (!mimeType) return 'unknown'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text'
  return 'unknown'
}

export default function FilePreview({ open, file, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [previewType, setPreviewType] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    if (open && file) {
      loadPreview()
    }
  }, [open, file])

  const loadPreview = async () => {
    if (!file) return
    const mime = file.mime_type || ''
    const type = getPreviewType(mime)
    setPreviewType(type)
    const url = getPreviewUrl(file.uuid)
    setPreviewUrl(url)

    if (type === 'text') {
      setLoading(true)
      try {
        const response = await fetch(url)
        setTextContent(await response.text())
      } catch {
        setTextContent('加载文本内容失败')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleDownload = () => {
    if (!file) return
    const url = getDownloadUrl(file.uuid)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }

  const previewable = previewType !== 'unknown'

  return (
    <Modal
      title={file?.name || '文件预览'}
      open={open}
      onCancel={onClose}
      width="80%"
      style={{ top: '5vh' }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#909399' }}>
            {file && <span>{formatFileSize(file.size)}</span>}
            {file?.mime_type && (
              <span style={{ padding: '2px 8px', background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>
                {file.mime_type}
              </span>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>下载</Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      <div style={{ minHeight: 400, maxHeight: '75vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#909399' }}>加载中...</p>
          </div>
        ) : !previewable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
            <FileUnknownOutlined style={{ fontSize: 64, color: '#909399' }} />
            <h3 style={{ margin: '16px 0 8px', color: '#303133' }}>{file?.name}</h3>
            <p style={{ color: '#909399', marginBottom: 16 }}>该文件类型暂不支持在线预览</p>
            <Button type="primary" onClick={handleDownload}>下载文件</Button>
          </div>
        ) : previewType === 'image' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16, background: '#f0f0f0', minHeight: 400 }}>
            <img src={previewUrl} alt={file?.name} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
          </div>
        ) : previewType === 'video' ? (
          <div style={{ display: 'flex', justifyContent: 'center', background: '#000', padding: 16, minHeight: 400 }}>
            <video controls autoPlay src={previewUrl} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
          </div>
        ) : previewType === 'audio' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
            <span style={{ fontSize: 80 }}>🎵</span>
            <h3 style={{ margin: '16px 0' }}>{file?.name}</h3>
            <audio controls autoPlay src={previewUrl} style={{ width: '100%', marginTop: 20 }} />
          </div>
        ) : previewType === 'pdf' ? (
          <div style={{ height: '70vh' }}>
            <iframe src={previewUrl} width="100%" height="100%" style={{ border: 'none' }} />
          </div>
        ) : previewType === 'text' ? (
          <div style={{ padding: 16, background: '#fafafa', minHeight: 400, maxHeight: '70vh', overflow: 'auto' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6, color: '#303133' }}>
              <code>{textContent}</code>
            </pre>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
