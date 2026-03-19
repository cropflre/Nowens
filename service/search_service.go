package service

import (
	"fmt"
	"io"
	"log"
	"nowen-file/model"
	"nowen-file/storage"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/blevesearch/bleve/v2"
)

// FullTextSearchService 全文搜索服务
type FullTextSearchService struct {
	index     bleve.Index
	indexPath string
	storage   storage.Storage
	mu        sync.RWMutex
}

// SearchDocument 搜索索引中的文档结构
type SearchDocument struct {
	FileID    uint   `json:"file_id"`
	UserID    uint   `json:"user_id"`
	FileName  string `json:"file_name"`
	Content   string `json:"content"`
	MimeType  string `json:"mime_type"`
	UpdatedAt string `json:"updated_at"`
}

// SearchResult 搜索结果
type SearchResult struct {
	FileID    uint    `json:"file_id"`
	FileName  string  `json:"file_name"`
	Score     float64 `json:"score"`
	Highlight string  `json:"highlight"` // 匹配的内容片段
}

// NewFullTextSearchService 创建全文搜索服务
func NewFullTextSearchService(indexPath string, store storage.Storage) *FullTextSearchService {
	svc := &FullTextSearchService{
		indexPath: indexPath,
		storage:   store,
	}

	os.MkdirAll(filepath.Dir(indexPath), 0755)

	// 尝试打开已有索引，否则创建新的
	idx, err := bleve.Open(indexPath)
	if err != nil {
		// 创建新索引
		mapping := bleve.NewIndexMapping()

		// 文档映射
		docMapping := bleve.NewDocumentMapping()

		// 文件名 — keyword + text 双索引
		fileNameFieldMapping := bleve.NewTextFieldMapping()
		fileNameFieldMapping.Analyzer = "standard"
		docMapping.AddFieldMappingsAt("file_name", fileNameFieldMapping)

		// 内容 — 全文索引
		contentFieldMapping := bleve.NewTextFieldMapping()
		contentFieldMapping.Analyzer = "standard"
		contentFieldMapping.Store = false // 不存储原始内容，节省空间
		docMapping.AddFieldMappingsAt("content", contentFieldMapping)

		// 用户ID — keyword 精确匹配
		userIDFieldMapping := bleve.NewNumericFieldMapping()
		docMapping.AddFieldMappingsAt("user_id", userIDFieldMapping)

		mapping.DefaultMapping = docMapping

		idx, err = bleve.New(indexPath, mapping)
		if err != nil {
			log.Printf("[全文搜索] 创建索引失败: %v", err)
			return svc
		}
		log.Printf("🔍 全文搜索索引已创建: %s", indexPath)
	} else {
		log.Printf("🔍 全文搜索索引已加载: %s", indexPath)
	}

	svc.index = idx
	return svc
}

// Close 关闭索引
func (s *FullTextSearchService) Close() {
	if s.index != nil {
		s.index.Close()
	}
}

// IndexFile 索引单个文件（提取文本内容并加入索引）
func (s *FullTextSearchService) IndexFile(file *model.FileItem) {
	if s.index == nil || file.IsDir || file.IsTrash {
		return
	}

	// 只索引可提取文本的文件类型
	if !s.isIndexable(file.MimeType, file.Name) {
		return
	}

	content := s.extractTextContent(file)
	if content == "" {
		return
	}

	// 限制内容长度（最大 100KB 文本）
	if len(content) > 100*1024 {
		content = content[:100*1024]
	}

	doc := SearchDocument{
		FileID:    file.ID,
		UserID:    file.UserID,
		FileName:  file.Name,
		Content:   content,
		MimeType:  file.MimeType,
		UpdatedAt: file.UpdatedAt.Format(time.RFC3339),
	}

	docID := strconv.FormatUint(uint64(file.ID), 10)
	if err := s.index.Index(docID, doc); err != nil {
		log.Printf("[全文搜索] 索引文件失败 %s: %v", file.Name, err)
	}
}

// RemoveFile 从索引中移除文件
func (s *FullTextSearchService) RemoveFile(fileID uint) {
	if s.index == nil {
		return
	}
	docID := strconv.FormatUint(uint64(fileID), 10)
	s.index.Delete(docID)
}

