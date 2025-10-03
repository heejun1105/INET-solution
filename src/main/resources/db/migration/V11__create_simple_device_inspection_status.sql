-- 기존 테이블 삭제
DROP TABLE IF EXISTS device_inspection_status;

-- 단순한 검사 상태 테이블 생성 (날짜/시간 정보 없음)
CREATE TABLE device_inspection_status (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    school_id BIGINT NOT NULL,
    inspector_id BIGINT NOT NULL,
    inspection_status VARCHAR(20) NOT NULL, -- 'confirmed', 'modified', 'unchecked'
    UNIQUE KEY unique_device_inspection (device_id, school_id, inspector_id),
    FOREIGN KEY (device_id) REFERENCES device(device_id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE CASCADE
);
