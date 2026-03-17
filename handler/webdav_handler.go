package handler

import (
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"nowen-file/model"
	"nowen-file/service"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// WebDAVHandler WebDAV 协议处理器
type WebDAVHandler struct {
	fileService *service.FileService
}

// NewWebDAVHandler 创建 WebDAV 处理器
func NewWebDAVHandler(fs *service.FileService) *WebDAVHandler {
	return &WebDAVHandler{fileService: fs}
}

// HandleWebDAV 统一 WebDAV 入口
func (h *WebDAVHandler) HandleWebDAV(c *gin.Context) {
	// Basic Auth 认证
	user, err := h.basicAuth(c)
	if err != nil {
		c.Header("WWW-Authenticate", `Basic realm="Nowen File WebDAV"`)
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// 获取请求路径（去掉 /dav 前缀）
	reqPath := strings.TrimPrefix(c.Request.URL.Path, "/dav")
	if reqPath == "" {
		reqPath = "/"
	}

	switch c.Request.Method {
	case "OPTIONS":
		h.handleOptions(c)
	case "PROPFIND":
		h.handlePropfind(c, user, reqPath)
	case "GET", "HEAD":
		h.handleGet(c, user, reqPath)
	case "PUT":
		h.handlePut(c, user, reqPath)
	case "DELETE":
		h.handleDelete(c, user, reqPath)
	case "MKCOL":
		h.handleMkcol(c, user, reqPath)
	case "MOVE":
		h.handleMove(c, user, reqPath)
	case "COPY":
		c.Status(http.StatusNotImplemented)
	default:
		c.Status(http.StatusMethodNotAllowed)
	}
}

// basicAuth 解析 Basic Auth 认证
func (h *WebDAVHandler) basicAuth(c *gin.Context) (*model.User, error) {
	auth := c.GetHeader("Authorization")
	if auth == "" || !strings.HasPrefix(auth, "Basic ") {
		return nil, fmt.Errorf("未提供认证")
	}

	decoded, err := base64.StdEncoding.DecodeString(auth[6:])
	if err != nil {
		return nil, fmt.Errorf("认证格式错误")
	}

	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("认证格式错误")
	}

	var user model.User
	if err := model.DB.Where("username = ?", parts[0]).First(&user).Error; err != nil {
		return nil, fmt.Errorf("用户不存在")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(parts[1])); err != nil {
		return nil, fmt.Errorf("密码错误")
	}

	return &user, nil
}

// resolvePathToFile 根据路径解析到文件/文件夹
func (h *WebDAVHandler) resolvePathToFile(userID uint, reqPath string) (*model.FileItem, error) {
	if reqPath == "/" || reqPath == "" {
		return nil, nil // 根目录
	}

	parts := strings.Split(strings.Trim(reqPath, "/"), "/")
	var parentID uint = 0

	for i, name := range parts {
		var file model.FileItem
		query := model.DB.Where("user_id = ? AND parent_id = ? AND name = ? AND is_trash = ?",
			userID, parentID, name, false)

		if i < len(parts)-1 {
			// 中间路径必须是文件夹
			query = query.Where("is_dir = ?", true)
		}

		if err := query.First(&file).Error; err != nil {
			return nil, fmt.Errorf("路径不存在: %s", name)
		}

		if i == len(parts)-1 {
			return &file, nil
		}
		parentID = file.ID
	}

	return nil, fmt.Errorf("路径不存在")
}

// resolveParentPath 解析父路径和文件名
func (h *WebDAVHandler) resolveParentPath(userID uint, reqPath string) (parentID uint, fileName string, err error) {
	dir := path.Dir(reqPath)
	fileName = path.Base(reqPath)

	if dir == "/" || dir == "." {
		return 0, fileName, nil
	}

	parent, err := h.resolvePathToFile(userID, dir)
	if err != nil {
		return 0, "", err
	}
	if parent == nil {
		return 0, fileName, nil
	}
	if !parent.IsDir {
		return 0, "", fmt.Errorf("父路径不是文件夹")
	}
	return parent.ID, fileName, nil
}

// handleOptions OPTIONS 请求
func (h *WebDAVHandler) handleOptions(c *gin.Context) {
	c.Header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, MOVE")
	c.Header("DAV", "1, 2")
	c.Status(http.StatusOK)
}

// handlePropfind PROPFIND 请求（列目录/文件属性）
func (h *WebDAVHandler) handlePropfind(c *gin.Context, user *model.User, reqPath string) {
	type PropResponse struct {
		XMLName  xml.Name `xml:"D:response"`
		Href     string   `xml:"D:href"`
		PropStat struct {
			Status string `xml:"D:status"`
			Prop   struct {
				DisplayName  string `xml:"D:displayname"`
				ResourceType struct {
					Collection *struct{} `xml:"D:collection,omitempty"`
				} `xml:"D:resourcetype"`
				ContentLength int64  `xml:"D:getcontentlength,omitempty"`
				ContentType   string `xml:"D:getcontenttype,omitempty"`
				LastModified  string `xml:"D:getlastmodified,omitempty"`
				CreationDate  string `xml:"D:creationdate,omitempty"`
			} `xml:"D:prop"`
		} `xml:"D:propstat"`
	}

	type MultiStatus struct {
		XMLName   xml.Name       `xml:"D:multistatus"`
		Xmlns     string         `xml:"xmlns:D,attr"`
		Responses []PropResponse `xml:"D:response"`
	}

	ms := MultiStatus{Xmlns: "DAV:"}

	if reqPath == "/" {
		// 根目录
		resp := PropResponse{}
		resp.Href = "/dav/"
		resp.PropStat.Status = "HTTP/1.1 200 OK"
		resp.PropStat.Prop.DisplayName = "根目录"
		resp.PropStat.Prop.ResourceType.Collection = &struct{}{}
		ms.Responses = append(ms.Responses, resp)

		// 列出根目录内容
		files, _ := h.fileService.ListFiles(user.ID, 0, "name", "asc")
		for _, f := range files {
			child := PropResponse{}
			child.Href = "/dav/" + f.Name
			if f.IsDir {
				child.Href += "/"
			}
			child.PropStat.Status = "HTTP/1.1 200 OK"
			child.PropStat.Prop.DisplayName = f.Name
			if f.IsDir {
				child.PropStat.Prop.ResourceType.Collection = &struct{}{}
			} else {
				child.PropStat.Prop.ContentLength = f.Size
				child.PropStat.Prop.ContentType = f.MimeType
			}
			child.PropStat.Prop.LastModified = f.UpdatedAt.Format(time.RFC1123)
			child.PropStat.Prop.CreationDate = f.CreatedAt.Format(time.RFC3339)
			ms.Responses = append(ms.Responses, child)
		}
	} else {
		file, err := h.resolvePathToFile(user.ID, reqPath)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}

		if file == nil {
			c.Status(http.StatusNotFound)
			return
		}

		resp := PropResponse{}
		resp.Href = "/dav" + reqPath
		if file.IsDir {
			resp.Href += "/"
		}
		resp.PropStat.Status = "HTTP/1.1 200 OK"
		resp.PropStat.Prop.DisplayName = file.Name
		if file.IsDir {
			resp.PropStat.Prop.ResourceType.Collection = &struct{}{}

			ms.Responses = append(ms.Responses, resp)

			// 列出子文件
			children, _ := h.fileService.ListFiles(user.ID, file.ID, "name", "asc")
			for _, f := range children {
				child := PropResponse{}
				child.Href = "/dav" + reqPath + "/" + f.Name
				if f.IsDir {
					child.Href += "/"
				}
				child.PropStat.Status = "HTTP/1.1 200 OK"
				child.PropStat.Prop.DisplayName = f.Name
				if f.IsDir {
					child.PropStat.Prop.ResourceType.Collection = &struct{}{}
				} else {
					child.PropStat.Prop.ContentLength = f.Size
					child.PropStat.Prop.ContentType = f.MimeType
				}
				child.PropStat.Prop.LastModified = f.UpdatedAt.Format(time.RFC1123)
				ms.Responses = append(ms.Responses, child)
			}
		} else {
			resp.PropStat.Prop.ContentLength = file.Size
			resp.PropStat.Prop.ContentType = file.MimeType
			resp.PropStat.Prop.LastModified = file.UpdatedAt.Format(time.RFC1123)
			ms.Responses = append(ms.Responses, resp)
		}
	}

	c.Header("Content-Type", "application/xml; charset=utf-8")
	c.Status(http.StatusMultiStatus)
	c.Writer.WriteString(xml.Header)
	enc := xml.NewEncoder(c.Writer)
	enc.Indent("", "  ")
	enc.Encode(ms)
}

