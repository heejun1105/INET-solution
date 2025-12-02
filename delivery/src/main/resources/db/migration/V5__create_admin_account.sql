-- 관리자 계정 생성 (환경 변수 기반)
-- 환경 변수 ADMIN_USERNAME, ADMIN_PASSWORD가 설정되어 있으면 해당 값으로 생성
-- 설정되어 있지 않으면 기본값 사용

SET @admin_username = COALESCE(NULLIF('${ADMIN_USERNAME}', ''), 'admin');
SET @admin_password = COALESCE(NULLIF('${ADMIN_PASSWORD}', ''), '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVEFDa'); -- admin123!

-- 기존 관리자 계정이 없으면 생성
INSERT INTO users (
    username, 
    password, 
    name,
    role, 
    status, 
    birth_date, 
    organization, 
    position, 
    phone_number, 
    created_at, 
    approved_at, 
    approved_by
) 
SELECT 
    @admin_username,
    @admin_password,
    '관리자',
    'ADMIN',
    'APPROVED',
    '1990-01-01',
    'I-NET 시스템',
    '시스템 관리자',
    '010-0000-0000',
    NOW(),
    NOW(),
    'SYSTEM'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = @admin_username
);

