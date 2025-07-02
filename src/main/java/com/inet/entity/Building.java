package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Entity
@Table(name = "building")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Building {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "building_id")
    private Long buildingId;
    
    @Column(name = "building_name", nullable = false)
    private String buildingName;
    
    @Column(name = "x_coordinate")
    private Integer xCoordinate = 0;
    
    @Column(name = "y_coordinate")
    private Integer yCoordinate = 0;
    
    @Column(name = "width")
    private Integer width = 200;
    
    @Column(name = "height")
    private Integer height = 300;
    
    @Column(name = "color")
    private String color = "#3b82f6";
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;
    
    @OneToMany(mappedBy = "building", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FloorRoom> rooms;
} 