import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button } from 'antd'
import { FolderOpenOutlined, UserOutlined, LockOutlined, SmileOutlined } from '@ant-design/icons'
import { useUserStore } from '@/stores/user'

export default function Login() {
  const navigate = useNavigate()
  const { login, register } = useUserStore()
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      let success: boolean
      if (isRegister) {
        success = await register(values.username, values.password, values.nickname)
      } else {
        success = await login(values.username, values.password)
      }
      if (success) {
        navigate('/')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    form.resetFields()
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        width: 420, padding: '48px 40px', background: '#fff',
        borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <FolderOpenOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <h1 style={{ margin: '12px 0 4px', fontSize: 28, color: '#303133', fontWeight: 700 }}>
            Nowen File
          </h1>
          <p style={{ color: '#909399', fontSize: 14 }}>现代化文件管理系统</p>
        </div>

        {/* 表单 */}
        <Form form={form} onFinish={handleSubmit} size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 32, message: '用户名长度 3-32 位' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, max: 64, message: '密码长度 6-64 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>

          {isRegister && (
            <Form.Item name="nickname">
              <Input prefix={<SmileOutlined />} placeholder="请输入昵称（选填）" />
            </Form.Item>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {isRegister ? '注 册' : '登 录'}
            </Button>
          </Form.Item>
        </Form>

        {/* 切换登录/注册 */}
        <div style={{ textAlign: 'center', color: '#909399', fontSize: 14 }}>
          <span>{isRegister ? '已有账号？' : '没有账号？'}</span>
          <Button type="link" onClick={toggleMode}>
            {isRegister ? '去登录' : '去注册'}
          </Button>
        </div>
      </div>
    </div>
  )
}
