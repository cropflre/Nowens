import { useState, useEffect } from 'react'
import { Spin, Empty, Pagination, Tag } from 'antd'
import {
  UploadOutlined, DownloadOutlined, DeleteOutlined, ShareAltOutlined,
  EditOutlined, DragOutlined, CopyOutlined, MessageOutlined,
  LockOutlined, UnlockOutlined, UndoOutlined, FolderAddOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { listActivities, type Activity } from '@/api/activity'
import { formatDate } from '@/utils'
import { useTranslation } from 'react-i18next'

// 操作图标和颜色映射
const actionConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  upload:        { icon: <UploadOutlined />, color: '#52c41a' },
  download:      { icon: <DownloadOutlined />, color: '#1890ff' },
  delete:        { icon: <DeleteOutlined />, color: '#f5222d' },
  share:         { icon: <ShareAltOutlined />, color: '#722ed1' },
  rename:        { icon: <EditOutlined />, color: '#fa8c16' },
  move:          { icon: <DragOutlined />, color: '#13c2c2' },
  copy:          { icon: <CopyOutlined />, color: '#2f54eb' },
  comment:       { icon: <MessageOutlined />, color: '#eb2f96' },
  encrypt:       { icon: <LockOutlined />, color: '#f5222d' },
  decrypt:       { icon: <UnlockOutlined />, color: '#52c41a' },
  restore:       { icon: <UndoOutlined />, color: '#faad14' },
  create_folder: { icon: <FolderAddOutlined />, color: '#1890ff' },
}

export default function Activities() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    loadActivities()
  }, [page])

  const loadActivities = async () => {
    setLoading(true)
    try {
      const res = await listActivities(page, pageSize)
      setActivities(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch {}
    setLoading(false)
  }

  const getActionLabel = (action: string) => {
    const key = `activity.${action}` as any
    const label = t(key)
    // 如果没有翻译，返回原始 action
    return label === key ? action : label
  }

  return (
    <div>
      <h3 style={{ fontSize: 18, color: '#303133', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClockCircleOutlined /> {t('activity.title')}
      </h3>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      ) : activities.length === 0 ? (
        <Empty description={t('common.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div>
          {/* 时间线 */}
          <div style={{ position: 'relative', paddingLeft: 32 }}>
            {/* 时间线竖线 */}
            <div style={{
              position: 'absolute', left: 11, top: 0, bottom: 0,
              width: 2, background: '#e8e8e8',
            }} />

            {activities.map((activity) => {
              const config = actionConfig[activity.action] || { icon: <ClockCircleOutlined />, color: '#909399' }
              return (
                <div key={activity.id} style={{ position: 'relative', marginBottom: 20 }}>
                  {/* 时间线圆点 */}
                  <div style={{
                    position: 'absolute', left: -28, top: 4,
                    width: 24, height: 24, borderRadius: '50%',
                    background: config.color + '15', color: config.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, border: `2px solid ${config.color}`,
                  }}>
                    {config.icon}
                  </div>

                  {/* 内容卡片 */}
                  <div style={{
                    background: '#fff', borderRadius: 8, padding: '12px 16px',
                    border: '1px solid #f0f0f0',
                    transition: 'box-shadow 0.2s',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag color={config.color} style={{ margin: 0 }}>
                        {getActionLabel(activity.action)}
                      </Tag>
                      {activity.target_name && (
                        <span style={{ fontSize: 14, color: '#303133', fontWeight: 500 }}>
                          {activity.target_name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {activity.detail && (
                        <span style={{ fontSize: 12, color: '#909399' }}>{activity.detail}</span>
                      )}
                      <span style={{ fontSize: 12, color: '#c0c4cc', flexShrink: 0, marginLeft: 'auto' }}>
                        {formatDate(activity.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 分页 */}
          {total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                total={total}
                pageSize={pageSize}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
