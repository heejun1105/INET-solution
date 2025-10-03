CREATE TABLE device_inspection_status (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    school_id BIGINT NOT NULL,
    inspector_id BIGINT NOT NULL,
    inspection_status ENUM('unchecked', 'confirmed', 'modified') NOT NULL DEFAULT 'unchecked',
    inspection_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES device(device_id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES school(school_id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_device_inspection (device_id, school_id, inspector_id, DATE(inspection_date))
);
