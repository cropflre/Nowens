package service

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"nowen-file/model"

	"gorm.io/gorm"
)

// EncryptionService 文件加密服务
type EncryptionService struct{}

// NewEncryptionService 创建加密服务
func NewEncryptionService() *EncryptionService {
	return &EncryptionService{}
}

// deriveKey 从密码派生 256 位 AES 密钥（使用 SHA-256）
func deriveKey(password string) []byte {
	hash := sha256.Sum256([]byte(password))
	return hash[:]
}

// Encrypt 加密数据 (AES-256-GCM)
func (s *EncryptionService) Encrypt(data []byte, password string) ([]byte, error) {
	key := deriveKey(password)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("创建加密器失败: %v", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("创建 GCM 失败: %v", err)
	}

	// 生成随机 nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("生成随机数失败: %v", err)
	}

	// 加密: nonce + ciphertext (nonce 会作为前缀附加)
	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return ciphertext, nil
}

// Decrypt 解密数据
func (s *EncryptionService) Decrypt(data []byte, password string) ([]byte, error) {
	key := deriveKey(password)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("创建解密器失败: %v", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("创建 GCM 失败: %v", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("密文数据不完整")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("解密失败，密码可能不正确")
	}

	return plaintext, nil
}

// EncryptReader 加密 Reader 中的数据并返回加密后的 Reader
func (s *EncryptionService) EncryptReader(reader io.Reader, password string) (io.Reader, int64, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, 0, fmt.Errorf("读取数据失败: %v", err)
	}

	encrypted, err := s.Encrypt(data, password)
	if err != nil {
		return nil, 0, err
	}

	return bytes.NewReader(encrypted), int64(len(encrypted)), nil
}

// DecryptReader 解密 Reader 中的数据并返回解密后的 Reader
func (s *EncryptionService) DecryptReader(reader io.Reader, password string) (io.Reader, int64, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, 0, fmt.Errorf("读取数据失败: %v", err)
	}

	decrypted, err := s.Decrypt(data, password)
	if err != nil {
		return nil, 0, err
	}

	return bytes.NewReader(decrypted), int64(len(decrypted)), nil
}

// SetFileEncrypted 标记文件为加密状态（在文件记录中标记）
func (s *EncryptionService) SetFileEncrypted(fileID uint, encrypted bool) error {
	return model.DB.Model(&model.FileItem{}).Where("id = ?", fileID).
		Update("is_encrypted", encrypted).Error
}

// IsFileEncrypted 检查文件是否加密
func (s *EncryptionService) IsFileEncrypted(fileID uint) bool {
	var file model.FileItem
	if err := model.DB.Select("is_encrypted").First(&file, fileID).Error; err != nil {
		return false
	}
	return file.IsEncrypted
}

// VerifyEncryptionPassword 验证加密密码（通过尝试解密前 64 字节）
func (s *EncryptionService) VerifyEncryptionPassword(reader io.ReadCloser, password string) bool {
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil {
		return false
	}
	_, err = s.Decrypt(data, password)
	return err == nil
}

// EncryptAndSaveFile 加密上传文件
func (s *EncryptionService) EncryptAndSaveFile(
	fileService *FileService,
	userID uint,
	fileID uint,
	password string,
) error {
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return errors.New("文件不存在")
	}

	if file.IsDir {
		return errors.New("不能加密文件夹")
	}

	if file.IsEncrypted {
		return errors.New("文件已经是加密状态")
	}

	// 限制加密文件大小 (100MB)
	if file.Size > 100*1024*1024 {
		return errors.New("文件过大，最大支持 100MB 加密")
	}

	// 读取原始文件
	reader, err := fileService.GetFileReader(&file)
	if err != nil {
		return fmt.Errorf("读取文件失败: %v", err)
	}
	defer reader.Close()

	// 加密
	encReader, encSize, err := s.EncryptReader(reader, password)
	if err != nil {
		return fmt.Errorf("加密失败: %v", err)
	}

	// 写回存储（覆盖原文件）
	if err := fileService.GetStorage().Put(file.StorePath, encReader, encSize); err != nil {
		return fmt.Errorf("保存加密文件失败: %v", err)
	}

	// 更新文件记录
	model.DB.Model(&file).Updates(map[string]interface{}{
		"is_encrypted": true,
		"size":         encSize,
	})

	// 更新用户存储使用量差值
	diff := encSize - file.Size
	if diff != 0 {
		model.DB.Model(&model.User{}).Where("id = ?", userID).
			Update("storage_used", gorm.Expr("storage_used + ?", diff))
	}

	return nil
}

// DecryptAndSaveFile 解密文件
func (s *EncryptionService) DecryptAndSaveFile(
	fileService *FileService,
	userID uint,
	fileID uint,
	password string,
) error {
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ? AND is_encrypted = ?", fileID, userID, true).
		First(&file).Error; err != nil {
		return errors.New("加密文件不存在")
	}

	// 读取加密文件
	reader, err := fileService.GetFileReader(&file)
	if err != nil {
		return fmt.Errorf("读取文件失败: %v", err)
	}
	defer reader.Close()

	// 解密
	decReader, decSize, err := s.DecryptReader(reader, password)
	if err != nil {
		return err
	}

	// 写回存储（覆盖加密文件）
	if err := fileService.GetStorage().Put(file.StorePath, decReader, decSize); err != nil {
		return fmt.Errorf("保存解密文件失败: %v", err)
	}

	// 更新文件记录
	model.DB.Model(&file).Updates(map[string]interface{}{
		"is_encrypted": false,
		"size":         decSize,
	})

	// 更新用户存储使用量差值
	diff := decSize - file.Size
	if diff != 0 {
		model.DB.Model(&model.User{}).Where("id = ?", userID).
			Update("storage_used", gorm.Expr("storage_used + ?", diff))
	}

	return nil
}
