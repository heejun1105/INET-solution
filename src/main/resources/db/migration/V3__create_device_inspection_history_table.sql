-- 장비검사 이력 테이블
CREATE TABLE device_inspection_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    school_id BIGINT NOT NULL,
    inspector_id BIGINT NOT NULL,
    inspection_date DATETIME NOT NULL,
    confirmed_count INT NOT NULL DEFAULT 0,
    modified_count INT NOT NULL DEFAULT 0,
    unconfirmed_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    inspection_details TEXT, -- JSON 형태로 각 장비별 검사 상태 저장
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_school_id (school_id),
    INDEX idx_inspector_id (inspector_id),
    INDEX idx_inspection_date (inspection_date),
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE CASCADE
);
