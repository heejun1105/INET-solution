-- 평면도 시스템 리빌딩
-- NetworkEquipment 테이블 생성 및 FloorPlanElement 확장

-- 1. NetworkEquipment 테이블 생성 (MDF/IDF 관리)
CREATE TABLE IF NOT EXISTS network_equipment (
    equipment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    school_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    equipment_type VARCHAR(50) NOT NULL COMMENT 'MDF 또는 IDF',
    color VARCHAR(50) DEFAULT '#3b82f6',
    x_coordinate DOUBLE DEFAULT 0,
    y_coordinate DOUBLE DEFAULT 0,
    width DOUBLE DEFAULT 50,
    height DOUBLE DEFAULT 65,
    description TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE,
    INDEX idx_network_equipment_school (school_id),
    INDEX idx_network_equipment_type (equipment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='네트워크 장비 (MDF/IDF)';

-- 2. FloorPlanElement 테이블에 새 필드 추가
ALTER TABLE floor_plan_elements
ADD COLUMN IF NOT EXISTS parent_element_id BIGINT DEFAULT NULL COMMENT '부모 요소 ID (자리는 교실에 속함)',
ADD COLUMN IF NOT EXISTS layer_order INT DEFAULT 0 COMMENT '레이어 순서',
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE COMMENT '이동 잠금 여부',
ADD COLUMN IF NOT EXISTS metadata TEXT COMMENT '추가 메타데이터 (JSON)';

-- 3. 인덱스 추가
ALTER TABLE floor_plan_elements
ADD INDEX IF NOT EXISTS idx_parent_element (parent_element_id),
ADD INDEX IF NOT EXISTS idx_layer_order (layer_order);

-- 4. 기존 데이터 호환성: layer_order를 z_index 값으로 초기화
UPDATE floor_plan_elements 
SET layer_order = COALESCE(z_index, 0) 
WHERE layer_order IS NULL OR layer_order = 0;

-- 5. 기존 데이터 호환성: is_locked 기본값 설정
UPDATE floor_plan_elements 
SET is_locked = FALSE 
WHERE is_locked IS NULL;

