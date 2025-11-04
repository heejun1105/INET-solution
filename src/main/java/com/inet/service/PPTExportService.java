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
import java.util.List;
import java.util.Map;

@Service
public class PPTExportService {
    
    @Autowired
    private FloorPlanRepository floorPlanRepository;
    
    @Autowired
    private FloorPlanElementRepository floorPlanElementRepository;
    
    @Autowired
    private SchoolRepository schoolRepository;
    
    @Autowired
    private FloorPlanService floorPlanService;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // 현재 바운딩 박스 최소값 (좌표 변환 시 사용)
    private double currentBoundsMinX = 0.0;
    private double currentBoundsMinY = 0.0;
    
    // 좌표 변환 상수 (FloorPlanCore.js와 동일하게 설정)
    private static final double CANVAS_WIDTH = 16000.0;  // 캔버스 기본 너비
    private static final double CANVAS_HEIGHT = 12000.0; // 캔버스 기본 높이
    private static final double PPT_WIDTH = 720.0;  // 10인치 * 72 포인트
    private static final double PPT_HEIGHT = 540.0; // 7.5인치 * 72 포인트
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
    public ByteArrayOutputStream exportFloorPlanToPPT(Long schoolId, String mode) throws IOException {
        try {
            System.out.println("PPT 내보내기 시작 - schoolId: " + schoolId + ", mode: " + mode);
            
            // 학교 정보 조회
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new RuntimeException("학교를 찾을 수 없습니다: " + schoolId));
            System.out.println("학교 정보 조회 완료: " + school.getSchoolName());
            
            // 활성 평면도 조회
            List<FloorPlan> activeFloorPlans = floorPlanRepository.findAllBySchoolIdAndIsActive(schoolId, true);
            System.out.println("활성 평면도 개수: " + activeFloorPlans.size());
            
            if (activeFloorPlans.isEmpty()) {
                throw new RuntimeException("저장된 평면도가 없습니다.");
            }
            
            // 가장 최근 평면도 선택
            FloorPlan floorPlan = activeFloorPlans.stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .findFirst()
                .get();
            System.out.println("평면도 선택 완료 - ID: " + floorPlan.getId());
            
            // 평면도 요소 조회
            List<FloorPlanElement> elements = floorPlanElementRepository.findByFloorPlanId(floorPlan.getId());
            System.out.println("평면도 요소 개수: " + elements.size());
            
            // 장비 보기 모드인 경우 장비 정보 조회
            Map<Long, List<Map<String, Object>>> devicesByClassroom = null;
            if ("equipment".equals(mode)) {
                devicesByClassroom = floorPlanService.getDevicesByClassroom(schoolId);
                System.out.println("장비 정보 조회 완료 - 교실 수: " + devicesByClassroom.size());
            }
            
            // PPT 프레젠테이션 생성
            XMLSlideShow ppt = createPPTPresentation(school, floorPlan, elements, mode, devicesByClassroom);
            System.out.println("PPT 프레젠테이션 생성 완료");
            
            // 바이트 배열로 변환
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            ppt.write(outputStream);
            ppt.close();
            System.out.println("PPT 파일 변환 완료 - 크기: " + outputStream.size() + " bytes");
            
            return outputStream;
            
        } catch (Exception e) {
            System.err.println("PPT 내보내기 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            throw new IOException("PPT 파일 생성 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
    
    /**
     * PPT 프레젠테이션 생성
     */
    private XMLSlideShow createPPTPresentation(School school, FloorPlan floorPlan, List<FloorPlanElement> elements,
                                              String mode, Map<Long, List<Map<String, Object>>> devicesByClassroom) {
        XMLSlideShow ppt = new XMLSlideShow();
        
        // 슬라이드 크기 설정 (16:10 와이드스크린)
        ppt.setPageSize(new java.awt.Dimension(720, 540));
        
        // 제목 슬라이드 생성
        createTitleSlide(ppt, school);
        
        // 평면도 슬라이드 생성
        createFloorPlanSlide(ppt, school, floorPlan, elements, mode, devicesByClassroom);
        
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
                                     String mode, Map<Long, List<Map<String, Object>>> devicesByClassroom) {
        XSLFSlide floorPlanSlide = ppt.createSlide();
        
        // 슬라이드 제목 추가
        XSLFTextBox headerBox = floorPlanSlide.createTextBox();
        headerBox.setAnchor(new Rectangle(20, 10, 680, 30));
        XSLFTextParagraph headerPara = headerBox.addNewTextParagraph();
        XSLFTextRun headerRun = headerPara.addNewTextRun();
        headerRun.setText(school.getSchoolName() + " - 평면도");
        headerRun.setFontSize(18.0);
        headerRun.setBold(true);
        headerRun.setFontColor(new Color(31, 78, 121));
        
        // 모드별 필터링 (바운딩 박스 계산 전에 먼저 필터링)
        // 바운딩 박스 계산에서는 실제 평면도 요소만 포함 (seat_layout, equipment_card 등 제외)
        List<FloorPlanElement> elementsToProcess = elements.stream()
            .filter(el -> {
                String elementType = el.getElementType();
                // 바운딩 박스 계산에서 제외할 요소 타입들
                if ("seat_layout".equals(elementType) || 
                    "equipment_card".equals(elementType)) {
                    return false;
                }
                return true;
            })
            .collect(java.util.stream.Collectors.toList());
        
        if ("wireless-ap".equals(mode)) {
            System.out.println("무선 AP 보기 모드: " + elementsToProcess.size() + "개 요소 포함 (전체: " + elements.size() + "개)");
        } else if ("equipment".equals(mode)) {
            System.out.println("장비 보기 모드: " + elementsToProcess.size() + "개 요소 포함 (전체: " + elements.size() + "개)");
        }
        
        // 필터링된 요소들로 바운딩 박스 계산
        BoundingBox bounds = calculateBoundingBox(elementsToProcess);
        System.out.println("실제 평면도 범위: " + bounds);
        
        // 동적 스케일 및 오프셋 계산 (헤더 영역 제외)
        double availableWidth = PPT_WIDTH - 40;  // 좌우 여백 20px씩
        double availableHeight = PPT_HEIGHT - 60; // 상단 헤더 50px + 하단 여백 10px
        
        // 바운딩 박스 크기 확인
        if (bounds.width <= 0 || bounds.height <= 0) {
            System.err.println("⚠️ 바운딩 박스 크기가 0 이하입니다: " + bounds);
            bounds = new BoundingBox(0, 0, 1000, 1000);
        }
        
        double scaleX = availableWidth / bounds.width;
        double scaleY = availableHeight / bounds.height;
        double scale = Math.min(scaleX, scaleY); // 비율 유지를 위해 작은 값 사용
        
        // 스케일이 너무 작거나 큰 경우 제한
        if (scale <= 0 || Double.isNaN(scale) || Double.isInfinite(scale)) {
            System.err.println("⚠️ 스케일 계산 오류: " + scale + ", 기본값 0.15 사용");
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
            System.err.println("⚠️ 마진이 음수입니다!");
            System.err.println(String.format("  bounds: minX=%.2f, minY=%.2f, width=%.2f, height=%.2f", 
                bounds.minX, bounds.minY, bounds.width, bounds.height));
            System.err.println(String.format("  scale: %.6f, scaledWidth=%.2f, scaledHeight=%.2f", 
                scale, scaledWidth, scaledHeight));
            System.err.println(String.format("  availableWidth=%.2f, availableHeight=%.2f", availableWidth, availableHeight));
            System.err.println(String.format("  marginX=%.2f, marginY=%.2f", marginX, marginY));
        }
        
        System.out.println(String.format("=== PPT 스케일 및 오프셋 계산 정보 ==="));
        System.out.println(String.format("바운딩 박스: minX=%.2f, minY=%.2f, maxX=%.2f, maxY=%.2f, width=%.2f, height=%.2f",
            bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, bounds.width, bounds.height));
        System.out.println(String.format("사용 가능 영역: width=%.2f, height=%.2f", availableWidth, availableHeight));
        System.out.println(String.format("스케일 계산: scaleX=%.6f, scaleY=%.6f, 최종 scale=%.6f (%.2f%%)", 
            scaleX, scaleY, scale, scale * 100));
        System.out.println(String.format("스케일된 크기: width=%.2f, height=%.2f", scaledWidth, scaledHeight));
        System.out.println(String.format("중앙 정렬 여백: marginX=%.2f, marginY=%.2f", marginX, marginY));
        System.out.println(String.format("최종 오프셋: offsetX=%.2f, offsetY=%.2f", offsetX, offsetY));
        System.out.println(String.format("기준 스케일: %.6f (%.2f%%)", REFERENCE_ZOOM, REFERENCE_ZOOM * 100));
        System.out.println(String.format("스케일 비율: %.6f (실제/기준)", scale / REFERENCE_ZOOM));
        System.out.println(String.format("기준 PPT 폰트: %.2fpt", REFERENCE_PPT_FONT));
        System.out.println("모드: " + mode + ", 장비 데이터: " + (devicesByClassroom != null ? devicesByClassroom.size() + "개 교실" : "null"));
        
        // 평면도 요소들을 z-index 순서대로 추가
        int roomCount = 0;
        int apCount = 0;
        int mdfCount = 0;
        
        for (FloorPlanElement element : elementsToProcess) {
            try {
                // 모든 모드에서 요소 추가 (필터링된 요소들은 이미 처리됨)
                addElementToSlide(floorPlanSlide, element, scale, offsetX, offsetY);
                
                // 무선 AP 보기 모드: AP와 MDF 개수 카운트
                if ("wireless-ap".equals(mode)) {
                    if ("wireless_ap".equals(element.getElementType())) {
                        apCount++;
                    } else if ("mdf_idf".equals(element.getElementType())) {
                        mdfCount++;
                    }
                }
                
                // 장비 보기 모드이고 교실 요소인 경우 장비 카드 추가
                if ("equipment".equals(mode) && "room".equals(element.getElementType())) {
                    roomCount++;
                    System.out.println("교실 요소 발견 (ID: " + element.getId() + ", Type: " + element.getElementType() + ")");
                    if (devicesByClassroom != null) {
                        addEquipmentCardsToRoom(floorPlanSlide, element, devicesByClassroom, scale, offsetX, offsetY, elements);
                    } else {
                        System.err.println("⚠️ 장비 데이터가 null입니다!");
                    }
                }
            } catch (Exception e) {
                System.err.println("요소 추가 중 오류 발생 (ID: " + element.getId() + "): " + e.getMessage());
                e.printStackTrace();
            }
        }
        
        if ("equipment".equals(mode)) {
            System.out.println("총 " + roomCount + "개의 교실 처리됨");
        } else if ("wireless-ap".equals(mode)) {
            System.out.println("총 " + apCount + "개의 AP, " + mdfCount + "개의 MDF 처리됨");
        }
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
            System.err.println("⚠️ 바운딩 박스 계산 실패: 기본값 사용");
            return new BoundingBox(0, 0, 1000, 1000);
        }
        
        // 패딩 추가
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX += padding;
        maxY += padding;
        
        System.out.println(String.format("바운딩 박스 계산: minX=%.2f, minY=%.2f, maxX=%.2f, maxY=%.2f, width=%.2f, height=%.2f",
            minX, minY, maxX, maxY, maxX - minX, maxY - minY));
        
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
                System.err.println("알 수 없는 요소 타입: " + elementType);
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
        System.out.println(String.format("[교실 선 굵기] borderWidth=%s, scale=%.6f, 계산결과=%.6fpt", 
            borderThicknessStr, scale, borderThickness * scale));
        
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
        System.out.println(String.format("[건물 선 굵기] borderWidth=%s, scale=%.6f, 계산결과=%.6fpt", 
            borderThicknessStr, scale, borderThickness * scale));
        
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
        System.out.println(String.format("[도형 선 굵기] shapeType=%s, borderWidth=%s, scale=%.6f, 계산결과=%.6fpt", 
            shapeType, lineWidthStr, scale, lineWidth * scale));
        
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
                        System.out.println("[점선 도형] 점선 스타일 적용: " + shapeType);
                    }
                }
            } catch (Exception e) {
                System.out.println("[점선 도형] 점선 스타일 설정 실패: " + e.getMessage());
                e.printStackTrace();
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
        System.out.println(String.format("[기타공간 선 굵기] borderWidth=%s, scale=%.6f, 계산결과=%.6fpt", 
            borderThicknessStr != null ? borderThicknessStr : "2.0", scale, otherSpaceLineWidth));
        
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
        
        // 테두리 색상 및 굵기 설정 (스케일에 비례, 이름박스는 얇게)
        shape.setLineColor(parseColor(borderColorStr));
        // 이름박스는 기본적으로 얇은 테두리 (1px 기준, 스케일 적용 시 최소값 보장)
        double nameBoxLineWidth = Math.max(0.3, borderThickness * scale);
        shape.setLineWidth(nameBoxLineWidth);
        shape.setFillColor(Color.WHITE);
        
        // 텍스트 설정: 자동맞춤 사용하지 않고 고정 비율 폰트 적용
        shape.setWordWrap(false);
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(label);
        // 동적 스케일 기반 폰트 크기
        // 기본 이름박스: 원본 높이 40px, 원본 폰트 18pt
        // 스케일이 0.15일 때 PPT 폰트 크기가 2.5pt가 되려면:
        // PPT폰트 = 기준PPT폰트 * (실제스케일 / 기준스케일) * (높이비율)
        //         = 2.5 * (scale / 0.15) * (originalHeight / 40)
        double originalHeight = element.getHeight();
        double scaleRatio = scale / REFERENCE_ZOOM;
        double heightRatio = originalHeight / 40.0;
        double fontSize = REFERENCE_PPT_FONT * scaleRatio * heightRatio * 1.2; // 20% 증가
        // 최소값 제거 - 계산된 값 그대로 사용 (스케일이 작을 때는 작은 폰트가 정상)
        System.out.println(String.format("[이름박스 폰트 계산] 원본높이=%.1fpx, 스케일=%.6f, 스케일비율=%.6f, 높이비율=%.6f, 계산결과=%.6fpt, 최종=%.2fpt", 
            originalHeight, scale, scaleRatio, heightRatio, REFERENCE_PPT_FONT * scaleRatio * heightRatio * 1.2, fontSize));
        textRun.setFontSize(fontSize);
        textRun.setFontColor(Color.BLACK);
        textRun.setBold(true);
        shape.setInsets(new org.apache.poi.sl.usermodel.Insets2D(2, 4, 2, 4));
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 장비 카드 생성 (동적 스케일 적용)
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
        String colorHex = (String) elementData.getOrDefault("color", "#4b5563");
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ROUND_RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 배경색 설정 (카테고리별 색상)
        Color bgColor = parseColor(colorHex);
        shape.setFillColor(bgColor);
        shape.setLineColor(bgColor);  // 테두리도 같은 색
        shape.setLineWidth(0.5);
        
        // 텍스트 추가
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(deviceType + " " + count);
        textRun.setFontSize(Math.min(14.0, height * 0.4));
        textRun.setFontColor(Color.WHITE);
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
        System.out.println(String.format("[WC 폰트 계산] 스케일=%.6f, 스케일비율=%.6f, 폰트비율=%.6f, 계산결과=%.6fpt, 최종=%.2fpt", 
            scale, scaleRatio, fontRatio, REFERENCE_PPT_FONT * scaleRatio * fontRatio * 1.2, fontSize));
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
        System.out.println(String.format("[EV 폰트 계산] 스케일=%.6f, 스케일비율=%.6f, 폰트비율=%.6f, 계산결과=%.6fpt, 최종=%.2fpt", 
            scale, scaleRatio, fontRatio, REFERENCE_PPT_FONT * scaleRatio * fontRatio * 1.2, fontSize));
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
                                        List<FloorPlanElement> elements) throws Exception {
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
            System.err.println("장비 카드 추가 실패: classroomId를 찾을 수 없음 (elementId=" + roomElement.getId() + ")");
            return;
        }
        
        // 해당 교실의 장비 조회
        List<Map<String, Object>> devices = devicesByClassroom.get(classroomId);
        if (devices == null || devices.isEmpty()) {
            System.out.println("교실 " + classroomId + " 장비 없음");
            return;
        }
        
        // uidCate별로 그룹화 및 카운트
        Map<String, Integer> deviceCounts = new java.util.HashMap<>();
        for (Map<String, Object> device : devices) {
            String cate = (String) device.getOrDefault("uidCate", "미분류");
            deviceCounts.put(cate, deviceCounts.getOrDefault(cate, 0) + 1);
        }
        
        // 카드 레이아웃 설정 (프론트엔드와 동일)
        // 프론트엔드: cardWidth=65, cardHeight=43, cardPadding=5, cardMargin=3 (위아래), cardsPerRow=4
        int cardWidth = (int)(65 * scale);
        int cardHeight = (int)(43 * scale);
        int cardPadding = (int)(5 * scale);
        int cardMargin = (int)(3 * scale);  // 카드 간격 (프론트엔드와 동일)
        int cardsPerRow = 4;  // 4열
        
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
        
        // 카드 리스트 생성 (최대 8개)
        List<Map.Entry<String, Integer>> cardList = new java.util.ArrayList<>(deviceCounts.entrySet());
        int maxCards = Math.min(cardList.size(), 8);
        
        // 카드 생성
        for (int i = 0; i < maxCards; i++) {
            Map.Entry<String, Integer> entry = cardList.get(i);
            String cate = entry.getKey();
            int count = entry.getValue();
            
            // 카드 위치 계산 (하단에서 위로, 왼쪽에서 오른쪽) - 프론트엔드와 동일
            int row = i / cardsPerRow;
            int col = i % cardsPerRow;
            
            // 프론트엔드: cardX = roomX + cardPadding + col * (cardWidth + cardMargin)
            int cardX = roomX + cardPadding + col * (cardWidth + cardMargin);
            // 프론트엔드: cardY = roomY + roomH - cardPadding - cardHeight - row * (cardHeight + cardMargin)
            int cardY = roomY + roomH - cardPadding - cardHeight - row * (cardHeight + cardMargin);
            
            // 이름박스와 겹치지 않도록 체크 (프론트엔드와 동일)
            if (nameBoxBottom > 0 && cardY < nameBoxBottom) {
                cardY = nameBoxBottom;
            }
            
            // 카드 색상 가져오기
            Color cardColor = getDeviceColorForPPT(cate);
            
            // 카드 도형 생성
            XSLFAutoShape cardShape = slide.createAutoShape();
            cardShape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ROUND_RECT);
            cardShape.setAnchor(new Rectangle(cardX, cardY, cardWidth, cardHeight));
            
            // 배경색 및 테두리
            cardShape.setFillColor(cardColor);
            cardShape.setLineColor(cardColor);
            cardShape.setLineWidth(0.5);
            
            // 텍스트 추가
        cardShape.setWordWrap(false);
        XSLFTextParagraph paragraph = cardShape.addNewTextParagraph();
            paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
            XSLFTextRun textRun = paragraph.addNewTextRun();
            textRun.setText(cate + " " + count);
            // 동적 스케일 기반 폰트 크기 (프론트엔드와 동일한 비율 적용)
            // 기본 장비카드: 원본 높이 43px, 원본 폰트 17pt
            // 스케일 0.15일 때 PPT 폰트 크기 계산:
            // 이름박스: 18pt → 2.5pt (비율 2.5/18 = 0.139)
            // 장비카드: 17pt → 2.5pt * (17/18) = 2.36pt (동일 비율 적용)
            // 일반화: PPT폰트 = 2.5 * (scale/0.15) * (17/18)
            double baseCardFontSize = 17.0; // 장비카드 원본 폰트
            double nameBoxFontSize = 18.0; // 이름박스 원본 폰트
            double scaleRatio = scale / REFERENCE_ZOOM;
            double fontRatio = baseCardFontSize / nameBoxFontSize;
            double fontSize = REFERENCE_PPT_FONT * scaleRatio * fontRatio * 1.2; // 20% 증가
            // 최소 폰트 크기 보장 (너무 작아지지 않도록)
            fontSize = Math.max(1.0, fontSize);
            if (i == 0) { // 첫 번째 카드만 로그 출력
                System.out.println(String.format("[장비카드 폰트 계산] 스케일=%.6f, 스케일비율=%.6f, 폰트비율=%.6f, 계산결과=%.6fpt, 최종=%.2fpt", 
                    scale, scaleRatio, fontRatio, REFERENCE_PPT_FONT * scaleRatio * fontRatio * 1.2, fontSize));
            }
            textRun.setFontSize(fontSize);
            textRun.setFontColor(Color.WHITE);
            textRun.setBold(true);
        cardShape.setInsets(new org.apache.poi.sl.usermodel.Insets2D(2, 4, 2, 4));
            
            cardShape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
        }
        
        System.out.println(String.format("교실 %s에 장비 카드 %d개 추가됨", 
            roomElement.getId(), maxCards));
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
            System.err.println("JSON 파싱 실패: " + e.getMessage());
        }
        return Map.of();
    }
    
    /**
     * 무선AP 생성 (동적 스케일 적용) - 원형
     */
    private void createWirelessApShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        Map<String, Object> elementData = parseElementData(element.getElementData());
        
        // 저장된 좌표는 중앙 좌표로 저장되어 있음
        double centerX = element.getXCoordinate();
        double centerY = element.getYCoordinate();
        
        // 반지름 계산 (width/height가 있으면 그걸 사용, 아니면 20)
        double radius = 20.0;
        if (element.getWidth() != null && element.getHeight() != null) {
            radius = Math.min(element.getWidth(), element.getHeight()) / 2.0;
        } else if (elementData.containsKey("radius")) {
            Object radiusObj = elementData.get("radius");
            if (radiusObj instanceof Number) {
                radius = ((Number) radiusObj).doubleValue();
            }
        }
        
        // 원형 도형 생성 (좌상단 좌표로 변환)
        // PPT 좌표 = (원본 좌표 - bounds.minX) * scale + offsetX
        int x = (int)(((centerX - radius) - this.currentBoundsMinX) * scale + offsetX);
        int y = (int)(((centerY - radius) - this.currentBoundsMinY) * scale + offsetY);
        int diameter = (int)(radius * 2 * scale);
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
        shape.setAnchor(new Rectangle(x, y, diameter, diameter));
        
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
}

