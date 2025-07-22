package com.inet.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inet.entity.*;
import com.inet.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class FloorPlanService {
    
    @Autowired
    private FloorPlanRepository floorPlanRepository;
    
    @Autowired
    private FloorPlanElementRepository floorPlanElementRepository;
    
    @Autowired
    private SchoolRepository schoolRepository;
    
    @Autowired
    private ClassroomRepository classroomRepository;
    
    @Autowired
    private BuildingRepository buildingRepository;
    
    @Autowired
    private WirelessApRepository wirelessApRepository;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 학교별 평면도 저장
     */
    @Transactional
    public boolean saveFloorPlan(Long schoolId, Map<String, Object> floorPlanData) {
        try {
            // 학교 존재 확인
            if (!schoolRepository.existsById(schoolId)) {
                throw new RuntimeException("학교를 찾을 수 없습니다: " + schoolId);
            }
            
            // 기존 평면도 조회 또는 새로 생성
            FloorPlan floorPlan = floorPlanRepository.findBySchoolIdAndActive(schoolId)
                    .orElse(new FloorPlan());
            
            // 평면도 메타데이터 설정
            floorPlan.setSchoolId(schoolId);
            floorPlan.setName("평면도_" + schoolId);
            floorPlan.setDescription("학교 평면도");
            floorPlan.setCanvasWidth(4000);
            floorPlan.setCanvasHeight(2500);
            floorPlan.setZoomLevel(1.0);
            floorPlan.setIsActive(true);
            
            // 평면도 저장
            floorPlan = floorPlanRepository.save(floorPlan);
            
            // 기존 요소들 삭제
            floorPlanElementRepository.deleteByFloorPlanId(floorPlan.getId());
            
            // 새로운 요소들 저장
            saveFloorPlanElements(floorPlan.getId(), floorPlanData);
            
            return true;
            
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * 평면도 요소들 저장
     */
    private void saveFloorPlanElements(Long floorPlanId, Map<String, Object> floorPlanData) {
        // 교실 요소들 저장
        if (floorPlanData.containsKey("rooms")) {
            List<Map<String, Object>> rooms = (List<Map<String, Object>>) floorPlanData.get("rooms");
            for (Map<String, Object> room : rooms) {
                saveElement(floorPlanId, "room", room);
            }
        }
        
        // 건물 요소들 저장
        if (floorPlanData.containsKey("buildings")) {
            List<Map<String, Object>> buildings = (List<Map<String, Object>>) floorPlanData.get("buildings");
            for (Map<String, Object> building : buildings) {
                saveElement(floorPlanId, "building", building);
            }
        }
        
        // 무선AP 요소들 저장
        if (floorPlanData.containsKey("wirelessAps")) {
            List<Map<String, Object>> wirelessAps = (List<Map<String, Object>>) floorPlanData.get("wirelessAps");
            for (Map<String, Object> wirelessAp : wirelessAps) {
                saveElement(floorPlanId, "wireless_ap", wirelessAp);
            }
        }
        
        // 도형 요소들 저장
        if (floorPlanData.containsKey("shapes")) {
            List<Map<String, Object>> shapes = (List<Map<String, Object>>) floorPlanData.get("shapes");
            for (Map<String, Object> shape : shapes) {
                saveElement(floorPlanId, "shape", shape);
            }
        }
        
        // 기타공간 요소들 저장
        if (floorPlanData.containsKey("otherSpaces")) {
            List<Map<String, Object>> otherSpaces = (List<Map<String, Object>>) floorPlanData.get("otherSpaces");
            for (Map<String, Object> otherSpace : otherSpaces) {
                saveElement(floorPlanId, "other_space", otherSpace);
            }
        }
    }
    
    /**
     * 개별 요소 저장
     */
    private void saveElement(Long floorPlanId, String elementType, Map<String, Object> elementData) {
        FloorPlanElement element = new FloorPlanElement();
        element.setFloorPlanId(floorPlanId);
        element.setElementType(elementType);
        
        // 참조 ID 설정
        if (elementData.containsKey("classroomId")) {
            element.setReferenceId(Long.valueOf(elementData.get("classroomId").toString()));
        } else if (elementData.containsKey("buildingId")) {
            element.setReferenceId(Long.valueOf(elementData.get("buildingId").toString()));
        } else if (elementData.containsKey("wirelessApId")) {
            element.setReferenceId(Long.valueOf(elementData.get("wirelessApId").toString()));
        } else if (elementData.containsKey("id")) {
            element.setReferenceId(Long.valueOf(elementData.get("id").toString()));
        }
        
        // 위치 정보 설정
        element.setXCoordinate(Double.valueOf(elementData.get("xCoordinate").toString()));
        element.setYCoordinate(Double.valueOf(elementData.get("yCoordinate").toString()));
        
        if (elementData.containsKey("width")) {
            element.setWidth(Double.valueOf(elementData.get("width").toString()));
        }
        
        if (elementData.containsKey("height")) {
            element.setHeight(Double.valueOf(elementData.get("height").toString()));
        }
        
        if (elementData.containsKey("zIndex")) {
            element.setZIndex(Integer.valueOf(elementData.get("zIndex").toString()));
        }
        
        // 추가 데이터를 JSON으로 저장
        try {
            element.setElementData(objectMapper.writeValueAsString(elementData));
        } catch (JsonProcessingException e) {
            element.setElementData("{}");
        }
        
        floorPlanElementRepository.save(element);
    }
    
    /**
     * 학교별 평면도 로드
     */
    public Map<String, Object> loadFloorPlan(Long schoolId) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // 평면도 메타데이터 조회
            FloorPlan floorPlan = floorPlanRepository.findBySchoolIdAndActive(schoolId)
                    .orElse(null);
            
            if (floorPlan == null) {
                result.put("success", false);
                result.put("message", "저장된 평면도가 없습니다.");
                return result;
            }
            
            // 평면도 요소들 조회
            List<FloorPlanElement> elements = floorPlanElementRepository.findByFloorPlanId(floorPlan.getId());
            
            // 요소들을 타입별로 분류
            Map<String, List<FloorPlanElement>> elementsByType = elements.stream()
                    .collect(Collectors.groupingBy(FloorPlanElement::getElementType));
            
            // 결과 데이터 구성
            result.put("success", true);
            result.put("floorPlan", convertFloorPlanToMap(floorPlan));
            result.put("rooms", convertElementsToMap(elementsByType.get("room")));
            result.put("buildings", convertElementsToMap(elementsByType.get("building")));
            result.put("wirelessAps", convertElementsToMap(elementsByType.get("wireless_ap")));
            result.put("shapes", convertElementsToMap(elementsByType.get("shape")));
            result.put("otherSpaces", convertElementsToMap(elementsByType.get("other_space")));
            
        } catch (Exception e) {
            e.printStackTrace();
            result.put("success", false);
            result.put("message", "평면도 로드 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return result;
    }
    
    /**
     * FloorPlan 엔티티를 Map으로 변환
     */
    private Map<String, Object> convertFloorPlanToMap(FloorPlan floorPlan) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", floorPlan.getId());
        map.put("schoolId", floorPlan.getSchoolId());
        map.put("name", floorPlan.getName());
        map.put("description", floorPlan.getDescription());
        map.put("canvasWidth", floorPlan.getCanvasWidth());
        map.put("canvasHeight", floorPlan.getCanvasHeight());
        map.put("zoomLevel", floorPlan.getZoomLevel());
        map.put("createdAt", floorPlan.getCreatedAt());
        map.put("updatedAt", floorPlan.getUpdatedAt());
        return map;
    }
    
    /**
     * FloorPlanElement 리스트를 Map 리스트로 변환
     */
    private List<Map<String, Object>> convertElementsToMap(List<FloorPlanElement> elements) {
        if (elements == null) {
            return new ArrayList<>();
        }
        
        return elements.stream().map(element -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", element.getId());
            map.put("elementType", element.getElementType());
            map.put("referenceId", element.getReferenceId());
            map.put("xCoordinate", element.getXCoordinate());
            map.put("yCoordinate", element.getYCoordinate());
            map.put("width", element.getWidth());
            map.put("height", element.getHeight());
            map.put("zIndex", element.getZIndex());
            
            // JSON 데이터 파싱
            try {
                if (element.getElementData() != null && !element.getElementData().isEmpty()) {
                    Map<String, Object> elementData = objectMapper.readValue(element.getElementData(), Map.class);
                    map.putAll(elementData);
                }
            } catch (JsonProcessingException e) {
                // JSON 파싱 실패 시 기본 데이터만 사용
            }
            
            return map;
        }).collect(Collectors.toList());
    }
    
    /**
     * 학교별 평면도 존재 여부 확인
     */
    public boolean hasFloorPlan(Long schoolId) {
        return floorPlanRepository.existsBySchoolIdAndActive(schoolId);
    }
    
    /**
     * 학교별 평면도 삭제
     */
    @Transactional
    public boolean deleteFloorPlan(Long schoolId) {
        try {
            FloorPlan floorPlan = floorPlanRepository.findBySchoolIdAndActive(schoolId).orElse(null);
            if (floorPlan != null) {
                // 요소들 삭제
                floorPlanElementRepository.deleteByFloorPlanId(floorPlan.getId());
                // 평면도 비활성화
                floorPlan.setIsActive(false);
                floorPlanRepository.save(floorPlan);
            }
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * 기존 API 호환성을 위한 학교별 평면도 데이터 조회
     */
    public Map<String, Object> getSchoolFloorPlan(Long schoolId) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // 학교별 건물 조회
            List<Building> buildings = buildingRepository.findBySchoolIdOrderByName(schoolId);
            result.put("buildings", buildings);
            
            // 학교별 교실 조회
            List<Classroom> classrooms = classroomRepository.findBySchoolSchoolIdOrderByRoomNameAsc(schoolId);
            result.put("rooms", classrooms);
            
            // 무선AP 조회 (학교별 조회 메서드가 없으므로 빈 리스트로 설정)
            result.put("wirelessAps", new ArrayList<>());
            
        } catch (Exception e) {
            e.printStackTrace();
            result.put("error", "평면도 데이터 조회 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return result;
    }
} 