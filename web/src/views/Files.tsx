import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Breadcrumb, Button, Table, Modal, Input, Select, Empty, Spin,
  Space, Tag, Checkbox, message, Upload, Progress, Dropdown,
} from 'antd'
import {
  HomeFilled, UploadOutlined, FolderAddOutlined,
  AppstoreOutlined, UnorderedListOutlined, DeleteOutlined,
  DownloadOutlined, ShareAltOutlined, EditOutlined,
  EyeOutlined, DragOutlined, HistoryOutlined, CheckSquareOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useFileStore } from '@/stores/file'
import type { FileItem, ShareLink } from '@/types'
import { formatFileSize, formatDate, getFileIcon, getFileColor } from '@/utils'
import {
  createFolder, uploadFile, renameFile, trashFile,
  searchFiles, getDownloadUrl, batchTrash,
} from '@/api/file'
import { createShare } from '@/api/share'
import FilePreview from '@/components/FilePreview'
import FileVersions from '@/components/FileVersions'

export default function Files() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileStore = useFileStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 上传相关
  interface UploadTask {
    name: string
    percent: number
    status: 'uploading' | 'done' | 'error'
  }
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])

  // 选中状态（批量操作）
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isMultiSelect, setIsMultiSelect] = useState(false)

  // 搜索相关
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<FileItem[]>([])

  // 新建文件夹
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // 重命名
  const [showRename, setShowRename] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null)

  // 分享
  const [showShare, setShowShare] = useState(false)
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null)
  const [sharePassword, setSharePassword] = useState('')
  const [shareExpireDays, setShareExpireDays] = useState(7)
  const [shareResult, setShareResult] = useState<ShareLink | null>(null)

  // 预览
  const [showPreview, setShowPreview] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  // 版本
  const [showVersions, setShowVersions] = useState(false)
  const [versionTarget, setVersionTarget] = useState<FileItem | null>(null)

  const displayFiles = isSearchMode ? searchResults : fileStore.files

  // 加载文件列表
  useEffect(() => {
    const search = searchParams.get('search')
    if (search) {
      handleSearchByKeyword(search)
    } else {
      fileStore.loadFiles(0)
    }
  }, [searchParams.get('search')])

  // ==================== 文件操作 ====================
  const handleClick = (file: FileItem) => {
    if (isMultiSelect) {
      const newSet = new Set(selectedIds)
      if (newSet.has(file.id)) newSet.delete(file.id)
      else newSet.add(file.id)
      setSelectedIds(newSet)
    }
  }

  const handleDoubleClick = (file: FileItem) => {
    if (file.is_dir) {
      setIsSearchMode(false)
      fileStore.enterFolder(file.id)
    } else {
      setPreviewFile(file)
      setShowPreview(true)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === displayFiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayFiles.map((f) => f.id)))
    }
  }

  const handleBatchTrash = async () => {
    if (selectedIds.size === 0) return
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedIds.size} 个文件吗？`,
      onOk: async () => {
        await batchTrash(Array.from(selectedIds))
        message.success(`已将 ${selectedIds.size} 个文件移入回收站`)
        setSelectedIds(new Set())
        setIsMultiSelect(false)
        fileStore.loadFiles()
      },
    })
  }

  const triggerUpload = () => fileInputRef.current?.click()

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const tasks: UploadTask[] = []
    for (const file of Array.from(files)) {
      const task: UploadTask = { name: file.name, percent: 0, status: 'uploading' }
      tasks.push(task)
    }
    setUploadTasks((prev) => [...prev, ...tasks])

    for (let i = 0; i < Array.from(files).length; i++) {
      const file = Array.from(files)[i]
      try {
        await uploadFile(fileStore.currentParentId, file, (percent) => {
          setUploadTasks((prev) => {
            const updated = [...prev]
            const idx = updated.findIndex((t) => t.name === file.name && t.status === 'uploading')
            if (idx >= 0) updated[idx] = { ...updated[idx], percent }
            return updated
          })
        })
        setUploadTasks((prev) => {
          const updated = [...prev]
          const idx = updated.findIndex((t) => t.name === file.name && t.status === 'uploading')
          if (idx >= 0) updated[idx] = { ...updated[idx], status: 'done', percent: 100 }
          return updated
        })
      } catch {
        setUploadTasks((prev) => {
          const updated = [...prev]
          const idx = updated.findIndex((t) => t.name === file.name && t.status === 'uploading')
          if (idx >= 0) updated[idx] = { ...updated[idx], status: 'error' }
          return updated
        })
      }
    }

    fileStore.loadFiles()
    e.target.value = ''
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      message.warning('请输入文件夹名称')
      return
    }
    try {
      await createFolder({ parent_id: fileStore.currentParentId, name: newFolderName.trim() })
      message.success('创建成功')
      setShowNewFolder(false)
      setNewFolderName('')
      fileStore.loadFiles()
    } catch {}
  }

  const handleDownload = (file: FileItem) => {
    const url = getDownloadUrl(file.uuid)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }

  const handleShare = (file: FileItem) => {
    setShareTarget(file)
    setSharePassword('')
    setShareExpireDays(7)
    setShareResult(null)
    setShowShare(true)
  }

  const handleCreateShare = async () => {
    if (!shareTarget) return
    try {
      const res = await createShare({
        file_id: shareTarget.id,
        password: sharePassword || undefined,
        expire_days: shareExpireDays,
      })
      setShareResult(res.data!)
      message.success('分享创建成功')
    } catch {}
  }

  const copyShareLink = () => {
    if (!shareResult) return
    const url = `${window.location.origin}/share/${shareResult.code}`
    navigator.clipboard.writeText(url)
    message.success('链接已复制到剪贴板')
  }

  const handleRenameSubmit = async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await renameFile({ file_id: renameTarget.id, new_name: renameValue.trim() })
      message.success('重命名成功')
      setShowRename(false)
      fileStore.loadFiles()
    } catch {}
  }

  const handleAction = (action: string, file: FileItem) => {
    if (action === 'rename') {
      setRenameTarget(file)
      setRenameValue(file.name)
      setShowRename(true)
    } else if (action === 'trash') {
      Modal.confirm({
        title: '删除确认',
        content: `确定要删除「${file.name}」吗？`,
        okText: '删除',
        okType: 'danger',
        onOk: async () => {
          await trashFile({ file_id: file.id })
          message.success('已移入回收站')
          fileStore.loadFiles()
        },
      })
    } else if (action === 'versions') {
      setVersionTarget(file)
      setShowVersions(true)
    }
  }

  // ==================== 搜索 ====================
  const handleSearchByKeyword = async (keyword: string) => {
    setSearchKeyword(keyword)
    setIsSearchMode(true)
    try {
      const res = await searchFiles(keyword)
      setSearchResults(res.data || [])
    } catch {
      setSearchResults([])
    }
  }

  const exitSearch = () => {
    setIsSearchMode(false)
    setSearchKeyword('')
    setSearchResults([])
    navigate('/files')
    fileStore.loadFiles(0)
  }

  // ==================== 列表列定义 ====================
  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: FileItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: 20, color: getFileColor(record.name, record.is_dir) }}>
            📁
          </span>
          <span className="text-ellipsis">{record.name}</span>
        </div>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (_: any, record: FileItem) =>
        record.is_dir ? '--' : formatFileSize(record.size),
    },
    {
      title: '修改时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (val: string) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: FileItem) => (
        <Space>
          {!record.is_dir && (
            <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleDownload(record) }}>
              下载
            </Button>
          )}
          <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleShare(record) }}>
            分享
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'rename', label: '重命名' },
                ...(!record.is_dir ? [{ key: 'versions', label: '版本历史' }] : []),
                { type: 'divider' as const },
                { key: 'trash', label: <span style={{ color: '#f5222d' }}>删除</span> },
              ],
              onClick: ({ key }) => handleAction(key, record),
            }}
            trigger={['click']}
          >
            <Button type="link" size="small" onClick={(e) => e.stopPropagation()}>更多</Button>
          </Dropdown>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ position: 'relative' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: 8 }}>
        <Breadcrumb
          items={[
            {
              title: (
                <a onClick={() => fileStore.goHome()}>
                  <HomeFilled /> 全部文件
                </a>
              ),
            },
            ...fileStore.breadcrumb.map((item) => ({
              title: <a onClick={() => fileStore.enterFolder(item.id)}>{item.name}</a>,
            })),
          ]}
        />
        <Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={triggerUpload}>
            上传文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
          <Button icon={<FolderAddOutlined />} onClick={() => setShowNewFolder(true)}>
            新建文件夹
          </Button>
          <Button
            icon={<CheckSquareOutlined />}
            onClick={() => { setIsMultiSelect(!isMultiSelect); setSelectedIds(new Set()) }}
          >
            {isMultiSelect ? '取消多选' : '多选'}
          </Button>
          <Button.Group>
            <Button
              type={fileStore.viewMode === 'grid' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              onClick={() => fileStore.setViewMode('grid')}
            />
            <Button
              type={fileStore.viewMode === 'list' ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              onClick={() => fileStore.setViewMode('list')}
            />
          </Button.Group>
        </Space>
      </div>

      {/* 批量操作栏 */}
      {isMultiSelect && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
          background: '#fdf6ec', border: '1px solid #faecd8', borderRadius: 8, marginBottom: 12,
        }}>
          <Checkbox
            checked={selectedIds.size > 0 && selectedIds.size === displayFiles.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < displayFiles.length}
            onChange={toggleSelectAll}
          >
            全选
          </Checkbox>
          <span style={{ fontSize: 14, color: '#e6a23c', fontWeight: 500 }}>已选 {selectedIds.size} 项</span>
          <Button danger size="small" disabled={selectedIds.size === 0} onClick={handleBatchTrash}>
            批量删除
          </Button>
          <Button size="small" onClick={() => { setIsMultiSelect(false); setSelectedIds(new Set()) }}>
            取消
          </Button>
        </div>
      )}

      {/* 搜索结果提示 */}
      {isSearchMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
          background: '#e6f7ff', borderRadius: 6, marginBottom: 12, fontSize: 14, color: '#1890ff',
        }}>
          <span>搜索 "{searchKeyword}" 的结果（{searchResults.length} 个）</span>
          <Button type="link" onClick={exitSearch}>清除搜索</Button>
        </div>
      )}

      {/* 加载状态 */}
      {fileStore.loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', color: '#909399' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>加载中...</p>
        </div>
      ) : displayFiles.length === 0 ? (
        <Empty description="暂无文件">
          <Button type="primary" onClick={triggerUpload}>上传文件</Button>
        </Empty>
      ) : fileStore.viewMode === 'grid' ? (
        /* 网格视图 */
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16,
        }}>
          {displayFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleClick(file)}
              onDoubleClick={() => handleDoubleClick(file)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '20px 12px 16px', background: '#fff', borderRadius: 10,
                cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
                border: selectedIds.has(file.id) ? '2px solid #1890ff' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12, color: getFileColor(file.name, file.is_dir) }}>
                {file.is_dir ? '📁' : '📄'}
              </div>
              <div className="text-ellipsis" title={file.name} style={{ fontSize: 13, color: '#303133', maxWidth: '100%', textAlign: 'center' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: '#909399', marginTop: 4 }}>
                {file.is_dir ? '--' : formatFileSize(file.size)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 列表视图 */
        <Table
          dataSource={displayFiles}
          columns={columns}
          rowKey="id"
          pagination={false}
          onRow={(record) => ({
            onDoubleClick: () => handleDoubleClick(record),
          })}
        />
      )}

      {/* 新建文件夹弹窗 */}
      <Modal
        title="新建文件夹"
        open={showNewFolder}
        onOk={handleCreateFolder}
        onCancel={() => setShowNewFolder(false)}
        width={400}
      >
        <Input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="请输入文件夹名称"
          onPressEnter={handleCreateFolder}
        />
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名"
        open={showRename}
        onOk={handleRenameSubmit}
        onCancel={() => setShowRename(false)}
        width={400}
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="请输入新名称"
          onPressEnter={handleRenameSubmit}
        />
      </Modal>

      {/* 分享弹窗 */}
      <Modal
        title="分享文件"
        open={showShare}
        onCancel={() => setShowShare(false)}
        width={460}
        footer={
          <Space>
            <Button onClick={() => setShowShare(false)}>关闭</Button>
            {!shareResult && (
              <Button type="primary" onClick={handleCreateShare}>创建分享</Button>
            )}
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <label>文件名：</label>
          <span>{shareTarget?.name}</span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>提取密码：</label>
          <Input
            value={sharePassword}
            onChange={(e) => setSharePassword(e.target.value)}
            placeholder="留空则无密码"
            maxLength={16}
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>有效期：</label>
          <Select
            value={shareExpireDays}
            onChange={setShareExpireDays}
            style={{ width: '100%', marginTop: 8 }}
            options={[
              { value: 0, label: '永久有效' },
              { value: 1, label: '1 天' },
              { value: 7, label: '7 天' },
              { value: 30, label: '30 天' },
            ]}
          />
        </div>
        {shareResult && (
          <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <p>分享链接已创建！</p>
            <p>分享码：<strong>{shareResult.code}</strong></p>
            <Button size="small" type="primary" onClick={copyShareLink}>复制链接</Button>
          </div>
        )}
      </Modal>

      {/* 文件预览 */}
      <FilePreview
        open={showPreview}
        file={previewFile}
        onClose={() => setShowPreview(false)}
      />

      {/* 文件版本历史 */}
      <FileVersions
        open={showVersions}
        file={versionTarget}
        onClose={() => setShowVersions(false)}
        onRestored={() => fileStore.loadFiles()}
      />

      {/* 上传进度 */}
      {uploadTasks.length > 0 && (
        <div style={{
          position: 'fixed', right: 24, bottom: 24, width: 360,
          background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: '#1890ff', color: '#fff', fontWeight: 500,
          }}>
            <span>上传列表 ({uploadTasks.length})</span>
            <Button type="link" style={{ color: '#fff' }} onClick={() => setUploadTasks([])}>清空</Button>
          </div>
          {uploadTasks.map((task, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', fontSize: 13, borderBottom: '1px solid #f0f0f0',
            }}>
              <span className="text-ellipsis" style={{ flex: 1 }}>{task.name}</span>
              {task.status === 'uploading' ? (
                <Progress percent={task.percent} size="small" style={{ width: 100 }} />
              ) : (
                <Tag color={task.status === 'done' ? 'success' : 'error'}>
                  {task.status === 'done' ? '完成' : '失败'}
                </Tag>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
