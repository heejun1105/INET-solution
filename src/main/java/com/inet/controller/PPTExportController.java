package com.inet.controller;

import com.inet.service.FloorPlanService;
import org.apache.poi.sl.usermodel.PictureData;
import org.apache.poi.xslf.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.awt.*;
import java.awt.geom.Rectangle2D;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;

@Controller
@RequestMapping("/floorplan")
public class PPTExportController {
    
    private static final Logger log = LoggerFactory.getLogger(PPTExportController.class);
    
    @Autowired
    private FloorPlanService floorPlanService;
    
    @GetMapping("/api/download-ppt/{schoolId}")
    public ResponseEntity<byte[]> downloadPPT(@PathVariable Long schoolId) {
        try {
            // 평면도 데이터 조회
            Map<String, Object> floorPlanData = floorPlanService.loadFloorPlan(schoolId);
            
            // PPT 생성
            byte[] pptBytes = createPPTFromFloorPlan(floorPlanData);
            
            // 응답 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "school_floorplan.pptx");
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pptBytes);
                    
        } catch (Exception e) {
            log.error("평면도 PPT 다운로드 중 오류 발생: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    private byte[] createPPTFromFloorPlan(Map<String, Object> floorPlanData) throws IOException {
        XMLSlideShow ppt = new XMLSlideShow();
        
        // 슬라이드 생성
        XSLFSlide slide = ppt.createSlide();
        
        // 제목 추가
        XSLFTextBox titleBox = slide.createTextBox();
        titleBox.setAnchor(new Rectangle2D.Double(50, 20, 600, 50));
        XSLFTextParagraph titleParagraph = titleBox.addNewTextParagraph();
        XSLFTextRun titleRun = titleParagraph.addNewTextRun();
        titleRun.setText("학교 평면도");
        titleRun.setFontSize(24.0);
        titleRun.setBold(true);
        titleRun.setFontColor(Color.BLUE);
        
        // 건물들 렌더링
        @SuppressWarnings("unchecked")
        java.util.List<Map<String, Object>> buildings = 
            (java.util.List<Map<String, Object>>) floorPlanData.get("buildings");
            
        if (buildings != null) {
            for (Map<String, Object> building : buildings) {
                addBuildingToPPT(slide, building);
            }
        }
        
        // PPT를 바이트 배열로 변환
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ppt.write(out);
        ppt.close();
        
        return out.toByteArray();
    }
    
    private void addBuildingToPPT(XSLFSlide slide, Map<String, Object> building) {
        // 건물 사각형 생성
        XSLFAutoShape buildingShape = slide.createAutoShape();
        buildingShape.setShapeType(org.apache.poi.sl.usermodel.ShapeType.RECT);
        
        // 위치와 크기 설정 (좌표 변환)
        double x = ((Number) building.getOrDefault("xCoordinate", 100)).doubleValue() * 0.75; // 스케일 조정
        double y = ((Number) building.getOrDefault("yCoordinate", 100)).doubleValue() * 0.75 + 100; // 제목 공간 확보
        double width = ((Number) building.getOrDefault("width", 200)).doubleValue() * 0.75;
        double height = ((Number) building.getOrDefault("height", 300)).doubleValue() * 0.75;
        
        buildingShape.setAnchor(new Rectangle2D.Double(x, y, width, height));
        
        // 색상 설정
        String color = (String) building.getOrDefault("color", "#3b82f6");
        Color buildingColor = hexToColor(color);
        buildingShape.setFillColor(buildingColor);
        
        // 테두리 설정
        buildingShape.setLineColor(Color.BLACK);
        buildingShape.setLineWidth(1.0);
        
        // 건물명 텍스트 추가
        XSLFTextBox textBox = slide.createTextBox();
        textBox.setAnchor(new Rectangle2D.Double(x, y, width, 30));
        
        XSLFTextParagraph paragraph = textBox.addNewTextParagraph();
        paragraph.setTextAlign(org.apache.poi.sl.usermodel.TextParagraph.TextAlign.CENTER);
        
        XSLFTextRun textRun = paragraph.addNewTextRun();
        textRun.setText((String) building.getOrDefault("buildingName", "건물"));
        textRun.setFontSize(12.0);
        textRun.setBold(true);
        textRun.setFontColor(Color.WHITE);
    }
    
    private Color hexToColor(String hex) {
        try {
            if (hex.startsWith("#")) {
                hex = hex.substring(1);
            }
            return new Color(Integer.valueOf(hex, 16));
        } catch (Exception e) {
            return Color.BLUE; // 기본 색상
        }
    }
} 