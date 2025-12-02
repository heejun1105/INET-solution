-- 사용자 테이블 생성
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    birth_date VARCHAR(10) NOT NULL,
    organization VARCHAR(100) NOT NULL,
    position VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL,
    approved_at DATETIME NULL,
    approved_by VARCHAR(50) NULL,
    last_login_at DATETIME NULL,
    INDEX idx_username (username),
    INDEX idx_status (status),
    INDEX idx_role (role),
    INDEX idx_created_at (created_at)
);

-- 기본 관리자 계정 생성 (비밀번호: admin123!)
-- 실제 운영 시에는 이 계정의 비밀번호를 변경해야 합니다
INSERT INTO users (
    username, 
    password, 
    role, 
    status, 
    birth_date, 
    organization, 
    position, 
    phone_number, 
    created_at, 
    approved_at, 
    approved_by
) VALUES (
    'admin',
    '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVEFDa', -- admin123!
    'ADMIN',
    'APPROVED',
    '1990-01-01',
    'I-NET 시스템',
    '시스템 관리자',
    '010-0000-0000',
    NOW(),
    NOW(),
    'SYSTEM'
);

