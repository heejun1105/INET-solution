package com.inet.controller;

import com.inet.service.FloorPlanService;
import com.inet.service.SchoolService;
import com.inet.entity.School;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/floorplan")
@RequiredArgsConstructor
@Slf4j
public class FloorPlanController {
    
    private final FloorPlanService floorPlanService;
    private final SchoolService schoolService;
    
    // 평면도 메인 페이지
    @GetMapping("")
    public String floorPlanMain(Model model) {
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);
        return "floorplan/main";
    }
    
    // 학교별 평면도 데이터 조회 API
    @GetMapping("/api/school/{schoolId}")
    @ResponseBody
    public Map<String, Object> getFloorPlanData(@PathVariable Long schoolId) {
        return floorPlanService.getSchoolFloorPlan(schoolId);
    }
    
    // 평면도 데이터 저장 API
    @PostMapping("/api/save")
    @ResponseBody
    public ResponseEntity<String> saveFloorPlan(@RequestBody Map<String, Object> floorPlanData) {
        try {
            floorPlanService.saveFloorPlanData(floorPlanData);
            return ResponseEntity.ok("저장 완료");
        } catch (Exception e) {
            log.error("평면도 저장 오류", e);
            return ResponseEntity.internalServerError().body("저장 실패: " + e.getMessage());
        }
    }
    
    // 교실별 장비 개수 조회 API
    @GetMapping("/api/room/{roomId}/devices")
    @ResponseBody
    public ResponseEntity<Map<String, Integer>> getRoomDevices(@PathVariable Long roomId) {
        try {
            Map<String, Integer> deviceCounts = floorPlanService.getDeviceCountByType(roomId);
            return ResponseEntity.ok(deviceCounts);
        } catch (Exception e) {
            log.error("교실 장비 정보 조회 오류", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * 미배치 교실 목록 조회
     */
    @GetMapping("/api/unplaced-rooms/{schoolId}")
    @ResponseBody
    public List<Map<String, Object>> getUnplacedRooms(@PathVariable Long schoolId) {
        return floorPlanService.getUnplacedRooms(schoolId);
    }
} 