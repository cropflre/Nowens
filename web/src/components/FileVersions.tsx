import { useState, useEffect } from 'react'
import { Modal, Spin, Empty, Timeline, Tag, Button, Space, message } from 'antd'
import type { FileItem, FileVersion } from '@/types'
import { getFileVersions, restoreVersion, deleteVersion } from '@/api/file'
import { formatFileSize, formatDate } from '@/utils'

interface Props {
  open: boolean
  file: FileItem | null
  onClose: () => void
  onRestored: () => void
}

export default function FileVersions({ open, file, onClose, onRestored }: Props) {
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<FileVersion[]>([])

  useEffect(() => {
    if (open && file) {
      loadVersions()
    }
  }, [open, file])

  const loadVersions = async () => {
    if (!file) return
    setLoading(true)
    try {
      const res = await getFileVersions(file.id)
      setVersions(res.data?.versions || [])
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = (ver: FileVersion) => {
    if (!file) return
    Modal.confirm({
      title: '回滚版本',
      content: `确定要回滚到 v${ver.version} 吗？当前版本将自动保存。`,
      onOk: async () => {
        await restoreVersion(file.id, ver.id)
        message.success('已回滚到该版本')
        loadVersions()
        onRestored()
      },
    })
  }

  const handleDelete = (ver: FileVersion) => {
    if (!file) return
    Modal.confirm({
      title: '删除版本',
      content: `确定要删除 v${ver.version} 吗？`,
      okType: 'danger',
      onOk: async () => {
        await deleteVersion(file.id, ver.id)
        message.success('版本已删除')
        loadVersions()
      },
    })
  }

  return (
    <Modal
      title={`版本历史 — ${file?.name || ''}`}
      open={open}
      onCancel={onClose}
      width={600}
      footer={null}
      destroyOnClose
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '40px 0', color: '#909399' }}>
          <Spin />
          <span>加载中...</span>
        </div>
      ) : versions.length === 0 ? (
        <Empty description="暂无历史版本" imageStyle={{ height: 80 }} />
      ) : (
        <Timeline
          items={versions.map((ver) => ({
            key: ver.id,
            children: (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#fafafa', borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Tag>v{ver.version}</Tag>
                  <span style={{ fontSize: 13, color: '#606266' }}>{formatFileSize(ver.size)}</span>
                  {ver.comment && (
                    <span style={{ fontSize: 12, color: '#909399', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ver.comment}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: '#c0c4cc' }}>{formatDate(ver.created_at)}</span>
                </div>
                <Space>
                  <Button type="link" size="small" onClick={() => handleRestore(ver)}>回滚到此版本</Button>
                  <Button type="link" size="small" danger onClick={() => handleDelete(ver)}>删除</Button>
                </Space>
              </div>
            ),
          }))}
        />
      )}
    </Modal>
  )
}
