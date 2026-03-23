package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"nowen-file/model"
	"strings"
	"time"
)

// WebhookService Webhook 通知服务
type WebhookService struct{}

// NewWebhookService 创建 Webhook 服务实例
func NewWebhookService() *WebhookService {
	return &WebhookService{}
}

// WebhookPayload Webhook 发送的消息载体
type WebhookPayload struct {
	Event     string      `json:"event"`     // 事件类型
	Timestamp int64       `json:"timestamp"` // 时间戳
	UserID    uint        `json:"user_id"`   // 操作用户
	Username  string      `json:"username"`  // 用户名
	Data      interface{} `json:"data"`      // 事件数据
}

// CreateWebhook 创建 Webhook 配置
func (s *WebhookService) CreateWebhook(userID uint, name, url, events, platform, secret string) (*model.WebhookConfig, error) {
	if name == "" || url == "" || events == "" {
		return nil, errors.New("名称、URL 和事件不能为空")
	}

	// 验证事件类型
	validEvents := map[string]bool{
		"upload": true, "download": true, "delete": true,
		"share": true, "trash": true, "restore": true,
		"rename": true, "move": true, "encrypt": true,
	}
	for _, ev := range strings.Split(events, ",") {
		if !validEvents[strings.TrimSpace(ev)] {
			return nil, fmt.Errorf("不支持的事件类型: %s", ev)
		}
	}

	if platform == "" {
		platform = "custom"
	}

	webhook := &model.WebhookConfig{
		UserID:   userID,
		Name:     name,
		URL:      url,
		Secret:   secret,
		Events:   events,
		Platform: platform,
		Enabled:  true,
	}

	if err := model.DB.Create(webhook).Error; err != nil {
		return nil, errors.New("创建 Webhook 失败")
	}
	return webhook, nil
}

// ListWebhooks 获取用户的 Webhook 列表
func (s *WebhookService) ListWebhooks(userID uint) ([]model.WebhookConfig, error) {
	var webhooks []model.WebhookConfig
	if err := model.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&webhooks).Error; err != nil {
		return nil, errors.New("查询 Webhook 失败")
	}
	return webhooks, nil
}

