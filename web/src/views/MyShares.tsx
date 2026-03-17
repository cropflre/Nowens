import { useState, useEffect } from 'react'
import { Table, Button, Tag, Empty, Space, Modal, message } from 'antd'
import { ShareAltOutlined } from '@ant-design/icons'
import type { ShareLink } from '@/types'
import { getShareList, deleteShare } from '@/api/share'
import { formatDate } from '@/utils'

export default function MyShares() {
  const [shares, setShares] = useState<ShareLink[]>([])

  useEffect(() => { loadShares() }, [])

  const loadShares = async () => {
    try {
      const res = await getShareList()
      setShares(res.data || [])
    } catch {}
  }

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/share/${code}`
    navigator.clipboard.writeText(url)
    message.success('分享链接已复制到剪贴板')
  }

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '取消分享',
      content: '确定要取消该分享吗？',
      onOk: async () => {
        await deleteShare(id)
        message.success('已取消分享')
        loadShares()
      },
    })
  }

  const columns = [
    {
      title: '分享码', dataIndex: 'code', key: 'code', width: 140,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    { title: '文件ID', dataIndex: 'file_id', key: 'file_id', width: 100 },
    { title: '查看', dataIndex: 'view_count', key: 'view_count', width: 80 },
    { title: '下载', dataIndex: 'download_count', key: 'download_count', width: 80 },
    {
      title: '过期时间', dataIndex: 'expire_at', key: 'expire_at', width: 180,
      render: (val: string) => val ? formatDate(val) : <Tag color="green">永久</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180,
      render: (val: string) => formatDate(val),
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_: any, record: ShareLink) => (
        <Space>
          <Button type="link" onClick={() => copyLink(record.code)}>复制链接</Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>取消分享</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ padding: '12px 0', marginBottom: 8 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#303133' }}>
          <ShareAltOutlined /> 我的分享
        </h3>
      </div>

      {shares.length === 0 ? (
        <Empty description="暂无分享链接" />
      ) : (
        <Table dataSource={shares} columns={columns} rowKey="id" pagination={false} />
      )}
    </div>
  )
}
