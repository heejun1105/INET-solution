-- 평면도 메타데이터 테이블
CREATE TABLE floor_plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    school_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    canvas_width INT,
    canvas_height INT,
    zoom_level DOUBLE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_school_id (school_id),
    INDEX idx_school_active (school_id, is_active)
);

-- 평면도 요소 테이블
CREATE TABLE floor_plan_elements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    floor_plan_id BIGINT NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    reference_id BIGINT,
    x_coordinate DOUBLE NOT NULL,
    y_coordinate DOUBLE NOT NULL,
    width DOUBLE,
    height DOUBLE,
    z_index INT,
    element_data TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_floor_plan_id (floor_plan_id),
    INDEX idx_element_type (element_type),
    INDEX idx_reference (reference_id, element_type),
    FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE
);

