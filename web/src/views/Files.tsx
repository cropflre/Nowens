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
  LoadingOutlined, StarOutlined, StarFilled, TagsOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons'
import { useFileStore } from '@/stores/file'
import type { FileItem, ShareLink, Tag as TagType } from '@/types'
import { formatFileSize, formatDate, getFileIcon, getFileColor } from '@/utils'
import {
  createFolder, uploadFile, renameFile, trashFile,
  searchFiles, getDownloadUrl, batchTrash, batchDownload, smartUpload, copyFile,
} from '@/api/file'
import { createShare } from '@/api/share'
import { addFavorite, removeFavorite, checkFavorite } from '@/api/favorite'
import { getTags, tagFile, untagFile, getFileTags } from '@/api/tag'
import { encryptFile, decryptFile } from '@/api/encryption'
import { fullTextSearch, type FullTextSearchResult } from '@/api/search'
import FilePreview from '@/components/FilePreview'
import FileVersions from '@/components/FileVersions'
import FileComments from '@/components/FileComments'

// 判断文件是否支持在线编辑
function isTextEditable(mimeType: string): boolean {
  if (!mimeType) return false
  if (mimeType.startsWith('text/')) return true
  return ['application/json', 'application/xml', 'application/javascript', 'application/x-yaml'].includes(mimeType)
}

