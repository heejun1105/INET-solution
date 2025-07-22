package com.inet.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "floor_plan_elements")
public class FloorPlanElement {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "floor_plan_id", nullable = false)
    private Long floorPlanId;
    
    @Column(name = "element_type", nullable = false)
    private String elementType; // room, building, wireless_ap, shape, other_space
    
    @Column(name = "reference_id")
    private Long referenceId; // 기존 엔티티의 ID (교실, 건물, 무선AP 등)
    
    @Column(name = "x_coordinate", nullable = false)
    private Double xCoordinate;
    
    @Column(name = "y_coordinate", nullable = false)
    private Double yCoordinate;
    
    @Column(name = "width")
    private Double width;
    
    @Column(name = "height")
    private Double height;
    
    @Column(name = "z_index")
    private Integer zIndex;
    
    @Column(name = "element_data", columnDefinition = "TEXT")
    private String elementData; // JSON 형태의 추가 데이터 (도형 정보, 스타일 등)
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    // 생성자
    public FloorPlanElement() {
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
    
    public Long getFloorPlanId() {
        return floorPlanId;
    }
    
    public void setFloorPlanId(Long floorPlanId) {
        this.floorPlanId = floorPlanId;
    }
    
    public String getElementType() {
        return elementType;
    }
    
    public void setElementType(String elementType) {
        this.elementType = elementType;
    }
    
    public Long getReferenceId() {
        return referenceId;
    }
    
    public void setReferenceId(Long referenceId) {
        this.referenceId = referenceId;
    }
    
    public Double getXCoordinate() {
        return xCoordinate;
    }
    
    public void setXCoordinate(Double xCoordinate) {
        this.xCoordinate = xCoordinate;
    }
    
    public Double getYCoordinate() {
        return yCoordinate;
    }
    
    public void setYCoordinate(Double yCoordinate) {
        this.yCoordinate = yCoordinate;
    }
    
    public Double getWidth() {
        return width;
    }
    
    public void setWidth(Double width) {
        this.width = width;
    }
    
    public Double getHeight() {
        return height;
    }
    
    public void setHeight(Double height) {
        this.height = height;
    }
    
    public Integer getZIndex() {
        return zIndex;
    }
    
    public void setZIndex(Integer zIndex) {
        this.zIndex = zIndex;
    }
    
    public String getElementData() {
        return elementData;
    }
    
    public void setElementData(String elementData) {
        this.elementData = elementData;
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