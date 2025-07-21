package com.inet.service;

import java.util.*;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.inet.entity.*;
import com.inet.repository.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class FloorPlanService {
    
    private final BuildingRepository buildingRepository;
    private final FloorRoomRepository floorRoomRepository;
    private final RoomSeatRepository roomSeatRepository;
    private final DeviceLocationRepository deviceLocationRepository;
    private final WirelessApLocationRepository wirelessApLocationRepository;
    private final SchoolRepository schoolRepository;
    private final DeviceRepository deviceRepository;
    private final WirelessApRepository wirelessApRepository;
    private final ClassroomRepository classroomRepository;
    
    // 학교별 건물 조회
    public List<Building> getBuildingsBySchool(Long schoolId) {
        return buildingRepository.findBySchoolIdOrderByName(schoolId);
    }
    
    // 건물별 방 조회 (층 없이 바로 건물에 속한 방들 조회)
    public List<FloorRoom> getRoomsByBuilding(Long buildingId) {
        return floorRoomRepository.findByBuildingIdOrderByRoomName(buildingId);
    }
    
    // 학교의 독립 교실들 조회 (건물에 속하지 않은 교실들)
    public List<FloorRoom> getIndependentRoomsBySchool(Long schoolId) {
        return floorRoomRepository.findIndependentRoomsBySchoolId(schoolId);
    }
    
    // 학교의 모든 교실들 조회 (건물 안팎 구분 없이)
    public List<FloorRoom> getAllRoomsBySchool(Long schoolId) {
        return floorRoomRepository.findBySchoolIdOrderByRoomName(schoolId);
    }
    
    // 방별 자리 조회
    public List<RoomSeat> getSeatsByRoom(Long floorRoomId) {
        return roomSeatRepository.findByFloorRoomIdOrderBySeatName(floorRoomId);
    }
    
    // 학교 전체 평면도 데이터 조회
    @Transactional(readOnly = true)
    public Map<String, Object> getSchoolFloorPlan(Long schoolId) {
        Map<String, Object> result = new HashMap<>();
        
        List<Building> buildings = getBuildingsBySchool(schoolId);
        result.put("buildings", buildings);
        
        // 독립 교실들 (건물에 속하지 않은 교실들)
        List<FloorRoom> independentRooms = getIndependentRoomsBySchool(schoolId);
        result.put("rooms", independentRooms);
        
        Map<Long, List<FloorRoom>> roomsByBuilding = new HashMap<>();
        Map<Long, List<RoomSeat>> seatsByRoom = new HashMap<>();
        Map<Long, List<DeviceLocation>> devicesByRoom = new HashMap<>();
        Map<Long, List<WirelessApLocation>> apsByRoom = new HashMap<>();
        
        // 건물에 속한 교실들 처리
        for (Building building : buildings) {
            List<FloorRoom> rooms = getRoomsByBuilding(building.getBuildingId());
            roomsByBuilding.put(building.getBuildingId(), rooms);
            
            // 건물 안 교실들의 상세 정보
            for (FloorRoom room : rooms) {
                List<RoomSeat> seats = getSeatsByRoom(room.getFloorRoomId());
                seatsByRoom.put(room.getFloorRoomId(), seats);
                
                List<DeviceLocation> devices = deviceLocationRepository.findByFloorRoomId(room.getFloorRoomId());
                devicesByRoom.put(room.getFloorRoomId(), devices);
                
                List<WirelessApLocation> aps = wirelessApLocationRepository.findByFloorRoomId(room.getFloorRoomId());
                apsByRoom.put(room.getFloorRoomId(), aps);
            }
        }
        
        // 독립 교실들의 상세 정보 처리
        for (FloorRoom room : independentRooms) {
            List<RoomSeat> seats = getSeatsByRoom(room.getFloorRoomId());
            seatsByRoom.put(room.getFloorRoomId(), seats);
            
            List<DeviceLocation> devices = deviceLocationRepository.findByFloorRoomId(room.getFloorRoomId());
            devicesByRoom.put(room.getFloorRoomId(), devices);
            
            List<WirelessApLocation> aps = wirelessApLocationRepository.findByFloorRoomId(room.getFloorRoomId());
            apsByRoom.put(room.getFloorRoomId(), aps);
        }
        
        result.put("roomsByBuilding", roomsByBuilding);
        result.put("seatsByRoom", seatsByRoom);
        result.put("devicesByRoom", devicesByRoom);
        result.put("apsByRoom", apsByRoom);
        
        return result;
    }
    
    // 건물 저장/수정
    @Transactional
    public Building saveBuilding(Building building) {
        return buildingRepository.save(building);
    }
    
    // 방 저장/수정
    @Transactional
    public FloorRoom saveRoom(FloorRoom room) {
        return floorRoomRepository.save(room);
    }
    
    // 자리 저장/수정
    @Transactional
    public RoomSeat saveSeat(RoomSeat seat) {
        return roomSeatRepository.save(seat);
    }
    
    // 장비 위치 저장/수정
    @Transactional
    public DeviceLocation saveDeviceLocation(DeviceLocation deviceLocation) {
        return deviceLocationRepository.save(deviceLocation);
    }
    
    // 무선AP 위치 저장/수정
    @Transactional
    public WirelessApLocation saveWirelessApLocation(WirelessApLocation apLocation) {
        return wirelessApLocationRepository.save(apLocation);
    }
    
    // 건물 삭제
    @Transactional
    public void deleteBuilding(Long buildingId) {
        buildingRepository.deleteById(buildingId);
    }
    
    // 방 삭제
    @Transactional
    public void deleteRoom(Long floorRoomId) {
        floorRoomRepository.deleteById(floorRoomId);
    }
    
    // 자리 삭제
    @Transactional
    public void deleteSeat(Long seatId) {
        roomSeatRepository.deleteById(seatId);
    }
    
    // 교실에 배치된 장비 정보 조회 (교실 표시용)
    @Transactional(readOnly = true)
    public Map<String, Integer> getDeviceCountByType(Long floorRoomId) {
        Optional<FloorRoom> room = floorRoomRepository.findById(floorRoomId);
        if (room.isEmpty() || room.get().getClassroom() == null) {
            return new HashMap<>();
        }
        
        List<Device> devices = deviceRepository.findByClassroom(room.get().getClassroom());
        Map<String, Integer> deviceCounts = new HashMap<>();
        
        for (Device device : devices) {
            String type = device.getType();
            if (type != null) {
                deviceCounts.put(type, deviceCounts.getOrDefault(type, 0) + 1);
            }
        }
        
        return deviceCounts;
    }
    
    // 교실 ID로 직접 장비 정보 조회 (Classroom 기반)
    @Transactional(readOnly = true)
    public Map<String, Integer> getDeviceCountByClassroom(Long classroomId) {
        Optional<Classroom> classroom = classroomRepository.findById(classroomId);
        if (classroom.isEmpty()) {
            return new HashMap<>();
        }
        
        List<Device> devices = deviceRepository.findByClassroom(classroom.get());
        Map<String, Integer> deviceCounts = new HashMap<>();
        
        for (Device device : devices) {
            String type = normalizeDeviceType(device.getType());
            if (type != null && !type.trim().isEmpty()) {
                deviceCounts.put(type, deviceCounts.getOrDefault(type, 0) + 1);
            }
        }
        
        return deviceCounts;
    }
    
    // 장비 타입 정규화 (다양한 표기를 통일)
    private String normalizeDeviceType(String originalType) {
        if (originalType == null || originalType.trim().isEmpty()) {
            return null;
        }
        
        String type = originalType.trim().toLowerCase();
        
        // 데스크톱/PC 관련
        if (type.contains("데스크") || type.contains("desktop") || 
            type.equals("pc") || type.contains("컴퓨터") || type.contains("본체")) {
            return "데스크톱";
        }
        
        // 모니터 관련
        if (type.contains("모니터") || type.contains("monitor") || type.contains("디스플레이")) {
            return "모니터";
        }
        
        // TV 관련
        if (type.contains("tv") || type.contains("티브이") || type.contains("텔레비전")) {
            return "TV";
        }
        
        // 노트북 관련
        if (type.contains("노트북") || type.contains("laptop") || type.contains("notebook")) {
            return "노트북";
        }
        
        // 프린터 관련
        if (type.contains("프린터") || type.contains("printer") || type.contains("복합기")) {
            return "프린터";
        }
        
        // 프로젝터 관련
        if (type.contains("프로젝터") || type.contains("projector") || type.contains("빔")) {
            return "프로젝터";
        }
        
        // 스피커 관련
        if (type.contains("스피커") || type.contains("speaker") || type.contains("사운드")) {
            return "스피커";
        }
        
        // 네트워크 관련
        if (type.contains("스위치") || type.contains("라우터") || type.contains("허브") || 
            type.contains("switch") || type.contains("router") || type.contains("hub")) {
            return "네트워크";
        }
        
        // 원본 타입 반환 (첫 글자 대문자로)
        return originalType.substring(0, 1).toUpperCase() + originalType.substring(1);
    }
    
    // 평면도 일괄 저장
    @Transactional
    public void saveFloorPlanData(Map<String, Object> floorPlanData) {
        log.info("평면도 데이터 저장 시작");
        
        // 건물 데이터 저장
        if (floorPlanData.containsKey("buildings")) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> buildings = (List<Map<String, Object>>) floorPlanData.get("buildings");
            for (Map<String, Object> buildingData : buildings) {
                saveOrUpdateBuilding(buildingData);
            }
        }
        
        // 교실 데이터 저장
        if (floorPlanData.containsKey("rooms")) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rooms = (List<Map<String, Object>>) floorPlanData.get("rooms");
            for (Map<String, Object> roomData : rooms) {
                saveOrUpdateRoom(roomData);
            }
        }
        
        log.info("평면도 데이터 저장 완료");
    }
    
    private void saveOrUpdateBuilding(Map<String, Object> buildingData) {
        Building building = new Building();
        
        if (buildingData.containsKey("buildingId") && buildingData.get("buildingId") != null) {
            String idStr = buildingData.get("buildingId").toString();
            try {
                building.setBuildingId(Long.valueOf(idStr));
            } catch (NumberFormatException e) {
                // 임시 ID(문자열)이면 무시 (신규 엔티티로 저장)
            }
        }
        
        building.setBuildingName((String) buildingData.get("buildingName"));
        building.setXCoordinate((Integer) buildingData.get("xCoordinate"));
        building.setYCoordinate((Integer) buildingData.get("yCoordinate"));
        building.setWidth((Integer) buildingData.get("width"));
        building.setHeight((Integer) buildingData.get("height"));
        building.setColor((String) buildingData.get("color"));
        
        Long schoolId = Long.valueOf(buildingData.get("schoolId").toString());
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found"));
        building.setSchool(school);
        
        buildingRepository.save(building);
    }
    
    private void saveOrUpdateRoom(Map<String, Object> roomData) {
        FloorRoom room = new FloorRoom();
        
        if (roomData.containsKey("floorRoomId") && roomData.get("floorRoomId") != null) {
            String idStr = roomData.get("floorRoomId").toString();
            try {
                room.setFloorRoomId(Long.valueOf(idStr));
            } catch (NumberFormatException e) {
                // 임시 ID(문자열)이면 무시 (신규 엔티티로 저장)
            }
        }
        
        room.setRoomName((String) roomData.get("roomName"));
        room.setRoomType((String) roomData.get("roomType"));
        room.setXCoordinate((Integer) roomData.get("xCoordinate"));
        room.setYCoordinate((Integer) roomData.get("yCoordinate"));
        room.setWidth((Integer) roomData.get("width"));
        room.setHeight((Integer) roomData.get("height"));
        
        // School 설정
        Long schoolId = Long.valueOf(roomData.get("schoolId").toString());
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("School not found"));
        room.setSchool(school);
        
        // Building 설정 (독립 교실인 경우 null일 수 있음)
        if (roomData.containsKey("buildingId") && roomData.get("buildingId") != null) {
            String buildingIdStr = roomData.get("buildingId").toString();
            try {
                Long buildingId = Long.valueOf(buildingIdStr);
                Building building = buildingRepository.findById(buildingId)
                    .orElseThrow(() -> new IllegalArgumentException("Building not found"));
                room.setBuilding(building);
            } catch (NumberFormatException e) {
                // 임시 ID(문자열)이면 무시 (신규 엔티티로 저장)
            }
        }
        
        floorRoomRepository.save(room);
    }
    
    // 미배치 교실 목록 조회 (평면도에 배치되지 않은 교실들)
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUnplacedRooms(Long schoolId) {
        List<Map<String, Object>> unplacedRooms = new java.util.ArrayList<>();
        
        try {
            // 해당 학교의 모든 교실 조회
            List<Classroom> allClassrooms = classroomRepository.findBySchoolSchoolIdOrderByRoomNameAsc(schoolId);
            
            // 실제 교실 데이터를 미배치 교실로 표시 (임시)
            for (Classroom classroom : allClassrooms) {
                Map<String, Object> roomData = new HashMap<>();
                roomData.put("classroomId", classroom.getClassroomId());
                roomData.put("roomName", classroom.getRoomName());
                roomData.put("schoolId", schoolId);
                unplacedRooms.add(roomData);
            }
            
            log.info("학교 {}의 교실 {}개 조회 완료", schoolId, unplacedRooms.size());
            
        } catch (Exception e) {
            log.error("교실 조회 중 오류 발생", e);
            // 오류 발생 시 빈 리스트 반환
        }
        
        return unplacedRooms;
    }
} 