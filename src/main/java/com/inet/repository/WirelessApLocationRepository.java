package com.inet.repository;

import com.inet.entity.WirelessApLocation;
import com.inet.entity.WirelessAp;
import com.inet.entity.FloorRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface WirelessApLocationRepository extends JpaRepository<WirelessApLocation, Long> {
    
    Optional<WirelessApLocation> findByWirelessAp(WirelessAp wirelessAp);
    
    List<WirelessApLocation> findByFloorRoom(FloorRoom floorRoom);
    
    @Query("SELECT wal FROM WirelessApLocation wal WHERE wal.floorRoom.floorRoomId = :floorRoomId")
    List<WirelessApLocation> findByFloorRoomId(@Param("floorRoomId") Long floorRoomId);
    
    @Query("SELECT wal FROM WirelessApLocation wal WHERE wal.floorRoom.school.schoolId = :schoolId")
    List<WirelessApLocation> findBySchoolId(@Param("schoolId") Long schoolId);
    
    void deleteByWirelessAp(WirelessAp wirelessAp);
} 