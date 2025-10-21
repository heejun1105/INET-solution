package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;

/**
 * 네트워크 장비 엔티티 (MDF/IDF)
 * 평면도에 배치되는 네트워크 주장비를 관리
 */
@Entity
@Table(name = "network_equipment", indexes = {
    @Index(name = "idx_network_equipment_school", columnList = "school_id"),
    @Index(name = "idx_network_equipment_type", columnList = "equipment_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NetworkEquipment {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "equipment_id")
    private Long equipmentId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;
    
    @Column(name = "name", nullable = false, length = 200)
    private String name; // MDF-1, IDF-2 등
    
    @Column(name = "equipment_type", nullable = false, length = 50)
    private String equipmentType; // MDF, IDF
    
    @Column(name = "color", length = 50)
    private String color; // 색상 (HEX 코드)
    
    @Column(name = "x_coordinate")
    private Double xCoordinate;
    
    @Column(name = "y_coordinate")
    private Double yCoordinate;
    
    @Column(name = "width")
    private Double width;
    
    @Column(name = "height")
    private Double height;
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description; // 설명
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}

