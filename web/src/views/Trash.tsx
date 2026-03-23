import { useState, useEffect } from 'react'
import { Table, Button, Empty, Space, Modal, message } from 'antd'
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import type { FileItem } from '@/types'
import { getTrashList, restoreFile, deleteFile, batchRestore } from '@/api/file'
import { formatFileSize, formatDate, getFileColor } from '@/utils'

export default function Trash() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  useEffect(() => { loadTrash() }, [])

  const loadTrash = async () => {
    try {
      const res = await getTrashList()
      setFiles(res.data || [])
      setSelectedIds([])
    } catch {}
  }

  const handleRestore = async (file: FileItem) => {
    try {
      await restoreFile({ file_id: file.id })
      message.success('已恢复')
      loadTrash()
    } catch {}
  }

  const handleBatchRestore = async () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要恢复的文件')
      return
    }
    Modal.confirm({
      title: '批量恢复',
      content: `确定要恢复选中的 ${selectedIds.length} 个文件吗？`,
      okText: '恢复',
      onOk: async () => {
        try {
          await batchRestore(selectedIds)
          message.success(`已恢复 ${selectedIds.length} 个文件`)
          loadTrash()
        } catch {
          message.error('批量恢复失败')
        }
      },
    })
  }

  const handleDelete = (file: FileItem) => {
    Modal.confirm({
      title: '永久删除',
      content: `永久删除「${file.name}」后将无法恢复，是否继续？`,
      okText: '永久删除',
      okType: 'danger',
      onOk: async () => {
        await deleteFile(file.id)
        message.success('已永久删除')
        loadTrash()
      },
    })
  }

  const handleClearAll = () => {
    Modal.confirm({
      title: '清空回收站',
      content: '确定要清空回收站吗？所有文件将被永久删除且无法恢复！',
      okText: '清空',
      okType: 'danger',
      onOk: async () => {
        for (const file of files) {
          await deleteFile(file.id)
        }
        message.success('回收站已清空')
        loadTrash()
      },
    })
  }

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: FileItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, color: getFileColor(record.name, record.is_dir) }}>
            {record.is_dir ? '📁' : '📄'}
          </span>
          <span>{record.name}</span>
        </div>
      ),
    },
    {
      title: '大小', dataIndex: 'size', key: 'size', width: 120,
      render: (_: any, record: FileItem) => record.is_dir ? '--' : formatFileSize(record.size),
    },
    {
      title: '删除时间', dataIndex: 'trashed_at', key: 'trashed_at', width: 180,
      render: (val: string) => formatDate(val),
    },
    {
      title: '操作', key: 'actions', width: 180,
      render: (_: any, record: FileItem) => (
        <Space>
          <Button type="link" onClick={() => handleRestore(record)}>恢复</Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>永久删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#303133' }}>
          <DeleteOutlined /> 回收站
        </h3>
        <Space>
          <Button
            icon={<UndoOutlined />}
            disabled={selectedIds.length === 0}
            onClick={handleBatchRestore}
          >
            批量恢复 {selectedIds.length > 0 && `(${selectedIds.length})`}
          </Button>
          <Button danger disabled={files.length === 0} onClick={handleClearAll}>
            清空回收站
          </Button>
        </Space>
      </div>

      {files.length === 0 ? (
        <Empty description="回收站是空的" />
      ) : (
        <Table
          dataSource={files}
          columns={columns}
          rowKey="id"
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
        />
      )}
    </div>
  )
}
