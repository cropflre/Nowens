package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CommentHandler 评论接口
type CommentHandler struct {
	commentService  *service.CommentService
	activityService *service.ActivityService
}

// NewCommentHandler 创建评论接口实例
func NewCommentHandler() *CommentHandler {
	return &CommentHandler{
		commentService:  service.NewCommentService(),
		activityService: service.NewActivityService(),
	}
}

// AddComment 添加评论
// POST /api/comments
func (h *CommentHandler) AddComment(c *gin.Context) {
	userID := c.GetUint("user_id")
	username, _ := c.Get("username")

	var req struct {
		FileID  uint   `json:"file_id" binding:"required"`
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	comment, err := h.commentService.AddComment(userID, username.(string), req.FileID, req.Content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	// 记录活动
	h.activityService.RecordActivity(userID, username.(string), "comment", "file", req.FileID, "", "添加了评论")

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "评论成功", "data": comment})
}

// ListComments 获取文件评论列表
// GET /api/comments/:file_id
func (h *CommentHandler) ListComments(c *gin.Context) {
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	comments, err := h.commentService.ListComments(uint(fileID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": "获取评论失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": comments})
}

// UpdateComment 更新评论
// PUT /api/comments/:id
func (h *CommentHandler) UpdateComment(c *gin.Context) {
	userID := c.GetUint("user_id")
	commentID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.commentService.UpdateComment(userID, uint(commentID), req.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "更新成功"})
}

// DeleteComment 删除评论
// DELETE /api/comments/:id
func (h *CommentHandler) DeleteComment(c *gin.Context) {
	userID := c.GetUint("user_id")
	commentID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误"})
		return
	}

	if err := h.commentService.DeleteComment(userID, uint(commentID)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "删除成功"})
}
