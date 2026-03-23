import { useState, useEffect } from 'react'
import { Card, Button, Steps, Input, message, QRCode, Alert, Space, Tag, Descriptions } from 'antd'
import { SafetyCertificateOutlined, LockOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { MFAStatus, MFASetupResponse } from '@/types'
import { getMFAStatus, setupMFA, verifyMFA, disableMFA } from '@/api/mfa'

export default function MFASetting() {
  const [status, setStatus] = useState<MFAStatus | null>(null)
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null)
  const [step, setStep] = useState(0)
  const [code, setCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [loading, setLoading] = useState(false)

  const loadStatus = async () => {
    try {
      const res = await getMFAStatus()
      if (res.code === 0 && res.data) {
        setStatus(res.data)
      }
    } catch {
      message.error('加载 MFA 状态失败')
    }
  }

  useEffect(() => { loadStatus() }, [])

  // 设置 MFA（生成密钥和二维码）
  const handleSetup = async () => {
    setLoading(true)
    try {
      const res = await setupMFA()
      if (res.code === 0 && res.data) {
        setSetupData(res.data)
        setStep(1)
      } else {
        message.error(res.msg || '设置失败')
      }
    } catch {
      message.error('设置失败')
    } finally {
      setLoading(false)
    }
  }

  // 验证并启用 MFA
  const handleVerify = async () => {
    if (code.length !== 6) {
      message.warning('请输入 6 位验证码')
      return
    }
    setLoading(true)
    try {
      const res = await verifyMFA(code)
      if (res.code === 0) {
        message.success('MFA 已启用')
        setStep(2)
        setCode('')
        loadStatus()
      } else {
        message.error(res.msg || '验证失败')
      }
    } catch {
      message.error('验证失败')
    } finally {
      setLoading(false)
    }
  }

  // 禁用 MFA
  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      message.warning('请输入 6 位验证码')
      return
    }
    setLoading(true)
    try {
      const res = await disableMFA(disableCode)
      if (res.code === 0) {
        message.success('MFA 已禁用')
        setDisableCode('')
        setSetupData(null)
        setStep(0)
        loadStatus()
      } else {
        message.error(res.msg || '禁用失败')
      }
    } catch {
      message.error('禁用失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ marginBottom: 24 }}>
        <SafetyCertificateOutlined /> 多因素认证（MFA）
      </h2>

      {/* 当前状态 */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={1}>
          <Descriptions.Item label="MFA 状态">
            {status?.enabled ? (
              <Tag icon={<CheckCircleOutlined />} color="success">已启用</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">未启用</Tag>
            )}
          </Descriptions.Item>
          {status?.enabled && status.created_at && (
            <Descriptions.Item label="启用时间">
              {new Date(status.created_at).toLocaleString()}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 未启用 MFA：设置流程 */}
      {!status?.enabled && (
        <Card title="启用 MFA 二次验证">
          <Steps
            current={step}
            style={{ marginBottom: 24 }}
            items={[
              { title: '开始' },
              { title: '扫描二维码' },
              { title: '完成' },
            ]}
          />

          {step === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ marginBottom: 16 }}>
                启用 MFA 后，每次登录时需要输入动态验证码，大大增强账号安全性。
              </p>
              <p style={{ marginBottom: 24, color: '#999' }}>
                请先在手机上安装 Google Authenticator、Microsoft Authenticator 或其他 TOTP 认证器。
              </p>
              <Button type="primary" size="large" icon={<LockOutlined />} onClick={handleSetup} loading={loading}>
                开始设置
              </Button>
            </div>
          )}

          {step === 1 && setupData && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Alert
                message="请使用认证器 App 扫描下方二维码"
                type="info"
                showIcon
                style={{ marginBottom: 16, textAlign: 'left' }}
              />

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <QRCode value={setupData.qrcode_url} size={200} />
              </div>

              <Alert
                message={
                  <span>
                    如果无法扫码，请手动输入密钥：<br />
                    <code style={{ fontSize: 14, fontWeight: 'bold', userSelect: 'all' }}>{setupData.secret}</code>
                  </span>
                }
                type="warning"
                style={{ marginBottom: 24, textAlign: 'left' }}
              />

              <p style={{ marginBottom: 8 }}>扫码完成后，请输入认证器上显示的 6 位数字验证码：</p>
              <Space>
                <Input
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  style={{ width: 160, fontSize: 20, textAlign: 'center', letterSpacing: 8 }}
                  onPressEnter={handleVerify}
                />
                <Button type="primary" onClick={handleVerify} loading={loading}>
                  验证并启用
                </Button>
              </Space>
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
              <h3>MFA 已成功启用！</h3>
              <p style={{ color: '#999' }}>下次登录时需要输入动态验证码。</p>
            </div>
          )}
        </Card>
      )}

      {/* 已启用 MFA：禁用操作 */}
      {status?.enabled && (
        <Card title="禁用 MFA">
          <Alert
            message="禁用 MFA 后，登录时将不再需要动态验证码。请谨慎操作。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Space>
            <Input
              placeholder="输入当前验证码"
              maxLength={6}
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
              style={{ width: 160 }}
            />
            <Button type="primary" danger onClick={handleDisable} loading={loading}>
              禁用 MFA
            </Button>
          </Space>
        </Card>
      )}
    </div>
  )
}
