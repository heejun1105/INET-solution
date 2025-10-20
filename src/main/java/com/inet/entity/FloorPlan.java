package com.inet.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 평면도 엔티티
 * 학교별 평면도 메타데이터를 관리
 */
@Entity
@Table(name = "floor_plans", indexes = {
    @Index(name = "idx_school_active", columnList = "school_id,is_active")
})
public class FloorPlan {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "school_id", nullable = false)
    private Long schoolId;
    
    @Column(name = "name", nullable = false, length = 200)
    private String name;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    // 캔버스 설정
    @Column(name = "canvas_width")
    private Integer canvasWidth;
    
    @Column(name = "canvas_height")
    private Integer canvasHeight;
    
    @Column(name = "zoom_level")
    private Double zoomLevel;
    
    // 패닝 위치 (뷰포트 중심)
    @Column(name = "pan_x")
    private Double panX;
    
    @Column(name = "pan_y")
    private Double panY;
    
    // 그리드 설정
    @Column(name = "grid_size")
    private Integer gridSize;
    
    @Column(name = "show_grid")
    private Boolean showGrid;
    
    @Column(name = "snap_to_grid")
    private Boolean snapToGrid;
    
    // 버전 관리 (낙관적 락)
    @Version
    @Column(name = "version")
    private Long version;
    
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
    
    public Double getPanX() {
        return panX;
    }
    
    public void setPanX(Double panX) {
        this.panX = panX;
    }
    
    public Double getPanY() {
        return panY;
    }
    
    public void setPanY(Double panY) {
        this.panY = panY;
    }
    
    public Integer getGridSize() {
        return gridSize;
    }
    
    public void setGridSize(Integer gridSize) {
        this.gridSize = gridSize;
    }
    
    public Boolean getShowGrid() {
        return showGrid;
    }
    
    public void setShowGrid(Boolean showGrid) {
        this.showGrid = showGrid;
    }
    
    public Boolean getSnapToGrid() {
        return snapToGrid;
    }
    
    public void setSnapToGrid(Boolean snapToGrid) {
        this.snapToGrid = snapToGrid;
    }
    
    public Long getVersion() {
        return version;
    }
    
    public void setVersion(Long version) {
        this.version = version;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
} 