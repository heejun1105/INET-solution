package com.inet.controller;

import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.FloorPlanService;
import com.inet.service.SchoolService;
import com.inet.service.DeviceService;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.config.PermissionHelper;
import com.inet.entity.School;
import com.inet.entity.Device;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.stream.Collectors;
import com.inet.service.ClassroomService;
import com.inet.entity.Classroom;

@Controller
@RequestMapping("/floorplan")
public class FloorPlanController {
    
    @Autowired
    private FloorPlanService floorPlanService;
    
    @Autowired
    private SchoolService schoolService;
    
    @Autowired
    private DeviceService deviceService;
    
    @Autowired
    private PermissionService permissionService;
    
    @Autowired
    private SchoolPermissionService schoolPermissionService;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private ClassroomService classroomService;
    
    @Autowired
    private PermissionHelper permissionHelper;
    
    // 권한 체크 메서드
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
    
    // 학교 권한 체크 메서드
    private User checkSchoolPermission(Feature feature, Long schoolId, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName())
            .orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkSchoolPermission(user, feature, schoolId, redirectAttributes);
    }
    
    // 평면도 메인 페이지
    @GetMapping("")
    public String floorPlanMain(Model model, RedirectAttributes redirectAttributes) {
        // 권한 체크
        User user = checkPermission(Feature.FLOORPLAN_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        List<School> schools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", schools);
        
        // 권한 정보 추가
        permissionHelper.addPermissionAttributes(user, model);
        
        return "floorplan/main";
    }
    
    // 기존 API: 학교별 평면도 데이터 조회 (하위 호환성)
    @GetMapping("/api/school/{schoolId}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getSchoolFloorPlan(@PathVariable Long schoolId) {
        Map<String, Object> response = new java.util.HashMap<>();
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.put("error", "로그인이 필요합니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.put("error", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.FLOORPLAN_MANAGEMENT, schoolId, null);
        if (checkedUser == null) {
            response.put("error", "해당 학교에 대한 권한이 없습니다.");
            return ResponseEntity.status(403).body(response);
        }
        
        try {
            // 기존 FloorPlanService의 메서드 사용
            Map<String, Object> floorPlanData = floorPlanService.getSchoolFloorPlan(schoolId);
            return ResponseEntity.ok(floorPlanData);
        } catch (Exception e) {
            e.printStackTrace();
            response.put("error", "평면도 데이터 조회 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * 평면도 저장 API
     */
    @PostMapping("/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveFloorPlan(
            @RequestParam Long schoolId,
            @RequestBody Map<String, Object> floorPlanData) {
        
        Map<String, Object> response = new java.util.HashMap<>();
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.put("error", "로그인이 필요합니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.put("error", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.FLOORPLAN_MANAGEMENT, schoolId, null);
        if (checkedUser == null) {
            response.put("error", "해당 학교에 대한 권한이 없습니다.");
            return ResponseEntity.status(403).body(response);
        }
        
        try {
            boolean success = floorPlanService.saveFloorPlan(schoolId, floorPlanData);
            
            if (success) {
                response.put("success", true);
                response.put("message", "평면도가 성공적으로 저장되었습니다.");
            } else {
                response.put("success", false);
                response.put("message", "평면도 저장에 실패했습니다.");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "평면도 저장 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 평면도 로드 API
     */
    @GetMapping("/load")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> loadFloorPlan(@RequestParam Long schoolId) {
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("error", "로그인이 필요합니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("error", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.FLOORPLAN_MANAGEMENT, schoolId, null);
        if (checkedUser == null) {
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("error", "해당 학교에 대한 권한이 없습니다.");
            return ResponseEntity.status(403).body(response);
        }
        
        Map<String, Object> response = floorPlanService.loadFloorPlan(schoolId);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 평면도 존재 여부 확인 API
     */
    @GetMapping("/exists")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> checkFloorPlanExists(@RequestParam Long schoolId) {
        
        Map<String, Object> response = new java.util.HashMap<>();
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.put("error", "로그인이 필요합니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.put("error", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.FLOORPLAN_MANAGEMENT, schoolId, null);
        if (checkedUser == null) {
            response.put("error", "해당 학교에 대한 권한이 없습니다.");
            return ResponseEntity.status(403).body(response);
        }
        
        try {
            boolean exists = floorPlanService.hasFloorPlan(schoolId);
            response.put("success", true);
            response.put("exists", exists);
            
        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "평면도 확인 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 평면도 삭제 API
     */
    @DeleteMapping("/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteFloorPlan(@RequestParam Long schoolId) {
        
        Map<String, Object> response = new java.util.HashMap<>();
        
        // 권한 체크
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.put("error", "로그인이 필요합니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            response.put("error", "사용자를 찾을 수 없습니다.");
            return ResponseEntity.status(401).body(response);
        }
        
        User checkedUser = permissionHelper.checkSchoolPermission(user, Feature.FLOORPLAN_MANAGEMENT, schoolId, null);
        if (checkedUser == null) {
            response.put("error", "해당 학교에 대한 권한이 없습니다.");
            return ResponseEntity.status(403).body(response);
        }
        
        try {
            boolean success = floorPlanService.deleteFloorPlan(schoolId);
            
            if (success) {
                response.put("success", true);
                response.put("message", "평면도가 성공적으로 삭제되었습니다.");
            } else {
                response.put("success", false);
                response.put("message", "평면도 삭제에 실패했습니다.");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "평면도 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 교실별 장비 정보 조회 API
     */
    @GetMapping("/api/classroom/{classroomId}/devices")
    @ResponseBody
    public ResponseEntity<Map<String, Integer>> getClassroomDevices(@PathVariable Long classroomId) {
        Map<String, Integer> deviceCounts = new HashMap<>();
        
        try {
            List<Device> devices = deviceService.findByClassroom(classroomId);
            
            // 장비 타입별로 개수 집계
            Map<String, Long> typeCounts = devices.stream()
                .collect(Collectors.groupingBy(
                    Device::getType,
                    Collectors.counting()
                ));
            
            // Long을 Integer로 변환
            typeCounts.forEach((type, count) -> deviceCounts.put(type, count.intValue()));
            
            return ResponseEntity.ok(deviceCounts);
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(deviceCounts); // 빈 맵 반환
        }
    }
    
    /**
     * 여러 교실의 장비 정보 배치 조회 API (성능 최적화)
     */
    @PostMapping("/api/classrooms/devices/batch")
    @ResponseBody
    public ResponseEntity<Map<String, Map<String, Integer>>> getClassroomsDevicesBatch(
            @RequestBody Map<String, List<Long>> request) {
        
        Map<String, Map<String, Integer>> response = new HashMap<>();
        
        try {
            List<Long> classroomIds = request.get("classroomIds");
            if (classroomIds == null || classroomIds.isEmpty()) {
                return ResponseEntity.ok(response);
            }
            
            // 각 교실별로 장비 조회 (기존 메서드 활용)
            for (Long classroomId : classroomIds) {
                try {
                    List<Device> devices = deviceService.findByClassroom(classroomId);
                    
                    // 장비 타입별로 개수 집계
                    Map<String, Long> typeCounts = devices.stream()
                        .collect(Collectors.groupingBy(
                            Device::getType,
                            Collectors.counting()
                        ));
                    
                    // 응답 형식으로 변환
                    Map<String, Integer> deviceCounts = new HashMap<>();
                    typeCounts.forEach((type, count) -> 
                        deviceCounts.put(type, count.intValue()));
                    
                    response.put(classroomId.toString(), deviceCounts);
                    
                } catch (Exception e) {
                    // 개별 교실 조회 실패 시 빈 맵으로 처리
                    response.put(classroomId.toString(), new HashMap<>());
                }
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(response); // 빈 맵 반환
        }
    }
    
    // 교실 배치 정보 조회 API (평면도 뷰어용)
    @PostMapping("/api/classrooms/batch")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getClassroomsBatch(
            @RequestBody Map<String, List<Long>> request) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<Long> classroomIds = request.get("classroomIds");
            if (classroomIds == null || classroomIds.isEmpty()) {
                return ResponseEntity.ok(response);
            }
            
            // 각 교실별로 정보 조회
            for (Long classroomId : classroomIds) {
                try {
                    Optional<Classroom> classroomOpt = classroomService.getClassroomById(classroomId);
                    if (classroomOpt.isPresent()) {
                        Classroom classroom = classroomOpt.get();
                        Map<String, Object> classroomInfo = new HashMap<>();
                        classroomInfo.put("roomName", classroom.getRoomName());
                        classroomInfo.put("classroomId", classroom.getClassroomId());
                        classroomInfo.put("schoolId", classroom.getSchool() != null ? classroom.getSchool().getSchoolId() : null);
                        
                        response.put(classroomId.toString(), classroomInfo);
                    }
                } catch (Exception e) {
                    // 개별 교실 조회 실패 시 빈 맵으로 처리
                    response.put(classroomId.toString(), new HashMap<>());
                }
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(response); // 빈 맵 반환
        }
    }

} 