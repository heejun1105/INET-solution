package com.inet.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inet.entity.*;
import com.inet.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;

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
     * 문자열이 유효한 Long 값인지 확인하는 헬퍼 메서드
     */
    private boolean isValidLong(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }
        try {
            Long.parseLong(value);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }
    
    /**
     * 학교별 평면도 저장
     */
    @Transactional
    public boolean saveFloorPlan(Long schoolId, Map<String, Object> floorPlanData) {
        // 동시 저장 요청 방지를 위한 synchronized 블록
        synchronized (this) {
            try {
                // 학교 존재 확인
                if (!schoolRepository.existsById(schoolId)) {
                    throw new RuntimeException("학교를 찾을 수 없습니다: " + schoolId);
                }
                
                // 기존 평면도와 요소들을 완전히 삭제
                deleteExistingFloorPlansCompletely(schoolId);
                
                // 새 평면도 생성
                FloorPlan floorPlan = new FloorPlan();
                
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
                
                // 새로운 요소들 저장
                saveFloorPlanElements(floorPlan.getId(), floorPlanData);
                
                return true;
                
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
    
    /**
     * 기존 평면도와 요소들을 완전히 삭제
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteExistingFloorPlansCompletely(Long schoolId) {
        try {
            // 학교의 모든 평면도 조회 (활성/비활성 모두)
            List<FloorPlan> allPlans = floorPlanRepository.findAllBySchoolId(schoolId);
            
            for (FloorPlan plan : allPlans) {
                try {
                    // 평면도 요소들을 먼저 삭제
                    floorPlanElementRepository.deleteByFloorPlanId(plan.getId());
                    
                    // 평면도 삭제 전에 다시 조회하여 존재하는지 확인
                    FloorPlan planToDelete = floorPlanRepository.findById(plan.getId()).orElse(null);
                    if (planToDelete != null) {
                        floorPlanRepository.delete(planToDelete);
                    }
                } catch (Exception e) {
                    // 개별 삭제 실패 시 무시하고 계속 진행
                    System.err.println("평면도 삭제 중 오류 (ID: " + plan.getId() + "): " + e.getMessage());
                }
            }
            
        } catch (Exception e) {
            System.err.println("평면도 삭제 중 전체 오류: " + e.getMessage());
            // 삭제 실패해도 계속 진행
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
        
        // 기타 공간 요소들 저장
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
        
        System.out.println("=== 요소 저장 시작 ===");
        System.out.println("요소 타입: " + elementType);
        System.out.println("요소 데이터: " + elementData);
        
        // 참조 ID 설정 (null 체크 추가)
        if (elementType.equals("shape")) {
            // 도형은 참조 ID가 필요하지 않음
            System.out.println("도형 요소 - 참조 ID 설정 안함");
        } else if (elementData.containsKey("classroomId") && elementData.get("classroomId") != null) {
            String classroomId = elementData.get("classroomId").toString();
            System.out.println("교실 ID 처리: " + classroomId);
            if (!classroomId.startsWith("temp-") && !classroomId.startsWith("temp_") && isValidLong(classroomId)) {
                element.setReferenceId(Long.valueOf(classroomId));
                System.out.println("교실 참조 ID 설정: " + classroomId);
            } else {
                System.out.println("임시 ID 또는 유효하지 않은 ID 무시: " + classroomId);
            }
        } else if (elementData.containsKey("buildingId") && elementData.get("buildingId") != null) {
            String buildingId = elementData.get("buildingId").toString();
            System.out.println("건물 ID 처리: " + buildingId);
            if (!buildingId.startsWith("temp-") && !buildingId.startsWith("temp_") && isValidLong(buildingId)) {
                element.setReferenceId(Long.valueOf(buildingId));
                System.out.println("건물 참조 ID 설정: " + buildingId);
            } else {
                System.out.println("임시 ID 또는 유효하지 않은 ID 무시: " + buildingId);
            }
        } else if (elementData.containsKey("wirelessApId") && elementData.get("wirelessApId") != null) {
            String wirelessApId = elementData.get("wirelessApId").toString();
            System.out.println("무선AP ID 처리: " + wirelessApId);
            if (!wirelessApId.startsWith("temp-") && !wirelessApId.startsWith("temp_") && isValidLong(wirelessApId)) {
                element.setReferenceId(Long.valueOf(wirelessApId));
                System.out.println("무선AP 참조 ID 설정: " + wirelessApId);
            } else {
                System.out.println("임시 ID 또는 유효하지 않은 ID 무시: " + wirelessApId);
            }
        } else if (elementData.containsKey("id") && elementData.get("id") != null) {
            String id = elementData.get("id").toString();
            System.out.println("일반 ID 처리: " + id);
            if (!id.startsWith("temp-") && !id.startsWith("temp_") && !id.startsWith("shape_") && isValidLong(id)) {
                element.setReferenceId(Long.valueOf(id));
                System.out.println("일반 참조 ID 설정: " + id);
            } else {
                System.out.println("임시 ID 또는 유효하지 않은 ID 무시: " + id);
            }
        } else {
            System.out.println("참조 ID 설정 안함 - 유효한 ID 없음");
        }
        
        // 위치 정보 설정 (null 체크 추가)
        Object xCoord = elementData.get("xCoordinate");
        Object yCoord = elementData.get("yCoordinate");
        
        element.setXCoordinate(xCoord != null ? Double.valueOf(xCoord.toString()) : 0.0);
        element.setYCoordinate(yCoord != null ? Double.valueOf(yCoord.toString()) : 0.0);
        
        if (elementData.containsKey("width") && elementData.get("width") != null) {
            element.setWidth(Double.valueOf(elementData.get("width").toString()));
        }
        
        if (elementData.containsKey("height") && elementData.get("height") != null) {
            element.setHeight(Double.valueOf(elementData.get("height").toString()));
        }
        
        if (elementData.containsKey("zIndex") && elementData.get("zIndex") != null) {
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
            // 평면도 메타데이터 조회 (여러 개가 있을 경우 가장 최근 것 선택)
            List<FloorPlan> activeFloorPlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
            FloorPlan floorPlan = null;
            
            if (activeFloorPlans.isEmpty()) {
                result.put("success", false);
                result.put("message", "저장된 평면도가 없습니다.");
                return result;
            } else if (activeFloorPlans.size() > 1) {
                // 여러 개의 활성 평면도가 있을 경우 가장 최근 것을 선택하고 나머지는 비활성화
                activeFloorPlans.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
                floorPlan = activeFloorPlans.get(0);
                
                // 나머지 평면도들을 비활성화
                for (int i = 1; i < activeFloorPlans.size(); i++) {
                    FloorPlan oldPlan = activeFloorPlans.get(i);
                    oldPlan.setIsActive(false);
                    floorPlanRepository.save(oldPlan);
                }
            } else {
                floorPlan = activeFloorPlans.get(0);
            }
            
            // 평면도 요소들 조회
            List<FloorPlanElement> elements = floorPlanElementRepository.findByFloorPlanId(floorPlan.getId());
            
            // 결과 구성
            result.put("success", true);
            result.put("floorPlan", convertFloorPlanToMap(floorPlan));
            result.put("elements", convertElementsToMap(elements));
            
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
        List<FloorPlan> activePlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
        return !activePlans.isEmpty();
    }
    
    /**
     * 학교별 평면도 삭제
     */
    @Transactional
    public boolean deleteFloorPlan(Long schoolId) {
        try {
            List<FloorPlan> activePlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
            
            for (FloorPlan floorPlan : activePlans) {
                // 요소들 삭제
                floorPlanElementRepository.deleteByFloorPlanId(floorPlan.getId());
                // 평면도 삭제
                floorPlanRepository.delete(floorPlan);
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