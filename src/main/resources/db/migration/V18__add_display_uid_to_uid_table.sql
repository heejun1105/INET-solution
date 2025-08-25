-- UID 테이블에 display_uid 컬럼 추가
ALTER TABLE uid ADD COLUMN display_uid VARCHAR(20);

-- display_uid 컬럼에 인덱스 생성
CREATE INDEX idx_display_uid ON uid(display_uid);

-- 기존 데이터에 대한 display_uid 값 생성
UPDATE uid u 
JOIN school s ON u.school_id = s.school_id 
SET u.display_uid = CONCAT(s.school_id, u.cate, COALESCE(u.mfg_year, ''), LPAD(u.id_number, 4, '0'))
WHERE u.display_uid IS NULL;
