package com.inet.controller;

import com.inet.entity.Feature;
import com.inet.entity.User;
import com.inet.service.FloorPlanService;
import com.inet.service.SchoolService;
import com.inet.service.DeviceService;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.service.PPTExportService;
import com.inet.config.PermissionHelper;
import com.inet.entity.School;
import com.inet.entity.Device;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.stream.Collectors;
import com.inet.service.ClassroomService;
import com.inet.entity.Classroom;

/**
 * 평면도 컨트롤러
 * RESTful API 원칙 준수 및 에러 응답 표준화
 */
@Controller
@RequestMapping("/floorplan")
public class FloorPlanController {
    
    private static final Logger logger = LoggerFactory.getLogger(FloorPlanController.class);
    
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
    
    @Autowired
    private PPTExportService pptExportService;
    
    /**
     * 평면도 메인 페이지
     */
    @GetMapping("")
    public String floorPlanMain(Model model, RedirectAttributes redirectAttributes) {
        User user = checkPermission(Feature.FLOORPLAN_MANAGEMENT, redirectAttributes);
        if (user == null) {
            return "redirect:/";
        }
        
        List<School> schools = schoolPermissionService.getAccessibleSchools(user);
        model.addAttribute("schools", schools);
        
        permissionHelper.addPermissionAttributes(user, model);
        
        return "floorplan/main";
    }
    
    // ===== RESTful API =====
    
    /**
     * 평면도 조회
     * GET /floorplan/api/schools/{schoolId}
     */
    @GetMapping("/api/schools/{schoolId}")
    @ResponseBody
    public ResponseEntity<ApiResponse> getFloorPlan(@PathVariable Long schoolId) {
        try {
            // 권한 체크
            User user = getCurrentUser();
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("로그인이 필요합니다."));
            }
            
            if (!hasSchoolPermission(user, schoolId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("해당 학교에 대한 권한이 없습니다."));
            }
            
            // 평면도 로드
            Map<String, Object> floorPlanData = floorPlanService.loadFloorPlan(schoolId);
            
