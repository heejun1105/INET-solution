package com.inet.repository;

import com.inet.entity.DeviceLocation;
import com.inet.entity.Device;
import com.inet.entity.FloorRoom;
import com.inet.entity.RoomSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceLocationRepository extends JpaRepository<DeviceLocation, Long> {
    
    Optional<DeviceLocation> findByDevice(Device device);
    
    List<DeviceLocation> findByFloorRoom(FloorRoom floorRoom);
    
    List<DeviceLocation> findByRoomSeat(RoomSeat roomSeat);
    
    @Query("SELECT dl FROM DeviceLocation dl WHERE dl.floorRoom.floorRoomId = :floorRoomId")
    List<DeviceLocation> findByFloorRoomId(@Param("floorRoomId") Long floorRoomId);
    
    @Query("SELECT dl FROM DeviceLocation dl WHERE dl.roomSeat.seatId = :seatId")
    List<DeviceLocation> findBySeatId(@Param("seatId") Long seatId);
    
    void deleteByDevice(Device device);
} 