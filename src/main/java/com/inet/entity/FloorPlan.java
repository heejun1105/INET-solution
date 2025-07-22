package com.inet.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "floor_plans")
public class FloorPlan {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "school_id", nullable = false)
    private Long schoolId;
    
    @Column(name = "name", nullable = false)
    private String name;
    
    @Column(name = "description")
    private String description;
    
    @Column(name = "canvas_width")
    private Integer canvasWidth;
    
    @Column(name = "canvas_height")
    private Integer canvasHeight;
    
    @Column(name = "zoom_level")
    private Double zoomLevel;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    // 생성자
    public FloorPlan() {
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
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public Integer getCanvasWidth() {
        return canvasWidth;
    }
    
    public void setCanvasWidth(Integer canvasWidth) {
        this.canvasWidth = canvasWidth;
    }
    
    public Integer getCanvasHeight() {
        return canvasHeight;
    }
    
    public void setCanvasHeight(Integer canvasHeight) {
        this.canvasHeight = canvasHeight;
    }
    
    public Double getZoomLevel() {
        return zoomLevel;
    }
    
    public void setZoomLevel(Double zoomLevel) {
        this.zoomLevel = zoomLevel;
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
    
    public Boolean getIsActive() {
        return isActive;
    }
    
    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
} 