// handleGet GET 请求（下载文件）
func (h *WebDAVHandler) handleGet(c *gin.Context, user *model.User, reqPath string) {
	file, err := h.resolvePathToFile(user.ID, reqPath)
	if err != nil || file == nil {
		c.Status(http.StatusNotFound)
		return
	}

	if file.IsDir {
		c.Status(http.StatusMethodNotAllowed)
		return
	}

	reader, err := h.fileService.GetFileReader(file)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	defer reader.Close()

	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", file.Size))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, file.Name))
	io.Copy(c.Writer, reader)
}

// handlePut PUT 请求（上传/覆盖文件）
func (h *WebDAVHandler) handlePut(c *gin.Context, user *model.User, reqPath string) {
	parentID, fileName, err := h.resolveParentPath(user.ID, reqPath)
	if err != nil {
		c.Status(http.StatusConflict)
		return
	}

	// 检查是否已存在同名文件（覆盖）
	var existing model.FileItem
	if err := model.DB.Where("user_id = ? AND parent_id = ? AND name = ? AND is_dir = ? AND is_trash = ?",
		user.ID, parentID, fileName, false, false).First(&existing).Error; err == nil {
		// 存在同名文件：创建版本后覆盖
		versionService := service.NewVersionService(h.fileService.GetStorage())
		versionService.CreateVersion(&existing, "WebDAV 覆盖前自动保存")

		// 保存新文件
		newPath := existing.StorePath
		if err := h.fileService.GetStorage().Put(newPath, c.Request.Body, c.Request.ContentLength); err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}

		// 更新文件记录
		model.DB.Model(&existing).Updates(map[string]interface{}{
			"size": c.Request.ContentLength,
		})

		c.Status(http.StatusNoContent)
		return
	}

	// 新文件：使用存储后端保存
	fileUUID := fmt.Sprintf("%d-%s-%d", user.ID, fileName, time.Now().UnixNano())
	relPath := fmt.Sprintf("%d/webdav/%s", user.ID, fileUUID)

	if err := h.fileService.GetStorage().Put(relPath, c.Request.Body, c.Request.ContentLength); err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	// 创建文件记录
	fileItem := &model.FileItem{
		UUID:      fmt.Sprintf("wdav-%d", time.Now().UnixNano()),
		UserID:    user.ID,
		ParentID:  parentID,
		Name:      fileName,
		IsDir:     false,
		Size:      c.Request.ContentLength,
		MimeType:  "application/octet-stream",
		StorePath: relPath,
	}
	model.DB.Create(fileItem)

	c.Status(http.StatusCreated)
}