export default function Files() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileStore = useFileStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

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
  const [fullTextResults, setFullTextResults] = useState<FullTextSearchResult[]>([])
  const [isFullTextSearch, setIsFullTextSearch] = useState(false)

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

  // 收藏状态
  const [favoritedIds, setFavoritedIds] = useState<Set<number>>(new Set())

  // 标签
  const [showTagModal, setShowTagModal] = useState(false)
  const [tagTarget, setTagTarget] = useState<FileItem | null>(null)
  const [allTags, setAllTags] = useState<TagType[]>([])
  const [fileTags, setFileTags] = useState<TagType[]>([])

  // 加密
  const [showEncrypt, setShowEncrypt] = useState(false)
  const [encryptTarget, setEncryptTarget] = useState<FileItem | null>(null)
  const [encryptPassword, setEncryptPassword] = useState('')
  const [encryptAction, setEncryptAction] = useState<'encrypt' | 'decrypt'>('encrypt')

  // 评论
  const [showComments, setShowComments] = useState(false)
  const [commentTarget, setCommentTarget] = useState<FileItem | null>(null)

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

  // 收藏：切换收藏状态
  const handleToggleFavorite = async (file: FileItem) => {
    try {
      if (favoritedIds.has(file.id)) {
        await removeFavorite(file.id)
        setFavoritedIds((prev) => { const next = new Set(prev); next.delete(file.id); return next })
        message.success('已取消收藏')
      } else {
        await addFavorite(file.id)
        setFavoritedIds((prev) => new Set(prev).add(file.id))
        message.success('已收藏')
      }
    } catch {}
  }

  // 标签：打开标签弹窗
  const handleOpenTagModal = async (file: FileItem) => {
    setTagTarget(file)
    setShowTagModal(true)
    try {
      const [tagsRes, fileTagsRes] = await Promise.all([
        getTags(),
        getFileTags(file.id),
      ])
      setAllTags(tagsRes.data || [])
      setFileTags(fileTagsRes.data || [])
    } catch {}
  }

  const handleTagFile = async (tagId: number) => {
    if (!tagTarget) return
    try {
      await tagFile({ file_id: tagTarget.id, tag_id: tagId })
      const res = await getFileTags(tagTarget.id)
      setFileTags(res.data || [])
      message.success('标签已添加')
    } catch {}
  }

  const handleUntagFile = async (tagId: number) => {
    if (!tagTarget) return
    try {
      await untagFile(tagTarget.id, tagId)
      setFileTags((prev) => prev.filter((t) => t.id !== tagId))
      message.success('标签已移除')
    } catch {}
  }

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

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return
    try {
      message.loading({ content: '正在打包下载...', key: 'batch-download', duration: 0 })
      const res = await batchDownload(Array.from(selectedIds))
      // 触发下载
      const blob = new Blob([res as any], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `批量下载_${selectedIds.size}个文件.zip`
      a.click()
      URL.revokeObjectURL(url)
      message.success({ content: '下载完成', key: 'batch-download' })
    } catch {
      message.error({ content: '打包下载失败', key: 'batch-download' })
    }
  }

  const triggerUpload = () => fileInputRef.current?.click()
  const triggerFolderUpload = () => folderInputRef.current?.click()

  // 拖拽上传
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const items = e.dataTransfer.items
    if (!items || items.length === 0) return

    const files: File[] = []

    // 支持拖拽文件夹（通过 webkitGetAsEntry API）
    const readEntry = async (entry: any, path: string = ''): Promise<void> => {
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve))
        // 保留相对路径，供后续创建文件夹结构
        Object.defineProperty(file, 'webkitRelativePath', { value: path + file.name, writable: false })
        files.push(file)
      } else if (entry.isDirectory) {
        const reader = entry.createReader()
        const entries: any[] = await new Promise((resolve) => reader.readEntries(resolve))
        for (const child of entries) {
          await readEntry(child, path + entry.name + '/')
        }
      }
    }

    // 尝试获取 FileSystemEntry
    const entries: any[] = []
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.()
      if (entry) entries.push(entry)
    }

    if (entries.length > 0) {
      for (const entry of entries) {
        await readEntry(entry)
      }
    } else {
      // 回退到普通文件列表
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i])
      }
    }

    if (files.length > 0) {
      processUploadFiles(files)
    }
  }

  // 文件夹上传
  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    processUploadFiles(Array.from(files))
    e.target.value = ''
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    processUploadFiles(Array.from(files))
    e.target.value = ''
  }

  // 通用上传处理（支持普通上传和分片上传）
  const processUploadFiles = async (files: File[]) => {
    const tasks: UploadTask[] = []
    for (const file of files) {
      const task: UploadTask = { name: file.name, percent: 0, status: 'uploading' }
      tasks.push(task)
    }
    setUploadTasks((prev) => [...prev, ...tasks])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // 使用智能上传（小文件直传，大文件分片）
        await smartUpload(fileStore.currentParentId, file, (percent) => {
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

  const handleAction = async (action: string, file: FileItem) => {
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
    } else if (action === 'favorite') {
      handleToggleFavorite(file)
    } else if (action === 'tag') {
      handleOpenTagModal(file)
    } else if (action === 'edit') {
      navigate(`/editor?uuid=${file.uuid}`)
    } else if (action === 'copy') {
      try {
        await copyFile({ file_id: file.id, target_id: fileStore.currentParentId })
        message.success('复制成功')
        fileStore.loadFiles()
      } catch {}
    } else if (action === 'comment') {
      setCommentTarget(file)
      setShowComments(true)
    } else if (action === 'encrypt') {
      setEncryptTarget(file)
      setEncryptAction('encrypt')
      setEncryptPassword('')
      setShowEncrypt(true)
    } else if (action === 'decrypt') {
      setEncryptTarget(file)
      setEncryptAction('decrypt')
      setEncryptPassword('')
      setShowEncrypt(true)
    }
  }

  // ==================== 搜索 ====================
  const handleSearchByKeyword = async (keyword: string) => {
    setSearchKeyword(keyword)
    setIsSearchMode(true)
    try {
      if (isFullTextSearch) {
        // 全文搜索
        const res = await fullTextSearch(keyword)
        setFullTextResults(res.data?.list || [])
        setSearchResults([])
      } else {
        // 普通文件名搜索
        const res = await searchFiles(keyword)
        setSearchResults(res.data || [])
        setFullTextResults([])
      }
    } catch {
      setSearchResults([])
      setFullTextResults([])
    }
  }

  const exitSearch = () => {
    setIsSearchMode(false)
    setSearchKeyword('')
    setSearchResults([])
    setFullTextResults([])
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
          {record.is_encrypted && <LockOutlined style={{ color: '#faad14', fontSize: 12 }} title="已加密" />}
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
                ...(!record.is_dir && isTextEditable(record.mime_type) ? [{ key: 'edit', label: '在线编辑', icon: <EditOutlined /> }] : []),
                ...(!record.is_dir && !record.is_encrypted ? [{ key: 'encrypt', label: '加密文件', icon: <LockOutlined /> }] : []),
                ...(!record.is_dir && record.is_encrypted ? [{ key: 'decrypt', label: '解密文件', icon: <UnlockOutlined /> }] : []),
                { key: 'copy', label: '复制' },
                { key: 'comment', label: '评论' },
                { key: 'favorite', label: favoritedIds.has(record.id) ? '取消收藏' : '收藏', icon: favoritedIds.has(record.id) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined /> },
                { key: 'tag', label: '管理标签', icon: <TagsOutlined /> },
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
    <div
      style={{ position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 拖拽上传遮罩层 */}
      {isDragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999,
          background: 'rgba(24, 144, 255, 0.08)', border: '3px dashed #1890ff',
          borderRadius: 12, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <UploadOutlined style={{ fontSize: 64, color: '#1890ff' }} />
          <p style={{ fontSize: 18, color: '#1890ff', marginTop: 16, fontWeight: 500 }}>
            松开鼠标上传文件
          </p>
          <p style={{ fontSize: 13, color: '#909399' }}>支持拖拽文件和文件夹</p>
        </div>
      )}
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
          <Button icon={<FolderAddOutlined />} onClick={triggerFolderUpload}>
            上传文件夹
          </Button>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            /* @ts-ignore */
            directory=""
            webkitdirectory=""
            style={{ display: 'none' }}
            onChange={handleFolderSelected}
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
          <Button type="primary" size="small" disabled={selectedIds.size === 0} icon={<DownloadOutlined />} onClick={handleBatchDownload}>
            批量下载
          </Button>
          <Button size="small" onClick={() => { setIsMultiSelect(false); setSelectedIds(new Set()) }}>
            取消
          </Button>
        </div>
      )}

      {/* 搜索结果提示 */}
      {isSearchMode && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
            background: '#e6f7ff', borderRadius: 6, fontSize: 14, color: '#1890ff',
          }}>
            <span>
              {isFullTextSearch ? '全文搜索' : '搜索'} "{searchKeyword}" 的结果
              （{isFullTextSearch ? fullTextResults.length : searchResults.length} 个）
            </span>
            <Button type="link" size="small" onClick={() => {
              setIsFullTextSearch(!isFullTextSearch)
              handleSearchByKeyword(searchKeyword)
            }}>
              切换到{isFullTextSearch ? '文件名搜索' : '全文搜索'}
            </Button>
            <Button type="link" onClick={exitSearch}>清除搜索</Button>
          </div>

          {/* 全文搜索结果列表 */}
          {isFullTextSearch && fullTextResults.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {fullTextResults.map((item) => (
                <div
                  key={item.file_id}
                  style={{
                    padding: '10px 14px', background: '#fff', borderRadius: 8,
                    marginBottom: 6, border: '1px solid #f0f0f0', cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ fontWeight: 500, fontSize: 14, color: '#303133' }}>
                    {item.file_name}
                  </div>
                  {item.highlight && (
                    <div
                      style={{ fontSize: 12, color: '#606266', marginTop: 4, lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: item.highlight }}
                    />
                  )}
                  <div style={{ fontSize: 11, color: '#c0c4cc', marginTop: 4 }}>
                    匹配度: {item.score.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* 标签管理弹窗 */}
      <Modal
        title={<span><TagsOutlined /> 管理标签 - {tagTarget?.name}</span>}
        open={showTagModal}
        onCancel={() => setShowTagModal(false)}
        footer={<Button onClick={() => setShowTagModal(false)}>关闭</Button>}
        width={420}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#909399', marginBottom: 8 }}>已添加的标签：</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {fileTags.length === 0 ? (
              <span style={{ color: '#c0c4cc', fontSize: 13 }}>暂无标签</span>
            ) : (
              fileTags.map((tag) => (
                <Tag
                  key={tag.id}
                  closable
                  color={tag.color}
                  onClose={() => handleUntagFile(tag.id)}
                >
                  {tag.name}
                </Tag>
              ))
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#909399', marginBottom: 8 }}>点击添加标签：</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allTags
              .filter((t) => !fileTags.some((ft) => ft.id === t.id))
              .map((tag) => (
                <Tag
                  key={tag.id}
                  style={{ cursor: 'pointer' }}
                  color={tag.color}
                  onClick={() => handleTagFile(tag.id)}
                >
                  + {tag.name}
                </Tag>
              ))}
            {allTags.filter((t) => !fileTags.some((ft) => ft.id === t.id)).length === 0 && (
              <span style={{ color: '#c0c4cc', fontSize: 13 }}>没有更多标签可添加</span>
            )}
          </div>
        </div>
      </Modal>

      {/* 加密/解密弹窗 */}
      <Modal
        title={<span>{encryptAction === 'encrypt' ? <><LockOutlined /> 加密文件</> : <><UnlockOutlined /> 解密文件</>} - {encryptTarget?.name}</span>}
        open={showEncrypt}
        onCancel={() => setShowEncrypt(false)}
        onOk={async () => {
          if (!encryptTarget || !encryptPassword) {
            message.warning('请输入密码')
            return
          }
          if (encryptPassword.length < 6) {
            message.warning('密码至少 6 位')
            return
          }
          try {
            if (encryptAction === 'encrypt') {
              await encryptFile({ file_id: encryptTarget.id, password: encryptPassword })
              message.success('文件已加密')
            } else {
              await decryptFile({ file_id: encryptTarget.id, password: encryptPassword })
              message.success('文件已解密')
            }
            setShowEncrypt(false)
            fileStore.loadFiles()
          } catch {}
        }}
        okText={encryptAction === 'encrypt' ? '加密' : '解密'}
        width={400}
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: '#909399' }}>
          {encryptAction === 'encrypt'
            ? '文件将使用 AES-256-GCM 加密存储。请牢记密码，遗忘后无法恢复！'
            : '请输入加密时设置的密码来解密此文件。'}
        </div>
        <Input.Password
          value={encryptPassword}
          onChange={(e) => setEncryptPassword(e.target.value)}
          placeholder={encryptAction === 'encrypt' ? '设置加密密码（至少6位）' : '输入解密密码'}
          size="large"
          onPressEnter={() => {/* 由 onOk 处理 */}}
        />
        {encryptAction === 'encrypt' && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, fontSize: 12, color: '#d48806' }}>
            ⚠️ 加密后文件将无法预览和在线编辑，需要解密后才能正常使用。
          </div>
        )}
      </Modal>

      {/* 文件评论 */}
      <FileComments
        open={showComments}
        fileId={commentTarget?.id ?? null}
        fileName={commentTarget?.name || ''}
        onClose={() => setShowComments(false)}
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
