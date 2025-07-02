package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "wireless_ap_location")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WirelessApLocation {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ap_location_id")
    private Long apLocationId;
    
    @Column(name = "x_coordinate")
    private Integer xCoordinate = 50; // 교실 중앙 기본값
    
    @Column(name = "y_coordinate")
    private Integer yCoordinate = 40; // 교실 중앙 기본값
    
    @Column(name = "color")
    private String color = "#ef4444"; // 빨간색 기본값
    
    @Column(name = "radius")
    private Integer radius = 8;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wireless_ap_id", nullable = false)
    private WirelessAp wirelessAp;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_room_id", nullable = false)
    private FloorRoom floorRoom;
} 