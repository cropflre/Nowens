import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Empty, Button, message, Modal } from 'antd'
import {
  StarFilled, DeleteOutlined, FolderOpenOutlined,
  DownloadOutlined, EyeOutlined,
} from '@ant-design/icons'
import type { FileItem } from '@/types'
import { getFavorites, removeFavorite } from '@/api/favorite'
import { getDownloadUrl } from '@/api/file'
import { formatFileSize, formatDate, getFileColor } from '@/utils'
import FilePreview from '@/components/FilePreview'

export default function Favorites() {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<{ id: number; file_id: number; file: FileItem; created_at: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const res = await getFavorites()
      setFavorites(res.data || [])
    } catch {
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavorite = (fileId: number, fileName: string) => {
    Modal.confirm({
      title: '取消收藏',
      content: `确定要取消收藏「${fileName}」吗？`,
      okText: '取消收藏',
      okType: 'danger',
      cancelText: '保留',
      onOk: async () => {
        await removeFavorite(fileId)
        message.success('已取消收藏')
        loadFavorites()
      },
    })
  }

  const handleDoubleClick = (file: FileItem) => {
    if (file.is_dir) {
      navigate('/files')
    } else {
      setPreviewFile(file)
      setShowPreview(true)
    }
  }

  const handleDownload = (file: FileItem) => {
    const url = getDownloadUrl(file.uuid)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }

  return (
    <div>
      <div style={{ padding: '12px 0', marginBottom: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#303133' }}>
          <StarFilled style={{ color: '#faad14' }} /> 我的收藏
          <span style={{ fontSize: 14, color: '#909399', fontWeight: 400 }}>
            ({favorites.length} 个)
          </span>
        </h3>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#909399' }}>加载中...</p>
        </div>
      ) : favorites.length === 0 ? (
        <Empty description="暂无收藏，在文件上右键可以添加收藏" />
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16,
        }}>
          {favorites.map((fav) => (
            <div
              key={fav.id}
              onDoubleClick={() => handleDoubleClick(fav.file)}
              style={{
                display: 'flex', flexDirection: 'column',
                padding: '16px', background: '#fff', borderRadius: 10,
                cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
                border: '1px solid #f0f0f0', position: 'relative',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
              }}
            >
              {/* 收藏星标 */}
              <StarFilled
                onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(fav.file_id, fav.file.name) }}
                style={{
                  position: 'absolute', top: 8, right: 8, fontSize: 16,
                  color: '#faad14', cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 36, color: getFileColor(fav.file.name, fav.file.is_dir) }}>
                  {fav.file.is_dir ? '📁' : '📄'}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="text-ellipsis" title={fav.file.name} style={{ fontSize: 14, color: '#303133', fontWeight: 500 }}>
                    {fav.file.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#909399', marginTop: 4 }}>
                    {fav.file.is_dir ? '文件夹' : formatFileSize(fav.file.size)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#c0c4cc' }}>
                  收藏于 {formatDate(fav.created_at)}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {!fav.file.is_dir && (
                    <>
                      <Button
                        type="text" size="small"
                        icon={<EyeOutlined />}
                        onClick={(e) => { e.stopPropagation(); setPreviewFile(fav.file); setShowPreview(true) }}
                      />
                      <Button
                        type="text" size="small"
                        icon={<DownloadOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleDownload(fav.file) }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <FilePreview open={showPreview} file={previewFile} onClose={() => setShowPreview(false)} />
    </div>
  )
}
