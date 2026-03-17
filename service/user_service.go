package service

import (
	"errors"
	"nowen-file/model"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// UserService 用户服务
type UserService struct{}

// NewUserService 创建用户服务实例
func NewUserService() *UserService {
	return &UserService{}
}

// Register 用户注册
func (s *UserService) Register(username, password, nickname string) (*model.User, error) {
	// 检查用户名是否已存在
	var existing model.User
	if err := model.DB.Where("username = ?", username).First(&existing).Error; err == nil {
		return nil, errors.New("用户名已存在")
	}

	// 加密密码
	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("密码加密失败")
	}

	// 设置默认昵称
	if nickname == "" {
		nickname = username
	}

	user := &model.User{
		Username: username,
		Password: string(hashedPwd),
		Nickname: nickname,
		Role:     "user",
	}

	// 检查是否是第一个用户，如果是则设置为管理员
	var count int64
	model.DB.Model(&model.User{}).Count(&count)
	if count == 0 {
		user.Role = "admin"
	}

	if err := model.DB.Create(user).Error; err != nil {
		return nil, errors.New("创建用户失败")
	}

	return user, nil
}

// Login 用户登录
func (s *UserService) Login(username, password string) (*model.User, error) {
	var user model.User
	if err := model.DB.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户名或密码错误")
		}
		return nil, errors.New("查询用户失败")
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("用户名或密码错误")
	}

	return &user, nil
}

// GetUserByID 根据ID获取用户信息
func (s *UserService) GetUserByID(id uint) (*model.User, error) {
	var user model.User
	if err := model.DB.First(&user, id).Error; err != nil {
		return nil, errors.New("用户不存在")
	}
	return &user, nil
}

// UpdateProfile 更新用户资料
func (s *UserService) UpdateProfile(userID uint, nickname, avatar string) error {
	updates := map[string]interface{}{}
	if nickname != "" {
		updates["nickname"] = nickname
	}
	if avatar != "" {
		updates["avatar"] = avatar
	}
	if len(updates) == 0 {
		return nil
	}
	return model.DB.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

// UpdateStorageUsed 更新用户已使用存储量
func (s *UserService) UpdateStorageUsed(userID uint, delta int64) error {
	return model.DB.Model(&model.User{}).Where("id = ?", userID).
		Update("storage_used", gorm.Expr("storage_used + ?", delta)).Error
}
