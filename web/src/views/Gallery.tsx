import { useState, useEffect } from 'react'
import { Spin, Empty, Modal } from 'antd'
import { PictureOutlined, DownloadOutlined } from '@ant-design/icons'
import { searchByType, getPreviewUrl, getDownloadUrl } from '@/api/file'
import { formatFileSize, formatDate } from '@/utils'
import type { FileItem } from '@/types'
import { useTranslation } from 'react-i18next'

// 按日期分组图片
function groupByDate(files: FileItem[]): { date: string; files: FileItem[] }[] {
  const groups: Record<string, FileItem[]> = {}
  for (const file of files) {
    const date = new Date(file.created_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(file)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a)) // 按日期降序
    .map(([date, files]) => ({ date, files }))
}

export default function Gallery() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState<FileItem[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    setLoading(true)
    try {
      const res = await searchByType('image')
      setImages(res.data || [])
    } catch {}
    setLoading(false)
  }

  const openPreview = (file: FileItem, index: number) => {
    setPreviewFile(file)
    setPreviewIndex(index)
    setPreviewOpen(true)
  }

  const navigatePreview = (direction: number) => {
    const newIndex = previewIndex + direction
    if (newIndex >= 0 && newIndex < images.length) {
      setPreviewIndex(newIndex)
      setPreviewFile(images[newIndex])
    }
  }

  const handleDownload = () => {
    if (!previewFile) return
    const a = document.createElement('a')
    a.href = getDownloadUrl(previewFile.uuid)
    a.download = previewFile.name
    a.click()
  }

  const groups = groupByDate(images)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PictureOutlined /> {t('gallery.title')}
        </h3>
        <span style={{ fontSize: 14, color: '#909399' }}>
          {images.length} {t('gallery.allPhotos').toLowerCase()}
        </span>
      </div>

      {images.length === 0 ? (
        <Empty description={t('gallery.noPhotos')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        groups.map((group) => (
          <div key={group.date} style={{ marginBottom: 32 }}>
            {/* 日期标题 */}
            <div style={{
              fontSize: 15, fontWeight: 600, color: '#303133',
              marginBottom: 12, paddingBottom: 8,
              borderBottom: '1px solid #ebeef5',
            }}>
              📅 {group.date}
              <span style={{ fontSize: 12, fontWeight: 400, color: '#909399', marginLeft: 8 }}>
                {group.files.length} 张
              </span>
            </div>

            {/* 瀑布流网格 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
            }}>
              {group.files.map((file, idx) => {
                const globalIdx = images.findIndex((f) => f.id === file.id)
                return (
                  <div
                    key={file.id}
                    onClick={() => openPreview(file, globalIdx)}
                    style={{
                      position: 'relative', cursor: 'pointer',
                      borderRadius: 8, overflow: 'hidden',
                      aspectRatio: '1', background: '#f0f0f0',
                    }}
                    onMouseEnter={(e) => {
                      const overlay = e.currentTarget.querySelector('.photo-overlay') as HTMLElement
                      if (overlay) overlay.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      const overlay = e.currentTarget.querySelector('.photo-overlay') as HTMLElement
                      if (overlay) overlay.style.opacity = '0'
                    }}
                  >
                    <img
                      src={getPreviewUrl(file.uuid)}
                      alt={file.name}
                      loading="lazy"
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', display: 'block',
                        transition: 'transform 0.3s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                    <div
                      className="photo-overlay"
                      style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '24px 8px 8px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                        color: '#fff', fontSize: 11, opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <div className="text-ellipsis" style={{ fontWeight: 500 }}>{file.name}</div>
                      <div style={{ opacity: 0.8 }}>{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* 图片预览弹窗 */}
      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width="90%"
        style={{ top: '3vh' }}
        footer={null}
        destroyOnClose
        closable={false}
      >
        {previewFile && (
          <div style={{ position: 'relative' }}>
            {/* 标题栏 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, padding: '0 4px',
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16 }}>{previewFile.name}</h4>
                <span style={{ fontSize: 12, color: '#909399' }}>
                  {formatFileSize(previewFile.size)} · {formatDate(previewFile.created_at)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a onClick={handleDownload} style={{ fontSize: 20, color: '#1890ff' }}>
                  <DownloadOutlined />
                </a>
              </div>
            </div>

            {/* 图片 */}
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              background: '#000', borderRadius: 8, minHeight: 400, maxHeight: '75vh',
              overflow: 'hidden', position: 'relative',
            }}>
              <img
                src={getPreviewUrl(previewFile.uuid)}
                alt={previewFile.name}
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }}
              />

              {/* 左右切换 */}
              {previewIndex > 0 && (
                <div
                  onClick={() => navigatePreview(-1)}
                  style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 20, color: '#303133',
                  }}
                >
                  ‹
                </div>
              )}
              {previewIndex < images.length - 1 && (
                <div
                  onClick={() => navigatePreview(1)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 20, color: '#303133',
                  }}
                >
                  ›
                </div>
              )}
            </div>

            {/* 底部缩略图条 */}
            <div style={{
              display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto',
              padding: '4px 0',
            }}>
              {images.slice(Math.max(0, previewIndex - 5), previewIndex + 6).map((img, i) => {
                const realIdx = Math.max(0, previewIndex - 5) + i
                return (
                  <img
                    key={img.id}
                    src={getPreviewUrl(img.uuid)}
                    alt={img.name}
                    onClick={() => { setPreviewFile(img); setPreviewIndex(realIdx) }}
                    style={{
                      width: 60, height: 60, objectFit: 'cover', borderRadius: 6,
                      cursor: 'pointer', flexShrink: 0,
                      border: realIdx === previewIndex ? '2px solid #1890ff' : '2px solid transparent',
                      opacity: realIdx === previewIndex ? 1 : 0.6,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
