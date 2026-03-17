import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Card, Progress, Empty } from 'antd'
import {
  FileOutlined, FolderOutlined, DeleteOutlined, ShareAltOutlined,
  StarOutlined, CloudUploadOutlined, PictureOutlined,
  VideoCameraOutlined, AudioOutlined, FileTextOutlined,
  EllipsisOutlined,
} from '@ant-design/icons'
import { getDashboard } from '@/api/dashboard'
import { formatFileSize, formatDate, getFileColor } from '@/utils'
import FilePreview from '@/components/FilePreview'
import type { FileItem } from '@/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await getDashboard()
      setData(res.data)
    } catch {}
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!data) return <Empty description="加载失败" />

  const storagePercent = Math.min(Math.round((data.storage_used / data.storage_limit) * 100), 100)

  // 类型分布颜色
  const typeColors: Record<string, string> = {
    '图片': '#e6a23c',
    '视频': '#9b59b6',
    '音频': '#e91e63',
    '文档': '#1890ff',
    '其他': '#909399',
  }
  const typeIcons: Record<string, React.ReactNode> = {
    '图片': <PictureOutlined />,
    '视频': <VideoCameraOutlined />,
    '音频': <AudioOutlined />,
    '文档': <FileTextOutlined />,
    '其他': <EllipsisOutlined />,
  }

  // 统计卡片
  const statCards = [
    { label: '文件', count: data.file_count, icon: <FileOutlined />, color: '#1890ff' },
    { label: '文件夹', count: data.folder_count, icon: <FolderOutlined />, color: '#f0c040' },
    { label: '分享', count: data.share_count, icon: <ShareAltOutlined />, color: '#52c41a' },
    { label: '收藏', count: data.favorite_count, icon: <StarOutlined />, color: '#faad14' },
    { label: '回收站', count: data.trash_count, icon: <DeleteOutlined />, color: '#f5222d' },
  ]

  return (
    <div>
      <h3 style={{ fontSize: 18, color: '#303133', marginBottom: 20 }}>📊 个人仪表盘</h3>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((item) => (
          <div key={item.label} style={{
            background: '#fff', borderRadius: 12, padding: '20px 16px',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: item.color + '15', color: item.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#303133' }}>{item.count}</div>
              <div style={{ fontSize: 13, color: '#909399' }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* 存储空间 */}
        <Card title="存储空间" size="small" style={{ borderRadius: 12 }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Progress
              type="dashboard"
              percent={storagePercent}
              size={160}
              strokeColor={storagePercent > 90 ? '#f5222d' : storagePercent > 70 ? '#faad14' : '#1890ff'}
              format={() => (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#303133' }}>
                    {storagePercent}%
                  </div>
                  <div style={{ fontSize: 12, color: '#909399' }}>已使用</div>
                </div>
              )}
            />
            <div style={{ marginTop: 12, fontSize: 14, color: '#606266' }}>
              {formatFileSize(data.storage_used)} / {formatFileSize(data.storage_limit)}
            </div>
          </div>
        </Card>

        {/* 文件类型分布 */}
        <Card title="文件类型分布" size="small" style={{ borderRadius: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            {data.type_distribution?.map((item: any) => {
              const percent = data.storage_used > 0 ? Math.round((item.total / data.storage_used) * 100) : 0
              return (
                <div key={item.category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: (typeColors[item.category] || '#909399') + '15',
                    color: typeColors[item.category] || '#909399',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {typeIcons[item.category] || <FileOutlined />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#606266' }}>{item.category}</span>
                      <span style={{ fontSize: 12, color: '#909399' }}>
                        {item.count} 个 · {formatFileSize(item.total)}
                      </span>
                    </div>
                    <Progress
                      percent={percent}
                      size="small"
                      showInfo={false}
                      strokeColor={typeColors[item.category] || '#909399'}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* 上传趋势 */}
        <Card title="近 7 天上传趋势" size="small" style={{ borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160, padding: '16px 0' }}>
            {data.upload_trend?.map((item: any) => {
              const maxCount = Math.max(...data.upload_trend.map((t: any) => t.count), 1)
              const height = Math.max((item.count / maxCount) * 120, 4)
              return (
                <div key={item.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#606266' }}>{item.count}</span>
                  <div style={{
                    width: '100%', maxWidth: 40, height,
                    background: 'linear-gradient(180deg, #1890ff, #69c0ff)',
                    borderRadius: '6px 6px 2px 2px', transition: 'height 0.3s',
                  }} />
                  <span style={{ fontSize: 11, color: '#909399' }}>{item.date}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* 最近文件 */}
        <Card title="最近文件" size="small" style={{ borderRadius: 12 }}
          extra={<a onClick={() => navigate('/files')}>查看全部</a>}
        >
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {data.recent_files?.length === 0 ? (
              <Empty description="暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              data.recent_files?.map((file: FileItem) => (
                <div
                  key={file.id}
                  onClick={() => { setPreviewFile(file); setShowPreview(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 4px', cursor: 'pointer', borderRadius: 6,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f7fa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 24, color: getFileColor(file.name, file.is_dir) }}>📄</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="text-ellipsis" style={{ fontSize: 13, color: '#303133' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: '#c0c4cc' }}>{formatFileSize(file.size)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#c0c4cc', flexShrink: 0 }}>
                    {formatDate(file.updated_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <FilePreview open={showPreview} file={previewFile} onClose={() => setShowPreview(false)} />
    </div>
  )
}
