-- 권한 테이블 생성
CREATE TABLE permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    feature VARCHAR(50) NOT NULL,
    permission_type VARCHAR(20) NOT NULL,
    school_id BIGINT NULL,
    created_at DATETIME NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_feature (feature),
    INDEX idx_permission_type (permission_type),
    INDEX idx_school_id (school_id),
    INDEX idx_user_feature (user_id, feature),
    INDEX idx_user_feature_permission (user_id, feature, permission_type),
    INDEX idx_user_feature_school (user_id, feature, school_id),
    INDEX idx_user_feature_permission_school (user_id, feature, permission_type, school_id)
);

-- 기존 users 테이블의 permissions 컬럼 제거 (새로운 권한 시스템 사용)
ALTER TABLE users DROP COLUMN permissions;

