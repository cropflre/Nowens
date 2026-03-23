import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useUserStore } from '@/stores/user'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/views/Layout'
import Login from '@/views/Login'
import Files from '@/views/Files'
import Category from '@/views/Category'
import Trash from '@/views/Trash'
import MyShares from '@/views/MyShares'
import ShareView from '@/views/ShareView'
import Admin from '@/views/Admin'
import Mounts from '@/views/Mounts'
import MountBrowse from '@/views/MountBrowse'
import Favorites from '@/views/Favorites'
import Tags from '@/views/Tags'
import Dashboard from '@/views/Dashboard'
import FileEditor from '@/views/FileEditor'
import Workspaces from '@/views/Workspaces'
import Gallery from '@/views/Gallery'
import Activities from '@/views/Activities'
import DedupDashboard from '@/views/DedupDashboard'
import WebhookManage from '@/views/WebhookManage'
import MFASetting from '@/views/MFASetting'

// 导入 i18n 配置
import '@/i18n'

// 路由守卫组件
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { token, fetchProfile } = useUserStore()

  useEffect(() => {
    if (token) {
      fetchProfile()
    }
  }, [])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/share/:code" element={<ShareView />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="files" element={<Files />} />
          <Route path="category/:type" element={<Category />} />
          <Route path="trash" element={<Trash />} />
          <Route path="shares" element={<MyShares />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="tags" element={<Tags />} />
          <Route path="workspaces" element={<Workspaces />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="activities" element={<Activities />} />
          <Route path="dedup" element={<DedupDashboard />} />
          <Route path="webhooks" element={<WebhookManage />} />
          <Route path="mfa" element={<MFASetting />} />
          <Route path="mounts" element={<Mounts />} />
          <Route path="mounts/:id/browse" element={<MountBrowse />} />
          <Route path="editor" element={<FileEditor />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
