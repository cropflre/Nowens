import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, Button, Input, Tag } from 'antd'
import {
  FolderOpenOutlined, LoadingOutlined,
  CloseCircleFilled, LockOutlined, DownloadOutlined,
} from '@ant-design/icons'
import type { FileItem, ShareLink, ShareDetail } from '@/types'
import { getShareInfo, verifySharePassword, getSharePreviewUrl, getShareDownloadUrl } from '@/api/share'
import { formatFileSize, getFileColor } from '@/utils'

export default function ShareView() {
  const { code = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [needPassword, setNeedPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [shareData, setShareData] = useState<ShareDetail | null>(null)
  const [fileInfo, setFileInfo] = useState<FileItem | null>(null)
  const [shareInfo, setShareInfo] = useState<ShareLink | null>(null)
  const [previewable, setPreviewable] = useState(false)
  const [previewType, setPreviewType] = useState('')
  const [previewSrc, setPreviewSrc] = useState('')
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    if (!code) {
      setErrorMsg('无效的分享链接')
      setLoading(false)
      return
    }
    loadShare()
  }, [code])

  const loadShare = async () => {
    try {
      const res = await getShareInfo(code)
      const data = res.data!
      setShareData(data)
      if (data.need_password) {
        setNeedPassword(true)
      } else {
        setFileData(data)
      }
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.msg || '分享链接不存在或已失效')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!password.trim()) return
    setVerifying(true)
    try {
      const res = await verifySharePassword(code, password)
      setNeedPassword(false)
      setFileData(res.data!)
    } catch {}
    finally { setVerifying(false) }
  }

  const setFileData = (data: ShareDetail) => {
    setFileInfo(data.file || null)
    setShareInfo(data.share || null)
    setPreviewable(data.previewable || false)
    setPreviewType(data.preview_type || '')

    if (data.previewable) {
      const src = getSharePreviewUrl(code, password || undefined)
      setPreviewSrc(src)
      if (data.preview_type === 'text') {
        fetch(src).then((r) => r.text()).then(setTextContent).catch(() => setTextContent('加载失败'))
      }
    }
  }

  const handleDownload = () => {
    const url = getShareDownloadUrl(code, password || undefined)
    const a = document.createElement('a')
    a.href = url
    a.download = fileInfo?.name || 'file'
    a.click()
  }

  const formatExpire = (expireAt: string) => {
    const date = new Date(expireAt)
    const now = new Date()
    if (date < now) return '已过期'
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 86400))
    if (diffDays <= 1) return '即将过期'
    return `${diffDays} 天后过期`
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 700, background: '#fff', borderRadius: 16,
        padding: 40, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <FolderOpenOutlined style={{ fontSize: 36, color: '#1890ff' }} />
          <h2 style={{ fontSize: 20, color: '#303133', margin: 0 }}>Nowen File 文件分享</h2>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: '#909399' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>加载中...</p>
          </div>
        ) : errorMsg ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <CloseCircleFilled style={{ fontSize: 48, color: '#f5222d' }} />
            <p style={{ marginTop: 12, color: '#909399' }}>{errorMsg}</p>
          </div>
        ) : needPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <LockOutlined style={{ fontSize: 48, color: '#faad14' }} />
            <h3 style={{ marginTop: 12 }}>{shareData?.file_name || '加密分享'}</h3>
            <p style={{ color: '#909399' }}>该文件已加密，请输入提取密码</p>
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入提取密码"
              style={{ maxWidth: 300, margin: '16px 0' }}
              size="large"
              onPressEnter={handleVerify}
            />
            <Button type="primary" size="large" onClick={handleVerify} loading={verifying}>
              提取文件
            </Button>
          </div>
        ) : fileInfo ? (
          <div>
            {/* 文件信息 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 56, color: getFileColor(fileInfo.name, fileInfo.is_dir) }}>
                {fileInfo.is_dir ? '📁' : '📄'}
              </div>
              <h3 style={{ margin: '12px 0 8px', fontSize: 18, textAlign: 'center', wordBreak: 'break-all' }}>
                {fileInfo.name}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tag>{formatFileSize(fileInfo.size)}</Tag>
                <Tag color="default">{fileInfo.mime_type || '未知类型'}</Tag>
              </div>
            </div>

            {/* 预览区域 */}
            {previewable && (
              <div style={{ margin: '16px 0', border: '1px solid #ebeef5', borderRadius: 8, overflow: 'hidden', background: '#fafafa' }}>
                {previewType === 'image' && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <img src={previewSrc} alt={fileInfo.name} style={{ maxWidth: '100%', maxHeight: 500, borderRadius: 4 }} />
                  </div>
                )}
                {previewType === 'video' && (
                  <div style={{ display: 'flex', justifyContent: 'center', background: '#000', padding: 8 }}>
                    <video controls src={previewSrc} style={{ maxWidth: '100%', maxHeight: '60vh' }} />
                  </div>
                )}
                {previewType === 'audio' && (
                  <div style={{ padding: 24 }}>
                    <audio controls src={previewSrc} style={{ width: '100%' }} />
                  </div>
                )}
                {previewType === 'pdf' && (
                  <iframe src={previewSrc} width="100%" height="500px" style={{ border: 'none' }} />
                )}
                {previewType === 'text' && (
                  <pre style={{ padding: 16, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13, lineHeight: 1.6 }}>
                    <code>{textContent}</code>
                  </pre>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 16px' }}>
              <Button type="primary" size="large" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载文件
              </Button>
            </div>

            {/* 分享信息 */}
            {shareInfo && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: 13, color: '#909399' }}>
                <span>查看 {shareInfo.view_count} 次</span>
                <span>·</span>
                <span>下载 {shareInfo.download_count} 次</span>
                {shareInfo.expire_at && (
                  <>
                    <span>·</span>
                    <span>{formatExpire(shareInfo.expire_at)}</span>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
