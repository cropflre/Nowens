import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Input, Dropdown, Avatar, Progress, Button, Drawer } from 'antd'
import {
  FolderOpenOutlined, DeleteOutlined, SearchOutlined,
  UserOutlined, LogoutOutlined, AppstoreOutlined,
  PictureOutlined, VideoCameraOutlined, AudioOutlined,
  FileTextOutlined, ShareAltOutlined, SettingOutlined,
  ApiOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DownOutlined, StarOutlined, TagsOutlined, DashboardOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/stores/user'
import { useFileStore } from '@/stores/file'
import { formatFileSize } from '@/utils'
import NotificationBell from '@/components/NotificationBell'
import type { MenuProps } from 'antd'

const { Sider, Header, Content } = AntLayout

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useUserStore()
  const { goHome } = useFileStore()
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
      label: '仪表盘',
    },
    {
      key: '/files',
      icon: <FolderOpenOutlined />,
      label: '全部文件',
    },
    {
      key: 'category',
      icon: <AppstoreOutlined />,
      label: '文件分类',
      children: [
        { key: '/category/image', icon: <PictureOutlined />, label: '图片' },
        { key: '/category/video', icon: <VideoCameraOutlined />, label: '视频' },
        { key: '/category/audio', icon: <AudioOutlined />, label: '音频' },
        { key: '/category/document', icon: <FileTextOutlined />, label: '文档' },
      ],
    },
    {
      key: '/favorites',
      icon: <StarOutlined />,
      label: '我的收藏',
    },
    {
      key: '/tags',
      icon: <TagsOutlined />,
      label: '标签管理',
    },
    {
      key: '/workspaces',
      icon: <TeamOutlined />,
      label: '协作空间',
    },
    {
      key: '/shares',
      icon: <ShareAltOutlined />,
      label: '我的分享',
    },
    {
      key: '/mounts',
      icon: <ApiOutlined />,
      label: '数据源',
    },
    {
      key: '/trash',
      icon: <DeleteOutlined />,
      label: '回收站',
    },
    ...(user?.role === 'admin'
      ? [{ key: '/admin', icon: <SettingOutlined />, label: '管理后台' }]
      : []),
  ]

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: '个人资料' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
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
            placeholder="搜索文件..."
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
        <Content style={{ background: '#f5f7fa', overflow: 'auto', padding: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