// Search 全文搜索（限定用户范围）
func (s *FullTextSearchService) Search(userID uint, keyword string, page, pageSize int) ([]SearchResult, int64, error) {
	if s.index == nil {
		return nil, 0, fmt.Errorf("搜索索引未初始化")
	}

	// 构建复合查询：内容匹配 + 文件名匹配 + 用户过滤
	contentQuery := bleve.NewMatchQuery(keyword)
	contentQuery.SetField("content")
	contentQuery.SetBoost(1.0)

	fileNameQuery := bleve.NewMatchQuery(keyword)
	fileNameQuery.SetField("file_name")
	fileNameQuery.SetBoost(2.0) // 文件名匹配权重更高

	// 用户 ID 过滤
	userIDFloat := float64(userID)
	userIDQuery := bleve.NewNumericRangeQuery(&userIDFloat, &userIDFloat)
	userIDQuery.SetField("user_id")

	// 内容或文件名匹配
	textQuery := bleve.NewDisjunctionQuery(contentQuery, fileNameQuery)

	// 最终查询：文本匹配 AND 用户过滤
	finalQuery := bleve.NewConjunctionQuery(textQuery, userIDQuery)

	searchReq := bleve.NewSearchRequestOptions(finalQuery, pageSize, (page-1)*pageSize, false)
	searchReq.Fields = []string{"file_id", "file_name", "user_id"}
	searchReq.Highlight = bleve.NewHighlightWithStyle("html")
	searchReq.Highlight.AddField("content")

	result, err := s.index.Search(searchReq)
	if err != nil {
		return nil, 0, fmt.Errorf("搜索失败: %v", err)
	}

	var results []SearchResult
	for _, hit := range result.Hits {
		fileID, _ := strconv.ParseUint(hit.ID, 10, 64)

		// 提取高亮片段
		highlight := ""
		if fragments, ok := hit.Fragments["content"]; ok && len(fragments) > 0 {
			highlight = fragments[0]
		}

		fileName := ""
		if fn, ok := hit.Fields["file_name"].(string); ok {
			fileName = fn
		}

		results = append(results, SearchResult{
			FileID:    uint(fileID),
			FileName:  fileName,
			Score:     hit.Score,
			Highlight: highlight,
		})
	}

	return results, int64(result.Total), nil
}

// RebuildIndex 重建全部索引（全量扫描）
func (s *FullTextSearchService) RebuildIndex(userID uint) (int, error) {
	if s.index == nil {
		return 0, fmt.Errorf("搜索索引未初始化")
	}

	var files []model.FileItem
	query := model.DB.Where("is_dir = ? AND is_trash = ?", false, false)
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	query.Find(&files)

	indexed := 0
	for _, file := range files {
		if s.isIndexable(file.MimeType, file.Name) {
			s.IndexFile(&file)
			indexed++
		}
	}

	log.Printf("[全文搜索] 重建索引完成，共索引 %d 个文件", indexed)
	return indexed, nil
}

// isIndexable 判断文件是否可索引（可提取文本的类型）
func (s *FullTextSearchService) isIndexable(mimeType, fileName string) bool {
	// 文本类文件
	if strings.HasPrefix(mimeType, "text/") {
		return true
	}
	// JSON / XML / YAML 等
	if mimeType == "application/json" || mimeType == "application/xml" ||
		mimeType == "application/x-yaml" || mimeType == "application/javascript" {
		return true
	}
	// 根据扩展名判断
	ext := strings.ToLower(filepath.Ext(fileName))
	indexableExts := map[string]bool{
		".txt": true, ".md": true, ".markdown": true,
		".json": true, ".xml": true, ".yaml": true, ".yml": true,
		".csv": true, ".tsv": true, ".log": true, ".ini": true, ".conf": true, ".cfg": true,
		".html": true, ".htm": true, ".css": true, ".scss": true, ".less": true,
		".js": true, ".ts": true, ".jsx": true, ".tsx": true, ".vue": true, ".svelte": true,
		".py": true, ".go": true, ".java": true, ".c": true, ".cpp": true, ".h": true,
		".rs": true, ".rb": true, ".php": true, ".sh": true, ".bash": true, ".zsh": true,
		".sql": true, ".r": true, ".swift": true, ".kt": true, ".scala": true,
		".toml": true, ".env": true, ".gitignore": true, ".dockerfile": true,
	}
	return indexableExts[ext]
}

// extractTextContent 从文件中提取文本内容
func (s *FullTextSearchService) extractTextContent(file *model.FileItem) string {
	// 限制只处理 10MB 以下的文件
	if file.Size > 10*1024*1024 {
		return ""
	}

	reader, err := s.storage.Get(file.StorePath)
	if err != nil {
		return ""
	}
	defer reader.Close()

	// 读取文件内容
	data, err := io.ReadAll(io.LimitReader(reader, 100*1024)) // 最多读 100KB
	if err != nil {
		return ""
	}

	// 检查是否为有效 UTF-8 文本
	content := string(data)
	if !utf8.ValidString(content) {
		return "" // 非文本文件，跳过
	}

	return content
}
