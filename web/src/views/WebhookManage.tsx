import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, message, Form, Input, Select, Switch, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, SendOutlined, ApiOutlined } from '@ant-design/icons'
import type { WebhookConfig } from '@/types'
import { listWebhooks, createWebhook, updateWebhook, deleteWebhook, testWebhook } from '@/api/webhook'

const eventOptions = [
  { label: '上传', value: 'upload' },
  { label: '下载', value: 'download' },
  { label: '删除', value: 'delete' },
  { label: '分享', value: 'share' },
  { label: '回收站', value: 'trash' },
  { label: '恢复', value: 'restore' },
  { label: '重命名', value: 'rename' },
  { label: '移动', value: 'move' },
  { label: '加密', value: 'encrypt' },
]

const platformOptions = [
  { label: '自定义', value: 'custom' },
  { label: '企业微信', value: 'wechat_work' },
  { label: '钉钉', value: 'dingtalk' },
  { label: 'Slack', value: 'slack' },
  { label: '飞书', value: 'feishu' },
]

export default function WebhookManage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WebhookConfig | null>(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await listWebhooks()
      if (res.code === 0 && res.data) {
        setWebhooks(res.data)
      }
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async () => {
    const values = await form.validateFields()
    const data = {
      ...values,
      events: values.events.join(','),
    }

    try {
      if (editing) {
        await updateWebhook(editing.id, data)
        message.success('更新成功')
      } else {
        await createWebhook(data)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      setEditing(null)
      loadData()
    } catch {
      message.error('操作失败')
    }
  }

  const handleEdit = (record: WebhookConfig) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      events: record.events.split(','),
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteWebhook(id)
      message.success('删除成功')
      loadData()
    } catch {
      message.error('删除失败')
    }
  }

  const handleTest = async (id: number) => {
    try {
      await testWebhook(id)
      message.success('测试消息已发送')
    } catch {
      message.error('测试失败')
    }
  }

  const handleToggle = async (record: WebhookConfig) => {
    try {
      await updateWebhook(record.id, { enabled: !record.enabled })
      loadData()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (v: string) => {
        const p = platformOptions.find(o => o.value === v)
        return <Tag color="blue">{p?.label || v}</Tag>
      },
    },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      width: 200,
      render: (v: string) =>
        v.split(',').map(e => {
          const ev = eventOptions.find(o => o.value === e.trim())
          return <Tag key={e} color="cyan" style={{ marginBottom: 2 }}>{ev?.label || e}</Tag>
        }),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean, record: WebhookConfig) => (
        <Switch size="small" checked={v} onChange={() => handleToggle(record)} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: WebhookConfig) => (
        <Space>
          <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleTest(record.id)}>
            测试
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>
        <ApiOutlined /> Webhook 通知管理
      </h2>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null)
            form.resetFields()
            setModalOpen(true)
          }}
        >
          添加 Webhook
        </Button>
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={webhooks}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? '编辑 Webhook' : '添加 Webhook'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null) }}
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={{ platform: 'custom', events: ['upload'] }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：企业微信通知" />
          </Form.Item>
          <Form.Item name="url" label="Webhook URL" rules={[{ required: true, message: '请输入 URL' }]}>
            <Input placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
          </Form.Item>
          <Form.Item name="platform" label="平台类型">
            <Select options={platformOptions} />
          </Form.Item>
          <Form.Item name="events" label="监听事件" rules={[{ required: true, message: '请选择事件' }]}>
            <Select mode="multiple" options={eventOptions} placeholder="选择要监听的事件" />
          </Form.Item>
          <Form.Item name="secret" label="签名密钥（可选）">
            <Input.Password placeholder="用于 HMAC-SHA256 签名验证" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
