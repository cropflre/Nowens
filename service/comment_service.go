package service

import (
	"errors"
	"nowen-file/model"
	"time"
)

// CommentService 评论/备注服务
type CommentService struct{}

// NewCommentService 创建评论服务
func NewCommentService() *CommentService {
	return &CommentService{}
}

// AddComment 添加评论
func (s *CommentService) AddComment(userID uint, username string, fileID uint, content string) (*model.Comment, error) {
	if content == "" {
		return nil, errors.New("评论内容不能为空")
	}
	if len(content) > 2048 {
		return nil, errors.New("评论内容不能超过 2048 个字符")
	}

	// 验证文件存在
	var file model.FileItem
	if err := model.DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		return nil, errors.New("文件不存在")
	}

	comment := &model.Comment{
		FileID:   fileID,
		UserID:   userID,
		Username: username,
		Content:  content,
	}
	if err := model.DB.Create(comment).Error; err != nil {
		return nil, errors.New("添加评论失败")
	}
	return comment, nil
}

// ListComments 获取文件评论列表
func (s *CommentService) ListComments(fileID uint) ([]model.Comment, error) {
	var comments []model.Comment
	err := model.DB.Where("file_id = ?", fileID).
		Order("created_at DESC").
		Find(&comments).Error
	return comments, err
}

// UpdateComment 更新评论（仅本人可修改）
func (s *CommentService) UpdateComment(userID uint, commentID uint, content string) error {
	if content == "" {
		return errors.New("评论内容不能为空")
	}
	result := model.DB.Model(&model.Comment{}).
		Where("id = ? AND user_id = ?", commentID, userID).
		Updates(map[string]interface{}{
			"content":    content,
			"updated_at": time.Now(),
		})
	if result.RowsAffected == 0 {
		return errors.New("评论不存在或无权修改")
	}
	return result.Error
}

// DeleteComment 删除评论（仅本人可删除）
func (s *CommentService) DeleteComment(userID uint, commentID uint) error {
	result := model.DB.Where("id = ? AND user_id = ?", commentID, userID).
		Delete(&model.Comment{})
	if result.RowsAffected == 0 {
		return errors.New("评论不存在或无权删除")
	}
	return result.Error
}
