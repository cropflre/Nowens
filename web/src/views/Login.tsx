import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Modal } from 'antd'
import { FolderOpenOutlined, UserOutlined, LockOutlined, SmileOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useUserStore } from '@/stores/user'

export default function Login() {
  const navigate = useNavigate()
  const { login, register } = useUserStore()
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [mfaModalOpen, setMfaModalOpen] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [pendingCredentials, setPendingCredentials] = useState<{ username: string; password: string } | null>(null)

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      let success: boolean | 'mfa_required'
      if (isRegister) {
        success = await register(values.username, values.password, values.nickname)
      } else {
        success = await login(values.username, values.password)
      }
      if (success === 'mfa_required') {
        // 需要 MFA 验证码
        setPendingCredentials({ username: values.username, password: values.password })
        setMfaModalOpen(true)
        setMfaCode('')
      } else if (success === true) {
        navigate('/')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleMFASubmit = async () => {
    if (!pendingCredentials || mfaCode.length !== 6) return
    setLoading(true)
    try {
      const success = await login(pendingCredentials.username, pendingCredentials.password, mfaCode)
      if (success === true) {
        setMfaModalOpen(false)
        setPendingCredentials(null)
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

      {/* MFA 验证码弹窗 */}
      <Modal
        title={
          <span><SafetyCertificateOutlined /> 多因素认证验证</span>
        }
        open={mfaModalOpen}
        onOk={handleMFASubmit}
        onCancel={() => { setMfaModalOpen(false); setPendingCredentials(null) }}
        okText="验证"
        cancelText="取消"
        confirmLoading={loading}
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          您的账号已启用多因素认证，请输入认证器 App 上显示的 6 位验证码：
        </p>
        <Input
          placeholder="000000"
          maxLength={6}
          value={mfaCode}
          onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
          style={{ fontSize: 24, textAlign: 'center', letterSpacing: 8 }}
          onPressEnter={handleMFASubmit}
          autoFocus
        />
      </Modal>
    </div>
  )
}
