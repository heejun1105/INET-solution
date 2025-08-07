-- 이메일과 보안 질문 필드 추가
ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE;
ALTER TABLE users ADD COLUMN security_question VARCHAR(255) NOT NULL;
ALTER TABLE users ADD COLUMN security_answer VARCHAR(255) NOT NULL;

-- 기존 사용자들을 위한 기본값 설정 (개발용)
UPDATE users SET 
    email = CONCAT(username, '@example.com'),
    security_question = '가장 좋아하는 색깔은?',
    security_answer = '파랑'
WHERE email IS NULL OR email = ''; 