            if (floorPlanData.containsKey("success") && 
                Boolean.FALSE.equals(floorPlanData.get("success"))) {
                String message = (String) floorPlanData.getOrDefault("message", "평면도를 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(message));
            }
            
            return ResponseEntity.ok(ApiResponse.success(floorPlanData));
            
        } catch (Exception e) {
            logger.error("평면도 조회 실패 - schoolId: {}", schoolId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("평면도 조회 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
    
    /**
     * 평면도 저장
     * PUT /floorplan/api/schools/{schoolId}
     */
    @PutMapping("/api/schools/{schoolId}")
    @ResponseBody
    public ResponseEntity<ApiResponse> saveFloorPlan(
            @PathVariable Long schoolId,
            @RequestBody Map<String, Object> floorPlanData) {
        
        try {
            // 권한 체크
            User user = getCurrentUser();
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("로그인이 필요합니다."));
            }
            
            if (!hasSchoolPermission(user, schoolId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("해당 학교에 대한 권한이 없습니다."));
            }
            
            // 평면도 저장
            boolean success = floorPlanService.saveFloorPlan(schoolId, floorPlanData);
            
            if (success) {
                return ResponseEntity.ok(ApiResponse.success("평면도가 성공적으로 저장되었습니다."));
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("평면도 저장에 실패했습니다."));
            }
            
        } catch (IllegalArgumentException e) {
            logger.warn("평면도 저장 실패 - 잘못된 요청: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(e.getMessage()));
                
        } catch (Exception e) {
            logger.error("평면도 저장 실패 - schoolId: {}", schoolId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("평면도 저장 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
    
    /**
     * 평면도 삭제
     * DELETE /floorplan/api/schools/{schoolId}
     */
    @DeleteMapping("/api/schools/{schoolId}")
    @ResponseBody
    public ResponseEntity<ApiResponse> deleteFloorPlan(@PathVariable Long schoolId) {
        try {
            // 권한 체크
            User user = getCurrentUser();
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("로그인이 필요합니다."));
            }
            
            if (!hasSchoolPermission(user, schoolId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("해당 학교에 대한 권한이 없습니다."));
            }
            
            // 평면도 삭제
            boolean success = floorPlanService.deleteFloorPlan(schoolId);
            
            if (success) {
                return ResponseEntity.ok(ApiResponse.success("평면도가 성공적으로 삭제되었습니다."));
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("평면도 삭제에 실패했습니다."));
            }
            
        } catch (Exception e) {
            logger.error("평면도 삭제 실패 - schoolId: {}", schoolId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("평면도 삭제 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
    
    /**
     * 평면도 존재 여부 확인
     * GET /floorplan/api/schools/{schoolId}/exists
     */
    @GetMapping("/api/schools/{schoolId}/exists")
    @ResponseBody
    public ResponseEntity<ApiResponse> checkFloorPlanExists(@PathVariable Long schoolId) {
        try {
            // 권한 체크
            User user = getCurrentUser();
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("로그인이 필요합니다."));
            }
            
            if (!hasSchoolPermission(user, schoolId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("해당 학교에 대한 권한이 없습니다."));
            }
            
            boolean exists = floorPlanService.hasFloorPlan(schoolId);
            Map<String, Object> data = Map.of("exists", exists);
            
            return ResponseEntity.ok(ApiResponse.success(data));
            
        } catch (Exception e) {
            logger.error("평면도 존재 확인 실패 - schoolId: {}", schoolId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("평면도 확인 중 오류가 발생했습니다: " + e.getMessage()));
        }
    }
    
    // ===== 하위 호환성을 위한 기존 API =====
    
    /**
     * 기존 API: 평면도 저장
     * POST /floorplan/save?schoolId={schoolId}
     */
    @PostMapping("/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveFloorPlanLegacy(
            @RequestParam Long schoolId,
            @RequestBody Map<String, Object> floorPlanData) {
        
        ResponseEntity<ApiResponse> response = saveFloorPlan(schoolId, floorPlanData);
        return ResponseEntity.status(response.getStatusCode())
            .body(response.getBody().toMap());
    }
    
    /**
     * 기존 API: 평면도 로드
     * GET /floorplan/load?schoolId={schoolId}
     */
    @GetMapping("/load")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> loadFloorPlanLegacy(@RequestParam Long schoolId) {
        ResponseEntity<ApiResponse> response = getFloorPlan(schoolId);
        return ResponseEntity.status(response.getStatusCode())
            .body(response.getBody().toMap());
    }
    
    /**
     * 기존 API: 평면도 존재 여부
     * GET /floorplan/exists?schoolId={schoolId}
     */
    @GetMapping("/exists")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> checkFloorPlanExistsLegacy(@RequestParam Long schoolId) {
        ResponseEntity<ApiResponse> response = checkFloorPlanExists(schoolId);
        return ResponseEntity.status(response.getStatusCode())
            .body(response.getBody().toMap());
    }
    
    /**
     * 기존 API: 평면도 삭제
     * DELETE /floorplan/delete?schoolId={schoolId}
     */
    @DeleteMapping("/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteFloorPlanLegacy(@RequestParam Long schoolId) {
        ResponseEntity<ApiResponse> response = deleteFloorPlan(schoolId);
        return ResponseEntity.status(response.getStatusCode())
            .body(response.getBody().toMap());
    }
    
    /**
     * 기존 API: 학교별 평면도 데이터 조회
     * GET /floorplan/api/school/{schoolId}
     */
    @GetMapping("/api/school/{schoolId}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getSchoolFloorPlanLegacy(@PathVariable Long schoolId) {
        try {
            User user = getCurrentUser();
            if (user == null || !hasSchoolPermission(user, schoolId)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "권한이 없습니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
            }
            
            Map<String, Object> floorPlanData = floorPlanService.getSchoolFloorPlan(schoolId);
            return ResponseEntity.ok(floorPlanData);
            
        } catch (Exception e) {
            logger.error("평면도 데이터 조회 실패", e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "평면도 데이터 조회 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // ===== 교실/장비 관련 API =====
    
    /**
     * 교실별 장비 정보 조회
     * GET /floorplan/api/classroom/{classroomId}/devices
     */
    @GetMapping("/api/classroom/{classroomId}/devices")
    @ResponseBody
    public ResponseEntity<Map<String, Integer>> getClassroomDevices(@PathVariable Long classroomId) {
        Map<String, Integer> deviceCounts = new HashMap<>();
        
        try {
            List<Device> devices = deviceService.findByClassroom(classroomId);
            
            Map<String, Long> typeCounts = devices.stream()
                .collect(Collectors.groupingBy(
                    Device::getType,
                    Collectors.counting()
                ));
            
            typeCounts.forEach((type, count) -> deviceCounts.put(type, count.intValue()));
            
            return ResponseEntity.ok(deviceCounts);
            
        } catch (Exception e) {
            logger.error("교실 장비 조회 실패 - classroomId: {}", classroomId, e);
            return ResponseEntity.ok(deviceCounts);
        }
    }
    
    /**
     * 여러 교실의 장비 정보 배치 조회
     * POST /floorplan/api/classrooms/devices/batch
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
            
            for (Long classroomId : classroomIds) {
                try {
                    List<Device> devices = deviceService.findByClassroom(classroomId);
                    
                    Map<String, Long> typeCounts = devices.stream()
                        .collect(Collectors.groupingBy(
                            Device::getType,
                            Collectors.counting()
                        ));
                    
                    Map<String, Integer> deviceCounts = new HashMap<>();
                    typeCounts.forEach((type, count) -> 
                        deviceCounts.put(type, count.intValue()));
                    
                    response.put(classroomId.toString(), deviceCounts);
                    
                } catch (Exception e) {
                    response.put(classroomId.toString(), new HashMap<>());
                }
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("교실 장비 배치 조회 실패", e);
            return ResponseEntity.ok(response);
        }
    }
    
    /**
     * 교실 배치 정보 조회
     * POST /floorplan/api/classrooms/batch
     */
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
            
            for (Long classroomId : classroomIds) {
                try {
                    Optional<Classroom> classroomOpt = classroomService.getClassroomById(classroomId);
                    if (classroomOpt.isPresent()) {
                        Classroom classroom = classroomOpt.get();
                        Map<String, Object> classroomInfo = new HashMap<>();
                        classroomInfo.put("roomName", classroom.getRoomName());
                        classroomInfo.put("classroomId", classroom.getClassroomId());
                        classroomInfo.put("schoolId", classroom.getSchool() != null ? 
                            classroom.getSchool().getSchoolId() : null);
                        
                        response.put(classroomId.toString(), classroomInfo);
                    }
                } catch (Exception e) {
                    response.put(classroomId.toString(), new HashMap<>());
                }
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("교실 배치 조회 실패", e);
            return ResponseEntity.ok(response);
        }
    }
    
    /**
     * PPT 내보내기
     * GET /floorplan/export/ppt?schoolId={schoolId}
     */
    @GetMapping("/export/ppt")
    @ResponseBody
    public ResponseEntity<byte[]> exportToPPT(@RequestParam Long schoolId) {
        try {
            User user = getCurrentUser();
            if (user == null || !hasSchoolPermission(user, schoolId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("권한이 없습니다.".getBytes());
            }
            
            Optional<School> schoolOpt = schoolService.findById(schoolId);
            if (!schoolOpt.isPresent()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("학교를 찾을 수 없습니다.".getBytes());
            }
            
            School school = schoolOpt.get();
            
            java.io.ByteArrayOutputStream pptStream = pptExportService.exportFloorPlanToPPT(schoolId);
            byte[] pptBytes = pptStream.toByteArray();
            
            String fileName = String.format("평면도_%s_%s.pptx", 
                school.getSchoolName(),
                java.time.LocalDateTime.now().format(
                    java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
            );
            
            String encodedFileName = java.net.URLEncoder.encode(fileName, "UTF-8")
                .replaceAll("\\+", "%20");
            
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"));
            headers.setContentDispositionFormData("attachment", encodedFileName);
            headers.setContentLength(pptBytes.length);
            
            return ResponseEntity.ok()
                .headers(headers)
                .body(pptBytes);
                
        } catch (Exception e) {
            logger.error("PPT 내보내기 실패 - schoolId: {}", schoolId, e);
            String errorMessage = "PPT 파일 생성 중 오류가 발생했습니다: " + e.getMessage();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorMessage.getBytes());
        }
    }
    
    // ===== 유틸리티 메서드 =====
    
    /**
     * 현재 사용자 조회
     */
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        return userService.findByUsername(auth.getName()).orElse(null);
    }
    
    /**
     * 학교 권한 확인
     */
    private boolean hasSchoolPermission(User user, Long schoolId) {
        return permissionHelper.checkSchoolPermission(
            user, Feature.FLOORPLAN_MANAGEMENT, schoolId, null) != null;
    }
    
    /**
     * 권한 체크 (리다이렉트용)
     */
    private User checkPermission(Feature feature, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            redirectAttributes.addFlashAttribute("error", "로그인이 필요합니다.");
            return null;
        }
        
        User user = userService.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            redirectAttributes.addFlashAttribute("error", "사용자를 찾을 수 없습니다.");
            return null;
        }
        
        return permissionHelper.checkFeaturePermission(user, feature, redirectAttributes);
    }
    
    /**
     * API 응답 표준화 클래스
     */
    public static class ApiResponse {
        private boolean success;
        private String message;
        private Object data;
        
        public ApiResponse(boolean success, String message, Object data) {
            this.success = success;
            this.message = message;
            this.data = data;
        }
        
        public static ApiResponse success(Object data) {
            return new ApiResponse(true, null, data);
        }
        
        public static ApiResponse success(String message) {
            return new ApiResponse(true, message, null);
        }
        
        public static ApiResponse error(String message) {
            return new ApiResponse(false, message, null);
        }
        
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("success", success);
            if (message != null) {
                map.put("message", message);
            }
            if (data != null) {
                if (data instanceof Map) {
                    map.putAll((Map<String, Object>) data);
                } else {
                    map.put("data", data);
                }
            }
            return map;
        }
        
        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
        public Object getData() { return data; }
    }
}
