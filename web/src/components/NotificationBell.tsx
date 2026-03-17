import { useState, useEffect, useCallback } from 'react'
import { Badge, Popover, Button, List, Empty, Spin, Tabs, message } from 'antd'
import {
  BellOutlined, CheckOutlined, DeleteOutlined,
  ClearOutlined, EyeOutlined,
} from '@ant-design/icons'
import type { Notification } from '@/types'
import {
  getNotifications, getUnreadCount, markAsRead,
  markAllAsRead, deleteNotification,
} from '@/api/notification'
import { formatDate } from '@/utils'

const typeLabels: Record<string, { label: string; color: string }> = {
  share_viewed: { label: '分享', color: '#1890ff' },
  storage_warning: { label: '存储', color: '#faad14' },
  scan_complete: { label: '扫描', color: '#52c41a' },
  system: { label: '系统', color: '#909399' },
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  // 定时刷新未读数量
  useEffect(() => {
    loadUnreadCount()
    const timer = setInterval(loadUnreadCount, 30000) // 30秒刷新一次
    return () => clearInterval(timer)
  }, [])

  // 打开面板时加载通知列表
  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open, activeTab])

  const loadUnreadCount = async () => {
    try {
      const res = await getUnreadCount()
      setUnreadCount(res.data?.count || 0)
    } catch {}
  }

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const res = await getNotifications({
        page: 1,
        page_size: 20,
        unread: activeTab === 'unread',
      })
      setNotifications(res.data?.list || [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (id: number) => {
    try {
      await markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {}
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      message.success('已全部标记为已读')
    } catch {}
  }

  const handleDelete = async (id: number) => {
    try {
      const notification = notifications.find((n) => n.id === id)
      await deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch {}
  }

  const content = (
    <div style={{ width: 380 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 4px', marginBottom: 8,
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          style={{ marginBottom: 0 }}
          items={[
            { key: 'all', label: '全部' },
            { key: 'unread', label: `未读 (${unreadCount})` },
          ]}
        />
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            全部已读
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : notifications.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '20px 0' }} />
      ) : (
        <List
          dataSource={notifications}
          style={{ maxHeight: 400, overflowY: 'auto' }}
          renderItem={(item) => {
            const typeInfo = typeLabels[item.type] || typeLabels.system
            return (
              <List.Item
                style={{
                  padding: '10px 8px',
                  background: item.is_read ? 'transparent' : '#f6ffed',
                  borderRadius: 6,
                  marginBottom: 4,
                }}
                actions={[
                  !item.is_read && (
                    <Button
                      key="read"
                      type="text" size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleMarkRead(item.id)}
                    />
                  ),
                  <Button
                    key="delete"
                    type="text" size="small" danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(item.id)}
                  />,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!item.is_read && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#1890ff', flexShrink: 0,
                        }} />
                      )}
                      <span style={{
                        fontSize: 13, fontWeight: item.is_read ? 400 : 500,
                        color: '#303133',
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        background: typeInfo.color + '20', color: typeInfo.color,
                        flexShrink: 0,
                      }}>
                        {typeInfo.label}
                      </span>
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: 12, color: '#909399', marginTop: 2 }}>
                        {item.content}
                      </div>
                      <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 4 }}>
                        {formatDate(item.created_at)}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{ fontSize: 18, display: 'flex', alignItems: 'center' }}
        />
      </Badge>
    </Popover>
  )
}
