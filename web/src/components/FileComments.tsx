import { useState, useEffect } from 'react'
import { Drawer, Input, Button, List, Avatar, Popconfirm, message, Empty, Spin } from 'antd'
import { SendOutlined, DeleteOutlined, EditOutlined, UserOutlined } from '@ant-design/icons'
import { addComment, listComments, updateComment, deleteComment, type Comment } from '@/api/comment'
import { formatDate } from '@/utils'
import { useUserStore } from '@/stores/user'

interface Props {
  open: boolean
  fileId: number | null
  fileName: string
  onClose: () => void
}

export default function FileComments({ open, fileId, fileName, onClose }: Props) {
  const { user } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && fileId) loadComments()
  }, [open, fileId])

  const loadComments = async () => {
    if (!fileId) return
    setLoading(true)
    try {
      const res = await listComments(fileId)
      setComments(res.data || [])
    } catch {}
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!fileId || !newComment.trim()) return
    setSubmitting(true)
    try {
      await addComment({ file_id: fileId, content: newComment.trim() })
      setNewComment('')
      loadComments()
      message.success('评论成功')
    } catch {}
    setSubmitting(false)
  }

  const handleUpdate = async (id: number) => {
    if (!editContent.trim()) return
    try {
      await updateComment(id, editContent.trim())
      setEditingId(null)
      setEditContent('')
      loadComments()
      message.success('已更新')
    } catch {}
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteComment(id)
      loadComments()
      message.success('已删除')
    } catch {}
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAdd()
    }
  }

  return (
    <Drawer
      title={`💬 评论 - ${fileName}`}
      open={open}
      onClose={onClose}
      width={420}
      styles={{ body: { padding: '12px 16px', display: 'flex', flexDirection: 'column' } }}
    >
      {/* 评论列表 */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : comments.length === 0 ? (
          <Empty description="暂无评论" image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ paddingTop: 60 }}
          />
        ) : (
          <List
            dataSource={comments}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '12px 0', border: 'none' }}
                actions={
                  item.user_id === user?.id
                    ? [
                        <Button
                          key="edit"
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingId(item.id)
                            setEditContent(item.content)
                          }}
                        />,
                        <Popconfirm
                          key="delete"
                          title="确定删除这条评论？"
                          onConfirm={() => handleDelete(item.id)}
                        >
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  avatar={
                    <Avatar size={36} icon={<UserOutlined />} style={{ background: '#1890ff' }}>
                      {item.username?.charAt(0)?.toUpperCase()}
                    </Avatar>
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{item.username}</span>
                      <span style={{ fontSize: 11, color: '#c0c4cc' }}>
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  }
                  description={
                    editingId === item.id ? (
                      <div style={{ marginTop: 4 }}>
                        <Input.TextArea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          autoSize={{ minRows: 2 }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <Button size="small" type="primary" onClick={() => handleUpdate(item.id)}>
                            保存
                          </Button>
                          <Button size="small" onClick={() => setEditingId(null)}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <p style={{
                        margin: '4px 0 0', color: '#303133',
                        lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      }}>
                        {item.content}
                      </p>
                    )
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 输入区 */}
      <div style={{
        borderTop: '1px solid #f0f0f0', paddingTop: 12,
        display: 'flex', gap: 8,
      }}>
        <Input.TextArea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="输入评论...（Ctrl+Enter 发送）"
          autoSize={{ minRows: 2, maxRows: 4 }}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleAdd}
          loading={submitting}
          disabled={!newComment.trim()}
          style={{ alignSelf: 'flex-end' }}
        >
          发送
        </Button>
      </div>
    </Drawer>
  )
}
