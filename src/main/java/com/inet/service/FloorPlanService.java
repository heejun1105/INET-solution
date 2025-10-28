package com.inet.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inet.entity.*;
import com.inet.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 평면도 서비스
 * 평면도 생성, 조회, 수정, 삭제 기능 제공
 * 설계모드 캔버스 안정화를 위한 개선된 로직
 */
@Service
public class FloorPlanService {
    
    private static final Logger logger = LoggerFactory.getLogger(FloorPlanService.class);
    
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
    
    @Autowired
    private DeviceService deviceService;
    
    @Autowired
    private DeviceRepository deviceRepository;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 평면도 저장 (트랜잭션 처리 개선)
     * @param schoolId 학교 ID
     * @param floorPlanData 평면도 데이터
     * @return 성공 여부
     */
    @Transactional
    public boolean saveFloorPlan(Long schoolId, Map<String, Object> floorPlanData) {
        try {
            logger.info("평면도 저장 시작 - schoolId: {}", schoolId);
            
            // 1. 데이터 검증
            validateFloorPlanData(schoolId, floorPlanData);
            
            // 2. 기존 평면도 조회 또는 새로 생성
            FloorPlan floorPlan = getOrCreateFloorPlan(schoolId);
            
            // 3. 평면도 메타데이터 업데이트
            updateFloorPlanMetadata(floorPlan, floorPlanData);
            
            // 4. 평면도 저장
            floorPlan = floorPlanRepository.save(floorPlan);
            
            // 5. 기존 요소들 삭제
            floorPlanElementRepository.deleteByFloorPlanId(floorPlan.getId());
            
            // 6. 새 요소들 저장
            saveFloorPlanElements(floorPlan.getId(), floorPlanData);
            
            logger.info("평면도 저장 완료 - schoolId: {}, floorPlanId: {}", schoolId, floorPlan.getId());
            return true;
            
        } catch (Exception e) {
            logger.error("평면도 저장 실패 - schoolId: {}", schoolId, e);
            throw new RuntimeException("평면도 저장 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
    
    /**
     * 평면도 데이터 검증
     */
    private void validateFloorPlanData(Long schoolId, Map<String, Object> floorPlanData) {
        // 학교 존재 확인
        if (!schoolRepository.existsById(schoolId)) {
            throw new IllegalArgumentException("존재하지 않는 학교입니다: " + schoolId);
        }
        
        // 데이터 유효성 검증
        if (floorPlanData == null || floorPlanData.isEmpty()) {
            throw new IllegalArgumentException("평면도 데이터가 비어있습니다");
        }
        
        logger.debug("평면도 데이터 검증 완료 - schoolId: {}", schoolId);
    }
    
    /**
     * 기존 평면도 조회 또는 새로 생성
     */
    private FloorPlan getOrCreateFloorPlan(Long schoolId) {
        List<FloorPlan> activePlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
        
        if (!activePlans.isEmpty()) {
            // 기존 평면도가 여러 개면 가장 최근 것만 활성화
            if (activePlans.size() > 1) {
                activePlans.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
                FloorPlan latest = activePlans.get(0);
                
                // 나머지는 비활성화
                for (int i = 1; i < activePlans.size(); i++) {
                    FloorPlan old = activePlans.get(i);
                    old.setIsActive(false);
                    floorPlanRepository.save(old);
                }
                
                return latest;
            }
            return activePlans.get(0);
        }
        
        // 새로 생성
        FloorPlan newPlan = new FloorPlan();
        newPlan.setSchoolId(schoolId);
        newPlan.setName("평면도_" + schoolId);
        newPlan.setDescription("학교 평면도");
        newPlan.setIsActive(true);
        
        // 기본 설정
        newPlan.setCanvasWidth(4000);
        newPlan.setCanvasHeight(2500);
        newPlan.setZoomLevel(1.0);
        newPlan.setPanX(0.0);
        newPlan.setPanY(0.0);
        newPlan.setGridSize(20);
        newPlan.setShowGrid(true);
        newPlan.setSnapToGrid(true);
        
        return newPlan;
    }
    
    /**
     * 평면도 메타데이터 업데이트
     */
    private void updateFloorPlanMetadata(FloorPlan floorPlan, Map<String, Object> data) {
        // 캔버스 크기
        if (data.containsKey("canvasWidth")) {
            floorPlan.setCanvasWidth(getIntValue(data, "canvasWidth", 4000));
        }
        if (data.containsKey("canvasHeight")) {
            floorPlan.setCanvasHeight(getIntValue(data, "canvasHeight", 2500));
        }
        
        // 줌/팬 상태
        if (data.containsKey("zoomLevel")) {
            floorPlan.setZoomLevel(getDoubleValue(data, "zoomLevel", 1.0));
        }
        if (data.containsKey("panX")) {
            floorPlan.setPanX(getDoubleValue(data, "panX", 0.0));
        }
        if (data.containsKey("panY")) {
            floorPlan.setPanY(getDoubleValue(data, "panY", 0.0));
        }
        
        // 그리드 설정
        if (data.containsKey("gridSize")) {
            floorPlan.setGridSize(getIntValue(data, "gridSize", 20));
        }
        if (data.containsKey("showGrid")) {
            floorPlan.setShowGrid(getBooleanValue(data, "showGrid", true));
        }
        if (data.containsKey("snapToGrid")) {
            floorPlan.setSnapToGrid(getBooleanValue(data, "snapToGrid", true));
        }
    }
    
    /**
     * 평면도 요소들 저장
     */
    private void saveFloorPlanElements(Long floorPlanId, Map<String, Object> floorPlanData) {
        int savedCount = 0;
        
        // 새로운 형식: elements 배열로 통합 (모든 타입 포함)
        if (floorPlanData.containsKey("elements")) {
            List<Map<String, Object>> elements = (List<Map<String, Object>>) floorPlanData.get("elements");
            logger.info("평면도 요소 저장 시작 - floorPlanId: {}, 요소 수: {}", floorPlanId, elements.size());
            
            for (Map<String, Object> element : elements) {
                String elementType = (String) element.get("elementType");
                if (elementType != null) {
                    saveElement(floorPlanId, elementType, element);
                    savedCount++;
                }
            }
        } else {
            // 이전 형식: 타입별로 분리된 배열 (하위 호환성)
            // 교실 요소들
            if (floorPlanData.containsKey("rooms")) {
                List<Map<String, Object>> rooms = (List<Map<String, Object>>) floorPlanData.get("rooms");
                for (Map<String, Object> room : rooms) {
                    saveElement(floorPlanId, "room", room);
                    savedCount++;
                }
            }
            
            // 건물 요소들
            if (floorPlanData.containsKey("buildings")) {
                List<Map<String, Object>> buildings = (List<Map<String, Object>>) floorPlanData.get("buildings");
                for (Map<String, Object> building : buildings) {
                    saveElement(floorPlanId, "building", building);
                    savedCount++;
                }
            }
            
            // 무선AP 요소들
            if (floorPlanData.containsKey("wirelessAps")) {
                List<Map<String, Object>> wirelessAps = (List<Map<String, Object>>) floorPlanData.get("wirelessAps");
                for (Map<String, Object> wirelessAp : wirelessAps) {
                    saveElement(floorPlanId, "wireless_ap", wirelessAp);
                    savedCount++;
                }
            }
            
            // 도형 요소들
            if (floorPlanData.containsKey("shapes")) {
                List<Map<String, Object>> shapes = (List<Map<String, Object>>) floorPlanData.get("shapes");
                for (Map<String, Object> shape : shapes) {
                    saveElement(floorPlanId, "shape", shape);
                    savedCount++;
                }
            }
            
            // 기타 공간 요소들
            if (floorPlanData.containsKey("otherSpaces")) {
                List<Map<String, Object>> otherSpaces = (List<Map<String, Object>>) floorPlanData.get("otherSpaces");
                for (Map<String, Object> otherSpace : otherSpaces) {
                    saveElement(floorPlanId, "other_space", otherSpace);
                    savedCount++;
                }
            }
        }
        
        logger.debug("평면도 요소 저장 완료 - floorPlanId: {}, 요소 수: {}", floorPlanId, savedCount);
    }
    
    /**
     * 개별 요소 저장 (개선된 로직)
     */
    private void saveElement(Long floorPlanId, String elementType, Map<String, Object> elementData) {
        FloorPlanElement element = new FloorPlanElement();
        element.setFloorPlanId(floorPlanId);
        element.setElementType(elementType);
        
        // 참조 ID 설정 (실제 DB ID만 저장)
        setReferenceId(element, elementType, elementData);
        
        // 위치 및 크기 정보
        element.setXCoordinate(getDoubleValue(elementData, "xCoordinate", 0.0));
        element.setYCoordinate(getDoubleValue(elementData, "yCoordinate", 0.0));
        element.setWidth(getDoubleValue(elementData, "width", null));
        element.setHeight(getDoubleValue(elementData, "height", null));
        element.setZIndex(getIntValue(elementData, "zIndex", null));
        element.setRotation(getDoubleValue(elementData, "rotation", 0.0));
        
        // 스타일 정보
        element.setColor(getStringValue(elementData, "color", null));
        element.setBackgroundColor(getStringValue(elementData, "backgroundColor", null));
        element.setBorderColor(getStringValue(elementData, "borderColor", null));
        element.setBorderWidth(getDoubleValue(elementData, "borderWidth", null));
        element.setOpacity(getDoubleValue(elementData, "opacity", 1.0));
        
        // 도형 전용 정보
        if ("shape".equals(elementType)) {
            element.setShapeType(getStringValue(elementData, "shapeType", "rectangle"));
            element.setTextContent(getStringValue(elementData, "textContent", null));
            element.setFontSize(getIntValue(elementData, "fontSize", null));
            element.setFontFamily(getStringValue(elementData, "fontFamily", null));
            
            // 선 도형 정보
            element.setStartX(getDoubleValue(elementData, "startX", null));
            element.setStartY(getDoubleValue(elementData, "startY", null));
            element.setEndX(getDoubleValue(elementData, "endX", null));
            element.setEndY(getDoubleValue(elementData, "endY", null));
        }
        
        // 라벨 정보
        element.setLabel(getStringValue(elementData, "label", null));
        element.setShowLabel(getBooleanValue(elementData, "showLabel", true));
        
        // 추가 데이터는 JSON으로 저장
        try {
            element.setElementData(objectMapper.writeValueAsString(elementData));
        } catch (JsonProcessingException e) {
            logger.warn("요소 데이터 JSON 변환 실패", e);
            element.setElementData("{}");
        }
        
        floorPlanElementRepository.save(element);
    }
    
    /**
     * 참조 ID 설정 (임시 ID 제외)
     */
    private void setReferenceId(FloorPlanElement element, String elementType, Map<String, Object> data) {
        String idKey = switch (elementType) {
            case "room" -> "classroomId";
            case "building" -> "buildingId";
            case "wireless_ap" -> "wirelessApId";
            default -> "id";
        };
        
        if (data.containsKey(idKey) && data.get(idKey) != null) {
            String idValue = data.get(idKey).toString();
            
            // 임시 ID는 무시 (temp-, temp_, shape_로 시작하는 ID)
            if (!idValue.startsWith("temp-") && 
                !idValue.startsWith("temp_") && 
                !idValue.startsWith("shape_") &&
                isValidLong(idValue)) {
                element.setReferenceId(Long.valueOf(idValue));
            }
        }
    }
    
    /**
     * 평면도 로드 (성능 최적화)
     */
    @Transactional(readOnly = true)
    public Map<String, Object> loadFloorPlan(Long schoolId) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            logger.info("평면도 로드 시작 - schoolId: {}", schoolId);
            
            // 평면도 조회
            FloorPlan floorPlan = getActiveFloorPlan(schoolId);
            if (floorPlan == null) {
                result.put("success", false);
                result.put("message", "저장된 평면도가 없습니다.");
                return result;
            }
            
            // 평면도 요소들 조회 (한 번에 가져오기)
            List<FloorPlanElement> elements = floorPlanElementRepository.findByFloorPlanId(floorPlan.getId());
            
            // 결과 구성
            result.put("success", true);
            result.put("floorPlan", convertFloorPlanToMap(floorPlan));
            result.put("elements", convertElementsToMap(elements));
            
            logger.info("평면도 로드 완료 - schoolId: {}, 요소 수: {}", schoolId, elements.size());
            
        } catch (Exception e) {
            logger.error("평면도 로드 실패 - schoolId: {}", schoolId, e);
            result.put("success", false);
            result.put("message", "평면도 로드 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return result;
    }
    
    /**
     * 활성 평면도 조회
     */
    private FloorPlan getActiveFloorPlan(Long schoolId) {
        List<FloorPlan> activePlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
        
        if (activePlans.isEmpty()) {
            return null;
        }
        
        if (activePlans.size() > 1) {
            // 여러 개면 가장 최근 것 반환
            activePlans.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
        }
        
        return activePlans.get(0);
    }
    
    /**
     * FloorPlan을 Map으로 변환
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
        map.put("panX", floorPlan.getPanX());
        map.put("panY", floorPlan.getPanY());
        map.put("gridSize", floorPlan.getGridSize());
        map.put("showGrid", floorPlan.getShowGrid());
        map.put("snapToGrid", floorPlan.getSnapToGrid());
        map.put("version", floorPlan.getVersion());
        map.put("createdAt", floorPlan.getCreatedAt());
        map.put("updatedAt", floorPlan.getUpdatedAt());
        return map;
    }
    
    /**
     * FloorPlanElement 리스트를 Map 리스트로 변환
     */
    private List<Map<String, Object>> convertElementsToMap(List<FloorPlanElement> elements) {
        if (elements == null || elements.isEmpty()) {
            return new ArrayList<>();
        }
        
        return elements.stream().map(element -> {
            Map<String, Object> map = new HashMap<>();
            
            // 기본 정보
            map.put("id", element.getId());
            map.put("elementType", element.getElementType());
            map.put("referenceId", element.getReferenceId());
            
            // 위치 및 크기
            map.put("xCoordinate", element.getXCoordinate());
            map.put("yCoordinate", element.getYCoordinate());
            map.put("width", element.getWidth());
            map.put("height", element.getHeight());
            map.put("zIndex", element.getZIndex());
            map.put("rotation", element.getRotation());
            
            // 스타일
            map.put("color", element.getColor());
            map.put("backgroundColor", element.getBackgroundColor());
            map.put("borderColor", element.getBorderColor());
            map.put("borderWidth", element.getBorderWidth());
            map.put("opacity", element.getOpacity());
            
            // 도형 정보
            if ("shape".equals(element.getElementType())) {
                map.put("shapeType", element.getShapeType());
                map.put("textContent", element.getTextContent());
                map.put("fontSize", element.getFontSize());
                map.put("fontFamily", element.getFontFamily());
                map.put("startX", element.getStartX());
                map.put("startY", element.getStartY());
                map.put("endX", element.getEndX());
                map.put("endY", element.getEndY());
            }
            
            // 라벨
            map.put("label", element.getLabel());
            map.put("showLabel", element.getShowLabel());
            
            // 버전
            map.put("version", element.getVersion());
            
            // JSON 데이터 병합
            try {
                if (element.getElementData() != null && !element.getElementData().isEmpty()) {
                    Map<String, Object> additionalData = objectMapper.readValue(
                        element.getElementData(), 
                        Map.class
                    );
                    // 기존 필드와 중복되지 않는 데이터만 추가
                    additionalData.forEach((key, value) -> map.putIfAbsent(key, value));
                }
            } catch (JsonProcessingException e) {
                logger.warn("요소 데이터 JSON 파싱 실패 - elementId: {}", element.getId(), e);
            }
            
            return map;
        }).collect(Collectors.toList());
    }
    
    /**
     * 평면도 존재 여부 확인
     */
    @Transactional(readOnly = true)
    public boolean hasFloorPlan(Long schoolId) {
        List<FloorPlan> activePlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
        return !activePlans.isEmpty();
    }
    
    /**
     * 평면도 삭제
     */
    @Transactional
    public boolean deleteFloorPlan(Long schoolId) {
        try {
            logger.info("평면도 삭제 시작 - schoolId: {}", schoolId);
            
            List<FloorPlan> activePlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
            
            for (FloorPlan floorPlan : activePlans) {
                // 요소들 먼저 삭제
                floorPlanElementRepository.deleteByFloorPlanId(floorPlan.getId());
                // 평면도 삭제
                floorPlanRepository.delete(floorPlan);
            }
            
            logger.info("평면도 삭제 완료 - schoolId: {}", schoolId);
            return true;
            
        } catch (Exception e) {
            logger.error("평면도 삭제 실패 - schoolId: {}", schoolId, e);
            return false;
        }
    }
    
    /**
     * 기존 API 호환성을 위한 학교별 평면도 데이터 조회
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getSchoolFloorPlan(Long schoolId) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            // 학교별 건물 조회
            List<Building> buildings = buildingRepository.findBySchoolIdOrderByName(schoolId);
            result.put("buildings", buildings);
            
            // 학교별 교실 조회
            List<Classroom> classrooms = classroomRepository.findBySchoolSchoolIdOrderByRoomNameAsc(schoolId);
            result.put("rooms", classrooms);
            
            // 무선AP 조회
            result.put("wirelessAps", new ArrayList<>());
            
        } catch (Exception e) {
            logger.error("평면도 데이터 조회 실패 - schoolId: {}", schoolId, e);
            result.put("error", "평면도 데이터 조회 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return result;
    }
    
    // ===== 유틸리티 메서드 =====
    
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
    
    private Integer getIntValue(Map<String, Object> map, String key, Integer defaultValue) {
        if (!map.containsKey(key) || map.get(key) == null) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Integer) {
            return (Integer) value;
        }
        return Integer.valueOf(value.toString());
    }
    
    private Double getDoubleValue(Map<String, Object> map, String key, Double defaultValue) {
        if (!map.containsKey(key) || map.get(key) == null) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Double) {
            return (Double) value;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return Double.valueOf(value.toString());
    }
    
    private String getStringValue(Map<String, Object> map, String key, String defaultValue) {
        if (!map.containsKey(key) || map.get(key) == null) {
            return defaultValue;
        }
        return map.get(key).toString();
    }
    
    private Boolean getBooleanValue(Map<String, Object> map, String key, Boolean defaultValue) {
        if (!map.containsKey(key) || map.get(key) == null) {
            return defaultValue;
        }
        Object value = map.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        return Boolean.valueOf(value.toString());
    }
    
    // ===== 새로 추가된 메서드 (평면도 리빌딩) =====
    
    /**
     * 미배치 교실 조회
     * 평면도에 배치되지 않은 교실 목록을 반환
     */
    @Transactional(readOnly = true)
    public List<Classroom> getUnplacedClassrooms(Long schoolId) {
        // 해당 학교의 모든 교실 조회
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다"));
        List<Classroom> allClassrooms = classroomRepository.findBySchool(school);
        
        // 평면도에 배치된 교실 ID 조회
        FloorPlan floorPlan = getActiveFloorPlan(schoolId);
        if (floorPlan == null) {
            // 평면도가 없으면 모든 교실이 미배치
            return allClassrooms;
        }
        
        List<FloorPlanElement> elements = floorPlanElementRepository.findByFloorPlanId(floorPlan.getId());
        Set<Long> placedClassroomIds = elements.stream()
            .filter(e -> "room".equals(e.getElementType()) && e.getReferenceId() != null)
            .map(FloorPlanElement::getReferenceId)
            .collect(Collectors.toSet());
        
        // 미배치 교실만 필터링
        return allClassrooms.stream()
            .filter(c -> !placedClassroomIds.contains(c.getClassroomId()))
            .collect(Collectors.toList());
    }
    
    /**
     * 학교별 무선AP 정보 조회
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getWirelessApsBySchool(Long schoolId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다"));
        List<com.inet.entity.WirelessAp> aps = wirelessApRepository.findBySchool(school);
        
        return aps.stream().map(ap -> {
            Map<String, Object> map = new HashMap<>();
            map.put("apId", ap.getAPId());
            map.put("newLabelNumber", ap.getNewLabelNumber());
            map.put("deviceNumber", ap.getDeviceNumber());
            map.put("manufacturer", ap.getManufacturer());
            map.put("model", ap.getModel());
            if (ap.getLocation() != null) {
                map.put("classroomId", ap.getLocation().getClassroomId());
                map.put("classroomName", ap.getLocation().getRoomName() != null ? 
                    ap.getLocation().getRoomName() : "");
            }
            return map;
        }).collect(Collectors.toList());
    }
    
    /**
     * 교실별 장비 조회
     */
    @Transactional(readOnly = true)
    public Map<Long, List<Map<String, Object>>> getDevicesByClassroom(Long schoolId) {
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다"));
        List<com.inet.entity.Device> devices = deviceRepository.findBySchool(school);
        
        return devices.stream()
            .filter(d -> d.getClassroom() != null)
            .collect(Collectors.groupingBy(
                d -> d.getClassroom().getClassroomId(),
                Collectors.mapping(this::convertDeviceToMap, Collectors.toList())
            ));
    }
    
    /**
     * 특정 교실 장비 조회
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getClassroomDevices(Long classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
            .orElseThrow(() -> new RuntimeException("교실을 찾을 수 없습니다"));
        List<com.inet.entity.Device> devices = deviceRepository.findByClassroom(classroom);
        
        return devices.stream()
            .map(this::convertDeviceToMap)
            .collect(Collectors.toList());
    }
    
    /**
     * Device를 Map으로 변환
     */
    private Map<String, Object> convertDeviceToMap(com.inet.entity.Device device) {
        Map<String, Object> map = new HashMap<>();
        map.put("deviceId", device.getDeviceId());
        map.put("type", device.getType());
        map.put("manufacturer", device.getManufacturer());
        map.put("modelName", device.getModelName());
        map.put("ipAddress", device.getIpAddress());
        map.put("setType", device.getSetType());
        
        if (device.getUid() != null && device.getUid().getDisplayUid() != null) {
            map.put("uidNumber", device.getUid().getDisplayUid());
        }
        if (device.getManage() != null && device.getManage().getManageNum() != null) {
            map.put("manageNumber", device.getManage().getManageNum());
        }
        if (device.getOperator() != null && device.getOperator().getName() != null) {
            map.put("operatorName", device.getOperator().getName());
        }
        
        return map;
    }
    
    /**
     * 캔버스 초기화
     * 해당 학교의 모든 평면도 요소 삭제
     */
    @Transactional
    public void initializeCanvas(Long schoolId) {
        FloorPlan floorPlan = getActiveFloorPlan(schoolId);
        if (floorPlan != null) {
            floorPlanElementRepository.deleteByFloorPlanId(floorPlan.getId());
            logger.info("캔버스 초기화 완료 - schoolId: {}, floorPlanId: {}", schoolId, floorPlan.getId());
        }
    }
}
