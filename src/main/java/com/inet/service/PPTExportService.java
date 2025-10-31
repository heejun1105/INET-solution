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
        
        // 요소들의 실제 바운딩 박스 계산
        BoundingBox bounds = calculateBoundingBox(elements);
        System.out.println("실제 평면도 범위: " + bounds);
        
        // 동적 스케일 및 오프셋 계산 (헤더 영역 제외)
        double availableWidth = PPT_WIDTH - 40;  // 좌우 여백 20px씩
        double availableHeight = PPT_HEIGHT - 60; // 상단 헤더 50px + 하단 여백 10px
        
        double scaleX = availableWidth / bounds.width;
        double scaleY = availableHeight / bounds.height;
        double scale = Math.min(scaleX, scaleY); // 비율 유지를 위해 작은 값 사용
        
        // 중앙 정렬을 위한 오프셋
        double offsetX = 20 + (availableWidth - bounds.width * scale) / 2 - bounds.minX * scale;
        double offsetY = 50 + (availableHeight - bounds.height * scale) / 2 - bounds.minY * scale;
        
        System.out.println(String.format("=== PPT 폰트 계산용 스케일 정보 ==="));
        System.out.println(String.format("동적 스케일: %.6f (%.2f%%)", scale, scale * 100));
        System.out.println(String.format("기준 스케일: %.6f (%.2f%%)", REFERENCE_ZOOM, REFERENCE_ZOOM * 100));
        System.out.println(String.format("스케일 비율: %.6f (실제/기준)", scale / REFERENCE_ZOOM));
        System.out.println(String.format("기준 PPT 폰트: %.2fpt", REFERENCE_PPT_FONT));
        System.out.println(String.format("오프셋: (%.2f, %.2f)", offsetX, offsetY));
        System.out.println("장비 보기 모드: " + mode + ", 장비 데이터: " + (devicesByClassroom != null ? devicesByClassroom.size() + "개 교실" : "null"));
        
        // 평면도 요소들을 z-index 순서대로 추가
        int roomCount = 0;
        for (FloorPlanElement element : elements) {
            try {
                addElementToSlide(floorPlanSlide, element, scale, offsetX, offsetY);
                
                // 장비 보기 모드이고 교실 요소인 경우 장비 카드 추가
                if ("equipment".equals(mode) && "room".equals(element.getElementType())) {
                    roomCount++;
                    System.out.println("교실 요소 발견 (ID: " + element.getId() + ", Type: " + element.getElementType() + ")");
                    if (devicesByClassroom != null) {
                        addEquipmentCardsToRoom(floorPlanSlide, element, devicesByClassroom, scale, offsetX, offsetY);
                    } else {
                        System.err.println("⚠️ 장비 데이터가 null입니다!");
                    }
                }
            } catch (Exception e) {
                System.err.println("요소 추가 중 오류 발생 (ID: " + element.getId() + "): " + e.getMessage());
                e.printStackTrace();
            }
        }
        System.out.println("총 " + roomCount + "개의 교실 처리됨");
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
        double minX = Double.MAX_VALUE;
        double minY = Double.MAX_VALUE;
        double maxX = Double.MIN_VALUE;
        double maxY = Double.MIN_VALUE;
        
        int padding = 100; // 여유 공간
        
        for (FloorPlanElement element : elements) {
            double x = element.getXCoordinate();
            double y = element.getYCoordinate();
            double w = element.getWidth();
            double h = element.getHeight();
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
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
            default:
                System.err.println("알 수 없는 요소 타입: " + elementType);
        }
    }
    
    /**
     * 교실 도형 생성 (동적 스케일 적용)
     */
    private void createRoomShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 추가 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String roomName = (String) elementData.getOrDefault("roomName", "교실");
        String borderColor = (String) elementData.getOrDefault("borderColor", "#000000");
        String borderThickness = (String) elementData.getOrDefault("borderThickness", "2");
        
        // 사각형 도형 생성
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 테두리 설정
        shape.setLineColor(parseColor(borderColor));
        shape.setLineWidth(Double.parseDouble(borderThickness));
        
        // 배경색 설정 (연한 회색)
        shape.setFillColor(new Color(245, 245, 245));
        
        // 텍스트 추가 (교실 내부, 일반적으로 표시 안 함)
        // 교실 이름은 name_box 요소로 별도 표시됨
    }
    
    /**
     * 건물 도형 생성 (동적 스케일 적용)
     */
    private void createBuildingShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 건물명 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String buildingName = (String) elementData.getOrDefault("buildingName", "건물");
        
        // 사각형 도형 생성
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 테두리 설정 (파란색)
        shape.setLineColor(new Color(59, 130, 246));
        shape.setLineWidth(3.0);
        
        // 배경색 설정 (연한 파란색)
        shape.setFillColor(new Color(219, 234, 254));
        
        // 건물 내부 텍스트는 표시하지 않음
    }
    
    /**
     * 도형 생성 (사각형, 원, 선, 화살표) - 동적 스케일 적용
     */
    private void createCustomShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 도형 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String shapeType = (String) elementData.getOrDefault("shapeType", "rectangle");
        String color = (String) elementData.getOrDefault("color", "#000000");
        String thickness = (String) elementData.getOrDefault("thickness", "2");
        
        XSLFAutoShape shape = slide.createAutoShape();
        
        // 도형 타입에 따라 설정
        switch (shapeType) {
            case "circle":
                shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.ELLIPSE);
                break;
            case "line":
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
        
        // 선 색상 및 두께 설정
        shape.setLineColor(parseColor(color));
        shape.setLineWidth(Double.parseDouble(thickness));
        
        // 선/화살표는 배경색 없음
        if (shapeType.equals("line") || shapeType.equals("arrow")) {
            shape.setFillColor(null);
        } else {
            // 사각형/원은 투명 배경
            shape.setFillColor(new Color(255, 255, 255, 0));
        }
    }
    
    /**
     * 기타공간 도형 생성 (동적 스케일 적용)
     */
    private void createOtherSpaceShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        // 좌표 변환 (동적 스케일 및 오프셋 적용)
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // element_data에서 공간 정보 파싱
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String spaceType = (String) elementData.getOrDefault("spaceType", "corridor");
        String spaceName = (String) elementData.getOrDefault("spaceName", "기타공간");
        
        // 사각형 도형 생성
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        // 공간 타입별 색상 설정
        Color bgColor = getOtherSpaceColor(spaceType);
        shape.setFillColor(bgColor);
        shape.setLineColor(darkenColor(bgColor, 0.3));
        shape.setLineWidth(2.0);
        
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
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        Map<String, Object> elementData = parseElementData(element.getElementData());
        String label = (String) elementData.getOrDefault("label", "");
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        shape.setLineColor(Color.BLACK);
        shape.setLineWidth(1.0);
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
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
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
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        shape.setLineColor(Color.BLACK);
        shape.setLineWidth(2.0 * scale);
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
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        XSLFAutoShape shape = slide.createAutoShape();
        shape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        shape.setAnchor(new Rectangle(x, y, width, height));
        
        shape.setLineColor(Color.BLACK);
        shape.setLineWidth(2.0 * scale);
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
     * 현관 생성 (동적 스케일 적용) - 간단한 문 표시
     */
    private void createEntranceShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // 세로선 (문틀)
        XSLFAutoShape line = slide.createAutoShape();
        line.setShapeType(org.apache.poi.sl.usermodel.ShapeType.LINE);
        int lineX = x + width - (int)Math.max(2, 2 * scale);
        line.setAnchor(new Rectangle(lineX, y, 2, height));
        line.setLineColor(Color.BLACK);
        line.setLineWidth(Math.max(1.5, 3.0 * scale));
        
        // 1/4 원호를 폴리라인으로 근사 (오른쪽 아래 힌지, 반지름은 짧은 변의 90%)
        int radius = (int)(Math.min(width, height) * 0.9);
        int segments = 16; // 더 크게 하면 더 매끈
        double cx = lineX;                 // 회전축(경첩)
        double cy = y + height;            // 아래쪽 기준
        double startAngle = -Math.PI / 2;  // 위쪽 방향
        double endAngle = Math.PI;         // 왼쪽 방향
        for (int i = 0; i < segments; i++) {
            double a1 = startAngle + (endAngle - startAngle) * (i / (double)segments);
            double a2 = startAngle + (endAngle - startAngle) * ((i + 1) / (double)segments);
            int sx = (int)(cx + Math.cos(a1) * radius);
            int sy = (int)(cy + Math.sin(a1) * radius);
            int ex = (int)(cx + Math.cos(a2) * radius);
            int ey = (int)(cy + Math.sin(a2) * radius);
            XSLFAutoShape seg = slide.createAutoShape();
            seg.setShapeType(org.apache.poi.sl.usermodel.ShapeType.LINE);
            seg.setAnchor(new Rectangle(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy)));
            seg.setLineColor(Color.BLACK);
            seg.setLineWidth(Math.max(1.2, 2.4 * scale));
        }
    }
    
    /**
     * 계단 생성 (동적 스케일 적용) - 대각선으로 표시
     */
    private void createStairsShape(XSLFSlide slide, FloorPlanElement element, double scale, double offsetX, double offsetY) throws Exception {
        int x = (int)(element.getXCoordinate() * scale + offsetX);
        int y = (int)(element.getYCoordinate() * scale + offsetY);
        int width = (int)(element.getWidth() * scale);
        int height = (int)(element.getHeight() * scale);
        
        // 지그재그 계단: 우상향 대각선과 수평선 반복
        int steps = 6;
        int stepW = width / steps;
        int stepH = height / steps;
        int curX = x;
        int curY = y + height;
        for (int i = 0; i < steps; i++) {
            int nextX = curX + stepW;
            int nextY = curY - stepH;
            // 대각선
            XSLFAutoShape diag = slide.createAutoShape();
            diag.setShapeType(org.apache.poi.sl.usermodel.ShapeType.LINE);
            diag.setAnchor(new Rectangle(Math.min(curX, nextX), Math.min(curY, nextY), Math.abs(nextX - curX), Math.abs(nextY - curY)));
            diag.setLineColor(Color.BLACK);
            diag.setLineWidth(Math.max(1.2, 2.0 * scale));
            // 수평선
            XSLFAutoShape hor = slide.createAutoShape();
            hor.setShapeType(org.apache.poi.sl.usermodel.ShapeType.LINE);
            hor.setAnchor(new Rectangle(Math.min(nextX - stepW / 3, nextX), nextY, stepW / 3, 1));
            hor.setLineColor(Color.BLACK);
            hor.setLineWidth(Math.max(1.2, 2.0 * scale));
            curX = nextX;
            curY = nextY;
        }
    }
    
    /**
     * 교실에 장비 카드 추가 (Equipment View Mode) - 동적 스케일 적용
     */
    private void addEquipmentCardsToRoom(XSLFSlide slide, FloorPlanElement roomElement, 
                                        Map<Long, List<Map<String, Object>>> devicesByClassroom,
                                        double scale, double offsetX, double offsetY) throws Exception {
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
        int cardWidth = (int)(65 * scale);
        int cardHeight = (int)(43 * scale);
        int cardPadding = (int)(5 * scale);
        int cardMarginH = (int)(1 * scale);  // 가로 간격
        int cardMarginV = (int)(3 * scale);  // 세로 간격
        int cardsPerRow = 4;  // 4열
        
        // 교실 좌표 변환 (동적 스케일 및 오프셋 적용)
        int roomX = (int)(roomElement.getXCoordinate() * scale + offsetX);
        int roomY = (int)(roomElement.getYCoordinate() * scale + offsetY);
        int roomH = (int)(roomElement.getHeight() * scale);
        
        // 카드 리스트 생성 (최대 8개)
        List<Map.Entry<String, Integer>> cardList = new java.util.ArrayList<>(deviceCounts.entrySet());
        int maxCards = Math.min(cardList.size(), 8);
        
        // 카드 생성
        for (int i = 0; i < maxCards; i++) {
            Map.Entry<String, Integer> entry = cardList.get(i);
            String cate = entry.getKey();
            int count = entry.getValue();
            
            // 카드 위치 계산 (하단에서 위로, 왼쪽에서 오른쪽)
            int row = i / cardsPerRow;
            int col = i % cardsPerRow;
            
            int cardX = roomX + cardPadding + col * (cardWidth + cardMarginH);
            int cardY = roomY + roomH - cardPadding - cardHeight - row * (cardHeight + cardMarginV);
            
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
            // 동적 스케일 기반 폰트 크기
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
            // 최소값 제거 - 계산된 값 그대로 사용
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
     * 16진수 색상 코드를 Color 객체로 변환
     */
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

