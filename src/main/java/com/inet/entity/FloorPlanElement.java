package com.inet.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 평면도 요소 엔티티
 * 평면도에 배치된 모든 요소(건물, 교실, 무선AP, 도형 등)를 표현
 */
@Entity
@Table(name = "floor_plan_elements", indexes = {
    @Index(name = "idx_floor_plan_id", columnList = "floor_plan_id"),
    @Index(name = "idx_element_type", columnList = "element_type"),
    @Index(name = "idx_reference_id", columnList = "reference_id")
})
public class FloorPlanElement {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "floor_plan_id", nullable = false)
    private Long floorPlanId;
    
    @Column(name = "element_type", nullable = false, length = 50)
    private String elementType; // room, building, wireless_ap, shape, other_space
    
    @Column(name = "reference_id")
    private Long referenceId; // 기존 엔티티의 ID (교실, 건물, 무선AP 등)
    
    // 위치 및 크기 정보 (구조화된 필드)
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
    
    @Column(name = "rotation")
    private Double rotation; // 회전 각도 (도)
    
    // 새로 추가된 필드들
    @Column(name = "parent_element_id")
    private Long parentElementId; // 부모 요소 ID (자리는 교실에 속함)
    
    @Column(name = "layer_order")
    private Integer layerOrder; // 레이어 순서 (z-index보다 명확)
    
    @Column(name = "is_locked")
    private Boolean isLocked = false; // 이동 잠금 여부
    
    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata; // 추가 메타데이터 (JSON)
    
    // 스타일 정보 (구조화된 필드)
    @Column(name = "color", length = 50)
    private String color;
    
    @Column(name = "background_color", length = 50)
    private String backgroundColor;
    
    @Column(name = "border_color", length = 50)
    private String borderColor;
    
    @Column(name = "border_width")
    private Double borderWidth;
    
    @Column(name = "opacity")
    private Double opacity;
    
    // 도형 전용 필드
    @Column(name = "shape_type", length = 50)
    private String shapeType; // rectangle, circle, ellipse, line, arrow, text
    
    @Column(name = "text_content", columnDefinition = "TEXT")
    private String textContent; // 텍스트 요소의 내용
    
    @Column(name = "font_size")
    private Integer fontSize;
    
    @Column(name = "font_family", length = 100)
    private String fontFamily;
    
    // 선 도형 전용 필드
    @Column(name = "start_x")
    private Double startX;
    
    @Column(name = "start_y")
    private Double startY;
    
    @Column(name = "end_x")
    private Double endX;
    
    @Column(name = "end_y")
    private Double endY;
    
    // 라벨 정보
    @Column(name = "label", length = 255)
    private String label; // 요소에 표시될 라벨
    
    @Column(name = "show_label")
    private Boolean showLabel; // 라벨 표시 여부
    
    // 추가 메타데이터 (복잡한 데이터는 여전히 JSON으로 저장)
    @Column(name = "element_data", columnDefinition = "TEXT")
    private String elementData; // JSON 형태의 추가 데이터
    
    // 페이지 번호 (학교별 평면도를 여러 페이지로 나눌 수 있음)
    @Column(name = "page_number")
    private Integer pageNumber = 1; // 기본값: 1페이지
    
    // 버전 관리 (낙관적 락)
    @Version
    @Column(name = "version")
    private Long version;
    
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
    
    public Double getRotation() {
        return rotation;
    }
    
    public void setRotation(Double rotation) {
        this.rotation = rotation;
    }
    
    public String getColor() {
        return color;
    }
    
    public void setColor(String color) {
        this.color = color;
    }
    
    public String getBackgroundColor() {
        return backgroundColor;
    }
    
    public void setBackgroundColor(String backgroundColor) {
        this.backgroundColor = backgroundColor;
    }
    
    public String getBorderColor() {
        return borderColor;
    }
    
    public void setBorderColor(String borderColor) {
        this.borderColor = borderColor;
    }
    
    public Double getBorderWidth() {
        return borderWidth;
    }
    
    public void setBorderWidth(Double borderWidth) {
        this.borderWidth = borderWidth;
    }
    
    public Double getOpacity() {
        return opacity;
    }
    
    public void setOpacity(Double opacity) {
        this.opacity = opacity;
    }
    
    public String getShapeType() {
        return shapeType;
    }
    
    public void setShapeType(String shapeType) {
        this.shapeType = shapeType;
    }
    
    public String getTextContent() {
        return textContent;
    }
    
    public void setTextContent(String textContent) {
        this.textContent = textContent;
    }
    
    public Integer getFontSize() {
        return fontSize;
    }
    
    public void setFontSize(Integer fontSize) {
        this.fontSize = fontSize;
    }
    
    public String getFontFamily() {
        return fontFamily;
    }
    
    public void setFontFamily(String fontFamily) {
        this.fontFamily = fontFamily;
    }
    
    public Double getStartX() {
        return startX;
    }
    
    public void setStartX(Double startX) {
        this.startX = startX;
    }
    
    public Double getStartY() {
        return startY;
    }
    
    public void setStartY(Double startY) {
        this.startY = startY;
    }
    
    public Double getEndX() {
        return endX;
    }
    
    public void setEndX(Double endX) {
        this.endX = endX;
    }
    
    public Double getEndY() {
        return endY;
    }
    
    public void setEndY(Double endY) {
        this.endY = endY;
    }
    
    public String getLabel() {
        return label;
    }
    
    public void setLabel(String label) {
        this.label = label;
    }
    
    public Boolean getShowLabel() {
        return showLabel;
    }
    
    public void setShowLabel(Boolean showLabel) {
        this.showLabel = showLabel;
    }
    
    public Long getVersion() {
        return version;
    }
    
    public void setVersion(Long version) {
        this.version = version;
    }
    
    public Long getParentElementId() {
        return parentElementId;
    }
    
    public void setParentElementId(Long parentElementId) {
        this.parentElementId = parentElementId;
    }
    
    public Integer getLayerOrder() {
        return layerOrder;
    }
    
    public void setLayerOrder(Integer layerOrder) {
        this.layerOrder = layerOrder;
    }
    
    public Boolean getIsLocked() {
        return isLocked;
    }
    
    public void setIsLocked(Boolean isLocked) {
        this.isLocked = isLocked;
    }
    
    public String getMetadata() {
        return metadata;
    }
    
    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }
    
    public Integer getPageNumber() {
        return pageNumber;
    }
    
    public void setPageNumber(Integer pageNumber) {
        this.pageNumber = pageNumber != null ? pageNumber : 1;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
} 