import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useUserStore } from '@/stores/user'
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
        <Route index element={<Navigate to="/files" replace />} />
        <Route path="files" element={<Files />} />
        <Route path="category/:type" element={<Category />} />
        <Route path="trash" element={<Trash />} />
        <Route path="shares" element={<MyShares />} />
        <Route path="mounts" element={<Mounts />} />
        <Route path="mounts/:id/browse" element={<MountBrowse />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  )
}
