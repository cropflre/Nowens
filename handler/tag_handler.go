package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// TagHandler 标签接口
type TagHandler struct {
	tagService *service.TagService
}

// NewTagHandler 创建标签接口
func NewTagHandler() *TagHandler {
	return &TagHandler{
		tagService: service.NewTagService(),
	}
}

// ==================== 标签管理 ====================

// CreateTag 创建标签
// POST /api/tags
func (h *TagHandler) CreateTag(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "标签名称不能为空")
		return
	}

	tag, err := h.tagService.CreateTag(userID, req.Name, req.Color)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, tag)
}

// UpdateTag 更新标签
// PUT /api/tags/:id
func (h *TagHandler) UpdateTag(c *gin.Context) {
	userID := GetUserID(c)
	tagID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var req struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.tagService.UpdateTag(userID, uint(tagID), req.Name, req.Color); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "更新成功")
}

// DeleteTag 删除标签
// DELETE /api/tags/:id
func (h *TagHandler) DeleteTag(c *gin.Context) {
	userID := GetUserID(c)
	tagID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.tagService.DeleteTag(userID, uint(tagID)); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "删除成功")
}

// ListTags 获取标签列表
// GET /api/tags
func (h *TagHandler) ListTags(c *gin.Context) {
	userID := GetUserID(c)

	tags, err := h.tagService.ListTags(userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, tags)
}

// ==================== 文件标签关联 ====================

// TagFile 给文件打标签
// POST /api/tags/file
func (h *TagHandler) TagFile(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		FileID uint `json:"file_id" binding:"required"`
		TagID  uint `json:"tag_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.tagService.TagFile(userID, req.FileID, req.TagID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "标签已添加")
}

// UntagFile 取消文件标签
// DELETE /api/tags/file/:file_id/:tag_id
func (h *TagHandler) UntagFile(c *gin.Context) {
	userID := GetUserID(c)
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	tagID, err := strconv.ParseUint(c.Param("tag_id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.tagService.UntagFile(userID, uint(fileID), uint(tagID)); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "标签已移除")
}

// GetFileTags 获取文件的标签
// GET /api/tags/file/:file_id
func (h *TagHandler) GetFileTags(c *gin.Context) {
	userID := GetUserID(c)
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	tags, err := h.tagService.GetFileTags(userID, uint(fileID))
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, tags)
}

// GetFilesByTag 根据标签获取文件
// GET /api/tags/:id/files
func (h *TagHandler) GetFilesByTag(c *gin.Context) {
	userID := GetUserID(c)
	tagID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	files, err := h.tagService.GetFilesByTag(userID, uint(tagID))
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, files)
}
