import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Spin, Button, message, Modal, Select, Tag } from 'antd'
import { SaveOutlined, ArrowLeftOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import { getTextContent, saveTextContent } from '@/api/dashboard'

// 根据文件扩展名推断编辑器语言
function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', markdown: 'markdown',
    py: 'python', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    rs: 'rust', rb: 'ruby', php: 'php', sh: 'shell', bash: 'shell',
    sql: 'sql', graphql: 'graphql',
    vue: 'html', svelte: 'html',
    txt: 'plaintext', log: 'plaintext', csv: 'plaintext',
    ini: 'ini', toml: 'ini', env: 'plaintext',
    dockerfile: 'dockerfile',
  }
  return langMap[ext] || 'plaintext'
}

export default function FileEditor() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const uuid = searchParams.get('uuid') || ''
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const editorRef = useRef<any>(null)

  useEffect(() => {
    if (uuid) loadContent()
  }, [uuid])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, uuid])

  const loadContent = async () => {
    setLoading(true)
    try {
      const res = await getTextContent(uuid)
      const data = res.data
      if (!data) throw new Error('返回数据为空')
      setContent(data.content)
      setOriginalContent(data.content)
      setFileName(data.file.name)
      setLanguage(getLanguage(data.file.name))
      setHasChanges(false)
    } catch {
      message.error('加载文件内容失败')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!uuid || saving) return
    setSaving(true)
    try {
      await saveTextContent(uuid, content)
      message.success('保存成功（已自动创建版本历史）')
      setOriginalContent(content)
      setHasChanges(false)
    } catch {
      message.error('保存失败')
    }
    setSaving(false)
  }

  const handleEditorChange = (value: string | undefined) => {
    const v = value || ''
    setContent(v)
    setHasChanges(v !== originalContent)
  }

  const handleGoBack = () => {
    if (hasChanges) {
      Modal.confirm({
        title: '未保存的修改',
        content: '当前文件有未保存的修改，是否放弃？',
        okText: '放弃修改',
        okType: 'danger',
        cancelText: '继续编辑',
        onOk: () => navigate(-1),
      })
    } else {
      navigate(-1)
    }
  }

  if (!uuid) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#909399' }}>未指定文件</div>
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: isFullscreen ? '100vh' : 'calc(100vh - 108px)',
      position: isFullscreen ? 'fixed' : 'relative',
      inset: isFullscreen ? 0 : 'auto',
      zIndex: isFullscreen ? 1000 : 'auto',
      background: '#fff',
    }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid #ebeef5', background: '#fafafa',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
            返回
          </Button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#303133' }}>
            📝 {fileName}
          </span>
          {hasChanges && (
            <Tag color="orange">未保存</Tag>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            value={language}
            onChange={setLanguage}
            size="small"
            style={{ width: 130 }}
            options={[
              { value: 'plaintext', label: '纯文本' },
              { value: 'javascript', label: 'JavaScript' },
              { value: 'typescript', label: 'TypeScript' },
              { value: 'html', label: 'HTML' },
              { value: 'css', label: 'CSS' },
              { value: 'json', label: 'JSON' },
              { value: 'markdown', label: 'Markdown' },
              { value: 'python', label: 'Python' },
              { value: 'go', label: 'Go' },
              { value: 'java', label: 'Java' },
              { value: 'sql', label: 'SQL' },
              { value: 'xml', label: 'XML' },
              { value: 'yaml', label: 'YAML' },
              { value: 'shell', label: 'Shell' },
            ]}
          />
          <Button
            type="text"
            icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={() => setIsFullscreen(!isFullscreen)}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
          >
            保存 (Ctrl+S)
          </Button>
        </div>
      </div>

      {/* 编辑器 */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={content}
            onChange={handleEditorChange}
            theme="vs-dark"
            onMount={(editor) => { editorRef.current = editor }}
            options={{
              fontSize: 14,
              lineNumbers: 'on',
              minimap: { enabled: true },
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              smoothScrolling: true,
            }}
          />
        )}
      </div>
    </div>
  )
}
