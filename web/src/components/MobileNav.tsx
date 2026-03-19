import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, FolderOpenOutlined, CameraOutlined,
  UserOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

/**
 * 移动端底部导航栏 — 仅在移动端显示
 * 提供 5 个核心页面的快速切换
 */
export default function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const items = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: t('sidebar.dashboard') },
    { key: '/files', icon: <FolderOpenOutlined />, label: t('sidebar.allFiles') },
    { key: '/gallery', icon: <CameraOutlined />, label: t('sidebar.gallery') },
    { key: '/category/image', icon: <AppstoreOutlined />, label: t('sidebar.category') },
    { key: '/activities', icon: <UserOutlined />, label: t('sidebar.activities') },
  ]

  const isActive = (key: string) => {
    if (key === '/files') return location.pathname === '/files'
    return location.pathname.startsWith(key)
  }

  return (
    <div className="mobile-bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      background: 'var(--bg-card, #fff)',
      borderTop: '1px solid var(--border-color, #ebeef5)',
      zIndex: 1000,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map((item) => {
        const active = isActive(item.key)
        return (
          <div
            key={item.key}
            onClick={() => navigate(item.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, cursor: 'pointer',
              color: active ? '#1890ff' : 'var(--text-muted, #909399)',
              fontSize: 10, gap: 2, transition: 'color 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
