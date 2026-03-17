import { useState, useEffect } from 'react'
import {
  Spin, Empty, Button, Modal, Input, Tag as AntTag, Space, message,
  ColorPicker, Popconfirm, Tooltip,
} from 'antd'
import {
  TagsOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import type { Tag, FileItem } from '@/types'
import { getTags, createTag, updateTag, deleteTag, getFilesByTag } from '@/api/tag'
import { formatFileSize, getFileColor } from '@/utils'
import FilePreview from '@/components/FilePreview'

export default function Tags() {
  const [tags, setTags] = useState<(Tag & { file_count: number })[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#1890ff')

  // 编辑标签
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  // 查看标签下的文件
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [tagFiles, setTagFiles] = useState<FileItem[]>([])
  const [filesLoading, setFilesLoading] = useState(false)

  // 预览
  const [showPreview, setShowPreview] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    setLoading(true)
    try {
      const res = await getTags()
      setTags(res.data || [])
    } catch {
      setTags([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      message.warning('请输入标签名称')
      return
    }
    try {
      await createTag({ name: newTagName.trim(), color: newTagColor })
      message.success('创建成功')
      setShowCreate(false)
      setNewTagName('')
      setNewTagColor('#1890ff')
      loadTags()
    } catch {}
  }

  const handleUpdateTag = async () => {
    if (!editTag) return
    try {
      await updateTag(editTag.id, { name: editName.trim(), color: editColor })
      message.success('更新成功')
      setEditTag(null)
      loadTags()
      // 如果正在查看该标签的文件，刷新
      if (selectedTag?.id === editTag.id) {
        setSelectedTag({ ...editTag, name: editName.trim(), color: editColor })
      }
    } catch {}
  }

  const handleDeleteTag = async (tag: Tag) => {
    try {
      await deleteTag(tag.id)
      message.success('已删除')
      loadTags()
      if (selectedTag?.id === tag.id) {
        setSelectedTag(null)
        setTagFiles([])
      }
    } catch {}
  }

  const handleSelectTag = async (tag: Tag) => {
    setSelectedTag(tag)
    setFilesLoading(true)
    try {
      const res = await getFilesByTag(tag.id)
      setTagFiles(res.data || [])
    } catch {
      setTagFiles([])
    } finally {
      setFilesLoading(false)
    }
  }

  const handleDoubleClick = (file: FileItem) => {
    if (!file.is_dir) {
      setPreviewFile(file)
      setShowPreview(true)
    }
  }

  // 预设颜色
  const presetColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginBottom: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#303133', margin: 0 }}>
          <TagsOutlined style={{ color: '#1890ff' }} /> 标签管理
        </h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>
          新建标签
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* 左侧：标签列表 */}
        <div style={{ width: 280, flexShrink: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : tags.length === 0 ? (
            <Empty description="暂无标签" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" size="small" onClick={() => setShowCreate(true)}>创建标签</Button>
            </Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => handleSelectTag(tag)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: selectedTag?.id === tag.id ? '#e6f7ff' : '#fff',
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                    border: selectedTag?.id === tag.id ? '1px solid #91d5ff' : '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: tag.color, flexShrink: 0,
                    }} />
                    <span className="text-ellipsis" style={{ fontSize: 14, color: '#303133' }}>
                      {tag.name}
                    </span>
                    <AntTag style={{ marginLeft: 'auto', flexShrink: 0 }}>{tag.file_count}</AntTag>
                  </div>
                  <Space size={4} style={{ marginLeft: 8, flexShrink: 0 }}>
                    <Tooltip title="编辑">
                      <Button
                        type="text" size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditTag(tag)
                          setEditName(tag.name)
                          setEditColor(tag.color)
                        }}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除该标签吗？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDeleteTag(tag) }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Tooltip title="删除">
                        <Button
                          type="text" size="small" danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：标签下的文件 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedTag ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: '#fafafa', borderRadius: 8, marginBottom: 16,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: selectedTag.color,
                }} />
                <span style={{ fontSize: 15, fontWeight: 500, color: '#303133' }}>
                  {selectedTag.name}
                </span>
                <span style={{ fontSize: 13, color: '#909399' }}>
                  ({tagFiles.length} 个文件)
                </span>
              </div>

              {filesLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              ) : tagFiles.length === 0 ? (
                <Empty description="该标签下暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16,
                }}>
                  {tagFiles.map((file) => (
                    <div
                      key={file.id}
                      onDoubleClick={() => handleDoubleClick(file)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '20px 12px 16px', background: '#fff', borderRadius: 10,
                        cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ fontSize: 48, marginBottom: 12, color: getFileColor(file.name, file.is_dir) }}>
                        {file.is_dir ? '📁' : '📄'}
                      </div>
                      <div className="text-ellipsis" title={file.name}
                        style={{ fontSize: 13, color: '#303133', maxWidth: '100%', textAlign: 'center' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#909399', marginTop: 4 }}>
                        {file.is_dir ? '文件夹' : formatFileSize(file.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '80px 0', color: '#c0c4cc',
            }}>
              <TagsOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <p>点击左侧标签查看文件</p>
            </div>
          )}
        </div>
      </div>

      {/* 创建标签弹窗 */}
      <Modal
        title="新建标签"
        open={showCreate}
        onOk={handleCreateTag}
        onCancel={() => setShowCreate(false)}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>标签名称</label>
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="请输入标签名称"
            maxLength={64}
            onPressEnter={handleCreateTag}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>标签颜色</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presetColors.map((color) => (
              <div
                key={color}
                onClick={() => setNewTagColor(color)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: color,
                  cursor: 'pointer', border: newTagColor === color ? '3px solid #303133' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </div>
      </Modal>

      {/* 编辑标签弹窗 */}
      <Modal
        title="编辑标签"
        open={!!editTag}
        onOk={handleUpdateTag}
        onCancel={() => setEditTag(null)}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>标签名称</label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="请输入标签名称"
            maxLength={64}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>标签颜色</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presetColors.map((color) => (
              <div
                key={color}
                onClick={() => setEditColor(color)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: color,
                  cursor: 'pointer', border: editColor === color ? '3px solid #303133' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        </div>
      </Modal>

      <FilePreview open={showPreview} file={previewFile} onClose={() => setShowPreview(false)} />
    </div>
  )
}
