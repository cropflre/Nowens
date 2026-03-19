import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Input, Dropdown, Avatar, Progress, Button, Drawer, Switch, Select } from 'antd'
import {
  FolderOpenOutlined, DeleteOutlined, SearchOutlined,
  UserOutlined, LogoutOutlined, AppstoreOutlined,
  PictureOutlined, VideoCameraOutlined, AudioOutlined,
  FileTextOutlined, ShareAltOutlined, SettingOutlined,
  ApiOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DownOutlined, StarOutlined, TagsOutlined, DashboardOutlined,
  TeamOutlined, ClockCircleOutlined, CameraOutlined,
  BulbOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/stores/user'
import { useFileStore } from '@/stores/file'
import { useThemeStore } from '@/stores/theme'
import { formatFileSize } from '@/utils'
import NotificationBell from '@/components/NotificationBell'
import MobileNav from '@/components/MobileNav'
import { useTranslation } from 'react-i18next'
import type { MenuProps } from 'antd'

const { Sider, Header, Content } = AntLayout

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useUserStore()
  const { goHome } = useFileStore()
  const { isDark, setMode, mode } = useThemeStore()
  const { t, i18n } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [drawerVisible, setDrawerVisible] = useState(false)

  // 响应式检测
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const storagePercent = (() => {
    const used = user?.storage_used || 0
    const limit = user?.storage_limit || 1
    return Math.min(Math.round((used / limit) * 100), 100)
  })()

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('sidebar.dashboard'),
    },
    {
      key: '/files',
      icon: <FolderOpenOutlined />,
      label: t('sidebar.allFiles'),
    },
    {
      key: 'category',
      icon: <AppstoreOutlined />,
      label: t('sidebar.category'),
      children: [
        { key: '/category/image', icon: <PictureOutlined />, label: t('sidebar.images') },
        { key: '/category/video', icon: <VideoCameraOutlined />, label: t('sidebar.videos') },
        { key: '/category/audio', icon: <AudioOutlined />, label: t('sidebar.audios') },
        { key: '/category/document', icon: <FileTextOutlined />, label: t('sidebar.documents') },
      ],
    },
    {
      key: '/gallery',
      icon: <CameraOutlined />,
      label: t('sidebar.gallery'),
    },
    {
      key: '/favorites',
      icon: <StarOutlined />,
      label: t('sidebar.favorites'),
    },
    {
      key: '/tags',
      icon: <TagsOutlined />,
      label: t('sidebar.tags'),
    },
    {
      key: '/workspaces',
      icon: <TeamOutlined />,
      label: t('sidebar.workspaces'),
    },
    {
      key: '/shares',
      icon: <ShareAltOutlined />,
      label: t('sidebar.shares'),
    },
    {
      key: '/mounts',
      icon: <ApiOutlined />,
      label: t('sidebar.mounts'),
    },
    {
      key: '/activities',
      icon: <ClockCircleOutlined />,
      label: t('sidebar.activities'),
    },
    {
      key: '/trash',
      icon: <DeleteOutlined />,
      label: t('sidebar.trash'),
    },
    ...(user?.role === 'admin'
      ? [{ key: '/admin', icon: <SettingOutlined />, label: t('sidebar.admin') }]
      : []),
  ]

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: t('auth.profile') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: t('auth.logout'), danger: true },
  ]

  const handleMenuClick = (info: { key: string }) => {
    navigate(info.key)
    // 移动端点击菜单后自动关闭侧边栏
    if (isMobile) setDrawerVisible(false)
  }

  const handleSearch = () => {
    if (searchKeyword.trim()) {
      navigate(`/files?search=${encodeURIComponent(searchKeyword)}`)
    }
  }

  const handleUserMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout()
    }
  }

  // 根据当前路径获取选中菜单
  const selectedKeys = [location.pathname]

  return (
    <AntLayout style={{ height: '100vh' }}>
      {/* 移动端侧边栏用 Drawer 抽屉模式 */}
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          width={220}
          styles={{ body: { padding: 0, background: '#1e1e2d' } }}
          closable={false}
        >
          <div
            onClick={() => { goHome(); navigate('/files'); setDrawerVisible(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '20px 18px', cursor: 'pointer',
            }}
          >
            <FolderOpenOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              Nowen File
            </span>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ background: 'transparent', borderRight: 'none', flex: 1 }}
          />
          <div style={{
            padding: 16, margin: '0 8px 8px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 8,
          }}>
            <Progress
              percent={storagePercent}
              size="small"
              showInfo={false}
              strokeColor={storagePercent > 90 ? '#f5222d' : '#1890ff'}
            />
            <div style={{ fontSize: 12, color: '#a2a3b7', marginTop: 8, textAlign: 'center' }}>
              {formatFileSize(user?.storage_used || 0)} / {formatFileSize(user?.storage_limit || 0)}
            </div>
          </div>
        </Drawer>
      ) : (
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        theme="dark"
        style={{ background: '#1e1e2d' }}
      >
        {/* Logo */}
        <div
          onClick={() => { goHome(); navigate('/files') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '20px 18px', cursor: 'pointer',
          }}
        >
          <FolderOpenOutlined style={{ fontSize: 28, color: '#1890ff' }} />
          {!collapsed && (
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              Nowen File
            </span>
          )}
        </div>

        {/* 导航菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ background: 'transparent', borderRight: 'none', flex: 1 }}
        />

        {/* 存储空间 */}
        {!collapsed && (
          <div style={{
            padding: 16, margin: '0 8px 8px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 8,
          }}>
            <Progress
              percent={storagePercent}
              size="small"
              showInfo={false}
              strokeColor={storagePercent > 90 ? '#f5222d' : '#1890ff'}
            />
            <div style={{ fontSize: 12, color: '#a2a3b7', marginTop: 8, textAlign: 'center' }}>
              {formatFileSize(user?.storage_used || 0)} / {formatFileSize(user?.storage_limit || 0)}
            </div>
          </div>
        )}

        {/* 折叠按钮 */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: 12, textAlign: 'center', cursor: 'pointer',
            color: '#a2a3b7', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </Sider>
      )}

      <AntLayout>
        {/* 顶部栏 */}
        <Header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60, padding: '0 24px', background: '#fff',
          borderBottom: '1px solid #ebeef5', lineHeight: 'normal',
        }}>
          <Input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder={t('files.searchPlaceholder')}
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: isMobile ? 160 : 320 }}
            onPressEnter={handleSearch}
            onClear={() => { setSearchKeyword(''); navigate('/files') }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            {isMobile && (
              <Button type="text" icon={<MenuUnfoldOutlined />} onClick={() => setDrawerVisible(true)} />
            )}

            {/* 语言切换 */}
            <Select
              value={i18n.language}
              onChange={(lang) => { i18n.changeLanguage(lang); localStorage.setItem('language', lang) }}
              size="small"
              style={{ width: 80 }}
              variant="borderless"
              options={[
                { value: 'zh-CN', label: '中文' },
                { value: 'en-US', label: 'EN' },
              ]}
            />

            {/* 主题切换 */}
            <Button
              type="text"
              icon={<BulbOutlined />}
              onClick={() => setMode(isDark ? 'light' : 'dark')}
              title={isDark ? t('theme.light') : t('theme.dark')}
              style={{ color: isDark ? '#faad14' : '#606266' }}
            />

            <NotificationBell />
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar size={32} src={user?.avatar}>
                {user?.nickname?.charAt(0) || 'U'}
              </Avatar>
              <span style={{ fontSize: 14, color: '#303133' }}>
                {user?.nickname || user?.username}
              </span>
              <DownOutlined style={{ fontSize: 12 }} />
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 页面内容 */}
        <Content style={{ background: '#f5f7fa', overflow: 'auto', padding: isMobile ? '12px 12px 72px' : 24 }}>
          <Outlet />
        </Content>

        {/* 移动端底部导航栏 */}
        {isMobile && <MobileNav />}
      </AntLayout>
    </AntLayout>
  )
}