// handleDelete DELETE 请求
func (h *WebDAVHandler) handleDelete(c *gin.Context, user *model.User, reqPath string) {
	file, err := h.resolvePathToFile(user.ID, reqPath)
	if err != nil || file == nil {
		c.Status(http.StatusNotFound)
		return
	}

	h.fileService.TrashFile(user.ID, file.ID)
	c.Status(http.StatusNoContent)
}

// handleMkcol MKCOL 请求（创建文件夹）
func (h *WebDAVHandler) handleMkcol(c *gin.Context, user *model.User, reqPath string) {
	parentID, folderName, err := h.resolveParentPath(user.ID, reqPath)
	if err != nil {
		c.Status(http.StatusConflict)
		return
	}

	_, err = h.fileService.CreateFolder(user.ID, parentID, folderName)
	if err != nil {
		c.Status(http.StatusConflict)
		return
	}

	c.Status(http.StatusCreated)
}

// handleMove MOVE 请求（移动/重命名）
func (h *WebDAVHandler) handleMove(c *gin.Context, user *model.User, reqPath string) {
	file, err := h.resolvePathToFile(user.ID, reqPath)
	if err != nil || file == nil {
		c.Status(http.StatusNotFound)
		return
	}

	dest := c.GetHeader("Destination")
	if dest == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	// 解析目标路径
	destPath := strings.TrimPrefix(dest, "/dav")
	// 如果是完整 URL，提取路径部分
	if strings.HasPrefix(dest, "http") {
		parts := strings.SplitN(dest, "/dav", 2)
		if len(parts) == 2 {
			destPath = parts[1]
		}
	}

	destParentID, destName, err := h.resolveParentPath(user.ID, destPath)
	if err != nil {
		c.Status(http.StatusConflict)
		return
	}

	// 如果父目录相同，只是重命名
	if destParentID == file.ParentID {
		h.fileService.RenameFile(user.ID, file.ID, destName)
	} else {
		h.fileService.MoveFile(user.ID, file.ID, destParentID)
		if destName != file.Name {
			h.fileService.RenameFile(user.ID, file.ID, destName)
		}
	}

	c.Status(http.StatusCreated)
}
