-- 평면도 요소에 페이지 번호 추가
-- 학교별로 평면도를 여러 페이지로 나눌 수 있도록 지원

-- FloorPlanElement 테이블에 page_number 컬럼 추가
ALTER TABLE floor_plan_elements
ADD COLUMN IF NOT EXISTS page_number INT DEFAULT 1 COMMENT '페이지 번호 (기본값: 1)';

-- page_number 인덱스 추가 (페이지별 요소 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_floor_plan_page ON floor_plan_elements(floor_plan_id, page_number);

-- 기존 데이터는 모두 1페이지로 설정
UPDATE floor_plan_elements
SET page_number = 1
WHERE page_number IS NULL;

-- 완료 확인
SELECT 'FloorPlanElement에 page_number 컬럼 추가 완료' AS Status;

