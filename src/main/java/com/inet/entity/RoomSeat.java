package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Entity
@Table(name = "room_seat")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RoomSeat {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "seat_id")
    private Long seatId;
    
    @Column(name = "seat_name", nullable = false)
    private String seatName;
    
    @Column(name = "x_coordinate")
    private Integer xCoordinate = 0;
    
    @Column(name = "y_coordinate")
    private Integer yCoordinate = 0;
    
    @Column(name = "width")
    private Integer width = 40;
    
    @Column(name = "height")
    private Integer height = 30;
    
    @Column(name = "color")
    private String color = "#fbbf24";
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_room_id", nullable = false)
    private FloorRoom floorRoom;
    
    @OneToMany(mappedBy = "roomSeat", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DeviceLocation> deviceLocations;
} 