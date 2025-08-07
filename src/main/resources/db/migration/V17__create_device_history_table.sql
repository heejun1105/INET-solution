CREATE TABLE device_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    before_value TEXT,
    after_value TEXT,
    modified_at DATETIME NOT NULL,
    modified_by BIGINT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES device(device_id) ON DELETE CASCADE,
    FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_device_history_device_id ON device_history(device_id);
CREATE INDEX idx_device_history_modified_at ON device_history(modified_at);
CREATE INDEX idx_device_history_modified_by ON device_history(modified_by);