// UpdateWebhook 更新 Webhook 配置
func (s *WebhookService) UpdateWebhook(userID uint, id uint, updates map[string]interface{}) error {
	result := model.DB.Model(&model.WebhookConfig{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(updates)
	if result.RowsAffected == 0 {
		return errors.New("Webhook 不存在")
	}
	return result.Error
}

// DeleteWebhook 删除 Webhook 配置
func (s *WebhookService) DeleteWebhook(userID uint, id uint) error {
	result := model.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&model.WebhookConfig{})
	if result.RowsAffected == 0 {
		return errors.New("Webhook 不存在")
	}
	return result.Error
}

// TriggerEvent 触发事件（异步发送到所有匹配的 Webhook）
func (s *WebhookService) TriggerEvent(userID uint, username string, event string, data interface{}) {
	go func() {
		var webhooks []model.WebhookConfig
		model.DB.Where("user_id = ? AND enabled = ?", userID, true).Find(&webhooks)

		payload := WebhookPayload{
			Event:     event,
			Timestamp: time.Now().Unix(),
			UserID:    userID,
			Username:  username,
			Data:      data,
		}

		for _, wh := range webhooks {
			// 检查事件是否在监听列表中
			events := strings.Split(wh.Events, ",")
			matched := false
			for _, ev := range events {
				if strings.TrimSpace(ev) == event {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}

			// 根据平台类型构建消息并发送
			s.sendWebhook(&wh, &payload)
		}
	}()
}

// sendWebhook 发送 Webhook 请求
func (s *WebhookService) sendWebhook(wh *model.WebhookConfig, payload *WebhookPayload) {
	var body []byte
	var err error

	switch wh.Platform {
	case "wechat_work":
		body, err = s.buildWechatWorkMessage(payload)
	case "dingtalk":
		body, err = s.buildDingtalkMessage(payload)
	case "slack":
		body, err = s.buildSlackMessage(payload)
	case "feishu":
		body, err = s.buildFeishuMessage(payload)
	default:
		body, err = json.Marshal(payload)
	}

	if err != nil {
		log.Printf("[Webhook] 构建消息失败: %s, err: %v", wh.Name, err)
		return
	}

	req, err := http.NewRequest("POST", wh.URL, bytes.NewReader(body))
	if err != nil {
		log.Printf("[Webhook] 创建请求失败: %s, err: %v", wh.Name, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Nowen-File-Webhook/1.0")

	// 添加 HMAC 签名（如果配置了密钥）
	if wh.Secret != "" {
		mac := hmac.New(sha256.New, []byte(wh.Secret))
		mac.Write(body)
		signature := hex.EncodeToString(mac.Sum(nil))
		req.Header.Set("X-Webhook-Signature", signature)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[Webhook] 发送失败: %s → %s, err: %v", wh.Name, wh.URL, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("[Webhook] 响应异常: %s → %s, status: %d", wh.Name, wh.URL, resp.StatusCode)
	} else {
		log.Printf("[Webhook] 发送成功: %s → %s (%s)", wh.Name, wh.URL, payload.Event)
	}
}

// 事件描述映射
func eventDescription(event string) string {
	m := map[string]string{
		"upload": "上传了文件", "download": "下载了文件", "delete": "删除了文件",
		"share": "分享了文件", "trash": "移入回收站", "restore": "从回收站恢复",
		"rename": "重命名了文件", "move": "移动了文件", "encrypt": "加密/解密了文件",
	}
	if desc, ok := m[event]; ok {
		return desc
	}
	return event
}

// buildWechatWorkMessage 构建企业微信消息
func (s *WebhookService) buildWechatWorkMessage(payload *WebhookPayload) ([]byte, error) {
	content := fmt.Sprintf("📁 Nowen File 通知\n\n事件: %s\n用户: %s\n时间: %s",
		eventDescription(payload.Event), payload.Username,
		time.Unix(payload.Timestamp, 0).Format("2006-01-02 15:04:05"))
	if data, ok := payload.Data.(map[string]interface{}); ok {
		if name, ok := data["file_name"].(string); ok {
			content += fmt.Sprintf("\n文件: %s", name)
		}
	}
	msg := map[string]interface{}{
		"msgtype": "text",
		"text":    map[string]string{"content": content},
	}
	return json.Marshal(msg)
}

// buildDingtalkMessage 构建钉钉消息
func (s *WebhookService) buildDingtalkMessage(payload *WebhookPayload) ([]byte, error) {
	content := fmt.Sprintf("📁 Nowen File 通知\n\n事件: %s\n用户: %s\n时间: %s",
		eventDescription(payload.Event), payload.Username,
		time.Unix(payload.Timestamp, 0).Format("2006-01-02 15:04:05"))
	if data, ok := payload.Data.(map[string]interface{}); ok {
		if name, ok := data["file_name"].(string); ok {
			content += fmt.Sprintf("\n文件: %s", name)
		}
	}
	msg := map[string]interface{}{
		"msgtype": "text",
		"text":    map[string]string{"content": content},
	}
	return json.Marshal(msg)
}

// buildSlackMessage 构建 Slack 消息
func (s *WebhookService) buildSlackMessage(payload *WebhookPayload) ([]byte, error) {
	text := fmt.Sprintf(":file_folder: *Nowen File 通知*\n\n*事件*: %s\n*用户*: %s\n*时间*: %s",
		eventDescription(payload.Event), payload.Username,
		time.Unix(payload.Timestamp, 0).Format("2006-01-02 15:04:05"))
	if data, ok := payload.Data.(map[string]interface{}); ok {
		if name, ok := data["file_name"].(string); ok {
			text += fmt.Sprintf("\n*文件*: %s", name)
		}
	}
	msg := map[string]interface{}{"text": text}
	return json.Marshal(msg)
}

// buildFeishuMessage 构建飞书消息
func (s *WebhookService) buildFeishuMessage(payload *WebhookPayload) ([]byte, error) {
	content := fmt.Sprintf("📁 Nowen File 通知\n\n事件: %s\n用户: %s\n时间: %s",
		eventDescription(payload.Event), payload.Username,
		time.Unix(payload.Timestamp, 0).Format("2006-01-02 15:04:05"))
	if data, ok := payload.Data.(map[string]interface{}); ok {
		if name, ok := data["file_name"].(string); ok {
			content += fmt.Sprintf("\n文件: %s", name)
		}
	}
	msg := map[string]interface{}{
		"msg_type": "text",
		"content":  map[string]string{"text": content},
	}
	return json.Marshal(msg)
}

// TestWebhook 测试 Webhook 连通性
func (s *WebhookService) TestWebhook(userID uint, id uint) error {
	var wh model.WebhookConfig
	if err := model.DB.Where("id = ? AND user_id = ?", id, userID).First(&wh).Error; err != nil {
		return errors.New("Webhook 不存在")
	}

	payload := &WebhookPayload{
		Event:     "test",
		Timestamp: time.Now().Unix(),
		UserID:    userID,
		Username:  "测试用户",
		Data: map[string]interface{}{
			"message":   "这是一条测试消息",
			"file_name": "测试文件.txt",
		},
	}

	s.sendWebhook(&wh, payload)
	return nil
}
