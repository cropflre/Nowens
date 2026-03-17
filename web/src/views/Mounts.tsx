import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Empty, Tag, Modal, Form, Input, Select, Dropdown, Spin, message,
} from 'antd'
import {
  PlusOutlined, MoreOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, LoadingOutlined,
  FolderOpenOutlined, ApiOutlined, DesktopOutlined, RobotOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { listMounts, createMount, updateMount, deleteMount, scanMount } from '@/api/mount'
import { getScheduleByMount, createSyncSchedule, updateSyncSchedule, deleteSyncSchedule } from '@/api/dashboard'
import { formatFileSize, formatDate } from '@/utils'
import type { MountPoint } from '@/types'

export default function Mounts() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [mounts, setMounts] = useState<MountPoint[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingMount, setEditingMount] = useState<MountPoint | null>(null)
  const [form] = Form.useForm()

  // 定时同步状态
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleMount, setScheduleMount] = useState<MountPoint | null>(null)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const [cronExpr, setCronExpr] = useState('0 */6 * * *')
  const [scheduleEnabled, setScheduleEnabled] = useState(true)
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  useEffect(() => { loadMounts() }, [])

  const loadMounts = async () => {
    setLoading(true)
    try {
      const res = await listMounts()
      setMounts(res.data || [])
    } catch {} finally { setLoading(false) }
  }

  const getMountTypeLabel = (type: string) => {
    const map: Record<string, string> = { local: '本地目录', smb: 'SMB 共享', nfs: 'NFS 挂载', agent: '远程 Agent' }
    return map[type] || type
  }

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      online: { color: 'success', label: '在线' },
      offline: { color: 'default', label: '未同步' },
      syncing: { color: 'warning', label: '扫描中...' },
      error: { color: 'error', label: '异常' },
    }
    const info = map[status] || { color: 'default', label: status }
    return <Tag color={info.color}>{status === 'syncing' && <LoadingOutlined style={{ marginRight: 4 }} />}{info.label}</Tag>
  }

  const getMountIconBg = (type: string) => {
    const map: Record<string, string> = {
      local: 'linear-gradient(135deg, #1890ff, #69c0ff)',
      smb: 'linear-gradient(135deg, #52c41a, #95de64)',
      nfs: 'linear-gradient(135deg, #faad14, #ffc53d)',
      agent: 'linear-gradient(135deg, #722ed1, #b37feb)',
    }
    return map[type] || map.local
  }

  const submitForm = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      if (editingMount) {
        await updateMount(editingMount.id, values)
        message.success('更新成功')
      } else {
        const res = await createMount(values)
        message.success('创建成功，开始扫描...')
        if (res.data?.id) scanMount(res.data.id)
      }
      setShowDialog(false)
      form.resetFields()
      setEditingMount(null)
      loadMounts()
    } catch {} finally { setSubmitting(false) }
  }

  const browseMount = (mount: MountPoint) => {
    if (mount.status === 'offline') {
      message.warning('请先扫描该数据源')
      return
    }
    navigate(`/mounts/${mount.id}/browse`)
  }

  const handleCommand = async (key: string, mount: MountPoint) => {
    if (key === 'scan') {
      await scanMount(mount.id)
      message.success('开始扫描，请稍后刷新查看')
      setTimeout(() => loadMounts(), 3000)
    } else if (key === 'edit') {
      setEditingMount(mount)
      form.setFieldsValue({
        name: mount.name,
        type: mount.type,
        base_path: mount.base_path,
        smb_user: mount.smb_user || '',
        smb_pass: '',
      })
      setShowDialog(true)
    } else if (key === 'schedule') {
      setScheduleMount(mount)
      setShowSchedule(true)
      try {
        const res = await getScheduleByMount(mount.id)
        if (res.data) {
          setScheduleData(res.data)
          setCronExpr(res.data.cron_expr)
          setScheduleEnabled(res.data.enabled)
        } else {
          setScheduleData(null)
          setCronExpr('0 */6 * * *')
          setScheduleEnabled(true)
        }
      } catch {
        setScheduleData(null)
      }
    } else if (key === 'delete') {
      Modal.confirm({
        title: '删除确认',
        content: `确定删除数据源「${mount.name}」吗？所有索引文件记录将被清除（不会删除原始文件）`,
        okType: 'danger',
        onOk: async () => {
          await deleteMount(mount.id)
          message.success('删除成功')
          loadMounts()
        },
      })
    }
  }

  return (
    <div style={{ padding: 4 }}>
      {/* 页面标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#303133' }}>数据源管理</h2>
        <p style={{ flex: 1, margin: 0, fontSize: 14, color: '#909399' }}>
          映射 Windows、Linux 或 NAS 上的文件目录进行统一管理
        </p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingMount(null); form.resetFields(); setShowDialog(true) }}>
          添加数据源
        </Button>
      </div>

      {/* 数据源卡片列表 */}
      <Spin spinning={loading}>
        {mounts.length === 0 && !loading ? (
          <div style={{ padding: '60px 0' }}>
            <Empty description="暂无数据源">
              <Button type="primary" onClick={() => setShowDialog(true)}>添加第一个数据源</Button>
            </Empty>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {mounts.map((mount) => (
              <div
                key={mount.id}
                onClick={() => browseMount(mount)}
                style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #ebeef5',
                  padding: 20, cursor: 'pointer', transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#1890ff'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#ebeef5'
                }}
              >
                {/* 卡片头部 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#fff',
                    background: getMountIconBg(mount.type), flexShrink: 0,
                  }}>
                    <FolderOpenOutlined style={{ fontSize: 24 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mount.name}
                    </h3>
                    <span style={{ fontSize: 12, color: '#909399' }}>{getMountTypeLabel(mount.type)}</span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'scan', icon: <ReloadOutlined />, label: '重新扫描' },
                          { key: 'schedule', icon: <ClockCircleOutlined />, label: '定时同步' },
                          { key: 'edit', icon: <EditOutlined />, label: '编辑' },
                          { type: 'divider' },
                          { key: 'delete', icon: <DeleteOutlined style={{ color: '#f5222d' }} />, label: <span style={{ color: '#f5222d' }}>删除</span> },
                        ],
                        onClick: ({ key }) => handleCommand(key, mount),
                      }}
                      trigger={['click']}
                    >
                      <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                  </div>
                </div>

                {/* 卡片内容 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#909399', width: 45, flexShrink: 0 }}>路径</span>
                    <span style={{ color: '#606266', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }} title={mount.base_path}>
                      {mount.base_path}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#909399', width: 45, flexShrink: 0 }}>状态</span>
                    {getStatusTag(mount.status)}
                  </div>
                  {mount.sync_msg && (
                    <div style={{ display: 'flex', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: '#909399', width: 45, flexShrink: 0 }}>信息</span>
                      <span style={{ fontSize: 12, color: '#909399', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mount.sync_msg}
                      </span>
                    </div>
                  )}
                </div>

                {/* 卡片底部统计 */}
                <div style={{ display: 'flex', gap: 16, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#303133' }}>{mount.file_count}</span>
                    <span style={{ fontSize: 11, color: '#c0c4cc', marginTop: 2 }}>文件</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#303133' }}>{mount.dir_count}</span>
                    <span style={{ fontSize: 11, color: '#c0c4cc', marginTop: 2 }}>目录</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#303133' }}>{formatFileSize(mount.total_size)}</span>
                    <span style={{ fontSize: 11, color: '#c0c4cc', marginTop: 2 }}>总大小</span>
                  </div>
                  {mount.last_sync && mount.last_sync !== '0001-01-01T00:00:00Z' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#303133' }}>{formatDate(mount.last_sync)}</span>
                      <span style={{ fontSize: 11, color: '#c0c4cc', marginTop: 2 }}>最近同步</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Spin>

      {/* 添加/编辑数据源对话框 */}
      <Modal
        title={editingMount ? '编辑数据源' : '添加数据源'}
        open={showDialog}
        onOk={submitForm}
        onCancel={() => { setShowDialog(false); setEditingMount(null); form.resetFields() }}
        confirmLoading={submitting}
        okText={editingMount ? '保存' : '创建并扫描'}
        width={520}
        destroyOnClose
      >
        <Form form={form} labelCol={{ span: 6 }} initialValues={{ type: 'local' }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入数据源名称' }]}>
            <Input placeholder="例如：我的NAS、办公电脑D盘" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'local', label: '📁 本地目录' },
                { value: 'smb', label: '🌐 SMB/CIFS 共享' },
                { value: 'nfs', label: '🐧 NFS 挂载' },
                { value: 'agent', label: '🤖 远程 Agent（即将推出）', disabled: true },
              ]}
            />
          </Form.Item>
          <Form.Item name="base_path" label="路径" rules={[{ required: true, message: '请输入路径' }]}>
            <Input placeholder="D:\Documents 或 /mnt/data" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'smb' ? (
                <>
                  <Form.Item name="smb_user" label="SMB 用户名">
                    <Input placeholder="可选" />
                  </Form.Item>
                  <Form.Item name="smb_pass" label="SMB 密码">
                    <Input.Password placeholder="可选" />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 定时同步配置弹窗 */}
      <Modal
        title={<span><ClockCircleOutlined /> 定时同步 - {scheduleMount?.name}</span>}
        open={showSchedule}
        onCancel={() => setShowSchedule(false)}
        footer={null}
        width={460}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#909399', marginBottom: 12 }}>
            配置 Cron 表达式来设定自动同步频率。格式：分 时 日 月 周
          </div>

          {/* 快捷选项 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: '每小时', value: '0 * * * *' },
              { label: '每3小时', value: '0 */3 * * *' },
              { label: '每6小时', value: '0 */6 * * *' },
              { label: '每12小时', value: '0 */12 * * *' },
              { label: '每天', value: '0 0 * * *' },
            ].map((preset) => (
              <Tag
                key={preset.value}
                color={cronExpr === preset.value ? 'blue' : 'default'}
                style={{ cursor: 'pointer' }}
                onClick={() => setCronExpr(preset.value)}
              >
                {preset.label}
              </Tag>
            ))}
          </div>

          <Input
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="例如: 0 */6 * * *"
            addonBefore="Cron"
          />

          {scheduleData && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#606266' }}>
              <div>状态：{scheduleData.enabled ? <Tag color="success">已启用</Tag> : <Tag color="default">已禁用</Tag>}</div>
              {scheduleData.last_run && <div>上次执行：{formatDate(scheduleData.last_run)}</div>}
              {scheduleData.next_run && <div>下次执行：{formatDate(scheduleData.next_run)}</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {scheduleData && (
            <>
              <Button
                danger
                onClick={async () => {
                  try {
                    await deleteSyncSchedule(scheduleData.id)
                    message.success('定时任务已删除')
                    setScheduleData(null)
                  } catch {}
                }}
              >
                删除任务
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await updateSyncSchedule(scheduleData.id, { enabled: !scheduleData.enabled })
                    message.success(scheduleData.enabled ? '已禁用' : '已启用')
                    setScheduleData({ ...scheduleData, enabled: !scheduleData.enabled })
                  } catch {}
                }}
              >
                {scheduleData.enabled ? '禁用' : '启用'}
              </Button>
            </>
          )}
          <Button
            type="primary"
            loading={scheduleSubmitting}
            onClick={async () => {
              if (!scheduleMount) return
              setScheduleSubmitting(true)
              try {
                if (scheduleData) {
                  await updateSyncSchedule(scheduleData.id, { cron_expr: cronExpr, enabled: true })
                  message.success('更新成功')
                } else {
                  await createSyncSchedule({ mount_id: scheduleMount.id, cron_expr: cronExpr })
                  message.success('定时任务创建成功')
                }
                setShowSchedule(false)
              } catch {} finally { setScheduleSubmitting(false) }
            }}
          >
            {scheduleData ? '更新' : '创建定时任务'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
