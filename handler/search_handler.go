package handler

import (
	"net/http"
	"nowen-file/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SearchHandler 全文搜索接口
type SearchHandler struct {
	searchService *service.FullTextSearchService
}

// NewSearchHandler 创建搜索接口实例
func NewSearchHandler(searchService *service.FullTextSearchService) *SearchHandler {
	return &SearchHandler{searchService: searchService}
}

// FullTextSearch 全文搜索
// GET /api/files/fulltext-search?keyword=xxx&page=1&page_size=20
func (h *SearchHandler) FullTextSearch(c *gin.Context) {
	userID := c.GetUint("user_id")
	keyword := c.Query("keyword")
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "请输入搜索关键词"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}

	results, total, err := h.searchService.Search(userID, keyword, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"list":  results,
			"total": total,
			"page":  page,
		},
	})
}

// RebuildIndex 重建全文索引
// POST /api/files/fulltext-rebuild
func (h *SearchHandler) RebuildIndex(c *gin.Context) {
	userID := c.GetUint("user_id")

	go func() {
		count, _ := h.searchService.RebuildIndex(userID)
		_ = count
	}()

	c.JSON(http.StatusOK, gin.H{"code": 0, "msg": "索引重建已开始，后台执行中"})
}
