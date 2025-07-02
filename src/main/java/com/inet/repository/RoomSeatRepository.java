package com.inet.repository;

import com.inet.entity.RoomSeat;
import com.inet.entity.FloorRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RoomSeatRepository extends JpaRepository<RoomSeat, Long> {
    
    List<RoomSeat> findByFloorRoom(FloorRoom floorRoom);
    
    List<RoomSeat> findByFloorRoomFloorRoomId(Long floorRoomId);
    
    @Query("SELECT rs FROM RoomSeat rs WHERE rs.floorRoom.floorRoomId = :floorRoomId ORDER BY rs.seatName")
    List<RoomSeat> findByFloorRoomIdOrderBySeatName(@Param("floorRoomId") Long floorRoomId);
    
    boolean existsByFloorRoomAndSeatName(FloorRoom floorRoom, String seatName);
} 