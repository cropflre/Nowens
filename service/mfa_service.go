package service

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"nowen-file/model"
	"strings"
	"time"

	"crypto/rand"
)

// MFAService 多因素认证服务
type MFAService struct{}

// NewMFAService 创建 MFA 服务实例
func NewMFAService() *MFAService {
	return &MFAService{}
}

// MFASetupResponse MFA 设置响应
type MFASetupResponse struct {
	Secret    string `json:"secret"`     // Base32 编码的密钥
	QRCodeURL string `json:"qrcode_url"` // otpauth:// URI（前端用于生成二维码）
}

// GenerateSecret 生成 TOTP 密钥
func (s *MFAService) GenerateSecret() (string, error) {
	// 生成 20 字节随机密钥
	secret := make([]byte, 20)
	if _, err := rand.Read(secret); err != nil {
		return "", errors.New("生成密钥失败")
	}
	// Base32 编码（去除填充符）
	return strings.TrimRight(base32.StdEncoding.EncodeToString(secret), "="), nil
}

// SetupMFA 为用户设置 MFA（生成密钥，返回二维码 URI）
func (s *MFAService) SetupMFA(userID uint, username string) (*MFASetupResponse, error) {
	// 检查是否已有 MFA 配置
	var existing model.UserMFA
	if err := model.DB.Where("user_id = ?", userID).First(&existing).Error; err == nil {
		if existing.Enabled {
			return nil, errors.New("MFA 已启用，请先禁用后重新设置")
		}
		// 已存在未启用的，删除旧的重新生成
		model.DB.Delete(&existing)
	}

	secret, err := s.GenerateSecret()
	if err != nil {
		return nil, err
	}

	mfa := &model.UserMFA{
		UserID:   userID,
		Secret:   secret,
		Enabled:  false,
		Verified: false,
	}
	if err := model.DB.Create(mfa).Error; err != nil {
		return nil, errors.New("保存 MFA 配置失败")
	}

	// 构建 otpauth URI
	issuer := "NowenFile"
	qrURL := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&digits=6&period=30",
		issuer, username, secret, issuer)

	return &MFASetupResponse{
		Secret:    secret,
		QRCodeURL: qrURL,
	}, nil
}

// VerifyAndEnableMFA 验证 TOTP 码并启用 MFA
func (s *MFAService) VerifyAndEnableMFA(userID uint, code string) error {
	var mfa model.UserMFA
	if err := model.DB.Where("user_id = ?", userID).First(&mfa).Error; err != nil {
		return errors.New("请先设置 MFA")
	}

	if mfa.Enabled {
		return errors.New("MFA 已启用")
	}

	if !s.VerifyTOTP(mfa.Secret, code) {
		return errors.New("验证码错误，请重新输入")
	}

	model.DB.Model(&mfa).Updates(map[string]interface{}{
		"enabled":  true,
		"verified": true,
	})

	return nil
}

// DisableMFA 禁用 MFA
func (s *MFAService) DisableMFA(userID uint, code string) error {
	var mfa model.UserMFA
	if err := model.DB.Where("user_id = ? AND enabled = ?", userID, true).First(&mfa).Error; err != nil {
		return errors.New("MFA 未启用")
	}

	if !s.VerifyTOTP(mfa.Secret, code) {
		return errors.New("验证码错误")
	}

	model.DB.Delete(&mfa)
	return nil
}

// ValidateMFA 验证登录时的 MFA 码
func (s *MFAService) ValidateMFA(userID uint, code string) error {
	var mfa model.UserMFA
	if err := model.DB.Where("user_id = ? AND enabled = ?", userID, true).First(&mfa).Error; err != nil {
		return nil // 未启用 MFA，直接通过
	}

	if !s.VerifyTOTP(mfa.Secret, code) {
		return errors.New("MFA 验证码错误")
	}

	return nil
}

// IsMFAEnabled 检查用户是否启用了 MFA
func (s *MFAService) IsMFAEnabled(userID uint) bool {
	var mfa model.UserMFA
	if err := model.DB.Where("user_id = ? AND enabled = ?", userID, true).First(&mfa).Error; err != nil {
		return false
	}
	return true
}

// GetMFAStatus 获取用户的 MFA 状态
func (s *MFAService) GetMFAStatus(userID uint) map[string]interface{} {
	var mfa model.UserMFA
	if err := model.DB.Where("user_id = ?", userID).First(&mfa).Error; err != nil {
		return map[string]interface{}{
			"enabled": false,
			"setup":   false,
		}
	}
	return map[string]interface{}{
		"enabled":    mfa.Enabled,
		"setup":      true,
		"created_at": mfa.CreatedAt,
	}
}

// VerifyTOTP 验证 TOTP 码（允许前后 1 个时间窗口偏移）
func (s *MFAService) VerifyTOTP(secret string, code string) bool {
	if len(code) != 6 {
		return false
	}

	// 补全 Base32 填充
	padding := (8 - len(secret)%8) % 8
	secret = secret + strings.Repeat("=", padding)

	key, err := base32.StdEncoding.DecodeString(strings.ToUpper(secret))
	if err != nil {
		return false
	}

	now := time.Now().Unix()
	// 检查当前时间窗口及前后各 1 个窗口
	for _, offset := range []int64{-1, 0, 1} {
		counter := (now / 30) + offset
		if generateTOTP(key, counter) == code {
			return true
		}
	}
	return false
}

// generateTOTP 根据密钥和计数器生成 6 位 TOTP 码
func generateTOTP(key []byte, counter int64) string {
	// 将计数器转为 8 字节大端序
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))

	// HMAC-SHA1
	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	hash := mac.Sum(nil)

	// 动态截断
	offset := hash[len(hash)-1] & 0x0f
	code := int64(binary.BigEndian.Uint32(hash[offset:offset+4]) & 0x7fffffff)

	// 取模得到 6 位数字
	otp := code % int64(math.Pow10(6))
	return fmt.Sprintf("%06d", otp)
}
