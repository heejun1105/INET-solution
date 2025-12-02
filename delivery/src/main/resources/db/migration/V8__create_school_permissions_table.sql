-- 학교 권한 테이블 생성
CREATE TABLE school_permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    school_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_school (user_id, school_id)
);

-- 학교 권한 테이블 인덱스 생성
CREATE INDEX idx_school_permissions_user_id ON school_permissions(user_id);
CREATE INDEX idx_school_permissions_school_id ON school_permissions(school_id);

-- 기존 permissions 테이블에서 school_id 컬럼 제거
ALTER TABLE permissions DROP FOREIGN KEY IF EXISTS permissions_ibfk_3;
ALTER TABLE permissions DROP COLUMN IF EXISTS school_id;

