import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Modal, Input, Form, message, Tag, Tooltip, Empty, Dropdown,
  Select, Avatar, Popconfirm, Card,
} from 'antd'
import {
  PlusOutlined, TeamOutlined, MoreOutlined, EditOutlined,
  DeleteOutlined, UserAddOutlined, CrownOutlined, EyeOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import {
  listWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace,
  listWorkspaceMembers, addWorkspaceMember, removeMember, updateMemberRole,
  searchUsers,
} from '@/api/workspace'
import { formatDate } from '@/utils'
import { useUserStore } from '@/stores/user'

const roleColors: Record<string, string> = {
  owner: '#f50',
  editor: '#2db7f5',
  viewer: '#87d068',
}
const roleNames: Record<string, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '只读',
}

export default function Workspaces() {
  const navigate = useNavigate()
  const { user } = useUserStore()
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 创建/编辑弹窗
  const [showCreate, setShowCreate] = useState(false)
  const [editingWs, setEditingWs] = useState<any>(null)
  const [form] = Form.useForm()

  // 成员管理弹窗
  const [showMembers, setShowMembers] = useState(false)
  const [membersWs, setMembersWs] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [addUsername, setAddUsername] = useState('')
  const [addRole, setAddRole] = useState('viewer')
  const [searchedUsers, setSearchedUsers] = useState<any[]>([])

  useEffect(() => { loadWorkspaces() }, [])

  const loadWorkspaces = async () => {
    setLoading(true)
    try {
      const res = await listWorkspaces()
      setWorkspaces(res.data || [])
    } catch {}
    setLoading(false)
  }

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      if (editingWs) {
        await updateWorkspace(editingWs.workspace.id, values)
        message.success('更新成功')
      } else {
        await createWorkspace(values)
        message.success('空间已创建')
      }
      setShowCreate(false)
      form.resetFields()
      setEditingWs(null)
      loadWorkspaces()
    } catch {}
  }

  const handleOpenMembers = async (ws: any) => {
    setMembersWs(ws)
    setShowMembers(true)
    try {
      const res = await listWorkspaceMembers(ws.workspace.id)
      setMembers(res.data || [])
    } catch {}
  }

  const handleAddMember = async () => {
    if (!addUsername || !membersWs) return
    try {
      await addWorkspaceMember(membersWs.workspace.id, { username: addUsername, role: addRole })
      message.success('成员已添加')
      setAddUsername('')
      const res = await listWorkspaceMembers(membersWs.workspace.id)
      setMembers(res.data || [])
    } catch {}
  }

  const handleSearchUser = async (keyword: string) => {
    if (keyword.length < 1) { setSearchedUsers([]); return }
    try {
      const res = await searchUsers(keyword)
      setSearchedUsers(res.data || [])
    } catch {}
  }

  const emojiIcons = ['📁', '🏢', '🎨', '💼', '🔬', '📚', '🎮', '🎵', '📷', '🌍', '🚀', '💡']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, color: '#303133', margin: 0 }}>
          <TeamOutlined /> 协作空间
        </h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingWs(null); form.resetFields(); setShowCreate(true) }}>
          创建空间
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100, color: '#909399' }}>加载中...</div>
      ) : workspaces.length === 0 ? (
        <Empty description="还没有协作空间，点击右上角创建" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {workspaces.map((item) => {
            const ws = item.workspace
            return (
              <Card
                key={ws.id}
                hoverable
                style={{ borderRadius: 12 }}
                actions={[
                  <Tooltip title="浏览文件" key="files">
                    <FolderOpenOutlined onClick={() => navigate(`/files?parent_id=${ws.root_folder}`)} />
                  </Tooltip>,
                  <Tooltip title="成员管理" key="members">
                    <TeamOutlined onClick={() => handleOpenMembers(item)} />
                  </Tooltip>,
                  <Dropdown key="more" menu={{
                    items: [
                      { key: 'edit', icon: <EditOutlined />, label: '编辑空间' },
                      item.my_role === 'owner'
                        ? { key: 'delete', icon: <DeleteOutlined style={{ color: '#f5222d' }} />, label: <span style={{ color: '#f5222d' }}>删除空间</span> }
                        : null,
                    ].filter(Boolean) as any[],
                    onClick: async ({ key }) => {
                      if (key === 'edit') {
                        setEditingWs(item)
                        form.setFieldsValue({ name: ws.name, description: ws.description, icon: ws.icon })
                        setShowCreate(true)
                      } else if (key === 'delete') {
                        Modal.confirm({
                          title: '删除空间',
                          content: `确定删除「${ws.name}」? 空间文件不会被删除。`,
                          okType: 'danger',
                          onOk: async () => {
                            await deleteWorkspace(ws.id)
                            message.success('已删除')
                            loadWorkspaces()
                          },
                        })
                      }
                    },
                  }}>
                    <MoreOutlined />
                  </Dropdown>,
                ]}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 32 }}>{ws.icon || '📁'}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#303133' }}>{ws.name}</div>
                    <div style={{ fontSize: 12, color: '#909399' }}>
                      创建于 {formatDate(ws.created_at)}
                    </div>
                  </div>
                </div>
                {ws.description && (
                  <div style={{ fontSize: 13, color: '#606266', marginBottom: 12, minHeight: 20 }}>
                    {ws.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Tag color={roleColors[item.my_role]}>{roleNames[item.my_role]}</Tag>
                  <span style={{ fontSize: 12, color: '#909399' }}>
                    <TeamOutlined /> {item.member_count} 位成员
                  </span>
                  <span style={{ fontSize: 12, color: '#c0c4cc', marginLeft: 'auto' }}>
                    <Avatar size={20} src={item.owner?.avatar}>{item.owner?.nickname?.charAt(0)}</Avatar>
                    <span style={{ marginLeft: 4 }}>{item.owner?.nickname || item.owner?.username}</span>
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 创建/编辑空间弹窗 */}
      <Modal
        title={editingWs ? '编辑空间' : '创建协作空间'}
        open={showCreate}
        onCancel={() => { setShowCreate(false); setEditingWs(null) }}
        onOk={handleCreate}
        okText={editingWs ? '保存' : '创建'}
        width={460}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="图标" name="icon">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {emojiIcons.map((emoji) => (
                <span
                  key={emoji}
                  onClick={() => form.setFieldValue('icon', emoji)}
                  style={{
                    fontSize: 24, cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
                    background: form.getFieldValue('icon') === emoji ? '#e6f7ff' : 'transparent',
                    border: form.getFieldValue('icon') === emoji ? '1px solid #91d5ff' : '1px solid transparent',
                  }}
                >
                  {emoji}
                </span>
              ))}
            </div>
          </Form.Item>
          <Form.Item label="空间名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：产品设计部" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="简单描述这个空间的用途（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        title={<span><TeamOutlined /> {membersWs?.workspace?.name} - 成员管理</span>}
        open={showMembers}
        onCancel={() => setShowMembers(false)}
        footer={null}
        width={520}
      >
        {/* 添加成员 */}
        {(membersWs?.my_role === 'owner' || membersWs?.my_role === 'editor') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Select
              showSearch
              value={addUsername || undefined}
              placeholder="搜索并选择用户"
              style={{ flex: 1 }}
              onSearch={handleSearchUser}
              onChange={(val) => setAddUsername(val)}
              filterOption={false}
              notFoundContent={null}
              options={searchedUsers.map((u) => ({
                value: u.username,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar size={20} src={u.avatar}>{u.nickname?.charAt(0) || u.username.charAt(0)}</Avatar>
                    <span>{u.nickname || u.username}</span>
                    <span style={{ color: '#c0c4cc', fontSize: 12 }}>@{u.username}</span>
                  </div>
                ),
              }))}
            />
            <Select
              value={addRole}
              onChange={setAddRole}
              style={{ width: 100 }}
              options={[
                { value: 'editor', label: '编辑者' },
                { value: 'viewer', label: '只读' },
              ]}
            />
            <Button type="primary" icon={<UserAddOutlined />} onClick={handleAddMember}>
              添加
            </Button>
          </div>
        )}

        {/* 成员列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, background: '#fafafa',
            }}>
              <Avatar size={36} src={m.user?.avatar}>
                {m.user?.nickname?.charAt(0) || m.user?.username?.charAt(0)}
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {m.user?.nickname || m.user?.username}
                  {m.role === 'owner' && <CrownOutlined style={{ color: '#faad14', marginLeft: 6 }} />}
                </div>
                <div style={{ fontSize: 12, color: '#909399' }}>@{m.user?.username}</div>
              </div>
              {m.role === 'owner' ? (
                <Tag color={roleColors.owner}>所有者</Tag>
              ) : (
                <>
                  {membersWs?.my_role === 'owner' ? (
                    <Select
                      size="small"
                      value={m.role}
                      style={{ width: 90 }}
                      onChange={async (val) => {
                        await updateMemberRole(membersWs.workspace.id, m.user_id, val)
                        const res = await listWorkspaceMembers(membersWs.workspace.id)
                        setMembers(res.data || [])
                      }}
                      options={[
                        { value: 'editor', label: '编辑者' },
                        { value: 'viewer', label: '只读' },
                      ]}
                    />
                  ) : (
                    <Tag color={roleColors[m.role]}>{roleNames[m.role]}</Tag>
                  )}
                  {membersWs?.my_role === 'owner' && (
                    <Popconfirm
                      title="确定移除该成员？"
                      onConfirm={async () => {
                        await removeMember(membersWs.workspace.id, m.user_id)
                        message.success('已移除')
                        const res = await listWorkspaceMembers(membersWs.workspace.id)
                        setMembers(res.data || [])
                      }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
