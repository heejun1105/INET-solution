package com.inet.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "device_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DeviceHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long historyId;
    
    @ManyToOne
    @JoinColumn(name = "device_id")
    private Device device;
    
    @Column(name = "field_name", nullable = false)
    private String fieldName; // 수정된 필드명 (예: type, manufacturer, modelName 등)
    
    @Column(name = "before_value", columnDefinition = "TEXT")
    private String beforeValue; // 수정 전 값
    
    @Column(name = "after_value", columnDefinition = "TEXT")
    private String afterValue; // 수정 후 값
    
    @Column(name = "modified_at", nullable = false)
    private LocalDateTime modifiedAt; // 수정 날짜
    
    @ManyToOne
    @JoinColumn(name = "modified_by")
    private User modifiedBy; // 수정한 회원
    
    // 생성자
    public DeviceHistory(Device device, String fieldName, String beforeValue, String afterValue, User modifiedBy) {
        this.device = device;
        this.fieldName = fieldName;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
        this.modifiedAt = LocalDateTime.now();
        this.modifiedBy = modifiedBy;
    }
    
    // Explicit getter methods
    public Long getHistoryId() {
        return this.historyId;
    }
    
    public Device getDevice() {
        return this.device;
    }
    
    public String getFieldName() {
        return this.fieldName;
    }
    
    public String getBeforeValue() {
        return this.beforeValue;
    }
    
    public String getAfterValue() {
        return this.afterValue;
    }
    
    public LocalDateTime getModifiedAt() {
        return this.modifiedAt;
    }
    
    public User getModifiedBy() {
        return this.modifiedBy;
    }
}
