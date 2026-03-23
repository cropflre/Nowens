import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, message, Statistic, Row, Col, Tooltip, Progress } from 'antd'
import { DeleteOutlined, SyncOutlined, FileOutlined, WarningOutlined } from '@ant-design/icons'
import type { DedupStats, DuplicateGroup, FileItem } from '@/types'
import { getDuplicates, cleanDuplicates } from '@/api/dedup'

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function DedupDashboard() {
  const [stats, setStats] = useState<DedupStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedHashes, setSelectedHashes] = useState<string[]>([])

  const loadData = async (p = page) => {
    setLoading(true)
    try {
      const res = await getDuplicates(p, 20)
      if (res.code === 0 && res.data) {
        setStats(res.data)
      }
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page])

  // 清理选中的重复文件
  const handleClean = async (hashes: string[]) => {
    Modal.confirm({
      title: hashes.length === 0 ? '一键清理所有重复文件？' : `清理 ${hashes.length} 组重复文件？`,
      content: '重复文件将被移入回收站（保留每组最早上传的文件），可以在回收站恢复。',
      okText: '确认清理',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        setCleaning(true)
        try {
          const res = await cleanDuplicates(hashes)
          if (res.code === 0 && res.data) {
            message.success(`清理完成：删除 ${res.data.deleted_count} 个文件，释放 ${formatSize(res.data.freed_size)} 空间`)
            setSelectedHashes([])
            loadData()
          }
        } catch {
          message.error('清理失败')
        } finally {
          setCleaning(false)
        }
      },
    })
  }

  // 展开行：显示该组的所有重复文件
  const expandedRowRender = (group: DuplicateGroup) => {
    const columns = [
      { title: '文件名', dataIndex: 'name', key: 'name', ellipsis: true },
      {
        title: '路径',
        dataIndex: 'parent_id',
        key: 'parent_id',
        render: (v: number) => v === 0 ? '根目录' : `文件夹 #${v}`,
      },
      { title: '大小', dataIndex: 'size', key: 'size', render: (v: number) => formatSize(v), width: 120 },
      { title: '上传时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString() },
      {
        title: '状态',
        key: 'status',
        width: 80,
        render: (_: any, _r: FileItem, index: number) =>
          index === 0 ? <Tag color="green">保留</Tag> : <Tag color="red">重复</Tag>,
      },
    ]

    return (
      <Table
        columns={columns}
        dataSource={group.files}
        rowKey="id"
        pagination={false}
        size="small"
        rowClassName={(_, index) => index === 0 ? 'bg-green-50' : ''}
      />
    )
  }

  const columns = [
    {
      title: '文件哈希',
      dataIndex: 'hash',
      key: 'hash',
      width: 200,
      render: (v: string) => (
        <Tooltip title={v}>
          <code style={{ fontSize: 12 }}>{v.substring(0, 16)}...</code>
        </Tooltip>
      ),
    },
    {
      title: '文件数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (v: number) => <Tag color="orange">{v} 个文件</Tag>,
    },
    { title: '单个大小', dataIndex: 'size', key: 'size', width: 120, render: (v: number) => formatSize(v) },
    {
      title: '浪费空间',
      dataIndex: 'wasted_size',
      key: 'wasted_size',
      width: 120,
      render: (v: number) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>{formatSize(v)}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: DuplicateGroup) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleClean([record.hash])}
        >
          清理
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>🔄 文件去重仪表盘</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="重复文件组"
              value={stats?.total_duplicate_groups || 0}
              prefix={<FileOutlined />}
              suffix="组"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="重复文件总数"
              value={stats?.total_duplicate_files || 0}
              prefix={<WarningOutlined />}
              suffix="个"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="可释放空间"
              value={formatSize(stats?.total_wasted_size || 0)}
              valueStyle={{ color: '#f5222d' }}
            />
            {stats && stats.total_wasted_size > 0 && (
              <Progress
                percent={100}
                size="small"
                status="exception"
                showInfo={false}
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<SyncOutlined />} onClick={() => loadData()} loading={loading}>
          刷新
        </Button>
        <Button
          type="primary"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleClean(selectedHashes)}
          loading={cleaning}
          disabled={!stats || stats.total_duplicate_groups === 0}
        >
          {selectedHashes.length > 0 ? `清理选中 (${selectedHashes.length})` : '一键清理全部'}
        </Button>
      </Space>

      {/* 重复文件列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={stats?.groups || []}
          rowKey="hash"
          loading={loading}
          expandable={{ expandedRowRender }}
          rowSelection={{
            selectedRowKeys: selectedHashes,
            onChange: (keys) => setSelectedHashes(keys as string[]),
          }}
          pagination={{
            current: page,
            pageSize: 20,
            total: stats?.total_duplicate_groups || 0,
            onChange: setPage,
            showTotal: (total) => `共 ${total} 组重复文件`,
          }}
        />
      </Card>
    </div>
  )
}
