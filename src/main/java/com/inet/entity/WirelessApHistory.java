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
@Entity
@Table(name = "wireless_ap_history")
public class WirelessApHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long historyId;
    
    @ManyToOne
    @JoinColumn(name = "ap_id")
    private WirelessAp wirelessAp;
    
    @Column(name = "field_name", nullable = false)
    private String fieldName; // 수정된 필드명 (예: location, manufacturer, model 등)
    
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
    public WirelessApHistory(WirelessAp wirelessAp, String fieldName, String beforeValue, String afterValue, User modifiedBy) {
        this.wirelessAp = wirelessAp;
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
    
    public WirelessAp getWirelessAp() {
        return this.wirelessAp;
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
    
    // Setter methods
    public void setHistoryId(Long historyId) {
        this.historyId = historyId;
    }
    
    public void setWirelessAp(WirelessAp wirelessAp) {
        this.wirelessAp = wirelessAp;
    }
    
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }
    
    public void setBeforeValue(String beforeValue) {
        this.beforeValue = beforeValue;
    }
    
    public void setAfterValue(String afterValue) {
        this.afterValue = afterValue;
    }
    
    public void setModifiedAt(LocalDateTime modifiedAt) {
        this.modifiedAt = modifiedAt;
    }
    
    public void setModifiedBy(User modifiedBy) {
        this.modifiedBy = modifiedBy;
    }
    
    // Default constructor
    public WirelessApHistory() {
    }
}
