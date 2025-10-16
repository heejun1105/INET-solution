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
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // 좌표 변환 상수
    private static final double CANVAS_WIDTH = 4000.0;
    private static final double CANVAS_HEIGHT = 2500.0;
    private static final double PPT_WIDTH = 720.0;  // 10인치 * 72 포인트
    private static final double PPT_HEIGHT = 540.0; // 7.5인치 * 72 포인트
    private static final double SCALE_X = PPT_WIDTH / CANVAS_WIDTH;
    private static final double SCALE_Y = PPT_HEIGHT / CANVAS_HEIGHT;
    
    /**
     * 학교별 평면도를 PPT 파일로 내보내기
     */
    public ByteArrayOutputStream exportFloorPlanToPPT(Long schoolId) throws IOException {
        try {
            System.out.println("PPT 내보내기 시작 - schoolId: " + schoolId);
            
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
            
            // PPT 프레젠테이션 생성
            XMLSlideShow ppt = createPPTPresentation(school, floorPlan, elements);
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
    private XMLSlideShow createPPTPresentation(School school, FloorPlan floorPlan, List<FloorPlanElement> elements) {
        XMLSlideShow ppt = new XMLSlideShow();
        
        // 슬라이드 크기 설정 (16:10 와이드스크린)
        ppt.setPageSize(new java.awt.Dimension(720, 540));
        
        // 제목 슬라이드 생성
        createTitleSlide(ppt, school);
        
        // 평면도 슬라이드 생성
        createFloorPlanSlide(ppt, school, floorPlan, elements);
        
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
    private void createFloorPlanSlide(XMLSlideShow ppt, School school, FloorPlan floorPlan, List<FloorPlanElement> elements) {
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
        
        // 평면도 요소들을 z-index 순서대로 추가
        for (FloorPlanElement element : elements) {
            try {
                addElementToSlide(floorPlanSlide, element);
            } catch (Exception e) {
                System.err.println("요소 추가 중 오류 발생 (ID: " + element.getId() + "): " + e.getMessage());
                e.printStackTrace();
            }
        }
    }
    
    /**
     * 평면도 요소를 슬라이드에 추가
     */
    private void addElementToSlide(XSLFSlide slide, FloorPlanElement element) throws Exception {
        String elementType = element.getElementType();
        
        switch (elementType) {
            case "room":
                createRoomShape(slide, element);
                break;
            case "building":
                createBuildingShape(slide, element);
                break;
            case "shape":
                createCustomShape(slide, element);
                break;
            case "other_space":
                createOtherSpaceShape(slide, element);
                break;
            default:
                System.err.println("알 수 없는 요소 타입: " + elementType);
        }
    }
    
    /**
     * 교실 도형 생성
     */
    private void createRoomShape(XSLFSlide slide, FloorPlanElement element) throws Exception {
        // 좌표 변환 (상단 여백 50px 추가)
        int x = (int)(element.getXCoordinate() * SCALE_X);
        int y = (int)(element.getYCoordinate() * SCALE_Y) + 50;
        int width = (int)(element.getWidth() * SCALE_X);
        int height = (int)(element.getHeight() * SCALE_Y);
        
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
        
        // 텍스트 추가
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(roomName);
        textRun.setFontSize(Math.min(width / 10.0, 14.0)); // 동적 폰트 크기
        textRun.setFontColor(Color.BLACK);
        textRun.setBold(true);
        
        // 텍스트 세로 중앙 정렬
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 건물 도형 생성
     */
    private void createBuildingShape(XSLFSlide slide, FloorPlanElement element) throws Exception {
        // 좌표 변환
        int x = (int)(element.getXCoordinate() * SCALE_X);
        int y = (int)(element.getYCoordinate() * SCALE_Y) + 50;
        int width = (int)(element.getWidth() * SCALE_X);
        int height = (int)(element.getHeight() * SCALE_Y);
        
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
        
        // 텍스트 추가
        XSLFTextParagraph paragraph = shape.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText(buildingName);
        textRun.setFontSize(Math.min(width / 8.0, 18.0));
        textRun.setFontColor(new Color(30, 64, 175));
        textRun.setBold(true);
        
        shape.setVerticalAlignment(org.apache.poi.sl.usermodel.VerticalAlignment.MIDDLE);
    }
    
    /**
     * 도형 생성 (사각형, 원, 선, 화살표)
     */
    private void createCustomShape(XSLFSlide slide, FloorPlanElement element) throws Exception {
        // 좌표 변환
        int x = (int)(element.getXCoordinate() * SCALE_X);
        int y = (int)(element.getYCoordinate() * SCALE_Y) + 50;
        int width = (int)(element.getWidth() * SCALE_X);
        int height = (int)(element.getHeight() * SCALE_Y);
        
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
     * 기타공간 도형 생성
     */
    private void createOtherSpaceShape(XSLFSlide slide, FloorPlanElement element) throws Exception {
        // 좌표 변환
        int x = (int)(element.getXCoordinate() * SCALE_X);
        int y = (int)(element.getYCoordinate() * SCALE_Y) + 50;
        int width = (int)(element.getWidth() * SCALE_X);
        int height = (int)(element.getHeight() * SCALE_Y);
        
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
     * element_data JSON 파싱
     */
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

