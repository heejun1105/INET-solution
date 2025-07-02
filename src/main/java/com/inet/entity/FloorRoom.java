package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Entity
@Table(name = "floor_room")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FloorRoom {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "floor_room_id")
    private Long floorRoomId;
    
    @Column(name = "room_name", nullable = false)
    private String roomName;
    
    @Column(name = "room_type")
    private String roomType; // classroom, restroom, stairs, entrance, etc.
    
    @Column(name = "x_coordinate")
    private Integer xCoordinate = 0;
    
    @Column(name = "y_coordinate") 
    private Integer yCoordinate = 0;
    
    @Column(name = "width")
    private Integer width = 100;
    
    @Column(name = "height")
    private Integer height = 80;
    
    @Column(name = "color")
    private String color = "#10b981";
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id", nullable = true)
    private Building building; // 교실은 건물에 속할 수도 있고 독립적일 수도 있음
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id", nullable = false)
    private School school; // 교실은 반드시 학교에 속해야 함
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom; // 기존 Classroom과 연결
    
    @OneToMany(mappedBy = "floorRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoomSeat> seats;
    
    @OneToMany(mappedBy = "floorRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WirelessApLocation> wirelessApLocations;
} 