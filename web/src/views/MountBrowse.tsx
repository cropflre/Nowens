import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Breadcrumb, Input, Table, Tag, Spin, Empty, Modal, message,
} from 'antd'
import {
  ArrowLeftOutlined, SearchOutlined, ReloadOutlined,
  HomeFilled, DownloadOutlined, EyeOutlined, FolderOpenOutlined,
} from '@ant-design/icons'
import {
  listIndexedFiles, searchIndexedFiles, getMount,
  getIndexedFileDownloadUrl, getIndexedFilePreviewUrl,
} from '@/api/mount'
import { formatFileSize, formatDate, getFileColor, isPreviewable } from '@/utils'
import type { IndexedFile, MountPoint } from '@/types'

export default function MountBrowse() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mountId = Number(id)

  const [mountInfo, setMountInfo] = useState<MountPoint | null>(null)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<IndexedFile[]>([])
  const [breadcrumb, setBreadcrumb] = useState<Array<{ name: string; path: string }>>([])
  const [currentPath, setCurrentPath] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showPreview, setShowPreview] = useState(false)
  const [previewFile, setPreviewFile] = useState<IndexedFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    loadMountInfo()
    loadFiles()
  }, [])

  const loadMountInfo = async () => {
    try {
      const res = await getMount(mountId)
      setMountInfo(res.data || null)
    } catch {
      message.error('数据源不存在')
      navigate('/mounts')
    }
  }

  const loadFiles = async (path = currentPath, sort = sortBy, order = sortOrder) => {
    setLoading(true)
    setIsSearchMode(false)
    try {
      const res = await listIndexedFiles(mountId, { path, sort, order })
      setFiles(res.data?.files || [])
      setBreadcrumb(res.data?.breadcrumb || [])
    } catch {} finally { setLoading(false) }
  }

  const doSearch = async () => {
    if (!searchKeyword.trim()) { clearSearch(); return }
    setLoading(true)
    setIsSearchMode(true)
    try {
      const res = await searchIndexedFiles(searchKeyword, mountId)
      setFiles(res.data || [])
      setBreadcrumb([])
    } catch {} finally { setLoading(false) }
  }

  const clearSearch = () => {
    setSearchKeyword('')
    setIsSearchMode(false)
    loadFiles()
  }

  const navigateTo = (path: string) => {
    setCurrentPath(path)
    loadFiles(path)
  }

  const handleRowDblClick = (record: IndexedFile) => {
    if (record.is_dir) {
      setCurrentPath(record.remote_path)
      loadFiles(record.remote_path)
    }
  }

  const downloadFile = (file: IndexedFile) => {
    const url = getIndexedFileDownloadUrl(file.id)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }

  const handlePreview = async (file: IndexedFile) => {
    setPreviewFile(file)
    const url = getIndexedFilePreviewUrl(file.id)
    setPreviewUrl(url)
    if (file.mime_type?.startsWith('text/')) {
      try {
        const resp = await fetch(url)
        setTextContent(await resp.text())
      } catch { setTextContent('无法加载文件内容') }
    }
    setShowPreview(true)
  }

  const getExtLabel = (name: string) => {
    const ext = name.split('.').pop()?.toUpperCase() || ''
    return ext ? `${ext} 文件` : '文件'
  }

  const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
    let newSort = 'name'
    if (sorter.field === 'size') newSort = 'size'
    else if (sorter.field === 'mod_time') newSort = 'mod_time'
    const newOrder = sorter.order === 'descend' ? 'desc' : 'asc'
    setSortBy(newSort)
    setSortOrder(newOrder)
    loadFiles(currentPath, newSort, newOrder)
  }

  const columns = [
    {
      title: '名称', dataIndex: 'name', key: 'name', sorter: true,
      render: (_: any, record: IndexedFile) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <span style={{ fontSize: 18, color: getFileColor(record.name, record.is_dir) }}>
            {record.is_dir ? '📁' : '📄'}
          </span>
          <span className="text-ellipsis" title={record.name}>{record.name}</span>
        </div>
      ),
    },
    {
      title: '大小', dataIndex: 'size', key: 'size', width: 120, sorter: true,
      render: (_: any, r: IndexedFile) => r.is_dir ? <span style={{ color: '#c0c4cc' }}>—</span> : formatFileSize(r.size),
    },
    {
      title: '修改时间', dataIndex: 'mod_time', key: 'mod_time', width: 180, sorter: true,
      render: (val: string) => formatDate(val),
    },
    {
      title: '类型', key: 'type', width: 150,
      render: (_: any, r: IndexedFile) => (
        <span style={{ fontSize: 13, color: '#909399' }}>{r.is_dir ? '文件夹' : getExtLabel(r.name)}</span>
      ),
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: any, record: IndexedFile) => (
        <>
          {!record.is_dir ? (
            <>
              <Button type="text" size="small" icon={<DownloadOutlined />} onClick={(e) => { e.stopPropagation(); downloadFile(record) }} />
              {isPreviewable(record.mime_type) && (
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handlePreview(record) }} />
              )}
            </>
          ) : (
            <Button type="text" size="small" onClick={(e) => { e.stopPropagation(); handleRowDblClick(record) }}>打开</Button>
          )}
        </>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/mounts')}>返回数据源</Button>
          {mountInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <FolderOpenOutlined style={{ fontSize: 16, color: '#1890ff' }} />
              <span style={{ fontWeight: 600, fontSize: 15, color: '#303133' }}>{mountInfo.name}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="在此数据源中搜索..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 260 }}
            onPressEnter={doSearch}
            onClear={clearSearch}
          />
          <Button type="text" icon={<ReloadOutlined />} loading={loading} onClick={() => loadFiles()} />
        </div>
      </div>

      {/* 面包屑导航 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: '#fff', borderRadius: 8, marginBottom: 12, border: '1px solid #ebeef5',
      }}>
        <Breadcrumb
          items={[
            { title: <a onClick={() => navigateTo('')}><HomeFilled /> 根目录</a> },
            ...breadcrumb.map((crumb) => ({
              title: <a onClick={() => navigateTo(crumb.path)}>{crumb.name}</a>,
            })),
          ]}
        />
        {!loading && <span style={{ fontSize: 13, color: '#909399' }}>{files.length} 项</span>}
      </div>

      {/* 搜索提示 */}
      {isSearchMode && (
        <div style={{ marginBottom: 12 }}>
          <Tag closable onClose={clearSearch}>搜索: {searchKeyword}</Tag>
        </div>
      )}

      {/* 文件列表 */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #ebeef5', flex: 1, overflow: 'auto' }}>
        <Spin spinning={loading}>
          {!loading && files.length === 0 ? (
            <div style={{ padding: '60px 0' }}>
              <Empty description={isSearchMode ? '未找到匹配的文件' : '空目录'} />
            </div>
          ) : (
            <Table
              dataSource={files}
              columns={columns}
              rowKey="id"
              pagination={false}
              onChange={handleTableChange}
              onRow={(record) => ({
                onDoubleClick: () => handleRowDblClick(record),
                style: record.is_dir ? { cursor: 'pointer' } : undefined,
              })}
            />
          )}
        </Spin>
      </div>

      {/* 预览对话框 */}
      <Modal
        title={previewFile?.name}
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        width="80%"
        style={{ top: '5vh' }}
        footer={null}
        destroyOnClose
      >
        <div style={{ minHeight: 200 }}>
          {previewFile?.mime_type?.startsWith('image/') && (
            <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
          )}
          {previewFile?.mime_type?.startsWith('video/') && (
            <video src={previewUrl} controls style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
          )}
          {previewFile?.mime_type?.startsWith('audio/') && (
            <audio src={previewUrl} controls style={{ width: '100%' }} />
          )}
          {previewFile?.mime_type === 'application/pdf' && (
            <iframe src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} />
          )}
          {previewFile?.mime_type?.startsWith('text/') && (
            <pre style={{
              maxHeight: '70vh', overflow: 'auto', background: '#f5f7fa',
              padding: 16, borderRadius: 8, fontSize: 13, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {textContent}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  )
}
