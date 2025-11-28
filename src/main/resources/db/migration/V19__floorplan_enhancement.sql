-- 평면도 시스템 개선을 위한 스키마 마이그레이션
-- 실행 전 기존 데이터 백업 필요

-- FloorPlan 테이블에 새 컬럼 추가
ALTER TABLE floor_plans 
ADD COLUMN IF NOT EXISTS pan_x DOUBLE DEFAULT 0.0 COMMENT '패닝 X 좌표',
ADD COLUMN IF NOT EXISTS pan_y DOUBLE DEFAULT 0.0 COMMENT '패닝 Y 좌표',
ADD COLUMN IF NOT EXISTS grid_size INT DEFAULT 20 COMMENT '그리드 크기',
ADD COLUMN IF NOT EXISTS show_grid BOOLEAN DEFAULT TRUE COMMENT '그리드 표시 여부',
ADD COLUMN IF NOT EXISTS snap_to_grid BOOLEAN DEFAULT TRUE COMMENT '그리드 스냅 여부',
ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 COMMENT '버전 (낙관적 락)';

-- FloorPlan 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_school_active ON floor_plans(school_id, is_active);

-- FloorPlanElement 테이블에 새 컬럼 추가
ALTER TABLE floor_plan_elements
ADD COLUMN IF NOT EXISTS rotation DOUBLE DEFAULT 0.0 COMMENT '회전 각도',
ADD COLUMN IF NOT EXISTS color VARCHAR(50) COMMENT '색상',
ADD COLUMN IF NOT EXISTS background_color VARCHAR(50) COMMENT '배경색',
ADD COLUMN IF NOT EXISTS border_color VARCHAR(50) COMMENT '테두리색',
ADD COLUMN IF NOT EXISTS border_width DOUBLE COMMENT '테두리 두께',
ADD COLUMN IF NOT EXISTS opacity DOUBLE DEFAULT 1.0 COMMENT '투명도',
ADD COLUMN IF NOT EXISTS shape_type VARCHAR(50) COMMENT '도형 타입',
ADD COLUMN IF NOT EXISTS text_content TEXT COMMENT '텍스트 내용',
ADD COLUMN IF NOT EXISTS font_size INT COMMENT '폰트 크기',
ADD COLUMN IF NOT EXISTS font_family VARCHAR(100) COMMENT '폰트 패밀리',
ADD COLUMN IF NOT EXISTS start_x DOUBLE COMMENT '선 시작 X',
ADD COLUMN IF NOT EXISTS start_y DOUBLE COMMENT '선 시작 Y',
ADD COLUMN IF NOT EXISTS end_x DOUBLE COMMENT '선 끝 X',
ADD COLUMN IF NOT EXISTS end_y DOUBLE COMMENT '선 끝 Y',
ADD COLUMN IF NOT EXISTS label VARCHAR(255) COMMENT '라벨',
ADD COLUMN IF NOT EXISTS show_label BOOLEAN DEFAULT TRUE COMMENT '라벨 표시 여부',
ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 COMMENT '버전 (낙관적 락)';

-- FloorPlanElement 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_floor_plan_id ON floor_plan_elements(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_element_type ON floor_plan_elements(element_type);
CREATE INDEX IF NOT EXISTS idx_reference_id ON floor_plan_elements(reference_id);

-- element_type 컬럼 길이 조정
ALTER TABLE floor_plan_elements 
MODIFY COLUMN element_type VARCHAR(50) NOT NULL;

-- 기존 데이터 마이그레이션 (기본값 설정)
UPDATE floor_plans 
SET 
    pan_x = COALESCE(pan_x, 0.0),
    pan_y = COALESCE(pan_y, 0.0),
    grid_size = COALESCE(grid_size, 20),
    show_grid = COALESCE(show_grid, TRUE),
    snap_to_grid = COALESCE(snap_to_grid, TRUE),
    version = COALESCE(version, 0)
WHERE pan_x IS NULL OR version IS NULL;

UPDATE floor_plan_elements
SET
    rotation = COALESCE(rotation, 0.0),
    opacity = COALESCE(opacity, 1.0),
    show_label = COALESCE(show_label, TRUE),
    version = COALESCE(version, 0)
WHERE rotation IS NULL OR version IS NULL;

-- 완료 확인
SELECT 'FloorPlan 스키마 마이그레이션 완료' AS Status;

