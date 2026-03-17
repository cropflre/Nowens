import { useState, useEffect } from 'react'
import {
  Tabs, Table, Tag, Button, Space, Progress, Select, Pagination,
  Modal, Form, Input, message, Card,
} from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { User, AdminDashboard, AuditLog } from '@/types'
import { getDashboard, getUsers, updateUser, deleteUser, resetPassword, getAuditLogs } from '@/api/admin'
import { formatFileSize, formatDate } from '@/utils'

export default function Admin() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logPage, setLogPage] = useState(1)
  const [logTotal, setLogTotal] = useState(0)
  const [logAction, setLogAction] = useState<string>('')
  const [showEdit, setShowEdit] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm] = Form.useForm()

  useEffect(() => {
    loadDashboard()
    loadUsers()
    loadLogs()
  }, [])

  const loadDashboard = async () => {
    try {
      const res = await getDashboard()
      setDashboard(res.data!)
    } catch {}
  }

  const loadUsers = async (page = userPage) => {
    try {
      const res = await getUsers(page)
      setUsers(res.data!.list || [])
      setUserTotal(res.data!.total)
    } catch {}
  }

  const loadLogs = async (page = logPage, action = logAction) => {
    try {
      const res = await getAuditLogs(page, 20, undefined, action)
      setLogs(res.data!.list || [])
      setLogTotal(res.data!.total)
    } catch {}
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    editForm.setFieldsValue({
      nickname: user.nickname,
      role: user.role,
      storage_limit: user.storage_limit,
    })
    setShowEdit(true)
  }

  const submitEditUser = async () => {
    if (!editingUser) return
    const values = editForm.getFieldsValue()
    try {
      await updateUser(editingUser.id, values)
      message.success('更新成功')
      setShowEdit(false)
      loadUsers()
    } catch {}
  }

  const handleResetPwd = (user: User) => {
    let pwd = ''
    Modal.confirm({
      title: `重置用户「${user.username}」的密码`,
      content: (
        <Input.Password
          placeholder="请输入新密码（至少6位）"
          onChange={(e) => { pwd = e.target.value }}
        />
      ),
      onOk: async () => {
        if (!pwd || pwd.length < 6) {
          message.warning('密码不能少于6位')
          return Promise.reject()
        }
        await resetPassword(user.id, pwd)
        message.success('密码已重置')
      },
    })
  }

  const handleDeleteUser = (user: User) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除用户「${user.username}」吗？此操作不可恢复`,
      okType: 'danger',
      onOk: async () => {
        await deleteUser(user.id)
        message.success('用户已删除')
        loadUsers()
      },
    })
  }

  const statCards = dashboard
    ? [
        { label: '用户数', value: dashboard.user_count, bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { label: '文件数', value: dashboard.file_count, bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        { label: '文件夹数', value: dashboard.folder_count, bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
        { label: '分享数', value: dashboard.share_count, bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
        { label: '总存储使用', value: formatFileSize(dashboard.total_storage), bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
        { label: '今日上传', value: dashboard.today_uploads, bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
      ]
    : []

  const userColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '用户名', dataIndex: 'username', key: 'username', width: 140 },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 140 },
    {
      title: '角色', key: 'role', width: 100,
      render: (_: any, r: User) => (
        <Tag color={r.role === 'admin' ? 'red' : 'default'}>{r.role === 'admin' ? '管理员' : '用户'}</Tag>
      ),
    },
    {
      title: '存储使用', key: 'storage', width: 200,
      render: (_: any, r: User) => (
        <div>
          <Progress percent={Math.round((r.storage_used / r.storage_limit) * 100)} size="small" showInfo={false} />
          <span style={{ fontSize: 12, color: '#909399' }}>{formatFileSize(r.storage_used)} / {formatFileSize(r.storage_limit)}</span>
        </div>
      ),
    },
    {
      title: '注册时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (val: string) => formatDate(val),
    },
    {
      title: '操作', key: 'actions', width: 260,
      render: (_: any, r: User) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEditUser(r)}>编辑</Button>
          <Button type="link" size="small" style={{ color: '#faad14' }} onClick={() => handleResetPwd(r)}>重置密码</Button>
          <Button type="link" size="small" danger disabled={r.role === 'admin'} onClick={() => handleDeleteUser(r)}>删除</Button>
        </Space>
      ),
    },
  ]

  const logColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '用户', dataIndex: 'username', key: 'username', width: 120 },
    {
      title: '操作', dataIndex: 'action', key: 'action', width: 120,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    { title: '资源', dataIndex: 'resource', key: 'resource', width: 80 },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (val: string) => formatDate(val),
    },
  ]

  const tabItems = [
    {
      key: 'dashboard',
      label: '系统概览',
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, padding: '12px 0' }}>
          {statCards.map((card, i) => (
            <div key={i} style={{
              background: card.bg, borderRadius: 12, padding: '24px 20px',
              color: '#fff', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{card.value}</div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>{card.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'users',
      label: '用户管理',
      children: (
        <div>
          <Table dataSource={users} columns={userColumns} rowKey="id" pagination={false} />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              current={userPage}
              pageSize={20}
              total={userTotal}
              showTotal={(total) => `共 ${total} 条`}
              onChange={(page) => { setUserPage(page); loadUsers(page) }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'logs',
      label: '审计日志',
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Select
              value={logAction}
              onChange={(val) => { setLogAction(val); loadLogs(1, val) }}
              placeholder="操作类型"
              allowClear
              style={{ width: 160 }}
              options={[
                { value: 'login', label: '登录' },
                { value: 'upload', label: '上传' },
                { value: 'download', label: '下载' },
                { value: 'delete', label: '删除' },
                { value: 'share', label: '分享' },
                { value: 'admin_update', label: '管理员操作' },
              ]}
            />
          </div>
          <Table dataSource={logs} columns={logColumns} rowKey="id" pagination={false} />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              current={logPage}
              pageSize={20}
              total={logTotal}
              showTotal={(total) => `共 ${total} 条`}
              onChange={(page) => { setLogPage(page); loadLogs(page) }}
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#303133', display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined /> 管理员后台
        </h2>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 编辑用户弹窗 */}
      <Modal
        title="编辑用户"
        open={showEdit}
        onOk={submitEditUser}
        onCancel={() => setShowEdit(false)}
        width={460}
      >
        {editingUser && (
          <Form form={editForm} labelCol={{ span: 6 }}>
            <Form.Item label="用户名">
              <Input value={editingUser.username} disabled />
            </Form.Item>
            <Form.Item name="nickname" label="昵称">
              <Input />
            </Form.Item>
            <Form.Item name="role" label="角色">
              <Select
                options={[
                  { value: 'user', label: '普通用户' },
                  { value: 'admin', label: '管理员' },
                ]}
              />
            </Form.Item>
            <Form.Item name="storage_limit" label="存储限额">
              <Select
                options={[
                  { value: 1073741824, label: '1 GB' },
                  { value: 5368709120, label: '5 GB' },
                  { value: 10737418240, label: '10 GB' },
                  { value: 53687091200, label: '50 GB' },
                  { value: 107374182400, label: '100 GB' },
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
