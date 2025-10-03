-- 무선AP 수정내역 테이블 생성
CREATE TABLE wireless_ap_history (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ap_id BIGINT NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    before_value TEXT,
    after_value TEXT,
    modified_at DATETIME NOT NULL,
    modified_by BIGINT NOT NULL,
    
    FOREIGN KEY (ap_id) REFERENCES wireless_ap(id) ON DELETE CASCADE,
    FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_ap_id (ap_id),
    INDEX idx_field_name (field_name),
    INDEX idx_modified_at (modified_at),
    INDEX idx_modified_by (modified_by),
    INDEX idx_ap_modified_at (ap_id, modified_at)
);
