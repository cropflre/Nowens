package handler

import (
	"fmt"
	"net/http"
	"nowen-file/service"

	"github.com/gin-gonic/gin"
)

// EncryptionHandler 文件加密接口
type EncryptionHandler struct {
	encryptionService *service.EncryptionService
	fileService       *service.FileService
}

// NewEncryptionHandler 创建加密接口
func NewEncryptionHandler(fs *service.FileService) *EncryptionHandler {
	return &EncryptionHandler{
		encryptionService: service.NewEncryptionService(),
		fileService:       fs,
	}
}

// EncryptFile 加密文件
// POST /api/files/encrypt
func (h *EncryptionHandler) EncryptFile(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		FileID   uint   `json:"file_id" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供文件ID和加密密码")
		return
	}

	if len(req.Password) < 6 {
		Error(c, http.StatusBadRequest, "密码至少 6 位")
		return
	}

	if err := h.encryptionService.EncryptAndSaveFile(h.fileService, userID, req.FileID, req.Password); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "文件已加密")
}

// DecryptFile 解密文件
// POST /api/files/decrypt
func (h *EncryptionHandler) DecryptFile(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		FileID   uint   `json:"file_id" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供文件ID和解密密码")
		return
	}

	if err := h.encryptionService.DecryptAndSaveFile(h.fileService, userID, req.FileID, req.Password); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "文件已解密")
}

// DownloadDecrypted 临时解密并下载（不修改存储状态）
// POST /api/files/decrypt-download
func (h *EncryptionHandler) DownloadDecrypted(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		FileID   uint   `json:"file_id" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "请提供文件ID和密码")
		return
	}

	file, err := h.fileService.GetFileByID(userID, req.FileID)
	if err != nil {
		Error(c, http.StatusNotFound, "文件不存在")
		return
	}

	if !file.IsEncrypted {
		Error(c, http.StatusBadRequest, "该文件未加密")
		return
	}

	reader, err := h.fileService.GetFileReader(file)
	if err != nil {
		Error(c, http.StatusInternalServerError, "读取文件失败")
		return
	}
	defer reader.Close()

	decReader, decSize, err := h.encryptionService.DecryptReader(reader, req.Password)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	c.Header("Content-Disposition", "attachment; filename=\""+file.Name+"\"")
	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", decSize))
	c.DataFromReader(http.StatusOK, decSize, file.MimeType, decReader, nil)
}
