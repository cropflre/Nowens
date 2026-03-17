import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, Empty, Button, Modal } from 'antd'
import {
  AppstoreOutlined, UnorderedListOutlined,
  LeftOutlined, RightOutlined, CloseOutlined,
  ExpandOutlined,
} from '@ant-design/icons'
import type { FileItem } from '@/types'
import { searchByType, getPreviewUrl, getDownloadUrl } from '@/api/file'
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

  // 画廊模式（仅图片类型）
  const [galleryIndex, setGalleryIndex] = useState(-1) // -1 表示不显示画廊
  const [viewMode, setViewMode] = useState<'grid' | 'gallery'>('grid')

  const info = categoryMap[type] || { title: '分类', color: '#909399' }
  const isImage = type === 'image'

  useEffect(() => {
    loadFiles()
    // 图片类型默认使用画廊模式
    setViewMode(type === 'image' ? 'gallery' : 'grid')
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

  // 画廊键盘导航
  const handleGalleryKeyDown = useCallback((e: KeyboardEvent) => {
    if (galleryIndex < 0) return
    if (e.key === 'ArrowLeft') {
      setGalleryIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1))
    } else if (e.key === 'ArrowRight') {
      setGalleryIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'Escape') {
      setGalleryIndex(-1)
    }
  }, [galleryIndex, files.length])

  useEffect(() => {
    window.addEventListener('keydown', handleGalleryKeyDown)
    return () => window.removeEventListener('keydown', handleGalleryKeyDown)
  }, [handleGalleryKeyDown])

  const handleClick = (file: FileItem, index: number) => {
    if (isImage && viewMode === 'gallery') {
      setGalleryIndex(index)
    } else {
      setPreviewFile(file)
      setShowPreview(true)
    }
  }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', marginBottom: 8,
      }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#303133', margin: 0 }}>
          <span style={{ color: info.color }}>●</span> {info.title}
          <span style={{ fontSize: 14, color: '#909399', fontWeight: 400 }}>
            ({files.length} 个)
          </span>
        </h3>
        {isImage && files.length > 0 && (
          <Button.Group>
            <Button
              type={viewMode === 'gallery' ? 'primary' : 'default'}
              icon={<ExpandOutlined />}
              onClick={() => setViewMode('gallery')}
            >
              画廊
            </Button>
            <Button
              type={viewMode === 'grid' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('grid')}
            >
              网格
            </Button>
          </Button.Group>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#909399' }}>加载中...</p>
        </div>
      ) : files.length === 0 ? (
        <Empty description={`暂无${info.title}`} />
      ) : isImage && viewMode === 'gallery' ? (
        /* 图片画廊模式 — 瀑布流 */
        <div style={{
          columnCount: 4, columnGap: 12,
        }}>
          {files.map((file, index) => (
            <div
              key={file.id}
              onClick={() => handleClick(file, index)}
              style={{
                breakInside: 'avoid', marginBottom: 12,
                borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                background: '#f5f5f5',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              <img
                src={getPreviewUrl(file.uuid)}
                alt={file.name}
                loading="lazy"
                style={{
                  width: '100%', display: 'block',
                  minHeight: 100, objectFit: 'cover',
                }}
              />
              <div style={{
                padding: '8px 10px', background: '#fff',
              }}>
                <div className="text-ellipsis" style={{ fontSize: 12, color: '#606266' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 2 }}>
                  {formatFileSize(file.size)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 普通网格视图 */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
          {files.map((file, index) => (
            <div
              key={file.id}
              onClick={() => handleClick(file, index)}
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
              {isImage ? (
                <img
                  src={getPreviewUrl(file.uuid)}
                  alt={file.name}
                  loading="lazy"
                  style={{
                    width: 80, height: 80, objectFit: 'cover',
                    borderRadius: 6, marginBottom: 12,
                  }}
                />
              ) : (
                <div style={{ fontSize: 48, marginBottom: 12, color: getFileColor(file.name, false) }}>📄</div>
              )}
              <div className="text-ellipsis" title={file.name} style={{ fontSize: 13, color: '#303133', maxWidth: '100%', textAlign: 'center' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: '#909399', marginTop: 4 }}>{formatFileSize(file.size)}</div>
            </div>
          ))}
        </div>
      )}

      {/* 画廊幻灯片查看器 */}
      {galleryIndex >= 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.92)', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setGalleryIndex(-1)}
        >
          {/* 关闭按钮 */}
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setGalleryIndex(-1)}
            style={{
              position: 'absolute', top: 16, right: 16,
              color: '#fff', fontSize: 20, zIndex: 1001,
            }}
          />

          {/* 左箭头 */}
          <Button
            type="text"
            icon={<LeftOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              setGalleryIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1))
            }}
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: '#fff', fontSize: 24, width: 48, height: 48,
              background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
              zIndex: 1001,
            }}
          />

          {/* 图片 */}
          <img
            src={getPreviewUrl(files[galleryIndex]?.uuid)}
            alt={files[galleryIndex]?.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '85vw', maxHeight: '80vh',
              objectFit: 'contain', borderRadius: 4,
              boxShadow: '0 0 40px rgba(0,0,0,0.5)',
            }}
          />

          {/* 右箭头 */}
          <Button
            type="text"
            icon={<RightOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              setGalleryIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0))
            }}
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              color: '#fff', fontSize: 24, width: 48, height: 48,
              background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
              zIndex: 1001,
            }}
          />

          {/* 底部信息栏 */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '16px 24px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>
                {files[galleryIndex]?.name}
              </div>
              <div style={{ fontSize: 13, color: '#a0a0a0', marginTop: 4 }}>
                {formatFileSize(files[galleryIndex]?.size)} · {galleryIndex + 1} / {files.length}
              </div>
            </div>
            <Button
              type="primary" ghost size="small"
              onClick={(e) => {
                e.stopPropagation()
                const url = getDownloadUrl(files[galleryIndex]?.uuid)
                const a = document.createElement('a')
                a.href = url
                a.download = files[galleryIndex]?.name
                a.click()
              }}
            >
              下载
            </Button>
          </div>

          {/* 缩略图条 */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 6, padding: '8px 12px',
              background: 'rgba(0,0,0,0.5)', borderRadius: 8,
              maxWidth: '80vw', overflowX: 'auto',
            }}
          >
            {files.map((file, idx) => (
              <img
                key={file.id}
                src={getPreviewUrl(file.uuid)}
                alt={file.name}
                onClick={() => setGalleryIndex(idx)}
                style={{
                  width: 48, height: 48, objectFit: 'cover',
                  borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                  border: idx === galleryIndex ? '2px solid #1890ff' : '2px solid transparent',
                  opacity: idx === galleryIndex ? 1 : 0.6,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </div>
      )}

      <FilePreview open={showPreview} file={previewFile} onClose={() => setShowPreview(false)} />
    </div>
  )
}
