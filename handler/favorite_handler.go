package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// FavoriteHandler 收藏夹接口
type FavoriteHandler struct {
	favoriteService *service.FavoriteService
}

// NewFavoriteHandler 创建收藏夹接口
func NewFavoriteHandler() *FavoriteHandler {
	return &FavoriteHandler{
		favoriteService: service.NewFavoriteService(),
	}
}

// AddFavorite 添加收藏
// POST /api/favorites
func (h *FavoriteHandler) AddFavorite(c *gin.Context) {
	userID := GetUserID(c)

	var req struct {
		FileID uint `json:"file_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.favoriteService.AddFavorite(userID, req.FileID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "收藏成功")
}

// RemoveFavorite 取消收藏
// DELETE /api/favorites/:file_id
func (h *FavoriteHandler) RemoveFavorite(c *gin.Context) {
	userID := GetUserID(c)
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	if err := h.favoriteService.RemoveFavorite(userID, uint(fileID)); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	SuccessMsg(c, "已取消收藏")
}

// ListFavorites 获取收藏列表
// GET /api/favorites
func (h *FavoriteHandler) ListFavorites(c *gin.Context) {
	userID := GetUserID(c)

	favorites, err := h.favoriteService.ListFavorites(userID)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, favorites)
}

// CheckFavorite 检查是否已收藏
// GET /api/favorites/check/:file_id
func (h *FavoriteHandler) CheckFavorite(c *gin.Context) {
	userID := GetUserID(c)
	fileID, err := strconv.ParseUint(c.Param("file_id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	isFav := h.favoriteService.IsFavorited(userID, uint(fileID))
	Success(c, gin.H{"is_favorited": isFav})
}
