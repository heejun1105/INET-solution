-- mfg_year 컬럼이 있는지 확인하고 없으면 추가
ALTER TABLE uid ADD COLUMN IF NOT EXISTS mfg_year VARCHAR(10);

-- mfg_year 컬럼이 INT 타입이면 VARCHAR로 변경
-- MySQL 구문
ALTER TABLE uid MODIFY COLUMN mfg_year VARCHAR(10);

-- 기존 null 값을 "xx"로 업데이트
UPDATE uid SET mfg_year = 'xx' WHERE mfg_year IS NULL;

