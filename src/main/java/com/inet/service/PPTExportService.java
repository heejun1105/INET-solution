package com.inet.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inet.entity.FloorPlan;
import com.inet.entity.FloorPlanElement;
import com.inet.entity.School;
import com.inet.repository.FloorPlanElementRepository;
import com.inet.repository.FloorPlanRepository;
import com.inet.repository.SchoolRepository;
import org.apache.poi.xslf.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.awt.geom.Rectangle2D;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class PPTExportService {
    
    private static final Logger log = LoggerFactory.getLogger(PPTExportService.class);
    
    @Autowired
    private FloorPlanRepository floorPlanRepository;
    
    @Autowired
    private FloorPlanElementRepository floorPlanElementRepository;
    
    @Autowired
    private SchoolRepository schoolRepository;
    
    @Autowired
    private FloorPlanService floorPlanService;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicInteger apLabelDebugCounter = new AtomicInteger();
    
    // 현재 바운딩 박스 최소값 (좌표 변환 시 사용)
    private double currentBoundsMinX = 0.0;
    private double currentBoundsMinY = 0.0;
    
    // 좌표 변환 상수 (FloorPlanCore.js와 동일하게 설정)
    private static final double CANVAS_WIDTH = 16000.0;  // 캔버스 기본 너비
    private static final double CANVAS_HEIGHT = 12000.0; // 캔버스 기본 높이
    // PPT 슬라이드 크기: A4 세로 (21cm x 29.7cm)
    // 1인치 = 2.54cm, 1포인트 = 1/72인치
    // A4 폭: 21 / 2.54 * 72 ≈ 595pt
    // A4 높이: 29.7 / 2.54 * 72 ≈ 842pt
    private static final double PPT_WIDTH = 595.0;   // A4 폭 (pt)
    private static final double PPT_HEIGHT = 842.0;  // A4 높이 (pt)
    private static final double SCALE_X = PPT_WIDTH / CANVAS_WIDTH;
    private static final double SCALE_Y = PPT_HEIGHT / CANVAS_HEIGHT;
    
    // 보기모드 배율 기반 폰트 조정
    // 배율이 15% (0.15)일 때 PPT 폰트 크기가 2.5pt가 되어야 함
    // 기본 이름박스: 원본 높이 40px, 원본 폰트 18pt
    // PPT 폰트 크기 = 원본폰트 * (스케일 / 기준스케일) * PPT보정값
    // 2.5 = 18.0 * (0.15 / 0.15) * PPT보정값
    // 2.5 = 18.0 * PPT보정값
    // PPT보정값 = 2.5 / 18.0 ≈ 0.139
    // 일반화: PPT폰트 = 원본폰트 * (스케일 / 기준스케일) * (기준PPT폰트 / 원본폰트)
    //          = 기준PPT폰트 * (스케일 / 기준스케일)
    private static final double REFERENCE_ZOOM = 0.15;        // 기준 배율 (15%)
    private static final double REFERENCE_PPT_FONT = 2.5;     // 기준 배율일 때의 PPT 폰트 크기 (pt)
    
    /**
     * 학교별 평면도를 PPT 파일로 내보내기
     */
    public ByteArrayOutputStream exportFloorPlanToPPT(Long schoolId, String mode, Integer equipmentFontSize) throws IOException {
        try {
            log.info("PPT 내보내기 시작 - schoolId: {}, mode: {}", schoolId, mode);
            
            // 학교 정보 조회
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다: " + schoolId));
            // 활성 평면도 조회
            List<FloorPlan> activeFloorPlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
            
            if (activeFloorPlans.isEmpty()) {
                throw new RuntimeException("저장된 평면도가 없습니다.");
            }
            
            // 가장 최근 평면도 선택
            FloorPlan floorPlan = activeFloorPlans.stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .findFirst()
                .get();
            
            // 평면도 요소 조회
            List<FloorPlanElement> elements = floorPlanElementRepository.findByFloorPlanId(floorPlan.getId());
            
            // 장비 보기 모드인 경우 장비 정보 조회
            Map<Long, List<Map<String, Object>>> devicesByClassroom = null;
            if ("equipment".equals(mode)) {
                devicesByClassroom = floorPlanService.getDevicesByClassroom(schoolId);
            }
            
            // PPT 프레젠테이션 생성
            XMLSlideShow ppt = createPPTPresentation(school, floorPlan, elements, mode, devicesByClassroom, equipmentFontSize);
            
            // 바이트 배열로 변환
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            ppt.write(outputStream);
            ppt.close();
            log.info("PPT 파일 변환 완료 - 크기: {} bytes", outputStream.size());
            
            return outputStream;
            
        } catch (Exception e) {
            log.error("PPT 내보내기 중 오류 발생: {}", e.getMessage(), e);
            throw new IOException("PPT 파일 생성 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
    
    /**
     * PPT 프레젠테이션 생성
     */
    private XMLSlideShow createPPTPresentation(School school, FloorPlan floorPlan, List<FloorPlanElement> elements,
                                              String mode, Map<Long, List<Map<String, Object>>> devicesByClassroom,
                                              Integer equipmentFontSize) {
        XMLSlideShow ppt = new XMLSlideShow();
        
        // 슬라이드 크기 설정: A4 세로 비율
        ppt.setPageSize(new java.awt.Dimension((int) PPT_WIDTH, (int) PPT_HEIGHT));
        
        // 제목 슬라이드 생성 제거 (바로 평면도부터 시작)
        // createTitleSlide(ppt, school);
        
        // 페이지별로 슬라이드 생성 (요소가 있는 페이지만)
        // 실제로 요소가 있는 페이지 번호들을 수집
        Set<Integer> pagesWithElements = elements.stream()
            .filter(el -> el.getPageNumber() != null)
            .map(FloorPlanElement::getPageNumber)
            .collect(java.util.stream.Collectors.toSet());
        
        // 페이지 번호 순서대로 정렬
        List<Integer> sortedPages = new ArrayList<>(pagesWithElements);
        java.util.Collections.sort(sortedPages);
        
        // 요소가 있는 페이지만 슬라이드 생성
        int finalMaxPage = sortedPages.size(); // 실제 요소가 있는 페이지 수
        for (Integer pageNum : sortedPages) {
            final int currentPageNum = pageNum;
            // 해당 페이지의 요소들만 필터링
            List<FloorPlanElement> pageElements = elements.stream()
                .filter(el -> el.getPageNumber() != null && el.getPageNumber().equals(currentPageNum))
                .collect(java.util.stream.Collectors.toList());
            
            // 요소가 있는 페이지만 슬라이드 생성
            if (!pageElements.isEmpty()) {
                createFloorPlanSlide(ppt, school, floorPlan, pageElements, mode, devicesByClassroom, equipmentFontSize, currentPageNum, finalMaxPage);
            }
        }
        
        return ppt;
    }
    
    /**
     * 제목 슬라이드 생성
     */
    private void createTitleSlide(XMLSlideShow ppt, School school) {
        XSLFSlide titleSlide = ppt.createSlide();
        
        // 제목 텍스트 박스
        XSLFTextBox titleBox = titleSlide.createTextBox();
        titleBox.setAnchor(new Rectangle(50, 150, 620, 100));
        XSLFTextParagraph titlePara = titleBox.addNewTextParagraph();
        titlePara.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun titleRun = titlePara.addNewTextRun();
        titleRun.setText(school.getSchoolName() + " 평면도");
        titleRun.setFontSize(44.0);
        titleRun.setBold(true);
        titleRun.setFontColor(new Color(31, 78, 121));
        
        // 날짜 텍스트 박스
        XSLFTextBox dateBox = titleSlide.createTextBox();
        dateBox.setAnchor(new Rectangle(50, 300, 620, 50));
        XSLFTextParagraph datePara = dateBox.addNewTextParagraph();
        datePara.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun dateRun = datePara.addNewTextRun();
        String currentDate = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy년 MM월 dd일"));
        dateRun.setText("생성일: " + currentDate);
        dateRun.setFontSize(20.0);
        dateRun.setFontColor(new Color(89, 89, 89));
    }
    
    /**
     * 평면도 슬라이드 생성
     */
    private void createFloorPlanSlide(XMLSlideShow ppt, School school, FloorPlan floorPlan, List<FloorPlanElement> elements,
                                     String mode, Map<Long, List<Map<String, Object>>> devicesByClassroom,
                                     Integer equipmentFontSize, Integer pageNumber, Integer maxPage) {
        XSLFSlide floorPlanSlide = ppt.createSlide();
        
        // 슬라이드 제목 추가 (페이지 정보 포함)
        XSLFTextBox headerBox = floorPlanSlide.createTextBox();
        headerBox.setAnchor(new Rectangle(20, 10, 400, 30));
        XSLFTextParagraph headerPara = headerBox.addNewTextParagraph();
        XSLFTextRun headerRun = headerPara.addNewTextRun();
        String title = school.getSchoolName() + " - 평면도";
        if (maxPage != null && maxPage > 1) {
            title += " (페이지 " + pageNumber + "/" + maxPage + ")";
        }
        headerRun.setText(title);
        headerRun.setFontSize(18.0);
        headerRun.setBold(true);
        headerRun.setFontColor(new Color(31, 78, 121));
        
        // 저장 날짜 추가 (우측)
        XSLFTextBox dateBox = floorPlanSlide.createTextBox();
        dateBox.setAnchor(new Rectangle(420, 10, 155, 30));
        XSLFTextParagraph datePara = dateBox.addNewTextParagraph();
        datePara.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.RIGHT);
        XSLFTextRun dateRun = datePara.addNewTextRun();
        String savedDate = floorPlan.getUpdatedAt().format(DateTimeFormatter.ofPattern("yyyy년 MM월 dd일"));
        dateRun.setText(savedDate);
        dateRun.setFontSize(14.0);
        dateRun.setFontColor(new Color(89, 89, 89));
        
        // 모드별 필터링 (바운딩 박스 계산 전에 먼저 필터링)
        // 바운딩 박스 계산에서는 실제 평면도 요소만 포함 (seat_layout, equipment_card 등 제외)
        List<FloorPlanElement> elementsToProcess = elements.stream()
            .filter(el -> {
                String elementType = el.getElementType();
                if ("seat_layout".equals(elementType) ||
                    "equipment_card".equals(elementType)) {
                    return false;
                }
                // 장비 보기 모드에서는 AP 관련 요소 제외
                if ("equipment".equals(mode)) {
                    if ("wireless_ap".equals(elementType) ||
                        "mdf_idf".equals(elementType)) {
                        return false;
                    }
                }
                return true;
            })
            .collect(java.util.stream.Collectors.toCollection(ArrayList::new));

        if ("wireless-ap".equals(mode)) {
            // 무선AP 보기 모드: 교실 요소는 그대로 유지하고, AP 요소만 처리
            // 현재 페이지의 AP만 수집 (중복 제거)
            List<FloorPlanElement> savedApElements = new ArrayList<>();
            Map<Long, FloorPlanElement> savedApMap = new HashMap<>();
            // 중복 체크를 위한 Set (referenceId + pageNumber 조합)
            Set<String> seenApKeys = new HashSet<>();
            
            for (FloorPlanElement el : elementsToProcess) {
                if ("wireless_ap".equals(el.getElementType())) {
                    // 현재 페이지의 AP만 포함
                    Integer apPageNumber = el.getPageNumber() != null ? el.getPageNumber() : 1;
                    if (apPageNumber.equals(pageNumber)) {
                        // 중복 체크: 같은 referenceId와 pageNumber를 가진 AP는 하나만 포함
                        Long referenceId = el.getReferenceId();
                        if (referenceId != null) {
                            String apKey = String.format("ap_%d_%d", referenceId, pageNumber);
                            if (seenApKeys.contains(apKey)) {
                                log.warn("중복된 AP 요소 스킵 (PPT 생성): referenceId={}, pageNumber={}, elementId={}", 
                                        referenceId, pageNumber, el.getId());
                                continue;
                            }
                            seenApKeys.add(apKey);
                        }
                        
                    savedApElements.add(el);
                        if (referenceId != null) {
                            savedApMap.putIfAbsent(referenceId, el);
                        }
                    }
                }
            }

            log.info("무선AP 보기 모드 - 중복 제거 후 저장된 AP 개수: {} (페이지 {})", savedApElements.size(), pageNumber);

            // 교실 맵 생성 (현재 페이지의 교실만 포함, referenceId가 없어도 포함)
            Map<Long, FloorPlanElement> roomMap = new HashMap<>();
            for (FloorPlanElement el : elementsToProcess) {
                if ("room".equals(el.getElementType())) {
                    // 현재 페이지의 교실만 포함
                    Integer roomPageNumber = el.getPageNumber() != null ? el.getPageNumber() : 1;
                    if (!roomPageNumber.equals(pageNumber)) {
                        continue;
                    }
                    
                    if (el.getReferenceId() != null) {
                    roomMap.putIfAbsent(el.getReferenceId(), el);
                    }
                    // referenceId가 없어도 element_data에서 classroomId 확인
                    if (el.getReferenceId() == null) {
                        try {
                            Map<String, Object> elementData = parseElementData(el.getElementData());
                            Object classroomIdObj = elementData.get("classroomId");
                            if (classroomIdObj != null) {
                                Long classroomId = toLong(classroomIdObj);
                                if (classroomId != null) {
                                    roomMap.putIfAbsent(classroomId, el);
                                }
                            }
                        } catch (Exception e) {
                            // 파싱 실패 시 무시
                        }
                    }
                }
            }
            
            log.info("무선AP 보기 모드 - 교실 개수: {}, 저장된 AP 개수: {}", roomMap.size(), savedApElements.size());

            List<Map<String, Object>> wirelessAps = floorPlanService.getWirelessApsBySchool(school.getSchoolId());
            Map<Long, Map<String, Object>> wirelessApMap = new HashMap<>();
            Map<String, Long> labelToApId = new HashMap<>();
            for (Map<String, Object> apData : wirelessAps) {
                Long apId = toLong(apData.get("apId"));
                if (apId != null) {
                    wirelessApMap.put(apId, apData);
                    String label = Objects.toString(apData.get("newLabelNumber"), "");
                    if (!label.isBlank()) {
                        labelToApId.put(normalizeLabel(label), apId);
                    }
                }
            }

            List<FloorPlanElement> resolvedApElements = new ArrayList<>();
            Set<Long> handledApIds = new HashSet<>();

            for (FloorPlanElement savedAp : savedApElements) {
                // 현재 페이지의 AP만 처리 (이미 필터링되었지만 다시 확인)
                Integer apPageNumber = savedAp.getPageNumber() != null ? savedAp.getPageNumber() : 1;
                if (!apPageNumber.equals(pageNumber)) {
                    log.debug("AP 스킵 (다른 페이지): apId={}, apPage={}, currentPage={}", 
                            savedAp.getReferenceId(), apPageNumber, pageNumber);
                    continue;
                }
                
                FloorPlanElement resolved = cloneWirelessApElement(savedAp);
                // 페이지 번호 유지 (현재 페이지)
                resolved.setPageNumber(pageNumber);
                Map<String, Object> elementData = parseElementData(resolved.getElementData());
                Long apId = extractWirelessApId(resolved, elementData, labelToApId);
                if (apId != null) {
                    handledApIds.add(apId);
                    resolved.setReferenceId(apId);
                    Map<String, Object> apInfo = wirelessApMap.get(apId);
                    if (apInfo != null) {
                        String newLabel = Objects.toString(apInfo.get("newLabelNumber"), "");
                        if (!newLabel.isBlank()) {
                            resolved.setLabel(newLabel);
                        }
                        
                        // 저장된 AP 좌표 처리
                        // DataSyncManager에서 저장 시 이미 중앙 좌표로 변환하여 저장하므로,
                        // 서버에서 로드된 좌표는 이미 절대 중앙 좌표입니다.
                        Long classroomId = toLong(apInfo.get("classroomId"));
                        if (classroomId != null) {
                            FloorPlanElement roomElement = roomMap.get(classroomId);
                            if (roomElement != null) {
                                double roomX = roomElement.getXCoordinate() != null ? roomElement.getXCoordinate() : 0.0;
                                double roomY = roomElement.getYCoordinate() != null ? roomElement.getYCoordinate() : 0.0;
                                double roomWidth = roomElement.getWidth() != null ? roomElement.getWidth() : 1000.0;
                                double roomHeight = roomElement.getHeight() != null ? roomElement.getHeight() : 1000.0;
                                
                                double savedX = resolved.getXCoordinate() != null ? resolved.getXCoordinate() : 0.0;
                                double savedY = resolved.getYCoordinate() != null ? resolved.getYCoordinate() : 0.0;
                                
                                // element_data에서 offsetX, offsetY 확인 (우선순위 1)
                                double offsetX = extractDouble(elementData.get("offsetX"), Double.NaN);
                                double offsetY = extractDouble(elementData.get("offsetY"), Double.NaN);
                                
                                if (!Double.isNaN(offsetX) && !Double.isNaN(offsetY)) {
                                    // element_data에 offsetX, offsetY가 있으면 교실 기준 오프셋으로 사용
                                    double centerX = roomX + offsetX;
                                    double centerY = roomY + offsetY;
                                    resolved.setXCoordinate(centerX);
                                    resolved.setYCoordinate(centerY);
                                    log.debug("AP 좌표 변환 (element_data offset): offsetX={}, offsetY={}, roomX={}, roomY={}, centerX={}, centerY={}", 
                                            offsetX, offsetY, roomX, roomY, centerX, centerY);
                                } else {
                                    // 저장된 좌표가 이미 중앙 좌표인지 확인
                                    // 교실 범위 내에 있으면 오프셋으로 간주, 그 외에는 절대 좌표로 간주
                                    boolean isWithinRoomBounds = (savedX >= roomX && savedX <= roomX + roomWidth && 
                                                                 savedY >= roomY && savedY <= roomY + roomHeight);
                                    
                                    // 절대 좌표는 보통 매우 큰 값(수천 이상)이므로, 작은 값은 오프셋으로 간주
                                    boolean isSmallValue = (Math.abs(savedX) < 5000 && Math.abs(savedY) < 5000);
                                    
                                    if (isWithinRoomBounds && isSmallValue) {
                                        // 교실 범위 내에 있고 작은 값이면 오프셋으로 간주
                                        double centerX = roomX + savedX;
                                        double centerY = roomY + savedY;
                                        resolved.setXCoordinate(centerX);
                                        resolved.setYCoordinate(centerY);
                                        log.debug("AP 좌표 변환 (오프셋으로 간주): savedX={}, savedY={}, roomX={}, roomY={}, centerX={}, centerY={}", 
                                                savedX, savedY, roomX, roomY, centerX, centerY);
                                    } else {
                                        // 이미 절대 중앙 좌표로 간주하고 그대로 사용
                                        // (DataSyncManager에서 저장 시 이미 중앙 좌표로 변환하여 저장)
                                        log.debug("AP 좌표 유지 (절대 중앙 좌표): savedX={}, savedY={}", savedX, savedY);
                                    }
                                }
                            }
                        }
                    }
                }

                ensureWirelessApElementData(resolved);
                normalizeWirelessApDefaults(resolved);
                resolvedApElements.add(resolved);
            }

            // 평면도에 배치된 교실에 속한 AP만 표시 (배치되지 않은 교실의 AP는 제외)
            for (Map.Entry<Long, Map<String, Object>> entry : wirelessApMap.entrySet()) {
                Long apId = entry.getKey();
                if (handledApIds.contains(apId)) {
                    continue;
                }
                
                // 해당 AP의 교실이 평면도에 배치되어 있는지 확인
                Map<String, Object> apInfo = entry.getValue();
                Long classroomId = toLong(apInfo.get("classroomId"));
                if (classroomId == null || !roomMap.containsKey(classroomId)) {
                    // 교실이 평면도에 배치되지 않은 AP는 제외
                    log.debug("AP 제외 (교실 미배치): apId={}, classroomId={}", apId, classroomId);
                    continue;
                }
                
                // 해당 AP의 교실이 현재 페이지에 있는지 확인
                FloorPlanElement roomElement = roomMap.get(classroomId);
                if (roomElement == null) {
                    // 현재 페이지에 해당 교실이 없으면 AP 생성하지 않음
                    log.debug("AP 제외 (현재 페이지에 교실 없음): apId={}, classroomId={}, pageNumber={}", 
                            apId, classroomId, pageNumber);
                    continue;
                }
                
                // 교실의 페이지 번호 확인 (이중 체크)
                Integer roomPageNumber = roomElement.getPageNumber() != null ? roomElement.getPageNumber() : 1;
                if (!roomPageNumber.equals(pageNumber)) {
                    log.debug("AP 제외 (교실이 다른 페이지): apId={}, classroomId={}, roomPage={}, currentPage={}", 
                            apId, classroomId, roomPageNumber, pageNumber);
                    continue;
                }
                
                FloorPlanElement virtualAp = createVirtualWirelessApElement(floorPlan, roomMap, apInfo);
                virtualAp.setReferenceId(apId);
                // 현재 페이지 번호 설정 (중요: 페이지별 필터링)
                virtualAp.setPageNumber(pageNumber);
                ensureWirelessApElementData(virtualAp);
                normalizeWirelessApDefaults(virtualAp);
                resolvedApElements.add(virtualAp);
            }

            // 기존 AP 요소 제거하고 변환된 AP 요소 추가
            elementsToProcess.removeIf(el -> "wireless_ap".equals(el.getElementType()));
            elementsToProcess.addAll(resolvedApElements);
            
            // 페이지별 AP 통계 로그
            Map<Integer, List<FloorPlanElement>> apByPage = new HashMap<>();
            Map<Long, List<FloorPlanElement>> apByClassroom = new HashMap<>();
            for (FloorPlanElement ap : resolvedApElements) {
                Integer apPage = ap.getPageNumber();
                if (apPage == null) {
                    apPage = pageNumber; // 현재 페이지로 간주
                }
                apByPage.computeIfAbsent(apPage, k -> new ArrayList<>()).add(ap);
                
                Long classroomId = ap.getReferenceId();
                if (classroomId != null) {
                    apByClassroom.computeIfAbsent(classroomId, k -> new ArrayList<>()).add(ap);
                }
            }
            
            log.info("무선AP 보기 모드 - 처리 후 요소 개수: {}, AP 개수: {}", 
                    elementsToProcess.size(), resolvedApElements.size());
            log.info("페이지별 AP 통계 (PPT 생성 - 페이지 {}):", pageNumber);
            apByPage.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    String apList = entry.getValue().stream()
                        .map(ap -> String.format("%s(%s)", ap.getLabel(), ap.getReferenceId()))
                        .collect(java.util.stream.Collectors.joining(", "));
                    log.info("  페이지 {}: {}개 AP - {}", entry.getKey(), entry.getValue().size(), apList);
                });
            
            // 교실별 중복 확인
            List<Long> duplicateClassrooms = apByClassroom.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toList());
            
            if (!duplicateClassrooms.isEmpty()) {
                log.warn("⚠️ 같은 교실에 여러 AP가 있는 경우:");
                for (Long classroomId : duplicateClassrooms) {
                    String apList = apByClassroom.get(classroomId).stream()
                        .map(ap -> String.format("%s(%s) - 페이지 %s", 
                            ap.getLabel(), ap.getReferenceId(), ap.getPageNumber()))
                        .collect(java.util.stream.Collectors.joining(", "));
                    log.warn("  교실 {}: {}", classroomId, apList);
                }
            } else {
                log.info("✅ 교실별 AP 중복 없음");
            }
        }
        
        // 필터링된 요소들로 바운딩 박스 계산
        BoundingBox bounds = calculateBoundingBox(elementsToProcess);
        
        // 동적 스케일 및 오프셋 계산 (헤더 영역 및 범례 영역 제외)
        double availableWidth = PPT_WIDTH - 40;  // 좌우 여백 20px씩
        double availableHeight = PPT_HEIGHT - 60 - 50; // 상단 헤더 50px + 하단 범례 영역 50px
        
        // 바운딩 박스 크기 확인
        if (bounds.width <= 0 || bounds.height <= 0) {
            log.warn("⚠️ 바운딩 박스 크기가 0 이하입니다: {}", bounds);
            bounds = new BoundingBox(0, 0, 1000, 1000);
        }
        
        double scaleX = availableWidth / bounds.width;
        double scaleY = availableHeight / bounds.height;
        double scale = Math.min(scaleX, scaleY); // 비율 유지를 위해 작은 값 사용
        
        // 스케일이 너무 작거나 큰 경우 제한
        if (scale <= 0 || Double.isNaN(scale) || Double.isInfinite(scale)) {
            log.warn("⚠️ 스케일 계산 오류: {}, 기본값 0.15 사용", scale);
            scale = 0.15;
        }
        
        // 중앙 정렬을 위한 오프셋 계산
        // 스케일된 평면도의 실제 크기
        double scaledWidth = bounds.width * scale;
        double scaledHeight = bounds.height * scale;
        
        // 중앙 정렬을 위한 여백 계산
        double marginX = (availableWidth - scaledWidth) / 2;
        double marginY = (availableHeight - scaledHeight) / 2;
        
        // 오프셋 계산: 요소 좌표를 PPT 좌표로 변환
        // 좌표 변환 공식: PPT 좌표 = (원본 좌표 - bounds.minX) * scale + baseX
        // 현재 코드는: PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        // 따라서: offsetX = baseX (bounds.minX는 좌표 변환 시 뺌)
        // baseX = 좌측 여백(20) + 중앙 정렬 여백(marginX)
        double baseX = 20 + marginX;  // 좌측 여백 20 + 중앙 정렬 여백
        double baseY = 50 + marginY;  // 상단 여백 50 + 중앙 정렬 여백
        
        // offsetX와 offsetY를 baseX, baseY로 설정하고, 좌표 변환 시 bounds.minX를 빼도록 수정
        // 이렇게 하면 항상 양수 오프셋을 사용할 수 있음
        double offsetX = baseX;
        double offsetY = baseY;
        
        // bounds.minX와 bounds.minY를 저장하여 좌표 변환 시 사용
        this.currentBoundsMinX = bounds.minX;
        this.currentBoundsMinY = bounds.minY;
        
        if (marginX < 0 || marginY < 0) {
            log.warn("⚠️ 마진이 음수입니다! bounds: minX={:.2f}, minY={:.2f}, width={:.2f}, height={:.2f}, scale: {:.6f}, scaledWidth: {:.2f}, scaledHeight: {:.2f}, availableWidth: {:.2f}, availableHeight: {:.2f}, marginX: {:.2f}, marginY: {:.2f}", 
                    bounds.minX, bounds.minY, bounds.width, bounds.height, scale, scaledWidth, scaledHeight, availableWidth, availableHeight, marginX, marginY);
        }
        
        
        // 평면도 요소들을 z-index 순서대로 추가
        int roomCount = 0;
        int apCount = 0;
        int mdfCount = 0;
        
        List<FloorPlanElement> deferredWirelessAps = new ArrayList<>();
        
        for (FloorPlanElement element : elementsToProcess) {
            if ("wireless_ap".equals(element.getElementType())) {
                deferredWirelessAps.add(element);
                continue;
            }
            
            try {
                // 모든 모드에서 요소 추가 (필터링된 요소들은 이미 처리됨)
                addElementToSlide(floorPlanSlide, element, scale, offsetX, offsetY);
                
                // 무선 AP 보기 모드: AP와 MDF 개수 카운트
                if ("wireless-ap".equals(mode)) {
                    if ("mdf_idf".equals(element.getElementType())) {
                        mdfCount++;
                    }
                }
                
                // 장비 보기 모드이고 교실 요소인 경우 장비 카드 추가
                if ("equipment".equals(mode) && "room".equals(element.getElementType())) {
                    roomCount++;
                    if (devicesByClassroom != null) {
                        addEquipmentCardsToRoom(floorPlanSlide, element, devicesByClassroom, scale, offsetX, offsetY, elements, equipmentFontSize);
                    } else {
                        log.warn("⚠️ 장비 데이터가 null입니다!");
                    }
                }
            } catch (Exception e) {
                log.error("요소 추가 중 오류 발생 (ID: {}): {}", element.getId(), e.getMessage(), e);
            }
        }
        
        for (FloorPlanElement apElement : deferredWirelessAps) {
            try {
                addElementToSlide(floorPlanSlide, apElement, scale, offsetX, offsetY);
                if ("wireless-ap".equals(mode)) {
                    apCount++;
                }
            } catch (Exception e) {
                log.error("무선AP 요소 추가 중 오류 발생 (ID: {}): {}", apElement.getId(), e.getMessage(), e);
            }
        }
        
        if ("equipment".equals(mode)) {
        } else if ("wireless-ap".equals(mode)) {
        }
        
        // 범례 추가 (평면도 하단에 50px 간격)
        addLegendToSlide(floorPlanSlide, school, mode, devicesByClassroom, offsetY + scaledHeight + 50);
    }
    
    /**
     * 바운딩 박스 클래스
     */
    private static class BoundingBox {
        double minX, minY, maxX, maxY, width, height;
        
        BoundingBox(double minX, double minY, double maxX, double maxY) {
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
            this.width = maxX - minX;
            this.height = maxY - minY;
        }
        
        @Override
        public String toString() {
            return String.format("BoundingBox[x: %.0f~%.0f (%.0f), y: %.0f~%.0f (%.0f)]", 
                minX, maxX, width, minY, maxY, height);
        }
    }
    
    /**
     * 모든 요소의 바운딩 박스 계산
     */
    private BoundingBox calculateBoundingBox(List<FloorPlanElement> elements) {
        if (elements == null || elements.isEmpty()) {
            // 빈 리스트인 경우 기본 바운딩 박스 반환
            return new BoundingBox(0, 0, 1000, 1000);
        }
        
        double minX = Double.MAX_VALUE;
        double minY = Double.MAX_VALUE;
        double maxX = Double.MIN_VALUE;
        double maxY = Double.MIN_VALUE;
        
        int padding = 100; // 여유 공간
        
        for (FloorPlanElement element : elements) {
            // 좌표가 없는 요소는 건너뛰기
            if (element.getXCoordinate() == null || element.getYCoordinate() == null) {
                continue;
            }
            
            double x = element.getXCoordinate();
            double y = element.getYCoordinate();
            Double wObj = element.getWidth();
            Double hObj = element.getHeight();
            double w = wObj != null ? wObj : 0;
            double h = hObj != null ? hObj : 0;
            
            // wireless_ap의 경우 좌표가 중앙 좌표로 저장되어 있으므로 좌상단 좌표로 변환
            if ("wireless_ap".equals(element.getElementType())) {
                double radius = 20.0; // 기본 반지름
                if (w > 0 && h > 0) {
                    radius = Math.min(w, h) / 2.0;
                } else {
                    // element_data에서 radius 확인
                    try {
                        Map<String, Object> elementData = parseElementData(element.getElementData());
                        if (elementData != null && elementData.containsKey("radius")) {
                            Object radiusObj = elementData.get("radius");
                            if (radiusObj instanceof Number) {
                                radius = ((Number) radiusObj).doubleValue();
                            }
                        }
            } catch (Exception e) {
                        // 파싱 실패 시 기본값 사용
                    }
                }
                // 중앙 좌표에서 반지름을 빼서 좌상단 좌표로 변환
                x = x - radius;
                y = y - radius;
                w = radius * 2;
                h = radius * 2;
            }
            
            // 요소의 실제 경계 계산
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        }
        
        // 유효한 바운딩 박스인지 확인
        if (minX == Double.MAX_VALUE || minY == Double.MAX_VALUE || 
            maxX == Double.MIN_VALUE || maxY == Double.MIN_VALUE) {
            // 유효하지 않은 경우 기본값 반환
            log.warn("⚠️ 바운딩 박스 계산 실패: 기본값 사용");
            return new BoundingBox(0, 0, 1000, 1000);
        }
        
        // 패딩 추가
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX += padding;
        maxY += padding;
        
        
        return new BoundingBox(minX, minY, maxX, maxY);
    }
    
    /**
     * 평면도 요소를 슬라이드에 추가 (동적 스케일 적용)
     */
    private void addElementToSlide(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        String elementType = element.getElementType();
        
        switch (elementType) {
            case "room":
                createRoomShape(slide, element, scale, offsetX, offsetY);
                break;
            case "building":
                createBuildingShape(slide, element, scale, offsetX, offsetY);
                break;
            case "shape":
                createCustomShape(slide, element, scale, offsetX, offsetY);
                break;
            case "other_space":
                createOtherSpaceShape(slide, element, scale, offsetX, offsetY);
                break;
            case "name_box":
                createNameBoxShape(slide, element, scale, offsetX, offsetY);
                break;
            case "equipment_card":
                createEquipmentCardShape(slide, element, scale, offsetX, offsetY);
                break;
            case "toilet":
                createToiletShape(slide, element, scale, offsetX, offsetY);
                break;
            case "elevator":
                createElevatorShape(slide, element, scale, offsetX, offsetY);
                break;
            case "entrance":
                createEntranceShape(slide, element, scale, offsetX, offsetY);
                break;
            case "stairs":
                createStairsShape(slide, element, scale, offsetX, offsetY);
                break;
            case "wireless_ap":
                createWirelessApShape(slide, element, scale, offsetX, offsetY);
                break;
            case "mdf_idf":
                createMdfIdfShape(slide, element, scale, offsetX, offsetY);
                break;
            default:
                log.warn("알 수 없는 요소 타입: {}", elementType);
        }
    }
    
    /**
     * 교실 도형 생성 (동적 스케일 적용)
     */
    private void createRoomShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 추가 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        Color shapeFillColor;
        String roomName = (String) elementData.getOrDefault("roomName", "교실");
        String borderColor = (String) elementData.getOrDefault("borderColor", "#000000");
        
        // borderWidth (JavaScript에서 사용) 또는 borderThickness 우선순위로 확인
        String borderThicknessStr = null;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                borderThicknessStr = String.valueOf(borderWidthObj);
            } else if (borderWidthObj instanceof String) {
                borderThicknessStr = (String) borderWidthObj;
            }
        }
        if (borderThicknessStr == null && elementData.containsKey("borderThickness")) {
            borderThicknessStr = String.valueOf(elementData.get("borderThickness"));
        }
        if (borderThicknessStr == null) {
            borderThicknessStr = "2"; // 기본값
        }
        
        double borderThickness = Double.parseDouble(borderThicknessStr);
        
        // 배경색 가져오기 (없으면 투명)
        String bgColorStr = (String) elementData.getOrDefault("backgroundColor", null);
        Color bgColor = null;
        if (bgColorStr != null && !bgColorStr.equals("transparent") && !bgColorStr.isEmpty()) {
            bgColor = parseColor(bgColorStr);
        } else {
            bgColor = new Color(245, 245, 245); // 기본 연한 회색
        }
        
        // 사각형 도형 생성
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 테두리 설정 (스케일에 비례)
        shape.setLineColor(parseColor(borderColor));
        // 스케일이 작아도 선이 보이도록 최소값 조정 (0.2pt)
        double roomLineWidth = Math.max(0.2, borderThickness * scale);
        shape.setLineWidth(roomLineWidth);
        
        // 배경색 설정
        shape.setFillColor(bgColor);
        
        // 텍스트 추가 (교실 내부, 일반적으로 표시 안 함)
        // 교실 이름은 name_box 요소로 별도 표시됨
    }
    
    /**
     * 건물 도형 생성 (동적 스케일 적용)
     */
    private void createBuildingShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 건물 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String buildingName = (String) elementData.getOrDefault("buildingName", "건물");
        String borderColor = (String) elementData.getOrDefault("borderColor", "#000000");
        
        // borderWidth (JavaScript에서 사용) 또는 borderThickness 우선순위로 확인
        String borderThicknessStr = null;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                borderThicknessStr = String.valueOf(borderWidthObj);
            } else if (borderWidthObj instanceof String) {
                borderThicknessStr = (String) borderWidthObj;
            }
        }
        if (borderThicknessStr == null && elementData.containsKey("borderThickness")) {
            borderThicknessStr = String.valueOf(elementData.get("borderThickness"));
        }
        if (borderThicknessStr == null) {
            borderThicknessStr = "2"; // 기본값
        }
        
        double borderThickness = Double.parseDouble(borderThicknessStr);
        
        // 배경색 가져오기 (없으면 연한 파란색)
        String bgColorStr = (String) elementData.getOrDefault("backgroundColor", null);
        Color bgColor = null;
        if (bgColorStr != null && !bgColorStr.equals("transparent") && !bgColorStr.isEmpty()) {
            bgColor = parseColor(bgColorStr);
        } else {
            bgColor = new Color(219, 234, 254); // 기본 연한 파란색
        }
        
        // 사각형 도형 생성
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 테두리 설정 (스케일에 비례)
        shape.setLineColor(parseColor(borderColor));
        // 스케일이 작아도 선이 보이도록 최소값 조정 (0.2pt)
        double buildingLineWidth = Math.max(0.2, borderThickness * scale);
        shape.setLineWidth(buildingLineWidth);
        
        // 배경색 설정
        shape.setFillColor(bgColor);
        
        // 건물 내부 텍스트는 표시하지 않음
    }
    
    /**
     * 도형 생성 (사각형, 원, 선, 화살표) - 동적 스케일 적용
     */
    private void createCustomShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 도형 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String shapeType = (String) elementData.getOrDefault("shapeType", "rectangle");
        String color = (String) elementData.getOrDefault("color", "#000000");
        String borderColor = (String) elementData.getOrDefault("borderColor", color);
        
        // borderWidth (JavaScript에서 사용) 또는 borderThickness 또는 thickness 우선순위로 확인
        String lineWidthStr = null;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                lineWidthStr = String.valueOf(borderWidthObj);
            } else if (borderWidthObj instanceof String) {
                lineWidthStr = (String) borderWidthObj;
            }
        }
        if (lineWidthStr == null && elementData.containsKey("borderThickness")) {
            lineWidthStr = String.valueOf(elementData.get("borderThickness"));
        }
        if (lineWidthStr == null && elementData.containsKey("thickness")) {
            lineWidthStr = String.valueOf(elementData.get("thickness"));
        }
        if (lineWidthStr == null) {
            lineWidthStr = "2"; // 기본값
        }
        
        double lineWidth = Double.parseDouble(lineWidthStr);
        
        // 배경색 가져오기
        String bgColorStr = (String) elementData.getOrDefault("backgroundColor", null);
        Color bgColor = null;
        if (bgColorStr != null && !bgColorStr.equals("transparent") && !bgColorStr.isEmpty()) {
            bgColor = parseColor(bgColorStr);
        }
        
        XSLFAutoShape shape = slide.createAutoShape();
        
        // 도형 타입에 따라 설정
        boolean isDashed = shapeType.equals("dashed-line");
        switch (shapeType) {
            case "circle":
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
                break;
            case "line":
            case "dashed-line":
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.LINE);
                break;
            case "arrow":
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RIGHT_ARROW);
                break;
            case "rectangle":
            default:
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
                break;
        }
        
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 선 색상 및 두께 설정 (스케일에 비례)
        shape.setLineColor(parseColor(borderColor));
        // 스케일이 작아도 선이 보이도록 최소값 조정 (0.2pt)
        double customLineWidth = Math.max(0.2, lineWidth * scale);
        shape.setLineWidth(customLineWidth);
        
        // 점선 스타일 처리
        if (isDashed) {
            // 점선 스타일 설정 (XML 객체에 직접 접근)
            try {
                // XSLFAutoShape의 XML 객체는 CTShape
                org.openxmlformats.schemas.presentationml.x2006.main.CTShape ctShape = 
                    (org.openxmlformats.schemas.presentationml.x2006.main.CTShape) shape.getXmlObject();
                if (ctShape != null && ctShape.getSpPr() != null) {
                    org.openxmlformats.schemas.drawingml.x2006.main.CTLineProperties lineProps = 
                        ctShape.getSpPr().getLn();
                    if (lineProps != null) {
                        // 점선 스타일 설정 (DASH)
                        org.openxmlformats.schemas.drawingml.x2006.main.CTPresetLineDashProperties presetDash = 
                            org.openxmlformats.schemas.drawingml.x2006.main.CTPresetLineDashProperties.Factory.newInstance();
                        presetDash.setVal(org.openxmlformats.schemas.drawingml.x2006.main.STPresetLineDashVal.DASH);
                        lineProps.setPrstDash(presetDash);
                    }
                }
            } catch (Exception e) {
                log.warn("[점선 도형] 점선 스타일 설정 실패: {}", e.getMessage());
            }
        }
        
        // 선/화살표는 배경색 없음
        if (shapeType.equals("line") || shapeType.equals("arrow") || isDashed) {
            shape.setFillColor(null);
        } else {
            // 사각형/원은 배경색 설정 (없으면 투명)
            if (bgColor != null) {
                shape.setFillColor(bgColor);
            } else {
            shape.setFillColor(new Color(255, 255, 255, 0));
            }
        }
    }
    
    /**
     * 기타공간 도형 생성 (동적 스케일 적용)
     */
    private void createOtherSpaceShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 공간 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String spaceType = (String) elementData.getOrDefault("spaceType", "corridor");
        String spaceName = (String) elementData.getOrDefault("spaceName", "기타공간");
        String borderColorStr = (String) elementData.getOrDefault("borderColor", null);
        
        // borderWidth (JavaScript에서 사용) 또는 borderThickness 우선순위로 확인
        String borderThicknessStr = null;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                borderThicknessStr = String.valueOf(borderWidthObj);
            } else if (borderWidthObj instanceof String) {
                borderThicknessStr = (String) borderWidthObj;
            }
        }
        if (borderThicknessStr == null && elementData.containsKey("borderThickness")) {
            borderThicknessStr = String.valueOf(elementData.get("borderThickness"));
        }
        
        String bgColorStr = (String) elementData.getOrDefault("backgroundColor", null);
        
        // 배경색 설정
        Color bgColor = null;
        if (bgColorStr != null && !bgColorStr.equals("transparent") && !bgColorStr.isEmpty()) {
            bgColor = parseColor(bgColorStr);
        } else {
            bgColor = getOtherSpaceColor(spaceType);
        }
        
        // 사각형 도형 생성
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        shape.setFillColor(bgColor);
        
        // 테두리 색상 설정
        Color lineColor = null;
        if (borderColorStr != null && !borderColorStr.isEmpty()) {
            lineColor = parseColor(borderColorStr);
        } else {
            lineColor = darkenColor(bgColor, 0.3);
        }
        shape.setLineColor(lineColor);
        
        // 테두리 굵기 설정 (스케일에 비례)
        double lineWidth = 2.0;
        if (borderThicknessStr != null && !borderThicknessStr.isEmpty()) {
            lineWidth = Double.parseDouble(borderThicknessStr);
        }
        // 스케일이 작아도 선이 보이도록 최소값 조정 (0.2pt)
        double otherSpaceLineWidth = Math.max(0.2, lineWidth * scale);
        shape.setLineWidth(otherSpaceLineWidth);
        
        // 텍스트 추가
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(spaceName);
        textRun.setFontSize(Math.min(width / 10.0, 12.0));
        textRun.setFontColor(Color.BLACK);
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 기타공간 타입별 색상 반환
     */
    private Color getOtherSpaceColor(String spaceType) {
        switch (spaceType) {
            case "corridor": return new Color(229, 231, 235); // 회색 (복도)
            case "staircase": return new Color(254, 243, 199); // 노란색 (계단)
            case "elevator": return new Color(224, 242, 254); // 하늘색 (엘리베이터)
            case "toilet": return new Color(219, 234, 254); // 파란색 (화장실)
            case "office": return new Color(254, 226, 226); // 분홍색 (사무실)
            case "library": return new Color(237, 233, 254); // 보라색 (도서관)
            case "cafeteria": return new Color(254, 249, 195); // 연노랑 (급식실)
            case "gym": return new Color(220, 252, 231); // 연두색 (체육관)
            case "auditorium": return new Color(254, 215, 170); // 주황색 (강당)
            default: return new Color(243, 244, 246); // 기본 회색
        }
    }
    
    /**
     * 색상을 어둡게 만들기
     */
    private Color darkenColor(Color color, double factor) {
        int r = (int)(color.getRed() * (1 - factor));
        int g = (int)(color.getGreen() * (1 - factor));
        int b = (int)(color.getBlue() * (1 - factor));
        return new Color(r, g, b);
    }
    
    /**
     * 이름박스 생성 (동적 스케일 적용)
     */
    private void createNameBoxShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String label = (String) elementData.getOrDefault("label", "");
        String borderColorStr = (String) elementData.getOrDefault("borderColor", "#000000");
        String borderThicknessStr = (String) elementData.getOrDefault("borderThickness", "1");
        double borderThickness = Double.parseDouble(borderThicknessStr);
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 이름박스 스타일 단순화: 테두리/배경 제거, 텍스트만 표시
        shape.setLineColor(null);          // 테두리 없음
        shape.setLineWidth(0.0);           // 선 두께 0
        shape.setFillColor(null);          // 배경 없음 (투명)
        
        // 텍스트 설정: 자동맞춤 사용하지 않고 고정 비율 폰트 적용
        shape.setWordWrap(false);
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(label);
        // 동적 스케일 기반 폰트 크기 (장비텍스트 공식 참고)
        // 화면: Math.max(12, (h * 0.5 + 2) * 1.5)
        // PPT: 장비텍스트처럼 화면 폰트 크기를 직접 스케일로 변환
        double originalHeight = element.getHeight();
        // 화면 공식: (h * 0.5 + 2) * 1.5
        double screenFontSize = (originalHeight * 0.5 + 2) * 1.5;
        // 최소값 적용 (화면: 12px)
        screenFontSize = Math.max(12.0, screenFontSize);
        
        // PPT 포인트로 변환: 화면 px * scale * 보정계수 (장비텍스트와 유사한 방식)
        // 장비텍스트: equipmentFontSize * scale * 0.8
        // 이름박스: screenFontSize * scale * 보정계수
        double calculatedFontSize = screenFontSize * scale * 0.8;
        
        // 순수 지수 함수를 사용한 통합 변환: fontSize = a * (calculatedFontSize)^b + c
        // 초기 계수 기준으로 지수 함수 결과값을 목표 최종값으로 보정
        double fontSize;
        if (calculatedFontSize <= 0) {
            fontSize = 0;
        } else {
            // 지수 함수: fontSize = a * (calculatedFontSize)^b + c
            // 초기 계수 사용
            double a = 0.45;   // 스케일 계수
            double b = 0.75;   // 지수 (1보다 작아서 작은 값에서 완만하게 증가)
            double c = 2.0;    // 오프셋
            
            double expResult = a * Math.pow(calculatedFontSize, b) + c;
            
            // 지수 함수 결과값을 목표 최종값으로 보정
            // 보정 포인트: 3→4, 5.2→9, 6.7→14, 9.9→50
            if (expResult <= 3.0) {
                // 3 이하: 선형 보간 (0 → 0, 3 → 4)
                if (expResult <= 0) {
                    fontSize = 0;
                } else {
                    double t = expResult / 3.0;
                    fontSize = 4.0 * t;
                }
            } else if (expResult <= 5.2) {
                // 3과 5.2 사이: 3 → 4, 5.2 → 9 선형 보간
                double t = (expResult - 3.0) / (5.2 - 3.0);
                fontSize = 4.0 + (9.0 - 4.0) * t;
            } else if (expResult <= 6.7) {
                // 5.2와 6.7 사이: 5.2 → 9, 6.7 → 14 선형 보간
                double t = (expResult - 5.2) / (6.7 - 5.2);
                fontSize = 9.0 + (14.0 - 9.0) * t;
            } else if (expResult <= 9.9) {
                // 6.7과 9.9 사이: 6.7 → 14, 9.9 → 50 선형 보간
                double t = (expResult - 6.7) / (9.9 - 6.7);
                fontSize = 14.0 + (50.0 - 14.0) * t;
            } else {
                // 9.9 이상: 9.9 → 50 비율을 유지하여 확장
                double ratio = 50.0 / 9.9;
                fontSize = expResult * ratio;
            }
        }
        
        // 폰트 크기 30% 증가
        fontSize = fontSize * 1.3;
        
        textRun.setFontSize(fontSize);
        textRun.setFontColor(Color.BLACK);
        textRun.setBold(true);
        shape.setInsets(new org.apache.poi.sl.usermodel.Insets2D(2, 4, 2, 4));
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 장비 카드 생성 (동적 스케일 적용)
     * 
     * 프론트엔드와 동일하게 카드 형태 대신 텍스트만 표시하도록 단순화.
     * (기존 사각형/배경 제거)
     */
    private void createEquipmentCardShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String deviceType = (String) elementData.getOrDefault("deviceType", "장비");
        Integer count = (Integer) elementData.getOrDefault("count", 0);
        
        // 장비 정보 텍스트
        String label = deviceType + " " + count;
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 카드 배경/테두리 제거 → 텍스트만 표시
        shape.setFillColor(null);
        shape.setLineColor(null);
        shape.setLineWidth(0.0);
        
        // 텍스트 설정 (붉은색, 중앙 정렬)
        shape.setWordWrap(true);
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(label);
        textRun.setFontSize(Math.min(16.0, height * 0.6));
        textRun.setFontColor(new Color(0xFF0000));
        textRun.setBold(true);
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 화장실 생성 (동적 스케일 적용)
     */
    private void createToiletShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        shape.setLineColor(Color.BLACK);
        // 스케일이 작아도 선이 보이도록 최소값 조정 (0.2pt)
        double toiletLineWidth = Math.max(0.2, 2.0 * scale);
        shape.setLineWidth(toiletLineWidth);
        shape.setFillColor(Color.WHITE);
        
        // WC 텍스트 추가 (중앙, 이름박스와 같은 높이)
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText("WC");
        // 동적 스케일 기반 폰트 크기 (기본 높이 180px 기준 22pt)
        // 이름박스와 동일한 방식으로 계산 (22pt → PPT 폰트 비율 적용)
        double baseFontSize = 22.0; // WC 원본 폰트
        double nameBoxFontSize = 18.0; // 이름박스 원본 폰트
        double scaleRatio = scale / REFERENCE_ZOOM;
        double fontRatio = baseFontSize / nameBoxFontSize;
        double fontSize = REFERENCE_PPT_FONT * scaleRatio * fontRatio * 1.2; // 20% 증가
        // 최소값 제거 - 계산된 값 그대로 사용
        textRun.setFontSize(fontSize);
        textRun.setFontColor(Color.BLACK);
        textRun.setBold(true);
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 엘리베이터 생성 (동적 스케일 적용)
     */
    private void createElevatorShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        shape.setLineColor(Color.BLACK);
        // 스케일이 작아도 선이 보이도록 최소값 조정 (0.2pt)
        double elevatorLineWidth = Math.max(0.2, 2.0 * scale);
        shape.setLineWidth(elevatorLineWidth);
        shape.setFillColor(Color.WHITE);
        
        // EV 텍스트 추가 (중앙, 이름박스와 같은 높이)
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText("EV");
        // 동적 스케일 기반 폰트 크기 (기본 높이 180px 기준 22pt)
        // 이름박스와 동일한 방식으로 계산 (22pt → PPT 폰트 비율 적용)
        double baseFontSize = 22.0; // EV 원본 폰트
        double nameBoxFontSize = 18.0; // 이름박스 원본 폰트
        double scaleRatio = scale / REFERENCE_ZOOM;
        double fontRatio = baseFontSize / nameBoxFontSize;
        double fontSize = REFERENCE_PPT_FONT * scaleRatio * fontRatio * 1.2; // 20% 증가
        // 최소값 제거 - 계산된 값 그대로 사용
        textRun.setFontSize(fontSize);
        textRun.setFontColor(Color.BLACK);
        textRun.setBold(true);
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 현관 생성 (동적 스케일 적용) - JavaScript와 동일한 로직
     */
    private void createEntranceShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 회전 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        Object rotationObj = elementData.getOrDefault("rotation", 0);
        double rotation = 0.0;
        if (rotationObj instanceof Number) {
            rotation = ((Number) rotationObj).doubleValue();
        } else if (rotationObj instanceof String) {
            try {
                rotation = Double.parseDouble((String) rotationObj);
            } catch (NumberFormatException e) {
                rotation = 0.0;
            }
        }
        
        // JavaScript와 동일한 계산: doorSize = Math.min(w, h)
        int doorSize = Math.min(width, height);
        // 중심 계산: centerX = x + w / 2, centerY = y + h / 2
        double centerX = x + width / 2.0;
        double centerY = y + height / 2.0;
        // 문틀 위치: startX = centerX + doorSize / 2 (오른쪽)
        double startX = centerX + doorSize / 2.0;
        double startY = centerY - doorSize / 2.0;
        
        // borderWidth 가져오기
        double borderWidth = 2.0;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                borderWidth = ((Number) borderWidthObj).doubleValue();
            } else if (borderWidthObj instanceof String) {
                try {
                    borderWidth = Double.parseDouble((String) borderWidthObj);
                } catch (NumberFormatException e) {
                    borderWidth = 2.0;
                }
            }
        }
        // JavaScript: lineWidth = borderWidth * 2
        double lineWidth = Math.max(0.2, borderWidth * 2.0 * scale);
        
        // 원호를 더 매끈하게 하기 위해 선분 수 증가 (48개로 충분히 부드럽게)
        int segments = 48;
        // JavaScript: arc(startX, startY, doorSize, Math.PI / 2, Math.PI)
        // Canvas arc는 (centerX, centerY, radius, startAngle, endAngle) 형식
        // startX, startY가 원호의 중심점
        double arcCenterX = startX;  // 원호 중심 X
        double arcCenterY = startY;  // 원호 중심 Y
        double arcRadius = doorSize; // 원호 반지름
        double arcStartAngle = Math.PI / 2;  // 위쪽 방향 (90도)
        double arcEndAngle = Math.PI;         // 왼쪽 방향 (180도)
        
        // 회전 적용을 위한 변환 행렬 계산
        double rotationRad = rotation * Math.PI / 180.0;
        
        // 회전 변환 함수 (요소의 중심 기준 회전)
        java.util.function.BiFunction<Double, Double, double[]> rotatePoint = (px, py) -> {
            double dx = px - centerX;
            double dy = py - centerY;
            double rotatedX = dx * Math.cos(rotationRad) - dy * Math.sin(rotationRad);
            double rotatedY = dx * Math.sin(rotationRad) + dy * Math.cos(rotationRad);
            return new double[]{rotatedX + centerX, rotatedY + centerY};
        };
        
        // 수직선 (문틀) - 회전 적용
        // JavaScript: moveTo(startX, startY), lineTo(startX, startY + doorSize)
        double[] lineStart = rotatePoint.apply(startX, startY);
        double[] lineEnd = rotatePoint.apply(startX, startY + doorSize);
        
        XSLFAutoShape line = slide.createAutoShape();
        line.setShapeType(org.apache.poi.sl.usermodel.ShapeType.LINE);
        line.setAnchor(new Rectangle(
            (int)Math.min(lineStart[0], lineEnd[0]), 
            (int)Math.min(lineStart[1], lineEnd[1]),
            (int)Math.abs(lineEnd[0] - lineStart[0]),
            (int)Math.abs(lineEnd[1] - lineStart[1])
        ));
        line.setLineColor(Color.BLACK);
        line.setLineWidth(lineWidth);
        
        // 1/4 원호를 Path2D로 생성하여 단일 Path로 그리기 (회전 적용)
        // JavaScript와 동일하게: arc(startX, startY, doorSize, Math.PI / 2, Math.PI)
        java.awt.geom.Path2D.Double arcPath = new java.awt.geom.Path2D.Double();
        
        // 원호의 시작점 계산 (회전 전)
        double startAngleX = arcCenterX + Math.cos(arcStartAngle) * arcRadius;
        double startAngleY = arcCenterY + Math.sin(arcStartAngle) * arcRadius;
        
        // 회전 적용하여 시작점 결정
        double[] arcPathStart = rotatePoint.apply(startAngleX, startAngleY);
        arcPath.moveTo(arcPathStart[0], arcPathStart[1]);
        
        // 원호를 작은 선분으로 근사하여 Path에 추가
        for (int i = 1; i <= segments; i++) {
            double angle = arcStartAngle + (arcEndAngle - arcStartAngle) * (i / (double)segments);
            
            // 원호 상의 점 계산 (원호 중심 기준)
            double px = arcCenterX + Math.cos(angle) * arcRadius;
            double py = arcCenterY + Math.sin(angle) * arcRadius;
            
            // 회전 적용 (요소의 중심 기준)
            double[] rotatedPoint = rotatePoint.apply(px, py);
            arcPath.lineTo(rotatedPoint[0], rotatedPoint[1]);
        }
        
        // XSLFFreeformShape로 단일 Path 생성
        XSLFFreeformShape arcShape = slide.createFreeform();
        arcShape.setPath(arcPath);
        arcShape.setLineColor(Color.BLACK);
        arcShape.setLineWidth(lineWidth);
        arcShape.setFillColor(null); // 배경 없음
    }
    
    /**
     * 계단 생성 (동적 스케일 적용) - JavaScript와 동일한 로직 (단일 Path)
     */
    private void createStairsShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 borderWidth 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        double borderWidth = 2.0;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                borderWidth = ((Number) borderWidthObj).doubleValue();
            } else if (borderWidthObj instanceof String) {
                try {
                    borderWidth = Double.parseDouble((String) borderWidthObj);
                } catch (NumberFormatException e) {
                    borderWidth = 2.0;
                }
            }
        }
        // JavaScript: lineWidth = borderWidth * 2
        double lineWidth = Math.max(0.2, borderWidth * 2.0 * scale);
        
        // JavaScript와 동일: stepCount = 7
        int stepCount = 7;
        
        // Path2D를 사용하여 단일 Path로 계단 그리기
        // JavaScript: ctx.moveTo(x, y + h) - 왼쪽 하단에서 시작
        java.awt.geom.Path2D.Double path = new java.awt.geom.Path2D.Double();
        path.moveTo(x, y + height);
        
        // JavaScript와 동일한 알고리즘
        for (int i = 0; i < stepCount; i++) {
            double stepX = x + (width / (double)stepCount) * i;
            double stepY = y + height - (height / (double)stepCount) * i;
            double nextStepX = x + (width / (double)stepCount) * (i + 1);
            
            // 위로 (JavaScript: ctx.lineTo(stepX, stepY))
            path.lineTo(stepX, stepY);
            // 오른쪽으로 (JavaScript: ctx.lineTo(nextStepX, stepY))
            path.lineTo(nextStepX, stepY);
        }
        
        // 마지막 단 연결 (JavaScript: ctx.lineTo(x + w, y))
        path.lineTo(x + width, y);
        
        // XSLFFreeformShape로 단일 Path 생성
        XSLFFreeformShape stairsPath = slide.createFreeform();
        stairsPath.setPath(path);
        stairsPath.setLineColor(Color.BLACK);
        stairsPath.setLineWidth(lineWidth);
        stairsPath.setFillColor(null); // 배경 없음
    }
    
    /**
     * 교실에 장비 카드 추가 (Equipment View Mode) - 동적 스케일 적용
     */
    private void addEquipmentCardsToRoom(XSLFSlide slide, FloorPlanElement roomElement, 
                                        Map<Long, List<Map<String, Object>>> devicesByClassroom,
                                        double scale, double offsetX, double offsetY, 
                                        List<FloorPlanElement> elements, Integer equipmentFontSize) throws Exception {
        // 교실 식별자 가져오기 (element_data.classroomId 우선, 없으면 referenceId 사용)
        Long classroomId = null;
        Map<String, Object> elementData = parseElementData(roomElement.getElementData());
        if (elementData.containsKey("classroomId")) {
            Object classroomIdObj = elementData.get("classroomId");
            if (classroomIdObj instanceof Integer) classroomId = ((Integer) classroomIdObj).longValue();
            else if (classroomIdObj instanceof Long) classroomId = (Long) classroomIdObj;
            else if (classroomIdObj instanceof String) {
                try { classroomId = Long.parseLong((String) classroomIdObj); } catch (Exception ignored) {}
            }
        }
        if (classroomId == null && roomElement.getReferenceId() != null) {
            classroomId = roomElement.getReferenceId();
        }
        if (classroomId == null) {
            log.error("장비 카드 추가 실패: classroomId를 찾을 수 없음 (elementId={})", roomElement.getId());
            return;
        }
        
        // 해당 교실의 장비 조회
        List<Map<String, Object>> devices = devicesByClassroom.get(classroomId);
        if (devices == null || devices.isEmpty()) {
            return;
        }
        
        // uidCate별로 그룹화 및 카운트 (보기모드와 동일한 순서 보장)
        // LinkedHashMap을 사용하여 장비가 처음 나타나는 순서대로 유지
        Map<String, Integer> deviceCounts = new java.util.LinkedHashMap<>();
        for (Map<String, Object> device : devices) {
            String cate = (String) device.getOrDefault("uidCate", "미분류");
            deviceCounts.put(cate, deviceCounts.getOrDefault(cate, 0) + 1);
        }
        
        // 교실 좌표 변환 (동적 스케일 및 오프셋 적용)
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int roomX = (int)((roomElement.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int roomY = (int)((roomElement.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int roomH = (int)(roomElement.getHeight() * scale);
        
        // 이름박스 위치 찾기 (겹침 방지 - 프론트엔드와 동일 로직)
        // element_data에서 parentElementId를 확인하거나 getParentElementId() 사용
        FloorPlanElement nameBox = null;
        for (FloorPlanElement el : elements) {
            if ("name_box".equals(el.getElementType())) {
                // parentElementId 필드 확인
                Long parentId = el.getParentElementId();
                // 또는 element_data에서 parentElementId 확인
                if (parentId == null) {
                    Map<String, Object> nameBoxData = parseElementData(el.getElementData());
                    Object parentElementIdObj = nameBoxData.get("parentElementId");
                    if (parentElementIdObj != null) {
                        try {
                            if (parentElementIdObj instanceof Number) {
                                parentId = ((Number) parentElementIdObj).longValue();
                            } else if (parentElementIdObj instanceof String) {
                                parentId = Long.parseLong((String) parentElementIdObj);
                            }
                        } catch (Exception ignored) {}
                    }
                }
                // 교실 ID와 일치하는지 확인
                if (parentId != null && parentId.equals(roomElement.getId())) {
                    nameBox = el;
                    break;
                }
            }
        }
        
        int nameBoxBottom = 0;
        if (nameBox != null) {
            // 이름박스 하단 절대 위치 + 안전 여백 (프론트엔드와 동일: +5)
            // PPT 좌표 = (원본 좌표 - bounds.minY) * scale + offsetY
            Double nameBoxYCoord = nameBox.getYCoordinate();
            Double nameBoxHeightValue = nameBox.getHeight();
            if (nameBoxYCoord != null && nameBoxHeightValue != null) {
                int nameBoxY = (int)((nameBoxYCoord - this.currentBoundsMinY) * scale + offsetY);
                int nameBoxHeight = (int)(nameBoxHeightValue * scale);
                nameBoxBottom = nameBoxY + nameBoxHeight + (int)(5 * scale);
            } else if (nameBoxYCoord != null) {
                // 높이가 없으면 기본값 40 사용
                int nameBoxY = (int)((nameBoxYCoord - this.currentBoundsMinY) * scale + offsetY);
                int nameBoxHeight = (int)(40 * scale);
                nameBoxBottom = nameBoxY + nameBoxHeight + (int)(5 * scale);
            }
        }
        
        // 카드 리스트 생성 (최대 8개) → 단일 텍스트로 변환 (프론트엔드: "TV 1, DK 6, ...")
        // LinkedHashMap의 entrySet을 사용하여 순서 보장
        java.util.List<Map.Entry<String, Integer>> cardList = new java.util.ArrayList<>(deviceCounts.entrySet());
        int maxCards = Math.min(cardList.size(), 8);
        
        StringBuilder labelBuilder = new StringBuilder();
        for (int i = 0; i < maxCards; i++) {
            Map.Entry<String, Integer> entry = cardList.get(i);
            String cate = entry.getKey();
            int count = entry.getValue();
            
            if (labelBuilder.length() > 0) {
                labelBuilder.append(", ");
            }
            labelBuilder.append(cate).append(" ").append(count);
        }
        
        if (labelBuilder.length() == 0) {
            return;
        }
        
        String label = labelBuilder.toString();
        
        // 텍스트 위치: 교실 높이의 3/5 지점 (프론트엔드와 동일)
        int roomWidth = (int)(roomElement.getWidth() * scale);
        int textY = roomY + (int)(roomH * 3.0 / 5.0);
        int textX = roomX;
        int textWidth = roomWidth;
        int textHeight = (int)(roomH / 3.0);
        
        XSLFAutoShape textShape = slide.createAutoShape();
        textShape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        textShape.setAnchor(new Rectangle(textX, textY, textWidth, textHeight));
            
        // 배경/테두리 제거 → 텍스트만 표시
        textShape.setFillColor(null);
        textShape.setLineColor(null);
        textShape.setLineWidth(0.0);
            
        // 텍스트 설정 (붉은색, 중앙 정렬, 자동 줄바꿈)
        textShape.setWordWrap(true);
        // 왼쪽/오른쪽 여백 0으로 설정 (교실 벽에 가깝게)
        textShape.setLeftInset(0.0);
        textShape.setRightInset(0.0);
        textShape.setTopInset(0.0);
        textShape.setBottomInset(0.0);
        
        XSLFTextParagraph paragraph = textShape.addNewTextParagraph();
            paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
            XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(label);
        // 장비 텍스트 폰트 크기: 프론트엔드에서 설정한 폰트 크기 사용
        // 화면: equipmentFontSize (px), 기본값 28px
        // PPT: 화면 폰트 크기를 PPT 스케일로 직접 변환 (px * scale = pt)
        double requestedPptFontSize;
        if (equipmentFontSize != null && equipmentFontSize > 0) {
            // 화면 폰트 크기(px)를 PPT 포인트로 변환: px * scale * 0.8 (0.8배 스케일 적용)
            requestedPptFontSize = equipmentFontSize * scale * 0.8;
        } else {
            // 기본값: 화면 28px를 PPT 포인트로 변환
            requestedPptFontSize = 28.0 * scale * 0.8;
        }
        
        // 교실 크기에 따라 폰트가 안 커지게 제한 (화면 로직과 동일)
        // 교실 높이의 40%를 최대 텍스트 영역으로 사용 (3/5 지점에서 시작하므로)
        double maxHeight = roomH * 0.4; // 교실 높이의 40%
        // 여백 없는 기준으로 줄바꿈: 교실 너비 전체 사용 (왼쪽/오른쪽 여백 0)
        double maxWidth = textWidth; // 여백 없이 교실 너비 전체 사용
        
        // 줄바꿈을 시뮬레이션하여 최대 폰트 크기 계산
        // 장비종류와 숫자는 분리되지 않도록 쉼표 기준으로만 분리
        double maxFontSize = requestedPptFontSize;
        String[] parts = label.split(", "); // "TV 1", "DK 6" 등으로 분리 (장비종류+숫자 세트 유지)
        double testFontSize = requestedPptFontSize;
        double testLineHeight = testFontSize * 1.2; // 줄 간격
        
        // 줄바꿈 시뮬레이션: 여백 없는 기준으로 엄격하게 계산
        // 각 장비 항목("TV 1", "DK 6" 등)은 하나의 단위로 유지되어야 함
        java.util.List<String> lines = new java.util.ArrayList<>();
        String testCurrentLine = "";
        for (String part : parts) {
            // 현재 줄에 추가할 텍스트: 비어있으면 장비 항목만, 아니면 ", " + 장비 항목
            String testText = testCurrentLine.isEmpty() ? part : testCurrentLine + ", " + part;
            double lineWidth = estimateTextWidth(testText, testFontSize);
            
            // 여백 없는 기준: 추정 오차를 최소화하기 위해 1% 여유만 허용
            // 장비종류+숫자 세트가 분리되지 않도록 각 part는 반드시 함께 유지
            if (lineWidth > maxWidth * 1.01 && !testCurrentLine.isEmpty()) {
                // 현재 줄이 꽉 찼으므로 이전 줄을 저장하고 새 줄 시작
                lines.add(testCurrentLine);
                testCurrentLine = part; // 새 줄에 현재 장비 항목 추가
            } else {
                // 현재 줄에 추가 가능
                testCurrentLine = testText;
            }
        }
        if (!testCurrentLine.isEmpty()) {
            lines.add(testCurrentLine);
        }
        
        // 총 높이 계산
        double totalHeight = lines.size() * testLineHeight;
        
        // 높이를 넘으면 폰트 크기 조정
        if (totalHeight > maxHeight) {
            double heightRatio = maxHeight / totalHeight;
            maxFontSize = Math.floor(testFontSize * heightRatio);
            maxFontSize = Math.max(3.0, maxFontSize);
        }
        
        // 각 줄의 너비도 체크하여 폰트 크기 추가 조정
        // 여백 없는 기준으로 엄격하게 체크
        for (String line : lines) {
            double lineWidth = estimateTextWidth(line, maxFontSize);
            // 여백 없는 기준: maxWidth를 초과하면 폰트 크기 조정
            if (lineWidth > maxWidth) {
                double widthRatio = maxWidth / lineWidth; // 정확히 maxWidth에 맞춤
                double adjustedSize = Math.floor(maxFontSize * widthRatio);
                maxFontSize = Math.min(maxFontSize, adjustedSize);
                maxFontSize = Math.max(3.0, maxFontSize);
                break;
            }
        }
        
        // 요청된 폰트 크기와 최대 폰트 크기 중 작은 값 사용
        double basePptFontSize = Math.min(requestedPptFontSize, maxFontSize);
        basePptFontSize = Math.max(3.0, basePptFontSize); // 최소값 보장
        
        // 폰트 크기 30% 증가
        double pptFontSize = basePptFontSize * 1.3;
        
        // 최종 폰트 크기로 줄바꿈을 다시 시뮬레이션하고 높이/너비 재검증
        // 프론트엔드와 동일하게 이진 탐색으로 최적의 폰트 크기 찾기
        double minFontSizeLimit = 3.0;
        double bestFontSize = minFontSizeLimit;
        java.util.List<String> bestLines = null;
        
        // 이진 탐색으로 최적의 폰트 크기 찾기
        double min = minFontSizeLimit;
        double max = pptFontSize;
        
        for (int iteration = 0; iteration < 20; iteration++) {
            if (min > max) break;
            
            double midFontSize = Math.floor((min + max) / 2);
            
            // 특정 폰트 크기가 교실 크기 제한 내에 맞는지 확인
            java.util.List<String> testLinesResult = new java.util.ArrayList<>();
            String currentLine = "";
            
            for (String part : parts) {
                String testText = currentLine.isEmpty() ? part : currentLine + ", " + part;
                double lineWidth = estimateTextWidth(testText, midFontSize);
                
                if (lineWidth > maxWidth * 1.01 && !currentLine.isEmpty()) {
                    testLinesResult.add(currentLine);
                    currentLine = part;
                } else {
                    currentLine = testText;
                }
            }
            if (!currentLine.isEmpty()) {
                testLinesResult.add(currentLine);
            }
            
            // 높이 체크
            double lineHeight = midFontSize * 1.2;
            double height = testLinesResult.size() * lineHeight;
            boolean fitsHeight = height <= maxHeight;
            
            // 너비 체크
            double maxWidthRatio = 1.0;
            for (String line : testLinesResult) {
                double lineWidth = estimateTextWidth(line, midFontSize);
                if (lineWidth > maxWidth) {
                    double ratio = (maxWidth - 10) / lineWidth;
                    maxWidthRatio = Math.min(maxWidthRatio, ratio);
                }
            }
            
            // 너비 제한이 있으면 조정된 크기 계산
            double adjustedSize = midFontSize;
            if (maxWidthRatio < 1.0) {
                adjustedSize = Math.floor(midFontSize * maxWidthRatio);
            }
            
            // 조정된 크기로 다시 검증 (재귀 깊이 제한: 최대 5회)
            boolean fits = fitsHeight && adjustedSize >= minFontSizeLimit;
            if (fits && maxWidthRatio < 1.0 && adjustedSize < midFontSize) {
                // 조정된 크기로 줄바꿈 다시 계산
                java.util.List<String> adjustedLines = new java.util.ArrayList<>();
                String adjCurrentLine = "";
                for (String part : parts) {
                    String testText = adjCurrentLine.isEmpty() ? part : adjCurrentLine + ", " + part;
                    double lineWidth = estimateTextWidth(testText, adjustedSize);
                    
                    if (lineWidth > maxWidth * 1.01 && !adjCurrentLine.isEmpty()) {
                        adjustedLines.add(adjCurrentLine);
                        adjCurrentLine = part;
                    } else {
                        adjCurrentLine = testText;
                    }
                }
                if (!adjCurrentLine.isEmpty()) {
                    adjustedLines.add(adjCurrentLine);
                }
                
                // 조정된 크기로 높이 재검증
                double adjLineHeight = adjustedSize * 1.2;
                double adjHeight = adjustedLines.size() * adjLineHeight;
                if (adjHeight <= maxHeight) {
                    testLinesResult = adjustedLines;
                } else {
                    fits = false;
                }
            }
            
            if (fits && adjustedSize > 0) {
                // 교실 크기 제한 내에 맞으면 더 큰 폰트 시도
                bestFontSize = adjustedSize;
                bestLines = testLinesResult;
                min = midFontSize + 1;
            } else {
                // 교실 크기 제한을 넘으면 더 작은 폰트 시도
                max = midFontSize - 1;
            }
        }
        
        // 최종 폰트 크기 결정
        pptFontSize = Math.min(pptFontSize, Math.max(minFontSizeLimit, bestFontSize));
        
        // 최종 줄바꿈 결과 사용
        java.util.List<String> finalLines = bestLines;
        if (finalLines == null || finalLines.isEmpty()) {
            // fallback: 최종 폰트 크기로 다시 계산
            finalLines = new java.util.ArrayList<>();
            String finalCurrentLine = "";
            for (String part : parts) {
                String testText = finalCurrentLine.isEmpty() ? part : finalCurrentLine + ", " + part;
                double lineWidth = estimateTextWidth(testText, pptFontSize);
                
                if (lineWidth > maxWidth * 1.01 && !finalCurrentLine.isEmpty()) {
                    finalLines.add(finalCurrentLine);
                    finalCurrentLine = part;
                } else {
                    finalCurrentLine = testText;
                }
            }
            if (!finalCurrentLine.isEmpty()) {
                finalLines.add(finalCurrentLine);
            }
        }
        
        // 줄바꿈 시뮬레이션 결과를 사용하여 수동으로 줄바꿈 적용
        // 장비종류+숫자 세트가 분리되지 않도록 각 줄을 \n으로 연결
        String formattedLabel = String.join("\n", finalLines);
        
        textRun.setText(formattedLabel);
        textRun.setFontSize(pptFontSize);
        textRun.setFontColor(new Color(0xFF0000));
            textRun.setBold(true);
        
        textShape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 장비 카테고리별 색상 반환 (프론트엔드와 동일)
     */
    private Color getDeviceColorForPPT(String cate) {
        Map<String, String> colors = Map.ofEntries(
            Map.entry("TV", "#b91c1c"),
            Map.entry("MO", "#1e40af"),
            Map.entry("DC", "#374151"),
            Map.entry("DK", "#6d28d9"),
            Map.entry("DW", "#0e7490"),
            Map.entry("ET", "#15803d"),
            Map.entry("ID", "#be185d"),
            Map.entry("PJ", "#c2410c"),
            Map.entry("PR", "#9333ea"),
            Map.entry("미분류", "#4b5563")
        );
        
        String hexColor = colors.getOrDefault(cate, "#4b5563");
        return parseColor(hexColor);
    }
    
    /**
     * element_data JSON 파싱
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseElementData(String elementData) {
        try {
            if (elementData != null && !elementData.isEmpty()) {
                return objectMapper.readValue(elementData, Map.class);
            }
        } catch (Exception e) {
            log.error("JSON 파싱 실패: {}", e.getMessage(), e);
        }
        return Map.of();
    }
    
    /**
     * 무선AP 생성 (동적 스케일 적용)
     */
    private void createWirelessApShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        Map<String, Object> elementData = parseElementData(element.getElementData());
        
        // AP 좌표는 이미 중앙 좌표로 저장되어 있음
        double centerX = element.getXCoordinate() != null ? element.getXCoordinate() : 0.0;
        double centerY = element.getYCoordinate() != null ? element.getYCoordinate() : 0.0;
        
        // 좌표 유효성 검사 및 디버깅
        if (centerX == 0.0 && centerY == 0.0) {
            log.warn("⚠️ AP 좌표가 (0,0)입니다. element ID: {}, label: {}", element.getId(), element.getLabel());
        }
        
        String shapeType = element.getShapeType();
        if (shapeType == null || shapeType.isBlank()) {
            Object shapeTypeObj = elementData.get("shapeType");
            if (shapeTypeObj != null) {
                shapeType = shapeTypeObj.toString();
            }
        }
        if (shapeType == null || shapeType.isBlank()) {
            shapeType = "circle";
        }
        
        double width = element.getWidth() != null ? element.getWidth() : extractDouble(elementData.get("width"), 40.0);
        double height = element.getHeight() != null ? element.getHeight() : extractDouble(elementData.get("height"), 40.0);
        double radius = element.getWidth() != null && element.getHeight() != null
            ? Math.min(element.getWidth(), element.getHeight()) / 2.0
            : extractDouble(elementData.get("radius"), Math.min(width, height) / 2.0);
        
        if ("circle".equalsIgnoreCase(shapeType)) {
            if (radius <= 0) {
                radius = Math.min(width, height) / 2.0;
                if (radius <= 0) {
                    radius = 20.0;
                }
            }
            
            double left = centerX - radius;
            double top = centerY - radius;
            
            int x = (int)(((left) - this.currentBoundsMinX) * scale + offsetX);
            int y = (int)(((top) - this.currentBoundsMinY) * scale + offsetY);
            int diameter = (int)(radius * 2 * scale);
            
            // 도형 크기 유효성 검사
            if (diameter <= 0) {
                log.warn("⚠️ AP 도형 크기가 0 이하입니다. radius: {}, scale: {}, diameter: {}, element: {}", 
                        radius, scale, diameter, element.getLabel());
                diameter = Math.max(1, (int)(40.0 * scale)); // 최소 크기 보장
            }
            
            Color fillColor = addWirelessApLabel(slide, element, elementData, x, y, diameter, diameter, radius * 2, scale);
            XSLFAutoShape shape = slide.createAutoShape();
            shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
            shape.setAnchor(new Rectangle(x, y, diameter, diameter));
            applyWirelessApStyle(shape, elementData, scale, fillColor);
            
            // 디버깅 로그 (처음 몇 개만)
            int debugIndex = apLabelDebugCounter.getAndIncrement();
            if (debugIndex < 5) {
                log.info("[AP 도형 생성] label: {}, centerX: {}, centerY: {}, left: {}, top: {}, x: {}, y: {}, diameter: {}, scale: {}", 
                        element.getLabel(), centerX, centerY, left, top, x, y, diameter, scale);
            }
            return;
        }
        
        if ("circle-l".equalsIgnoreCase(shapeType)) {
            // 원형 테두리 + 대문자 L (선으로 그리기)
            if (radius <= 0) {
                radius = Math.min(width, height) / 2.0;
                if (radius <= 0) {
                    radius = 20.0;
                }
            }
            
            double left = centerX - radius;
            double top = centerY - radius;
            
            int x = (int)(((left) - this.currentBoundsMinX) * scale + offsetX);
            int y = (int)(((top) - this.currentBoundsMinY) * scale + offsetY);
            int diameter = (int)(radius * 2 * scale);
            
            // 도형 크기 유효성 검사
            if (diameter <= 0) {
                log.warn("⚠️ AP circle-l 도형 크기가 0 이하입니다. radius: {}, scale: {}, diameter: {}, element: {}", 
                        radius, scale, diameter, element.getLabel());
                diameter = Math.max(1, (int)(40.0 * scale)); // 최소 크기 보장
            }
            
            // 원형 테두리만 그리기 (채우기 없음) - 굵은 선
            XSLFAutoShape circleShape = slide.createAutoShape();
            circleShape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
            circleShape.setAnchor(new Rectangle(x, y, diameter, diameter));
            
            // 테두리 색상과 두께 설정
            String borderColorStr = (String) elementData.getOrDefault("borderColor", "#000000");
            Color borderColor = parseColor(borderColorStr);
            circleShape.setFillColor(null); // 채우기 없음
            circleShape.setLineColor(borderColor);
            double borderWidth = extractDouble(elementData.get("borderWidth"), 2.0);
            circleShape.setLineWidth(Math.max(0.2, borderWidth * 2.0 * scale)); // 테두리를 2배로 굵게
            
            // 대문자 L 그리기 (선으로 그리기) - 프론트엔드와 동일하게
            String letterColorStr = (String) elementData.getOrDefault("letterColor", borderColorStr);
            Color letterColor = parseColor(letterColorStr);
            double letterSize = radius * 0.6 * scale; // L 크기 (원의 60%)
            int circleCenterX = x + diameter / 2;
            int circleCenterY = y + diameter / 2;
            
            // L의 위치 계산 (원의 중심 기준)
            // 프론트엔드: letterX = centerX - letterSize * 0.3, letterY = centerY - letterSize * 0.3
            double letterX = circleCenterX - (letterSize * 0.3);
            double letterY = circleCenterY - (letterSize * 0.3);
            
            // L을 Path2D로 그리기 (프론트엔드와 동일한 로직)
            java.awt.geom.Path2D.Double lPath = new java.awt.geom.Path2D.Double();
            // L의 세로선
            lPath.moveTo(letterX, letterY);
            lPath.lineTo(letterX, letterY + letterSize);
            // L의 가로선
            lPath.lineTo(letterX + letterSize * 0.7, letterY + letterSize);
            
            // XSLFFreeformShape로 L 그리기
            XSLFFreeformShape lShape = slide.createFreeform();
            lShape.setPath(lPath);
            lShape.setLineColor(letterColor);
            lShape.setLineWidth(Math.max(0.2, borderWidth * 2.0 * scale)); // L도 2배로 굵게
            lShape.setFillColor(null); // 채우기 없음
            
            // 라벨 추가 (circle-l일 때 letterColor 사용)
            addWirelessApLabelForCircleL(slide, element, elementData, x, y, diameter, diameter, radius * 2, scale, letterColor);
            return;
        }

        if (width <= 0) {
            width = radius > 0 ? radius * 2 : 40.0;
        }
        if (height <= 0) {
            height = radius > 0 ? radius * 2 : 40.0;
        }
        
        double left = centerX - width / 2.0;
        double top = centerY - height / 2.0;
        
        int x = (int)(((left) - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)(((top) - this.currentBoundsMinY) * scale + offsetY);
        int pptWidth = (int)(width * scale);
        int pptHeight = (int)(height * scale);
        
        // 도형 크기 유효성 검사
        if (pptWidth <= 0 || pptHeight <= 0) {
            log.warn("⚠️ AP 도형 크기가 0 이하입니다. width: {}, height: {}, scale: {}, pptWidth: {}, pptHeight: {}, element: {}", 
                    width, height, scale, pptWidth, pptHeight, element.getLabel());
            pptWidth = Math.max(1, (int)(40.0 * scale)); // 최소 크기 보장
            pptHeight = Math.max(1, (int)(40.0 * scale)); // 최소 크기 보장
        }
        
        double baseSize = Math.min(width, height);
        Color fillColor = addWirelessApLabel(slide, element, elementData, x, y, pptWidth, pptHeight, baseSize, scale);
        
        XSLFAutoShape shape = slide.createAutoShape();
        if ("triangle".equalsIgnoreCase(shapeType)) {
            shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.TRIANGLE);
        } else if ("diamond".equalsIgnoreCase(shapeType)) {
            shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.DIAMOND);
        } else {
            shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        }
        shape.setAnchor(new Rectangle(x, y, pptWidth, pptHeight));
        applyWirelessApStyle(shape, elementData, scale, fillColor);
    }

    private double extractDouble(Object value, double defaultValue) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String str) {
            try {
                return Double.parseDouble(str);
            } catch (NumberFormatException ignored) {
            }
        }
        return defaultValue;
    }

    private Color applyWirelessApStyle(XSLFAutoShape shape, Map<String, Object> elementData, double scale, Color resolvedFill) {
        Color bgColor = resolvedFill != null ? resolvedFill : parseColor((String) elementData.getOrDefault("backgroundColor", "#ef4444"));
        shape.setFillColor(bgColor);
        
        String borderColorStr = (String) elementData.getOrDefault("borderColor", "#000000");
        Color borderColor = parseColor(borderColorStr);
        shape.setLineColor(borderColor);
        
        double borderWidth = extractDouble(elementData.get("borderWidth"), 2.0);
        shape.setLineWidth(Math.max(0.2, borderWidth * scale));
        
        return bgColor;
    }

    private Color resolveWirelessApFillColor(FloorPlanElement element, Map<String, Object> elementData) {
        String bgColor = element.getBackgroundColor();
        if (bgColor == null || bgColor.isBlank()) {
            Object dataColor = elementData.get("backgroundColor");
            if (dataColor != null && !dataColor.toString().isBlank()) {
                bgColor = dataColor.toString();
            }
        }
        if (bgColor == null || bgColor.isBlank()) {
            bgColor = "#ef4444";
        }
        return parseColor(bgColor);
    }

    private Color addWirelessApLabel(
        XSLFSlide slide,
        FloorPlanElement element,
        Map<String, Object> elementData,
        int shapeX,
        int shapeY,
        int shapeWidth,
        int shapeHeight,
        double baseSize,
        double scale
    ) {
        String label = element.getLabel();
        if (label == null || label.isBlank()) {
            Object labelObj = elementData.get("label");
            if (labelObj != null) {
                label = labelObj.toString();
            }
        }
        
        if (label == null || label.isBlank()) {
            return null;
        }
        
        Color backgroundColor = resolveWirelessApFillColor(element, elementData);
        
        double fontSize = Math.min(Math.max(3.6, baseSize * scale * 0.38), shapeWidth * 0.65);
        fontSize = fontSize * 1.5; // AP 이름 크기 1.5배 증가
        double textWidth = Math.max(shapeWidth + fontSize * 0.35, fontSize * (label.length() + 1) * 0.5);
        double textHeight = Math.max(fontSize * 0.9, 4.2);
        double paddingByFont = fontSize * 0.32;
        double paddingByShape = Math.min(Math.max(shapeHeight * 0.08, 0.6), shapeHeight * 0.3);
        double textPadding = Math.min(Math.max(0.35, (paddingByFont * 0.6) + (paddingByShape * 0.35)), 8.0);
        double textBoxX = shapeX + (shapeWidth / 2.0) - (textWidth / 2.0);
        if (textBoxX < 0) {
            textBoxX = 0;
        }
        double verticalAdjust = Math.max(0.3, fontSize * 0.08); // 상자를 살짝 위로 이동
        double textY = shapeY + shapeHeight + textPadding - verticalAdjust;
        if (textY < 0) {
            textY = 0;
        }
        
        XSLFTextBox labelBox = slide.createTextBox();
        Rectangle2D.Double initialAnchor = new Rectangle2D.Double(
            textBoxX,
            textY,
            textWidth,
            textHeight
        );
        labelBox.setAnchor(initialAnchor);
        labelBox.setLineColor(null);
        labelBox.setFillColor(null);
        labelBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.BOTTOM);
        labelBox.setLeftInset(0.0);
        labelBox.setRightInset(0.0);
        labelBox.setTopInset(0.0);
        labelBox.setBottomInset(0.0);
        labelBox.setWordWrap(false);
        
        XSLFTextParagraph paragraph = labelBox.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        paragraph.setLineSpacing(0.0);
        paragraph.setSpaceBefore(0.0);
        paragraph.setSpaceAfter(0.0);
        paragraph.setIndent(0.0);
        paragraph.setLeftMargin(0.0);
        paragraph.setRightMargin(0.0);
        paragraph.setFontAlign(org.apache.poi.sl.usermodel.TextParagraph.FontAlign.CENTER);
        
        XSLFTextRun run = paragraph.addNewTextRun();
        run.setText(label);
        run.setBold(true);
        run.setFontSize(fontSize);
        run.setFontColor(backgroundColor != null ? backgroundColor : Color.BLACK);
        run.setBaselineOffset(0.0);
        run.setFontFamily("Malgun Gothic");
        
        double adjustedWidth = Math.max(textWidth, fontSize * (label.length() + 2) * 0.5);
        double adjustedHeight = Math.max(textHeight, fontSize * 0.95);
        double finalX = shapeX + (shapeWidth / 2.0) - (adjustedWidth / 2.0);
        if (finalX < 0) {
            finalX = 0;
        }
        double finalY = shapeY + shapeHeight + textPadding - verticalAdjust;
        if (finalY < 0) {
            finalY = 0;
        }
        Rectangle2D finalAnchor = new Rectangle2D.Double(finalX, finalY, adjustedWidth, adjustedHeight);
        labelBox.setAnchor(finalAnchor);
        labelBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.BOTTOM);
        if (!labelBox.getTextParagraphs().isEmpty()) {
            labelBox.getTextParagraphs().get(0).setBullet(false);
        }
        
        int debugIndex = apLabelDebugCounter.getAndIncrement();
        if (debugIndex < 8) {
            System.out.printf("[AP 라벨 디버그] label=%s, fontSize=%.3f, textWidth=%.3f, textHeight=%.3f, adjustedWidth=%.3f, adjustedHeight=%.3f, finalX=%.3f, finalY=%.3f%n",
                label, fontSize, textWidth, textHeight, adjustedWidth, adjustedHeight, finalX, finalY);
            System.out.printf("[AP 라벨 디버그] paragraph lineSpacing=%.3f, align=%s, vertical=%s%n",
                paragraph.getLineSpacing(), paragraph.getTextAlign(), labelBox.getVerticalAlignment());
        }
        
        return backgroundColor;
    }
    
    /**
     * circle-l 모양의 AP 라벨 추가 (letterColor 사용)
     */
    private void addWirelessApLabelForCircleL(
        XSLFSlide slide,
        FloorPlanElement element,
        Map<String, Object> elementData,
        int shapeX,
        int shapeY,
        int shapeWidth,
        int shapeHeight,
        double baseSize,
        double scale,
        Color letterColor
    ) {
        String label = element.getLabel();
        if (label == null || label.isBlank()) {
            Object labelObj = elementData.get("label");
            if (labelObj != null) {
                label = labelObj.toString();
            }
        }
        
        if (label == null || label.isBlank()) {
            return;
        }
        
        double fontSize = Math.min(Math.max(3.6, baseSize * scale * 0.38), shapeWidth * 0.65);
        fontSize = fontSize * 1.5; // AP 이름 크기 1.5배 증가
        double textWidth = Math.max(shapeWidth + fontSize * 0.35, fontSize * (label.length() + 1) * 0.5);
        double textHeight = Math.max(fontSize * 0.9, 4.2);
        double paddingByFont = fontSize * 0.32;
        double paddingByShape = Math.min(Math.max(shapeHeight * 0.08, 0.6), shapeHeight * 0.3);
        double textPadding = Math.min(Math.max(0.35, (paddingByFont * 0.6) + (paddingByShape * 0.35)), 8.0);
        double textBoxX = shapeX + (shapeWidth / 2.0) - (textWidth / 2.0);
        if (textBoxX < 0) {
            textBoxX = 0;
        }
        double verticalAdjust = Math.max(0.3, fontSize * 0.08);
        double textY = shapeY + shapeHeight + textPadding - verticalAdjust;
        if (textY < 0) {
            textY = 0;
        }
        
        XSLFTextBox labelBox = slide.createTextBox();
        Rectangle2D.Double initialAnchor = new Rectangle2D.Double(
            textBoxX,
            textY,
            textWidth,
            textHeight
        );
        labelBox.setAnchor(initialAnchor);
        labelBox.setLineColor(null);
        labelBox.setFillColor(null);
        labelBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.BOTTOM);
        labelBox.setLeftInset(0.0);
        labelBox.setRightInset(0.0);
        labelBox.setTopInset(0.0);
        labelBox.setBottomInset(0.0);
        labelBox.setWordWrap(false);
        
        XSLFTextParagraph paragraph = labelBox.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        paragraph.setLineSpacing(0.0);
        paragraph.setSpaceBefore(0.0);
        paragraph.setSpaceAfter(0.0);
        paragraph.setIndent(0.0);
        paragraph.setLeftMargin(0.0);
        paragraph.setRightMargin(0.0);
        paragraph.setFontAlign(org.apache.poi.sl.usermodel.TextParagraph.FontAlign.CENTER);
        
        XSLFTextRun run = paragraph.addNewTextRun();
        run.setText(label);
        run.setBold(true);
        run.setFontSize(fontSize);
        run.setFontColor(letterColor != null ? letterColor : Color.BLACK); // letterColor 사용
        run.setBaselineOffset(0.0);
        run.setFontFamily("Malgun Gothic");
        
        double adjustedWidth = Math.max(textWidth, fontSize * (label.length() + 2) * 0.5);
        double adjustedHeight = Math.max(textHeight, fontSize * 0.95);
        double finalX = shapeX + (shapeWidth / 2.0) - (adjustedWidth / 2.0);
        if (finalX < 0) {
            finalX = 0;
        }
        double finalY = shapeY + shapeHeight + textPadding - verticalAdjust;
        if (finalY < 0) {
            finalY = 0;
        }
        Rectangle2D finalAnchor = new Rectangle2D.Double(finalX, finalY, adjustedWidth, adjustedHeight);
        labelBox.setAnchor(finalAnchor);
        labelBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.BOTTOM);
        if (!labelBox.getTextParagraphs().isEmpty()) {
            labelBox.getTextParagraphs().get(0).setBullet(false);
        }
    }

    private FloorPlanElement cloneWirelessApElement(FloorPlanElement source) {
        FloorPlanElement clone = new FloorPlanElement();
        clone.setFloorPlanId(source.getFloorPlanId());
        clone.setElementType("wireless_ap");
        clone.setReferenceId(source.getReferenceId());
        clone.setXCoordinate(source.getXCoordinate());
        clone.setYCoordinate(source.getYCoordinate());
        clone.setWidth(source.getWidth());
        clone.setHeight(source.getHeight());
        clone.setRotation(source.getRotation());
        clone.setBackgroundColor(source.getBackgroundColor());
        clone.setBorderColor(source.getBorderColor());
        clone.setBorderWidth(source.getBorderWidth());
        clone.setLabel(source.getLabel());
        clone.setShapeType(source.getShapeType());
        clone.setElementData(source.getElementData());
        clone.setShowLabel(source.getShowLabel());
        clone.setPageNumber(source.getPageNumber()); // 페이지 번호 복사 (중요!)
        return clone;
    }

    private FloorPlanElement createVirtualWirelessApElement(
        FloorPlan floorPlan,
        Map<Long, FloorPlanElement> roomMap,
        Map<String, Object> apInfo
    ) {
        FloorPlanElement virtualAp = new FloorPlanElement();
        virtualAp.setFloorPlanId(floorPlan.getId());
        virtualAp.setElementType("wireless_ap");
        virtualAp.setShapeType("circle");

        Long classroomId = toLong(apInfo.get("classroomId"));
        double centerX = 0.0;
        double centerY = 0.0;
        if (classroomId != null) {
            FloorPlanElement roomElement = roomMap.get(classroomId);
            if (roomElement != null) {
                double roomX = roomElement.getXCoordinate() != null ? roomElement.getXCoordinate() : 0.0;
                double roomY = roomElement.getYCoordinate() != null ? roomElement.getYCoordinate() : 0.0;
                double roomWidth = roomElement.getWidth() != null ? roomElement.getWidth() : 0.0;
                double roomHeight = roomElement.getHeight() != null ? roomElement.getHeight() : 0.0;
                centerX = roomX + roomWidth / 2.0;
                centerY = roomY + roomHeight / 2.0 + 30.0;
            }
        }

        virtualAp.setXCoordinate(centerX);
        virtualAp.setYCoordinate(centerY);
        virtualAp.setWidth(40.0);
        virtualAp.setHeight(40.0);
        virtualAp.setBackgroundColor("#ef4444");
        virtualAp.setBorderColor("#000000");
        virtualAp.setBorderWidth(2.0);
        String newLabel = Objects.toString(apInfo.get("newLabelNumber"), "");
        virtualAp.setLabel(newLabel);
        virtualAp.setShowLabel(true);

        ensureWirelessApElementData(virtualAp);
        return virtualAp;
    }

    private void ensureWirelessApElementData(FloorPlanElement element) {
        Map<String, Object> data = new HashMap<>(parseElementData(element.getElementData()));

        double defaultWidth = element.getWidth() != null ? element.getWidth() : extractDouble(data.get("width"), 40.0);
        double defaultHeight = element.getHeight() != null ? element.getHeight() : extractDouble(data.get("height"), 40.0);
        element.setWidth(defaultWidth);
        element.setHeight(defaultHeight);

        String shape = element.getShapeType();
        if (shape == null || shape.isBlank()) {
            Object shapeFromData = data.get("shapeType");
            shape = shapeFromData != null ? shapeFromData.toString() : "circle";
            element.setShapeType(shape);
        }

        data.put("backgroundColor", element.getBackgroundColor() != null ? element.getBackgroundColor() : "#ef4444");
        data.put("borderColor", element.getBorderColor() != null ? element.getBorderColor() : "#000000");
        data.put("borderWidth", element.getBorderWidth() != null ? element.getBorderWidth() : 2.0);
        if (element.getLabel() != null) {
            data.put("label", element.getLabel());
        }
        data.put("shapeType", shape);
        data.put("width", element.getWidth());
        data.put("height", element.getHeight());
        if ("circle".equalsIgnoreCase(shape)) {
            double radius = Math.min(element.getWidth(), element.getHeight()) / 2.0;
            if (radius <= 0) {
                radius = 20.0;
            }
            data.put("radius", radius);
        }

        try {
            element.setElementData(objectMapper.writeValueAsString(data));
        } catch (Exception e) {
            log.error("무선AP elementData 직렬화 실패: {}", e.getMessage(), e);
            element.setElementData(null);
        }
    }

    private void normalizeWirelessApDefaults(FloorPlanElement element) {
        Map<String, Object> elementData = parseElementData(element.getElementData());

        if (element.getElementType() == null || element.getElementType().isBlank()) {
            element.setElementType("wireless_ap");
        }

        if (element.getShapeType() == null || element.getShapeType().isBlank()) {
            Object shapeData = elementData.get("shapeType");
            if (shapeData != null && !shapeData.toString().isBlank()) {
                element.setShapeType(shapeData.toString());
            } else {
                element.setShapeType("circle");
            }
        }

        if (element.getBackgroundColor() == null || element.getBackgroundColor().isBlank()) {
            element.setBackgroundColor("#ef4444");
        }

        if (element.getBorderColor() == null || element.getBorderColor().isBlank()) {
            element.setBorderColor("#000000");
        }

        if (element.getBorderWidth() == null) {
            element.setBorderWidth(2.0);
        }

        if (element.getShowLabel() == null) {
            element.setShowLabel(true);
        }

        if (element.getLabel() == null) {
            element.setLabel("");
        }

        Double width = element.getWidth();
        if (width == null && elementData.containsKey("width")) {
            width = extractDouble(elementData.get("width"), 0.0);
        }
        Double height = element.getHeight();
        if (height == null && elementData.containsKey("height")) {
            height = extractDouble(elementData.get("height"), 0.0);
        }
        if (width == null || width <= 0) {
            width = 40.0;
        }
        if (height == null || height <= 0) {
            height = 40.0;
        }

        if ("circle".equalsIgnoreCase(element.getShapeType())) {
            double size = Math.max(1.0, Math.min(width, height));
            element.setWidth(size);
            element.setHeight(size);
        } else {
            element.setWidth(width);
            element.setHeight(height);
        }

        if (element.getXCoordinate() == null) {
            element.setXCoordinate(0.0);
        }
        if (element.getYCoordinate() == null) {
            element.setYCoordinate(0.0);
        }
    }

    private Long extractWirelessApId(
        FloorPlanElement element,
        Map<String, Object> elementData,
        Map<String, Long> labelToApId
    ) {
        if (element.getReferenceId() != null) {
            return element.getReferenceId();
        }

        String[] candidateKeys = {"wirelessApId", "apId", "referenceId", "id"};
        for (String key : candidateKeys) {
            if (elementData.containsKey(key)) {
                Long id = toLong(elementData.get(key));
                if (id != null) {
                    return id;
                }
            }
        }

        if (elementData.containsKey("wirelessAp")) {
            Object nested = elementData.get("wirelessAp");
            if (nested instanceof Map<?, ?> nestedMap) {
                Object nestedId = ((Map<?, ?>) nestedMap).get("apId");
                Long id = toLong(nestedId);
                if (id != null) {
                    return id;
                }
            }
        }

        String label = element.getLabel();
        if (label == null && elementData.containsKey("label")) {
            label = Objects.toString(elementData.get("label"), null);
        }
        if (label != null && !label.isBlank()) {
            return labelToApId.get(normalizeLabel(label));
        }

        return null;
    }

    private String normalizeLabel(String label) {
        return label == null ? "" : label.trim().toUpperCase();
    }
    
    /**
     * MDF(IDF) 생성 (동적 스케일 적용) - 사각형
     */
    private void createMdfIdfShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)((element.getXCoordinate() - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)((element.getYCoordinate() - this.currentBoundsMinY) * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        Map<String, Object> elementData = parseElementData(element.getElementData());
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 배경색 (빨간색 기본값)
        String bgColorStr = (String) elementData.getOrDefault("backgroundColor", "#ef4444");
        Color bgColor = parseColor(bgColorStr);
        shape.setFillColor(bgColor);
        
        // 테두리 색 (검은색 기본값)
        String borderColorStr = (String) elementData.getOrDefault("borderColor", "#000000");
        Color borderColor = parseColor(borderColorStr);
        shape.setLineColor(borderColor);
        
        // 테두리 두께
        double borderWidth = 2.0;
        if (elementData.containsKey("borderWidth")) {
            Object borderWidthObj = elementData.get("borderWidth");
            if (borderWidthObj instanceof Number) {
                borderWidth = ((Number) borderWidthObj).doubleValue();
            }
        }
        shape.setLineWidth(Math.max(0.2, borderWidth * scale));
    }
    
    private Color parseColor(String hexColor) {
        try {
            if (hexColor.startsWith("#")) {
                hexColor = hexColor.substring(1);
            }
            int rgb = Integer.parseInt(hexColor, 16);
            return new Color(rgb);
        } catch (Exception e) {
            return Color.BLACK;
        }
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            String text = value.toString();
            if (text == null || text.isBlank()) {
                return null;
            }
            return Long.parseLong(text);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
    
    /**
     * PPT 슬라이드에 범례 추가
     */
    private void addLegendToSlide(XSLFSlide slide, School school, String mode, 
                                   Map<Long, List<Map<String, Object>>> devicesByClassroom, 
                                   double startY) {
        try {
            double legendX = 20.0; // 좌측 여백
            double legendY = startY;
            double fontSize = 10.0;
            double boxPadding = 10.0; // 박스 내부 여백
            double boxHeight = 35.0; // 박스 높이
            // A4 가로 크기(595pt)에서 좌우 여백(각 20pt)을 뺀 범례 너비
            double legendWidth = PPT_WIDTH - legendX * 2; // 595 - 20 - 20 = 555
            
            // 직사각형 테두리 박스 생성
            XSLFAutoShape legendBox = slide.createAutoShape();
            legendBox.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
            legendBox.setAnchor(new Rectangle((int)legendX, (int)legendY, (int)legendWidth, (int)boxHeight));
            legendBox.setFillColor(Color.WHITE);
            legendBox.setLineColor(Color.BLACK);
            legendBox.setLineWidth(1.0);
            
            if ("equipment".equals(mode)) {
                // 장비 범례: 텍스트만 표시
                List<String> legendItems = buildEquipmentLegendItems(devicesByClassroom);
                if (legendItems.isEmpty()) {
                    return;
                }
                
                // 범례 텍스트 추가
                XSLFTextBox textBox = slide.createTextBox();
                textBox.setAnchor(new Rectangle((int)(legendX + boxPadding), (int)(legendY + boxPadding), 
                                                (int)(legendWidth - boxPadding * 2), (int)(boxHeight - boxPadding * 2)));
                textBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
                textBox.setLeftInset(0.0);
                textBox.setRightInset(0.0);
                textBox.setTopInset(0.0);
                textBox.setBottomInset(0.0);
                
                XSLFTextParagraph para = textBox.addNewTextParagraph();
                para.setLeftMargin(0.0);
                para.setRightMargin(0.0);
                para.setSpaceAfter(0.0);
                para.setSpaceBefore(0.0);
                para.setLineSpacing(0.0);
                para.setIndent(0.0);
                
                // "범례 : " 부분
                XSLFTextRun titleRun = para.addNewTextRun();
                titleRun.setText("범례 : ");
                titleRun.setFontSize(fontSize);
                titleRun.setBold(true);
                titleRun.setFontColor(Color.BLACK);
                
                // 범례 항목들 추가
                for (int i = 0; i < legendItems.size(); i++) {
                    String item = legendItems.get(i);
                    String[] parts = item.split(" - ", 2);
                    if (parts.length == 2) {
                        // 약어 부분 (빨간색)
                        XSLFTextRun abbrevRun = para.addNewTextRun();
                        abbrevRun.setText(parts[0] + " - ");
                        abbrevRun.setFontSize(fontSize);
                        abbrevRun.setFontColor(new Color(255, 0, 0));
                        
                        // 이름 부분 (검은색)
                        XSLFTextRun nameRun = para.addNewTextRun();
                        nameRun.setText(parts[1]);
                        nameRun.setFontSize(fontSize);
                        nameRun.setFontColor(Color.BLACK);
                    }
                    
                    if (i < legendItems.size() - 1) {
                        XSLFTextRun spaceRun = para.addNewTextRun();
                        spaceRun.setText(" ");
                    }
                }
            } else if ("wireless-ap".equals(mode)) {
                // AP 범례: 도형과 텍스트 함께 표시
                addApLegendWithShapes(slide, legendX, legendY, boxPadding, boxHeight, fontSize);
            }
        } catch (Exception e) {
            log.error("범례 추가 중 오류: {}", e.getMessage(), e);
        }
    }
    
    /**
     * 장비 범례 항목 리스트 생성
     */
    private List<String> buildEquipmentLegendItems(Map<Long, List<Map<String, Object>>> devicesByClassroom) {
        List<String> legendItems = new ArrayList<>();
        
        if (devicesByClassroom == null || devicesByClassroom.isEmpty()) {
            return legendItems;
        }
        
        // 모든 장비의 cate 수집
        Set<String> cateSet = new HashSet<>();
        for (List<Map<String, Object>> devices : devicesByClassroom.values()) {
            for (Map<String, Object> device : devices) {
                Object uidCateObj = device.get("uidCate");
                if (uidCateObj != null) {
                    cateSet.add(uidCateObj.toString());
                }
            }
        }
        
        if (cateSet.isEmpty()) {
            return legendItems;
        }
        
        // cate를 장비 종류로 그룹화
        Map<String, List<String>> typeGroups = new HashMap<>();
        for (String cate : cateSet) {
            String type = getDeviceTypeByCate(cate);
            typeGroups.computeIfAbsent(type, k -> new ArrayList<>()).add(cate);
        }
        
        // 정렬된 항목 리스트 생성
        List<String> sortedTypes = new ArrayList<>(typeGroups.keySet());
        sortedTypes.sort(String::compareTo);
        
        for (String type : sortedTypes) {
            List<String> cates = typeGroups.get(type);
            cates.sort(String::compareTo);
            String cateStr = cates.size() > 1 ? String.join(", ", cates) : cates.get(0);
            legendItems.add(cateStr + " - " + type);
        }
        
        return legendItems;
    }
    
    /**
     * AP 범례 항목 리스트 생성 (고정)
     */
    private List<String> buildApLegendItems() {
        List<String> items = new ArrayList<>();
        items.add("MDF - MDF");
        items.add("IDF# - IDF#");
        items.add("도교육청AP# - 도교육청AP#");
        items.add("4차,3차 - 4차,3차");
        items.add("학교구입 - 학교구입");
        return items;
    }
    
    /**
     * AP 범례를 도형과 텍스트로 함께 추가 (가로 나열)
     */
    private void addApLegendWithShapes(XSLFSlide slide, double boxX, double boxY, 
                                       double boxPadding, double boxHeight, double fontSize) {
        List<LegendItem> items = new ArrayList<>();
        items.add(new LegendItem("rectangle", new Color(239, 68, 68), "MDF"));
        items.add(new LegendItem("rectangle", Color.BLACK, "IDF#"));
        items.add(new LegendItem("circle", Color.BLACK, "도교육청AP#"));
        items.add(new LegendItem("triangle", Color.BLACK, "4차,3차"));
        items.add(new LegendItem("diamond", Color.BLACK, "학교구입"));
        items.add(new LegendItem("circle-l", Color.BLACK, "라인"));
        
        double startX = boxX + boxPadding + 50; // "범례 : " 공간 확보
        double currentX = startX;
        double centerY = boxY + boxHeight / 2.0; // 박스 중앙 Y 좌표
        double shapeSize = 12.0;
        double rectangleWidth = 8.0;  // 세로가 긴 직사각형: 가로
        double rectangleHeight = 18.0; // 세로가 긴 직사각형: 세로
        double itemSpacing = 8.0; // 항목 간 간격
        
        // "범례 : " 텍스트 추가
        XSLFTextBox titleBox = slide.createTextBox();
        titleBox.setAnchor(new Rectangle((int)(boxX + boxPadding), (int)(boxY + boxPadding), 
                                        50, (int)(boxHeight - boxPadding * 2)));
        titleBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
        titleBox.setLeftInset(0.0);
        titleBox.setRightInset(0.0);
        titleBox.setTopInset(0.0);
        titleBox.setBottomInset(0.0);
        XSLFTextParagraph titlePara = titleBox.addNewTextParagraph();
        XSLFTextRun titleRun = titlePara.addNewTextRun();
        titleRun.setText("범례 : ");
        titleRun.setFontSize(fontSize);
        titleRun.setBold(true);
        titleRun.setFontColor(Color.BLACK);
        
        for (LegendItem item : items) {
            double shapeY = centerY - rectangleHeight / 2.0; // 도형을 중앙에 맞춤
            double shapeWidth;
            double shapeHeight;
            
            // 도형 그리기
            XSLFAutoShape shape = slide.createAutoShape();
            
            if ("rectangle".equals(item.shape)) {
                // MDF, IDF: 세로가 긴 직사각형
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
                shapeWidth = rectangleWidth;
                shapeHeight = rectangleHeight;
                shapeY = centerY - rectangleHeight / 2.0;
            } else if ("circle".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                shapeY = centerY - shapeSize / 2.0;
            } else if ("triangle".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.TRIANGLE);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                shapeY = centerY - shapeSize / 2.0;
            } else if ("diamond".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.DIAMOND);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                shapeY = centerY - shapeSize / 2.0;
            } else if ("circle-l".equals(item.shape)) {
                // 원형L: 원형 테두리와 L 문자
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                shapeY = centerY - shapeSize / 2.0;
            } else {
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                shapeY = centerY - shapeSize / 2.0;
            }
            
            shape.setAnchor(new Rectangle((int)currentX, (int)shapeY, (int)shapeWidth, (int)shapeHeight));
            
            // circle-l은 투명 배경과 테두리만
            if ("circle-l".equals(item.shape)) {
                shape.setFillColor(null); // 투명
                shape.setLineColor(item.color);
                shape.setLineWidth(2.0);
                
                // L을 선으로 그리기 (프론트엔드와 동일하게)
                double letterSize = shapeSize * 0.36; // L 크기 (원의 36%, 40% 감소: 0.6 * 0.6)
                double letterX = currentX + shapeSize / 2.0 - (letterSize * 0.3);
                double letterY = centerY - (letterSize * 0.7); // 위치를 더 위로 올림 (0.5 → 0.7)
                
                // L을 Path2D로 그리기
                java.awt.geom.Path2D.Double lPath = new java.awt.geom.Path2D.Double();
                // L의 세로선
                lPath.moveTo(letterX, letterY);
                lPath.lineTo(letterX, letterY + letterSize);
                // L의 가로선
                lPath.lineTo(letterX + letterSize * 0.7, letterY + letterSize);
                
                // XSLFFreeformShape로 L 그리기
                XSLFFreeformShape lShape = slide.createFreeform();
                lShape.setPath(lPath);
                lShape.setLineColor(item.color);
                lShape.setLineWidth(2.0); // 범례에서는 고정 두께
                lShape.setFillColor(null); // 채우기 없음
            } else {
                shape.setFillColor(item.color);
                shape.setLineColor(Color.BLACK);
                shape.setLineWidth(0.5);
            }
            
            // 라벨 추가 (도형 옆에)
            double labelX = currentX + shapeWidth + 3;
            double labelY = centerY - fontSize / 2.0;
            
            XSLFTextBox labelBox = slide.createTextBox();
            labelBox.setAnchor(new Rectangle((int)labelX, (int)labelY, 150, (int)fontSize + 2));
            labelBox.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
            labelBox.setLeftInset(0.0);
            labelBox.setRightInset(0.0);
            labelBox.setTopInset(0.0);
            labelBox.setBottomInset(0.0);
            
            XSLFTextParagraph labelPara = labelBox.addNewTextParagraph();
            labelPara.setLeftMargin(0.0);
            labelPara.setRightMargin(0.0);
            labelPara.setSpaceAfter(0.0);
            labelPara.setSpaceBefore(0.0);
            labelPara.setLineSpacing(0.0);
            
            XSLFTextRun labelRun = labelPara.addNewTextRun();
            labelRun.setText("- " + item.label);
            labelRun.setFontSize(fontSize);
            labelRun.setFontColor(Color.BLACK);
            
            // 다음 항목 위치 계산 (도형 너비 + 라벨 너비 + 간격)
            double labelWidth = estimateTextWidth(item.label, fontSize) + 10; // "- " 포함
            currentX += shapeWidth + labelWidth + itemSpacing;
        }
    }
    
    /**
     * 텍스트 너비 추정 (대략적인 값)
     * 줄바꿈을 더 빡빡하게 하기 위해 실제보다 약간 작게 계산 (추정 오차 보정)
     */
    private double estimateTextWidth(String text, double fontSize) {
        // 여백 없는 기준으로 더 정확하게 계산
        // 한글은 폰트 크기의 0.9배, 영문/숫자는 0.55배, 공백/쉼표는 0.3배
        // 추정 오차를 줄이기 위해 실제 값에 더 가깝게 계산
        double width = 0;
        for (char c : text.toCharArray()) {
            if (c >= 0xAC00 && c <= 0xD7A3) { // 한글
                width += fontSize * 0.9; // 한글은 실제보다 약간 크게 계산
            } else if (c == ' ' || c == ',') { // 공백, 쉼표
                width += fontSize * 0.3; // 공백/쉼표는 실제보다 약간 크게 계산
            } else { // 영문, 숫자, 기호
                width += fontSize * 0.55; // 영문/숫자는 실제보다 약간 크게 계산
            }
        }
        return width;
    }
    
    /**
     * 장비 보기 범례 추가
     */
    private void addEquipmentLegend(XSLFSlide slide, School school, 
                                    Map<Long, List<Map<String, Object>>> devicesByClassroom,
                                    double startX, double startY, double itemSpacing, double fontSize) {
        if (devicesByClassroom == null || devicesByClassroom.isEmpty()) {
            return;
        }
        
        // 모든 장비의 cate 수집
        Set<String> cateSet = new HashSet<>();
        for (List<Map<String, Object>> devices : devicesByClassroom.values()) {
            for (Map<String, Object> device : devices) {
                Object uidCateObj = device.get("uidCate");
                if (uidCateObj != null) {
                    cateSet.add(uidCateObj.toString());
                }
            }
        }
        
        if (cateSet.isEmpty()) {
            return;
        }
        
        // cate를 장비 종류로 그룹화
        Map<String, List<String>> typeGroups = new HashMap<>();
        for (String cate : cateSet) {
            String type = getDeviceTypeByCate(cate);
            typeGroups.computeIfAbsent(type, k -> new ArrayList<>()).add(cate);
        }
        
        double currentY = startY;
        double currentX = startX;
        double maxWidth = 680.0;
        double itemWidth = maxWidth / 2; // 2열로 배치
        
        List<String> sortedTypes = new ArrayList<>(typeGroups.keySet());
        sortedTypes.sort(String::compareTo);
        
        int col = 0;
        for (String type : sortedTypes) {
            List<String> cates = typeGroups.get(type);
            cates.sort(String::compareTo);
            String cateStr = cates.size() > 1 ? String.join(", ", cates) : cates.get(0);
            String label = cateStr + " - " + type;
            
            double x = currentX + (col * itemWidth);
            
            XSLFTextBox itemBox = slide.createTextBox();
            itemBox.setAnchor(new Rectangle((int)x, (int)currentY, (int)(itemWidth - 10), 20));
            XSLFTextParagraph itemPara = itemBox.addNewTextParagraph();
            XSLFTextRun itemRun = itemPara.addNewTextRun();
            itemRun.setText(label);
            itemRun.setFontSize(fontSize);
            itemRun.setFontColor(Color.BLACK);
            
            col++;
            if (col >= 2) {
                col = 0;
                currentY += itemSpacing;
            }
        }
    }
    
    /**
     * AP 보기 범례 추가 (고정)
     */
    private void addApLegend(XSLFSlide slide, double startX, double startY, 
                            double itemSpacing, double fontSize) {
        List<LegendItem> items = new ArrayList<>();
        items.add(new LegendItem("rectangle", new Color(239, 68, 68), "MDF"));
        items.add(new LegendItem("rectangle", Color.BLACK, "IDF#"));
        items.add(new LegendItem("circle", Color.BLACK, "도교육청AP#"));
        items.add(new LegendItem("triangle", Color.BLACK, "4차,3차"));
        items.add(new LegendItem("diamond", Color.BLACK, "학교구입"));
        
        double currentY = startY;
        double shapeSize = 12.0;
        double rectangleWidth = 8.0;  // 세로가 긴 직사각형: 가로
        double rectangleHeight = 18.0; // 세로가 긴 직사각형: 세로
        
        for (LegendItem item : items) {
            // 도형 그리기
            XSLFAutoShape shape = slide.createAutoShape();
            double shapeX = startX;
            double shapeY = currentY + 4;
            double shapeWidth;
            double shapeHeight;
            double labelX;
            
            if ("rectangle".equals(item.shape)) {
                // MDF, IDF: 세로가 긴 직사각형
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
                shapeWidth = rectangleWidth;
                shapeHeight = rectangleHeight;
                labelX = startX + rectangleWidth + 5;
            } else if ("square".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                labelX = startX + shapeSize + 5;
            } else if ("circle".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                labelX = startX + shapeSize + 5;
            } else if ("triangle".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.TRIANGLE);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                labelX = startX + shapeSize + 5;
            } else if ("diamond".equals(item.shape)) {
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.DIAMOND);
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                labelX = startX + shapeSize + 5;
            } else {
                // 기본값
                shapeWidth = shapeSize;
                shapeHeight = shapeSize;
                labelX = startX + shapeSize + 5;
            }
            
            shape.setAnchor(new Rectangle((int)shapeX, (int)shapeY, (int)shapeWidth, (int)shapeHeight));
            shape.setFillColor(item.color);
            shape.setLineColor(Color.BLACK);
            shape.setLineWidth(0.5);
            
            // 라벨 추가
            XSLFTextBox labelBox = slide.createTextBox();
            labelBox.setAnchor(new Rectangle((int)labelX, (int)currentY, 200, 20));
            XSLFTextParagraph labelPara = labelBox.addNewTextParagraph();
            XSLFTextRun labelRun = labelPara.addNewTextRun();
            labelRun.setText("- " + item.label);
            labelRun.setFontSize(fontSize);
            labelRun.setFontColor(Color.BLACK);
            
            currentY += itemSpacing;
        }
    }
    
    /**
     * cate를 장비 종류로 매핑
     */
    private String getDeviceTypeByCate(String cate) {
        if (cate == null) return "기타";
        
        // 데스크톱 관련
        if (cate.equals("DW") || cate.equals("DE") || cate.equals("DK") || 
            cate.equals("DC") || cate.equals("DS") || cate.equals("DD") || 
            cate.equals("DT")) {
            return "데스크톱";
        }
        
        switch (cate) {
            case "MO": return "모니터";
            case "PR": return "프린터";
            case "TV": return "TV";
            case "ID": return "전자칠판";
            case "ED": return "전자교탁";
            case "DI": return "DID";
            case "TB": return "태블릿";
            case "PJ": return "프로젝터";
            default: return "기타";
        }
    }
    
    /**
     * 범례 항목 클래스
     */
    private static class LegendItem {
        String shape;
        Color color;
        String label;
        
        LegendItem(String shape, Color color, String label) {
            this.shape = shape;
            this.color = color;
            this.label = label;
        }
    }
}

