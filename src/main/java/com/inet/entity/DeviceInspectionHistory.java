package com.inet.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "device_inspection_history")
public class DeviceInspectionHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "school_id", nullable = false)
    private Long schoolId;
    
    @Column(name = "inspector_id", nullable = false)
    private Long inspectorId;
    
    @Column(name = "inspection_date", nullable = false)
    private LocalDateTime inspectionDate;
    
    @Column(name = "confirmed_count", nullable = false)
    private Integer confirmedCount = 0;
    
    @Column(name = "modified_count", nullable = false)
    private Integer modifiedCount = 0;
    
    @Column(name = "unconfirmed_count", nullable = false)
    private Integer unconfirmedCount = 0;
    
    @Column(name = "total_count", nullable = false)
    private Integer totalCount = 0;
    
    @Column(name = "inspection_details", columnDefinition = "TEXT")
    private String inspectionDetails; // JSON 형태로 각 장비별 검사 상태 저장
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    // 생성자
    public DeviceInspectionHistory() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Long getSchoolId() {
        return schoolId;
    }
    
    public void setSchoolId(Long schoolId) {
        this.schoolId = schoolId;
    }
    
    public Long getInspectorId() {
        return inspectorId;
    }
    
    public void setInspectorId(Long inspectorId) {
        this.inspectorId = inspectorId;
    }
    
    public LocalDateTime getInspectionDate() {
        return inspectionDate;
    }
    
    public void setInspectionDate(LocalDateTime inspectionDate) {
        this.inspectionDate = inspectionDate;
    }
    
    public Integer getConfirmedCount() {
        return confirmedCount;
    }
    
    public void setConfirmedCount(Integer confirmedCount) {
        this.confirmedCount = confirmedCount;
    }
    
    public Integer getModifiedCount() {
        return modifiedCount;
    }
    
    public void setModifiedCount(Integer modifiedCount) {
        this.modifiedCount = modifiedCount;
    }
    
    public Integer getUnconfirmedCount() {
        return unconfirmedCount;
    }
    
    public void setUnconfirmedCount(Integer unconfirmedCount) {
        this.unconfirmedCount = unconfirmedCount;
    }
    
    public Integer getTotalCount() {
        return totalCount;
    }
    
    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }
    
    public String getInspectionDetails() {
        return inspectionDetails;
    }
    
    public void setInspectionDetails(String inspectionDetails) {
        this.inspectionDetails = inspectionDetails;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
