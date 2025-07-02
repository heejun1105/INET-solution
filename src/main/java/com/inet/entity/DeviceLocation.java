package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "device_location")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DeviceLocation {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "device_location_id")
    private Long deviceLocationId;
    
    @Column(name = "x_coordinate")
    private Integer xCoordinate = 0;
    
    @Column(name = "y_coordinate")
    private Integer yCoordinate = 0;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id")
    private RoomSeat roomSeat; // 특정 자리에 배치된 경우
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_room_id")
    private FloorRoom floorRoom; // 교실 전체에 표시되는 경우
} 