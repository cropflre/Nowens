import React from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React 错误边界 — 防止子组件崩溃导致白屏
 * 捕获渲染错误并显示友好的错误页面
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', background: 'var(--bg-secondary, #f5f7fa)',
        }}>
          <Result
            status="error"
            title="页面出现了问题"
            subTitle={
              <div>
                <p>很抱歉，页面发生了意外错误。请尝试刷新页面或返回首页。</p>
                {this.state.error && (
                  <details style={{ marginTop: 12, textAlign: 'left', maxWidth: 500 }}>
                    <summary style={{ cursor: 'pointer', color: '#909399', fontSize: 12 }}>
                      错误详情
                    </summary>
                    <pre style={{
                      marginTop: 8, padding: 12, background: '#f5f5f5',
                      borderRadius: 6, fontSize: 11, overflow: 'auto',
                      maxHeight: 200, color: '#f5222d',
                    }}>
                      {this.state.error.message}
                      {'\n'}
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            }
            extra={[
              <Button key="home" type="primary" onClick={this.handleReset}>
                返回首页
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
            ]}
          />
        </div>
      )
    }

    return this.props.children
  }
}
