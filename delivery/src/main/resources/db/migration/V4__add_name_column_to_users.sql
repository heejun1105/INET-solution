-- V4__add_name_column_to_users.sql
-- users 테이블에 name 컬럼 추가

ALTER TABLE users ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT '사용자' AFTER password;

-- 기존 admin 사용자의 이름을 '관리자'로 설정
UPDATE users SET name = '관리자' WHERE username = 'admin';

