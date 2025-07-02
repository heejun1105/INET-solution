package com.inet.repository;

import com.inet.entity.FloorRoom;
import com.inet.entity.Building;
import com.inet.entity.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FloorRoomRepository extends JpaRepository<FloorRoom, Long> {
    
    List<FloorRoom> findByBuilding(Building building);
    
    List<FloorRoom> findByBuilding_BuildingId(Long buildingId);
    
    @Query("SELECT fr FROM FloorRoom fr WHERE fr.building.buildingId = :buildingId ORDER BY fr.roomName")
    List<FloorRoom> findByBuildingIdOrderByRoomName(@Param("buildingId") Long buildingId);
    
    @Query("SELECT fr FROM FloorRoom fr WHERE fr.school.schoolId = :schoolId ORDER BY fr.roomName")
    List<FloorRoom> findBySchoolIdOrderByRoomName(@Param("schoolId") Long schoolId);
    
    @Query("SELECT fr FROM FloorRoom fr WHERE fr.school.schoolId = :schoolId AND fr.building IS NULL ORDER BY fr.roomName")
    List<FloorRoom> findIndependentRoomsBySchoolId(@Param("schoolId") Long schoolId);
    
    @Query("SELECT fr FROM FloorRoom fr WHERE fr.building.school.schoolId = :schoolId")
    List<FloorRoom> findBySchoolId(@Param("schoolId") Long schoolId);
    
    List<FloorRoom> findByClassroom_ClassroomId(Long classroomId);
    
    List<FloorRoom> findByClassroomIsNull();
    
    List<FloorRoom> findByRoomNameContainingIgnoreCase(String roomName);
    
    List<FloorRoom> findByRoomType(String roomType);
    
    Optional<FloorRoom> findByClassroom(Classroom classroom);
    
    boolean existsByBuildingAndRoomName(Building building, String roomName);
} 